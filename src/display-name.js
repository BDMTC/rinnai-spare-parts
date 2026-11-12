/**
 * Display-time part-name expand + short plain-English card blurbs.
 * Search still uses the official price-list string; this only reshapes the card.
 */

function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/+.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Preferred layman word for locked abbrev groups (short catalogue form → display). */
const DISPLAY_BY_GROUP = {
  assy: "assembly",
  "w-assy": "with assembly",
  comb: "combustion",
  conv: "convection",
  "con-kit": "conversion kit",
  brkt: "bracket",
  hx: "heat exchanger",
  ht: "high-tension",
  pcb: "circuit board",
  hsg: "housing",
  pnl: "panel",
  "w-pnl": "wall panel",
  btm: "bottom",
  oh: "overheat",
  ohs: "overheat sensor",
  mtr: "metre",
  elect: "electrical",
  "c-w": "complete with",
  reg: "regulator",
  trans: "transformer",
  inj: "injector",
  control: "control",
  cab: "cabinet",
  idu: "indoor unit",
  odu: "outdoor unit",
  temp: "temperature",
  rh: "right-hand",
  lh: "left-hand",
  blk: "black",
  compr: "compressor",
  extens: "extension",
  "t-stat": "thermostat",
  "t-couple": "thermocouple",
  "p-switch": "pressure switch",
  press: "pressure",
  exp: "expansion",
  ign: "ignition",
  exh: "exhaust",
  conn: "connector",
  supp: "support",
  waterproof: "waterproof",
  adapter: "adapter",
  chamber: "chamber",
  "w-o": "without",
  inc: "including",
  ret: "retainer",
  dia: "diameter",
  var: "variable",
  repl: "replacement",
  std: "standard",
  ptr: "P&T relief",
  "evap-c": "evaporative cooler",
  "t-red": "terra red",
  burner: "burner",
  sparker: "sparker",
  spindle: "spindle",
  conduit: "conduit",
  transiton: "transition",
  components: "components",
  "o-ring": "O-ring",
  sml: "small",
  med: "medium",
  pcs: "pieces",
  waterflow: "water flow",
  "gas-valve": "gas valve",
  pack: "pack",
  "fast-blow": "fast-blow",
  "pan-head": "pan-head",
  "drain-pan": "drain pan",
  "compression-fitting": "compression fitting",
  "reversing-valve": "reversing valve",
  condensate: "condensate",
  condenser: "condenser",
  "outdoor-coil": "outdoor coil",
  "extension-loom": "extension loom",
  "extension-timer": "extension timer",
  harness: "harness",
  loom: "loom",
  filter: "filter",
  flue: "flue",
  thermistor: "thermistor",
  electrode: "electrode",
  gasket: "gasket",
  capacitor: "capacitor",
  manifold: "manifold",
  damper: "damper",
  bypass: "bypass",
  orifice: "orifice",
  aeration: "aeration",
  snorkel: "snorkel",
  grommet: "grommet",
  contactor: "contactor",
  baffle: "baffle",
  sensor: "sensor",
  servo: "servo",
  piezo: "piezo",
  spring: "spring",
  relief: "relief",
  union: "union",
  decal: "decal",
  "lp-fuel": "LPG",
  "nat-gas": "natural gas",
};

/** Phrase rewrites applied before token expand (longest first). */
const PHRASE_REWRITES = [
  { from: "hex exch", to: "heat exchanger" },
  { from: "heat exchanger", to: "heat exchanger" },
  { from: "heat exch", to: "heat exchanger" },
  { from: "heat ex", to: "heat exchanger" },
  { from: "ht lead", to: "high-tension lead" },
  { from: "high tension lead", to: "high-tension lead" },
  { from: "high tension", to: "high-tension" },
  { from: "con kit", to: "conversion kit" },
  { from: "conv/kit", to: "conversion kit" },
  { from: "c/w", to: "complete with" },
  { from: "w/pnl", to: "wall panel" },
  { from: "w/panel", to: "wall panel" },
  { from: "w/assy", to: "with assembly" },
  { from: "w/o", to: "without" },
  { from: "o/h", to: "overheat" },
  { from: "t/stat", to: "thermostat" },
  { from: "t/couple", to: "thermocouple" },
  { from: "thermo couple", to: "thermocouple" },
  { from: "p/switch", to: "pressure switch" },
  { from: "press switch", to: "pressure switch" },
  { from: "fan com", to: "fan combustion" }, // catalogue typo / truncate of COMB
  { from: "pc board", to: "circuit board" },
  { from: "printed circuit board", to: "circuit board" },
];

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "without",
]);

