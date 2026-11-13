"""
HP wave batch 3 — Enviroflo classic + split leftovers + GR 10A/VMH SPLs.

PL:
- Enviroflo Issue13 (EHPA250/315 VM/VMH) → ehpa-vm
- Enviroflo Split SHPR50 Issue1 → enviroflo-shpr50
- Enviroflo Split SHPL70 Issue1 → enviroflo-shpl70
- GR EHPG180/265L/300 VM10 + EHPG280VMH SPLs → ehpg-gr

SM:
- Enviroflo Heat Pump Issue2 → ehpa-vm
- Enviroflo Split SHPR50 Issue1 → enviroflo-shpr50
- Enviroflo Split SHPL70 Issue1 → enviroflo-shpl70
"""
from __future__ import annotations

import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
DIAGRAM_DIR = ROOT / "src" / "assets" / "diagram-pages"
SM_OUT = ROOT / "src" / "assets" / "service-manual-pages"
OUT_JSON = ROOT / "public" / "data" / "edpl-part-map.json"
TECH = Path(
    r"C:\Users\MrMoo\AppData\Local\Cursor\AgentStores\cursor_agent_stores"
    r"\bc-d92c502a-6769-481d-8807-f6d8424bcab1\files\media\rinnai-tech-latest"
    r"\Rinnai Hot Water"
)

PL_JOBS = [
    {
        "pdf": "PL - RINNAI - ENVIROFLO HEAT PUMP - ISSUE 13 - AUG 2024.PDF",
        "stem": "pl-ehpa-vm-issue13",
        "seriesIds": ["ehpa-vm"],
        "chassis": [
            "EHPA250VM",
            "EHPA250VMH",
            "EHPA315VM",
            "EHPA315VMH",
            "EHPA",
            "Enviroflo",
        ],
        "priority": 28,
        "diagramPages": [1, 2],
        "listPages": [2],
        "parser": "matrix",
    },
    {
        "pdf": "PL - RINNAI - ENVIROFLO SPLIT HEAT PUMP - SHPR50 - ISSUE 1 - AUG 2025.pdf",
        "stem": "pl-enviroflo-shpr50-issue1",
        "seriesIds": ["enviroflo-shpr50"],
        "chassis": ["SHPR50", "Enviroflo Split", "Enviroflo"],
        "priority": 30,
        "diagramPages": [1],
        "listPages": [1],
        "parser": "padded",
    },
    {
        "pdf": "PL- RINNAI - ENVIROFLO SPLIT HEAT PUMP - SHPL70 - ISSUE 1 - AUG 2025.pdf",
        "stem": "pl-enviroflo-shpl70-issue1",
        "seriesIds": ["enviroflo-shpl70"],
        "chassis": ["SHPL70", "Enviroflo Split", "Enviroflo"],
        "priority": 30,
        "diagramPages": [1],
        "listPages": [1],
        "parser": "ra",
    },
    {
        "pdf": "SPL - RINNAI - GR SERIES_EHPG180VM10 -10AMP - ISSUE 3 - MAY 2026.pdf",
        "stem": "pl-ehpg-180vm10-issue3",
        "seriesIds": ["ehpg-gr"],
        "chassis": ["EHPG180VM10", "EHPG180", "EHPG", "GR SERIES"],
        "priority": 27,
        "diagramPages": [1],
        "listPages": [2, 3],
        "parser": "ra",
    },
    {
        "pdf": "SPL - RINNAI - GR SERIES_EHPG265LVM10 -10AMP - ISSUE 2 - MAY 2026.pdf",
        "stem": "pl-ehpg-265lvm10-issue2",
        "seriesIds": ["ehpg-gr"],
        "chassis": ["EHPG265LVM10", "EHPG265L", "EHPG", "GR SERIES"],
        "priority": 27,
        "diagramPages": [1],
        "listPages": [2, 3],
        "parser": "ra",
    },
    {
        "pdf": "SPL - RINNAI - GR SERIES_EHPG280VMH - ISSUE 2 - MAY 2026.pdf",
        "stem": "pl-ehpg-280vmh-issue2",
        "seriesIds": ["ehpg-gr"],
        "chassis": ["EHPG280VMH", "EHPG280", "EHPG", "GR SERIES"],
        "priority": 27,
        "diagramPages": [1],
        "listPages": [2, 3],
        "parser": "ra",
    },
    {
        "pdf": "SPL - RINNAI - GR SERIES_EHPG300VM10 -10AMP - ISSUE 2 - MAY 2026.pdf",
        "stem": "pl-ehpg-300vm10-issue2",
        "seriesIds": ["ehpg-gr"],
        "chassis": ["EHPG300VM10", "EHPG300", "EHPG", "GR SERIES"],
        "priority": 27,
        "diagramPages": [1],
        "listPages": [2, 3],
        "parser": "ra",
    },
]

