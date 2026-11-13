/**
 * RSP-84: SM lightbox page flip + Download PDF (file://).
 * Run after: npm run build:file
 *   node scripts/smoke-rsp-84-lightbox-pages.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-84-sm-lightbox";
const localDir = path.resolve("artifacts/rsp-84-sm-lightbox");
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(localDir, { recursive: true });

const distHtml = path.resolve("dist/index.html");
if (!fs.existsSync(distHtml)) {
  console.error("Missing dist/index.html — run npm run build:file first");
  process.exit(1);
}

const pdfData = path.resolve("dist/assets/pdf-data-smVRM2632WC.js");
if (!fs.existsSync(pdfData)) {
  console.error("Missing dist/assets/pdf-data-smVRM2632WC.js — PDF emit failed");
  process.exit(1);
}
console.log(
  "pdf-data-smVRM2632WC.js bytes",
  fs.statSync(pdfData).size
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
await page.goto(pathToFileURL(distHtml).href, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(1200);

async function shot(name) {
  for (const d of [path.join(mediaDir, name), path.join(localDir, name)]) {
    await page.screenshot({ path: d, fullPage: false });
  }
  console.log("shot", name);
}

const seriesInput = page.locator("#series-input");
await seriesInput.click();
await seriesInput.fill("");
await seriesInput.type("HD200e", { delay: 20 });
await page.waitForTimeout(500);
await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /HD200e/i })
  .first()
  .click();
await page.waitForTimeout(500);

await page.locator("#diagram-thumb-btn").click();
await page.waitForTimeout(400);

const openState = await page.evaluate(() => {
  const dialog = document.querySelector("#diagram-lightbox");
  const nav = document.querySelector("#diagram-lightbox-nav");
  const pageEl = document.querySelector("#diagram-lightbox-page");
  const prev = document.querySelector("#diagram-lightbox-prev");
  const next = document.querySelector("#diagram-lightbox-next");
  const download = document.querySelector("#diagram-lightbox-download");
  return {
    open: dialog?.open || dialog?.hasAttribute("open"),
    navHidden: nav?.hidden ?? true,
    pageText: pageEl?.textContent || "",
    prevDisabled: prev?.disabled ?? true,
    nextDisabled: next?.disabled ?? true,
    downloadHidden: download?.hidden ?? true,
    downloadText: download?.textContent || "",
  };
});
console.log("openState", openState);

if (!openState.open) {
  console.error("FAIL lightbox not open");
  await browser.close();
  process.exit(1);
}
if (openState.navHidden) {
  console.error("FAIL nav hidden for multi-page SM");
  await browser.close();
  process.exit(1);
}
if (!/Page 1\s*\/\s*53/i.test(openState.pageText)) {
  console.error("FAIL expected Page 1 / 53", openState.pageText);
  await browser.close();
  process.exit(1);
}
if (openState.downloadHidden || !/Download PDF/i.test(openState.downloadText)) {
  console.error("FAIL Download control missing", openState);
  await browser.close();
  process.exit(1);
}

await shot("01-sm-lightbox-page-controls.png");

await page.locator("#diagram-lightbox-next").click();
await page.waitForTimeout(350);
const page2 = await page.evaluate(
  () => document.querySelector("#diagram-lightbox-page")?.textContent || ""
);
console.log("after next", page2);
if (!/Page 2\s*\/\s*53/i.test(page2)) {
  console.error("FAIL next page", page2);
  await browser.close();
  process.exit(1);
}

await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
const page3 = await page.evaluate(
  () => document.querySelector("#diagram-lightbox-page")?.textContent || ""
);
console.log("after arrow", page3);
if (!/Page 3\s*\/\s*53/i.test(page3)) {
  console.error("FAIL keyboard next", page3);
  await browser.close();
  process.exit(1);
}

const downloadResult = await page.evaluate(async () => {
  const btn = document.querySelector("#diagram-lightbox-download");
  if (!btn) return { ok: false, reason: "no button" };
  btn.click();
  // Wait for lazy script + click path
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (window.__RSP_PDF__?.["smVRM2632WC.pdf"]?.base64) {
      const b64 = window.__RSP_PDF__["smVRM2632WC.pdf"].base64;
      return { ok: true, b64Len: b64.length, btnText: btn.textContent };
    }
  }
  return { ok: false, reason: "pdf data not loaded", btnText: btn.textContent };
});
console.log("downloadResult", downloadResult);
if (!downloadResult.ok || downloadResult.b64Len < 1000) {
  console.error("FAIL download PDF data", downloadResult);
  await browser.close();
  process.exit(1);
}

await shot("02-sm-lightbox-after-next.png");
console.log("OK RSP-84 smoke");
await browser.close();
