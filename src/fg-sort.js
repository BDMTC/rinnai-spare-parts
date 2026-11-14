/**
 * Finished-goods list order:
 * model → capacity/litre → ALL Natural Gas → ALL LPG → outlet temp within fuel.
 */

/** @typedef {{ orderCode?: string, name?: string }} FgSortItem */

/**
 * Family / install key — keep chassis capacity (28e, 16, 135); strip fuel + °C only.
 * @param {FgSortItem} it
 * @returns {string}
 */
export function fgModelSortKey(it) {
  const name = String(it?.name || "").trim();
  if (name) {
    const key = name
      .replace(/\bNatural\s+Gas\s+or\s+LPG\b/gi, " ")
      .replace(/\bNat\s*Gas\s+or\s+LPG\b/gi, " ")
      .replace(/\bNatural\s+Gas\b/gi, " ")
      .replace(/\bNat\s*Gas\b/gi, " ")
      .replace(/\bLPG\b/gi, " ")
      .replace(/\bNG\b/gi, " ")
      .replace(/\bN\s*\/\s*L\b/gi, " ")
      .replace(/\b\d{2,3}\s*°\s*C\b/gi, " ")
      .replace(/\b\d{2,3}\s*Degree(?:s)?\b/gi, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
    if (key) return key;
  }
  const code = String(it?.orderCode || "")
    .trim()
    .toUpperCase()
    .replace(/N\s*\/\s*L/gi, "")
    .replace(/(?:[EI])?[NLB](?=\d{2})/, "")
    .replace(/\d{2,3}[A-Z]?$/i, "");
  return code || "~";
}

/**
 * Chassis / tank litreage (not outlet °C). Prefer explicit L / code capacity.
 * @param {FgSortItem} it
 * @returns {number}
 */
export function fgLitreageSortValue(it) {
  const name = String(it?.name || "");
  const fromLitres = name.match(/\b(\d{2,3})\s*L\b/i);
  if (fromLitres) return Number(fromLitres[1]);

  const code = String(it?.orderCode || "").toUpperCase();
  // GHF4135N / GHF4170LH — mid size 135 / 170
  const ghf = code.match(/^GHF\d(\d{3})/);
  if (ghf) return Number(ghf[1]);

  const fromCode =
    code.match(/^(?:INF(?:INITY)?|HDC?|B|EHF[AS]?|EHPT?|EHPG?|REU|MP)[A-Z]*?(\d{2,3})/) ||
    code.match(/(\d{2,3})/);
  if (fromCode) return Number(fromCode[1]);

  // Name fallback: first size-like number that is not a bare outlet temp phrase
  const fromName = name.match(/\b(\d{2,3})(?:e|i)?\b/i);
  return fromName ? Number(fromName[1]) : 9999;
}

/**
 * Outlet temperature (°C) for continuous-flow SKUs; 0 when not applicable.
 * @param {FgSortItem} it
 * @returns {number}
 */
export function fgTempSortValue(it) {
  const name = String(it?.name || "");
  const fromName =
    name.match(/\b(\d{2,3})\s*°\s*C\b/i) || name.match(/\b(\d{2,3})\s*Degree(?:s)?\b/i);
  if (fromName) return Number(fromName[1]);

  const code = String(it?.orderCode || "").toUpperCase();
  // HD28EN42 / INF16EN50A / INF12N50B / GHF — no trailing outlet on GHF
  const fromCode = code.match(/(?:[EI])?[NLB](\d{2})[A-Z]?$/);
  if (fromCode) return Number(fromCode[1]);
  return 0;
}

/**
 * Nat Gas / NG = 0, LPG = 1, umbrella / unknown = 2.
 * @param {FgSortItem} it
 * @returns {number}
 */
export function fgFuelSortRank(it) {
  const name = String(it?.name || "");
  const code = String(it?.orderCode || "").toUpperCase();

  // Dual-fuel umbrellas are not a fuel yet — park after concrete N/L.
  if (
    /N\s*\/\s*L/i.test(code) ||
    /Natural\s+Gas\s+or\s+LPG/i.test(name) ||
    /Nat\s*Gas\s+or\s+LPG/i.test(name) ||
    /\bN\s*\/\s*L\b/i.test(name)
  ) {
    return 2;
  }

  if (/\bLPG\b/i.test(name)) return 1;
  if (/\bNatural\s+Gas\b|\bNat\s*Gas\b|\bNG\b/i.test(name)) return 0;

  // INF16EL50 / HD28EL50 / INF12L50 — L before temp
  if (/(?:[EI])?L(?=\d{2})/.test(code) || /(?:^|[^A-Z])L(?=\d{2})/.test(code)) {
    return 1;
  }
  // INF16EN50 / HD28EN50 / INF12N50 — N before temp
  if (/(?:[EI])?N(?=\d{2})/.test(code) || /(?:^|[^A-Z])N(?=\d{2})/.test(code)) {
    return 0;
  }
  // GHF4135N / GHF4170LH
  if (/[NL]H?$/.test(code)) {
    if (/LH?$/.test(code) && !/NH?$/.test(code)) return 1;
    if (/L$/.test(code)) return 1;
    if (/NH?$/.test(code) || /N$/.test(code)) return 0;
  }
  return 2;
}

/**
 * @param {FgSortItem} a
 * @param {FgSortItem} b
 */
export function compareFgItems(a, b) {
  const model = fgModelSortKey(a).localeCompare(fgModelSortKey(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (model !== 0) return model;

  const litre = fgLitreageSortValue(a) - fgLitreageSortValue(b);
  if (litre !== 0) return litre;

  // Within model + litreage: ALL Natural Gas, then ALL LPG (no per-temp N/L pairs).
  const fuel = fgFuelSortRank(a) - fgFuelSortRank(b);
  if (fuel !== 0) return fuel;

  const temp = fgTempSortValue(a) - fgTempSortValue(b);
  if (temp !== 0) return temp;

  return String(a?.orderCode || "").localeCompare(String(b?.orderCode || ""), undefined, {
    numeric: true,
  });
}

/**
 * @template {FgSortItem} T
 * @param {T[]} items
 * @returns {T[]}
 */
export function sortFgItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort(compareFgItems);
}
