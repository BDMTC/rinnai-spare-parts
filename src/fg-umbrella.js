/**
 * Finished-goods dual-fuel umbrellas (N/L packs, “Natural Gas or LPG” names).
 * These are not orderable — resolve to concrete N or L after the tech picks fuel.
 */

/** @typedef {{ orderCode?: string, name?: string, netExGst?: number }} FgUmbrellaItem */

/**
 * @param {FgUmbrellaItem|null|undefined} it
 */
export function isFgUmbrellaItem(it) {
  const c = String(it?.orderCode || "");
  const n = String(it?.name || "");
  return (
    /N\s*\/\s*L/i.test(c) ||
    /Natural\s+Gas\s+or\s+LPG/i.test(n) ||
    /Nat\s*Gas\s+or\s+LPG/i.test(n) ||
    /\bN\s*\/\s*L\b/i.test(n)
  );
}

/**
 * @param {string} orderCode
 * @param {"N"|"L"} fuel
 */
export function resolveFgUmbrellaOrderCode(orderCode, fuel) {
  if (fuel !== "N" && fuel !== "L") return String(orderCode || "");
  return String(orderCode || "").replace(/N\s*\/\s*L/gi, fuel);
}

/**
 * Single-fuel name; strip unused umbrella brackets / letters.
 * @param {string} name
 * @param {"N"|"L"} fuel
 */
export function resolveFgUmbrellaName(name, fuel) {
  const label = fuel === "L" ? "LPG" : fuel === "N" ? "Natural Gas" : "";
  if (!label) return String(name || "").trim();
  let s = String(name || "").trim();
  // Drop bracketed umbrella SKUs: (MP228EMN/L)
  s = s.replace(/\s*\([^)]*N\s*\/\s*L[^)]*\)/gi, "");
  s = s.replace(/Natural\s+Gas\s+or\s+LPG/gi, label);
  s = s.replace(/Nat\s*Gas\s+or\s+LPG/gi, label);
  s = s.replace(/\bN\s*\/\s*L\b/gi, label);
  s = s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
  return s;
}

/**
 * @template {FgUmbrellaItem} T
 * @param {T} it
 * @param {"N"|"L"} fuel
 * @returns {T}
 */
export function resolveFgUmbrellaItem(it, fuel) {
  return {
    ...it,
    orderCode: resolveFgUmbrellaOrderCode(it.orderCode || "", fuel),
    name: resolveFgUmbrellaName(it.name || "", fuel),
  };
}
