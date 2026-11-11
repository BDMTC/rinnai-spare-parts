/**
 * Quote list for Rinnai spare parts (client-side, localStorage).
 * Storage key kept as cart-v1 for continuity with earlier builds.
 */

import {
  computePrices,
  formatAud,
  clampMarginPercent,
  DEFAULT_MARGIN_PERCENT,
  DEFAULT_GST_RATE,
} from "./pricing.js";

export const CART_STORAGE_KEY = "rinnai-parts-cart-v1";
export const STORES_EMAIL = "stores@mtcgas.com.au";

/**
 * @typedef {{ code: string, name: string, netInvoiceExGst: number|null, qty: number }} CartLine
 */

/**
 * @returns {CartLine[]}
 */
export function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeLine)
      .filter((line) => line && line.code);
  } catch {
    return [];
  }
}

/**
 * @param {CartLine[]} lines
 */
export function saveCart(lines) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines.map(normalizeLine)));
}

export function clearStoredCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
}

/**
 * @param {unknown} row
 * @returns {CartLine|null}
 */
function normalizeLine(row) {
  if (!row || typeof row !== "object") return null;
  const code = String(row.code || "").trim();
  if (!code) return null;
  const name = String(row.name || "").trim() || code;
  const net =
    row.netInvoiceExGst == null || row.netInvoiceExGst === ""
      ? null
      : Number(row.netInvoiceExGst);
  const qtyRaw = Number(row.qty);
  const qty =
    Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.min(9999, Math.floor(qtyRaw)) : 1;
  return {
    code,
    name,
    netInvoiceExGst: Number.isFinite(net) ? net : null,
    qty,
  };
}

/**
 * @param {CartLine[]} lines
 * @param {{ code: string, name?: string, netInvoiceExGst?: number|null }} part
 * @param {number} [qty]
 * @returns {CartLine[]}
 */
export function addToCart(lines, part, qty = 1) {
  const code = String(part?.code || "").trim();
  if (!code) return lines.slice();
  const addQty =
    Number.isFinite(Number(qty)) && Number(qty) > 0
      ? Math.min(9999, Math.floor(Number(qty)))
      : 1;
  const next = lines.map((line) => ({ ...line }));
  const existing = next.find(
    (line) => line.code.toUpperCase() === code.toUpperCase()
  );
  if (existing) {
    existing.qty = Math.min(9999, existing.qty + addQty);
    if (part.name) existing.name = String(part.name);
    if (part.netInvoiceExGst != null) {
      const net = Number(part.netInvoiceExGst);
      existing.netInvoiceExGst = Number.isFinite(net) ? net : existing.netInvoiceExGst;
    }
    return next;
  }
  next.push(
    normalizeLine({
      code,
      name: part.name || code,
      netInvoiceExGst: part.netInvoiceExGst ?? null,
      qty: addQty,
    })
  );
  return next;
}

/**
 * @param {CartLine[]} lines
 * @param {string} code
 * @returns {CartLine[]}
 */
export function removeFromCart(lines, code) {
  const target = String(code || "").toUpperCase();
  return lines.filter((line) => line.code.toUpperCase() !== target);
}

/**
 * @param {CartLine[]} lines
 * @param {string} code
 * @param {number|string} qty
 * @returns {CartLine[]}
 */
export function setCartQty(lines, code, qty) {
  const target = String(code || "").toUpperCase();
  const qtyNum = Number(qty);
  const nextQty =
    Number.isFinite(qtyNum) && qtyNum > 0
      ? Math.min(9999, Math.floor(qtyNum))
      : 1;
  return lines.map((line) =>
    line.code.toUpperCase() === target ? { ...line, qty: nextQty } : line
  );
}

/**
 * @param {CartLine[]} lines
 */
export function cartItemCount(lines) {
  return lines.reduce((sum, line) => sum + (line.qty || 0), 0);
}

/**
 * @param {CartLine} line
 * @param {number} marginPercent
 * @param {number} [gstRate]
 */
