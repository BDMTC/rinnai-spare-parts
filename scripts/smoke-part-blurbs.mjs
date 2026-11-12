/**
 * Offline smoke: enriched blurbs + assembly-rich preference + search indexing.
 * Run: node scripts/smoke-part-blurbs.mjs
 */
import catalogue from "../public/data/catalogue.json" with { type: "json" };
import abbrevs from "../public/data/part-name-abbreviations.json" with { type: "json" };
import hierarchy from "../public/data/assembly-hierarchy.json" with { type: "json" };
import partBlurbs from "../public/data/part-blurbs.json" with { type: "json" };
import {
  buildAbbrevIndex,
  buildAssemblyIndex,
  buildPartSearchCache,
  searchParts,
} from "../src/search.js";
import { plainEnglishSummary } from "../src/display-name.js";

const abbrevIndex = buildAbbrevIndex(abbrevs);
const assemblyIndex = buildAssemblyIndex(hierarchy);
const partSearchCache = buildPartSearchCache(catalogue.parts || [], {
  abbrevIndex,
  assemblyIndex,
  partBlurbs,
});

function partByCode(code) {
  return (catalogue.parts || []).find((p) => String(p.code) === String(code));
}

function summary(code) {
  const part = partByCode(code);
  if (!part) return { code, error: "missing" };
  return {
    code,
    name: part.name,
    summary: plainEnglishSummary(part, assemblyIndex, abbrevIndex, partBlurbs),
    curated: Boolean(partBlurbs.blurbs?.[code]),
  };
}

const codes = [
  "92093550", // HD200e hex — seed
  "92095224", // HD200e fan — seed / maybe assembly
  "90175563", // Energysaver gasket
  "90175662", // burner packing gasket
  "90196524", // ES309 combustion fan
  "90102054", // air filter
  "90179590", // PCB
  "92099409", // mapped fan parent if present
];

console.log("=== Card summaries ===");
for (const c of codes) {
  console.log(JSON.stringify(summary(c), null, 2));
}

const queries = [
  { q: "92093550", expectCode: "92093550" },
  { q: "fan", expectCode: null },
  { q: "gasket", expectCode: null },
  { q: "washable front air filter", expectHint: /filter/i },
  { q: "big heating coil", expectHint: /heat|hex|exch/i },
];

console.log("\n=== Search indexing (blurbs searchable) ===");
for (const { q, expectCode, expectHint } of queries) {
  const rows = searchParts(catalogue, q, null, {
    abbrevIndex,
    assemblyIndex,
    partBlurbs,
    partSearchCache,
    limit: 8,
  });
  const top = rows.slice(0, 5).map((r) => ({
    code: r.part.code,
    name: r.part.name,
    summary: plainEnglishSummary(r.part, assemblyIndex, abbrevIndex, partBlurbs),
    matchedOn: r.matchedOn,
  }));
  const hitCode = expectCode
    ? top.some((t) => String(t.code) === expectCode)
    : true;
  const hitHint = expectHint
    ? top.some(
        (t) =>
          expectHint.test(t.summary || "") || expectHint.test(t.name || "")
      )
    : true;
  console.log(
    JSON.stringify(
      { q, ok: hitCode && hitHint, top },
      null,
      2
    )
  );
}

let empty = 0;
for (const part of catalogue.parts || []) {
  const s = plainEnglishSummary(part, assemblyIndex, abbrevIndex, partBlurbs);
  if (!String(s || "").trim()) empty += 1;
}
console.log("\nEmpty summaries:", empty, "/", (catalogue.parts || []).length);
console.log("Blurb doc count:", Object.keys(partBlurbs.blurbs || {}).length);
