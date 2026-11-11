/**
 * Resolve local data-sheet PDFs via document-index + series aliases.
 * Uses the main series schema (series[].documentKeys / aliases), not the
 * older branch aliases[] shape.
 */

import { findSeries, documentKeysForPin } from "./series.js";

function normalise(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Expand free-text query + model/series pin into normalised document keys.
 * @param {object|null|undefined} seriesDoc
 * @param {string} query
 * @param {{ series?: object|null, model?: object|null }|null} pin
 * @returns {Set<string>}
 */
export function expandDocumentKeys(seriesDoc, query, pin = null) {
  const keys = new Set();

  for (const k of documentKeysForPin(pin || {})) {
    const n = normalise(k);
    if (n) keys.add(n);
  }

  const q = String(query || "").trim();
  if (q) {
    const nq = normalise(q);
    if (nq) keys.add(nq);
    const series = findSeries(seriesDoc, q);
    if (series) {
      for (const k of [
        series.label,
        ...(series.aliases || []),
        ...(series.documentKeys || []),
      ]) {
        const n = normalise(k);
        if (n) keys.add(n);
      }
    }
  }

  return keys;
}

/**
 * @param {object|null|undefined} documentIndex
 * @param {object|null|undefined} seriesDoc
 * @param {string} query
 * @param {{ kind?: string, series?: object|null, model?: object|null }|null} pin
 * @returns {Array<{ doc: object, score: number, matchedOn: string[] }>}
 */
export function searchDocuments(
  documentIndex,
  seriesDoc,
  query,
  pin = null
) {
  const docs = documentIndex?.documents || [];
  if (!docs.length) return [];

  const q = String(query || "").trim();
  const hasPin = Boolean(pin && pin.kind && pin.kind !== "none");
  if (!q && !hasPin) return [];

  const seriesKeys = expandDocumentKeys(seriesDoc, q, pin);
  const nq = normalise(q);
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

    if (nq && fileKey.includes(nq)) {
      score += 40;
      matchedOn.push("filename");
    }

    if (!q && hasPin && score === 0) continue;
    if (q && score === 0) continue;

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
