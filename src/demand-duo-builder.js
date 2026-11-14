/**
 * Demand Duo stem builder (Finished goods → DD family).
 * Wizard: one zero-knowledge question per card; options from parked catalog only.
 */

/** @typedef {{ orderCode: string, netExGst: number, name?: string }} DdCodeRow */
/** @typedef {{
 *   series?: string,
 *   heaters?: string,
 *   model?: string,
 *   mount?: string,
 *   tank?: string,
 *   gas?: string,
 *   outlet?: string,
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
  series: { label: "Series", colorClass: "dd-stem--series" },
  heaters: { label: "Heaters", colorClass: "dd-stem--heaters" },
  model: { label: "Model", colorClass: "dd-stem--model" },
  mount: { label: "Mount", colorClass: "dd-stem--mount" },
  tank: { label: "Tank", colorClass: "dd-stem--tank" },
  gas: { label: "Gas", colorClass: "dd-stem--gas" },
  outlet: { label: "Outlet", colorClass: "dd-stem--outlet" },
};

/**
 * Zero-knowledge prompts (from Demand Duo SPE Nov 2025 —
 * docs/demand-duo-spe-2511-summary.md).
 */
export const DD_QUESTIONS = {
  series: {
    prompt: "How are the continuous-flow heaters mounted?",
    help: "SPE: Integrated DD1 = on the tank. Demand Duo = separate rack/frame modules. Plus = rack/frame with pump already on the heater module.",
  },
  heaters: {
    prompt: "How many continuous-flow heaters?",
    help: "Count the Heavy Duty units on the rack or frame (not the tank).",
  },
  model: {
    prompt: "Which Heavy Duty heater?",
    help: "Data plate: HD28 (28 L/min), HD32 (32 L/min), or HDC32 condensing.",
  },
  mount: {
    prompt: "Is the plant inside or outside?",
    help: "Inside needs flueing. Outside is external (E).",
  },
  tank: {
    prompt: "What storage tank?",
    help: "Stainless 250 / 315 L, or vitreous enamel 270 / 330 L (V in the code).",
  },
  gas: {
    prompt: "Natural Gas or LPG?",
    help: "Zone packs are usually N/L (either gas type on the same code).",
  },
  outlet: {
    prompt: "What size tank outlet?",
    help: "Standard, or 50 mm (-50) when the job needs larger tank connections.",
  },
};

/** @returns {DdStemState} */
export function emptyDdStemState() {
  return {};
}

/**
 * Parse a catalog system code into stems. null if not DD1/DDF/DDPL system SKU.
 * @param {string} code
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

/** @param {DdCodeRow[]} codes */
export function ddSystemCatalog(codes) {
  return (Array.isArray(codes) ? codes : []).filter((row) =>
    parseDdSystemCode(row.orderCode)
  );
}

function stemHas(stem, key) {
  return Object.prototype.hasOwnProperty.call(stem, key);
}

/**
 * @param {DdStemState} stem
 * @param {DdCodeRow} row
 */
function rowMatchesStem(stem, row) {
  const parsed = parseDdSystemCode(row.orderCode);
  if (!parsed) return false;
  for (const key of DD_STEM_KEYS) {
    if (!stemHas(stem, key)) continue;
    if (String(parsed[key] ?? "") !== String(stem[key] ?? "")) return false;
  }
  return true;
}

/** @param {DdCodeRow[]} catalog @param {DdStemState} stem */
export function filterDdCatalog(catalog, stem) {
  return catalog.filter((row) => rowMatchesStem(stem, row));
}

