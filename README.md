# Rinnai Parts — MTC Gas Admin

Local-first spare parts search for MTC Gas admin. Find parts by **order code**, **description**, or **sheet category**, optionally pinned to a REU model. Pricing uses Rinnai **net invoice ex GST** with an on-screen margin and 10% GST.

No backend required. Data loads from static JSON under `public/data/`.

## How to run

```bash
npm install
npm run ingest   # if source-data/*.xlsx are present / refreshed
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Pricing (locked rules)

| Item | Rule |
|------|------|
| Base price | Column **K** — Net invoice price **ex GST** |
| Description | Column **A** (from Excel row 6 down) |
| Part / order code | Column **C** |
| Sheets | **All** workbook sheets are scanned |
| Margin | On-screen selector; **default 20%** |
| Sell ex GST | `net × (1 + margin%/100)` |
| Inc GST | `ex GST × 1.10` (AU GST 10%) |

## Refresh the price list

1. Put the new Rinnai price workbook in `source-data/` (see `source-data/README.md`).
2. Edit `public/data/config.json` → `priceList.workbookPath`, `workbookFile`, `effectiveDate`.
3. Run `npm run ingest`.
4. Refresh the browser.

The app also shows this path under **Data sources / price list config**.

## Data files

| File | Role |
|------|------|
| `public/data/config.json` | Margin default, GST, workbook paths, `documents.rootUrl`, refresh steps |
| `public/data/models.json` | REU Model History rows |
| `public/data/prices.json` | Price rows + sheet index |
| `public/data/catalogue.json` | Combined search index (models + parts) |
| `public/data/series-aliases.json` | Series map for model typeahead + document lookup (HD28, HD200e/i, Infinity 26/32, HD210, …) |
| `public/data/trade-aliases.json` | Trade/layman terms → official description patterns (e.g. flow servo) |
| `public/data/document-index.json` | Portable PDF index (paths + series tags) — **no binaries** |
| `data-sheets/` | Local PDFs only (gitignored). Vite serves at `/data-sheets/` |

## Local data sheets (PDF open)

Binaries stay on the office PC (≈283MB). Do **not** commit them.

1. Keep (or extract) PDFs under the repo’s `data-sheets/` folder, e.g.  
   `C:\Temp\rinnai-spare-parts\data-sheets\Rinnai Data Sheets\…`
2. Confirm `public/data/document-index.json` is present (already committed).
3. In `public/data/config.json`, `documents.rootUrl` defaults to `/data-sheets` and `documents.localFolder` to `data-sheets`.
4. Run `npm run dev` (or `preview`) from the repo root. Vite maps **`/data-sheets/*` → `./data-sheets/*`**.
5. Pin **HD28** (or search `VCM2837` / `REU-VCM2837`) — matching sheets list under **Data sheets**. Use **Open PDF** (new tab) or **View here** (in-app).

If the folder is missing (cloud agent, fresh clone), the index still lists matches; opening a PDF shows a clear 404 until files are present. WC vs FFUC/FFC stay distinct keys — both can appear for a series; they are not treated as duplicates.

## What it does

- Search bar + **model typeahead** (marketing names, REU/chassis codes, series aliases)
- **Series pin** via aliases (HD28, HD200e/VRM2632WC, HD200i, Infinity 26/32, HD210, …)
- **Ranked model-pinned search**: Primary = most likely code for the pin; trade aliases resolve layman terms; chassis fit across all series
- Margin **0–100%** in **5%** steps (default 20%)
- Matching **data sheets** for the pin (from `document-index.json`) with click-to-open PDFs
- Matches part code, description, trade alias, and sheet/category
- Shows net invoice ex GST, computed ex GST at selected margin, and inc GST
- Data-sources panel documents how to swap the next price list

## Out of scope (this pass)

- Exploded diagrams / callout RAG (Beau supplying next)
- Quote cart / email handoff
- Explicit `modelIds` on every price row (fit currently inferred from chassis text)

## Assumptions

See [ASSUMPTIONS.md](./ASSUMPTIONS.md).

---

**Woz's tips**

- Pin the model when you can — Primary ranking uses series chassis keys in the description (e.g. HD200e + flow servo → 92095902).
- When Rinnai sends a new price workbook, change config + `npm run ingest`; don’t hand-edit `prices.json`.
- `file://` won’t load JSON via `fetch` — use `npm run dev` / `preview`.
