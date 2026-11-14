/**
 * Warranty-checker family example packs (Basic + Detailed).
 * Each ⓘ opens one family cover-flow (~20 offline shots). Next/Prev/drag stay inside that family.
 */
import { publicUrl } from "./boot-data.js";
import manifest from "../public/assets/process-family-examples/manifest.json";

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   caption: string,
 *   attribution: string,
 * }} FamilyExamplePack
 *
 * @typedef {{
 *   kind: "image",
 *   src: string,
 *   label: string,
 * }} FamilyExamplePage
 */

/** @type {FamilyExamplePack[]} */
export const PROCESS_FAMILY_EXAMPLE_PACKS = [
  {
    id: "cf",
    title: "Gas continuous flow",
    caption:
      "Infinity / Enviro, HD / HDC, Builders, Flowmaster — wall-hung gas CF [e.g. Infinity 32, HD200e].",
    attribution: "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/cf/",
  },
  {
    id: "accessory",
    title: "CF accessory",
    caption:
      "Controllers, SmartStart, flues, pipe covers — sold with or after a CF unit.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/accessory/",
  },
  {
    id: "hotflo",
    title: "Hotflo electric storage",
    caption:
      "Tank-style electric storage [EHFA / EHFD / HFE]. Cylinder vs components have different year bands.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/hotflo/",
  },
  {
    id: "heat-pump",
    title: "Heat pump — Enviroflo",
    caption:
      "Heat-pump cylinder + compressor [EHPA / AR series]. Cylinder, compressor, and other parts differ.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/heat-pump/",
  },
  {
    id: "efinity",
    title: "Efinity electric CF",
    caption:
      "Indoor electric continuous flow (3-phase) [Efinity 14 / 19 / 29 kW] — not a storage tank.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/efinity/",
  },
  {
    id: "ghf-solar",
    title: "GHF / solar",
    caption:
      "Gas storage (GHF) or solar CF booster / solar cylinder [e.g. Solar 28]. Often needs booklet / Rinnai check.",
    attribution:
      "Rinnai AU catalogue + Bible unit shot · offline in public/assets/process-family-examples/ghf-solar/",
  },
  {
    id: "mixed",
    title: "Mixed system",
    caption:
      "Desk invent — storage tank + continuous-flow shots mixed (tank then CF). Beau to correct if the office uses a different mixed pattern.",
    attribution:
      "Composite gallery · Hotflo + Infinity catalogue shots (see SOURCES.md)",
  },
];

/**
 * @param {string|null|undefined} familyId
 * @returns {FamilyExamplePack}
 */
export function getFamilyExamplePack(familyId) {
  const hit = PROCESS_FAMILY_EXAMPLE_PACKS.find((p) => p.id === familyId);
  return hit || PROCESS_FAMILY_EXAMPLE_PACKS[0];
}

/**
 * @param {string} relPath family/file under process-family-examples
 */
function exampleFileUrl(relPath) {
  return publicUrl(`assets/process-family-examples/${relPath}`);
}

/**
 * Pages for one family only (~20 images). Next/Prev stay inside this list.
 * @param {FamilyExamplePack} pack
 * @returns {FamilyExamplePage[]}
 */
export function familyExamplePages(pack) {
  const rows = Array.isArray(manifest?.[pack.id]) ? manifest[pack.id] : [];
  return rows
    .map((row) => {
      const file = String(row?.file || "");
      if (!file) return null;
      const label = file.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || pack.title;
      return {
        kind: "image",
        src: exampleFileUrl(file),
        label,
      };
    })
    .filter(Boolean);
}
