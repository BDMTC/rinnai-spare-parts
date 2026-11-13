/**
 * Pin 1 — Type of system (ruling class).
 *
 * For now CF units group under Continuous Flow Hot Water Systems.
 * Flashing Everything sits at the bottom of the list (not default) and
 * overrides Pins 2–3: search every part by the search term only.
 */

/** @typedef {{ id: string, value: string, label: string, subtitle: string, kind: 'system'|'everything', flash?: boolean }} SystemType */

/** @type {SystemType[]} */
export const SYSTEM_TYPES = [
  {
    id: "continuous-flow-hot-water",
    value: "system:continuous-flow-hot-water",
    label: "Continuous Flow Hot Water Systems",
    subtitle: "CF / Infinity / HD / REU continuous-flow hot water",
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
  return SYSTEM_TYPES.find((t) => t.value === v || t.id === v) || null;
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
 * Today every series-aliases entry is Continuous Flow — expand later.
 * @param {object|null|undefined} series
 * @param {string|null|undefined} systemTypeId
 */
export function seriesBelongsToSystemType(series, systemTypeId) {
  if (!series || !systemTypeId) return false;
  const id = String(systemTypeId).toLowerCase();
  if (id === "everything") return false;
  if (id === "continuous-flow-hot-water") {
    // Explicit tag when present; otherwise all current series are CF.
    const tagged = series.systemType || series.systemTypes;
    if (Array.isArray(tagged) && tagged.length) {
      return tagged.map((t) => String(t).toLowerCase()).includes(id);
    }
    if (typeof tagged === "string" && tagged) {
      return String(tagged).toLowerCase() === id;
    }
    return true;
  }
  return false;
}

/**
 * Pin 1 suggestions — CF first, flashing Everything always last when empty/matching.
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 */
export function suggestSystemTypePins(query, opts = {}) {
  const limit = opts.limit ?? 8;
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
    } else if (tokens.includes(q) || t.label.toLowerCase().includes(query.trim().toLowerCase())) {
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

  // Non-Everything by score, then Everything always at the bottom of the list.
  const normal = results
    .filter((r) => r.kind !== "everything")
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const everything = results.filter((r) => r.kind === "everything");
  return [...normal, ...everything].slice(0, limit);
}

/**
 * @param {string|null|undefined} pinValue
 */
export function labelForSystemTypeValue(pinValue) {
  const t = systemTypeFromValue(pinValue);
  return t?.label || "";
}
