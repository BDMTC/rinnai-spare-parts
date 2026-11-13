/**
 * Exploded-diagram page images for the search-panel thumb + lightbox.
 * Seed pages:
 * - ED_N Series 2020 IN32 Enviro.pdf p1–p3 (assembly-hierarchy / HD210 / N3237)
 * - EDPL REU-VRM2632WC.pdf p4–p7 (HD200e / VRM2632WC common ED)
 * Also honours part.diagramRef.url / .path when set.
 */
import edNSeriesP1 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p1.jpg";
import edNSeriesP2 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p2.jpg";
import edNSeriesP3 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p3.jpg";
import edplVrm2632wcP4 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p4.jpg";
import edplVrm2632wcP5 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p5.jpg";
import edplVrm2632wcP6 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p6.jpg";
import edplVrm2632wcP7 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p7.jpg";

/** @type {Record<string, string>} */
const DIAGRAM_PAGE_URLS = {
  "ed-n-series-2020-in32-enviro__p1": edNSeriesP1,
  "ed-n-series-2020-in32-enviro__p2": edNSeriesP2,
  "ed-n-series-2020-in32-enviro__p3": edNSeriesP3,
  "edpl-reu-vrm2632wc__p4": edplVrm2632wcP4,
  "edpl-reu-vrm2632wc__p5": edplVrm2632wcP5,
  "edpl-reu-vrm2632wc__p6": edplVrm2632wcP6,
  "edpl-reu-vrm2632wc__p7": edplVrm2632wcP7,
};

/**
 * Known part code → ED page (from chassis EDPL parts list / callouts).
 * @type {Record<string, { page: string, callout?: string }>}
 */
const PART_DIAGRAM_PAGES = {
  // HD200e / REU-VRM2632WC — HEX is callout 140 on ED page 5
  "92093550": {
    page: "EDPL REU-VRM2632WC.pdf p5",
    callout: "140",
  },
};

/**
 * Pin1 series id → default / common ED page when the primary hit has no
 * assembly/diagramRef mapping yet.
 * @type {Record<string, { page: string, label?: string }>}
 */
const SERIES_DIAGRAM_DEFAULT = {
  hd200e: {
    page: "EDPL REU-VRM2632WC.pdf p5",
    label: "EDPL REU-VRM2632WC (HD200e)",
  },
};

/** Chassis tokens that imply the VRM2632WC common ED. */
const VRM2632WC_TOKENS = [
  "VRM2632WC",
  "REUVRM2632WC",
  "REU-VRM2632WC",
  "HD200E",
  "HD200e",
];

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
 * @param {{ page: string, callout?: string|null, label?: string }} hit
 * @returns {{ url: string, label: string, callout: string|null }|null}
 */
function toDiagramResult(hit) {
  if (!hit?.page) return null;
  const url = diagramPageUrl(hit.page);
  if (!url) return null;
  return {
    url,
    label: String(hit.label || hit.page),
    callout: hit.callout != null ? String(hit.callout) : null,
  };
}

/**
 * @param {object|null|undefined} pin  resolveModelPin result
 * @returns {{ page: string, label?: string }|null}
 */
function diagramFromPin(pin) {
  if (!pin || pin.kind === "none") return null;
  const seriesId = pin.series?.id ? String(pin.series.id).toLowerCase() : "";
  if (seriesId && SERIES_DIAGRAM_DEFAULT[seriesId]) {
    return SERIES_DIAGRAM_DEFAULT[seriesId];
  }

  const hay = [
    pin.series?.id,
    pin.series?.label,
    ...(pin.series?.documentKeys || []),
    ...(pin.series?.aliases || []),
    pin.model?.itemNumber,
    pin.model?.sku,
    pin.model?.id,
  ]
    .filter(Boolean)
    .map((s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, ""));

  for (const token of VRM2632WC_TOKENS) {
    const n = String(token).toUpperCase().replace(/[^A-Z0-9]+/g, "");
    if (hay.some((h) => h.includes(n) || n.includes(h))) {
      return SERIES_DIAGRAM_DEFAULT.hd200e;
    }
  }
  return null;
}

/**
 * Resolve the best diagram page image for a part (Primary hit).
 * Prefer explicit diagramRef, then known part pages, assembly hierarchy,
 * then dual-pin chassis → common ED fallback.
 *
 * @param {object|null|undefined} part
 * @param {object|null|undefined} assemblyIndex  from buildAssemblyIndex
 * @param {{ pin?: object|null }} [opts]
 * @returns {{ url: string, label: string, callout: string|null }|null}
 */
export function resolvePartDiagram(part, assemblyIndex, opts = {}) {
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
  if (code && PART_DIAGRAM_PAGES[code]) {
    const hit = toDiagramResult(PART_DIAGRAM_PAGES[code]);
    if (hit) return hit;
  }

  if (code && assemblyIndex) {
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
        const parentRec = assemblyIndex.parentByCode?.get(p.parentCode);
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
  }

  const pinHit = diagramFromPin(opts.pin || null);
  if (pinHit) {
    return toDiagramResult(pinHit);
  }

  return null;
}
