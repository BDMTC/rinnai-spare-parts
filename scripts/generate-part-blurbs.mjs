/**
 * Generate public/data/part-blurbs.json — offline layman blurbs (Beau-approved tone).
 * Run: node scripts/generate-part-blurbs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import catalogue from "../public/data/catalogue.json" with { type: "json" };
import abbrevs from "../public/data/part-name-abbreviations.json" with { type: "json" };
import hierarchy from "../public/data/assembly-hierarchy.json" with { type: "json" };
import edplPartMap from "../public/data/edpl-part-map.json" with { type: "json" };
import modelsDoc from "../public/data/models.json" with { type: "json" };
import seriesAliases from "../public/data/series-aliases.json" with { type: "json" };
import { buildAbbrevIndex, buildAssemblyIndex } from "../src/search.js";
import { expandDisplayTitle, plainEnglishSummary } from "../src/display-name.js";
import {
  buildModelChassisIndex,
  buildSeriesAliasChassisIndex,
  resolveChassisLabels,
  withChassisPhrase,
} from "../src/chassis-blurb-labels.js";

const seriesAliasIndex = buildSeriesAliasChassisIndex(seriesAliases);
const modelChassisIndex = buildModelChassisIndex(modelsDoc);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../public/data/part-blurbs.json");

const abbrevIndex = buildAbbrevIndex(abbrevs);
const assemblyIndex = buildAssemblyIndex(hierarchy);

/** Beau-approved seed blurbs (reviewed). */
const SEED = {
  "92093550":
    "Main copper heat exchanger for HD200e / Infinity external continuous-flow (VRM2632WC) — the big heating coil the water runs through.",
  "92095224":
    "Combustion fan for HD200e external continuous-flow — the blower that feeds air into the burner.",
  "92095902":
    "Water-flow sensor for HD200e / Infinity 26–32 external — tells the unit that water is moving so it can fire.",
  "92094319":
    "Natural-gas burner manifold for Infinity internal FFUG/C chassis — the gas distribution block at the burners (NG only).",
  "92099920":
    "High-tension ignition lead for Infinity internal 2632 — the spark cable from igniter to electrode.",
  "90150004":
    "Heat exchanger for Rinnai 2001 console/inbuilt space heater — the metal heat cell that warms the room air.",
  "90175563":
    "Seal gasket between heat exchanger and heater body on Energysaver 556/557/559 — stops flue/leak paths at that joint.",
  "90175662":
    "Burner-box packing gasket for Energysaver 309/556/559 — seals the burner chamber face.",
  "90102054":
    "Room-air intake filter pack for Energysaver 561FT3 (also listed with 557) — the washable/replaceable front air filter.",
  "90146341":
    "Beige air filter for Rinnai 2001 / 30FT-style space heater — the grille filter you pull from the front.",
  "90150475":
    "Lid / window thermistor for 2001-series heaters — temperature probe behind the control lid (not the room air sensor).",
  "90179590":
    "Main control circuit board for Energysaver 559FDT — the brains board under the control lid.",
  "90196524":
    "Combustion fan for Energysaver 309 — burner air blower inside the heater (not the room convection fan).",
  "90157462":
    "Transfer-tube gasket on 2001 heat exchanger path — small seal where the heat tube joins.",
  "90147497":
    "Front heat-exchanger section for older Spectrum/Sapphire-style heaters (240/280) — confirm chassis before ordering.",
  "90199125":
    "Natural-gas injector manifold for Energysaver 1005 — NG burner gas bar (not LPG).",
  "90149931":
    "NG bypass orifice / jet for 2001 Eurosit gas valve path — fuel-specific; don’t mix with LPG bypass.",
  "90150095":
    "LPG bypass orifice / jet for 2001 Eurosit gas valve path — fuel-specific; don’t mix with NG bypass.",
  "92095897":
    "Natural-gas manifold for HD200e external (VRM2632WC) — burner gas bar on the outdoor Infinity.",
};

