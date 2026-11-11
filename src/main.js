import "./style.css";
import mtcgasLogoUrl from "./assets/mtcgas-australia-logo.png?inline";
import mtcTeamHqUrl from "./assets/mtc-team-hq.jpg?inline";
import { searchParts, getModelLabel } from "./search.js";
import {
  computePrices,
  formatAud,
  DEFAULT_MARGIN_PERCENT,
  DEFAULT_GST_RATE,
  clampMarginPercent,
  marginPercentOptions,
} from "./pricing.js";
import {
  resolveModelPin,
  documentKeysForPin,
} from "./series.js";
import { bindModelPicker } from "./model-picker.js";
import {
  makePartVisibilityFilter,
  restrictionWarningCopy,
} from "./restriction.js";
import {
  loadCart,
  saveCart,
  clearStoredCart,
  addToCart,
  removeFromCart,
  setCartQty,
  cartItemCount,
  linePricing,
  cartTotals,
  formatQuoteText,
  buildStoresMailto,
  normalizeJobNumber,
} from "./cart.js";
import {
  loadOverrides,
  saveOverrides,
  applyOverridesToCatalogue,
  makeAdminPartFilter,
  tryUnlockAdmin,
  isAdminSessionUnlocked,
  setAdminSessionUnlocked,
  getConfiguredAdminPassword,
  setLocalAdminPassword,
  loadPriceListPath,
  savePriceListPath,
  clearFlag,
  suspendPart,
  unsuspendPart,
  deletePartOverride,
  restoreDeletedPart,
  applyPricePatch,
  clearPricePatch,
  flagPart,
  enqueueChange,
} from "./admin-overrides.js";
import { buildFlagIssueMailto } from "./flag-issue.js";
import {
  parsePriceWorkbook,
  pricesToCatalogueParts,
  diffPriceImport,
  buildReviewedParts,
} from "./price-import.js";

const app = document.querySelector("#app");

