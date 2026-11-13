/**
 * Dual pin typeahead — Pin 1 series (commercial name), Pin 2 full Item Number
 * filtered to the selected series. Restricted / NLA rows stay visible (greyed);
 * keyboard Enter must NOT select them — click opens unlock confirm.
 */

import { getModelLabel, getModelDisplayName } from "./search.js";
import {
  getModelCommercialName,
  getModelFuelKind,
  getModelShortCode,
  getSeriesCommercialName,
} from "./model-commercial-name.js";
import {
  listSeries,
  modelBelongsToSeries,
  modelIdsForSeries,
  seriesForModel,
  normalise,
  findSeries,
} from "./series.js";
import {
  isModelRestricted,
  restrictionForPin,
} from "./restriction.js";
import { outletTempFromModel } from "./reu-format.js";

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
 * Pin 1 — series only (marketing label · commercial name).
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 */
export function suggestSeriesPins(catalogue, seriesDoc, query, opts = {}) {
  const limit = opts.limit ?? 14;
  const qRaw = String(query || "").trim();
  const qNorm = normalise(qRaw);
  const results = [];

  const primaryEmpty =
    /^(hd28e|hd28i|hd200e|hd200i|hd210e|hd210i|hd32|hdc32e?|hdc32i|hd250e|hdc211e?|hdc211i|infinity26|infinity28|infinity32|solar28)/i;

  for (const series of listSeries(seriesDoc)) {
    const commercial = getSeriesCommercialName(series);
    const tokens = [
      series.id,
      series.label,
      commercial,
      ...(series.aliases || []),
      ...(series.documentKeys || []),
    ].map(normalise);

    let score;
    if (!qNorm) {
      if (!primaryEmpty.test(series.id)) continue;
      score = 10;
    } else {
      score = scoreMatch(tokens, qNorm, qRaw);
      if (score <= 0) continue;
      if (normalise(series.label).startsWith(qNorm)) score += 15;
      if (/VRM|VCM|REU|N3237|AM2626|KM3237/i.test(qNorm)) score += 5;
    }

    const count = modelIdsForSeries(catalogue, series).length;
    results.push(
      withRestriction(
        {
          kind: "series",
          value: `series:${series.id}`,
          label: seriesPinLabel(series, commercial),
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

  return rankSuggestions(results).slice(0, limit);
}

/**
 * Pin 2 — full Item Number (or marketing SKU) within the pinned series.
 * Commercial names stay visible on the subtitle / title.
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string|null|undefined} seriesId
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 */
export function suggestItemNumberPins(
  catalogue,
  seriesDoc,
  seriesId,
  query,
  opts = {}
) {
  const limit = opts.limit ?? 16;
  if (!seriesId) return [];

  const series =
    listSeries(seriesDoc).find((s) => s.id === seriesId) ||
    findSeries(seriesDoc, seriesId);
  if (!series) return [];

  const qRaw = String(query || "").trim();
  const qNorm = normalise(qRaw);
  const results = [];

  for (const model of catalogue?.models || []) {
    if (!modelBelongsToSeries(model, series)) continue;

    const shortCode = getModelShortCode(model);
    const commercial = getModelCommercialName(model, series);
    const itemNumber = String(model.itemNumber || "").trim();
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
    ].map(normalise);

    let score;
    if (!qNorm) {
      score = 20;
      // Prefer domestic 50° rows slightly when browsing empty
      const temp = outletTempFromModel(model);
      if (temp === 50) score += 5;
      else if (temp != null && temp >= 60) score -= 2;
    } else {
      score = scoreMatch(tokens, qNorm, qRaw);
      if (score <= 0) continue;
      // Exact Item Number / SKU boosts
      if (normalise(itemNumber) === qNorm || normalise(shortCode) === qNorm) {
        score += 25;
      }
    }

    const label = itemPinLabel(model);
    const fuelKind = getModelFuelKind(model, series);
    results.push(
      withRestriction(
        {
          kind: "model",
          value: model.id,
          label,
          subtitle: itemPinSubtitle(model, series, commercial, shortCode),
          series,
          model,
          score,
          fuelKind,
        },
        catalogue,
        seriesDoc
      )
    );
  }

  return rankSuggestions(results, {
    groupFuel: !qNorm,
  }).slice(0, limit);
}

/**
 * Legacy combined suggest (series + models) — kept for callers/tests.
 * Prefer suggestSeriesPins / suggestItemNumberPins for the dual UI.
 */
export function suggestModelPins(catalogue, seriesDoc, query, opts = {}) {
  const limit = opts.limit ?? 14;
  const seriesHits = suggestSeriesPins(catalogue, seriesDoc, query, {
    limit,
  });
  // Without a series filter, still surface a few model Item Numbers for discovery
  const qNorm = normalise(query);
  if (!qNorm) return seriesHits.slice(0, limit);

  const modelHits = [];
  for (const model of catalogue?.models || []) {
    const series = seriesForModel(catalogue, seriesDoc, model);
    const shortCode = getModelShortCode(model);
    const commercial = getModelCommercialName(model, series);
    const tokens = [
      model.id,
      model.sku,
      model.marketingCode,
      model.itemNumber,
      model.name,
      shortCode,
      commercial,
    ].map(normalise);
    const score = scoreMatch(tokens, qNorm, query);
    if (score <= 0) continue;
    modelHits.push(
      withRestriction(
        {
          kind: "model",
          value: model.id,
          label: itemPinLabel(model),
          subtitle: itemPinSubtitle(model, series, commercial, shortCode),
          series: series || null,
          model,
          score,
        },
        catalogue,
        seriesDoc
      )
    );
  }
  return rankSuggestions([...seriesHits, ...modelHits]).slice(0, limit);
}

/**
 * Fuel sort: Nat Gas → LPG → Butane / unknown.
 * @param {string|null|undefined} kind
 */
function fuelSortRank(kind) {
  if (kind === "nat-gas") return 0;
  if (kind === "lpg") return 1;
  if (kind === "butane") return 2;
  return 3;
}

/**
 * Unrestricted first, then restricted/greyed. Series before models when mixed.
 * Pin 2 empty browse: Nat Gas block, then LPG (within active / restricted tiers).
 * @param {Array<object>} results
 * @param {{ groupFuel?: boolean }} [opts]
 */
function rankSuggestions(results, opts = {}) {
  const groupFuel = Boolean(opts.groupFuel);
  return results.sort((a, b) => {
    const aRestricted = a.restricted ? 1 : 0;
    const bRestricted = b.restricted ? 1 : 0;
    if (aRestricted !== bRestricted) return aRestricted - bRestricted;
    if (a.kind !== b.kind) {
      const aSeries = a.kind === "series" ? 1 : 0;
      const bSeries = b.kind === "series" ? 1 : 0;
      if (bSeries !== aSeries) return bSeries - aSeries;
    }
    if (groupFuel) {
      const fuelCmp = fuelSortRank(a.fuelKind) - fuelSortRank(b.fuelKind);
      if (fuelCmp !== 0) return fuelCmp;
    }
    if (b.score !== a.score) return b.score - a.score;
    if (!groupFuel) {
      const fuelCmp = fuelSortRank(a.fuelKind) - fuelSortRank(b.fuelKind);
      if (fuelCmp !== 0) return fuelCmp;
    }
    return String(a.label).localeCompare(String(b.label));
  });
}

/**
 * Series typeahead / pin title: short code · commercial (no fuel/temp).
 * @param {object} series
 * @param {string} [commercialName]
 */
function seriesPinLabel(series, commercialName = "") {
  const short = String(series?.label || "").trim();
  const commercial =
    commercialName || getSeriesCommercialName(series);
  if (short && commercial && commercial !== short) {
    return `${short} · ${commercial}`;
  }
  return short || commercial;
}

/**
 * Colour External (green) / Internal (yellow) in Pin 1 series labels.
 * @param {string} text
 * @returns {string} HTML (escaped, with install spans)
 */
export function highlightInstallLabelHtml(text) {
  return escapeHtml(String(text || "")).replace(
    /\b(External|Internal)\b/g,
    (word) => {
      const kind = word.toLowerCase() === "external" ? "external" : "internal";
      return `<span class="pin-install pin-install--${kind}">${word}</span>`;
    }
  );
}

/**
 * Colour Nat Gas (blue) / LPG (red) in Pin 2 row text (subtitle commercial names).
 * @param {string} text
 * @returns {string} HTML (escaped, with fuel spans)
 */
export function highlightFuelLabelHtml(text) {
  return escapeHtml(String(text || "")).replace(
    /\b(Nat Gas|LPG)\b/g,
    (word) => {
      const kind = word === "LPG" ? "lpg" : "nat-gas";
      return `<span class="pin-fuel pin-fuel--${kind}">${word}</span>`;
    }
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function seriesSubtitle(series, count) {
  const bits = [];
  if (series.provisional) bits.push("provisional");
  if (series.region) bits.push(series.region);
  if (series.status) bits.push(series.status);
  const aliases = series.aliases || [];
  const alias =
    aliases.find((a) => /^REU-/i.test(String(a))) ||
    aliases.find((a) => /VRM|VCM|REU-/i.test(String(a)));
  if (alias) bits.push(alias);
  bits.push(`${count} model${count === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

/**
 * Pin 2 title: full Item Number preferred; else marketing SKU.
 * @param {object} model
 */
function itemPinLabel(model) {
  const item = String(model?.itemNumber || "").trim();
  if (item) return item;
  return getModelShortCode(model) || getModelLabel(model) || model?.id || "";
}

/**
 * Commercial name stays visible; marketing SKU when distinct from Item Number.
 * @param {object} model
 * @param {object|null} series
 * @param {string} [commercialName]
 * @param {string} [shortCode]
 */
function itemPinSubtitle(model, series, commercialName = "", shortCode = "") {
  const bits = [];
  const short = shortCode || getModelShortCode(model);
  const commercial =
    commercialName || getModelCommercialName(model, series);
  if (commercial) bits.push(commercial);
  if (short && short !== itemPinLabel(model)) bits.push(short);
  if (isModelRestricted(model) && model.restrictionLabel) {
    bits.push(model.restrictionLabel);
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
    if (!series) return sid;
    return seriesPinLabel(series);
  }
  const model = (catalogue?.models || []).find((m) => m.id === pinValue);
  if (!model) return "";
  return itemPinLabel(model);
}

/**
 * Mount combobox behaviour on a pin picker root.
 *
 * Root must contain input, clear button, listbox, and hidden value input —
 * either legacy `#model-*` ids or `#series-*` / `#item-*`.
 *
 * @param {HTMLElement} root
 * @param {{
 *   catalogue: object,
 *   seriesDoc: object,
 *   mode: 'series'|'item',
 *   onChange: () => void,
 *   getSeriesId?: () => string|null,
 *   isPinUnlocked?: (pinValue: string) => boolean,
 *   requestUnlock?: (suggestion: object) => Promise<boolean>|boolean,
 * }} ctx
 */
export function bindModelPicker(root, ctx) {
  const mode = ctx.mode || "series";
  const prefix = mode === "item" ? "item" : mode === "series" ? "series" : "model";

  const input =
    root.querySelector(`#${prefix}-input`) ||
    root.querySelector("#model-input");
  const hidden =
    root.querySelector(`#${prefix}-pin`) ||
    root.querySelector("#model-pin");
  const list =
    root.querySelector(`#${prefix}-listbox`) ||
    root.querySelector("#model-listbox");
  const clearBtn =
    root.querySelector(`#${prefix}-clear`) ||
    root.querySelector("#model-clear");
  if (!input || !hidden || !list) return null;

  const row = input.closest(".model-picker-row") || input.parentElement;
  let richLabel = null;
  if (mode === "series" && row) {
    richLabel = row.querySelector(".model-picker-rich-label");
    if (!richLabel) {
      richLabel = document.createElement("div");
      richLabel.className = "model-picker-rich-label";
      richLabel.setAttribute("aria-hidden", "true");
      row.appendChild(richLabel);
    }
  }

  let open = false;
  let activeIndex = -1;
  /** @type {Array<object>} */
  let suggestions = [];
  let unlockPending = false;

  function updateRichLabel() {
    if (!richLabel) return;
    const show =
      mode === "series" &&
      Boolean(hidden.value) &&
      !open &&
      document.activeElement !== input &&
      /\b(External|Internal)\b/.test(input.value);
    if (show) {
      // Single child keeps "200 External" spacing — flex must not split
      // text + colour span into separate items (collapses the space).
      richLabel.innerHTML = `<span class="model-picker-rich-label-text">${highlightInstallLabelHtml(input.value)}</span>`;
      richLabel.hidden = false;
      root.classList.add("has-rich-label");
    } else {
      richLabel.innerHTML = "";
      richLabel.hidden = true;
      root.classList.remove("has-rich-label");
    }
  }

  function setPin(value, label) {
    hidden.value = value || "";
    if (label != null) input.value = label;
    else if (!value) input.value = "";
    updateClear();
    updateDisabled();
    updateRichLabel();
    ctx.onChange();
  }

  function updateClear() {
    if (!clearBtn) return;
    clearBtn.hidden = !hidden.value && !input.value;
  }

  function updateDisabled() {
    if (mode !== "item") return;
    const seriesId =
      typeof ctx.getSeriesId === "function" ? ctx.getSeriesId() : null;
    const disabled = !seriesId;
    input.disabled = disabled;
    root.classList.toggle("is-disabled", disabled);
    if (disabled) {
      input.placeholder = "Pin a series first…";
    } else {
      input.placeholder = "Item Number e.g. REU-AM2626WD-50-AKN…";
    }
  }

  function setOpen(next) {
    open = next;
    root.classList.toggle("is-open", next);
    updateRichLabel();
  }

  function closeList() {
    setOpen(false);
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
      empty.textContent =
        mode === "item"
          ? "No matching Item Numbers in this series"
          : "No matching series";
      empty.setAttribute("role", "presentation");
      list.appendChild(empty);
      list.hidden = false;
      setOpen(true);
      input.setAttribute("aria-expanded", "true");
      return;
    }

    suggestions.forEach((s, i) => {
      const li = document.createElement("li");
      li.id = `${prefix}-opt-${i}`;
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
          : "Item №";
      const labelHtml =
        mode === "series"
          ? highlightInstallLabelHtml(s.label)
          : escapeHtml(s.label);
      const subHtml =
        mode === "item"
          ? highlightFuelLabelHtml(s.subtitle || "")
          : escapeHtml(s.subtitle || "");
      li.innerHTML = `
        <span class="model-option-label">${labelHtml}</span>
        <span class="model-option-sub">${subHtml}</span>
        <span class="model-option-kind">${escapeHtml(kindLabel)}</span>
      `;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(i, { fromKeyboard: false });
      });
      list.appendChild(li);
    });
    list.hidden = false;
    setOpen(true);
    input.setAttribute("aria-expanded", "true");
    if (activeIndex >= 0) {
      input.setAttribute("aria-activedescendant", `${prefix}-opt-${activeIndex}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function refreshSuggestions() {
    if (mode === "item") {
      const seriesId =
        typeof ctx.getSeriesId === "function" ? ctx.getSeriesId() : null;
      if (!seriesId) {
        suggestions = [];
        activeIndex = -1;
        renderList();
        return;
      }
      suggestions = suggestItemNumberPins(
        ctx.catalogue,
        ctx.seriesDoc,
        seriesId,
        input.value,
        { limit: 16 }
      );
    } else {
      suggestions = suggestSeriesPins(
        ctx.catalogue,
        ctx.seriesDoc,
        input.value,
        { limit: 14 }
      );
    }
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

  input.addEventListener("focus", () => {
    updateRichLabel();
    if (!unlockPending && !input.disabled) refreshSuggestions();
  });

  input.addEventListener("input", () => {
    if (hidden.value) hidden.value = "";
    updateClear();
    updateRichLabel();
    refreshSuggestions();
    ctx.onChange();
  });

  input.addEventListener("keydown", (e) => {
    if (input.disabled) return;
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
    setTimeout(() => {
      if (unlockPending) return;
      closeList();
      if (hidden.value) {
        input.value = labelForPinValue(
          ctx.catalogue,
          ctx.seriesDoc,
          hidden.value
        );
      }
      updateClear();
      updateRichLabel();
    }, 120);
  });

  if (clearBtn) {
    clearBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      setPin("", "");
      closeList();
      if (!input.disabled) input.focus();
    });
  }

  updateClear();
  updateDisabled();
  updateRichLabel();

  return {
    getValue: () => hidden.value || null,
    setValue: (value) => {
      setPin(value, labelForPinValue(ctx.catalogue, ctx.seriesDoc, value));
    },
    refreshEnabled: () => {
      updateDisabled();
    },
    clear: () => setPin("", ""),
  };
}
