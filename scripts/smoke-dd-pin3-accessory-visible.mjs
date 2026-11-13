#!/usr/bin/env node
/**
 * RSP-123 follow-up: Pin3 Demand Duo accessory Item Numbers show the finished-
 * goods SKU card even when UI visibility is pre-indexed from catalogue.parts
 * (synthetic accessorySku parts are not price-list rows).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveModelPin,
  isAccessoryFamilySeries,
  listSeries,
  accessorySkuPartsForSeries,
} from "../src/series.js";
import { searchParts } from "../src/search.js";
import { seriesBelongsToSystemType } from "../src/system-type.js";

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

/** Mirror main.js getIsPartVisible allow-set + accessorySku bypass. */
function makeUiVisibleFilter() {
  const allowed = new Set();
  for (const part of catalogue.parts || []) {
    const id = String(part.id || "").trim();
    const code = String(part.code || "").trim();
    if (id) allowed.add(`id:${id}`);
    if (code) allowed.add(`code:${code}`);
  }
  return (part) => {
    if (part?.accessorySku) return true;
    const id = String(part?.id || "").trim();
    if (id && allowed.has(`id:${id}`)) return true;
    const code = String(part?.code || "").trim();
    if (code && allowed.has(`code:${code}`)) return true;
    return false;
  };
}

/** Broken pre-fix filter: price rows only (reproduces Beau empty Pin3). */
function makeBrokenPriceOnlyFilter() {
  const allowed = new Set(
    (catalogue.parts || [])
      .map((p) => String(p.code || "").trim())
      .filter(Boolean)
  );
  return (part) => allowed.has(String(part?.code || "").trim());
}

const uiVisible = makeUiVisibleFilter();
const broken = makeBrokenPriceOnlyFilter();

const ddSeries = listSeries(seriesDoc).filter(
  (s) =>
    seriesBelongsToSystemType(s, "demand-duo") && isAccessoryFamilySeries(s)
);
assert(ddSeries.length === 3, `expected 3 DD families, got ${ddSeries.length}`);

const expected = [];
for (const series of ddSeries) {
  for (const part of accessorySkuPartsForSeries(catalogue, series)) {
    expected.push(part.code);
  }
}
assert(expected.includes("DD1TSTAT"), "DD1TSTAT in family SKUs");
assert(expected.length >= 7, `expected ≥7 SKUs, got ${expected.length}`);

// Prove broken filter hides synthetic cards (root cause)
const pinDd1 = resolveModelPin(catalogue, seriesDoc, "dd1tstat");
const brokenCards = searchParts(catalogue, "", null, {
  pin: pinDd1,
  modelIds: pinDd1.modelIds,
  isPartVisible: broken,
});
assert(
  brokenCards.length === 0,
  "price-only filter must reproduce empty DD1TSTAT (root cause)"
);

const fixed = [];
for (const code of expected) {
  const model = (catalogue.models || []).find(
    (m) =>
      String(m.sku || "").toUpperCase() === code.toUpperCase() ||
      String(m.itemNumber || "").toUpperCase() === code.toUpperCase() ||
      String(m.id || "").toUpperCase() === code.toUpperCase()
  );
  assert(model, `model for ${code}`);
  const pin = resolveModelPin(catalogue, seriesDoc, model.id);
  assert(pin.kind === "model", `${code} model pin`);
  assert(
    isAccessoryFamilySeries(pin.series),
    `${code} accessory family series`
  );
  const cards = searchParts(catalogue, "", null, {
    pin,
    modelIds: pin.modelIds,
    isPartVisible: uiVisible,
  });
  assert(
    cards.length === 1 && cards[0].part.code === code,
    `Pin3 ${code} → sole card, got [${cards.map((r) => r.part.code).join(",")}]`
  );
  fixed.push(code);
}

// Pin2 family browse: ONLY finished-goods SKUs (no catalogue family-tag leak)
for (const series of ddSeries) {
  const pin = resolveModelPin(catalogue, seriesDoc, `series:${series.id}`);
  const familyCodes = accessorySkuPartsForSeries(catalogue, series).map(
    (p) => p.code
  );
  const cards = searchParts(catalogue, "", null, {
    pin,
    modelIds: pin.modelIds,
    isPartVisible: uiVisible,
  });
  const codes = cards.map((r) => r.part.code).sort();
  assert(
    codes.length === familyCodes.length &&
      codes.every((c) => familyCodes.includes(c)) &&
      cards.every((r) => r.part.accessorySku === true),
    `Pin2 ${series.id} must be only family SKUs, got [${codes.join(",")}]`
  );
}

// Explicit DDTSTAT “234” leak regression (Climate / Logfires / etc.)
const ddtstatPin = resolveModelPin(catalogue, seriesDoc, "series:ddtstat");
const ddtstatCards = searchParts(catalogue, "", null, {
  pin: ddtstatPin,
  modelIds: ddtstatPin.modelIds,
});
const leak = ddtstatCards.filter(
  (r) =>
    !r.part.accessorySku ||
    ["B062347", "84002345", "90182341", "80080234"].includes(r.part.code)
);
assert(
  leak.length === 0 && ddtstatCards.length === 3,
  `DDTSTAT Pin2 must be 3 TSTAT SKUs only, got ${ddtstatCards.length} (leak ${leak
    .map((r) => r.part.code)
    .join(",")})`
);

console.log("ok smoke-dd-pin3-accessory-visible", {
  pin3Sole: fixed,
  families: ddSeries.map((s) => s.id),
  ddtstatPin2: ddtstatCards.map((r) => r.part.code),
});