/** @type {object|null} */
let baseCatalogue = null;
/** @type {object|null} */
let catalogue = null;
/** @type {object|null} */
let config = null;
/** @type {object|null} */
let pricesMeta = null;
/** @type {object|null} */
let seriesDoc = null;
/** @type {object|null} */
let tradeAliases = null;
let lastResults = [];
let marginPercent = DEFAULT_MARGIN_PERCENT;
let gstRate = DEFAULT_GST_RATE;
/** @type {{ getValue: () => string|null, setValue: (v: string|null) => void }|null} */
let modelPicker = null;
/** Session unlocks for restricted pins (model id or series:…). */
const unlockedPins = new Set();
/** @type {import("./cart.js").CartLine[]} */
let cartLines = loadCart();
let cartFlashTimer = 0;
/** @type {import("./admin-overrides.js").AdminOverrides} */
let overrides = loadOverrides();
let adminUnlocked = isAdminSessionUnlocked();
/** @type {null | { incomingParts: object[], diff: object, sourceFile: string, meta: object, skipCodes: Set<string> }} */
let pendingImport = null;

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.json();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlight(text, query) {
  const safe = escapeHtml(text);
  const q = String(query || "").trim();
  if (!q) return safe;
  try {
    const re = new RegExp(
      `(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "ig"
    );
    return safe.replace(re, "<mark>$1</mark>");
  } catch {
    return safe;
  }
}

function persistCart() {
  saveCart(cartLines);
}

function persistOverrides() {
  saveOverrides(overrides);
}

function refreshCatalogueFromOverrides() {
  if (!baseCatalogue) {
    catalogue = null;
    return;
  }
  catalogue = applyOverridesToCatalogue(baseCatalogue, overrides);
}

function pinnedLabelForQuote() {
  const pin = currentPin();
  if (pin.kind === "series" && pin.series) {
    return `${pin.series.label} series`;
  }
  if (pin.kind === "model" && pin.model) {
    const seriesBit = pin.series ? ` · ${pin.series.label}` : "";
    return `${getModelLabel(pin.model)}${seriesBit}`;
  }
  return null;
}

function updateCartBadge() {
  const badge = document.querySelector("#cart-badge");
  const btn = document.querySelector("#cart-open");
  if (!badge) return;
  const count = cartItemCount(cartLines);
  if (count > 0) {
    badge.hidden = false;
    badge.textContent = count > 99 ? "99+" : String(count);
  } else {
    badge.hidden = true;
    badge.textContent = "0";
  }
  if (btn) {
    btn.setAttribute(
      "aria-label",
      count > 0 ? `Open quote list (${count} items)` : "Open quote list"
    );
  }
}

function showCartFlash(message) {
  const flash = document.querySelector("#cart-flash");
  if (!flash) return;
  flash.hidden = false;
  flash.textContent = message;
  window.clearTimeout(cartFlashTimer);
  cartFlashTimer = window.setTimeout(() => {
    flash.hidden = true;
    flash.textContent = "";
  }, 2200);
}

function renderCartOverlay() {
  const body = document.querySelector("#cart-body");
  const totalsEl = document.querySelector("#cart-totals");
  const pinEl = document.querySelector("#cart-pin");
  if (!body || !totalsEl) return;

  const pinLabel = pinnedLabelForQuote();
  if (pinEl) {
    pinEl.textContent = pinLabel
      ? `Pinned model: ${pinLabel} · prices at ${marginPercent}% margin`
      : `No model pinned · prices at ${marginPercent}% margin`;
  }

  if (!cartLines.length) {
    body.innerHTML = `<p class="cart-empty">Quote list is empty. Add parts from search results.</p>`;
  } else {
    body.innerHTML = cartLines
      .map((line) => {
        const p = linePricing(line, marginPercent, gstRate);
        return `
          <article class="cart-line" data-code="${escapeHtml(line.code)}">
            <div class="cart-line-main">
              <p class="cart-line-code">${escapeHtml(line.code)}</p>
              <h3 class="cart-line-name">${escapeHtml(line.name)}</h3>
              <p class="cart-line-units">
                <span>Unit EX GST <strong>${formatAud(p.unitNet)}</strong></span>
                <span>Unit + ${marginPercent}% <strong>${formatAud(p.unitEx)}</strong></span>
                <span>Unit INC GST <strong>${formatAud(p.unitInc)}</strong></span>
              </p>
            </div>
            <label class="cart-qty">
              <span class="cart-qty-label">Qty</span>
              <input
                type="number"
                class="cart-qty-input"
                min="1"
                max="9999"
                step="1"
                value="${line.qty}"
                data-code="${escapeHtml(line.code)}"
                inputmode="numeric"
              />
            </label>
            <div class="cart-line-total">
              <span class="cart-line-total-label">Line total</span>
              <strong>${formatAud(p.lineEx)}</strong>
              <span class="cart-line-total-sub muted">INC GST ${formatAud(p.lineInc)}</span>
            </div>
            <button
              type="button"
              class="cart-line-remove"
              data-code="${escapeHtml(line.code)}"
              aria-label="Remove ${escapeHtml(line.code)}"
            >Remove</button>
          </article>
        `;
      })
      .join("");
  }

  const totals = cartTotals(cartLines, marginPercent, gstRate);
  totalsEl.innerHTML = `
    <p class="cart-total-line"><span>Total EX GST</span> <strong>${formatAud(totals.totalExGst)}</strong></p>
    <p class="cart-total-line"><span>Total with markup</span> <strong>${formatAud(totals.totalMarkup)}</strong></p>
    <p class="cart-total-line cart-total-line--inc"><span>Total INC GST</span> <strong>${formatAud(totals.totalIncGst)}</strong></p>
  `;

  updateCartBadge();

  body.querySelectorAll(".cart-qty-input").forEach((input) => {
    input.addEventListener("change", () => {
      cartLines = setCartQty(cartLines, input.dataset.code, input.value);
      persistCart();
      renderCartOverlay();
    });
    input.addEventListener("input", () => {
      const next = Number(input.value);
      if (!Number.isFinite(next) || next < 1) return;
      cartLines = setCartQty(cartLines, input.dataset.code, next);
      const line = cartLines.find(
        (l) => l.code.toUpperCase() === String(input.dataset.code || "").toUpperCase()
      );
      const article = input.closest(".cart-line");
      if (line && article) {
        const p = linePricing(line, marginPercent, gstRate);
        const strong = article.querySelector(".cart-line-total strong");
        const sub = article.querySelector(".cart-line-total-sub");
        if (strong) strong.textContent = formatAud(p.lineEx);
        if (sub) sub.textContent = `INC GST ${formatAud(p.lineInc)}`;
      }
      const totalsLive = cartTotals(cartLines, marginPercent, gstRate);
      totalsEl.innerHTML = `
        <p class="cart-total-line"><span>Total EX GST</span> <strong>${formatAud(totalsLive.totalExGst)}</strong></p>
        <p class="cart-total-line"><span>Total with markup</span> <strong>${formatAud(totalsLive.totalMarkup)}</strong></p>
        <p class="cart-total-line cart-total-line--inc"><span>Total INC GST</span> <strong>${formatAud(totalsLive.totalIncGst)}</strong></p>
      `;
      updateCartBadge();
    });
  });

  body.querySelectorAll(".cart-line-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      cartLines = removeFromCart(cartLines, btn.dataset.code);
      persistCart();
      renderCartOverlay();
    });
  });
}

function openCart() {
  const dialog = document.querySelector("#cart-dialog");
  renderCartOverlay();
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeCart() {
  const dialog = document.querySelector("#cart-dialog");
  const flash = document.querySelector("#cart-flash");
  if (flash) {
    flash.hidden = true;
    flash.textContent = "";
  }
  if (dialog && typeof dialog.close === "function") dialog.close();
  else if (dialog) dialog.removeAttribute("open");
}

function handleAddToQuote(part) {
  if (!part?.code) return;
  cartLines = addToCart(cartLines, {
    code: part.code,
    name: part.name,
    netInvoiceExGst: part.netInvoiceExGst ?? null,
  });
  persistCart();
  updateCartBadge();
}

function promptJobNumber() {
  const raw = window.prompt(
    "Job / work order number for stores email\n(plain number or WO-… for Acumatica):",
    ""
  );
  if (raw == null) return null;
  const job = normalizeJobNumber(raw);
  if (!job) {
    window.alert("Enter a job or work order number.");
    return null;
  }
  return job;
}

function emailCartToStores() {
  if (!cartLines.length) {
    showCartFlash("Quote list is empty — add parts first.");
    return;
  }
  const job = promptJobNumber();
  if (job == null) return;
  const body = formatQuoteText({
    lines: cartLines,
    jobNumber: job,
    marginPercent,
    gstRate,
    pinnedLabel: pinnedLabelForQuote(),
  });
  const href = buildStoresMailto(job, body);
  window.location.href = href;
}

async function copyCartToClipboard() {
  if (!cartLines.length) {
    showCartFlash("Quote list is empty — nothing to copy.");
    return;
  }
  const text = formatQuoteText({
    lines: cartLines,
    jobNumber: "",
    marginPercent,
    gstRate,
    pinnedLabel: pinnedLabelForQuote(),
  });
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showCartFlash("Copied quote list to clipboard.");
  } catch {
    showCartFlash("Could not copy — try again or use Email.");
  }
}

function saveCartAndClose() {
  persistCart();
  showCartFlash("Quote list saved.");
  window.setTimeout(() => closeCart(), 350);
}

function clearCartAndClose() {
  cartLines = [];
  clearStoredCart();
  updateCartBadge();
  closeCart();
}

function submitFlagPart(part) {
  const code = String(part?.code || "").trim();
  const title = String(part?.title || part?.name || code).trim();
  if (!code && !title) return;
  const payload = {
    code: code || title,
    title: title || code,
  };
  overrides = flagPart(overrides, payload);
  persistOverrides();
  window.location.href = buildFlagIssueMailto(payload);
  renderAdminPanel();
  runSearch();
}

function renderShell() {
  const effective =
    config?.priceList?.effectiveDate ||
    pricesMeta?.effectiveDate ||
    "unknown";
  const workbook =
    config?.priceList?.workbookFile ||
    pricesMeta?.sourceFile ||
    "price list";
  const pricePath = loadPriceListPath(config);

  app.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div class="brand">
          <div class="mtc-logo">
            <img
              class="mtc-logo-img"
              src="${mtcgasLogoUrl}"
              alt="MTCGAS Australia"
              width="204"
              height="100"
              decoding="async"
            />
          </div>
          <div class="brand-text">
            <h1 class="brand-name">Rinnai Parts</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <button
            type="button"
            class="cart-trigger"
            id="cart-open"
            aria-label="Open quote list"
            title="Quote list"
          >
            <svg class="cart-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14h9.45c.75 0 1.41-.41 1.75-1.03l3.24-6.07A1 1 0 0 0 20.72 5H6.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7.42l.74-1.35z"
              />
            </svg>
            <span class="cart-badge" id="cart-badge" hidden>0</span>
          </button>
        </div>
        <p class="topbar-note">Local catalogue · price list ${escapeHtml(effective)}</p>
      </header>

      <main class="hero">
        <form class="search-panel" id="search-form" autocomplete="off">
          <div class="controls-row">
            <div class="field model-field">
              <span class="field-label" id="model-label">Model</span>
              <div
                class="model-picker"
                id="model-picker"
              >
                <div class="model-picker-row">
                  <input
                    id="model-input"
                    type="text"
                    role="combobox"
                    aria-labelledby="model-label"
                    aria-autocomplete="list"
                    aria-controls="model-listbox"
                    aria-expanded="false"
                    placeholder="Type HD200e, VRM2632, HD28…"
                    spellcheck="false"
                    autocomplete="off"
                  />
                  <button
                    type="button"
                    class="model-clear"
                    id="model-clear"
                    aria-label="Clear model pin"
                    hidden
                  >
                    ×
                  </button>
                </div>
                <input type="hidden" id="model-pin" name="model" value="" />
                <ul
                  class="model-listbox"
                  id="model-listbox"
                  role="listbox"
                  hidden
                ></ul>
              </div>
            </div>

            <label class="field margin-field" for="margin-select">
              <span class="field-label">Margin %</span>
              <select id="margin-select" name="margin">
                ${marginPercentOptions()
                  .map((m) => {
                    const selected =
                      m === DEFAULT_MARGIN_PERCENT ? " selected" : "";
                    const label =
                      m === DEFAULT_MARGIN_PERCENT
                        ? `${m}% (default)`
                        : `${m}%`;
                    return `<option value="${m}"${selected}>${label}</option>`;
                  })
                  .join("")}
              </select>
            </label>
          </div>

          <label class="field query-field" for="query-input">
            <span class="field-label">Search</span>
            <div class="query-row">
              <input
                id="query-input"
                name="q"
                type="search"
                placeholder="Trade term, part code, or description…"
                spellcheck="false"
                autofocus
              />
              <button type="submit" class="search-btn">Search</button>
            </div>
          </label>
        </form>

        <p class="pin-warn" id="pin-warn" hidden>
          No model pinned — results are unranked for a specific unit. Pin a model (e.g. HD200e) for a Primary part code.
        </p>

        <p class="hint" id="hint">
          Tip: pin a model, then try
          <button type="button" class="chip" data-q="flow servo">flow servo</button>
          <button type="button" class="chip" data-q="thermocouple">thermocouple</button>
          <button type="button" class="chip" data-q="pcb">pcb</button>
          <button type="button" class="chip" data-q="35401021">35401021</button>
          <button type="button" class="chip" data-q="gas valve">gas valve</button>
        </p>
        <p class="pricing-note">
          Prices: net invoice ex GST × (1 + margin%) → AUD ex GST; + GST ${Math.round(gstRate * 100)}% → inc GST.
          Default margin <strong>${DEFAULT_MARGIN_PERCENT}%</strong>.
        </p>
      </main>

      <section class="results-wrap" aria-live="polite">
        <div class="results-meta" id="results-meta"></div>
        <ul class="results" id="results"></ul>
        <p class="empty" id="empty" hidden>No matches. Try a part code, description fragment, or clear the model pin.</p>
      </section>

      <dialog class="nla-dialog" id="nla-dialog" aria-labelledby="nla-dialog-title">
        <form method="dialog" class="nla-dialog-form" id="nla-dialog-form">
          <p class="nla-dialog-kicker" id="nla-dialog-kicker">Restricted unit</p>
          <h2 class="nla-dialog-title" id="nla-dialog-title">Are you sure this is the unit you want?</h2>
          <p class="nla-dialog-body" id="nla-dialog-body"></p>
          <p class="nla-dialog-detail muted" id="nla-dialog-detail" hidden></p>
          <div class="nla-dialog-actions">
            <button type="submit" value="cancel" class="nla-btn nla-btn--ghost" id="nla-dialog-no">No</button>
            <button type="submit" value="confirm" class="nla-btn nla-btn--primary" id="nla-dialog-yes">Yes</button>
          </div>
        </form>
      </dialog>

      <dialog class="cart-dialog" id="cart-dialog" aria-labelledby="cart-dialog-title">
        <div class="cart-dialog-inner">
          <header class="cart-dialog-bar">
            <div>
              <p class="cart-dialog-kicker">Quote</p>
              <h2 class="cart-dialog-title" id="cart-dialog-title">Quote list</h2>
            </div>
            <button type="button" class="cart-dialog-close" id="cart-close" aria-label="Close quote list">Close</button>
          </header>
          <p class="cart-pin muted" id="cart-pin"></p>
          <p class="cart-flash" id="cart-flash" hidden></p>
          <div class="cart-body" id="cart-body"></div>
          <footer class="cart-dialog-foot">
            <div class="cart-totals" id="cart-totals"></div>
            <div class="cart-actions">
              <button type="button" class="cart-action cart-action--primary" id="cart-email">Email list to stores</button>
              <button type="button" class="cart-action" id="cart-copy">Copy to clipboard</button>
              <button type="button" class="cart-action" id="cart-save">Save quote list</button>
              <button type="button" class="cart-action cart-action--danger" id="cart-clear">Clear quote list</button>
            </div>
          </footer>
        </div>
      </dialog>

      <div
        class="ops-panels"
        id="ops-panels"
        tabindex="0"
        aria-describedby="ops-panels-hint"
      >
        <div class="ops-panels-veil" aria-hidden="true">
          <img
            class="ops-panels-photo"
            src="${mtcTeamHqUrl}"
            alt=""
            width="2048"
            height="1365"
            decoding="async"
          />
          <div class="ops-panels-veil-caption">
            <img
              class="ops-panels-veil-logo"
              src="${mtcgasLogoUrl}"
              alt=""
              width="204"
              height="100"
              decoding="async"
            />
            <p class="ops-panels-veil-title">MTC Gas team</p>
            <p class="ops-panels-hint" id="ops-panels-hint">
              Hover or focus to reveal admin &amp; data sources
            </p>
          </div>
        </div>
        <div class="ops-panels-body">
          <section class="admin-section" id="admin-section" aria-labelledby="admin-heading">
            <div class="admin-head">
              <div>
                <p class="admin-kicker">Development</p>
                <h2 id="admin-heading">Admin / catalogue tools</h2>
              </div>
            </div>
            <p class="admin-note">
              Local overrides only (browser storage). <strong>Production part listings are updated by AI via ingest</strong>
              (<code>npm run ingest</code> — this panel records intent in a change queue and applies a local overlay so search matches what Beau just changed. Do not treat browser edits as the committed <code>prices.json</code> source of truth.
            </p>
            <div class="admin-gate" id="admin-gate"></div>
            <div class="admin-body" id="admin-body" hidden></div>
          </section>

          <section
            class="data-sources"
            id="data-sources"
            aria-labelledby="data-sources-heading"
          >
            <div class="data-sources-body">
              <h2 id="data-sources-heading">Data sources / price list config</h2>
              <dl class="data-sources-grid">
                <div>
                  <dt>Config file</dt>
                  <dd><code>public/data/config.json</code></dd>
                </div>
                <div>
                  <dt>Active price workbook</dt>
                  <dd><code>${escapeHtml(workbook)}</code></dd>
                </div>
                <div>
                  <dt>Configured path / endpoint</dt>
                  <dd><code id="ds-price-path">${escapeHtml(pricePath || "—")}</code></dd>
                </div>
                <div>
                  <dt>Effective</dt>
                  <dd>${escapeHtml(String(effective))}</dd>
                </div>
                <div>
                  <dt>Models</dt>
                  <dd id="ds-models">—</dd>
                </div>
                <div>
                  <dt>Price rows</dt>
                  <dd id="ds-prices">—</dd>
                </div>
                <div>
                  <dt>Sheets scanned</dt>
                  <dd id="ds-sheets">—</dd>
                </div>
                <div>
                  <dt>Series aliases</dt>
                  <dd><code>public/data/series-aliases.json</code></dd>
                </div>
                <div>
                  <dt>Trade aliases</dt>
                  <dd><code>public/data/trade-aliases.json</code></dd>
                </div>
                <div>
                  <dt>Local admin overlay</dt>
                  <dd id="ds-overrides">localStorage · see Admin</dd>
                </div>
              </dl>
              <ol class="refresh-steps">
                <li>Drop the new Rinnai price workbook into <code>source-data/</code> (or set path in Admin).</li>
                <li>Update <code>priceList.workbookPath</code> / <code>endpoint</code> / <code>effectiveDate</code> in <code>public/data/config.json</code>.</li>
                <li>Run <code>npm run ingest</code> for production JSON, then refresh — or use Admin import for a local preview overlay.</li>
                <li>Series / trade aliases are hand-maintained JSON — not overwritten by ingest.</li>
                <li>Data-sheet PDFs remain under <code>data-sheets/</code>; the sheet list is hidden from the main search UI (index code kept for later admin use).</li>
              </ol>
            </div>
          </section>
        </div>
      </div>

      <footer class="footer">
        <span>Real Rinnai lists ingested locally. Exploded diagrams still to come.</span>
      </footer>
    </div>
  `;
}

/**
 * Confirm unlock for a restricted typeahead suggestion (mouse click only).
 * @param {object} suggestion
 * @returns {Promise<boolean>}
 */
function requestUnlock(suggestion) {
  const dialog = document.querySelector("#nla-dialog");
  const titleEl = document.querySelector("#nla-dialog-title");
  const bodyEl = document.querySelector("#nla-dialog-body");
  const detailEl = document.querySelector("#nla-dialog-detail");
  const kickerEl = document.querySelector("#nla-dialog-kicker");
  const yesBtn = document.querySelector("#nla-dialog-yes");
  const noBtn = document.querySelector("#nla-dialog-no");
  if (!dialog || typeof dialog.showModal !== "function") {
    const ok = window.confirm(
      `${suggestion.label} is restricted / NLA. Are you sure this is the unit you want?`
    );
    if (ok) unlockedPins.add(suggestion.value);
    return Promise.resolve(ok);
  }

  const copy = restrictionWarningCopy(suggestion.restriction || suggestion);
  if (kickerEl) kickerEl.textContent = copy.title;
  if (titleEl) titleEl.textContent = "Are you sure this is the unit you want?";
  if (bodyEl) bodyEl.textContent = copy.body;
  if (detailEl) {
    if (copy.detail) {
      detailEl.hidden = false;
      detailEl.textContent = copy.detail;
    } else {
      detailEl.hidden = true;
      detailEl.textContent = "";
    }
  }
  if (yesBtn) yesBtn.textContent = "Yes";
  if (noBtn) noBtn.textContent = "No";

  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      const ok = dialog.returnValue === "confirm";
      if (ok) unlockedPins.add(suggestion.value);
      resolve(ok);
    };
    dialog.addEventListener("close", onClose);
    dialog.returnValue = "";
    dialog.showModal();
    noBtn?.focus();
  });
}

