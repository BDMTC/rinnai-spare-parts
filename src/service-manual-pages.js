/**
 * Pin1 series → service-manual cover / first useful page (Vite-bundled, file:// safe).
 * Sourced from document-index SM PDFs under data-sheets/ for continuous-flow series.
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

/** @type {Record<string, { url: string, label: string, source: string }>} */
const SERIES_SERVICE_MANUALS = {
  hd200e: {
    url: hd200e,
    label: "smVRM2632WC.pdf p1",
    source: "smVRM2632WC.pdf",
  },
  hd200i: {
    url: hd200i,
    label: "smVR2632FFUG_VRM2632FFUC.pdf p1",
    source: "smVR2632FFUG_VRM2632FFUC.pdf",
  },
  infinity26: {
    url: infinity26,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
  },
  "infinity26-internal": {
    url: infinity26Internal,
    label: "smVR2632FFUG_VRM2632FFUC.pdf p1",
    source: "smVR2632FFUG_VRM2632FFUC.pdf",
  },
  "infinity26-plus": {
    url: infinity26Plus,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
  },
  "infinity26-smartstart": {
    url: infinity26Smartstart,
    label: "SM Smartstart.pdf p1",
    source: "SM Smartstart.pdf",
  },
  "infinity32-enviro": {
    url: infinity32Enviro,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
  },
  "infinity32-enviro-plus-n": {
    url: infinity32EnviroPlusN,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
  },
  hd210e: {
    url: hd210e,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
  },
  hd210i: {
    url: hd210i,
    label: "SM INF26_INF32 Enviro WH 190810.pdf p1",
    source: "SM INF26_INF32 Enviro WH 190810.pdf",
  },
};

/**
 * @param {string|null|undefined} seriesId
 * @returns {{ url: string, label: string, source: string, kind: 'sm' }|null}
 */
export function resolveSeriesServiceManual(seriesId) {
  if (!seriesId) return null;
  const key = String(seriesId).trim().toLowerCase();
  const hit = SERIES_SERVICE_MANUALS[key];
  if (!hit?.url) return null;
  return { kind: "sm", url: hit.url, label: hit.label, source: hit.source };
}
