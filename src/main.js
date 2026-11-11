import "./style.css";
import { searchParts, getModelLabel } from "./search.js";

const app = document.querySelector("#app");

/** @type {object|null} */
let catalogue = null;
let lastResults = [];

async function loadCatalogue() {
  const res = await fetch("/data/catalogue.json");
  if (!res.ok) throw new Error(`Could not load catalogue (${res.status})`);
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
        <p class="topbar-note">Local catalogue · offline-ready seed</p>
      </header>

      <main class="hero">
        <form class="search-panel" id="search-form" autocomplete="off">
          <label class="field model-field" for="model-select">
            <span class="field-label">Model</span>
            <select id="model-select" name="model">
              <option value="">Any model</option>
            </select>
          </label>

          <label class="field query-field" for="query-input">
            <span class="field-label">Search</span>
            <div class="query-row">
              <input
                id="query-input"
                name="q"
                type="search"
                placeholder="Part name, Rinnai code, or trade term…"
                spellcheck="false"
                autofocus
              />
              <button type="submit" class="search-btn">Search</button>
            </div>
          </label>
        </form>

        <p class="hint" id="hint">
          Tip: try <button type="button" class="chip" data-q="flow sensor">flow sensor</button>
          <button type="button" class="chip" data-q="PCB">PCB</button>
          <button type="button" class="chip" data-q="R1876">R1876</button>
          <button type="button" class="chip" data-q="anode">anode</button>
        </p>
      </main>

      <section class="results-wrap" aria-live="polite">
        <div class="results-meta" id="results-meta"></div>
        <ul class="results" id="results"></ul>
        <p class="empty" id="empty" hidden>No matches. Check spelling, try an alias, or clear the model pin.</p>
      </section>

      <footer class="footer">
        <span>Sample data only — replace <code>public/data/catalogue.json</code> with real lists.</span>
      </footer>
    </div>
  `;
}

function populateModels() {
  const select = document.querySelector("#model-select");
  const models = [...(catalogue.models || [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  for (const model of models) {
    const opt = document.createElement("option");
    opt.value = model.id;
    opt.textContent = getModelLabel(model);
    select.appendChild(opt);
  }
}

function runSearch() {
  const q = document.querySelector("#query-input").value;
  const modelId = document.querySelector("#model-select").value || null;
  lastResults = searchParts(catalogue, q, modelId);
  renderResults(q, modelId);
}

function renderResults(query, modelId) {
  const list = document.querySelector("#results");
  const meta = document.querySelector("#results-meta");
  const empty = document.querySelector("#empty");

  list.innerHTML = "";

  if (!query.trim() && !modelId) {
    meta.textContent = "";
    empty.hidden = true;
    return;
  }

  const model = (catalogue.models || []).find((m) => m.id === modelId);
  const modelBit = model ? ` · pinned ${getModelLabel(model)}` : "";
  meta.textContent = `${lastResults.length} result${lastResults.length === 1 ? "" : "s"}${modelBit}`;

  if (!lastResults.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const row of lastResults) {
    const { part, matchedOn, fitsSelectedModel, fittedModels } = row;
    const li = document.createElement("li");
    li.className = "result";
    if (modelId && fitsSelectedModel === false) {
      li.classList.add("result--other-model");
    }
    if (modelId && fitsSelectedModel === true) {
      li.classList.add("result--fits");
    }

    const aliases =
      (part.aliases || []).length > 0
        ? part.aliases.map((a) => `<span class="alias">${highlight(a, query)}</span>`).join("")
        : `<span class="muted">No aliases</span>`;

    const modelsHtml = fittedModels.length
      ? fittedModels
          .map((m) => {
            const cls =
              modelId && m.id === modelId ? "model-tag model-tag--active" : "model-tag";
            return `<span class="${cls}">${escapeHtml(m.sku || m.name)}</span>`;
          })
          .join("")
      : `<span class="muted">No models linked</span>`;

    const fitBadge =
      modelId == null
        ? ""
        : fitsSelectedModel
          ? `<span class="badge badge--fit">Fits selected model</span>`
          : `<span class="badge badge--other">Other model</span>`;

    const matchBits = matchedOn
      .map((m) => `<span class="match-tag">${escapeHtml(m)}</span>`)
      .join("");

    const diagramPlaceholder =
      part.diagramRef?.url || part.diagramRef?.path
        ? `<span class="diagram-ref">Diagram: ${escapeHtml(part.diagramRef.path || part.diagramRef.url)}${part.diagramRef.callout ? ` · ${escapeHtml(part.diagramRef.callout)}` : ""}</span>`
        : `<span class="diagram-ref muted">Diagram: placeholder (callout ${escapeHtml(part.diagramRef?.callout || "—")})</span>`;

    li.innerHTML = `
      <div class="result-head">
        <div>
          <p class="result-code">${highlight(part.code, query)}</p>
          <h2 class="result-name">${highlight(part.name, query)}</h2>
        </div>
        <div class="result-flags">${fitBadge}</div>
      </div>
      <div class="result-body">
        <div class="result-block">
          <h3>Aliases</h3>
          <div class="alias-row">${aliases}</div>
        </div>
        <div class="result-block">
          <h3>Fits models</h3>
          <div class="model-row">${modelsHtml}</div>
        </div>
      </div>
      <div class="result-foot">
        <div class="match-row">Matched on ${matchBits || '<span class="muted">—</span>'}</div>
        ${diagramPlaceholder}
      </div>
    `;
    list.appendChild(li);
  }
}

function bindEvents() {
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#query-input");
  const select = document.querySelector("#model-select");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });

  // Live search as you type / change model — ops-friendly
  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(runSearch, 120);
  });
  select.addEventListener("change", runSearch);

  document.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.dataset.q || "";
      runSearch();
      input.focus();
    });
  });
}

async function boot() {
  renderShell();
  try {
    catalogue = await loadCatalogue();
    populateModels();
    bindEvents();
  } catch (err) {
    app.innerHTML = `
      <div class="fatal">
        <h1>Catalogue failed to load</h1>
        <p>${escapeHtml(err.message)}</p>
        <p>Expected file: <code>/data/catalogue.json</code></p>
      </div>
    `;
  }
}

boot();
