"""
Leftover PDF pack #93:
PL VR2632FFUG_VRM2632FFUC Issue 4 → hd200i / infinity26-internal refresh.
Distinct from already-wired EDPL VRM2632FFU Issue 4.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
DIAGRAM_DIR = ROOT / "src" / "assets" / "diagram-pages"
OUT_JSON = ROOT / "public" / "data" / "edpl-part-map.json"

PDF_NAME = "PL - RINNAI - VR2632FFUG_VRM2632FFUC - ISSUE 4 - JUNE 2025.pdf"
STEM = "pl-vr2632ffug-vrm2632ffuc-issue4"
SERIES = ["hd200i", "infinity26-internal"]
CHASSIS = [
    "VR2632FFUG",
    "REU-VR2632FFUG",
    "VRM2632FFUC",
    "REU-VRM2632FFUC",
    "HD200I",
    "HD200i",
]
PRIORITY = 26


def parse_callout_rows(text: str) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        callout = name = None
        m_same = re.match(r"^0*(\d{1,3})\s+(.+)$", ln)
        if m_same:
            callout = str(int(m_same.group(1)))
            name = m_same.group(2).strip()
        elif re.fullmatch(r"0*\d{1,3}", ln):
            callout = str(int(ln))
            j = i + 1
            while j < len(lines) and j < i + 4:
                cand = lines[j]
                if re.fullmatch(r"\d{8}", cand) or re.fullmatch(r"0*\d{1,3}", cand):
                    break
                if re.fullmatch(r"\d", cand) or cand in {"-", "–"}:
                    j += 1
                    continue
                if cand.upper() in {
                    "NO",
                    "DESCRIPTION",
                    "RA PART",
                    "RA PART NO.",
                    "RA PART NO",
                    "PARTS CODE",
                    "RA PART NUMBER",
                    "11 DIGIT CODE",
                    "VR2632FFUGVRM2632FFUC",
                    "VR2632FFUG",
                    "VRM2632FFUC",
                }:
                    j += 1
                    continue
                if re.match(r"^\d{2}-\d{4}", cand) or cand.startswith("REU-"):
                    j += 1
                    continue
                name = cand
                break
            if not name:
                i += 1
                continue
            i = j
        else:
            i += 1
            continue
        code = None
        j = i + 1
        while j < len(lines) and j < i + 6:
            cand = lines[j]
            if re.fullmatch(r"\d{8}", cand):
                code = cand
                break
            if re.fullmatch(r"0*\d{1,3}", cand) or re.match(r"^0*\d{1,3}\s+\S", cand):
                break
            j += 1
        if code and name and not re.fullmatch(r"\d+", name):
            rows.append({"callout": callout, "code": code, "name": name[:120]})
            i = j + 1
            continue
        i += 1
    return rows


def main() -> None:
    pdf = SHEETS / PDF_NAME
    if not pdf.exists():
        raise SystemExit(f"MISSING {PDF_NAME}")

    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }
    edpl = json.loads(OUT_JSON.read_text(encoding="utf-8"))

    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for i in range(doc.page_count):
        dest = DIAGRAM_DIR / f"{STEM}__p{i + 1}.jpg"
        zoom = 1400 / doc[i].rect.width
        pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=72)
        print("diag", dest.name, dest.stat().st_size)

    by: dict[str, dict] = {}
    for i in range(doc.page_count):
        text = doc[i].get_text("text") or ""
        if len(text.strip()) < 80:
            continue
        for r in parse_callout_rows(text):
            by[r["code"]] = {
                "callout": r["callout"],
                "page": f"{pdf.name} p{i + 1}",
                "pageKey": f"{STEM}__p{i + 1}",
                "listPage": i + 1,
                "listPageKey": f"{STEM}__p{i + 1}",
                "pdf": pdf.name,
                "stem": STEM,
                "seriesIds": list(SERIES),
                "chassisTokens": list(CHASSIS),
                "priority": PRIORITY,
                "name": r["name"],
            }
    pages = doc.page_count
    doc.close()

    parts = edpl.setdefault("parts", {})
    added = updated = 0
    for code, hit in by.items():
        existing = parts.get(code)
        if not isinstance(existing, list):
            parts[code] = [hit]
            added += 1
        else:
            kept = [h for h in existing if h.get("stem") != STEM]
            kept.insert(0, hit)
            parts[code] = kept
            updated += 1

    sheets = [s for s in edpl.setdefault("sheets", []) if s.get("stem") != STEM]
    # Issue4 layout: list pp1-3, exploded diagrams pp4-7 (same family as VRM2632FFU Issue4)
    dpages = [4, 5, 6, 7] if pages >= 7 else list(range(max(1, pages // 2 + 1), pages + 1))
    sheets.append(
        {
            "file": pdf.name,
            "stem": STEM,
            "status": "ok",
            "pages": pages,
            "diagramPages": dpages,
            "listPages": [1, 2, 3] if pages >= 3 else list(range(1, pages + 1)),
            "defaultDiagramPage": dpages[0],
            "rowsExtracted": len(by),
            "rowsInCatalogue": sum(1 for c in by if c in part_codes),
            "rowsWithListBox": len(by),
            "seriesIds": list(SERIES),
            "chassisTokens": list(CHASSIS),
            "priority": PRIORITY,
            "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        }
    )
    edpl["sheets"] = sheets
    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(edpl.get("parts") or {})
    totals["codesInCatalogue"] = sum(
        1 for c in (edpl.get("parts") or {}) if c in part_codes
    )
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["vr2632ffugIssue4"] = (
        f"PL VR2632FFUG_VRM2632FFUC Issue 4 → {STEM} "
        f"({len(by)} rows, {sum(1 for c in by if c in part_codes)} in catalogue)"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print(
        STEM,
        "rows",
        len(by),
        "inCat",
        sum(1 for c in by if c in part_codes),
        "added",
        added,
        "updated",
        updated,
    )


if __name__ == "__main__":
    main()
