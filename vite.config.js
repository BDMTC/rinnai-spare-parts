import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataSheetsDir = path.resolve(__dirname, "data-sheets");

const MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

/**
 * Serve gitignored `./data-sheets` at `/data-sheets/*` for local PDF open.
 * Folder is optional — missing files return 404; missing root is silent empty.
 */
function serveLocalDataSheets() {
  function attach(server) {
    server.middlewares.use((req, res, next) => {
      const rawUrl = req.url || "";
      if (!rawUrl.startsWith("/data-sheets")) return next();

      const urlPath = decodeURIComponent(rawUrl.split("?")[0]);
      const rel = urlPath.replace(/^\/data-sheets\/?/, "");
      if (!rel || rel.includes("\0")) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      const abs = path.resolve(dataSheetsDir, rel);
      if (!abs.startsWith(dataSheetsDir + path.sep) && abs !== dataSheetsDir) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }

      fs.stat(abs, (err, stat) => {
        if (err || !stat.isFile()) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(
            "PDF not found locally. Place files under ./data-sheets/ " +
              "(see README — usually C:\\Temp\\rinnai-spare-parts\\data-sheets\\)."
          );
          return;
        }
        const ext = path.extname(abs).toLowerCase();
        res.statusCode = 200;
        res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
        res.setHeader("Content-Length", String(stat.size));
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(abs).pipe(res);
      });
    });
  }

  return {
    name: "serve-local-data-sheets",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

/**
 * file:// builds must use a classic (non-module) script — Chrome/Edge treat
 * each local file as an opaque origin, so type="module" fails on double-click.
 */
function classicScriptForFileBuild(isFileBuild) {
  if (!isFileBuild) return null;
  return {
    name: "classic-script-for-file-build",
    enforce: "post",
    transformIndexHtml(html) {
      let out = html
        .replace(/\s*type="module"/g, "")
        .replace(/\s*crossorigin/g, "")
        .replace(/<link rel="modulepreload"[^>]*>/g, "");

      // Module scripts are deferred; classic <script> in <head> runs before #app exists.
      const re =
        /<script\b[^>]*\bsrc="([^"]*assets\/[^"]+\.js)"[^>]*>\s*<\/script>/i;
      const match = out.match(re);
      if (match) {
        out = out.replace(re, "");
        const tag = `<script defer src="${match[1]}"></script>`;
        if (/<\/body>/i.test(out)) {
          out = out.replace(/<\/body>/i, `    ${tag}\n  </body>`);
        } else {
          out += `\n${tag}\n`;
        }
      }
      return out;
    },
  };
}

/** Swap fetch boot loader for the baked-JSON loader in --mode file. */
function aliasBootDataForFile(isFileBuild) {
  if (!isFileBuild) return null;
  const target = path.resolve(__dirname, "src/boot-data.file.js");
  return {
    name: "alias-boot-data-for-file",
    enforce: "pre",
    resolveId(source) {
      if (
        source === "./boot-data.js" ||
        source === "boot-data.js" ||
        source.endsWith("/boot-data.js")
      ) {
        return target;
      }
      return null;
    },
  };
}

/**
 * Emit classic JS wrappers with base64 PDF bytes for lightbox Download.
 * Loaded via <script src> so file:// (opaque origins) still works.
 */
function lightboxPdfDataScripts() {
  const sheetsDir = path.resolve(dataSheetsDir, "Rinnai Data Sheets");
  const PDFS = [
    { id: "smVRM2632WC", file: "smVRM2632WC.pdf" },
    { id: "smVR2632FFUG_VRM2632FFUC", file: "smVR2632FFUG_VRM2632FFUC.pdf" },
    {
      id: "SM-INF26-INF32-Enviro-WH-190810",
      file: "SM INF26_INF32 Enviro WH 190810.pdf",
    },
    { id: "SM-Smartstart", file: "SM Smartstart.pdf" },
    { id: "SM-Inbuilt-Smartstart", file: "SM Inbuilt Smartstart.pdf" },
    {
      id: "PL-ED-INF26-Smartstart-VR2626WGP",
      file: "PL & ED INF26 Smartstart VR2626WGP.pdf",
    },
    { id: "EDPL-REU-VRM2632WC", file: "EDPL REU-VRM2632WC.pdf" },
    { id: "EDPL-REU-VR2632FFUG", file: "EDPL REU-VR2632FFUG.pdf" },
    { id: "EDPL-V2632FFU-FFUC", file: "EDPL V2632FFU_FFUC.pdf" },
    { id: "EDPL-REUV2630WD-INF26Plus", file: "EDPL REUV2630WD INF26Plus.pdf" },
    { id: "EDPL-Smartstart", file: "EDPL Smartstart.pdf" },
    { id: "EDPL-VR-VRM3237", file: "EDPL VR_VRM3237.pdf" },
    {
      id: "PLED-Infinity-32-Enviro-Plus-N-Series-e",
      file: "PLED_Infinity-32-Enviro-Plus-N-Series-e.pdf",
    },
    { id: "ED-N-Series-2020-IN32-Enviro", file: "ED_N Series 2020 IN32 Enviro.pdf" },
    {
      id: "Hotflo-EHFA160-Spare-Parts-List-S111418B",
      file: "Hotflo EHFA160 Spare Parts List S111418B.pdf",
    },
    { id: "EHFA-SPARE-PARTS", file: "EHFA  SPARE PARTS.pdf" },
    { id: "smVR3237WG-WC", file: "smVR3237WG_WC.pdf" },
    {
      id: "Parts-List-REU-VCM2837-WC-External",
      file: "Parts List REU-VCM2837 WC External.pdf",
    },
    {
      id: "New-A-Series-CF-Parts-List",
      file: "New A Series CF Parts List.pdf",
    },
    { id: "smV2626W-V2630WC", file: "smV2626W_V2630WC.pdf" },
    { id: "EDPL-VRM2630", file: "EDPL VRM2630.pdf" },
    {
      id: "PL-INF32-ENVIRO-KM3237WD-ISSUE4",
      file: "PL - RINNAI - EDPL INF32 ENVIRO KM3237WD - ISSUE 4 - JUNE 2025.pdf",
    },
    {
      id: "PL-ENVIRO-KM2635WD-ISSUE04",
      file: "PL - RINNAI - ENVIRO KM2635WD - ISSUE 04 - JUNE 2025.pdf",
    },
    {
      id: "PL-N3237-Inf32-Enviro-Plus-N-Issue3",
      file: "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf",
    },
    { id: "EDPL-VR2426-VR2626", file: "EDPL VR2426_VR2626.pdf" },
    { id: "EDPL-REUV2426WG", file: "EDPL REUV2426WG.pdf" },
    { id: "EDPL-REUV2626WG", file: "EDPL REUV2626WG.pdf" },
    {
      id: "EDPL-REUV2626W-REUV2632WC",
      file: "EDPL REUV2626W_REUV2632WC.pdf",
    },
    { id: "EDPL-REUV2632FFU", file: "EDPL REUV2632FFU.pdf" },
    { id: "EDPL-REUV2632FFUC", file: "EDPL REUV2632FFUC.pdf" },
    { id: "EDPL-VRM2632FFU", file: "EDPL VRM2632FFU.pdf" },
    {
      id: "PL-EDPL-VRM2632FFU-ISSUE4",
      file: "PL - RINNAI - EDPL VRM2632FFU - ISSUE 4 - JUNE 2025.pdf",
    },
    { id: "EDPL-VM3237WC", file: "EDPL VM3237WC.pdf" },
    { id: "EDPL-REUVM3237WC", file: "EDPL REUVM3237WC.pdf" },
    { id: "EDPL-REUV3237", file: "EDPL REUV3237.pdf" },
    { id: "REU-V3237WG-Parts-List", file: "REU-V3237WG Parts List.pdf" },
    {
      id: "PL-HD250E-REUVRM3237WC-ISSUE4",
      file: "PL - RINNAI - EDPL HD250E REUVRM3237WC - ISSUE 4 - FEB 2025.pdf",
    },
    {
      id: "PL-EDPLVRM3237-ISSUE4",
      file: "PL - RINNAI - EDPLVRM3237 - ISSUE 4 - JUNE 2025.pdf",
    },
    {
      id: "HW-CF-A-Series-Parts-List-Issue1",
      file: "HW_CF_A_Series_Parts_List_Issue_1_Jan_2018.pdf",
    },
    {
      id: "HW-CF-BM-SM-BM2626-B26",
      file: "HW_CF_BM_SM_Issue_1_AUG BM2626 & B26 Series.pdf",
    },
    {
      id: "PL-2025-BM-SERIES-INFINITY-B-ISSUE1",
      file: "PL - RINNAI - 2025 BM SERIES - INFINITY B - ISSUE 1 - AUG 2025.pdf",
    },
    { id: "smK2430WAK", file: "smK2430WAK.pdf" },
    { id: "EDPL-REU-K2430WG", file: "EDPL REU-K2430WG.pdf" },
    { id: "smvREUVR1616W-VR2024-v2", file: "smvREUVR1616W_VR2024_v2.pdf" },
    { id: "EDPL-VR1620", file: "EDPL VR1620.pdf" },
    { id: "EDPL-VR2024", file: "EDPL VR2024.pdf" },
    { id: "SMVR2426W-VR2632WC", file: "SMVR2426W_VR2632WC.pdf" },
    { id: "EDPL-B24", file: "EDPL B24.pdf" },
    { id: "smv1616W", file: "smv1616W.pdf" },
    { id: "SM-V16-18-20", file: "SM V16_18_20.pdf" },
    { id: "SM-V32", file: "SM V32.pdf" },
    { id: "EDPL-REUV1620WG", file: "EDPL REUV1620WG.pdf" },
    { id: "EDPL-REUV2024WG", file: "EDPL REUV2024WG.pdf" },
    { id: "EDPL-V1616W-2018W-2020W", file: "EDPL V1616W_2018W_2020W.pdf" },
    { id: "EDPL-V3232W-WC", file: "EDPL V3232W_WC.pdf" },
    { id: "EDPL-B16", file: "EDPL B16.pdf" },
    { id: "EDPL-2425W", file: "EDPL 2425W.pdf" },
    { id: "REU-VRM2024", file: "REU-VRM2024.pdf" },
    {
      id: "smREUV3237W-VM3237WC-April09",
      file: "smREUV3237W_VM3237WC April09.pdf",
    },
    { id: "SM-2006", file: "SM 2006.pdf" },
    { id: "SM-2402", file: "SM 2402.pdf" },
    { id: "SM-24WA", file: "SM 24WA.pdf" },
    { id: "SM-REU3203", file: "SM REU3203.pdf" },
    { id: "SM-V26", file: "SM V26.pdf" },
    { id: "SM-V26FFU", file: "SM V26FFU.pdf" },
    { id: "VR2024WB-B20-NON50", file: "VR2024WB-50-AK B20 NON50.pdf" },
    {
      id: "PL-EHPT-180VM-ISSUE3",
      file: "PL - RINNAI - A SERIES HEAT PUMP - EHPT 180VM - ISSUE 3 - MAY 2026.pdf",
    },
    {
      id: "PL-EHPT-250VM-ISSUE1",
      file: "PL - RINNAI - A SERIES HEAT PUMP - EHPT 250VM - ISSUE 1 - FEB 2024.pdf",
    },
    {
      id: "PL-EHPA-AR-ISSUE5",
      file: "PL - RINNAI - AR SERIES_EHPA300VM EHPA340VM - ISSUE 5 - AUG 2026.pdf",
    },
    {
      id: "PL-EHPS-215VM-ISSUE4",
      file: "PL - RINNAI - B SERIES HEAT PUMP - EHPS 215VM - ISSUE 4 - NOV 2025.pdf",
    },
    {
      id: "PL-EHPS-265VMT-ISSUE4",
      file: "PL - RINNAI - E SERIES HEAT PUMP - EHPS 265VMT - ISSUE 4 - NOV 2025.pdf",
    },
    {
      id: "SM-EHPT-A-ISSUE2",
      file: "SM - RINNAI - A SERIES HEAT PUMP - EHPT 180 - 250 VM - ISSUE 2  - APR 2024.pdf",
    },
    {
      id: "SM-EHPA-AR-ISSUE3",
      file: "SM - RINNAI - AR SERIES HEAT PUMP EHPAxxVM -  ISSUE 3 - DEC 2025.pdf",
    },
    {
      id: "SM-EHPS-BE-ISSUE1",
      file: "SM - RINNAI - B  E SERIES HEAT PUMP - EHPS (VM VMT) - ISSUE 1 - NOV 2023.pdf",
    },
    {
      id: "PL-EHPG-265VMT-ISSUE4",
      file: "PL - RINNAI - GR SERIES HEAT PUMP - EHPG265VMT - ISSUE 4 - DEC 2025.pdf",
    },
    {
      id: "PL-EHPG-250VMP-ISSUE3",
      file: "PL- RINNAI - GR SERIES HEAT PUMP - EHPG250VMP - ISSUE 3 - DEC 2025.pdf",
    },
    {
      id: "SPL-EHPG-XXVM-ISSUE5",
      file: "SPL - RINNAI - GR SERIES_EHPGxxVM - ISSUE 5 - MAY 2026.pdf",
    },
    {
      id: "PL-EHPA-VMA-ISSUE7",
      file: "PL - RINNAI - ENVIROFLO VMA V2 HEAT PUMP - ISSUE 7 - AUG 2024.pdf",
    },
    {
      id: "PL-CHP-ISSUE6",
      file: "PL - COMMERCIAL HEAT PUMP - ISSUE 6 - OCT 2025.pdf",
    },
    {
      id: "SM-EHPG-GR-ISSUE1",
      file: "SM - RINNAI - GR SERIES HEAT PUMP EHPGxxVM, VMT, VMP - ISSUE 1 - MARCH 2025.pdf",
    },
    {
      id: "SM-EHPA-VMA-ISSUE3",
      file: "SM - RINNAI - ENVIROFLO HEAT PUMP - VMA V2 - ISSUE 3 - JUN 2024.pdf",
    },
    {
      id: "SM-CHP-ISSUE2",
      file: "SM - RINNAI - COMM HEAT PUMP CHP020 CHP040 - ISSUE 2 - OCT 2025.pdf",
    },
  ];

  function buildScriptSource(fileName) {
    const abs = path.join(sheetsDir, fileName);
    if (!fs.existsSync(abs)) {
      throw new Error(
        `Lightbox PDF missing: ${abs}. Place data-sheets under the repo root.`
      );
    }
    const b64 = fs.readFileSync(abs).toString("base64");
    return (
      `window.__RSP_PDF__=window.__RSP_PDF__||{};` +
      `window.__RSP_PDF__[${JSON.stringify(fileName)}]=` +
      `{fileName:${JSON.stringify(fileName)},base64:${JSON.stringify(b64)}};`
    );
  }

  function servePdfData(req, res, next) {
    const rawUrl = req.url || "";
    const pathOnly = decodeURIComponent(rawUrl.split("?")[0] || "");
    const m = pathOnly.match(/^\/assets\/pdf-data-([A-Za-z0-9_-]+)\.js$/);
    if (!m) return next();
    const hit = PDFS.find((p) => p.id === m[1]);
    if (!hit) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    try {
      const source = buildScriptSource(hit.file);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(source);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(String(err?.message || err));
    }
  }

  return {
    name: "lightbox-pdf-data-scripts",
    configureServer(server) {
      server.middlewares.use(servePdfData);
    },
    configurePreviewServer(server) {
      server.middlewares.use(servePdfData);
    },
    generateBundle() {
      for (const pdf of PDFS) {
        const source = buildScriptSource(pdf.file);
        this.emitFile({
          type: "asset",
          fileName: `assets/pdf-data-${pdf.id}.js`,
          source,
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const isFileBuild = mode === "file";

  return {
    base: isFileBuild ? "./" : "/",
    plugins: [
      aliasBootDataForFile(isFileBuild),
      serveLocalDataSheets(),
      lightboxPdfDataScripts(),
      classicScriptForFileBuild(isFileBuild),
    ].filter(Boolean),
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      fs: {
        allow: [__dirname, dataSheetsDir],
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
    },
    build: isFileBuild
      ? {
          outDir: "dist",
          emptyOutDir: true,
          cssCodeSplit: false,
          modulePreload: false,
          assetsInlineLimit: 8192,
          chunkSizeWarningLimit: 20000,
          rollupOptions: {
            output: {
              format: "iife",
              name: "RinnaiPartsApp",
              inlineDynamicImports: true,
              entryFileNames: "assets/app.js",
              assetFileNames: "assets/[name]-[hash][extname]",
            },
          },
        }
      : {
          outDir: "dist",
        },
  };
});
