/**
 * Pin 1 — Type of system (ruling class).
 *
 * Locked classes (Beau 2026-11-13 / RSP-112). Flashing Everything sits at
 * the bottom of the list (not default) and overrides Pins 2–3: search every
 * part by the search term only.
 */

/** @typedef {{ id: string, value: string, label: string, subtitle: string, kind: 'system'|'everything', flash?: boolean }} SystemType */

/** Provisional → production id (RSP-109 pending:* keys). */
export const PENDING_SYSTEM_TYPE_MAP = {
  "pending:hotflo-electric-storage": "hotflo-electric-storage",
  "pending:gas-storage-hot-water": "gas-storage-hot-water",
  "pending:heat-pump-hot-water": "heat-pump-hot-water",
  "pending:commercial-heat-pump": "commercial-heat-pump",
  "pending:demand-duo": "demand-duo",
  "pending:electric-continuous-flow": "electric-continuous-flow",
  "pending:solar-hot-water": "solar-hot-water",
};

/**
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function normalizeSystemTypeId(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^system:/, "");
  if (!v) return "";
  if (PENDING_SYSTEM_TYPE_MAP[v]) return PENDING_SYSTEM_TYPE_MAP[v];
  if (v.startsWith("pending:")) return v.slice("pending:".length);
  return v;
}

/** @type {SystemType[]} */
export const SYSTEM_TYPES = [
  {
    id: "continuous-flow-hot-water",
    value: "system:continuous-flow-hot-water",
    label: "Continuous Flow Hot Water Systems",
    subtitle: "CF / Infinity / HD / REU / FM10 continuous-flow hot water",
    kind: "system",
  },
  {
    id: "hotflo-electric-storage",
    value: "system:hotflo-electric-storage",
    label: "Hotflo Electric Storage Hot Water Systems",
    subtitle: "Hotflo EHF / EHFA / EHFD electric storage",
    kind: "system",
  },
  {
    id: "gas-storage-hot-water",
    value: "system:gas-storage-hot-water",
    label: "Gas Storage Hot Water Systems",
    subtitle: "GHF gas storage hot water",
    kind: "system",
  },
  {
    id: "heat-pump-hot-water",
    value: "system:heat-pump-hot-water",
    label: "Heat Pump Hot Water Systems",
    subtitle: "Domestic Enviroflo / EHPA / EHPG / EHPT / EHPS",
    kind: "system",
  },
  {
    id: "commercial-heat-pump",
    value: "system:commercial-heat-pump",
    label: "Commercial Heat Pump Hot Water Systems",
    subtitle: "CHP commercial heat pump",
    kind: "system",
  },
  {
    id: "demand-duo",
    value: "system:demand-duo",
    label: "Demand Duo",
    subtitle: "Demand Duo commercial valves / packs / stats",
    kind: "system",
  },
  {
    id: "electric-continuous-flow",
    value: "system:electric-continuous-flow",
    label: "Electric Continuous Flow Hot Water Systems",
    subtitle: "Efinity ECF electric continuous-flow",
    kind: "system",
  },
  {
    id: "solar-hot-water",
    value: "system:solar-hot-water",
    label: "Solar Hot Water Systems",
    subtitle: "Solar split SG tanks",
    kind: "system",
  },
  {
    id: "everything",
    value: "system:everything",
    label: "Everything",
    subtitle: "Overrides other pins — search every part by term only",
    kind: "everything",
    flash: true,
  },
];

/**
 * @param {string|null|undefined} value
 * @returns {SystemType|null}
 */
export function systemTypeFromValue(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  const id = normalizeSystemTypeId(v);
  return (
    SYSTEM_TYPES.find((t) => t.value === v || t.id === v || t.id === id) || null
  );
}

/**
 * @param {string|null|undefined} value
 */
export function isEverythingSystem(value) {
  const t = systemTypeFromValue(value);
  return Boolean(t && t.kind === "everything");
}

/**
 * @param {string|null|undefined} value
 */
export function isScopedSystem(value) {
  const t = systemTypeFromValue(value);
  return Boolean(t && t.kind === "system");
}

/**
 * Does a series belong under this system class?
 * Explicit series.systemType / systemTypes win. Untagged series stay under
 * Continuous Flow (legacy CF catalogue). pending:* tags map to locked ids.
 * @param {object|null|undefined} series
 * @param {string|null|undefined} systemTypeId
 */
export function seriesBelongsToSystemType(series, systemTypeId) {
  if (!series || !systemTypeId) return false;
  const id = normalizeSystemTypeId(systemTypeId);
  if (!id || id === "everything") return false;

  const tagged = series.systemType || series.systemTypes;
  const tags = Array.isArray(tagged)
    ? tagged.map((t) => normalizeSystemTypeId(t)).filter(Boolean)
    : typeof tagged === "string" && tagged
      ? [normalizeSystemTypeId(tagged)].filter(Boolean)
      : [];

  if (tags.length) return tags.includes(id);

  // Untagged = Continuous Flow only (pre-RSP-95 CF series).
  return id === "continuous-flow-hot-water";
}

/**
 * Pin 1 suggestions — scoped types first, flashing Everything always last.
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 */
export function suggestSystemTypePins(query, opts = {}) {
  // Enough room for every locked class + Everything.
  const limit = opts.limit ?? 16;
  const q = String(query || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  /** @type {Array<object>} */
  const results = [];
  for (const t of SYSTEM_TYPES) {
    const tokens = [t.id, t.label, t.subtitle, t.kind]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    let score = 0;
    if (!q) {
      score = t.kind === "everything" ? 1 : 10;
    } else if (
      tokens.includes(q) ||
      t.label.toLowerCase().includes(query.trim().toLowerCase())
    ) {
      score = tokens.startsWith(q) ? 80 : 55;
      if (t.kind === "everything" && "everything".startsWith(q)) score = 90;
    } else {
      continue;
    }
    results.push({
      kind: t.kind === "everything" ? "everything" : "system",
      value: t.value,
      label: t.label,
      subtitle: t.subtitle,
      systemType: t,
      flash: Boolean(t.flash),
      restricted: false,
      score,
    });
  }

  // Empty query: keep SYSTEM_TYPES declaration order (CF first).
  // Typed query: rank by score, then label. Everything always last.
  const normal = results.filter((r) => r.kind !== "everything");
  if (q) {
    normal.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }
  const everything = results.filter((r) => r.kind === "everything");
  const normalLimit = everything.length
    ? Math.max(0, limit - everything.length)
    : limit;
  return [...normal.slice(0, normalLimit), ...everything];
}

/**
 * @param {string|null|undefined} pinValue
 */
export function labelForSystemTypeValue(pinValue) {
  const t = systemTypeFromValue(pinValue);
  return t?.label || "";
}
