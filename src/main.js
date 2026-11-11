import "./style.css";
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
import { searchDocuments, resolveDocumentUrl } from "./documents.js";
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

const app = document.querySelector("#app");

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
/** @type {object|null} */
let documentIndex = null;
let lastResults = [];
let lastDocResults = [];
let marginPercent = DEFAULT_MARGIN_PERCENT;
let gstRate = DEFAULT_GST_RATE;
/** @type {{ title: string, url: string }|null} */
let viewerState = null;
/** @type {{ getValue: () => string|null, setValue: (v: string|null) => void }|null} */
let modelPicker = null;
/** Session unlocks for restricted pins (model id or series:…). */
const unlockedPins = new Set();
/** @type {import("./cart.js").CartLine[]} */
let cartLines = loadCart();
let cartFlashTimer = 0;

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
      count > 0 ? `Open quote cart (${count} items)` : "Open quote cart"
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
    body.innerHTML = `<p class="cart-empty">Cart is empty. Add parts from search results.</p>`;
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
      // Live totals without full re-render of focused input
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

function handleAddToCart(part) {
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
    showCartFlash("Cart is empty — add parts first.");
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
    showCartFlash("Cart is empty — nothing to copy.");
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
  showCartFlash("Cart saved.");
  window.setTimeout(() => closeCart(), 350);
}

