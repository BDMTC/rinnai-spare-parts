/**
 * Pin2-side news ticker — Brisbane/SE QLD weekly weather (per-day items),
 * urgent QLD news, Rinnai AU announcements. Every item is a hyperlink.
 * Public feeds only; file:// / CORS failures fall back to demo stubs.
 */

const WEATHER_LABEL = "Brisbane / SE QLD";
const WTTR_URL = "https://wttr.in/Brisbane?format=j1";
const WEATHER_PAGE_URL = "https://www.bom.gov.au/qld/forecasts/brisbane.shtml";
const ABC_QLD_RSS = "https://www.abc.net.au/news/feed/45910/rss.xml";
const ABC_NEWS_HOME = "https://www.abc.net.au/news/";
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const RINNAI_NEWS_URL = "https://www.rinnai.com.au/news";
const ALLORIGINS_RAW = "https://api.allorigins.win/raw?url=";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const QLD_HINT =
  /\b(qld|queensland|brisbane|gold coast|sunshine coast|toowoomba|cairns|townsville|rockhampton|mackay|bundaberg|ipswich|logan|moreton|seq|south.?east queensland)\b/i;

/**
 * @typedef {{ kind: string, text: string, href: string, source?: string }} TickerItem
 */

/** Demo stubs — always available for file:// / offline. */
export const TICKER_STUBS = Object.freeze([
  {
    kind: "weather",
    text: "Brisbane / SE QLD · Fri 21–29° · Light rain shower",
    href: WEATHER_PAGE_URL,
  },
  {
    kind: "weather",
    text: "Brisbane / SE QLD · Sat 21–26° · Light rain shower",
    href: WEATHER_PAGE_URL,
  },
  {
    kind: "weather",
    text: "Brisbane / SE QLD · Sun 20–31° · Thundery outbreaks in nearby",
    href: WEATHER_PAGE_URL,
  },
  {
    kind: "weather",
    text: "Brisbane / SE QLD · Mon 19–28° · Partly cloudy",
    href: WEATHER_PAGE_URL,
  },
  {
    kind: "weather",
    text: "Brisbane / SE QLD · Tue 18–27° · Sunny",
    href: WEATHER_PAGE_URL,
  },
  {
    kind: "weather",
    text: "Brisbane / SE QLD · Wed 19–28° · Cloudy",
    href: WEATHER_PAGE_URL,
  },
  {
    kind: "weather",
    text: "Brisbane / SE QLD · Thu 20–29° · Light rain shower",
    href: WEATHER_PAGE_URL,
  },
  {
    kind: "news",
    text: "QLD · Demo headline — SES urges caution after SE QLD storms (offline stub)",
    href: ABC_NEWS_HOME,
  },
  {
    kind: "news",
    text: "QLD · Demo headline — SEQ traffic delays after overnight rain (offline stub)",
    href: ABC_NEWS_HOME,
  },
  {
    kind: "rinnai",
    text: "Rinnai · Check rinnai.com.au/news for product alerts (no live feed)",
    href: RINNAI_NEWS_URL,
  },
]);

/**
 * @param {string} url
 * @param {number} [ms]
 * @returns {Promise<Response|null>}
 */
async function fetchSoft(url, ms = 8000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      signal: ctrl.signal,
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
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
export async function loadTickerItems() {
  const [weather, news, rinnai] = await Promise.all([
    fetchWeeklyWeather(),
    fetchQldNews(),
    fetchRinnaiNews(),
  ]);

  /** @type {TickerItem[]} */
  const out = [];

  if (weather.length) {
    for (const w of weather) out.push({ ...w, source: "wttr.in" });
  } else {
    for (const s of TICKER_STUBS.filter((x) => x.kind === "weather")) {
      out.push({ ...s, source: "stub" });
    }
  }

  if (news.length) {
    for (const n of news) out.push({ ...n, source: "abc-rss2json" });
  } else {
    for (const s of TICKER_STUBS.filter((x) => x.kind === "news")) {
      out.push({ ...s, source: "stub" });
    }
  }

  if (rinnai.length) {
    for (const r of rinnai) out.push({ ...r, source: "rinnai.com.au" });
  }

  if (!out.length) {
    return TICKER_STUBS.map((s) => ({ ...s, source: "stub" }));
  }
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
  const kindLabel = { weather: "Weather", news: "News", rinnai: "Rinnai" };
  const html = items
    .map((it) => {
      const k = kindLabel[it.kind] || "Update";
      const href = String(it.href || "").trim() || "#";
      const safeHref = /^https?:\/\//i.test(href) ? href : "#";
      return `<a class="news-ticker-item news-ticker-item--${escapeAttr(
        it.kind
      )}" href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer"><span class="news-ticker-kind">${escapeHtml(
        k
      )}</span><span class="news-ticker-text">${escapeHtml(it.text)}</span></a>`;
    })
    .join('<span class="news-ticker-sep" aria-hidden="true">·</span>');
  // Duplicate for seamless marquee
  track.innerHTML = `${html}<span class="news-ticker-sep" aria-hidden="true">·</span>${html}`;
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

  let timer = 0;
  const refresh = async () => {
    try {
      const items = await loadTickerItems();
      renderTickerDom(root, items);
    } catch {
      renderTickerDom(
        root,
        TICKER_STUBS.map((s) => ({ ...s, source: "stub" }))
      );
    }
  };

  renderTickerDom(
    root,
    TICKER_STUBS.map((s) => ({ ...s, source: "stub" }))
  );
  void refresh();
  timer = window.setInterval(() => void refresh(), 30 * 60 * 1000);
  root.addEventListener(
    "remove",
    () => {
      if (timer) window.clearInterval(timer);
    },
    { once: true }
  );
}
