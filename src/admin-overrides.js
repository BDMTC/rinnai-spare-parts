/**
 * Local admin overrides for the Rinnai parts catalogue.
 *
 * Runtime: localStorage overlay (flag / suspend / delete + optional price patch).
 * Intent queue: records what Beau asked for so AI / ingest can sync production JSON later.
 * Admin unlock uses a baked PBKDF2 hash only — never store plaintext password in git.
 */

export const OVERRIDES_STORAGE_KEY = "rinnai-parts-overrides-v1";
export const ADMIN_SESSION_STORAGE_KEY = "rinnai-parts-admin-session-v1";
export const PRICE_LIST_PATH_STORAGE_KEY = "rinnai-parts-price-list-path-v1";

/** Fixed app salt for admin password PBKDF2 (not a secret). */
export const ADMIN_PASSWORD_SALT = "mtc-rinnai-admin-gate-v1";
export const ADMIN_PASSWORD_ITERATIONS = 120000;
export const ADMIN_PASSWORD_BITS = 256;
/** PBKDF2-SHA-256 hex digest of the admin password with ADMIN_PASSWORD_SALT. */
export const ADMIN_PASSWORD_HASH_HEX =
  "6517a2cce8ca3ef7be45f4d47405b8c8ebee1c7c79ecdfbea11e22cbde53e8b6";

/**
 * @typedef {{
 *   flagged: Record<string, { code: string, title: string, flaggedAt: string, note?: string }>,
 *   suspended: Record<string, { code: string, title?: string, suspendedAt: string }>,
 *   deleted: Record<string, { code: string, title?: string, deletedAt: string }>,
 *   pricePatch: null | {
 *     appliedAt: string,
 *     sourceFile: string,
 *     parts: object[],
 *     meta?: object,
 *     skippedCodes?: string[],
 *   },
 *   changeQueue: Array<{
 *     id: string,
 *     at: string,
 *     action: string,
 *     code?: string,
 *     title?: string,
 *     detail?: string,
 *     synced?: boolean,
 *   }>,
 * }} AdminOverrides
 */

/**
 * @returns {AdminOverrides}
 */
export function emptyOverrides() {
  return {
    flagged: {},
    suspended: {},
    deleted: {},
    pricePatch: null,
    changeQueue: [],
  };
}

/**
 * @returns {AdminOverrides}
 */
export function loadOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (!raw) return emptyOverrides();
    const parsed = JSON.parse(raw);
    return {
      flagged: parsed?.flagged && typeof parsed.flagged === "object" ? parsed.flagged : {},
      suspended:
        parsed?.suspended && typeof parsed.suspended === "object"
          ? parsed.suspended
          : {},
      deleted:
        parsed?.deleted && typeof parsed.deleted === "object" ? parsed.deleted : {},
      pricePatch: parsed?.pricePatch || null,
      changeQueue: Array.isArray(parsed?.changeQueue) ? parsed.changeQueue : [],
    };
  } catch {
    return emptyOverrides();
  }
}

/**
 * @param {AdminOverrides} overrides
 */