function mountModelPicker() {
  const root = document.querySelector("#model-picker");
  if (!root) {
    modelPicker = null;
    return;
  }
  modelPicker = bindModelPicker(root, {
    catalogue,
    seriesDoc,
    onChange: () => runSearch(),
    isPinUnlocked: (pinValue) => unlockedPins.has(pinValue),
    requestUnlock,
  });
}

function currentPin() {
  const pinValue =
    modelPicker?.getValue?.() ||
    document.querySelector("#model-pin")?.value ||
    null;
  return resolveModelPin(catalogue, seriesDoc, pinValue);
}

function populateDataSources() {
  const modelsEl = document.querySelector("#ds-models");
  const pricesEl = document.querySelector("#ds-prices");
  const sheetsEl = document.querySelector("#ds-sheets");
  const overridesEl = document.querySelector("#ds-overrides");
  const pathEl = document.querySelector("#ds-price-path");
  if (modelsEl) {
    const total =
      catalogue?.meta?.modelCount ?? catalogue?.models?.length ?? "—";
    const restricted =
      catalogue?.meta?.restrictedModelCount ??
      (catalogue?.models || []).filter((m) => m.restricted).length;
    modelsEl.textContent =
      restricted != null && total !== "—"
        ? `${total} · ${restricted} restricted (NLA/export/use-up)`
        : String(total);
  }
  if (pricesEl) {
    const live = catalogue?.parts?.length ?? "—";
    const priced = pricesMeta?.pricedCount ?? live;
    const total = pricesMeta?.count ?? priced;
    pricesEl.textContent = `${live} live · ${total} base · ${priced} priced`;
  }
  if (sheetsEl) {
    sheetsEl.textContent = String(
      pricesMeta?.sheetCount ?? config?.priceList?.sheetCount ?? "—"
    );
  }
  if (pathEl) {
    pathEl.textContent = loadPriceListPath(config) || "—";
  }
  if (overridesEl) {
    const f = Object.keys(overrides.flagged || {}).length;
    const s = Object.keys(overrides.suspended || {}).length;
    const d = Object.keys(overrides.deleted || {}).length;
    const patch = overrides.pricePatch ? " · price patch on" : "";
    overridesEl.textContent = `${f} flagged · ${s} suspended · ${d} deleted${patch}`;
  }
}

