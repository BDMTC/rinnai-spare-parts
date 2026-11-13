"""
HDC211e PL Pin1 — REU-KM3237WDC-AK Combined SP & EPD SEP 2018.pdf

Cover-true HDC211e (commercial KM3237WDC). Not Infinity 32 Enviro KM3237WD.
Renders PL/ED page JPEGs and merges chassis-scoped hits into edpl-part-map.json.
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "public" / "data" / "edpl-part-map.json"

PDF_NAME = "REU-KM3237WDC-AK Combined SP & EPD SEP 2018.pdf"
STEM = "pl-reu-km3237wdc-hdc211e"
SERIES_IDS = ["hdc211e"]
CHASSIS_TOKENS = [
    "KM3237WDC",
    "REU-KM3237WDC",
    "REUKM3237WDC",
    "HDC211E",
    "HDC211e",
]
PRIORITY = 16


def parse_hdc_rows(text: str) -> list[dict]:
    """HDC sheet lines are '001 Part Name' then optional 8-digit RA on next line."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        m = re.match(r"^0*(\d{1,3})\s+(.+)$", lines[i])
        if not m:
            i += 1
            continue
        callout = str(int(m.group(1)))
        name = m.group(2).strip()
        code = None
        j = i + 1
        while j < len(lines) and j < i + 4:
            ln = lines[j]
            if re.fullmatch(r"\d{8}", ln):
                code = ln
                break
            if re.match(r"^0*\d{1,3}\s+\S", ln):
                break
            j += 1
        if code:
            rows.append({"callout": callout, "code": code, "name": name[:120]})
            i = j + 1
            continue
        i += 1
    return rows


def load_edpl_mod():
    path = ROOT / "scripts" / "extract-edpl-part-map.py"
    spec = importlib.util.spec_from_file_location("edpl_extract", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    mod = load_edpl_mod()
    pdf = mod.find_pdf(PDF_NAME)
    if not pdf:
        print("MISSING", PDF_NAME)
        sys.exit(1)

    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }

    doc = pymupdf.open(pdf)
    diagram_pages = mod.detect_diagram_pages(doc)
    if not diagram_pages:
        diagram_pages = list(range(max(1, doc.page_count // 2 + 1), doc.page_count + 1))
    default_diag = diagram_pages[0]
    all_pages = list(range(1, doc.page_count + 1))
    mod.ensure_diagram_jpegs(pdf, STEM, all_pages)

    by_code: dict[str, dict] = {}
    for i in range(doc.page_count):
        text = doc[i].get_text("text") or ""
        if len(text.strip()) < 200:
            continue
        list_page = i + 1
        for row in parse_hdc_rows(text):
            code = row["code"]
            by_code[code] = {
                "callout": row["callout"],
                "page": f"{PDF_NAME} p{default_diag}",
                "pageKey": f"{STEM}__p{default_diag}",
                "listPage": list_page,
                "listPageKey": f"{STEM}__p{list_page}",
                "pdf": PDF_NAME,
                "stem": STEM,
                "seriesIds": list(SERIES_IDS),
                "chassisTokens": list(CHASSIS_TOKENS),
                "priority": PRIORITY,
                "name": row.get("name") or "",
            }
    doc.close()

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
                if "hdc211e"
                not in [str(s).lower() for s in (h.get("seriesIds") or [])]
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
            "pages": len(all_pages),
            "diagramPages": diagram_pages,
            "listPages": [p for p in all_pages if p not in diagram_pages],
            "defaultDiagramPage": default_diag,
            "rowsExtracted": len(by_code),
            "rowsInCatalogue": sum(1 for c in by_code if c in part_codes),
            "rowsWithListBox": 0,
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
    totals["hdc211eCodes"] = len(by_code)
    totals["hdc211eInCatalogue"] = sum(1 for c in by_code if c in part_codes)
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["hdc211e"] = (
        "HDC211e PL Pin1 from REU-KM3237WDC-AK Combined SP & EPD SEP 2018 "
        "(cover HDC211e; chassis WDC — not Enviro KM3237WD)"
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
        "diagPages",
        diagram_pages,
    )


if __name__ == "__main__":
    main()
