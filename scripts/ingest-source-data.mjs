#!/usr/bin/env node
/**
 * Convert Beau's Rinnai Excel workbooks into public/data JSON.
 *
 * Usage:
 *   npm run ingest
 *   node scripts/ingest-source-data.mjs
 *   node scripts/ingest-source-data.mjs --price-list path/to/new.xlsx
 *
 * Pricing columns (locked): from Excel row 6 down, A=description, C=part code,
 * K=Net invoice price (ex GST). All sheets are scanned.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { applyModelRestrictionFields } from "../src/restriction.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "public/data/config.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseArgs(argv) {
  const out = { priceList: null, models: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--price-list" && argv[i + 1]) out.priceList = argv[++i];
    else if (a === "--models" && argv[i + 1]) out.models = argv[++i];
  }
  return out;
}

function cell(row, index) {
  if (!row) return null;
  const v = row[index];
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim();
    return t === "" ? null : t;
  }
  return v;
}

function parseMoney(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
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

function looksLikeHeader(description, code) {
  const d = String(description || "").toUpperCase();
  const c = String(code || "").toUpperCase();
  if (d === "DESCRIPTION" || d.includes("DESCRIPTION")) {
    if (!code || c.includes("ORDER") || c.includes("CODE")) return true;
  }
  if (c.includes("ORDER") && c.includes("CODE")) return true;
  if (d === "PRODUCT SEGMENT") return true;
  return false;
}

function ingestModels(workbookPath) {
  const abs = path.isAbsolute(workbookPath)
    ? workbookPath
    : path.join(root, workbookPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Model history workbook not found: ${abs}`);
  }

  const wb = XLSX.readFile(abs, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    defval: null,
    raw: false,
  });

  const models = [];
  const seen = new Set();

  for (const row of rows) {
    const marketingCode = String(row["Marketing Code"] ?? "").trim();
    const itemNumber = String(row["Item Number"] ?? "").trim();
    if (!marketingCode && !itemNumber) continue;

    const description = String(row["Description"] ?? "").trim();
    const description2 = String(row["Description 2"] ?? "").trim();
    const stockingType = String(row["Stocking Type"] ?? "").trim() || null;

    const idBase = slugId(marketingCode || itemNumber) || `model-${models.length + 1}`;
    let id = idBase;
    let n = 2;
    while (seen.has(id)) {
      id = `${idBase}-${n++}`;
    }
    seen.add(id);

    models.push(
      applyModelRestrictionFields({
        id,
        brand: "Rinnai",
        marketingCode: marketingCode || null,
        itemNumber: itemNumber || null,
        name: description || marketingCode || itemNumber,
        sku: marketingCode || itemNumber,
        description: description || null,
        description2: description2 || null,
        stockingType,
        family: null,
        fuel: null,
        diagramUrl: null,
        diagramPath: null,
        notes: description2 || null,
        restricted: false,
        restrictionKind: null,
        restrictionLabel: null,
      })
    );
  }

  const restrictedCount = models.filter((m) => m.restricted).length;

  return {
    version: 1,
    meta: {
      title: "Rinnai REU model history",
      sourceFile: path.basename(abs),
      sourceSheet: sheetName,
      locale: "en-AU",
      updated: new Date().toISOString().slice(0, 10),
      count: models.length,
      restrictedCount,
      notes:
        "Fields preserved from REU-Model-History.xlsx. restricted* derived from Description 2 (NLA / export only / use-up / only-for). family/fuel/diagrams left null until Beau supplies them.",
    },
    models,
  };
}

function ingestPrices(workbookPath, config) {
  const abs = path.isAbsolute(workbookPath)
    ? workbookPath
    : path.join(root, workbookPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Price list workbook not found: ${abs}`);
  }

  const wb = XLSX.readFile(abs, { cellDates: true });
  const dataStartRow = config.priceList?.parse?.dataStartRow ?? 6; // 1-based Excel row
  const startIndex = Math.max(0, dataStartRow - 1);

  const sheets = [];
  const prices = [];
  let skippedHeaders = 0;
  let skippedEmpty = 0;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    // Category title often sits on the row above the header (Excel row 5).
    const titleRow = cell(rows[startIndex - 1], 0);
    const category =
      titleRow && !looksLikeHeader(titleRow, null)
        ? String(titleRow).trim()
        : sheetName.trim();

    let sheetRows = 0;
    let sheetWithPrice = 0;

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      const description = cell(row, 0); // A
      const codeRaw = cell(row, 2); // C
      const code =
        codeRaw == null
          ? null
          : String(codeRaw)
              .replace(/\r\n/g, " ")
              .replace(/\s+/g, " ")
              .trim();
      const net = parseMoney(cell(row, 10)); // K

      if (!description && !code) {
        skippedEmpty += 1;
        continue;
      }

      if (looksLikeHeader(description, code)) {
        skippedHeaders += 1;
        continue;
      }

      // Require a part code for searchable price rows.
      if (!code) {
        skippedEmpty += 1;
        continue;
      }

      // DISCOUNTS sheet layout differs: A=segment, B=product code, C=discount %.
      const isDiscountSheet = sheetName.trim().toUpperCase() === "DISCOUNTS";
      if (isDiscountSheet) {
        const segmentCode = cell(row, 1); // B
        const discountRaw = code; // C (already normalised string)
        if (!segmentCode || looksLikeHeader(description, segmentCode)) {
          skippedEmpty += 1;
          continue;
        }
        // Excel stores 34% as 0.34 when read raw; plain "34.00%" strings parse as 34.
        let discountPct = parseMoney(discountRaw);
        if (
          discountPct != null &&
          typeof cell(row, 2) === "number" &&
          discountPct > 0 &&
          discountPct <= 1
        ) {
          discountPct = Math.round(discountPct * 10000) / 100; // 0.34 → 34
        }
        prices.push({
          id: `price-${slugId(sheetName)}-${prices.length + 1}`,
          code: String(segmentCode).trim(),
          description: description || String(segmentCode).trim(),
          sheet: sheetName.trim(),
          category: "Discounts",
          netInvoiceExGst: null,
          discountPercent: discountPct,
          kind: "discount-segment",
          sourceRow: i + 1,
        });
        sheetRows += 1;
        continue;
      }

      if (net == null && !description) {
        skippedEmpty += 1;
        continue;
      }

      // Skip Cover/Contact noise: codes that are clearly not order codes when no price.
      if (net == null) {
        skippedEmpty += 1;
        continue;
      }

      prices.push({
        id: `price-${slugId(sheetName)}-${prices.length + 1}`,
        code,
        description: description || code,
        sheet: sheetName.trim(),
        category,
        netInvoiceExGst: net,
        kind: "part",
        sourceRow: i + 1,
      });
      sheetRows += 1;
      sheetWithPrice += 1;
    }

    sheets.push({
      name: sheetName.trim(),
      category,
      rowCount: sheetRows,
      pricedCount: sheetWithPrice,
    });
  }

  return {
    version: 1,
    meta: {
      title: config.priceList?.label || "Rinnai spare parts price list",
      sourceFile: path.basename(abs),
      effectiveDate: config.priceList?.effectiveDate || null,
      locale: "en-AU",
      currency: config.currency || "AUD",
      gstRate: config.gstRate ?? 0.1,
      basePriceField: "netInvoiceExGst",
      basePriceLabel: "Net invoice price (ex GST)",
      updated: new Date().toISOString().slice(0, 10),
      sheetCount: sheets.length,
      count: prices.length,
      pricedCount: prices.filter((p) => p.netInvoiceExGst != null).length,
      skippedHeaders,
      skippedEmpty,
      notes:
        "Base price is column K net invoice ex GST. App applies on-screen margin %, then GST 10%.",
    },
    sheets,
    prices,
  };
}

function buildCatalogue(modelsDoc, pricesDoc, config) {
  // Searchable rows = every ingested price-list row (parts + discount segments).
  // Aliases / model links stay empty until Beau supplies them.
  const parts = pricesDoc.prices.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.description,
    aliases: [],
    modelIds: [],
    category: p.category,
    sheet: p.sheet,
    kind: p.kind || "part",
    netInvoiceExGst: p.netInvoiceExGst,
    discountPercent: p.discountPercent ?? null,
    diagramRef: { url: null, path: null, callout: null },
    notes:
      p.kind === "discount-segment"
        ? `Price-list discount segment${p.discountPercent != null ? ` · ${p.discountPercent}%` : ""}`
        : null,
  }));

  return {
    version: 2,
    meta: {
      title: "Rinnai spare parts catalogue (models + price list)",
      locale: "en-AU",
      updated: new Date().toISOString().slice(0, 10),
      notes:
        "Models from REU Model History. Parts from price list (all product sheets). Aliases/diagrams TBD.",
      defaultMarginPercent: config.defaultMarginPercent ?? 25,
      gstRate: config.gstRate ?? 0.1,
      modelCount: modelsDoc.models.length,
      restrictedModelCount: modelsDoc.models.filter((m) => m.restricted).length,
      partCount: parts.length,
    },
    models: modelsDoc.models,
    parts,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readJson(configPath);

  const modelsPath = args.models || config.modelHistory.workbookPath;
  const pricePath = args.priceList || config.priceList.workbookPath;

  console.log("Ingesting models from:", modelsPath);
  const modelsDoc = ingestModels(modelsPath);
  writeJson(path.join(root, config.modelHistory.generatedFile), modelsDoc);
  console.log(
    `  → ${modelsDoc.models.length} models (${modelsDoc.meta.restrictedCount} restricted from Description 2)`
  );

  console.log("Ingesting prices from:", pricePath);
  const pricesDoc = ingestPrices(pricePath, config);
  writeJson(path.join(root, config.priceList.generatedFile), pricesDoc);
  console.log(
    `  → ${pricesDoc.prices.length} price rows across ${pricesDoc.sheets.length} sheets (${pricesDoc.meta.pricedCount} priced)`
  );
  for (const s of pricesDoc.sheets) {
    console.log(
      `     • ${s.name}: ${s.rowCount} rows (${s.pricedCount} priced)`
    );
  }

  const catalogue = buildCatalogue(modelsDoc, pricesDoc, config);
  writeJson(path.join(root, "public/data/catalogue.json"), catalogue);
  console.log(
    `  → catalogue.json: ${catalogue.models.length} models, ${catalogue.parts.length} parts`
  );

  // Refresh config stamp
  config.priceList.lastIngested = pricesDoc.meta.updated;
  config.modelHistory.lastIngested = modelsDoc.meta.updated;
  writeJson(configPath, config);
  console.log("Done. Config updated:", path.relative(root, configPath));
}

main();
