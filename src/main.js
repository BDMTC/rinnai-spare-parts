import "./style.css";
import mtcgasLogoUrl from "./assets/mtcgas-australia-logo.png?inline";
import mtcTeamHqUrl from "./assets/mtc-team-hq.jpg?inline";
import rinnaiLogoUrl from "./assets/rinnai-logo.svg";
import emptyFrameLoopUrl from "./assets/empty-frame-loop.gif";
import tipPinModelUrl from "./assets/help/tip-pin-model.svg?inline";
import tipMarginUrl from "./assets/help/tip-margin.svg?inline";
import tipSearchUrl from "./assets/help/tip-search.svg?inline";
import tipHomeLogoUrl from "./assets/help/tip-home-logo.svg?inline";
import tipQuoteUrl from "./assets/help/tip-quote.svg?inline";
import { seriesUnitShotUrl } from "./series-unit-shots.js";
import {
  getFamilyExamplePack,
  familyExamplePages,
} from "./process-family-examples.js";
import {
  resolvePartDiagram,
  diagramPdfFileName,
  diagramPageSiblings,
} from "./diagram-pages.js";
import { resolveSeriesServiceManual } from "./service-manual-pages.js";
import { resolveCalloutBox } from "./diagram-callouts.js";
import {
  downloadLightboxPdf,
  LIGHTBOX_PDFS,
} from "./lightbox-pdf-download.js";
import {
  searchParts,
  getModelLabel,
  buildAbbrevIndex,
  buildAssemblyIndex,
  buildPartSearchCache,
  isNotPurchasableCode,
  matchAssemblyConcept,
} from "./search.js";
import {
  expandDisplayTitle,
  plainEnglishSummary,
} from "./display-name.js";
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
  isEverythingSystem,
  systemTypeFromValue,
} from "./system-type.js";
import {
  outletTempFromModel,
  isCommercialOutletTemp,
} from "./reu-format.js";
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
import { bindNewsTicker } from "./news-ticker.js";
import {
  appendFeedback,
  buildFeedbackMailto,
  downloadFeedbackJson,
  loadFeedback,
} from "./feedback.js";
import {
  parsePriceWorkbook,
  pricesToCatalogueParts,
  diffPriceImport,
  buildReviewedParts,
} from "./price-import.js";
import { loadBootData } from "./boot-data.js";
import { mountDataplatePin } from "./dataplate-pin.js";

// Resolved at boot (not import time) so the file:// classic IIFE can sit in <head>
// with defer, or at end of <body>, without racing #app.
function getApp() {
  return document.querySelector("#app");
}

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
/** @type {object|null} */
let partAbbrevs = null;
/** @type {ReturnType<typeof buildAbbrevIndex>|null} */
let abbrevIndex = null;
/** @type {object|null} */
let assemblyHierarchy = null;
/** @type {ReturnType<typeof buildAssemblyIndex>|null} */
let assemblyIndex = null;
/** @type {object|null} */
let partBlurbs = null;
/** @type {object|null} */
let processDoc = null;
/** @type {object|null} */
let processBasicDoc = null;
/** Active Process desk topic id (Detailed). */
let processTopicId = "";
/** Active Basic playbook chapter id. */
let processBasicChapterId = "";
/**
 * Process desk surface: chooser first, then basic or detailed pack.
 * @type {"chooser"|"basic"|"detailed"}
 */
let processViewMode = "chooser";
const PROCESS_LEVEL_STORAGE_KEY = "rsp-process-instruction-level";
/** @type {{ topicId: string, nodeId: string, outcomeId: string | null }} */
let processCheckerState = { topicId: "", nodeId: "", outcomeId: null };
/** Active family example pack id + page index (Next/Prev stay inside one family). */
let processExampleFamilyId = "cf";
let processExamplePageIndex = 0;
/** @type {ReturnType<typeof buildPartSearchCache>|null} */
let partSearchCache = null;
/** Memoised visibility predicate — pin/unlocks change it, typing must not. */
let visiblePartFilter = null;
let visiblePartFilterKey = "";
let lastResults = [];
let marginPercent = DEFAULT_MARGIN_PERCENT;
let gstRate = DEFAULT_GST_RATE;
/** @type {{ getValue: () => string|null, setValue: (v: string|null) => void, clear?: () => void, refreshEnabled?: () => void }|null} */
let systemPicker = null;
/** @type {{ getValue: () => string|null, setValue: (v: string|null) => void, clear?: () => void, refreshEnabled?: () => void }|null} */
let seriesPicker = null;
/** @type {{ getValue: () => string|null, setValue: (v: string|null) => void, clear?: () => void, refreshEnabled?: () => void }|null} */
let itemPicker = null;
/** @type {ReturnType<typeof mountDataplatePin>|null} */
let dataplatePin = null;
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

/** Keep Admin / Data sources usable after unlock / paste (veil must not re-block). */
function revealOpsPanels() {
  document.querySelector("#ops-panels")?.classList.add("is-revealed");
}

function coverOpsPanels() {
  document.querySelector("#ops-panels")?.classList.remove("is-revealed");
}

function bindOpsPanelsReveal() {
  const panels = document.querySelector("#ops-panels");
  if (!panels || panels.dataset.revealBound === "1") return;
  panels.dataset.revealBound = "1";
  const reveal = () => panels.classList.add("is-revealed");
  panels.addEventListener("pointerdown", reveal);
  panels.addEventListener("focusin", reveal);
  // While admin is unlocked, never re-cover — mouseleave used to clear
  // is-revealed and the team-photo veil blocked the Admin UI again.
  panels.addEventListener("mouseleave", () => {
    if (adminUnlocked) return;
    if (panels.contains(document.activeElement)) return;
    panels.classList.remove("is-revealed");
  });
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
    partSearchCache = null;
    visiblePartFilter = null;
    visiblePartFilterKey = "";
    return;
  }
  catalogue = applyOverridesToCatalogue(baseCatalogue, overrides);
  // Index layman/abbrev text once — search used to re-expand ~6.5k blurbs every keystroke.
  partSearchCache = buildPartSearchCache(catalogue.parts || [], {
    abbrevIndex,
    assemblyIndex,
    partBlurbs,
  });
  visiblePartFilter = null;
  visiblePartFilterKey = "";
}

function partVisibilityKey(pinValue) {
  const unlocks = [...unlockedPins].map(String).sort().join(",");
  return `${catalogue?.parts?.length || 0}|${pinValue || ""}|${unlocks}`;
}

/**
 * Restriction + admin visibility is pin/unlock-dependent, not query-dependent.
 * Precompute allowed part ids once per pin so keystrokes stay cheap.
 */
function activePinValue() {
  if (isEverythingSystem(currentSystemTypeValue())) return null;
  return (
    itemPicker?.getValue?.() ||
    document.querySelector("#item-pin")?.value ||
    seriesPicker?.getValue?.() ||
    document.querySelector("#series-pin")?.value ||
    null
  );
}

function getIsPartVisible() {
  const pin = currentPin();
  const pinValue = activePinValue();
  const key = partVisibilityKey(pinValue);
  if (visiblePartFilter && visiblePartFilterKey === key) {
    return visiblePartFilter;
  }
  const baseVis = makePartVisibilityFilter(catalogue, {
    unlockedPinValues: unlockedPins,
    activePinValue: pinValue,
    activeModelIds: pin.modelIds,
  });
  const isPartVisible = makeAdminPartFilter(overrides, baseVis);
  // Pre-index price-list rows only. Demand Duo finished-goods accessory SKUs
  // are synthetic (not in catalogue.parts) — must still pass through.
  const allowed = new Set();
  for (const part of catalogue?.parts || []) {
    if (!isPartVisible(part)) continue;
    const id = String(part.id || "").trim();
    const code = String(part.code || "").trim();
    if (id) allowed.add(`id:${id}`);
    if (code) allowed.add(`code:${code}`);
  }
  visiblePartFilter = (part) => {
    if (part?.accessorySku) {
      return isPartVisible(part);
    }
    const id = String(part?.id || "").trim();
    if (id && allowed.has(`id:${id}`)) return true;
    const code = String(part?.code || "").trim();
    if (code && allowed.has(`code:${code}`)) return true;
    return false;
  };
  visiblePartFilterKey = key;
  return visiblePartFilter;
}

