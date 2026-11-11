# Assumptions — Rinnai Parts v1

Short notes so Beau can correct anything that doesn’t match warehouse reality.

1. **Audience** — MTC Gas admin (layperson searchers) first; plumbers later. UI copy stays ops-plain, not customer marketing.
2. **Local-first** — No auth, no API, no Acumatica/portal. Catalogue is static JSON shipped with the app.
3. **Seed data is fake-but-plausible** — Part codes (`R####`, `MC-91-2AU`) and model SKUs are **illustrative**, not verified against a live Rinnai price book. Do not order from this seed.
4. **Model pin is soft filter** — Selecting a model boosts matching parts and labels non-fits; it does not hard-hide other results (admin may still need to compare).
5. **Aliases are first-class** — Trade terms (“flow sensor”, “PCB”, “anode”) are expected to be the primary search path for admin.
6. **Diagrams later** — `diagramUrl` / `diagramPath` / `diagramRef.callout` exist in the schema; no exploded diagrams ship in v1.
7. **One catalogue file** — Single `catalogue.json` for models + parts. Split files / import tooling can wait until Beau has real dumps.
8. **AU English / SEQ ops** — Labels and sample models lean continuous-flow Infinity / Heavy Duty and one storage example, reflecting MTC’s hot-water work — not a full national Rinnai range.
9. **No stock / pricing** — This is identification only. Warehouse qty and supplier cost stay out of scope.
10. **Fonts** — Google Fonts load when online; layout still works if fonts fail (system fallbacks).

---

**Woz's Proactive Tips (Potential Pitfalls)**

- If two parts share an alias but different codes, model pin + “Fits selected model” badge are the safety net — train admin to set the model first.
- When real lists arrive, keep `id` values stable if anything starts bookmarking or linking to parts later.
- LPG vs NG valve kits are a classic wrong-order trap; put fuel notes on the **part** or **model** `notes` field as soon as Beau confirms the split.