function runSearch() {
  const q = document.querySelector("#query-input")?.value || "";
  const pin = currentPin();
  const modelId = pin.kind === "model" ? pin.model?.id : null;
  const pinValue =
    modelPicker?.getValue?.() ||
    document.querySelector("#model-pin")?.value ||
    null;
  const baseVis = makePartVisibilityFilter(catalogue, {
    unlockedPinValues: unlockedPins,
    activePinValue: pinValue,
    activeModelIds: pin.modelIds,
  });
  const isPartVisible = makeAdminPartFilter(overrides, baseVis);
  lastResults = searchParts(catalogue, q, modelId, {
    modelIds: pin.modelIds,
    pin,
    tradeAliases,
    isPartVisible,
  });
  renderResults(q, pin);
}

function renderPriceBlock(part) {
  if (part.kind === "discount-segment") {
    const pct =
      part.discountPercent != null ? `${part.discountPercent}%` : "—";
    return `
      <div class="price-block">
        <h3>Discount segment</h3>
        <p class="price-line"><span class="price-label">List discount</span> <strong>${escapeHtml(pct)}</strong></p>
        <p class="price-muted">Not a sell price — segment discount from the price workbook.</p>
      </div>
    `;
  }

  const priced = computePrices(part.netInvoiceExGst, marginPercent, gstRate);
  if (!priced) {
    return `
      <div class="price-block">
        <h3>Pricing</h3>
        <p class="muted">No net invoice price on this row.</p>
      </div>
    `;
  }

  return `
    <div class="price-block">
      <h3>Pricing (AUD)</h3>
      <p class="price-line"><span class="price-label">Price EX GST</span> <strong>${formatAud(priced.netInvoiceExGst)}</strong></p>
      <p class="price-line"><span class="price-label">Price EX GST plus ${priced.marginPercent}% markup</span> <strong>${formatAud(priced.exGst)}</strong></p>
      <p class="price-line price-line--inc"><span class="price-label">Price INC GST</span> <strong>${formatAud(priced.incGst)}</strong></p>
    </div>
  `;
}

