/**
 * Lazy-load full PDF bytes via classic <script> assets (file:// safe).
 * Chromium blocks fetch() between opaque file origins; script src still works.
 */

/** @typedef {{ id: string, fileName: string }} LightboxPdfRef */

/** @type {Record<string, LightboxPdfRef>} */
export const LIGHTBOX_PDFS = {
  "smVRM2632WC.pdf": { id: "smVRM2632WC", fileName: "smVRM2632WC.pdf" },
  "smVR2632FFUG_VRM2632FFUC.pdf": {
    id: "smVR2632FFUG_VRM2632FFUC",
    fileName: "smVR2632FFUG_VRM2632FFUC.pdf",
  },
  "SM INF26_INF32 Enviro WH 190810.pdf": {
    id: "SM-INF26-INF32-Enviro-WH-190810",
    fileName: "SM INF26_INF32 Enviro WH 190810.pdf",
  },
  "SM Smartstart.pdf": { id: "SM-Smartstart", fileName: "SM Smartstart.pdf" },
  "SM Inbuilt Smartstart.pdf": {
    id: "SM-Inbuilt-Smartstart",
    fileName: "SM Inbuilt Smartstart.pdf",
  },
  "PL & ED INF26 Smartstart VR2626WGP.pdf": {
    id: "PL-ED-INF26-Smartstart-VR2626WGP",
    fileName: "PL & ED INF26 Smartstart VR2626WGP.pdf",
  },
  "EDPL REU-VRM2632WC.pdf": {
    id: "EDPL-REU-VRM2632WC",
    fileName: "EDPL REU-VRM2632WC.pdf",
  },
  "EDPL REU-VR2632FFUG.pdf": {
    id: "EDPL-REU-VR2632FFUG",
    fileName: "EDPL REU-VR2632FFUG.pdf",
  },
  "EDPL V2632FFU_FFUC.pdf": {
    id: "EDPL-V2632FFU-FFUC",
    fileName: "EDPL V2632FFU_FFUC.pdf",
  },
  "EDPL REUV2630WD INF26Plus.pdf": {
    id: "EDPL-REUV2630WD-INF26Plus",
    fileName: "EDPL REUV2630WD INF26Plus.pdf",
  },
  "EDPL Smartstart.pdf": {
    id: "EDPL-Smartstart",
    fileName: "EDPL Smartstart.pdf",
  },
  "EDPL VR_VRM3237.pdf": {
    id: "EDPL-VR-VRM3237",
    fileName: "EDPL VR_VRM3237.pdf",
  },
  "PLED_Infinity-32-Enviro-Plus-N-Series-e.pdf": {
    id: "PLED-Infinity-32-Enviro-Plus-N-Series-e",
    fileName: "PLED_Infinity-32-Enviro-Plus-N-Series-e.pdf",
  },
  "ED_N Series 2020 IN32 Enviro.pdf": {
    id: "ED-N-Series-2020-IN32-Enviro",
    fileName: "ED_N Series 2020 IN32 Enviro.pdf",
  },
  "Hotflo EHFA160 Spare Parts List S111418B.pdf": {
    id: "Hotflo-EHFA160-Spare-Parts-List-S111418B",
    fileName: "Hotflo EHFA160 Spare Parts List S111418B.pdf",
  },
  "EHFA  SPARE PARTS.pdf": {
    id: "EHFA-SPARE-PARTS",
    fileName: "EHFA  SPARE PARTS.pdf",
  },
  "smVR3237WG_WC.pdf": {
    id: "smVR3237WG-WC",
    fileName: "smVR3237WG_WC.pdf",
  },
  "Parts List REU-VCM2837 WC External.pdf": {
    id: "Parts-List-REU-VCM2837-WC-External",
    fileName: "Parts List REU-VCM2837 WC External.pdf",
  },
  "New A Series CF Parts List.pdf": {
    id: "New-A-Series-CF-Parts-List",
    fileName: "New A Series CF Parts List.pdf",
  },
  "PL - RINNAI - EDPL INF32 ENVIRO KM3237WD - ISSUE 4 - JUNE 2025.pdf": {
    id: "PL-INF32-ENVIRO-KM3237WD-ISSUE4",
    fileName:
      "PL - RINNAI - EDPL INF32 ENVIRO KM3237WD - ISSUE 4 - JUNE 2025.pdf",
  },
  "PL - RINNAI - ENVIRO KM2635WD - ISSUE 04 - JUNE 2025.pdf": {
    id: "PL-ENVIRO-KM2635WD-ISSUE04",
    fileName: "PL - RINNAI - ENVIRO KM2635WD - ISSUE 04 - JUNE 2025.pdf",
  },
  "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf": {
    id: "PL-N3237-Inf32-Enviro-Plus-N-Issue3",
    fileName:
      "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf",
  },
  "smV2626W_V2630WC.pdf": {
    id: "smV2626W-V2630WC",
    fileName: "smV2626W_V2630WC.pdf",
  },
  "EDPL VRM2630.pdf": {
    id: "EDPL-VRM2630",
    fileName: "EDPL VRM2630.pdf",
  },
  "EDPL VR2426_VR2626.pdf": {
    id: "EDPL-VR2426-VR2626",
    fileName: "EDPL VR2426_VR2626.pdf",
  },
  "EDPL REUV2426WG.pdf": {
    id: "EDPL-REUV2426WG",
    fileName: "EDPL REUV2426WG.pdf",
  },
  "EDPL REUV2626WG.pdf": {
    id: "EDPL-REUV2626WG",
    fileName: "EDPL REUV2626WG.pdf",
  },
  "EDPL REUV2626W_REUV2632WC.pdf": {
    id: "EDPL-REUV2626W-REUV2632WC",
    fileName: "EDPL REUV2626W_REUV2632WC.pdf",
  },
  "EDPL REUV2632FFU.pdf": {
    id: "EDPL-REUV2632FFU",
    fileName: "EDPL REUV2632FFU.pdf",
  },
  "EDPL REUV2632FFUC.pdf": {
    id: "EDPL-REUV2632FFUC",
    fileName: "EDPL REUV2632FFUC.pdf",
  },
  "EDPL VRM2632FFU.pdf": {
    id: "EDPL-VRM2632FFU",
    fileName: "EDPL VRM2632FFU.pdf",
  },
  "PL - RINNAI - EDPL VRM2632FFU - ISSUE 4 - JUNE 2025.pdf": {
    id: "PL-EDPL-VRM2632FFU-ISSUE4",
    fileName: "PL - RINNAI - EDPL VRM2632FFU - ISSUE 4 - JUNE 2025.pdf",
  },
  "EDPL VM3237WC.pdf": {
    id: "EDPL-VM3237WC",
    fileName: "EDPL VM3237WC.pdf",
  },
  "EDPL REUVM3237WC.pdf": {
    id: "EDPL-REUVM3237WC",
    fileName: "EDPL REUVM3237WC.pdf",
  },
  "EDPL REUV3237.pdf": {
    id: "EDPL-REUV3237",
    fileName: "EDPL REUV3237.pdf",
  },
  "REU-V3237WG Parts List.pdf": {
    id: "REU-V3237WG-Parts-List",
    fileName: "REU-V3237WG Parts List.pdf",
  },
  "PL - RINNAI - EDPL HD250E REUVRM3237WC - ISSUE 4 - FEB 2025.pdf": {
    id: "PL-HD250E-REUVRM3237WC-ISSUE4",
    fileName:
      "PL - RINNAI - EDPL HD250E REUVRM3237WC - ISSUE 4 - FEB 2025.pdf",
  },
  "PL - RINNAI - EDPLVRM3237 - ISSUE 4 - JUNE 2025.pdf": {
    id: "PL-EDPLVRM3237-ISSUE4",
    fileName: "PL - RINNAI - EDPLVRM3237 - ISSUE 4 - JUNE 2025.pdf",
  },
  "HW_CF_A_Series_Parts_List_Issue_1_Jan_2018.pdf": {
    id: "HW-CF-A-Series-Parts-List-Issue1",
    fileName: "HW_CF_A_Series_Parts_List_Issue_1_Jan_2018.pdf",
  },
};

