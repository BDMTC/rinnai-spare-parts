/**
 * Exploded-diagram page images for the search-panel thumb + lightbox.
 * Seed + continuous-flow extensions from document-index ED/EDPL sheets on disk.
 * Also honours part.diagramRef.url / .path when set.
 */
import edNSeriesP1 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p1.jpg";
import edNSeriesP2 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p2.jpg";
import edNSeriesP3 from "./assets/diagram-pages/ed-n-series-2020-in32-enviro__p3.jpg";
import edplVrm2632wcP4 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p4.jpg";
import edplVrm2632wcP5 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p5.jpg";
import edplVrm2632wcP6 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p6.jpg";
import edplVrm2632wcP7 from "./assets/diagram-pages/edpl-reu-vrm2632wc__p7.jpg";
import edplVr2632ffugP4 from "./assets/diagram-pages/edpl-reu-vr2632ffug__p4.jpg";
import edplVr2632ffugP5 from "./assets/diagram-pages/edpl-reu-vr2632ffug__p5.jpg";
import edplVr2632ffugP6 from "./assets/diagram-pages/edpl-reu-vr2632ffug__p6.jpg";
import edplVr2632ffugP7 from "./assets/diagram-pages/edpl-reu-vr2632ffug__p7.jpg";
import edplV2632ffuFfucP4 from "./assets/diagram-pages/edpl-v2632ffu-ffuc__p4.jpg";
import edplV2632ffuFfucP5 from "./assets/diagram-pages/edpl-v2632ffu-ffuc__p5.jpg";
import edplV2632ffuFfucP6 from "./assets/diagram-pages/edpl-v2632ffu-ffuc__p6.jpg";
import edplV2632ffuFfucP7 from "./assets/diagram-pages/edpl-v2632ffu-ffuc__p7.jpg";
import edplInf26PlusP6 from "./assets/diagram-pages/edpl-reuv2630wd-inf26plus__p6.jpg";
import edplInf26PlusP7 from "./assets/diagram-pages/edpl-reuv2630wd-inf26plus__p7.jpg";
import edplInf26PlusP8 from "./assets/diagram-pages/edpl-reuv2630wd-inf26plus__p8.jpg";
import edplSmartstartP3 from "./assets/diagram-pages/edpl-smartstart__p3.jpg";
import edplSmartstartP4 from "./assets/diagram-pages/edpl-smartstart__p4.jpg";
import edplSmartstartP5 from "./assets/diagram-pages/edpl-smartstart__p5.jpg";
import edplVrVrm3237P4 from "./assets/diagram-pages/edpl-vr-vrm3237__p4.jpg";
import edplVrVrm3237P5 from "./assets/diagram-pages/edpl-vr-vrm3237__p5.jpg";
import edplVrVrm3237P6 from "./assets/diagram-pages/edpl-vr-vrm3237__p6.jpg";
import edplVrVrm3237P7 from "./assets/diagram-pages/edpl-vr-vrm3237__p7.jpg";
import pledNSeriesP6 from "./assets/diagram-pages/pled-infinity-32-enviro-plus-n-series-e__p6.jpg";
import pledNSeriesP7 from "./assets/diagram-pages/pled-infinity-32-enviro-plus-n-series-e__p7.jpg";
import pledNSeriesP8 from "./assets/diagram-pages/pled-infinity-32-enviro-plus-n-series-e__p8.jpg";
import pledNSeriesP9 from "./assets/diagram-pages/pled-infinity-32-enviro-plus-n-series-e__p9.jpg";

