/**
 * Lazy OCR loader — script-tags assets/ocr/* only on dataplate drop.
 * Never import tesseract.js here (keeps it out of the file:// IIFE app.js).
 */

let bridgePromise = null;

function resolveOcrBridgeUrl() {
  const scripts = document.getElementsByTagName("script");
  for (let i = scripts.length - 1; i >= 0; i--) {
    const src = scripts[i].src || "";
    // file:// / built: …/assets/app.js → …/assets/ocr/ocr-bridge.js
    if (/\/assets\/app[^/]*\.js/i.test(src)) {
      try {
        return new URL("ocr/ocr-bridge.js", src).href;
      } catch {
        /* fall through */
      }
    }
  }
  // Vite dev serves public/ at site root
  if (/^https?:/i.test(location.protocol)) {
    return `${location.origin}/assets/ocr/ocr-bridge.js`;
  }
  try {
    return new URL("assets/ocr/ocr-bridge.js", location.href).href;
  } catch {
    return "./assets/ocr/ocr-bridge.js";
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-rsp-ocr-bridge="1"]`);
    if (existing) {
      if (window.__RSP_OCR__?.__ready) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.rspOcrBridge = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`OCR sidecar missing: ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * Load ocr-bridge.js (which pulls eng/core/worker/tesseract on demand).
 * @returns {Promise<object>}
 */
export function ensureDataplateOcr() {
  if (window.__RSP_OCR__?.__ready) {
    return Promise.resolve(window.__RSP_OCR__);
  }
  if (bridgePromise) return bridgePromise;
  const url = resolveOcrBridgeUrl();
  bridgePromise = loadScript(url)
    .then(() => {
      if (!window.__RSP_OCR__?.__ready) {
        throw new Error("OCR bridge loaded but API missing");
      }
      return window.__RSP_OCR__;
    })
    .catch((err) => {
      bridgePromise = null;
      throw err;
    });
  return bridgePromise;
}

/**
 * @param {Blob|File|HTMLCanvasElement|HTMLImageElement|ImageBitmap|string} image
 * @param {(m: object) => void} [onProgress]
 * @returns {Promise<string>}
 */
export async function recognizeDataplateImage(image, onProgress) {
  const api = await ensureDataplateOcr();
  return api.recognize(image, onProgress);
}
