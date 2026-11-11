# Rinnai Parts — MTC Gas Admin (v1)

Local-first spare parts search for MTC Gas admin. Find the right Rinnai part by **official name**, **Rinnai code**, or **trade/layman alias**, optionally pinned to a unit model.

No backend required for v1. Catalogue loads from a static JSON file.

## How to run

```bash
cd rinnai-parts
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

Offline / USB stick: after `npm run build`, serve the `dist/` folder with any static server (or open via a local server — fetch of JSON needs http(s), not `file://`).

## What it does

- Google-like search bar + **Search** button (also searches as you type)
- **Model** select to pin which Rinnai unit the query is for
- Matches across part name, Rinnai code, and aliases
- Results show code, official name, aliases, and which models fit
- When a model is selected, fitting parts rank higher; non-fitting hits stay visible but marked “Other model”

## Data shape

Replace or extend `public/data/catalogue.json`. Shape:

```json
{
  "version": 1,
  "meta": {
    "title": "…",
    "locale": "en-AU",
    "notes": "…",
    "updated": "YYYY-MM-DD"
  },
  "models": [
    {
      "id": "inf26e",
      "brand": "Rinnai",
      "name": "Infinity 26 External",
      "sku": "INF26E",
      "family": "Infinity continuous flow",
      "fuel": "Natural Gas / LPG variants",
      "diagramUrl": null,
      "diagramPath": null,
      "notes": null
    }
  ],
  "parts": [
    {
      "id": "part-flow-sensor",
      "code": "R1876",
      "name": "Water Flow Sensor Assembly",
      "aliases": ["flow sensor", "water sensor", "flow switch"],
      "modelIds": ["inf16i", "inf20e", "inf26e"],
      "category": "Water path",
      "diagramRef": {
        "url": null,
        "path": null,
        "callout": "WF-3"
      },
      "notes": "optional free text"
    }
  ]
}
```

### Field notes

| Field | Purpose |
|-------|---------|
| `models[].id` | Stable key referenced by `parts[].modelIds` |
| `models[].diagramUrl` / `diagramPath` | Placeholder for exploded diagram later |
| `parts[].code` | Official Rinnai part code |
| `parts[].aliases` | Trade / admin / plumber synonyms |
| `parts[].diagramRef` | Future diagram link + callout number |

Diagram media can later live under `public/diagrams/` and be pointed to via `diagramPath` (e.g. `/diagrams/inf26e-exploded.pdf`).

## Assumptions

See [ASSUMPTIONS.md](./ASSUMPTIONS.md).

## Out of scope (v1)

- Company portal auth
- Real catalogue import / ERP sync
- OCR of exploded diagrams
- Ordering / stock levels

## What Beau should supply next

1. Real **model list** (SKU / marketing name / fuel variants)
2. Real **parts lists** per model (code + official name)
3. **Alias / synonym** list from admin + warehouse (how people actually ask)
4. Exploded **diagram PDFs/images** + callout map when ready
5. Any known **NG vs LPG** part splits that must not be cross-ordered

---

**Woz's Proactive Tips (Potential Pitfalls)**

- Same trade term (e.g. “PCB”) can map to **different codes per model family** — always pin the model before ordering.
- Alias collisions will grow; keep aliases lowercase-ish plain English and avoid stuffing SKUs into alias lists (SKUs belong in `code`).
- When diagrams arrive, store them locally under `public/diagrams/` first; don’t assume portal CDN until auth exists.
- `file://` won’t load the JSON via `fetch` — always use `npm run dev` / `preview` or another static server.
