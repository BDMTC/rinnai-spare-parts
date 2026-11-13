/**
 * Dataplate upload / OCR / confirm-chip UI for dual pins.
 * Never silent auto-pin — admin must tap chips (or Confirm).
 */

import { mapDataplateTextToPinCandidates } from "./dataplate-map.js";
import { recognizeDataplateImage } from "./dataplate-ocr.js";

/**
 * @param {object} ctx
 * @param {() => object|null} ctx.getCatalogue
 * @param {() => object|null} ctx.getSeriesDoc
 * @param {{ getValue: Function, setValue: Function, clear?: Function, refreshEnabled?: Function }} ctx.seriesPicker
 * @param {{ getValue: Function, setValue: Function, clear?: Function, refreshEnabled?: Function }} ctx.itemPicker
 * @param {(suggestion: object) => Promise<boolean>} [ctx.requestUnlock]
 * @param {(pinValue: string) => boolean} [ctx.isPinUnlocked]
 * @param {() => void} [ctx.onPinned]
 */
export function mountDataplatePin(ctx) {
  const root = document.querySelector("#dataplate-zone");
  if (!root) return null;

  const drop = root.querySelector("#dataplate-drop");
  const fileInput = root.querySelector("#dataplate-file");
  const preview = root.querySelector("#dataplate-preview");
  const statusEl = root.querySelector("#dataplate-status");
  const textArea = root.querySelector("#dataplate-text");
  const chipsEl = root.querySelector("#dataplate-chips");
  const seriesChips = root.querySelector("#dataplate-series-chips");
  const itemChips = root.querySelector("#dataplate-item-chips");
  const confirmBtn = root.querySelector("#dataplate-confirm");
  const clearBtn = root.querySelector("#dataplate-clear");

  /** @type {string|null} */
  let selectedSeries = null;
  /** @type {string|null} */
  let selectedItem = null;
  /** @type {ReturnType<typeof mapDataplateTextToPinCandidates>|null} */
  let lastMap = null;
  let objectUrl = null;
  let busy = false;

  function setStatus(msg, kind = "") {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.dataset.kind = kind || "";
    statusEl.hidden = !msg;
  }

  function revokePreview() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
  }

  function showPreview(file) {
    revokePreview();
    if (!preview || !file) return;
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.hidden = false;
  }

  function updateConfirmEnabled() {
    if (!confirmBtn) return;
    confirmBtn.disabled = !selectedSeries && !selectedItem;
  }

  function renderChips() {
    if (!chipsEl || !seriesChips || !itemChips) return;
    const series = lastMap?.seriesCandidates || [];
    const items = lastMap?.itemCandidates || [];
    chipsEl.hidden = !series.length && !items.length;

    seriesChips.innerHTML = series.length
      ? series
          .map((c) => {
            const active = c.value === selectedSeries ? " is-selected" : "";
            return `<button type="button" class="dataplate-chip${active}" data-kind="series" data-value="${escapeAttr(c.value)}" aria-pressed="${c.value === selectedSeries ? "true" : "false"}">${escapeHtml(c.label)}</button>`;
          })
          .join("")
      : `<span class="dataplate-chip-empty">No series match yet</span>`;

    itemChips.innerHTML = items.length
      ? items
          .map((c) => {
            const active = c.value === selectedItem ? " is-selected" : "";
            const sub = c.subtitle
              ? `<span class="dataplate-chip-sub">${escapeHtml(c.subtitle)}</span>`
              : "";
            return `<button type="button" class="dataplate-chip dataplate-chip--item${active}" data-kind="item" data-value="${escapeAttr(c.value)}" aria-pressed="${c.value === selectedItem ? "true" : "false"}"><span class="dataplate-chip-label">${escapeHtml(c.label)}</span>${sub}</button>`;
          })
          .join("")
      : `<span class="dataplate-chip-empty">No Item Number match yet</span>`;

    updateConfirmEnabled();
  }

  function applyMapFromText(text) {
    const catalogue = ctx.getCatalogue?.() || null;
    const seriesDoc = ctx.getSeriesDoc?.() || null;
    lastMap = mapDataplateTextToPinCandidates(catalogue, seriesDoc, text);
    selectedSeries = null;
    selectedItem = null;
    // Soft-select top candidates for confirm, but do NOT lock pins yet
    if (lastMap.seriesCandidates[0]) {
      selectedSeries = lastMap.seriesCandidates[0].value;
    }
    if (lastMap.itemCandidates[0]) {
      selectedItem = lastMap.itemCandidates[0].value;
      // Align series with item when possible
      const item = lastMap.itemCandidates[0];
      if (item.series?.id) {
        selectedSeries = `series:${item.series.id}`;
      }
    }
    renderChips();
    if (!lastMap.seriesCandidates.length && !lastMap.itemCandidates.length) {
      setStatus(
        "No REU / HD codes recognised — check the dataplate text or try another photo.",
        "warn"
      );
    } else {
      setStatus(
        "Confirm Pin 1 / Pin 2 chips below — nothing is locked until you confirm.",
        "ok"
      );
    }
  }

  async function runOcrOnFile(file) {
    if (!file || busy) return;
    busy = true;
    showPreview(file);
    setStatus("Loading OCR sidecar…", "busy");
    try {
      const text = await recognizeDataplateImage(file, (m) => {
        if (m?.status) {
          const pct =
            typeof m.progress === "number"
              ? ` ${Math.round(m.progress * 100)}%`
              : "";
          setStatus(`Reading dataplate… ${m.status}${pct}`, "busy");
        }
      });
      if (textArea) textArea.value = text.trim();
      if (!String(text || "").trim()) {
        setStatus(
          "OCR found no text — paste or type the dataplate line, then Confirm.",
          "warn"
        );
        lastMap = null;
        renderChips();
        return;
      }
      applyMapFromText(text);
    } catch (err) {
      console.warn("[dataplate OCR]", err);
      setStatus(
        `OCR unavailable (${err?.message || err}). Paste or type the dataplate line below.`,
        "warn"
      );
    } finally {
      busy = false;
    }
  }

  async function lockSelectedPins() {
    if (!selectedSeries && !selectedItem) return;

    const itemCand = (lastMap?.itemCandidates || []).find(
      (c) => c.value === selectedItem
    );
    const seriesCand = (lastMap?.seriesCandidates || []).find(
      (c) => c.value === selectedSeries
    );

    // Restricted Item Number → same unlock dialog as typeahead
    if (itemCand?.restricted && selectedItem) {
      const unlocked =
        typeof ctx.isPinUnlocked === "function" &&
        ctx.isPinUnlocked(selectedItem);
      if (!unlocked) {
        if (typeof ctx.requestUnlock !== "function") return;
        const ok = await ctx.requestUnlock({
          value: selectedItem,
          label: itemCand.label,
          restricted: true,
          restriction: itemCand.model,
          restrictionLabel: itemCand.model?.restrictionLabel,
        });
        if (!ok) return;
      }
    }

    if (selectedSeries && ctx.seriesPicker?.setValue) {
      ctx.seriesPicker.setValue(selectedSeries);
    }
    ctx.itemPicker?.refreshEnabled?.();
    if (selectedItem && ctx.itemPicker?.setValue) {
      ctx.itemPicker.setValue(selectedItem);
    } else if (!selectedItem && seriesCand) {
      // Series-only confirm clears stale Item Number
      ctx.itemPicker?.clear?.();
    }
    ctx.itemPicker?.refreshEnabled?.();
    setStatus("Pins confirmed from dataplate.", "ok");
    ctx.onPinned?.();
  }

  drop?.addEventListener("click", (e) => {
    if (e.target === fileInput) return;
    fileInput?.click();
  });

  drop?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput?.click();
    }
  });

  ["dragenter", "dragover"].forEach((type) => {
    drop?.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    drop?.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.remove("is-dragover");
    });
  });
  drop?.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && /^image\//i.test(file.type)) runOcrOnFile(file);
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) runOcrOnFile(file);
    fileInput.value = "";
  });

  textArea?.addEventListener("input", () => {
    const t = textArea.value || "";
    if (t.trim().length >= 4) applyMapFromText(t);
  });

  chipsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button.dataplate-chip");
    if (!btn) return;
    const kind = btn.dataset.kind;
    const value = btn.dataset.value;
    if (!value) return;
    if (kind === "series") {
      selectedSeries = selectedSeries === value ? null : value;
      // Clearing series drops item selection that belongs elsewhere
      if (!selectedSeries) selectedItem = null;
    } else if (kind === "item") {
      selectedItem = selectedItem === value ? null : value;
      const item = (lastMap?.itemCandidates || []).find((c) => c.value === value);
      if (selectedItem && item?.series?.id) {
        selectedSeries = `series:${item.series.id}`;
      }
    }
    renderChips();
  });

  confirmBtn?.addEventListener("click", () => {
    lockSelectedPins();
  });

  clearBtn?.addEventListener("click", () => {
    revokePreview();
    if (textArea) textArea.value = "";
    lastMap = null;
    selectedSeries = null;
    selectedItem = null;
    renderChips();
    setStatus("");
    if (fileInput) fileInput.value = "";
  });

  setStatus("");
  renderChips();

  return {
    clear: () => clearBtn?.click(),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
