/**
 * RSP-89: idle empty frames (Rinnai logo + bundled GIF) + solid admin HQ veil.
 * Run after: npm run build:file
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-89-solid-empty-frames";
const localDir = path.resolve("artifacts/rsp-89-solid-empty-frames");
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
await page.waitForTimeout(1400);

async function shot(name) {
  for (const d of [path.join(mediaDir, name), path.join(localDir, name)]) {
    await page.screenshot({ path: d, fullPage: false });
  }
  console.log("shot", name);
}

const idle = await page.evaluate(() => {
  const seriesImg = document.querySelector("#series-visual-img");
  const diagramImg = document.querySelector("#diagram-visual-img");
  const seriesFrame = document.querySelector("#series-visual");
  const diagramFrame = document.querySelector("#diagram-visual");
  const veil = document.querySelector(".ops-panels-veil");
  const veilCs = veil ? getComputedStyle(veil) : null;
  return {
    seriesSrc: seriesImg?.getAttribute("src") || "",
    seriesAlt: seriesImg?.alt || "",
    seriesEmptyArt: seriesFrame?.classList.contains("is-empty-art") || false,
    seriesPhHidden: document.querySelector("#series-visual-ph")?.hidden ?? null,
    diagramSrc: diagramImg?.getAttribute("src") || "",
    diagramEmptyArt: diagramFrame?.classList.contains("is-empty-art") || false,
    diagramPhHidden: document.querySelector("#diagram-visual-ph")?.hidden ?? null,
    seriesClickable: seriesFrame?.classList.contains("is-clickable") || false,
    diagramClickable: diagramFrame?.classList.contains("is-clickable") || false,
    veilOpacity: veilCs?.opacity || "",
  };
});
console.log("idle", idle);

const fail = (msg) => {
  console.error("FAIL", msg);
  process.exitCode = 1;
};

if (!idle.seriesEmptyArt || !idle.diagramEmptyArt) fail("expected is-empty-art on both frames");
if (!/rinnai/i.test(idle.seriesSrc) && !idle.seriesSrc.includes("data:")) {
  // hashed asset name may not include rinnai — check alt + that src is set
}
if (!idle.seriesSrc) fail("left frame missing Rinnai logo src");
if (!/rinnai/i.test(idle.seriesAlt)) fail("left alt should be Rinnai");
if (!idle.diagramSrc) fail("right frame missing GIF src");
if (!idle.seriesPhHidden || !idle.diagramPhHidden) fail("placeholders should be hidden in idle art");
if (idle.seriesClickable || idle.diagramClickable) fail("idle art must not be clickable");
if (idle.veilOpacity !== "1") fail(`admin veil must be fully opaque, got ${idle.veilOpacity}`);

// Confirm GIF is a local relative/bundled asset, not live pinterest
if (/pinimg\.com|pinterest/i.test(idle.diagramSrc)) {
  fail("GIF must be bundled, not live Pinterest URL");
}

await shot("01-empty-frames-logo-gif.png");

// Admin HQ solid shot before any hover/focus (mouse parked away)
await page.mouse.move(0, 0);
await page.evaluate(() => {
  document.activeElement?.blur?.();
  document.querySelector("#ops-panels")?.classList.remove("is-revealed");
});
await page.locator("#ops-panels").scrollIntoViewIfNeeded();
await page.mouse.move(0, 0);
await page.waitForTimeout(400);
{
  const veilBox = await page.locator("#ops-panels").boundingBox();
  const clip = {
    x: Math.max(0, veilBox.x - 8),
    y: Math.max(0, veilBox.y - 8),
    width: Math.min(1384, veilBox.width + 16),
    height: Math.min(560, veilBox.height + 16),
  };
  for (const d of [mediaDir, localDir]) {
    await page.screenshot({
      path: path.join(d, "03-admin-solid-opaque.png"),
      clip,
    });
  }
  console.log("shot 03-admin-solid-opaque.png");
}

// Pin1 HD200e → normal unit shot / SM
await page.locator("#series-input").click();
await page.locator("#series-input").fill("");
await page.locator("#series-input").type("HD200e", { delay: 20 });
await page.waitForTimeout(500);
await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /HD200e/i })
  .first()
  .click();
await page.waitForTimeout(600);

const pin1 = await page.evaluate(() => {
  const seriesImg = document.querySelector("#series-visual-img");
  const diagramImg = document.querySelector("#diagram-visual-img");
  const seriesFrame = document.querySelector("#series-visual");
  const diagramFrame = document.querySelector("#diagram-visual");
  return {
    seriesSrc: seriesImg?.getAttribute("src") || "",
    seriesAlt: seriesImg?.alt || "",
    seriesEmptyArt: seriesFrame?.classList.contains("is-empty-art") || false,
    diagramEmptyArt: diagramFrame?.classList.contains("is-empty-art") || false,
    diagramAlt: diagramImg?.alt || "",
    diagramClickable: diagramFrame?.classList.contains("is-clickable") || false,
  };
});
console.log("pin1", pin1);

if (pin1.seriesEmptyArt || pin1.diagramEmptyArt) fail("Pin1 must clear empty-art");
if (!/HD200e/i.test(pin1.seriesAlt) && !/unit/i.test(pin1.seriesAlt)) {
  fail("expected unit shot alt after Pin1");
}
if (!/service manual/i.test(pin1.diagramAlt)) fail("expected SM on right after Pin1");
if (!pin1.diagramClickable) fail("SM should be clickable after Pin1");

await shot("02-pin1-unit-sm.png");

await browser.close();
if (process.exitCode) {
  console.error("RSP-89 smoke FAILED");
  process.exit(1);
}
console.log("RSP-89 smoke OK");
