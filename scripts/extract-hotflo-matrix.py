"""
Hotflo EHFA matrix PL/ED sheets → merge into public/data/edpl-part-map.json

Covers EHFA160 (dedicated sheet) + EHFA250/315 shared desktop sheet.
Carry-forward blanks like the printed table.
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

SHEET_SPECS = [
    {
        "file": "Hotflo EHFA160 Spare Parts List S111418B.pdf",
        "stem": "pl-hotflo-ehfa160",
        "modelPrefix": "EHFA160",
        "seriesIds": ["ehfa160"],
        "chassisTokens": ["EHFA160", "Hotflo EHFA160", "HOTFLO EHFA160"],
        "priority": 20,
    },
    {
        "file": "EHFA  SPARE PARTS.pdf",
        "stem": "pl-hotflo-ehfa-spare-parts",
        # Shared sheet — map models to series by capacity digits
        "modelPrefix": "EHFA",
        "seriesByModel": {
            "EHFA250": "ehfa250",
            "EHFA315": "ehfa315",
        },
        "chassisTokens": ["EHFA", "Hotflo EHFA", "HOTFLO EHFA"],
        "priority": 18,
    },
]


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


def find_pdf(file_name: str) -> Path | None:
    direct = SHEETS / file_name
    if direct.exists():
        return direct
    hits = list((ROOT / "data-sheets").rglob(file_name))
    return hits[0] if hits else None


def parse_matrix_rows(text: str, model_re: re.Pattern) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    start = None
    for i, ln in enumerate(lines):
        if model_re.fullmatch(ln):
            start = i
            break
    if start is None:
        return []

    models: list[dict] = []
    i = start
    while i < len(lines):
        ln = lines[i]
        if model_re.fullmatch(ln):
            model = ln.upper()
            cells: list[str] = []
            j = i + 1
            while j < len(lines) and len(cells) < 10:
                cell = lines[j].strip()
                if model_re.fullmatch(cell):
                    break
                up = cell.upper()
                if up in {
                    "WEIGHT",
                    "SCALE",
                    "A3 SIZE",
                    "HOTFLO EHFA160 SPARE PARTS LIST",
                    "EHFA SPARE PARTS",
                } or up.startswith("HOTFLO"):
                    break
                if re.fullmatch(r"\d{8}", cell) or up in {"N/A", "NA", "-"}:
                    cells.append("N/A" if up in {"N/A", "NA", "-"} else cell)
                    j += 1
                    continue
                break
            models.append({"model": model, "cells": cells})
            i = j
            continue
        up = ln.upper()
        if up in {"WEIGHT", "SCALE"} or up.startswith("HOTFLO") or up.startswith("LINEAR"):
            break
        i += 1

    carried = ["N/A"] * 10
    out = []
    for row in models:
        cells = list(row["cells"])
        while len(cells) < 10:
            cells.append("")
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
            if code != "N/A" and re.fullmatch(r"\d{8}", code):
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
        if float(w[0]) > pw * 0.55:
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


def series_for_model(spec: dict, model: str) -> list[str]:
    by = spec.get("seriesByModel") or {}
    for prefix, sid in by.items():
        if model.startswith(prefix):
            return [sid]
    return list(spec.get("seriesIds") or [])


def process_sheet(spec: dict, part_codes: set[str], edpl: dict) -> dict:
    pdf = find_pdf(spec["file"])
    if not pdf:
        print("MISSING", spec["file"])
        return {"status": "missing", "file": spec["file"]}

    prefix = spec["modelPrefix"]
    model_re = re.compile(rf"{re.escape(prefix)}\d*[A-Z0-9]*", re.I)
    # Prefer stricter: EHFA250S24 style when prefix is EHFA
    if prefix == "EHFA":
        model_re = re.compile(r"EHFA\d{3}[A-Z0-9]*", re.I)
    elif prefix.startswith("EHFA") and prefix != "EHFA":
        model_re = re.compile(rf"{re.escape(prefix)}[A-Z0-9]*", re.I)

    doc = pymupdf.open(pdf)
    page = doc[0]
    text = page.get_text("text") or ""
    rows = parse_matrix_rows(text, model_re)
    boxes = code_boxes(page)
    cos = callout_boxes(page)
    doc.close()

    page_key = render_page(pdf, spec["stem"], 1)
    by_code: dict[str, dict] = {}
    for row in rows:
        sids = series_for_model(spec, row["model"])
        if not sids:
            continue
        for callout, code in row["items"].items():
            if code in by_code:
                tok = row["model"]
                if tok not in by_code[code]["chassisTokens"]:
                    by_code[code]["chassisTokens"].append(tok)
                for sid in sids:
                    if sid not in by_code[code]["seriesIds"]:
                        by_code[code]["seriesIds"].append(sid)
                continue
            by_code[code] = {
                "callout": callout,
                "page": f"{spec['file']} p1",
                "pageKey": page_key,
                "listPage": 1,
                "listPageKey": page_key,
                "listBox": boxes.get(code),
                "pdf": spec["file"],
                "stem": spec["stem"],
                "seriesIds": list(sids),
                "chassisTokens": list(spec.get("chassisTokens") or []) + [row["model"]],
                "priority": int(spec.get("priority") or 0),
                "name": ITEM_NAMES.get(callout, ""),
            }

    parts = edpl.setdefault("parts", {})
    hotflo_sids = set()
    for sid_list in (spec.get("seriesIds") or []):
        hotflo_sids.add(str(sid_list).lower())
    for sid in (spec.get("seriesByModel") or {}).values():
        hotflo_sids.add(str(sid).lower())

    added = updated = 0
    for code, hit in by_code.items():
        entry = {k: v for k, v in hit.items() if v is not None}
        existing = parts.get(code)
        if not isinstance(existing, list):
            parts[code] = [entry]
            added += 1
        else:
            # Replace prior hits from this stem; keep other families
            kept = [h for h in existing if h.get("stem") != spec["stem"]]
            kept.insert(0, entry)
            parts[code] = kept
            updated += 1

    sheets = [s for s in edpl.get("sheets") or [] if s.get("stem") != spec["stem"]]
    sheets.append(
        {
            "file": spec["file"],
            "stem": spec["stem"],
            "status": "ok",
            "pages": 1,
            "diagramPages": [1],
            "listPages": [1],
            "defaultDiagramPage": 1,
            "rowsExtracted": sum(len(r["items"]) for r in rows),
            "rowsInCatalogue": sum(1 for c in by_code if c in part_codes),
            "rowsWithListBox": sum(1 for h in by_code.values() if h.get("listBox")),
            "seriesIds": list(hotflo_sids),
            "chassisTokens": spec.get("chassisTokens") or [],
            "priority": spec.get("priority"),
            "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        }
    )
    edpl["sheets"] = sheets

    if cos:
        callouts = json.loads(CALLOUTS_JSON.read_text(encoding="utf-8"))
        pages = callouts.setdefault("pages", {})
        prev = pages.get(page_key, {}).get("callouts", {})
        pages[page_key] = {
            "source": "text-layer extract-hotflo-matrix.py",
            "width": 1400,
            "callouts": {**cos, **prev},
        }
        callouts.setdefault("meta", {})["updated"] = datetime.now(
            timezone.utc
        ).date().isoformat()
        CALLOUTS_JSON.write_text(json.dumps(callouts, indent=2), encoding="utf-8")

    print(
        f"OK {spec['file']}: models={len(rows)} codes={len(by_code)} "
        f"inCat={sum(1 for c in by_code if c in part_codes)} "
        f"added={added} updated={updated} callouts={sorted(cos.keys())}"
    )
    for row in rows[:12]:
        print(" ", row["model"], row["items"])
    if len(rows) > 12:
        print(f"  … {len(rows) - 12} more models")
    return {
        "status": "ok",
        "codes": len(by_code),
        "inCat": sum(1 for c in by_code if c in part_codes),
        "models": len(rows),
    }


def main():
    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }
    edpl = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    results = []
    for spec in SHEET_SPECS:
        results.append(process_sheet(spec, part_codes, edpl))

    parts = edpl.get("parts") or {}
    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(parts)
    totals["codesInCatalogue"] = sum(1 for c in parts if c in part_codes)
    totals["hotfloMatrixSheetsOk"] = sum(1 for r in results if r.get("status") == "ok")
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["hotfloMatrix"] = (
        "EHFA160 + EHFA SPARE PARTS (250/315) matrix PL/ED; carry-forward rows"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)


if __name__ == "__main__":
    main()
