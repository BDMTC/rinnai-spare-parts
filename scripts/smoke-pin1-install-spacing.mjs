/**
 * RSP-78 — pinned Pin1 chip keeps space before External/Internal.
 * Run after: npm run build:file
 *   node scripts/smoke-pin1-install-spacing.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-78-pin1-install-spacing";
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync("artifacts/rsp-78-pin1-install-spacing", { recursive: true });

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

await pinContinuousFlow();

async function shot(name) {
  for (const d of [
    path.join(mediaDir, name),
    path.join("artifacts/rsp-78-pin1-install-spacing", name),
  ]) {
    await page.screenshot({ path: d, fullPage: false });
  }
  console.log("shot", name);
}

const input = page.locator("#series-input");
await input.click();
await input.fill("");
await input.type("HD200e", { delay: 25 });
await page.waitForTimeout(700);
await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /External/i })
  .first()
  .click();
await page.waitForTimeout(400);
await input.blur();
await page.waitForTimeout(300);
await shot("01-hd200e-external-spaced.png");

const check = await page.evaluate(() => {
  const rich = document.querySelector(
    "#series-picker .model-picker-rich-label-text"
  );
  const text = rich?.textContent || "";
  const html = rich?.innerHTML || "";
  const ext = rich?.querySelector(".pin-install--external");
  return {
    text,
    html,
    hasSpaceBeforeExternal: /200 External/.test(text),
    jammed: /200External/.test(text),
    externalColor: ext ? getComputedStyle(ext).color : null,
  };
});
console.log("CHECK", JSON.stringify(check, null, 2));

if (check.jammed || !check.hasSpaceBeforeExternal || !check.externalColor) {
  console.error("FAIL spacing/colour");
  await browser.close();
  process.exit(1);
}

await page.locator("#series-clear").click();
await page.waitForTimeout(200);
await input.click();
await input.fill("");
await input.type("HD200i", { delay: 25 });
await page.waitForTimeout(700);
await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /Internal/i })
  .first()
  .click();
await page.waitForTimeout(400);
await input.blur();
await page.waitForTimeout(300);
await shot("02-hd200i-internal-spaced.png");

const checkI = await page.evaluate(() => {
  const rich = document.querySelector(
    "#series-picker .model-picker-rich-label-text"
  );
  const text = rich?.textContent || "";
  return {
    text,
    hasSpaceBeforeInternal: /200 Internal/.test(text),
    jammed: /200Internal/.test(text),
  };
});
console.log("CHECK_I", JSON.stringify(checkI, null, 2));
if (checkI.jammed || !checkI.hasSpaceBeforeInternal) {
  console.error("FAIL internal spacing");
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log("OK", mediaDir);
