"""
Heritage Infinity SM-embedded parts lists → edpl-part-map + diagram JPEGs.

Hotflo EHFA400/EHFD/EHF25 + GHF4 + Efinity wait-for Tech Issue PL sync;
these series already have cover-true SM packs but no PL/diagram defaults.
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

SPECS = [
    {
        "file": "SM 2006.pdf",
        "stem": "pl-sm-2006",
        "seriesIds": ["infinity20-2006"],
        "chassisTokens": ["2006FFU", "REU-2006FFU", "REU2006FFU", "2006"],
        "priority": 15,
        "listPages": [66, 67, 68],
        "diagramPages": [62, 63, 64, 65],
        "defaultDiagramPage": 62,
    },
    {
        "file": "SM 24WA.pdf",
        "stem": "pl-sm-24wa",
        "seriesIds": ["infinity24-wa"],
        "chassisTokens": ["24WA", "REU-24WA", "REU24WA"],
        "priority": 15,
        "listPages": [60, 62, 63],
        "diagramPages": [61],
        "defaultDiagramPage": 61,
    },
    {
        "file": "SM REU3203.pdf",
        "stem": "pl-sm-reu3203",
        "seriesIds": ["infinity32-3203"],
        "chassisTokens": ["3203W", "REU-3203W", "REU3203W", "3203"],
        "priority": 15,
        "listPages": [58, 59, 60],
        "diagramPages": [54, 55, 56, 57],
        "defaultDiagramPage": 54,
    },
]


def parse_rows(text: str) -> list[dict]:
    """Callout on its own line (001) or '100 Front panel…' then 8-digit RA."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        m_solo = re.fullmatch(r"0*(\d{1,3})", ln)
        m_inline = re.match(r"^0*(\d{1,3})\s+(.+)$", ln)
        callout = name = None
        if m_solo:
            callout = str(int(m_solo.group(1)))
            name = lines[i + 1] if i + 1 < len(lines) else ""
            j = i + 2
        elif m_inline:
            callout = str(int(m_inline.group(1)))
            name = m_inline.group(2).strip()
            j = i + 1
        else:
            i += 1
            continue
        code = None
        while j < len(lines) and j < i + 6:
            cand = lines[j]
            if re.fullmatch(r"\d{8}", cand):
                code = cand
                break
            if re.fullmatch(r"0*\d{1,3}", cand) or re.match(r"^0*\d{1,3}\s+\S", cand):
                break
            # skip NZ / qty junk
            j += 1
        if code:
            rows.append({"callout": callout, "code": code, "name": (name or "")[:120]})
            i = j + 1
            continue
        i += 1
    return rows


def render_pages(pdf: Path, stem: str, pages: list[int]) -> None:
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for p in pages:
        if p < 1 or p > doc.page_count:
            continue
        dest = DIAGRAM_DIR / f"{stem}__p{p}.jpg"
        if dest.exists() and dest.stat().st_size > 8_000:
            continue
        page = doc[p - 1]
        zoom = 1400 / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=72)
        print("wrote", dest.name, dest.stat().st_size)
    doc.close()


def main() -> None:
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
    sheets = edpl.setdefault("sheets", [])

    for spec in SPECS:
        pdf = SHEETS / spec["file"]
        if not pdf.exists():
            print("MISSING", spec["file"])
            continue
        render_pages(
            pdf,
            spec["stem"],
            sorted(set(spec["listPages"] + spec["diagramPages"])),
        )
        doc = pymupdf.open(pdf)
        by_code: dict[str, dict] = {}
        for lp in spec["listPages"]:
            text = doc[lp - 1].get_text("text") or ""
            for row in parse_rows(text):
                by_code[row["code"]] = {
                    "callout": row["callout"],
                    "page": f"{spec['file']} p{spec['defaultDiagramPage']}",
                    "pageKey": f"{spec['stem']}__p{spec['defaultDiagramPage']}",
                    "listPage": lp,
                    "listPageKey": f"{spec['stem']}__p{lp}",
                    "pdf": spec["file"],
                    "stem": spec["stem"],
                    "seriesIds": list(spec["seriesIds"]),
                    "chassisTokens": list(spec["chassisTokens"]),
                    "priority": spec["priority"],
                    "name": row["name"],
                }
        doc.close()

        sid_set = {s.lower() for s in spec["seriesIds"]}
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
                    if not sid_set.intersection(
                        {str(s).lower() for s in (h.get("seriesIds") or [])}
                    )
                ]
                kept.insert(0, hit)
                parts[code] = kept
                updated += 1

        sheets = [s for s in sheets if s.get("stem") != spec["stem"]]
        sheets.append(
            {
                "file": spec["file"],
                "stem": spec["stem"],
                "status": "ok",
                "pages": max(spec["listPages"] + spec["diagramPages"]),
                "diagramPages": spec["diagramPages"],
                "listPages": spec["listPages"],
                "defaultDiagramPage": spec["defaultDiagramPage"],
                "rowsExtracted": len(by_code),
                "rowsInCatalogue": sum(1 for c in by_code if c in part_codes),
                "rowsWithListBox": 0,
                "seriesIds": spec["seriesIds"],
                "chassisTokens": spec["chassisTokens"],
                "priority": spec["priority"],
                "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
                "notes": "RA codes from SM-embedded parts list (heritage leftovers)",
            }
        )
        print(
            spec["stem"],
            "codes",
            len(by_code),
            "inCat",
            sum(1 for c in by_code if c in part_codes),
            "added",
            added,
            "updated",
            updated,
        )

    edpl["sheets"] = sheets
    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(parts)
    totals["codesInCatalogue"] = sum(1 for c in parts if c in part_codes)
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["heritageSmPl"] = (
        "SM-embedded PL for infinity20-2006 / infinity24-wa / infinity32-3203 "
        "(Hotflo EHFA400/EHFD/EHF25/GHF4/Efinity still wait-for Tech Issue PL sync)"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)


if __name__ == "__main__":
    main()
