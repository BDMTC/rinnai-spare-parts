# Assumptions — Rinnai Parts

Short notes so Beau can correct anything that doesn’t match warehouse reality.

1. **Audience** — MTC Gas admin (layperson searchers) first; plumbers later. UI copy stays ops-plain, not customer marketing.
2. **Local-first** — No auth, no API, no Acumatica/portal. Catalogue is static JSON shipped with the app.
3. **Models** — Loaded from `REU-Model-History.xlsx` (Marketing Code, Item Number, Description, Description 2, Stocking Type). No invented fields. Description 2 drives `restricted` / `restrictionKind` (NLA, export only, use-up, only-for / customer-only). Soft `USE X WHEN NLA` pointers on still-stocked SKUs are not flagged. Site-listed / field-supported AU greys Beau wants selectable (home §A + commercial HD/HDC §F) are force-cleared via `public/data/model-site-active-unrestrict.json` (ingest + shipped JSON); pure EXPORT ONLY siblings stay grey unless listed. **HD200e** (`VRM2632WC`) is off the AU marketing site but remains a spares mainstay — keep active rows selectable; absence from the site spider is not a defect.
3c. **REU Item Number schema** — Shipped `itemNumber` values use Rinnai’s hyphenated form (`REU-A2626WB-50-AKN`, `REU-VCM2837WC-50-KL`, `REU-NB3237WC-42-AK`), matching data-plate / tech-sheet style. Source xlsx may still be packed without hyphens; `src/reu-format.js` restores hyphens on ingest. Search/matching strips non-alnum so either form compares equal.
3b. **NLA gate** — Restricted models show greyed in the typeahead and stay arrow-highlightable, but **keyboard Enter does not select them** — only a mouse click opens the unlock confirm. Until Yes unlocks that pin for the session **and** it stays pinned, parts that only relate to those restricted chassis stay out of default search.
4. **Parts / prices** — Loaded from the spare-parts price workbook. All sheets scanned. Product sheets use A/C/K from row 6; DISCOUNTS uses A/B/C (segment / code / %). Cover & Contact yield no priced parts.
5. **Base price** — Column K net invoice ex GST. Sell ex GST = net × (1 + margin%/100). Margin selector **0–100% in 5% steps**; default **25%**. GST always **10%** AU.
6. **Model pin ranks by chassis fit** — Price-list rows still have empty `modelIds`; fit is inferred from chassis tokens in the description against `series-aliases.json` documentKeys (any series/model). Exact unit-class match → Primary; related family → secondary; unrelated demoted. Primary result box uses brand orange `#F47921` (highlight only — not day-to-day UI chrome / arcs).
7. **Trade aliases** — `trade-aliases.json` maps layman/trade terms (e.g. flow servo) to official description patterns; preferPatterns win when multiple official names fit the pin.
7a. **Part-name abbreviations** — `part-name-abbreviations.json` is bidirectional short↔long search (BRKT↔bracket, ASSY↔assembly, CON KIT↔conversion kit, …). Context-dependent tokens are not merged “both”; unset tokens (W/I, FS, A/FRM, MOD, OUT, HE, PSI) are omitted.
7b. **Series aliases** — `series-aliases.json` maps marketing series ↔ chassis/doc keys. Confirmed: **HD28 ↔ VCM2837**; **AU HD200e ↔ VRM2632WC**; **HD200i ↔ REU-VR2632FFUG / REU-VRM2632FFUC** (`relatedFamilies` FFU for later cross-family search); **Infinity 26 Plus ↔ REUV2630WD / VRM2630WD**; **Infinity 26 Smartstart ↔ VR2626WGP**; **Infinity 32 Enviro ↔ KM3237**; **HD210e ↔ N3237WC**; **HD210i ↔ N3237FFC**; **Infinity 32 Enviro+ ↔ N3237W** (do **not** map all N3237 to Enviro Plus). NZ discontinued **REU-VM2630WC / HD200e Infinity** is **not** in the typeahead map (Beau removed).
7c. **Unit class** — Internal vs external (FFUC/FFC vs WC/WC-AK) are distinct; soft document matching never equates conflicting unit-class suffixes.
7d. **Data sheets** — `document-index.json` / `documents.js` stay in the codebase for later admin use; the main search UI no longer lists sheets. PDF bytes live under gitignored `data-sheets/`.
8. **Quote list** — User-facing name is **Quote list** (not shopping cart). **Add to Quote** sits top-right on each result card. Overlay email/copy/save/clear unchanged in behaviour.
9. **Flag for problem** — On each result card (with Add to Quote); mailto `stores@mtcgas.com.au` with fixed subject/body for that card’s part (code included). Local flag overlay recorded for admin clear.
10. **Admin overlays** — Password gate verifies against a baked-in PBKDF2 hash (no plaintext in repo); unlock persists per tab via `sessionStorage`. Flag clear / suspend / delete / browser price-import live in `localStorage` (`rinnai-parts-overrides-v1`). **Production catalogue updates go through AI + `npm run ingest`**; the admin UI queues change intents and applies a local overlay only.
11. **Diagrams later** — `diagramUrl` / `diagramPath` / `diagramRef.callout` exist; no exploded diagrams in this pass.
12. **Source xlsx** — Kept under `source-data/` locally and gitignored; generated JSON under `public/data/` is committed for offline use.
13. **Fonts** — Google Fonts load when online; layout still works if fonts fail (system fallbacks).

---

**Woz's tips**

- Wrong-order risk (LPG vs NG) is not encoded yet — keep reading Description 2 / notes on models.
- Don’t treat discount-segment rows (PCH, PWC, …) as sell prices.
- When Beau imports a new price list in Admin, review NLA/removed rows (skip = keep) before applying the local patch — then ask AI to sync via ingest for production.
- Header logo is the official MTCGAS Australia PNG, Vite-inlined (`?inline` data URI in the JS bundle) — no separate deploy asset under `public/`.
- Admin + Data sources share one soft team-HQ photo veil (also `?inline`); hover/focus fades it fully to reveal both panels.
