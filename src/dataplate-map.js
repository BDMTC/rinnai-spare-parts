/**
 * Map OCR / pasted dataplate text → Pin 1 series + Pin 2 Item Number candidates.
 * Confirm chips only — never auto-pin.
 */

import { formatReuItemNumber } from "./reu-format.js";
import {
  findSeries,
  listSeries,
  modelBelongsToSeries,
  normalise,
  seriesForModel,
} from "./series.js";
import {
  getModelCommercialName,
  getModelShortCode,
  getSeriesCommercialName,
} from "./model-commercial-name.js";
import { isModelRestricted } from "./restriction.js";

/** Tokens that look like REU / HD / INF / chassis codes on a dataplate. */
const TOKEN_RE =
  /\b(?:REU[\s\-]?[A-Z][A-Z0-9\-]{3,}|HD[\s\-]?[0-9]{2,3}[A-Z0-9]*|INF[\s\-]?[0-9]{2}[A-Z0-9]*|HDC[\s\-]?[0-9]{2,3}[A-Z0-9]*|(?:REU)?(?:VCM|VRM|VR|AM|NB|KM|N)[0-9]{3,5}[A-Z]{0,6}(?:[\-\s]?[0-9]{2})?(?:[\-\s]?[A-Z]{1,6})?)\b/gi;

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractDataplateTokens(text) {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  const found = new Set();
  for (const m of raw.matchAll(TOKEN_RE)) {
    const t = String(m[0] || "")
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/^\-|\-$/g, "");
    if (t.length >= 4) found.add(t);
  }
  // Also try packed alnum lines that start with REU/HD after OCR glue
  const alnumChunks = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const chunk of alnumChunks) {
    if (/^(?:REU|HD|INF|HDC)/.test(chunk) && chunk.length >= 5) {
      found.add(chunk);
    }
  }
  return [...found];
}

/**
 * @param {string} token
 */
function scoreModelAgainstToken(model, tokenNorm) {
  if (!tokenNorm) return 0;
  const itemN = normalise(model.itemNumber);
  const skuN = normalise(model.sku || model.marketingCode);
  const formatted = normalise(formatReuItemNumber(tokenNorm) || tokenNorm);
  let best = 0;
  for (const hay of [itemN, skuN]) {
    if (!hay) continue;
    if (hay === tokenNorm || hay === formatted) best = Math.max(best, 100);
    else if (hay.startsWith(tokenNorm) || tokenNorm.startsWith(hay))
      best = Math.max(best, 85);
    else if (hay.includes(tokenNorm) || tokenNorm.includes(hay))
      best = Math.max(best, 70);
  }
  // Chassis-only REU-A2626WB vs packed REU-A2626WB-50-AKN
  if (best < 70 && itemN && tokenNorm.startsWith("REU")) {
    const peel = itemN.replace(/(?:50|42|60|65|70|75|85|95)?(?:AKN|AKL|AKB|AK|KN|KL|KB|UA|UAL)?(?:NZ|BLK|2)?$/, "");
    if (peel && (peel === tokenNorm || tokenNorm.startsWith(peel) || peel.startsWith(tokenNorm))) {
      best = Math.max(best, 78);
    }
  }
  return best;
}

/**
 * @param {object} series
 */
function seriesChipLabel(series) {
  const short = String(series?.label || "").trim();
  const commercial = getSeriesCommercialName(series);
  if (short && commercial && normalise(short) !== normalise(commercial)) {
    return `${short} · ${commercial}`;
  }
  return short || commercial || series?.id || "";
}

/**
 * @param {object} model
 */
function itemChipLabel(model) {
  const item = String(model?.itemNumber || "").trim();
  if (item) return item;
  return getModelShortCode(model) || model?.id || "";
}

/**
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string} text
 * @param {{ limitSeries?: number, limitItems?: number }} [opts]
 */
export function mapDataplateTextToPinCandidates(
  catalogue,
  seriesDoc,
  text,
  opts = {}
) {
  const limitSeries = opts.limitSeries ?? 6;
  const limitItems = opts.limitItems ?? 8;
  const tokens = extractDataplateTokens(text);
  /** @type {Map<string, { value: string, label: string, score: number, kind: 'series', series: object }>} */
  const seriesMap = new Map();
  /** @type {Map<string, { value: string, label: string, subtitle: string, score: number, kind: 'item', model: object, series: object|null, restricted: boolean }>} */
  const itemMap = new Map();

  for (const token of tokens) {
    const tokenNorm = normalise(token);
    const formatted = formatReuItemNumber(token) || token;

    // Direct series alias hit (HD210e, VCM2837, …)
    const seriesHit =
      findSeries(seriesDoc, token) || findSeries(seriesDoc, formatted);
    if (seriesHit) {
      const key = `series:${seriesHit.id}`;
      const prev = seriesMap.get(key);
      const score = 90;
      if (!prev || score > prev.score) {
        seriesMap.set(key, {
          kind: "series",
          value: key,
          label: seriesChipLabel(seriesHit),
          score,
          series: seriesHit,
        });
      }
    }

    for (const model of catalogue?.models || []) {
      const score = scoreModelAgainstToken(model, tokenNorm);
      if (score < 70) continue;
      const series = seriesForModel(catalogue, seriesDoc, model);
      if (series) {
        const sKey = `series:${series.id}`;
        const sPrev = seriesMap.get(sKey);
        const sScore = Math.min(score, 95);
        if (!sPrev || sScore > sPrev.score) {
          seriesMap.set(sKey, {
            kind: "series",
            value: sKey,
            label: seriesChipLabel(series),
            score: sScore,
            series,
          });
        }
      }
      const iPrev = itemMap.get(model.id);
      if (!iPrev || score > iPrev.score) {
        const commercial = getModelCommercialName(model, series);
        const short = getModelShortCode(model);
        const bits = [];
        if (commercial) bits.push(commercial);
        if (short && short !== itemChipLabel(model)) bits.push(short);
        itemMap.set(model.id, {
          kind: "item",
          value: model.id,
          label: itemChipLabel(model),
          subtitle: bits.join(" · "),
          score,
          model,
          series: series || null,
          restricted: isModelRestricted(model),
        });
      }
    }
  }

  // If we only got series from aliases, still try to surface Item Numbers when
  // a single series dominates and tokens look like packed SKUs.
  const seriesList = [...seriesMap.values()].sort((a, b) => b.score - a.score);
  const itemList = [...itemMap.values()].sort((a, b) => b.score - a.score);

  // Prefer items that belong to the top series candidate when filtering noise
  let items = itemList;
  if (seriesList[0] && itemList.length > limitItems) {
    const topId = seriesList[0].series?.id;
    const inTop = itemList.filter(
      (i) => i.series?.id === topId || modelBelongsToSeries(i.model, seriesList[0].series)
    );
    if (inTop.length) items = [...inTop, ...itemList.filter((i) => !inTop.includes(i))];
  }

  return {
    tokens,
    seriesCandidates: seriesList.slice(0, limitSeries),
    itemCandidates: items.slice(0, limitItems),
    rawText: String(text || "").trim(),
  };
}

/**
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @returns {string[]}
 */
export function listSeriesLabelsForEmpty(seriesDoc) {
  return listSeries(seriesDoc).map((s) => seriesChipLabel(s));
}
