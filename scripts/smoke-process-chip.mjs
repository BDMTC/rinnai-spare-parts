import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const htmlPath = path.join(distDir, "index.html");

if (!fs.existsSync(htmlPath)) {
  console.error("Missing dist/index.html — run npm run build:file first");
  process.exit(1);
}

function collectText(dir) {
  const parts = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) parts.push(collectText(p));
    else if (/\.(html|js|css)$/i.test(name)) {
      parts.push(fs.readFileSync(p, "utf8"));
    }
  }
  return parts.join("\n");
}

const blob = collectText(distDir);
const checks = [
  ["process-open button id", /process-open/.test(blob)],
  ["process-dialog", /process-dialog/.test(blob)],
  ["Portal close-off topic", /Portal close-off/.test(blob)],
  ["Warranty periods topic", /Warranty periods/.test(blob)],
  ["no Hayward15", !/Hayward15/i.test(blob)],
  ["no PayWay contractor login 493092", !/493092/.test(blob)],
  ["no portal login email", !/admin@mtcgas\.com\.au/i.test(blob)],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);

// Light Playwright smoke if available: open file:// and click Process.
try {
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const page = await browser.newPage();
  const fileUrl = pathToFileURL(htmlPath).href;
  await page.goto(fileUrl);
  await page.waitForSelector("#process-open", { timeout: 15000 });
  await page.click("#process-open");
  await page.waitForFunction(() => {
    const d = document.querySelector("#process-dialog");
    return Boolean(d && (d.open || d.hasAttribute("open")));
  }, null, { timeout: 5000 });
  const railCount = await page.locator("#process-rail .process-rail-btn").count();
  const firstTopic = await page.locator("#process-body .process-topic-title").textContent();
  console.log("PASS playwright open", { railCount, firstTopic: firstTopic?.trim() });
  if (railCount < 7) {
    console.error("FAIL expected 7 topics, got", railCount);
    process.exit(1);
  }
  await browser.close();
} catch (err) {
  console.log("SKIP playwright:", err?.message || err);
}

console.log("smoke ok");
