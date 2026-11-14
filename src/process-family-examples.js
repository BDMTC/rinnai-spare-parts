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
 *   dataplateExample: string,
 * }} FamilyExamplePack
 *
 * @typedef {{
 *   kind: "image",
 *   src: string,
 *   label: string,
 * }} FamilyExamplePage
 */

/** Alias checker exampleId → pack id (shared Basic + Detailed tool). */
const FAMILY_EXAMPLE_ALIASES = {
  solar: "ghf-solar",
};

/** @type {FamilyExamplePack[]} */
export const PROCESS_FAMILY_EXAMPLE_PACKS = [
  {
    id: "cf",
    title: "Gas continuous flow",
    caption:
      "Infinity / Enviro, HD / HDC, Builders, Flowmaster — wall-hung gas continuous flow [e.g. Infinity 32, HD200e].",
    attribution: "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/cf/",
    dataplateExample:
      "Worked dataplate: Model REU-VRM2632WC · Serial A12B345678 · Mfd 03/2022. Install date unknown → age from May 2022 (manufacture + 2 months). That is an HD-class continuous flow plate — use Gas continuous flow in the tool.",
  },
  {
    id: "accessory",
    title: "Continuous flow accessory",
    caption:
      "Controllers, SmartStart, flues, pipe covers — sold with or after a continuous flow unit.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/accessory/",
    dataplateExample:
      "Worked dataplate (controller): Model MC-601RC · Serial C998877 · Install with the heater 11/2024. Age from Nov 2024. Pick Controller / SmartStart / CF accessory in the tool — not the heater family.",
  },
  {
    id: "hotflo",
    title: "Hotflo electric storage",
    caption:
      "Tank-style electric storage [EHFA / EHFD / HFE codes]. Cylinder vs components have different year bands.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/hotflo/",
    dataplateExample:
      "Worked dataplate: Model EHFA250 · Serial H250-112233 · Mfd 06/2021 · Install 08/2021. Age from Aug 2021. 250 L tank → Hotflo 80–400 L path in the tool.",
  },
  {
    id: "heat-pump",
    title: "Heat pump — Enviroflo",
    caption:
      "Enviroflo heat pump [EHPA / EHPS / EHPT]. Cylinder, refrigeration, and other parts differ — EHPA cylinder 7 yr / refrigeration labour 3 yr.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/heat-pump/",
    dataplateExample:
      "Worked dataplate: Model EHPA250VMA · Serial EP250-445566 · Install 01/07/2023. Starts with EHPA → Enviroflo EHPA path. Ask Solar Victoria rebate only if domestic + that rebate.",
  },
  {
    id: "efinity",
    title: "Efinity electric continuous flow",
    caption:
      "Indoor electric continuous flow (3-phase) [Efinity] — 5/5/5 domestic, 60°C domestic ceiling.",
    attribution:
      "Rinnai AU catalogue shots · offline in public/assets/process-family-examples/efinity/",
    dataplateExample:
      "Worked dataplate: Model ECF26 · Serial EF26-778899 · Mfd 02/2024 · Install 03/2024. Indoor electric CF → Efinity path (60°C domestic ceiling).",
  },
  {
    id: "ghf-solar",
    title: "Solar hot water",
    caption:
      "Solar collectors / cylinders / gas boosters. Use Solar in the tool. GHF gas storage is outside HW families → grey card (manager or 1300).",
    attribution:
      "Rinnai AU catalogue + Bible unit shot · offline in public/assets/process-family-examples/ghf-solar/",
    dataplateExample:
      "Worked dataplate (solar booster): Model REU-V2632FFUC · Serial S20-334455 · Install 10/2020 on Rinnai solar. That is a solar-boost continuous flow — pick Solar hot water (or Gas CF → Demand Duo / Rinnai-converted).",
  },
  {
    id: "commercial",
    title: "Demand Duo / manifold pack",
    caption:
      "Full Demand Duo setups, DD racks, and HD manifold packs — not a lone continuous-flow heater. Commercial pack path in the tool.",
    attribution:
      "Rinnai AU catalogue + SM cover · offline in public/assets/process-family-examples/commercial/",
    dataplateExample:
      "Worked dataplate (Demand Duo): Model Demand Duo 1 · tank + HD200e on the skid · Serial DD1-556677 · Install 09/2022. That is a commercial pack — pick Demand Duo / manifold / QRE, not standalone Gas continuous flow.",
  },
];

/**
 * @param {string|null|undefined} familyId
 * @returns {FamilyExamplePack}
 */
export function getFamilyExamplePack(familyId) {
  const raw = String(familyId || "");
  const id = FAMILY_EXAMPLE_ALIASES[raw] || raw;
  const hit = PROCESS_FAMILY_EXAMPLE_PACKS.find((p) => p.id === id);
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
