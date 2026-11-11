/**
 * Local catalogue search for Rinnai spare parts.
 *
 * Ranking (pinned model/series):
 *   1. Chassis / series fit for the pin (exact → related family → none)
 *   2. Trade-alias strength (preferPatterns → officialPatterns → weak)
 *   3. Code / name / token match quality
 *
 * Fit is inferred from chassis tokens in the price-list description against
 * series-aliases documentKeys (modelIds are not populated on ingest yet).
 */

import { documentKeysForPin } from "./series.js";
import { unitClassOf, seriesKeyMatchesTag, normalise as normaliseKey } from "./documents.js";

function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/+.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text) {
  return normalise(text).split(" ").filter(Boolean);
}

function alnum(text) {
  return normaliseKey(text);
}

/**
 * Chassis-like tokens from a price-list description (VRM2632WC, VCM2837, …).
 * Splits on spaces and slashes so "VRM2630WC/WD" yields both sides when useful.
 * @param {string} text
 * @returns {string[]}
 */
export function extractChassisTokens(text) {
  const raw = String(text || "");
  const bits = raw.split(/[\s,/|]+/).filter(Boolean);
  const out = [];
  for (const bit of bits) {
    const n = alnum(bit);
    if (n.length < 4) continue;
    if (!/\d/.test(n) || !/[A-Z]/.test(n)) continue;
    out.push(n);
  }
  return [...new Set(out)];
}

/**
 * Capacity / family digit run (2632, 2837, 3237, …) from a chassis key.
 * @param {string} keyNorm
 */
function capacityCore(keyNorm) {
  const m = String(keyNorm || "").match(/(\d{3,5})/);
  return m ? m[1] : null;
}

/**
 * Build pin match context from series aliases + model sku/item.
 * Works for any series/model in series-aliases.json — not HD200e-specific.
 * @param {{ kind?: string, series?: object|null, model?: object|null, modelIds?: string[] }|null} pin
 */
export function buildPinContext(pin) {
  if (!pin || !pin.kind || pin.kind === "none") {
    return null;
  }

  const keySet = new Set();
  for (const k of documentKeysForPin(pin)) {
    const n = alnum(k);
    if (n && n.length >= 3) keySet.add(n);
  }
  if (pin.series?.label) {
    const n = alnum(pin.series.label);
    if (n) keySet.add(n);
  }
  if (pin.model) {
    for (const field of ["sku", "marketingCode", "itemNumber", "name"]) {
      const n = alnum(pin.model[field]);
      if (n && n.length >= 4) keySet.add(n);
    }
  }

  const keys = [...keySet].sort((a, b) => b.length - a.length);
  const cores = [
    ...new Set(keys.map(capacityCore).filter(Boolean)),
  ];
  const unitClasses = (pin.series?.match?.unitClasses || []).map((u) =>
    String(u).toUpperCase()
  );
  const relatedFamilies = (pin.series?.relatedFamilies || []).map((u) =>
    String(u).toUpperCase()
  );

  return {
    kind: pin.kind,
    modelIds: new Set(pin.modelIds || []),
    keys,
    cores,
    unitClasses,
    relatedFamilies,
    series: pin.series || null,
    model: pin.model || null,
    label:
      pin.series?.label ||
      pin.model?.sku ||
      pin.model?.marketingCode ||
      "pinned model",
  };
}

/**
 * @param {object|null|undefined} tradeDoc
 * @param {string} query
 */
export function matchTradeAliases(tradeDoc, query) {
  const q = normalise(query);
  if (!q || !tradeDoc?.aliases?.length) return [];
  const hits = [];
  for (const entry of tradeDoc.aliases) {
    const terms = (entry.terms || []).map(normalise).filter(Boolean);
    let termHit = null;
    let termStrength = 0;
    for (const term of terms) {
      if (q === term) {
        termHit = term;
        termStrength = 100;
        break;
      }
      if (term.length >= 4 && (q.includes(term) || term.includes(q))) {
        const strength = Math.min(90, 50 + term.length);
        if (strength > termStrength) {
          termHit = term;
          termStrength = strength;
        }
      }
    }
    if (!termHit) continue;
    hits.push({
      entry,
      termHit,
      termStrength,
      official: (entry.officialPatterns || []).map(normalise),
      prefer: (entry.preferPatterns || []).map(normalise),
    });
  }
  hits.sort((a, b) => b.termStrength - a.termStrength);
  return hits;
}

