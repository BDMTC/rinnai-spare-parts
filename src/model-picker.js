/**
 * Model / series typeahead — filter across marketing names, REU codes, aliases.
 *
 * Restricted / NLA rows stay visible (greyed) and arrow-highlightable, but
 * keyboard confirm (Enter) must NOT select them — only an explicit mouse click
 * opens the unlock confirm dialog. Ranking always puts unrestricted / active
 * pins first; restricted (NLA, export-only, use-up, Only for xyz, Desc 2) last.
 */

import { getModelLabel, getModelDisplayName } from "./search.js";
import {
  getModelCommercialName,
  getModelShortCode,
} from "./model-commercial-name.js";
import {
  listSeries,
  modelBelongsToSeries,
  modelIdsForSeries,
  seriesForModel,
  normalise,
} from "./series.js";
import {
  isModelRestricted,
  restrictionForPin,
} from "./restriction.js";

/**
 * Score a normalised haystack against query (normalised + raw).
 * @param {string[]} haystacksNorm
 * @param {string} qNorm
 * @param {string} qRaw
 */
function scoreMatch(haystacksNorm, qNorm, qRaw) {
  if (!qNorm) return 0;
  let best = 0;
  const qLower = String(qRaw || "").trim().toLowerCase();
  for (const h of haystacksNorm) {
    if (!h) continue;
    if (h === qNorm) best = Math.max(best, 100);
    else if (h.startsWith(qNorm)) best = Math.max(best, 80);
    else if (h.includes(qNorm)) best = Math.max(best, 55);
  }
  // Soft: spaced marketing like "hd 200" already normalised; also raw includes
  if (best === 0 && qLower.length >= 2) {
    for (const h of haystacksNorm) {
      if (h.includes(qNorm)) best = Math.max(best, 40);
    }
  }
  return best;
}

/**
 * Annotate a suggestion with restriction metadata.
 * @param {object} suggestion
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 */
function withRestriction(suggestion, catalogue, seriesDoc) {
  const info = restrictionForPin(catalogue, seriesDoc, suggestion.value, {
    listSeries,
    modelIdsForSeries,
  });
  const restricted = Boolean(info?.restricted);
  return {
    ...suggestion,
    restricted,
    restriction: info,
    restrictionLabel: info?.label || null,
  };
}

/**
 * Build typeahead suggestions for the model pin field.
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Array<object>}
 */
export function suggestModelPins(catalogue, seriesDoc, query, opts = {}) {
  const limit = opts.limit ?? 14;
  const qRaw = String(query || "").trim();
  const qNorm = normalise(qRaw);
  const results = [];

  if (!qNorm) {
    // Empty: surface primary series pins for discovery
    for (const series of listSeries(seriesDoc)) {
      if (
        !/^(hd28e?|hd28i|hd200e|hd200i|hd210e|hd210i|hd32|hdc32e?|hdc32i|hd250e|hdc211e?|hdc211i|infinity26|infinity32)/i.test(
          series.id
        )
      ) {
        continue;
      }
      const count = modelIdsForSeries(catalogue, series).length;
      results.push(
        withRestriction(
          {
            kind: "series",
            value: `series:${series.id}`,
            label: series.label,
            subtitle: seriesSubtitle(series, count),
            series,
            model: null,
            score: 10,
          },
          catalogue,
          seriesDoc
        )
      );
    }
    return rankSuggestions(results).slice(0, limit);
  }

  for (const series of listSeries(seriesDoc)) {
    const tokens = [
      series.id,
      series.label,
      ...(series.aliases || []),
      ...(series.documentKeys || []),
    ].map(normalise);
    let score = scoreMatch(tokens, qNorm, qRaw);
    if (score <= 0) continue;
    // Boost short marketing labels (HD200e) when query is prefix of label
    if (normalise(series.label).startsWith(qNorm)) score += 15;
    // Chassis queries (VRM2632) should still rank series high
    if (/^\d/.test(qNorm) === false && /VRM|VCM|REU/.test(qNorm)) {
      score += 5;
    }
    const count = modelIdsForSeries(catalogue, series).length;
    results.push(
      withRestriction(
        {
          kind: "series",
          value: `series:${series.id}`,
          label: series.label,
          subtitle: seriesSubtitle(series, count),
          series,
          model: null,
          score,
        },
        catalogue,
        seriesDoc
      )
    );
  }

  for (const model of catalogue?.models || []) {
    const series = seriesForModel(catalogue, seriesDoc, model);
    const shortCode = getModelShortCode(model);
    const commercial = getModelCommercialName(model, series);
    const display = getModelDisplayName(model, series);
    const tokens = [
      model.id,
      model.sku,
      model.marketingCode,
      model.itemNumber,
      model.name,
      model.description,
      shortCode,
      commercial,
      display,
      series?.label,
      ...(series?.aliases || []),
    ].map(normalise);
    let score = scoreMatch(tokens, qNorm, qRaw);
    if (score <= 0) continue;
    // Slight boost when chassis/query hits via series membership
    if (series && modelBelongsToSeries(model, series)) {
      const seriesTokens = [
        series.label,
        ...(series.aliases || []),
        ...(series.documentKeys || []),
      ].map(normalise);
      if (seriesTokens.some((t) => t.includes(qNorm) || qNorm.includes(t))) {
        score += 8;
      }
    }
    const label =
      shortCode && commercial && commercial !== shortCode
        ? `${shortCode} · ${commercial}`
        : shortCode || display;
    results.push(
      withRestriction(
        {
          kind: "model",
          value: model.id,
          // Short marketing code, then readable commercial name (same title row)
          label,
          subtitle: modelSubtitle(model, series, commercial),
          series: series || null,
          model,
          score,
        },
        catalogue,
        seriesDoc
      )
    );
  }

  return rankSuggestions(results).slice(0, limit);
}

