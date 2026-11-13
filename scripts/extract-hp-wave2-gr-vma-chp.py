"""
HP wave batch 2 — GR / Enviroflo VMA / CHP (Tech-synced).

PL:
- EHPG265VMT Issue4 + EHPG250VMP Issue3 + EHPGxxVM SPL Issue5 → ehpg-gr
- Enviroflo VMA V2 Issue7 → ehpa-vma
- Commercial CHP020/040 Issue6 → chp

SM:
- GR Series EHPGxxVM/VMT/VMP Issue1 → ehpg-gr
- Enviroflo VMA V2 Issue3 → ehpa-vma
- Comm Heat Pump CHP020/040 Issue2 → chp
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
        "pdf": "PL - RINNAI - GR SERIES HEAT PUMP - EHPG265VMT - ISSUE 4 - DEC 2025.pdf",
        "stem": "pl-ehpg-265vmt-issue4",
        "seriesIds": ["ehpg-gr"],
        "chassis": ["EHPG265VMT", "EHPG265", "EHPG", "GR SERIES"],
        "priority": 30,
        "diagramPages": [3],
        "listPages": [1, 2],
        "parser": "ra",
    },
    {
        "pdf": "PL- RINNAI - GR SERIES HEAT PUMP - EHPG250VMP - ISSUE 3 - DEC 2025.pdf",
        "stem": "pl-ehpg-250vmp-issue3",
        "seriesIds": ["ehpg-gr"],
        "chassis": ["EHPG250VMP", "EHPG250", "EHPG", "GR SERIES"],
        "priority": 29,
        "diagramPages": [1],
        "listPages": [2],
        "parser": "ra",
    },
    {
        "pdf": "SPL - RINNAI - GR SERIES_EHPGxxVM - ISSUE 5 - MAY 2026.pdf",
        "stem": "pl-ehpg-xxvm-issue5",
        "seriesIds": ["ehpg-gr"],
        "chassis": [
            "EHPG215VM",
            "EHPG265VM",
            "EHPG280VM",
            "EHPG300VM",
            "EHPG",
            "GR SERIES",
        ],
        "priority": 28,
        "diagramPages": [1],
        "listPages": [2, 3],
        "parser": "ra",
    },
    {
        "pdf": "PL - RINNAI - ENVIROFLO VMA V2 HEAT PUMP - ISSUE 7 - AUG 2024.pdf",
        "stem": "pl-ehpa-vma-issue7",
        "seriesIds": ["ehpa-vma"],
        "chassis": ["EHPA250VMA", "EHPA250", "Enviroflo", "VMA"],
        "priority": 30,
        "diagramPages": [2, 3, 4, 5],
        "listPages": [1],
        "parser": "ra",
    },
    {
        "pdf": "PL - COMMERCIAL HEAT PUMP - ISSUE 6 - OCT 2025.pdf",
        "stem": "pl-chp-issue6",
        "seriesIds": ["chp"],
        "chassis": ["CHP020", "CHP040", "CHP020H", "CHP040H", "CHP020V2", "CHP"],
        "priority": 30,
        "diagramPages": [1],
        "listPages": [1, 2],
        "parser": "chp",
    },
]

SM_JOBS = [
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - GR SERIES HEAT PUMP EHPGxxVM, VMT, VMP - ISSUE 1 - MARCH 2025.pdf",
        ),
        "stem": "sm-ehpg-gr",
        "series": ["ehpg-gr"],
    },
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - ENVIROFLO HEAT PUMP - VMA V2 - ISSUE 3 - JUN 2024.pdf",
        ),
        "stem": "sm-ehpa-vma",
        "series": ["ehpa-vma"],
    },
    {
        "tech": (
            "RINNAI COMMERCIAL HEAT PUMP",
            "SM - RINNAI - COMM HEAT PUMP CHP020 CHP040 - ISSUE 2 - OCT 2025.pdf",
        ),
        "stem": "sm-chp",
        "series": ["chp"],
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
    "CHP020",
    "CHP040",
    "CHP020V2",
    "N/A",
    "NA",
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


def parse_ra_rows(text: str) -> list[dict]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = re.fullmatch(r"(\d{1,3})(?:-\d+)?", ln)
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
                    if b.upper() in SKIP_NAMES:
                        continue
                    if re.fullmatch(r"\d{8}", b) or re.fullmatch(
                        r"\d{1,3}(?:-\d+)?", b
                    ):
                        continue
                    name = b
                    break
                if not name:
                    for a in window[j + 1 :]:
                        if a.upper() in SKIP_NAMES or re.fullmatch(r"\d{8}", a):
                            continue
                        if re.fullmatch(r"\d{1,3}(?:-\d+)?", a):
                            break
                        name = a
                        break
                break
        if code and name and not re.fullmatch(r"\d+", name):
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


def parse_chp_rows(text: str) -> list[dict]:
    """Letter callouts + 8-digit PART NUMBER (and alnum SKUs with digits)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if not re.fullmatch(r"[A-Z]", ln):
            i += 1
            continue
        callout = ln
        # next non-header line is description
        j = i + 1
        if j >= len(lines):
            break
        name = lines[j]
        if name.upper() in SKIP_NAMES:
            i += 1
            continue
        # collect codes after name until next letter callout / page noise
        k = j + 1
        codes: list[str] = []
        while k < len(lines):
            cand = lines[k]
            if re.fullmatch(r"[A-Z]", cand):
                break
            if cand in {"-", "–"} or cand.upper().startswith("SOLD"):
                k += 1
                continue
            # strip parenthetical notes
            base = re.split(r"\s*\(", cand, 1)[0].strip()
            if re.fullmatch(r"\d{8}", base):
                codes.append(base)
            elif re.fullmatch(r"[A-Z]{2,}\d+[A-Z0-9]*", base) and len(base) >= 6:
                # e.g. DDMSP302 / DDMSP1001
                codes.append(base)
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
    parser = parse_chp_rows if job["parser"] == "chp" else parse_ra_rows
    for i in range(doc.page_count):
        text = doc[i].get_text("text") or ""
        for r in parser(text):
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
    edpl.setdefault("meta", {})["hpWave2GrVmaChp"] = {"pl": pl_stats, "sm": sm_stats}
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)


if __name__ == "__main__":
    main()
