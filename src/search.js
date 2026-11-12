/**
 * Local catalogue search for Rinnai spare parts.
 * Scores official name, Rinnai/order code, aliases, sheet/category.
 * When a model is pinned, parts that fit that model rank higher and
 * non-fitting parts are deprioritised (still shown, marked).
 */

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

/**
 * @param {object} catalogue
 * @param {string} query
 * @param {string|null} modelId
 * @param {{ limit?: number, modelIds?: string[] }} [opts]
 * @returns {Array<object>}
 */
export function searchParts(catalogue, query, modelId = null, opts = {}) {
  const q = normalise(query);
  const qTokens = tokens(query);
  const limit = opts.limit ?? 80;
  const pinnedIds = new Set(
    (opts.modelIds && opts.modelIds.length
      ? opts.modelIds
      : modelId
        ? [modelId]
        : []
    ).filter(Boolean)
  );
  const hasPin = pinnedIds.size > 0;
  const modelsById = Object.fromEntries(
    (catalogue.models || []).map((m) => [m.id, m])
  );

  if (!q && !hasPin) {
    return [];
  }

  const results = [];

  for (const part of catalogue.parts || []) {
    const nameN = normalise(part.name);
    const codeN = normalise(part.code);
    const aliasesN = (part.aliases || []).map(normalise);
    const categoryN = normalise(part.category);
    const sheetN = normalise(part.sheet);
    const partModelIds = part.modelIds || [];
    const fitsModel = hasPin
      ? partModelIds.some((id) => pinnedIds.has(id))
      : null;

    let score = 0;
    let matchedOn = [];

    if (q) {
      // Exact code hit (highest precision)
      if (codeN === q) {
        score += 100;
        matchedOn.push("code");
      } else if (codeN.includes(q) || (q.length >= 3 && q.includes(codeN))) {
        score += 70;
        matchedOn.push("code");
      }

      // Exact / substring name (price-list description)
      if (nameN === q) {
        score += 90;
        matchedOn.push("name");
      } else if (nameN.includes(q)) {
        score += 55;
        matchedOn.push("name");
      }

      // Alias exact / substring
      for (const alias of aliasesN) {
        if (alias === q) {
          score += 85;
          matchedOn.push("alias");
          break;
        }
        if (alias.includes(q) || q.includes(alias)) {
          score += 50;
          matchedOn.push("alias");
          break;
        }
      }

      // Sheet / category (so “heating”, “cont flow” etc. work)
      if (categoryN.includes(q) || sheetN.includes(q)) {
        score += 25;
        matchedOn.push("category");
      }

      // Token overlap (handles multi-word trade terms)
      if (qTokens.length > 1 || score === 0) {
        const haystack = [nameN, codeN, categoryN, sheetN, ...aliasesN].join(
          " "
        );
        let hits = 0;
        for (const t of qTokens) {
          if (haystack.includes(t)) hits += 1;
        }
        if (hits > 0) {
          score += Math.round((hits / qTokens.length) * 35);
          if (!matchedOn.length) matchedOn.push("token");
        }
      }
    } else if (hasPin && fitsModel) {
      // Model / series browse with empty query: list parts that fit
      score = 10;
      matchedOn.push("model");
    }

    if (score <= 0) continue;

    // Model / series pin: boost fits, soft-penalise non-fits (still visible)
    if (hasPin) {
      if (fitsModel) score += 40;
      else score = Math.max(1, score - 25);
    }

    const fittedModels = partModelIds
      .map((id) => modelsById[id])
      .filter(Boolean);

    results.push({
      part,
      score,
      matchedOn: [...new Set(matchedOn)],
      fitsSelectedModel: fitsModel,
      fittedModels,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (hasPin) {
      const af = a.fitsSelectedModel ? 1 : 0;
      const bf = b.fitsSelectedModel ? 1 : 0;
      if (bf !== af) return bf - af;
    }
    return a.part.name.localeCompare(b.part.name);
  });

  return results.slice(0, limit);
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

  // Explicit HD200E / HD200I / HD28E / HD28I in description
  const named = nameU.match(/\bHD(\d+)([EI])\b/) || nameU.match(/HD(\d+)([EI])(?=[^A-Z]|$)/);
  if (named) {
    const label = `HD${named[1]}${named[2].toLowerCase()}`;
    return sku ? `${label} · ${sku}` : label;
  }

  if (series?.label && /^HD\d+[ei]$/i.test(series.label)) {
    return sku ? `${series.label} · ${sku}` : series.label;
  }

  // Heuristic from sku: HD28E* / HD28I* / HD200I*
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
