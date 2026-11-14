#!/usr/bin/env python3
"""Reshape Process warranty topic + checker from AU booklet ingest (KISS).

Kill every chase-booklet / chase-Rinnai terminal. Wire yes/no prompts from
warranty-chase-kill-brief.md. Grey leftovers → escalate_rinnai rider.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DETAILED = ROOT / "public" / "data" / "rinnai-process.json"
BASIC = ROOT / "public" / "data" / "rinnai-process-basic.json"

ESCALATE = "escalate_rinnai"


def age_choices(
    labour_years: int | None,
    parts_years: int,
    *,
    labour_parts_label: str | None = None,
    parts_only_label: str | None = None,
    over_label: str | None = None,
    over_outcome: str = "chargeable",
    over_next: str | None = None,
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
        over: dict = {
            "label": over_label or f"Older than {y} years",
        }
        if over_next:
            over["next"] = over_next
        else:
            over["outcome"] = over_outcome
        choices.append(over)
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
        over = {"label": over_label or f"Older than {parts_years} years"}
        if over_next:
            over["next"] = over_next
        else:
            over["outcome"] = over_outcome
        choices.append(over)
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
    "blurb": "Newbie desk aid: answer the quick tool, follow the outcome card. Grey → manager or Rinnai 1300 555 545.",
    "steps": [
        {
            "n": 1,
            "text": "Gate 1 — Period (is it still in years?): Find the install date on the job / proof of purchase. If nobody knows install date, read manufacture date on the metal data plate and add 2 months. Then run the quick tool below — it asks the age in plain English. Outside the years → customer pays (chargeable).",
        },
        {
            "n": 2,
            "text": "Gate 2 — Compliant install: Was a licensed tradesperson used, and does the install look normal for plumbing/gas rules (AS/NZS 3500 & 5601)? If clearly not → not warranty; customer pays. Also check domestic vs commercial using the family °C limit shown in the tool (gas CF / Demand Duo 65°C, Hotflo / heat pump / solar 70°C, Efinity 60°C).",
        },
        {
            "n": 3,
            "text": "Gate 3 — Correct application: Is this the right kind of unit for the job? A normal home continuous-flow heater stuck on a commercial loop or a non-Rinnai solar system is usually not warranty. Exception the tool knows: HD Demand Duo solar boost, or a unit Rinnai converted for Rinnai solar. Wrong application → customer pays.",
        },
        {
            "n": 4,
            "text": "Gate 4 — Water chemistry: Mains water that looks normal is usually fine. Raw bore, dam, or “funny chemistry” water often voids warranty → customer pays. If the site is more than about 40 km from an authorised provider (or off mainland), travel may still be customer-paid even when parts are covered — ask your manager or Rinnai if unsure.",
        },
        {
            "n": 5,
            "text": "Gate 5 — What actually failed?: Clear Rinnai factory part fault → Next action matches the tool (authorise, then Charge Type = Warranty). Site/external → customer pays. Grey/disputed → same next action as the grey card: manager first outside Mon–Fri 8:00–17:00 AEST; manager or Rinnai 1300 555 545 in hours; copy path; tick checklist; log case # / Covered vs Excluded; offload. Website “register product” is not a fault claim — faults go Book a Service / assessment.",
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
                "(1) Extended HEX only if registered with Rinnai — ask yes/no in the quick tool.",
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
                "Solar Victoria rebate (domestic from 1 Jul 2023): 5-year whole-of-product parts+labour when rebate applies — yes/no in the quick tool.",
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
                "Domestic ceiling: 70°C. Commercial years are shorter (often 1–5) — use the quick tool; grey → manager or 1300 555 545.",
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
        "Built for brand-new desk admins: answer the quick tool; follow the outcome card; grey → manager or 1300 555 545.",
        "Source snapshot: rinnai.com.au/support/warranty ingest 2026-11-14 (Project store docs/rinnai-au-warranty-support-ingest.md).",
        "GHF / fire / AC leftovers: grey card → escalate to manager or Rinnai.",
        "Rinnai must authorise warranty work before you promise free labour/parts. Replacement under warranty keeps the original appliance term.",
    ],
    "checker": {
        "heading": "This quick tool can help you assess - Answer the following questions.",
        "disclaimer": "For new desk staff — same tool on Basic and Detailed. Not Rinnai’s final say. Grey card: manager first outside hours; manager or 1300 555 545 in hours. Only set Charge Type = Warranty after Rinnai authorises.",
        "startId": "family",
        "questions": {},
        "outcomes": {
            "labour_parts": {
                "title": "Likely warranty — labour + parts",
                "detail": "Next action: check model + serial + install (or manufacture + 2 months) on the Asset are correct, then get Rinnai authorisation before you promise a free visit. Only then set Charge Type = Warranty. Remote sites may still pay travel.",
            },
            "parts_only": {
                "title": "Likely warranty — parts only",
                "detail": "Next action: parts may be free; labour probably is not. Tell the customer labour is chargeable unless Rinnai says otherwise in writing. Do not promise a free call-out.",
            },
            "chargeable": {
                "title": "Likely chargeable (customer pays)",
                "detail": "Next action: treat as customer-paid. Quote the customer. If someone disputes that, escalate to your manager first — or Rinnai on 1300 555 545 in help-line hours (Mon–Fri 8:00–17:00 AEST).",
            },
            "escalate_rinnai": {
                "title": "Resolution has reached a grey area, here’s the problems.",
                "detail": "Manager first outside hours; manager or Rinnai 1300 555 545 in hours. Relay the path, tick the checklist, log case # / Covered vs Excluded, and offload.",
            },
            "insufficient": {
                "title": "Need more info before you decide",
                "detail": "Next action: get (1) product family, (2) home vs commercial, (3) what failed, (4) rough age — install date, or manufacture date on the plate + 2 months. Ask the tech / customer. Then Reset and run the tool again. Do not set Charge Type yet.",
            },
        },
        "examplesNote": "Tap ⓘ for photo examples of each family. Year tables below are a desk cheat-sheet — the quick tool is the hand-holding path.",
        "escalation": {
            "headline": "Resolution has reached a grey area, here’s the problems.",
            "when": "This case may need to be either escalated to your manager, or Rinnai on 1300 555 545 to help reach a determination.",
            "whenOutsideHours": "Outside help-line hours right now — escalate to your manager first. Call Rinnai on 1300 555 545 Mon–Fri 8:00–17:00 AEST (next open window) if your manager wants an OEM ruling.",
            "pathLead": "The path taken to reach this outcome was:",
            "offload": "Take the Rinnai warranty case / reference number and offload the case: log case #, rep name, and Covered vs Excluded in the job notes before you proceed.",
            "beforeCall": [
                "Model (full REU / plate model)",
                "Serial number",
                "Install date or PoP (else manufacture + 2 months)",
                "Fault code + tech diagnostic notes",
                "Site type (resi vs commercial, water supply)",
            ],
            "phone": "1300 555 545",
            "hours": "Mon–Fri 8:00–17:00 AEST",
            "ivr": "Service / Warranty (or Technical Support if the tech is on site) → Hot Water / Commercial Hot Water",
            "backupPhone": "03 9271 6605",
            "log": "Rinnai case/ref #, rep name, and Covered vs Excluded in job notes before proceeding.",
            "caution": "Do not book Rinnai 1st Care without client/manager approval if the claim is disputed (call-out fee risk if working to spec / site damage).",
        },
    },
}

# --- build checker questions ---
q: dict = {}

q["family"] = {
    "prompt": "What kind of product?",
    "choices": [
        {"label": "Gas continuous flow (Infinity / HD / Builders)", "next": "cf_water", "exampleId": "cf"},
        {"label": "Efinity electric continuous flow", "next": "ef_water", "exampleId": "efinity"},
        {"label": "Controller / SmartStart / CF accessory", "next": "acc_water", "exampleId": "accessory"},
        {"label": "Hotflo electric storage tank", "next": "hotflo_water", "exampleId": "hotflo"},
        {"label": "Enviroflo heat pump", "next": "hp_water", "exampleId": "heat-pump"},
        {"label": "Solar hot water", "next": "sol_water", "exampleId": "solar"},
        {"label": "Demand Duo / manifold / QRE commercial pack", "next": "com_water", "exampleId": "commercial"},
        {"label": "Something else (GHF / fire / AC…)", "outcome": ESCALATE},
    ],
}

# Shared Gate 4 water + Gate 5 Rinnai-part (after family)
for prefix, nxt in [
    ("cf", "cf_solar"),
    ("ef", "ef_use"),
    ("acc", "acc_use"),
    ("hotflo", "hotflo_size"),
    ("hp", "hp_series"),
    ("sol", "sol_use"),
    ("com", "com_use"),
]:
    q[f"{prefix}_water"] = {
        "prompt": "Is the water supply mains water inside Rinnai’s water-quality table (not raw bore/dam / chemistry outside spec)?",
        "choices": [
            {"label": "Yes — mains / in-spec", "next": f"{prefix}_part"},
            {"label": "No — bore, dam, or outside water spec", "outcome": "chargeable"},
            {"label": "Not sure", "outcome": ESCALATE},
        ],
    }
    q[f"{prefix}_part"] = {
        "prompt": "Is the failed part a Rinnai-supplied part (not a third-party valve, pipe, or electrical fitting)?",
        "choices": [
            {"label": "Yes — Rinnai part", "next": nxt},
            {"label": "No — non-Rinnai / site-supplied", "outcome": "chargeable"},
            {"label": "Not sure", "outcome": ESCALATE},
        ],
    }

# Gas CF — solar application (Gate 3)
q["cf_solar"] = {
    "prompt": "Is this heater on a solar hot-water system?",
    "choices": [
        {"label": "No — normal gas continuous flow", "next": "cf_use"},
        {
            "label": "Yes — Heavy Duty Demand Duo solar boost or Rinnai-converted solar model",
            "next": "cf_use",
        },
        {
            "label": "Yes — but not Demand Duo / not Rinnai-converted",
            "outcome": "chargeable",
        },
        {"label": "Not sure / disputed", "outcome": ESCALATE},
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
    "prompt": "How old is the unit? (Infinity / Enviro / B26 heat exchanger — parts 12 yr, labour 3 yr). If install date unknown, use manufacture date + 2 months.",
    "choices": age_choices(
        3,
        12,
        over_label="Older than 12 years",
        over_next="cf_dom_inf_hex_ext",
    ),
}
q["cf_dom_inf_hex_ext"] = {
    "prompt": "Is extended heat-exchanger cover (25 years) registered with Rinnai for this unit?",
    "choices": [
        {"label": "Yes — registered extended HEX", "next": "cf_dom_inf_hex_ext_age"},
        {"label": "No — standard 12-year HEX only", "outcome": "chargeable"},
        {"label": "Not sure", "outcome": ESCALATE},
    ],
}
q["cf_dom_inf_hex_ext_age"] = {
    "prompt": "How old under extended HEX? (parts to 25 yr; labour still only 3 yr)",
    "choices": [
        {"label": "25 years old or less (parts only — labour already past 3 yr)", "outcome": "parts_only"},
        {"label": "Older than 25 years", "outcome": "chargeable"},
        {"label": "Not sure / age unknown", "outcome": "insufficient"},
    ],
}
q["cf_dom_inf_other_age"] = {
    "prompt": "How old? (other parts — usually 3 yr; 5 yr if two or more controllers)",
    "choices": [
        {"label": "3 years old or less", "outcome": "labour_parts"},
        {"label": "Between 3 and 5 years, and 2+ controllers", "outcome": "labour_parts"},
        {"label": "Older than 3 years, only one controller (or none)", "outcome": "chargeable"},
        {"label": "Not sure / age unknown", "outcome": "insufficient"},
    ],
}
q["cf_dom_bld_fail"] = fail_q(
    [("Heat exchanger", "cf_dom_bld_hex_age"), ("Other parts", "cf_dom_bld_other_age")]
)
q["cf_dom_bld_hex_age"] = {
    "prompt": "How old? (Builders heat exchanger — parts 10 yr, labour 3 yr). If install unknown → manufacture + 2 months.",
    "choices": age_choices(3, 10, over_label="Older than 10 years", over_next="cf_dom_bld_hex_ext"),
}
q["cf_dom_bld_hex_ext"] = {
    "prompt": "Is extended heat-exchanger cover (15 years) registered with Rinnai for this Builders unit?",
    "choices": [
        {"label": "Yes — registered extended HEX", "next": "cf_dom_bld_hex_ext_age"},
        {"label": "No — standard 10-year HEX only", "outcome": "chargeable"},
        {"label": "Not sure", "outcome": ESCALATE},
    ],
}
q["cf_dom_bld_hex_ext_age"] = {
    "prompt": "How old under extended HEX? (parts to 15 yr; labour still only 3 yr)",
    "choices": [
        {"label": "15 years old or less (parts only — labour already past 3 yr)", "outcome": "parts_only"},
        {"label": "Older than 15 years", "outcome": "chargeable"},
        {"label": "Not sure / age unknown", "outcome": "insufficient"},
    ],
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
    "prompt": "What failed? (Frost on Flowmaster in a long below-0°C site is not covered.)",
    "choices": [
        {"label": "Heat exchanger — not frost", "next": "cf_dom_fm_hex_age"},
        {"label": "Other parts — not frost", "next": "cf_dom_fm_other_age"},
        {"label": "Frost / freeze damage (known frost / unprotected)", "outcome": "chargeable"},
        {"label": "Frost claim disputed / not sure", "outcome": ESCALATE},
        {"label": "Not sure what failed", "outcome": "insufficient"},
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
        {"label": "Not sure", "outcome": ESCALATE},
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
        {"label": "Between 3 and 5 years, and 2+ controllers", "outcome": "labour_parts"},
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

# Heat pump — Solar Victoria
q["hp_series"] = {
    "prompt": "Which Enviroflo series? (model starts with…)",
    "choices": [
        {"label": "EHPA", "next": "hp_rebate"},
        {"label": "EHPS or EHPT", "next": "hp_rebate_s"},
        {"label": "Not sure", "outcome": "insufficient"},
    ],
}
q["hp_rebate"] = {
    "prompt": "Domestic install from 1 Jul 2023 that received a Solar Victoria / Solar Homes hot-water rebate?",
    "choices": [
        {"label": "No / not that rebate", "next": "hp_use"},
        {"label": "Yes — 5-year whole-of-product path", "next": "hp_rebate_age"},
        {"label": "Not sure", "outcome": ESCALATE},
    ],
}
q["hp_rebate_s"] = {
    "prompt": "Domestic install from 1 Jul 2023 that received a Solar Victoria / Solar Homes hot-water rebate?",
    "choices": [
        {"label": "No / not that rebate", "next": "hps_use"},
        {"label": "Yes — 5-year whole-of-product path", "next": "hp_rebate_age"},
        {"label": "Not sure", "outcome": ESCALATE},
    ],
}
q["hp_rebate_age"] = {
    "prompt": "How old? (Solar Victoria rebate — 5-year whole-of-product parts + labour)",
    "choices": age_choices(None, 5),
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
        {"label": "Not sure", "outcome": ESCALATE},
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
    "prompt": "Which collector? (Frost area + roof + no pumped frost protection → frost not warranted.)",
    "choices": [
        {"label": "Flat plate (Enduro family) — not frost", "next": "sol_dom_fp_age"},
        {"label": "Evacuated tube — not frost", "next": "sol_dom_evt_age"},
        {
            "label": "Frost damage on roof system without pumped frost protection",
            "outcome": "chargeable",
        },
        {"label": "Frost claim disputed / not sure", "outcome": ESCALATE},
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
    "prompt": "Commercial solar — how old is the unit? (many commercial bands are 1 year; grey leftovers escalate)",
    "choices": [
        {"label": "1 year old or less", "outcome": "labour_parts"},
        {"label": "Older than 1 year — still looks inside a known commercial band", "outcome": ESCALATE},
        {"label": "Older than 1 year — clearly outside", "outcome": "chargeable"},
        {"label": "Not sure", "outcome": ESCALATE},
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
        {"label": "Common flue / power flue fan", "next": "com_dom_flue"},
        {"label": "Something else / grey", "outcome": ESCALATE},
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
q["com_dom_flue"] = {
    "prompt": "How old? (common flue / power flue fan — 1 yr)",
    "choices": age_choices(None, 1),
}
q["com_comm_type"] = {
    "prompt": "What failed (commercial use)?",
    "choices": [
        {"label": "HD booster — check 85/95°C preset", "next": "com_comm_hd_temp"},
        {"label": "QRE / storage cylinder — check if set over 76°C", "next": "com_comm_qre_temp"},
        {"label": "Commercial heat pump (CHP)", "next": "com_comm_chp"},
        {"label": "Common flue / power flue fan", "next": "com_comm_flue"},
        {"label": "Something else / grey", "outcome": ESCALATE},
    ],
}
q["com_comm_hd_temp"] = {
    "prompt": "HD booster preset?",
    "choices": [
        {"label": "Normal", "next": "com_comm_hd_fail"},
        {"label": "85°C or 95°C", "next": "com_comm_hd_hi"},
        {"label": "Not sure", "outcome": ESCALATE},
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
        {"label": "No — normal", "next": "com_comm_qre_mat"},
        {"label": "Yes — over 76°C (1 yr only)", "next": "com_comm_qre_hi"},
        {"label": "Not sure", "outcome": ESCALATE},
    ],
}
q["com_comm_qre_mat"] = {
    "prompt": "Stainless or vitreous enamel cylinder?",
    "choices": [
        {"label": "Stainless (parts 7 yr, labour 1 yr)", "next": "com_comm_qre_ss"},
        {"label": "Vitreous enamel (parts 5 yr, labour 1 yr)", "next": "com_comm_qre_ve"},
        {"label": "Not sure", "outcome": ESCALATE},
    ],
}
q["com_comm_qre_ss"] = {
    "prompt": "How old? (SS QRE/storage commercial — parts 7 yr, labour 1 yr)",
    "choices": age_choices(1, 7),
}
q["com_comm_qre_ve"] = {
    "prompt": "How old? (VE QRE/storage commercial — parts 5 yr, labour 1 yr)",
    "choices": age_choices(1, 5),
}
q["com_comm_qre_hi"] = {
    "prompt": "How old? (>76°C cylinder — 1 yr)",
    "choices": age_choices(None, 1),
}
q["com_comm_chp"] = {
    "prompt": "How old? (commercial air-to-water heat pump — 2 yr parts + labour)",
    "choices": age_choices(None, 2),
}
q["com_comm_flue"] = {
    "prompt": "How old? (common flue / power flue fan — 1 yr)",
    "choices": age_choices(None, 1),
}

WARRANTY_TOPIC["checker"]["questions"] = q


def main() -> None:
    # Sanity: no chase_* outcomes left
    chase_hits = []
    for qid, node in q.items():
        for c in node.get("choices") or []:
            oc = str(c.get("outcome") or "")
            label = str(c.get("label") or "")
            if oc.startswith("chase") or "chase" in label.lower() or "booklet" in label.lower():
                chase_hits.append((qid, label, oc))
    if chase_hits:
        raise SystemExit(f"chase/booklet leftovers remain: {chase_hits}")

    detailed = json.loads(DETAILED.read_text(encoding="utf-8"))
    topics = detailed.get("topics") or []
    idx = next((i for i, t in enumerate(topics) if t.get("id") == "warranty"), None)
    if idx is None:
        raise SystemExit("warranty topic not found")
    topics[idx] = WARRANTY_TOPIC
    detailed["topics"] = topics
    DETAILED.write_text(json.dumps(detailed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    esc = sum(
        1
        for node in q.values()
        for c in node.get("choices") or []
        if c.get("outcome") == ESCALATE
    )
    print(f"updated {DETAILED} warranty topic; questions={len(q)}; escalate_terminals={esc}")

    basic = json.loads(BASIC.read_text(encoding="utf-8"))
    for ch in basic.get("chapters") or []:
        if ch.get("id") != "warranty":
            continue
        ch["blurb"] = "Zero-knowledge: same quick tool as Detailed — playbook only differs."
        ch["body"] = [
            "You do not need to know warranty history. Use the quick tool below — it is the exact same questions and outcomes as Detailed Process → Warranty. Basic only adds this plain-English playbook around it.",
            "Age starts at install date. If install is unknown, use the manufacture date on the metal data plate and add 2 months. Parts years and labour years can differ.",
            "Home vs commercial depends on delivery temperature: gas continuous flow / Demand Duo ≤65°C; Hotflo / heat pump / solar ≤70°C; Efinity ≤60°C. Over that (or bulk HW / building flow-and-return) = commercial.",
            "Next actions match the tool cards: labour+parts → authorise then Charge Type Warranty; parts only → quote labour; customer pays → quote (dispute → manager first, or 1300 in hours); need more info → ask tech then Reset; grey → manager first outside hours / manager or 1300 555 545 in hours, copy path, tick checklist, log case #, offload.",
            "Tap ⓘ on a family for a worked dataplate example. Year tables: {{link:detailed:warranty}}Detailed Process → Warranty{{/link}}. If Rinnai later disagrees on the Work Order, follow what Rinnai closes.",
        ]
    BASIC.write_text(json.dumps(basic, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {BASIC} warranty chapter")


if __name__ == "__main__":
    main()
