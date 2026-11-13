"""
SM polish #92:
- SM VRM16/VRM20 Issue03 → vrm1620, vrm2024
- SM VR2626WB_VRM2626WG Issue03 → vrm2626
- SM VR3237WG/VRM3237WG/VRM3237WC Issue03 → vrm3237wg
- SM ECF Efinity Issue3 → efinity-ecf
"""
from __future__ import annotations

from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "data-sheets" / "Rinnai Data Sheets"
SM_OUT = ROOT / "src" / "assets" / "service-manual-pages"

PACKS = [
    {
        "pdf": "SM - RINNAI - VRM16, VRM20 - ISSUE 03 - JAN 2015.pdf",
        "stem": "sm-vrm16-vrm20",
        "series": ["vrm1620", "vrm2024"],
    },
    {
        "pdf": "SM - RINNAI - VR2626WB_VRM2626WG - ISSUE 03 - NOV 2014.pdf",
        "stem": "sm-vr2626wb-vrm2626wg",
        "series": ["vrm2626"],
    },
    {
        "pdf": "SM - RINNAI VR3237WG_ VRM3237WG _ VRM3237WC HD250e ISSUE03 NOV 2014.pdf",
        "stem": "sm-vr3237-vrm3237wg",
        "series": ["vrm3237wg"],
    },
    {
        "pdf": "SM - RINNAI - ECF EFINITY - ELECTRIC CFHW - ISSUE 3 - AUG 2026.pdf",
        "stem": "sm-efinity-ecf",
        "series": ["efinity-ecf"],
    },
]


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


def main() -> None:
    for pack in PACKS:
        n = render_sm_pack(pack["pdf"], pack["stem"])
        copy_thumbs(pack["stem"], pack["series"])
        print(f"OK {pack['stem']} pages={n} series={pack['series']}")


if __name__ == "__main__":
    main()
