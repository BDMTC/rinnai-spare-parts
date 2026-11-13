"""
Hotflo / Efinity / GHF wave — Tech-synced Issue PLs → edpl-part-map + diagram JPEGs.

Sources copied from store media/rinnai-tech-latest (do not invent).
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

ITEM_NAMES_10 = {
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


def find_pdf(name: str) -> Path | None:
    direct = SHEETS / name
    if direct.exists():
        return direct
    for p in SHEETS.glob("*.pdf"):
        if p.name.lower() == name.lower():
            return p
    for p in SHEETS.glob("*.PDF"):
        if p.name.lower() == name.lower():
            return p
    hits = list((ROOT / "data-sheets").rglob(name))
    return hits[0] if hits else None


def render_all(pdf: Path, stem: str) -> int:
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for i in range(doc.page_count):
        dest = DIAGRAM_DIR / f"{stem}__p{i + 1}.jpg"
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


def parse_ghf(text: str) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines) and lines[i].upper() != "DESCRIPTION":
        i += 1
    i += 1
    last_callout = None
    while i < len(lines):
        ln = lines[i]
        if ln.upper().startswith("RINNAI HOTFLO") or ln.upper() == "NOT SHOWN":
            i += 1
            continue
        if re.fullmatch(r"\d{1,2}", ln):
            last_callout = ln
            i += 1
            continue
        if re.fullmatch(r"\d{8}", ln) and last_callout:
            code = ln
            name = lines[i + 1] if i + 1 < len(lines) else ""
            if re.fullmatch(r"\d{8}", name) or re.fullmatch(r"\d{1,2}", name):
                name = ""
            else:
                i += 1
            rows.append({"callout": last_callout, "code": code, "name": name[:120]})
            i += 1
            continue
        i += 1
    return rows


def parse_matrix(text: str, model_re: re.Pattern[str]) -> list[dict]:
    """Carry-forward matrix cells → unique RA codes with chassis tokens."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    models: list[dict] = []
    i = 0
    while i < len(lines):
        if model_re.fullmatch(lines[i]):
            model = lines[i].upper()
            cells: list[str] = []
            j = i + 1
            while j < len(lines) and len(cells) < 10:
                cell = lines[j].strip()
                if model_re.fullmatch(cell):
                    break
                up = cell.upper()
                if up in {"WEIGHT", "SCALE", "A3 SIZE"} or up.startswith("ELECTRIC"):
                    break
                if re.fullmatch(r"\d{8}", cell) or up in {"N/A", "NA", "-"}:
                    cells.append("N/A" if up in {"N/A", "NA", "-"} else cell)
                    j += 1
                    continue
                break
            models.append({"model": model, "cells": cells})
            i = j
            continue
        i += 1
    carried = ["N/A"] * 10
    by_code: dict[str, dict] = {}
    for row in models:
        cells = list(row["cells"]) + [""] * 10
        for idx in range(10):
            raw = (cells[idx] or "").strip() or carried[idx]
            if raw.upper() in {"N/A", "NA", "-"}:
                carried[idx] = "N/A"
                continue
            if re.fullmatch(r"\d{8}", raw):
                carried[idx] = raw
                callout = str(idx + 1)
                hit = by_code.get(raw)
                if hit:
                    if row["model"] not in hit["chassisTokens"]:
                        hit["chassisTokens"].append(row["model"])
                else:
                    by_code[raw] = {
                        "callout": callout,
                        "code": raw,
                        "name": ITEM_NAMES_10.get(callout, ""),
                        "chassisTokens": [row["model"]],
                    }
    return list(by_code.values())


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


