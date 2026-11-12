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

export default defineConfig(({ mode }) => {
  const isFileBuild = mode === "file";

  return {
    base: isFileBuild ? "./" : "/",
    plugins: [
      aliasBootDataForFile(isFileBuild),
      serveLocalDataSheets(),
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
          chunkSizeWarningLimit: 5000,
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