/** Longer chassis keys first. */
const CHASSIS_HINTS = [
  [/vrm2632wc|v2632wc/i, "HD200e / Infinity external continuous-flow"],
  [/vrm2632ffug|vr2632ffug/i, "Infinity 26 internal (FFUG) continuous-flow"],
  [/vrm2632ffuc|vr2632ffuc/i, "HD200i / Infinity internal continuous-flow"],
  [/vrm2632ffu\b/i, "Infinity 2632 internal continuous-flow"],
  [/vr2626wgp/i, "Infinity 26 Smartstart continuous-flow"],
  [/vrm2630wd|vm2630wd|reuv2630wd/i, "Infinity 26 Plus continuous-flow"],
  [/vcm2837wc/i, "HD28e external continuous-flow"],
  [/vcm2837ffuc|vcm2837ffc/i, "HD28i internal continuous-flow"],
  [/vcm2837/i, "HD28 continuous-flow"],
  [/vrm3237wc|vrm3237/i, "HD250e continuous-flow"],
  [/n3237ffc/i, "HD210i / Infinity 32 Enviro internal"],
  [/n3237wc/i, "HD210e / Infinity 32 Enviro external"],
  [/n3237w\b|n3237/i, "Infinity 32 Enviro+ / N3237 continuous-flow"],
  [/km3237/i, "Infinity 32 Enviro (KM) continuous-flow"],
  [/am3237/i, "HD32 continuous-flow"],
  [/nb3237/i, "HDC32 continuous-flow"],
  [/559fdt|559\b/i, "Energysaver 559"],
  [/561ft3|561ft/i, "Energysaver 561FT3"],
  [/556\b/i, "Energysaver 556"],
  [/557\b/i, "Energysaver 557"],
  [/309\b/i, "Energysaver 309"],
  [/1005\b/i, "Energysaver 1005"],
  [/1004\b/i, "Energysaver / Avenger 1004"],
  [/2001\b/i, "Rinnai 2001 space heater"],
  [/30ft\b/i, "Rinnai 30FT space heater"],
  [/311\b/i, "Rinnai 311 / Ultima-style heater"],
  [/240\b|280\b|210\b/i, "Spectrum / Sapphire-style space heater"],
];

function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/+.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_CHASSIS = [
  [/CONT\.?\s*FLOW|CONTINUOUS\s*FLOW/i, "continuous-flow hot water"],
  [/STORAGE\s*HOT\s*WATER/i, "storage hot water"],
  [/SOLAR/i, "solar hot water"],
  [/COMMERCIAL\s*HOT\s*WATER/i, "commercial hot water"],
  [/LOGFIRE/i, "log fire / fireplace"],
  [/CLIMATE\s*EVAP/i, "evaporative cooler"],
  [/CLIMATE\s*REFRIG/i, "refrigeration / climate unit"],
  [/CLIMATE\s*TEMP/i, "climate temperature-control unit"],
  [/CLIMATE\s*APAC/i, "APAC climate unit"],
  [/LIFESTYLE/i, "lifestyle indoor appliance"],
  [/^COOLING$/i, "cooling appliance"],
  [/^HEATING$/i, "gas space heater"],
];

function chassisPhrase(name, category) {
  const blob = `${name} ${category || ""}`;
  for (const [re, label] of CHASSIS_HINTS) {
    if (re.test(blob)) return label;
  }
  const cat = String(category || "").trim();
  for (const [re, label] of CATEGORY_CHASSIS) {
    if (re.test(cat)) return label;
  }
  if (/heater|energysaver|reh-/i.test(blob)) return "gas space heater";
  return null;
}

function fuelBit(nameN) {
  const hasNg = /\b(ng|nat|natural gas)\b/.test(nameN);
  const hasLp = /\b(lp|lpg|propane)\b/.test(nameN);
  if (hasNg && !hasLp) return " (natural gas only)";
  if (hasLp && !hasNg) return " (LPG only)";
  return "";
}

/**
 * Role + job phrase for approved tone.
 * `chassis: true` → append real model OR-list (or omit if map unresolved).
 * @returns {{ what: string, job: string, chassis?: boolean }|null}
 */
