"""
HDC32e/i (NB3237) + HDC211i (KM3237FFUDC) + HD28e WC Issue5 refresh.

Tech-synced Issue PLs → edpl-part-map + diagram JPEGs. HP deferred.
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


def find_pdf(name: str) -> Path | None:
    direct = SHEETS / name
    if direct.exists():
        return direct
    for p in SHEETS.glob("*"):
        if p.name.lower() == name.lower():
            return p
    hits = list((ROOT / "data-sheets").rglob(name))
    return hits[0] if hits else None


def render_pages(pdf: Path, stem: str, pages: list[int] | None = None) -> int:
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    targets = pages or list(range(1, doc.page_count + 1))
    for pn in targets:
        i = pn - 1
        if i < 0 or i >= doc.page_count:
            continue
        dest = DIAGRAM_DIR / f"{stem}__p{pn}.jpg"
        zoom = 1400 / doc[i].rect.width
        pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=72)
        print("wrote", dest.name, dest.stat().st_size)
    n = doc.page_count
    doc.close()
    return n


def parse_callout_name_code(text: str) -> list[dict]:
    """'001 Name' or '001' / Name / 8-digit RA (HDC/VCM style)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        callout = None
        name = None
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
                    "DRAWING PART NO.",
                    "PART NAME",
                    "RA PART NO.",
                    "NOTE",
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