function pinnedLabelForQuote() {
  const pin = currentPin();
  if (pin.kind === "model" && pin.model) {
    const item =
      String(pin.model.itemNumber || "").trim() ||
      pin.model.sku ||
      pin.model.marketingCode ||
      getModelLabel(pin.model);
    const seriesBit = pin.series ? ` · ${pin.series.label}` : "";
    return `${item}${seriesBit}`;
  }
  if (pin.kind === "series" && pin.series) {
    return `${pin.series.label} series`;
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

function openHelp() {
  const dialog = document.querySelector("#help-dialog");
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeHelp() {
  const dialog = document.querySelector("#help-dialog");
  if (dialog && typeof dialog.close === "function") dialog.close();
  else if (dialog) dialog.removeAttribute("open");
}

function processTopics() {
  const topics = processDoc?.topics;
  return Array.isArray(topics) ? topics : [];
}

function processBasicChapters() {
  const chapters = processBasicDoc?.chapters;
  return Array.isArray(chapters) ? chapters : [];
}

/** Shared warranty pathway checker from the Detailed pack (same tree on Basic + Detailed). */
function processWarrantyCheckerTopic() {
  const topics = processTopics();
  const warranty = topics.find((t) => t.id === "warranty");
  if (!warranty?.checker) return null;
  return { id: "warranty", checker: warranty.checker };
}

function activeProcessTopic() {
  const topics = processTopics();
  if (!topics.length) return null;
  return topics.find((t) => t.id === processTopicId) || topics[0];
}

function activeProcessBasicChapter() {
  const chapters = processBasicChapters();
  if (!chapters.length) return null;
  return chapters.find((c) => c.id === processBasicChapterId) || chapters[0];
}

function loadSavedProcessLevel() {
  try {
    const raw = localStorage.getItem(PROCESS_LEVEL_STORAGE_KEY);
    if (raw === "basic" || raw === "detailed") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function saveProcessLevel(level) {
  try {
    if (level === "basic" || level === "detailed") {
      localStorage.setItem(PROCESS_LEVEL_STORAGE_KEY, level);
    }
  } catch {
    /* ignore */
  }
}

function setProcessLevel(level) {
  if (level !== "basic" && level !== "detailed") return;
  processViewMode = level;
  saveProcessLevel(level);
  if (level === "basic") {
    const chapters = processBasicChapters();
    if (!processBasicChapterId && chapters[0]?.id) {
      processBasicChapterId = chapters[0].id;
    }
  } else {
    const topics = processTopics();
    if (!processTopicId && topics[0]?.id) processTopicId = topics[0].id;
  }
  renderProcessDesk();
}

function showProcessChooser() {
  processViewMode = "chooser";
  renderProcessDesk();
}

function resetProcessChecker(topic) {
  const startId = topic?.checker?.startId || "";
  processCheckerState = {
    topicId: topic?.id || "",
    nodeId: startId,
    outcomeId: null,
  };
}

function ensureProcessCheckerState(topic) {
  const checker = topic?.checker;
  if (!checker?.startId) {
    processCheckerState = { topicId: "", nodeId: "", outcomeId: null };
    return;
  }
  if (processCheckerState.topicId !== topic.id) {
    resetProcessChecker(topic);
  }
}

function renderFamilyExamplePageHtml(pack, page) {
  let media = "";
  if (page?.kind === "collage" && Array.isArray(page.images) && page.images.length >= 2) {
    media = `<div class="process-example-collage">
      <figure class="process-example-collage-item">
        <img src="${escapeHtml(page.images[0].src)}" alt="${escapeHtml(page.images[0].label)}" loading="lazy" decoding="async" />
        <figcaption>${escapeHtml(page.images[0].caption || "Storage tank")}</figcaption>
      </figure>
      <span class="process-example-collage-plus" aria-hidden="true">+</span>
      <figure class="process-example-collage-item">
        <img src="${escapeHtml(page.images[1].src)}" alt="${escapeHtml(page.images[1].label)}" loading="lazy" decoding="async" />
        <figcaption>${escapeHtml(page.images[1].caption || "Continuous flow")}</figcaption>
      </figure>
    </div>`;
  } else if (page?.src) {
    media = `<div class="process-example-shots process-example-shots--single">
      <figure class="process-example-shot">
        <img src="${escapeHtml(page.src)}" alt="${escapeHtml(page.label || pack.title)}" loading="lazy" decoding="async" />
      </figure>
    </div>`;
  } else {
    media = `<p class="muted">No example image for this family yet.</p>`;
  }

  return `
    <div class="process-example-slide" data-example-id="${escapeHtml(pack.id)}">
      <h3 class="process-example-slide-title">${escapeHtml(pack.title)}</h3>
      <p class="process-example-slide-caption">${escapeHtml(pack.caption)}</p>
      ${media}
      <p class="process-example-slide-attr muted">${escapeHtml(pack.attribution || "")}</p>
    </div>`;
}

function openProcessFamilyExamples(familyId) {
  const dialog = document.querySelector("#process-example-dialog");
  if (!dialog) return;
  processExampleFamilyId = familyId || "cf";
  processExamplePageIndex = 0;
  renderProcessFamilyExampleSlide();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeProcessFamilyExamples() {
  const dialog = document.querySelector("#process-example-dialog");
  if (dialog && typeof dialog.close === "function") dialog.close();
  else if (dialog) dialog.removeAttribute("open");
}

function renderProcessFamilyExampleSlide() {
  const stage = document.querySelector("#process-example-stage");
  const pageEl = document.querySelector("#process-example-page");
  const prev = document.querySelector("#process-example-prev");
  const next = document.querySelector("#process-example-next");
  if (!stage) return;
  const pack = getFamilyExamplePack(processExampleFamilyId);
  const pages = familyExamplePages(pack);
  if (!pages.length) {
    stage.innerHTML = `<p class="muted">No family examples loaded.</p>`;
    if (pageEl) pageEl.textContent = "";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
    return;
  }
  if (processExamplePageIndex < 0) processExamplePageIndex = 0;
  if (processExamplePageIndex >= pages.length) {
    processExamplePageIndex = pages.length - 1;
  }
  stage.innerHTML = renderFamilyExamplePageHtml(pack, pages[processExamplePageIndex]);
  if (pageEl) {
    pageEl.textContent =
      pages.length > 1
        ? `${processExamplePageIndex + 1} / ${pages.length}`
        : pack.title;
  }
  if (prev) prev.disabled = processExamplePageIndex <= 0;
  if (next) next.disabled = processExamplePageIndex >= pages.length - 1;
}

function renderProcessCheckerHtml(topic) {
  const checker = topic?.checker;
  if (!checker || typeof checker !== "object") return "";
  ensureProcessCheckerState(topic);

  const questions = checker.questions && typeof checker.questions === "object" ? checker.questions : {};
  const outcomes = checker.outcomes && typeof checker.outcomes === "object" ? checker.outcomes : {};
  const outcomeId = processCheckerState.outcomeId;
  const nodeId = processCheckerState.nodeId || checker.startId || "";

  let panelInner = "";
  if (outcomeId && outcomes[outcomeId]) {
    const out = outcomes[outcomeId];
    panelInner = `
      <div class="process-checker-outcome" data-outcome="${escapeHtml(outcomeId)}">
        <p class="process-checker-outcome-title">${escapeHtml(out.title || outcomeId)}</p>
        <p class="process-checker-outcome-detail muted">${escapeHtml(out.detail || "")}</p>
      </div>`;
  } else {
    const q = questions[nodeId];
    if (!q) {
      panelInner = `<p class="muted">Checker path not available.</p>`;
    } else {
      const choices = Array.isArray(q.choices) ? q.choices : [];
      const choicesHtml = choices
        .map((c, i) => {
          const label = escapeHtml(c?.label || `Choice ${i + 1}`);
          const exId = c?.exampleId ? String(c.exampleId) : "";
          const exampleBtn = exId
            ? `<button type="button" class="process-checker-example-icon" data-checker-example="${escapeHtml(exId)}" title="Show example" aria-label="Show example for ${label}">
                <span aria-hidden="true">ⓘ</span>
              </button>`
            : "";
          return `<div class="process-checker-choice-row">
            <button type="button" class="process-checker-choice" data-checker-choice="${i}">${label}</button>
            ${exampleBtn}
          </div>`;
        })
        .join("");
      panelInner = `
        <p class="process-checker-prompt">${escapeHtml(q.prompt || "")}</p>
        <div class="process-checker-choices" role="group" aria-label="${escapeHtml(q.prompt || "Choices")}">
          ${choicesHtml}
        </div>`;
    }
  }

  return `
    <section class="process-checker" aria-label="Warranty pathway checker">
      <div class="process-checker-head">
        <h3 class="process-checker-title">${escapeHtml(checker.heading || "Still unsure? — answer the following")}</h3>
        <button type="button" class="cart-action process-checker-reset" data-checker-reset>Reset</button>
      </div>
      <div class="process-checker-panel">${panelInner}</div>
      <p class="process-checker-disclaimer muted">${escapeHtml(
        checker.disclaimer ||
          "Desk aid only — not legal advice or Rinnai’s final say."
      )}</p>
    </section>`;
}

function bindProcessChecker(topic) {
  const body = document.querySelector("#process-body");
  if (!body || !topic?.checker) return;
  const checker = topic.checker;
  const questions = checker.questions && typeof checker.questions === "object" ? checker.questions : {};

  body.querySelector("[data-checker-reset]")?.addEventListener("click", () => {
    resetProcessChecker(topic);
    renderProcessDesk();
  });

  body.querySelectorAll("[data-checker-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-checker-choice"));
      const nodeId = processCheckerState.nodeId || checker.startId || "";
      const q = questions[nodeId];
      const choice = Array.isArray(q?.choices) ? q.choices[idx] : null;
      if (!choice) return;
      if (choice.outcome) {
        processCheckerState = {
          ...processCheckerState,
          topicId: topic.id,
          outcomeId: String(choice.outcome),
        };
      } else if (choice.next) {
        processCheckerState = {
          topicId: topic.id,
          nodeId: String(choice.next),
          outcomeId: null,
        };
      }
      renderProcessDesk();
    });
  });

  body.querySelectorAll("[data-checker-example]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProcessFamilyExamples(btn.getAttribute("data-checker-example") || "");
    });
  });
}

function updateProcessDialogChrome() {
  const kicker = document.querySelector("#process-dialog-kicker");
  const title = document.querySelector("#process-dialog-title");
  const source = document.querySelector("#process-source");
  const levelBtn = document.querySelector("#process-change-level");
  const layout = document.querySelector("#process-layout");

  if (processViewMode === "chooser") {
    if (kicker) kicker.textContent = processDoc?.kicker || "Zone Contractor";
    if (title) title.textContent = "Rinnai Process";
    if (source) {
      source.textContent =
        "Would you like basic instructions, or detailed instructions?";
    }
    if (levelBtn) levelBtn.hidden = true;
    if (layout) layout.classList.add("process-layout--chooser");
    return;
  }

  if (processViewMode === "basic") {
    if (kicker) kicker.textContent = processBasicDoc?.kicker || "Zone Contractor";
    if (title) title.textContent = processBasicDoc?.title || "Rinnai Process — Basic";
    if (source) {
      source.textContent =
        processBasicDoc?.sourceNote ||
        "Zero-knowledge playbook. Plain English. No portal passwords or payment credentials.";
    }
  } else {
    if (kicker) kicker.textContent = processDoc?.kicker || "Zone Contractor";
    if (title) title.textContent = processDoc?.title || "Rinnai Process";
    if (source) {
      source.textContent = processDoc?.sourceNote || "";
    }
  }

  if (levelBtn) levelBtn.hidden = false;
  if (layout) layout.classList.remove("process-layout--chooser");
}

function renderProcessChooser() {
  const rail = document.querySelector("#process-rail");
  const body = document.querySelector("#process-body");
  if (!rail || !body) return;

  rail.innerHTML = "";
  body.innerHTML = `
    <div class="process-chooser" role="group" aria-label="Instruction level">
      <p class="process-chooser-prompt">Would you like basic instructions, or detailed instructions?</p>
      <div class="process-chooser-actions">
        <button type="button" class="process-chooser-card" data-process-level="basic">
          <span class="process-chooser-card-title">Basic</span>
          <span class="process-chooser-card-blurb">10 short chapters. Plain English with examples in brackets. Assume no prior knowledge. Includes the warranty checker.</span>
        </button>
        <button type="button" class="process-chooser-card" data-process-level="detailed">
          <span class="process-chooser-card-title">Detailed</span>
          <span class="process-chooser-card-blurb">Full Process topics, step tables, warranty years, and Still unsure? checker.</span>
        </button>
      </div>
    </div>
  `;

  body.querySelectorAll("[data-process-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setProcessLevel(btn.getAttribute("data-process-level") || "");
    });
  });
}

function renderProcessBasicBody() {
  const rail = document.querySelector("#process-rail");
  const body = document.querySelector("#process-body");
  if (!rail || !body) return;

  const chapters = processBasicChapters();
  const current = activeProcessBasicChapter();
  if (current?.id) processBasicChapterId = current.id;

  if (!chapters.length || !current) {
    rail.innerHTML = "";
    body.innerHTML = `<p class="process-empty muted">Basic process pack not loaded.</p>`;
    return;
  }

  rail.innerHTML = chapters
    .map((c) => {
      const active = c.id === current.id;
      return `<button
        type="button"
        class="process-rail-btn${active ? " is-active" : ""}"
        data-process-basic-chapter="${escapeHtml(c.id)}"
        aria-current="${active ? "page" : "false"}"
      >
        <span class="process-rail-title">${escapeHtml(c.title || c.id)}</span>
        <span class="process-rail-blurb">${escapeHtml(c.blurb || "")}</span>
      </button>`;
    })
    .join("");

  const paras = Array.isArray(current.body) ? current.body : [];
  const bodyHtml = paras.length
    ? `<div class="process-basic-body">${paras
        .map((p) => `<p class="process-basic-para">${escapeHtml(p)}</p>`)
        .join("")}</div>`
    : `<p class="process-empty muted">No copy for this chapter.</p>`;

  const intro =
    processBasicDoc?.intro && current.id === chapters[0]?.id
      ? `<p class="process-basic-intro muted">${escapeHtml(processBasicDoc.intro)}</p>`
      : "";

  const warrantyTopic =
    current.id === "warranty" ? processWarrantyCheckerTopic() : null;
  const checkerHtml = warrantyTopic
    ? renderProcessCheckerHtml(warrantyTopic)
    : "";

  body.innerHTML = `
    <header class="process-topic-head">
      <h3 class="process-topic-title">${escapeHtml(current.title || "")}</h3>
      <p class="process-topic-blurb muted">${escapeHtml(current.blurb || "")}</p>
    </header>
    ${intro}
    ${bodyHtml}
    ${checkerHtml}
  `;

  rail.querySelectorAll("[data-process-basic-chapter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      processBasicChapterId = btn.getAttribute("data-process-basic-chapter") || "";
      renderProcessDesk();
    });
  });

  if (warrantyTopic) bindProcessChecker(warrantyTopic);
}