/**
 * How well a part description fits the pinned series/model chassis.
 * @returns {{ tier: 'exact'|'related'|'none', strength: number, matchedKey: string|null, reason: string|null }}
 */
export function scorePartFit(part, pinCtx) {
  if (!pinCtx) {
    return { tier: "none", strength: 0, matchedKey: null, reason: null };
  }

  const partModelIds = part.modelIds || [];
  if (partModelIds.some((id) => pinCtx.modelIds.has(id))) {
    return {
      tier: "exact",
      strength: 120,
      matchedKey: "modelId",
      reason: "linked model id",
    };
  }

  const haystack = alnum(
    [part.name, part.code, ...(part.aliases || [])].join(" ")
  );
  const chassis = extractChassisTokens(
    [part.name, ...(part.aliases || [])].join(" ")
  );

  let bestExact = null;
  for (const key of pinCtx.keys) {
    if (key.length < 4) continue;
    // Direct containment in description blob
    if (haystack.includes(key)) {
      // If pin requires a unit class, reject conflicting classes in haystack
      if (conflictsPinUnitClass(haystack, chassis, pinCtx, key)) {
        continue;
      }
      const strength = 80 + Math.min(40, key.length);
      if (!bestExact || strength > bestExact.strength) {
        bestExact = {
          tier: "exact",
          strength,
          matchedKey: key,
          reason: `chassis ${key}`,
        };
      }
      continue;
    }
    // Token soft-match (REUVCM2837 ↔ VCM2837) without unit-class conflict
    for (const token of chassis) {
      if (!seriesKeyMatchesTag(key, token)) continue;
      if (conflictsPinUnitClass(haystack, chassis, pinCtx, key)) continue;
      const strength = 70 + Math.min(35, Math.min(key.length, token.length));
      if (!bestExact || strength > bestExact.strength) {
        bestExact = {
          tier: "exact",
          strength,
          matchedKey: key,
          reason: `chassis ${token}≈${key}`,
        };
      }
    }
  }
  if (bestExact) return bestExact;

  // Soft-exact: series.relatedFamilies (e.g. HD200i ↔ FFU heritage parts)
  for (const fam of pinCtx.relatedFamilies) {
    for (const token of chassis) {
      const uc = unitClassOf(token);
      if (uc && uc === fam) {
        return {
          tier: "exact",
          strength: 60 + Math.min(20, token.length),
          matchedKey: fam,
          reason: `related family ${fam} (${token})`,
        };
      }
    }
  }

  // Related: shared capacity digits across the platform line
  let related = null;
  for (const core of pinCtx.cores) {
    if (core && haystack.includes(core)) {
      const strength = 40 + Math.min(20, core.length);
      if (!related || strength > related.strength) {
        related = {
          tier: "related",
          strength,
          matchedKey: core,
          reason: `family ${core}`,
        };
      }
    }
  }

  if (related) return related;
  return { tier: "none", strength: 0, matchedKey: null, reason: null };
}

/**
 * Reject exact fit when the pin is unit-class specific (WC vs FFUC) and the
 * part description carries a conflicting class.
 */
function conflictsPinUnitClass(haystack, chassis, pinCtx, matchedKey) {
  const required = pinCtx.unitClasses || [];
  if (!required.length) return false;

  const keyClass = unitClassOf(matchedKey);
  // A bare platform key (N3237, VRM2632) matching a part that only states that
  // platform is OK; conflict only when the part shows a different unit class.
  const partClasses = new Set();
  for (const token of chassis) {
    const uc = unitClassOf(token);
    if (uc) partClasses.add(uc);
  }
  // Also scan haystack for embedded unit classes after digits
  for (const suffix of ["WCAK", "FFUDC", "FFUC", "FFUG", "FFUD", "FFC", "FFU", "WDC", "WC", "WD", "WG"]) {
    const re = new RegExp(`\\d${suffix}(?=[A-Z0-9]|$)`);
    if (re.test(haystack)) partClasses.add(suffix);
  }

  if (!partClasses.size) return false;

  // If any part class is allowed, no conflict
  for (const pc of partClasses) {
    if (required.includes(pc)) return false;
  }
  // Part only shows disallowed classes
  if (keyClass && required.includes(keyClass) && ![...partClasses].includes(keyClass)) {
    return true;
  }
  return [...partClasses].every((pc) => !required.includes(pc));
}

/**
 * Trade-alias hit quality against a part name.
 * @returns {{ strength: number, label: string|null, preferred: boolean }}
 */
