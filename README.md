# Rinnai Parts — MTC Gas Admin

Local-first spare parts search for MTC Gas admin. Find parts by **order code**, **description**, or **sheet category**, optionally pinned to a REU model. Pricing uses Rinnai **net invoice ex GST** with an on-screen margin and 10% GST.

No backend required. Data loads from static JSON under `public/data/`.

**Tip (PR [#13](https://github.com/BDMTC/rinnai-spare-parts/pull/13)):** branch `cursor/feedback-popup-379a` (thumbs-feedback feature @ `beac548`). Canonical TDD lives in Project Context `docs/rinnai-parts-tdd.md` (not this repo) — see that header for the live tip SHA.

## How to run

```bash
npm install
npm run ingest   # if source-data/*.xlsx are present / refreshed
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production build (http / deploy):

```bash
npm run build
npm run preview
```

### Double-click / `file://` (no local server)

Chrome and Edge block `fetch` and ES modules under `file://`. Use the dedicated file build, which bundles catalogue JSON into one classic (IIFE) script with relative asset URLs:

```bash
npm run build:file
```

Then open **`dist/index.html`** (double-click in Explorer, or drag into Chrome/Edge). Keep the whole `dist/` folder together.

- Models, prices, and search load from the baked-in JSON pack — no network and no `fetch` of `data/*.json`.
- `npm run dev` is unchanged (still the day-to-day workflow).
- Regular `npm run build` stays absolute-base for http deploy; only `build:file` uses `base: './'` + IIFE.

**PDFs:** keep sheets under repo-root `data-sheets/` (sibling of `dist/`). Open via the in-app link (navigation to `../data-sheets/...`). Do not expect `fetch` of local PDFs under `file://` — Chromium blocks that without special flags; opening in a new tab usually works when the file exists.

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
2. Edit `public/data/config.json` → `priceList.workbookPath` / `endpoint`, `workbookFile`, `effectiveDate` (or set the path in Admin).
3. Run `npm run ingest` for production JSON.
4. Refresh the browser.

Admin can also **Import & review** a workbook in-browser (same A/C/K row-6 rules). That applies a **local overlay** + change-queue entry only — production listings still need AI / `npm run ingest`. Path is shown under **Data sources** and editable in Admin.

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
| `public/data/tech-sheet-sync.json` | Map of Tech-mirror PLs to replace/add into local sheets |
| `public/data/part-name-abbreviations.json` | Bidirectional short↔long part-name search aliases |
| `data-sheets/` | Local PDFs only (gitignored). Vite serves at `/data-sheets/` |

## Local data sheets (PDF open)

Binaries stay on the office PC (≈283MB). Do **not** commit them.

1. Keep (or extract) PDFs under the repo’s `data-sheets/` folder, e.g.  
   `C:\Temp\rinnai-spare-parts\data-sheets\Rinnai Data Sheets\…`
2. Confirm `public/data/document-index.json` is present (already committed).
3. In `public/data/config.json`, `documents.rootUrl` defaults to `/data-sheets`, `documents.fileRootUrl` to `../data-sheets` (for `dist/` + `file://`), and `documents.localFolder` to `data-sheets`.
4. Run `npm run dev` (or `preview`) from the repo root. Vite maps **`/data-sheets/*` → `./data-sheets/*`**. For double-click, use `npm run build:file` and open `dist/index.html` (PDF links resolve to `../data-sheets/...`).
5. Pin **HD28** (or search `VCM2837` / `REU-VCM2837`) — matching sheets list under **Data sheets**. Use **Open PDF** (new tab) or **View here** (in-app).

### Refresh sheets from Rinnai Tech mirror

After an overnight Tech spider (Project store `media/rinnai-tech-latest/`):

```bash
npm run sync:tech-sheets -- --mirror /path/to/rinnai-tech-latest
```

That copies mapped PLs into `data-sheets/Rinnai Data Sheets/`, quarantines superseded filenames under `data-sheets/quarantine/`, and rewrites `public/data/document-index.json`. Use `--index-only` to refresh the JSON without copying binaries (cloud). Mapping lives in `public/data/tech-sheet-sync.json`.

If the folder is missing (cloud agent, fresh clone), the index still lists matches; opening a PDF shows a clear 404 until files are present. WC vs FFUC/FFC stay distinct keys — both can appear for a series; they are not treated as duplicates.

## What it does

- Search bar + **model typeahead** (marketing names, REU/chassis codes, series aliases)
- **NLA / restricted gate**: Description 2 flags (NLA, export only, use-up, only-for) grey models in the picker; **click only** opens unlock confirm (Enter/keyboard will not select); exclusive restricted chassis parts stay out of default search until that pin is unlocked for the session
- **Series pin** via aliases (HD28, HD200e/VRM2632WC, HD200i, Infinity 26/32, HD210, …)
- **Ranked model-pinned search**: Primary = most likely code for the pin; trade aliases resolve layman terms; chassis fit across all series
- **Part-name abbreviations**: bidirectional short↔long search (`part-name-abbreviations.json`) with **matched …** chips on result cards
- **MTC logo home**: banner logo click clears search + model pin
- Header **?** beginner help tips; thumbs-up **feedback** blurb (offline `localStorage` + optional mailto / JSON export)
- Margin **0–100%** in **5%** steps (default 20%)
- **Quote list** (header icon + overlay): Add to Quote on each result (top-right), email/copy/save/clear
- **Flag item for problem** on each result card → mailto stores for Beau review (that part)
- **Admin / development** (hashed PBKDF2 password gate): clear flags, suspend/delete parts, price-list path, workbook import with count-diff review — localStorage overlay + change queue for AI ingest sync
- Matches part code, description, trade alias, abbrev expand, and sheet/category
- Shows net invoice ex GST, computed ex GST at selected margin, and inc GST
- Data-sources panel documents how to swap the next price list
- Data-sheet index/code kept; sheet listing removed from the main search UI; Tech sync covers **CFHW / REU** sheets only

## Out of scope (this pass)

- **Aircon** / broader Tech File Manager sections (deferred — CFHW/REU only)
- Exploded diagrams / callout RAG (Beau supplying next)
- Explicit `modelIds` on every price row (fit currently inferred from chassis text)
- Committing browser admin edits as production `prices.json` (always go through AI ingest)

## Assumptions

See [ASSUMPTIONS.md](./ASSUMPTIONS.md).

---

**Woz's tips**

- Pin the model when you can — Primary ranking uses series chassis keys in the description (e.g. HD200e + flow servo → 92095902).
- When Rinnai sends a new price workbook, change config + `npm run ingest`; don’t hand-edit `prices.json`.
- Day-to-day: `npm run dev`. For a no-server open on the office PC: `npm run build:file` → double-click `dist/index.html`.
