/**
 * Readable commercial unit names for model-pin typeahead.
 *
 * Prefer a cleaned catalogue description when it already reads commercially;
 * otherwise derive from marketing code / series + install + fuel + outlet temp.
 *
 * Series pins use a shorter form (family + install / variant only — no fuel
 * or outlet temp): HD200e → Heavy Duty 200 External.
 *
 * Examples:
 *   HD210EN42 → Heavy Duty 210 External Nat Gas 42 Degree
 *   HD210EN50 → Heavy Duty 210 External Nat Gas 50 Degree
 *   series HD200e → Heavy Duty 200 External
 */

const FUEL_WORDS = {
  N: "Nat Gas",
  NG: "Nat Gas",
  NAT: "Nat Gas",
  L: "LPG",
  LP: "LPG",
  LPG: "LPG",
  B: "Butane",
  BUTANE: "Butane",
};

/**
 * @param {object|null|undefined} model
 * @param {object|null|undefined} [series]
 * @returns {string}
 */
export function getModelCommercialName(model, series = null) {
  if (!model) return "";
  const sku = String(model.sku || model.marketingCode || "").trim();
  const rawDesc = String(model.description || model.name || "").trim();

  const fromDesc = commercialFromCatalogueDescription(rawDesc, series);
  if (fromDesc) return fromDesc;

  const fromSku = deriveCommercialNameFromSku(sku, model, series);
  if (fromSku) return fromSku;

  const fromSeries = commercialFromSeriesOnly(series, rawDesc);
  if (fromSeries) return fromSeries;

  return cleanStars(rawDesc) || sku;
}

/**
 * Short marketing code for the typeahead title row.
 * @param {object|null|undefined} model
 */
export function getModelShortCode(model) {
  if (!model) return "";
  return String(model.sku || model.marketingCode || model.id || "").trim();
}

/**
 * Fuel kind for Pin 3 grouping / colouring.
 * @param {object|null|undefined} model
 * @param {object|null|undefined} [series]
 * @returns {"nat-gas"|"lpg"|"butane"|""}
 */