function renderResults(query, pin) {
  const list = document.querySelector("#results");
  const meta = document.querySelector("#results-meta");
  const empty = document.querySelector("#empty");
  const pinWarn = document.querySelector("#pin-warn");
  const activePin = pin || currentPin();
  const hasPin = activePin.kind !== "none";
  const hasQuery = Boolean(String(query || "").trim());

  if (!list || !meta || !empty) return;
  list.innerHTML = "";

  if (pinWarn) {
    pinWarn.hidden = !(hasQuery && !hasPin);
  }

  if (!hasQuery && !hasPin) {
    meta.textContent = "";
    empty.hidden = true;
    return;
  }

  let pinBit = "";
  if (activePin.kind === "series" && activePin.series) {
    const keys = documentKeysForPin(activePin).slice(0, 3).join(" · ");
    pinBit = ` · pinned ${activePin.series.label} series (${keys}) · ${activePin.modelIds.length} models`;
  } else if (activePin.kind === "model" && activePin.model) {
    const seriesBit = activePin.series
      ? ` · ${activePin.series.label}`
      : "";
    pinBit = ` · pinned ${getModelLabel(activePin.model)}${seriesBit}`;
  }
  const primary = lastResults.find((r) => r.isPrimary);
  const primaryBit =
    hasPin && primary
      ? ` · Primary ${primary.part.code}`
      : hasPin
        ? " · no exact Primary for this pin"
        : "";
  meta.textContent = `${lastResults.length} part${lastResults.length === 1 ? "" : "s"}${pinBit}${primaryBit} · margin ${marginPercent}%`;

  if (!lastResults.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const row of lastResults) {
    const {
      part,
      matchedOn,
      fitsSelectedModel,
      fittedModels,
      isPrimary,
      fitTier,
      fitReason,
    } = row;
    const li = document.createElement("li");
    li.className = "result";
    if (isPrimary) {
      li.classList.add("result--primary");
    } else if (hasPin && fitTier === "exact") {
      li.classList.add("result--fits");
    } else if (hasPin && fitTier === "related") {
      li.classList.add("result--related");
    } else if (hasPin && fitsSelectedModel === false) {
      li.classList.add("result--other-model");
    }
    if (part.adminFlagged) li.classList.add("result--flagged");

    const tradeAliasesForPart =
      (part.aliases || []).length > 0
        ? part.aliases
            .map((a) => `<span class="alias">${highlight(a, query)}</span>`)
            .join("")
        : `<span class="muted">No part-level aliases yet</span>`;

    const chassisBit =
      hasPin && fitReason
        ? `<span class="muted fit-reason">${escapeHtml(fitReason)}</span>`
        : "";

    const modelsHtml = fittedModels.length
      ? fittedModels
          .map((m) => {
            const active = hasPin && activePin.modelIds.includes(m.id);
            const cls = active
              ? "model-tag model-tag--active"
              : "model-tag";
            return `<span class="${cls}">${escapeHtml(m.sku || m.name)}</span>`;
          })
          .join("")
      : chassisBit || `<span class="muted">Fit inferred from chassis in description</span>`;

    const fitBadge = !hasPin
      ? ""
      : isPrimary
        ? `<span class="badge badge--primary">Primary</span>`
        : fitTier === "exact"
          ? `<span class="badge badge--fit">${
              activePin.kind === "series" ? "Fits series" : "Fits pinned model"
            }</span>`
          : fitTier === "related"
            ? `<span class="badge badge--related">Related family</span>`
            : `<span class="badge badge--other">Other model</span>`;

    const flagBadge = part.adminFlagged
      ? `<span class="badge badge--flag">Flagged</span>`
      : "";

    const matchBits = matchedOn
      .map((m) => `<span class="match-tag">${escapeHtml(m)}</span>`)
      .join("");

    const categoryBit = part.category
      ? `<span class="category-tag">${escapeHtml(part.category)}</span>`
      : "";

    const cardActions =
      part.kind === "discount-segment"
        ? ""
        : `<div class="result-card-actions">
            <button
              type="button"
              class="add-quote-btn"
              data-code="${escapeHtml(part.code)}"
            >Add to Quote</button>
            <button
              type="button"
              class="flag-part-btn"
              data-code="${escapeHtml(part.code)}"
              data-title="${escapeHtml(part.name || part.code)}"
            >Flag item for problem</button>
          </div>`;

    li.innerHTML = `
      <div class="result-head">
        <div class="result-head-main">
          ${
            isPrimary
              ? `<p class="primary-kicker">Most likely for ${escapeHtml(
                  activePin.series?.label ||
                    activePin.model?.sku ||
                    "pinned model"
                )}</p>`
              : ""
          }
          <p class="result-code">${highlight(part.code, query)}</p>
          <h2 class="result-name">${highlight(part.name, query)}</h2>
          <div class="result-tags">${categoryBit}</div>
        </div>
        <div class="result-head-actions">
          <div class="result-flags">${fitBadge}${flagBadge}</div>
          ${cardActions}
        </div>
      </div>
      <div class="result-body">
        ${renderPriceBlock(part)}
        <div class="result-block">
          <h3>Aliases</h3>
          <div class="alias-row">${tradeAliasesForPart}</div>
          <h3 class="subhead">Model fit</h3>
          <div class="model-row">${modelsHtml}</div>
        </div>
      </div>
      <div class="result-foot">
        <div class="match-row">Matched on ${matchBits || '<span class="muted">—</span>'}</div>
        <span class="diagram-ref muted">Sheet: ${escapeHtml(part.sheet || "—")}</span>
      </div>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll(".add-quote-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code;
      const row = lastResults.find((r) => r.part?.code === code);
      if (!row?.part) return;
      handleAddToQuote(row.part);
      const prev = btn.textContent;
      btn.textContent = "Added";
      btn.classList.add("add-quote-btn--done");
      window.setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("add-quote-btn--done");
      }, 900);
    });
  });

  list.querySelectorAll(".flag-part-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code;
      const row = lastResults.find((r) => r.part?.code === code);
      const part = row?.part;
      submitFlagPart({
        code: part?.code || code,
        title: part?.name || btn.dataset.title || code,
      });
    });
  });
}

function renderAdminGate() {
  const gate = document.querySelector("#admin-gate");
  const body = document.querySelector("#admin-body");
  if (!gate || !body) return;

  if (adminUnlocked) {
    gate.innerHTML = `
      <div class="admin-gate-open">
        <p class="admin-unlocked">Unlocked for this browser tab.</p>
        <button type="button" class="admin-lock-btn" id="admin-lock">Lock admin</button>
      </div>
    `;
    body.hidden = false;
    gate.querySelector("#admin-lock")?.addEventListener("click", () => {
      adminUnlocked = false;
      setAdminSessionUnlocked(false);
      renderAdminPanel();
    });
    return;
  }

  body.hidden = true;
  const hasPassword = Boolean(getConfiguredAdminPassword(config));
  gate.innerHTML = `
    <form class="admin-unlock-form" id="admin-unlock-form">
      <label class="field" for="admin-password">
        <span class="field-label">Admin password</span>
        <input
          id="admin-password"
          type="password"
          autocomplete="current-password"
          placeholder="${hasPassword ? "Enter password" : "Empty stub — press Unlock (set password later)"}"
        />
      </label>
      <button type="submit" class="admin-unlock-btn">Unlock</button>
      <p class="admin-gate-hint muted">
        ${
          hasPassword
            ? "Password is set in localStorage / config (not committed)."
            : "No password set yet — Unlock opens the tools. Set one later via the field inside Admin or localStorage key <code>rinnai-parts-admin-password-v1</code>."
        }
      </p>
    </form>
  `;
  gate.querySelector("#admin-unlock-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const attempt = document.querySelector("#admin-password")?.value ?? "";
    const result = tryUnlockAdmin(attempt, config);
    if (!result.ok) {
      window.alert("Incorrect password.");
      return;
    }
    adminUnlocked = true;
    renderAdminPanel();
  });
}

function renderImportReview() {
  if (!pendingImport) return "";
  const { diff, sourceFile, skipCodes } = pendingImport;
  const removedRows = (diff.removed || [])
    .map((row) => {
      const key = String(row.code).toUpperCase();
      const checked = skipCodes.has(key) ? " checked" : "";
      return `
        <label class="import-row">
          <input type="checkbox" class="import-skip" data-code="${escapeHtml(
            row.code
          )}"${checked} />
          <span>
            <strong>${escapeHtml(row.code)}</strong>
            ${escapeHtml(row.title)}
            <span class="muted"> — missing from new list (skip = keep in catalogue)</span>
          </span>
        </label>
      `;
    })
    .join("");

  const addedPreview = (diff.added || [])
    .slice(0, 12)
    .map(
      (row) =>
        `<li><code>${escapeHtml(row.code)}</code> ${escapeHtml(row.title)}</li>`
    )
    .join("");

  return `
    <div class="import-review" id="import-review">
      <h3>Import review — ${escapeHtml(sourceFile)}</h3>
      <p>
        Current parts: <strong>${diff.currentCount}</strong>
        · Incoming: <strong>${diff.incomingCount}</strong>
        · Difference: <strong>${diff.difference >= 0 ? "+" : ""}${diff.difference}</strong>
        · Kept: ${diff.keptCount}
        · New: ${diff.added?.length ?? 0}
        · Missing from new list: ${diff.removed?.length ?? 0}
      </p>
      ${
        diff.removed?.length
          ? `<div class="import-removed">
              <h4>Missing from new list (often NLA / removed) — tick to keep</h4>
              <div class="import-removed-list">${removedRows}</div>
            </div>`
          : `<p class="muted">No parts missing from the new list.</p>`
      }
      ${
        diff.added?.length
          ? `<div class="import-added">
              <h4>New in incoming (first 12)</h4>
              <ul>${addedPreview}</ul>
            </div>`
          : ""
      }
      <div class="import-actions">
        <button type="button" class="admin-btn admin-btn--primary" id="import-apply">Apply import to local overlay</button>
        <button type="button" class="admin-btn" id="import-cancel">Cancel review</button>
      </div>
      <p class="muted">Apply writes a local price patch + change-queue entry. Production still needs <code>npm run ingest</code> / AI sync.</p>
    </div>
  `;
}

function renderAdminBody() {
  const body = document.querySelector("#admin-body");
  if (!body || !adminUnlocked) return;

  const flagged = Object.values(overrides.flagged || {});
  const suspended = Object.values(overrides.suspended || {});
  const deleted = Object.values(overrides.deleted || {});
  const queue = overrides.changeQueue || [];
  const path = loadPriceListPath(config);
  const storedPw = getConfiguredAdminPassword(config);

  const flagRows = flagged.length
    ? flagged
        .map(
          (f) => `
        <li class="admin-item">
          <div>
            <code>${escapeHtml(f.code)}</code>
            <span>${escapeHtml(f.title || "")}</span>
          </div>
          <button type="button" class="admin-btn" data-unflag="${escapeHtml(
            f.code
          )}">Clear flag</button>
        </li>`
        )
        .join("")
    : `<li class="muted">No flagged parts.</li>`;

  const suspendRows = suspended.length
    ? suspended
        .map(
          (s) => `
        <li class="admin-item">
          <div>
            <code>${escapeHtml(s.code)}</code>
            <span>${escapeHtml(s.title || "")}</span>
          </div>
          <button type="button" class="admin-btn" data-unsuspend="${escapeHtml(
            s.code
          )}">Unsuspend</button>
        </li>`
        )
        .join("")
    : `<li class="muted">No suspended parts.</li>`;

  const deleteRows = deleted.length
    ? deleted
        .map(
          (d) => `
        <li class="admin-item">
          <div>
            <code>${escapeHtml(d.code)}</code>
            <span>${escapeHtml(d.title || "")}</span>
          </div>
          <button type="button" class="admin-btn" data-restore="${escapeHtml(
            d.code
          )}">Restore</button>
        </li>`
        )
        .join("")
    : `<li class="muted">No deleted parts in overlay.</li>`;

  const queueRows = queue.length
    ? queue
        .slice(0, 25)
        .map(
          (q) => `
        <li class="admin-queue-item">
          <span class="admin-queue-action">${escapeHtml(q.action)}</span>
          <code>${escapeHtml(q.code || "—")}</code>
          <span class="muted">${escapeHtml(q.detail || "")}</span>
        </li>`
        )
        .join("")
    : `<li class="muted">Change queue empty.</li>`;

  body.innerHTML = `
    <div class="admin-grid">
      <div class="admin-card">
        <h3>Password (local only)</h3>
        <p class="muted">Stored in <code>localStorage</code> — leave blank for stub unlock. Never commit a real password.</p>
        <div class="admin-inline">
          <input id="admin-set-password" type="password" placeholder="${
            storedPw ? "Password is set — enter to replace" : "Set password (optional)"
          }" autocomplete="new-password" />
          <button type="button" class="admin-btn" id="admin-save-password">Save password</button>
          <button type="button" class="admin-btn" id="admin-clear-password">Clear</button>
        </div>
      </div>

      <div class="admin-card">
        <h3>Price list path / endpoint</h3>
        <p class="muted">Hint for where the workbook lives (Office PC). Browser import uses a file picker; path is config for ingest.</p>
        <div class="admin-inline">
          <input id="admin-price-path" type="text" value="${escapeHtml(
            path
          )}" spellcheck="false" />
          <button type="button" class="admin-btn" id="admin-save-path">Save path</button>
        </div>
        <div class="admin-inline admin-inline--file">
          <input id="admin-price-file" type="file" accept=".xlsx,.xls" />
          <button type="button" class="admin-btn admin-btn--primary" id="admin-import-file">Import &amp; review</button>
        </div>
        ${
          overrides.pricePatch
            ? `<p>Local price patch active from <code>${escapeHtml(
                overrides.pricePatch.sourceFile
              )}</code> (${overrides.pricePatch.parts?.length ?? 0} parts).
               <button type="button" class="admin-btn" id="admin-clear-patch">Clear patch</button></p>`
            : `<p class="muted">No local price patch — using committed JSON.</p>`
        }
        <div id="import-review-slot">${renderImportReview()}</div>
      </div>

      <div class="admin-card">
        <h3>Flagged parts</h3>
        <ul class="admin-list">${flagRows}</ul>
      </div>

      <div class="admin-card">
        <h3>Suspended (hidden from search)</h3>
        <div class="admin-inline">
          <input id="admin-suspend-code" type="text" placeholder="Part code to suspend" spellcheck="false" />
          <button type="button" class="admin-btn" id="admin-suspend-btn">Suspend</button>
        </div>
        <ul class="admin-list">${suspendRows}</ul>
      </div>

      <div class="admin-card">
        <h3>Deleted from active catalogue</h3>
        <p class="muted">Soft-delete overlay — does not rewrite <code>prices.json</code>. Queue for AI ingest.</p>
        <div class="admin-inline">
          <input id="admin-delete-code" type="text" placeholder="Part code to delete" spellcheck="false" />
          <button type="button" class="admin-btn admin-btn--danger" id="admin-delete-btn">Delete</button>
        </div>
        <ul class="admin-list">${deleteRows}</ul>
      </div>

      <div class="admin-card admin-card--wide">
        <h3>Change queue (for AI ingest sync)</h3>
        <p class="muted">Beau’s admin actions are recorded here. Production catalogue updates should be applied by AI running ingest / editing committed JSON — not by shipping localStorage.</p>
        <ul class="admin-queue">${queueRows}</ul>
        <button type="button" class="admin-btn" id="admin-export-queue">Copy queue JSON</button>
      </div>
    </div>
  `;

  body.querySelector("#admin-save-password")?.addEventListener("click", () => {
    const val = document.querySelector("#admin-set-password")?.value ?? "";
    setLocalAdminPassword(val);
    window.alert(
      val
        ? "Password saved in localStorage for this browser."
        : "Password cleared (stub unlock)."
    );
    renderAdminPanel();
  });
  body.querySelector("#admin-clear-password")?.addEventListener("click", () => {
    setLocalAdminPassword("");
    renderAdminPanel();
  });
  body.querySelector("#admin-save-path")?.addEventListener("click", () => {
    const val = document.querySelector("#admin-price-path")?.value ?? "";
    savePriceListPath(val);
    overrides = enqueueChange(overrides, {
      action: "set-price-path",
      detail: `Price list path set to ${val || "(empty)"}`,
    });
    persistOverrides();
    populateDataSources();
    renderAdminPanel();
  });
  body.querySelector("#admin-import-file")?.addEventListener("click", () => {
    const fileInput = document.querySelector("#admin-price-file");
    const file = fileInput?.files?.[0];
    if (!file) {
      window.alert("Choose an .xlsx price list first.");
      return;
    }
    void handlePriceImportFile(file);
  });
  body.querySelector("#admin-clear-patch")?.addEventListener("click", () => {
    overrides = clearPricePatch(overrides);
    persistOverrides();
    refreshCatalogueFromOverrides();
    populateDataSources();
    runSearch();
    renderAdminPanel();
  });
  body.querySelector("#import-apply")?.addEventListener("click", applyPendingImport);
  body.querySelector("#import-cancel")?.addEventListener("click", () => {
    pendingImport = null;
    renderAdminPanel();
  });
  body.querySelectorAll(".import-skip").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (!pendingImport) return;
      const code = String(cb.dataset.code || "").toUpperCase();
      if (cb.checked) pendingImport.skipCodes.add(code);
      else pendingImport.skipCodes.delete(code);
    });
  });
  body.querySelectorAll("[data-unflag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      overrides = clearFlag(overrides, btn.dataset.unflag);
      persistOverrides();
      refreshCatalogueFromOverrides();
      runSearch();
      renderAdminPanel();
      populateDataSources();
    });
  });
  body.querySelectorAll("[data-unsuspend]").forEach((btn) => {
    btn.addEventListener("click", () => {
      overrides = unsuspendPart(overrides, btn.dataset.unsuspend);
      persistOverrides();
      refreshCatalogueFromOverrides();
      runSearch();
      renderAdminPanel();
      populateDataSources();
    });
  });
  body.querySelectorAll("[data-restore]").forEach((btn) => {
    btn.addEventListener("click", () => {
      overrides = restoreDeletedPart(overrides, btn.dataset.restore);
      persistOverrides();
      refreshCatalogueFromOverrides();
      runSearch();
      renderAdminPanel();
      populateDataSources();
    });
  });
  body.querySelector("#admin-suspend-btn")?.addEventListener("click", () => {
    const code = String(
      document.querySelector("#admin-suspend-code")?.value || ""
    ).trim();
    if (!code) return;
    const part =
      catalogue?.parts?.find(
        (p) => String(p.code).toUpperCase() === code.toUpperCase()
      ) ||
      baseCatalogue?.parts?.find(
        (p) => String(p.code).toUpperCase() === code.toUpperCase()
      );
    overrides = suspendPart(overrides, {
      code,
      title: part?.name || code,
    });
    persistOverrides();
    refreshCatalogueFromOverrides();
    runSearch();
    renderAdminPanel();
    populateDataSources();
  });
  body.querySelector("#admin-delete-btn")?.addEventListener("click", () => {
    const code = String(
      document.querySelector("#admin-delete-code")?.value || ""
    ).trim();
    if (!code) return;
    if (
      !window.confirm(
        `Delete ${code} from the active local catalogue overlay? (prices.json unchanged until AI ingest)`
      )
    ) {
      return;
    }
    const part =
      catalogue?.parts?.find(
        (p) => String(p.code).toUpperCase() === code.toUpperCase()
      ) ||
      baseCatalogue?.parts?.find(
        (p) => String(p.code).toUpperCase() === code.toUpperCase()
      );
    overrides = deletePartOverride(overrides, {
      code,
      title: part?.name || code,
    });
    persistOverrides();
    refreshCatalogueFromOverrides();
    runSearch();
    renderAdminPanel();
    populateDataSources();
  });
  body.querySelector("#admin-export-queue")?.addEventListener("click", async () => {
    const text = JSON.stringify(overrides.changeQueue || [], null, 2);
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Change queue copied to clipboard.");
    } catch {
      window.prompt("Copy change queue JSON:", text);
    }
  });
}

function renderAdminPanel() {
  renderAdminGate();
  renderAdminBody();
  populateDataSources();
}

async function handlePriceImportFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const parsed = parsePriceWorkbook(buffer, {
      sourceFile: file.name,
      dataStartRow: config?.priceList?.parse?.dataStartRow ?? 6,
      effectiveDate: config?.priceList?.effectiveDate || null,
      label: config?.priceList?.label,
      currency: config?.currency,
      gstRate: config?.gstRate ?? gstRate,
    });
    const incomingParts = pricesToCatalogueParts(parsed.prices);
    const currentParts = catalogue?.parts || baseCatalogue?.parts || [];
    const diff = diffPriceImport(currentParts, incomingParts);
    pendingImport = {
      incomingParts,
      diff,
      sourceFile: file.name,
      meta: parsed.meta,
      skipCodes: new Set(),
    };
    renderAdminPanel();
  } catch (err) {
    window.alert(`Import failed: ${err.message || err}`);
  }
}

function applyPendingImport() {
  if (!pendingImport) return;
  const parts = buildReviewedParts(
    pendingImport.incomingParts,
    pendingImport.skipCodes,
    {
      currentParts: catalogue?.parts || baseCatalogue?.parts || [],
      retainSkippedRemoved: true,
    }
  );
  overrides = applyPricePatch(overrides, {
    sourceFile: pendingImport.sourceFile,
    parts,
    meta: pendingImport.meta,
    skippedCodes: [...pendingImport.skipCodes],
  });
  persistOverrides();
  pendingImport = null;
  refreshCatalogueFromOverrides();
  populateDataSources();
  runSearch();
  renderAdminPanel();
  window.alert(
    `Local overlay updated (${parts.length} parts). Queue recorded for AI ingest sync.`
  );
}

function bindEvents() {
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#query-input");
  const margin = document.querySelector("#margin-select");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(runSearch, 120);
  });

  marginPercent = clampMarginPercent(marginPercent);
  margin.value = String(marginPercent);
  margin.addEventListener("change", () => {
    marginPercent = clampMarginPercent(Number(margin.value));
    margin.value = String(marginPercent);
    const q = input.value;
    renderResults(q, currentPin());
    const cartDialog = document.querySelector("#cart-dialog");
    if (cartDialog?.open) renderCartOverlay();
  });

  document.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.dataset.q || "";
      runSearch();
      input.focus();
    });
  });

  const cartOpen = document.querySelector("#cart-open");
  const cartClose = document.querySelector("#cart-close");
  const cartDialog = document.querySelector("#cart-dialog");
  cartOpen?.addEventListener("click", openCart);
  cartClose?.addEventListener("click", closeCart);
  document.querySelector("#cart-email")?.addEventListener("click", emailCartToStores);
  document.querySelector("#cart-copy")?.addEventListener("click", () => {
    copyCartToClipboard();
  });
  document.querySelector("#cart-save")?.addEventListener("click", saveCartAndClose);
  document.querySelector("#cart-clear")?.addEventListener("click", clearCartAndClose);
  if (cartDialog) {
    cartDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeCart();
    });
    cartDialog.addEventListener("click", (e) => {
      if (e.target === cartDialog) closeCart();
    });
  }

  updateCartBadge();
  renderAdminPanel();
}

async function boot() {
  renderShell();
  try {
    const [cat, cfg, prices, series, trade] = await Promise.all([
      loadJson("/data/catalogue.json"),
      loadJson("/data/config.json"),
      loadJson("/data/prices.json"),
      loadJson("/data/series-aliases.json"),
      loadJson("/data/trade-aliases.json").catch(() => ({ aliases: [] })),
    ]);
    baseCatalogue = cat;
    config = cfg;
    pricesMeta = prices.meta || null;
    seriesDoc = series;
    tradeAliases = trade;
    overrides = loadOverrides();
    refreshCatalogueFromOverrides();
    marginPercent = clampMarginPercent(
      Number(cfg.defaultMarginPercent ?? cat.meta?.defaultMarginPercent) ||
        DEFAULT_MARGIN_PERCENT
    );
    gstRate = Number(cfg.gstRate ?? cat.meta?.gstRate) || DEFAULT_GST_RATE;
    adminUnlocked = isAdminSessionUnlocked();

    renderShell();
    cartLines = loadCart();
    mountModelPicker();
    populateDataSources();
    bindEvents();
  } catch (err) {
    app.innerHTML = `
      <div class="fatal">
        <h1>Catalogue failed to load</h1>
        <p>${escapeHtml(err.message)}</p>
        <p>Expected files under <code>/data/</code> — run <code>npm run ingest</code> if JSON is missing.</p>
      </div>
    `;
  }
}

boot();
