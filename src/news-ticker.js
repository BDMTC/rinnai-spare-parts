/**
 * Pin2-side news ticker — Brisbane/SE QLD weekly weather (per-day items),
 * top Brisbane traffic incidents, urgent QLD news, Rinnai AU announcements.
 * Every item is a hyperlink. Public feeds only. Offline gag only when the
 * browser is truly offline; file:// uses direct fetch then CORS relays.
 */

const WEATHER_LABEL = "Brisbane / SE QLD";
const WTTR_URL = "https://wttr.in/Brisbane?format=j1";
const WEATHER_PAGE_URL = "https://www.bom.gov.au/qld/forecasts/brisbane.shtml";
const ABC_QLD_RSS = "https://www.abc.net.au/news/feed/45910/rss.xml";
const ABC_NEWS_HOME = "https://www.abc.net.au/news/";
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const RINNAI_NEWS_URL = "https://www.rinnai.com.au/news";
const ALLORIGINS_RAW = "https://api.allorigins.win/raw?url=";
/** Public QLDTraffic GeoJSON (CORS *); no API key. */
const TRAFFIC_GEOJSON_URL =
  "https://data.qldtraffic.qld.gov.au/events_v2.geojson";
const TRAFFIC_PAGE_URL = "https://qldtraffic.qld.gov.au/";
const TRAFFIC_TOP_N = 10;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const QLD_HINT =
  /\b(qld|queensland|brisbane|gold coast|sunshine coast|toowoomba|cairns|townsville|rockhampton|mackay|bundaberg|ipswich|logan|moreton|seq|south.?east queensland)\b/i;

/** Exact locality tokens for Brisbane + inner SEQ (matched on locality only). */
const BNE_LOCALITIES = new Set(
  [
    "brisbane",
    "brisbane city",
    "south brisbane",
    "north brisbane",
    "fortitude valley",
    "west end",
    "chermside",
    "indooroopilly",
    "capalaba",
    "beenleigh",
    "springfield",
    "springfield lakes",
    "springfield central",
    "forest lake",
    "carindale",
    "mt gravatt",
    "mount gravatt",
    "upper mt gravatt",
    "sunnybank",
    "sunnybank hills",
    "eight mile plains",
    "rochedale",
    "rocklea",
    "oxley",
    "darra",
    "wacol",
    "richlands",
    "inala",
    "acacia ridge",
    "coopers plains",
    "salisbury",
    "yeerongpilly",
    "yeronga",
    "fairfield",
    "annerley",
    "anstead",
    "bellbowrie",
    "kenmore",
    "fig tree pocket",
    "toowong",
    "paddington",
    "ashgrove",
    "the gap",
    "mitchelton",
    "keperra",
    "everton park",
    "albany creek",
    "aspley",
    "bridgeman downs",
    "carseldine",
    "zillmere",
    "nundah",
    "clayfield",
    "hamilton",
    "ascot",
    "hendra",
    "eagle farm",
    "pinkenba",
    "murarrie",
    "cannon hill",
    "morningside",
    "balmoral",
    "bulimba",
    "hawthorne",
    "norman park",
    "coorparoo",
    "greenslopes",
    "holland park",
    "wishart",
    "mansfield",
    "macgregor",
    "slacks creek",
    "springwood",
    "daisy hill",
    "shailer park",
    "loganholme",
    "waterford",
    "bethania",
    "edens landing",
    "holmview",
    "browns plains",
    "park ridge",
    "marsden",
    "woodridge",
    "kingston",
    "loganlea",
    "meadowbrook",
    "underwood",
    "kuraby",
    "stretton",
    "calamvale",
    "algester",
    "pallara",
    "heathwood",
    "larapinta",
    "doolandella",
    "durack",
    "willawong",
    "archerfield",
    "moorooka",
    "woolloongabba",
    "kangaroo point",
    "east brisbane",
    "camp hill",
    "carina",
    "carina heights",
    "tingalpa",
    "wynnum",
    "manly",
    "lota",
    "cleveland",
    "ormiston",
    "wellington point",
    "birkdale",
    "thorneside",
    "redland bay",
    "victoria point",
    "thornlands",
    "alexandra hills",
    "sheldon",
    "mt cotton",
    "mount cotton",
    "moggill",
    "riverview",
    "rosewood",
    "bundamba",
    "booval",
    "yamanto",
    "goodna",
    "ipswich",
    "logan",
    "elimbah",
    "morayfield",
    "griffin",
    "murrumba downs",
    "tallegalla",
    "mount walker",
    "cedar vale",
  ].map((s) => s.toLowerCase())
);

