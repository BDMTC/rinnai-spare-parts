/**
 * Pricing helpers for Rinnai spare parts.
 * Base = net invoice ex GST. Sell ex GST = net × (1 + margin%/100). GST = 10%.
 */

export const DEFAULT_MARGIN_PERCENT = 20;
export const DEFAULT_GST_RATE = 0.1;
/** Inclusive range for the on-screen margin selector (5% steps). */
export const MARGIN_PERCENT_MIN = 0;
export const MARGIN_PERCENT_MAX = 100;
export const MARGIN_PERCENT_STEP = 5;

/**
 * Clamp margin to 0–100 and snap to the nearest 5% step.
 * @param {number} marginPercent
 */
export function clampMarginPercent(marginPercent) {
  const n = Number(marginPercent);
  if (!Number.isFinite(n)) return DEFAULT_MARGIN_PERCENT;
  const clamped = Math.min(
    MARGIN_PERCENT_MAX,
    Math.max(MARGIN_PERCENT_MIN, n)
  );
  return Math.round(clamped / MARGIN_PERCENT_STEP) * MARGIN_PERCENT_STEP;
}

/**
 * @returns {number[]}
 */
export function marginPercentOptions() {
  const out = [];
  for (
    let m = MARGIN_PERCENT_MIN;
    m <= MARGIN_PERCENT_MAX;
    m += MARGIN_PERCENT_STEP
  ) {
    out.push(m);
  }
  return out;
}

/**
 * @param {number|null|undefined} netInvoiceExGst
 * @param {number} marginPercent
 * @param {number} [gstRate]
 */
export function computePrices(
  netInvoiceExGst,
  marginPercent = DEFAULT_MARGIN_PERCENT,
  gstRate = DEFAULT_GST_RATE
) {
  if (netInvoiceExGst == null || !Number.isFinite(Number(netInvoiceExGst))) {
    return null;
  }
  const net = Number(netInvoiceExGst);
  const margin = clampMarginPercent(marginPercent);
  const rate = Number(gstRate);
  if (!Number.isFinite(rate)) return null;

  const exGst = net * (1 + margin / 100);
  const incGst = exGst * (1 + rate);
  return {
    netInvoiceExGst: net,
    marginPercent: margin,
    gstRate: rate,
    exGst,
    incGst,
  };
}

/**
 * @param {number} amount
 * @param {string} [currency]
 */
export function formatAud(amount, currency = "AUD") {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
