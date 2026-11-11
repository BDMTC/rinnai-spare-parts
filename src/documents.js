/**
 * Resolve local data-sheet PDFs via document-index + series aliases.
 * Uses the main series schema (series[].documentKeys / aliases), not the
 * older branch aliases[] shape.
 *
 * Unit-class variants (WC / WC-AK vs FFUC / FFC) stay distinct — a WC key
 * must not soft-match an FFUC tag, and vice versa.
 */

import { findSeries, documentKeysForPin } from "./series.js";

/** Longer suffixes first so FFUC wins over FFC/FFU, WCAK over WC, etc. */
const UNIT_CLASS_SUFFIXES = [
  "WCAK",
  "FFUC",
  "FFUG",
  "FFC",
  "FFU",
  "WC",
  "WD",
  "WG",
];

export function normalise(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Trailing internal/external (etc.) class on a normalised chassis code, if any.
 * @param {string} normalised
 * @returns {string|null}
 */
export function unitClassOf(normalised) {
  const n = String(normalised || "");
  for (const suffix of UNIT_CLASS_SUFFIXES) {
    if (n.endsWith(suffix) && n.length > suffix.length) return suffix;
  }
  return null;
}

/**
 * Exact or soft chassis match. Conflicting unit classes never soft-match.
 * @param {string} keyNorm
 * @param {string} tagNorm
 */
export function seriesKeyMatchesTag(keyNorm, tagNorm) {
  if (!keyNorm || !tagNorm) return false;
  if (keyNorm === tagNorm) return true;

  const keyClass = unitClassOf(keyNorm);
  const tagClass = unitClassOf(tagNorm);
  if (keyClass && tagClass && keyClass !== tagClass) return false;

  // Soft containment for chassis aliases (VCM2837 ↔ REUVCM2837).
  const minLen = 5;
  if (keyNorm.length >= minLen && tagNorm.includes(keyNorm)) return true;
  if (tagNorm.length >= minLen && keyNorm.includes(tagNorm)) return true;
  return false;
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
 * PDF root for the current page protocol.
 * - http / Vite: `/data-sheets` (middleware maps to ./data-sheets)
 * - file:// from dist/index.html: `../data-sheets` (repo-root sibling of dist/)
 *
 * @param {object|null|undefined} config
 * @returns {string}
 */
export function resolveDocumentsRoot(config = null) {
  const httpRoot = String(
    config?.documents?.rootUrl || "/data-sheets"
  ).replace(/\/$/, "");
  const fileRoot = String(
    config?.documents?.fileRootUrl || "../data-sheets"
  ).replace(/\/$/, "");

  if (typeof location !== "undefined" && location.protocol === "file:") {
    return fileRoot;
  }
  return httpRoot;
}

/**
 * Build a browser URL for a document PDF.
 * Index paths look like `data-sheets/Rinnai Data Sheets/foo.pdf`.
 * Vite serves the gitignored `./data-sheets` folder at `/data-sheets`.
 *
 * Under file://, open via relative navigation (`../data-sheets/...`) — do not
 * fetch() PDF bytes (Chrome/Edge block local fetch without special flags).
 *
 * @param {object} doc
 * @param {object|null|undefined} config
 * @returns {string|null}
 */
export function resolveDocumentUrl(doc, config = null) {
  const rootUrl = resolveDocumentsRoot(config);
  let rel = String(doc?.path || "").replace(/\\/g, "/");
  if (!rel && doc?.fileName) {
    rel = doc.fileName;
  }
  if (!rel) return null;

  const prefix = String(
    config?.documents?.indexPathPrefix || "data-sheets/"
  ).replace(/\\/g, "/");
  if (rel.startsWith(prefix)) {
    rel = rel.slice(prefix.length);
  } else if (rel.startsWith("data-sheets/")) {
    rel = rel.slice("data-sheets/".length);
  }

  const parts = rel
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .map(encodeURIComponent);
  if (!parts.length) return null;
  return `${rootUrl}/${parts.join("/")}`;
}

/**
 * @param {object|null|undefined} documentIndex
 * @param {object|null|undefined} seriesDoc
 * @param {string} query
 * @param {{ kind?: string, series?: object|null, model?: object|null }|null} pin
 * @returns {Array<{ doc: object, score: number, matchedOn: string[], url: string|null }>}
 */
export function searchDocuments(
  documentIndex,
  seriesDoc,
  query,
  pin = null,
  config = null
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
      let hit = false;
      for (const k of seriesKeys) {
        if (seriesKeyMatchesTag(k, s)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        score += 80;
        matchedOn.push("series");
        break;
      }
    }

    // Filename: free-text query substring, or pin keys on the file name.
    if (nq && fileKey.includes(nq)) {
      score += 40;
      matchedOn.push("filename");
    } else if (!nq && hasPin) {
      for (const k of seriesKeys) {
        if (k.length >= 5 && seriesKeyMatchesTag(k, fileKey)) {
          score += 50;
          matchedOn.push("filename");
          break;
        }
        if (k.length >= 5 && fileKey.includes(k) && !unitClassConflict(k, fileKey)) {
          score += 50;
          matchedOn.push("filename");
          break;
        }
      }
    }

    if (!q && hasPin && score === 0) continue;
    if (q && score === 0) continue;

    if (score > 0) {
      results.push({
        doc,
        score,
        matchedOn: [...new Set(matchedOn)],
        url: resolveDocumentUrl(doc, config),
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.doc.fileName).localeCompare(String(b.doc.fileName));
  });
  return results;
}

function unitClassConflict(a, b) {
  const ca = unitClassOf(a);
  const cb = unitClassOf(b);
  return Boolean(ca && cb && ca !== cb);
}
