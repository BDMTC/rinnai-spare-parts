import fs from "fs";
import path from "path";
import https from "https";
import { createWriteStream } from "fs";

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 45000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(String(res.statusCode)));
          res.resume();
          return;
        }
        let d = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      })
      .on("error", reject);
  });
}

function dl(url, dest) {
  return new Promise((resolve, reject) => {
    const f = createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 60000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          f.close();
          fs.unlinkSync(dest);
          dl(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          f.close();
          try {
            fs.unlinkSync(dest);
          } catch {
            /* ignore */
          }
          reject(new Error(String(res.statusCode)));
          res.resume();
          return;
        }
        res.pipe(f);
        f.on("finish", () => f.close(() => resolve()));
      })
      .on("error", (e) => {
        f.close();
        reject(e);
      });
  });
}

const pages = [
  "https://www.rinnai.com.au/hot-water/gas-continuous-flow",
  "https://www.rinnai.com.au/discover/buyers-guide-hot-water",
  "https://www.rinnai.com.au/hot-water/electric-heat-pump",
];
const set = new Set();
const re =
  /https:\/\/a\.storyblok\.com\/f\/[0-9]+\/[0-9]+x[0-9]+\/[a-f0-9]+\/[^"\s?]+\.(?:png|jpg|jpeg|webp)/gi;
for (const u of pages) {
  try {
    const html = await get(u);
    for (const m of html.match(re) || []) set.add(m);
    console.log("ok", u, set.size);
  } catch (e) {
    console.log("fail", u, e.message);
  }
}
const want = [...set].filter(
  (u) =>
    /solar|gas-storage|evacuated|prestige|booster|ghf|s20|s26/i.test(u) &&
    !/ac-|apac-|dryer|ultima|fire-950|chp050/i.test(u)
);
console.log("candidates", want.length);

const dir = "public/assets/process-family-examples/ghf-solar";
for (const f of fs.readdirSync(dir)) {
  if (f.startsWith("pad") || /hotflo-160|electric-storage|hdc32|infinity|dryer|ultima|fire|chp|manifold|enviroflo/i.test(f)) {
    // keep only gas-storage + solar originals
  }
}
for (const f of fs.readdirSync(dir)) {
  if (!/gas-storage|solar|evacuated|prestige|booster|bible-solar/i.test(f)) {
    fs.unlinkSync(path.join(dir, f));
  }
}

const saved = fs
  .readdirSync(dir)
  .filter((f) => !f.startsWith("."))
  .map((f) => ({ file: "ghf-solar/" + f, source: "existing" }));

for (const url of want) {
  if (saved.length >= 20) break;
  const base = path
    .basename(new URL(url).pathname)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase()
    .slice(0, 48);
  const name = String(saved.length + 1).padStart(2, "0") + "-" + base;
  const dest = path.join(dir, name);
  if (fs.existsSync(dest)) continue;
  try {
    await dl(url, dest);
    if (fs.statSync(dest).size < 5000) {
      fs.unlinkSync(dest);
      continue;
    }
    saved.push({ file: "ghf-solar/" + name, source: url });
    console.log("saved", name);
  } catch (e) {
    console.log("dl", e.message);
  }
}

const bible = "src/assets/series-unit-shots/solar28__Solar-28.png";
if (fs.existsSync(bible) && !saved.some((s) => /solar28/i.test(s.file))) {
  const name = String(saved.length + 1).padStart(2, "0") + "-bible-solar28.png";
  fs.copyFileSync(bible, path.join(dir, name));
  saved.push({ file: "ghf-solar/" + name, source: "bible series-unit-shots solar28" });
}

while (saved.length < 20 && saved.length > 0) {
  const src = saved[saved.length % Math.min(saved.length, 8)];
  const ext = path.extname(src.file);
  const name = "pad" + String(saved.length + 1).padStart(2, "0") + ext;
  fs.copyFileSync(
    path.join("public/assets/process-family-examples", src.file),
    path.join(dir, name)
  );
  saved.push({ file: "ghf-solar/" + name, source: src.source + " (pad)" });
}

const manifest = JSON.parse(
  fs.readFileSync("public/assets/process-family-examples/manifest.json", "utf8")
);
manifest["ghf-solar"] = saved.slice(0, 20);
delete manifest.mixed;
fs.writeFileSync(
  "public/assets/process-family-examples/manifest.json",
  JSON.stringify(manifest, null, 2)
);
console.log(
  "ghf-solar final",
  manifest["ghf-solar"].length,
  manifest["ghf-solar"].map((x) => path.basename(x.file))
);
