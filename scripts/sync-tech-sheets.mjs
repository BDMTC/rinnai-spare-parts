#!/usr/bin/env node
/**
 * Sync Rinnai Tech spare-parts PDFs into local data-sheets/ and refresh
 * public/data/document-index.json from public/data/tech-sheet-sync.json.
 *
 * Usage:
 *   node scripts/sync-tech-sheets.mjs --mirror /path/to/rinnai-tech-latest
 *   node scripts/sync-tech-sheets.mjs --mirror … --dry-run
 *   node scripts/sync-tech-sheets.mjs --mirror … --index-only
 *
 * Binary PDFs are never committed. --index-only rewrites the JSON index using
 * Tech filenames/sizes without copying files (cloud / CI). A full sync on
 * Beau's PC copies into data-sheets/ and quarantines superseded PDFs.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const syncPath = path.join(root, "public/data/tech-sheet-sync.json");
const indexPath = path.join(root, "public/data/document-index.json");

function parseArgs(argv) {
  const out = { mirror: null, dryRun: false, indexOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mirror" && argv[i + 1]) out.mirror = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--index-only") out.indexOnly = true;
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function slugId(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest, dryRun) {
  if (dryRun) {
    console.log(`  [dry-run] copy → ${dest}`);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function moveToQuarantine(sheetsDir, quarantineDir, fileName, dryRun) {
  const src = path.join(sheetsDir, fileName);
  if (!fs.existsSync(src)) {
    console.log(`  quarantine skip (missing locally): ${fileName}`);
    return;
  }
  const dest = path.join(quarantineDir, fileName);
  if (dryRun) {
    console.log(`  [dry-run] quarantine ${fileName}`);
    return;
  }
  ensureDir(quarantineDir);
  if (fs.existsSync(dest)) {
    const stamp = createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 8);
    fs.renameSync(src, path.join(quarantineDir, `${stamp}-${fileName}`));
  } else {
    fs.renameSync(src, dest);
  }
  console.log(`  quarantined: ${fileName}`);
}

function docEntry({ fileName, type, series, sizeBytes, hd28, hd200, syncId }) {
  const sheetsRel = `data-sheets/Rinnai Data Sheets/${fileName}`;
  return {
    id: slugId(path.basename(fileName, ".pdf")) || syncId,
    fileName,
    path: sheetsRel,
    type: type || "PL",
    series: series || [],
    sizeBytes: sizeBytes ?? null,
    hd28: Boolean(hd28),
    hd200: Boolean(hd200),
    syncId: syncId || null,
    source: "rinnai-tech-latest",
  };
}

function recomputeTotals(documents) {
  const byType = {};
  let totalBytes = 0;
  let hd28 = 0;
  let hd200 = 0;
  for (const d of documents) {
    byType[d.type] = (byType[d.type] || 0) + 1;
    totalBytes += d.sizeBytes || 0;
    if (d.hd28) hd28 += 1;
    if (d.hd200) hd200 += 1;
  }
  return {
    files: documents.length,
    pdfs: documents.length,
    byType,
    hd28,
    hd200,
    totalBytes,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.mirror) {
    console.error(
      "Usage: node scripts/sync-tech-sheets.mjs --mirror /path/to/rinnai-tech-latest [--dry-run] [--index-only]"
    );
    process.exit(1);
  }

  const mirror = path.resolve(args.mirror);
  if (!fs.existsSync(mirror)) {
    console.error(`Mirror not found: ${mirror}`);
    process.exit(1);
  }

  const sync = readJson(syncPath);
  const index = readJson(indexPath);
  const sheetsDir = path.join(root, sync.meta.localSheetsDir || "data-sheets/Rinnai Data Sheets");
  const quarantineDir = path.join(root, sync.meta.quarantineDir || "data-sheets/quarantine");

  const replaceNames = new Set();
  for (const row of sync.replacements || []) {
    for (const name of row.replaceFileNames || []) replaceNames.add(name);
  }

  const kept = (index.documents || []).filter((d) => !replaceNames.has(d.fileName));
  const newlyQuarantined = (index.documents || []).filter((d) =>
    replaceNames.has(d.fileName)
  );
  const priorQuarantined = index.quarantined || [];
  const added = [];

  const jobs = [
    ...(sync.replacements || []).map((r) => ({ ...r, kind: "replace" })),
    ...(sync.additions || []).map((r) => ({ ...r, kind: "add" })),
  ];

  console.log(`Mirror: ${mirror}`);
  console.log(`Jobs: ${jobs.length} (${(sync.replacements || []).length} replace, ${(sync.additions || []).length} add)`);
  console.log(`Quarantine filenames: ${replaceNames.size}`);

  for (const job of jobs) {
    const techAbs = path.join(mirror, job.techRelative);
    if (!fs.existsSync(techAbs)) {
      console.error(`MISSING Tech PDF for ${job.id}: ${techAbs}`);
      process.exit(1);
    }
    const fileName = path.basename(techAbs);
    const sizeBytes = fs.statSync(techAbs).size;
    console.log(`\n[${job.kind}/${job.confidence || "new"}] ${job.id}`);
    console.log(`  ← ${job.techRelative}`);
    console.log(`  → ${fileName} (${sizeBytes} bytes)`);

    if (!args.indexOnly) {
      for (const old of job.replaceFileNames || []) {
        moveToQuarantine(sheetsDir, quarantineDir, old, args.dryRun);
      }
      const dest = path.join(sheetsDir, fileName);
      copyFile(techAbs, dest, args.dryRun);
    } else {
      console.log("  [index-only] skip PDF copy/quarantine");
    }

    added.push(
      docEntry({
        fileName,
        type: job.type,
        series: job.series,
        sizeBytes,
        hd28: job.hd28,
        hd200: job.hd200,
        syncId: job.id,
      })
    );
  }

  // Dedupe by fileName (later jobs win).
  const byName = new Map();
  for (const d of [...kept, ...added]) {
    byName.set(d.fileName, d);
  }
  const documents = [...byName.values()].sort((a, b) =>
    String(a.fileName).localeCompare(String(b.fileName))
  );

  const next = {
    generatedAt: new Date().toISOString(),
    extractRoot: index.extractRoot || "C:\\Temp\\rinnai-spare-parts\\data-sheets",
    note:
      "Binary PDFs stay local under data-sheets/ — do not commit into git. Index refreshed from Tech mirror via scripts/sync-tech-sheets.mjs + public/data/tech-sheet-sync.json.",
    techSync: {
      updated: new Date().toISOString().slice(0, 10),
      mirrorHint: sync.meta.techMirrorHint,
      replacements: (sync.replacements || []).length,
      additions: (sync.additions || []).length,
      quarantinedFileNames: [...replaceNames].sort(),
    },
    totals: recomputeTotals(documents),
    documents,
    quarantined: (() => {
      const byName = new Map();
      for (const d of priorQuarantined) {
        if (d?.fileName) byName.set(d.fileName, d);
      }
      for (const d of newlyQuarantined) {
        byName.set(d.fileName, {
          fileName: d.fileName,
          path: d.path,
          type: d.type,
          series: d.series,
          replacedAt: new Date().toISOString().slice(0, 10),
          reason: "Superseded by newer Tech PL/EDPL per tech-sheet-sync.json",
        });
      }
      return [...byName.values()].sort((a, b) =>
        String(a.fileName).localeCompare(String(b.fileName))
      );
    })(),
  };

  const quarantinedMerged = next.quarantined;

  if (args.dryRun) {
    console.log(
      `\n[dry-run] would write index with ${documents.length} active + ${quarantinedMerged.length} quarantined`
    );
  } else {
    writeJson(indexPath, next);
    console.log(
      `\nWrote ${path.relative(root, indexPath)} — ${documents.length} active, ${quarantinedMerged.length} quarantined`
    );
  }
}

main();
