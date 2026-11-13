/**
 * Chassis model labels for layman blurbs.
 * Prefer real PL/ED / assembly map tokens; join multiples with " OR ".
 * Never invent models. Never emit "this chassis".
 */

/** Family / marketing noise — not a chassis SKU admins pin. */
const FAMILY_JUNK =
  /^(A|B|N)-?SERIES$|^INFINITY\d*|^INFINITY-|^B26(SERIES)?$|^A-SERIES$|^B-SERIES$/i;

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
    if (!t || t.length < 3) continue;
    if (FAMILY_JUNK.test(t)) continue;
    // Drop bare series family words without digits
    if (!/\d/.test(t) && !/^HD/i.test(t)) continue;
    const key = t.toUpperCase();
    if (seen.has(key)) {
      const prev = seen.get(key);
      // Prefer mixed-case commercial (HD200e) over all-caps
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
 * Append a natural chassis phrase. When unresolved, return base only
 * (omit “this chassis” — shorter sentence stays grammatical).
 * @param {string} baseJob e.g. "air mover", "outer front cover"
 * @param {string[]} labels
 * @param {{ prep?: "for"|"on" }} [opts]
 * @returns {string}
 */
export function withChassisPhrase(baseJob, labels, opts = {}) {
  const base = String(baseJob || "").trim();
  const list = formatChassisOrList(labels);
  if (!list) return base;
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
