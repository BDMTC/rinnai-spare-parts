"""
IHF10 / Flowmaster FM10 cover-true SM parts list + PL JPEG pack → edpl-part-map.

Source of truth for RA codes: IHF10.pdf §11 text layer (Issue 3 / 4-Apr-17).
Diagram pack: IHF10-Spare-Parts-List.pdf (SM pages 20–24 reprint; p3 = exploded).
Series: fm10 (FM10LA/NA; documentKeys already include IHF10).
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

SM_PDF = "IHF10.pdf"
PL_PDF = "IHF10-Spare-Parts-List.pdf"
STEM = "pl-ihf10"
SERIES_IDS = ["fm10"]
CHASSIS_TOKENS = [
    "IHF10",
    "FM10",
    "FM10LA",
    "FM10NA",
    "Flowmaster",
    "FLOWMASTER",
]
PRIORITY = 22
# SM 0-based pages that hold the §11 parts table
SM_LIST_PAGES = (23, 24)  # printed -20- / -21-
# PL page that carries the exploded diagram (matches SM printed -22-)
PL_DIAGRAM_PAGE = 3


def find_pdf(name: str) -> Path | None:
    direct = SHEETS / name
    if direct.exists():
        return direct
    hits = list((ROOT / "data-sheets").rglob(name))
    return hits[0] if hits else None


def parse_parts_rows(text: str) -> list[dict]:
    """Parse No / DESCRIPTION / RA CODE [/ TR] blocks from SM §11."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    callout_re = re.compile(r"^\d{1,2}[a-zA-Z]?(?:\.\d+)?$")
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if not callout_re.fullmatch(ln):
            i += 1
            continue
        callout = ln
        desc = lines[i + 1] if i + 1 < len(lines) else ""
        nxt = lines[i + 2] if i + 2 < len(lines) else ""
        nxt2 = lines[i + 3] if i + 3 < len(lines) else ""
        if re.fullmatch(r"\d{8}", nxt):
            tr = None
            if nxt2 and not callout_re.fullmatch(nxt2) and not re.fullmatch(
                r"\d{8}", nxt2
            ):
                tr = nxt2
                i += 4
            else:
                i += 3
            rows.append(
                {
                    "callout": callout,
                    "code": nxt,
                    "name": desc,
                    "tr": tr,
                }
            )
            continue
        # TR-only / no RA — skip
        i += 1
    return rows


def render_pl_pages(pdf: Path, stem: str) -> list[int]:
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    pages = []
    for i in range(doc.page_count):
        page_1 = i + 1
        key = f"{stem}__p{page_1}"
        dest = DIAGRAM_DIR / f"{key}.jpg"
        zoom = 1400 / doc[i].rect.width
        pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=72)
        pages.append(page_1)
        print("wrote", dest.name, dest.stat().st_size)
    doc.close()
    return pages


def list_page_for_sm_index(sm_0: int) -> int:
    """Map SM 0-based list page → PL 1-based page (p1=table1, p2=table2)."""
    if sm_0 == SM_LIST_PAGES[0]:
        return 1
    if sm_0 == SM_LIST_PAGES[1]:
        return 2
    return 1


def main() -> None:
    sm_path = find_pdf(SM_PDF)
    pl_path = find_pdf(PL_PDF)
    if not sm_path or not pl_path:
        print("MISSING", SM_PDF if not sm_path else "", PL_PDF if not pl_path else "")
        sys.exit(1)

    sm = pymupdf.open(sm_path)
    by_code: dict[str, dict] = {}
    for sm_0 in SM_LIST_PAGES:
        text = sm[sm_0].get_text("text") or ""
        list_page = list_page_for_sm_index(sm_0)
        for row in parse_parts_rows(text):
            code = row["code"]
            by_code[code] = {
                "callout": row["callout"],
                "page": f"{PL_PDF} p{PL_DIAGRAM_PAGE}",
                "pageKey": f"{STEM}__p{PL_DIAGRAM_PAGE}",
                "listPage": list_page,
                "listPageKey": f"{STEM}__p{list_page}",
                "pdf": PL_PDF,
                "stem": STEM,
                "seriesIds": list(SERIES_IDS),
                "chassisTokens": list(CHASSIS_TOKENS),
                "priority": PRIORITY,
                "name": row["name"],
                "sourceSm": SM_PDF,
                "sourceSmPage": sm_0 + 1,
            }
    sm.close()

    pl_pages = render_pl_pages(pl_path, STEM)

    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }

    edpl = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    parts = edpl.setdefault("parts", {})
    added = 0
    updated = 0
    for code, hit in by_code.items():
        existing = parts.get(code)
        if not isinstance(existing, list):
            parts[code] = [hit]
            added += 1
        else:
            kept = [
                h
                for h in existing
                if "fm10" not in [str(s).lower() for s in (h.get("seriesIds") or [])]
            ]
            kept.insert(0, hit)
            parts[code] = kept
            updated += 1

    sheets = [s for s in edpl.setdefault("sheets", []) if s.get("stem") != STEM]
    sheets.append(
        {
            "file": PL_PDF,
            "stem": STEM,
            "status": "ok",
            "pages": len(pl_pages),
            "diagramPages": [PL_DIAGRAM_PAGE],
            "listPages": [1, 2],
            "defaultDiagramPage": PL_DIAGRAM_PAGE,
            "rowsExtracted": len(by_code),
            "rowsInCatalogue": sum(1 for c in by_code if c in part_codes),
            "rowsWithListBox": 0,
            "seriesIds": SERIES_IDS,
            "chassisTokens": CHASSIS_TOKENS,
            "priority": PRIORITY,
            "path": str(pl_path.relative_to(ROOT)).replace("\\", "/"),
            "sourceSm": SM_PDF,
            "notes": "RA codes from IHF10.pdf §11 text; PL JPEG pack from IHF10-Spare-Parts-List.pdf",
        }
    )
    edpl["sheets"] = sheets

    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(parts)
    totals["codesInCatalogue"] = sum(1 for c in parts if c in part_codes)
    totals["ihf10Fm10Codes"] = len(by_code)
    totals["ihf10Fm10InCatalogue"] = sum(1 for c in by_code if c in part_codes)
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    meta = edpl.setdefault("meta", {})
    meta["ihf10Fm10"] = (
        "Flowmaster FM10 / Hotflo IHF10 Instantaneous — cover-true SM IHF10.pdf + "
        "IHF10-Spare-Parts-List.pdf Issue 3 (RSP-131 stretch #84)"
    )

    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)
    print(
        "codes",
        len(by_code),
        "inCat",
        sum(1 for c in by_code if c in part_codes),
        "added",
        added,
        "updated",
        updated,
    )


if __name__ == "__main__":
    main()
