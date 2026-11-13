/**
 * HD200e + heat exchanger → VRM2632WC ED page 5 (not “No diagram…”).
 * Run after: npm run build:file
 *   node scripts/smoke-hd200e-diagram.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-80-hd200e-diagram";
const localDir = path.resolve("artifacts/rsp-80-hd200e-diagram");
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
await page.waitForTimeout(400);

const itemInput = page.locator("#item-input");
await itemInput.click();
await page.waitForTimeout(500);
await page
  .locator("#item-listbox [role='option']")
  .filter({ hasText: /VRM2632WC|REU-VRM2632WC/i })
  .first()
  .click();
await page.waitForTimeout(400);

await page.locator("#query-input").fill("heat exchanger");
await page.waitForTimeout(800);
await shot("01-hd200e-hex-diagram.png");

const state = await page.evaluate(() => {
  const btn = document.querySelector("#diagram-thumb-btn");
  const img = document.querySelector("#diagram-visual-img");
  const ph = document.querySelector("#diagram-visual-ph");
  const primary = document.querySelector(".result--primary .part-code, .result--primary [data-code], .result--primary");
  const codeEl = document.querySelector(".result--primary .result-code, .result--primary strong");
  const meta = document.querySelector("#results-meta")?.textContent || "";
  return {
    btnHidden: btn?.hidden ?? true,
    src: img?.getAttribute("src") || "",
    phHidden: ph?.hidden ?? true,
    phText: ph?.textContent?.trim() || "",
    meta,
    primaryText: primary?.textContent?.slice(0, 200) || "",
    codeHint: codeEl?.textContent || "",
  };
});
console.log(JSON.stringify(state, null, 2));

const ok =
  !state.btnHidden &&
  /edpl-reu-vrm2632wc__p5/i.test(state.src) &&
  /92093550/i.test(state.meta + state.primaryText + state.codeHint);

if (!ok) {
  console.error("FAIL HD200e HEX diagram");
  await browser.close();
  process.exit(1);
}

await page.locator("#diagram-thumb-btn").click();
await page.waitForTimeout(300);
await shot("02-hd200e-hex-lightbox.png");

await browser.close();
console.log("OK", mediaDir);
