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
    help: "Zone prices one N/L pack — pick Natural Gas (order code ends in N) or LPG (ends in L).",
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

/** Catalog N/L pack matches a concrete N or L fuel choice. */
function gasStemMatches(catalogGas, stemGas) {
  const c = String(catalogGas ?? "");
  const s = String(stemGas ?? "");
  if (c === s) return true;
  if (c === "N/L" && (s === "N" || s === "L")) return true;
  return false;
}

/**
 * Rewrite parked N/L order code to concrete …N or …L.
 * @param {string} orderCode
 * @param {string} fuel "N" | "L"
 */
export function resolveDdFuelOrderCode(orderCode, fuel) {
  if (fuel !== "N" && fuel !== "L") return String(orderCode || "");
  return String(orderCode || "").replace(/N\/L(?=(-50)?$)/i, fuel);
}

/**
 * Swap dual-fuel wording for the chosen fuel.
 * @param {string} name
 * @param {string} fuel "N" | "L"
 */
export function resolveDdFuelName(name, fuel) {
  const label = fuel === "L" ? "LPG" : fuel === "N" ? "Natural Gas" : "";
  if (!label) return String(name || "").trim();
  let s = String(name || "").trim();
  if (/Natural\s+Gas\s+or\s+LPG/i.test(s)) {
    return s.replace(/Natural\s+Gas\s+or\s+LPG/gi, label);
  }
  if (/\bN\/L\b/i.test(s)) {
    return s.replace(/\bN\/L\b/gi, label);
  }
  if (/\b(Natural\s+Gas|Nat\s*Gas|LPG)\b/i.test(s)) return s;
  return s ? `${s} - ${label}` : label;
}

/**
 * @param {DdCodeRow} row
 * @param {string} fuel "N" | "L"
 * @returns {DdCodeRow}
 */
export function resolveDdFuelMatch(row, fuel) {
  return {
    ...row,
    orderCode: resolveDdFuelOrderCode(row.orderCode, fuel),
    name: resolveDdFuelName(row.name || "", fuel),
  };
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
    if (key === "gas") {
      if (!gasStemMatches(parsed.gas, stem.gas)) return false;
      continue;
    }
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
    const raw = parsed[key] ?? "";
    // Zone lists one N/L pack — offer concrete Natural Gas (N) / LPG (L).
    if (key === "gas" && raw === "N/L") {
      set.add("N");
      set.add("L");
      continue;
    }
    set.add(raw);
  }
  return [...set].sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    // Natural Gas before LPG
    if (key === "gas") {
      const rank = (v) => (v === "N" ? 0 : v === "L" ? 1 : 2);
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
    }
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
      // Never auto-pick dual-fuel N/L — always ask Natural Gas vs LPG.
      if (opts.length === 1 && !(key === "gas" && opts[0] === "N/L")) {
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
  if (hits.length !== 1) return null;
  const hit = hits[0];
  const parsed = parseDdSystemCode(hit.orderCode);
  // N/L pack is not a final match until the tech picks N or L.
  if (parsed?.gas === "N/L") {
    if (!stemHas(stem, "gas") || stem.gas === "N/L") return null;
    if (stem.gas !== "N" && stem.gas !== "L") return null;
    return resolveDdFuelMatch(hit, stem.gas);
  }
  return hit;
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
 * Shared name prefix across catalog hits (for partial descriptions while building).
 * @param {string[]} names
 */
function ddCommonNamePrefix(names) {
  if (!names.length) return "";
  let prefix = names[0];
  for (let i = 1; i < names.length; i++) {
    const n = names[i];
    let j = 0;
    while (j < prefix.length && j < n.length && prefix[j] === n[j]) j++;
    prefix = prefix.slice(0, j);
    if (!prefix) break;
  }
  // Trim back to a word boundary so we don't cut mid-token awkwardly
  const cut = prefix.search(/[\s(/,-][^/\s(/,-]*$/);
  if (cut > 8) prefix = prefix.slice(0, cut).trimEnd();
  return prefix.trim();
}

/**
 * Best Zone FG description for the current stem: exact match name, else shared
 * prefix of remaining hits, else plain-English stems answered so far.
 * @param {DdCodeRow[]} catalog
 * @param {DdStemState} stem
 * @param {DdCodeRow|null|undefined} match
 */
export function ddBestProductDescription(catalog, stem, match) {
  if (match?.name) return String(match.name).trim();
  const remaining = filterDdCatalog(catalog, stem);
  const names = remaining.map((r) => String(r.name || "").trim()).filter(Boolean);
  let desc = "";
  if (names.length === 1) desc = names[0];
  else if (names.length > 1) {
    const shared = ddCommonNamePrefix(names);
    if (shared.length >= 12) desc = `${shared}…`;
  }
  if (!desc) {
    /** @type {string[]} */
    const bits = [];
    for (const key of DD_STEM_KEYS) {
      if (!stemHas(stem, key)) continue;
      if (key === "heaters" && stem.series === "DD1") continue;
      bits.push(ddOptionLabel(key, stem[key] ?? ""));
    }
    desc = bits.length ? bits.join(" · ") : "still assembling";
  }
  if (stemHas(stem, "gas") && (stem.gas === "N" || stem.gas === "L")) {
    desc = resolveDdFuelName(desc, stem.gas);
  }
  return desc;
}

/**
 * One-line package readout: code + description.
 * @param {DdCodeRow[]} catalog
 * @param {DdStemState} stem
 * @param {DdCodeRow|null|undefined} match
 */
export function ddPackageDeterminedLine(catalog, stem, match) {
  let code = match?.orderCode || assembleDdCode(stem) || "—";
  if (
    !match &&
    stemHas(stem, "gas") &&
    (stem.gas === "N" || stem.gas === "L") &&
    /N\/L/i.test(code)
  ) {
    code = resolveDdFuelOrderCode(code, stem.gas);
  }
  const desc = ddBestProductDescription(catalog, stem, match);
  return {
    code,
    description: desc,
    text: `Package code determined to be: ${code} - ${desc}.`,
  };
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
