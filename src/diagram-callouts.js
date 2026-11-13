/**
 * Normalized ED callout boxes for lightbox highlight (file:// safe import).
 */
import calloutDoc from "../public/data/diagram-callouts.json";

/**
 * @param {string|null|undefined} diagramPage
 * @returns {string|null}
 */
function pageKey(diagramPage) {
  const raw = String(diagramPage || "").trim();
  if (!raw) return null;
  // Already an asset key: edpl-reu-vrm2632wc__p5
  if (/^[a-z0-9-]+__p\d+$/i.test(raw)) return raw.toLowerCase();
  const m = raw.match(/^(.+?)\s+p(\d+)\s*$/i);
  if (!m) {
    return (
      raw
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || null
    );
  }
  const stem = m[1]
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stem ? `${stem}__p${m[2]}` : null;
}

/**
 * @param {string|null|undefined} pageKeyOrLabel  asset key or "….pdf pN"
 * @param {string|null|undefined} callout
 * @returns {{ x: number, y: number, w: number, h: number }|null}
 */
export function resolveCalloutBox(pageKeyOrLabel, callout) {
  const raw = callout != null ? String(callout).trim() : "";
  if (!raw) return null;
  const key =
    pageKey(pageKeyOrLabel) ||
    String(pageKeyOrLabel || "")
      .trim()
      .toLowerCase();
  if (!key) return null;
  const page = calloutDoc?.pages?.[key];
  if (!page?.callouts) return null;
  const box = page.callouts[raw] || page.callouts[raw.replace(/^0+/, "")] || null;
  if (!box) return null;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w);
  const h = Number(box.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return { x, y, w, h };
}
