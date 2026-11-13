/**
 * Exploded-diagram page images for the search-panel thumb + lightbox.
 * Seed + continuous-flow extensions from document-index ED/EDPL sheets on disk.
 * Also honours part.diagramRef.url / .path when set.
 *
 * Part → page + callout bulk map: public/data/edpl-part-map.json
 * (PDF text extract; chassis-scoped). Highlight boxes are separate / optional.
 */
import edplPartMap from "../public/data/edpl-part-map.json";

/** Eager URL map for every rendered ED page JPEG under assets/diagram-pages. */
const pageModules = import.meta.glob("./assets/diagram-pages/*.jpg", {
  eager: true,
  import: "default",
});

/** @type {Record<string, string>} */
const DIAGRAM_PAGE_URLS = {};
for (const [modPath, url] of Object.entries(pageModules)) {
  const base = String(modPath).split("/").pop() || "";
  const key = base.replace(/\.jpg$/i, "").toLowerCase();
  if (key) DIAGRAM_PAGE_URLS[key] = url;
}

/**
 * Legacy hardmap (kept as last-chance override before series default).
 * Prefer edpl-part-map.json for catalogue coverage.
 * @type {Record<string, { page: string, callout?: string }>}
 */
const PART_DIAGRAM_PAGES = {
  "92093550": {
    page: "EDPL REU-VRM2632WC.pdf p5",
    callout: "140",
  },
};

