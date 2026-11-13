/**
 * Map OCR / pasted dataplate text → Pin 1 type + Pin 2 series + Pin 3 Item
 * Number candidates. Confirm chips only — never auto-pin.
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
import {
  SYSTEM_TYPES,
  normalizeSystemTypeId,
  seriesBelongsToSystemType,
} from "./system-type.js";

/**
 * Tokens that look like product / chassis codes on a dataplate.
 * Covers CF REU/HD plus Hotflo, GHF, heat pumps, ECF, CHP, Demand Duo, solar SG.
 */
const TOKEN_RE =
  /\b(?:REU[\s\-]?[A-Z][A-Z0-9\-]{3,}|HD[\s\-]?[0-9]{2,3}[A-Z0-9]*|INF[\s\-]?[0-9]{2}[A-Z0-9]*|HDC[\s\-]?[0-9]{2,3}[A-Z0-9]*|(?:REU)?(?:VCM|VRM|VR|AM|NB|KM|N)[0-9]{3,5}[A-Z]{0,6}(?:[\-\s]?[0-9]{2})?(?:[\-\s]?[A-Z]{1,6})?|EHF[AD]?\d+[A-Z0-9]*|GHF\d+[A-Z0-9]*|EHP[AGTS]\d*[A-Z0-9]*|ECF\d+[A-Z0-9]*|CHP\d+[A-Z0-9]*|DD(?:UPS|UPM|UVC|TSTAT|1TSTAT|234TSTAT|56TSTAT)[A-Z0-9]*|UVC\d+[A-Z0-9]*|SG(?:175|215|270|320)[A-Z0-9]*|FM10[A-Z0-9]*)\b/gi;

/**
 * Brand / family cues on the plate itself (not Everything).
 * More-specific cues first; scores accumulate per system id.
 * @type {Array<{ id: string, score: number, re: RegExp }>}
 */
