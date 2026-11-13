#!/usr/bin/env node
/**
 * RSP-95 — wire matched Hot Water price-list codes (not already in Bible)
 * into public/data/models.json + catalogue.json models[].
 *
 * Matched-only: reads expand-beyond-cf match artefacts. Does not invent
 * unmatched model→PDF links. Does not extract parts from PDFs.
 *
 * Usage:
 *   node scripts/wire-matched-hw-models.mjs --store <path-to-expand-beyond-cf>
 *   node scripts/wire-matched-hw-models.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DEFAULT_STORE = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  "AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/docs/expand-beyond-cf"
);

function parseArgs(argv) {
  const out = { store: DEFAULT_STORE, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--store" && argv[i + 1]) out.store = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if ((c === "," && !q) || ((c === "\n" || c === "\r") && !q)) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (c === ",") continue;
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }
    cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function slugId(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function loadMatched(storeDir) {
  const csvPath = path.join(storeDir, "matched-model-pdf.csv");
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h] = r[i]));
    o.alreadyInCfBible = o.alreadyInCfBible === "true";
    o.score = Number(o.score);
    return o;
  });
}

function loadModelsAll(storeDir) {
  const doc = readJson(path.join(storeDir, "models-all.json"));
  const map = new Map();
  for (const m of doc.models || []) {
    map.set(String(m.orderCode || "").toUpperCase(), m);
  }
  return map;
}

function existingSkuSet(models) {
  const set = new Set();
  for (const m of models) {
    for (const field of ["sku", "marketingCode", "id"]) {
      const v = String(m[field] || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "");
      if (v) set.add(v);
    }
  }
  return set;
}

function buildModelRow(match, src, seenIds) {
  const code = String(match.orderCode || "").trim();
  const productName = String(src?.productName || "").trim();
  const name = productName
    ? `${productName} · ${code}`
    : code;
  const idBase = slugId(code) || `hw-${seenIds.size + 1}`;
  let id = idBase;
  let n = 2;
  while (seenIds.has(id)) id = `${idBase}-${n++}`;
  seenIds.add(id);

  const pdfNote = match.pdfFileName
    ? `Matched PL: ${match.pdfFileName} (${match.confidence}/${match.score})`
    : null;

  return {
    id,
    brand: "Rinnai",
    marketingCode: code,
    itemNumber: code,
    name,
    sku: code,
    description: productName || code,
    description2: null,
    stockingType: null,
    family: match.family || null,
    fuel: null,
    diagramUrl: null,
    diagramPath: null,
    notes: pdfNote,
    matchedPdfFileName: match.pdfFileName || null,
    matchedPdfRelPath: match.pdfRelPath || null,
    matchedVia: match.matchedVia || null,
    matchConfidence: match.confidence || null,
    matchScore: Number.isFinite(match.score) ? match.score : null,
    restricted: false,
    restrictionKind: null,
    restrictionLabel: null,
    source: "zone-contractor-matched-pdf",
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.store)) {
    throw new Error(`Match store not found: ${args.store}`);
  }

  const matched = loadMatched(args.store);
  const modelsAll = loadModelsAll(args.store);
  const modelsPath = path.join(root, "public/data/models.json");
  const cataloguePath = path.join(root, "public/data/catalogue.json");
  const modelsDoc = readJson(modelsPath);
  const catalogueDoc = readJson(cataloguePath);

  const existing = existingSkuSet(modelsDoc.models || []);
  const seenIds = new Set((modelsDoc.models || []).map((m) => m.id));

  const toAdd = [];
  const skippedPresent = [];
  const byFamily = {};

  for (const m of matched) {
    const codeU = String(m.orderCode || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "");
    byFamily[m.family] = byFamily[m.family] || { matched: 0, wired: 0, skipped: 0 };
    byFamily[m.family].matched++;

    if (existing.has(codeU) || m.alreadyInCfBible) {
      byFamily[m.family].skipped++;
      skippedPresent.push(m.orderCode);
      continue;
    }

    const src = modelsAll.get(String(m.orderCode).toUpperCase());
    const row = buildModelRow(m, src, seenIds);
    toAdd.push(row);
    existing.add(codeU);
    byFamily[m.family].wired++;
  }

  console.log(
    JSON.stringify(
      {
        matchedTotal: matched.length,
        alreadyPresentOrFlagged: skippedPresent.length,
        wiring: toAdd.length,
        byFamily,
        sampleWired: toAdd.slice(0, 8).map((m) => m.sku),
      },
      null,
      2
    )
  );

  if (args.dryRun) {
    console.log("dry-run: no files written");
    return;
  }

  modelsDoc.models = [...(modelsDoc.models || []), ...toAdd];
  modelsDoc.meta = {
    ...modelsDoc.meta,
    updated: new Date().toISOString().slice(0, 10),
    count: modelsDoc.models.length,
    restrictedCount: modelsDoc.models.filter((m) => m.restricted).length,
    matchedHwWired: toAdd.length,
    notes: `${modelsDoc.meta?.notes || ""} RSP-95: appended ${toAdd.length} Zone Contractor matched Hot Water models (matched-only; no invented PDF links).`.trim(),
  };

  // Keep catalogue models in sync with models.json; parts unchanged.
  const catById = new Map((catalogueDoc.models || []).map((m) => [m.id, m]));
  for (const m of toAdd) {
    if (!catById.has(m.id)) {
      catalogueDoc.models.push({ ...m });
    }
  }
  catalogueDoc.meta = {
    ...catalogueDoc.meta,
    updated: new Date().toISOString().slice(0, 10),
    modelCount: catalogueDoc.models.length,
    restrictedModelCount: catalogueDoc.models.filter((m) => m.restricted).length,
    notes: `${catalogueDoc.meta?.notes || ""} RSP-95: +${toAdd.length} matched Hot Water models.`.trim(),
  };

  writeJson(modelsPath, modelsDoc);
  writeJson(cataloguePath, catalogueDoc);
  console.log(`wrote ${toAdd.length} models → models.json + catalogue.json`);
}

main();
