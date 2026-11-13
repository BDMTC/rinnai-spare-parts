"""
Extract continuous-flow EDPL / ED / PLED part-list rows → public/data/edpl-part-map.json

For each RA 8-digit code: callout (NO), source PDF, parts-list page, preferred
diagram page (OCR callout hit when possible, else first image-ish page).

Chassis-scoped: each sheet carries seriesIds + chassisTokens so resolvePartDiagram
can avoid cross-chassis contamination (e.g. HD28 vs HD200).
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
OUT_JSON = ROOT / "public" / "data" / "edpl-part-map.json"
OUT_REPORT = ROOT / "artifacts" / "edpl-part-map-extract.json"
DIAGRAM_DIR = ROOT / "src" / "assets" / "diagram-pages"

# Continuous-flow EDPL / ED / PLED sheets (exclude space heat / Hotflo / Titan / RIB).
# Prefer newest Issue PL where both undated + Issue exist (listed first wins only when
# we merge by chassis; Issue files override undated for same stem family).
CF_SHEETS = [
    # HD200e
    {
        "file": "EDPL REU-VRM2632WC.pdf",
        "stem": "edpl-reu-vrm2632wc",
        "seriesIds": ["hd200e"],
        "chassisTokens": ["VRM2632WC", "REU-VRM2632WC", "HD200E", "HD200e"],
        "priority": 10,
    },
    # HD200i / Infinity 26 internal
    {
        "file": "EDPL REU-VR2632FFUG.pdf",
        "stem": "edpl-reu-vr2632ffug",
        "seriesIds": ["hd200i", "infinity26-internal"],
        "chassisTokens": ["VR2632FFUG", "REU-VR2632FFUG", "HD200I", "HD200i"],
        "priority": 10,
    },
    {
        "file": "EDPL V2632FFU_FFUC.pdf",
        "stem": "edpl-v2632ffu-ffuc",
        "seriesIds": ["hd200i", "infinity26-internal"],
        "chassisTokens": ["V2632FFU", "V2632FFUC", "VRM2632FFUC", "REU-VRM2632FFUC"],
        "priority": 8,
    },
    {
        "file": "PL - RINNAI - EDPL VRM2632FFU - ISSUE 4 - JUNE 2025.pdf",
        "stem": "edpl-vrm2632ffu-issue4",
        "seriesIds": ["hd200i", "infinity26-internal"],
        "chassisTokens": ["VRM2632FFU", "VRM2632FFUC", "HD200I", "REU-VRM2632FFUC", "REU-VR2632FFUG"],
        "priority": 12,
    },
    {
        "file": "EDPL VRM2632FFU.pdf",
        "stem": "edpl-vrm2632ffu",
        "seriesIds": ["hd200i", "infinity26-internal"],
        "chassisTokens": ["VRM2632FFU", "VRM2632FFUC"],
        "priority": 6,
    },
    {
        "file": "EDPL REUV2632FFU.pdf",
        "stem": "edpl-reuv2632ffu",
        "seriesIds": ["infinity26-internal", "hd200i"],
        "chassisTokens": ["REUV2632FFU", "V2632FFU"],
        "priority": 5,
    },
    {
        "file": "EDPL REUV2632FFUC.pdf",
        "stem": "edpl-reuv2632ffuc",
        "seriesIds": ["hd200i", "infinity26-internal"],
        "chassisTokens": ["REUV2632FFUC", "V2632FFUC"],
        "priority": 5,
    },
    # Infinity 26 Plus
    {
        "file": "EDPL REUV2630WD INF26Plus.pdf",
        "stem": "edpl-reuv2630wd-inf26plus",
        "seriesIds": ["infinity26-plus"],
        "chassisTokens": ["REUV2630WD", "VRM2630WD", "INF26PLUS", "INF26P"],
        "priority": 10,
    },
    {
        "file": "EDPL VRM2630.pdf",
        "stem": "edpl-vrm2630",
        "seriesIds": ["infinity26-plus"],
        "chassisTokens": ["VRM2630", "VRM2630WD"],
        "priority": 6,
    },
    # Smartstart
    {
        "file": "EDPL Smartstart.pdf",
        "stem": "edpl-smartstart",
        "seriesIds": ["infinity26-smartstart"],
        "chassisTokens": ["SMARTSTART", "VR2626WGP", "REU-VR2626WGP"],
        "priority": 10,
    },
    {
        "file": "PL & ED INF26 Smartstart VR2626WGP.pdf",
        "stem": "pl-ed-inf26-smartstart-vr2626wgp",
        "seriesIds": ["infinity26-smartstart"],
        "chassisTokens": ["VR2626WGP", "SMARTSTART", "INF26S"],
        "priority": 8,
    },
    # HD250 / VR3237
    {
        "file": "EDPL VR_VRM3237.pdf",
        "stem": "edpl-vr-vrm3237",
        "seriesIds": ["hd250e"],
        "chassisTokens": ["VRM3237", "VR3237", "VRM3237WC", "VRM3237WG", "HD250E", "HD250e"],
        "priority": 10,
    },
    {
        "file": "PL - RINNAI - EDPL HD250E REUVRM3237WC - ISSUE 4 - FEB 2025.pdf",
        "stem": "edpl-hd250e-reuvrm3237wc-issue4",
        "seriesIds": ["hd250e"],
        "chassisTokens": ["HD250E", "HD250e", "REUVRM3237WC", "VRM3237WC", "REU-VRM3237WC"],
        "priority": 12,
    },
    {
        "file": "PL - RINNAI - EDPLVRM3237 - ISSUE 4 - JUNE 2025.pdf",
        "stem": "edpl-vrm3237-issue4",
        "seriesIds": ["hd250e"],
        "chassisTokens": ["VRM3237", "VRM3237WC", "VRM3237WG", "REUVRM3237", "HD250"],
        "priority": 11,
    },
    {
        "file": "EDPL REUVM3237WC.pdf",
        "stem": "edpl-reuvm3237wc",
        "seriesIds": ["hd250e"],
        "chassisTokens": ["REUVM3237WC", "VM3237WC", "VRM3237WC"],
        "priority": 6,
    },
    {
        "file": "EDPL VM3237WC.pdf",
        "stem": "edpl-vm3237wc",
        "seriesIds": ["hd250e"],
        "chassisTokens": ["VM3237WC"],
        "priority": 5,
    },
    {
        "file": "EDPL REUV3237.pdf",
        "stem": "edpl-reuv3237",
        "seriesIds": ["hd250e"],
        "chassisTokens": ["REUV3237", "V3237"],
        "priority": 4,
    },
    # N-series / HD210 / Infinity 32 Enviro(+)
    {
        "file": "ED_N Series 2020 IN32 Enviro.pdf",
        "stem": "ed-n-series-2020-in32-enviro",
        "seriesIds": ["infinity32-enviro-plus-n", "hd210e", "hd210i", "infinity32-enviro"],
        "chassisTokens": ["N3237", "N3237W", "N3237WC", "N3237FFC", "HD210E", "HD210I"],
        "priority": 12,
        "diagramOnly": True,  # exploded pages; parts from PLED / PL
    },
    {
        "file": "PLED_Infinity-32-Enviro-Plus-N-Series-e.pdf",
        "stem": "pled-infinity-32-enviro-plus-n-series-e",
        "seriesIds": ["infinity32-enviro-plus-n", "hd210e", "hd210i", "infinity32-enviro"],
        "chassisTokens": ["N3237", "N-SERIES", "ENVIRO", "N3237W", "N3237WC", "N3237FFC"],
        "priority": 11,
    },
    {
        "file": "PL - RINNAI - EDPL INF32 ENVIRO KM3237WD - ISSUE 4 - JUNE 2025.pdf",
        "stem": "edpl-inf32-enviro-km3237wd-issue4",
        "seriesIds": ["infinity32-enviro"],
        "chassisTokens": ["KM3237", "KM3237WD", "REU-KM3237WD", "ENVIRO", "INFINITY32"],
        "priority": 12,
    },
    {
        "file": "PL - RINNAI - ENVIRO KM2635WD - ISSUE 04 - JUNE 2025.pdf",
        "stem": "edpl-enviro-km2635wd-issue4",
        "seriesIds": ["infinity26"],
        "chassisTokens": ["KM2635WD", "REU-KM2635WD", "INF26", "ENVIRO"],
        "priority": 10,
    },
    # HD28 / VCM2837
    {
        "file": "Parts List REU-VCM2837 WC External.pdf",
        "stem": "pl-reu-vcm2837-wc-external",
        "seriesIds": ["hd28e"],
        "chassisTokens": ["VCM2837WC", "REU-VCM2837WC", "HD28E", "HD28e"],
        "priority": 10,
    },
    {
        "file": "REU-VCM2837 - External  PARTS LIST.pdf",
        "stem": "pl-reu-vcm2837-external",
        "seriesIds": ["hd28e"],
        "chassisTokens": ["VCM2837WC", "REU-VCM2837WC", "HD28E"],
        "priority": 8,
    },
    # Heritage / older CF platforms still in catalogue
    {
        "file": "EDPL VR2426_VR2626.pdf",
        "stem": "edpl-vr2426-vr2626",
        "seriesIds": ["infinity26", "infinity26-smartstart"],
        "chassisTokens": ["VR2426", "VR2626", "VR2626WG"],
        "priority": 5,
    },
    {
        "file": "EDPL REUV2626WG.pdf",
        "stem": "edpl-reuv2626wg",
        "seriesIds": ["infinity26"],
        "chassisTokens": ["REUV2626WG", "V2626WG"],
        "priority": 5,
    },
    {
        "file": "EDPL REUV2426WG.pdf",
        "stem": "edpl-reuv2426wg",
        "seriesIds": ["infinity26"],
        "chassisTokens": ["REUV2426WG", "V2426WG"],
        "priority": 4,
    },
    {
        "file": "EDPL REUV2024WG.pdf",
        "stem": "edpl-reuv2024wg",
        "seriesIds": [],
        "chassisTokens": ["REUV2024WG", "V2024WG", "VR2024"],
        "priority": 3,
    },
    {
        "file": "EDPL VR2024.pdf",
        "stem": "edpl-vr2024",
        "seriesIds": [],
        "chassisTokens": ["VR2024"],
        "priority": 3,
    },
    {
        "file": "EDPL REUV1620WG.pdf",
        "stem": "edpl-reuv1620wg",
        "seriesIds": [],
        "chassisTokens": ["REUV1620WG", "V1620WG", "VR1620"],
        "priority": 3,
    },
    {
        "file": "EDPL VR1620.pdf",
        "stem": "edpl-vr1620",
        "seriesIds": [],
        "chassisTokens": ["VR1620"],
        "priority": 3,
    },
    {
        "file": "EDPL REUV1620W.pdf",
        "stem": "edpl-reuv1620w",
        "seriesIds": [],
        "chassisTokens": ["REUV1620W", "V1620W"],
        "priority": 2,
    },
    {
        "file": "EDPL V1616W_2018W_2020W.pdf",
        "stem": "edpl-v1616w-2018w-2020w",
        "seriesIds": [],
        "chassisTokens": ["V1616W", "V2018W", "V2020W"],
        "priority": 2,
    },
    {
        "file": "EDPL V1616WF.pdf",
        "stem": "edpl-v1616wf",
        "seriesIds": [],
        "chassisTokens": ["V1616WF"],
        "priority": 2,
    },
    {
        "file": "EDPL 2425W.pdf",
        "stem": "edpl-2425w",
        "seriesIds": [],
        "chassisTokens": ["2425W", "V2425W"],
        "priority": 2,
    },
    {
        "file": "EDPL B16.pdf",
        "stem": "edpl-b16",
        "seriesIds": [],
        "chassisTokens": ["B16", "BM1616", "INFINITY-B16"],
        "priority": 5,
    },
    {
        "file": "EDPL B24.pdf",
        "stem": "edpl-b24",
        "seriesIds": [],
        "chassisTokens": ["B24", "BM2426", "INFINITY-B24"],
        "priority": 5,
    },
    {
        "file": "EDPL V3232W_WC.pdf",
        "stem": "edpl-v3232w-wc",
        "seriesIds": [],
        "chassisTokens": ["V3232W", "V3232WC"],
        "priority": 3,
    },
    {
        "file": "EDPL REUV2626W_REUV2632WC.pdf",
        "stem": "edpl-reuv2626w-reuv2632wc",
        "seriesIds": ["hd200e"],
        "chassisTokens": ["REUV2626W", "REUV2632WC", "V2626W"],
        "priority": 4,
    },
    {
        "file": "SmartStart Parts list.pdf",
        "stem": "pl-smartstart-parts-list",
        "seriesIds": ["infinity26-smartstart"],
        "chassisTokens": ["SMARTSTART", "VR2626WGP"],
        "priority": 6,
    },

    {
        "file": "EDPL REU-K2403WG.pdf",
        "stem": "edpl-reu-k2403wg",
        "seriesIds": [],
        "chassisTokens": ["K2403WG", "REU-K2403WG"],
        "priority": 2,
    },
    {
        "file": "EDPL REU-K2430WG.pdf",
        "stem": "edpl-reu-k2430wg",
        "seriesIds": [],
        "chassisTokens": ["K2430WG", "REU-K2430WG"],
        "priority": 2,
    },
    {
        "file": "New A Series CF Parts List.pdf",
        "stem": "pl-new-a-series-cf",
        "seriesIds": ["infinity26", "hd32"],
        "chassisTokens": ["AM2626", "AM3237", "A-SERIES", "REU-AM2626", "REU-AM3237"],
        "priority": 9,
    },
    {
        "file": "REU-V3237WG Parts List.pdf",
        "stem": "pl-reu-v3237wg",
        "seriesIds": ["hd250e"],
        "chassisTokens": ["V3237WG", "REU-V3237WG"],
        "priority": 4,
    },
    {
        "file": "PL - N3237_Infinity 32 Enviro Plus N Series_Issue 3_Dec 21.pdf",
        "stem": "pl-n3237-inf32-enviro-plus-issue3",
        "seriesIds": ["infinity32-enviro-plus-n", "hd210e", "hd210i"],
        "chassisTokens": ["N3237", "N3237W", "N3237WC", "N3237FFC", "HD210E", "HD210I"],
        "priority": 13,
    },
    {
        "file": "HW_CF_A_Series_Parts_List_Issue_1_Jan_2018.pdf",
        "stem": "pl-hw-cf-a-series-issue1",
        "seriesIds": ["infinity26", "hd32"],
        "chassisTokens": ["AM2626", "AM3237", "A-SERIES", "REU-AM2626", "REU-AM3237"],
        "priority": 8,
    },
    {
        "file": "HW_CF_BM_SM_Issue_1_AUG BM2626 & B26 Series.pdf",
        "stem": "pl-hw-cf-bm-sm-b26",
        "seriesIds": [],
        "chassisTokens": ["BM2626", "B26", "B26SERIES"],
        "priority": 5,
    },
    {
        "file": "PL - RINNAI - 2025 BM SERIES - INFINITY B - ISSUE 1 - AUG 2025.pdf",
        "stem": "pl-rinnai-2025-bm-series-infinity-b",
        "seriesIds": [],
        "chassisTokens": ["BM2626", "INFINITY-B", "B-SERIES"],
        "priority": 7,
    },
    {
        "file": "REU-VCM2837 - External  PARTS LIST.pdf",
        "stem": "pl-reu-vcm2837-external-quarantine",
        "seriesIds": ["hd28e"],
        "chassisTokens": ["VCM2837WC", "REU-VCM2837WC", "HD28E"],
        "priority": 7,
        "altDirs": ["_duplicates_quarantine"],
    },
]


def find_pdf(file_name: str, alt_dirs: list[str] | None = None) -> Path | None:
    direct = SHEETS / file_name
    if direct.exists():
        return direct
    for alt in alt_dirs or []:
        cand = (ROOT / "data-sheets" / alt / file_name)
        if cand.exists():
            return cand
        cand2 = SHEETS.parent / alt / file_name
        if cand2.exists():
            return cand2
    hits = list((ROOT / "data-sheets").rglob(file_name))
    return hits[0] if hits else None


def slugify(stem: str) -> str:
    s = stem.lower().replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def page_text_len(page) -> int:
    return len((page.get_text("text") or "").strip())


def detect_diagram_pages(doc) -> list[int]:
    """1-based page numbers that look like exploded diagrams (little text)."""
    scored = []
    for i in range(doc.page_count):
        scored.append((page_text_len(doc[i]), i + 1))
    # Header-only diagram pages often sit ~80–150 chars; parts tables are 800+.
    picks = [p for n, p in scored if n < 200]
    if picks:
        return picks
    # Fallback: last half of PDF
    start = max(1, doc.page_count // 2 + 1)
    return list(range(start, doc.page_count + 1))


def normalize_box(
    x0: float, y0: float, x1: float, y1: float, page_w: float, page_h: float, *, pad: float = 0.006
) -> dict:
    """Normalized fraction box with a little pad so the highlight reads on JPEG."""
    if page_w <= 0 or page_h <= 0:
        return {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0}
    x = max(0.0, (x0 / page_w) - pad)
    y = max(0.0, (y0 / page_h) - pad)
    w = min(1.0 - x, ((x1 - x0) / page_w) + 2 * pad)
    h = min(1.0 - y, ((y1 - y0) / page_h) + 2 * pad)
    return {
        "x": round(x, 5),
        "y": round(y, 5),
        "w": round(max(w, 0.008), 5),
        "h": round(max(h, 0.006), 5),
    }


def code_word_boxes(page) -> dict[str, dict]:
    """
    Text-layer word bboxes for RA 8-digit codes on a parts-list page.
    Returns code → {x,y,w,h} as fractions of page size (JPEG-aligned).
    """
    rect = page.rect
    pw, ph = float(rect.width), float(rect.height)
    found: dict[str, dict] = {}
    for w in page.get_text("words") or []:
        # words tuple: x0, y0, x1, y1, word, block, line, word_no
        if len(w) < 5:
            continue
        text = str(w[4]).strip()
        if not re.fullmatch(r"\d{8}", text):
            continue
        box = normalize_box(float(w[0]), float(w[1]), float(w[2]), float(w[3]), pw, ph)
        # Prefer first occurrence (top of table) when duplicates exist
        found.setdefault(text, box)
    return found


def callout_word_boxes(page) -> dict[str, dict]:
    """
    Text-layer bboxes for short numeric callouts on ED pages (when text exists).
    Keys are unpadded callout strings ("140"). Sparse — many ED pages are image-only.
    """
    rect = page.rect
    pw, ph = float(rect.width), float(rect.height)
    found: dict[str, dict] = {}
    for w in page.get_text("words") or []:
        if len(w) < 5:
            continue
        text = str(w[4]).strip().rstrip(".")
        if not re.fullmatch(r"\d{1,3}", text):
            continue
        key = str(int(text))
        box = normalize_box(
            float(w[0]), float(w[1]), float(w[2]), float(w[3]), pw, ph, pad=0.008
        )
        # Prefer smaller boxes (likely the label, not a large table cell)
        prev = found.get(key)
        if not prev or (box["w"] * box["h"]) < (prev["w"] * prev["h"]):
            found[key] = box
    return found


def parse_part_rows(text: str) -> list[dict]:
    """
    Parse EDPL parts-list text into {callout, code, name}.
    Strict line-walk first; loose fallback associates each 8-digit code with the
    nearest preceding 1–3 digit callout on its own line.
    """
    rows = []
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    i = 0
    while i < len(lines):
        m = re.fullmatch(r"0*(\d{1,3})", lines[i])
        if not m:
            i += 1
            continue
        callout = m.group(1)
        name_parts = []
        code = None
        j = i + 1
        while j < len(lines) and j < i + 10:
            ln = lines[j]
            cm = re.fullmatch(r"(\d{8})", ln)
            if cm:
                code = cm.group(1)
                break
            cm2 = re.search(r"\b(\d{8})\b", ln)
            if cm2 and re.fullmatch(r"\d{8}", ln.strip()):
                code = cm2.group(1)
                break
            if re.fullmatch(r"0*\d{1,3}", ln) and name_parts:
                break
            if ln.upper() in {
                "NO",
                "PART NAME",
                "DESCRIPTION",
                "RA PART NO",
                "RA CODE",
                "11 DIGIT CODE",
                "11 DIGIT",
                "ITEM NO.",
                "ITEM NO",
                "QTY",
                "QTY.",
            }:
                j += 1
                continue
            if re.fullmatch(r"\d{3}-\d{3}-\d{3}", ln) or re.fullmatch(
                r"\d{3}-\d{7}", ln
            ):
                j += 1
                continue
            if re.fullmatch(r"\d+", ln) and len(ln) <= 2:
                j += 1
                continue
            name_parts.append(ln)
            j += 1
        if code:
            callout_norm = str(int(callout))
            rows.append(
                {
                    "callout": callout_norm,
                    "calloutPadded": callout_norm.zfill(3),
                    "code": code,
                    "name": " ".join(name_parts)[:120],
                    "listLine": i + 1,
                }
            )
            i = j + 1
            continue
        i += 1

    # Loose fallback: every 8-digit code ← nearest prior solo callout line
    seen = {(r["callout"], r["code"]) for r in rows}
    last_callout = None
    for ln in lines:
        cm = re.fullmatch(r"0*(\d{1,3})", ln)
        if cm:
            last_callout = str(int(cm.group(1)))
            continue
        code_m = re.fullmatch(r"(\d{8})", ln)
        if not code_m:
            # also "92099423 014-…" rare single-line forms
            code_m = re.search(r"(?<!\d)(\d{8})(?!\d)", ln)
            if not code_m or not last_callout:
                continue
            # skip pure 11-digit dotted lines without callout context already set
        if code_m and last_callout:
            code = code_m.group(1)
            key = (last_callout, code)
            if key not in seen:
                seen.add(key)
                rows.append(
                    {
                        "callout": last_callout,
                        "calloutPadded": last_callout.zfill(3),
                        "code": code,
                        "name": "",
                        "listLine": 0,
                    }
                )
    return rows


def ocr_callouts_on_page(img_path: Path, ocr) -> dict[str, dict]:
    """Return callout → normalized box from a diagram JPEG."""
    result, _elapse = ocr(str(img_path))
    found: dict[str, dict] = {}
    if not result:
        return found
    # Need image size for normalisation — RapidOCR boxes are pixel coords
    try:
        import struct

        with open(img_path, "rb") as f:
            data = f.read(2)
            if data[:2] != b"\xff\xd8":
                return found
            f.seek(0)
            # use pymupdf pixmap size via pillow-less JPEG SOF
        from PIL import Image

        with Image.open(img_path) as im:
            w, h = im.size
    except Exception:
        # Fallback: assume 1400-wide render
        w, h = 1400, 2000
        try:
            # try reading via pymupdf if jpeg
            pass
        except Exception:
            pass

    for box, text, score in result:
        t = str(text).strip()
        digits = "".join(ch for ch in t if ch.isdigit())
        if not digits or not (1 <= len(digits) <= 3):
            continue
        if float(score) < 0.45:
            continue
        # Prefer pure numeric callouts
        if not t.isdigit() and digits != t:
            # allow "140." etc
            if not re.fullmatch(r"\d{1,3}\.?", t):
                continue
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        key = str(int(digits))
        entry = {
            "x": round(x0 / w, 5),
            "y": round(y0 / h, 5),
            "w": round((x1 - x0) / w, 5),
            "h": round((y1 - y0) / h, 5),
            "score": round(float(score), 3),
        }
        prev = found.get(key)
        if not prev or entry["score"] > prev.get("score", 0):
            found[key] = entry
    return found


def ensure_diagram_jpegs(pdf_path: Path, stem: str, pages_1based: list[int]) -> list[str]:
    """Render missing diagram page JPEGs; return asset keys written/existing."""
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
    keys = []
    doc = pymupdf.open(pdf_path)
    for p in pages_1based:
        key = f"{stem}__p{p}"
        dest = DIAGRAM_DIR / f"{key}.jpg"
        keys.append(key)
        if dest.exists() and dest.stat().st_size > 10_000:
            continue
        if p < 1 or p > doc.page_count:
            continue
        page = doc[p - 1]
        zoom = 1400 / page.rect.width
        mat = pymupdf.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        pix.save(dest, jpg_quality=78)
        print(f"  wrote {dest.name} {dest.stat().st_size}")
    doc.close()
    return keys


def main():
    do_ocr = "--ocr" in sys.argv
    # Default: no diagram JPEG render (Beau B — existing page packs only).
    do_render = "--render-pages" in sys.argv
    # PL page JPEGs for lightbox part-number highlight (RSP-131).
    # Default ON for stems that already ship any diagram JPEG; --no-render-list-pages to skip.
    do_render_list = "--no-render-list-pages" not in sys.argv
    ocr = None
    if do_ocr:
        from rapidocr_onnxruntime import RapidOCR

        ocr = RapidOCR()
        print("OCR enabled")
    if not do_render:
        print("Diagram JPEG render skipped (use --render-pages to enable)")
    if do_render_list:
        print("List-page JPEG render enabled for stems with existing page packs")
    else:
        print("List-page JPEG render skipped (--no-render-list-pages)")

    catalogue = json.loads(
        (ROOT / "public" / "data" / "catalogue.json").read_text(encoding="utf-8")
    )
    part_codes = {
        str(p.get("code") or "").strip()
        for p in catalogue.get("parts") or []
        if p.get("code")
    }

    sheets_out = []
    # code → list of hits (multi-chassis)
    by_code: dict[str, list[dict]] = defaultdict(list)
    callout_boxes: dict[str, dict] = {}  # pageKey → {callout: box}
    list_pages_rendered = 0
    list_boxes_total = 0

    for spec in CF_SHEETS:
        pdf = find_pdf(spec["file"], spec.get("altDirs"))
        if not pdf:
            print("MISSING", spec["file"])
            sheets_out.append({**spec, "status": "missing"})
            continue
        doc = pymupdf.open(pdf)
        diagram_pages = detect_diagram_pages(doc)
        default_diagram = diagram_pages[0] if diagram_pages else max(1, doc.page_count)
        stem = spec["stem"]

        # Extract rows + text-layer RA code bboxes from parts-list pages
        rows = []
        # (listPage 1-based) → code → box
        page_code_boxes: dict[int, dict[str, dict]] = {}
        list_pages: list[int] = []
        for i in range(doc.page_count):
            page = doc[i]
            text = page.get_text("text") or ""
            if len(text.strip()) < 80:
                # Still try sparse ED callout text-layer boxes
                if i + 1 in diagram_pages:
                    cos = callout_word_boxes(page)
                    if cos:
                        key = f"{stem}__p{i + 1}"
                        callout_boxes.setdefault(key, {}).update(cos)
                continue
            page_rows = parse_part_rows(text)
            boxes = code_word_boxes(page)
            if boxes:
                page_code_boxes[i + 1] = boxes
            if page_rows:
                list_pages.append(i + 1)
            for r in page_rows:
                r["listPage"] = i + 1
                if r["code"] in boxes:
                    r["listBox"] = boxes[r["code"]]
            rows.extend(page_rows)

        # Deduplicate rows by (callout, code) keeping first
        seen = set()
        deduped = []
        for r in rows:
            k = (r["callout"], r["code"])
            if k in seen:
                continue
            seen.add(k)
            deduped.append(r)
        rows = deduped

        page_count = doc.page_count
        asset_keys = []
        if do_render:
            asset_keys = ensure_diagram_jpegs(pdf, stem, diagram_pages)
        else:
            # Prefer already-shipped page packs for this stem when present
            for p in diagram_pages:
                key = f"{stem}__p{p}"
                if (DIAGRAM_DIR / f"{key}.jpg").exists():
                    asset_keys.append(key)
            if not asset_keys:
                # Any existing pages for this stem
                asset_keys = [
                    p.stem
                    for p in DIAGRAM_DIR.glob(f"{stem}__p*.jpg")
                ]

        # Render parts-list pages into the same stem pack when this stem already
        # ships diagram JPEGs (lightbox Prev/Next across PL + ED).
        stem_has_pack = bool(list(DIAGRAM_DIR.glob(f"{stem}__p*.jpg"))) or bool(
            asset_keys
        )
        if do_render_list and stem_has_pack and list_pages:
            unique_list = sorted(set(list_pages))
            written = ensure_diagram_jpegs(pdf, stem, unique_list)
            list_pages_rendered += len(unique_list)
            for key in written:
                if key not in asset_keys:
                    asset_keys.append(key)

        # OCR callouts → page when requested (optional; default path skips)
        callout_to_page: dict[str, int] = {}
        if do_ocr and ocr and diagram_pages:
            for p in diagram_pages:
                key = f"{stem}__p{p}"
                img = DIAGRAM_DIR / f"{key}.jpg"
                if not img.exists():
                    continue
                found = ocr_callouts_on_page(img, ocr)
                if found:
                    callout_boxes[key] = {
                        k: {kk: vv for kk, vv in v.items() if kk != "score"}
                        for k, v in found.items()
                    }
                    for c in found:
                        callout_to_page.setdefault(c, p)
                print(f"  OCR {key}: {len(found)} callouts")

        doc.close()

        # If this stem has no shipped JPEGs, remap pageKey to a known pack stem
        # for the same series (Beau B — existing page packs only).
        PACK_FALLBACK = {
            "hd200e": ("edpl-reu-vrm2632wc", 5),
            "hd200i": ("edpl-reu-vr2632ffug", 5),
            "infinity26-internal": ("edpl-v2632ffu-ffuc", 5),
            "infinity26-plus": ("edpl-reuv2630wd-inf26plus", 6),
            "infinity26-smartstart": ("edpl-smartstart", 4),
            "hd250e": ("edpl-vr-vrm3237", 5),
            "infinity32-enviro": ("ed-n-series-2020-in32-enviro", 1),
            "infinity32-enviro-plus-n": ("ed-n-series-2020-in32-enviro", 1),
            "hd210e": ("ed-n-series-2020-in32-enviro", 1),
            "hd210i": ("ed-n-series-2020-in32-enviro", 1),
            "infinity26": ("edpl-reuv2630wd-inf26plus", 6),
            # hd28e: no shipped page pack yet — keep native pageKey / callout only
        }

        def resolve_page_key(diag_page: int) -> tuple[str, str, int]:
            native = f"{stem}__p{diag_page}"
            if (DIAGRAM_DIR / f"{native}.jpg").exists():
                return native, f"{spec['file']} p{diag_page}", diag_page
            # any native page for stem
            for key in asset_keys:
                m = re.search(r"__p(\d+)$", key)
                if m:
                    p = int(m.group(1))
                    return key, f"{spec['file']} p{p}", p
            for sid in spec.get("seriesIds") or []:
                fb = PACK_FALLBACK.get(sid)
                if not fb:
                    continue
                fb_stem, fb_page = fb
                fb_key = f"{fb_stem}__p{fb_page}"
                if (DIAGRAM_DIR / f"{fb_key}.jpg").exists():
                    return fb_key, f"{spec['file']} p{fb_page}", fb_page
            return native, f"{spec['file']} p{diag_page}", diag_page

        sheet_codes_in_cat = 0
        sheet_list_boxes = 0
        for r in rows:
            code = r["code"]
            # Prefer OCR page for this callout; else default diagram page of sheet
            diag_page = callout_to_page.get(r["callout"], default_diagram)
            page_key, page_label, diag_page = resolve_page_key(diag_page)
            list_page = r.get("listPage")
            list_box = r.get("listBox")
            if not list_box and list_page and list_page in page_code_boxes:
                list_box = page_code_boxes[list_page].get(code)
            list_page_key = (
                f"{stem}__p{list_page}" if isinstance(list_page, int) else None
            )
            if list_box:
                sheet_list_boxes += 1
                list_boxes_total += 1
            hit = {
                "code": code,
                "callout": r["callout"],
                "calloutPadded": r["calloutPadded"],
                "name": r.get("name") or "",
                "pdf": spec["file"],
                "stem": stem,
                "page": page_label,
                "pageKey": page_key,
                "diagramPage": diag_page,
                "listPage": list_page,
                "listPageKey": list_page_key,
                "listBox": list_box,
                "seriesIds": list(spec.get("seriesIds") or []),
                "chassisTokens": list(spec.get("chassisTokens") or []),
                "priority": int(spec.get("priority") or 0),
            }
            by_code[code].append(hit)
            if code in part_codes:
                sheet_codes_in_cat += 1

        sheets_out.append(
            {
                "file": spec["file"],
                "stem": stem,
                "status": "ok",
                "path": str(pdf.relative_to(ROOT)).replace("\\", "/"),
                "pages": page_count,
                "diagramPages": diagram_pages,
                "listPages": sorted(set(list_pages)),
                "defaultDiagramPage": default_diagram,
                "rowsExtracted": len(rows),
                "rowsInCatalogue": sheet_codes_in_cat,
                "rowsWithListBox": sheet_list_boxes,
                "seriesIds": spec.get("seriesIds") or [],
                "chassisTokens": spec.get("chassisTokens") or [],
                "priority": spec.get("priority"),
                "assetKeys": asset_keys,
            }
        )
        print(
            f"OK {spec['file']}: rows={len(rows)} inCat={sheet_codes_in_cat} "
            f"listBoxes={sheet_list_boxes} diagramPages={diagram_pages} "
            f"listPages={sorted(set(list_pages))}"
        )

    def list_jpeg_exists(hit: dict) -> bool:
        lpk = hit.get("listPageKey")
        return bool(lpk and (DIAGRAM_DIR / f"{lpk}.jpg").exists())

    def enrich_list_from_pack(hit: dict, pool: list[dict]) -> dict:
        """
        Prefer a same-series pack-backed listPage/listBox when the priority sheet
        has no PL JPEG (Issue PDFs often win priority but ship no page pack).
        Diagram pageKey stays on the priority hit.
        """
        if list_jpeg_exists(hit) and hit.get("listBox"):
            return hit
        series = {str(s).lower() for s in (hit.get("seriesIds") or [])}
        candidates = []
        for other in pool:
            if other is hit:
                continue
            if not list_jpeg_exists(other):
                continue
            if not other.get("listBox"):
                continue
            other_series = {str(s).lower() for s in (other.get("seriesIds") or [])}
            if series and other_series and not (series & other_series):
                continue
            candidates.append(other)
        if not candidates:
            return hit
        # Prefer highest priority pack-backed sibling
        donor = sorted(candidates, key=lambda h: (-h["priority"], h["pdf"]))[0]
        enriched = dict(hit)
        enriched["listPage"] = donor.get("listPage")
        enriched["listPageKey"] = donor.get("listPageKey")
        enriched["listBox"] = donor.get("listBox")
        # Keep donor pdf/stem only for list provenance when native had no box asset
        enriched["listPdf"] = donor.get("pdf")
        enriched["listStem"] = donor.get("stem")
        return enriched

    # Compact runtime map: code → [hits…] sorted by priority desc
    # Keep listPage + listBox for PL highlight (RSP-131) — do not strip.
    parts_map = {}
    multi = 0
    for code, hits in by_code.items():
        hits_sorted = sorted(hits, key=lambda h: (-h["priority"], h["pdf"]))
        if len(hits_sorted) > 1:
            multi += 1
        hits_sorted = [enrich_list_from_pack(h, hits_sorted) for h in hits_sorted]
        compact = []
        for h in hits_sorted:
            entry = {
                "callout": h["callout"],
                "page": h["page"],
                "pageKey": h["pageKey"],
                "pdf": h["pdf"],
                "stem": h["stem"],
                "seriesIds": h["seriesIds"],
                "chassisTokens": h["chassisTokens"],
                "priority": h["priority"],
            }
            if h.get("listPage") is not None:
                entry["listPage"] = h["listPage"]
            if h.get("listPageKey"):
                entry["listPageKey"] = h["listPageKey"]
            if h.get("listBox"):
                entry["listBox"] = h["listBox"]
            if h.get("listPdf"):
                entry["listPdf"] = h["listPdf"]
            compact.append(entry)
        parts_map[code] = compact

    in_cat = sum(1 for c in parts_map if c in part_codes)
    with_page_asset = 0
    with_list_box = 0
    with_list_page_asset = 0
    for c, hits in parts_map.items():
        if c not in part_codes:
            continue
        pk = hits[0]["pageKey"]
        if (DIAGRAM_DIR / f"{pk}.jpg").exists():
            with_page_asset += 1
        if hits[0].get("listBox"):
            with_list_box += 1
        lpk = hits[0].get("listPageKey")
        if lpk and (DIAGRAM_DIR / f"{lpk}.jpg").exists():
            with_list_page_asset += 1

    out = {
        "version": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "title": "Continuous-flow EDPL part → page + callout map",
            "scope": "AU continuous-flow / REU hot-water EDPL/ED/PLED sheets",
            "ocr": do_ocr,
            "sourceRule": "Callout NO + RA/catalogue 8-digit from parts-list text; diagram page = first image-ish page of sheet (OCR optional); listPage + text-layer word bbox kept for PL highlight",
            "resolve": "Pick first hit matching pin seriesId / chassis token; else highest priority",
            "plHighlight": "listPage + listPageKey + listBox (pymupdf words); lightbox opens PL page when JPEG exists",
        },
        "totals": {
            "sheetsConfigured": len(CF_SHEETS),
            "sheetsOk": sum(1 for s in sheets_out if s.get("status") == "ok"),
            "sheetsMissing": sum(1 for s in sheets_out if s.get("status") == "missing"),
            "uniqueCodes": len(parts_map),
            "codesInCatalogue": in_cat,
            "codesInCatalogueWithPageAsset": with_page_asset,
            "codesInCatalogueWithListBox": with_list_box,
            "codesInCatalogueWithListPageAsset": with_list_page_asset,
            "listBoxesExtracted": list_boxes_total,
            "listPagesRendered": list_pages_rendered,
            "codesMultiChassis": multi,
            "cataloguePartsTotal": len(part_codes),
        },
        "sheets": [
            {
                k: s[k]
                for k in (
                    "file",
                    "stem",
                    "status",
                    "pages",
                    "diagramPages",
                    "listPages",
                    "defaultDiagramPage",
                    "rowsExtracted",
                    "rowsInCatalogue",
                    "rowsWithListBox",
                    "seriesIds",
                    "chassisTokens",
                    "priority",
                )
                if k in s
            }
            | ({"path": s["path"]} if s.get("path") else {})
            for s in sheets_out
        ],
        "parts": parts_map,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.write_text(
        json.dumps({"totals": out["totals"], "sheets": sheets_out}, indent=2),
        encoding="utf-8",
    )
    print("Wrote", OUT_JSON)
    print("Totals", json.dumps(out["totals"], indent=2))

    # Merge text-layer (and optional OCR) callout boxes into diagram-callouts.json
    if callout_boxes:
        callouts_path = ROOT / "public" / "data" / "diagram-callouts.json"
        existing = json.loads(callouts_path.read_text(encoding="utf-8"))
        pages = existing.setdefault("pages", {})
        for key, cos in callout_boxes.items():
            prev = pages.get(key, {}).get("callouts", {})
            # Prefer existing OCR/manual boxes; fill gaps from text-layer
            merged = {**cos, **prev}
            pages[key] = {
                "source": pages.get(key, {}).get("source")
                or ("ocr extract-edpl-part-map.py" if do_ocr else "text-layer extract-edpl-part-map.py"),
                "callouts": merged,
            }
        existing["meta"] = existing.get("meta") or {}
        existing["meta"]["updated"] = datetime.now(timezone.utc).date().isoformat()
        existing["meta"]["notes"] = (
            "Normalized callout boxes (x,y,w,h as fractions of page image). "
            "ED lightbox highlight; PL part-number boxes live on edpl-part-map listBox."
        )
        callouts_path.write_text(json.dumps(existing, indent=2), encoding="utf-8")
        print("Updated diagram-callouts.json pages", len(callout_boxes))


if __name__ == "__main__":
    main()
