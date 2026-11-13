/**
 * Pin1 series → service-manual cover (thumb) + full page set for lightbox.
 * Vite-bundled JPGs — file:// safe. Shared packs when series share an SM PDF.
 */
import hd200e from "./assets/service-manual-pages/hd200e__p1.jpg";
import hd200i from "./assets/service-manual-pages/hd200i__p1.jpg";
import infinity26 from "./assets/service-manual-pages/infinity26__p1.jpg";
import infinityA from "./assets/service-manual-pages/infinity-a__p1.jpg";
import vr2426 from "./assets/service-manual-pages/vr2426__p1.jpg";
import infinity16V from "./assets/service-manual-pages/infinity16-v__p1.jpg";
import infinity20V from "./assets/service-manual-pages/infinity20-v__p1.jpg";
import infinityV1616 from "./assets/service-manual-pages/infinity-v1616__p1.jpg";
import v3232 from "./assets/service-manual-pages/v3232__p1.jpg";
import infinity202006 from "./assets/service-manual-pages/infinity20-2006__p1.jpg";
import infinity242402 from "./assets/service-manual-pages/infinity24-2402__p1.jpg";
import infinity24Wa from "./assets/service-manual-pages/infinity24-wa__p1.jpg";
import infinity323203 from "./assets/service-manual-pages/infinity32-3203__p1.jpg";
import v2626 from "./assets/service-manual-pages/v2626__p1.jpg";
import smartstart from "./assets/service-manual-pages/smartstart__p1.jpg";
import v2632ffu from "./assets/service-manual-pages/v2632ffu__p1.jpg";
import fm10 from "./assets/service-manual-pages/fm10__p1.jpg";
import infinity26Internal from "./assets/service-manual-pages/infinity26-internal__p1.jpg";
import infinity26Plus from "./assets/service-manual-pages/infinity26-plus__p1.jpg";
import infinity26Smartstart from "./assets/service-manual-pages/infinity26-smartstart__p1.jpg";
import infinity32Enviro from "./assets/service-manual-pages/infinity32-enviro__p1.jpg";
import infinity32EnviroPlusN from "./assets/service-manual-pages/infinity32-enviro-plus-n__p1.jpg";
import hd210e from "./assets/service-manual-pages/hd210e__p1.jpg";
import hd210i from "./assets/service-manual-pages/hd210i__p1.jpg";
import hd250e from "./assets/service-manual-pages/hd250e__p1.jpg";
import infinity32 from "./assets/service-manual-pages/infinity32__p1.jpg";
import v3237 from "./assets/service-manual-pages/v3237__p1.jpg";
import infinityB from "./assets/service-manual-pages/infinity-b__p1.jpg";
import envirosmart from "./assets/service-manual-pages/envirosmart__p1.jpg";
import infinity16 from "./assets/service-manual-pages/infinity16__p1.jpg";
import infinity20 from "./assets/service-manual-pages/infinity20__p1.jpg";
import hdc32e from "./assets/service-manual-pages/hdc32e__p1.jpg";
import hdc32i from "./assets/service-manual-pages/hdc32i__p1.jpg";
import hd28e from "./assets/service-manual-pages/hd28e__p1.jpg";
import hd28i from "./assets/service-manual-pages/hd28i__p1.jpg";
import infinity28 from "./assets/service-manual-pages/infinity28__p1.jpg";
import hd32 from "./assets/service-manual-pages/hd32__p1.jpg";
import vrm1620 from "./assets/service-manual-pages/vrm1620__p1.jpg";
import vrm2024 from "./assets/service-manual-pages/vrm2024__p1.jpg";
import vrm2626 from "./assets/service-manual-pages/vrm2626__p1.jpg";
import vrm3237wg from "./assets/service-manual-pages/vrm3237wg__p1.jpg";
import efinityEcf from "./assets/service-manual-pages/efinity-ecf__p1.jpg";
import ehptA from "./assets/service-manual-pages/ehpt-a__p1.jpg";
import ehpaAr from "./assets/service-manual-pages/ehpa-ar__p1.jpg";
import ehpsBe from "./assets/service-manual-pages/ehps-be__p1.jpg";
import ehpgGr from "./assets/service-manual-pages/ehpg-gr__p1.jpg";
import ehpaVma from "./assets/service-manual-pages/ehpa-vma__p1.jpg";
import chp from "./assets/service-manual-pages/chp__p1.jpg";

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
  "sm-inbuilt-smartstart": import.meta.glob(
    "./assets/service-manual-pages/sm-inbuilt-smartstart__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vr3237wg-wc": import.meta.glob(
    "./assets/service-manual-pages/sm-vr3237wg-wc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-v3237w-vm3237wc": import.meta.glob(
    "./assets/service-manual-pages/sm-v3237w-vm3237wc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-new-a-series-cf": import.meta.glob(
    "./assets/service-manual-pages/sm-new-a-series-cf__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-v2626w-v2630wc": import.meta.glob(
    "./assets/service-manual-pages/sm-v2626w-v2630wc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-hw-cf-bm-b26": import.meta.glob(
    "./assets/service-manual-pages/sm-hw-cf-bm-b26__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-k2430wak": import.meta.glob(
    "./assets/service-manual-pages/sm-k2430wak__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vreu-vr1620-vr2024": import.meta.glob(
    "./assets/service-manual-pages/sm-vreu-vr1620-vr2024__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vr2426w-vr2632wc": import.meta.glob(
    "./assets/service-manual-pages/sm-vr2426w-vr2632wc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-v1620-v2024": import.meta.glob(
    "./assets/service-manual-pages/sm-v1620-v2024__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-v1616-v2018-v2020": import.meta.glob(
    "./assets/service-manual-pages/sm-v1616-v2018-v2020__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-v3232w-wc": import.meta.glob(
    "./assets/service-manual-pages/sm-v3232w-wc__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-2006": import.meta.glob(
    "./assets/service-manual-pages/sm-2006__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-2402": import.meta.glob(
    "./assets/service-manual-pages/sm-2402__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-24wa": import.meta.glob(
    "./assets/service-manual-pages/sm-24wa__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-reu3203": import.meta.glob(
    "./assets/service-manual-pages/sm-reu3203__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-v26": import.meta.glob(
    "./assets/service-manual-pages/sm-v26__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-v26ffu": import.meta.glob(
    "./assets/service-manual-pages/sm-v26ffu__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-ihf10": import.meta.glob(
    "./assets/service-manual-pages/sm-ihf10__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-nb3237": import.meta.glob(
    "./assets/service-manual-pages/sm-nb3237__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vcm2837": import.meta.glob(
    "./assets/service-manual-pages/sm-vcm2837__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-am3237": import.meta.glob(
    "./assets/service-manual-pages/sm-am3237__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vrm16-vrm20": import.meta.glob(
    "./assets/service-manual-pages/sm-vrm16-vrm20__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vr2626wb-vrm2626wg": import.meta.glob(
    "./assets/service-manual-pages/sm-vr2626wb-vrm2626wg__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-vr3237-vrm3237wg": import.meta.glob(
    "./assets/service-manual-pages/sm-vr3237-vrm3237wg__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-efinity-ecf": import.meta.glob(
    "./assets/service-manual-pages/sm-efinity-ecf__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-ehpt-a": import.meta.glob(
    "./assets/service-manual-pages/sm-ehpt-a__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-ehpa-ar": import.meta.glob(
    "./assets/service-manual-pages/sm-ehpa-ar__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-ehps-be": import.meta.glob(
    "./assets/service-manual-pages/sm-ehps-be__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-ehpg-gr": import.meta.glob(
    "./assets/service-manual-pages/sm-ehpg-gr__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-ehpa-vma": import.meta.glob(
    "./assets/service-manual-pages/sm-ehpa-vma__p*.jpg",
    { eager: true, import: "default" }
  ),
  "sm-chp": import.meta.glob(
    "./assets/service-manual-pages/sm-chp__p*.jpg",
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
  "infinity-a": {
    url: infinityA,
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
    label: "smV2626W_V2630WC.pdf p1",
    source: "smV2626W_V2630WC.pdf",
    packId: "sm-v2626w-v2630wc",
  },
  "infinity26-smartstart": {
    url: infinity26Smartstart,
    label: "SM Inbuilt Smartstart.pdf p1",
    source: "SM Inbuilt Smartstart.pdf",
    packId: "sm-inbuilt-smartstart",
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
  infinity32: {
    url: infinity32,
    label: "smVR3237WG_WC.pdf p1",
    source: "smVR3237WG_WC.pdf",
    packId: "sm-vr3237wg-wc",
  },
  v3237: {
    url: v3237,
    label: "smREUV3237W_VM3237WC April09.pdf p1",
    source: "smREUV3237W_VM3237WC April09.pdf",
    packId: "sm-v3237w-vm3237wc",
  },
  "infinity-b": {
    url: infinityB,
    label: "HW_CF_BM_SM_Issue_1_AUG BM2626 & B26 Series.pdf p1",
    source: "HW_CF_BM_SM_Issue_1_AUG BM2626 & B26 Series.pdf",
    packId: "sm-hw-cf-bm-b26",
  },
  envirosmart: {
    url: envirosmart,
    label: "smK2430WAK.pdf p1",
    source: "smK2430WAK.pdf",
    packId: "sm-k2430wak",
  },
  infinity16: {
    url: infinity16,
    label: "smvREUVR1616W_VR2024_v2.pdf p1",
    source: "smvREUVR1616W_VR2024_v2.pdf",
    packId: "sm-vreu-vr1620-vr2024",
  },
  infinity20: {
    url: infinity20,
    label: "smvREUVR1616W_VR2024_v2.pdf p1",
    source: "smvREUVR1616W_VR2024_v2.pdf",
    packId: "sm-vreu-vr1620-vr2024",
  },
  vr2426: {
    url: vr2426,
    label: "SMVR2426W_VR2632WC.pdf p1",
    source: "SMVR2426W_VR2632WC.pdf",
    packId: "sm-vr2426w-vr2632wc",
  },
  "infinity16-v": {
    url: infinity16V,
    label: "smv1616W.pdf p1",
    source: "smv1616W.pdf",
    packId: "sm-v1620-v2024",
  },
  "infinity20-v": {
    url: infinity20V,
    label: "smv1616W.pdf p1",
    source: "smv1616W.pdf",
    packId: "sm-v1620-v2024",
  },
  "infinity-v1616": {
    url: infinityV1616,
    label: "SM V16_18_20.pdf p1",
    source: "SM V16_18_20.pdf",
    packId: "sm-v1616-v2018-v2020",
  },
  v3232: {
    url: v3232,
    label: "SM V32.pdf p1",
    source: "SM V32.pdf",
    packId: "sm-v3232w-wc",
  },
  "infinity20-2006": {
    url: infinity202006,
    label: "SM 2006.pdf p1",
    source: "SM 2006.pdf",
    packId: "sm-2006",
  },
  "infinity24-2402": {
    url: infinity242402,
    label: "SM 2402.pdf p1",
    source: "SM 2402.pdf",
    packId: "sm-2402",
  },
  "infinity24-wa": {
    url: infinity24Wa,
    label: "SM 24WA.pdf p1",
    source: "SM 24WA.pdf",
    packId: "sm-24wa",
  },
  "infinity32-3203": {
    url: infinity323203,
    label: "SM REU3203.pdf p1",
    source: "SM REU3203.pdf",
    packId: "sm-reu3203",
  },
  v2626: {
    url: v2626,
    label: "SM V26.pdf p1",
    source: "SM V26.pdf",
    packId: "sm-v26",
  },
  smartstart: {
    url: smartstart,
    label: "SM Smartstart.pdf p1",
    source: "SM Smartstart.pdf",
    packId: "sm-smartstart",
  },
  v2632ffu: {
    url: v2632ffu,
    label: "SM V26FFU.pdf p1",
    source: "SM V26FFU.pdf",
    packId: "sm-v26ffu",
  },
  fm10: {
    url: fm10,
    label: "IHF10.pdf p1",
    source: "IHF10.pdf",
    packId: "sm-ihf10",
  },
  hdc32e: {
    url: hdc32e,
    label:
      "SM - RINNAI - N SERIES INFINITY ENVIRO32 REU-NB3237 - ISSUE 1 - JULY 2025.pdf p1",
    source:
      "SM - RINNAI - N SERIES INFINITY ENVIRO32 REU-NB3237 - ISSUE 1 - JULY 2025.pdf",
    packId: "sm-nb3237",
  },
  hdc32i: {
    url: hdc32i,
    label:
      "SM - RINNAI - N SERIES INFINITY ENVIRO32 REU-NB3237 - ISSUE 1 - JULY 2025.pdf p1",
    source:
      "SM - RINNAI - N SERIES INFINITY ENVIRO32 REU-NB3237 - ISSUE 1 - JULY 2025.pdf",
    packId: "sm-nb3237",
  },
  hd28e: {
    url: hd28e,
    label: "SM - RINNAI - REUVCM2837FF,FFC,WC - ISSUE 2 - FEB 2026.pdf p1",
    source: "SM - RINNAI - REUVCM2837FF,FFC,WC - ISSUE 2 - FEB 2026.pdf",
    packId: "sm-vcm2837",
  },
  hd28i: {
    url: hd28i,
    label: "SM - RINNAI - REUVCM2837FF,FFC,WC - ISSUE 2 - FEB 2026.pdf p1",
    source: "SM - RINNAI - REUVCM2837FF,FFC,WC - ISSUE 2 - FEB 2026.pdf",
    packId: "sm-vcm2837",
  },
  infinity28: {
    url: infinity28,
    label: "SM - RINNAI - REUVCM2837FF,FFC,WC - ISSUE 2 - FEB 2026.pdf p1",
    source: "SM - RINNAI - REUVCM2837FF,FFC,WC - ISSUE 2 - FEB 2026.pdf",
    packId: "sm-vcm2837",
  },
  hd32: {
    url: hd32,
    label: "SM - RINNAI - REUAM3237W,WC - ISSUE 4 - FEB 2026.pdf p1",
    source: "SM - RINNAI - REUAM3237W,WC - ISSUE 4 - FEB 2026.pdf",
    packId: "sm-am3237",
  },
  vrm1620: {
    url: vrm1620,
    label: "SM - RINNAI - VRM16, VRM20 - ISSUE 03 - JAN 2015.pdf p1",
    source: "SM - RINNAI - VRM16, VRM20 - ISSUE 03 - JAN 2015.pdf",
    packId: "sm-vrm16-vrm20",
  },
  vrm2024: {
    url: vrm2024,
    label: "SM - RINNAI - VRM16, VRM20 - ISSUE 03 - JAN 2015.pdf p1",
    source: "SM - RINNAI - VRM16, VRM20 - ISSUE 03 - JAN 2015.pdf",
    packId: "sm-vrm16-vrm20",
  },
  vrm2626: {
    url: vrm2626,
    label: "SM - RINNAI - VR2626WB_VRM2626WG - ISSUE 03 - NOV 2014.pdf p1",
    source: "SM - RINNAI - VR2626WB_VRM2626WG - ISSUE 03 - NOV 2014.pdf",
    packId: "sm-vr2626wb-vrm2626wg",
  },
  vrm3237wg: {
    url: vrm3237wg,
    label:
      "SM - RINNAI VR3237WG_ VRM3237WG _ VRM3237WC HD250e ISSUE03 NOV 2014.pdf p1",
    source:
      "SM - RINNAI VR3237WG_ VRM3237WG _ VRM3237WC HD250e ISSUE03 NOV 2014.pdf",
    packId: "sm-vr3237-vrm3237wg",
  },
  "efinity-ecf": {
    url: efinityEcf,
    label: "SM - RINNAI - ECF EFINITY - ELECTRIC CFHW - ISSUE 3 - AUG 2026.pdf p1",
    source: "SM - RINNAI - ECF EFINITY - ELECTRIC CFHW - ISSUE 3 - AUG 2026.pdf",
    packId: "sm-efinity-ecf",
  },
  "ehpt-a": {
    url: ehptA,
    label:
      "SM - RINNAI - A SERIES HEAT PUMP - EHPT 180 - 250 VM - ISSUE 2  - APR 2024.pdf p1",
    source:
      "SM - RINNAI - A SERIES HEAT PUMP - EHPT 180 - 250 VM - ISSUE 2  - APR 2024.pdf",
    packId: "sm-ehpt-a",
  },
  "ehpa-ar": {
    url: ehpaAr,
    label:
      "SM - RINNAI - AR SERIES HEAT PUMP EHPAxxVM -  ISSUE 3 - DEC 2025.pdf p1",
    source:
      "SM - RINNAI - AR SERIES HEAT PUMP EHPAxxVM -  ISSUE 3 - DEC 2025.pdf",
    packId: "sm-ehpa-ar",
  },
  "ehps-be": {
    url: ehpsBe,
    label:
      "SM - RINNAI - B  E SERIES HEAT PUMP - EHPS (VM VMT) - ISSUE 1 - NOV 2023.pdf p1",
    source:
      "SM - RINNAI - B  E SERIES HEAT PUMP - EHPS (VM VMT) - ISSUE 1 - NOV 2023.pdf",
    packId: "sm-ehps-be",
  },
  "ehpg-gr": {
    url: ehpgGr,
    label:
      "SM - RINNAI - GR SERIES HEAT PUMP EHPGxxVM, VMT, VMP - ISSUE 1 - MARCH 2025.pdf p1",
    source:
      "SM - RINNAI - GR SERIES HEAT PUMP EHPGxxVM, VMT, VMP - ISSUE 1 - MARCH 2025.pdf",
    packId: "sm-ehpg-gr",
  },
  "ehpa-vma": {
    url: ehpaVma,
    label:
      "SM - RINNAI - ENVIROFLO HEAT PUMP - VMA V2 - ISSUE 3 - JUN 2024.pdf p1",
    source:
      "SM - RINNAI - ENVIROFLO HEAT PUMP - VMA V2 - ISSUE 3 - JUN 2024.pdf",
    packId: "sm-ehpa-vma",
  },
  chp: {
    url: chp,
    label:
      "SM - RINNAI - COMM HEAT PUMP CHP020 CHP040 - ISSUE 2 - OCT 2025.pdf p1",
    source:
      "SM - RINNAI - COMM HEAT PUMP CHP020 CHP040 - ISSUE 2 - OCT 2025.pdf",
    packId: "sm-chp",
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