/**
 * @typedef {{ kind: string, text: string, href?: string, source?: string }} TickerItem
 */

/**
 * Offline / feed-fail wink only — short title nod, never full song lyrics
 * (copyright). No href (not a link).
 * @type {TickerItem}
 */
export const OFFLINE_STUB = Object.freeze({
  kind: "offline",
  text: "Don't worry, be happy… (offline — no feed)",
  href: "",
  source: "stub",
});

/** @deprecated use OFFLINE_STUB — kept name for older call sites */
export const TICKER_STUBS = Object.freeze([OFFLINE_STUB]);

/**
 * @returns {TickerItem[]}
 */
function offlineStubItems() {
  return [{ ...OFFLINE_STUB }];
}

/**
 * file:// pages use Origin "null". Some hosts answer ACAO:* which Chromium
 * can reject for null; others time out. Try direct, then public CORS relays.
 * @param {string} url
 * @param {number} [ms]
 * @returns {Promise<Response|null>}
 */
async function fetchSoft(url, ms = 8000) {
  const candidates = [url];
  // Relays that re-emit CORS for browser / file:// null origin.
  candidates.push(`https://corsproxy.io/?${encodeURIComponent(url)}`);
  candidates.push(`${ALLORIGINS_RAW}${encodeURIComponent(url)}`);

  for (const candidate of candidates) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      const res = await fetch(candidate, {
        signal: ctrl.signal,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) continue;
      return res;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Comfortable ticker crawl — ~42 px/s of the duplicated track half (= 100%). */
const TICKER_PX_PER_SEC = 42;
const TICKER_SPEED_KEY = "rinnai-ticker-speed-mult";
const TICKER_SPEED_STEP = 0.25;
const TICKER_SPEED_MIN = 0.25;
const TICKER_SPEED_MAX = 2;
/** mid button = 50% of comfortable crawl */
const TICKER_SPEED_MID = 0.5;

/** @type {number} */
let tickerSpeedMult = 1;

/**
 * @param {unknown} raw
 * @returns {number}
 */
function clampSpeedMult(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  const stepped = Math.round(n / TICKER_SPEED_STEP) * TICKER_SPEED_STEP;
  return Math.min(TICKER_SPEED_MAX, Math.max(TICKER_SPEED_MIN, stepped));
}

function loadSpeedMult() {
  try {
    const raw = localStorage.getItem(TICKER_SPEED_KEY);
    if (raw == null || raw === "") return 1;
    return clampSpeedMult(raw);
  } catch {
    return 1;
  }
}

/**
 * @param {number} mult
 */
function saveSpeedMult(mult) {
  tickerSpeedMult = clampSpeedMult(mult);
  try {
    localStorage.setItem(TICKER_SPEED_KEY, String(tickerSpeedMult));
  } catch {
    /* private mode / file:// quirks — still apply in-session */
  }
}

/**
 * @param {HTMLElement} track
 */
function syncTickerDuration(track) {
  const half = Math.max(1, track.scrollWidth / 2);
  const pxPerSec = Math.max(8, TICKER_PX_PER_SEC * tickerSpeedMult);
  // Higher speed → shorter duration. Floor/cap keep extremes sane.
  const sec = Math.max(30, Math.min(320, half / pxPerSec));
  track.style.setProperty("--ticker-duration", `${sec.toFixed(1)}s`);
}

/**
 * @param {ParentNode|Document} [scope]
 */
function syncSpeedButtons(scope = document) {
  const mid = scope.querySelector?.("#ticker-speed-mid");
  if (mid instanceof HTMLElement) {
    mid.classList.toggle("is-active", Math.abs(tickerSpeedMult - TICKER_SPEED_MID) < 0.01);
  }
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string}
 */
function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr.slice(5);
  return DAY_NAMES[d.getDay()];
}

/**
 * Soften loud WMO-ish phrases without chopping by character length.
 * @param {string} desc
 * @returns {string}
 */
function tidyWeatherDesc(desc) {
  return String(desc || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/thundery outbreaks in nearby/gi, "Thundery outbreaks nearby")
    .replace(/patchy rain nearby/gi, "Patchy rain nearby");
}

/**
 * One ticker item per forecast day — full description, no char truncate.
 * @param {any} data
 * @returns {TickerItem[]}
 */
export function formatWeeklyForecastDays(data) {
  const days = Array.isArray(data?.weather) ? data.weather.slice(0, 7) : [];
  return days.map((day) => {
    const label = dayLabel(String(day.date || ""));
    const min = day.mintempC ?? "?";
    const max = day.maxtempC ?? "?";
    const noon = Array.isArray(day.hourly)
      ? day.hourly.find((h) => Number(h.time) === 1200) || day.hourly[4]
      : null;
    const desc = tidyWeatherDesc(noon?.weatherDesc?.[0]?.value || "");
    const text = desc
      ? `${WEATHER_LABEL} · ${label} ${min}–${max}° · ${desc}`
      : `${WEATHER_LABEL} · ${label} ${min}–${max}°`;
    return {
      kind: "weather",
      text,
      href: WEATHER_PAGE_URL,
    };
  });
}

/** @deprecated use formatWeeklyForecastDays — kept for older smoke checks */
export function formatWeeklyForecast(data) {
  const days = formatWeeklyForecastDays(data);
  if (!days.length) return null;
  return days.map((d) => d.text.replace(`${WEATHER_LABEL} · `, "")).join(" · ");
}

/**
 * @returns {Promise<TickerItem[]>}
 */
async function fetchWeeklyWeather() {
  const res = await fetchSoft(WTTR_URL, 10000);
  if (!res) return [];
  try {
    const data = await res.json();
    return formatWeeklyForecastDays(data);
  } catch {
    return [];
  }
}

/**
 * Prefer Queensland-flavoured ABC Top Stories; fall back to top items.
 * @returns {Promise<TickerItem[]>}
 */
async function fetchQldNews() {
  const res = await fetchSoft(`${RSS2JSON}${encodeURIComponent(ABC_QLD_RSS)}`, 10000);
  if (!res) return [];
  try {
    const data = await res.json();
    if (data?.status !== "ok" || !Array.isArray(data.items)) return [];
    const items = data.items
      .map((it) => ({
        title: String(it.title || "")
          .replace(/\s+/g, " ")
          .trim(),
        href: String(it.link || it.url || "").trim(),
        blob: `${it.title || ""} ${it.description || ""}`,
      }))
      .filter((it) => it.title.length > 8 && /^https?:\/\//i.test(it.href));

    const qld = items.filter((it) => QLD_HINT.test(it.blob));
    const picked = (qld.length ? qld : items).slice(0, 4);
    return picked.map((it) => ({
      kind: "news",
      text: `QLD · ${it.title}`,
      href: it.href,
    }));
  } catch {
    return [];
  }
}

/**
 * Decode a few HTML entities in scraped titles.
 * @param {string} s
 */
function decodeBasicEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Absolute URL for a Rinnai path or href.
 * @param {string} href
 */
function absoluteRinnaiUrl(href) {
  try {
    return new URL(href, RINNAI_NEWS_URL).href;
  } catch {
    return RINNAI_NEWS_URL;
  }
}

/**
 * @param {any} feature QLDTraffic GeoJSON feature
 * @returns {boolean}
 */
export function isBrisbaneAreaTraffic(feature) {
  const p = feature?.properties || {};
  const rs = p.road_summary || {};
  if (/metropolitan/i.test(String(rs.district || ""))) return true;
  if (
    /\b(brisbane|ipswich|logan|moreton bay|redland)\b/i.test(
      String(rs.local_government_area || "")
    )
  ) {
    return true;
  }
  // Locality only (split on / ,) — avoid false hits like "Hamilton Plains" (Whitsundays).
  const parts = String(rs.locality || "")
    .toLowerCase()
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.some((loc) => BNE_LOCALITIES.has(loc));
}

/**
 * Rank: High → Medium → Low, then crash/congestion/hazard/flood before
 * roadworks, then newest last_updated.
 * @param {any} feature
 * @returns {number}
 */
function trafficRankScore(feature) {
  const p = feature?.properties || {};
  const pri = String(p.event_priority || "").toLowerCase();
  const priScore = pri === "high" ? 0 : pri === "medium" ? 1 : 2;
  const type = `${p.event_type || ""} ${p.event_subtype || ""}`.toLowerCase();
  let typeScore = 5;
  if (/\bcrash\b/.test(type)) typeScore = 0;
  else if (/\bcongestion\b/.test(type)) typeScore = 1;
  else if (/\bflood/.test(type)) typeScore = 2;
  else if (/\bhazard\b/.test(type)) typeScore = 3;
  else if (/\bspecial event\b/.test(type)) typeScore = 4;
  const updated = Date.parse(p.last_updated || "") || 0;
  // Lower is better for sort; bake recency as negative ms fraction.
  return priScore * 1e12 + typeScore * 1e10 - updated;
}

/**
 * Full-text traffic ticker line — never character-truncated.
 * @param {any} feature
 * @returns {TickerItem|null}
 */
export function formatTrafficItem(feature) {
  const p = feature?.properties || {};
  const rs = p.road_summary || {};
  const kind = [p.event_type, p.event_subtype].filter(Boolean).join(" / ");
  const road = String(rs.road_name || "").replace(/\s+/g, " ").trim();
  const locality = String(rs.locality || "").replace(/\s+/g, " ").trim();
  const advice = String(p.advice || "").replace(/\s+/g, " ").trim();
  const desc = String(p.description || "").replace(/\s+/g, " ").trim();
  const bits = ["Traffic"];
  if (kind) bits.push(kind);
  if (road) bits.push(road);
  if (locality) bits.push(locality);
  if (advice) bits.push(advice);
  if (desc) bits.push(desc);
  const text = bits.join(" · ");
  if (text === "Traffic") return null;
  const hrefRaw = String(p.web_link || "").trim();
  const href = /^https?:\/\//i.test(hrefRaw) ? hrefRaw : TRAFFIC_PAGE_URL;
  return { kind: "traffic", text, href };
}

/**
 * Top N Brisbane-area incidents from QLDTraffic GeoJSON.
 * @param {any} data FeatureCollection
 * @param {number} [limit]
 * @returns {TickerItem[]}
 */
export function pickTopBrisbaneTraffic(data, limit = TRAFFIC_TOP_N) {
  const features = Array.isArray(data?.features) ? data.features : [];
  return features
    .filter((f) => String(f?.properties?.status || "") === "Published")
    .filter(isBrisbaneAreaTraffic)
    .sort((a, b) => trafficRankScore(a) - trafficRankScore(b))
    .slice(0, limit)
    .map(formatTrafficItem)
    .filter(Boolean);
}

/**
 * @returns {Promise<TickerItem[]>}
 */
async function fetchBrisbaneTraffic() {
  // ~3 MB GeoJSON; allow headroom especially via CORS relay on file://.
  const res = await fetchSoft(TRAFFIC_GEOJSON_URL, 45000);
  if (!res) return [];
  try {
    const data = await res.json();
    return pickTopBrisbaneTraffic(data, TRAFFIC_TOP_N);
  } catch {
    return [];
  }
}

/**
 * Scrape public Rinnai AU /news cards (title + article href).
 * @returns {Promise<TickerItem[]>}
 */
async function fetchRinnaiNews() {
  const urls = [
    `${ALLORIGINS_RAW}${encodeURIComponent(RINNAI_NEWS_URL)}`,
    RINNAI_NEWS_URL,
  ];
  for (const url of urls) {
    const res = await fetchSoft(url, 10000);
    if (!res) continue;
    try {
      const html = await res.text();
      /** @type {TickerItem[]} */
      const found = [];
      const seen = new Set();

      // Prefer linked headings / cards: <a href="/news/...">Title</a> near news paths
      const linkRe =
        /<a[^>]+href=["'](\/news\/[^"'#?]+|https?:\/\/(?:www\.)?rinnai\.com\.au\/news\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = linkRe.exec(html)) && found.length < 6) {
        const href = absoluteRinnaiUrl(m[1]);
        const rawInner = m[2].replace(/<[^>]+>/g, " ");
        const title = decodeBasicEntities(rawInner);
        if (!title || title.length < 10 || /read more|latest news|^news$/i.test(title)) {
          continue;
        }
        if (seen.has(href) || seen.has(title)) continue;
        seen.add(href);
        seen.add(title);
        found.push({ kind: "rinnai", text: `Rinnai · ${title}`, href });
      }

      // Fallback: bare h2/h3 titles → listing page
      if (!found.length) {
        const headingRe = /<h[23][^>]*>([^<]{10,140})<\/h[23]>/gi;
        while ((m = headingRe.exec(html)) && found.length < 4) {
          const t = decodeBasicEntities(m[1]);
          if (!t || /latest news/i.test(t) || seen.has(t)) continue;
          seen.add(t);
          found.push({
            kind: "rinnai",
            text: `Rinnai · ${t}`,
            href: RINNAI_NEWS_URL,
          });
        }
      }

      if (found.length) return found;
    } catch {
      /* try next */
    }
  }
  return [];
}

/**
 * @returns {Promise<TickerItem[]>}
 */
/**
 * True only when the browser reports offline — not for CORS / feed blips.
 * @returns {boolean}
 */
export function isTrulyOffline() {
  return (
    typeof navigator !== "undefined" && navigator && navigator.onLine === false
  );
}

export async function loadTickerItems() {
  // Gag only when truly offline (Beau). Networked feed fails ≠ offline wink.
  if (isTrulyOffline()) return offlineStubItems();

  const [weather, traffic, news, rinnai] = await Promise.all([
    fetchWeeklyWeather(),
    fetchBrisbaneTraffic(),
    fetchQldNews(),
    fetchRinnaiNews(),
  ]);

  /** @type {TickerItem[]} */
  const out = [];

  for (const w of weather) out.push({ ...w, source: "wttr.in" });
  for (const t of traffic) out.push({ ...t, source: "qldtraffic" });
  for (const n of news) out.push({ ...n, source: "abc-rss2json" });
  for (const r of rinnai) out.push({ ...r, source: "rinnai.com.au" });

  // Still online but nothing landed — stay quiet (no gag). Caller may retry.
  return out;
}

/**
 * @param {HTMLElement|null} root
 * @param {TickerItem[]} items
 */
function renderTickerDom(root, items) {
  if (!root) return;
  const track = root.querySelector(".news-ticker-track");
  if (!track) return;
  const kindLabel = {
    weather: "Weather",
    traffic: "Traffic",
    news: "News",
    rinnai: "Rinnai",
    offline: "Offline",
  };
  const html = items
    .map((it) => {
      const k = kindLabel[it.kind] || "Update";
      const href = String(it.href || "").trim();
      const safeHref = /^https?:\/\//i.test(href) ? href : "";
      const inner = `<span class="news-ticker-kind">${escapeHtml(
        k
      )}</span><span class="news-ticker-text">${escapeHtml(it.text)}</span>`;
      const cls = `news-ticker-item news-ticker-item--${escapeAttr(it.kind)}`;
      if (safeHref) {
        return `<a class="${cls}" href="${escapeHtml(
          safeHref
        )}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      }
      // Offline wink / no URL — not a link (Beau: no verse dump, no fake href).
      return `<span class="${cls}">${inner}</span>`;
    })
    .join('<span class="news-ticker-sep" aria-hidden="true">·</span>');
  // Duplicate for seamless marquee
  track.innerHTML = `${html}<span class="news-ticker-sep" aria-hidden="true">·</span>${html}`;
  syncTickerDuration(track);
  root.dataset.ready = "1";
  root.removeAttribute("hidden");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return String(s).replace(/[^a-z0-9_-]/gi, "");
}

/**
 * Mount + refresh ticker. Safe on file:// — never throws to caller.
 * @param {ParentNode|Document} [scope]
 */
export function bindNewsTicker(scope = document) {
  const root = scope.querySelector?.("#news-ticker") || document.querySelector("#news-ticker");
  if (!root) return;

  tickerSpeedMult = loadSpeedMult();
  syncSpeedButtons(scope);

  let timer = 0;
  let lastLive = /** @type {TickerItem[]} */ ([]);

  const applySpeed = () => {
    const track = root.querySelector(".news-ticker-track");
    if (track instanceof HTMLElement) syncTickerDuration(track);
    syncSpeedButtons(scope);
  };

  const refresh = async () => {
    try {
      if (isTrulyOffline()) {
        renderTickerDom(root, offlineStubItems());
        return;
      }
      const items = await loadTickerItems();
      if (items.length) {
        lastLive = items;
        renderTickerDom(root, items);
      } else if (lastLive.length) {
        // Keep last good crawl while networked but feeds hiccup.
        renderTickerDom(root, lastLive);
      }
      // else: leave empty / prior — do not paint offline gag while online
    } catch {
      if (isTrulyOffline()) renderTickerDom(root, offlineStubItems());
      else if (lastLive.length) renderTickerDom(root, lastLive);
    }
  };

  scope.querySelector?.("#ticker-speed-up")?.addEventListener("click", () => {
    saveSpeedMult(tickerSpeedMult + TICKER_SPEED_STEP);
    applySpeed();
  });
  scope.querySelector?.("#ticker-speed-down")?.addEventListener("click", () => {
    saveSpeedMult(tickerSpeedMult - TICKER_SPEED_STEP);
    applySpeed();
  });
  scope.querySelector?.("#ticker-speed-mid")?.addEventListener("click", () => {
    saveSpeedMult(TICKER_SPEED_MID);
    applySpeed();
  });

  // Don't flash the offline gag on first paint when networked (file:// fix).
  if (isTrulyOffline()) {
    renderTickerDom(root, offlineStubItems());
  }
  void refresh();
  timer = window.setInterval(() => void refresh(), 30 * 60 * 1000);
  window.addEventListener("online", () => void refresh());
  window.addEventListener("offline", () => {
    renderTickerDom(root, offlineStubItems());
  });
  root.addEventListener(
    "remove",
    () => {
      if (timer) window.clearInterval(timer);
    },
    { once: true }
  );
}
