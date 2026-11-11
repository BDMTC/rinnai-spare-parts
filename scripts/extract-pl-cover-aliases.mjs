#!/usr/bin/env node
/**
 * Local hook: sample PL / EDPL / SM PDF cover (and early pages) for
 * marketing ↔ REU model strings, then print suspected alias pairs.
 *
 * Run on Beau's office PC where data-sheets live, e.g.:
 *   cd C:\Temp\rinnai-spare-parts
 *   npm run extract:pl-covers
 *
 * Prefers `pdftotext` (Poppler) if on PATH; otherwise tries Python pypdf:
 *   python -m pip install --user pypdf
 *
 * Does NOT auto-write series-aliases.json — print suspects for Beau to confirm.
 * Cloud agents without PDFs exit 0 with a clear skip message.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultSheets = path.join(root, "data-sheets");

const FOCUS =
  /VRM2632|VR2632|VM2632|V2632|VM2630|VRM2630|HD200|VCM2837|HD28|FFUC|FFUG|WC-AK/i;

function walkPdfs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (/quarantine/i.test(name)) continue;
      walkPdfs(abs, out);
    } else if (/\.pdf$/i.test(name) && FOCUS.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

function extractWithPdftotext(file, maxPages = 4) {
  const args = ["-f", "1", "-l", String(maxPages), "-layout", file, "-"];
  const r = spawnSync("pdftotext", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) return null;
  return r.stdout || "";
}

function extractWithPypdf(file, maxPages = 4) {
  const py = `
import sys
try:
    from pypdf import PdfReader
except ImportError:
    sys.exit(2)
path = sys.argv[1]
max_pages = int(sys.argv[2])
reader = PdfReader(path)
n = min(len(reader.pages), max_pages)
parts = []
for i in range(n):
    try:
        parts.append(reader.pages[i].extract_text() or "")
    except Exception as e:
        parts.append("")
print("\\n".join(parts))
`;
  const r = spawnSync("python", ["-c", py, file, String(maxPages)], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status === 2) return { missingDep: true, text: null };
  if (r.status !== 0) return { missingDep: false, text: null };
  return { missingDep: false, text: r.stdout || "" };
}

function extractText(file) {
  const viaPoppler = extractWithPdftotext(file);
  if (viaPoppler != null) return { engine: "pdftotext", text: viaPoppler };
  const viaPy = extractWithPypdf(file);
  if (viaPy.missingDep) {
    return { engine: null, text: null, error: "pypdf-missing" };
  }
  if (viaPy.text != null) return { engine: "pypdf", text: viaPy.text };
  return { engine: null, text: null, error: "extract-failed" };
}

function findHits(text) {
  const hits = new Set();
  const patterns = [
    /\bHD200[eiEI]?\b/g,
    /\bHD28[eiEI]?\b/g,
    /\bInfinity\b/gi,
    /\bREU[- ]?[A-Z]{0,3}\d{3,4}[A-Z0-9-]*/gi,
    /\b(?:VRM|VR|VM|V)2632[A-Z]{0,4}(?:-AK)?\b/gi,
    /\b(?:VM|VRM)2630[A-Z]{0,4}(?:-AK)?\b/gi,
    /\bVCM2837[A-Z]{0,4}\b/gi,
  ];
  for (const re of patterns) {
    for (const m of String(text || "").matchAll(re)) {
      hits.add(m[0].replace(/\s+/g, " ").trim());
    }
  }
  return [...hits];
}

function main() {
  const sheetsRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : defaultSheets;

  console.log(`PL/ED cover extract — root: ${sheetsRoot}`);
  if (!fs.existsSync(sheetsRoot)) {
    console.log(
      "SKIP: data-sheets folder missing (expected on office PC at C:\\Temp\\rinnai-spare-parts\\data-sheets). No PDFs to sample."
    );
    console.log(
      "When present, re-run: npm run extract:pl-covers — then paste hits for Beau to confirm before locking series-aliases.json."
    );
    process.exit(0);
  }

  const pdfs = walkPdfs(sheetsRoot);
  if (!pdfs.length) {
    console.log("SKIP: no focus PDFs matched under data-sheets.");
    process.exit(0);
  }

  console.log(`Scanning ${pdfs.length} PDF(s)…\n`);
  let engineUsed = null;
  const rows = [];

  for (const file of pdfs) {
    const rel = path.relative(root, file);
    const { engine, text, error } = extractText(file);
    if (error === "pypdf-missing") {
      console.error(
        "Need pdftotext (Poppler) or: python -m pip install --user pypdf"
      );
      process.exit(1);
    }
    if (!text) {
      console.log(`— ${rel}: extract failed`);
      continue;
    }
    engineUsed = engineUsed || engine;
    const hits = findHits(text);
    const hd = hits.filter((h) => /HD200|HD28|Infinity/i.test(h));
    const reu = hits.filter((h) => /REU|VRM|VR2632|VM2632|V2632|VM2630|VCM/i.test(h));
    rows.push({ rel, hd, reu, sample: text.slice(0, 240).replace(/\s+/g, " ") });
    console.log(`## ${rel}`);
    console.log(`  marketing-ish: ${hd.join(" · ") || "(none)"}`);
    console.log(`  codes: ${reu.slice(0, 12).join(" · ") || "(none)"}`);
    console.log("");
  }

  console.log(`Engine: ${engineUsed || "none"}`);
  console.log(
    "Review hits against docs/model-link-suspects.md; only Beau ✅ locks series-aliases.json."
  );
  // Touch rows so unused-lint tooling does not strip in future edits
  void rows.length;
}

main();
