/**
 * One-shot: measure searchParts cost pin vs unpinned (± text cache).
 * Run: node scripts/bench-search-lag.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  searchParts,
  buildAbbrevIndex,
  buildAssemblyIndex,
  buildPartSearchCache,
  buildPinContext,
  scorePartFit,
} from "../src/search.js";
import { plainEnglishSummary, expandDisplayTitle } from "../src/display-name.js";
import { resolveModelPin } from "../src/series.js";
import { makePartVisibilityFilter } from "../src/restriction.js";
import { expandAbbrevs } from "../src/search.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => JSON.parse(readFileSync(join(root, "public/data", p), "utf8"));

const catalogue = load("catalogue.json");
const seriesDoc = load("series-aliases.json");
const tradeAliases = load("trade-aliases.json");
const abbrevs = load("part-name-abbreviations.json");
const hierarchy = load("assembly-hierarchy.json");
const partBlurbs = load("part-blurbs.json");

const abbrevIndex = buildAbbrevIndex(abbrevs);
const assemblyIndex = buildAssemblyIndex(hierarchy);

const pin = resolveModelPin(catalogue, seriesDoc, "series:hd200e");
console.log(
  "pin",
  pin.kind,
  pin.series?.label || pin.model?.sku,
  "modelIds",
  pin.modelIds?.length
);

const tCache0 = performance.now();
const partSearchCache = buildPartSearchCache(catalogue.parts || [], {
  abbrevIndex,
  assemblyIndex,
  partBlurbs,
});
console.log(
  `buildPartSearchCache: ${(performance.now() - tCache0).toFixed(1)}ms (size ${partSearchCache.size})`
);

const isPartVisible = makePartVisibilityFilter(catalogue, {
  unlockedPinValues: [],
  activePinValue: "series:hd200e",
  activeModelIds: pin.modelIds || [],
});

function bench(label, fn, n = 8) {
  fn();
  const times = [];
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const r = fn();
    times.push(performance.now() - t0);
    if (i === 0 && r?.length != null) hits = r.length;
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(
    `${label}: mean ${mean.toFixed(1)}ms  median ${times[Math.floor(times.length / 2)].toFixed(1)}ms  (hits ${hits})`
  );
  return mean;
}

const shared = {
  tradeAliases,
  abbrevIndex,
  assemblyIndex,
  partBlurbs,
  isPartVisible,
};

console.log("\n=== without cache (legacy path) ===");
bench("unpinned fan", () => searchParts(catalogue, "fan", null, shared));
bench("pinned fan", () =>
  searchParts(catalogue, "fan", null, {
    ...shared,
    pin,
    modelIds: pin.modelIds,
  })
);

console.log("\n=== with partSearchCache (fixed path) ===");
const cached = { ...shared, partSearchCache };
bench("unpinned fan", () => searchParts(catalogue, "fan", null, cached));
bench("pinned fan", () =>
  searchParts(catalogue, "fan", null, {
    ...cached,
    pin,
    modelIds: pin.modelIds,
  })
);
bench("pinned gasket", () =>
  searchParts(catalogue, "gasket", null, {
    ...cached,
    pin,
    modelIds: pin.modelIds,
  })
);
bench("pinned combustion fan", () =>
  searchParts(catalogue, "combustion fan", null, {
    ...cached,
    pin,
    modelIds: pin.modelIds,
  })
);
bench("pinned f", () =>
  searchParts(catalogue, "f", null, {
    ...cached,
    pin,
    modelIds: pin.modelIds,
  })
);

console.log("\n=== micro (reference) ===");
const parts = catalogue.parts || [];
const pinCtx = buildPinContext(pin);
let t = performance.now();
for (const part of parts) isPartVisible(part);
console.log(`visible: ${(performance.now() - t).toFixed(1)}ms`);
t = performance.now();
for (const part of parts) scorePartFit(part, pinCtx);
console.log(`fit(pin): ${(performance.now() - t).toFixed(1)}ms`);
t = performance.now();
for (const part of parts) {
  const c = partSearchCache.get(part);
  void c?.blurbN;
}
console.log(`cache get all: ${(performance.now() - t).toFixed(1)}ms`);
