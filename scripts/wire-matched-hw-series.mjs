#!/usr/bin/env node
/**
 * RSP-95 — append Hot Water series aliases for matched (non-CF-REU) chassis.
 * Prefix/documentKeys follow matched PDF tokens — not REU unit-class rules.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const seriesPath = path.join(root, "public/data/series-aliases.json");

/** @type {Array<object>} */
const NEW_SERIES = [
  {
    id: "fm10",
    label: "Flowmaster FM10",
    aliases: ["FM10", "FM10LA", "FM10NA", "Flowmaster", "FLOWMASTER"],
    match: {
      marketingCodePrefixes: ["FM10"],
    },
    documentKeys: ["FM10", "FM10LA", "FM10NA", "Flowmaster", "FLOWMASTER", "IHF10"],
    notes:
      "RSP-95 matched: Flowmaster FM10LA/NA. Continuous-flow instantaneous; not Hotflo storage. No REU unit class.",
  },
  {
    id: "efinity-ecf",
    label: "Efinity ECF",
    aliases: ["Efinity", "ECF", "ECF14", "ECF19", "ECF29", "Electric CF"],
    match: {
      marketingCodePrefixes: ["ECF14", "ECF19", "ECF29"],
    },
    documentKeys: [
      "ECF",
      "ECF14",
      "ECF14I50",
      "ECF14I60",
      "ECF19",
      "ECF19I50",
      "ECF19I60",
      "ECF29",
      "ECF29I50",
      "ECF29I60",
      "Efinity",
    ],
    notes: "RSP-95 matched: electric continuous-flow Efinity ECF14/19/29. One PL per SKU.",
  },
  {
    id: "ehfa160",
    label: "Hotflo EHFA160",
    aliases: ["EHFA160", "Hotflo EHFA160", "HOTFLO EHFA160", "Hotflo", "HOTFLO"],
    match: {
      marketingCodePrefixes: ["EHFA160"],
    },
    documentKeys: ["EHFA160", "Hotflo EHFA160", "HOTFLO EHFA160"],
    notes:
      "RSP-95 matched: EHFA160S* → PL Hotflo EHFA160. Proof part 95110104 (ELEMENT 2.4KW EHFA160). No REU chassis.",
  },
  {
    id: "ehfd160",
    label: "Hotflo EHFD160",
    aliases: ["EHFD160", "Hotflo EHFD160", "HOTFLO EHFD160"],
    match: {
      marketingCodePrefixes: ["EHFD160"],
    },
    documentKeys: ["EHFD160", "Hotflo EHFD160", "EHFD"],
    notes: "RSP-95 matched: EHFD160S* → PL Hotflo EHFD160.",
  },
  {
    id: "ehfa250",
    label: "Hotflo EHFA250",
    aliases: ["EHFA250", "Hotflo EHFA250", "HOTFLO EHFA250", "EHFA"],
    match: {
      marketingCodePrefixes: ["EHFA250"],
    },
    documentKeys: ["EHFA250", "Hotflo EHFA250"],
    notes:
      "RSP-95 matched: EHFA250S24/36 → EHFA SPARE PARTS.pdf; S48 → EHF 250SL 315L PL. Soft doc match: EHFA250 ⊃ series tag EHFA on desktop sheet.",
  },
  {
    id: "ehfa315",
    label: "Hotflo EHFA315",
    aliases: ["EHFA315", "Hotflo EHFA315", "HOTFLO EHFA315"],
    match: {
      marketingCodePrefixes: ["EHFA315"],
    },
    documentKeys: ["EHFA315", "EHF315", "Hotflo EHFA315"],
    notes: "RSP-95 matched: EHFA315S* → PL Hotflo EHF 250SL 315L.",
  },
  {
    id: "ehfa400",
    label: "Hotflo EHFA400",
    aliases: ["EHFA400", "Hotflo EHFA400", "HOTFLO EHFA400"],
    match: {
      marketingCodePrefixes: ["EHFA400"],
    },
    documentKeys: ["EHFA400", "Hotflo EHFA400", "EHFA 400"],
    notes: "RSP-95 matched: EHFA400S* → PL Hotflo EHFA 400L.",
  },
  {
    id: "ehf25",
    label: "Hotflo EHF25",
    aliases: ["EHF25", "Hotflo EHF25", "HOTFLO EHF25"],
    match: {
      marketingCodePrefixes: ["EHF25"],
      marketingCodeExcludePrefixes: ["EHFA", "EHFD", "EHPA", "EHPG", "EHPT", "EHPS"],
    },
    documentKeys: ["EHF25", "Hotflo EHF25"],
    notes:
      "RSP-95 matched: EHF25S* (filename_stem→EHF 250SL 315L PL). Exclude EHFA/EHFD/EHP* prefixes so storage siblings stay distinct.",
  },
  {
    id: "ghf4",
    label: "Hotflo GHF4",
    aliases: ["GHF4", "GHF4135", "Hotflo GHF4", "HOTFLO GHF4"],
    match: {
      marketingCodePrefixes: ["GHF4"],
    },
    documentKeys: ["GHF4", "GHF4135", "GHF4135L", "GHF4135N", "Hotflo GHF4"],
    notes: "RSP-95 matched: GHF4135* → PL Hotflo GHF4 135L/170L.",
  },
  {
    id: "ehpa-ar",
    label: "Heat Pump AR EHPA",
    aliases: ["EHPA300", "EHPA340", "EHPA", "AR Series", "Heat Pump AR"],
    match: {
      marketingCodePrefixes: ["EHPA300", "EHPA340"],
    },
    documentKeys: ["EHPA300VM", "EHPA340VM", "EHPA300", "EHPA340", "AR SERIES"],
    notes: "RSP-95 matched: EHPA300/340 VM* → AR series PL.",
  },
  {
    id: "ehpa-vma",
    label: "Enviroflo VMA",
    aliases: ["EHPA250VMA", "Enviroflo", "VMA", "EHPA250"],
    match: {
      marketingCodePrefixes: ["EHPA250VMA"],
    },
    documentKeys: ["EHPA250VMA", "EHPA250", "Enviroflo", "VMA"],
    notes: "RSP-95 matched: EHPA250VMA/H → Enviroflo VMA V2 PL.",
  },
  {
    id: "ehpg-gr",
    label: "Heat Pump GR EHPG",
    aliases: ["EHPG", "GR Series", "EHPG215", "EHPG280", "EHPG300"],
    match: {
      marketingCodePrefixes: ["EHPG"],
    },
    documentKeys: ["EHPG", "EHPG215VM", "EHPG280VM", "EHPG300VM", "GR SERIES"],
    notes: "RSP-95 matched: EHPGxxVM → GR series SPL/SM.",
  },
  {
    id: "ehpt-a",
    label: "Heat Pump A EHPT",
    aliases: ["EHPT", "EHPT180", "A Series Heat Pump"],
    match: {
      marketingCodePrefixes: ["EHPT"],
    },
    documentKeys: ["EHPT", "EHPT180", "EHPT180VM", "A SERIES"],
    notes: "RSP-95 matched: EHPT180VM → A series heat pump SM.",
  },
  {
    id: "ehps-be",
    label: "Heat Pump B/E EHPS",
    aliases: ["EHPS", "EHPS215", "B E Series Heat Pump"],
    match: {
      marketingCodePrefixes: ["EHPS"],
    },
    documentKeys: ["EHPS", "EHPS215", "EHPS215VM"],
    notes: "RSP-95 matched: EHPS215VM → B/E series heat pump SM.",
  },
  {
    id: "solar-sg",
    label: "Solar Split SG",
    aliases: ["SG175", "SG215", "SG270", "SG320", "Solar Split", "SG"],
    match: {
      marketingCodePrefixes: ["SG175", "SG215", "SG270", "SG320"],
    },
    documentKeys: ["SG175", "SG175A", "SG215", "SG215A", "SG270A", "SG320A", "Solar Split"],
    notes: "RSP-95 matched: SGxxx(A) solar split PLs. Matched-only — no invented SE links.",
  },
  {
    id: "chp",
    label: "Commercial Heat Pump CHP",
    aliases: ["CHP", "CHP020", "CHP040", "Commercial Heat Pump"],
    match: {
      marketingCodePrefixes: ["CHP020", "CHP040"],
    },
    documentKeys: ["CHP020", "CHP040", "CHP020H", "CHP040H"],
    notes: "RSP-95 matched: CHP020H/CHP040H → commercial heat pump SM.",
  },
  {
    id: "ddups",
    label: "DDUPS",
    commercialName: "Grundfos circulation pumps",
    aliases: [
      "DDUPS",
      "Grundfos",
      "circulation pump",
      "Demand Duo pumps",
      "Demand Duo",
    ],
    match: {
      marketingCodePrefixes: ["DDUPS", "DDUPM"],
    },
    documentKeys: ["DDUPS2580N", "DDUPS32100N", "DDUPS", "Demand Duo"],
    notes:
      "RSP-115: Demand Duo accessory family — Grundfos circulation pumps (not chassis).",
    accessoryFamily: true,
  },
  {
    id: "ddtstat",
    label: "DDTSTAT",
    commercialName: "Pump controllers",
    aliases: [
      "DDTSTAT",
      "DDStats",
      "DD1TSTAT",
      "DD234TSTAT",
      "DD56TSTAT",
      "56tstat",
      "56TSTAT",
      "pump controller",
      "Demand Duo",
    ],
    match: {
      marketingCodePrefixes: [
        "DD1TSTAT",
        "DD234TSTAT",
        "DD56TSTAT",
        "DDTSTAT",
      ],
    },
    documentKeys: [
      "DD1TSTAT",
      "DD234TSTAT",
      "DD56TSTAT",
      "56TSTAT",
      "DDTSTAT",
      "Demand Duo",
    ],
    notes:
      "RSP-115: Demand Duo accessory family — pump controllers (not chassis).",
    accessoryFamily: true,
  },
  {
    id: "dduvc",
    label: "UVC / DDUVC",
    commercialName: "UV sterilisation systems",
    aliases: [
      "UVC",
      "DDUVC",
      "UV",
      "UV steriliser",
      "UV sterilization",
      "Demand Duo",
    ],
    match: {
      marketingCodePrefixes: ["DDUVC", "UVC"],
    },
    documentKeys: [
      "DDUVC1200",
      "DDUVC1700",
      "UVC1200",
      "UVC1700",
      "UVC",
      "DDUVC",
      "Demand Duo",
    ],
    notes:
      "RSP-115: Demand Duo accessory family — UV sterilisation (not chassis).",
    accessoryFamily: true,
  },
];

function main() {
  const doc = JSON.parse(fs.readFileSync(seriesPath, "utf8"));
  const existingIds = new Set((doc.series || []).map((s) => s.id));
  const added = [];
  for (const s of NEW_SERIES) {
    if (existingIds.has(s.id)) {
      console.log("skip existing", s.id);
      continue;
    }
    doc.series.push(s);
    existingIds.add(s.id);
    added.push(s.id);
  }
  doc.meta = {
    ...doc.meta,
    updated: new Date().toISOString().slice(0, 10),
    notes: `${doc.meta?.notes || ""} RSP-95: +${added.length} Hot Water series (Hotflo/Efinity/heat pump/solar/commercial matched-only).`.trim(),
  };
  fs.writeFileSync(seriesPath, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ addedCount: added.length, added }, null, 2));
}

main();