export function linePricing(line, marginPercent, gstRate = DEFAULT_GST_RATE) {
  const priced = computePrices(line.netInvoiceExGst, marginPercent, gstRate);
  if (!priced) {
    return {
      unitNet: null,
      unitEx: null,
      unitInc: null,
      lineNet: null,
      lineEx: null,
      lineInc: null,
      marginPercent: clampMarginPercent(marginPercent),
    };
  }
  const qty = line.qty || 1;
  return {
    unitNet: priced.netInvoiceExGst,
    unitEx: priced.exGst,
    unitInc: priced.incGst,
    lineNet: priced.netInvoiceExGst * qty,
    lineEx: priced.exGst * qty,
    lineInc: priced.incGst * qty,
    marginPercent: priced.marginPercent,
  };
}

/**
 * @param {CartLine[]} lines
 * @param {number} marginPercent
 * @param {number} [gstRate]
 */
export function cartTotals(lines, marginPercent, gstRate = DEFAULT_GST_RATE) {
  let totalExGst = 0;
  let totalMarkup = 0;
  let totalIncGst = 0;
  let pricedLines = 0;
  for (const line of lines) {
    const p = linePricing(line, marginPercent, gstRate);
    if (p.lineNet == null) continue;
    pricedLines += 1;
    totalExGst += p.lineNet;
    totalMarkup += p.lineEx;
    totalIncGst += p.lineInc;
  }
  return {
    totalExGst,
    totalMarkup,
    totalIncGst,
    pricedLines,
    marginPercent: clampMarginPercent(marginPercent ?? DEFAULT_MARGIN_PERCENT),
    gstRate,
  };
}

/**
 * Normalize job / work-order input for subject/body (plain digits or WO-…).
 * @param {string} raw
 */
export function normalizeJobNumber(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^wo[\s\-_]?/i.test(trimmed)) {
    const rest = trimmed.replace(/^wo[\s\-_]*/i, "").trim();
    return rest ? `WO-${rest.replace(/^-+/, "")}` : "WO-";
  }
  return trimmed;
}

/**
 * Build plain-text quote for email / clipboard.
 * @param {{
 *   lines: CartLine[],
 *   jobNumber: string,
 *   marginPercent: number,
 *   gstRate?: number,
 *   pinnedLabel?: string|null,
 * }} opts
 */
export function formatQuoteText(opts) {
  const {
    lines,
    jobNumber,
    marginPercent,
    gstRate = DEFAULT_GST_RATE,
    pinnedLabel = null,
  } = opts;
  const job = normalizeJobNumber(jobNumber);
  const margin = clampMarginPercent(marginPercent);
  const totals = cartTotals(lines, margin, gstRate);
  const out = [];
  out.push(job ? `Parts for job ${job}` : "Parts quote list");
  out.push("");
  if (pinnedLabel) {
    out.push(`Pinned model: ${pinnedLabel}`);
    out.push("");
  }
  out.push(`Margin: ${margin}% · GST: ${Math.round(gstRate * 100)}%`);
  out.push("");
  if (!lines.length) {
    out.push("(Quote list is empty)");
  } else {
    for (const line of lines) {
      const p = linePricing(line, margin, gstRate);
      out.push(`${line.code} — ${line.name}`);
      out.push(
        `  Qty: ${line.qty}` +
          ` · Unit EX GST: ${formatAud(p.unitNet)}` +
          ` · Unit + markup: ${formatAud(p.unitEx)}` +
          ` · Unit INC GST: ${formatAud(p.unitInc)}` +
          ` · Line: ${formatAud(p.lineEx)}`
      );
      out.push("");
    }
  }
  out.push(`Total EX GST: ${formatAud(totals.totalExGst)}`);
  out.push(`Total with markup: ${formatAud(totals.totalMarkup)}`);
  out.push(`Total INC GST: ${formatAud(totals.totalIncGst)}`);
  return out.join("\n");
}

/**
 * @param {string} jobNumber
 * @param {string} body
 */
export function buildStoresMailto(jobNumber, body) {
  const job = normalizeJobNumber(jobNumber) || "(no job number)";
  const subject = `Parts for job ${job}`;
  return `mailto:${STORES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
