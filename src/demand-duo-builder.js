/**
 * Demand Duo stem builder (Finished goods family → DD).
 * Assembles order codes stem-by-stem from the parked catalog — no invented decode.
 * Options are whatever remains possible in demandDuo.codes.
 */

/** @typedef {{ orderCode: string, netExGst: number, name?: string }} DdCodeRow */
/** @typedef {{
 *   series: string,
 *   heaters: string,
 *   model: string,
 *   mount: string,
 *   tank: string,
 *   gas: string,
 *   outlet: string,
 * }} DdStemState */

export const DD_STEM_KEYS = [
  "series",
  "heaters",
  "model",
  "mount",
  "tank",
  "gas",
  "outlet",
];

export const DD_STEM_META = {
  series: {
    label: "Series",
    hint: "DD1 integrated · DDF frame · DDPL Plus",
    colorClass: "dd-stem--series",
  },
  heaters: {
    label: "Heaters",
    hint: "Module count (DDF / DDPL only)",
    colorClass: "dd-stem--heaters",
  },
  model: {
    label: "Heater model",
    hint: "28 · 32 · C32",
    colorClass: "dd-stem--model",
  },
  mount: {
    label: "Mount",
    hint: "E external · I internal",
    colorClass: "dd-stem--mount",
  },
  tank: {
    label: "Tank",
    hint: "Litres (+ V = vitreous enamel)",
    colorClass: "dd-stem--tank",
  },
  gas: {
    label: "Gas",
    hint: "N/L = Natural Gas or LPG pack",
    colorClass: "dd-stem--gas",
  },
  outlet: {
    label: "Outlet",
    hint: "Blank standard · -50 = 50 mm tank outlet",
    colorClass: "dd-stem--outlet",
  },
};

/** @returns {DdStemState} */
export function emptyDdStemState() {
  return {
    series: "",
    heaters: "",
    model: "",
    mount: "",
    tank: "",
    gas: "",
    outlet: "",
  };
}

/**
 * Parse a catalog system code into stems. Returns null if not a DD1/DDF/DDPL system SKU.
 * @param {string} code
 * @returns {Partial<DdStemState>|null}
 */
export function parseDdSystemCode(code) {
  const c = String(code || "").trim().toUpperCase();
  const m = c.match(/^(DD1|DDF|DDPL)([2-6])?(C32|28|32)([EI])(\d{3}V?)(N\/L)(-50)?$/);
  if (!m) return null;
  const [, series, heaters, model, mount, tank, gas, outlet] = m;
  return {
    series,
    heaters: heaters || "",
    model,
    mount,
    tank,
    gas,
    outlet: outlet || "",
  };
}

/**
 * @param {DdCodeRow[]} codes
 * @returns {DdCodeRow[]}
 */
export function ddSystemCatalog(codes) {
  return (Array.isArray(codes) ? codes : []).filter((row) => parseDdSystemCode(row.orderCode));
}

/**
 * @param {Partial<DdStemState>} stem
 * @param {DdCodeRow} row
 */
function rowMatchesStem(stem, row) {
  const parsed = parseDdSystemCode(row.orderCode);
  if (!parsed) return false;
  for (const key of DD_STEM_KEYS) {
    const want = stem[key];
    if (!want) continue;
    if (String(parsed[key] || "") !== String(want)) return false;
  }
  return true;
}

/**
 * @param {DdCodeRow[]} catalog
 * @param {Partial<DdStemState>} stem
 */
export function filterDdCatalog(catalog, stem) {
  return catalog.filter((row) => rowMatchesStem(stem, row));
}

/**
 * Remaining option values for a stem key given current picks.
 * @param {DdCodeRow[]} catalog
 * @param {Partial<DdStemState>} stem
 * @param {keyof DdStemState} key
 */
export function ddOptionsForKey(catalog, stem, key) {
  const without = { ...stem, [key]: "" };
  const pool = filterDdCatalog(catalog, without);
  const set = new Set();
  for (const row of pool) {
    const parsed = parseDdSystemCode(row.orderCode);
    if (!parsed) continue;
    const val = parsed[key] || "";
    // Heaters blank is valid for DD1 — expose as "—" option only when present
    set.add(val);
  }
  return [...set].sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

/**
 * Build display segments for the big code strip.
 * @param {Partial<DdStemState>} stem
 */
export function ddStemSegments(stem) {
  return DD_STEM_KEYS.map((key) => ({
    key,
    value: stem[key] || "",
    meta: DD_STEM_META[key],
    filled: Boolean(stem[key]),
  })).filter((seg) => {
    // Hide empty heaters placeholder until series needs it or it's filled
    if (seg.key === "heaters" && !seg.value && stem.series === "DD1") return false;
    if (seg.key === "outlet" && !seg.value) return false;
    return true;
  });
}

/**
 * Assembled code string from stem (may be incomplete).
 * @param {Partial<DdStemState>} stem
 */
export function assembleDdCode(stem) {
  if (!stem.series) return "";
  const parts = [stem.series];
  if (stem.series !== "DD1" && stem.heaters) parts.push(stem.heaters);
  if (stem.model) parts.push(stem.model);
  if (stem.mount) parts.push(stem.mount);
  if (stem.tank) parts.push(stem.tank);
  if (stem.gas) parts.push(stem.gas);
  if (stem.outlet) parts.push(stem.outlet);
  return parts.join("");
}

/**
 * Exact catalog hit when stem fully specifies one code.
 * @param {DdCodeRow[]} catalog
 * @param {Partial<DdStemState>} stem
 */
export function matchDdCode(catalog, stem) {
  const hits = filterDdCatalog(catalog, stem);
  if (hits.length === 1) return hits[0];
  const assembled = assembleDdCode(stem);
  if (!assembled) return null;
  return hits.find((h) => h.orderCode.toUpperCase() === assembled.toUpperCase()) || null;
}

/** Option button label */
export function ddOptionLabel(key, value) {
  if (key === "heaters" && value === "") return "— (DD1 single)";
  if (key === "outlet" && value === "") return "Standard";
  if (key === "series") {
    if (value === "DD1") return "DD1 · Integrated";
    if (value === "DDF") return "DDF · Frame / separate heaters";
    if (value === "DDPL") return "DDPL · Plus";
  }
  if (key === "mount") {
    if (value === "E") return "E · External";
    if (value === "I") return "I · Internal";
  }
  if (key === "gas" && value === "N/L") return "N/L · NG or LPG";
  if (key === "outlet" && value === "-50") return "-50 · 50 mm outlet";
  if (key === "tank" && /V$/.test(value)) return `${value} · Vitreous`;
  if (key === "tank") return `${value}L · Stainless`;
  return value || "—";
}
