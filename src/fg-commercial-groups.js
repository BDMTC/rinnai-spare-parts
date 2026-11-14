/**
 * Group Commercial HW finished-goods rows into sheet-style subsections
 * (Demand Duo SKUs stay parked — not in this list).
 */

/** @typedef {{ orderCode?: string, name?: string, netExGst?: number, familyId?: string }} FgItem */

export const COMMERCIAL_FG_SECTIONS = [
  {
    id: "hd-cf",
    title: "Heavy Duty continuous flow",
    blurb: "HD28 / HD32 / HDC32 heaters (external & internal).",
  },
  {
    id: "flue",
    title: "Flueing & mandatory extras",
    blurb: "Internal flue parts (aluminium / polypropylene).",
  },
  {
    id: "manifold",
    title: "Manifold packs",
    blurb: "MP multi-heater packs (not Demand Duo).",
  },
  {
    id: "chp",
    title: "Commercial heat pumps",
    blurb: "CHP vertical / horizontal discharge units.",
  },
  {
    id: "qre",
    title: "Quick recovery electric tanks",
    blurb: "QRE stainless & vitreous enamel storage.",
  },
  {
    id: "tanks",
    title: "Storage tanks (horizontal / solar-ready)",
    blurb: "Horizontal and vitreous storage cylinders.",
  },
  {
    id: "solar",
    title: "Commercial solar collectors & kits",
    blurb: "Flat plate, evacuated tube, rails and mounts on the Commercial sheet.",
  },
  {
    id: "controls",
    title: "Controllers, valves & cascade",
    blurb: "MEC packs, PAM valve, cascade cables.",
  },
  {
    id: "other",
    title: "Other commercial",
    blurb: "Anything else on the Commercial sheet.",
  },
];

/**
 * @param {string} orderCode
 * @returns {string} section id
 */
export function commercialFgSectionId(orderCode) {
  const c = String(orderCode || "").trim().toUpperCase();
  if (!c) return "other";
  if (/^HDC?\d/.test(c) || /^HD\d/.test(c)) return "hd-cf";
  if (c.startsWith("FF")) return "flue";
  if (c.startsWith("MP")) return "manifold";
  if (c.startsWith("CHP")) return "chp";
  if (c.startsWith("QRE")) return "qre";
  if (c.startsWith("SH") || c.startsWith("SG")) return "tanks";
  if (
    c.startsWith("SP") ||
    c.startsWith("KDD") ||
    c.startsWith("EVT") ||
    /^\d{8}$/.test(c)
  ) {
    return "solar";
  }
  if (c.startsWith("MEC") || c.startsWith("PAM") || c.startsWith("CSAC")) {
    return "controls";
  }
  return "other";
}

/**
 * @param {FgItem[]} items
 * @returns {{ id: string, title: string, blurb: string, items: FgItem[] }[]}
 */
export function groupCommercialFgItems(items) {
  /** @type {Map<string, FgItem[]>} */
  const buckets = new Map(COMMERCIAL_FG_SECTIONS.map((s) => [s.id, []]));
  for (const it of items || []) {
    const id = commercialFgSectionId(it.orderCode);
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(it);
  }
  return COMMERCIAL_FG_SECTIONS.map((s) => ({
    ...s,
    items: buckets.get(s.id) || [],
  })).filter((s) => s.items.length > 0);
}
