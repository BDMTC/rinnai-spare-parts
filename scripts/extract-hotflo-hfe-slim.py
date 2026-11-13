"""
Hotflo HFE 250S/315S slim spare-parts sheet → ehfa250 + ehfa315.

Source: HFE 250S 315S SPL 29032021 V8.pdf (Issue 8 Mar 2021).
Complements EHFA SPARE PARTS matrix with slim-specific RA codes.
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

PDF_NAME = "HFE 250S 315S SPL 29032021 V8.pdf"
STEM = "pl-hotflo-hfe-250-315-slim"
SERIES_IDS = ["ehfa250", "ehfa315"]
CHASSIS_TOKENS = [
    "EHFA250",
    "EHFA315",
    "EHFA250S",
    "EHFA315S",
    "HFE250SSL",
    "HFE315SSL",
    "Hotflo",
    "HOTFLO",
]
PRIORITY = 19


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


def parse_rows(text: str) -> list[dict]:
    """Item # / description / RA — tolerate missing item nums on anode variants."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    last_callout = "1"
    while i < len(lines):
        ln = lines[i]
        if re.fullmatch(r"\d{1,2}", ln):
            last_callout = ln
            desc = lines[i + 1] if i + 1 < len(lines) else ""
            nxt = lines[i + 2] if i + 2 < len(lines) else ""
            if re.fullmatch(r"\d{8}", nxt):
                rows.append({"callout": last_callout, "code": nxt, "name": desc})
                i += 3
                continue
            i += 1
            continue
        # orphan description + RA (anode variants under item 2/3)
        if i + 1 < len(lines) and re.fullmatch(r"\d{8}", lines[i + 1]):
            if not re.fullmatch(r"\d{8}", ln) and ln.upper() not in {
                "ITEMS",
                "DESCRIPTION",
                "RA PART NO.",
                "RA PART NO",
                "SUPPLIER ERP CODE",
            }:
                rows.append({"callout": last_callout, "code": lines[i + 1], "name": ln})
                i += 2
                continue
        i += 1
    return rows


def main() -> None:
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
    rows = parse_rows(text)
    pw, ph = float(page.rect.width), float(page.rect.height)
    boxes = {}
    for w in page.get_text("words") or []:
        t = str(w[4]).strip()
        if re.fullmatch(r"\d{8}", t):
            boxes.setdefault(
                t,
                normalize_box(float(w[0]), float(w[1]), float(w[2]), float(w[3]), pw, ph),
            )
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    dest = DIAGRAM_DIR / f"{STEM}__p1.jpg"
    zoom = 1400 / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    pix.save(dest, jpg_quality=78)
    print("wrote", dest.name, dest.stat().st_size)
    doc.close()

    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }

    by_code: dict[str, dict] = {}
    for row in rows:
        code = row["code"]
        name = (row["name"] or "").strip()
        # Skip mis-parsed numeric-only names (e.g. PTR line 13 / 95110048)
        if re.fullmatch(r"\d+", name):
            if code == "95110048":
                name = "PTR VALVE"
            else:
                continue
        # Capacity-hint series scoping for anode/lid/base lines
        name_u = name.upper()
        sids = list(SERIES_IDS)
        if "250" in name_u and "315" not in name_u:
            sids = ["ehfa250"]
        elif "315" in name_u and "250" not in name_u:
            sids = ["ehfa315"]
        by_code[code] = {
            "callout": row["callout"],
            "page": f"{PDF_NAME} p1",
            "pageKey": f"{STEM}__p1",
            "listPage": 1,
            "listPageKey": f"{STEM}__p1",
            "listBox": boxes.get(code),
            "pdf": PDF_NAME,
            "stem": STEM,
            "seriesIds": sids,
            "chassisTokens": list(CHASSIS_TOKENS),
            "priority": PRIORITY,
            "name": name,
        }

    edpl = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    parts = edpl.setdefault("parts", {})
    added = updated = 0
    for code, hit in by_code.items():
        existing = parts.get(code)
        if not isinstance(existing, list):
            parts[code] = [hit]
            added += 1
        else:
            kept = [
                h
                for h in existing
                if h.get("stem") != STEM
            ]
            kept.insert(0, hit)
            parts[code] = kept
            updated += 1

    sheets = [s for s in edpl.setdefault("sheets", []) if s.get("stem") != STEM]
    sheets.append(
        {
            "file": PDF_NAME,
            "stem": STEM,
            "status": "ok",
            "pages": 1,
            "diagramPages": [1],
            "listPages": [1],
            "defaultDiagramPage": 1,
            "rowsExtracted": len(by_code),
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
    totals["hotfloHfeSlimCodes"] = len(by_code)
    totals["hotfloHfeSlimInCatalogue"] = sum(1 for c in by_code if c in part_codes)
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["hotfloHfeSlim"] = (
        "Hotflo HFE 250S/315S slim SPL Issue 8 → ehfa250/ehfa315 (complements EHFA SPARE PARTS)"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print(
        "Wrote",
        OUT_JSON,
        "codes",
        len(by_code),
        "inCat",
        sum(1 for c in by_code if c in part_codes),
        "added",
        added,
        "updated",
        updated,
    )
    for code, hit in sorted(by_code.items()):
        print(" ", hit["callout"], code, hit["name"][:50], hit["seriesIds"])


if __name__ == "__main__":
    main()
