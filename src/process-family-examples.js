/**
 * Warranty-checker family example slides (Basic + Detailed).
 * Prefer offline public/ catalogue shots; fall back to Bible series unit shots.
 */
import { publicUrl } from "./boot-data.js";
import { seriesUnitShotUrl } from "./series-unit-shots.js";

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   caption: string,
 *   attribution: string,
 *   publicFiles?: string[],
 *   seriesIds?: string[],
 *   collage?: boolean,
 * }} FamilyExampleSlide
 */

/** @type {FamilyExampleSlide[]} */
export const PROCESS_FAMILY_EXAMPLE_SLIDES = [
  {
    id: "cf",
    title: "Gas continuous flow",
    caption:
      "Infinity / Enviro, HD / HDC, Builders, Flowmaster — wall-hung gas CF [e.g. Infinity 32, HD200e].",
    attribution: "Rinnai AU catalogue · Infinity 32 + Bible unit shots",
    publicFiles: ["infinity-32.png"],
    seriesIds: ["hd200e", "hd28e", "infinity26"],
  },
  {
    id: "accessory",
    title: "CF accessory",
    caption:
      "Controllers, SmartStart, flues, pipe covers — sold with or after a CF unit.",
    attribution: "Bible unit shot · Infinity 26 Smartstart",
    seriesIds: ["infinity26-smartstart"],
  },
  {
    id: "hotflo",
    title: "Hotflo electric storage",
    caption:
      "Tank-style electric storage [EHFA / EHFD / HFE]. Cylinder vs components have different year bands.",
    attribution: "Rinnai AU catalogue · Hotflo 160L",
    publicFiles: ["hotflo-160l.png"],
  },
  {
    id: "heat-pump",
    title: "Heat pump — Enviroflo",
    caption:
      "Heat-pump cylinder + compressor [EHPA / AR series]. Cylinder, compressor, and other parts differ.",
    attribution: "Rinnai AU catalogue · Enviroflo AR 300L",
    publicFiles: ["enviroflo-ar-300.png"],
  },
  {
    id: "efinity",
    title: "Efinity electric CF",
    caption:
      "Indoor electric continuous flow (3-phase) [Efinity 14 / 19 / 29 kW] — not a storage tank.",
    attribution: "Rinnai AU catalogue · Efinity 19kW",
    publicFiles: ["efinity-19kw.png"],
  },
  {
    id: "ghf-solar",
    title: "GHF / solar",
    caption:
      "Gas storage (GHF) or solar CF booster / solar cylinder [e.g. Solar 28]. Often needs booklet / Rinnai check.",
    attribution: "Bible unit shot · Solar 28",
    seriesIds: ["solar28"],
  },
  {
    id: "mixed",
    title: "Mixed system",
    caption:
      "Desk invent — storage tank + continuous-flow combo on one install. Beau to correct if the office uses a different mixed pattern.",
    attribution: "Composite · Hotflo 160L + Infinity 32 (Rinnai AU catalogue)",
    publicFiles: ["hotflo-160l.png", "infinity-32.png"],
    collage: true,
  },
];

/**
 * @param {string} fileName
 * @returns {string}
 */
function publicExampleUrl(fileName) {
  return publicUrl(`assets/process-family-examples/${fileName}`);
}

/**
 * @param {FamilyExampleSlide} slide
 * @returns {{ src: string, label: string }[]}
 */
export function familyExampleImages(slide) {
  /** @type {{ src: string, label: string }[]} */
  const out = [];
  for (const file of slide.publicFiles || []) {
    out.push({
      src: publicExampleUrl(file),
      label: file.replace(/\.[^.]+$/, "").replace(/-/g, " "),
    });
  }
  for (const id of slide.seriesIds || []) {
    const src = seriesUnitShotUrl(id);
    if (!src) continue;
    out.push({ src, label: id });
  }
  return out;
}

/**
 * @param {string|null|undefined} startId
 * @returns {number}
 */
export function familyExampleSlideIndex(startId) {
  if (!startId) return 0;
  const i = PROCESS_FAMILY_EXAMPLE_SLIDES.findIndex((s) => s.id === startId);
  return i >= 0 ? i : 0;
}