function renderProcessDetailedBody() {
  const rail = document.querySelector("#process-rail");
  const body = document.querySelector("#process-body");
  if (!rail || !body) return;

  const topics = processTopics();
  const current = activeProcessTopic();
  if (current?.id) processTopicId = current.id;

  if (!topics.length || !current) {
    rail.innerHTML = "";
    body.innerHTML = `<p class="process-empty muted">Process pack not loaded.</p>`;
    return;
  }

  rail.innerHTML = topics
    .map((t) => {
      const active = t.id === current.id;
      return `<button
        type="button"
        class="process-rail-btn${active ? " is-active" : ""}"
        data-process-topic="${escapeHtml(t.id)}"
        aria-current="${active ? "page" : "false"}"
      >
        <span class="process-rail-title">${escapeHtml(t.title || t.id)}</span>
        <span class="process-rail-blurb">${escapeHtml(t.blurb || "")}</span>
      </button>`;
    })
    .join("");

  const steps = Array.isArray(current.steps) ? current.steps : [];
  const notes = Array.isArray(current.notes) ? current.notes : [];
  const tables = Array.isArray(current.tables) ? current.tables : [];
  const actions = Array.isArray(current.actions) ? current.actions : [];

  const stepsHtml = steps.length
    ? `<ol class="process-steps">${steps
        .map((s) => {
          const n = s?.n != null ? String(s.n) : "";
          const text = escapeHtml(s?.text || String(s || ""));
          return `<li class="process-step">
            <span class="process-step-n" aria-hidden="true">${escapeHtml(n)}</span>
            <span class="process-step-text">${text}</span>
          </li>`;
        })
        .join("")}</ol>`
    : "";

  const tablesHtml = tables
    .map((table) => {
      const headers = Array.isArray(table.headers) ? table.headers : [];
      const rows = Array.isArray(table.rows) ? table.rows : [];
      const head = headers.length
        ? `<thead><tr>${headers
            .map((h) => `<th scope="col">${escapeHtml(h)}</th>`)
            .join("")}</tr></thead>`
        : "";
      const bodyRows = rows
        .map(
          (row) =>
            `<tr>${(Array.isArray(row) ? row : [row])
              .map((cell) => `<td>${escapeHtml(cell)}</td>`)
              .join("")}</tr>`
        )
        .join("");
      const footNotes = Array.isArray(table.footnote)
        ? table.footnote.filter((f) => String(f || "").trim())
        : table.footnote
          ? [table.footnote]
          : [];
      const foot = footNotes.length
        ? footNotes.length === 1
          ? `<p class="process-table-foot muted">${escapeHtml(footNotes[0])}</p>`
          : `<ul class="process-table-foot muted">${footNotes
              .map((f) => `<li>${escapeHtml(f)}</li>`)
              .join("")}</ul>`
        : "";
      return `<section class="process-table-block">
        <h3 class="process-table-title">${escapeHtml(table.title || "Table")}</h3>
        <div class="process-table-scroll">
          <table class="process-table">${head}<tbody>${bodyRows}</tbody></table>
        </div>
        ${foot}
      </section>`;
    })
    .join("");

  const notesHtml = notes.length
    ? `<ul class="process-notes">${notes
        .map((n) => `<li>${escapeHtml(n)}</li>`)
        .join("")}</ul>`
    : "";

  const actionsHtml = actions.length
    ? `<div class="process-actions">${actions
        .map((a) => {
          if (a?.id === "focus-search") {
            return `<button type="button" class="cart-action" id="process-focus-search">${escapeHtml(
              a.label || "Focus Bible search"
            )}</button>`;
          }
          return "";
        })
        .join("")}</div>`
    : "";

  const checkerHtml = renderProcessCheckerHtml(current);

  body.innerHTML = `
    <header class="process-topic-head">
      <h3 class="process-topic-title">${escapeHtml(current.title || "")}</h3>
      <p class="process-topic-blurb muted">${escapeHtml(current.blurb || "")}</p>
    </header>
    ${stepsHtml}
    ${tablesHtml}
    ${checkerHtml}
    ${notesHtml}
    ${actionsHtml}
  `;

  rail.querySelectorAll("[data-process-topic]").forEach((btn) => {
    btn.addEventListener("click", () => {
      processTopicId = btn.getAttribute("data-process-topic") || "";
      renderProcessDesk();
    });
  });

  bindProcessChecker(current);

  body.querySelector("#process-focus-search")?.addEventListener("click", () => {
    closeProcess();
    const input = document.querySelector("#query-input");
    input?.focus();
    input?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function renderProcessDesk() {
  updateProcessDialogChrome();
  if (processViewMode === "chooser") {
    renderProcessChooser();
    return;
  }
  if (processViewMode === "basic") {
    renderProcessBasicBody();
    return;
  }
  renderProcessDetailedBody();
}

function openProcess() {
  const dialog = document.querySelector("#process-dialog");
  if (!dialog) return;
  const saved = loadSavedProcessLevel();
  if (saved === "basic" || saved === "detailed") {
    processViewMode = saved;
    if (saved === "basic") {
      const chapters = processBasicChapters();
      if (!processBasicChapterId && chapters[0]?.id) {
        processBasicChapterId = chapters[0].id;
      }
    } else {
      const topics = processTopics();
      if (!processTopicId && topics[0]?.id) processTopicId = topics[0].id;
    }
  } else {
    processViewMode = "chooser";
  }
  renderProcessDesk();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeProcess() {
  const dialog = document.querySelector("#process-dialog");
  if (dialog && typeof dialog.close === "function") dialog.close();
  else if (dialog) dialog.removeAttribute("open");
}

function openFeedback() {
  const dialog = document.querySelector("#feedback-dialog");
  if (!dialog) return;
  const flash = document.querySelector("#feedback-flash");
  if (flash) {
    flash.hidden = true;
    flash.textContent = "";
  }
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.querySelector("#feedback-name")?.focus();
}

function closeFeedback() {
  const dialog = document.querySelector("#feedback-dialog");
  if (dialog && typeof dialog.close === "function") dialog.close();
  else if (dialog) dialog.removeAttribute("open");
}

function showFeedbackFlash(message) {
  const flash = document.querySelector("#feedback-flash");
  if (!flash) return;
  flash.textContent = message;
  flash.hidden = !message;
}

function submitFeedback(opts = {}) {
  const nameInput = document.querySelector("#feedback-name");
  const commentInput = document.querySelector("#feedback-comment");
  const name = nameInput?.value ?? "";
  const comment = commentInput?.value ?? "";
  let entry;
  try {
    entry = appendFeedback({ name, comment });
  } catch (err) {
    showFeedbackFlash(err.message || "Please fill in your name and comment.");
    if (!String(name).trim()) nameInput?.focus();
    else commentInput?.focus();
    return null;
  }
  if (nameInput) nameInput.value = "";
  if (commentInput) commentInput.value = "";
  showFeedbackFlash("Thanks — saved on this device.");
  if (opts.mailto) {
    openMailto(buildFeedbackMailto(entry));
  }
  return entry;
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

/**
 * Hand off to the OS mail client. Call only from a real click handler
 * (not after window.prompt) — Chromium drops mailto without user activation.
 * @param {string} href
 */
function openMailto(href) {
  if (!href || !String(href).startsWith("mailto:")) return;
  // location.href is more reliable than a synthetic <a>.click() for mailto.
  window.location.href = href;
}

function readCartJobNumber() {
  const input = document.querySelector("#cart-job");
  const job = normalizeJobNumber(input?.value ?? "");
  if (!job) {
    showCartFlash("Enter a job or work order number (plain digits or WO-…).");
    input?.focus();
    return null;
  }
  return job;
}

function emailCartToStores() {
  if (!cartLines.length) {
    showCartFlash("Quote list is empty — add parts first.");
    return;
  }
  // Keep the modal open and read job from the in-dialog field.
  // window.prompt is suppressed under <dialog showModal()>, and closing the
  // dialog then prompting burns the user gesture so mailto often no-ops.
  const job = readCartJobNumber();
  if (job == null) return;
  const body = formatQuoteText({
    lines: cartLines,
    jobNumber: job,
    marginPercent,
    gstRate,
    pinnedLabel: pinnedLabelForQuote(),
  });
  openMailto(buildStoresMailto(job, body));
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

/** Pin snapshot for flag-issue mailto body (type / series / item when set). */
function flagPinsLabel() {
  const bits = [];
  const system = systemTypeFromValue(currentSystemTypeValue());
  if (system) bits.push(`Type: ${system.label}`);
  const pin = currentPin();
  if (pin.kind === "series" || pin.kind === "model") {
    if (pin.series?.label) bits.push(`Series: ${pin.series.label}`);
  }
  if (pin.kind === "model" && pin.model) {
    const item =
      String(pin.model.itemNumber || "").trim() ||
      pin.model.sku ||
      pin.model.marketingCode ||
      getModelLabel(pin.model);
    if (item) bits.push(`Item Number: ${item}`);
  }
  return bits.length ? bits.join(" · ") : null;
}

function dismissFlagConfirm(card) {
  card?.querySelector(".flag-confirm-overlay")?.remove();
}

/**
 * Card-sized confirm overlay. Yes keeps user activation for mailto.
 * @param {HTMLElement} card
 * @param {{ code?: string, title?: string, name?: string }} part
 */
function showFlagConfirm(card, part) {
  if (!card) return;
  document.querySelectorAll(".flag-confirm-overlay").forEach((el) => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "flag-confirm-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute(
    "aria-label",
    "Are you sure you want to flag this item as a problem or issue?"
  );
  overlay.innerHTML = `
    <p class="flag-confirm-copy">Are you sure you want to flag this item as a problem or issue?</p>
    <div class="flag-confirm-actions">
      <button type="button" class="flag-confirm-yes">Yes</button>
      <button type="button" class="flag-confirm-no">No</button>
    </div>
  `;
  card.appendChild(overlay);
  overlay.querySelector(".flag-confirm-no")?.addEventListener("click", () => {
    dismissFlagConfirm(card);
  });
  overlay.querySelector(".flag-confirm-yes")?.addEventListener("click", () => {
    // Keep mailto inside this click so Chromium retains user activation.
    submitFlagPart(part);
    dismissFlagConfirm(card);
  });
  overlay.querySelector(".flag-confirm-yes")?.focus();
}

function submitFlagPart(part) {
  const code = String(part?.code || "").trim();
  const title = String(part?.title || part?.name || code).trim();
  if (!code && !title) return;
  const payload = {
    code: code || title,
    title: title || code,
    description: title || code,
    pins: flagPinsLabel(),
  };
  overrides = flagPart(overrides, payload);
  persistOverrides();
  renderAdminPanel();
  // Mailto before runSearch so the Yes click's user activation is not lost
  // when the results list re-renders and tears down the card.
  openMailto(buildFlagIssueMailto(payload));
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

  getApp().innerHTML = `
    <div class="page">
      <header class="topbar">
        <button
          type="button"
          class="mtc-logo"
          id="home-logo"
          aria-label="MTC Gas home — clear search and model pin"
          title="Home"
        >
          <img
            class="mtc-logo-img"
            src="${mtcgasLogoUrl}"
            alt="MTCGAS Australia"
            width="204"
            height="100"
            decoding="async"
          />
        </button>
        <div class="brand-text">
          <h1 class="brand-name">
            <span class="brand-name-line">Rinnai Parts</span>
            <span class="brand-name-line brand-name-line--bible">Bible</span>
          </h1>
        </div>
        <div class="topbar-actions">
          <button
            type="button"
            class="cart-trigger process-trigger"
            id="process-open"
            aria-label="Open Rinnai process desk"
            title="Process"
          >
            <svg class="cart-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h10V5H7zm2 2h6v2H9V7zm0 4h6v2H9v-2zm0 4h4v2H9v-2z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="cart-trigger help-trigger"
            id="help-open"
            aria-label="Open help tips"
            title="Help"
          >
            <svg class="cart-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
              />
            </svg>
          </button>
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
          <p class="domestic-temp-warn" id="domestic-temp-warn" hidden role="alert">
            Commercial outlet temp (60°C+) — must not be installed on a domestic system.
          </p>

          <div class="pin-margin-row">
            <div class="field system-field">
              <span class="field-label" id="system-label">Pin 1 · Type of system</span>
              <div class="model-picker" id="system-picker">
                <div class="model-picker-row">
                  <input
                    id="system-input"
                    type="text"
                    role="combobox"
                    aria-labelledby="system-label"
                    aria-autocomplete="list"
                    aria-controls="system-listbox"
                    aria-expanded="false"
                    placeholder="Choose type of system first."
                    spellcheck="false"
                    autocomplete="off"
                  />
                  <button
                    type="button"
                    class="model-clear"
                    id="system-clear"
                    aria-label="Clear type of system pin"
                    hidden
                  >
                    ×
                  </button>
                </div>
                <input type="hidden" id="system-pin" name="system" value="" />
                <ul
                  class="model-listbox"
                  id="system-listbox"
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

          <div class="pin2-ticker-row">
            <div class="field series-field">
              <span class="field-label" id="series-label">Pin 2 · Series</span>
              <div class="model-picker" id="series-picker">
                <div class="model-picker-row">
                  <input
                    id="series-input"
                    type="text"
                    role="combobox"
                    aria-labelledby="series-label"
                    aria-autocomplete="list"
                    aria-controls="series-listbox"
                    aria-expanded="false"
                    placeholder="Choose the type of system above first"
                    spellcheck="false"
                    autocomplete="off"
                    disabled
                  />
                  <button
                    type="button"
                    class="model-clear"
                    id="series-clear"
                    aria-label="Clear series pin"
                    hidden
                  >
                    ×
                  </button>
                </div>
                <input type="hidden" id="series-pin" name="series" value="" />
                <ul
                  class="model-listbox"
                  id="series-listbox"
                  role="listbox"
                  hidden
                ></ul>
              </div>
            </div>

            <aside
              class="news-ticker"
              id="news-ticker"
              aria-label="Brisbane news, weather, and traffic"
            >
              <span class="news-ticker-label">Brisbane News / Weather / Traffic</span>
              <div class="news-ticker-viewport">
                <div class="news-ticker-track" role="list"></div>
              </div>
            </aside>
          </div>

          <div class="pin3-search-visuals-row pin2-search-visuals-row">
            <div class="pin3-search-col pin2-search-col">
              <div class="field item-field">
                <span class="field-label" id="item-label">Pin 3 · Item Number</span>
                <div class="model-picker" id="item-picker">
                  <div class="model-picker-row">
                    <input
                      id="item-input"
                      type="text"
                      role="combobox"
                      aria-labelledby="item-label"
                      aria-autocomplete="list"
                      aria-controls="item-listbox"
                      aria-expanded="false"
                      placeholder="Choose the series above first"
                      spellcheck="false"
                      autocomplete="off"
                      disabled
                    />
                    <button
                      type="button"
                      class="model-clear"
                      id="item-clear"
                      aria-label="Clear Item Number pin"
                      hidden
                    >
                      ×
                    </button>
                  </div>
                  <input type="hidden" id="item-pin" name="item" value="" />
                  <ul
                    class="model-listbox"
                    id="item-listbox"
                    role="listbox"
                    hidden
                  ></ul>
                </div>
              </div>

              <label class="field query-field" for="query-input">
                <span class="field-label">Search</span>
                <div class="query-row">
                  <input
                    id="query-input"
                    name="q"
                    type="search"
                    placeholder="Choose type of system (Pin 1) first"
                    spellcheck="false"
                    disabled
                    aria-describedby="search-lock-hint"
                  />
                  <button type="submit" class="search-btn" disabled>Search</button>
                </div>
                <p class="search-lock-hint" id="search-lock-hint">
                  Set Pin 1 first — search unlocks after you pick a type (or Everything).
                </p>
              </label>
            </div>

            <div class="search-visuals-slot" aria-hidden="false">
              <div class="search-visuals" id="search-visuals">
                <div class="search-visual search-visual--series" id="series-visual">
                  <span class="search-visual-click-hint" id="series-click-hint" hidden>click me</span>
                  <button
                    type="button"
                    class="series-thumb-btn"
                    id="series-thumb-btn"
                    hidden
                    aria-label="Series unit photo"
                  >
                    <img
                      id="series-visual-img"
                      alt=""
                      decoding="async"
                    />
                  </button>
                  <p class="search-visual-placeholder" id="series-visual-ph">
                    Pin a series
                  </p>
                </div>
                <div class="search-visual search-visual--diagram" id="diagram-visual">
                  <span class="search-visual-click-hint" id="diagram-click-hint" hidden>click me</span>
                  <button
                    type="button"
                    class="diagram-thumb-btn"
                    id="diagram-thumb-btn"
                    hidden
                    aria-label="Open document full size"
                  >
                    <img
                      id="diagram-visual-img"
                      alt=""
                      decoding="async"
                    />
                  </button>
                  <p class="search-visual-placeholder" id="diagram-visual-ph">
                    Pin a series
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="dataplate-zone" id="dataplate-zone">
            <span class="dataplate-zone-title" id="dataplate-label"
              >Optionally, you can try searching model by OCR:</span
            >
            <div
              class="dataplate-drop"
              id="dataplate-drop"
              role="button"
              tabindex="0"
              aria-labelledby="dataplate-label"
              aria-describedby="dataplate-drop-hint"
            >
              <input
                type="file"
                id="dataplate-file"
                accept="image/*"
                capture="environment"
                hidden
              />
              <img id="dataplate-preview" class="dataplate-preview" alt="" hidden />
              <p class="dataplate-drop-hint" id="dataplate-drop-hint">
                Drop a dataplate photo from the portal here, or take a photo of a dataplate.
              </p>
            </div>
            <p class="dataplate-status" id="dataplate-status" hidden></p>
            <div class="dataplate-chips" id="dataplate-chips" hidden>
              <div class="dataplate-chip-group">
                <span class="dataplate-chip-heading">Pin 1 · Type of system</span>
                <div class="dataplate-chip-row" id="dataplate-system-chips"></div>
              </div>
              <div class="dataplate-chip-group">
                <span class="dataplate-chip-heading">Pin 2 · Series</span>
                <div class="dataplate-chip-row" id="dataplate-series-chips"></div>
              </div>
              <div class="dataplate-chip-group">
                <span class="dataplate-chip-heading">Pin 3 · Item Number</span>
                <div class="dataplate-chip-row" id="dataplate-item-chips"></div>
              </div>
              <div class="dataplate-chip-actions">
                <button type="button" class="dataplate-confirm" id="dataplate-confirm" disabled>
                  Confirm pins
                </button>
                <button type="button" class="dataplate-clear" id="dataplate-clear">
                  Clear dataplate
                </button>
              </div>
            </div>
          </div>
        </form>

        <dialog class="diagram-lightbox" id="diagram-lightbox" aria-label="Document page">
          <div class="diagram-lightbox-inner">
            <button type="button" class="diagram-lightbox-close" id="diagram-lightbox-close" aria-label="Close">×</button>
            <div class="diagram-lightbox-toolbar" id="diagram-lightbox-toolbar">
              <div class="diagram-lightbox-nav" id="diagram-lightbox-nav" hidden>
                <button type="button" class="diagram-lightbox-nav-btn" id="diagram-lightbox-prev" aria-label="Previous page">‹ Prev</button>
                <span class="diagram-lightbox-page" id="diagram-lightbox-page" aria-live="polite"></span>
                <button type="button" class="diagram-lightbox-nav-btn" id="diagram-lightbox-next" aria-label="Next page">Next ›</button>
              </div>
              <button type="button" class="diagram-lightbox-download" id="diagram-lightbox-download" hidden>Download PDF</button>
            </div>
            <div class="diagram-lightbox-stage" id="diagram-lightbox-stage">
              <div class="diagram-lightbox-frame" id="diagram-lightbox-frame">
                <img id="diagram-lightbox-img" alt="Document page" decoding="async" />
                <div class="diagram-callout-highlight" id="diagram-callout-highlight" hidden></div>
              </div>
            </div>
            <p class="diagram-lightbox-caption" id="diagram-lightbox-caption"></p>
          </div>
        </dialog>

        <p class="pin-warn" id="pin-warn" hidden>
          No series or Item Number pinned — results are unranked for a specific unit. Pin type of system, series, then the full Item Number, for a Primary part code.
        </p>
        <p class="pin-warn pin-warn--item" id="item-pin-warn" hidden>
          Series only — pin the full Item Number (Pin 3) for chassis-scoped Primary ranking. Concept searches like HEX can mix chassis across a series.
        </p>

        <p class="hint" id="hint">
          Tip: pin series + Item Number, then try
          <button type="button" class="chip" data-q="flow servo">flow servo</button>
          <button type="button" class="chip" data-q="thermocouple">thermocouple</button>
          <button type="button" class="chip" data-q="pcb">pcb</button>
          <button type="button" class="chip" data-q="hex">hex</button>
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
            <label class="cart-job-field" for="cart-job">
              <span class="cart-job-label">Job / WO for stores email</span>
              <input
                id="cart-job"
                class="cart-job-input"
                type="text"
                inputmode="text"
                autocomplete="off"
                placeholder="e.g. 12345 or WO-12345"
              />
            </label>
            <div class="cart-actions">
              <button type="button" class="cart-action cart-action--primary" id="cart-email">Email list to stores</button>
              <button type="button" class="cart-action" id="cart-copy">Copy to clipboard</button>
              <button type="button" class="cart-action" id="cart-save">Save quote list</button>
              <button type="button" class="cart-action cart-action--danger" id="cart-clear">Clear quote list</button>
            </div>
          </footer>
        </div>
      </dialog>

      <dialog class="cart-dialog process-dialog" id="process-dialog" aria-labelledby="process-dialog-title">
        <div class="process-dialog-inner">
          <header class="cart-dialog-bar">
            <div>
              <p class="cart-dialog-kicker" id="process-dialog-kicker">${escapeHtml(processDoc?.kicker || "Zone Contractor")}</p>
              <h2 class="cart-dialog-title" id="process-dialog-title">${escapeHtml(processDoc?.title || "Rinnai Process")}</h2>
            </div>
            <div class="process-dialog-actions">
              <button type="button" class="cart-action" id="process-change-level" hidden>Change instruction level</button>
              <button type="button" class="cart-dialog-close" id="process-close" aria-label="Close process desk">Close</button>
            </div>
          </header>
          <p class="process-source muted" id="process-source">${escapeHtml(processDoc?.sourceNote || "")}</p>
          <div class="process-layout" id="process-layout">
            <nav class="process-rail" id="process-rail" aria-label="Process topics"></nav>
            <div class="process-body" id="process-body"></div>
          </div>
        </div>
      </dialog>

      <dialog class="cart-dialog process-example-dialog" id="process-example-dialog" aria-labelledby="process-example-title">
        <div class="process-example-dialog-inner">
          <header class="cart-dialog-bar">
            <div>
              <p class="cart-dialog-kicker">Warranty checker</p>
              <h2 class="cart-dialog-title" id="process-example-title">Product family examples</h2>
            </div>
            <button type="button" class="cart-dialog-close" id="process-example-close" aria-label="Close examples">Close</button>
          </header>
          <div class="process-example-toolbar">
            <button type="button" class="cart-action" id="process-example-prev" aria-label="Previous example">‹ Prev</button>
            <span class="process-example-page muted" id="process-example-page" aria-live="polite"></span>
            <button type="button" class="cart-action" id="process-example-next" aria-label="Next example">Next ›</button>
          </div>
          <div class="process-example-stage" id="process-example-stage"></div>
        </div>
      </dialog>

      <dialog class="cart-dialog help-dialog" id="help-dialog" aria-labelledby="help-dialog-title">
        <div class="help-dialog-inner">
          <header class="cart-dialog-bar">
            <div>
              <p class="cart-dialog-kicker">Tips</p>
              <h2 class="cart-dialog-title" id="help-dialog-title">Quick help</h2>
            </div>
            <button type="button" class="cart-dialog-close" id="help-close" aria-label="Close help">Close</button>
          </header>
          <div class="help-body">
            <article class="help-tip">
              <h3 class="help-tip-title">1. Pin first</h3>
              <p class="help-tip-copy">
                You need to pin (type → series → Item Number). You can type what you need in each box too.
              </p>
              <img class="help-tip-img" src="${tipPinModelUrl}" alt="Type, series, and Item Number pin fields" width="560" height="220" decoding="async" />
            </article>
            <article class="help-tip">
              <h3 class="help-tip-title">2. Set margin</h3>
              <p class="help-tip-copy">Use Margin % for your sell markup. Default is ${DEFAULT_MARGIN_PERCENT}%.</p>
              <img class="help-tip-img" src="${tipMarginUrl}" alt="Margin percent dropdown" width="420" height="180" decoding="async" />
            </article>
            <article class="help-tip">
              <h3 class="help-tip-title">3. Search</h3>
              <p class="help-tip-copy">
                Locked until Pin 1. Part code or trade words work (brkt / bracket both match).
                <strong>Everything</strong> = whole catalogue.
              </p>
              <img class="help-tip-img" src="${tipSearchUrl}" alt="Search box with matched alias chip" width="560" height="210" decoding="async" />
            </article>
            <article class="help-tip">
              <h3 class="help-tip-title">4. Back to main page</h3>
              <p class="help-tip-copy">Click the MTC logo to clear search and all pins.</p>
              <img class="help-tip-img" src="${tipHomeLogoUrl}" alt="MTC logo home button" width="480" height="180" decoding="async" />
            </article>
            <article class="help-tip">
              <h3 class="help-tip-title">5. Quote button</h3>
              <p class="help-tip-copy">Add to Quote builds a list. The cart icon opens it so you can email or copy.</p>
              <img class="help-tip-img" src="${tipQuoteUrl}" alt="Quote cart icon and Add to Quote button" width="520" height="200" decoding="async" />
            </article>
          </div>
        </div>
      </dialog>

      <dialog class="cart-dialog help-dialog feedback-dialog" id="feedback-dialog" aria-labelledby="feedback-dialog-title">
        <div class="help-dialog-inner">
          <header class="cart-dialog-bar">
            <div>
              <p class="cart-dialog-kicker">Feedback</p>
              <h2 class="cart-dialog-title" id="feedback-dialog-title">Questions · comments · suggestions</h2>
            </div>
            <button type="button" class="cart-dialog-close" id="feedback-close" aria-label="Close feedback">Close</button>
          </header>
          <form class="feedback-form" id="feedback-form">
            <p class="feedback-lead">
              How can we improve this tool for you? Drop a note for Beau — it stays on this device (and you can email or export it).
            </p>
            <p class="cart-flash" id="feedback-flash" hidden></p>
            <label class="cart-job-field" for="feedback-name">
              <span class="cart-job-label">Your name</span>
              <input
                id="feedback-name"
                class="cart-job-input"
                type="text"
                name="name"
                autocomplete="name"
                required
                maxlength="120"
                placeholder="e.g. Sam from stores"
              />
            </label>
            <label class="cart-job-field" for="feedback-comment">
              <span class="cart-job-label">Comment</span>
              <textarea
                id="feedback-comment"
                class="cart-job-input feedback-comment"
                name="comment"
                required
                maxlength="4000"
                rows="5"
                placeholder="What would make this easier day-to-day?"
              ></textarea>
            </label>
            <div class="cart-actions feedback-actions">
              <button type="submit" class="cart-action cart-action--primary" id="feedback-save">Save feedback</button>
              <button type="button" class="cart-action" id="feedback-email">Save &amp; email Beau</button>
              <button type="button" class="cart-action" id="feedback-export">Export JSON</button>
            </div>
          </form>
        </div>
      </dialog>

      <div
        class="ops-panels"
        id="ops-panels"
        tabindex="0"
        aria-describedby="ops-panels-hint"
      >
        <div class="ops-panels-veil" aria-hidden="true">
          <div class="ops-panels-photo-frame">
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
                Hover or focus to show behind.
              </p>
            </div>
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
                  <dt>Part-name abbreviations</dt>
                  <dd><code>public/data/part-name-abbreviations.json</code></dd>
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
                <li>Series / trade / part-name abbreviation aliases are hand-maintained JSON — not overwritten by ingest.</li>
                <li>Data-sheet PDFs remain under <code>data-sheets/</code>; the sheet list is hidden from the main search UI (index code kept for later admin use).</li>
              </ol>
            </div>
          </section>
        </div>
      </div>

      <div class="feedback-blurb">
        <button
          type="button"
          class="feedback-like"
          id="feedback-open"
          aria-haspopup="dialog"
          aria-controls="feedback-dialog"
          title="Questions, comments, suggestions"
        >
          <span class="feedback-like-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
              <path
                fill="currentColor"
                d="M2 21h4V9H2v12zm19.07-9.62c.28-.45.43-.97.43-1.51 0-1.52-1.23-2.75-2.75-2.75H13.4l.79-3.78.03-.32c0-.41-.17-.79-.44-1.06L12.87 1 6.93 6.94C6.54 7.33 6.3 7.87 6.3 8.45V18c0 1.1.9 2 2 2h8.35c.83 0 1.55-.5 1.86-1.22l3.12-7.29c.16-.37.24-.77.24-1.17 0-.22-.03-.43-.08-.64l.28.2z"
              />
            </svg>
          </span>
          <span class="feedback-like-copy">Like if you found this useful</span>
        </button>
      </div>

      <footer class="footer">
        <span>
          All pricing data current, Parts tool made by
          <a class="footer-author" href="mailto:beau.dougall@mtcgas.com.au">Beau Dougall</a>
          for MTC Gas Australia PTY LTD. Version two coming soon! Expanding to plumbers, exploded diagrams, and more.
        </span>
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

function seriesIdFromPinValue(value) {
  const v = String(value || "");
  if (v.startsWith("series:")) return v.slice("series:".length);
  return null;
}

function currentSystemTypeValue() {
  return (
    systemPicker?.getValue?.() ||
    document.querySelector("#system-pin")?.value ||
    null
  );
}

/** Pin 1 must be set before any free / catalogue search. */
function hasSystemTypePin() {
  return Boolean(systemTypeFromValue(currentSystemTypeValue()));
}

/**
 * Disable search + tip chips until Pin 1 is set.
 * Everything unlocks whole-catalogue search; other types unlock as today.
 */
function syncSearchLock() {
  const locked = !hasSystemTypePin();
  const everything = isEverythingSystem(currentSystemTypeValue());
  const input = document.querySelector("#query-input");
  const btn = document.querySelector(".search-btn");
  const hint = document.querySelector("#search-lock-hint");

  if (input) {
    input.disabled = locked;
    input.placeholder = locked
      ? "Choose type of system (Pin 1) first"
      : everything
        ? "Search every part — trade term, code, or description…"
        : "Trade term, part code, or description…";
  }
  if (btn) btn.disabled = locked;
  if (hint) hint.hidden = !locked;
  document.querySelectorAll("#hint .chip").forEach((chip) => {
    chip.disabled = locked;
  });
}

function mountModelPicker() {
  const systemRoot = document.querySelector("#system-picker");
  const seriesRoot = document.querySelector("#series-picker");
  const itemRoot = document.querySelector("#item-picker");
  systemPicker = null;
  seriesPicker = null;
  itemPicker = null;

  if (systemRoot) {
    systemPicker = bindModelPicker(systemRoot, {
      catalogue,
      seriesDoc,
      mode: "system",
      onChange: () => {
        const systemVal = currentSystemTypeValue();
        if (isEverythingSystem(systemVal)) {
          // Everything overrides Pins 2–3 — clear them and search by term only.
          seriesPicker?.clear?.();
          itemPicker?.clear?.();
        } else if (!systemVal) {
          seriesPicker?.clear?.();
          itemPicker?.clear?.();
        }
        seriesPicker?.refreshEnabled?.();
        itemPicker?.refreshEnabled?.();
        updateDomesticTempWarn();
        syncSearchLock();
        runSearch();
      },
      isPinUnlocked: (pinValue) => unlockedPins.has(pinValue),
      requestUnlock,
    });
  }

  if (seriesRoot) {
    seriesPicker = bindModelPicker(seriesRoot, {
      catalogue,
      seriesDoc,
      mode: "series",
      getSystemTypeId: () => currentSystemTypeValue(),
      onChange: () => {
        // Changing / clearing series drops Item Number pin (filtered set changes).
        const seriesVal = seriesPicker?.getValue?.() || null;
        const itemVal = itemPicker?.getValue?.() || null;
        if (!seriesVal && itemVal) {
          itemPicker?.clear?.();
        } else if (seriesVal && itemVal) {
          const pin = resolveModelPin(catalogue, seriesDoc, itemVal);
          const sid = seriesIdFromPinValue(seriesVal);
          if (pin.series?.id && sid && pin.series.id !== sid) {
            itemPicker?.clear?.();
          }
        }
        itemPicker?.refreshEnabled?.();
        updateDomesticTempWarn();
        runSearch();
      },
      isPinUnlocked: (pinValue) => unlockedPins.has(pinValue),
      requestUnlock,
    });
  }

  if (itemRoot) {
    itemPicker = bindModelPicker(itemRoot, {
      catalogue,
      seriesDoc,
      mode: "item",
      getSystemTypeId: () => currentSystemTypeValue(),
      getSeriesId: () =>
        seriesIdFromPinValue(
          seriesPicker?.getValue?.() ||
            document.querySelector("#series-pin")?.value
        ),
      onChange: () => {
        updateDomesticTempWarn();
        runSearch();
      },
      isPinUnlocked: (pinValue) => unlockedPins.has(pinValue),
      requestUnlock,
    });
  }

  updateDomesticTempWarn();
  mountDataplateUi();
}

function mountDataplateUi() {
  dataplatePin = mountDataplatePin({
    getCatalogue: () => catalogue,
    getSeriesDoc: () => seriesDoc,
    systemPicker,
    seriesPicker,
    itemPicker,
    isPinUnlocked: (pinValue) => unlockedPins.has(pinValue),
    requestUnlock,
    onPinned: () => {
      // Pin 1 comes from the dataplate system chip — never silent CF.
      seriesPicker?.refreshEnabled?.();
      itemPicker?.refreshEnabled?.();
      updateDomesticTempWarn();
      syncSearchLock();
      runSearch();
    },
  });
}

function currentPin() {
  // Everything override: ignore series/item — free catalogue search by term only.
  if (isEverythingSystem(currentSystemTypeValue())) {
    return resolveModelPin(catalogue, seriesDoc, null);
  }
  const itemValue =
    itemPicker?.getValue?.() ||
    document.querySelector("#item-pin")?.value ||
    null;
  if (itemValue) {
    return resolveModelPin(catalogue, seriesDoc, itemValue);
  }
  const seriesValue =
    seriesPicker?.getValue?.() ||
    document.querySelector("#series-pin")?.value ||
    null;
  return resolveModelPin(catalogue, seriesDoc, seriesValue);
}

/**
 * Flashing 60°+ commercial / not-for-domestic warning above the pin area.
 */
function updateDomesticTempWarn() {
  const el = document.querySelector("#domestic-temp-warn");
  if (!el) return;
  const pin = currentPin();
  const temp =
    pin.kind === "model" ? outletTempFromModel(pin.model) : null;
  const show = isCommercialOutletTemp(temp);
  el.hidden = !show;
  if (show) {
    el.textContent = `Commercial outlet temp (${temp}°C) — must not be installed on a domestic system.`;
  }
}

/**
 * Right-panel doc visual: SM (Pin2) or ED (Pin3 + search hit).
 * PL part-number highlight lives on lightbox (listPageKey + listBox).
 * @type {{
 *   kind: 'sm'|'ed',
 *   url: string,
 *   label: string,
 *   callout?: string|null,
 *   pageKey?: string|null,
 *   calloutPageKey?: string|null,
 *   listPageKey?: string|null,
 *   listBox?: { x: number, y: number, w: number, h: number }|null,
 *   highlight?: { x: number, y: number, w: number, h: number }|null,
 *   pages?: { page: number, url: string, pageKey: string }[],
 *   pageIndex?: number,
 *   pdfFileName?: string|null
 * }|null}
 */
let activeDiagram = null;

/** @type {{ pages: { page: number, url: string, pageKey: string }[], pageIndex: number, kind: 'sm'|'ed', label: string, callout?: string|null, calloutPageKey?: string|null, listPageKey?: string|null, listBox?: object|null, calloutBox?: object|null, pdfFileName?: string|null }|null} */
let lightboxState = null;

/**
 * Under-Margin dual panel: series promo (left) + SM/ED (right).
 * No pins → idle art (Rinnai logo left, bundled loop GIF right).
 * Pin2 series → unit shot + service manual cover. Pin3 + part hit → ED (SM if no ED).
 * Sized by Pin3+Search height — does not grow the search card.
 */
function updateSearchVisuals(query, pin) {
  const activePin = pin || currentPin();
  const seriesId =
    activePin?.series?.id ||
    seriesIdFromPinValue(
      seriesPicker?.getValue?.() ||
        document.querySelector("#series-pin")?.value
    );
  const seriesUrl = seriesUnitShotUrl(seriesId);
  // Keep Rinnai + Carlton idle art until real content exists. Clearing idle on
  // Pin2 alone (3-pin) left empty broken frames for series without unit shots
  // / SM (Demand Duo accessories, Hotflo, etc.).
  const seriesImg = document.querySelector("#series-visual-img");
  const seriesPh = document.querySelector("#series-visual-ph");
  const seriesThumb = document.querySelector("#series-thumb-btn");
  const seriesHint = document.querySelector("#series-click-hint");
  const seriesFrame = document.querySelector("#series-visual");
  // Left unit shot is display-only for now. Green “click me” only when this
  // frame itself opens something. SM/ED live on the right frame — do not
  // advertise the unit photo as clickable just because an SM exists.
  const seriesClickable = false;
  const showSeriesIdle = !seriesUrl;
  if (seriesImg && seriesPh && seriesThumb) {
    if (showSeriesIdle) {
      seriesImg.src = rinnaiLogoUrl;
      seriesImg.alt = "Rinnai";
      seriesThumb.hidden = false;
      seriesThumb.disabled = true;
      seriesThumb.setAttribute("aria-label", "Rinnai logo");
      seriesPh.hidden = true;
    } else {
      seriesImg.src = seriesUrl;
      seriesImg.alt = activePin?.series
        ? `${activePin.series.label || seriesId} unit`
        : "Pinned series unit";
      seriesThumb.hidden = false;
      seriesThumb.disabled = !seriesClickable;
      seriesThumb.setAttribute(
        "aria-label",
        seriesClickable
          ? "Open series unit photo full size"
          : "Series unit photo"
      );
      seriesPh.hidden = true;
    }
  }
  if (seriesFrame) {
    seriesFrame.classList.toggle("is-clickable", seriesClickable);
    seriesFrame.classList.toggle("is-empty-art", showSeriesIdle);
  }
  if (seriesHint) seriesHint.hidden = !seriesClickable;

  const hasQuery = Boolean(String(query || "").trim());
  const hasPin3 = activePin?.kind === "model";
  const primary =
    hasQuery && lastResults?.length
      ? lastResults.find((r) => r.isPrimary) || lastResults[0]
      : null;

  /** @type {typeof activeDiagram} */
  let panel = null;
  if (seriesId && hasPin3 && primary) {
    const ed = resolvePartDiagram(primary.part, assemblyIndex, {
      pin: activePin,
    });
    if (ed?.url) {
      const pageKey = ed.pageKey || ed.label || null;
      const calloutHighlight = resolveCalloutBox(
        ed.calloutPageKey || pageKey,
        ed.callout
      );
      panel = {
        kind: "ed",
        url: ed.url,
        label: ed.label,
        callout: ed.callout,
        pageKey,
        calloutPageKey: ed.calloutPageKey || pageKey,
        listPageKey: ed.listPageKey || null,
        listBox: ed.listBox || null,
        // Panel thumb stays on ED; lightbox may open on PL with listBox.
        highlight: calloutHighlight,
        pages: ed.pages || [{ page: 1, url: ed.url, pageKey: pageKey || "ed" }],
        pageIndex: ed.pageIndex ?? 0,
        pdfFileName: ed.pdfFileName || null,
      };
    } else {
      const sm = resolveSeriesServiceManual(seriesId);
      if (sm) {
        panel = {
          ...sm,
          callout: null,
          calloutPageKey: null,
          highlight: null,
        };
      }
    }
  } else if (seriesId) {
    const sm = resolveSeriesServiceManual(seriesId);
    if (sm) {
      panel = {
        ...sm,
        callout: null,
        calloutPageKey: null,
        highlight: null,
      };
    }
  }
  activeDiagram = panel;

  const thumbBtn = document.querySelector("#diagram-thumb-btn");
  const diagramImg = document.querySelector("#diagram-visual-img");
  const diagramPh = document.querySelector("#diagram-visual-ph");
  const diagramHint = document.querySelector("#diagram-click-hint");
  const diagramFrame = document.querySelector("#diagram-visual");
  const diagramClickable = Boolean(panel?.url);
  const showDiagramIdle = !panel?.url;
  if (thumbBtn && diagramImg && diagramPh) {
    if (showDiagramIdle) {
      diagramImg.src = emptyFrameLoopUrl;
      diagramImg.alt = "";
      // Stealth hotlink only — no green click-me, border flash, or cursor change.
      thumbBtn.hidden = false;
      thumbBtn.disabled = false;
      thumbBtn.dataset.stealthYoutube = "1";
      thumbBtn.setAttribute("aria-label", "Decorative animation");
      diagramPh.hidden = true;
    } else {
      diagramImg.src = panel.url;
      thumbBtn.disabled = false;
      delete thumbBtn.dataset.stealthYoutube;
      if (panel.kind === "ed") {
        const calloutBit = panel.callout ? ` · item ${panel.callout}` : "";
        diagramImg.alt = `Exploded diagram${calloutBit}`;
        thumbBtn.setAttribute("aria-label", "Open exploded diagram full size");
      } else {
        diagramImg.alt = `Service manual — ${panel.label || seriesId}`;
        thumbBtn.setAttribute("aria-label", "Open service manual full size");
      }
      thumbBtn.hidden = false;
      diagramPh.hidden = true;
    }
  }
  if (diagramFrame) {
    diagramFrame.classList.toggle("is-clickable", diagramClickable);
    diagramFrame.classList.toggle("is-empty-art", showDiagramIdle);
  }
  if (diagramHint) diagramHint.hidden = !diagramClickable;
}

/** Reserved: open unit-shot lightbox from the left frame when that action ships. */
function openSeriesManualLightbox() {
  // Left frame is not clickable yet (SM/ED open from the right frame only).
}

function activeLightboxHighlight(state) {
  if (!state || state.kind !== "ed") return { box: null, kind: null };
  const curKey = state.pages?.[state.pageIndex]?.pageKey || null;
  if (!curKey) return { box: null, kind: null };
  if (state.listPageKey && state.listBox && curKey === state.listPageKey) {
    return { box: state.listBox, kind: "pl" };
  }
  if (
    state.calloutPageKey &&
    state.calloutBox &&
    curKey === state.calloutPageKey
  ) {
    return { box: state.calloutBox, kind: "ed" };
  }
  return { box: null, kind: null };
}

function syncCalloutHighlight() {
  const highlightEl = document.querySelector("#diagram-callout-highlight");
  const img = document.querySelector("#diagram-lightbox-img");
  const frame = document.querySelector("#diagram-lightbox-frame");
  if (!highlightEl || !img || !frame) return;
  const { box } = activeLightboxHighlight(lightboxState);
  if (!box || !img.naturalWidth) {
    highlightEl.hidden = true;
    return;
  }
  highlightEl.hidden = false;
  highlightEl.style.left = `${box.x * 100}%`;
  highlightEl.style.top = `${box.y * 100}%`;
  highlightEl.style.width = `${box.w * 100}%`;
  highlightEl.style.height = `${box.h * 100}%`;
}

function syncLightboxChrome() {
  const state = lightboxState;
  const nav = document.querySelector("#diagram-lightbox-nav");
  const pageEl = document.querySelector("#diagram-lightbox-page");
  const prevBtn = document.querySelector("#diagram-lightbox-prev");
  const nextBtn = document.querySelector("#diagram-lightbox-next");
  const downloadBtn = document.querySelector("#diagram-lightbox-download");
  const caption = document.querySelector("#diagram-lightbox-caption");
  const pages = state?.pages || [];
  const multi = pages.length > 1;
  if (nav) nav.hidden = !multi;
  if (pageEl && state && pages.length) {
    const cur = pages[state.pageIndex];
    pageEl.textContent = `Page ${cur?.page ?? state.pageIndex + 1} / ${pages[pages.length - 1]?.page ?? pages.length}`;
  } else if (pageEl) {
    pageEl.textContent = "";
  }
  if (prevBtn) prevBtn.disabled = !state || state.pageIndex <= 0;
  if (nextBtn) {
    nextBtn.disabled = !state || state.pageIndex >= pages.length - 1;
  }
  if (state && !LIGHTBOX_PDFS[state.pdfFileName]) {
    const inferred = resolveLightboxPdfFileName({
      pdfFileName: state.pdfFileName,
      pageKey: state.pages?.[state.pageIndex]?.pageKey,
      calloutPageKey: state.calloutPageKey,
      label: state.label,
      pages: state.pages,
      pageIndex: state.pageIndex,
    });
    if (inferred) state.pdfFileName = inferred;
  }
  const canDownload = Boolean(
    state?.pdfFileName && LIGHTBOX_PDFS[state.pdfFileName]
  );
  if (downloadBtn) {
    downloadBtn.hidden = !canDownload;
    downloadBtn.disabled = !canDownload;
  }
  if (caption && state) {
    const cur = pages[state.pageIndex];
    if (state.kind === "ed") {
      const { kind } = activeLightboxHighlight(state);
      const mark =
        kind === "pl"
          ? " · part number"
          : kind === "ed" && state.callout
            ? ` · callout ${state.callout}`
            : "";
      const kindLabel =
        kind === "pl" ? "Parts list" : state.label || "Exploded diagram";
      caption.textContent = `${kindLabel} · p${cur?.page ?? "?"}${mark}`;
    } else {
      caption.textContent = `Service manual — ${state.pdfFileName || state.label || ""} · p${cur?.page ?? "?"}`.trim();
    }
  }
}

function showLightboxPage(index) {
  if (!lightboxState?.pages?.length) return;
  const pages = lightboxState.pages;
  const next = Math.max(0, Math.min(pages.length - 1, index));
  lightboxState.pageIndex = next;
  const cur = pages[next];
  const img = document.querySelector("#diagram-lightbox-img");
  const highlightEl = document.querySelector("#diagram-callout-highlight");
  if (!img || !cur) return;
  if (highlightEl) highlightEl.hidden = true;
  img.onload = () => syncCalloutHighlight();
  img.src = cur.url;
  const { kind } = activeLightboxHighlight(lightboxState);
  img.alt =
    lightboxState.kind === "ed"
      ? kind === "pl"
        ? `Parts list page ${cur.page}`
        : `Exploded diagram page ${cur.page}`
      : `Service manual page ${cur.page}`;
  syncLightboxChrome();
  if (img.complete) syncCalloutHighlight();
}

function stepLightboxPage(delta) {
  if (!lightboxState?.pages?.length) return;
  showLightboxPage(lightboxState.pageIndex + delta);
}

function resolveLightboxPdfFileName(diagram) {
  if (!diagram) return null;
  const direct =
    diagram.pdfFileName || diagram.source || diagram.pdf || null;
  if (direct && LIGHTBOX_PDFS[direct]) return direct;
  const inferred = diagramPdfFileName(
    diagram.pageKey ||
      diagram.calloutPageKey ||
      diagram.label ||
      diagram.pages?.[diagram.pageIndex ?? 0]?.pageKey ||
      null
  );
  if (inferred && LIGHTBOX_PDFS[inferred]) return inferred;
  if (direct) return direct;
  return inferred || null;
}

function resolveLightboxPages(diagram) {
  if (!diagram?.url) return [];
  let pages =
    diagram.pages?.length > 0
      ? diagram.pages
      : [
          {
            page: 1,
            url: diagram.url,
            pageKey: diagram.pageKey || "doc",
          },
        ];
  // Expand sibling ED pages when only a single fallback page landed.
  if (pages.length <= 1) {
    const seed =
      diagram.pageKey ||
      diagram.calloutPageKey ||
      diagram.label ||
      pages[0]?.pageKey ||
      null;
    const siblings = diagramPageSiblings(seed);
    if (siblings.length > 1) pages = siblings;
  }
  return pages;
}

const EMPTY_FRAME_YOUTUBE_URL =
  "https://www.youtube.com/watch?v=WflKlxvwmYY";

function openDiagramLightbox() {
  if (!activeDiagram?.url) return;
  const dialog = document.querySelector("#diagram-lightbox");
  const img = document.querySelector("#diagram-lightbox-img");
  if (!dialog || !img) return;

  const pages = resolveLightboxPages(activeDiagram);
  const pdfFileName = resolveLightboxPdfFileName(activeDiagram);

  const listPageKey = activeDiagram.listPageKey || null;
  const listBox = activeDiagram.listBox || null;
  const listIdx =
    listPageKey && listBox
      ? pages.findIndex((p) => p.pageKey === listPageKey)
      : -1;
  const preferPl = listIdx >= 0;

  let pageIndex = activeDiagram.pageIndex ?? 0;
  if (preferPl) {
    pageIndex = listIdx;
  } else if (pages.length && activeDiagram.pageKey) {
    const hit = pages.findIndex((p) => p.pageKey === activeDiagram.pageKey);
    if (hit >= 0) pageIndex = hit;
  }

  const calloutPageKey =
    activeDiagram.calloutPageKey || activeDiagram.pageKey || null;

  lightboxState = {
    kind: activeDiagram.kind,
    label: activeDiagram.label,
    callout: activeDiagram.callout || null,
    calloutPageKey,
    calloutBox: activeDiagram.highlight || null,
    listPageKey,
    listBox,
    pages,
    pageIndex: Math.max(0, Math.min(pages.length - 1, pageIndex)),
    pdfFileName,
  };

  dialog.setAttribute(
    "aria-label",
    preferPl
      ? "Parts list"
      : activeDiagram.kind === "ed"
        ? "Exploded diagram"
        : "Service manual"
  );
  showLightboxPage(lightboxState.pageIndex);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDiagramLightbox() {
  const dialog = document.querySelector("#diagram-lightbox");
  const img = document.querySelector("#diagram-lightbox-img");
  const highlightEl = document.querySelector("#diagram-callout-highlight");
  const downloadBtn = document.querySelector("#diagram-lightbox-download");
  if (dialog && typeof dialog.close === "function") dialog.close();
  else if (dialog) dialog.removeAttribute("open");
  if (highlightEl) highlightEl.hidden = true;
  if (downloadBtn) {
    downloadBtn.hidden = true;
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download PDF";
  }
  lightboxState = null;
  if (img) {
    img.onload = null;
    img.removeAttribute("src");
    img.alt = "";
  }
}

async function onLightboxDownload() {
  const fileName = lightboxState?.pdfFileName;
  const btn = document.querySelector("#diagram-lightbox-download");
  if (!fileName || !LIGHTBOX_PDFS[fileName]) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Preparing…";
  }
  try {
    await downloadLightboxPdf(fileName);
  } catch (err) {
    console.error(err);
    if (btn) btn.textContent = "Download failed";
    setTimeout(() => {
      if (btn && lightboxState) {
        btn.textContent = "Download PDF";
        btn.disabled = false;
      }
    }, 1600);
    return;
  }
  if (btn && lightboxState) {
    btn.textContent = "Download PDF";
    btn.disabled = false;
  }
}

function onLightboxKeydown(e) {
  const dialog = document.querySelector("#diagram-lightbox");
  if (!dialog?.open && !dialog?.hasAttribute("open")) return;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    stepLightboxPage(-1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    stepLightboxPage(1);
  }
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
  // No Pin 1 → no free/everything-style catalogue search.
  if (!hasSystemTypePin()) {
    lastResults = [];
    const input = document.querySelector("#query-input");
    if (input && input.value) input.value = "";
    renderResults("", currentPin());
    updateSearchVisuals("", currentPin());
    return;
  }
  const q = document.querySelector("#query-input")?.value || "";
  const pin = currentPin();
  const modelId = pin.kind === "model" ? pin.model?.id : null;
  lastResults = searchParts(catalogue, q, modelId, {
    modelIds: pin.modelIds,
    pin,
    tradeAliases,
    abbrevIndex,
    assemblyIndex,
    assemblyHierarchy,
    partBlurbs,
    partSearchCache,
    isPartVisible: getIsPartVisible(),
  });
  renderResults(q, pin);
  updateSearchVisuals(q, pin);
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
  const itemPinWarn = document.querySelector("#item-pin-warn");
  const activePin = pin || currentPin();
  const hasPin = activePin.kind !== "none";
  const hasQuery = Boolean(String(query || "").trim());
  const seriesOnly = activePin.kind === "series";
  const assemblyConcept =
    hasQuery && assemblyIndex
      ? matchAssemblyConcept(assemblyIndex, query)
      : null;

  if (!list || !meta || !empty) return;
  list.innerHTML = "";

  if (pinWarn) {
    pinWarn.hidden = !(hasQuery && !hasPin);
  }
  if (itemPinWarn) {
    // Encourage Pin 3 when series-only; stronger copy for HEX / assembly concepts.
    // Accessory families (Demand Duo DDUPS/DDTSTAT/UVC) are not chassis — no Pin3 nudge.
    const accessorySeries = Boolean(activePin?.series?.accessoryFamily);
    itemPinWarn.hidden = !(hasQuery && seriesOnly && !accessorySeries);
    if (!itemPinWarn.hidden) {
      const conceptId = assemblyConcept?.concept?.id || null;
      const conceptName = conceptId
        ? String(conceptId).replace(/-/g, " ")
        : null;
      itemPinWarn.textContent = conceptName
        ? `Series only — pin the full Item Number (Pin 3) before strong Primary ranking for “${conceptName}”. HEX / assemblies can mix chassis across a series.`
        : "Series only — pin the full Item Number (Pin 3) to scope parts to that unit’s chassis (not the whole series).";
    }
  }

  if (!hasQuery && !hasPin) {
    meta.textContent = "";
    empty.hidden = true;
    updateSearchVisuals(query, activePin);
    return;
  }

  let pinBit = "";
  if (activePin.kind === "model" && activePin.model) {
    const item =
      String(activePin.model.itemNumber || "").trim() ||
      activePin.model.sku ||
      getModelLabel(activePin.model);
    const seriesBit = activePin.series
      ? ` · ${activePin.series.label}`
      : "";
    pinBit = ` · pinned ${item}${seriesBit}`;
  } else if (activePin.kind === "series" && activePin.series) {
    const keys = documentKeysForPin(activePin).slice(0, 3).join(" · ");
    pinBit = ` · pinned ${activePin.series.label} series (${keys}) · ${activePin.modelIds.length} models · Item Number not set`;
  }
  const primaries = lastResults.filter((r) => r.isPrimary);
  const duoPrimaries = primaries.filter((r) => r.isDuoAssembly);
  const primaryBit = duoPrimaries.length >= 2
    ? ` · Primary duo ${duoPrimaries
        .map((r) => `${r.duoLabel || ""} ${r.part.code}`.trim())
        .join(" + ")}`
    : hasPin && primaries[0]
      ? ` · Primary ${primaries[0].part.code}`
      : hasPin
        ? " · no exact Primary for this pin"
        : primaries[0]
          ? ` · Primary ${primaries[0].part.code}`
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
      isSubComponent,
      subOf,
      isDuoAssembly,
      duoLabel,
      duoPartnerCode,
      duoNeedBothNote,
      duoRole,
    } = row;
    const notPurchasable = isNotPurchasableCode(part.code);
    const display = expandDisplayTitle(part.name || "", abbrevIndex);
    const displayTitle = display.title || part.name || part.code || "";
    const showOfficialName =
      Boolean(part.name) &&
      display.expanded &&
      String(display.title || "").toLowerCase() !==
        String(part.name || "").toLowerCase();
    const summaryLine = plainEnglishSummary(
      part,
      assemblyIndex,
      abbrevIndex,
      partBlurbs
    );
    const li = document.createElement("li");
    li.className = "result";
    if (isPrimary && isDuoAssembly) {
      li.classList.add("result--primary", "result--duo");
      if (duoRole === "top") li.classList.add("result--duo-top");
      if (duoRole === "bottom") li.classList.add("result--duo-bottom");
    } else if (isPrimary) {
      li.classList.add("result--primary");
    } else if (isSubComponent) {
      li.classList.add("result--subcomponent");
    } else if (hasPin && fitTier === "exact") {
      li.classList.add("result--fits");
    } else if (hasPin && fitTier === "related") {
      li.classList.add("result--related");
    } else if (hasPin && fitsSelectedModel === false) {
      li.classList.add("result--other-model");
    }
    if (notPurchasable) li.classList.add("result--not-available");
    if (part.adminFlagged) li.classList.add("result--flagged");

    const fitChips = [];
    if (fittedModels.length) {
      for (const m of fittedModels) {
        const active = hasPin && activePin.modelIds.includes(m.id);
        const cls = active ? "model-tag model-tag--active" : "model-tag";
        fitChips.push(
          `<span class="${cls}">${escapeHtml(m.sku || m.name)}</span>`
        );
      }
    } else if (hasPin && fitReason) {
      fitChips.push(
        `<span class="model-tag model-tag--fit">${escapeHtml(fitReason)}</span>`
      );
    }

    const duoBadge = isDuoAssembly
      ? `<span class="badge badge--duo">${escapeHtml(
          duoLabel || (duoRole === "top" ? "TOP" : "BTM")
        )}</span>`
      : "";

    const fitBadge = isDuoAssembly
      ? `<span class="badge badge--primary">Primary pair</span>`
      : !hasPin
        ? isPrimary
          ? `<span class="badge badge--primary">Primary</span>`
          : ""
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

    const notAvailableBadge = notPurchasable
      ? `<span class="badge badge--not-available" aria-label="Not available for purchase">Not available</span>`
      : "";

    const subOfParents = subOf?.parents?.length
      ? subOf.parents
      : subOf
        ? [{ code: subOf.code, shortName: subOf.shortName, name: subOf.name }]
        : [];
    const subOfKicker =
      isSubComponent && subOfParents.length
        ? `<p class="subcomponent-note subcomponent-note--blink">sub-component of ${escapeHtml(
            subOfParents
              .map((p) => `${p.code} ${p.shortName || p.name || ""}`.trim())
              .join(" / ")
          )}</p>`
        : isSubComponent
          ? `<p class="subcomponent-note subcomponent-note--blink">sub-component</p>`
          : "";

    const subBadge = isSubComponent
      ? `<span class="badge badge--sub">Sub-component</span>`
      : "";

    const matchBits = matchedOn
      .map((m) => `<span class="match-tag">${escapeHtml(m)}</span>`)
      .join("");

    const categoryBit = part.category
      ? `<span class="category-tag">${escapeHtml(part.category)}</span>`
      : "";

    const addQuoteBtn =
      part.kind === "discount-segment"
        ? ""
        : `<div class="result-card-actions">
            <button
              type="button"
              class="add-quote-btn"
              data-code="${escapeHtml(part.code)}"
              ${notPurchasable ? "disabled aria-disabled=\"true\"" : ""}
            >${notPurchasable ? "Not available" : "Add to Quote"}</button>
          </div>`;

    const flagBtn =
      part.kind === "discount-segment"
        ? ""
        : `<button
              type="button"
              class="flag-part-btn"
              data-code="${escapeHtml(part.code)}"
              data-title="${escapeHtml(part.name || part.code)}"
            >Flag item for problem</button>`;

    li.innerHTML = `
      <div class="result-head">
        <div class="result-head-main">
          ${
            isPrimary && isDuoAssembly
              ? `<p class="primary-kicker primary-kicker--duo">${escapeHtml(
                  duoNeedBothNote ||
                    "Check if both TOP and BTM are required; if not, order the singular one"
                )} · this card is ${escapeHtml(
                  duoLabel || (duoRole === "top" ? "TOP" : "BTM")
                )}${
                  duoPartnerCode
                    ? ` · partner ${escapeHtml(duoPartnerCode)}`
                    : ""
                }</p>`
              : isPrimary
                ? `<p class="primary-kicker">The part you are searching for is:</p>`
                : subOfKicker
          }
          <div class="result-identity">
            <span class="result-field-label">Rinnai part code</span>
            <span class="result-field-colon" aria-hidden="true">:</span>
            <span class="result-field-value result-code">${highlight(part.code, query)}</span>
            <span class="result-field-label">Rinnai description</span>
            <span class="result-field-colon" aria-hidden="true">:</span>
            <span class="result-field-value result-name">${highlight(displayTitle, query)}</span>
          </div>
          ${
            showOfficialName
              ? `<p class="result-official" title="Official price-list wording">${highlight(
                  part.name,
                  query
                )}</p>`
              : ""
          }
          <div class="result-tags">${categoryBit}${fitChips.join("")}</div>
        </div>
        <div class="result-head-actions">
          <div class="result-flags">${duoBadge}${subBadge}${fitBadge}${notAvailableBadge}${flagBadge}</div>
          ${addQuoteBtn}
        </div>
      </div>
      <div class="result-body">
        ${renderPriceBlock(part)}
        <div class="result-block result-block--summary">
          <p class="result-summary">${escapeHtml(summaryLine)}</p>
        </div>
      </div>
      <div class="result-foot">
        <div class="match-row">Matched on ${matchBits || '<span class="muted">—</span>'}</div>
        <div class="result-foot-actions">
          <span class="diagram-ref muted">Sheet: ${escapeHtml(part.sheet || "—")}</span>
          ${flagBtn}
        </div>
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
      const card = btn.closest(".result");
      if (!card) return;
      showFlagConfirm(card, {
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
    revealOpsPanels();
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
      coverOpsPanels();
      renderAdminPanel();
    });
    return;
  }

  body.hidden = true;
  gate.innerHTML = `
    <form class="admin-unlock-form" id="admin-unlock-form">
      <label class="field" for="admin-password">
        <span class="field-label">Admin password</span>
        <input
          id="admin-password"
          type="password"
          autocomplete="current-password"
          placeholder="Enter password"
        />
      </label>
      <button type="submit" class="admin-unlock-btn">Unlock</button>
      <p class="admin-gate-hint muted">
        Unlocks Admin tools for this browser tab (sessionStorage). Password is verified against a baked-in hash — not stored as plaintext.
      </p>
    </form>
  `;
  gate.querySelector("#admin-unlock-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    revealOpsPanels();
    const attempt =
      gate.querySelector("#admin-password")?.value ??
      document.querySelector("#admin-password")?.value ??
      "";
    const submitBtn = gate.querySelector(".admin-unlock-btn");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const result = await tryUnlockAdmin(attempt);
      if (!result.ok) {
        window.alert("Incorrect password.");
        return;
      }
      adminUnlocked = true;
      revealOpsPanels();
      renderAdminPanel();
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
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

function resetToHome() {
  const input = document.querySelector("#query-input");
  if (input) input.value = "";
  if (itemPicker?.clear) itemPicker.clear();
  else if (itemPicker?.setValue) itemPicker.setValue(null);
  if (seriesPicker?.clear) seriesPicker.clear();
  else if (seriesPicker?.setValue) seriesPicker.setValue(null);
  if (systemPicker?.clear) systemPicker.clear();
  else if (systemPicker?.setValue) systemPicker.setValue(null);
  seriesPicker?.refreshEnabled?.();
  itemPicker?.refreshEnabled?.();
  dataplatePin?.clear?.();
  updateDomesticTempWarn();
  syncSearchLock();
  runSearch();
  document.querySelector("#system-input")?.focus();
}

function bindEvents() {
  const form = document.querySelector("#search-form");
  const input = document.querySelector("#query-input");
  const margin = document.querySelector("#margin-select");

  document.querySelector("#home-logo")?.addEventListener("click", resetToHome);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    // Keep short — heavy catalogue text is pre-indexed in partSearchCache.
    debounce = setTimeout(runSearch, 100);
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

  const processOpen = document.querySelector("#process-open");
  const processClose = document.querySelector("#process-close");
  const processChangeLevel = document.querySelector("#process-change-level");
  const processDialog = document.querySelector("#process-dialog");
  processOpen?.addEventListener("click", openProcess);
  processClose?.addEventListener("click", closeProcess);
  processChangeLevel?.addEventListener("click", showProcessChooser);
  if (processDialog) {
    processDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeProcess();
    });
    processDialog.addEventListener("click", (e) => {
      if (e.target === processDialog) closeProcess();
    });
  }

  const processExampleClose = document.querySelector("#process-example-close");
  const processExampleDialog = document.querySelector("#process-example-dialog");
  const processExamplePrev = document.querySelector("#process-example-prev");
  const processExampleNext = document.querySelector("#process-example-next");
  processExampleClose?.addEventListener("click", closeProcessFamilyExamples);
  processExamplePrev?.addEventListener("click", () => {
    processExamplePageIndex = Math.max(0, processExamplePageIndex - 1);
    renderProcessFamilyExampleSlide();
  });
  processExampleNext?.addEventListener("click", () => {
    const pages = familyExamplePages(getFamilyExamplePack(processExampleFamilyId));
    processExamplePageIndex = Math.min(pages.length - 1, processExamplePageIndex + 1);
    renderProcessFamilyExampleSlide();
  });
  if (processExampleDialog) {
    processExampleDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeProcessFamilyExamples();
    });
    processExampleDialog.addEventListener("click", (e) => {
      if (e.target === processExampleDialog) closeProcessFamilyExamples();
    });
  }

  const helpOpen = document.querySelector("#help-open");
  const helpClose = document.querySelector("#help-close");
  const helpDialog = document.querySelector("#help-dialog");
  helpOpen?.addEventListener("click", openHelp);
  helpClose?.addEventListener("click", closeHelp);
  if (helpDialog) {
    helpDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeHelp();
    });
    helpDialog.addEventListener("click", (e) => {
      if (e.target === helpDialog) closeHelp();
    });
  }

  const feedbackOpen = document.querySelector("#feedback-open");
  const feedbackClose = document.querySelector("#feedback-close");
  const feedbackDialog = document.querySelector("#feedback-dialog");
  const feedbackForm = document.querySelector("#feedback-form");
  feedbackOpen?.addEventListener("click", openFeedback);
  feedbackClose?.addEventListener("click", closeFeedback);
  feedbackForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitFeedback({ mailto: false });
  });
  document.querySelector("#feedback-email")?.addEventListener("click", () => {
    submitFeedback({ mailto: true });
  });
  document.querySelector("#feedback-export")?.addEventListener("click", () => {
    const n = downloadFeedbackJson();
    showFeedbackFlash(
      n
        ? `Exported ${n} feedback entr${n === 1 ? "y" : "ies"}.`
        : "No feedback saved yet — submit one first."
    );
  });
  if (feedbackDialog) {
    feedbackDialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeFeedback();
    });
    feedbackDialog.addEventListener("click", (e) => {
      if (e.target === feedbackDialog) closeFeedback();
    });
  }
  // Touch localStorage early so export/status stay consistent after boot.
  loadFeedback();

  const seriesThumb = document.querySelector("#series-thumb-btn");
  const diagramThumb = document.querySelector("#diagram-thumb-btn");
  const diagramLightbox = document.querySelector("#diagram-lightbox");
  const diagramLightboxClose = document.querySelector("#diagram-lightbox-close");
  const diagramLightboxPrev = document.querySelector("#diagram-lightbox-prev");
  const diagramLightboxNext = document.querySelector("#diagram-lightbox-next");
  const diagramLightboxDownload = document.querySelector(
    "#diagram-lightbox-download"
  );
  seriesThumb?.addEventListener("click", () => {
    if (seriesThumb.disabled || seriesThumb.hidden) return;
    openSeriesManualLightbox();
  });
  diagramThumb?.addEventListener("click", () => {
    if (diagramThumb.dataset.stealthYoutube === "1") {
      window.open(EMPTY_FRAME_YOUTUBE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    openDiagramLightbox();
  });
  diagramLightboxClose?.addEventListener("click", closeDiagramLightbox);
  diagramLightboxPrev?.addEventListener("click", () => stepLightboxPage(-1));
  diagramLightboxNext?.addEventListener("click", () => stepLightboxPage(1));
  diagramLightboxDownload?.addEventListener("click", () => {
    void onLightboxDownload();
  });
  document.addEventListener("keydown", onLightboxKeydown);
  if (diagramLightbox) {
    diagramLightbox.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeDiagramLightbox();
    });
    diagramLightbox.addEventListener("click", (e) => {
      if (e.target === diagramLightbox) closeDiagramLightbox();
    });
  }

  syncSearchLock();
  updateSearchVisuals(
    document.querySelector("#query-input")?.value || "",
    currentPin()
  );
  updateCartBadge();
  bindOpsPanelsReveal();
  renderAdminPanel();
  try {
    bindNewsTicker(document);
  } catch {
    /* ticker must never break boot / file:// */
  }
}

