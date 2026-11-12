/**
 * Smoke card layout: no aliases block; category+fit tags; blurb in body.
 * Run after build:file: node scripts/smoke-card-layout.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/card-layout";
fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync("artifacts/card-layout", { recursive: true });

const distHtml = path.resolve("dist/index.html");
const fileUrl = pathToFileURL(distHtml).href;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
await page.goto(fileUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(1000);

async function shot(name) {
  const p1 = path.join(mediaDir, name);
  const p2 = path.join("artifacts/card-layout", name);
  await page.screenshot({ path: p1, fullPage: false });
  await page.screenshot({ path: p2, fullPage: false });
  return p1;
}

async function setQuery(q) {
  const input = page.locator("#query-input");
  await input.fill("");
  await input.type(q, { delay: 15 });
  await input.press("Enter");
  await page.waitForTimeout(900);
}

async function pinHd200e() {
  const input = page.locator("#model-query, #model-input, .model-typeahead input, .search-panel input").first();
  await input.click();
  await input.fill("");
  await input.type("HD200e", { delay: 30 });
  await page.waitForTimeout(600);
  const opt = page.locator("[role='option'], .suggestion, .typeahead-item, li, button").filter({ hasText: /HD200e/i }).first();
  if (await opt.count()) await opt.click();
  else await input.press("Enter");
  await page.waitForTimeout(700);
}

async function inspectTop() {
  const card = page.locator(".result").first();
  await card.waitFor({ timeout: 15000 });
  return card.evaluate((el) => {
    const text = el.innerText;
    return {
      code: el.querySelector(".result-code")?.textContent?.trim(),
      name: el.querySelector(".result-name")?.textContent?.trim(),
      hasCodeLabel: /Rinnai part code:/i.test(
        el.querySelector(".result-code")?.textContent || ""
      ),
      hasDescLabel: /Rinnai description:/i.test(
        el.querySelector(".result-name")?.textContent || ""
      ),
      summaryInHead: Boolean(el.querySelector(".result-head .result-summary")),
      summaryInBody: Boolean(el.querySelector(".result-body .result-summary")),
      summary: el.querySelector(".result-summary")?.textContent?.trim(),
      tags: [...el.querySelectorAll(".result-tags .category-tag, .result-tags .model-tag")].map((t) => t.textContent.trim()),
      hasAliasesHeading: /Aliases/i.test(text),
      hasEmptyAliasesMsg: /No stored part aliases/i.test(text),
      hasModelFitHeading: /Model fit/i.test(text),
    };
  });
}

const report = { tip: "card-layout" };

await setQuery("hex");
report.unpinned = await inspectTop();
report.unpinnedShot = await shot("card-unpinned-hex.png");

await pinHd200e();
await setQuery("hex");
report.pinned = await inspectTop();
report.pinnedShot = await shot("card-pinned-hd200e-hex.png");

report.ok =
  !report.unpinned.hasAliasesHeading &&
  !report.unpinned.hasEmptyAliasesMsg &&
  !report.unpinned.hasModelFitHeading &&
  report.unpinned.summaryInBody &&
  !report.unpinned.summaryInHead &&
  !report.pinned.hasAliasesHeading &&
  report.pinned.summaryInBody &&
  report.pinned.hasCodeLabel &&
  report.pinned.hasDescLabel &&
  /92093550/.test(report.pinned.code || "");

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
