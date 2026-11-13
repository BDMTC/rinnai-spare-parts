/**
 * Pin1 series → service-manual cover (thumb) + full page set for lightbox.
 * Vite-bundled JPGs — file:// safe. Shared packs when series share an SM PDF.
 */
import hd200e from "./assets/service-manual-pages/hd200e__p1.jpg";
import hd200i from "./assets/service-manual-pages/hd200i__p1.jpg";
import infinity26 from "./assets/service-manual-pages/infinity26__p1.jpg";
import infinity26Internal from "./assets/service-manual-pages/infinity26-internal__p1.jpg";
import infinity26Plus from "./assets/service-manual-pages/infinity26-plus__p1.jpg";
import infinity26Smartstart from "./assets/service-manual-pages/infinity26-smartstart__p1.jpg";
import infinity32Enviro from "./assets/service-manual-pages/infinity32-enviro__p1.jpg";
import infinity32EnviroPlusN from "./assets/service-manual-pages/infinity32-enviro-plus-n__p1.jpg";
import hd210e from "./assets/service-manual-pages/hd210e__p1.jpg";
import hd210i from "./assets/service-manual-pages/hd210i__p1.jpg";
import hd250e from "./assets/service-manual-pages/hd250e__p1.jpg";

/** @type {Record<string, Record<string, string>>} */
const SM_PACK_GLOBS = {
  "sm-vrm2632wc": import.meta.glob(
    "./assets/service-manual-pages/sm-vrm2632wc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vr2632ffug-vrm2632ffuc": import.meta.glob(
    "./assets/service-manual-pages/sm-vr2632ffug-vrm2632ffuc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-inf26-inf32-enviro-wh-190810": import.meta.glob(
    "./assets/service-manual-pages/sm-inf26-inf32-enviro-wh-190810__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-smartstart": import.meta.glob(
    "./assets/service-manual-pages/sm-smartstart__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vr3237wg-wc": import.meta.glob(
    "./assets/service-manual-pages/sm-vr3237wg-wc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-new-a-series-cf": import.meta.glob(
    "./assets/service-manual-pages/sm-new-a-series-cf__p*.jpg",
    { eager: true, import: "default" }
  ),
};

/**
 * @param {string} packId
 * @returns {{ page: number, url: string, pageKey: string }[]}
 */
function pagesForPack(packId) {
  const glob = SM_PACK_GLOBS[packId] || {};
  /** @type {{ page: number, url: string, pageKey: string }[]} */
  const pages = [];
  for (const [path, url] of Object.entries(glob)) {
    const m = path.match(/__p(\d+)\.jpg$/i);
    if (!m) continue;
    const page = Number(m[1]);
    pages.push({
      page,
      url: String(url),
      pageKey: `${packId}__p${page}`,
    });
  }
  pages.sort((a, b) => a.page - b.page);
  return pages;
}

/** @type {Record<string, { url: string, label: string, source: string, packId: string }>} */
const SERIES_SERVICE_MANUALS = {
  hd200e: {
    url: hd200e,
    label: "smVRM2632WC.pdf p1",
    source: "smVRM2632WC.pdf",
    packId: "sm-vrm2632wc",
  },
  hd200i: {
    url: hd200i,
    label: "smVR2632FFUG_VRM2632FFUC.pdf p1",
    source: "smVR2632FFUG_VRM2632FFUC.pdf",
    packId: "sm-vr2632ffug-vrm2632ffuc",
  },
  infinity26: {
    url: infinity26,
    label: "New A Series CF Parts List.pdf p1",
    source: "New A Series CF Parts List.pdf",
    packId: "sm-new-a-series-cf",
  },
  "infinity26-internal": {
    url: infinity26Internal,
    label: "smVR2632FFUG_VRM2632FFUC.pdf p1",
    source: "smVR2632FFUG_VRM2632FFUC.pdf",
    packId: "sm-vr2632ffug-vrm2632ffuc",
  },
  "infinity26-plus": {
    url: infinity26Plus,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
    packId: "sm-inf26-inf32-enviro-wh-190810",
  },
  "infinity26-smartstart": {
    url: infinity26Smartstart,
    label: "SM Smartstart.pdf p1",
    source: "SM Smartstart.pdf",
    packId: "sm-smartstart",
  },
  "infinity32-enviro": {
    url: infinity32Enviro,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
    packId: "sm-inf26-inf32-enviro-wh-190810",
  },
  "infinity32-enviro-plus-n": {
    url: infinity32EnviroPlusN,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
    packId: "sm-inf26-inf32-enviro-wh-190810",
  },
  hd210e: {
    url: hd210e,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
    packId: "sm-inf26-inf32-enviro-wh-190810",
  },
  hd210i: {
    url: hd210i,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
    packId: "sm-inf26-inf32-enviro-wh-190810",
  },
  hd250e: {
    url: hd250e,
    label: "smVR3237WG_WC.pdf p1",
    source: "smVR3237WG_WC.pdf",
    packId: "sm-vr3237wg-wc",
  },
};

/**
 * @param {string|null|undefined} seriesId
 * @returns {{
 *   url: string,
 *   label: string,
 *   source: string,
 *   kind: 'sm',
 *   pages: { page: number, url: string, pageKey: string }[],
 *   pageIndex: number,
 *   pdfFileName: string
 * }|null}
 */
export function resolveSeriesServiceManual(seriesId) {
  if (!seriesId) return null;
  const key = String(seriesId).trim().toLowerCase();
  const hit = SERIES_SERVICE_MANUALS[key];
  if (!hit?.url) return null;
  const pages = pagesForPack(hit.packId);
  const pageIndex = Math.max(
    0,
    pages.findIndex((p) => p.page === 1)
  );
  return {
    kind: "sm",
    url: hit.url,
    label: hit.label,
    source: hit.source,
    pages: pages.length ? pages : [{ page: 1, url: hit.url, pageKey: `${hit.packId}__p1` }],
    pageIndex: pages.length ? pageIndex : 0,
    pdfFileName: hit.source,
  };
}