def parse_nb3237(text: str) -> list[dict]:
    """NB matrix: callout / name / RA / supplier / qty FFC WC W."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    last_callout = "1"
    while i < len(lines):
        ln = lines[i]
        if re.fullmatch(r"0*\d{1,3}", ln):
            last_callout = str(int(ln))
            i += 1
            continue
        # name line followed by 8-digit RA
        if i + 1 < len(lines) and re.fullmatch(r"\d{8}", lines[i + 1]):
            if (
                not re.fullmatch(r"\d{8}", ln)
                and ln.upper()
                not in {
                    "DRAWING PART NO.",
                    "PART NAME",
                    "RA PART NO.",
                    "PARTS CODE",
                    "NOTE",
                }
                and not ln.startswith("REU-")
                and not ln.startswith("ISSUE")
                and not ln.startswith("Rinnai")
                and not ln.startswith("Effective")
                and not ln.startswith("Some part")
                and not ln.startswith("Contact Rinnai")
            ):
                name = ln
                code = lines[i + 1]
                # peek qty columns after supplier
                qty = []
                j = i + 2
                # skip supplier-ish
                if j < len(lines) and (
                    re.match(r"^\d{3}-", lines[j])
                    or re.match(r"^\d{11}", lines[j])
                    or re.match(r"^[0-9A-Z-]{7,}$", lines[j])
                ):
                    j += 1
                while j < len(lines) and len(qty) < 3:
                    q = lines[j]
                    if q in {"-", "–", "1", "2", "3", "4"} or re.fullmatch(r"\d", q):
                        qty.append(q)
                        j += 1
                        continue
                    break
                # map columns: FFC, WC, W
                sids: list[str] = []
                if len(qty) >= 3:
                    if qty[0] not in {"-", "–"}:
                        sids.append("hdc32i")
                    if qty[1] not in {"-", "–"}:
                        sids.append("hdc32e")
                    # W column = INF ENVIRO residential NB3237W — chassis token only
                else:
                    # name hints
                    u = name.upper()
                    if "FFC" in u and "WC" not in u:
                        sids = ["hdc32i"]
                    elif "WC" in u and "FFC" not in u:
                        sids = ["hdc32e"]
                    elif "ENVIRO" in u and "FFC" not in u and "WC" not in u:
                        sids = []  # W-only ENVIRO panel
                    else:
                        sids = ["hdc32e", "hdc32i"]
                if not sids:
                    # still keep for free search with chassis tokens; skip series pin
                    sids = []
                rows.append(
                    {
                        "callout": last_callout,
                        "code": code,
                        "name": name[:120],
                        "seriesIds": sids,
                    }
                )
                i = j
                continue
        i += 1
    return rows


def merge_hits(edpl: dict, by_code: dict[str, dict], *, stem: str) -> tuple[int, int]:
    parts = edpl.setdefault("parts", {})
    added = updated = 0
    for code, hit in by_code.items():
        existing = parts.get(code)
        if not isinstance(existing, list):
            parts[code] = [hit]
            added += 1
        else:
            kept = [h for h in existing if h.get("stem") != stem]
            kept.insert(0, hit)
            parts[code] = kept
            updated += 1
    return added, updated


def register_sheet(
    edpl,
    *,
    file,
    stem,
    pages,
    series_ids,
    chassis,
    priority,
    rows,
    in_cat,
    path,
    diagram_pages=None,
):
    sheets = [s for s in edpl.setdefault("sheets", []) if s.get("stem") != stem]
    dpages = diagram_pages or list(range(1, pages + 1))
    sheets.append(
        {
            "file": file,
            "stem": stem,
            "status": "ok",
            "pages": pages,
            "diagramPages": dpages,
            "listPages": list(range(1, pages + 1)),
            "defaultDiagramPage": dpages[0] if dpages else 1,
            "rowsExtracted": rows,
            "rowsInCatalogue": in_cat,
            "rowsWithListBox": 0,
            "seriesIds": series_ids,
            "chassisTokens": chassis,
            "priority": priority,
            "path": path,
        }
    )
    edpl["sheets"] = sheets


def hit_for(
    *,
    callout,
    name,
    pdf_name,
    stem,
    page_num,
    series_ids,
    chassis,
    priority,
) -> dict:
    return {
        "callout": str(callout),
        "page": f"{pdf_name} p{page_num}",
        "pageKey": f"{stem}__p{page_num}",
        "listPage": page_num,
        "listPageKey": f"{stem}__p{page_num}",
        "pdf": pdf_name,
        "stem": stem,
        "seriesIds": series_ids,
        "chassisTokens": chassis,
        "priority": priority,
        "name": name,
    }


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
    jobs: list[str] = []

    # --- NB3237 → hdc32e + hdc32i ---
    fn = "PL - RINNAI - NB SERIES - REU-NB3237 - INF ENVIRO32 - ISSUE 2 - SEP 2026.pdf"
    pdf = find_pdf(fn)
    if pdf:
        stem = "pl-reu-nb3237-hdc32"
        pages = render_pages(pdf, stem)
        doc = pymupdf.open(pdf)
        by: dict[str, dict] = {}
        chassis = [
            "NB3237",
            "NB3237WC",
            "NB3237FFC",
            "REU-NB3237",
            "HDC32e",
            "HDC32i",
            "HDC32",
        ]
        for i in range(doc.page_count):
            text = doc[i].get_text("text") or ""
            if len(text.strip()) < 80:
                continue
            for r in parse_nb3237(text):
                sids = r.get("seriesIds") or ["hdc32e", "hdc32i"]
                if not sids:
                    # W-only ENVIRO — keep chassis tokens, no HDC series pin
                    continue
                by[r["code"]] = hit_for(
                    callout=r["callout"],
                    name=r["name"],
                    pdf_name=pdf.name,
                    stem=stem,
                    page_num=i + 1,
                    series_ids=sids,
                    chassis=chassis,
                    priority=24,
                )
        doc.close()
        a, u = merge_hits(edpl, by, stem=stem)
        # diagram pages: later pages often exploded (6-9)
        dpages = list(range(6, pages + 1)) if pages >= 6 else list(range(1, pages + 1))
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["hdc32e", "hdc32i"],
            chassis=chassis,
            priority=24,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
            diagram_pages=dpages,
        )
        print(stem, len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append(stem)
    else:
        print("MISSING", fn)

    # --- KM3237FFUDC → hdc211i ---
    fn = "PL - RINNAI - INF32 - REU-KM3237FFUDC-AK - ISSUE 3 - JUNE 2025.pdf"
    pdf = find_pdf(fn)
    if pdf:
        stem = "pl-reu-km3237ffudc-hdc211i"
        pages = render_pages(pdf, stem)
        doc = pymupdf.open(pdf)
        by = {}
        chassis = [
            "KM3237FFUDC",
            "REU-KM3237FFUDC",
            "REUKM3237FFUDC",
            "HDC211i",
            "HDC211I",
        ]
        for i in range(doc.page_count):
            text = doc[i].get_text("text") or ""
            if len(text.strip()) < 80:
                continue
            for r in parse_callout_name_code(text):
                by[r["code"]] = hit_for(
                    callout=r["callout"],
                    name=r["name"],
                    pdf_name=pdf.name,
                    stem=stem,
                    page_num=i + 1,
                    series_ids=["hdc211i"],
                    chassis=chassis,
                    priority=24,
                )
        doc.close()
        a, u = merge_hits(edpl, by, stem=stem)
        dpages = [p for p in range(1, pages + 1)]
        # prefer image pages 4+ as default diagram
        default_d = [p for p in dpages if p >= 4] or dpages
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["hdc211i"],
            chassis=chassis,
            priority=24,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
            diagram_pages=default_d,
        )
        print(stem, len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append(stem)
    else:
        print("MISSING", fn)

    # --- VCM2837 WC Issue 5 → hd28e refresh ---
    fn = "PL - RINNAI - 2021 REUVCM2837 WC ISSUE 5 - MAY 2026.pdf"
    pdf = find_pdf(fn)
    if pdf:
        stem = "pl-reu-vcm2837-wc-issue5"
        pages = render_pages(pdf, stem)
        doc = pymupdf.open(pdf)
        by = {}
        chassis = [
            "VCM2837WC",
            "REU-VCM2837WC",
            "REUVCM2837WC",
            "HD28e",
            "HD28E",
        ]
        for i in range(doc.page_count):
            text = doc[i].get_text("text") or ""
            if len(text.strip()) < 80:
                continue
            for r in parse_callout_name_code(text):
                by[r["code"]] = hit_for(
                    callout=r["callout"],
                    name=r["name"],
                    pdf_name=pdf.name,
                    stem=stem,
                    page_num=i + 1,
                    series_ids=["hd28e"],
                    chassis=chassis,
                    priority=24,
                )
        doc.close()
        a, u = merge_hits(edpl, by, stem=stem)
        dpages = list(range(5, pages + 1)) if pages >= 5 else list(range(1, pages + 1))
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["hd28e"],
            chassis=chassis,
            priority=24,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
            diagram_pages=dpages,
        )
        print(stem, len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append(stem)
    else:
        print("MISSING", fn)

    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(edpl.get("parts") or {})
    totals["codesInCatalogue"] = sum(
        1 for c in (edpl.get("parts") or {}) if c in part_codes
    )
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["hdc32Hdc211i"] = (
        "NB3237 HDC32e/i + KM3237FFUDC HDC211i + VCM2837 WC Issue5 hd28e "
        f"({', '.join(jobs)})"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON, "jobs", jobs)


if __name__ == "__main__":
    main()
