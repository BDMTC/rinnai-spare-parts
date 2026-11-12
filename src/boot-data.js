/**
 * Catalogue boot loader (http / Vite dev).
 * Relative fetch of public/data/*.json — works under http(s) and vite preview.
 * The file:// IIFE build swaps this module for boot-data.file.js via Vite alias.
 */

/** Resolve a public/ path against the page URL (no leading slash). */
export function publicUrl(relPath) {
  const cleaned = String(relPath || "").replace(/^\//, "");
  return new URL(cleaned, document.baseURI).href;
}

async function fetchJson(relPath) {
  const url = publicUrl(relPath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${relPath} (${res.status})`);
  return res.json();
}

/**
 * @returns {Promise<{
 *   catalogue: object,
 *   config: object,
 *   prices: object,
 *   series: object,
 *   trade: object,
 *   abbrevs: object,
 *   assemblyHierarchy: object,
 * }>}
 */
export async function loadBootData() {
  const [catalogue, config, prices, series, trade, abbrevs, assemblyHierarchy] =
    await Promise.all([
      fetchJson("data/catalogue.json"),
      fetchJson("data/config.json"),
      fetchJson("data/prices.json"),
      fetchJson("data/series-aliases.json"),
      fetchJson("data/trade-aliases.json").catch(() => ({ aliases: [] })),
      fetchJson("data/part-name-abbreviations.json").catch(() => ({
        groups: [],
      })),
      fetchJson("data/assembly-hierarchy.json").catch(() => ({
        assemblies: [],
        concepts: [],
      })),
    ]);

  return {
    catalogue,
    config,
    prices,
    series,
    trade,
    abbrevs,
    assemblyHierarchy,
  };
}
