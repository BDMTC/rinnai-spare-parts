/**
 * Build lazy OCR sidecar under public/assets/ocr/ (copied to dist by Vite).
 * Never imported into app.js — classic script tags only, on dataplate drop.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "assets", "ocr");
const cacheDir = path.join(root, "scripts", "ocr-cache");

const ENG_URL =
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
        reject(err);
      });
  });
}

function bridgeSource() {
  return `/* RSP OCR bridge — lazy sidecar, not part of app.js */
(function (global) {
  "use strict";
  if (global.__RSP_OCR__ && global.__RSP_OCR__.__ready) return;

  var workerRef = null;
  var loadPromise = null;

  function blobUrlFromText(text, mime) {
    return URL.createObjectURL(new Blob([text], { type: mime || "application/javascript" }));
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function sidecarBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (/assets\\/ocr\\/ocr-bridge\\.js/i.test(src)) {
        return src.replace(/ocr-bridge\\.js([?#].*)?$/i, "");
      }
    }
    try {
      return new URL("assets/ocr/", document.baseURI || location.href).href;
    } catch (e) {
      return "./assets/ocr/";
    }
  }

  function ensureAssets() {
    var base = sidecarBase();
    var chain = Promise.resolve();
    if (!global.Tesseract) {
      chain = chain.then(function () { return loadScript(base + "tesseract.min.js"); });
    }
    if (!global.__RSP_OCR_ENG_B64__) {
      chain = chain.then(function () { return loadScript(base + "ocr-eng.js"); });
    }
    if (!global.__RSP_OCR_CORE_JS__) {
      chain = chain.then(function () { return loadScript(base + "ocr-core.js"); });
    }
    if (!global.__RSP_OCR_WORKER_JS__) {
      chain = chain.then(function () { return loadScript(base + "ocr-worker.js"); });
    }
    return chain;
  }

  function buildWrappedWorkerSource() {
    var engB64 = global.__RSP_OCR_ENG_B64__;
    if (!engB64) throw new Error("OCR eng data missing");
    var workerSrc = global.__RSP_OCR_WORKER_JS__;
    if (!workerSrc) throw new Error("OCR worker source missing");
    return (
      "const __RSP_ENG_B64__=" + JSON.stringify(engB64) + ";" +
      "function __rspB64ToU8(b64){var bin=atob(b64);var o=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)o[i]=bin.charCodeAt(i);return o;}" +
      "const __RSP_ENG_U8__=__rspB64ToU8(__RSP_ENG_B64__);" +
      "const __rspFetch=self.fetch.bind(self);" +
      "self.fetch=function(url,opts){" +
      "  var u=String(url||'');" +
      "  if(/eng\\\\.traineddata/i.test(u)){" +
      "    return Promise.resolve(new Response(__RSP_ENG_U8__,{status:200,headers:{'Content-Type':'application/octet-stream'}}));" +
      "  }" +
      "  return __rspFetch(url,opts);" +
      "};" +
      workerSrc
    );
  }

  async function createOcrWorker(onProgress) {
    await ensureAssets();
    if (!global.Tesseract || typeof global.Tesseract.createWorker !== "function") {
      throw new Error("Tesseract UMD missing");
    }
    var coreUrl = blobUrlFromText(global.__RSP_OCR_CORE_JS__, "application/javascript");
    var workerUrl = blobUrlFromText(buildWrappedWorkerSource(), "application/javascript");
    return global.Tesseract.createWorker("eng", 1, {
      workerPath: workerUrl,
      workerBlobURL: false,
      corePath: coreUrl,
      langPath: "https://rsp-ocr.local",
      gzip: true,
      cacheMethod: "none",
      logger: function (m) {
        if (typeof onProgress === "function") onProgress(m);
      },
    });
  }

  async function getWorker(onProgress) {
    if (workerRef) return workerRef;
    if (loadPromise) return loadPromise;
    loadPromise = createOcrWorker(onProgress)
      .then(function (w) {
        workerRef = w;
        loadPromise = null;
        return w;
      })
      .catch(function (err) {
        loadPromise = null;
        throw err;
      });
    return loadPromise;
  }

  global.__RSP_OCR__ = {
    __ready: true,
    recognize: async function (image, onProgress) {
      var worker = await getWorker(onProgress);
      var result = await worker.recognize(image);
      return (result && result.data && result.data.text) || "";
    },
    terminate: async function () {
      if (workerRef) {
        try { await workerRef.terminate(); } catch (e) {}
        workerRef = null;
      }
    },
    warmup: function (onProgress) { return getWorker(onProgress); },
  };
})(typeof window !== "undefined" ? window : globalThis);
`;
}

async function main() {
  ensureDir(outDir);
  ensureDir(cacheDir);

  const tessMin = path.join(root, "node_modules/tesseract.js/dist/tesseract.min.js");
  const workerMin = path.join(root, "node_modules/tesseract.js/dist/worker.min.js");
  const coreJs = path.join(
    root,
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js"
  );
  const coreWasm = path.join(
    root,
    "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm"
  );

  for (const p of [tessMin, workerMin, coreJs]) {
    if (!fs.existsSync(p)) throw new Error(`Missing ${p} — run npm install`);
  }

  const engCache = path.join(cacheDir, "eng.traineddata.gz");
  if (!fs.existsSync(engCache)) {
    console.log("Downloading eng.traineddata.gz…");
    await download(ENG_URL, engCache);
  }
  fs.copyFileSync(engCache, path.join(outDir, "eng.traineddata.gz"));
  fs.copyFileSync(tessMin, path.join(outDir, "tesseract.min.js"));
  fs.copyFileSync(workerMin, path.join(outDir, "worker.min.js"));
  fs.copyFileSync(coreJs, path.join(outDir, "tesseract-core-simd-lstm.wasm.js"));
  if (fs.existsSync(coreWasm)) {
    fs.copyFileSync(coreWasm, path.join(outDir, "tesseract-core-simd-lstm.wasm"));
  }

  const engB64 = fs.readFileSync(engCache).toString("base64");
  const workerSrc = fs.readFileSync(workerMin, "utf8");
  const coreSrc = fs.readFileSync(coreJs, "utf8");

  fs.writeFileSync(
    path.join(outDir, "ocr-eng.js"),
    `window.__RSP_OCR_ENG_B64__=${JSON.stringify(engB64)};\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(outDir, "ocr-worker.js"),
    `window.__RSP_OCR_WORKER_JS__=${JSON.stringify(workerSrc)};\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(outDir, "ocr-core.js"),
    `window.__RSP_OCR_CORE_JS__=${JSON.stringify(coreSrc)};\n`,
    "utf8"
  );
  fs.writeFileSync(path.join(outDir, "ocr-bridge.js"), bridgeSource(), "utf8");

  if (!fs.existsSync(path.join(outDir, "README.md"))) {
    fs.writeFileSync(
      path.join(outDir, "README.md"),
      "# OCR sidecar (lazy)\n\nGenerated by `npm run ocr:vendor`.\n",
      "utf8"
    );
  }

  const sizes = fs
    .readdirSync(outDir)
    .map((name) => {
      const st = fs.statSync(path.join(outDir, name));
      return `  ${name}: ${(st.size / 1024 / 1024).toFixed(2)} MB`;
    })
    .join("\n");
  console.log("OCR sidecar ready in public/assets/ocr/\n" + sizes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
