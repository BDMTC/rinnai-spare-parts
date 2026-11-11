import "./style.css";
import { searchParts, getModelLabel } from "./search.js";
import {
  computePrices,
  formatAud,
  DEFAULT_MARGIN_PERCENT,
  DEFAULT_GST_RATE,
} from "./pricing.js";
import {
  listSeries,
  resolveModelPin,
  documentKeysForPin,
  modelIdsForSeries,
} from "./series.js";
import { searchDocuments, resolveDocumentUrl } from "./documents.js";

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
let documentIndex = null;
let lastResults = [];
let lastDocResults = [];
let marginPercent = DEFAULT_MARGIN_PERCENT;
let gstRate = DEFAULT_GST_RATE;
/** @type {{ title: string, url: string }|null} */
let viewerState = null;

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
        <p class="topbar-note">Local catalogue · price list ${escapeHtml(effective)}</p>
      </header>

      <main class="hero">
        <form class="search-panel" id="search-form" autocomplete="off">
          <div class="controls-row">
            <label class="field model-field" for="model-select">
              <span class="field-label">Model</span>
              <select id="model-select" name="model">
                <option value="">Any model</option>
              </select>
            </label>

            <label class="field margin-field" for="margin-select">
              <span class="field-label">Margin %</span>
              <select id="margin-select" name="margin">
                <option value="0">0%</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20" selected>20% (default)</option>
                <option value="25">25%</option>
                <option value="30">30%</option>
                <option value="35">35%</option>
                <option value="40">40%</option>
                <option value="50">50%</option>
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
                placeholder="Part code, description, or sheet category…"
                spellcheck="false"
                autofocus
              />
              <button type="submit" class="search-btn">Search</button>
            </div>
          </label>
        </form>

        <p class="hint" id="hint">
          Tip: try
          <button type="button" class="chip" data-q="35401021">35401021</button>
          <button type="button" class="chip" data-q="flow">flow</button>
          <button type="button" class="chip" data-q="thermocouple">thermocouple</button>
          <button type="button" class="chip" data-q="HD200">HD200</button>
          <button type="button" class="chip" data-q="HD28">HD28</button>
          <button type="button" class="chip" data-q="VCM2837">VCM2837</button>
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
            <dt>Document index</dt>
            <dd id="ds-docs"><code>public/data/document-index.json</code></dd>
          </div>
        </dl>
        <ol class="refresh-steps">
          <li>Drop the new Rinnai price workbook into <code>source-data/</code>.</li>
          <li>Update <code>priceList.workbookPath</code> / <code>effectiveDate</code> in <code>public/data/config.json</code>.</li>
          <li>Run <code>npm run ingest</code>, then refresh the app.</li>
          <li>Series map (e.g. HD28 ↔ VCM2837) lives in <code>public/data/series-aliases.json</code> — edit there for model pin / document keys.</li>
          <li>Data-sheet PDFs stay local under <code>data-sheets/</code> (e.g. <code>C:\\Temp\\rinnai-spare-parts\\data-sheets\\</code>); Vite serves them at <code>/data-sheets/</code>. Only the JSON index is committed.</li>
        </ol>
      </section>

      <footer class="footer">
        <span>Real Rinnai lists ingested locally. Exploded diagrams still to come.</span>
      </footer>
    </div>
  `;
}

function populateModels() {
  const select = document.querySelector("#model-select");

  const seriesList = listSeries(seriesDoc);
  if (seriesList.length) {
    const seriesGroup = document.createElement("optgroup");
    seriesGroup.label = "Series (aliases)";
    for (const series of seriesList) {
      const count = modelIdsForSeries(catalogue, series).length;
      const opt = document.createElement("option");
      opt.value = `series:${series.id}`;
      const aliasBit = (series.aliases || [])
        .filter((a) => normaliseAlias(a) !== normaliseAlias(series.label))
        .slice(0, 2)
        .join(" · ");
      opt.textContent = aliasBit
        ? `${series.label} series (${aliasBit}) · ${count} models`
        : `${series.label} series · ${count} models`;
      seriesGroup.appendChild(opt);
    }
    select.appendChild(seriesGroup);
  }

  const modelsGroup = document.createElement("optgroup");
  modelsGroup.label = "Models";
  const models = [...(catalogue.models || [])].sort((a, b) =>
    String(a.sku || a.name).localeCompare(String(b.sku || b.name))
  );
  for (const model of models) {
    const opt = document.createElement("option");
    opt.value = model.id;
    opt.textContent = getModelLabel(model);
    modelsGroup.appendChild(opt);
  }
  select.appendChild(modelsGroup);
}

function normaliseAlias(text) {
  return String(text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function currentPin() {
  const pinValue = document.querySelector("#model-select")?.value || null;
  return resolveModelPin(catalogue, seriesDoc, pinValue);
}

function populateDataSources() {
  const modelsEl = document.querySelector("#ds-models");
  const pricesEl = document.querySelector("#ds-prices");
  const sheetsEl = document.querySelector("#ds-sheets");
  const docsEl = document.querySelector("#ds-docs");
  if (modelsEl) {
    modelsEl.textContent = String(
      catalogue?.meta?.modelCount ?? catalogue?.models?.length ?? "—"
    );
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
  lastResults = searchParts(catalogue, q, modelId, {
    modelIds: pin.modelIds,
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
  const activePin = pin || currentPin();
  const hasPin = activePin.kind !== "none";

  list.innerHTML = "";

  if (!query.trim() && !hasPin) {
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
      ? ` · ${activePin.series.label}/${(activePin.series.aliases || []).find((a) => /VCM2837/i.test(a)) || activePin.series.label}`
      : "";
    pinBit = ` · pinned ${getModelLabel(activePin.model)}${seriesBit}`;
  }
  const docBit = lastDocResults.length
    ? ` · ${lastDocResults.length} data sheet${lastDocResults.length === 1 ? "" : "s"}`
    : "";
  meta.textContent = `${lastResults.length} part${lastResults.length === 1 ? "" : "s"}${docBit}${pinBit} · margin ${marginPercent}%`;

  renderDocResults(activePin);

  if (!lastResults.length && !lastDocResults.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const row of lastResults) {
    const { part, matchedOn, fitsSelectedModel, fittedModels } = row;
    const li = document.createElement("li");
    li.className = "result";
    if (hasPin && fitsSelectedModel === false) {
      li.classList.add("result--other-model");
    }
    if (hasPin && fitsSelectedModel === true) {
      li.classList.add("result--fits");
    }

    const aliases =
      (part.aliases || []).length > 0
        ? part.aliases
            .map((a) => `<span class="alias">${highlight(a, query)}</span>`)
            .join("")
        : `<span class="muted">No aliases yet</span>`;

    const modelsHtml = fittedModels.length
      ? fittedModels
          .map((m) => {
            const active =
              hasPin && activePin.modelIds.includes(m.id);
            const cls = active
              ? "model-tag model-tag--active"
              : "model-tag";
            return `<span class="${cls}">${escapeHtml(m.sku || m.name)}</span>`;
          })
          .join("")
      : `<span class="muted">Model links not mapped yet</span>`;

    const fitBadge =
      !hasPin
        ? ""
        : fitsSelectedModel
          ? `<span class="badge badge--fit">${activePin.kind === "series" ? "Fits series" : "Fits selected model"}</span>`
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
          <div class="alias-row">${aliases}</div>
          <h3 class="subhead">Fits models</h3>
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
}

function bindEvents() {
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#query-input");
  const select = document.querySelector("#model-select");
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
  select.addEventListener("change", runSearch);

  margin.value = String(marginPercent);
  margin.addEventListener("change", () => {
    marginPercent = Number(margin.value);
    const q = input.value;
    renderResults(q, currentPin());
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
}

async function boot() {
  renderShell();
  try {
    const [cat, cfg, prices, series, docs] = await Promise.all([
      loadJson("/data/catalogue.json"),
      loadJson("/data/config.json"),
      loadJson("/data/prices.json"),
      loadJson("/data/series-aliases.json"),
      loadJson("/data/document-index.json").catch(() => ({ documents: [] })),
    ]);
    catalogue = cat;
    config = cfg;
    pricesMeta = prices.meta || null;
    seriesDoc = series;
    documentIndex = docs;
    marginPercent =
      Number(cfg.defaultMarginPercent ?? cat.meta?.defaultMarginPercent) ||
      DEFAULT_MARGIN_PERCENT;
    gstRate = Number(cfg.gstRate ?? cat.meta?.gstRate) || DEFAULT_GST_RATE;

    // Re-render shell now that config is known (effective date / workbook name).
    renderShell();
    populateModels();
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
