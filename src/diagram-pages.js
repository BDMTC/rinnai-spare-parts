/**
 * Exploded-diagram page images for the search-panel thumb + lightbox.
 * Seed: ED_N Series 2020 IN32 Enviro.pdf p1–p3 (assembly-hierarchy diagramPage).
 * Also honours part.diagramRef.url / .path when set.
 */
import edNSeriesP1 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p1.jpg";
import edNSeriesP2 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p2.jpg";
import edNSeriesP3 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p3.jpg";

/** @type {Record<string, string>} */
const DIAGRAM_PAGE_URLS = {
  "ed-n-series-2020-in32-enviro__p1": edNSeriesP1,
  "ed-n-series-2020-in32-enviro__p2": edNSeriesP2,
  "ed-n-series-2020-in32-enviro__p3": edNSeriesP3,
};

/**
 * Normalise "ED_N Series 2020 IN32 Enviro.pdf p3" → asset key.
 * @param {string|null|undefined} diagramPage
 * @returns {string|null}
 */
export function diagramPageKey(diagramPage) {
  const raw = String(diagramPage || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(.+?)\s+p(\d+)\s*$/i);
  if (!m) {
    const slug = slugifyDiagramStem(raw);
    return slug || null;
  }
  const stem = slugifyDiagramStem(m[1].replace(/\.pdf$/i, ""));
  if (!stem) return null;
  return `${stem}__p${m[2]}`;
}

/**
 * @param {string} stem
 */
function slugifyDiagramStem(stem) {
  return String(stem || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * @param {string|null|undefined} keyOrPage
 * @returns {string|null}
 */
export function diagramPageUrl(keyOrPage) {
  if (!keyOrPage) return null;
  const asKey = String(keyOrPage).trim();
  if (DIAGRAM_PAGE_URLS[asKey]) return DIAGRAM_PAGE_URLS[asKey];
  const key = diagramPageKey(asKey);
  if (key && DIAGRAM_PAGE_URLS[key]) return DIAGRAM_PAGE_URLS[key];
  // Bare relative/path already a URL (http or data or ./assets)
  if (/^(?:https?:|data:|\.\/|\/)/i.test(asKey)) return asKey;
  return null;
}

/**
 * Resolve the best diagram page image for a part (Primary hit).
 * Prefer explicit diagramRef, then assembly hierarchy diagramPage.
 *
 * @param {object|null|undefined} part
 * @param {object|null|undefined} assemblyIndex  from buildAssemblyIndex
 * @returns {{ url: string, label: string, callout: string|null }|null}
 */
export function resolvePartDiagram(part, assemblyIndex) {
  if (!part) return null;

  const ref = part.diagramRef || {};
  const refUrl = ref.url || ref.path || null;
  if (refUrl) {
    const url = diagramPageUrl(refUrl) || String(refUrl);
    if (url) {
      return {
        url,
        label: String(ref.label || part.sheet || part.code || "Exploded diagram"),
        callout: ref.callout != null ? String(ref.callout) : null,
      };
    }
  }

  const code = String(part.code || "").trim();
  if (!code || !assemblyIndex) return null;

  const parent = assemblyIndex.parentByCode?.get(code);
  if (parent?.diagramPage) {
    const url = diagramPageUrl(parent.diagramPage);
    if (url) {
      return {
        url,
        label: String(parent.diagramPage),
        callout: Array.isArray(parent.parentItemNos)
          ? parent.parentItemNos[0] || null
          : null,
      };
    }
  }

  const child = assemblyIndex.childByCode?.get(code);
  if (child) {
    const parents = child.parents || [];
    for (const p of parents) {
      const parentRec =
        assemblyIndex.parentByCode?.get(p.parentCode) ||
        (p.diagramPage ? p : null);
      const page = parentRec?.diagramPage || p.diagramPage;
      if (!page) continue;
      const url = diagramPageUrl(page);
      if (url) {
        return {
          url,
          label: String(page),
          callout: child.itemNo != null ? String(child.itemNo) : null,
        };
      }
    }
  }

  return null;
}
