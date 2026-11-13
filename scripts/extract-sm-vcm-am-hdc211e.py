"""
SM/registry polish + leftover PDF pack:
- SM REUVCM2837 Issue2 → hd28e / hd28i / infinity28
- SM REUAM3237 Issue4 → hd32
- PL HDC211e Issue03 → hdc211e refresh (Tech-synced)
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
SM_OUT = ROOT / "src" / "assets" / "service-manual-pages"
DIAGRAM_DIR = ROOT / "src" / "assets" / "diagram-pages"
OUT_JSON = ROOT / "public" / "data" / "edpl-part-map.json"

VCM_SM = "SM - RINNAI - REUVCM2837FF,FFC,WC - ISSUE 2 - FEB 2026.pdf"
AM_SM = "SM - RINNAI - REUAM3237W,WC - ISSUE 4 - FEB 2026.pdf"
HDC_PL = "PL - RINNAI - HDC211e - REU-KM3237WDC - ISSUE 03 - JUNE 2025.pdf"


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
        raise SystemExit(f"MISSING thumb {src}")
    for sid in series_ids:
        dest = SM_OUT / f"{sid}__p1.jpg"
        dest.write_bytes(src.read_bytes())
        print("thumb", dest.name, dest.stat().st_size)


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
                    "PARTS CODE",
                    "RA PART NUMBER",
                    "RA PART NUMBE RJ 11 DIGIT CODE",
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


def extract_hdc211e_issue03(edpl: dict, part_codes: set[str]) -> str | None:
    pdf = SHEETS / HDC_PL
    if not pdf.exists():
        print("MISSING", HDC_PL)
        return None
    stem = "pl-reu-km3237wdc-hdc211e-issue03"
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for i in range(doc.page_count):
        dest = DIAGRAM_DIR / f"{stem}__p{i + 1}.jpg"
        zoom = 1400 / doc[i].rect.width
        pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=72)
        print("diag", dest.name, dest.stat().st_size)
    by: dict[str, dict] = {}
    chassis = [
        "KM3237WDC",
        "REU-KM3237WDC",
        "REUKM3237WDC",
        "HDC211e",
        "HDC211E",
    ]
    for i in range(doc.page_count):
        text = doc[i].get_text("text") or ""
        if len(text.strip()) < 80:
            continue
        for r in parse_callout_rows(text):
            by[r["code"]] = {
                "callout": r["callout"],
                "page": f"{pdf.name} p{i + 1}",
                "pageKey": f"{stem}__p{i + 1}",
                "listPage": i + 1,
                "listPageKey": f"{stem}__p{i + 1}",
                "pdf": pdf.name,
                "stem": stem,
                "seriesIds": ["hdc211e"],
                "chassisTokens": chassis,
                "priority": 25,
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
            kept = [h for h in existing if h.get("stem") != stem]
            kept.insert(0, hit)
            parts[code] = kept
            updated += 1
    sheets = [s for s in edpl.setdefault("sheets", []) if s.get("stem") != stem]
    dpages = list(range(max(1, pages // 2 + 1), pages + 1)) or [1]
    sheets.append(
        {
            "file": pdf.name,
            "stem": stem,
            "status": "ok",
            "pages": pages,
            "diagramPages": dpages,
            "listPages": list(range(1, pages + 1)),
            "defaultDiagramPage": dpages[0],
            "rowsExtracted": len(by),
            "rowsInCatalogue": sum(1 for c in by if c in part_codes),
            "rowsWithListBox": 0,
            "seriesIds": ["hdc211e"],
            "chassisTokens": chassis,
            "priority": 25,
            "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        }
    )
    edpl["sheets"] = sheets
    print(stem, len(by), "inCat", sum(1 for c in by if c in part_codes), added, updated)
    return stem


def main() -> None:
    n1 = render_sm_pack(VCM_SM, "sm-vcm2837")
    print("VCM SM pages", n1)
    copy_thumbs("sm-vcm2837", ["hd28e", "hd28i", "infinity28"])
    n2 = render_sm_pack(AM_SM, "sm-am3237")
    print("AM SM pages", n2)
    copy_thumbs("sm-am3237", ["hd32"])

    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }
    edpl = json.loads(OUT_JSON.read_text(encoding="utf-8"))
    jobs = ["sm-vcm2837", "sm-am3237"]
    r = extract_hdc211e_issue03(edpl, part_codes)
    if r:
        jobs.append(r)
    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(edpl.get("parts") or {})
    totals["codesInCatalogue"] = sum(
        1 for c in (edpl.get("parts") or {}) if c in part_codes
    )
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["smVcmAmHdc211e"] = (
        "VCM2837 SM (hd28e/i + inf28) + AM3237 SM (hd32) + HDC211e Issue03 PL "
        f"({', '.join(jobs)})"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON, "jobs", jobs)


if __name__ == "__main__":
    main()