SM_JOBS = [
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - ENVIROFLO HEAT PUMP - ISSUE 2 - NOV 2021.pdf",
        ),
        "stem": "sm-ehpa-vm",
        "series": ["ehpa-vm"],
    },
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - ENVIROFLO SPLIT HEAT PUMP - SHPR50 - 250L, 315L - ISSUE 1 - JUL 2025.pdf",
        ),
        "stem": "sm-enviroflo-shpr50",
        "series": ["enviroflo-shpr50"],
    },
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - ENVIROFLO SPLIT HEAT PUMP - SHPL70 - ISSUE 1 - SEP 2025.pdf",
        ),
        "stem": "sm-enviroflo-shpl70",
        "series": ["enviroflo-shpl70"],
    },
]

SKIP_NAMES = {
    "NO",
    "ITEM NO",
    "ITEM NO.",
    "ITEM",
    "RA PART NO",
    "RA PART NO.",
    "RA PART NUMBER",
    "RA DESCRIPTION",
    "DESCRIPTION",
    "PART NAME",
    "PART NUMBER",
    "SUPPLIER CODE",
    "SUNRISE CODE",
    "MODEL",
    "N/A",
    "NA",
    "SPARE PARTS CODE",
}


def ensure_pdf(name: str) -> Path:
    p = SHEETS / name
    if p.exists():
        return p
    for c in SHEETS.iterdir():
        if c.name.lower() == name.lower():
            return c
    raise SystemExit(f"MISSING {name}")


def sync_sm(tech_dir: str, name: str) -> Path:
    src = TECH / tech_dir / name
    if not src.exists():
        raise SystemExit(f"MISSING TECH SM {src}")
    dest = SHEETS / name
    if not dest.exists() or dest.stat().st_size != src.stat().st_size:
        shutil.copy2(src, dest)
        print("copied SM", name, dest.stat().st_size)
    return dest


def render_pages(pdf: Path, out_dir: Path, stem: str, *, width=900, quality=55) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf)
    for i in range(doc.page_count):
        dest = out_dir / f"{stem}__p{i + 1}.jpg"
        if dest.exists() and dest.stat().st_size > 8_000:
            continue
        zoom = width / doc[i].rect.width
        pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        pix.save(dest, jpg_quality=quality)
        print("img", dest.name, dest.stat().st_size)
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
        print("thumb", dest.name)


def _is_supplierish(s: str) -> bool:
    u = s.upper().strip()
    if u in SKIP_NAMES:
        return True
    if re.fullmatch(r"\d{8}", u):
        return True
    if re.fullmatch(r"\d{1,3}(?:-\d{1,2})?", u):
        return True
    # supplier codes like 019-6202000 / 209-489-000 / R1.07.08.00166
    if re.search(r"\d{2,}-\d{2,}", u):
        return True
    if re.fullmatch(r"[A-Z]\d+(\.\d+)+", u):
        return True
    return False


def parse_ra_rows(text: str, *, padded: bool = False) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if padded:
            m = re.fullmatch(r"0*(\d{1,3})", ln)
        else:
            m = re.fullmatch(r"(\d{1,3})(?:-\d{1,2})?", ln)
        if not m:
            i += 1
            continue
        callout = str(int(m.group(1)))
        code = None
        name = None
        window = lines[i + 1 : i + 6]
        for j, cand in enumerate(window):
            if re.fullmatch(r"\d{8}", cand):
                code = cand
                before = window[:j]
                for b in reversed(before):
                    if _is_supplierish(b):
                        continue
                    name = b
                    break
                if not name:
                    for a in window[j + 1 :]:
                        if _is_supplierish(a):
                            continue
                        if padded and re.fullmatch(r"0*\d{1,3}", a):
                            break
                        if (not padded) and re.fullmatch(
                            r"\d{1,3}(?:-\d{1,2})?", a
                        ):
                            break
                        name = a
                        break
                break
        if code and name and not re.fullmatch(r"\d+", name) and not _is_supplierish(name):
            rows.append({"callout": callout, "code": code, "name": name[:120]})
        i += 1
    seen: set[str] = set()
    out: list[dict] = []
    for r in rows:
        if r["code"] in seen:
            continue
        seen.add(r["code"])
        out.append(r)
    return out


