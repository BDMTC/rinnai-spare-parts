"""
CF + Hotflo leftovers wave — Tech-synced Issue PLs → edpl-part-map + diagram JPEGs.

- REUVCM2837 FF Issue 4 → hd28i + infinity28 (critical Pin1 gap)
- REU-AM3237WC Issue 2 → hd32 dedicated PL
- Hotflo EHF 250SL / 250T315T / 400S / HFE80-400S / 160T400T → ehfa*
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


def pdf_text(pdf: Path) -> str:
    doc = pymupdf.open(pdf)
    text = "\n".join((doc[i].get_text("text") or "") for i in range(doc.page_count))
    doc.close()
    return text


def parse_vcm_ff(text: str) -> list[dict]:
    """Callout alone or '006 NAME', then name, then 8-digit RA."""
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
            # next non-qty line is name
            j = i + 1
            while j < len(lines) and j < i + 4:
                cand = lines[j]
                if re.fullmatch(r"\d{8}", cand) or re.fullmatch(r"0*\d{1,3}", cand):
                    break
                if re.fullmatch(r"\d", cand):
                    j += 1
                    continue
                if cand.upper() in {"NO", "DESCRIPTION", "RA PART", "PARTS CODE"}:
                    j += 1
                    continue
                if re.match(r"^\d{2}-\d{4}", cand):  # drawing refs
                    j += 1
                    continue
                name = cand
                break
            if not name:
                i += 1
                continue
            i = j  # continue from name line for code scan below
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
            if re.fullmatch(r"0*\d{1,3}", cand) or re.match(
                r"^0*\d{1,3}\s+\S", cand
            ):
                break
            j += 1
        if code and name:
            rows.append({"callout": callout, "code": code, "name": name[:120]})
            i = j + 1
            continue
        i += 1
    return rows


def vcm_series_ids(name: str) -> list[str]:
    u = name.upper()
    has_ffc = "FFC" in u or "FFUC" in u
    has_ff = bool(re.search(r"\bVCM2837FF\b", u)) or (
        "VCM2837FF" in u and "FFC" not in u.replace("FFC", "")
    )
    # Shared / generic VCM2837 without FF suffix → both
    if has_ffc and not re.search(r"VCM2837FF(?!C)", u):
        return ["hd28i"]
    if re.search(r"VCM2837FF(?!C)", u) and "FFC" not in u:
        return ["infinity28"]
    if has_ffc and re.search(r"VCM2837FF(?!C)", u):
        return ["hd28i", "infinity28"]
    if "FF FFC" in u or "FF/FFC" in u or "FFC FF" in u:
        return ["hd28i", "infinity28"]
    if "VCM2837" in u and not has_ffc and "FF" not in u:
        return ["hd28i", "infinity28"]
    if has_ffc:
        return ["hd28i"]
    if has_ff:
        return ["infinity28"]
    return ["hd28i", "infinity28"]


def parse_am3237(text: str) -> list[dict]:
    """'001 PANEL FRONT…' inline or next-line 8-digit RA."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        m = re.match(r"^0*(\d{1,3})\s+(.+)$", lines[i])
        if not m:
            i += 1
            continue
        callout = str(int(m.group(1)))
        rest = m.group(2).strip()
        # inline: NAME then maybe code on same? usually next line
        inline = re.match(r"^(.+?)\s+(\d{8})$", rest)
        if inline:
            rows.append(
                {
                    "callout": callout,
                    "code": inline.group(2),
                    "name": inline.group(1).strip()[:120],
                }
            )
            i += 1
            continue
        name = rest
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


def parse_hfe_list(text: str) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    last_callout = "1"
    i = 0
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


def hotflo_series_from_name(name: str, default: list[str]) -> list[str]:
    u = (name or "").upper()
    if "250" in u and "315" not in u and "400" not in u:
        return ["ehfa250"]
    if "315" in u and "250" not in u:
        return ["ehfa315"]
    if "400" in u and "160" not in u:
        return ["ehfa400"]
    if "160" in u and "400" not in u:
        return ["ehfa160"]
    if "250" in u and "315" in u:
        return ["ehfa250", "ehfa315"]
    if "160" in u and "400" in u:
        return ["ehfa160", "ehfa400"]
    return list(default)


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


