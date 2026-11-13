/**
 * RSP-88: click-me / green highlight only on frames that actually open something.
 * Pin1-only → left unit shot plain; right SM highlighted.
 * Pin2 + part ED → right ED highlighted; left still plain.
 * Run after: npm run build:file
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-88-unit-shot-click-me";
const localDir = path.resolve("artifacts/rsp-88-unit-shot-click-me");
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

function frameHints() {
  return page.evaluate(() => {
    const series = document.querySelector("#series-visual");
    const diagram = document.querySelector("#diagram-visual");
    const seriesHint = document.querySelector("#series-click-hint");
    const diagramHint = document.querySelector("#diagram-click-hint");
    const seriesCs = series ? getComputedStyle(series) : null;
    const diagramCs = diagram ? getComputedStyle(diagram) : null;
    const seriesHintCs = seriesHint ? getComputedStyle(seriesHint) : null;
    const diagramHintCs = diagramHint ? getComputedStyle(diagramHint) : null;
    return {
      seriesClickable: series?.classList.contains("is-clickable"),
      seriesHint: !(seriesHint?.hidden ?? true),
      seriesDisabled: document.querySelector("#series-thumb-btn")?.disabled ?? true,
      seriesHasImg: Boolean(
        document.querySelector("#series-visual-img")?.getAttribute("src")
      ),
      seriesAnim: seriesCs?.animationName || "",
      seriesHintAnim: seriesHintCs?.animationName || "",
      diagramClickable: diagram?.classList.contains("is-clickable"),
      diagramHint: !(diagramHint?.hidden ?? true),
      diagramHintText: diagramHint?.textContent || "",
      diagramAlt: document.querySelector("#diagram-visual-img")?.alt || "",
      diagramAnim: diagramCs?.animationName || "",
      diagramHintAnim: diagramHintCs?.animationName || "",
    };
  });
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

const pin1 = await frameHints();
console.log("pin1", pin1);
if (!pin1.seriesHasImg) {
  console.error("FAIL expected HD200e unit shot on left");
  await browser.close();
  process.exit(1);
}
if (pin1.seriesClickable || pin1.seriesHint || !pin1.seriesDisabled) {
  console.error("FAIL left unit shot must not show click-me on Pin1-only", pin1);
  await browser.close();
  process.exit(1);
}
if (!pin1.diagramClickable || !pin1.diagramHint) {
  console.error("FAIL right SM must show click-me on Pin1-only", pin1);
  await browser.close();
  process.exit(1);
}
if (
  !/search-visual-click-border-flash/.test(pin1.diagramAnim) ||
  !/search-visual-click-hint-flash/.test(pin1.diagramHintAnim)
) {
  console.error("FAIL right SM click-me must flash border + label", pin1);
  await browser.close();
  process.exit(1);
}
if (/search-visual-click/.test(pin1.seriesAnim + pin1.seriesHintAnim)) {
  console.error("FAIL left must not flash on Pin1-only", pin1);
  await browser.close();
  process.exit(1);
}
if (!/service manual/i.test(pin1.diagramAlt)) {
  console.error("FAIL expected SM on right after Pin1", pin1.diagramAlt);
  await browser.close();
  process.exit(1);
}
await shot("01-pin1-left-plain-right-sm.png");
await page.waitForTimeout(550);
await shot("01b-pin1-flash-mid.png");

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

const pin2 = await frameHints();
console.log("pin2", pin2);
if (pin2.seriesClickable || pin2.seriesHint || !pin2.seriesDisabled) {
  console.error("FAIL left must stay unhighlighted when ED is shown", pin2);
  await browser.close();
  process.exit(1);
}
if (!pin2.diagramClickable || !pin2.diagramHint) {
  console.error("FAIL right ED must show click-me", pin2);
  await browser.close();
  process.exit(1);
}
if (
  !/search-visual-click-border-flash/.test(pin2.diagramAnim) ||
  !/search-visual-click-hint-flash/.test(pin2.diagramHintAnim)
) {
  console.error("FAIL right ED click-me must flash border + label", pin2);
  await browser.close();
  process.exit(1);
}
if (/search-visual-click/.test(pin2.seriesAnim + pin2.seriesHintAnim)) {
  console.error("FAIL left must not flash when ED is shown", pin2);
  await browser.close();
  process.exit(1);
}
if (!/exploded/i.test(pin2.diagramAlt)) {
  console.error("FAIL expected ED on right after Pin2+HEX", pin2.diagramAlt);
  await browser.close();
  process.exit(1);
}
await shot("02-pin2-left-plain-right-ed.png");
await page.waitForTimeout(550);
await shot("02b-pin2-flash-mid.png");

console.log("OK RSP-88 smoke");
await browser.close();
