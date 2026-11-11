/**
 * Pricing helpers for Rinnai spare parts.
 * Base = net invoice ex GST. Sell ex GST = net × (1 + margin%/100). GST = 10%.
 */

export const DEFAULT_MARGIN_PERCENT = 20;
export const DEFAULT_GST_RATE = 0.1;

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
  const margin = Number(marginPercent);
  const rate = Number(gstRate);
  if (!Number.isFinite(margin) || !Number.isFinite(rate)) return null;

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
