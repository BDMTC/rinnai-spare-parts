/**
 * RSP-75 — screenshot Pin1 HD28 Internal/External + Pin2 Item Numbers.
 * Run after: npm run build:file
 *   node scripts/smoke-hd28-pin2.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-75-hd28-pin2";
const localDir = path.resolve("artifacts/rsp-75-hd28-pin2");
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
await page.waitForTimeout(1500);

async function shot(name) {
  const dests = [path.join(mediaDir, name), path.join(localDir, name)];
  for (const d of dests) await page.screenshot({ path: d, fullPage: false });
  console.log("shot", name);
  return dests[0];
}

async function pinContinuousFlow() {
  const input = page.locator("#system-input");
  await input.click();
  await page
    .locator("#system-listbox [role='option']")
    .filter({ hasText: /Continuous Flow/i })
    .first()
    .click();
  await page.waitForTimeout(400);
}

async function openSeriesPin(query) {
  const input = page.locator("#series-input");
  await input.click();
  await input.fill("");
  await input.type(query, { delay: 25 });
  await page.waitForTimeout(600);
}

async function chooseOption(textRe) {
  const option = page
    .locator("#series-listbox [role='option'], #item-listbox [role='option']")
    .filter({ hasText: textRe })
    .first();
  await option.waitFor({ timeout: 8000 });
  await option.click();
  await page.waitForTimeout(500);
}

async function openItemPin() {
  const input = page.locator("#item-input");
  await input.click();
  await page.waitForTimeout(700);
}

// Pin1 CF → Pin2 HD28 — must show External + Internal, not umbrella / INF28
await pinContinuousFlow();
await openSeriesPin("HD28");
await shot("01-pin1-hd28-series.png");
const pin1Text = await page.locator("#series-listbox").innerText();
console.log("--- Pin2 HD28 ---\n" + pin1Text);

// Choose External → Pin3 WC only
await chooseOption(/HD28e.*External/i);
await openItemPin();
await shot("02-pin2-hd28e-items.png");
const pin2e = await page.locator("#item-listbox").innerText();
console.log("--- Pin3 HD28e ---\n" + pin2e);

// Clear series, pick Internal
await page.locator("#series-clear").click();
await page.waitForTimeout(300);
await openSeriesPin("HD28");
await chooseOption(/HD28i.*Internal/i);
await openItemPin();
await shot("03-pin2-hd28i-items.png");
const pin2i = await page.locator("#item-listbox").innerText();
console.log("--- Pin2 HD28i ---\n" + pin2i);

// Infinity 28 separate
await page.locator("#series-clear").click();
await page.waitForTimeout(300);
await openSeriesPin("Infinity 28");
await shot("04-pin1-infinity28.png");
await chooseOption(/Infinity 28/i);
await openItemPin();
await shot("05-pin2-infinity28-items.png");
const pin2inf = await page.locator("#item-listbox").innerText();
console.log("--- Pin2 Infinity 28 ---\n" + pin2inf);

const checks = {
  pin1HasExternal: /Heavy Duty 28 External/i.test(pin1Text),
  pin1HasInternal: /Heavy Duty 28 Internal/i.test(pin1Text),
  pin1NoUmbrellaOnly: !/^HD28 · Heavy Duty 28$/m.test(pin1Text.split("\n")[0] || ""),
  pin2eWcOnly: /VCM2837WC/i.test(pin2e) && !/INF28|VCM2837FF[^C]|Solar/i.test(pin2e),
  pin2iFfcOnly:
    /VCM2837FFC/i.test(pin2i) && !/INF28|VCM2837WC|Solar|VCM2837FF-/i.test(pin2i),
  pin2infFfOnly:
    /VCM2837FF-/i.test(pin2inf) &&
    /INF28/i.test(pin2inf) &&
    !/HD28|VCM2837FFC|VCM2837WC|S28/i.test(pin2inf),
};
console.log("CHECKS", JSON.stringify(checks, null, 2));
const failed = Object.entries(checks).filter(([, v]) => !v);
if (failed.length) {
  console.error("FAIL", failed.map(([k]) => k));
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log("OK — screenshots in", mediaDir);
