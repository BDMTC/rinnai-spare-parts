#!/usr/bin/env node
/**
 * Pin3 chassis PL/ED hard-fence eval (Beau-locked; remapped from Pin2 / RSP-106).
 *
 * Fail closed if:
 *   - AM2626WD-50-AKN-BLK + "heat ex" Primary ≠ 92099678
 *   - VR2626WGP + "heat ex" Primary ≠ 92098924
 *   - Smartstart-only codes appear in AM2626WD heat-ex results
 *   - AM-only HEX appears as Primary on Smartstart (flipped)
 *
 * Blurb/abbrev/trade ranking must still run inside the allow-set
 * (assert Primary still wins on trade heat-ex query).
 *
 * Usage: node scripts/eval-pin3-chassis-hard.mjs
 * Exit 0 = pass; non-zero = fail.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  searchParts,
  buildAssemblyIndex,
  buildAbbrevIndex,
} from "../src/search.js";
import { resolveModelPin } from "../src/series.js";
import { buildPin3ChassisPartAllowSet } from "../src/pin3-chassis-allow.js";
import edplPartMap from "../public/data/edpl-part-map.json" with { type: "json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/catalogue.json"), "utf8")
);
const seriesDoc = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/series-aliases.json"), "utf8")
);
const tradeAliases = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/trade-aliases.json"), "utf8")
);
const assemblyHierarchy = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/assembly-hierarchy.json"), "utf8")
);
const partAbbrevs = JSON.parse(
  fs.readFileSync(
    path.join(root, "public/data/part-name-abbreviations.json"),
    "utf8"
  )
);
const partBlurbs = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/part-blurbs.json"), "utf8")
);

const assemblyIndex = buildAssemblyIndex(assemblyHierarchy);
const abbrevIndex = buildAbbrevIndex(partAbbrevs);

const AM_ITEM = "REU-AM2626WD-50-AKN-BLK";
const AM_HEX = "92099678";
const SM_HEX = "92098924";

/** @type {string[]} */
const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error("FAIL:", msg);
}

function pass(msg) {
  console.log("PASS:", msg);
}

function pinForItemPrefix(prefix) {
  const model = catalogue.models.find((m) =>
    String(m.itemNumber || "").startsWith(prefix)
  );
  if (!model) throw new Error(`no model starting ${prefix}`);
  return resolveModelPin(catalogue, seriesDoc, model.id);
}

function pinForExactItem(itemNumber) {
  const model = catalogue.models.find((m) => m.itemNumber === itemNumber);
  if (!model) throw new Error(`no model ${itemNumber}`);
  return resolveModelPin(catalogue, seriesDoc, model.id);
}

function search(pin, query) {
  return searchParts(catalogue, query, null, {
    pin,
    limit: 40,
    tradeAliases,
    assemblyHierarchy,
    assemblyIndex,
    partAbbrevs,
    abbrevIndex,
    partBlurbs,
    edplPartMap,
  });
}

function primaryCode(rows) {
  const p = rows.find((r) => r.isPrimary);
  return p?.part?.code || null;
}

function codes(rows) {
  return rows.map((r) => String(r.part?.code || ""));
}

// --- Allow-set sanity ---
const amPin = pinForExactItem(AM_ITEM);
const smPin = pinForItemPrefix("REU-VR2626WGP");
const amAllow = buildPin3ChassisPartAllowSet(amPin, edplPartMap);
const smAllow = buildPin3ChassisPartAllowSet(smPin, edplPartMap);

if (!amAllow?.has(AM_HEX)) fail(`AM allow-set missing correct HEX ${AM_HEX}`);
else pass(`AM allow-set has ${AM_HEX}`);
if (amAllow?.has(SM_HEX)) fail(`AM allow-set must exclude Smartstart HEX ${SM_HEX}`);
else pass(`AM allow-set excludes ${SM_HEX}`);
if (!smAllow?.has(SM_HEX)) fail(`Smartstart allow-set missing ${SM_HEX}`);
else pass(`Smartstart allow-set has ${SM_HEX}`);
if (smAllow?.has(AM_HEX)) fail(`Smartstart allow-set must exclude AM HEX ${AM_HEX}`);
else pass(`Smartstart allow-set excludes ${AM_HEX}`);

// --- Locked HEX Primary cases (Pin3 Item Number) ---
const amHeat = search(amPin, "heat ex");
const amPrimary = primaryCode(amHeat);
if (amPrimary !== AM_HEX) {
  fail(`AM2626WD + heat ex Primary=${amPrimary}, want ${AM_HEX}`);
} else {
  pass(`AM2626WD + heat ex → Primary ${AM_HEX}`);
}
if (codes(amHeat).includes(SM_HEX)) {
  fail(`AM2626WD results must not include Smartstart HEX ${SM_HEX}`);
} else {
  pass(`AM2626WD results exclude ${SM_HEX}`);
}

const smHeat = search(smPin, "heat ex");
const smPrimary = primaryCode(smHeat);
if (smPrimary !== SM_HEX) {
  fail(`VR2626WGP + heat ex Primary=${smPrimary}, want ${SM_HEX}`);
} else {
  pass(`VR2626WGP + heat ex → Primary ${SM_HEX}`);
}
if (codes(smHeat).includes(AM_HEX)) {
  fail(`Smartstart results must not include AM HEX ${AM_HEX}`);
} else {
  pass(`Smartstart results exclude ${AM_HEX}`);
}

// --- Other Smartstart-only codes must not appear on AM pin ---
const smOnly = [];
for (const [code, hits] of Object.entries(edplPartMap.parts || {})) {
  const onSm = (hits || []).some((h) =>
    (h.seriesIds || []).includes("infinity26-smartstart")
  );
  const onAm = (hits || []).some((h) =>
    (h.seriesIds || []).includes("infinity26")
  );
  if (onSm && !onAm) smOnly.push(code);
}
const amCodes = new Set(codes(amHeat));
const leaked = smOnly.filter((c) => amCodes.has(c));
if (leaked.length) {
  fail(`AM heat-ex results leaked Smartstart-only codes: ${leaked.join(", ")}`);
} else {
  pass(`No Smartstart-only codes in AM heat-ex results (${smOnly.length} checked)`);
}

// --- Blurb path still works inside allow-set (layman phrasing) ---
const amBlurb = search(amPin, "heat exchanger");
if (primaryCode(amBlurb) !== AM_HEX) {
  fail(
    `AM + "heat exchanger" Primary=${primaryCode(amBlurb)}, want ${AM_HEX} (blurb/trade path)`
  );
} else {
  pass(`AM + "heat exchanger" still Primary ${AM_HEX} (blurb/trade intact)`);
}

// --- Series-only (Pin2) must NOT apply the hard fence ---
const seriesOnly = resolveModelPin(catalogue, seriesDoc, "series:infinity26");
const seriesAllow = buildPin3ChassisPartAllowSet(seriesOnly, edplPartMap);
if (seriesAllow !== null) {
  fail("Series-only Pin2 must not build a chassis allow-set");
} else {
  pass("Series-only Pin2 skips Pin3 chassis fence");
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll Pin3 chassis hard-fence evals passed.");
process.exit(0);
