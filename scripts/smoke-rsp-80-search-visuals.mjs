/**
 * RSP-80 — Pin2/Search width match + under-Margin series/diagram visuals + lightbox.
 * Run after: npm run build:file
 *   node scripts/smoke-rsp-80-search-visuals.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-80-search-visuals";
const localDir = path.resolve("artifacts/rsp-80-search-visuals");
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(localDir, { recursive: true });

const distHtml = path.resolve("dist/index.html");
if (!fs.existsSync(distHtml)) {
  console.error("Missing dist/index.html — run npm run build:file first");
  process.exit(1);
}

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

await shot("01-empty-placeholders.png");

const seriesInput = page.locator("#series-input");
await seriesInput.click();
await seriesInput.fill("");
await seriesInput.type("HD210e", { delay: 20 });
await page.waitForTimeout(500);
await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /HD210e/i })
  .first()
  .click();
await page.waitForTimeout(500);
await shot("02-pin1-series-shot.png");

const seriesState = await page.evaluate(() => {
  const img = document.querySelector("#series-visual-img");
  const ph = document.querySelector("#series-visual-ph");
  const panel = document.querySelector(".search-panel");
  const slot = document.querySelector(".search-visuals-slot");
  const pin1 = document.querySelector(".series-field");
  const pin2 = document.querySelector(".item-field");
  const query = document.querySelector(".query-field");
  const pr = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
  };
  return {
    seriesSrc: img?.getAttribute("src") || "",
    seriesHidden: img?.hidden ?? true,
    phHidden: ph?.hidden ?? true,
    panel: pr(panel),
    slot: pr(slot),
    pin1: pr(pin1),
    pin2: pr(pin2),
    query: pr(query),
  };
});
console.log("SERIES", JSON.stringify(seriesState, null, 2));

const itemInput = page.locator("#item-input");
await itemInput.click();
await page.waitForTimeout(400);
await page
  .locator("#item-listbox [role='option']")
  .filter({ hasText: /HD210EN50|REU-N3237WC-50/i })
  .first()
  .click();
await page.waitForTimeout(400);

await page.locator("#query-input").fill("hex");
await page.waitForTimeout(700);
await shot("03-hex-diagram-thumb.png");

const diagramState = await page.evaluate(() => {
  const btn = document.querySelector("#diagram-thumb-btn");
  const img = document.querySelector("#diagram-visual-img");
  const ph = document.querySelector("#diagram-visual-ph");
  const panel = document.querySelector(".search-panel");
  const pr = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    btnHidden: btn?.hidden ?? true,
    diagramSrc: img?.getAttribute("src") || "",
    phHidden: ph?.hidden ?? true,
    panel: pr(panel),
    primaryCount: document.querySelectorAll(".result--primary").length,
  };
});
console.log("DIAGRAM", JSON.stringify(diagramState, null, 2));

await page.locator("#diagram-thumb-btn").click();
await page.waitForTimeout(400);
await shot("04-diagram-lightbox.png");

const lightboxOpen = await page.evaluate(() => {
  const d = document.querySelector("#diagram-lightbox");
  const img = document.querySelector("#diagram-lightbox-img");
  return {
    open: d?.hasAttribute("open") || d?.open === true,
    src: img?.getAttribute("src") || "",
  };
});
console.log("LIGHTBOX", lightboxOpen);

await page.locator("#diagram-lightbox-close").click();
await page.waitForTimeout(200);

const widthOk =
  seriesState.pin1 &&
  seriesState.pin2 &&
  seriesState.query &&
  Math.abs(seriesState.pin1.w - seriesState.pin2.w) <= 4 &&
  Math.abs(seriesState.pin1.w - seriesState.query.w) <= 4;

const seriesOk = Boolean(seriesState.seriesSrc) && !seriesState.seriesHidden;
const diagramOk =
  Boolean(diagramState.diagramSrc) &&
  !diagramState.btnHidden &&
  diagramState.primaryCount >= 1;
const lightboxOk = lightboxOpen.open && Boolean(lightboxOpen.src);

console.log({ widthOk, seriesOk, diagramOk, lightboxOk });

if (!widthOk || !seriesOk || !diagramOk || !lightboxOk) {
  console.error("FAIL RSP-80 smoke");
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log("OK", mediaDir);