def parse_efinity(text: str) -> list[dict]:
    """Walk lines: track callout / Not shown; emit every 8-digit RA (92*)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    seen: set[str] = set()
    last_callout = "1"
    not_shown = False
    i = 0
    while i < len(lines):
        ln = lines[i]
        up = ln.upper()
        if up.startswith("NOT SHOWN"):
            not_shown = True
            i += 1
            continue
        if up.startswith("PAGE ") or up.startswith("ISSUE ") or up.startswith(
            "EFINITY "
        ):
            i += 1
            continue
        if up in {
            "NO.",
            "RA PART NUMBER",
            "PARTS INCLUDED",
            "PART NAME",
            "SUPPLIER CODE",
            "SPARE PARTS AND EXPLODED VIEW",
        }:
            i += 1
            continue
        if re.fullmatch(r"\d{1,3}", ln):
            last_callout = str(int(ln))
            not_shown = False
            i += 1
            continue
        if re.fullmatch(r"\d{8}", ln) and ln.startswith("92"):
            code = ln
            name = ""
            # name often after parts-included / before supplier
            for k in range(i + 1, min(i + 5, len(lines))):
                cand = lines[k]
                if re.fullmatch(r"\d{8}", cand) or re.fullmatch(r"\d{1,3}", cand):
                    break
                if re.match(r"^\d+/", cand):
                    continue
                if re.match(r"^[0-9A-Z]{10,}$", cand) or re.match(r"^\d{11}", cand):
                    continue
                if cand.upper().startswith("NOT SHOWN") or cand.upper().startswith(
                    "PAGE "
                ):
                    break
                if "ECF" in cand.upper() or cand.isupper() or " " in cand:
                    name = cand
                    break
            callout = "NS" if not_shown else last_callout
            if code not in seen:
                seen.add(code)
                rows.append({"callout": callout, "code": code, "name": name[:120]})
            not_shown = False
            i += 1
            continue
        i += 1
    return rows


def merge_hits(
    edpl: dict,
    by_code: dict[str, dict],
    *,
    stem: str,
) -> tuple[int, int]:
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
):
    sheets = [s for s in edpl.setdefault("sheets", []) if s.get("stem") != stem]
    sheets.append(
        {
            "file": file,
            "stem": stem,
            "status": "ok",
            "pages": pages,
            "diagramPages": list(range(1, pages + 1)),
            "listPages": list(range(1, pages + 1)),
            "defaultDiagramPage": 1,
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
    callout: str,
    name: str,
    pdf_name: str,
    stem: str,
    series_ids: list[str],
    chassis: list[str],
    priority: int,
) -> dict:
    return {
        "callout": callout,
        "page": f"{pdf_name} p1",
        "pageKey": f"{stem}__p1",
        "listPage": 1,
        "listPageKey": f"{stem}__p1",
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

    # --- GHF4 ---
    fn = "PL - RINNAI - HOTFLO - GHF4 135L,170L - ISSUE 4 - OCT 2021.pdf"
    pdf = find_pdf(fn)
    if pdf:
        stem = "pl-hotflo-ghf4"
        pages = render_all(pdf, stem)
        rows = parse_ghf(pdf_text(pdf))
        by = {
            r["code"]: hit_for(
                callout=r["callout"],
                name=r["name"],
                pdf_name=pdf.name,
                stem=stem,
                series_ids=["ghf4"],
                chassis=["GHF4", "GHF4135", "Hotflo GHF4"],
                priority=22,
            )
            for r in rows
        }
        a, u = merge_hits(edpl, by, stem=stem)
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["ghf4"],
            chassis=["GHF4", "GHF4135"],
            priority=22,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
        )
        print("ghf4", len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append("ghf4")
    else:
        print("MISSING", fn)

    # --- EHFA400 ---
    fn = "PL - RINNAI - HOTFLO - EHFA 400L - ISSUE 1 - MARCH 2021.PDF"
    pdf = find_pdf(fn)
    if pdf:
        stem = "pl-hotflo-ehfa400"
        pages = render_all(pdf, stem)
        rows = parse_matrix(pdf_text(pdf), re.compile(r"^EHFA\d{3}[A-Z0-9]*$", re.I))
        by = {
            r["code"]: hit_for(
                callout=r["callout"],
                name=r["name"],
                pdf_name=pdf.name,
                stem=stem,
                series_ids=["ehfa400"],
                chassis=["EHFA400", "Hotflo EHFA400"] + r["chassisTokens"],
                priority=22,
            )
            for r in rows
        }
        a, u = merge_hits(edpl, by, stem=stem)
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["ehfa400"],
            chassis=["EHFA400"],
            priority=22,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
        )
        print("ehfa400", len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append("ehfa400")
    else:
        print("MISSING", fn)

    # --- EHFD160 ---
    fn = "PL - RINNAI - HOTFLO - EHFD160 - ISSUE 1 - JUNE 2018.pdf"
    pdf = find_pdf(fn)
    if pdf:
        stem = "pl-hotflo-ehfd160"
        pages = render_all(pdf, stem)
        rows = parse_matrix(pdf_text(pdf), re.compile(r"^EHFD\d{0,3}[A-Z0-9]*$", re.I))
        by = {
            r["code"]: hit_for(
                callout=r["callout"],
                name=r["name"],
                pdf_name=pdf.name,
                stem=stem,
                series_ids=["ehfd160"],
                chassis=["EHFD160", "Hotflo EHFD160"] + r["chassisTokens"],
                priority=22,
            )
            for r in rows
        }
        a, u = merge_hits(edpl, by, stem=stem)
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["ehfd160"],
            chassis=["EHFD160"],
            priority=22,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
        )
        print("ehfd160", len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append("ehfd160")
    else:
        print("MISSING", fn)

    # --- EHF25 (HFE 25/50) ---
    fn = "PL - RINNAI - HOTFLO - HFE 25L 50L - ISSUE 9 - DEC 2022.pdf"
    pdf = find_pdf(fn)
    if pdf:
        stem = "pl-hotflo-ehf25"
        pages = render_all(pdf, stem)
        rows = parse_hfe_list(pdf_text(pdf))
        by = {}
        for r in rows:
            name = r["name"]
            if re.fullmatch(r"\d+", name or ""):
                continue
            by[r["code"]] = hit_for(
                callout=r["callout"],
                name=name,
                pdf_name=pdf.name,
                stem=stem,
                series_ids=["ehf25"],
                chassis=["EHF25", "HFE25", "Hotflo EHF25", "HFE 25L 50L"],
                priority=22,
            )
        a, u = merge_hits(edpl, by, stem=stem)
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["ehf25"],
            chassis=["EHF25", "HFE25"],
            priority=22,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
        )
        print("ehf25", len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append("ehf25")
    else:
        print("MISSING", fn)

    # --- Efinity unique PDFs (ECF14 I50==I60 shared) ---
    efinity_files = [
        (
            "PL - RINNAI - EFINITY ECF14I50 - ISSUE 4 - JUL 2026.pdf",
            "pl-efinity-ecf14",
            ["ECF14", "ECF14I50", "ECF14I60"],
        ),
        (
            "PL - RINNAI - EFINITY ECF19I50 - ISSUE 4 - JUL 2026.pdf",
            "pl-efinity-ecf19i50",
            ["ECF19I50"],
        ),
        (
            "PL - RINNAI - EFINITY ECF19I60 - ISSUE 4 - JUL 2026.pdf",
            "pl-efinity-ecf19i60",
            ["ECF19I60"],
        ),
        (
            "PL - RINNAI - EFINITY ECF29I50 - ISSUE 4 - JUL 2026.pdf",
            "pl-efinity-ecf29i50",
            ["ECF29I50"],
        ),
        (
            "PL - RINNAI - EFINITY ECF29I60 - ISSUE 4 - JUL 2026.pdf",
            "pl-efinity-ecf29i60",
            ["ECF29I60"],
        ),
    ]
    for fn, stem, tokens in efinity_files:
        pdf = find_pdf(fn)
        if not pdf:
            print("MISSING", fn)
            continue
        pages = render_all(pdf, stem)
        rows = parse_efinity(pdf_text(pdf))
        by = {
            r["code"]: hit_for(
                callout=r["callout"],
                name=r["name"],
                pdf_name=pdf.name,
                stem=stem,
                series_ids=["efinity-ecf"],
                chassis=["Efinity", "ECF"] + tokens,
                priority=22,
            )
            for r in rows
        }
        a, u = merge_hits(edpl, by, stem=stem)
        register_sheet(
            edpl,
            file=pdf.name,
            stem=stem,
            pages=pages,
            series_ids=["efinity-ecf"],
            chassis=tokens,
            priority=22,
            rows=len(by),
            in_cat=sum(1 for c in by if c in part_codes),
            path=str(pdf.relative_to(ROOT)).replace("\\", "/"),
        )
        print(stem, len(by), "inCat", sum(1 for c in by if c in part_codes), a, u)
        jobs.append(stem)

    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(edpl.get("parts") or {})
    totals["codesInCatalogue"] = sum(
        1 for c in (edpl.get("parts") or {}) if c in part_codes
    )
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["hotfloEfinityWave"] = (
        "Tech-synced Hotflo GHF4/EHFA400/EHFD160/EHF25 + Efinity ECF Issue PLs "
        f"({', '.join(jobs)})"
    )
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON, "jobs", jobs)


if __name__ == "__main__":
    main()
