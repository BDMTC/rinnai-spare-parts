# Assumptions — Rinnai Parts

Short notes so Beau can correct anything that doesn’t match warehouse reality.

1. **Audience** — MTC Gas admin (layperson searchers) first; plumbers later. UI copy stays ops-plain, not customer marketing.
2. **Local-first** — No auth, no API, no Acumatica/portal. Catalogue is static JSON shipped with the app.
3. **Models** — Loaded from `REU-Model-History.xlsx` (Marketing Code, Item Number, Description, Description 2, Stocking Type). No invented fields.
4. **Parts / prices** — Loaded from the spare-parts price workbook. All sheets scanned. Product sheets use A/C/K from row 6; DISCOUNTS uses A/B/C (segment / code / %). Cover & Contact yield no priced parts.
5. **Base price** — Column K net invoice ex GST. Sell ex GST = net × (1 + margin%/100). Margin selector **0–100% in 5% steps**; default **20%**. GST always **10%** AU.
6. **Model pin is soft** — Selecting a model boosts fitting parts when `modelIds` exist; price-list rows are not yet linked to models, so pin mostly prepares for later mapping.
7. **Part aliases** — Schema supports trade synonyms; real admin/warehouse lists still to come.
7b. **Series aliases** — `series-aliases.json` maps marketing series ↔ chassis/doc keys. Confirmed: **HD28 ↔ VCM2837**; **AU HD200e ↔ VRM2632WC**; **HD200i ↔ REU-VR2632FFUG / REU-VRM2632FFUC** (`relatedFamilies` FFU for later cross-family search); **Infinity 26 Plus ↔ REUV2630WD / VRM2630WD**; **Infinity 26 Smartstart ↔ VR2626WGP**; **Infinity 32 Enviro ↔ KM3237**; **HD210e ↔ N3237WC**; **HD210i ↔ N3237FFC**; **Infinity 32 Enviro+ ↔ N3237W** (do **not** map all N3237 to Enviro Plus). NZ discontinued **REU-VM2630WC / HD200e Infinity** is **not** in the typeahead map (Beau removed).
7c. **Unit class** — Internal vs external (FFUC/FFC vs WC/WC-AK) are distinct; soft document matching never equates conflicting unit-class suffixes.
7d. **Data sheets** — `document-index.json` is committed; PDF bytes live under gitignored `data-sheets/`, served locally at `/data-sheets` per `config.documents.rootUrl`. Cloud/agents without the folder get index hits + empty/404 open, not a hard crash.
8. **Diagrams later** — `diagramUrl` / `diagramPath` / `diagramRef.callout` exist; no exploded diagrams in this pass.
9. **Source xlsx** — Kept under `source-data/` locally and gitignored; generated JSON under `public/data/` is committed for offline use.
10. **Fonts** — Google Fonts load when online; layout still works if fonts fail (system fallbacks).

---

**Woz's tips**

- Wrong-order risk (LPG vs NG) is not encoded yet — keep reading Description 2 / notes on models.
- Don’t treat discount-segment rows (PCH, PWC, …) as sell prices.
