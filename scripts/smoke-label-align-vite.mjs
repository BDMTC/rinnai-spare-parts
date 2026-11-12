/**
 * Vite proof: colon column alignment on TOP HEX card.
 * node scripts/smoke-label-align-vite.mjs
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const media =
  "C:/Users/purchasing/AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-d92c502a-6769-481d-8807-f6d8424bcab1/files/media/card-layout";
fs.mkdirSync(media, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
await page.goto(`http://127.0.0.1:5173/?cb=${Date.now()}`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.reload({ waitUntil: "networkidle" });

const q = page.locator("#query-input");
await q.fill("");
await q.type("heat exchanger", { delay: 8 });
await q.press("Enter");
await page.waitForTimeout(1100);

const cards = page.locator(".result");
let idx = 0;
for (let i = 0; i < Math.min(await cards.count(), 12); i++) {
  if (/92099423/.test(await cards.nth(i).innerText())) {
    idx = i;
    break;
  }
}
const card = cards.nth(idx);

const proof = await card.evaluate((el) => {
  const id = el.querySelector(".result-identity");
  const labels = [...id.querySelectorAll(".result-field-label")];
  const colons = [...id.querySelectorAll(".result-field-colon")];
  const values = [...id.querySelectorAll(".result-field-value")];
  function inkBox(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    return { left: r.left, right: r.right, width: r.width };
  }
  return {
    labelInk: labels.map((l) => ({
      text: l.textContent,
      ...inkBox(l),
      align: getComputedStyle(l).textAlign,
      weight: getComputedStyle(l).fontWeight,
      size: getComputedStyle(l).fontSize,
      font: getComputedStyle(l).fontFamily,
    })),
    colonInk: colons.map((c) => ({
      ...inkBox(c),
      left: c.getBoundingClientRect().left,
      weight: getComputedStyle(c).fontWeight,
      size: getComputedStyle(c).fontSize,
    })),
    valueInk: values.map((v) => ({
      text: v.textContent.trim().slice(0, 30),
      left: v.getBoundingClientRect().left,
      weight: getComputedStyle(v).fontWeight,
      size: getComputedStyle(v).fontSize,
      font: getComputedStyle(v).fontFamily,
    })),
  };
});

await card.evaluate((el) => {
  const colons = [...el.querySelectorAll(".result-field-colon")];
  const x = colons[0].getBoundingClientRect().left;
  const id = el.querySelector(".result-identity");
  const idr = id.getBoundingClientRect();
  const line = document.createElement("div");
  line.id = "align-proof-line";
  line.style.position = "fixed";
  line.style.left = `${x}px`;
  line.style.top = `${idr.top - 4}px`;
  line.style.width = "2px";
  line.style.height = `${idr.height + 8}px`;
  line.style.background = "#e11";
  line.style.zIndex = "99999";
  line.style.pointerEvents = "none";
  document.body.appendChild(line);
});

const idBox = await card.locator(".result-identity").boundingBox();
const shot = path.join(media, "vite-label-align.png");
await page.screenshot({
  path: shot,
  clip: {
    x: idBox.x - 12,
    y: idBox.y - 28,
    width: idBox.width + 24,
    height: idBox.height + 56,
  },
});
await page.screenshot({
  path: path.join(media, "vite-label-align-full.png"),
  fullPage: false,
});

const colonDelta = Math.abs(proof.colonInk[0].left - proof.colonInk[1].left);
const valueDelta = Math.abs(proof.valueInk[0].left - proof.valueInk[1].left);
const labelInkDelta = proof.labelInk[0].left - proof.labelInk[1].left;
const sameLabelFace =
  proof.labelInk[0].font === proof.labelInk[1].font &&
  proof.labelInk[0].size === proof.labelInk[1].size &&
  proof.labelInk[0].weight === proof.labelInk[1].weight;
const sameValueFace =
  proof.valueInk[0].font === proof.valueInk[1].font &&
  proof.valueInk[0].size === proof.valueInk[1].size &&
  proof.valueInk[0].weight === proof.valueInk[1].weight;

const ok =
  colonDelta <= 1 &&
  valueDelta <= 1 &&
  labelInkDelta > 5 &&
  sameLabelFace &&
  sameValueFace;

console.log(
  JSON.stringify(
    {
      proof,
      colonDelta,
      valueDelta,
      labelInkDelta,
      sameLabelFace,
      sameValueFace,
      ok,
      shot,
    },
    null,
    2
  )
);

await browser.close();
process.exit(ok ? 0 : 1);