/**
 * Pin1 series id → default / common ED page when the primary hit has no
 * assembly/diagramRef / edpl-part-map mapping yet.
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
    page: "PL & ED INF26 Smartstart VR2626WGP.pdf p1",
    label: "PL & ED INF26 Smartstart VR2626WGP",
  },
  infinity26: {
    page: "New A Series CF Parts List.pdf p56",
    label: "New A Series CF Parts List (Infinity 26)",
  },
  "infinity-a": {
    page: "HW_CF_A_Series_Parts_List_Issue_1_Jan_2018.pdf p1",
    label: "HW CF A Series Parts List Issue 1 (Infinity A)",
  },
  vr2426: {
    page: "EDPL VR2426_VR2626.pdf p1",
    label: "EDPL VR2426_VR2626 (B24)",
  },
  "infinity16-v": {
    page: "EDPL REUV1620WG.pdf p1",
    label: "EDPL REUV1620WG (Infinity 16 V)",
  },
  "infinity20-v": {
    page: "EDPL REUV2024WG.pdf p1",
    label: "EDPL REUV2024WG (Infinity 20 V)",
  },
  "infinity-v1616": {
    page: "EDPL V1616W_2018W_2020W.pdf p1",
    label: "EDPL V1616W_2018W_2020W",
  },
  v3232: {
    page: "EDPL V3232W_WC.pdf p1",
    label: "EDPL V3232W_WC",
  },
  v2626: {
    page: "EDPL REUV2626W_REUV2632WC.pdf p1",
    label: "EDPL REUV2626W_REUV2632WC (V2626)",
  },
  smartstart: {
    page: "EDPL Smartstart.pdf p1",
    label: "EDPL Smartstart (CUG1)",
  },
  hd32: {
    page: "New A Series CF Parts List.pdf p56",
    label: "New A Series CF Parts List (HD32e)",
  },
  "infinity32-enviro": {
    page: "PL - RINNAI - EDPL INF32 ENVIRO KM3237WD - ISSUE 4 - JUNE 2025.pdf p1",
    label: "EDPL INF32 ENVIRO KM3237WD Issue 4",
  },
  "infinity32-enviro-plus-n": {
    page: "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf p1",
    label: "N3237 Infinity 32 Enviro Plus N Issue 3",
  },
  hd210e: {
    page: "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf p1",
    label: "N3237 Infinity 32 Enviro Plus N Issue 3 (HD210e)",
  },
  hd210i: {
    page: "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf p1",
    label: "N3237 Infinity 32 Enviro Plus N Issue 3 (HD210i)",
  },
  hd250e: {
    page: "EDPL VR_VRM3237.pdf p5",
    label: "EDPL VR_VRM3237 (HD250e)",
  },
  infinity32: {
    page: "EDPL VR_VRM3237.pdf p1",
    label: "EDPL VR_VRM3237 (Infinity 32)",
  },
  v3237: {
    page: "EDPL REUV3237.pdf p1",
    label: "EDPL REUV3237 (V3237)",
  },
  ehfa160: {
    page: "Hotflo EHFA160 Spare Parts List S111418B.pdf p1",
    label: "Hotflo EHFA160 spare parts",
  },
  ehfa250: {
    page: "EHFA  SPARE PARTS.pdf p1",
    label: "Hotflo EHFA spare parts (250)",
  },
  ehfa315: {
    page: "EHFA  SPARE PARTS.pdf p1",
    label: "Hotflo EHFA spare parts (315)",
  },
  hd28e: {
    page: "Parts List REU-VCM2837 WC External.pdf p5",
    label: "Parts List REU-VCM2837 WC External (HD28e)",
  },
  "infinity-b": {
    page: "PL - RINNAI - 2025 BM SERIES - INFINITY B - ISSUE 1 - AUG 2025.pdf p1",
    label: "2025 BM Series Infinity B Issue 1",
  },
  envirosmart: {
    page: "EDPL REU-K2430WG.pdf p1",
    label: "EDPL REU-K2430WG (EnviroSmart)",
  },
  infinity16: {
    page: "EDPL VR1620.pdf p1",
    label: "EDPL VR1620 (Infinity 16)",
  },
  infinity20: {
    page: "EDPL VR2024.pdf p1",
    label: "EDPL VR2024 (Infinity 20)",
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
  // Already a page asset key (e.g. edpl-reu-vrm2632wc__p5) — do not re-slugify
  // or "__p5" becomes "-p5" and sibling/PDF lookup breaks.
  if (/^[a-z0-9-]+__p\d+$/i.test(raw)) return raw.toLowerCase();
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
  const raw = pageKeyOrLabel ? String(pageKeyOrLabel).trim() : "";
  // Prefer an exact DIAGRAM_PAGE_URLS key before diagramPageKey slugify.
  const key =
    (raw && DIAGRAM_PAGE_URLS[raw] ? raw : null) ||
    diagramPageKey(pageKeyOrLabel) ||
    null;
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
  const raw = pageKeyOrLabel ? String(pageKeyOrLabel).trim() : "";
  if (!raw) return null;
  const fromLabel = inferPdfFromLabel(raw);
  if (fromLabel) return fromLabel;
  const key = diagramPageKey(raw) || "";
  if (!key) return null;
  const stem = String(key).replace(/__p\d+$/i, "");
  if (ED_STEM_TO_PDF[stem]) return ED_STEM_TO_PDF[stem];
  // Fall back to edpl-part-map sheet registry
  const sheets = edplPartMap?.sheets || [];
  for (const s of sheets) {
    if (s?.stem === stem && s?.file) return s.file;
  }
  return null;
}

/** @type {Record<string, string>} */
const ED_STEM_TO_PDF = {
  "ed-n-series-2020-in32-enviro": "ED_N Series 2020 IN32 Enviro.pdf",
  "edpl-reu-vrm2632wc": "EDPL REU-VRM2632WC.pdf",
  "edpl-reu-vr2632ffug": "EDPL REU-VR2632FFUG.pdf",
  "edpl-v2632ffu-ffuc": "EDPL V2632FFU_FFUC.pdf",
  "edpl-reuv2630wd-inf26plus": "EDPL REUV2630WD INF26Plus.pdf",
  "edpl-vrm2630": "EDPL VRM2630.pdf",
  "edpl-smartstart": "EDPL Smartstart.pdf",
  "pl-ed-inf26-smartstart-vr2626wgp":
    "PL & ED INF26 Smartstart VR2626WGP.pdf",
  "pl-new-a-series-cf": "New A Series CF Parts List.pdf",
  "edpl-inf32-enviro-km3237wd-issue4":
    "PL - RINNAI - EDPL INF32 ENVIRO KM3237WD - ISSUE 4 - JUNE 2025.pdf",
  "edpl-enviro-km2635wd-issue4":
    "PL - RINNAI - ENVIRO KM2635WD - ISSUE 04 - JUNE 2025.pdf",
  "pl-n3237-inf32-enviro-plus-issue3":
    "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf",
  "edpl-vr-vrm3237": "EDPL VR_VRM3237.pdf",
  "edpl-vr2426-vr2626": "EDPL VR2426_VR2626.pdf",
  "edpl-reuv2426wg": "EDPL REUV2426WG.pdf",
  "edpl-reuv2626wg": "EDPL REUV2626WG.pdf",
  "edpl-reuv2626w-reuv2632wc": "EDPL REUV2626W_REUV2632WC.pdf",
  "edpl-reuv2632ffu": "EDPL REUV2632FFU.pdf",
  "edpl-reuv2632ffuc": "EDPL REUV2632FFUC.pdf",
  "edpl-vrm2632ffu": "EDPL VRM2632FFU.pdf",
  "edpl-vrm2632ffu-issue4":
    "PL - RINNAI - EDPL VRM2632FFU - ISSUE 4 - JUNE 2025.pdf",
  "edpl-vm3237wc": "EDPL VM3237WC.pdf",
  "edpl-reuvm3237wc": "EDPL REUVM3237WC.pdf",
  "edpl-reuv3237": "EDPL REUV3237.pdf",
  "pl-reu-v3237wg": "REU-V3237WG Parts List.pdf",
  "edpl-hd250e-reuvrm3237wc-issue4":
    "PL - RINNAI - EDPL HD250E REUVRM3237WC - ISSUE 4 - FEB 2025.pdf",
  "edpl-vrm3237-issue4": "PL - RINNAI - EDPLVRM3237 - ISSUE 4 - JUNE 2025.pdf",
  "pl-hw-cf-a-series-issue1":
    "HW_CF_A_Series_Parts_List_Issue_1_Jan_2018.pdf",
  "pl-rinnai-2025-bm-series-infinity-b":
    "PL - RINNAI - 2025 BM SERIES - INFINITY B - ISSUE 1 - AUG 2025.pdf",
  "edpl-reu-k2430wg": "EDPL REU-K2430WG.pdf",
  "edpl-vr1620": "EDPL VR1620.pdf",
  "edpl-vr2024": "EDPL VR2024.pdf",
  "edpl-b24": "EDPL B24.pdf",
  "edpl-b16": "EDPL B16.pdf",
  "edpl-2425w": "EDPL 2425W.pdf",
  "edpl-v3232w-wc": "EDPL V3232W_WC.pdf",
  "edpl-v1616wf": "EDPL V1616WF.pdf",
  "edpl-v1616w-2018w-2020w": "EDPL V1616W_2018W_2020W.pdf",
  "edpl-reuv1620wg": "EDPL REUV1620WG.pdf",
  "edpl-reuv2024wg": "EDPL REUV2024WG.pdf",
  "edpl-reuv1620w": "EDPL REUV1620W.pdf",
  "edpl-reu-vrm2024": "REU-VRM2024.pdf",
  "pled-infinity-32-enviro-plus-n-series-e":
    "PLED_Infinity-32-Enviro-Plus-N-Series-e.pdf",
  "pl-reu-vcm2837-wc-external": "Parts List REU-VCM2837 WC External.pdf",
  "pl-hotflo-ehfa160": "Hotflo EHFA160 Spare Parts List S111418B.pdf",
  "pl-hotflo-ehfa-spare-parts": "EHFA  SPARE PARTS.pdf",
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
 * Merge unique page siblings from one or more pack seeds (PL + ED stems).
 * @param {...(string|null|undefined)} seeds
 * @returns {{ page: number, url: string, pageKey: string }[]}
 */
function mergeDiagramPageSiblings(...seeds) {
  /** @type {Map<string, { page: number, url: string, pageKey: string }>} */
  const byKey = new Map();
  for (const seed of seeds) {
    if (!seed) continue;
    for (const p of diagramPageSiblings(seed)) {
      if (!byKey.has(p.pageKey)) byKey.set(p.pageKey, p);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const stemA = a.pageKey.replace(/__p\d+$/i, "");
    const stemB = b.pageKey.replace(/__p\d+$/i, "");
    if (stemA !== stemB) return stemA.localeCompare(stemB);
    return a.page - b.page;
  });
}

/**
 * @param {{
 *   page: string,
 *   callout?: string|null,
 *   label?: string,
 *   listPage?: number|null,
 *   listPageKey?: string|null,
 *   listBox?: { x: number, y: number, w: number, h: number }|null,
 *   pdf?: string|null,
 * }} hit
 * @returns {{
 *   url: string,
 *   label: string,
 *   callout: string|null,
 *   pageKey: string|null,
 *   listPageKey?: string|null,
 *   listBox?: { x: number, y: number, w: number, h: number }|null,
 *   pages: { page: number, url: string, pageKey: string }[],
 *   pageIndex: number,
 *   pdfFileName: string|null,
 *   calloutPageKey: string|null,
 * }|null}
 */
function toDiagramResult(hit) {
  if (!hit?.page) return null;
  const url = diagramPageUrl(hit.page) || diagramPageUrl(hit.pageKey);
  if (!url) return null;
  const pageKey =
    diagramPageKey(hit.pageKey) || diagramPageKey(hit.page) || null;
  const listPageKey = hit.listPageKey
    ? diagramPageKey(hit.listPageKey) || String(hit.listPageKey)
    : null;
  const listUrl = listPageKey ? diagramPageUrl(listPageKey) : null;
  const listBox =
    listUrl && hit.listBox && Number.isFinite(Number(hit.listBox.x))
      ? {
          x: Number(hit.listBox.x),
          y: Number(hit.listBox.y),
          w: Number(hit.listBox.w),
          h: Number(hit.listBox.h),
        }
      : null;
  const pages = mergeDiagramPageSiblings(pageKey || hit.page, listPageKey);
  const pageIndex = Math.max(
    0,
    pages.findIndex((p) => p.pageKey === pageKey)
  );
  return {
    url,
    label: String(hit.label || hit.page),
    callout: hit.callout != null ? String(hit.callout) : null,
    pageKey,
    listPageKey: listBox ? listPageKey : null,
    listBox,
    pages: pages.length
      ? pages
      : pageKey
        ? [{ page: 1, url, pageKey }]
        : [{ page: 1, url, pageKey: "ed" }],
    pageIndex: pages.length ? pageIndex : 0,
    pdfFileName:
      diagramPdfFileName(pageKey || hit.page) ||
      (hit.pdf ? String(hit.pdf) : null) ||
      diagramPdfFileName(listPageKey),
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
 * Normalise chassis / series tokens for matching.
 * @param {string} text
 */
function normToken(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Pin context tokens for chassis-scoped EDPL pick.
 * @param {object|null|undefined} pin
 */
function pinMatchContext(pin) {
  if (!pin || pin.kind === "none") {
    return { seriesId: "", tokens: [] };
  }
  const seriesId = pin.series?.id ? String(pin.series.id).toLowerCase() : "";
  const tokens = [
    seriesId,
    pin.series?.label,
    ...(pin.series?.documentKeys || []),
    ...(pin.series?.aliases || []),
    pin.model?.itemNumber,
    pin.model?.sku,
    pin.model?.id,
  ]
    .filter(Boolean)
    .map(normToken)
    .filter(Boolean);
  return { seriesId, tokens };
}

/**
 * @param {{ seriesIds?: string[] }|null|undefined} edplHit
 */
function seriesDefaultForHit(edplHit) {
  for (const id of edplHit?.seriesIds || []) {
    const key = String(id || "").toLowerCase();
    if (key && SERIES_DIAGRAM_DEFAULT[key]) return SERIES_DIAGRAM_DEFAULT[key];
  }
  return null;
}

/**
 * @param {object} hit  raw edpl-part-map hit
 */
function toPickResult(hit) {
  return {
    page: hit.pageKey || hit.page,
    pageKey: hit.pageKey,
    callout: hit.callout,
    label: hit.page || hit.pdf,
    seriesIds: hit.seriesIds || [],
    listPage: hit.listPage ?? null,
    listPageKey: hit.listPageKey || null,
    listBox: hit.listBox || null,
    pdf: hit.pdf || hit.listPdf || null,
  };
}

/**
 * Pick chassis-scoped EDPL hit for a part code.
 * @param {string} code
 * @param {object|null|undefined} pin
 * @returns {{
 *   page: string,
 *   pageKey?: string,
 *   callout?: string,
 *   label?: string,
 *   seriesIds?: string[],
 *   listPage?: number|null,
 *   listPageKey?: string|null,
 *   listBox?: object|null,
 *   pdf?: string|null,
 * }|null}
 */
export function pickEdplPartHit(code, pin) {
  const raw = String(code || "").trim();
  if (!raw) return null;
  const hits = edplPartMap?.parts?.[raw];
  if (!Array.isArray(hits) || !hits.length) return null;

  const { seriesId, tokens } = pinMatchContext(pin);
  if (seriesId || tokens.length) {
    for (const hit of hits) {
      const seriesIds = (hit.seriesIds || []).map((s) => String(s).toLowerCase());
      if (seriesId && seriesIds.includes(seriesId)) {
        return toPickResult(hit);
      }
    }
    for (const hit of hits) {
      const chassis = (hit.chassisTokens || []).map(normToken);
      if (
        chassis.some((c) =>
          tokens.some((t) => t.includes(c) || c.includes(t))
        )
      ) {
        return toPickResult(hit);
      }
    }
  }

  // No pin / no chassis match → highest-priority hit (extract order)
  return toPickResult(hits[0]);
}

/**
 * Resolve the best diagram page image for a part (Primary hit).
 * Prefer explicit diagramRef, then edpl-part-map (chassis-scoped), known hardmap,
 * assembly hierarchy, then dual-pin chassis → common ED fallback.
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
  const edplHit = pickEdplPartHit(code, opts.pin || null);
  if (edplHit) {
    const hit = toDiagramResult(edplHit);
    if (hit) return { kind: "ed", ...hit };
    // Map has callout/page label but no rendered JPEG for that stem — keep
    // callout and fall back to series/existing page packs image (Beau B).
    const fallbackPage =
      diagramFromPin(opts.pin || null) ||
      seriesDefaultForHit(edplHit) ||
      null;
    if (fallbackPage) {
      const fb = toDiagramResult({
        page: fallbackPage.page,
        label: edplHit.label || fallbackPage.label || fallbackPage.page,
        callout: edplHit.callout,
        listPage: edplHit.listPage,
        listPageKey: edplHit.listPageKey,
        listBox: edplHit.listBox,
        pdf: edplHit.pdf,
      });
      if (fb) return { kind: "ed", ...fb };
    }
  }

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

/** Coverage helpers for reports / smoke. */
export function edplPartMapTotals() {
  return edplPartMap?.totals || null;
}

export function edplMappedCodeCount() {
  return Object.keys(edplPartMap?.parts || {}).length;
}