export function saveOverrides(overrides) {
  localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {string} a
 * @param {string} b
 */
function timingSafeEqualHex(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const len = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Derive PBKDF2-SHA-256 hex of an unlock attempt (Web Crypto).
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashAdminPassword(password) {
  const enc = new TextEncoder();
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto is required for admin unlock.");
  }
  const keyMaterial = await subtle.importKey(
    "raw",
    enc.encode(String(password ?? "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(ADMIN_PASSWORD_SALT),
      iterations: ADMIN_PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    ADMIN_PASSWORD_BITS
  );
  return bufferToHex(bits);
}

export function isAdminSessionUnlocked() {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminSessionUnlocked(unlocked) {
  try {
    if (unlocked) sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, "1");
    else sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Compare hashed attempt to the baked-in admin password hash.
 * @param {string} attempt
 * @returns {Promise<{ ok: boolean }>}
 */
export async function tryUnlockAdmin(attempt) {
  try {
    const hashed = await hashAdminPassword(attempt);
    if (timingSafeEqualHex(hashed, ADMIN_PASSWORD_HASH_HEX)) {
      setAdminSessionUnlocked(true);
      return { ok: true };
    }
  } catch {
    /* treat crypto failures as failed unlock */
  }
  return { ok: false };
}

/**
 * @param {object|null} config
 */
export function loadPriceListPath(config) {
  try {
    const stored = localStorage.getItem(PRICE_LIST_PATH_STORAGE_KEY);
    if (stored != null && stored !== "") return stored;
  } catch {
    /* ignore */
  }
  return (
    config?.priceList?.workbookPath ||
    config?.priceList?.endpoint ||
    config?.priceList?.workbookFile ||
    ""
  );
}

/**
 * @param {string} path
 */
export function savePriceListPath(path) {
  localStorage.setItem(PRICE_LIST_PATH_STORAGE_KEY, String(path ?? ""));
}

function nowIso() {
  return new Date().toISOString();
}

function queueId() {
  return `chg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {AdminOverrides} overrides
 * @param {{ action: string, code?: string, title?: string, detail?: string }} entry
 */
export function enqueueChange(overrides, entry) {
  const next = {
    ...overrides,
    changeQueue: [
      {
        id: queueId(),
        at: nowIso(),
        action: entry.action,
        code: entry.code || undefined,
        title: entry.title || undefined,
        detail: entry.detail || undefined,
        synced: false,
      },
      ...overrides.changeQueue,
    ].slice(0, 200),
  };
  return next;
}

/**
 * @param {AdminOverrides} overrides
 * @param {{ code: string, title?: string, note?: string }} part
 */
export function flagPart(overrides, part) {
  const code = String(part.code || "").trim();
  if (!code) return overrides;
  const key = code.toUpperCase();
  let next = {
    ...overrides,
    flagged: {
      ...overrides.flagged,
      [key]: {
        code,
        title: part.title || part.name || code,
        flaggedAt: nowIso(),
        note: part.note || "",
      },
    },
  };
  next = enqueueChange(next, {
    action: "flag",
    code,
    title: part.title || part.name || code,
    detail: "Flagged for problem review (local + mailto)",
  });
  return next;
}

/**
 * @param {AdminOverrides} overrides
 * @param {string} code
 */
export function clearFlag(overrides, code) {
  const key = String(code || "").trim().toUpperCase();
  if (!key || !overrides.flagged[key]) return overrides;
  const prev = overrides.flagged[key];
  const flagged = { ...overrides.flagged };
  delete flagged[key];
  return enqueueChange(
    { ...overrides, flagged },
    {
      action: "unflag",
      code: prev.code,
      title: prev.title,
      detail: "Cleared flagged status (local override)",
    }
  );
}

/**
 * @param {AdminOverrides} overrides
 * @param {{ code: string, title?: string }} part
 */
export function suspendPart(overrides, part) {
  const code = String(part.code || "").trim();
  if (!code) return overrides;
  const key = code.toUpperCase();
  let next = {
    ...overrides,
    suspended: {
      ...overrides.suspended,
      [key]: {
        code,
        title: part.title || part.name || code,
        suspendedAt: nowIso(),
      },
    },
  };
  next = enqueueChange(next, {
    action: "suspend",
    code,
    title: part.title || part.name || code,
    detail: "Suspended from normal search until unsuspended",
  });
  return next;
}

/**
 * @param {AdminOverrides} overrides
 * @param {string} code
 */
export function unsuspendPart(overrides, code) {
  const key = String(code || "").trim().toUpperCase();
  if (!key || !overrides.suspended[key]) return overrides;
  const prev = overrides.suspended[key];
  const suspended = { ...overrides.suspended };
  delete suspended[key];
  return enqueueChange(
    { ...overrides, suspended },
    {
      action: "unsuspend",
      code: prev.code,
      title: prev.title,
      detail: "Restored to normal search listings",
    }
  );
}

/**
 * Soft-delete from active catalogue via override (does not rewrite prices.json).
 * @param {AdminOverrides} overrides
 * @param {{ code: string, title?: string }} part
 */
export function deletePartOverride(overrides, part) {
  const code = String(part.code || "").trim();
  if (!code) return overrides;
  const key = code.toUpperCase();
  const suspended = { ...overrides.suspended };
  delete suspended[key];
  const flagged = { ...overrides.flagged };
  delete flagged[key];
  let next = {
    ...overrides,
    deleted: {
      ...overrides.deleted,
      [key]: {
        code,
        title: part.title || part.name || code,
        deletedAt: nowIso(),
      },
    },
    suspended,
    flagged,
  };
  next = enqueueChange(next, {
    action: "delete",
    code,
    title: part.title || part.name || code,
    detail:
      "Deleted from active catalogue overlay — production JSON still needs agent ingest sync",
  });
  return next;
}

/**
 * @param {AdminOverrides} overrides
 * @param {string} code
 */
export function restoreDeletedPart(overrides, code) {
  const key = String(code || "").trim().toUpperCase();
  if (!key || !overrides.deleted[key]) return overrides;
  const prev = overrides.deleted[key];
  const deleted = { ...overrides.deleted };
  delete deleted[key];
  return enqueueChange(
    { ...overrides, deleted },
    {
      action: "restore-delete",
      code: prev.code,
      title: prev.title,
      detail: "Restored deleted part in local overlay",
    }
  );
}

/**
 * Apply a reviewed price import as a local catalogue patch.
 * @param {AdminOverrides} overrides
 * @param {{
 *   sourceFile: string,
 *   parts: object[],
 *   meta?: object,
 *   skippedCodes?: string[],
 * }} patch
 */
export function applyPricePatch(overrides, patch) {
  let next = {
    ...overrides,
    pricePatch: {
      appliedAt: nowIso(),
      sourceFile: patch.sourceFile || "import.xlsx",
      parts: patch.parts || [],
      meta: patch.meta || null,
      skippedCodes: patch.skippedCodes || [],
    },
  };
  next = enqueueChange(next, {
    action: "price-import",
    detail: `Imported ${patch.parts?.length ?? 0} parts from ${
      patch.sourceFile || "workbook"
    }; skipped ${patch.skippedCodes?.length ?? 0}. Sync via npm run ingest for production.`,
  });
  return next;
}

export function clearPricePatch(overrides) {
  if (!overrides.pricePatch) return overrides;
  return enqueueChange(
    { ...overrides, pricePatch: null },
    {
      action: "clear-price-patch",
      detail: "Cleared local price import overlay; base public/data JSON restored",
    }
  );
}

/**
 * Merge local overrides into the loaded catalogue (in memory).
 * Price patch replaces parts wholesale; delete/suspend filter search visibility.
 * @param {object} catalogue
 * @param {AdminOverrides} overrides
 */
export function applyOverridesToCatalogue(catalogue, overrides) {
  if (!catalogue) return catalogue;
  let parts = Array.isArray(catalogue.parts) ? catalogue.parts.slice() : [];

  if (overrides.pricePatch?.parts?.length) {
    parts = overrides.pricePatch.parts.map((p) => ({ ...p }));
  }

  const deleted = new Set(
    Object.keys(overrides.deleted || {}).map((k) => k.toUpperCase())
  );
  if (deleted.size) {
    parts = parts.filter((p) => !deleted.has(String(p.code || "").toUpperCase()));
  }

  // Annotate flagged / suspended for UI (still searchable when suspended? No — hide).
  const suspended = overrides.suspended || {};
  const flagged = overrides.flagged || {};
  parts = parts.map((p) => {
    const key = String(p.code || "").toUpperCase();
    const next = { ...p };
    if (flagged[key]) {
      next.adminFlagged = true;
      next.adminFlaggedAt = flagged[key].flaggedAt;
    }
    if (suspended[key]) {
      next.adminSuspended = true;
      next.adminSuspendedAt = suspended[key].suspendedAt;
    }
    return next;
  });

  // Suspended parts stay in overlay data for admin lists, but leave the live catalogue.
  const liveParts = parts.filter((p) => !p.adminSuspended);

  return {
    ...catalogue,
    parts: liveParts,
    meta: {
      ...(catalogue.meta || {}),
      partCount: liveParts.length,
      adminOverlay: true,
      adminSuspendedCount: Object.keys(suspended).length,
      adminDeletedCount: Object.keys(deleted).length,
      adminFlaggedCount: Object.keys(flagged).length,
      pricePatchApplied: Boolean(overrides.pricePatch),
    },
    _adminAllParts: parts,
  };
}

/**
 * Visibility filter that also hides suspended/deleted (defence in depth).
 * @param {AdminOverrides} overrides
 * @param {(part: object) => boolean} [baseFilter]
 */
export function makeAdminPartFilter(overrides, baseFilter) {
  const suspended = new Set(
    Object.keys(overrides.suspended || {}).map((k) => k.toUpperCase())
  );
  const deleted = new Set(
    Object.keys(overrides.deleted || {}).map((k) => k.toUpperCase())
  );
  return (part) => {
    const key = String(part?.code || "").toUpperCase();
    if (key && (suspended.has(key) || deleted.has(key))) return false;
    if (typeof baseFilter === "function" && !baseFilter(part)) return false;
    return true;
  };
}
