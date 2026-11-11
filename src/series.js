/**
 * Series alias helpers — marketing name ↔ chassis / document keys.
 * Data: public/data/series-aliases.json
 */

/** Longer suffixes first so FFUC wins over FFC/FFU, WCAK over WC, etc. */
const UNIT_CLASS_SUFFIXES = [
  "WCAK",
  "FFUDC",
  "FFUC",
  "FFUG",
  "FFUD",
  "FFC",
  "FFU",
  "WDC",
  "WC",
  "WD",
  "WG",
];

function normalise(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function unitClassOf(normalised) {
  const n = String(normalised || "");
  for (const suffix of UNIT_CLASS_SUFFIXES) {
    if (n.endsWith(suffix) && n.length > suffix.length) return suffix;
  }
  return null;
}

/**
 * Unit class embedded in a full item number (REUVRM2632WC50KN → WC),
 * not only when the class is the trailing token.
 * @param {string} itemNormalised
 */
function unitClassFromItemNumber(itemNormalised) {
  const n = String(itemNormalised || "");
  if (!n) return null;
  for (const suffix of UNIT_CLASS_SUFFIXES) {
    // Chassis digit(s) then unit class, before temp/fuel tail (50KN, 75N, …)
    const re = new RegExp(`\\d${suffix}(?=[A-Z0-9]|$)`);
    if (re.test(n)) return suffix;
  }
  return unitClassOf(n);
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
 * Prefers exact id, then exact normalised alias/label/documentKey.
 * @param {object|null|undefined} seriesDoc
 * @param {string} query
 */
export function findSeries(seriesDoc, query) {
  const q = normalise(query);
  if (!q) return null;
  const all = listSeries(seriesDoc);
  const byId = all.find((s) => normalise(s.id) === q);
  if (byId) return byId;
  for (const series of all) {
    const keys = [
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
  const marketingN = normalise(marketing);
  const item = String(model.itemNumber || "").toUpperCase();
  const itemN = normalise(item);
  const match = series.match || {};

  const excludes = match.marketingCodeExcludePrefixes || [];
  for (const p of excludes) {
    if (marketing.startsWith(String(p).toUpperCase())) return false;
  }

  const unitClasses = (match.unitClasses || []).map((u) =>
    String(u).toUpperCase()
  );
  if (unitClasses.length) {
    const uc = unitClassFromItemNumber(itemN);
    if (!uc || !unitClasses.includes(uc)) {
      return false;
    }
  }

  const prefixes = match.marketingCodePrefixes || [];
  let prefixHit = false;
  for (const p of prefixes) {
    if (marketing.startsWith(String(p).toUpperCase())) {
      prefixHit = true;
      break;
    }
  }

  const includes = match.itemNumberIncludes || [];
  let includeHit = false;
  for (const frag of includes) {
    const f = normalise(frag);
    if (f && itemN.includes(f)) {
      includeHit = true;
      break;
    }
  }

  if (prefixes.length || includes.length || unitClasses.length) {
    if (unitClasses.length) {
      // Unit class already verified; need at least one of prefix/include when present
      if (prefixes.length || includes.length) return prefixHit || includeHit;
      return true;
    }
    return prefixHit || includeHit;
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
 * Prefer the most specific series for a model (e/i over umbrella).
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {object} model
 */
export function seriesForModel(catalogue, seriesDoc, model) {
  const hits = listSeries(seriesDoc).filter((s) =>
    modelBelongsToSeries(model, s)
  );
  if (!hits.length) return null;
  // Prefer entries whose id is not a bare parent of another hit (hd200e over hd28-style umbrellas when both match is rare)
  hits.sort((a, b) => {
    const aSpec = (a.match?.unitClasses || []).length ? 1 : 0;
    const bSpec = (b.match?.unitClasses || []).length ? 1 : 0;
    if (bSpec !== aSpec) return bSpec - aSpec;
    return String(a.label).localeCompare(String(b.label));
  });
  return hits[0];
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
  const series = seriesForModel(catalogue, seriesDoc, model);
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

export { normalise };
