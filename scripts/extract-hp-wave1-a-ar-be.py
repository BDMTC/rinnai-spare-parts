"""
HP wave batch 1 — A / AR / B+E series (Tech-synced, no invented PDFs).

PL:
- EHPT 180VM Issue 3 + EHPT 250VM Issue 1 → ehpt-a
- AR EHPA300/340 Issue 5 → ehpa-ar
- EHPS 215VM Issue 4 + EHPS 265VMT Issue 4 → ehps-be

SM (cover-true):
- A Series EHPT 180-250 VM Issue 2 → ehpt-a
- AR Series EHPAxxVM Issue 3 → ehpa-ar
- B/E Series EHPS Issue 1 → ehps-be
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
        "pdf": "PL - RINNAI - A SERIES HEAT PUMP - EHPT 180VM - ISSUE 3 - MAY 2026.pdf",
        "stem": "pl-ehpt-180vm-issue3",
        "seriesIds": ["ehpt-a"],
        "chassis": ["EHPT180VM", "EHPT180", "EHPT", "A SERIES"],
        "priority": 30,
        "diagramPages": [2],
        "listPages": [1],
    },
    {
        "pdf": "PL - RINNAI - A SERIES HEAT PUMP - EHPT 250VM - ISSUE 1 - FEB 2024.pdf",
        "stem": "pl-ehpt-250vm-issue1",
        "seriesIds": ["ehpt-a"],
        "chassis": ["EHPT250VM", "EHPT250", "EHPT", "A SERIES"],
        "priority": 28,
        "diagramPages": [2],
        "listPages": [1],
    },
    {
        "pdf": "PL - RINNAI - AR SERIES_EHPA300VM EHPA340VM - ISSUE 5 - AUG 2026.pdf",
        "stem": "pl-ehpa-ar-issue5",
        "seriesIds": ["ehpa-ar"],
        "chassis": [
            "EHPA300VM",
            "EHPA300VMH",
            "EHPA340VM",
            "EHPA340VMH",
            "EHPA300",
            "EHPA340",
            "AR SERIES",
        ],
        "priority": 30,
        "diagramPages": [2],
        "listPages": [1],
    },
    {
        "pdf": "PL - RINNAI - B SERIES HEAT PUMP - EHPS 215VM - ISSUE 4 - NOV 2025.pdf",
        "stem": "pl-ehps-215vm-issue4",
        "seriesIds": ["ehps-be"],
        "chassis": ["EHPS215VM", "EHPS215", "EHPS", "B SERIES"],
        "priority": 30,
        "diagramPages": [1],
        "listPages": [2],
    },
    {
        "pdf": "PL - RINNAI - E SERIES HEAT PUMP - EHPS 265VMT - ISSUE 4 - NOV 2025.pdf",
        "stem": "pl-ehps-265vmt-issue4",
        "seriesIds": ["ehps-be"],
        "chassis": ["EHPS265VMT", "EHPS265", "EHPS", "E SERIES"],
        "priority": 29,
        "diagramPages": [1],
        "listPages": [2],
    },
]

SM_JOBS = [
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - A SERIES HEAT PUMP - EHPT 180 - 250 VM - ISSUE 2  - APR 2024.pdf",
        ),
        "stem": "sm-ehpt-a",
        "series": ["ehpt-a"],
    },
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - AR SERIES HEAT PUMP EHPAxxVM -  ISSUE 3 - DEC 2025.pdf",
        ),
        "stem": "sm-ehpa-ar",
        "series": ["ehpa-ar"],
    },
    {
        "tech": (
            "RINNAI HEAT PUMP",
            "SM - RINNAI - B  E SERIES HEAT PUMP - EHPS (VM VMT) - ISSUE 1 - NOV 2023.pdf",
        ),
        "stem": "sm-ehps-be",
        "series": ["ehps-be"],
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
    "RA  DESCRIPTION",
    "DESCRIPTION",
    "PART NAME",
    "SUPPLIER CODE",
    "SUNRISE CODE",
    "SPARE PARTS CODE",
    "N/A",
    "NA",
}


def ensure_pdf(name: str) -> Path:
    p = SHEETS / name
    if p.exists():
        return p
    for c in SHEETS.glob("*"):
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
    """Table-first: callout + 8-digit RA + nearby name."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    rows: list[dict] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        callout = None
        m = re.fullmatch(r"(\d{1,3})(?:-\d+)?", ln)
        if m:
            callout = str(int(m.group(1)))
        else:
            i += 1
            continue
        code = None
        name = None
        # scan next few lines for RA then name, or name then RA
        window = lines[i + 1 : i + 6]
        for j, cand in enumerate(window):
            if re.fullmatch(r"\d{8}", cand):
                code = cand
                # name before code?
                before = window[:j]
                for b in reversed(before):
                    if b.upper() in SKIP_NAMES:
                        continue
                    if re.fullmatch(r"\d{8}", b) or re.fullmatch(r"\d{1,3}(?:-\d+)?", b):
                        continue
                    if re.match(r"^[A-Z0-9][A-Z0-9.\-/]{2,}$", b) and not re.search(
                        r"[a-z ]", b
                    ):
                        # supplier-ish; keep looking for prose name
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
    # de-dupe by code keeping first
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
    for i in range(doc.page_count):
        text = doc[i].get_text("text") or ""
        for r in parse_ra_rows(text):
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
    lpages = [p for p in job["listPages"] if 1 <= p <= pages] or list(range(1, pages + 1))
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

    pl_stats = []
    for job in PL_JOBS:
        pl_stats.append(extract_pl(job, edpl, part_codes))

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
    edpl.setdefault("meta", {})["hpWave1AArBe"] = {
        "pl": pl_stats,
        "sm": sm_stats,
    }
    OUT_JSON.write_text(json.dumps(edpl, indent=2), encoding="utf-8")
    print("Wrote", OUT_JSON)


if __name__ == "__main__":
    main()
