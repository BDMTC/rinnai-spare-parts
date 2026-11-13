"""
Hotflo EHFA160 proof extract → merge into public/data/edpl-part-map.json

Sheet is a single-page model×item matrix + exploded callouts (not CF row PL).
Carry-forward blanks like the printed table (H rows often only override anode).
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
PDF_NAME = "Hotflo EHFA160 Spare Parts List S111418B.pdf"
STEM = "pl-hotflo-ehfa160"
SERIES_IDS = ["ehfa160"]
CHASSIS_TOKENS = ["EHFA160", "Hotflo EHFA160", "HOTFLO EHFA160"]
PRIORITY = 20
DIAGRAM_DIR = ROOT / "src" / "assets" / "diagram-pages"
OUT_JSON = ROOT / "public" / "data" / "edpl-part-map.json"
CALLOUTS_JSON = ROOT / "public" / "data" / "diagram-callouts.json"

ITEM_NAMES = {
    "1": "ANODE",
    "2": "ELEMENT",
    "3": "ELECTRICAL COVER BOTTOM",
    "4": "ELECTRICAL COVER TOP",
    "5": "THERMOSTAT TOP",
    "6": "THERMOSTAT BOTTOM",
    "7": "PTR VALVE",
    "8": "PLUG TOP",
    "9": "PORT COVERS",
    "10": "END CAP",
}


def normalize_box(x0, y0, x1, y1, page_w, page_h, *, pad=0.006):
    x = max(0.0, (x0 / page_w) - pad)
    y = max(0.0, (y0 / page_h) - pad)
    w = min(1.0 - x, ((x1 - x0) / page_w) + 2 * pad)
    h = min(1.0 - y, ((y1 - y0) / page_h) + 2 * pad)
    return {
        "x": round(x, 5),
        "y": round(y, 5),
        "w": round(max(w, 0.008), 5),
        "h": round(max(h, 0.006), 5),
    }


def parse_matrix_rows(text: str) -> list[dict]:
    """
    Parse MODEL / ITEM table with carry-forward.
    Returns rows: {model, items: {callout: code|None}}
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # Find model block start
    start = None
    for i, ln in enumerate(lines):
        if ln.upper() == "EHFA160S18":
            start = i
            break
    if start is None:
        return []

    models: list[dict] = []
    i = start
    while i < len(lines):
        ln = lines[i]
        if re.fullmatch(r"EHFA160[A-Z0-9]+", ln, flags=re.I):
            model = ln.upper()
            cells: list[str] = []
            j = i + 1
            while j < len(lines) and len(cells) < 10:
                cell = lines[j].strip()
                if re.fullmatch(r"EHFA160[A-Z0-9]+", cell, flags=re.I):
                    break
                if cell.upper() in {"WEIGHT", "SCALE", "A3 SIZE", "HOTFLO EHFA160 SPARE PARTS LIST"}:
                    break
                if re.fullmatch(r"\d{8}", cell) or cell.upper() in {"N/A", "NA", "-"}:
                    cells.append(cell.upper() if cell.upper() in {"N/A", "NA"} else cell)
                    j += 1
                    continue
                # stop on non-cell noise
                break
            models.append({"model": model, "cells": cells})
            i = j
            continue
        if ln.upper() in {"WEIGHT", "SCALE"} or ln.startswith("Hotflo"):
            break
        i += 1

    # Carry-forward across model rows (blank trailing cells inherit)
    carried = ["N/A"] * 10
    out = []
    for row in models:
        cells = list(row["cells"])
        while len(cells) < 10:
            cells.append("")  # blank = inherit
        resolved = []
        for idx in range(10):
            raw = cells[idx].strip()
            if not raw:
                raw = carried[idx]
            elif raw.upper() in {"N/A", "NA", "-"}:
                raw = "N/A"
                carried[idx] = "N/A"
            else:
                carried[idx] = raw
            resolved.append(raw)
        items = {}
        for idx, code in enumerate(resolved, start=1):
            if code == "N/A":
                continue
            if re.fullmatch(r"\d{8}", code):
                items[str(idx)] = code
        out.append({"model": row["model"], "items": items})
    return out


def code_boxes(page) -> dict[str, dict]:
    rect = page.rect
    pw, ph = float(rect.width), float(rect.height)
    found = {}
    for w in page.get_text("words") or []:
        text = str(w[4]).strip()
        if not re.fullmatch(r"\d{8}", text):
            continue
        found.setdefault(
            text,
            normalize_box(float(w[0]), float(w[1]), float(w[2]), float(w[3]), pw, ph),
        )
    return found


def callout_boxes(page) -> dict[str, dict]:
    """Callout numerals drawn on the tank illustration (left of sheet)."""
    rect = page.rect
    pw, ph = float(rect.width), float(rect.height)
    found = {}
    for w in page.get_text("words") or []:
        text = str(w[4]).strip().rstrip(".")
        if not re.fullmatch(r"\d{1,2}", text):
            continue
        key = str(int(text))
        if int(key) < 1 or int(key) > 10:
            continue
        x0 = float(w[0])
        # Illustration callouts sit in the left/upper drawing — skip table header nums
        if x0 > pw * 0.55:
            continue
        box = normalize_box(
            float(w[0]), float(w[1]), float(w[2]), float(w[3]), pw, ph, pad=0.01
        )
        prev = found.get(key)
        if not prev or (box["w"] * box["h"]) < (prev["w"] * prev["h"]):
            found[key] = box
    return found