/**
 * @param {string} fileName
 * @returns {string}
 */
export function lightboxPdfScriptUrl(fileName) {
  const ref = LIGHTBOX_PDFS[fileName];
  if (!ref) return "";
  const base = import.meta.env.BASE_URL || "./";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}assets/pdf-data-${ref.id}.js`;
}

/**
 * @param {{ fileName: string, base64: string }} rec
 * @returns {{ fileName: string, bytes: Uint8Array }}
 */
function decodePdfRecord(rec) {
  const bin = atob(rec.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { fileName: rec.fileName, bytes };
}

/**
 * @param {string} fileName
 * @returns {Promise<{ fileName: string, bytes: Uint8Array }>}
 */
export function loadLightboxPdf(fileName) {
  const ref = LIGHTBOX_PDFS[fileName];
  if (!ref) {
    return Promise.reject(new Error(`Unknown lightbox PDF: ${fileName}`));
  }

  const existing = globalThis.__RSP_PDF__?.[fileName];
  if (existing?.base64) {
    return Promise.resolve(decodePdfRecord(existing));
  }

  const url = lightboxPdfScriptUrl(fileName);
  return new Promise((resolve, reject) => {
    const prev = document.querySelector(`script[data-rsp-pdf="${ref.id}"]`);
    if (prev) {
      prev.addEventListener("load", () => {
        const rec = globalThis.__RSP_PDF__?.[fileName];
        if (!rec?.base64) reject(new Error(`PDF data missing after load: ${fileName}`));
        else resolve(decodePdfRecord(rec));
      });
      prev.addEventListener("error", () =>
        reject(new Error(`Failed to load PDF data: ${fileName}`))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.rspPdf = ref.id;
    script.onload = () => {
      const rec = globalThis.__RSP_PDF__?.[fileName];
      if (!rec?.base64) {
        reject(new Error(`PDF data missing after load: ${fileName}`));
        return;
      }
      resolve(decodePdfRecord(rec));
    };
    script.onerror = () =>
      reject(new Error(`Failed to load PDF data: ${fileName}`));
    document.head.appendChild(script);
  });
}

/**
 * Save the full PDF to the device (blob download — works under file://).
 * @param {string} fileName
 * @returns {Promise<void>}
 */
export async function downloadLightboxPdf(fileName) {
  const { fileName: name, bytes } = await loadLightboxPdf(fileName);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
