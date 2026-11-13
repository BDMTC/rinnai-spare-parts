/**
 * RSP-76 — Pin1 External green / Internal yellow.
 * Run after: npm run build:file
 *   node scripts/smoke-pin1-install-colours.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-76-pin1-install-colours";
const localDir = path.resolve("artifacts/rsp-76-pin1-install-colours");
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

const input = page.locator("#series-input");
await input.click();
await input.fill("");
await input.type("HD28", { delay: 25 });
await page.waitForTimeout(700);
await shot("01-pin1-hd28-colours.png");

const colours = await page.evaluate(() => {
  const opts = [...document.querySelectorAll("#series-listbox .model-option-label")];
  return opts.map((el) => {
    const ext = el.querySelector(".pin-install--external");
    const inn = el.querySelector(".pin-install--internal");
    const cs = (node) => (node ? getComputedStyle(node).color : null);
    return {
      text: el.textContent.trim(),
      externalColor: cs(ext),
      internalColor: cs(inn),
    };
  });
});
console.log("COLOURS", JSON.stringify(colours, null, 2));

const hasExt = colours.some((c) => c.externalColor);
const hasInt = colours.some((c) => c.internalColor);
if (!hasExt || !hasInt) {
  console.error("FAIL missing External/Internal spans");
  await browser.close();
  process.exit(1);
}

await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /External/i })
  .first()
  .click();
await page.waitForTimeout(500);
await page.locator("#series-input").blur();
await page.waitForTimeout(300);
await shot("02-pin1-selected-external.png");

const rich = await page.evaluate(() => {
  const el = document.querySelector("#series-picker .model-picker-rich-label .pin-install--external");
  return el ? getComputedStyle(el).color : null;
});
console.log("SELECTED_EXTERNAL_COLOR", rich);
if (!rich) {
  console.error("FAIL rich label missing on selected External pin");
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log("OK", mediaDir);
