/**
 * RSP-79 — Pin2 Nat Gas first / LPG second + blue/red fuel colours.
 * Run after: npm run build:file
 *   node scripts/smoke-pin2-fuel-colours.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

const mediaDir =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/rsp-79-pin2-fuel-colours";
const localDir = path.resolve("artifacts/rsp-79-pin2-fuel-colours");
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
await seriesInput.type("HD210e", { delay: 20 });
await page.waitForTimeout(500);
await page
  .locator("#series-listbox [role='option']")
  .filter({ hasText: /HD210e/i })
  .first()
  .click();
await page.waitForTimeout(400);

const itemInput = page.locator("#item-input");
await itemInput.click();
await page.waitForTimeout(700);
await shot("01-pin2-hd210e-fuel-order.png");

const rows = await page.evaluate(() => {
  const opts = [...document.querySelectorAll("#item-listbox .model-option")];
  return opts.map((el) => {
    const sub = el.querySelector(".model-option-sub");
    const ng = sub?.querySelector(".pin-fuel--nat-gas");
    const lpg = sub?.querySelector(".pin-fuel--lpg");
    const cs = (node) => (node ? getComputedStyle(node).color : null);
    return {
      label: el.querySelector(".model-option-label")?.textContent.trim() || "",
      subtitle: sub?.textContent.trim() || "",
      restricted: el.classList.contains("model-option--restricted"),
      natGasColor: cs(ng),
      lpgColor: cs(lpg),
      hasNatGas: Boolean(ng),
      hasLpg: Boolean(lpg),
    };
  });
});
console.log("ROWS", JSON.stringify(rows, null, 2));

const active = rows.filter((r) => !r.restricted);
const fuels = active.map((r) =>
  r.hasNatGas ? "nat-gas" : r.hasLpg ? "lpg" : "other"
);
const firstLpg = fuels.indexOf("lpg");
const lastNg = fuels.lastIndexOf("nat-gas");
const orderOk = firstLpg < 0 || lastNg < 0 || lastNg < firstLpg;
const hasNgColour = active.some((r) => r.natGasColor);
const hasLpgColour = active.some((r) => r.lpgColor);

console.log({ fuels, orderOk, hasNgColour, hasLpgColour });

if (!orderOk) {
  console.error("FAIL active units not Nat Gas then LPG");
  await browser.close();
  process.exit(1);
}
if (!hasNgColour || !hasLpgColour) {
  console.error("FAIL missing Nat Gas / LPG colour spans");
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log("OK", mediaDir);
