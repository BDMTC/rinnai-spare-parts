/**
 * Warranty-checker family example packs (Basic + Detailed).
 * Each ⓘ opens one family cover-flow. Next/Prev/drag stay inside that family.
 * Packs match real warranty-table families only (no Mixed / not-sure invent).
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
      "Infinity / Enviro, HD / HDC, Builders, Flowmaster — wall-hung gas continuous flow [e.g. Infinity 32, HD200e].",
    attribution: "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/cf/",
  },
  {
    id: "accessory",
    title: "Continuous flow accessory",
    caption:
      "Controllers, SmartStart, flues, pipe covers — sold with or after a continuous flow unit.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/accessory/",
  },
  {
    id: "hotflo",
    title: "Hotflo electric storage",
    caption:
      "Tank-style electric storage [EHFA / EHFD / HFE codes]. Cylinder vs components have different year bands.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/hotflo/",
  },
  {
    id: "heat-pump",
    title: "Heat pump — Enviroflo",
    caption:
      "Enviroflo heat pump [EHPA / EHPS / EHPT]. Cylinder, refrigeration, and other parts differ — EHPA cylinder 7 yr / refrigeration labour 3 yr.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/heat-pump/",
  },
  {
    id: "efinity",
    title: "Efinity electric continuous flow",
    caption:
      "Indoor electric continuous flow (3-phase) [Efinity] — 5/5/5 domestic, 60°C domestic ceiling.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/efinity/",
  },
  {
    id: "ghf-solar",
    title: "Solar / gas storage",
    caption:
      "Solar booster / collectors / cylinders (use Solar booklet path in the checker). GHF gas storage still chase Rinnai.",
    attribution:
      "Rinnai AU catalogue + Bible unit shot · offline in public/assets/process-family-examples/ghf-solar/",
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
 * Pages for one family only. Next/Prev stay inside this list.
 * @param {FamilyExamplePack} pack
 * @returns {FamilyExamplePage[]}
 */
export function familyExamplePages(pack) {
  const rows = Array.isArray(manifest?.[pack.id]) ? manifest[pack.id] : [];
  return rows
    .map((row) => {
      const file = String(row?.file || "");
      if (!file) return null;
      const label =
        file.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || pack.title;
      return {
        kind: "image",
        src: exampleFileUrl(file),
        label,
      };
    })
    .filter(Boolean);
}
