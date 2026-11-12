/**
 * Smoke me a kipper — tip #18 file:// dist smoke + screenshots.
 * Run after: npm run build:file
 *   node scripts/smoke-kipper.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/smoke-kipper";
const localDir = path.resolve("artifacts/smoke-kipper");
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(localDir, { recursive: true });

const distHtml = path.resolve("dist/index.html");
if (!fs.existsSync(distHtml)) {
  console.error("Missing dist/index.html — run npm run build:file first");
  process.exit(1);
}
const fileUrl = pathToFileURL(distHtml).href;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1200);

async function shot(name) {
  const dests = [
    path.join(mediaDir, name),
    path.join(localDir, name),
  ];
  for (const d of dests) await page.screenshot({ path: d, fullPage: false });
  return dests[0];
}

async function setQuery(q) {
  const input = page.locator("#query-input");
  await input.click();
  await input.fill("");
  await input.type(q, { delay: 20 });
  await input.press("Enter");
  await page.waitForTimeout(900);
}

async function pinHd200e() {
  const candidates = [
    "#model-query",
    "#model-input",
    "input[aria-label*='Model' i]",
    ".model-typeahead input",
    ".search-panel input",
  ];
  let input = null;
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      input = loc;
      break;
    }
  }
  if (!input) throw new Error("model pin input not found");
  await input.click();
  await input.fill("");
  await input.type("HD200e", { delay: 35 });
  await page.waitForTimeout(700);
  const option = page
    .locator("[role='option'], .suggestion, .typeahead-item, .model-suggestion, li, button")
    .filter({ hasText: /HD200e/i })
    .first();
  if (await option.count()) await option.click();
  else await input.press("Enter");
  await page.waitForTimeout(800);
}

async function sampleCards(n = 4) {
  await page.waitForSelector(".result, .result-name", { timeout: 20000 });
  const cards = await page.locator(".result").all();
  const out = [];
  for (const c of cards.slice(0, n)) {
    out.push({
      primary: await c.evaluate((el) => el.classList.contains("result--primary")),
      code: (await c.locator(".result-code").textContent().catch(() => null))?.trim(),
      name: (await c.locator(".result-name").textContent().catch(() => null))?.trim(),
      summary: (await c.locator(".result-summary").textContent().catch(() => null))?.trim(),
    });
  }
  return out;
}

const report = { fileUrl, tip: "c10f35a", pr: 18 };

await pinHd200e();
await setQuery("hex");
report.hd200eHex = await sampleCards(5);
report.hd200eHexShot = await shot("kipper-hd200e-hex-92093550.png");

await setQuery("90102054");
report.filter = await sampleCards(2);
report.filterShot = await shot("kipper-energysaver-filter-90102054.png");

await setQuery("90179590");
report.pcb = await sampleCards(2);
report.pcbShot = await shot("kipper-energysaver-pcb-90179590.png");

const helpOpen = page.locator("#help-open");
await helpOpen.click();
await page.waitForTimeout(500);
report.helpShot = await shot("kipper-help-margin-25.png");
const helpText = await page.locator("#help-dialog").innerText().catch(() => "");
report.helpHas25 = /25\s*%/.test(helpText);
const helpSvg = await page.locator("#help-dialog img, #help-dialog svg").first().count();
report.helpArtPresent = helpSvg > 0;

const hexOk =
  report.hd200eHex?.[0]?.code === "92093550" &&
  report.hd200eHex?.[0]?.primary === true &&
  /heating coil|heat exchanger|HD200e/i.test(report.hd200eHex?.[0]?.summary || "");
const filterOk =
  report.filter?.[0]?.code === "90102054" &&
  /filter|air/i.test(report.filter?.[0]?.summary || "");
const pcbOk =
  report.pcb?.[0]?.code === "90179590" &&
  /circuit board|brains|PCB|control/i.test(report.pcb?.[0]?.summary || "");

report.ok = Boolean(hexOk && filterOk && pcbOk && report.helpHas25);

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
