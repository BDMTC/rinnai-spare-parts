#!/usr/bin/env python3
"""Reshape Process warranty topic + checker from AU booklet ingest (KISS)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DETAILED = ROOT / "public" / "data" / "rinnai-process.json"
BASIC = ROOT / "public" / "data" / "rinnai-process-basic.json"


def age_choices(
    labour_years: int | None,
    parts_years: int,
    *,
    labour_parts_label: str | None = None,
    parts_only_label: str | None = None,
    over_label: str | None = None,
    over_outcome: str = "chargeable",
) -> list[dict]:
    """Build simple age choices. labour_years None → parts+labour same band."""
    choices: list[dict] = []
    if labour_years is None or labour_years == parts_years:
        y = parts_years
        choices.append(
            {
                "label": labour_parts_label or f"{y} years old or less",
                "outcome": "labour_parts",
            }
        )
        choices.append(
            {
                "label": over_label or f"Older than {y} years",
                "outcome": over_outcome,
            }
        )
    else:
        choices.append(
            {
                "label": labour_parts_label
                or f"{labour_years} years old or less (labour + parts)",
                "outcome": "labour_parts",
            }
        )
        choices.append(
            {
                "label": parts_only_label
                or f"Between {labour_years} and {parts_years} years (parts only)",
                "outcome": "parts_only",
            }
        )
        choices.append(
            {
                "label": over_label or f"Older than {parts_years} years",
                "outcome": over_outcome,
            }
        )
    choices.append({"label": "Not sure / age unknown", "outcome": "insufficient"})
    return choices


def use_q(next_dom: str, next_comm: str, celsius: int) -> dict:
    return {
        "prompt": f"Home (domestic) or commercial use? Domestic lodging-style only if delivery is {celsius}°C or less, not a bulk tank system, and no building flow-and-return.",
        "choices": [
            {"label": f"Domestic (≤{celsius}°C)", "next": next_dom},
            {"label": "Commercial", "next": next_comm},
            {"label": "Not sure", "outcome": "insufficient"},
        ],
    }


def fail_q(parts: list[tuple[str, str]], *, extra: list[dict] | None = None) -> dict:
    choices = [{"label": label, "next": nxt} for label, nxt in parts]
    if extra:
        choices.extend(extra)
    choices.append({"label": "Not sure", "outcome": "insufficient"})
    return {"prompt": "What failed?", "choices": choices}


WARRANTY_TOPIC = {
    "id": "warranty",
    "title": "Warranty periods",
    "blurb": "Quick assess + year tables from current Rinnai AU warranty booklets (rinnai.com.au/support/warranty). Confirm the booklet before Charge Type = Warranty.",
    "steps": [
        {
            "n": 1,
            "text": "Pick the product family first. Domestic vs commercial uses a family °C limit — gas CF / Demand Duo pack 65°C, Hotflo / heat pump / solar 70°C, Efinity 60°C. Lodging-style (motel room, caravan, aged care unit) can still be Domestic only under that °C, and only if it is not bulk HW or building flow-and-return.",
        },
        {
            "n": 2,
            "text": "Clock starts at install date. If unknown, use manufacture date on the dataplate + 2 months. Age the claim from that date.",
        },
        {
            "n": 3,
            "text": "Parts years and labour years are separate. Heat exchanger / cylinder often lasts longer than other parts. Read the matching table row + footnotes, then run the quick tool.",
        },
        {
            "n": 4,
            "text": "Warranty work needs Rinnai authorisation before you start. Registration on the website is not the same as a fault claim — faults go Book a Service / assessment. Desk aid only; Rinnai’s Work Order close-off wins.",
        },
    ],
    "tables": [
        {
            "title": "Gas continuous flow (booklet Feb 2025)",
            "headers": [
                "Use",
                "Product group",
                "Heat exchanger (parts)",
                "Other parts",
                "Labour",
            ],
            "rows": [
                [
                    "Domestic",
                    "Infinity / Black B26 (3)",
                    "12 yr or Ext 25 (1)",
                    "3 yr (2)",
                    "3 yr (2)",
                ],
                [
                    "Domestic",
                    "Infinity Enviro (3)",
                    "12 yr or Ext 25 (1)",
                    "3 yr (2)",
                    "3 yr (2)",
                ],
                [
                    "Domestic",
                    "Builders (3)",
                    "10 yr or Ext 15 (1)",
                    "3 yr (2)",
                    "3 yr (2)",
                ],
                ["Domestic", "HD / HDC (3)", "12 yr", "5 yr", "5 yr"],
                ["Domestic", "Flowmaster 10 (3)(5)", "10 yr", "3 yr", "3 yr"],
                ["Commercial", "Infinity / Black B26 / Enviro / Flowmaster", "1 yr", "1 yr", "1 yr"],
                ["Commercial", "HD / HDC (3)", "5 yr (6)", "3 yr (6)", "3 yr (6)"],
            ],
            "footnote": [
                "Domestic lodging-style ceiling for this booklet: 65°C.",
                "(1) Extended HEX option — not automatic; check T&Cs / Rinnai.",
                "(2) Domestic: 5 years parts+labour if two or more controllers.",
                "(3) Not for solar unless HD on Rinnai Demand Duo solar boost, or unit converted by Rinnai for Rinnai solar.",
                "(5) Frost / long below-0°C installs not covered.",
                "(6) HD commercial HEX drops to 1 year parts+labour if preset 85°C or 95°C.",
                "Standalone HD uses this table. HD inside Demand Duo / manifold pack also see Commercial pack table.",
            ],
        },
        {
            "title": "Gas CF accessories (same booklet)",
            "headers": ["Use", "Accessory", "Parts", "Labour"],
            "rows": [
                ["Domestic", "SmartStart (REU-CUG1)", "3 yr", "3 yr"],
                ["Domestic", "Water controllers", "3 yr (2)", "3 yr (2)"],
                ["Domestic", "Other accessories (4)", "1 yr", "1 yr"],
                ["Commercial", "SmartStart / controllers / other", "1 yr", "1 yr"],
            ],
            "footnote": [
                "(2) Domestic controllers: 5 years if two or more installed.",
                "(4) Pipe covers, recess boxes, security brackets, flue diverters, coaxial flueing.",
            ],
        },
        {
            "title": "Efinity electric continuous flow (booklet Mar 2024)",
            "headers": ["Use", "Heat exchanger", "Other parts", "Labour"],
            "rows": [
                ["Domestic", "5 yr", "5 yr", "5 yr"],
                ["Commercial", "1 yr", "1 yr", "1 yr"],
            ],
            "footnote": [
                "Domestic ceiling: 60°C. Indoor only. Not for solar, spa/pool, or long frost sites.",
            ],
        },
        {
            "title": "Hotflo electric storage (booklet May 2021)",
            "headers": ["Use", "Coverage", "Cylinder", "Other components"],
            "rows": [
                ["Domestic 80–400 L", "Parts", "10 yr", "1 yr"],
                ["Domestic 80–400 L", "Labour", "3 yr", "1 yr"],
                ["Domestic 25 / 50 L", "Parts", "7 yr", "1 yr"],
                ["Domestic 25 / 50 L", "Labour", "3 yr", "1 yr"],
                ["Commercial any size", "Parts / labour", "1 yr", "1 yr"],
            ],
            "footnote": [
                "Domestic ceiling: 70°C. Components = sensors, thermostats, valves, elements, anodes.",
            ],
        },
        {
            "title": "Enviroflo heat pump (booklet Nov 2023)",
            "headers": [
                "Series",
                "Use",
                "Coverage",
                "Cylinder",
                "Refrigeration (1)",
                "Other (2)",
            ],
            "rows": [
                ["EHPA", "Domestic", "Parts", "7 yr", "3 yr", "1 yr"],
                ["EHPA", "Domestic", "Labour", "3 yr", "3 yr", "1 yr"],
                ["EHPS / EHPT", "Domestic", "Parts", "5 yr", "3 yr", "1 yr"],
                ["EHPS / EHPT", "Domestic", "Labour", "3 yr", "1 yr", "1 yr"],
                ["Any", "Commercial", "Parts / labour", "1 yr", "1 yr", "1 yr"],
            ],
            "footnote": [
                "Domestic ceiling: 70°C.",
                "(1) Compressor, condenser, TXV, HEX, evaporator, assoc. pipework.",
                "(2) Sensors, thermostats, valves, elements, anodes.",
                "Solar Victoria rebate (domestic from 1 Jul 2023): may be 5-year whole-of-product parts+labour — confirm with Rinnai 1300 555 545.",
            ],
        },
        {
            "title": "Solar hot water (booklet Oct 2024) — domestic parts snapshot",
            "headers": ["Item", "Parts (domestic)", "Labour (domestic)"],
            "rows": [
                ["S20 / S26 / Rinnai-converted solar CF — HEX", "12 yr", "3 yr"],
                ["Same — other CF parts", "3 yr", "3 yr"],
                ["VE cylinder ground / roof", "10 / 5 yr", "3 yr"],
                ["Stainless cylinder", "10 yr", "3 yr"],
                ["Flat plate (Enduro family)", "7 yr", "1 yr"],
                ["Evacuated tube (+ manifold)", "15 yr", "1 yr"],
                ["Other components", "1 yr", "1 yr"],
            ],
            "footnote": [
                "Domestic ceiling: 70°C. Commercial years are shorter (often 1–5) — see booklet or chase Rinnai if unsure.",
                "Roof systems without pumped frost protection: frost damage not covered in known frost areas.",
            ],
        },
        {
            "title": "Commercial pack — Demand Duo / manifold / QRE (booklet Dec 2024)",
            "headers": ["Item", "Domestic parts / labour", "Commercial parts / labour"],
            "rows": [
                ["HD booster HEX in DD / MP", "12 / 5", "5 / 3 (1 yr if 85/95°C)"],
                ["HD booster other parts", "5 / 5", "3 / 3"],
                ["SS QRE / storage cylinder", "10 / 3", "7 / 1 (1 yr if >76°C)"],
                ["VE QRE / storage cylinder", "10 / 3", "5 / 1 (1 yr if >76°C)"],
                ["Commercial air-to-water HP", "—", "2 / 2"],
                ["Common flue / power flue fan", "1 / 1", "1 / 1"],
            ],
            "footnote": [
                "Domestic ceiling for this booklet: 65°C. Standalone HD → gas CF table, not this pack.",
            ],
        },
    ],
    "notes": [
        "Source: https://www.rinnai.com.au/support/warranty ingest 2026-11-14 (Project store docs/rinnai-au-warranty-support-ingest.md).",
        "Do not invent cover for GHF gas storage or non-HW (fires / AC) — chase Rinnai or open that family’s booklet.",
    ],
    "checker": {
        "heading": "This quick tool can help you assess - Answer the following questions.",
        "disclaimer": "Desk aid for newbies — not Rinnai’s final say. Confirm the current booklet before Charge Type = Warranty.",
        "startId": "family",
        "questions": {},
        "outcomes": {
            "labour_parts": {
                "title": "Likely warranty — labour + parts",
                "detail": "Age looks inside both labour and parts years. Set Charge Type = Warranty only if model, serial, and install/manufacture date on the Asset are correct — and Rinnai has authorised the visit.",
            },
            "parts_only": {
                "title": "Likely warranty — parts only",
                "detail": "Parts years still look open; labour looks outside the band. Quote labour to the customer (or check booklet) before promising a free call-out.",
            },
            "chargeable": {
                "title": "Likely chargeable",
                "detail": "Age looks past the matching years. Treat as customer-paid unless Rinnai confirms otherwise in writing.",
            },
            "chase_rinnai": {
                "title": "Chase Rinnai / check booklet",
                "detail": "Borderline or special path (extended HEX, dual controllers, frost, high-temp preset, Solar Victoria rebate, odd commercial pack). Do not invent cover — booklet or Rinnai first.",
            },
            "insufficient": {
                "title": "Need more info",
                "detail": "Need family, domestic vs commercial, what failed, and a rough age (or install / manufacture date) before picking Charge Type.",
            },
        },
        "examplesNote": "Family chips map to current AU HW warranty booklets. Confirm imprint date on rinnai.com.au/support/warranty.",
    },
}

# --- build checker questions ---
q: dict = {}

q["family"] = {
    "prompt": "What kind of product?",
    "choices": [
        {"label": "Gas continuous flow (Infinity / HD / Builders)", "next": "cf_solar", "exampleId": "cf"},
        {"label": "Efinity electric continuous flow", "next": "ef_use", "exampleId": "efinity"},
        {"label": "Controller / SmartStart / CF accessory", "next": "acc_use", "exampleId": "accessory"},
        {"label": "Hotflo electric storage tank", "next": "hotflo_size", "exampleId": "hotflo"},
        {"label": "Enviroflo heat pump", "next": "hp_series", "exampleId": "heat-pump"},
        {"label": "Solar hot water", "next": "sol_use", "exampleId": "solar"},
        {"label": "Demand Duo / manifold / QRE commercial pack", "next": "com_use", "exampleId": "commercial"},
        {"label": "Something else (GHF / fire / AC…)", "outcome": "chase_rinnai"},
    ],
}

# Gas CF
q["cf_solar"] = {
    "prompt": "Is this heater on a solar hot-water system?",
    "choices": [
        {"label": "No — normal gas continuous flow", "next": "cf_use"},
        {"label": "Yes — Demand Duo solar boost or Rinnai-converted for solar", "next": "cf_use"},
        {"label": "Yes — but not Demand Duo / not Rinnai-converted", "outcome": "chase_rinnai"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["cf_use"] = use_q("cf_dom_group", "cf_comm_group", 65)
q["cf_dom_group"] = {
    "prompt": "Which domestic gas continuous flow group?",
    "choices": [
        {"label": "Infinity / Enviro / Black B26", "next": "cf_dom_inf_fail"},
        {"label": "Builders (B16–B26)", "next": "cf_dom_bld_fail"},
        {"label": "HD / HDC", "next": "cf_dom_hd_fail"},
        {"label": "Flowmaster 10", "next": "cf_dom_fm_fail"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["cf_dom_inf_fail"] = fail_q(
    [("Heat exchanger", "cf_dom_inf_hex_age"), ("Other parts", "cf_dom_inf_other_age")]
)
q["cf_dom_inf_hex_age"] = {
    "prompt": "How old is the unit? (Infinity / Enviro / B26 heat exchanger — parts 12 yr, labour 3 yr)",
    "choices": age_choices(3, 12, over_outcome="chase_rinnai", over_label="Older than 12 years / has extended cover?"),
}
q["cf_dom_inf_other_age"] = {
    "prompt": "How old? (other parts — usually 3 yr; 5 yr if two or more controllers)",
    "choices": [
        {"label": "3 years old or less", "outcome": "labour_parts"},
        {"label": "Between 3 and 5 years, and 2+ controllers", "outcome": "chase_rinnai"},
        {"label": "Older than 3 years, only one controller (or none)", "outcome": "chargeable"},
        {"label": "Not sure / age unknown", "outcome": "insufficient"},
    ],
}
q["cf_dom_bld_fail"] = fail_q(
    [("Heat exchanger", "cf_dom_bld_hex_age"), ("Other parts", "cf_dom_bld_other_age")]
)
q["cf_dom_bld_hex_age"] = {
    "prompt": "How old? (Builders heat exchanger — parts 10 yr, labour 3 yr)",
    "choices": age_choices(3, 10, over_outcome="chase_rinnai", over_label="Older than 10 years / extended cover?"),
}
q["cf_dom_bld_other_age"] = {
    "prompt": "How old? (Builders other parts — 3 yr parts + labour)",
    "choices": age_choices(None, 3),
}
q["cf_dom_hd_fail"] = fail_q(
    [("Heat exchanger", "cf_dom_hd_hex_age"), ("Other parts", "cf_dom_hd_other_age")]
)
q["cf_dom_hd_hex_age"] = {
    "prompt": "How old? (HD domestic heat exchanger — parts 12 yr, labour 5 yr)",
    "choices": age_choices(5, 12),
}
q["cf_dom_hd_other_age"] = {
    "prompt": "How old? (HD domestic other parts — 5 yr parts + labour)",
    "choices": age_choices(None, 5),
}
q["cf_dom_fm_fail"] = {
    "prompt": "What failed? (Frost damage on Flowmaster is usually not covered.)",
    "choices": [
        {"label": "Heat exchanger — not frost", "next": "cf_dom_fm_hex_age"},
        {"label": "Other parts — not frost", "next": "cf_dom_fm_other_age"},
        {"label": "Frost / freeze damage", "outcome": "chase_rinnai"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["cf_dom_fm_hex_age"] = {
    "prompt": "How old? (Flowmaster heat exchanger — parts 10 yr, labour 3 yr)",
    "choices": age_choices(3, 10),
}
q["cf_dom_fm_other_age"] = {
    "prompt": "How old? (Flowmaster other parts — 3 yr)",
    "choices": age_choices(None, 3),
}
q["cf_comm_group"] = {
    "prompt": "Which commercial gas continuous flow group?",
    "choices": [
        {"label": "Infinity / Enviro / Black B26 / Flowmaster", "next": "cf_comm_inf_age"},
        {"label": "HD / HDC", "next": "cf_comm_hd_temp"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["cf_comm_inf_age"] = {
    "prompt": "How old? (commercial Infinity / Enviro / Flowmaster — 1 yr parts + labour)",
    "choices": age_choices(None, 1),
}
q["cf_comm_hd_temp"] = {
    "prompt": "Is the HD preset to 85°C or 95°C? (that drops heat-exchanger cover to 1 year)",
    "choices": [
        {"label": "Normal preset", "next": "cf_comm_hd_fail"},
        {"label": "85°C or 95°C", "next": "cf_comm_hd_hi_age"},
        {"label": "Not sure", "outcome": "chase_rinnai"},
    ],
}
q["cf_comm_hd_fail"] = fail_q(
    [("Heat exchanger", "cf_comm_hd_hex_age"), ("Other parts", "cf_comm_hd_other_age")]
)
q["cf_comm_hd_hex_age"] = {
    "prompt": "How old? (HD commercial heat exchanger — parts 5 yr, labour 3 yr)",
    "choices": age_choices(3, 5),
}
q["cf_comm_hd_other_age"] = {
    "prompt": "How old? (HD commercial other parts — 3 yr)",
    "choices": age_choices(None, 3),
}
q["cf_comm_hd_hi_age"] = {
    "prompt": "How old? (HD high-temp preset — 1 yr parts + labour)",
    "choices": age_choices(None, 1),
}

# Efinity
q["ef_use"] = use_q("ef_dom_age", "ef_comm_age", 60)
q["ef_dom_age"] = {
    "prompt": "How old? (Efinity domestic — heat exchanger, other parts and labour all 5 yr)",
    "choices": age_choices(None, 5),
}
q["ef_comm_age"] = {
    "prompt": "How old? (Efinity commercial — 1 yr parts + labour)",
    "choices": age_choices(None, 1),
}

# Accessories
q["acc_use"] = use_q("acc_dom_type", "acc_comm_age", 65)
q["acc_dom_type"] = {
    "prompt": "Which accessory?",
    "choices": [
        {"label": "SmartStart", "next": "acc_dom_ss_age"},
        {"label": "Controller(s)", "next": "acc_dom_ctrl_age"},
        {"label": "Other accessory", "next": "acc_dom_other_age"},
    ],
}
q["acc_dom_ss_age"] = {
    "prompt": "How old? (SmartStart domestic — 3 yr)",
    "choices": age_choices(None, 3),
}
q["acc_dom_ctrl_age"] = {
    "prompt": "How old? (controllers — 3 yr; 5 yr if two or more)",
    "choices": [
        {"label": "3 years old or less", "outcome": "labour_parts"},
        {"label": "Between 3 and 5 years, and 2+ controllers", "outcome": "chase_rinnai"},
        {"label": "Outside that band", "outcome": "chargeable"},
        {"label": "Not sure / age unknown", "outcome": "insufficient"},
    ],
}
q["acc_dom_other_age"] = {
    "prompt": "How old? (other domestic accessory — 1 yr)",
    "choices": age_choices(None, 1),
}
q["acc_comm_age"] = {
    "prompt": "How old? (commercial CF accessory — 1 yr)",
    "choices": age_choices(None, 1),
}

# Hotflo
q["hotflo_size"] = {
    "prompt": "Which Hotflo size?",
    "choices": [
        {"label": "80–400 L (or EHFA / EHFD)", "next": "hotflo_use"},
        {"label": "25 L or 50 L", "next": "hotflo_small_use"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["hotflo_use"] = use_q("hotflo_dom_fail", "hotflo_comm_age", 70)
q["hotflo_small_use"] = use_q("hotflo_small_dom_fail", "hotflo_comm_age", 70)
q["hotflo_dom_fail"] = fail_q(
    [("Cylinder / tank", "hotflo_dom_cyl_age"), ("Other parts (element, thermostat…)", "hotflo_dom_comp_age")]
)
q["hotflo_dom_cyl_age"] = {
    "prompt": "How old? (domestic cylinder 80–400 L — parts 10 yr, labour 3 yr)",
    "choices": age_choices(3, 10),
}
q["hotflo_dom_comp_age"] = {
    "prompt": "How old? (domestic other parts — 1 yr)",
    "choices": age_choices(None, 1),
}
q["hotflo_small_dom_fail"] = fail_q(
    [("Cylinder / tank", "hotflo_small_cyl_age"), ("Other parts", "hotflo_dom_comp_age")]
)
q["hotflo_small_cyl_age"] = {
    "prompt": "How old? (25/50 L domestic cylinder — parts 7 yr, labour 3 yr)",
    "choices": age_choices(3, 7),
}
q["hotflo_comm_age"] = {
    "prompt": "How old? (commercial Hotflo — 1 yr parts + labour)",
    "choices": age_choices(None, 1),
}

# Heat pump
q["hp_series"] = {
    "prompt": "Which Enviroflo series? (model starts with…)",
    "choices": [
        {"label": "EHPA", "next": "hp_rebate"},
        {"label": "EHPS or EHPT", "next": "hp_rebate_s"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["hp_rebate"] = {
    "prompt": "Did this domestic install get a Solar Victoria hot-water rebate (from 1 Jul 2023)?",
    "choices": [
        {"label": "No / not Victoria rebate", "next": "hp_use"},
        {"label": "Yes — possible 5-year whole-product cover", "outcome": "chase_rinnai"},
        {"label": "Not sure", "next": "hp_use"},
    ],
}
q["hp_rebate_s"] = {
    "prompt": "Did this domestic install get a Solar Victoria hot-water rebate (from 1 Jul 2023)?",
    "choices": [
        {"label": "No / not Victoria rebate", "next": "hps_use"},
        {"label": "Yes — possible 5-year whole-product cover", "outcome": "chase_rinnai"},
        {"label": "Not sure", "next": "hps_use"},
    ],
}
q["hp_use"] = use_q("hp_dom_fail", "hp_comm_age", 70)
q["hps_use"] = use_q("hps_dom_fail", "hp_comm_age", 70)
q["hp_dom_fail"] = fail_q(
    [
        ("Cylinder / tank", "hp_dom_cyl_age"),
        ("Refrigeration (compressor / outdoor side)", "hp_dom_ref_age"),
        ("Other parts", "hp_dom_other_age"),
    ]
)
q["hp_dom_cyl_age"] = {
    "prompt": "How old? (EHPA domestic cylinder — parts 7 yr, labour 3 yr)",
    "choices": age_choices(3, 7),
}
q["hp_dom_ref_age"] = {
    "prompt": "How old? (EHPA refrigeration — parts 3 yr, labour 3 yr)",
    "choices": age_choices(None, 3),
}
q["hp_dom_other_age"] = {
    "prompt": "How old? (EHPA other parts — 1 yr)",
    "choices": age_choices(None, 1),
}
q["hps_dom_fail"] = fail_q(
    [
        ("Cylinder / tank", "hps_dom_cyl_age"),
        ("Refrigeration (compressor / outdoor side)", "hps_dom_ref_age"),
        ("Other parts", "hps_dom_other_age"),
    ]
)
q["hps_dom_cyl_age"] = {
    "prompt": "How old? (EHPS/EHPT domestic cylinder — parts 5 yr, labour 3 yr)",
    "choices": age_choices(3, 5),
}
q["hps_dom_ref_age"] = {
    "prompt": "How old? (EHPS/EHPT refrigeration — parts 3 yr, labour 1 yr)",
    "choices": age_choices(1, 3),
}
q["hps_dom_other_age"] = {
    "prompt": "How old? (EHPS/EHPT other parts — 1 yr)",
    "choices": age_choices(None, 1),
}
q["hp_comm_age"] = {
    "prompt": "How old? (commercial Enviroflo — 1 yr parts + labour)",
    "choices": age_choices(None, 1),
}

# Solar
q["sol_use"] = use_q("sol_dom_fail", "sol_comm", 70)
q["sol_dom_fail"] = {
    "prompt": "What failed on the solar system?",
    "choices": [
        {"label": "Gas booster heat exchanger (S20/S26 / converted)", "next": "sol_dom_hex_age"},
        {"label": "Gas booster other parts", "next": "sol_dom_other_cf_age"},
        {"label": "Storage cylinder", "next": "sol_dom_cyl_type"},
        {"label": "Collector (flat plate or tube)", "next": "sol_dom_col_type"},
        {"label": "Pump / controller / other", "next": "sol_dom_misc_age"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["sol_dom_hex_age"] = {
    "prompt": "How old? (solar CF heat exchanger — parts 12 yr, labour 3 yr)",
    "choices": age_choices(3, 12),
}
q["sol_dom_other_cf_age"] = {
    "prompt": "How old? (solar CF other parts — 3 yr)",
    "choices": age_choices(None, 3),
}
q["sol_dom_cyl_type"] = {
    "prompt": "Which cylinder?",
    "choices": [
        {"label": "Vitreous enamel — ground mounted", "next": "sol_dom_cyl_ve_g"},
        {"label": "Vitreous enamel — roof mounted", "next": "sol_dom_cyl_ve_r"},
        {"label": "Stainless steel", "next": "sol_dom_cyl_ss"},
        {"label": "Not sure", "outcome": "chase_rinnai"},
    ],
}
q["sol_dom_cyl_ve_g"] = {
    "prompt": "How old? (VE ground cylinder — parts 10 yr, labour 3 yr)",
    "choices": age_choices(3, 10),
}
q["sol_dom_cyl_ve_r"] = {
    "prompt": "How old? (VE roof cylinder — parts 5 yr, labour 3 yr)",
    "choices": age_choices(3, 5),
}
q["sol_dom_cyl_ss"] = {
    "prompt": "How old? (stainless cylinder — parts 10 yr, labour 3 yr)",
    "choices": age_choices(3, 10),
}
q["sol_dom_col_type"] = {
    "prompt": "Which collector? (frost on unprotected roof systems → chase Rinnai)",
    "choices": [
        {"label": "Flat plate (Enduro family)", "next": "sol_dom_fp_age"},
        {"label": "Evacuated tube", "next": "sol_dom_evt_age"},
        {"label": "Frost damage / not sure", "outcome": "chase_rinnai"},
    ],
}
q["sol_dom_fp_age"] = {
    "prompt": "How old? (flat plate domestic — parts 7 yr, labour 1 yr)",
    "choices": age_choices(1, 7),
}
q["sol_dom_evt_age"] = {
    "prompt": "How old? (evacuated tube domestic — parts 15 yr, labour 1 yr)",
    "choices": age_choices(1, 15),
}
q["sol_dom_misc_age"] = {
    "prompt": "How old? (other solar components — 1 yr)",
    "choices": age_choices(None, 1),
}
q["sol_comm"] = {
    "prompt": "Commercial solar years are shorter and fiddly — open the Solar booklet table or ask Rinnai?",
    "choices": [
        {"label": "I’ll check the Solar booklet / Rinnai", "outcome": "chase_rinnai"},
        {"label": "Unit is 1 year old or less (likely still in many commercial bands)", "outcome": "labour_parts"},
        {"label": "Older than 1 year", "outcome": "chase_rinnai"},
    ],
}

# Commercial pack
q["com_use"] = use_q("com_dom_type", "com_comm_type", 65)
q["com_dom_type"] = {
    "prompt": "What failed in the commercial pack (domestic use)?",
    "choices": [
        {"label": "HD booster heat exchanger", "next": "com_dom_hd_hex"},
        {"label": "HD booster other parts", "next": "com_dom_hd_other"},
        {"label": "QRE / storage cylinder", "next": "com_dom_qre"},
        {"label": "Something else", "outcome": "chase_rinnai"},
    ],
}
q["com_dom_hd_hex"] = {
    "prompt": "How old? (DD/MP HD HEX domestic — parts 12 yr, labour 5 yr)",
    "choices": age_choices(5, 12),
}
q["com_dom_hd_other"] = {
    "prompt": "How old? (DD/MP HD other domestic — 5 yr)",
    "choices": age_choices(None, 5),
}
q["com_dom_qre"] = {
    "prompt": "How old? (QRE/storage cylinder domestic — parts 10 yr, labour 3 yr)",
    "choices": age_choices(3, 10),
}
q["com_comm_type"] = {
    "prompt": "What failed (commercial use)?",
    "choices": [
        {"label": "HD booster — check 85/95°C preset", "next": "com_comm_hd_temp"},
        {"label": "QRE / storage cylinder — check if set over 76°C", "next": "com_comm_qre_temp"},
        {"label": "Commercial heat pump (CHP)", "next": "com_comm_chp"},
        {"label": "Common flue / other", "outcome": "chase_rinnai"},
    ],
}
q["com_comm_hd_temp"] = {
    "prompt": "HD booster preset?",
    "choices": [
        {"label": "Normal", "next": "com_comm_hd_fail"},
        {"label": "85°C or 95°C", "next": "com_comm_hd_hi"},
        {"label": "Not sure", "outcome": "chase_rinnai"},
    ],
}
q["com_comm_hd_fail"] = fail_q(
    [("Heat exchanger", "com_comm_hd_hex"), ("Other parts", "com_comm_hd_other")]
)
q["com_comm_hd_hex"] = {
    "prompt": "How old? (commercial DD/MP HD HEX — parts 5 yr, labour 3 yr)",
    "choices": age_choices(3, 5),
}
q["com_comm_hd_other"] = {
    "prompt": "How old? (commercial DD/MP HD other — 3 yr)",
    "choices": age_choices(None, 3),
}
q["com_comm_hd_hi"] = {
    "prompt": "How old? (high-temp HD HEX — 1 yr)",
    "choices": age_choices(None, 1),
}
q["com_comm_qre_temp"] = {
    "prompt": "Is the cylinder set temperature over 76°C?",
    "choices": [
        {"label": "No — normal", "next": "com_comm_qre_age"},
        {"label": "Yes — over 76°C (1 yr only)", "next": "com_comm_qre_hi"},
        {"label": "Not sure", "outcome": "chase_rinnai"},
    ],
}
q["com_comm_qre_age"] = {
    "prompt": "Stainless or vitreous? (SS parts 7 yr / VE 5 yr; labour 1 yr) — pick the safer labour+parts band if unsure.",
    "choices": [
        {"label": "1 year old or less", "outcome": "labour_parts"},
        {"label": "Between 1 and 5 years (parts only — confirm SS/VE in booklet)", "outcome": "parts_only"},
        {"label": "Older than 7 years (or 5 if VE)", "outcome": "chargeable"},
        {"label": "Not sure", "outcome": "chase_rinnai"},
    ],
}
q["com_comm_qre_hi"] = {
    "prompt": "How old? (>76°C cylinder — 1 yr)",
    "choices": age_choices(None, 1),
}
q["com_comm_chp"] = {
    "prompt": "How old? (commercial air-to-water heat pump — 2 yr parts + labour)",
    "choices": age_choices(None, 2),
}

WARRANTY_TOPIC["checker"]["questions"] = q


def main() -> None:
    detailed = json.loads(DETAILED.read_text(encoding="utf-8"))
    topics = detailed.get("topics") or []
    idx = next((i for i, t in enumerate(topics) if t.get("id") == "warranty"), None)
    if idx is None:
        raise SystemExit("warranty topic not found")
    topics[idx] = WARRANTY_TOPIC
    detailed["topics"] = topics
    DETAILED.write_text(json.dumps(detailed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {DETAILED} warranty topic; questions={len(q)}")

    basic = json.loads(BASIC.read_text(encoding="utf-8"))
    for ch in basic.get("chapters") or []:
        if ch.get("id") != "warranty":
            continue
        ch["blurb"] = "Years differ by product — use the quick tool below."
        ch["body"] = [
            "Warranty years depend on the product family (heat exchanger / cylinder / compressor / other parts / labour) and whether the install is domestic or commercial — the °C limit depends on the family too.",
            "Use This quick tool can help you assess below (short yes/no-style questions). It suggests likely warranty labour+parts, parts only, chargeable, or chase Rinnai.",
            "For the full year tables, use Change instruction level → Detailed → Warranty. Always confirm the current Rinnai booklet before promising cover.",
            "That checker is a desk aid — if Rinnai later disagrees, follow what Rinnai closes on the Work Order.",
        ]
    BASIC.write_text(json.dumps(basic, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {BASIC} warranty chapter")


if __name__ == "__main__":
    main()
