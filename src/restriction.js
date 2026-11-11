/**
 * Column D (Description 2) restriction flags for REU model history.
 *
 * Restricted kinds (Beau):
 *   - nla / no longer available / unavailable
 *   - export only / overseas market only
 *   - use-up / nil stock / runout (treat as NLA after use-up)
 *   - only for xyz / customer-only
 *
 * Soft "USE X WHEN NLA" pointers on still-stocked SKUs are NOT restricted.
 */

/**
 * @param {string|null|undefined} description2
 * @returns {{ kind: string, label: string, summary: string }|null}
 */
export function classifyModelRestriction(description2) {
  const raw = String(description2 || "").trim();
  if (!raw) return null;

  const t = raw
    .toUpperCase()
    .replace(/[*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  if (/\bONLY\s+FOR\b/.test(t) || /\bCUSTOMER[\s-]?ONLY\b/.test(t)) {
    return {
      kind: "customer-only",
      label: "Customer-only",
      summary: raw,
    };
  }

  if (
    /\bEXPORT\s+ONLY\b/.test(t) ||
    /\bOVERSEAS(\s+MARKET)?(\s+ONLY)?\b/.test(t)
  ) {
    return {
      kind: "export-only",
      label: "Export only",
      summary: raw,
    };
  }

  if (
    /\bUSE[\s-]?UP\b/.test(t) ||
    /\bNIL\s+STOCK\b/.test(t) ||
    /\bAFTER\s+RUNOUT\b/.test(t) ||
    /\bRUN[\s-]?OUT\b/.test(t)
  ) {
    return {
      kind: "use-up",
      label: "Use-up / NLA",
      summary: raw,
    };
  }

  // "WHEN NLA PLS USE X" on this row → unit is on the NLA path.
  if (/^WHEN\s+NLA\b/.test(t)) {
    return {
      kind: "nla",
      label: "No longer available",
      summary: raw,
    };
  }

  // "USE X WHEN NLA" — fallback pointer; this SKU is not marked restricted yet.
  if (isUseWhenNlaPointer(t)) {
    return null;
  }

  if (
    /\bNLA\b/.test(t) ||
    /\bUNAVAILABLE\b/.test(t) ||
    /\bNOT\s+AVAILABLE\b/.test(t)
  ) {
    return {
      kind: "nla",
      label: "No longer available",
      summary: raw,
    };
  }

  return null;
}

/**
 * @param {string} t uppercased Description 2 without asterisks
 */
function isUseWhenNlaPointer(t) {
  if (!/\bWHEN\s+NLA\b/.test(t)) return false;
  if (/^NLA\b/.test(t)) return false;
  if (/\bNLA\s*[,:]/.test(t)) return false;
  if (/\bNLA\s+-\s/.test(t)) return false;
  if (/\bNLA\s+(USE|PLS|PLEASE|REPLACE|REPLACEMENT)\b/.test(t)) return false;
  // e.g. USE HD28IL42 WHEN NLA / USE INF32EN60A WHEN NLA
  return /\bUSE\b.+\bWHEN\s+NLA\b/.test(t);
}

/**
 * Apply restriction fields onto a model row (mutates and returns).
 * @param {object} model
 */
export function applyModelRestrictionFields(model) {
  const hit = classifyModelRestriction(
    model?.description2 || model?.notes || null
  );
  if (!hit) {
    model.restricted = false;
    model.restrictionKind = null;
    model.restrictionLabel = null;
    return model;
  }
  model.restricted = true;
  model.restrictionKind = hit.kind;
  model.restrictionLabel = hit.label;
  return model;
}

/**
 * @param {object|null|undefined} model
 */
export function isModelRestricted(model) {
  if (!model) return false;
  if (typeof model.restricted === "boolean") return model.restricted;
  return Boolean(classifyModelRestriction(model.description2 || model.notes));
}

/**
 * Restriction summary for a pin value (model id or series:…).
 * Series is restricted only when it has members and every member is restricted.
 * @param {object} catalogue
 * @param {object|null|undefined} seriesDoc
 * @param {string|null|undefined} pinValue
 * @param {{
 *   resolveModelPin?: Function,
 *   modelIdsForSeries?: Function,
 *   listSeries?: Function,
 * }} [helpers]
 */
export function restrictionForPin(catalogue, seriesDoc, pinValue, helpers = {}) {
  if (!pinValue) return null;

  if (String(pinValue).startsWith("series:")) {
    const sid = String(pinValue).slice("series:".length);
    const listSeries = helpers.listSeries;
    const modelIdsForSeries = helpers.modelIdsForSeries;
    const series =
      (listSeries ? listSeries(seriesDoc) : seriesDoc?.series || []).find(
        (s) => s.id === sid
      ) || null;
    if (!series || !modelIdsForSeries) {
      return null;
    }
    const ids = modelIdsForSeries(catalogue, series);
    const models = (catalogue?.models || []).filter((m) => ids.includes(m.id));
    if (!models.length) return null;
    if (!models.every(isModelRestricted)) return null;
    const kinds = [
      ...new Set(models.map((m) => m.restrictionKind).filter(Boolean)),
    ];
    const label =
      kinds.length === 1
        ? models.find((m) => m.restrictionKind === kinds[0])?.restrictionLabel ||
          "Restricted"
        : "Restricted";
    return {
      restricted: true,
      kind: kinds[0] || "nla",
      label,
      pinValue,
      series,
      model: null,
      models,
      summary: `${series.label} · all ${models.length} mapped models restricted`,
    };
  }

  const model = (catalogue?.models || []).find((m) => m.id === pinValue);
  if (!model || !isModelRestricted(model)) return null;
  return {
    restricted: true,
    kind: model.restrictionKind || "nla",
    label: model.restrictionLabel || "Restricted",
    pinValue,
    series: null,
    model,
    models: [model],
    summary: model.description2 || model.notes || model.restrictionLabel,
  };
}

function alnum(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Identity keys used to relate price-list rows to a model chassis.
 * Letter+digit only — bare capacity digits (2632, 2020) false-match dates/codes.
 * @param {object} model
 * @returns {string[]}
 */
export function modelIdentityKeys(model) {
  const keys = new Set();
  for (const field of ["marketingCode", "sku", "itemNumber"]) {
    const n = alnum(model?.[field]);
    if (n && n.length >= 4) keys.add(n);
  }
  const item = alnum(model?.itemNumber);
  // Strip leading REU: REUVRM2632WC50KN → VRM2632WC50KN; REUA1620… → A1620…
  if (item.startsWith("REU") && item.length > 6) {
    keys.add(item.slice(3));
  }
  // Chassis tokens with letters (VRM2632WC, VCM2837, AM3237, …).
  // Match embedded VRM/VCM/… even when the blob still has a REU prefix.
  for (const src of [item, alnum(model?.marketingCode), alnum(model?.sku)]) {
    if (!src) continue;
    const variants = [src];
    if (src.startsWith("REU") && src.length > 6) variants.push(src.slice(3));
    for (const blob of variants) {
      for (const m of blob.matchAll(
        /((?:VRM|VCM|VR|AM|KM|NB|N)\d{3,5}[A-Z0-9]*)/g
      )) {
        const token = m[1];
        if (token.length >= 5) keys.add(token);
        // Unit-class chassis: VRM2632WC50KN → VRM2632WC
        const chassis = token.match(
          /^((?:VRM|VCM|VR|AM|KM|NB|N)\d{3,5}(?:WCAK|FFUDC|FFUC|FFUG|FFUD|FFC|FFU|WDC|WC|WD|WG))/
        );
        if (chassis && chassis[1].length >= 5) keys.add(chassis[1]);
        // Platform without unit class: VCM2837FFUC → VCM2837
        const platform = token.match(/^((?:VRM|VCM|VR|AM|KM|NB|N)\d{3,5})/);
        if (platform && platform[1].length >= 5) keys.add(platform[1]);
      }
    }
  }
  return [...keys].filter(
    (k) => k.length >= 4 && /[A-Z]/.test(k) && /\d/.test(k)
  );
}

/**
 * Chassis-like tokens from a part description (same idea as search.js).
 * @param {string} text
 * @returns {string[]}
 */
function extractPartChassisTokens(text) {
  const bits = String(text || "")
    .toUpperCase()
    .split(/[\s,/|]+/)
    .filter(Boolean);
  const out = [];
  for (const bit of bits) {
    const n = alnum(bit);
    if (n.length < 4) continue;
    if (!/\d/.test(n) || !/[A-Z]/.test(n)) continue;
    out.push(n);
  }
  return [...new Set(out)];
}

/**
 * @param {object} part
 * @returns {string}
 */
function partHaystack(part) {
  return alnum(
    [part?.name, part?.code, ...(part?.aliases || [])].filter(Boolean).join(" ")
  );
}

/**
 * Does a part description appear to relate to this model chassis?
 * Exact chassis-token match against model keys (avoids VR2626WG ⊂ VR2626WGP).
 * @param {object} part
 * @param {object} model
 */
export function partRelatesToModel(part, model) {
  const tokens = new Set(
    extractPartChassisTokens(
      [part?.name, ...(part?.aliases || [])].filter(Boolean).join(" ")
    )
  );
  const hay = partHaystack(part);
  for (const key of modelIdentityKeys(model)) {
    if (tokens.has(key)) return true;
    // Marketing codes often appear as their own token or inside the blob
    if (
      key.length >= 5 &&
      /^[A-Z]{1,6}\d/.test(key) &&
      !/^(VRM|VCM|VR|AM|KM|NB|REU)/.test(key) &&
      hay.includes(key)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Key ownership for gate decisions.
 * Exclusive = only restricted models own the key (shared platforms stay open).
 * @param {object[]} models
 */
function buildRestrictionKeyIndex(models) {
  /** @type {Map<string, { restrictedIds: string[], unrestricted: number }>} */
  const owners = new Map();
  /** @type {Map<string, object>} */
  const byId = new Map();

  for (const model of models) {
    byId.set(model.id, model);
    for (const key of modelIdentityKeys(model)) {
      let entry = owners.get(key);
      if (!entry) {
        entry = { restrictedIds: [], unrestricted: 0 };
        owners.set(key, entry);
      }
      if (isModelRestricted(model)) entry.restrictedIds.push(model.id);
      else entry.unrestricted += 1;
    }
  }

  /** @type {Map<string, string[]>} */
  const exclusive = new Map();
  /** @type {Set<string>} */
  const openKeys = new Set();
  for (const [key, entry] of owners) {
    if (entry.unrestricted > 0) openKeys.add(key);
    else if (entry.restrictedIds.length) {
      exclusive.set(key, entry.restrictedIds);
    }
  }
  return { exclusive, openKeys, byId };
}

/**
 * Session gate: hide parts whose chassis/marketing keys are exclusive to
 * locked restricted models. Shared platforms with live AU stock stay visible.
 *
 * @param {object} catalogue
 * @param {{
 *   unlockedPinValues?: Set<string>|string[],
 *   activePinValue?: string|null,
 *   activeModelIds?: string[],
 * }} [gate]
 * @returns {(part: object) => boolean}
 */
export function makePartVisibilityFilter(catalogue, gate = {}) {
  const models = catalogue?.models || [];
  const { exclusive, openKeys, byId } = buildRestrictionKeyIndex(models);
  const exclusiveKeys = [...exclusive.keys()].sort(
    (a, b) => b.length - a.length
  );

  const unlockedPins = new Set(
    [...(gate.unlockedPinValues || [])].map(String).filter(Boolean)
  );
  const activePin = gate.activePinValue ? String(gate.activePinValue) : null;
  const activeIds = new Set((gate.activeModelIds || []).map(String));

  /** Model ids whose exclusive parts are allowed through right now. */
  const unlockedModelIds = new Set();
  for (const model of models) {
    if (!isModelRestricted(model)) continue;
    if (!unlockedPins.has(model.id)) continue;
    if (!activePin) continue;
    if (activePin === model.id || activeIds.has(model.id)) {
      unlockedModelIds.add(model.id);
    }
  }
  if (
    activePin &&
    activePin.startsWith("series:") &&
    unlockedPins.has(activePin)
  ) {
    for (const id of activeIds) {
      const model = byId.get(id);
      if (model && isModelRestricted(model)) unlockedModelIds.add(id);
    }
  }

  function tokenMatchesKey(tokens, hay, key) {
    if (tokens.includes(key)) return true;
    // Marketing / SKU blob match (not chassis prefixes — avoids VR2626WG⊂WGP)
    if (
      key.length >= 5 &&
      /^[A-Z]{1,6}\d/.test(key) &&
      !/^(VRM|VCM|VR|AM|KM|NB|REU)/.test(key) &&
      hay.includes(key)
    ) {
      return true;
    }
    return false;
  }

  return function isPartVisible(part) {
    const tokens = extractPartChassisTokens(
      [part?.name, ...(part?.aliases || [])].filter(Boolean).join(" ")
    );
    const hay = partHaystack(part);
    if (!tokens.length && !hay) return true;

    // Any token owned by live/unrestricted stock → keep in default catalogue
    for (const token of tokens) {
      if (openKeys.has(token)) return true;
    }

    /** @type {string[]} */
    let hitRestrictedIds = [];
    for (const key of exclusiveKeys) {
      if (!tokenMatchesKey(tokens, hay, key)) continue;
      hitRestrictedIds = exclusive.get(key) || [];
      break;
    }

    if (!hitRestrictedIds.length) return true;
    return hitRestrictedIds.some((id) => unlockedModelIds.has(id));
  };
}

/**
 * Human copy for the confirm dialog.
 * @param {{ label?: string, kind?: string, summary?: string, model?: object|null, series?: object|null }} info
 */
export function restrictionWarningCopy(info) {
  const unit =
    info?.series?.label ||
    info?.model?.sku ||
    info?.model?.marketingCode ||
    "This unit";
  const kindLabel = info?.label || "restricted";
  return {
    title: "Restricted unit",
    body: `${unit} is marked ${kindLabel.toLowerCase()} in model history (Description 2). It is no longer general AU stock — or is export / customer-only / use-up. Are you sure this is the unit you want?`,
    detail: info?.summary || info?.model?.description2 || null,
    confirmLabel: "Yes, use this unit",
    cancelLabel: "No, cancel",
  };
}
