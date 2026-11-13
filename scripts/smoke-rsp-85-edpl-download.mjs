/**
 * RSP-85: EDPL lightbox Download PDF + click-me hints on clickable frames.
 * Run after: npm run build:file
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-85-edpl-download";
const localDir = path.resolve("artifacts/rsp-85-edpl-download");
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(localDir, { recursive: true });

const distHtml = path.resolve("dist/index.html");
if (!fs.existsSync(distHtml)) {
  console.error("Missing dist/index.html — run npm run build:file first");
  process.exit(1);
}

const pdfData = path.resolve("dist/assets/pdf-data-EDPL-REU-VRM2632WC.js");
if (!fs.existsSync(pdfData)) {
  console.error("Missing pdf-data-EDPL-REU-VRM2632WC.js");
  process.exit(1);
}
console.log("pdf-data-EDPL-REU-VRM2632WC.js bytes", fs.statSync(pdfData).size);

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

await page.locator("#series-input").click();
await page.locator("#series-input").fill("");
await page.locator("#series-input").type("HD200e", { delay: 20 });
await page.waitForTimeout(500);
await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /HD200e/i })
  .first()
  .click();
await page.waitForTimeout(500);

const pin1Hints = await page.evaluate(() => ({
  seriesClickable: document
    .querySelector("#series-visual")
    ?.classList.contains("is-clickable"),
  seriesHint: !(document.querySelector("#series-click-hint")?.hidden ?? true),
  diagramClickable: document
    .querySelector("#diagram-visual")
    ?.classList.contains("is-clickable"),
  diagramHint: !(document.querySelector("#diagram-click-hint")?.hidden ?? true),
}));
console.log("pin1Hints", pin1Hints);
if (!pin1Hints.seriesClickable || !pin1Hints.seriesHint) {
  console.error("FAIL series click-me missing on Pin1");
  await browser.close();
  process.exit(1);
}
if (!pin1Hints.diagramClickable || !pin1Hints.diagramHint) {
  console.error("FAIL diagram click-me missing on Pin1 SM");
  await browser.close();
  process.exit(1);
}
await shot("01-click-me-pin1.png");

await page.locator("#item-input").click();
await page.waitForTimeout(400);
await page
  .locator("#item-listbox [role='option']")
  .filter({ hasText: /VRM2632WC|REU-VRM2632WC/i })
  .first()
  .click();
await page.waitForTimeout(400);
await page.locator("#query-input").fill("heat exchanger");
await page.waitForTimeout(900);

const pin2Hints = await page.evaluate(() => ({
  seriesClickable: document
    .querySelector("#series-visual")
    ?.classList.contains("is-clickable"),
  diagramClickable: document
    .querySelector("#diagram-visual")
    ?.classList.contains("is-clickable"),
  diagramHint: !(document.querySelector("#diagram-click-hint")?.hidden ?? true),
  diagramHintText:
    document.querySelector("#diagram-click-hint")?.textContent || "",
}));
console.log("pin2Hints", pin2Hints);
if (!pin2Hints.diagramClickable || !pin2Hints.diagramHint) {
  console.error("FAIL diagram click-me missing on ED");
  await browser.close();
  process.exit(1);
}
await shot("02-click-me-ed.png");

await page.locator("#diagram-thumb-btn").click();
await page.waitForTimeout(400);

const openState = await page.evaluate(() => {
  const dialog = document.querySelector("#diagram-lightbox");
  const download = document.querySelector("#diagram-lightbox-download");
  const nav = document.querySelector("#diagram-lightbox-nav");
  const pageEl = document.querySelector("#diagram-lightbox-page");
  return {
    open: dialog?.open || dialog?.hasAttribute("open"),
    aria: dialog?.getAttribute("aria-label") || "",
    downloadHidden: download?.hidden ?? true,
    downloadText: download?.textContent || "",
    navHidden: nav?.hidden ?? true,
    pageText: pageEl?.textContent || "",
    caption: document.querySelector("#diagram-lightbox-caption")?.textContent || "",
  };
});
console.log("openState", openState);

if (!openState.open || !/exploded/i.test(openState.aria)) {
  console.error("FAIL ED lightbox not open", openState);
  await browser.close();
  process.exit(1);
}
if (openState.downloadHidden || !/Download PDF/i.test(openState.downloadText)) {
  console.error("FAIL ED Download control missing", openState);
  await browser.close();
  process.exit(1);
}
if (!/Page 5\s*\/\s*7/i.test(openState.pageText)) {
  console.error("FAIL expected Page 5 / 7", openState.pageText);
  await browser.close();
  process.exit(1);
}

await shot("03-ed-lightbox-download.png");

const downloadResult = await page.evaluate(async () => {
  const btn = document.querySelector("#diagram-lightbox-download");
  btn.click();
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const rec = window.__RSP_PDF__?.["EDPL REU-VRM2632WC.pdf"];
    if (rec?.base64) {
      return { ok: true, b64Len: rec.base64.length, btnText: btn.textContent };
    }
  }
  return {
    ok: false,
    keys: Object.keys(window.__RSP_PDF__ || {}),
    btnText: btn?.textContent,
  };
});
console.log("downloadResult", downloadResult);
if (!downloadResult.ok || downloadResult.b64Len < 1000) {
  console.error("FAIL ED PDF data", downloadResult);
  await browser.close();
  process.exit(1);
}

console.log("OK RSP-85 smoke");
await browser.close();
