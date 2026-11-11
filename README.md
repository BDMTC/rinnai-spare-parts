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
| `public/data/config.json` | Margin default, GST, workbook paths, refresh steps |
| `public/data/models.json` | REU Model History rows |
| `public/data/prices.json` | Price rows + sheet index |
| `public/data/catalogue.json` | Combined search index (models + parts) |
| `public/data/series-aliases.json` | Series map for model pin + document lookup (HD28 ↔ REU-VCM2837 / VCM2837) |

## What it does

- Search bar + model pin (REU marketing codes from model history)
- **Series pin** via aliases (HD28 ↔ REU-VCM2837 / VCM2837 / REUVCM2837)
- Matches part code, description, and sheet/category
- Shows net invoice ex GST, computed ex GST at selected margin, and inc GST
- Data-sources panel documents how to swap the next price list

## Out of scope (this pass)

- Exploded diagrams / callout RAG (Beau supplying next)
- Quote cart / email handoff
- Trade aliases (schema ready; lists not supplied yet)
- Model ↔ part fit mapping from Rinnai docs

## Assumptions

See [ASSUMPTIONS.md](./ASSUMPTIONS.md).

---

**Woz's tips**

- Pin the model when you can — part–model links are not mapped yet from the price book alone.
- When Rinnai sends a new price workbook, change config + `npm run ingest`; don’t hand-edit `prices.json`.
- `file://` won’t load JSON via `fetch` — use `npm run dev` / `preview`.
