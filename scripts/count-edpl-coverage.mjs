/**
 * Coverage: catalogue parts with chassis-scoped EDPL page+callout from edpl-part-map.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cat = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/catalogue.json"), "utf8")
);
const map = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/edpl-part-map.json"), "utf8")
);
const asm = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/assembly-hierarchy.json"), "utf8")
);

const parts = cat.parts || [];
const partCodes = new Set(
  parts.map((p) => String(p.code || "").trim()).filter(Boolean)
);
const mapParts = map.parts || {};

let linked = 0;
let linkedWithCallout = 0;
const linkedCodes = [];
for (const code of partCodes) {
  const hits = mapParts[code];
  if (!Array.isArray(hits) || !hits.length) continue;
  linked++;
  linkedCodes.push(code);
  if (hits[0]?.callout) linkedWithCallout++;
}

const asmWithPage = new Set();
for (const a of asm.assemblies || []) {
  if (!a.diagramPage) continue;
  if (a.parentCode) asmWithPage.add(String(a.parentCode));
  for (const c of a.children || []) {
    if (c.code) asmWithPage.add(String(c.code));
  }
}
const asmOnly = [...asmWithPage].filter(
  (c) => partCodes.has(c) && !mapParts[c]
).length;

const eightDigit = [...partCodes].filter((c) => /^\d{8}$/.test(c)).length;

const diagramDir = path.join(root, "src/assets/diagram-pages");
let withShippedPageAsset = 0;
for (const code of linkedCodes) {
  const pk = mapParts[code]?.[0]?.pageKey;
  if (pk && fs.existsSync(path.join(diagramDir, `${pk}.jpg`))) {
    withShippedPageAsset++;
  }
}

const out = {
  beforeHardmapPlusAssembly: 16,
  totalParts: parts.length,
  eightDigitParts: eightDigit,
  edplMappedInCatalogue: linked,
  edplMappedWithCallout: linkedWithCallout,
  edplMappedWithShippedPageAsset: withShippedPageAsset,
  edplUniqueCodesAll: Object.keys(mapParts).length,
  assemblyOnlyExtra: asmOnly,
  sheetsOk: map.totals?.sheetsOk,
  sheetsMissing: map.totals?.sheetsMissing,
  coveragePctOfCatalogue: Number(((linked / parts.length) * 100).toFixed(2)),
  coveragePctOfEightDigit: Number(((linked / eightDigit) * 100).toFixed(2)),
  gapsInCatalogue: parts.length - linked,
  note: "Mapped = catalogue code appears on an EDPL/PL text table with callout. Page image uses existing packs / series fallback when stem JPEG not shipped. Gaps = no EDPL/PL text row (image-only PDFs, non-CF, discounts, fittings never listed).",
};

console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(
  path.join(root, "artifacts/edpl-coverage-summary.json"),
  JSON.stringify(out, null, 2)
);