function scoreTradeHit(partNameN, tradeHits) {
  if (!tradeHits.length) {
    return { strength: 0, label: null, preferred: false };
  }
  let best = { strength: 0, label: null, preferred: false };
  for (const hit of tradeHits) {
    for (const pref of hit.prefer) {
      if (pref && partNameN.includes(pref)) {
        const strength = 90 + Math.min(10, pref.length);
        if (strength > best.strength) {
          best = {
            strength,
            label: hit.entry.id || "trade",
            preferred: true,
          };
        }
      }
    }
    for (const pat of hit.official) {
      if (pat && partNameN.includes(pat)) {
        const strength = 70 + Math.min(15, pat.length);
        if (strength > best.strength) {
          best = {
            strength,
            label: hit.entry.id || "trade",
            preferred: hit.prefer.some((p) => partNameN.includes(p)),
          };
        }
      }
    }
  }
  return best;
}

/**
 * @param {object} catalogue
 * @param {string} query
 * @param {string|null} modelId
 * @param {{
 *   limit?: number,
 *   modelIds?: string[],
 *   pin?: object|null,
 *   tradeAliases?: object|null,
 *   isPartVisible?: ((part: object) => boolean)|null,
 * }} [opts]
 * @returns {Array<object>}
 */
export function searchParts(catalogue, query, modelId = null, opts = {}) {
  const q = normalise(query);
  const qTokens = tokens(query);
  const limit = opts.limit ?? 80;
  const pinCtx =
    opts.pin && opts.pin.kind && opts.pin.kind !== "none"
      ? buildPinContext(opts.pin)
      : buildPinContext(
          modelId || (opts.modelIds && opts.modelIds.length)
            ? {
                kind: "model",
                modelIds:
                  opts.modelIds && opts.modelIds.length
                    ? opts.modelIds
                    : [modelId],
                series: null,
                model: (catalogue.models || []).find((m) => m.id === modelId) || null,
              }
            : null
        );
  const hasPin = Boolean(pinCtx);
  const tradeHits = matchTradeAliases(opts.tradeAliases, query);
  const hasTrade = tradeHits.length > 0;
  const modelsById = Object.fromEntries(
    (catalogue.models || []).map((m) => [m.id, m])
  );
  const isPartVisible =
    typeof opts.isPartVisible === "function" ? opts.isPartVisible : null;

  if (!q && !hasPin) {
    return [];
  }

  const results = [];

  for (const part of catalogue.parts || []) {
    if (isPartVisible && !isPartVisible(part)) continue;

    const nameN = normalise(part.name);
    const codeN = normalise(part.code);
    const aliasesN = (part.aliases || []).map(normalise);
    const categoryN = normalise(part.category);
    const sheetN = normalise(part.sheet);
    const partModelIds = part.modelIds || [];

    const fit = scorePartFit(part, pinCtx);
    const fitsModel =
      !hasPin ? null : fit.tier === "exact" ? true : fit.tier === "related" ? "related" : false;

    let score = 0;
    let matchedOn = [];
    let aliasStrength = 0;

    const trade = scoreTradeHit(nameN, tradeHits);
    if (trade.strength > 0) {
      score += trade.strength;
      aliasStrength = trade.strength;
      matchedOn.push(trade.preferred ? "trade-prefer" : "trade-alias");
    }

    if (q) {
      if (codeN === q) {
        score += 100;
        matchedOn.push("code");
      } else if (codeN.includes(q) || (q.length >= 3 && q.includes(codeN))) {
        score += 70;
        matchedOn.push("code");
      }

      if (nameN === q) {
        score += 90;
        matchedOn.push("name");
      } else if (nameN.includes(q)) {
        score += 55;
        matchedOn.push("name");
      }

      for (const alias of aliasesN) {
        if (alias === q) {
          score += 85;
          aliasStrength = Math.max(aliasStrength, 85);
          matchedOn.push("alias");
          break;
        }
        if (alias.includes(q) || q.includes(alias)) {
          score += 50;
          aliasStrength = Math.max(aliasStrength, 50);
          matchedOn.push("alias");
          break;
        }
      }

      if (categoryN.includes(q) || sheetN.includes(q)) {
        score += 25;
        matchedOn.push("category");
      }

      // Token overlap — when a trade alias fired, also count official-pattern tokens
      const extraTokens = hasTrade
        ? tradeHits.flatMap((h) =>
            [...h.prefer, ...h.official].flatMap((p) => p.split(" "))
          )
        : [];
      const searchTokens = [...new Set([...qTokens, ...extraTokens])].filter(
        (t) => t.length >= 2
      );

      if (searchTokens.length > 1 || score === 0 || hasTrade) {
        const haystack = [nameN, codeN, categoryN, sheetN, ...aliasesN].join(
          " "
        );
        let hits = 0;
        let weighed = 0;
        for (const t of searchTokens) {
          if (haystack.includes(t)) {
            hits += 1;
            // Prefer meaningful trade tokens over stop-ish shorts
            weighed += t.length >= 4 ? 2 : 1;
          }
        }
        if (hits > 0) {
          const denom = Math.max(1, qTokens.length);
          score += Math.round((hits / Math.max(denom, searchTokens.length)) * 35);
          score += Math.min(20, weighed);
          if (!matchedOn.length) matchedOn.push("token");
        }
      }

      // Pure trade-query with no textual overlap and no trade pattern hit → skip
      if (hasTrade && score === 0 && trade.strength === 0) {
        // allow token path above; if still 0, drop
      }
    } else if (hasPin && fit.tier !== "none") {
      score = 10 + fit.strength / 10;
      matchedOn.push("model");
    }

    if (score <= 0) continue;

    // Trade query (e.g. "flow servo"): keep official-pattern hits (+ exact code),
    // drop weak chassis/token-only noise like harness clips.
    if (hasTrade && trade.strength <= 0 && codeN !== q) {
      continue;
    }

    // Pin ranking boosts — exact fit first, related demoted but above unrelated
    let fitRank = 0;
    if (hasPin) {
      if (fit.tier === "exact") {
        score += 50 + fit.strength / 10;
        fitRank = 2;
      } else if (fit.tier === "related") {
        score += 8;
        fitRank = 1;
      } else {
        score = Math.max(1, score - 30);
        fitRank = 0;
      }
    }

    const fittedModels = partModelIds
      .map((id) => modelsById[id])
      .filter(Boolean);

    results.push({
      part,
      score,
      matchedOn: [...new Set(matchedOn)],
      fitsSelectedModel: fitsModel,
      fitTier: fit.tier,
      fitReason: fit.reason,
      aliasStrength,
      fitRank,
      fittedModels,
      isPrimary: false,
    });
  }

  results.sort((a, b) => {
    if (hasPin && b.fitRank !== a.fitRank) return b.fitRank - a.fitRank;
    if (hasPin && b.aliasStrength !== a.aliasStrength) {
      return b.aliasStrength - a.aliasStrength;
    }
    if (b.score !== a.score) return b.score - a.score;
    return a.part.name.localeCompare(b.part.name);
  });

  const sliced = results.slice(0, limit);
  if (hasPin && sliced.length) {
    // Primary = top exact-fit hit when present; else top related; else none
    const primaryIdx = sliced.findIndex((r) => r.fitTier === "exact");
    const idx = primaryIdx >= 0 ? primaryIdx : sliced[0].fitTier === "related" ? 0 : -1;
    if (idx >= 0) sliced[idx].isPrimary = true;
  }

  return sliced;
}