/** @param {DdCodeRow[]} catalog @param {DdStemState} stem @param {string} key */
export function ddOptionsForKey(catalog, stem, key) {
  const without = { ...stem };
  delete without[key];
  const pool = filterDdCatalog(catalog, without);
  const set = new Set();
  for (const row of pool) {
    const parsed = parseDdSystemCode(row.orderCode);
    if (!parsed) continue;
    set.add(parsed[key] ?? "");
  }
  return [...set].sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

/**
 * Next question key, or null when stem is complete (single catalog match or fully specified).
 * Auto-applies single-option stems into `stem` (mutates) so the wizard can skip them.
 * @param {DdCodeRow[]} catalog
 * @param {DdStemState} stem
 * @returns {string|null}
 */
export function resolveDdWizardStep(catalog, stem) {
  // Skip heaters on DD1 — lock empty
  if (stem.series === "DD1" && !stemHas(stem, "heaters")) {
    stem.heaters = "";
  }

  for (let guard = 0; guard < 12; guard++) {
    const match = matchDdCode(catalog, stem);
    if (match) return null;

    let progressed = false;
    for (const key of DD_STEM_KEYS) {
      if (stem.series === "DD1" && key === "heaters") continue;
      if (stemHas(stem, key)) continue;
      const opts = ddOptionsForKey(catalog, stem, key);
      if (opts.length === 1) {
        stem[key] = opts[0];
        progressed = true;
        break;
      }
      if (opts.length === 0) return null;
      return key;
    }
    if (!progressed) break;
  }
  return null;
}

/** Keys answered by the user (excludes auto-filled heaters "" on DD1 if we track separately — use stemHas). */
export function ddAnsweredKeys(stem) {
  return DD_STEM_KEYS.filter((k) => stemHas(stem, k));
}

/**
 * @param {DdStemState} stem
 */
export function ddStemSegments(stem) {
  return DD_STEM_KEYS.map((key) => ({
    key,
    value: stemHas(stem, key) ? String(stem[key] ?? "") : "",
    meta: DD_STEM_META[key],
    filled: stemHas(stem, key) && !(key === "heaters" && stem.series === "DD1"),
    pending: !stemHas(stem, key),
  })).filter((seg) => {
    if (seg.key === "heaters" && stem.series === "DD1") return false;
    if (seg.key === "outlet" && stemHas(stem, "outlet") && stem.outlet === "") {
      // show a small marker for standard outlet once chosen
      return true;
    }
    if (seg.key === "outlet" && !stemHas(stem, "outlet")) return false;
    return stemHas(stem, "series") || seg.key === "series";
  });
}

/** @param {DdStemState} stem */
export function assembleDdCode(stem) {
  if (!stem.series) return "";
  const parts = [stem.series];
  if (stem.series !== "DD1" && stemHas(stem, "heaters") && stem.heaters) {
    parts.push(stem.heaters);
  }
  if (stemHas(stem, "model") && stem.model) parts.push(stem.model);
  if (stemHas(stem, "mount") && stem.mount) parts.push(stem.mount);
  if (stemHas(stem, "tank") && stem.tank) parts.push(stem.tank);
  if (stemHas(stem, "gas") && stem.gas) parts.push(stem.gas);
  if (stemHas(stem, "outlet") && stem.outlet) parts.push(stem.outlet);
  return parts.join("");
}

/** @param {DdCodeRow[]} catalog @param {DdStemState} stem */
export function matchDdCode(catalog, stem) {
  const hits = filterDdCatalog(catalog, stem);
  return hits.length === 1 ? hits[0] : null;
}

/** Plain-English option label (SPE language) */
export function ddOptionLabel(key, value) {
  if (key === "series") {
    if (value === "DD1") return "On the tank front (Integrated DD1)";
    if (value === "DDF") return "On a separate rack / frame (Demand Duo)";
    if (value === "DDPL") return "Plus pack — rack/frame, pump on heater module";
  }
  if (key === "heaters") {
    if (value === "") return "One heater on the tank";
    return `${value} continuous-flow heaters`;
  }
  if (key === "model") {
    if (value === "28") return "HD28 — 28 L/min (non-condensing)";
    if (value === "32") return "HD32 — 32 L/min (non-condensing)";
    if (value === "C32") return "HDC32 — 32 L/min condensing";
  }
  if (key === "mount") {
    if (value === "E") return "Outside (external)";
    if (value === "I") return "Inside (internal — needs flue)";
  }
  if (key === "tank") {
    if (/V$/.test(value)) {
      return `${value.replace(/V$/, "")} L vitreous enamel`;
    }
    return `${value} L stainless steel`;
  }
  if (key === "gas") {
    if (value === "N/L") return "Natural Gas or LPG (N/L pack)";
    if (value === "N") return "Natural Gas";
    if (value === "L") return "LPG";
  }
  if (key === "outlet") {
    if (value === "") return "Standard tank outlet";
    if (value === "-50") return "50 mm tank outlet";
  }
  return value || "—";
}

/** Stem chip text for the assembling strip */
export function ddStemChipText(key, value) {
  if (key === "outlet" && value === "") return "std";
  return value || "";
}

/**
 * Undo last user-facing answer (and clear auto-filled keys after it).
 * @param {DdStemState} stem
 * @param {string[]} history keys in answer order
 */
export function ddGoBack(stem, history) {
  const nextHist = history.slice();
  const last = nextHist.pop();
  if (!last) return { stem: emptyDdStemState(), history: [] };
  const next = { ...stem };
  // Drop last answer and everything after it in STEM order
  const idx = DD_STEM_KEYS.indexOf(last);
  for (const key of DD_STEM_KEYS.slice(idx)) {
    delete next[key];
  }
  return { stem: next, history: nextHist };
}