function clearCartAndClose() {
  cartLines = [];
  clearStoredCart();
  updateCartBadge();
  closeCart();
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

  app.innerHTML = `
    <div class="page">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div class="brand-text">
            <p class="brand-org">MTC Gas · Admin</p>
            <h1 class="brand-name">Rinnai Parts</h1>
          </div>
        </div>
        <button
          type="button"
          class="cart-trigger"
          id="cart-open"
          aria-label="Open quote cart"
          title="Quote cart"
        >
          <svg class="cart-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14h9.45c.75 0 1.41-.41 1.75-1.03l3.24-6.07A1 1 0 0 0 20.72 5H6.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7.42l.74-1.35z"
            />
          </svg>
          <span class="cart-badge" id="cart-badge" hidden>0</span>
        </button>
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
        <div class="docs-wrap" id="docs-wrap" hidden>
          <h2 class="docs-heading">Data sheets</h2>
          <p class="docs-note muted" id="docs-note" hidden></p>
          <ul class="docs" id="docs"></ul>
        </div>
        <p class="empty" id="empty" hidden>No matches. Try a part code, description fragment, or clear the model pin.</p>
      </section>

      <dialog class="pdf-viewer" id="pdf-viewer">
        <div class="pdf-viewer-bar">
          <p class="pdf-viewer-title" id="pdf-viewer-title">Data sheet</p>
          <div class="pdf-viewer-actions">
            <a class="pdf-viewer-link" id="pdf-viewer-newtab" href="#" target="_blank" rel="noopener">Open in new tab</a>
            <button type="button" class="pdf-viewer-close" id="pdf-viewer-close">Close</button>
          </div>
        </div>
        <iframe class="pdf-viewer-frame" id="pdf-viewer-frame" title="Data sheet PDF"></iframe>
      </dialog>

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
              <h2 class="cart-dialog-title" id="cart-dialog-title">Shopping cart</h2>
            </div>
            <button type="button" class="cart-dialog-close" id="cart-close" aria-label="Close cart">Close</button>
          </header>
          <p class="cart-pin muted" id="cart-pin"></p>
          <p class="cart-flash" id="cart-flash" hidden></p>
          <div class="cart-body" id="cart-body"></div>
          <footer class="cart-dialog-foot">
            <div class="cart-totals" id="cart-totals"></div>
            <div class="cart-actions">
              <button type="button" class="cart-action cart-action--primary" id="cart-email">Email list to stores</button>
              <button type="button" class="cart-action" id="cart-copy">Copy to clipboard</button>
              <button type="button" class="cart-action" id="cart-save">Save cart</button>
              <button type="button" class="cart-action cart-action--danger" id="cart-clear">Clear cart</button>
            </div>
          </footer>
        </div>
      </dialog>

      <section class="data-sources" id="data-sources" aria-labelledby="data-sources-heading">
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
            <dt>Document index</dt>
            <dd id="ds-docs"><code>public/data/document-index.json</code></dd>
          </div>
        </dl>
        <ol class="refresh-steps">
          <li>Drop the new Rinnai price workbook into <code>source-data/</code>.</li>
          <li>Update <code>priceList.workbookPath</code> / <code>effectiveDate</code> in <code>public/data/config.json</code>.</li>
          <li>Run <code>npm run ingest</code>, then refresh the app.</li>
          <li>Series map (e.g. HD28 ↔ VCM2837) lives in <code>public/data/series-aliases.json</code> — edit there for model pin / document keys.</li>
          <li>Trade terms (e.g. flow servo) live in <code>public/data/trade-aliases.json</code> — not overwritten by ingest.</li>
          <li>Data-sheet PDFs stay local under <code>data-sheets/</code> (e.g. <code>C:\\Temp\\rinnai-spare-parts\\data-sheets\\</code>); Vite serves them at <code>/data-sheets/</code>. Only the JSON index is committed.</li>
        </ol>
      </section>

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
    // Focus No by default so Enter does not casually unlock.
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
  const docsEl = document.querySelector("#ds-docs");
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
    const priced = pricesMeta?.pricedCount ?? catalogue?.parts?.length ?? "—";
    const total = pricesMeta?.count ?? priced;
    pricesEl.textContent = `${total} total · ${priced} priced`;
  }
  if (sheetsEl) {
    sheetsEl.textContent = String(
      pricesMeta?.sheetCount ?? config?.priceList?.sheetCount ?? "—"
    );
  }
  if (docsEl) {
    const n = documentIndex?.totals?.pdfs ?? documentIndex?.documents?.length;
    docsEl.innerHTML = n
      ? `<code>public/data/document-index.json</code> · ${n} PDFs`
      : `<code>public/data/document-index.json</code>`;
  }
}

function runSearch() {
  const q = document.querySelector("#query-input").value;
  const pin = currentPin();
  const modelId = pin.kind === "model" ? pin.model?.id : null;
  const pinValue =
    modelPicker?.getValue?.() ||
    document.querySelector("#model-pin")?.value ||
    null;
  const isPartVisible = makePartVisibilityFilter(catalogue, {
    unlockedPinValues: unlockedPins,
    activePinValue: pinValue,
    activeModelIds: pin.modelIds,
  });
  lastResults = searchParts(catalogue, q, modelId, {
    modelIds: pin.modelIds,
    pin,
    tradeAliases,
    isPartVisible,
  });
  lastDocResults = searchDocuments(documentIndex, seriesDoc, q, pin, config);
  renderResults(q, pin);
}

function documentsRootHint() {
  const folder =
    config?.documents?.extractRootExample ||
    config?.documents?.localFolder ||
    "data-sheets/";
  const rootUrl = config?.documents?.rootUrl || "/data-sheets";
  return `PDFs load from ${folder} via ${rootUrl}/ (gitignored — not in cloud).`;
}

function openPdfViewer(title, url) {
  viewerState = { title, url };
  const dialog = document.querySelector("#pdf-viewer");
  const frame = document.querySelector("#pdf-viewer-frame");
  const titleEl = document.querySelector("#pdf-viewer-title");
  const link = document.querySelector("#pdf-viewer-newtab");
  if (!dialog || !frame || !titleEl || !link) {
    window.open(url, "_blank", "noopener");
    return;
  }
  titleEl.textContent = title;
  link.href = url;
  frame.src = url;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closePdfViewer() {
  viewerState = null;
  const dialog = document.querySelector("#pdf-viewer");
  const frame = document.querySelector("#pdf-viewer-frame");
  if (frame) frame.src = "about:blank";
  if (dialog && typeof dialog.close === "function") dialog.close();
  else if (dialog) dialog.removeAttribute("open");
}

function renderDocResults(pin) {
  const wrap = document.querySelector("#docs-wrap");
  const list = document.querySelector("#docs");
  const note = document.querySelector("#docs-note");
  if (!wrap || !list) return;
  list.innerHTML = "";

  const activePin = pin || currentPin();
  const hasPin = activePin.kind !== "none";
  const hasQuery = Boolean(
    String(document.querySelector("#query-input")?.value || "").trim()
  );
  const indexCount =
    documentIndex?.totals?.pdfs ?? documentIndex?.documents?.length ?? 0;

  if (!lastDocResults.length) {
    if (hasPin || hasQuery) {
      wrap.hidden = false;
      if (note) {
        note.hidden = false;
        if (!indexCount) {
          note.textContent =
            "No document index loaded. Expected public/data/document-index.json.";
        } else if (hasPin) {
          const label =
            activePin.series?.label ||
            activePin.model?.sku ||
            "this pin";
          note.textContent = `No matching data sheets for ${label}. ${documentsRootHint()}`;
        } else {
          note.textContent = `No matching data sheets for this search. ${documentsRootHint()}`;
        }
      }
    } else {
      wrap.hidden = true;
      if (note) {
        note.hidden = true;
        note.textContent = "";
      }
    }
    return;
  }

  wrap.hidden = false;
  if (note) {
    note.hidden = false;
    note.textContent = `${lastDocResults.length} sheet${
      lastDocResults.length === 1 ? "" : "s"
    } · click to open · ${documentsRootHint()}`;
  }

  for (const row of lastDocResults) {
    const { doc, matchedOn } = row;
    const url = row.url || resolveDocumentUrl(doc, config);
    const li = document.createElement("li");
    li.className = "doc";
    const series = (doc.series || [])
      .map((s) => `<span class="model-tag">${escapeHtml(s)}</span>`)
      .join("");
    const type = escapeHtml(doc.type || "other");
    const name = escapeHtml(doc.fileName);
    const openControls = url
      ? `<div class="doc-actions">
          <a class="doc-open" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open PDF</a>
          <button type="button" class="doc-view" data-url="${escapeHtml(url)}" data-title="${name}">View here</button>
        </div>`
      : `<p class="docs-note muted">No URL — check documents.rootUrl in config.json</p>`;

    li.innerHTML = `
      <div class="doc-head">
        <span class="doc-type">${type}</span>
        <p class="doc-name">${
          url
            ? `<a class="doc-name-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${name}</a>`
            : name
        }</p>
      </div>
      <div class="doc-series">${series || '<span class="muted">No series tags</span>'}</div>
      <p class="doc-path muted">${escapeHtml(doc.path || "")}</p>
      ${openControls}
      <div class="match-row">Matched on ${(matchedOn || [])
        .map((m) => `<span class="match-tag">${escapeHtml(m)}</span>`)
        .join("")}</div>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll(".doc-view").forEach((btn) => {
    btn.addEventListener("click", () => {
      openPdfViewer(btn.dataset.title || "Data sheet", btn.dataset.url);
    });
  });
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

  list.innerHTML = "";

  if (pinWarn) {
    pinWarn.hidden = !(hasQuery && !hasPin);
  }

  if (!hasQuery && !hasPin) {
    meta.textContent = "";
    empty.hidden = true;
    const docsWrap = document.querySelector("#docs-wrap");
    const docsList = document.querySelector("#docs");
    const docsNote = document.querySelector("#docs-note");
    if (docsWrap) docsWrap.hidden = true;
    if (docsList) docsList.innerHTML = "";
    if (docsNote) {
      docsNote.hidden = true;
      docsNote.textContent = "";
    }
    lastDocResults = [];
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
  const docBit = lastDocResults.length
    ? ` · ${lastDocResults.length} data sheet${lastDocResults.length === 1 ? "" : "s"}`
    : "";
  meta.textContent = `${lastResults.length} part${lastResults.length === 1 ? "" : "s"}${docBit}${pinBit}${primaryBit} · margin ${marginPercent}%`;

  renderDocResults(activePin);

  if (!lastResults.length && !lastDocResults.length) {
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

    const matchBits = matchedOn
      .map((m) => `<span class="match-tag">${escapeHtml(m)}</span>`)
      .join("");

    const categoryBit = part.category
      ? `<span class="category-tag">${escapeHtml(part.category)}</span>`
      : "";

    li.innerHTML = `
      <div class="result-head">
        <div>
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
        <div class="result-flags">${fitBadge}</div>
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
        <div class="result-foot-actions">
          ${
            part.kind === "discount-segment"
              ? ""
              : `<button
                  type="button"
                  class="add-cart-btn"
                  data-code="${escapeHtml(part.code)}"
                >Add to cart</button>`
          }
          <span class="diagram-ref muted">Sheet: ${escapeHtml(part.sheet || "—")}</span>
        </div>
      </div>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll(".add-cart-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code;
      const row = lastResults.find((r) => r.part?.code === code);
      if (!row?.part) return;
      handleAddToCart(row.part);
      const prev = btn.textContent;
      btn.textContent = "Added";
      btn.classList.add("add-cart-btn--done");
      window.setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("add-cart-btn--done");
      }, 900);
    });
  });
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

  const viewerClose = document.querySelector("#pdf-viewer-close");
  const viewer = document.querySelector("#pdf-viewer");
  if (viewerClose) viewerClose.addEventListener("click", closePdfViewer);
  if (viewer) {
    viewer.addEventListener("cancel", (e) => {
      e.preventDefault();
      closePdfViewer();
    });
    viewer.addEventListener("click", (e) => {
      if (e.target === viewer) closePdfViewer();
    });
  }

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
}

async function boot() {
  renderShell();
  try {
    const [cat, cfg, prices, series, trade, docs] = await Promise.all([
      loadJson("/data/catalogue.json"),
      loadJson("/data/config.json"),
      loadJson("/data/prices.json"),
      loadJson("/data/series-aliases.json"),
      loadJson("/data/trade-aliases.json").catch(() => ({ aliases: [] })),
      loadJson("/data/document-index.json").catch(() => ({ documents: [] })),
    ]);
    catalogue = cat;
    config = cfg;
    pricesMeta = prices.meta || null;
    seriesDoc = series;
    tradeAliases = trade;
    documentIndex = docs;
    marginPercent = clampMarginPercent(
      Number(cfg.defaultMarginPercent ?? cat.meta?.defaultMarginPercent) ||
        DEFAULT_MARGIN_PERCENT
    );
    gstRate = Number(cfg.gstRate ?? cat.meta?.gstRate) || DEFAULT_GST_RATE;

    // Re-render shell now that config is known (effective date / workbook name).
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
