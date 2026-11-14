/**
 * Finished-goods list order: model → litreage → gas (Nat Gas before LPG).
 */

/** @typedef {{ orderCode?: string, name?: string }} FgSortItem */

/**
 * @param {FgSortItem} it
 * @returns {string}
 */
export function fgModelSortKey(it) {
  const name = String(it?.name || "").trim();
  if (name) {
    const key = name
      .replace(/\bNatural\s+Gas\b/gi, " ")
      .replace(/\bNat\s*Gas\b/gi, " ")
      .replace(/\bLPG\b/gi, " ")
      .replace(/\bNG\b/gi, " ")
      .replace(/\b\d{2,3}\s*°\s*C\b/gi, " ")
      .replace(/\b\d{2,3}\s*Degree\b/gi, " ")
      .replace(/\b\d{2,3}\s*L\b/gi, " ")
      .replace(/\b\d{2,3}\b/g, " ")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
    if (key) return key;
  }
  const code = String(it?.orderCode || "")
    .trim()
    .toUpperCase()
    .replace(/(?:[EI])?[NLB](?=\d{2})/, "")
    .replace(/\d{2,3}[A-Z]?$/i, "");
  return code || "~";
}

/**
 * @param {FgSortItem} it
 * @returns {number}
 */
export function fgLitreageSortValue(it) {
  const name = String(it?.name || "");
  const fromName =
    name.match(/\b(\d{2,3})\s*L\b/i) ||
    name.match(/\b(\d{2,3})\s*(?:Natural|Nat|LPG|NG|°|Degree)/i) ||
    name.match(/\b(\d{2,3})\b/);
  if (fromName) return Number(fromName[1]);

  const code = String(it?.orderCode || "").toUpperCase();
  const fromCode =
    code.match(/^(?:INF(?:INITY)?|HDC?|B|EHF[AS]?|EHPT?|EHPG?|REU)[A-Z]*?(\d{2,3})/) ||
    code.match(/(\d{2,3})/);
  return fromCode ? Number(fromCode[1]) : 9999;
}

/**
 * Nat Gas / NG = 0, LPG = 1, unknown = 2.
 * @param {FgSortItem} it
 * @returns {number}
 */
export function fgFuelSortRank(it) {
  const name = String(it?.name || "");
  if (/\bLPG\b/i.test(name)) return 1;
  if (/\bNatural\s+Gas\b|\bNat\s*Gas\b|\bNG\b/i.test(name)) return 0;

  const code = String(it?.orderCode || "").toUpperCase();
  // INF16EL50 / HD28EL50 / INF12L50 — L before temp
  if (/(?:[EI])?L(?=\d{2})/.test(code) || /(?:^|[^A-Z])L(?=\d{2})/.test(code)) {
    return 1;
  }
  // INF16EN50 / HD28EN50 / INF12N50 — N before temp
  if (/(?:[EI])?N(?=\d{2})/.test(code) || /(?:^|[^A-Z])N(?=\d{2})/.test(code)) {
    return 0;
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
  const fuel = fgFuelSortRank(a) - fgFuelSortRank(b);
  if (fuel !== 0) return fuel;
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
