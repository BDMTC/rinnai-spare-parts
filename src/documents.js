/**
 * Resolve local data-sheet PDFs via document-index + series aliases.
 * HD28 ↔ REU-VCM2837 / VCM2837 is the first wired example.
 */

function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Build lookup: normalised label → alias group.
 * @param {object} aliasesConfig
 */
export function buildAliasIndex(aliasesConfig) {
  const byLabel = new Map();
  for (const group of aliasesConfig?.aliases || []) {
    const labels = [group.canonical, ...(group.labels || [])].filter(Boolean);
    for (const label of labels) {
      byLabel.set(normalise(label), group);
    }
  }
  return byLabel;
}

/**
 * Expand a free-text query or model pin into normalised series keys.
 * @param {string} query
 * @param {object|null} model
 * @param {Map} aliasByLabel
 * @returns {Set<string>}
 */
export function expandSeriesKeys(query, model, aliasByLabel) {
  const keys = new Set();
  const addGroup = (group) => {
    if (!group) return;
    keys.add(normalise(group.canonical));
    for (const label of group.labels || []) keys.add(normalise(label));
    if (group.modelId) keys.add(normalise(group.modelId));
  };

  const q = normalise(query);
  if (q && aliasByLabel.has(q)) addGroup(aliasByLabel.get(q));
  if (q) keys.add(q);

  if (model) {
    for (const candidate of [
      model.id,
      model.sku,
      model.name,
      ...(model.aliases || []),
      ...(model.series || []),
    ]) {
      const n = normalise(candidate);
      if (!n) continue;
      keys.add(n);
      if (aliasByLabel.has(n)) addGroup(aliasByLabel.get(n));
    }
  }

  return keys;
}

/**
 * @param {object} documentIndex
 * @param {object} aliasesConfig
 * @param {string} query
 * @param {object|null} model
 * @returns {Array<object>}
 */
export function searchDocuments(documentIndex, aliasesConfig, query, model = null) {
  const docs = documentIndex?.documents || [];
  if (!docs.length) return [];

  const aliasByLabel = buildAliasIndex(aliasesConfig);
  const seriesKeys = expandSeriesKeys(query, model, aliasByLabel);
  if (!seriesKeys.size && !normalise(query) && !model) return [];

  const results = [];
  for (const doc of docs) {
    const docSeries = (doc.series || []).map(normalise).filter(Boolean);
    const fileKey = normalise(doc.fileName);
    let score = 0;
    const matchedOn = [];

    for (const s of docSeries) {
      if (seriesKeys.has(s)) {
        score += 80;
        matchedOn.push("series");
        break;
      }
    }

    const q = normalise(query);
    if (q && fileKey.includes(q)) {
      score += 40;
      matchedOn.push("filename");
    }

    // Model browse with empty query: require series hit
    if (!q && model && score === 0) continue;
    if (q && score === 0) continue;
    if (!q && !model) continue;

    if (score > 0) {
      results.push({
        doc,
        score,
        matchedOn: [...new Set(matchedOn)],
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.doc.fileName).localeCompare(String(b.doc.fileName));
  });
  return results;
}
