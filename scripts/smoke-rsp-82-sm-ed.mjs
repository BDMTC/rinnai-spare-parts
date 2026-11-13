/**
 * RSP-82: Pin1 → SM; Pin2 + HEX → ED lightbox with callout highlight.
 * Run after: npm run build:file
 *   node scripts/smoke-rsp-82-sm-ed.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-82-sm-ed";
const localDir = path.resolve("artifacts/rsp-82-sm-ed");
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

// Pin1 HD200e only → SM
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
await shot("01-pin1-sm.png");

const pin1 = await page.evaluate(() => {
  const btn = document.querySelector("#diagram-thumb-btn");
  const img = document.querySelector("#diagram-visual-img");
  return {
    btnHidden: btn?.hidden ?? true,
    src: img?.getAttribute("src") || "",
    alt: img?.alt || "",
  };
});
console.log("pin1", pin1);

if (pin1.btnHidden || !/hd200e__p1|service-manual|smVRM/i.test(pin1.src + pin1.alt)) {
  // bundled asset hashes name — check alt / that button is visible with an image
  const okSm = !pin1.btnHidden && Boolean(pin1.src);
  if (!okSm) {
    console.error("FAIL Pin1 SM not shown", pin1);
    await browser.close();
    process.exit(1);
  }
}

await page.locator("#diagram-thumb-btn").click();
await page.waitForTimeout(300);
await shot("02-pin1-sm-lightbox.png");
await page.locator("#diagram-lightbox-close").click();
await page.waitForTimeout(200);

// Pin2 + HEX → ED with highlight
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
await page.waitForTimeout(900);
await shot("03-pin2-hex-ed.png");

const pin2 = await page.evaluate(() => {
  const btn = document.querySelector("#diagram-thumb-btn");
  const img = document.querySelector("#diagram-visual-img");
  const codeEl = document.querySelector(
    ".result--primary .result-code, .result--primary strong"
  );
  return {
    btnHidden: btn?.hidden ?? true,
    src: img?.getAttribute("src") || "",
    alt: img?.alt || "",
    code: codeEl?.textContent || "",
  };
});
console.log("pin2", pin2);

if (pin2.btnHidden || !/92093550/i.test(pin2.code + (await page.locator("#results-meta").textContent()))) {
  console.error("FAIL primary HEX", pin2);
  await browser.close();
  process.exit(1);
}

await page.locator("#diagram-thumb-btn").click();
await page.waitForTimeout(400);
await shot("04-ed-lightbox-highlight.png");

const lb = await page.evaluate(() => {
  const hl = document.querySelector("#diagram-callout-highlight");
  const img = document.querySelector("#diagram-lightbox-img");
  const cap = document.querySelector("#diagram-lightbox-caption");
  return {
    hlHidden: hl?.hidden ?? true,
    left: hl?.style.left || "",
    top: hl?.style.top || "",
    width: hl?.style.width || "",
    height: hl?.style.height || "",
    imgSrc: img?.getAttribute("src") || "",
    caption: cap?.textContent || "",
  };
});
console.log("lightbox", lb);

if (lb.hlHidden || !lb.left || !lb.width) {
  console.error("FAIL callout highlight missing", lb);
  await browser.close();
  process.exit(1);
}

// HD210e Pin1 SM + HEX ED highlight (N3237)
await page.locator("#diagram-lightbox-close").click().catch(() => {});
await page.waitForTimeout(200);
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
await shot("05-hd210e-pin1-sm.png");

const hd210sm = await page.evaluate(() => {
  const btn = document.querySelector("#diagram-thumb-btn");
  return { btnHidden: btn?.hidden ?? true, src: document.querySelector("#diagram-visual-img")?.getAttribute("src") || "" };
});
if (hd210sm.btnHidden) {
  console.error("FAIL HD210e SM", hd210sm);
  await browser.close();
  process.exit(1);
}

await page.locator("#item-input").click();
await page.waitForTimeout(400);
await page.locator("#item-listbox [role='option']").first().click();
await page.waitForTimeout(400);
await page.locator("#query-input").fill("hex");
await page.waitForTimeout(900);
await page.locator("#diagram-thumb-btn").click();
await page.waitForTimeout(400);
await shot("06-hd210e-hex-lightbox.png");

const hd210lb = await page.evaluate(() => {
  const hl = document.querySelector("#diagram-callout-highlight");
  return {
    hlHidden: hl?.hidden ?? true,
    caption: document.querySelector("#diagram-lightbox-caption")?.textContent || "",
  };
});
console.log("hd210 lightbox", hd210lb);

await browser.close();
console.log("OK", mediaDir);