def process_job(
    edpl,
    part_codes,
    *,
    fn,
    stem,
    series_ids,
    chassis,
    priority,
    parser,
    series_fn=None,
    diagram_pages=None,
) -> str | None:
    pdf = find_pdf(fn)
    if not pdf:
        print("MISSING", fn)
        return None
    pages = render_pages(pdf, stem, diagram_pages)
    doc = pymupdf.open(pdf)
    by: dict[str, dict] = {}
    for i in range(doc.page_count):
        text = doc[i].get_text("text") or ""
        rows = parser(text)
        for r in rows:
            name = r["name"]
            if re.fullmatch(r"\d+", name or ""):
                continue
            sids = series_fn(name) if series_fn else list(series_ids)
            if not sids:
                continue
            by[r["code"]] = hit_for(
                callout=r["callout"],
                name=name,
                pdf_name=pdf.name,
                stem=stem,
                page_num=i + 1,
                series_ids=sids,
                chassis=list(chassis),
                priority=priority,
            )
    doc.close()
    a, u = merge_hits(edpl, by, stem=stem)
    register_sheet(
        edpl,
        file=pdf.name,
        stem=stem,
        pages=pages,
        series_ids=series_ids,
        chassis=chassis,
        priority=priority,
        rows=len(by),
        in_cat=sum(1 for c in by if c in part_codes),
        path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
        diagram_pages=diagram_pages or list(range(1, pages + 1)),
    )
    print(stem, len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
    return stem


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

    # --- VCM2837 FF (HD28i + Infinity 28) — render list+diagram pages ---
    # Issue 4: pages 1-4 lists, 5-8 diagrams typically; render all
    r = process_job(
        edpl,
        part_codes,
        fn="PL - RINNAI - 2021 REUVCM2837 FF - ISSUE 4 - MAR 2024.pdf",
        stem="pl-reu-vcm2837-ff-issue4",
        series_ids=["hd28i", "infinity28"],
        chassis=[
            "VCM2837FF",
            "VCM2837FFC",
            "REU-VCM2837FF",
            "REU-VCM2837FFC",
            "HD28i",
            "Infinity 28",
            "INF28",
        ],
        priority=23,
        parser=parse_vcm_ff,
        series_fn=vcm_series_ids,
    )
    if r:
        jobs.append(r)

    # --- AM3237WC HD32 ---
    r = process_job(
        edpl,
        part_codes,
        fn="PL - RINNAI - 2022 REU-AM3237WC-AK - Issue 2 - FEB 2023.pdf",
        stem="pl-reu-am3237wc-hd32",
        series_ids=["hd32"],
        chassis=["AM3237WC", "REU-AM3237WC", "HD32", "HD32e"],
        priority=23,
        parser=parse_am3237,
    )
    if r:
        jobs.append(r)

    # --- Hotflo leftovers ---
    hotflo_jobs = [
        (
            "PL - RINNAI - HOTFLO - EHF 250SL 315L - PTR 850 - ISSUE 6.pdf",
            "pl-hotflo-ehf-250sl-315l",
            ["ehfa250", "ehfa315"],
            ["EHF250S", "EHFA250S", "HFE250SSL", "EHF315S", "EHFA315S", "HFE315SSL"],
        ),
        (
            "PL - RINNAI - HOTFLO - EHF 250T 315T - ISSUE 8 - MAR 2021.pdf",
            "pl-hotflo-ehf-250t-315t",
            ["ehfa250", "ehfa315"],
            ["EHF250T", "EHFA250T", "HFE250T", "EHF315T", "EHFA315T", "HFE315T"],
        ),
        (
            "PL - RINNAI - HOTFLO - EHF HFE 400S - ISSUE 7 - JUNE 2020.pdf",
            "pl-hotflo-ehf-400s",
            ["ehfa400"],
            ["EHF400S", "HFE400S", "EHFA400"],
        ),
        (
            "PL - RINNAI - HOTFLO - HFE 160T 400T - ISSUE 8 - MAR 2021.pdf",
            "pl-hotflo-hfe-160t-400t",
            ["ehfa160", "ehfa400"],
            ["EHF160T", "EHFA160T", "HFE160T", "EHF400T", "HFE400T"],
        ),
        (
            "PL - RINNAI - HOTFLO - HFE 80S 125S 160S 200S 400S - ISSUE 10 - DEC 2025.pdf",
            "pl-hotflo-hfe-80-400s-issue10",
            ["ehfa160", "ehfa400"],
            [
                "EHF80S",
                "HFE80S",
                "EHF125S",
                "HFE125S",
                "EHF160S",
                "EHFA160S",
                "HFE160S",
                "EHF200S",
                "HFE200S",
                "EHF400S",
                "HFE400S",
            ],
        ),
    ]
    for fn, stem, sids, chassis in hotflo_jobs:
        r = process_job(
            edpl,
            part_codes,
            fn=fn,
            stem=stem,
            series_ids=sids,
            chassis=chassis,
            priority=22,
            parser=parse_hfe_list,
            series_fn=lambda name, d=sids: hotflo_series_from_name(name, d),
        )
        if r:
            jobs.append(r)

    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(edpl.get("parts") or {})
    totals["codesInCatalogue"] = sum(
        1 for c in (edpl.get("parts") or {}) if c in part_codes
    )
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["cfHotfloLeftovers"] = (
        "VCM2837 FF Issue4 (hd28i/inf28) + AM3237WC HD32 + Hotflo 250SL/T/400S/80-400S "
        f"({', '.join(jobs)})"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON, "jobs", jobs)


if __name__ == "__main__":
    main()