function roleJob(nameN) {
  if (/\bfan\b/.test(nameN) && /\b(comb|combustion|com)\b/.test(nameN)) {
    return {
      what: "Combustion fan",
      job: "the blower that feeds air into the burner",
    };
  }
  if (/\bfan\b/.test(nameN) && /\bconv|convection\b/.test(nameN)) {
    return {
      what: "Convection / room fan",
      job: "moves warm air into the room (not the burner fan)",
    };
  }
  if (/\bfan\b/.test(nameN) && /\bmotor\b/.test(nameN)) {
    return { what: "Fan motor", job: "drives the fan impeller" };
  }
  if (/\bfan\b/.test(nameN) && /\bgasket\b/.test(nameN)) {
    return { what: "Fan gasket", job: "seals the combustion-fan joint" };
  }
  if (/\bfan\b/.test(nameN)) {
    return { what: "Fan assembly", job: "air mover", chassis: true };
  }
  if (
    (/\bhex\b/.test(nameN) || /\bheat\b/.test(nameN)) &&
    /\bexch/.test(nameN)
  ) {
    if (/\bgasket\b/.test(nameN)) {
      return {
        what: "Heat-exchanger gasket",
        job: "seals the heat-exchanger joint",
      };
    }
    if (/\btop\b/.test(nameN)) {
      return {
        what: "Top heat-exchanger half",
        job: "upper heating section — check if the bottom half is also needed",
      };
    }
    if (/\b(btm|bot|bottom)\b/.test(nameN)) {
      return {
        what: "Bottom heat-exchanger half",
        job: "lower heating section — often paired with the top half",
      };
    }
    if (/\bfront\b/.test(nameN)) {
      return {
        what: "Front heat-exchanger section",
        job: "the forward heating cell on this heater",
      };
    }
    if (/\brear\b|\bback\b/.test(nameN)) {
      return {
        what: "Rear heat-exchanger section",
        job: "the back heating cell on this heater",
      };
    }
    return {
      what: "Heat exchanger",
      job: "the metal path that transfers heat into the water or room air",
    };
  }
  if (/\bwater ?flow\b/.test(nameN) && /\bsensor\b/.test(nameN)) {
    return {
      what: "Water-flow sensor",
      job: "detects water moving so the unit can fire",
    };
  }
  if (/\bbypass\b/.test(nameN) && /\bservo\b/.test(nameN)) {
    return {
      what: "Bypass water-flow servo",
      job: "motorised valve that regulates hot/cold mix on continuous-flow",
    };
  }
  if (/\bservo\b/.test(nameN)) {
    return { what: "Servo valve", job: "motorised valve / actuator on this unit" };
  }
  if (/\b(pcb|circuit board|pc board)\b/.test(nameN)) {
    if (/\bmain\b/.test(nameN)) {
      return {
        what: "Main control circuit board",
        job: "the primary brains board for this heater",
      };
    }
    return {
      what: "Control circuit board",
      job: "electronics board that runs the appliance",
    };
  }
  if (/\bthermistor\b/.test(nameN)) {
    if (/\blid\b|\bwindow\b/.test(nameN)) {
      return {
        what: "Lid / window thermistor",
        job: "temperature probe at the control lid (not the room sensor)",
      };
    }
    if (/\boutlet\b|\bout\b/.test(nameN)) {
      return {
        what: "Outlet thermistor",
        job: "senses outgoing water temperature",
      };
    }
    if (/\binlet\b|\bin\b/.test(nameN)) {
      return {
        what: "Inlet thermistor",
        job: "senses incoming water temperature",
      };
    }
    return {
      what: "Thermistor",
      job: "temperature sensor for control / safety",
    };
  }
  if (/\bfilter\b/.test(nameN)) {
    if (/\bgas\b/.test(nameN)) {
      return { what: "Gas filter", job: "strainer on the gas inlet path" };
    }
    if (/\bair\b|\broom\b/.test(nameN) || /\bass/.test(nameN)) {
      return {
        what: "Air filter",
        job: "intake / grille filter you service from the front",
      };
    }
    return {
      what: "Filter",
      job: "serviceable filter element",
      chassis: true,
    };
  }
  if (/\bgasket\b/.test(nameN) && /\bburner\b/.test(nameN)) {
    return {
      what: "Burner-box gasket",
      job: "seals the burner chamber face",
    };
  }
  if (/\bgasket\b/.test(nameN)) {
    return { what: "Gasket", job: "seal for the joint named on the price line" };
  }
  if (/\bo-?ring\b/.test(nameN)) {
    return { what: "O-ring", job: "rubber seal for the fitting / assembly named" };
  }
  if (/\bmanifold\b/.test(nameN)) {
    return {
      what: "Gas manifold",
      job: "burner gas distribution bar — match NG vs LPG",
    };
  }
  if (/\binjector\b|\binj\b/.test(nameN)) {
    return { what: "Gas injector / jet", job: "metered gas orifice for the burner" };
  }
  if (/\belectrode\b/.test(nameN)) {
    return {
      what: "Ignition electrode",
      job: "spark / flame-sensing probe at the burner",
    };
  }
  if (/\bsparker\b/.test(nameN)) {
    return {
      what: "Spark generator",
      job: "ignition module that makes the spark",
    };
  }
  if (/\blead\b/.test(nameN) && /\b(ht|high tension|high-tension)\b/.test(nameN)) {
    return {
      what: "High-tension ignition lead",
      job: "spark cable from igniter to electrode",
    };
  }
  if (/\bflame rod\b|\bflamerod\b/.test(nameN)) {
    return {
      what: "Flame rod",
      job: "flame-sensing probe that proves the burner is lit",
    };
  }
  if (/\bbypass\b/.test(nameN)) {
    return {
      what: "Bypass orifice / path",
      job: "fuel- or water-bypass piece — match NG/LPG if marked",
    };
  }
  if (/\bvalve\b/.test(nameN) && /\bgas\b/.test(nameN)) {
    return { what: "Gas valve", job: "controls gas into the burner" };
  }
  if (/\bvalve\b/.test(nameN) && /\brelief\b/.test(nameN)) {
    return { what: "Relief valve", job: "safety pressure/temperature relief" };
  }
  if (/\bharness\b|\bloom\b/.test(nameN)) {
    return { what: "Wiring harness / loom", job: "cable set for this section of the unit" };
  }
  if (/\bpanel\b/.test(nameN) && /\bfront\b/.test(nameN)) {
    return {
      what: "Front panel / fascia",
      job: "outer front cover",
      chassis: true,
    };
  }
  if (/\bpanel\b/.test(nameN)) {
    return { what: "Panel / cover", job: "outer sheet-metal or trim panel" };
  }
  if (/\b(brkt|bracket)\b/.test(nameN)) {
    return { what: "Mounting bracket", job: "holds the named component in place" };
  }
  if (/\bburner\b/.test(nameN)) {
    return { what: "Burner", job: "gas burner section inside the heater" };
  }
  if (/\bflue\b/.test(nameN)) {
    return { what: "Flue part", job: "exhaust / flue connection piece" };
  }
  if (/\bcapacit/.test(nameN)) {
    return { what: "Capacitor", job: "electrical start/run capacitor" };
  }
  if (
    (/\btransformer\b/.test(nameN) || /\btrans\b/.test(nameN)) &&
    !/\btransition\b/.test(nameN)
  ) {
    return { what: "Transformer", job: "power transformer for controls / ignition" };
  }
  if (/\boverheat\b|\bohs\b/.test(nameN)) {
    return {
      what: "Overheat sensor / switch",
      job: "safety cut-out if the heater runs too hot",
    };
  }
  if (/\bthermocouple\b/.test(nameN)) {
    return {
      what: "Thermocouple",
      job: "flame-failure / pilot safety sensor",
    };
  }
  if (/\binlet\b/.test(nameN) && /\bwater\b/.test(nameN)) {
    return { what: "Water inlet fitting", job: "cold-water connection into the unit" };
  }
  if (/\boutlet\b/.test(nameN) && /\bwater\b/.test(nameN)) {
    return { what: "Water outlet fitting", job: "hot-water connection out of the unit" };
  }
  if (/\bremote\b/.test(nameN)) {
    return {
      what: "Remote control",
      job: "handset / wireless controller for this appliance",
    };
  }
  if (/\bcompressor\b|\bcomp\b/.test(nameN) && /\bscroll|recip|herm/.test(nameN)) {
    return {
      what: "Compressor",
      job: "refrigeration compressor that pumps the refrigerant",
    };
  }
  if (/\bevaporat/.test(nameN)) {
    return {
      what: "Evaporator part",
      job: "cold-side heat-exchange piece in the fridge/AC path",
    };
  }
  if (/\bcondens/.test(nameN)) {
    return {
      what: "Condenser part",
      job: "hot-side heat-exchange piece in the fridge/AC path",
    };
  }
  if (/\bsensor\b/.test(nameN)) {
    return { what: "Sensor", job: "sensing probe / switch for control or safety" };
  }
  if (/\bswitch\b/.test(nameN)) {
    return { what: "Switch", job: "electrical or limit switch for this function" };
  }
  if (/\bvalve\b/.test(nameN)) {
    return { what: "Valve", job: "flow / gas / refrigerant valve for this path" };
  }
  if (/\bplug\b|\bstopper\b/.test(nameN)) {
    return { what: "Plug / stopper", job: "blanking or sealing plug for an opening" };
  }
  if (/\bhose\b|\btube\b|\bpipe\b/.test(nameN)) {
    return { what: "Hose / tube", job: "flexible or rigid fluid path piece" };
  }
  if (/\bwire\b|\bcable\b/.test(nameN)) {
    return { what: "Wire / cable", job: "electrical lead for this circuit" };
  }
  if (/\bmotor\b/.test(nameN)) {
    return { what: "Motor", job: "drive motor for the named assembly" };
  }
  if (/\bseal\b/.test(nameN)) {
    return { what: "Seal", job: "sealing piece for the joint named on the card" };
  }
  if (/\bscrew\b|\bbolt\b|\bnut\b|\bwasher\b/.test(nameN)) {
    return { what: "Fastener", job: "fixing screw/bolt/nut for this assembly" };
  }
  if (/\blabel\b|\bdecal\b/.test(nameN)) {
    return { what: "Label / decal", job: "identification or instruction sticker" };
  }
  if (/\bconversion kit\b|\bcon kit\b/.test(nameN)) {
    return {
      what: "Fuel conversion kit",
      job: "parts to change NG ↔ LPG on this model",
    };
  }
  return null;
}