export function getModelFuelKind(model, series = null) {
  if (!model) return "";
  const commercial = getModelCommercialName(model, series);
  const fromText = fuelKindFromText(commercial);
  if (fromText) return fromText;

  const sku = String(model.sku || model.marketingCode || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const peeled = peelFuelTemp(sku);
  if (peeled?.fuel) {
    const fromPeel = fuelKindFromText(peeled.fuel);
    if (fromPeel) return fromPeel;
  }

  // Marketing SKU mid-fuel letter: HD210EN50 / HD28IL50 / INF26N60
  const skuFuel = sku.match(
    /(?:^|[A-Z0-9])([EI])?([NLB]|NG|LP|LPG)(?=\d{2,3}|$)/
  );
  if (skuFuel) {
    const mapped = FUEL_WORDS[normFuel(skuFuel[2])] || "";
    const fromSku = fuelKindFromText(mapped);
    if (fromSku) return fromSku;
  }

  // Item Number packing: …-50-AKN / …-AKL / …N / …L
  const item = String(model.itemNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pack = item.match(/(?:AK|UA|ZK|K)?([NLB])(?:BLK)?$/);
  if (pack) {
    const mapped = FUEL_WORDS[pack[1]] || "";
    const fromItem = fuelKindFromText(mapped);
    if (fromItem) return fromItem;
  }

  return "";
}

/**
 * @param {string} text
 * @returns {"nat-gas"|"lpg"|"butane"|""}
 */
function fuelKindFromText(text) {
  const s = String(text || "");
  if (/\bNat\s*Gas\b/i.test(s) || /\bNatural\s*Gas\b/i.test(s)) return "nat-gas";
  if (/\bLPG\b/i.test(s) || /\bLP\b/i.test(s)) return "lpg";
  if (/\bButane\b/i.test(s)) return "butane";
  const u = s.toUpperCase().replace(/\s+/g, "");
  if (u === "N" || u === "NG" || u === "NAT") return "nat-gas";
  if (u === "L" || u === "LP" || u === "LPG") return "lpg";
  if (u === "B" || u === "BUTANE") return "butane";
  return "";
}

/**
 * Series-level commercial name (no fuel / outlet temp).
 * e.g. HD200e → Heavy Duty 200 External; Infinity 26 Plus → Infinity 26 Plus
 *
 * @param {object|null|undefined} series
 * @returns {string}
 */
export function getSeriesCommercialName(series) {
  if (!series) return "";
  const fromLabel = expandSeriesLabel(series.label);
  if (fromLabel) return fromLabel;
  const fromId = expandSeriesLabel(series.id);
  if (fromId) return fromId;
  return String(series.label || series.id || "").trim();
}

/**
 * @param {string} desc
 * @param {object|null|undefined} series
 */
function commercialFromCatalogueDescription(desc, series) {
  const cleaned = cleanStars(desc);
  if (!cleaned) return "";
  const u = cleaned.toUpperCase();

  // Already commercial-style (not C'FLOW / CFLOW catalogue jargon)
  if (
    !/\bC'?FLOW\b/.test(u) &&
    !/^CFLOW\b/.test(u) &&
    /\b(EXTERNAL|INTERNAL|COMMERCIAL|INFINITY|HEAVY\s*DUTY|ENVIRO|SMARTSTART|BOOSTER|SOLAR)\b/.test(
      u
    )
  ) {
    const normalised = normaliseLegacyCommercial(cleaned);
    if (normalised) return normalised;
    return titleCaseCommercial(expandFuelTokens(cleaned));
  }

  // C'FLOW HD210E (42) NG  /  C'FLOW HD200 (50) INT NG  /  C'FLOW INFINITY 26 (50) NG
  const cflow = cleaned.match(
    /^C'?FLOW\s+(.+)$/i
  ) || cleaned.match(/^CFLOW\s+(.+)$/i);
  if (!cflow) return "";

  const body = cflow[1].trim();
  const parsed = parseCflowBody(body, series);
  if (parsed) return parsed;

  // Incomplete C'FLOW (missing fuel) — let SKU derivation take over
  return "";
}

/**
 * @param {string} body
 * @param {object|null|undefined} series
 */
function parseCflowBody(body, series) {
  const u = body.toUpperCase().replace(/\s+/g, " ").trim();

  // INFINITY / ENVIRO / PLUS variants
  let m = u.match(
    /^(INFINITY(?:\s+ENVIRO)?(?:\s*\+)?|ENVIRO(?:SMART)?|INF(?:INITY)?)\s*(\d+)?\s*(PLUS|SMARTSTART|ENVIRO\+?)?\s*(?:\(?(?:(\d+))\)?)?\s*(INT(?:ERNAL)?\s+)?(EXT(?:ERNAL)?\s+)?(NG|NAT(?:URAL)?(?:\s*GAS)?|LPG?|LP|BUTANE)\b/i
  );
  if (m) {
    const family = infinityFamilyFromMatch(m[1], m[2], m[3], series);
    const temp = m[4];
    const install = m[5] ? "Internal" : m[6] ? "External" : installFromSeries(series);
    const fuel = FUEL_WORDS[normFuel(m[7])] || m[7];
    return joinCommercial([family, install, fuel, temp ? `${Number(temp)} Degree` : ""]);
  }

  // HD / HDC … (temp) [INT] fuel
  m = u.match(
    /^(HDC?)\s*(\d+)\s*([EI])?\s*(?:\(?(?:(\d+))\)?)?\s*(INT(?:ERNAL)?\s+)?(EXT(?:ERNAL)?\s+)?(NG|NAT(?:URAL)?(?:\s*GAS)?|LPG?|LP|BUTANE)\b/i
  );
  if (m) {
    const prefix = m[1].toUpperCase();
    const num = m[2];
    const ei = (m[3] || "").toUpperCase();
    const temp = m[4];
    let install = "";
    if (m[5]) install = "Internal";
    else if (m[6]) install = "External";
    else if (ei === "I") install = "Internal";
    else if (ei === "E") install = "External";
    else install = installFromSeries(series) || "External";
    const fuel = FUEL_WORDS[normFuel(m[7])] || m[7];
    const family =
      prefix === "HDC"
        ? `Heavy Duty ${num}`
        : `Heavy Duty ${num}`;
    return joinCommercial([family, install, fuel, temp ? `${Number(temp)} Degree` : ""]);
  }

  // B16 / B20 builders style: B16 NG P/SET 50
  m = u.match(
    /^(B\d+)\s+(NG|NAT|LPG?|LP|BUTANE)\b.*?\b(\d{2,3})\b/i
  );
  if (m) {
    const fuel = FUEL_WORDS[normFuel(m[2])] || m[2];
    return joinCommercial([m[1].toUpperCase(), fuel, `${Number(m[3])} Degree`]);
  }

  return "";
}

/**
 * @param {string} sku
 * @param {object|null|undefined} model
 * @param {object|null|undefined} series
 */
function deriveCommercialNameFromSku(sku, model, series) {
  const raw = String(sku || "").trim().toUpperCase();
  if (!raw) return "";

  // HDC211EN75 / HD210EN42 / HD28IL50 / HD200N50 / HD200IN50 / HD250L75
  let m = raw.match(
    /^(HDC?)(\d+)([EI])?([NLB])(\d{2,3})([A-Z0-9]*)$/
  );
  if (m) {
    const [, prefix, num, ei, fuelCode, temp, rest] = m;
    const install = installFromEi(ei, series, prefix, raw);
    const fuel = FUEL_WORDS[fuelCode] || fuelCode;
    const family = `Heavy Duty ${num}`;
    const region = regionSuffix(rest);
    return joinCommercial([
      family,
      install,
      fuel,
      `${Number(temp)} Degree`,
      region,
    ]);
  }

  // HD200AL / HD200AN / HD250AL — commercial L/N without outlet temp
  m = raw.match(/^(HDC?)(\d+)([EI])?A([NLB])([A-Z0-9]*)$/);
  if (m) {
    const [, , num, ei, fuelCode, rest] = m;
    const install = installFromEi(ei, series, "HD", raw) || "External";
    const fuel = FUEL_WORDS[fuelCode] || fuelCode;
    return joinCommercial([
      `Heavy Duty ${num}`,
      install,
      "Commercial",
      fuel,
      regionSuffix(rest),
    ]);
  }

  // HD200LI / HD200NI — internal commercial fuel only
  m = raw.match(/^(HDC?)(\d+)([NLB])I([A-Z0-9]*)$/);
  if (m) {
    const [, , num, fuelCode, rest] = m;
    const fuel = FUEL_WORDS[fuelCode] || fuelCode;
    return joinCommercial([
      `Heavy Duty ${num}`,
      "Internal",
      "Commercial",
      fuel,
      regionSuffix(rest),
    ]);
  }

  // INF32E60B — Enviro + temp + trailing fuel letter
  m = raw.match(/^(INF)(\d+)E(\d{2,3})([NLB])([A-Z0-9]*)$/);
  if (m) {
    const fuel = FUEL_WORDS[m[4]] || m[4];
    return joinCommercial([
      `Infinity ${m[2]} Enviro`,
      fuel,
      `${Number(m[3])} Degree`,
      regionSuffix(m[5]),
    ]);
  }

  // INF26N50 / INF26IN50 / INF26EL50A / INF26PN50 / INF32EEN60NZ / INF26B50M
  m = raw.match(
    /^(INF)(\d+)([A-Z]*?)([NLB])(\d{0,3})([A-Z0-9]*)$/
  );
  if (m) {
    const [, , num, mid, fuelCode, temp, rest] = m;
    const midU = mid.toUpperCase();
    const bits = infinityBitsFromMid(num, midU, series);
    const fuel = FUEL_WORDS[fuelCode] || fuelCode;
    const tempBit = temp ? `${Number(temp)} Degree` : "";
    return joinCommercial([
      bits.family,
      bits.install,
      bits.variant,
      fuel,
      tempBit,
      regionSuffix(rest + (bits.regionRest || "")),
    ]);
  }

  // ENV32N / ENV26L / ENVSMTN50
  m = raw.match(/^ENV(?:IRO)?(?:SMART)?(\d+)?([A-Z]*?)([NLB])(\d{0,3})([A-Z0-9]*)$/);
  if (m && raw.startsWith("ENV")) {
    if (raw.startsWith("ENVSMT")) {
      const sm = raw.match(/^ENVSMT([NLB])(\d{0,3})([A-Z0-9]*)$/);
      if (sm) {
        const fuel = FUEL_WORDS[sm[1]] || sm[1];
        const tempBit = sm[2] ? `${Number(sm[2])} Degree` : "";
        return joinCommercial(["Envirosmart", fuel, tempBit, regionSuffix(sm[3])]);
      }
    }
    const num = m[1];
    const fuel = FUEL_WORDS[m[3]] || m[3];
    const tempBit = m[4] ? `${Number(m[4])} Degree` : "";
    return joinCommercial([
      num ? `Infinity ${num} Enviro` : "Infinity Enviro",
      fuel,
      tempBit,
      regionSuffix(m[5]),
    ]);
  }

  // B16N50A / B26L60
  m = raw.match(/^(B\d+)([NLB])(\d{2,3})([A-Z0-9]*)$/);
  if (m) {
    const fuel = FUEL_WORDS[m[2]] || m[2];
    return joinCommercial([
      m[1],
      fuel,
      `${Number(m[3])} Degree`,
      regionSuffix(m[4]),
    ]);
  }

  // S26N70 / S26IL70 solar boosters
  m = raw.match(/^S(\d+)([EI])?([NLB])(\d{2,3})([A-Z0-9]*)$/);
  if (m) {
    const install = installFromEi(m[2], series, "S", raw);
    const fuel = FUEL_WORDS[m[3]] || m[3];
    return joinCommercial([
      `Solar Booster ${m[1]}`,
      install,
      fuel,
      `${Number(m[4])} Degree`,
      regionSuffix(m[5]),
    ]);
  }

  // K26 PN50 / K26N60M Infinity + controller packs
  m = raw.match(/^K(\d+)(P)?([NLB])(\d{0,3})([A-Z0-9]*)$/);
  if (m) {
    const plus = m[2] ? "Plus" : "";
    const fuel = FUEL_WORDS[m[3]] || m[3];
    const tempBit = m[4] ? `${Number(m[4])} Degree` : "";
    return joinCommercial([
      `Infinity ${m[1]}`,
      plus,
      fuel,
      tempBit,
      "with controller",
      regionSuffix(m[5]),
    ]);
  }

  // Series-assisted fallback: peel fuel+temp off the end when series label known
  if (series?.label) {
    const peeled = peelFuelTemp(raw);
    if (peeled) {
      const base = expandSeriesLabel(series.label);
      if (base) {
        return joinCommercial([
          base,
          peeled.fuel,
          peeled.temp ? `${peeled.temp} Degree` : "",
          peeled.region,
        ]);
      }
    }
  }

  return "";
}

/**
 * @param {string|undefined} ei
 * @param {object|null|undefined} series
 * @param {string} prefix
 * @param {string} skuU
 */
function installFromEi(ei, series, prefix, skuU) {
  const fromSeries = installFromSeries(series);
  if (ei === "I") return "Internal";
  if (ei === "E") return "External";
  if (fromSeries) return fromSeries;
  // HD200 / HD250 without E letter are external; *I* mid-code already caught
  if (/^HD(C)?\d+I/.test(skuU)) return "Internal";
  if (/^HD(C)?\d+/.test(skuU)) return "External";
  return "";
}

/**
 * @param {object|null|undefined} series
 */
function installFromSeries(series) {
  const label = String(series?.label || "");
  if (/internal|\bi\b/i.test(label) || /i$/i.test(label)) return "Internal";
  if (/external|\be\b/i.test(label) || /e$/i.test(label)) return "External";
  const id = String(series?.id || "");
  if (/internal|(^|-)i$/i.test(id) || /i$/i.test(id)) return "Internal";
  if (/external|(^|-)e$/i.test(id) || /e$/i.test(id)) return "External";
  return "";
}

/**
 * @param {string} num
 * @param {string} midU
 * @param {object|null|undefined} series
 */
function infinityBitsFromMid(num, midU, series) {
  let family = `Infinity ${num}`;
  let install = "";
  let variant = "";
  let regionRest = "";

  // Order matters: longer tokens first
  let rest = midU;
  if (rest.startsWith("SS") || rest === "S" || rest.startsWith("S")) {
    // Smartstart often INF26S* — but INF26EL is Enviro L, not Smartstart
    if (/^S{1,2}(?![A-Z]*E)/.test(rest) && !rest.startsWith("EL") && !rest.startsWith("EE")) {
      if (rest.startsWith("SS")) {
        variant = "Smartstart";
        rest = rest.slice(2);
      } else if (rest.startsWith("S") && !/^S?[EI]?$/.test(rest) === false) {
        // INF26S… Smartstart when not Enviro (E…)
        if (!rest.startsWith("SE") && rest !== "E") {
          // handled below carefully
        }
      }
    }
  }

  if (rest.includes("EE")) {
    // INF32EEN / INF32EEL — Enviro External
    variant = "Enviro";
    install = "External";
    rest = rest.replace("EE", "");
  } else if (rest.includes("EI")) {
    variant = "Enviro";
    install = "Internal";
    rest = rest.replace("EI", "");
  } else if (rest.startsWith("EL") || rest.startsWith("EN") || rest.startsWith("EB")) {
    // INF26EL50 — Enviro + fuel letter is outside mid (fuel separate)
    // mid is only letters between capacity and fuel → for INF26EL50 mid="E"
    // actually regex ([A-Z]*?) is non-greedy before fuel — INF26EL50 → mid=E, fuel=L
    // INF26EL → wait INF26EL50A: INF + 26 + E + L + 50 + A → mid=E, fuel=L ✓ Enviro external-ish
    variant = "Enviro";
    rest = rest.slice(1);
  } else if (rest.startsWith("P")) {
    variant = "Plus";
    rest = rest.slice(1);
  } else if (rest.startsWith("SS")) {
    variant = "Smartstart";
    rest = rest.slice(2);
  } else if (rest.startsWith("S") && !rest.startsWith("SE")) {
    variant = "Smartstart";
    rest = rest.slice(1);
  }

  if (rest.startsWith("I")) {
    install = "Internal";
    rest = rest.slice(1);
  } else if (rest.startsWith("E")) {
    install = "External";
    rest = rest.slice(1);
  }

  if (!install) install = installFromSeries(series);
  if (!variant && /enviro/i.test(String(series?.label || ""))) variant = "Enviro";
  if (!variant && /plus/i.test(String(series?.label || ""))) variant = "Plus";
  if (!variant && /smartstart/i.test(String(series?.label || ""))) {
    variant = "Smartstart";
  }
  if (/internal/i.test(String(series?.label || "")) && !install) {
    install = "Internal";
  }

  // Series label can replace generic Infinity N
  const seriesExpanded = expandSeriesLabel(series?.label || "");
  if (seriesExpanded) family = seriesExpanded.replace(/\s+Internal$/i, "").replace(/\s+External$/i, "");

  regionRest = rest;
  return { family, install, variant, regionRest };
}

function infinityFamilyFromMatch(head, num, variant, series) {
  const seriesExpanded = expandSeriesLabel(series?.label || "");
  if (seriesExpanded) {
    return seriesExpanded
      .replace(/\s+Internal$/i, "")
      .replace(/\s+External$/i, "");
  }
  const h = String(head || "").toUpperCase();
  const n = num || "";
  let family = n ? `Infinity ${n}` : "Infinity";
  if (/ENVIRO/.test(h) || /ENVIRO/i.test(String(variant || ""))) {
    family = n ? `Infinity ${n} Enviro` : "Infinity Enviro";
  }
  if (/PLUS/i.test(String(variant || ""))) family += " Plus";
  if (/SMARTSTART/i.test(String(variant || ""))) family += " Smartstart";
  return family.trim();
}

/**
 * @param {string} label
 */
function expandSeriesLabel(label) {
  const s = String(label || "").trim();
  if (!s) return "";

  let m = s.match(/^HDC?(\d+)([ei])$/i);
  if (m) {
    const install = m[2].toLowerCase() === "i" ? "Internal" : "External";
    return joinCommercial([`Heavy Duty ${m[1]}`, install]);
  }
  m = s.match(/^HDC?(\d+)$/i);
  if (m) return `Heavy Duty ${m[1]}`;

  if (/^Infinity\b/i.test(s)) return s.replace(/\s*\(internal\)\s*/i, " Internal").replace(/\s+/g, " ").trim();
  if (/^INF\s*(\d+)/i.test(s)) {
    return s.replace(/^INF\s*/i, "Infinity ").trim();
  }
  return s;
}

function commercialFromSeriesOnly(series, rawDesc) {
  const expanded = expandSeriesLabel(series?.label || "");
  if (expanded) return expanded;
  return cleanStars(rawDesc);
}

function peelFuelTemp(skuU) {
  const m = String(skuU).match(/([NLB])(\d{2,3})([A-Z0-9]*)$/);
  if (!m) return null;
  return {
    fuel: FUEL_WORDS[m[1]] || m[1],
    temp: Number(m[2]),
    region: regionSuffix(m[3]),
  };
}

function regionSuffix(rest) {
  const r = String(rest || "").toUpperCase();
  if (!r) return "";
  if (r.includes("NZ")) return "NZ";
  return "";
}

function normFuel(token) {
  return String(token || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace("NATURALGAS", "NAT")
    .replace("NATGAS", "NAT");
}

/**
 * Legacy rows like "HD 200E EXTERNAL COMMERCIAL L" → readable commercial.
 * @param {string} text
 */
function normaliseLegacyCommercial(text) {
  const u = String(text || "").toUpperCase().replace(/\s+/g, " ").trim();
  let m = u.match(
    /^HD\s*(\d+)\s*([EI])?\s+(EXTERNAL|INTERNAL)\s+COMMERCIAL\s+([NLB]|NG|LPG?|LP|BUTANE)\b/
  );
  if (m) {
    const install = m[3].startsWith("INT") ? "Internal" : "External";
    const fuel = FUEL_WORDS[normFuel(m[4])] || m[4];
    return joinCommercial([
      `Heavy Duty ${m[1]}`,
      install,
      "Commercial",
      fuel,
    ]);
  }
  m = u.match(
    /^INFINITY\s+ENVIRO\s+(\d+)\s+(NG|NAT(?:URAL)?(?:\s*GAS)?|LPG?|LP|BUTANE)\b/
  );
  if (m) {
    const fuel = FUEL_WORDS[normFuel(m[2])] || m[2];
    return joinCommercial([`Infinity ${m[1]} Enviro`, fuel]);
  }
  m = u.match(
    /^INFINITY\s+V?(\d+)\s+A\/F\s+(NG|NAT(?:URAL)?(?:\s*GAS)?|LPG?|LP|BUTANE)\b/
  );
  if (m) {
    const fuel = FUEL_WORDS[normFuel(m[2])] || m[2];
    return joinCommercial([`Infinity ${m[1]}`, "A/F", fuel]);
  }
  return "";
}

function expandFuelTokens(text) {
  return String(text)
    .replace(/\bNAT(?:URAL)?\s*GAS\b/gi, "Nat Gas")
    .replace(/\bNG\b/gi, "Nat Gas")
    .replace(/\bNAT\b/gi, "Nat Gas")
    .replace(/\bLP\b/gi, "LPG")
    .replace(/\bBUTANE\b/gi, "Butane");
}

function titleCaseCommercial(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b([a-zA-Z]+)\b/g,
      (w) => {
        const u = w.toUpperCase();
        if (u === "LPG" || u === "NZ" || u === "NG") return u === "NG" ? "Nat Gas" : u;
        if (u === "A/F") return "A/F";
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
    )
    .replace(/\bNat Gas\b/g, "Nat Gas")
    .replace(/\bLpg\b/g, "LPG");
}

function cleanStars(text) {
  return String(text || "")
    .replace(/^\*+\s*/, "")
    .replace(/\s*\*+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function joinCommercial(parts) {
  return parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
