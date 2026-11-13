#!/usr/bin/env node
/**
 * RSP-95 smoke: EHFA160 series/model pin resolves element 95110104;
 * all newly wired matched SKUs belong to a series.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPinContext,
  scorePartFit,
  searchParts,
} from "../src/search.js";
import {
  resolveModelPin,
  modelBelongsToSeries,
  listSeries,
  seriesForModel,
} from "../src/series.js";
import { searchDocuments } from "../src/documents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/catalogue.json"), "utf8")
);
const seriesDoc = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/series-aliases.json"), "utf8")
);
const docIndex = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/document-index.json"), "utf8")
);

const PART = "95110104";
const MODEL = "EHFA160S24";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const part = catalogue.parts.find((p) => p.code === PART);
assert(part, `catalogue missing part ${PART}`);

const seriesPin = resolveModelPin(catalogue, seriesDoc, "series:ehfa160");
assert(seriesPin.kind === "series", "ehfa160 series pin");
assert(seriesPin.series?.id === "ehfa160", "series id");
assert(
  seriesPin.modelIds.some((id) =>
    catalogue.models.find((m) => m.id === id && m.sku === MODEL)
  ),
  `${MODEL} in ehfa160 modelIds`
);

const fitSeries = scorePartFit(part, buildPinContext(seriesPin));
assert(fitSeries.tier === "exact", `series fit tier exact, got ${fitSeries.tier}`);
assert(
  /EHFA160/i.test(fitSeries.matchedKey || ""),
  `matchedKey EHFA160, got ${fitSeries.matchedKey}`
);

const model = catalogue.models.find((m) => m.sku === MODEL);
assert(model, `catalogue missing model ${MODEL}`);
const modelPin = resolveModelPin(catalogue, seriesDoc, model.id);
assert(modelPin.kind === "model", "model pin kind");
const fitModel = scorePartFit(part, buildPinContext(modelPin));
assert(fitModel.tier === "exact", `model fit tier exact, got ${fitModel.tier}`);

const searchHits = searchParts(catalogue, PART, null, {
  pin: seriesPin,
  limit: 40,
});
const found = (Array.isArray(searchHits) ? searchHits : []).some(
  (r) => (r.part?.code || r.code) === PART
);
assert(found, "searchParts must return 95110104 under EHFA160 pin");

const docs = searchDocuments(docIndex, seriesDoc, "", seriesPin);
const ehfaDoc = docs.some((d) =>
  /EHFA160|EHFA/i.test(JSON.stringify(d.doc || d))
);

const wired = catalogue.models.filter((m) => m.source === "zone-contractor-matched-pdf");
const orphans = [];
for (const m of wired) {
  const s = seriesForModel(catalogue, seriesDoc, m);
  if (!s) orphans.push(m.sku);
}

const multi = [];
for (const m of wired) {
  const hits = listSeries(seriesDoc).filter((s) => modelBelongsToSeries(m, s));
  if (hits.length > 1) multi.push({ sku: m.sku, series: hits.map((h) => h.id) });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      part: PART,
      partName: part.name,
      seriesFit: fitSeries,
      modelFit: fitModel,
      searchFound: found,
      ehfaDocs: ehfaDoc,
      docCount: (docs || []).length,
      wiredModels: wired.length,
      orphanSeries: orphans,
      multiSeries: multi,
      ehfa160ModelCount: seriesPin.modelIds.length,
    },
    null,
    2
  )
);