/** @type {Record<string, string>} */
const DIAGRAM_PAGE_URLS = {
  "ed-n-series-2020-in32-enviro__p1": edNSeriesP1,
  "ed-n-series-2020-in32-enviro__p2": edNSeriesP2,
  "ed-n-series-2020-in32-enviro__p3": edNSeriesP3,
  "edpl-reu-vrm2632wc__p4": edplVrm2632wcP4,
  "edpl-reu-vrm2632wc__p5": edplVrm2632wcP5,
  "edpl-reu-vrm2632wc__p6": edplVrm2632wcP6,
  "edpl-reu-vrm2632wc__p7": edplVrm2632wcP7,
  "edpl-reu-vr2632ffug__p4": edplVr2632ffugP4,
  "edpl-reu-vr2632ffug__p5": edplVr2632ffugP5,
  "edpl-reu-vr2632ffug__p6": edplVr2632ffugP6,
  "edpl-reu-vr2632ffug__p7": edplVr2632ffugP7,
  "edpl-v2632ffu-ffuc__p4": edplV2632ffuFfucP4,
  "edpl-v2632ffu-ffuc__p5": edplV2632ffuFfucP5,
  "edpl-v2632ffu-ffuc__p6": edplV2632ffuFfucP6,
  "edpl-v2632ffu-ffuc__p7": edplV2632ffuFfucP7,
  "edpl-reuv2630wd-inf26plus__p6": edplInf26PlusP6,
  "edpl-reuv2630wd-inf26plus__p7": edplInf26PlusP7,
  "edpl-reuv2630wd-inf26plus__p8": edplInf26PlusP8,
  "edpl-smartstart__p3": edplSmartstartP3,
  "edpl-smartstart__p4": edplSmartstartP4,
  "edpl-smartstart__p5": edplSmartstartP5,
  "edpl-vr-vrm3237__p4": edplVrVrm3237P4,
  "edpl-vr-vrm3237__p5": edplVrVrm3237P5,
  "edpl-vr-vrm3237__p6": edplVrVrm3237P6,
  "edpl-vr-vrm3237__p7": edplVrVrm3237P7,
  "pled-infinity-32-enviro-plus-n-series-e__p6": pledNSeriesP6,
  "pled-infinity-32-enviro-plus-n-series-e__p7": pledNSeriesP7,
  "pled-infinity-32-enviro-plus-n-series-e__p8": pledNSeriesP8,
  "pled-infinity-32-enviro-plus-n-series-e__p9": pledNSeriesP9,
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
  hd200i: {
    page: "EDPL REU-VR2632FFUG.pdf p5",
    label: "EDPL REU-VR2632FFUG (HD200i)",
  },
  "infinity26-internal": {
    page: "EDPL V2632FFU_FFUC.pdf p5",
    label: "EDPL V2632FFU_FFUC",
  },
  "infinity26-plus": {
    page: "EDPL REUV2630WD INF26Plus.pdf p6",
    label: "EDPL REUV2630WD INF26Plus",
  },
  "infinity26-smartstart": {
    page: "EDPL Smartstart.pdf p4",
    label: "EDPL Smartstart",
  },
  "infinity32-enviro": {
    page: "ED_N Series 2020 IN32 Enviro.pdf p1",
    label: "ED_N Series 2020 IN32 Enviro",
  },
  "infinity32-enviro-plus-n": {
    page: "ED_N Series 2020 IN32 Enviro.pdf p1",
    label: "ED_N Series 2020 IN32 Enviro",
  },
  hd210e: {
    page: "ED_N Series 2020 IN32 Enviro.pdf p1",
    label: "ED_N Series 2020 IN32 Enviro (HD210e)",
  },
  hd210i: {
    page: "ED_N Series 2020 IN32 Enviro.pdf p1",
    label: "ED_N Series 2020 IN32 Enviro (HD210i)",
  },
  hd250e: {
    page: "EDPL VR_VRM3237.pdf p5",
    label: "EDPL VR_VRM3237 (HD250e)",
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
 * Sibling ED pages for the same sheet (multi-page lightbox).
 * @param {string|null|undefined} pageKeyOrLabel
 * @returns {{ page: number, url: string, pageKey: string }[]}
 */
export function diagramPageSiblings(pageKeyOrLabel) {
  const key =
    diagramPageKey(pageKeyOrLabel) ||
    (pageKeyOrLabel && DIAGRAM_PAGE_URLS[String(pageKeyOrLabel).trim()]
      ? String(pageKeyOrLabel).trim()
      : null);
  if (!key) return [];
  const stemMatch = String(key).match(/^(.*)__p(\d+)$/i);
  if (!stemMatch) {
    const url = DIAGRAM_PAGE_URLS[key];
    return url ? [{ page: 1, url, pageKey: key }] : [];
  }
  const stem = stemMatch[1];
  /** @type {{ page: number, url: string, pageKey: string }[]} */
  const pages = [];
  for (const [k, url] of Object.entries(DIAGRAM_PAGE_URLS)) {
    const m = k.match(new RegExp(`^${escapeRegExp(stem)}__p(\\d+)$`, "i"));
    if (!m) continue;
    pages.push({ page: Number(m[1]), url, pageKey: k });
  }
  pages.sort((a, b) => a.page - b.page);
  return pages;
}

/**
 * Source PDF file name for an ED page key/label (for Download).
 * @param {string|null|undefined} pageKeyOrLabel
 * @returns {string|null}
 */
export function diagramPdfFileName(pageKeyOrLabel) {
  const key =
    diagramPageKey(pageKeyOrLabel) ||
    (pageKeyOrLabel ? String(pageKeyOrLabel).trim() : "");
  if (!key) return null;
  const stem = String(key).replace(/__p\d+$/i, "");
  return ED_STEM_TO_PDF[stem] || inferPdfFromLabel(pageKeyOrLabel);
}

/** @type {Record<string, string>} */
const ED_STEM_TO_PDF = {
  "ed-n-series-2020-in32-enviro": "ED_N Series 2020 IN32 Enviro.pdf",
  "edpl-reu-vrm2632wc": "EDPL REU-VRM2632WC.pdf",
  "edpl-reu-vr2632ffug": "EDPL REU-VR2632FFUG.pdf",
  "edpl-v2632ffu-ffuc": "EDPL V2632FFU_FFUC.pdf",
  "edpl-reuv2630wd-inf26plus": "EDPL REUV2630WD INF26Plus.pdf",
  "edpl-smartstart": "EDPL Smartstart.pdf",
  "edpl-vr-vrm3237": "EDPL VR_VRM3237.pdf",
  "pled-infinity-32-enviro-plus-n-series-e":
    "PLED_Infinity-32-Enviro-Plus-N-Series-e.pdf",
};

/**
 * @param {string|null|undefined} label
 * @returns {string|null}
 */
function inferPdfFromLabel(label) {
  const raw = String(label || "").trim();
  const m = raw.match(/^(.+?\.pdf)\b/i);
  return m ? m[1] : null;
}

/**
 * @param {string} text
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {{ page: string, callout?: string|null, label?: string }} hit
 * @returns {{ url: string, label: string, callout: string|null, pageKey: string|null }|null}
 */
function toDiagramResult(hit) {
  if (!hit?.page) return null;
  const url = diagramPageUrl(hit.page);
  if (!url) return null;
  const pageKey = diagramPageKey(hit.page);
  const pages = diagramPageSiblings(pageKey || hit.page);
  const pageIndex = Math.max(
    0,
    pages.findIndex((p) => p.pageKey === pageKey)
  );
  return {
    url,
    label: String(hit.label || hit.page),
    callout: hit.callout != null ? String(hit.callout) : null,
    pageKey,
    pages: pages.length
      ? pages
      : pageKey
        ? [{ page: 1, url, pageKey }]
        : [{ page: 1, url, pageKey: "ed" }],
    pageIndex: pages.length ? pageIndex : 0,
    pdfFileName: diagramPdfFileName(pageKey || hit.page),
    calloutPageKey: pageKey,
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
 * @returns {{ url: string, label: string, callout: string|null, pageKey: string|null, kind: 'ed' }|null}
 */
export function resolvePartDiagram(part, assemblyIndex, opts = {}) {
  if (!part) return null;

  const ref = part.diagramRef || {};
  const refUrl = ref.url || ref.path || null;
  if (refUrl) {
    const hit = toDiagramResult({
      page: refUrl,
      label: ref.label || part.sheet || part.code || "Exploded diagram",
      callout: ref.callout,
    });
    if (hit) return { kind: "ed", ...hit };
    const url = diagramPageUrl(refUrl) || String(refUrl);
    if (url) {
      const pageKey = diagramPageKey(refUrl) || diagramPageKey(ref.label) || null;
      return {
        kind: "ed",
        url,
        label: String(ref.label || part.sheet || part.code || "Exploded diagram"),
        callout: ref.callout != null ? String(ref.callout) : null,
        pageKey,
        pages: [{ page: 1, url, pageKey: pageKey || "ed" }],
        pageIndex: 0,
        pdfFileName: diagramPdfFileName(pageKey || ref.label || refUrl),
        calloutPageKey: pageKey,
      };
    }
  }

  const code = String(part.code || "").trim();
  if (code && PART_DIAGRAM_PAGES[code]) {
    const hit = toDiagramResult(PART_DIAGRAM_PAGES[code]);
    if (hit) return { kind: "ed", ...hit };
  }

  if (code && assemblyIndex) {
    const parent = assemblyIndex.parentByCode?.get(code);
    if (parent?.diagramPage) {
      const hit = toDiagramResult({
        page: parent.diagramPage,
        label: parent.diagramPage,
        callout: Array.isArray(parent.parentItemNos)
          ? parent.parentItemNos[0] || null
          : null,
      });
      if (hit) return { kind: "ed", ...hit };
    }

    const child = assemblyIndex.childByCode?.get(code);
    if (child) {
      const parents = child.parents || [];
      for (const p of parents) {
        const parentRec = assemblyIndex.parentByCode?.get(p.parentCode);
        const page = parentRec?.diagramPage || p.diagramPage;
        if (!page) continue;
        const hit = toDiagramResult({
          page,
          label: page,
          callout: child.itemNo != null ? String(child.itemNo) : null,
        });
        if (hit) return { kind: "ed", ...hit };
      }
    }
  }

  const pinHit = diagramFromPin(opts.pin || null);
  if (pinHit) {
    const hit = toDiagramResult(pinHit);
    if (hit) return { kind: "ed", ...hit };
  }

  return null;
}
