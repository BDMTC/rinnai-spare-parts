/**
 * Series alias helpers — marketing name ↔ chassis / document keys.
 * Data: public/data/series-aliases.json
 */

function normalise(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * @param {object|null|undefined} seriesDoc
 * @returns {Array<object>}
 */
export function listSeries(seriesDoc) {
  return seriesDoc?.series || [];
}

/**
 * Resolve a series by id or any alias (HD28, VCM2837, REU-VCM2837, …).
 * @param {object|null|undefined} seriesDoc
 * @param {string} query
 */
export function findSeries(seriesDoc, query) {
  const q = normalise(query);
  if (!q) return null;
  for (const series of listSeries(seriesDoc)) {
    const keys = [
      series.id,
      series.label,
      ...(series.aliases || []),
      ...(series.documentKeys || []),
    ];
    if (keys.some((k) => normalise(k) === q)) return series;
  }
  return null;
}

/**
 * Does a catalogue model belong to a series?
 * @param {object} model
 * @param {object} series
 */
export function modelBelongsToSeries(model, series) {
  if (!model || !series) return false;
  const marketing = String(model.marketingCode || model.sku || "").toUpperCase();
  const item = String(model.itemNumber || "").toUpperCase();
  const prefixes = series.match?.marketingCodePrefixes || [];
  for (const p of prefixes) {
    if (marketing.startsWith(String(p).toUpperCase())) return true;
  }
  const includes = series.match?.itemNumberIncludes || [];
  for (const frag of includes) {
    const f = String(frag).toUpperCase();
    if (item.includes(f)) return true;
  }
  // Alias hit on marketing / item blob
  const blob = normalise(`${marketing} ${item}`);
  for (const a of series.aliases || []) {
    const na = normalise(a);
    if (na && blob.includes(na)) return true;
  }
  return false;
}

/**
 * Model ids that belong to a series.
 * @param {object} catalogue
 * @param {object} series
 */
export function modelIdsForSeries(catalogue, series) {
  return (catalogue?.models || [])
    .filter((m) => modelBelongsToSeries(m, series))
    .map((m) => m.id);
}

/**
 * Expand a model-select value into concrete model ids.
 * Values may be "" | modelId | "series:<id>".
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string|null} pinValue
 * @returns {{ kind: 'none'|'model'|'series', modelIds: string[], series: object|null, model: object|null }}
 */
export function resolveModelPin(catalogue, seriesDoc, pinValue) {
  if (!pinValue) {
    return { kind: "none", modelIds: [], series: null, model: null };
  }
  if (String(pinValue).startsWith("series:")) {
    const sid = String(pinValue).slice("series:".length);
    const series =
      listSeries(seriesDoc).find((s) => s.id === sid) ||
      findSeries(seriesDoc, sid);
    return {
      kind: "series",
      modelIds: series ? modelIdsForSeries(catalogue, series) : [],
      series: series || null,
      model: null,
    };
  }
  const model = (catalogue?.models || []).find((m) => m.id === pinValue);
  if (!model) {
    return { kind: "none", modelIds: [], series: null, model: null };
  }
  // Also attach series membership for document lookup / badges
  const series =
    listSeries(seriesDoc).find((s) => modelBelongsToSeries(model, s)) || null;
  return {
    kind: "model",
    modelIds: [model.id],
    series,
    model,
  };
}

/**
 * Document lookup keys for a pin (series aliases + model sku).
 * @param {{ series: object|null, model: object|null }} pin
 */
export function documentKeysForPin(pin) {
  const keys = new Set();
  if (pin?.series) {
    for (const k of pin.series.documentKeys || pin.series.aliases || []) {
      keys.add(String(k));
    }
    if (pin.series.label) keys.add(String(pin.series.label));
  }
  if (pin?.model) {
    if (pin.model.sku) keys.add(String(pin.model.sku));
    if (pin.model.marketingCode) keys.add(String(pin.model.marketingCode));
    if (pin.model.itemNumber) keys.add(String(pin.model.itemNumber));
  }
  return [...keys];
}
