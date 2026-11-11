/**
 * Browser-side price-list import using the same column rules as scripts/ingest-source-data.mjs:
 * row 6+, A=description, C=part code, K=net invoice ex GST, all sheets.
 */

import * as XLSX from "xlsx";

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

/**
 * Parse a workbook ArrayBuffer into price rows (ingest-compatible).
 * @param {ArrayBuffer} buffer
 * @param {{
 *   sourceFile?: string,
 *   dataStartRow?: number,
 *   effectiveDate?: string|null,
 *   label?: string,
 *   currency?: string,
 *   gstRate?: number,
 * }} [opts]
 */
export function parsePriceWorkbook(buffer, opts = {}) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const dataStartRow = opts.dataStartRow ?? 6;
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

    const titleRow = cell(rows[startIndex - 1], 0);
    const category =
      titleRow && !looksLikeHeader(titleRow, null)
        ? String(titleRow).trim()
        : sheetName.trim();

    let sheetRows = 0;
    let sheetWithPrice = 0;

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      const description = cell(row, 0);
      const codeRaw = cell(row, 2);
      const code =
        codeRaw == null
          ? null
          : String(codeRaw)
              .replace(/\r\n/g, " ")
              .replace(/\s+/g, " ")
              .trim();
      const net = parseMoney(cell(row, 10));

      if (!description && !code) {
        skippedEmpty += 1;
        continue;
      }

      if (looksLikeHeader(description, code)) {
        skippedHeaders += 1;
        continue;
      }

      if (!code) {
        skippedEmpty += 1;
        continue;
      }

      const isDiscountSheet = sheetName.trim().toUpperCase() === "DISCOUNTS";
      if (isDiscountSheet) {
        const segmentCode = cell(row, 1);
        const discountRaw = code;
        if (!segmentCode || looksLikeHeader(description, segmentCode)) {
          skippedEmpty += 1;
          continue;
        }
        let discountPct = parseMoney(discountRaw);
        if (
          discountPct != null &&
          typeof cell(row, 2) === "number" &&
          discountPct > 0 &&
          discountPct <= 1
        ) {
          discountPct = Math.round(discountPct * 10000) / 100;
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
      title: opts.label || "Rinnai spare parts price list",
      sourceFile: opts.sourceFile || "import.xlsx",
      effectiveDate: opts.effectiveDate || null,
      locale: "en-AU",
      currency: opts.currency || "AUD",
      gstRate: opts.gstRate ?? 0.1,
      basePriceField: "netInvoiceExGst",
      basePriceLabel: "Net invoice price (ex GST)",
      updated: new Date().toISOString().slice(0, 10),
      sheetCount: sheets.length,
      count: prices.length,
      pricedCount: prices.filter((p) => p.netInvoiceExGst != null).length,
      skippedHeaders,
      skippedEmpty,
      notes:
        "Browser import — same rules as npm run ingest (A/C/K from row 6, all sheets).",
    },
    sheets,
    prices,
  };
}

/**
 * Map ingested price rows → catalogue part shape.
 * @param {object[]} prices
 */
export function pricesToCatalogueParts(prices) {
  return (prices || []).map((p) => ({
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
        ? `Price-list discount segment${
            p.discountPercent != null ? ` · ${p.discountPercent}%` : ""
          }`
        : null,
  }));
}

/**
 * Diff current catalogue parts vs incoming import.
 * @param {object[]} currentParts
 * @param {object[]} incomingParts
 */
export function diffPriceImport(currentParts, incomingParts) {
  /** @type {Map<string, object>} */
  const currentByCode = new Map();
  for (const p of currentParts || []) {
    const key = String(p.code || "").toUpperCase();
    if (!key) continue;
    if (!currentByCode.has(key)) currentByCode.set(key, p);
  }

  /** @type {Map<string, object>} */
  const incomingByCode = new Map();
  for (const p of incomingParts || []) {
    const key = String(p.code || "").toUpperCase();
    if (!key) continue;
    if (!incomingByCode.has(key)) incomingByCode.set(key, p);
  }

  const removed = [];
  const added = [];
  const kept = [];

  for (const [key, part] of currentByCode) {
    if (!incomingByCode.has(key)) {
      removed.push({
        code: part.code,
        title: part.name || part.description || part.code,
        kind: part.kind || "part",
        reason: "missing-from-new-list",
      });
    } else {
      kept.push(key);
    }
  }

  for (const [key, part] of incomingByCode) {
    if (!currentByCode.has(key)) {
      added.push({
        code: part.code,
        title: part.name || part.description || part.code,
        kind: part.kind || "part",
      });
    }
  }

  const currentCount = currentByCode.size;
  const incomingCount = incomingByCode.size;

  return {
    currentCount,
    incomingCount,
    difference: incomingCount - currentCount,
    removed,
    added,
    keptCount: kept.length,
  };
}

/**
 * Build the parts array to apply after review.
 * @param {object[]} incomingParts
 * @param {Set<string>|string[]} skipCodes codes to omit (e.g. keep old NLA rows out, or skip new junk)
 * @param {{
 *   currentParts?: object[],
 *   retainSkippedRemoved?: boolean,
 * }} [opts] if retainSkippedRemoved, codes skipped from "removed" stay from current catalogue
 */
export function buildReviewedParts(incomingParts, skipCodes, opts = {}) {
  const skip = new Set(
    [...(skipCodes || [])].map((c) => String(c).toUpperCase())
  );
  const incoming = (incomingParts || []).filter(
    (p) => !skip.has(String(p.code || "").toUpperCase())
  );

  if (!opts.retainSkippedRemoved || !opts.currentParts?.length) {
    return incoming;
  }

  // When reviewing removals: checking "skip" on a removed part means keep it from current.
  const incomingKeys = new Set(
    incoming.map((p) => String(p.code || "").toUpperCase())
  );
  const retained = [];
  for (const p of opts.currentParts) {
    const key = String(p.code || "").toUpperCase();
    if (skip.has(key) && !incomingKeys.has(key)) {
      retained.push({ ...p });
      incomingKeys.add(key);
    }
  }
  return [...incoming, ...retained];
}