const SYSTEM_TEXT_CUES = [
  // Demand Duo
  { id: "demand-duo", score: 96, re: /\bdemand\s*duo\b/i },
  { id: "demand-duo", score: 92, re: /\bDD(?:UPS|UPM|UVC|TSTAT|1TSTAT|234TSTAT|56TSTAT)\b/i },
  { id: "demand-duo", score: 80, re: /\bUVC\s*(?:1200|1700)\b/i },

  // Commercial heat pump (before generic heat pump)
  { id: "commercial-heat-pump", score: 95, re: /\bCHP\d*/i },
  { id: "commercial-heat-pump", score: 88, re: /\bcommercial\s+heat\s*pump\b/i },

  // Domestic heat pump / Enviroflo
  { id: "heat-pump-hot-water", score: 94, re: /\benviroflo\b/i },
  { id: "heat-pump-hot-water", score: 92, re: /\bEHP[AGTS]\d*/i },
  { id: "heat-pump-hot-water", score: 78, re: /\bheat\s*pump\b/i },

  // Gas storage GHF (before generic Hotflo — plates can say “Hotflo GHF”)
  { id: "gas-storage-hot-water", score: 95, re: /\bGHF\d*/i },
  { id: "gas-storage-hot-water", score: 82, re: /\bgas\s+storage\b/i },

  // Hotflo electric storage
  { id: "hotflo-electric-storage", score: 96, re: /\bhotflo\b/i },
  { id: "hotflo-electric-storage", score: 92, re: /\bEHF[AD]?\d+/i },

  // Electric continuous flow
  { id: "electric-continuous-flow", score: 95, re: /\befinity\b/i },
  { id: "electric-continuous-flow", score: 92, re: /\bECF\d+/i },

  // Solar split tanks (not Solar 28 CF)
  { id: "solar-hot-water", score: 94, re: /\bsolar\s+split\b/i },
  { id: "solar-hot-water", score: 90, re: /\bSG(?:175|215|270|320)\b/i },

  // Continuous flow / Infinity / REU / HD / Flowmaster
  { id: "continuous-flow-hot-water", score: 94, re: /\bREU[\s\-]?[A-Z0-9]/i },
  { id: "continuous-flow-hot-water", score: 90, re: /\binfinity\b/i },
  { id: "continuous-flow-hot-water", score: 88, re: /\b(?:HD|HDC)\s*\d{2,3}/i },
  { id: "continuous-flow-hot-water", score: 86, re: /\bflowmaster\b|\bFM10\b/i },
  { id: "continuous-flow-hot-water", score: 80, re: /\bcontinuous\s*flow\b/i },
];

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
    if (t.length >= 3) found.add(t);
  }
  // Also try packed alnum chunks after OCR glue
  const alnumChunks = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  for (const chunk of alnumChunks) {
    if (
      /^(?:REU|HD|INF|HDC|EHF|GHF|EHP|ECF|CHP|DD|SG|FM10|UVC)/.test(chunk) &&
      chunk.length >= 4
    ) {
      found.add(chunk);
    }
    if (chunk === "HOTFLO" || chunk === "ENVIROFLO" || chunk === "EFINITY") {
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
    const peel = itemN.replace(
      /(?:50|42|60|65|70|75|85|95)?(?:AKN|AKL|AKB|AK|KN|KL|KB|UA|UAL)?(?:NZ|BLK|2)?$/,
      ""
    );
    if (
      peel &&
      (peel === tokenNorm || tokenNorm.startsWith(peel) || peel.startsWith(tokenNorm))
    ) {
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
 * Resolve a series' Pin1 system id (tagged, else CF for untagged legacy).
 * @param {object|null|undefined} series
 * @returns {string}
 */
export function systemTypeIdForSeries(series) {
  if (!series) return "";
  const tagged = series.systemType || series.systemTypes;
  const tags = Array.isArray(tagged)
    ? tagged.map((t) => normalizeSystemTypeId(t)).filter(Boolean)
    : typeof tagged === "string" && tagged
      ? [normalizeSystemTypeId(tagged)].filter(Boolean)
      : [];
  if (tags.length) return tags[0];
  // Untagged = Continuous Flow (same rule as seriesBelongsToSystemType).
  return "continuous-flow-hot-water";
}

/**
 * Infer Pin1 Type of system candidates from plate text + matched series/items.
 * Covers every scoped SYSTEM_TYPES class when evidence supports it — never Everything.
 *
 * @param {{
 *   text?: string,
 *   seriesCandidates?: Array<{ series?: object, score?: number }>,
 *   itemCandidates?: Array<{ series?: object|null, score?: number }>,
 *   limit?: number
 * }} [opts]
 */
export function inferSystemTypeCandidates(opts = {}) {
  const limit = opts.limit ?? 4;
  const text = String(opts.text || "");
  /** @type {Map<string, { id: string, value: string, label: string, subtitle: string, score: number, kind: 'system', systemType: object, evidence: string[] }>} */
  const map = new Map();

  function bump(id, score, evidence) {
    const sid = normalizeSystemTypeId(id);
    if (!sid || sid === "everything") return;
    const t = SYSTEM_TYPES.find((x) => x.id === sid && x.kind === "system");
    if (!t) return;
    const prev = map.get(sid);
    const evidenceList = prev ? [...prev.evidence] : [];
    if (evidence && !evidenceList.includes(evidence)) evidenceList.push(evidence);
    const nextScore = Math.max(prev?.score || 0, score);
    map.set(sid, {
      kind: "system",
      value: t.value,
      label: t.label,
      subtitle: t.subtitle,
      score: nextScore,
      systemType: t,
      evidence: evidenceList,
    });
  }

  for (const c of opts.seriesCandidates || []) {
    const id = systemTypeIdForSeries(c.series);
    if (id) bump(id, Math.max(70, Number(c.score) || 80), "series match");
  }
  for (const c of opts.itemCandidates || []) {
    const id = systemTypeIdForSeries(c.series);
    if (id) bump(id, Math.max(72, Number(c.score) || 82), "item match");
  }

  // Plate brand / family wording for every locked class.
  for (const cue of SYSTEM_TEXT_CUES) {
    if (cue.re.test(text)) bump(cue.id, cue.score, "plate text");
  }

  // Disambiguate Hotflo electric vs GHF gas when both cues fire.
  if (map.has("gas-storage-hot-water") && map.has("hotflo-electric-storage")) {
    const gas = map.get("gas-storage-hot-water");
    const hotflo = map.get("hotflo-electric-storage");
    if (/\bGHF\d*/i.test(text) && !/\bEHF[AD]?\d+/i.test(text)) {
      // “Hotflo GHF…” on gas tanks — prefer gas storage.
      gas.score = Math.max(gas.score, (hotflo?.score || 0) + 8);
      map.delete("hotflo-electric-storage");
    } else if (/\bEHF[AD]?\d+/i.test(text) && !/\bGHF\d*/i.test(text)) {
      map.delete("gas-storage-hot-water");
    }
  }

  // Generic “heat pump” without CHP should not keep commercial CHP alone.
  if (
    map.has("commercial-heat-pump") &&
    map.has("heat-pump-hot-water") &&
    !/\bCHP\d*/i.test(text) &&
    !/\bcommercial\s+heat\s*pump\b/i.test(text)
  ) {
    map.delete("commercial-heat-pump");
  }

  return [...map.values()]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/**
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string} text
 * @param {{ limitSeries?: number, limitItems?: number, limitSystems?: number }} [opts]
 */
export function mapDataplateTextToPinCandidates(
  catalogue,
  seriesDoc,
  text,
  opts = {}
) {
  const limitSeries = opts.limitSeries ?? 6;
  const limitItems = opts.limitItems ?? 8;
  const limitSystems = opts.limitSystems ?? 4;
  const tokens = extractDataplateTokens(text);
  /** @type {Map<string, { value: string, label: string, score: number, kind: 'series', series: object }>} */
  const seriesMap = new Map();
  /** @type {Map<string, { value: string, label: string, subtitle: string, score: number, kind: 'item', model: object, series: object|null, restricted: boolean }>} */
  const itemMap = new Map();

  for (const token of tokens) {
    const tokenNorm = normalise(token);
    const formatted = formatReuItemNumber(token) || token;

    // Direct series alias hit (HD210e, Hotflo, VCM2837, …)
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

  // Brand words that are aliases (Hotflo, Demand Duo, Enviroflo) even without SKU.
  for (const word of [
    "Hotflo",
    "HOTFLO",
    "Demand Duo",
    "Enviroflo",
    "Efinity",
    "Flowmaster",
    "Infinity",
  ]) {
    if (!new RegExp(word.replace(/\s+/g, "\\s*"), "i").test(text)) continue;
    const seriesHit = findSeries(seriesDoc, word);
    if (!seriesHit) continue;
    const key = `series:${seriesHit.id}`;
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        kind: "series",
        value: key,
        label: seriesChipLabel(seriesHit),
        score: 75,
        series: seriesHit,
      });
    }
  }

  const seriesList = [...seriesMap.values()].sort((a, b) => b.score - a.score);
  const itemList = [...itemMap.values()].sort((a, b) => b.score - a.score);

  // Prefer items that belong to the top series candidate when filtering noise
  let items = itemList;
  if (seriesList[0] && itemList.length > limitItems) {
    const topId = seriesList[0].series?.id;
    const inTop = itemList.filter(
      (i) =>
        i.series?.id === topId ||
        modelBelongsToSeries(i.model, seriesList[0].series)
    );
    if (inTop.length)
      items = [...inTop, ...itemList.filter((i) => !inTop.includes(i))];
  }

  const seriesCandidates = seriesList.slice(0, limitSeries);
  const itemCandidates = items.slice(0, limitItems);
  const systemCandidates = inferSystemTypeCandidates({
    text,
    seriesCandidates,
    itemCandidates,
    limit: limitSystems,
  });

  return {
    tokens,
    systemCandidates,
    seriesCandidates,
    itemCandidates,
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

/**
 * @param {object|null|undefined} series
 * @param {string|null|undefined} systemTypeId
 */
export function seriesMatchesInferredSystem(series, systemTypeId) {
  return seriesBelongsToSystemType(series, systemTypeId);
}
