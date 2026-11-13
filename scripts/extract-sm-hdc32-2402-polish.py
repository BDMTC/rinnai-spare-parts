"""
SM pack / registry polish (preferred CF/Hotflo/Efinity/GHF PL one-shot exhausted).

1) Cover-true NB3237 SM → sm-nb3237 pack + hdc32e/hdc32i thumbs
2) Infinity 24 (2402) SERIES diagram JPEGs from SM 2402 (image-only SM; no invented RA codes)
"""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
SM_OUT = ROOT / "src" / "assets" / "service-manual-pages"
DIAGRAM_DIR = ROOT / "src" / "assets" / "diagram-pages"
OUT_JSON = ROOT / "public" / "data" / "edpl-part-map.json"

NB_SM = "SM - RINNAI - N SERIES INFINITY ENVIRO32 REU-NB3237 - ISSUE 1 - JULY 2025.pdf"
NB_STEM = "sm-nb3237"
SM_2402 = "SM 2402.pdf"
PL_STEM_2402 = "pl-sm-2402"
# Densest SM 2402 pages (visual exploded / assembly candidates)
PAGES_2402 = [39, 56, 67, 59, 40]


def render_sm_pack(pdf_name: str, stem: str, *, target_width=900, quality=55) -> int:
    pdf = SHEETS / pdf_name
    if not pdf.exists():
        raise SystemExit(f"MISSING {pdf_name}")
    SM_OUT.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for i in range(doc.page_count):
        dest = SM_OUT / f"{stem}__p{i + 1}.jpg"
        if dest.exists() and dest.stat().st_size > 8_000:
            continue
        zoom = target_width / doc[i].rect.width
        pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=quality)
        print("sm", dest.name, dest.stat().st_size)
    n = doc.page_count
    doc.close()
    return n


def copy_thumbs(pack_stem: str, series_ids: list[str]) -> None:
    src = SM_OUT / f"{pack_stem}__p1.jpg"
    if not src.exists():
        raise SystemExit(f"MISSING thumb source {src}")
    for sid in series_ids:
        dest = SM_OUT / f"{sid}__p1.jpg"
        dest.write_bytes(src.read_bytes())
        print("thumb", dest.name, dest.stat().st_size)


def render_diagram_pages(pdf_name: str, stem: str, pages: list[int]) -> None:
    pdf = SHEETS / pdf_name
    if not pdf.exists():
        raise SystemExit(f"MISSING {pdf_name}")
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for pn in pages:
        i = pn - 1
        if i < 0 or i >= doc.page_count:
            continue
        dest = DIAGRAM_DIR / f"{stem}__p{pn}.jpg"
        zoom = 1400 / doc[i].rect.width
        pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=72)
        print("diag", dest.name, dest.stat().st_size)
    doc.close()


def register_2402_sheet(edpl: dict) -> None:
    """Registry-only sheet for Pin1 diagram default — no invented part hits."""
    pdf = SHEETS / SM_2402
    stem = PL_STEM_2402
    sheets = [s for s in edpl.setdefault("sheets", []) if s.get("stem") != stem]
    sheets.append(
        {
            "file": SM_2402,
            "stem": stem,
            "status": "ok",
            "pages": 89,
            "diagramPages": list(PAGES_2402),
            "listPages": [],
            "defaultDiagramPage": PAGES_2402[0],
            "rowsExtracted": 0,
            "rowsInCatalogue": 0,
            "rowsWithListBox": 0,
            "seriesIds": ["infinity24-2402"],
            "chassisTokens": [
                "2402FFU",
                "REU-2402FFU",
                "2402W",
                "REU-2402W",
                "Infinity 24",
            ],
            "priority": 12,
            "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
            "notes": "SM 2402 image-only — diagram pages only; OCR needed for RA extract",
        }
    )
    edpl["sheets"] = sheets
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["smHdc32_2402Polish"] = (
        "NB3237 SM pack for hdc32e/i + infinity24-2402 diagram registry (no invented RA)"
    )


def main() -> None:
    n = render_sm_pack(NB_SM, NB_STEM)
    print("NB SM pages", n)
    copy_thumbs(NB_STEM, ["hdc32e", "hdc32i"])
    render_diagram_pages(SM_2402, PL_STEM_2402, PAGES_2402)
    edpl = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    register_2402_sheet(edpl)
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)


if __name__ == "__main__":
    main()
