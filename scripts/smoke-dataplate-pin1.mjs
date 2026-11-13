#!/usr/bin/env node
/**
 * Dataplate Pin1 inference — plate evidence → system chips for every locked class.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferSystemTypeCandidates,
  mapDataplateTextToPinCandidates,
} from "../src/dataplate-map.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/catalogue.json"), "utf8")
);
const seriesDoc = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/series-aliases.json"), "utf8")
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function topId(text) {
  const mapped = mapDataplateTextToPinCandidates(catalogue, seriesDoc, text);
  const top = mapped.systemCandidates[0];
  assert(top, `no Pin1 for: ${text}`);
  return top.systemType?.id || top.value;
}

const cases = [
  ["Hotflo EHFA160S24 160L", "hotflo-electric-storage"],
  ["Rinnai Hotflo electric storage tank", "hotflo-electric-storage"],
  ["GHF4135N gas storage", "gas-storage-hot-water"],
  ["Hotflo GHF4135N 135L", "gas-storage-hot-water"],
  ["Enviroflo EHPA250VMAH", "heat-pump-hot-water"],
  ["EHPG215VM heat pump", "heat-pump-hot-water"],
  ["CHP020H commercial heat pump", "commercial-heat-pump"],
  ["Demand Duo DDUPS2580N", "demand-duo"],
  ["Efinity ECF19I50", "electric-continuous-flow"],
  ["Solar Split SG215A", "solar-hot-water"],
  ["REU-AM2626WD-50-AKN Infinity 26", "continuous-flow-hot-water"],
  ["HD210e EN50 external", "continuous-flow-hot-water"],
];

for (const [text, expect] of cases) {
  const id = topId(text);
  assert(
    id === expect || id === `system:${expect}`,
    `expected ${expect} for “${text}”, got ${id}`
  );
}

// No silent Everything from OCR cues
const none = inferSystemTypeCandidates({ text: "random garage sticker" });
assert(
  !none.some((c) => c.systemType?.kind === "everything" || c.id === "everything"),
  "Everything must not appear as an OCR Pin1 chip"
);

console.log(`ok — ${cases.length} Pin1 OCR evidence cases`);