export function getModelLabel(model) {
  if (!model) return "";
  const sku = model.sku || model.marketingCode;
  return sku ? `${model.name} (${sku})` : model.name;
}

/**
 * Prefer marketing display names (HD200e / HD200i) when series or name implies them.
 * @param {object} model
 * @param {object|null} [series]
 */
export function getModelDisplayName(model, series = null) {
  if (!model) return "";
  const sku = String(model.sku || model.marketingCode || "");
  const name = String(model.name || model.description || "");
  const nameU = name.toUpperCase().replace(/\s+/g, "");

  const named =
    nameU.match(/\bHD(\d+)([EI])\b/) ||
    nameU.match(/HD(\d+)([EI])(?=[^A-Z]|$)/);
  if (named) {
    const label = `HD${named[1]}${named[2].toLowerCase()}`;
    return sku ? `${label} · ${sku}` : label;
  }

  if (series?.label && /^HD\d+[ei]$/i.test(series.label)) {
    return sku ? `${series.label} · ${sku}` : series.label;
  }

  const skuU = sku.toUpperCase();
  if (/^HD\d+I/.test(skuU)) {
    const n = skuU.match(/^HD(\d+)/)?.[1];
    if (n) return `HD${n}i · ${sku}`;
  }
  if (/^HD\d+E/.test(skuU)) {
    const n = skuU.match(/^HD(\d+)/)?.[1];
    if (n) return `HD${n}e · ${sku}`;
  }

  return getModelLabel(model);
}
