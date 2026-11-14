import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const root = "public/assets/process-family-examples";
fs.mkdirSync(root, { recursive: true });

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 RSP-desk" }, timeout: 45000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`${url} -> ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 RSP-desk" }, timeout: 60000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`${url} -> ${res.statusCode}`));
          res.resume();
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      }
    );
    req.on("error", (e) => {
      file.close();
      try {
        fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
      reject(e);
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function extract(html) {
  const re =
    /https:\/\/a\.storyblok\.com\/f\/[0-9]+\/[0-9]+x[0-9]+\/[a-f0-9]+\/[^"\s?]+\.(?:png|jpg|jpeg|webp)/gi;
  return [...new Set((html.match(re) || []).map((u) => u.replace(/\\u002F/g, "/")))];
}

function score(url, fam) {
  const n = url.toLowerCase();
  const rules = {
    cf: [/hw-gas-cf/, /infinity/, /flowmaster/, /builder/, /hd\d/, /hdc/, /enviro/],
    accessory: [
      /controller|con-deluxe|con-kitchen|con-gas|smartstart|pipe-cover|recess|flue|secbrack|watersaver|acc-/,
    ],
    hotflo: [/hotflo|electric-storage|elect-storage/],
    "heat-pump": [/enviroflo|electric-hp|hw-hp|heat.?pump|ehpa|hotflo-plus|hotflo-250/],
    efinity: [/efinity|ele-cf-enfinity|electric-cf-efinity/],
    "ghf-solar": [/gas-storage|solar|evacuated|ghf|prestige|booster/],
  };
  const bad = [
    /ac-|apac-|he-gas-portable|he-brivis|he-outdoor|he-electric-panel|con-brivis|social-share/,
  ];
  if (bad.some((r) => r.test(n))) return -1;
  const rs = rules[fam] || [];
  let s = 0;
  for (const r of rs) if (r.test(n)) s += 2;
  if (/ima\.(png|jpg|jpeg|webp)$/.test(n) || /-ima\./.test(n) || /front/.test(n)) s += 1;
  if (/ban\.|banner|feature-main|collection/.test(n)) s -= 0.5;
  return s;
}

const seeds = {
  cf: [
    "https://www.rinnai.com.au/hot-water/gas-continuous-flow",
    "https://www.rinnai.com.au/home/catalogue/products/infinity/infinity-32",
    "https://www.rinnai.com.au/home/catalogue/products/infinity/infinity-26",
  ],
  accessory: [
    "https://www.rinnai.com.au/home/hot-water/controllers",
    "https://www.rinnai.com.au/hot-water/gas-continuous-flow",
  ],
  hotflo: [
    "https://www.rinnai.com.au/home/catalogue/products/hotflo-electric-storage/hotflo-medium-electric-storage-160l",
    "https://www.rinnai.com.au/home/catalogue/products/hotflo-electric-storage/hotflo-medium-electric-storage-80l",
    "https://www.rinnai.com.au/home/catalogue/products/hotflo-electric-storage/hotflo-medium-electric-storage-125l",
    "https://www.rinnai.com.au/home/catalogue/products/hotflo-electric-storage/hotflo-medium-electric-storage-315l",
  ],
  "heat-pump": [
    "https://www.rinnai.com.au/hot-water/electric-heat-pump",
    "https://www.rinnai.com.au/home/catalogue/products/enviroflo-electric-ar/enviroflo-ar-300L-heat-pump",
  ],
  efinity: [
    "https://www.rinnai.com.au/hot-water/electric-continuous-flow",
    "https://www.rinnai.com.au/home/catalogue/products/efinity/efinity-19kw",
    "https://www.rinnai.com.au/home/catalogue/products/efinity/efinity-14kw",
    "https://www.rinnai.com.au/home/catalogue/products/efinity/efinity-29kw",
  ],
  "ghf-solar": [
    "https://www.rinnai.com.au/home/catalogue/products/hotflo-gas-storage/hotflo-gas-storage-135l",
    "https://www.rinnai.com.au/home/catalogue/products/hotflo-gas-storage/hotflo-gas-storage-170l",
    "https://www.rinnai.com.au/discover/buyers-guide-hot-water",
    "https://www.rinnai.com.au/home/catalogue/products/hotflo-electric-storage/hotflo-medium-electric-storage-160l",
  ],
};

async function gather(fam, urls) {
  const set = new Set();
  for (const u of urls) {
    try {
      const html = await fetchText(u);
      for (const img of extract(html)) set.add(img);
      console.log(fam, "ok", u, "->", set.size);
    } catch (e) {
      console.log(fam, "fail", u, e.message);
    }
  }
  return [...set]
    .map((url) => ({ url, s: score(url, fam) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.url.localeCompare(b.url));
}

function safeName(url, i) {
  const base = path
    .basename(new URL(url).pathname)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase();
  const ext = path.extname(base) || ".png";
  const stem = path.basename(base, ext).slice(0, 48);
  return `${String(i + 1).padStart(2, "0")}-${stem}${ext}`;
}

const manifest = {};
for (const [fam, urls] of Object.entries(seeds)) {
  const ranked = await gather(fam, urls);
  const dir = path.join(root, fam);
  fs.mkdirSync(dir, { recursive: true });
  const picked = ranked.slice(0, 28);
  const saved = [];
  for (const item of picked) {
    if (saved.length >= 20) break;
    const name = safeName(item.url, saved.length);
    const dest = path.join(dir, name);
    try {
      await download(item.url, dest);
      const st = fs.statSync(dest);
      if (st.size < 5000) {
        fs.unlinkSync(dest);
        continue;
      }
      saved.push({ file: `${fam}/${name}`, source: item.url });
      console.log("saved", fam, name, st.size);
    } catch (e) {
      console.log("dl fail", fam, e.message);
    }
  }
  manifest[fam] = saved;
  console.log("FAMILY", fam, saved.length);
}

delete manifest.mixed;

fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, v.length])),
    null,
    2
  )
);
