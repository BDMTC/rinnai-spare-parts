/**
 * Model / series typeahead — filter across marketing names, REU codes, aliases.
 */

import { getModelLabel, getModelDisplayName } from "./search.js";
import {
  listSeries,
  modelBelongsToSeries,
  modelIdsForSeries,
  seriesForModel,
  normalise,
} from "./series.js";

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
        !/^(hd28e?|hd28i|hd200e|hd200i|hd200e-infinity-nz|hd210e|hd210i|infinity26|infinity32)/i.test(
          series.id
        )
      ) {
        continue;
      }
      const count = modelIdsForSeries(catalogue, series).length;
      results.push({
        kind: "series",
        value: `series:${series.id}`,
        label: series.label,
        subtitle: seriesSubtitle(series, count),
        series,
        model: null,
        score: 10,
      });
    }
    return results.slice(0, limit);
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
    if (/^\d/.test(qNorm) === false && /VRM|VCM|VM2630|REU/.test(qNorm)) {
      score += 5;
    }
    const count = modelIdsForSeries(catalogue, series).length;
    results.push({
      kind: "series",
      value: `series:${series.id}`,
      label: series.label,
      subtitle: seriesSubtitle(series, count),
      series,
      model: null,
      score,
    });
  }

  for (const model of catalogue?.models || []) {
    const series = seriesForModel(catalogue, seriesDoc, model);
    const display = getModelDisplayName(model, series);
    const tokens = [
      model.id,
      model.sku,
      model.marketingCode,
      model.itemNumber,
      model.name,
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
    results.push({
      kind: "model",
      value: model.id,
      label: display,
      subtitle: modelSubtitle(model, series),
      series: series || null,
      model,
      score,
    });
  }

  results.sort((a, b) => {
    // Always prefer series pins ahead of individual models when both match
    if (a.kind !== b.kind) {
      const aSeries = a.kind === "series" ? 1 : 0;
      const bSeries = b.kind === "series" ? 1 : 0;
      if (bSeries !== aSeries) return bSeries - aSeries;
    }
    if (b.score !== a.score) return b.score - a.score;
    return String(a.label).localeCompare(String(b.label));
  });

  return results.slice(0, limit);
}

function seriesSubtitle(series, count) {
  const bits = [];
  if (series.provisional) bits.push("provisional");
  if (series.region) bits.push(series.region);
  if (series.status) bits.push(series.status);
  const alias = (series.aliases || []).find((a) =>
    /VRM|VCM|VM2630|REU-/i.test(a)
  );
  if (alias) bits.push(alias);
  bits.push(`${count} model${count === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

function modelSubtitle(model, series) {
  const bits = [];
  if (series?.label) bits.push(series.label);
  if (model.itemNumber) bits.push(model.itemNumber);
  else if (model.sku) bits.push(model.sku);
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
  return getModelDisplayName(model, series) || getModelLabel(model);
}

/**
 * Mount combobox behaviour on a model-picker root element.
 * Root must contain: input#model-input, button.clear, ul[role=listbox], hidden input#model-pin
 *
 * @param {HTMLElement} root
 * @param {{ catalogue: object, seriesDoc: object, onChange: () => void }} ctx
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
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      if (i === activeIndex) li.classList.add("is-active");
      li.dataset.value = s.value;
      li.innerHTML = `
        <span class="model-option-label">${escapeHtml(s.label)}</span>
        <span class="model-option-sub">${escapeHtml(s.subtitle || "")}</span>
        <span class="model-option-kind">${s.kind === "series" ? "Series" : "Model"}</span>
      `;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(i);
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

  function choose(index) {
    const s = suggestions[index];
    if (!s) return;
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
    refreshSuggestions();
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
        choose(activeIndex);
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
