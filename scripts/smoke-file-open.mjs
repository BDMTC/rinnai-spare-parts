/**
 * Headless Chrome smoke: open dist/index.html via file:// and confirm boot.
 * Usage: node scripts/smoke-file-open.mjs
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const indexHtml = path.join(root, "dist", "index.html");
const fileUrl = pathToFileURL(indexHtml).href;
const chrome =
  process.env.CHROME_PATH ||
  "/usr/bin/google-chrome-stable";

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#app", { timeout: 15000 });

  // Wait until shell leaves the initial empty/fatal state.
  await page.waitForFunction(
    () => {
      const app = document.querySelector("#app");
      if (!app) return false;
      if (app.querySelector(".fatal")) return "fatal";
      // Search input is present once catalogue boots.
      return Boolean(
        app.querySelector('input[type="search"], input#q, .search input, [data-search]') ||
          app.querySelector("header") && app.textContent.includes("Rinnai")
      );
    },
    { timeout: 20000 }
  );

  const snapshot = await page.evaluate(async () => {
    const app = document.querySelector("#app");
    const fatal = app?.querySelector(".fatal");
    const text = (app?.innerText || "").slice(0, 2000);
    const hasSearch =
      Boolean(app?.querySelector("input")) &&
      /search|part|model|margin|quote/i.test(text);
    // Exercise search if possible
    const input =
      app?.querySelector('input[type="search"]') ||
      app?.querySelector('input[type="text"]') ||
      app?.querySelector("input");
    if (input) {
      input.focus();
      input.value = "flow servo";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 400));
    }
    const after = (app?.innerText || "").slice(0, 4000);
    return {
      protocol: location.protocol,
      href: location.href,
      fatal: fatal ? fatal.innerText : null,
      hasSearch,
      mentionsPrice: /ex gst|inc gst|margin/i.test(after),
      mentionsPart: /920|part|servo|sensor/i.test(after),
      sample: after.slice(0, 800),
    };
  });

  const ok =
    snapshot.protocol === "file:" &&
    !snapshot.fatal &&
    snapshot.hasSearch &&
    snapshot.mentionsPrice &&
    errors.length === 0;

  console.log(JSON.stringify({ ok, snapshot, errors }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}
