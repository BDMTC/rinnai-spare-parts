/**
 * Pin2-side news ticker — Brisbane/SE QLD weekly weather, urgent QLD news,
 * Rinnai AU announcements. Public feeds only; file:// / CORS failures fall
 * back to demo stubs so the strip never crashes.
 */

const WEATHER_LABEL = "Brisbane / SE QLD";
const WTTR_URL = "https://wttr.in/Brisbane?format=j1";
const ABC_QLD_RSS = "https://www.abc.net.au/news/feed/45910/rss.xml";
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const RINNAI_NEWS_URL = "https://www.rinnai.com.au/news";
const ALLORIGINS_RAW = "https://api.allorigins.win/raw?url=";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const QLD_HINT =
  /\b(qld|queensland|brisbane|gold coast|sunshine coast|toowoomba|cairns|townsville|rockhampton|mackay|bundaberg|ipswich|logan|moreton|seq|south.?east queensland)\b/i;

/** Demo stubs — always available for file:// / offline. */
export const TICKER_STUBS = Object.freeze([
  {
    kind: "weather",
    text: "Brisbane / SE QLD week · Fri 21–29° showers · Sat 21–26° showers · Sun 20–31° storms · Mon 19–28° partly cloudy · Tue 18–27° sunny · Wed 19–28° cloudy · Thu 20–29° showers",
  },
  {
    kind: "news",
    text: "QLD · Demo headline — SES urges caution after SE QLD storms (offline stub)",
  },
  {
    kind: "news",
    text: "QLD · Demo headline — SEQ traffic delays after overnight rain (offline stub)",
  },
  {
    kind: "rinnai",
    text: "Rinnai · Check rinnai.com.au/news for product alerts (no live feed)",
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
 * Compact weekly forecast line from wttr.in j1 weather[].
 * @param {any} data
 * @returns {string|null}
 */
export function formatWeeklyForecast(data) {
  const days = Array.isArray(data?.weather) ? data.weather.slice(0, 7) : [];
  if (!days.length) return null;
  const bits = days.map((day) => {
    const label = dayLabel(String(day.date || ""));
    const min = day.mintempC ?? "?";
    const max = day.maxtempC ?? "?";
    const noon = Array.isArray(day.hourly)
      ? day.hourly.find((h) => Number(h.time) === 1200) || day.hourly[4]
      : null;
    const desc = String(noon?.weatherDesc?.[0]?.value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const short = desc
      ? desc
          .replace("thundery outbreaks in nearby", "storms")
          .replace("patchy rain nearby", "patchy rain")
          .replace("light rain shower", "showers")
          .replace("moderate or heavy rain shower", "heavy showers")
          .replace("partly cloudy", "partly cloudy")
          .slice(0, 22)
      : "";
    return short ? `${label} ${min}–${max}° ${short}` : `${label} ${min}–${max}°`;
  });
  return `${WEATHER_LABEL} week · ${bits.join(" · ")}`;
}

/**
 * @returns {Promise<{kind:string,text:string}|null>}
 */
async function fetchWeeklyWeather() {
  const res = await fetchSoft(WTTR_URL, 10000);
  if (!res) return null;
  try {
    const data = await res.json();
    const text = formatWeeklyForecast(data);
    return text ? { kind: "weather", text } : null;
  } catch {
    return null;
  }
}

/**
 * Prefer Queensland-flavoured ABC Top Stories; fall back to top items.
 * @returns {Promise<{kind:string,text:string}[]>}
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
        blob: `${it.title || ""} ${it.description || ""}`,
      }))
      .filter((it) => it.title.length > 8);

    const qld = items.filter((it) => QLD_HINT.test(it.blob));
    const picked = (qld.length ? qld : items).slice(0, 4);
    return picked.map((it) => ({
      kind: "news",
      text: `QLD · ${it.title}`,
    }));
  } catch {
    return [];
  }
}

/**
 * Scrape public Rinnai AU /news headings when a CORS proxy cooperates.
 * Graceful empty when unavailable (no stub spam).
 * @returns {Promise<{kind:string,text:string}[]>}
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
      const titles = [];
      const re = /<h[23][^>]*>([^<]{10,140})<\/h[23]>/gi;
      let m;
      while ((m = re.exec(html)) && titles.length < 4) {
        const t = m[1]
          .replace(/&amp;/g, "&")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!t || /latest news/i.test(t)) continue;
        if (titles.includes(t)) continue;
        titles.push(t);
      }
      if (titles.length) {
        return titles.map((t) => ({ kind: "rinnai", text: `Rinnai · ${t}` }));
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

/**
 * Merge live feeds with stubs. Weather/news always have something to show.
 * Rinnai stays empty when live fails (per brief) — unless nothing else loaded
 * and we need a demo line (stubs already include one).
 * @returns {Promise<{kind:string,text:string,source:string}[]>}
 */
export async function loadTickerItems() {
  const [weather, news, rinnai] = await Promise.all([
    fetchWeeklyWeather(),
    fetchQldNews(),
    fetchRinnaiNews(),
  ]);

  /** @type {{kind:string,text:string,source:string}[]} */
  const out = [];

  if (weather) {
    out.push({ ...weather, source: "wttr.in" });
  } else {
    out.push({ ...TICKER_STUBS[0], source: "stub" });
  }

  if (news.length) {
    for (const n of news) out.push({ ...n, source: "abc-rss2json" });
  } else {
    out.push({ ...TICKER_STUBS[1], source: "stub" });
    out.push({ ...TICKER_STUBS[2], source: "stub" });
  }

  if (rinnai.length) {
    for (const r of rinnai) out.push({ ...r, source: "rinnai.com.au" });
  }
  // graceful empty for Rinnai — no forced stub when other live content exists

  if (!out.length) {
    return TICKER_STUBS.map((s) => ({ ...s, source: "stub" }));
  }
  return out;
}

/**
 * @param {HTMLElement|null} root
 * @param {{kind:string,text:string}[]} items
 */
function renderTickerDom(root, items) {
  if (!root) return;
  const track = root.querySelector(".news-ticker-track");
  if (!track) return;
  const kindLabel = { weather: "Weather", news: "News", rinnai: "Rinnai" };
  const html = items
    .map((it) => {
      const k = kindLabel[it.kind] || "Update";
      return `<span class="news-ticker-item news-ticker-item--${escapeAttr(
        it.kind
      )}"><span class="news-ticker-kind">${escapeHtml(
        k
      )}</span><span class="news-ticker-text">${escapeHtml(it.text)}</span></span>`;
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

  // Immediate stub so layout paints before network
  renderTickerDom(
    root,
    TICKER_STUBS.map((s) => ({ ...s, source: "stub" }))
  );
  void refresh();
  // Soft refresh every 30 min when the tab is open
  timer = window.setInterval(() => void refresh(), 30 * 60 * 1000);
  root.addEventListener(
    "remove",
    () => {
      if (timer) window.clearInterval(timer);
    },
    { once: true }
  );
}