async function boot() {
  renderShell();
  try {
    const {
      catalogue: cat,
      config: cfg,
      prices,
      series,
      trade,
      abbrevs,
      assemblyHierarchy: hierarchyDoc,
      partBlurbs: blurbsDoc,
      processDoc: processPack,
      processBasicDoc: processBasicPack,
    } = await loadBootData();
    baseCatalogue = cat;
    config = cfg;
    pricesMeta = prices.meta || null;
    seriesDoc = series;
    tradeAliases = trade;
    partAbbrevs = abbrevs;
    abbrevIndex = buildAbbrevIndex(abbrevs);
    assemblyHierarchy = hierarchyDoc || null;
    assemblyIndex = buildAssemblyIndex(assemblyHierarchy);
    partBlurbs = blurbsDoc || null;
    processDoc = processPack || null;
    processBasicDoc = processBasicPack || null;
    if (!processTopicId && processDoc?.topics?.[0]?.id) {
      processTopicId = processDoc.topics[0].id;
    }
    if (!processBasicChapterId && processBasicDoc?.chapters?.[0]?.id) {
      processBasicChapterId = processBasicDoc.chapters[0].id;
    }
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
    const root = getApp();
    if (root) {
      root.innerHTML = `
      <div class="fatal">
        <h1>Catalogue failed to load</h1>
        <p>${escapeHtml(err.message)}</p>
        <p>Expected files under <code>data/</code> — run <code>npm run ingest</code> if JSON is missing. For double-click open, use <code>npm run build:file</code> then open <code>dist/index.html</code>.</p>
      </div>
    `;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    boot();
  });
} else {
  boot();
}