def render_page(pdf: Path, stem: str, page_1based: int = 1) -> str:
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    key = f"{stem}__p{page_1based}"
    dest = DIAGRAM_DIR / f"{key}.jpg"
    doc = pymupdf.open(pdf)
    page = doc[page_1based - 1]
    zoom = 1400 / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    pix.save(dest, jpg_quality=78)
    doc.close()
    print("wrote", dest.name, dest.stat().st_size)
    return key


def main():
    pdf = SHEETS / PDF_NAME
    if not pdf.exists():
        hits = list((ROOT / "data-sheets").rglob(PDF_NAME))
        pdf = hits[0] if hits else None
    if not pdf or not pdf.exists():
        print("MISSING", PDF_NAME)
        sys.exit(1)

    doc = pymupdf.open(pdf)
    page = doc[0]
    text = page.get_text("text") or ""
    rows = parse_matrix_rows(text)
    boxes = code_boxes(page)
    cos = callout_boxes(page)
    doc.close()

    page_key = render_page(pdf, STEM, 1)

    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }

    # code → hit (unique codes; keep first model that lists it)
    by_code: dict[str, dict] = {}
    for row in rows:
        for callout, code in row["items"].items():
            if code in by_code:
                # append chassis token for this model variant
                tok = row["model"]
                if tok not in by_code[code]["chassisTokens"]:
                    by_code[code]["chassisTokens"].append(tok)
                continue
            by_code[code] = {
                "callout": callout,
                "page": f"{PDF_NAME} p1",
                "pageKey": page_key,
                "listPage": 1,
                "listPageKey": page_key,
                "listBox": boxes.get(code),
                "pdf": PDF_NAME,
                "stem": STEM,
                "seriesIds": list(SERIES_IDS),
                "chassisTokens": list(CHASSIS_TOKENS) + [row["model"]],
                "priority": PRIORITY,
                "name": ITEM_NAMES.get(callout, ""),
            }

    edpl = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    parts = edpl.setdefault("parts", {})
    added = 0
    updated = 0
    for code, hit in by_code.items():
        entry = {k: v for k, v in hit.items() if v is not None}
        existing = parts.get(code)
        if not isinstance(existing, list):
            parts[code] = [entry]
            added += 1
        else:
            # Replace prior ehfa160 hits; keep other chassis
            kept = [
                h
                for h in existing
                if "ehfa160" not in [str(s).lower() for s in (h.get("seriesIds") or [])]
            ]
            kept.insert(0, entry)
            parts[code] = kept
            updated += 1

    # Sheet registry
    sheets = edpl.setdefault("sheets", [])
    sheets = [s for s in sheets if s.get("stem") != STEM]
    sheets.append(
        {
            "file": PDF_NAME,
            "stem": STEM,
            "status": "ok",
            "pages": 1,
            "diagramPages": [1],
            "listPages": [1],
            "defaultDiagramPage": 1,
            "rowsExtracted": sum(len(r["items"]) for r in rows),
            "rowsInCatalogue": sum(1 for c in by_code if c in part_codes),
            "rowsWithListBox": sum(1 for h in by_code.values() if h.get("listBox")),
            "seriesIds": SERIES_IDS,
            "chassisTokens": CHASSIS_TOKENS,
            "priority": PRIORITY,
            "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        }
    )
    edpl["sheets"] = sheets

    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(parts)
    totals["codesInCatalogue"] = sum(1 for c in parts if c in part_codes)
    totals["hotfloEhfa160Codes"] = len(by_code)
    totals["hotfloEhfa160InCatalogue"] = sum(1 for c in by_code if c in part_codes)
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    meta = edpl.setdefault("meta", {})
    meta["hotfloEhfa160"] = (
        "Matrix PL+ED proof (RSP-131 stretch); single page; carry-forward model rows"
    )

    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)
    print(
        "models",
        len(rows),
        "uniqueCodes",
        len(by_code),
        "inCat",
        sum(1 for c in by_code if c in part_codes),
        "added",
        added,
        "updated",
        updated,
    )
    for row in rows:
        print(" ", row["model"], row["items"])

    # Callout boxes on the same page key
    if cos:
        callouts = json.loads(CALLOUTS_JSON.read_text(encoding="utf-8"))
        pages = callouts.setdefault("pages", {})
        prev = pages.get(page_key, {}).get("callouts", {})
        pages[page_key] = {
            "source": "text-layer extract-hotflo-ehfa160.py",
            "width": 1400,
            "callouts": {**cos, **prev},
        }
        callouts.setdefault("meta", {})["updated"] = datetime.now(
            timezone.utc
        ).date().isoformat()
        CALLOUTS_JSON.write_text(json.dumps(callouts, indent=2), encoding="utf-8")
        print("callouts", sorted(cos.keys()))


if __name__ == "__main__":
    main()
