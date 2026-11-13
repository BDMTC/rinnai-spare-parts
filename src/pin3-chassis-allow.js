/**
 * Pin3 chassis PL/ED hard allowlist.
 *
 * When Pin 3 (Item Number / model pin) is set, search candidates are restricted
 * to part codes that appear on that chassis’s PL/ED map (edpl-part-map.json).
 * Soft signals (blurb / abbrev / trade / description digit overlap) may only
 * rank inside that set — they must not pull another chassis’ BOM into results
 * or Primary.
 *
 * Series-only Pin 2 does not apply this fence (encourage Pin 3 first).
 * Everything (Pin 1 override) never applies this fence.
 */

/**
 * @param {string} text
 */
function alnum(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * @param {object|null|undefined} pin
 * @returns {{ seriesId: string, tokens: string[] }}
 */
export function pin3MatchContext(pin) {
  if (!pin || pin.kind !== "model") {
    return { seriesId: "", tokens: [] };
  }
  const seriesId = pin.series?.id ? String(pin.series.id).toLowerCase() : "";
  const tokens = [
    seriesId,
    pin.series?.label,
    ...(pin.series?.documentKeys || []),
    ...(pin.series?.aliases || []),
    pin.model?.itemNumber,
    pin.model?.sku,
    pin.model?.marketingCode,
    pin.model?.id,
  ]
    .filter(Boolean)
    .map(alnum)
    .filter((t) => t.length >= 4);
  // Longer first so AM2626WD wins over short INF26-style aliases when comparing.
  tokens.sort((a, b) => b.length - a.length);
  return { seriesId, tokens: [...new Set(tokens)] };
}

/**
 * Does one EDPL/PL hit belong to this Pin3 chassis?
 *
 * When the pin has a series id, membership is **seriesIds only** (the PL/ED
 * sheet tags). No description-token / alias soft match — that lets INF26 pull
 * INF26S Smartstart rows into Infinity 26.
 *
 * Chassis-token overlap is only used when Pin3 has no series id yet.
 *
 * @param {object} hit
 * @param {{ seriesId: string, tokens: string[] }} ctx
 */
export function edplHitMatchesPin3(hit, ctx) {
  if (!hit || !ctx) return false;
  const seriesIds = (hit.seriesIds || []).map((s) => String(s).toLowerCase());

  if (ctx.seriesId) {
    return seriesIds.includes(ctx.seriesId);
  }

  const chassis = (hit.chassisTokens || []).map(alnum).filter(Boolean);
  if (!chassis.length || !ctx.tokens.length) return false;

  for (const c of chassis) {
    if (c.length < 6) continue;
    for (const t of ctx.tokens) {
      if (t.length < 6) continue;
      if (t === c || t.includes(c) || c.includes(t)) return true;
    }
  }
  return false;
}

/**
 * Build the hard allow-set of catalogue part codes for a Pin3 model pin.
 * Returns null when the fence does not apply (no Pin3 / not a model pin).
 * Returns an empty Set when Pin3 is set but no PL/ED rows match (fail closed).
 *
 * @param {object|null|undefined} pin
 * @param {object|null|undefined} edplPartMap  public/data/edpl-part-map.json
 * @returns {Set<string>|null}
 */
export function buildPin3ChassisPartAllowSet(pin, edplPartMap) {
  if (!pin || pin.kind !== "model") return null;
  const ctx = pin3MatchContext(pin);
  if (!ctx.seriesId && !ctx.tokens.length) return new Set();

  const allow = new Set();
  const parts = edplPartMap?.parts || {};
  for (const [code, hits] of Object.entries(parts)) {
    if (!Array.isArray(hits) || !hits.length) continue;
    if (hits.some((h) => edplHitMatchesPin3(h, ctx))) {
      allow.add(String(code));
    }
  }
  return allow;
}

/**
 * @param {string|null|undefined} code
 * @param {Set<string>|null|undefined} allowSet
 */
export function partOnPin3ChassisAllow(code, allowSet) {
  if (!allowSet) return true;
  return allowSet.has(String(code || "").trim());
}

/** @deprecated Use pin3MatchContext — kept for restack/compat during #50/#51 rebase. */
export const pin2MatchContext = pin3MatchContext;
/** @deprecated Use edplHitMatchesPin3 */
export const edplHitMatchesPin2 = edplHitMatchesPin3;
/** @deprecated Use buildPin3ChassisPartAllowSet */
export const buildPin2ChassisPartAllowSet = buildPin3ChassisPartAllowSet;
/** @deprecated Use partOnPin3ChassisAllow */
export const partOnPin2ChassisAllow = partOnPin3ChassisAllow;