def parse_matrix_rows(text: str) -> list[dict]:
    """Issue13-style: callout, DESCRIPTION, then one+ chassis RA codes."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = re.fullmatch(r"(\d{1,2})", ln)
        if not m:
            i += 1
            continue
        callout = str(int(m.group(1)))
        if i + 1 >= len(lines):
            break
        name = lines[i + 1]
        if _is_supplierish(name) or re.fullmatch(r"\d{8}", name):
            i += 1
            continue
        codes: list[str] = []
        k = i + 2
        while k < len(lines):
            cand = lines[k]
            if re.fullmatch(r"\d{1,2}", cand):
                break
            if re.fullmatch(r"\d{8}", cand):
                if cand not in codes:
                    codes.append(cand)
            elif cand.upper() in {
                "SCALE",
                "N/A",
                "WEIGHT",
                "LINEAR = 1",
                "ANGULAR = 1",
            }:
                break
            k += 1
        for code in codes:
            rows.append({"callout": callout, "code": code, "name": name[:120]})
        i = k if k > i else i + 1

    seen: set[str] = set()
    out: list[dict] = []
    for r in rows:
        if r["code"] in seen:
            continue
        seen.add(r["code"])
        out.append(r)
    return out


def extract_pl(job: dict, edpl: dict, part_codes: set[str]) -> dict:
    pdf = ensure_pdf(job["pdf"])
    stem = job["stem"]
    pages = render_pages(pdf, DIAGRAM_DIR, stem, width=1400, quality=72)
    doc = pymupdf.open(pdf)
    by: dict[str, dict] = {}
    parser_name = job["parser"]
    for i in range(doc.page_count):
        if i + 1 not in job["listPages"]:
            continue
        text = doc[i].get_text("text") or ""
        if parser_name == "matrix":
            parsed = parse_matrix_rows(text)
        elif parser_name == "padded":
            parsed = parse_ra_rows(text, padded=True)
        else:
            parsed = parse_ra_rows(text, padded=False)
        for r in parsed:
            by[r["code"]] = {
                "callout": r["callout"],
                "page": f"{pdf.name} p{i + 1}",
                "pageKey": f"{stem}__p{i + 1}",
                "listPage": i + 1,
                "listPageKey": f"{stem}__p{i + 1}",
                "pdf": pdf.name,
                "stem": stem,
                "seriesIds": list(job["seriesIds"]),
                "chassisTokens": list(job["chassis"]),
                "priority": job["priority"],
                "name": r["name"],
            }
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
    dpages = [p for p in job["diagramPages"] if 1 <= p <= pages] or [pages]
    lpages = [p for p in job["listPages"] if 1 <= p <= pages] or list(
        range(1, pages + 1)
    )
    sheets.append(
        {
            "file": pdf.name,
            "stem": stem,
            "status": "ok",
            "pages": pages,
            "diagramPages": dpages,
            "listPages": lpages,
            "defaultDiagramPage": dpages[0],
            "rowsExtracted": len(by),
            "rowsInCatalogue": sum(1 for c in by if c in part_codes),
            "rowsWithListBox": len(by),
            "seriesIds": list(job["seriesIds"]),
            "chassisTokens": list(job["chassis"]),
            "priority": job["priority"],
            "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
        }
    )
    edpl["sheets"] = sheets
    print(
        stem,
        "rows",
        len(by),
        "inCat",
        sum(1 for c in by if c in part_codes),
        "added",
        added,
        "updated",
        updated,
    )
    return {"stem": stem, "rows": len(by), "inCat": sum(1 for c in by if c in part_codes)}


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

    pl_stats = [extract_pl(job, edpl, part_codes) for job in PL_JOBS]

    sm_stats = []
    for job in SM_JOBS:
        pdf = sync_sm(*job["tech"])
        n = render_pages(pdf, SM_OUT, job["stem"], width=900, quality=55)
        copy_thumbs(job["stem"], job["series"])
        sm_stats.append({"stem": job["stem"], "pages": n, "series": job["series"]})
        print("SM OK", job["stem"], n)

    totals = edpl.setdefault("totals", {})
    totals["uniqueCodes"] = len(edpl.get("parts") or {})
    totals["codesInCatalogue"] = sum(
        1 for c in (edpl.get("parts") or {}) if c in part_codes
    )
    edpl["version"] = max(int(edpl.get("version") or 1), 2)
    edpl["generatedAt"] = datetime.now(timezone.utc).isoformat()
    edpl.setdefault("meta", {})["hpWave3EnvirofloSplitGrAmp"] = {
        "pl": pl_stats,
        "sm": sm_stats,
    }
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)


if __name__ == "__main__":
    main()
