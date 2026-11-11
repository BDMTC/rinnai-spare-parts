/**
 * Local catalogue search for Rinnai spare parts.
 * Scores official name, Rinnai code, and layman/trade aliases.
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
 * @returns {Array<object>}
 */
export function searchParts(catalogue, query, modelId = null) {
  const q = normalise(query);
  const qTokens = tokens(query);
  const modelsById = Object.fromEntries(
    (catalogue.models || []).map((m) => [m.id, m])
  );

  if (!q && !modelId) {
    return [];
  }

  const results = [];

  for (const part of catalogue.parts || []) {
    const nameN = normalise(part.name);
    const codeN = normalise(part.code);
    const aliasesN = (part.aliases || []).map(normalise);
    const fitsModel = modelId ? (part.modelIds || []).includes(modelId) : null;

    let score = 0;
    let matchedOn = [];

    if (q) {
      // Exact code hit (highest precision)
      if (codeN === q) {
        score += 100;
        matchedOn.push("code");
      } else if (codeN.includes(q) || q.includes(codeN)) {
        score += 70;
        matchedOn.push("code");
      }

      // Exact / substring name
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

      // Token overlap (handles multi-word trade terms)
      if (qTokens.length > 1 || score === 0) {
        const haystack = [nameN, codeN, ...aliasesN].join(" ");
        let hits = 0;
        for (const t of qTokens) {
          if (haystack.includes(t)) hits += 1;
        }
        if (hits > 0) {
          score += Math.round((hits / qTokens.length) * 35);
          if (!matchedOn.length) matchedOn.push("token");
        }
      }
    } else if (modelId && fitsModel) {
      // Model browse with empty query: list parts that fit
      score = 10;
      matchedOn.push("model");
    }

    if (score <= 0) continue;

    // Model pin: boost fits, soft-penalise non-fits (still visible)
    if (modelId) {
      if (fitsModel) score += 40;
      else score = Math.max(1, score - 25);
    }

    const fittedModels = (part.modelIds || [])
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
    // Prefer model-fit when scores tie
    if (modelId) {
      const af = a.fitsSelectedModel ? 1 : 0;
      const bf = b.fitsSelectedModel ? 1 : 0;
      if (bf !== af) return bf - af;
    }
    return a.part.name.localeCompare(b.part.name);
  });

  return results;
}

export function getModelLabel(model) {
  if (!model) return "";
  if (model.sku && model.series?.length) {
    const seriesBit = model.series.filter((s) => s !== model.sku).slice(0, 2).join(" / ");
    return seriesBit
      ? `${model.name} (${model.sku} · ${seriesBit})`
      : `${model.name} (${model.sku})`;
  }
  return model.sku ? `${model.name} (${model.sku})` : model.name;
}

/**
 * Resolve a selected model id against catalogue + optional series-alias modelId.
 * @param {object} catalogue
 * @param {string|null} modelId
 * @param {object|null} aliasesConfig
 */
export function resolveModel(catalogue, modelId, aliasesConfig = null) {
  if (!modelId) return null;
  const models = catalogue?.models || [];
  const direct = models.find((m) => m.id === modelId);
  if (direct) return direct;
  const group = (aliasesConfig?.aliases || []).find((a) => a.modelId === modelId || a.id === modelId);
  if (!group) return null;
  return (
    models.find((m) => m.id === group.modelId) ||
    models.find((m) => (m.series || []).includes(group.canonical)) ||
    null
  );
}