/** Chassis / model-ish tokens stay uppercase as in the price list. */
function isChassisToken(tok) {
  const t = String(tok || "");
  if (!t) return false;
  if (!/\d/.test(t)) return false;
  // e.g. N3237, VRM2632WC, 309FT3, VM2632FFU, / D kept separate
  return /^[A-Za-z]*\d[A-Za-z0-9./-]*$/.test(t);
}

function titleCaseWord(word, index) {
  const w = String(word || "");
  if (!w) return w;
  if (w.includes("-")) {
    return w
      .split("-")
      .map((part, i) => titleCaseWord(part, index + i))
      .join("-");
  }
  // Preserve O-ring / LPG / P&T style already mixed
  if (/[A-Z]/.test(w) && /[a-z]/.test(w)) return w;
  if (/&/.test(w)) return w;
  // Keep catalogue discontinued marker, title-case the rest (*HEAT → *Heat)
  const star = w.match(/^(\*+)(.*)$/);
  if (star) {
    const rest = titleCaseWord(star[2], index);
    return rest ? `${star[1]}${rest}` : star[1];
  }
  const lower = w.toLowerCase();
  if (index > 0 && SMALL_WORDS.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatDisplayTitle(rawTokens) {
  return rawTokens
    .map((tok, i) => {
      if (isChassisToken(tok)) return String(tok).toUpperCase();
      if (/^\d/.test(tok)) return tok;
      return titleCaseWord(tok, i);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build short-form → group display lookup from abbrev index.
 * Only locked / locked-careful groups; skips forms that are already the display word.
 * @param {{ groups?: Array }|null} abbrevIndex
 */
function buildShortFormMap(abbrevIndex) {
  /** @type {Map<string, { groupId: string, display: string }>} */
  const map = new Map();
  for (const group of abbrevIndex?.groups || []) {
    if (!group || group.status === "unset") continue;
    if (
      group.status &&
      group.status !== "locked" &&
      group.status !== "locked-careful"
    ) {
      continue;
    }
    const display = DISPLAY_BY_GROUP[group.id];
    if (!display) continue;
    const displayN = normalise(display);
    for (const form of group.forms || []) {
      const f = normalise(form);
      if (!f || f === displayN) continue;
      // First group wins if a form were duplicated across groups.
      if (!map.has(f)) map.set(f, { groupId: group.id, display });
    }
  }
  return map;
}

/**
 * Expand locked abbrevs in a price-list name for card title display.
 * @param {string} name official price-list description
 * @param {{ groups?: Array }|null} abbrevIndex
 * @returns {{ title: string, expanded: boolean, official: string }}
 */
export function expandDisplayTitle(name, abbrevIndex) {
  const official = String(name || "").trim();
  if (!official) {
    return { title: "", expanded: false, official: "" };
  }

  let work = normalise(official);

  // Phrase-level rewrites (longest first)
  const phrases = [...PHRASE_REWRITES].sort(
    (a, b) => b.from.length - a.from.length
  );
  for (const { from, to } of phrases) {
    const needle = ` ${from} `;
    let hay = ` ${work} `;
    if (!hay.includes(needle)) continue;
    hay = hay.split(needle).join(` ${to} `);
    work = hay.replace(/\s+/g, " ").trim();
  }

  const shortMap = buildShortFormMap(abbrevIndex);
  const alreadyExpandedWord = new Set(
    Object.values(DISPLAY_BY_GROUP).flatMap((d) => normalise(d).split(" "))
  );
  const out = [];
  for (const tok of work.split(" ").filter(Boolean)) {
    // Slash-token: expand known whole form, else try segments
    if (tok.includes("/")) {
      const whole = shortMap.get(tok);
      if (whole) {
        out.push(...whole.display.split(" "));
        continue;
      }
      const segs = tok.split("/").filter(Boolean);
      const expandedSegs = segs.map((s) => {
        if (alreadyExpandedWord.has(s)) return s;
        return shortMap.get(s)?.display || s;
      });
      out.push(expandedSegs.join("/"));
      continue;
    }

    // Length shorthand 2mtr → 2 metre
    const mtr = tok.match(/^(\d+)(mtr)$/);
    if (mtr) {
      out.push(mtr[1], DISPLAY_BY_GROUP.mtr || "metre");
      continue;
    }

    // Already the long form (e.g. exchanger after “heat exchanger” phrase rewrite)
    if (alreadyExpandedWord.has(tok)) {
      out.push(tok);
      continue;
    }

    const hit = shortMap.get(tok);
    if (hit) {
      out.push(...hit.display.split(" "));
      continue;
    }
    out.push(tok);
  }

  // Recover chassis token casing from the official string
  const officialToks = official.split(/\s+/).filter(Boolean);
  const chassisByN = new Map();
  for (const t of officialToks) {
    if (isChassisToken(t)) chassisByN.set(normalise(t), t.toUpperCase());
  }
  const merged = out.map((t) => chassisByN.get(normalise(t)) || t);

  const title = formatDisplayTitle(merged);
  const expanded = normalise(title) !== normalise(official);
  return { title: expanded ? title : formatDisplayTitle(officialToks), expanded, official };
}

/** Strip chassis / model tokens and noise from a display title for blurb prose. */
function proseTokensFromTitle(title) {
  return String(title || "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !isChassisToken(t))
    .filter((t) => !/^[*]+$/.test(t))
    .map((t) => t.replace(/^\*+/, ""))
    .filter(Boolean);
}

function sentenceFromPhrase(words) {
  const raw = words.join(" ").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const clipped = raw.length > 72 ? `${raw.slice(0, 69).trim()}…` : raw;
  const lower = clipped.charAt(0).toLowerCase() + clipped.slice(1);
  const body = lower.endsWith(".") ? lower.slice(0, -1) : lower;
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}

/**
 * Pattern blurbs from the official / expanded name (no uniqueness claims).
 * @param {string} nameN
 * @param {string} displayTitle
 * @returns {string|null}
 */
function heuristicSummaryFromName(nameN, displayTitle) {
  if (
    /\bfan\b/.test(nameN) &&
    (/\b(comb|combustion)\b/.test(nameN) || /\bfan com\b/.test(nameN))
  ) {
    if (/\bgasket\b/.test(nameN)) return "Gasket for the combustion fan assembly.";
    if (/\bo-?ring\b/.test(nameN)) return "O-ring for the combustion fan assembly.";
    if (/\bhousing\b|\bhsg\b/.test(nameN)) return "Housing for the combustion fan.";
    if (/\bmotor\b|\bmtr\b/.test(nameN) && !/\bmetre\b/.test(nameN)) {
      return "Combustion fan motor.";
    }
    return "Combustion fan assembly.";
  }
  if (/\bfan\b/.test(nameN) && /\bconv|convection\b/.test(nameN)) {
    return "Convection fan / blower.";
  }
  if (/\bfan\b/.test(nameN)) {
    if (/\bgasket\b/.test(nameN)) return "Fan gasket.";
    if (/\bo-?ring\b/.test(nameN)) return "Fan O-ring.";
    if (/\bblade\b|\bimpeller\b/.test(nameN)) return "Fan blade / impeller.";
    if (/\bmotor\b/.test(nameN)) return "Fan motor.";
    if (/\bhousing\b|\bhsg\b|\bcasing\b/.test(nameN)) return "Fan housing / casing.";
    if (/\b(assy|assembly)\b/.test(nameN)) return "Fan assembly.";
    return "Fan-related spare.";
  }
  if ((/\bhex\b/.test(nameN) || /\bheat\b/.test(nameN)) && /\bexch/.test(nameN)) {
    if (/\bgasket\b/.test(nameN)) return "Heat-exchanger gasket.";
    if (/\binsulat/.test(nameN)) return "Heat-exchanger insulation.";
    if (/\btop\b/.test(nameN)) return "Top half of the heat exchanger.";
    if (/\b(btm|bot|bottom)\b/.test(nameN)) return "Bottom half of the heat exchanger.";
    if (/\b(assy|assembly)\b/.test(nameN)) return "Heat exchanger assembly.";
    return "Heat exchanger.";
  }
  if (/\belectrode\b/.test(nameN)) {
    if (/\b(assy|assembly)\b/.test(nameN)) return "Ignition electrode assembly.";
    return "Ignition / flame-sensing electrode.";
  }
  if (/\bflame rod\b|\bflamerod\b/.test(nameN)) return "Flame rod (flame sensor).";
  if (/\bsparker\b/.test(nameN) && (/\bht\b/.test(nameN) || /\blead\b/.test(nameN))) {
    return "Spark generator kit including the high-tension lead.";
  }
  if (/\bsparker\b|\bspark\b/.test(nameN)) return "Spark / ignition generator.";
  if (/\blead\b/.test(nameN) && (/\bht\b/.test(nameN) || /\bhigh[- ]?tension\b/.test(nameN))) {
    return "High-tension spark lead (ignition cable).";
  }
  if (/\bbypass\b/.test(nameN) && /\bservo\b/.test(nameN)) {
    return "Bypass water-flow servo valve assembly.";
  }
  if (/\bwater ?flow\b/.test(nameN) && /\bservo\b/.test(nameN)) {
    return "Water-flow servo valve assembly.";
  }
  if (/\bservo\b/.test(nameN)) return "Servo valve / actuator.";
  if (/\b(brkt|bracket)\b/.test(nameN) && /\bthermistor\b/.test(nameN)) {
    return "Mounting bracket for a thermistor.";
  }
  if (/\bthermistor\b/.test(nameN)) return "Thermistor (temperature sensor).";
  if (/\bthermocouple\b|\bt\/couple\b/.test(nameN)) return "Thermocouple.";
  if (/\bthermostat\b|\bt\/stat\b/.test(nameN)) return "Thermostat.";
  if (/\b(pcb|circuit board|pc board)\b/.test(nameN)) {
    return "Printed circuit board (controller electronics).";
  }
  if (/\bharness\b|\bharn\b/.test(nameN)) return "Wiring harness.";
  if (/\bloom\b/.test(nameN)) return "Wiring loom.";
  if (/\bfilter\b/.test(nameN)) {
    if (/\b(brkt|bracket)\b/.test(nameN)) return "Filter mounting bracket.";
    return "Filter assembly / element.";
  }
  if (/\bo-?ring\b|\boring\b/.test(nameN)) return "O-ring seal.";
  if (/\bgasket\b|\bgask\b/.test(nameN)) return "Gasket / sealing face.";
  if (/\bseal\b/.test(nameN)) return "Seal.";
  if (/\bmanifold\b/.test(nameN)) {
    if (/\b(lp|lpg)\b/.test(nameN)) return "LPG gas manifold.";
    if (/\b(nat|ng)\b/.test(nameN)) return "Natural-gas manifold.";
    return "Gas / water manifold.";
  }
  if (/\bburner\b|\bbrnr\b|\bbrn\b/.test(nameN)) return "Burner component.";
  if (/\binjector\b|\binj\b/.test(nameN)) return "Gas injector / jet.";
  if (/\borifice\b/.test(nameN)) return "Orifice / jet.";
  if (/\bvalve\b/.test(nameN)) {
    if (/\bgas\b/.test(nameN)) return "Gas valve.";
    if (/\brelief\b|\bptr\b/.test(nameN)) return "Relief valve.";
    if (/\breversing\b|\brev\b/.test(nameN)) return "Reversing valve.";
    return "Valve.";
  }
  if (/\bregulator\b|\breg\b/.test(nameN)) return "Regulator.";
  if (/\btransformer\b|\btrans\b/.test(nameN) && !/\btransition\b/.test(nameN)) {
    return "Transformer.";
  }
  if (/\bsensor\b/.test(nameN)) {
    if (/\boverheat\b|\bohs\b|\bo\/h\b/.test(nameN)) return "Overheat sensor / switch.";
    return "Sensor.";
  }
  if (/\boverheat\b|\bohs\b/.test(nameN)) return "Overheat safety device.";
  if (/\bpressure switch\b|\bp\/switch\b|\bpress switch\b/.test(nameN)) {
    return "Pressure switch.";
  }
  if (/\bpanel\b|\bpnl\b/.test(nameN)) {
    if (/\bfront\b/.test(nameN)) return "Front panel / fascia.";
    if (/\bwall\b/.test(nameN)) return "Wall panel set.";
    return "Panel / cover.";
  }
  if (/\b(brkt|bracket)\b/.test(nameN)) return "Mounting bracket.";
  if (/\bhousing\b|\bhsg\b/.test(nameN)) return "Housing.";
  if (/\bcabinet\b|\bcab\b/.test(nameN)) return "Cabinet / casing part.";
  if (/\bflue\b/.test(nameN)) return "Flue / flue pipe part.";
  if (/\bcapacit/.test(nameN)) return "Capacitor.";
  if (/\bfuse\b/.test(nameN)) return "Fuse.";
  if (/\bcontactor\b/.test(nameN)) return "Contactor.";
  if (/\bspring\b/.test(nameN)) return "Spring.";
  if (/\bdamper\b/.test(nameN)) return "Damper.";
  if (/\bgrommet\b/.test(nameN)) return "Grommet.";
  if (/\bsnorkel\b/.test(nameN)) return "Snorkel / intake tube.";
  if (/\baeration\b/.test(nameN)) return "Aeration component.";
  if (/\bpipe\b|\bhose\b|\btube\b/.test(nameN)) return "Pipe / hose / tube.";
  if (/\bclip\b|\bclamp\b|\bretainer\b|\bret\b/.test(nameN)) {
    return "Clip / clamp / retainer.";
  }
  if (/\bscrew\b|\bbolt\b|\bnut\b|\bwasher\b/.test(nameN)) {
    return "Fastener.";
  }
  if (/\binsulat/.test(nameN)) return "Insulation.";
  if (/\blabel\b|\bdecal\b/.test(nameN)) return "Label / decal.";
  if (/\bconversion kit\b|\bcon kit\b|\bconv\/kit\b/.test(nameN)) {
    return "Fuel conversion kit.";
  }
  if (/\bignit/.test(nameN) || /\bpiezo\b/.test(nameN)) return "Ignition component.";
  if (/\bmotor\b/.test(nameN)) return "Motor.";
  if (/\bcompressor\b|\bcompr\b/.test(nameN)) return "Compressor.";
  if (/\bconnector\b|\bconn\b/.test(nameN)) return "Connector / connecting piece.";
  if (/\bunion\b/.test(nameN)) return "Union fitting.";
  if (/\badapter\b|\badaptor\b|\badptr\b|\badpt\b/.test(nameN)) return "Adapter.";
  if (/\bsupport\b|\bsupp\b/.test(nameN)) return "Support bracket / brace.";
  if (/\bbrace\b/.test(nameN)) return "Brace.";
  if (/\bcover\b|\blid\b/.test(nameN)) return "Cover / lid.";
  if (/\bdoor\b/.test(nameN)) return "Door.";
  if (/\bvent\b|\bterminal\b/.test(nameN)) return "Vent / terminal.";
  if (/\bparts\b/.test(nameN) && /\b(heating|logfires|lifestyle|commercial|solar|storage|cooling|climate|cont\.? flow)\b/.test(nameN)) {
    return "Discount / category header — not a spare part.";
  }

  // Universal fallback: expanded title without chassis soup
  const prose = proseTokensFromTitle(displayTitle);
  if (!prose.length) return "Spare part from the price list.";
  // Prefer a short noun-ish phrase (drop trailing slash fragments)
  const cleaned = prose.filter((t) => t !== "/" && t !== "-");
  return sentenceFromPhrase(cleaned.slice(0, 10)) || "Spare part from the price list.";
}

/**
 * Resolve an offline curated blurb from part-blurbs.json.
 * @param {string} code
 * @param {object|null|undefined} blurbDoc
 * @returns {string|null}
 */
function curatedBlurb(code, blurbDoc) {
  if (!code || !blurbDoc) return null;
  const entry = blurbDoc.blurbs?.[code] || blurbDoc[code];
  if (!entry) return null;
  if (typeof entry === "string") {
    const t = entry.trim();
    return t || null;
  }
  const t = String(entry.text || "").trim();
  return t || null;
}

/**
 * Short plain-English summary for every result card.
 * Order: assembly-map facts → curated offline blurbs → name heuristics.
 * @param {object} part
 * @param {{ parentByCode?: Map, childByCode?: Map }|null} assemblyIndex
 * @param {{ groups?: Array }|null} [abbrevIndex]
 * @param {object|null} [blurbDoc] part-blurbs.json
 * @returns {string}
 */
export function plainEnglishSummary(
  part,
  assemblyIndex,
  abbrevIndex = null,
  blurbDoc = null
) {
  if (!part) return "Spare part from the price list.";
  const code = String(part.code || "").trim();
  const nameN = normalise(part.name);
  const display = expandDisplayTitle(part.name || "", abbrevIndex);
  const displayTitle = display.title || part.name || part.code || "";
  const parent = code ? assemblyIndex?.parentByCode?.get(code) : null;
  const child = code ? assemblyIndex?.childByCode?.get(code) : null;

  // Richer blurbs from confirmed assembly maps
  if (parent?.conceptId === "fan") {
    return "Combustion fan — the only fan assembly on this unit.";
  }
  if (parent?.conceptId === "heat-exchanger") {
    const role = parent.duoGroup?.role;
    if (role === "top") {
      return "Top half of the heat exchanger; check whether bottom is also needed.";
    }
    if (role === "bottom") {
      return "Bottom half of the heat exchanger; pair with the top half when replacing both.";
    }
    return "Heat exchanger assembly for this chassis.";
  }
  if (parent?.conceptId === "electrode") {
    return "Ignition electrode kit (flame rod and brackets sit under this assembly).";
  }
  if (parent?.conceptId === "front-panel") {
    return "Front panel kit for this chassis finish.";
  }

  if (child) {
    const role = String(child.role || "").toLowerCase();
    const concept = child.conceptId;
    const parentBits = (child.parents || [])
      .map((p) => p.shortName || p.parentName || p.parentCode)
      .filter(Boolean);
    const parentNote = parentBits.length
      ? ` under ${parentBits.join(" / ")}`
      : "";

    if (concept === "fan") {
      if (role === "gasket") {
        return "Fan gasket; usually ordered with the combustion fan.";
      }
      if (role === "o-ring" || role === "oring" || role === "o ring") {
        return "Fan O-ring; usually ordered with the combustion fan.";
      }
      if (role === "bolt") {
        return "Fan mounting bolt; usually ordered with the combustion fan.";
      }
      return `Sub-component of the combustion fan${parentNote}.`;
    }
    if (concept === "heat-exchanger") {
      if (role === "gasket" && (child.shared || (child.parents || []).length > 1)) {
        return "Shared heat-exchanger gasket — fits top and bottom; also sold on its own.";
      }
      if (role === "insulation") {
        return "Heat-exchanger insulation; goes with the top HEX assembly.";
      }
      if (role === "gasket") {
        return "Heat-exchanger gasket for the mapped parent assembly.";
      }
      return `Sub-component of the heat exchanger${parentNote}.`;
    }
    if (concept === "electrode") {
      if (role === "electrode" || role === "flame-rod" || role === "flame rod") {
        return "Ignition / flame-sensing piece from the electrode assembly.";
      }
      if (role === "gasket" || role === "bracket" || role === "sleeve") {
        return "Sub-piece of the electrode assembly.";
      }
      return `Sub-component of the electrode assembly${parentNote}.`;
    }
    if (concept === "front-panel") {
      if (role === "brace") return "Front-panel brace; sold under the panel kit.";
      if (role === "gasket") return "Front-panel gasket; sold under the panel kit.";
      if (role === "screw") return "Front-panel fastener; sold under the panel kit.";
      return `Sub-component of the front panel kit${parentNote}.`;
    }
    return `Sub-component${parentNote || " of a mapped assembly"}.`;
  }

  const curated = curatedBlurb(code, blurbDoc);
  if (curated) return curated;

  return heuristicSummaryFromName(nameN, displayTitle);
}
