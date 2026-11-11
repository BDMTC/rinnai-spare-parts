/**
 * Catalogue boot loader for npm run build:file (double-click / file://).
 * JSON is baked into the IIFE bundle — Chrome/Edge block fetch under file:.
 */
import { loadBundledBootData } from "./boot-data-bundled.js";

export function publicUrl(relPath) {
  const cleaned = String(relPath || "").replace(/^\//, "");
  return new URL(cleaned, document.baseURI).href;
}

/** @returns {Promise<ReturnType<typeof loadBundledBootData>>} */
export async function loadBootData() {
  return loadBundledBootData();
}
