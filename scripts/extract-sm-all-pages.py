"""
Extract all pages of unique continuous-flow Service Manual PDFs (RSP-84).
Shared by stem so series that share a PDF reuse the same page set.
Thumb covers (series__p1.jpg) are left as-is from RSP-82.
"""
from __future__ import annotations

from pathlib import Path
import json
import re
import pymupdf

ROOT = Path(r"C:\Temp\rinnai-spare-parts")
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
SM_OUT = ROOT / "src" / "assets" / "service-manual-pages"
SM_OUT.mkdir(parents=True, exist_ok=True)

# Unique SM PDFs used by series map in service-manual-pages.js
UNIQUE_SM = {
    "sm-vrm2632wc": "smVRM2632WC.pdf",
    "sm-vr2632ffug-vrm2632ffuc": "smVR2632FFUG_VRM2632FFUC.pdf",
    "sm-inf26-inf32-enviro-wh-190810": "SM INF26_INF32 Enviro WH 190810.pdf",
    "sm-smartstart": "SM Smartstart.pdf",  # CUG1 preheat — not Inf26 VR2626WGP
    # Infinity 26 Smartstart inbuilt (cover lists REU-VR2626WGP)
    "sm-inbuilt-smartstart": "SM Inbuilt Smartstart.pdf",
    # HD250e / Infinity 32 VR3237 family (weekend stretch)
    "sm-vr3237wg-wc": "smVR3237WG_WC.pdf",
    # Heritage V3237WG / VM3237WC
    "sm-v3237w-vm3237wc": "smREUV3237W_VM3237WC April09.pdf",
    # Infinity 26 / A-AM domestic (cover lists INF26 AM2626 — not Enviro KM)
    "sm-new-a-series-cf": "New A Series CF Parts List.pdf",
    # Infinity 26 Plus (cover lists REU-VM2630WD — not Enviro KM)
    "sm-v2626w-v2630wc": "smV2626W_V2630WC.pdf",
    # Infinity B family (cover lists BM2626 / B26 / B20 / B16 / B12)
    "sm-hw-cf-bm-b26": "HW_CF_BM_SM_Issue_1_AUG BM2626 & B26 Series.pdf",
    # EnviroSmart K2430
    "sm-k2430wak": "smK2430WAK.pdf",
    # Infinity 16/20 heritage VR (cover lists VR1620WG/WB/WS + VR2024WG)
    "sm-vreu-vr1620-vr2024": "smvREUVR1616W_VR2024_v2.pdf",
    # B24 / VR2426WB+WS (cover also lists VR2626WG / VRM2630WD — those stay other series)
    "sm-vr2426w-vr2632wc": "SMVR2426W_VR2632WC.pdf",
    # Pre-VR Infinity 16/20 (V1620WG/WB/WS + V2024WG)
    "sm-v1620-v2024": "smv1616W.pdf",
    # Early V1616 / V2018 / V2020
    "sm-v1616-v2018-v2020": "SM V16_18_20.pdf",
    # Heritage V3232W / HD250e V3232WC
    "sm-v3232w-wc": "SM V32.pdf",
}

# Optional series thumb covers copied from pack page 1
SERIES_THUMBS = {
    "hd250e": "sm-vr3237wg-wc",
    "infinity32": "sm-vr3237wg-wc",
    "v3237": "sm-v3237w-vm3237wc",
    "infinity26": "sm-new-a-series-cf",
    "infinity-a": "sm-new-a-series-cf",
    "infinity26-plus": "sm-v2626w-v2630wc",
    "infinity26-smartstart": "sm-inbuilt-smartstart",
    "infinity-b": "sm-hw-cf-bm-b26",
    "envirosmart": "sm-k2430wak",
    "infinity16": "sm-vreu-vr1620-vr2024",
    "infinity20": "sm-vreu-vr1620-vr2024",
    "vr2426": "sm-vr2426w-vr2632wc",
    "infinity16-v": "sm-v1620-v2024",
    "infinity20-v": "sm-v1620-v2024",
    "infinity-v1616": "sm-v1616-v2018-v2020",
    "v3232": "sm-v3232w-wc",
}

TARGET_WIDTH = 900
JPG_QUALITY = 55


def render_page(page, dest: Path, target_width=TARGET_WIDTH, quality=JPG_QUALITY):
    zoom = target_width / page.rect.width
    mat = pymupdf.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    pix.save(dest, jpg_quality=quality)
    return pix.width, pix.height, dest.stat().st_size


manifest = {"packs": {}, "notes": []}

for stem, file_name in UNIQUE_SM.items():
    pdf = SHEETS / file_name
    if not pdf.exists():
        print("MISSING", file_name)
        manifest["notes"].append(f"missing {file_name}")
        continue
    doc = pymupdf.open(pdf)
    pages = []
    print(f"=== {file_name} ({doc.page_count} pages) -> {stem} ===")
    for i in range(doc.page_count):
        name = f"{stem}__p{i + 1}.jpg"
        dest = SM_OUT / name
        if dest.exists() and dest.stat().st_size > 8_000:
            pages.append({"page": i + 1, "asset": name, "bytes": dest.stat().st_size})
            continue
        w, h, size = render_page(doc[i], dest)
        print(f"  {name} {w}x{h} {size}")
        pages.append({"page": i + 1, "asset": name, "bytes": size})
    manifest["packs"][stem] = {
        "file": file_name,
        "pageCount": doc.page_count,
        "pages": pages,
        "totalBytes": sum(p["bytes"] for p in pages),
    }
    doc.close()
    print(
        f"  total {manifest['packs'][stem]['totalBytes'] / 1e6:.2f} MB"
    )

FORCE_THUMBS = {
    "infinity26-plus",  # replace wrong Enviro cover
    "infinity26-smartstart",  # replace CUG1 preheat cover
}

for series_id, pack_stem in SERIES_THUMBS.items():
    src = SM_OUT / f"{pack_stem}__p1.jpg"
    dest = SM_OUT / f"{series_id}__p1.jpg"
    if not src.exists():
        print("THUMB SKIP missing pack p1", src.name)
        continue
    if (
        series_id not in FORCE_THUMBS
        and dest.exists()
        and dest.stat().st_size > 8_000
    ):
        print("thumb exists", dest.name)
        continue
    dest.write_bytes(src.read_bytes())
    print("thumb", dest.name, dest.stat().st_size)

out = ROOT / "artifacts" / "rsp-84-sm-pages-manifest.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("wrote", out)