/**
 * Unrestricted first (existing relevance inside the band), then restricted/greyed.
 * @param {Array<object>} results
 */
function rankSuggestions(results) {
  return results.sort((a, b) => {
    // Active / unrestricted first; NLA / export / use-up / restricted grey rows last
    const aRestricted = a.restricted ? 1 : 0;
    const bRestricted = b.restricted ? 1 : 0;
    if (aRestricted !== bRestricted) return aRestricted - bRestricted;
    // Always prefer series pins ahead of individual models when both match
    if (a.kind !== b.kind) {
      const aSeries = a.kind === "series" ? 1 : 0;
      const bSeries = b.kind === "series" ? 1 : 0;
      if (bSeries !== aSeries) return bSeries - aSeries;
    }
    if (b.score !== a.score) return b.score - a.score;
    return String(a.label).localeCompare(String(b.label));
  });
}

function seriesSubtitle(series, count) {
  const bits = [];
  if (series.provisional) bits.push("provisional");
  if (series.region) bits.push(series.region);
  if (series.status) bits.push(series.status);
  const aliases = series.aliases || [];
  // Prefer hyphen REU schema (REU-VRM3237WC) over short chassis (VRM3237WC).
  const alias =
    aliases.find((a) => /^REU-/i.test(String(a))) ||
    aliases.find((a) => /VRM|VCM|REU-/i.test(String(a)));
  if (alias) bits.push(alias);
  bits.push(`${count} model${count === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

function modelSubtitle(model, series, commercialName = "") {
  const bits = [];
  // Commercial name lives on the title row; subtitle keeps chassis / restriction.
  if (series?.label) bits.push(series.label);
  if (isModelRestricted(model) && model.restrictionLabel) {
    bits.push(model.restrictionLabel);
  }
  if (model.itemNumber) bits.push(model.itemNumber);
  // If we somehow lack a commercial title, surface it here as a fallback.
  const shortCode = getModelShortCode(model);
  const commercial =
    commercialName || getModelCommercialName(model, series);
  if (
    commercial &&
    commercial !== shortCode &&
    !bits.some((b) => b === commercial)
  ) {
    // Only when title could not include it (no short code)
    if (!shortCode) bits.unshift(commercial);
  }
  return bits.join(" · ");
}

/**
 * Human label for a resolved pin value.
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string|null} pinValue
 */
export function labelForPinValue(catalogue, seriesDoc, pinValue) {
  if (!pinValue) return "";
  if (String(pinValue).startsWith("series:")) {
    const sid = String(pinValue).slice("series:".length);
    const series = listSeries(seriesDoc).find((s) => s.id === sid);
    return series?.label || sid;
  }
  const model = (catalogue?.models || []).find((m) => m.id === pinValue);
  if (!model) return "";
  const series = seriesForModel(catalogue, seriesDoc, model);
  const shortCode = getModelShortCode(model);
  const commercial = getModelCommercialName(model, series);
  if (shortCode && commercial && commercial !== shortCode) {
    return `${shortCode} · ${commercial}`;
  }
  return (
    shortCode ||
    getModelDisplayName(model, series) ||
    getModelLabel(model)
  );
}

/**
 * Mount combobox behaviour on a model-picker root element.
 * Root must contain: input#model-input, button.clear, ul[role=listbox], hidden input#model-pin
 *
 * @param {HTMLElement} root
 * @param {{
 *   catalogue: object,
 *   seriesDoc: object,
 *   onChange: () => void,
 *   isPinUnlocked?: (pinValue: string) => boolean,
 *   requestUnlock?: (suggestion: object) => Promise<boolean>|boolean,
 * }} ctx
 */
export function bindModelPicker(root, ctx) {
  const input = root.querySelector("#model-input");
  const hidden = root.querySelector("#model-pin");
  const list = root.querySelector("#model-listbox");
  const clearBtn = root.querySelector("#model-clear");
  if (!input || !hidden || !list) return;

  let open = false;
  let activeIndex = -1;
  /** @type {Array<object>} */
  let suggestions = [];
  /** Prevent blur-restore while unlock dialog is open */
  let unlockPending = false;

  function setPin(value, label) {
    hidden.value = value || "";
    if (label != null) input.value = label;
    else if (!value) input.value = "";
    updateClear();
    ctx.onChange();
  }

  function updateClear() {
    if (!clearBtn) return;
    clearBtn.hidden = !hidden.value && !input.value;
  }

  function closeList() {
    open = false;
    activeIndex = -1;
    list.hidden = true;
    list.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function renderList() {
    list.innerHTML = "";
    if (!suggestions.length) {
      const empty = document.createElement("li");
      empty.className = "model-option model-option--empty";
      empty.textContent = "No matching models or series";
      empty.setAttribute("role", "presentation");
      list.appendChild(empty);
      list.hidden = false;
      open = true;
      input.setAttribute("aria-expanded", "true");
      return;
    }

    suggestions.forEach((s, i) => {
      const li = document.createElement("li");
      li.id = `model-opt-${i}`;
      li.className = "model-option";
      if (s.restricted) li.classList.add("model-option--restricted");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      if (s.restricted) {
        li.setAttribute("aria-disabled", "false");
        li.title =
          "Restricted unit — click to confirm unlock (keyboard Enter will not select)";
      }
      if (i === activeIndex) li.classList.add("is-active");
      li.dataset.value = s.value;
      const kindLabel = s.restricted
        ? s.restrictionLabel || "Restricted"
        : s.kind === "series"
          ? "Series"
          : "Model";
      li.innerHTML = `
        <span class="model-option-label">${escapeHtml(s.label)}</span>
        <span class="model-option-sub">${escapeHtml(s.subtitle || "")}</span>
        <span class="model-option-kind">${escapeHtml(kindLabel)}</span>
      `;
      // Mouse / pointer only — keyboard must not synthesise this path.
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(i, { fromKeyboard: false });
      });
      list.appendChild(li);
    });
    list.hidden = false;
    open = true;
    input.setAttribute("aria-expanded", "true");
    if (activeIndex >= 0) {
      input.setAttribute("aria-activedescendant", `model-opt-${activeIndex}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function refreshSuggestions() {
    // If a pin is locked and input still shows its label, typing replaces filter
    suggestions = suggestModelPins(
      ctx.catalogue,
      ctx.seriesDoc,
      input.value,
      { limit: 14 }
    );
    activeIndex = suggestions.length ? 0 : -1;
    renderList();
  }

  /**
   * @param {number} index
   * @param {{ fromKeyboard?: boolean }} [opts]
   */
  async function choose(index, opts = {}) {
    const fromKeyboard = Boolean(opts.fromKeyboard);
    const s = suggestions[index];
    if (!s) return;

    // Restricted rows: keyboard confirm is blocked. Only an explicit click
    // may open the unlock dialog (or pin if already unlocked this session).
    if (s.restricted && fromKeyboard) {
      return;
    }

    if (s.restricted) {
      const already =
        typeof ctx.isPinUnlocked === "function" &&
        ctx.isPinUnlocked(s.value);
      if (!already) {
        if (typeof ctx.requestUnlock !== "function") return;
        unlockPending = true;
        closeList();
        let ok = false;
        try {
          ok = Boolean(await ctx.requestUnlock(s));
        } finally {
          unlockPending = false;
        }
        if (!ok) {
          // Cancelled — leave input as typed filter text, no pin.
          updateClear();
          input.focus();
          return;
        }
      }
    }

    setPin(s.value, s.label);
    closeList();
    input.blur();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  input.addEventListener("focus", () => {
    if (!unlockPending) refreshSuggestions();
  });

  input.addEventListener("input", () => {
    // Typing clears the committed pin until a suggestion is chosen
    if (hidden.value) hidden.value = "";
    updateClear();
    refreshSuggestions();
    ctx.onChange();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) refreshSuggestions();
      if (!suggestions.length) return;
      activeIndex = (activeIndex + 1) % suggestions.length;
      renderList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) refreshSuggestions();
      if (!suggestions.length) return;
      activeIndex =
        (activeIndex - 1 + suggestions.length) % suggestions.length;
      renderList();
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        // Keyboard confirm — restricted rows are ignored (click required).
        choose(activeIndex, { fromKeyboard: true });
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (open) closeList();
      else if (hidden.value || input.value) {
        setPin("", "");
        closeList();
      }
    }
  });

  input.addEventListener("blur", () => {
    // Delay so mousedown on option can fire
    setTimeout(() => {
      if (unlockPending) return;
      closeList();
      // If pin set, restore canonical label; if not, leave typed text cleared
      if (hidden.value) {
        input.value = labelForPinValue(
          ctx.catalogue,
          ctx.seriesDoc,
          hidden.value
        );
      }
      updateClear();
    }, 120);
  });

  if (clearBtn) {
    clearBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      setPin("", "");
      closeList();
      input.focus();
    });
  }

  updateClear();

  return {
    getValue: () => hidden.value || null,
    setValue: (value) => {
      setPin(value, labelForPinValue(ctx.catalogue, ctx.seriesDoc, value));
    },
  };
}
