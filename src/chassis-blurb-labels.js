/**
 * Chassis model labels for layman blurbs.
 * Prefer real PL/ED / assembly / series-alias / Item Number tokens;
 * join multiples with " OR ". Never invent. Never emit "this chassis".
 */

/** Family / marketing noise — not a chassis SKU admins pin. */
const FAMILY_JUNK =
  /^(A|B|N)-?SERIES$|^INFINITY\d*|^INFINITY-|^B26(SERIES)?$|^A-SERIES$|^B-SERIES$/i;

/** Tokens that look numeric/size-ish and are not chassis on their own. */
const BARE_NOISE = new Set(
  [
    "V1",
    "V2",
    "MOQ12",
    "50MM",
    "50C", // outlet-temp marking on CF panels — not a chassis
    "0",
    "1",
    "2",
    "3",
    "9",
    "05",
    "06",
    "4S",
    "3SP",
    "6UN",
    "10X10",
    "9X7",
    "600W",
  ].map((s) => s.toUpperCase())
);

/**
 * Strip leading REU / REU- so labels match plate-style chassis codes.
 * @param {string} token
 * @returns {string}
 */
export function stripReuPrefix(token) {
  return String(token || "")
    .trim()
    .replace(/^REU-?/i, "");
}

function alnum(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Engineering chassis codes (VRM2632WC, V2632WC, N3237WC, AM2626…).
 * Commercial HD#### kept only when no engineering token exists.
 * @param {string} tok
 */
function isEngineeringChassis(tok) {
  const t = String(tok || "");
  if (!t) return false;
  if (/^HD[CI]?\d/i.test(t)) return false;
  return /[A-Za-z]/.test(t) && /\d{2,}/.test(t);
}

/**
 * Deduplicate + prefer engineering chassis tokens from raw map tokens.
 * @param {Iterable<string>|null|undefined} rawTokens
 * @returns {string[]}
 */
export function normalizeChassisLabels(rawTokens) {
  const seen = new Map(); // UPPER → display form
  for (const raw of rawTokens || []) {
    let t = stripReuPrefix(raw);
    if (!t || t.length < 2) continue;
    if (/\s/.test(t)) continue; // marketing phrases, not chassis codes
    if (FAMILY_JUNK.test(t)) continue;
    if (BARE_NOISE.has(t.toUpperCase())) continue;
    // Keep digit chassis codes, HD####, or letter-only PL model marks (EHPT, SAPP…)
    if (!/\d/.test(t) && !/^HD/i.test(t) && !/^[A-Z]{3,}$/i.test(t)) continue;
    const key = t.toUpperCase();
    if (seen.has(key)) {
      const prev = seen.get(key);
      if (/[a-z]/.test(t) && !/[a-z]/.test(prev)) seen.set(key, t);
      continue;
    }
    seen.set(key, t);
  }
  const all = [...seen.values()];
  const engineering = all.filter(isEngineeringChassis);
  if (engineering.length) return engineering;
  return all;
}

/**
 * @param {string[]} labels
 * @returns {string} e.g. "VRM2632WC OR V2632WC"
 */
export function formatChassisOrList(labels) {
  if (!labels?.length) return "";
  return labels.join(" OR ");
}

/**
 * Collect chassis labels from edpl-part-map hits for one part code.
 * Prefer tokens that appear on the price-list name; else highest-priority
 * hit only (avoid unioning every chassis from multi-series PDFs).
 * @param {Array<{ chassisTokens?: string[], priority?: number }>|null|undefined} hits
 * @param {{ partName?: string }} [opts]
 * @returns {string[]}
 */
export function chassisLabelsFromEdplHits(hits, opts = {}) {
  const list = Array.isArray(hits) ? hits.filter(Boolean) : [];
  if (!list.length) return [];

  const nameKey = alnum(opts.partName || "");
  if (nameKey.length >= 4) {
    const fromName = [];
    for (const h of list) {
      for (const t of h.chassisTokens || []) {
        const a = alnum(stripReuPrefix(t));
        if (a.length >= 4 && nameKey.includes(a)) fromName.push(String(t));
      }
    }
    const named = normalizeChassisLabels(fromName);
    if (named.length) return named;
  }

  let best = -Infinity;
  for (const h of list) {
    const p = Number(h.priority);
    if (Number.isFinite(p) && p > best) best = p;
  }
  const top =
    best === -Infinity
      ? list
      : list.filter((h) => (Number(h.priority) || 0) === best);
  const raw = [];
  for (const h of top) {
    for (const t of h.chassisTokens || []) raw.push(String(t));
  }
  return normalizeChassisLabels(raw);
}

/**
 * Collect from assembly parent/child seriesTokens.
 * @param {{ seriesTokens?: string[] }|null|undefined} entry
 * @returns {string[]}
 */
export function chassisLabelsFromAssembly(entry) {
  return normalizeChassisLabels(entry?.seriesTokens || []);
}

/**
 * Pull chassis / model tokens already written on the price-list name.
 * Does not invent — only returns substrings present on the line.
 * @param {string} name
 * @returns {string[]}
 */
export function extractChassisTokensFromName(name) {
  const blob = String(name || "");
  if (!blob.trim()) return [];
  const found = [];

  const patterns = [
    /\bREU-?[A-Z]{1,6}\d{2,4}[A-Z0-9]*\b/gi,
    /\b(?:VRM|VCM|VR|VM|AM|NB|KM|BM|INF)\d{2,4}[A-Z0-9]*\b/gi,
    // E2626 / A2626WG / N3237 / N3237WC (trailing letters optional)
    /\b(?:N|E|A)\d{3,4}[A-Z]{0,6}\b/gi,
    /\b(?:IHF|FM|CHP|ECF|EHFA|EHFD|EHPT|EHPS|EHPG|EHPA|SHPL|SHPR|GHF|ES)\d*[A-Z0-9]*\b/gi,
    /\b(?:XXE|XXI|BX|KU|HINRA|HINBR|HINCJ|HINRJX|HONRJX|HONBR|DONSR|DONSC|DINLR|MINSD|MON2H|RINV|RIN|RDV|RDT|RD)\d*[A-Z0-9-]*\b/gi,
    /\b(?:AP|AE|PC|PQ|MC|EX|NC|C)\d{2,3}[A-Z0-9]*\b/gi,
    /\b(?:IB|LS|SS|R)\d{2,4}[A-Z0-9]*\b/gi,
    /\b(?:EHPT|EHPS|EHPG|EHPA|SAPP|SYMBN|RDV)\b/gi,
    /\b559FDT\b/gi,
    /\b561FT3?\b/gi,
    /\b(?:556|557|559|561)FT\d?\b/gi,
    /\b(?:470|670)TRE2?\b/gi,
    /\b(?:371|471|571|671)TR\b/gi,
    /\b309FT3\b/gi,
    /\b252V2\b/gi,
    /\b30FT\b/gi,
    /\b(?:1004|1005|2001)\b/g,
    /\b(?:151|309|311|329|460|556|557|559|561|210|240|252|280|281|800|850|1000|1253|1500)\b/g,
    // Cooling size codes that are the PL model mark (25C, 34C, 70RT…)
    /\b(?:25|34|35|50|51|52|70|80)(?:C|G|RT|RT2)?\b/gi,
    // APAC kit / subassy model marks
    /\bP\d{5,}(?:-SA)?(?:-\d+)?(?:-\d+KW)?\b/gi,
    /\bR-HPU\d{3,}(?:-\d+)?(?:-SA)?\b/gi,
    /\bA\d{6}\b/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    for (const m of blob.matchAll(re)) {
      let t = String(m[0] || "").trim().replace(/-+$/g, "");
      if (!t) continue;
      if (BARE_NOISE.has(t.toUpperCase())) continue;
      // Drop lone "A"/"N"/"E" false positives under 3 chars without enough digits
      if (/^[A-Z]$/i.test(t)) continue;
      found.push(t);
    }
  }

  // Compound "HINRJX25-35" / "HONRJX50-80" → keep whole token (already matched)
  // "RINV 25 35" → RINV25 OR RINV35 when spaced
  const spaced = blob.match(
    /\b(RINV|RIN|HINRJX|HONRJX|HONBR|HINCJ|DONSR|XXE|XXI|BX|KU)\s+(\d{2,3})(?:\s+(\d{2,3}))?\b/gi
  );
  if (spaced) {
    for (const s of spaced) {
      const parts = s.trim().split(/\s+/);
      const head = parts[0].toUpperCase();
      for (let i = 1; i < parts.length; i++) {
        found.push(`${head}${parts[i]}`);
      }
    }
  }

  return normalizeChassisLabels(found);
}

/**
 * Build uppercase-alnum → preferred chassis labels from series-aliases.json.
 * @param {{ series?: Array }} seriesDoc
 * @returns {Map<string, string[]>}
 */
export function buildSeriesAliasChassisIndex(seriesDoc) {
  const map = new Map();
  for (const s of seriesDoc?.series || []) {
    // Prefer plate/doc chassis codes only — not marketing prose aliases.
    const preferred = normalizeChassisLabels([
      ...(s.documentKeys || []),
      ...(s.match?.itemNumberIncludes || []),
    ]);
    const keys = new Set();
    for (const raw of [
      ...(s.documentKeys || []),
      ...(s.match?.itemNumberIncludes || []),
      ...(s.match?.marketingCodePrefixes || []),
      s.label,
    ]) {
      const t = alnum(stripReuPrefix(raw));
      if (t.length >= 3) keys.add(t);
    }
    for (const k of keys) {
      const prev = map.get(k) || [];
      map.set(k, normalizeChassisLabels([...prev, ...preferred]));
    }
  }
  return map;
}

/**
 * Build uppercase-alnum → chassis labels from models.json Item Numbers.
 * @param {{ models?: Array }} modelsDoc
 * @returns {Map<string, string[]>}
 */
export function buildModelChassisIndex(modelsDoc) {
  const map = new Map();
  for (const m of modelsDoc?.models || []) {
    const item = String(m.itemNumber || "");
    const mkt = String(m.marketingCode || m.sku || "");
    const core = item.replace(/^REU-/i, "").split("-")[0];
    const labels = normalizeChassisLabels([core, mkt].filter(Boolean));
    for (const raw of [mkt, item, core, m.id, m.sku]) {
      const k = alnum(stripReuPrefix(raw));
      if (k.length < 3) continue;
      const prev = map.get(k) || [];
      map.set(k, normalizeChassisLabels([...prev, ...labels]));
    }
  }
  return map;
}

/**
 * Exhaustive chassis resolution for one part.
 * Order: assembly → EDPL → price-list name tokens → series aliases → models Item Numbers.
 * @param {string} code
 * @param {{
 *   part?: { name?: string },
 *   edplPartMap?: { parts?: Record<string, Array> },
 *   assemblyIndex?: { parentByCode?: Map },
 *   seriesAliasIndex?: Map<string, string[]>,
 *   modelChassisIndex?: Map<string, string[]>,
 * }} ctx
 * @returns {string[]}
 */
export function resolveChassisLabels(code, ctx = {}) {
  const raw = [];
  const part = ctx.part || null;
  const name = part?.name || "";

  const parent = ctx.assemblyIndex?.parentByCode?.get(String(code));
  if (parent) raw.push(...chassisLabelsFromAssembly(parent));

  raw.push(
    ...chassisLabelsFromEdplHits(ctx.edplPartMap?.parts?.[String(code)], {
      partName: name,
    })
  );

  const nameToks = extractChassisTokensFromName(name);
  raw.push(...nameToks);

  const aliasIdx = ctx.seriesAliasIndex;
  const modelIdx = ctx.modelChassisIndex;
  // Exact alias/doc-key expand only (no marketing dump; no loose prefix fan-out).
  for (const t of nameToks) {
    const k = alnum(stripReuPrefix(t));
    if (!k) continue;
    if (aliasIdx?.has(k)) raw.push(...(aliasIdx.get(k) || []));
  }

  let labels = normalizeChassisLabels(raw);
  // models.json only when still empty — exact / prefix on Item Number cores.
  if (!labels.length && modelIdx) {
    for (const t of nameToks) {
      const k = alnum(stripReuPrefix(t));
      if (!k || k.length < 3) continue;
      if (modelIdx.has(k)) raw.push(...(modelIdx.get(k) || []));
      else {
        for (const [ak, vals] of modelIdx) {
          if (ak.length < 4) continue;
          if (ak.startsWith(k) || k.startsWith(ak)) raw.push(...vals);
        }
      }
    }
    labels = normalizeChassisLabels(raw);
  }

  // Prefer tokens that actually appear on the price-list name when present.
  if (nameToks.length) {
    const nameLabels = normalizeChassisLabels(nameToks);
    if (nameLabels.length) {
      const nameKeys = new Set(nameLabels.map((x) => x.toUpperCase()));
      const overlap = labels.filter((x) => nameKeys.has(x.toUpperCase()));
      if (overlap.length) return overlap;
      // Name had tokens but normalize filtered them — return name tokens first.
      return nameLabels;
    }
  }

  return labels;
}

/**
 * Append a natural chassis phrase. Empty labels → empty string (caller must fail closed).
 * @param {string} baseJob e.g. "air mover", "outer front cover"
 * @param {string[]} labels
 * @param {{ prep?: "for"|"on" }} [opts]
 * @returns {string}
 */
export function withChassisPhrase(baseJob, labels, opts = {}) {
  const base = String(baseJob || "").trim();
  const list = formatChassisOrList(labels);
  if (!list) return "";
  const prep = opts.prep === "on" ? "on" : "for";
  return `${base} ${prep} ${list}`;
}

/**
 * Runtime assembly override lines when models resolve / don’t.
 * @param {string} lead e.g. "Heat exchanger assembly"
 * @param {string[]} labels
 * @returns {string}
 */
export function assemblyChassisSentence(lead, labels) {
  const list = formatChassisOrList(labels);
  if (list) return `${lead} for ${list}.`;
  return `${lead} — chassis unresolved on PL/ED map.`;
}