function clipWords(text, max = 18) {
  const raw = String(text || "").trim();
  // Never truncate model OR-lists — admins need every chassis code.
  if (/\sOR\s/.test(raw)) {
    max = Math.max(max, raw.split(/\s+/).filter(Boolean).length);
  }
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return `${words.slice(0, max).join(" ").replace(/[.,;:—-]+$/, "")}.`;
}

function compose(part) {
  const code = String(part.code || "").trim();
  if (SEED[code]) {
    return { text: SEED[code], source: "beau-sample", reviewed: true };
  }
  if (part.kind === "discount-segment") {
    return {
      text: "Discount / category header — not a spare part.",
      source: "heuristic",
      reviewed: false,
    };
  }
  // Leave assembly-mapped SKUs to runtime assembly blurbs
  if (
    assemblyIndex.parentByCode.has(code) ||
    assemblyIndex.childByCode.has(code)
  ) {
    return null;
  }

  const name = String(part.name || "");
  const nameN = normalise(name);
  const display = expandDisplayTitle(name, abbrevIndex);
  const role = roleJob(nameN);
  const chassis = chassisPhrase(name, part.category);
  const fuel = fuelBit(nameN);
  const modelLabels = resolveChassisLabels(code, {
    part,
    edplPartMap,
    assemblyIndex,
    seriesAliasIndex,
    modelChassisIndex,
  });

  if (role) {
    if (role.chassis && !modelLabels.length) {
      return {
        text: null,
        source: "chassis-unmapped",
        reviewed: false,
        unmapped: true,
        what: role.what,
        job: role.job,
      };
    }
    const job = role.chassis
      ? withChassisPhrase(role.job, modelLabels)
      : role.job;
    if (role.chassis && !job) {
      return {
        text: null,
        source: "chassis-unmapped",
        reviewed: false,
        unmapped: true,
        what: role.what,
        job: role.job,
      };
    }
    let line;
    if (chassis) {
      line = `${role.what} for ${chassis}${fuel} — ${job}.`;
    } else {
      line = `${role.what}${fuel} — ${job}.`;
    }
    return {
      text: clipWords(line.replace(/\s+/g, " ").trim()),
      source: "pattern",
      reviewed: false,
    };
  }

  // Fallback: expanded layman headwords + chassis (no jargon dump)
  const titleBits = String(display.title || name)
    .replace(/^\*+/, "")
    .replace(/\b(assy|ass'y|assybly)\b/gi, "assembly")
    .split(/\s+/)
    .filter((t) => {
      if (!t) return false;
      if (/^[A-Z]{2,}\d+/i.test(t) && t.length > 5) return false; // chassis codes
      if (/^\d{5,}/.test(t)) return false;
      if (/^(vrm|vr|vcm|n\d|km|am|nb|pc|ex|cs)\d/i.test(t)) return false;
      return !/^\d/.test(t) || t.length > 4;
    });
  const head = titleBits.slice(0, 5).join(" ").trim();
  const softHead =
    head && head.length >= 4
      ? head.charAt(0).toUpperCase() + head.slice(1)
      : "Spare part";
  const line = chassis
    ? `${softHead} for ${chassis} — confirm against the data plate before ordering.`
    : `${softHead} — confirm against the data plate and price-list name.`;
  return {
    text: clipWords(line.replace(/\s+/g, " ").trim()),
    source: "pattern-fallback",
    reviewed: false,
  };
}

const blurbs = {};
let seeded = 0;
let patterned = 0;
let skippedAssembly = 0;
let skippedOther = 0;
/** @type {{ code: string, name: string, category: string, sheet: string, what: string }[]} */
const chassisGaps = [];

for (const part of catalogue.parts || []) {
  const code = String(part.code || "").trim();
  if (!code) continue;
  const entry = compose(part);
  if (!entry) {
    if (
      assemblyIndex.parentByCode.has(code) ||
      assemblyIndex.childByCode.has(code)
    ) {
      skippedAssembly += 1;
    } else skippedOther += 1;
    continue;
  }
  if (entry.unmapped) {
    chassisGaps.push({
      code,
      name: String(part.name || ""),
      category: String(part.category || ""),
      sheet: String(part.sheet || ""),
      what: entry.what || "",
    });
    continue;
  }
  blurbs[code] = {
    text: entry.text,
    source: entry.source,
    reviewed: entry.reviewed,
  };
  if (entry.source === "beau-sample") seeded += 1;
  else patterned += 1;
}

let chassisThisLeft = 0;
let truncatedChassisJob = 0;
for (const [code, entry] of Object.entries(blurbs)) {
  const text = String(entry.text || "");
  if (/this chassis/i.test(text)) {
    chassisThisLeft += 1;
    console.warn("WARN still has this chassis:", code, text);
  }
  if (
    /— (air mover|serviceable filter element|outer front cover)\.$/.test(text)
  ) {
    truncatedChassisJob += 1;
    console.warn("WARN truncated chassis job:", code, text);
  }
}

const gapsPath = path.resolve(
  __dirname,
  "../public/data/chassis-blurb-gaps.json"
);
const gapDoc = {
  version: 1,
  meta: {
    title: "Chassis blurb gaps — needs Beau",
    updated: "2026-11-13",
    tip: "cursor/chassis-model-blurbs-1bba",
    notes:
      "Former “…this chassis…” fan/filter/front-panel blurbs with no chassis token after EDPL + PL name + series-aliases + models Item Number search. Do not invent. Beau to supply model OR-list.",
    count: chassisGaps.length,
  },
  gaps: chassisGaps,
};
fs.writeFileSync(gapsPath, `${JSON.stringify(gapDoc, null, 2)}\n`, "utf8");
console.log("Wrote gaps", gapsPath, "count", chassisGaps.length);

const doc = {
  version: 1,
  meta: {
    title: "Offline layman part blurbs",
    updated: "2026-11-13",
    tip: "cursor/chassis-model-blurbs-1bba",
    notes:
      "Beau-approved tone. Prefer assembly-rich runtime blurbs when mapped; else this file; else heuristics. Chassis jobs always name PL/ED/alias/Item Number model OR-lists (never “this chassis”; never truncated). Baked into file:// dist. No runtime web fetch.",
    counts: {
      total: Object.keys(blurbs).length,
      seeded,
      patterned,
      skippedAssembly,
      thisChassisLeft: chassisThisLeft,
      chassisGaps: chassisGaps.length,
      truncatedChassisJob,
    },
  },
  blurbs,
};

if (chassisThisLeft) {
  throw new Error(
    `part-blurbs still contains "this chassis" on ${chassisThisLeft} entries`
  );
}
if (truncatedChassisJob) {
  throw new Error(
    `part-blurbs still has truncated chassis jobs on ${truncatedChassisJob} entries`
  );
}
if (chassisGaps.length) {
  // Fail closed: do not ship a blurb file that drops unmapped chassis jobs.
  // Gaps are listed in public/data/chassis-blurb-gaps.json for Beau.
  console.error(
    `STOP: ${chassisGaps.length} chassis blurbs unmapped after exhaustive search. See ${gapsPath}`
  );
  const byCat = {};
  for (const g of chassisGaps) {
    byCat[g.category] = (byCat[g.category] || 0) + 1;
  }
  console.error("Gaps by category:", byCat);
  process.exitCode = 2;
  // Still write the partial blurbs so resolved OR-lists are reviewable,
  // but exit non-zero so this is not treated as complete.
}

fs.writeFileSync(outPath, `${JSON.stringify(doc)}\n`, "utf8");
console.log("Wrote", outPath);
console.log(doc.meta.counts);

// Spot-check parity reduction on a few codes
for (const code of Object.keys(SEED).slice(0, 5)) {
  const part = (catalogue.parts || []).find((p) => p.code === code);
  const before = plainEnglishSummary(part, assemblyIndex, abbrevIndex);
  console.log(code, "\n  before:", before, "\n  after:", blurbs[code].text);
}
