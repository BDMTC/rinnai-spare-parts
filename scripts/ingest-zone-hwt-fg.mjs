/**
 * Ingest Zone Contractor Qld HWT finished-goods workbook → public/data/zone-hwt-fg.json.
 * Always maps Net Invoice Price (EX GST) by header text (re-read on each header row).
 * Section titles = red-fill banner rows (prepended to short product names).
 *
 * Usage: node scripts/ingest-zone-hwt-fg.mjs [path-to-xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "public/data/config.json"), "utf8"));
const fgCfg = config.finishedGoodsPriceList || {};

const defaultOffice =
  "G:\\My Drive\\MTC\\Projects\\MTC PROCESS\\Admin FSL Training\\Zone Contractor Qld Price List - HWT Effective 01-02-26.xlsx";
const xlsxPath = process.argv[2] || defaultOffice;
const outRel = fgCfg.generatedFile || "public/data/zone-hwt-fg.json";
const outPath = path.join(root, outRel);

const pyBody = `import json, re, sys
from openpyxl import load_workbook

xlsx, out, effective, label, workbook_file, generated = sys.argv[1:7]
wb = load_workbook(xlsx, data_only=True)

FAMILIES = [
  ("cf", "Gas continuous flow", "Cont Flow"),
  ("efinity", "Electric continuous flow", "Electric Cont Flow"),
  ("storage", "Storage tanks", "Storage Tanks"),
  ("hp-aio", "Heat pump (all-in-one)", "All-In-One Heat Pump"),
  ("hp-split", "Heat pump (split)", "Split Heat Pumps"),
  ("solar", "Solar components", "Solar Pricing"),
  ("commercial", "Commercial / Demand Duo", "Commercial HW"),
]

def norm(s):
    return re.sub(r"\\s+", " ", str(s or "").replace("\\n", " ")).strip()

def is_red_fill(cell):
    try:
        fg = cell.fill.fgColor if cell.fill else None
        if not fg:
            return False
        rgb = str(getattr(fg, "rgb", "") or "").upper()
        return rgb.endswith("FF0000") or rgb in ("FFFF0000", "FF0000")
    except Exception:
        return False

def header_map(row_vals):
    m = {}
    for j, v in enumerate(row_vals):
        h = norm(v).upper()
        if not h:
            continue
        if "PRODUCT" in h and "NAME" in h:
            m["name"] = j
        elif "ORDER" in h and "CODE" in h:
            m["code"] = j
        elif "NET" in h and "INVOICE" in h and "EX" in h and "GST" in h:
            m["netEx"] = j
    return m

def looks_like_header(row_vals):
    joined = " ".join(norm(v).upper() for v in row_vals if v is not None)
    return "PRODUCT NAME" in joined and "ORDER" in joined and "CODE" in joined

def is_section_title(ws, r, row_vals):
    v0 = row_vals[0] if row_vals else None
    if v0 is None or not str(v0).strip():
        return False
    if looks_like_header(row_vals):
        return False
    cell = ws.cell(r, 1)
    if is_red_fill(cell):
        return True
    if cell.font and cell.font.bold and all((row_vals[j] in (None, "") for j in range(1, min(4, len(row_vals))))):
        t = norm(v0)
        if len(t) > 8 and not re.match(r"^[A-Z0-9]{4,}$", t):
            return True
    return False

def clean_section(s):
    s = norm(s)
    s = re.sub(r"^HOT WATER\\s*-\\s*", "", s, flags=re.I)
    return s

def humanize_section(s):
    """Readable banner text for labels (Beau: Tank for Split Elec Heat Pump)."""
    s = clean_section(s)
    out = s
    out = re.sub(
        r"(?i)^split electric heat pump tanks(?:\\s+for\\s+\\S+)?\\s*$",
        "Tank for Split Elec Heat Pump",
        out,
    )
    if out == s and s.isupper() and len(s) > 8:
        parts = []
        for w in s.split(" "):
            if re.match(r"^[A-Z0-9]{2,}\\d", w) or re.match(r"^SHP", w, re.I):
                parts.append(w)
            elif len(w) <= 3:
                parts.append(w)
            else:
                parts.append(w.capitalize())
        out = " ".join(parts)
    return out

def expand_hard_water(name, order_code=""):
    """HW = Hard Water (extra durable tank for hard-water SEQ)."""
    name = norm(name)
    dash = "\\u2014"
    # Trailing workbook marker " HW"
    name = re.sub(r"\\s+HW\\s*$", f" {dash} Hard Water", name, flags=re.I)
    # Order codes like …24H / …L70H mark Hard Water when the name omitted HW
    if order_code and re.search(r"[0-9]H$", order_code) and "hard water" not in name.lower():
        name = f"{name} {dash} Hard Water"
    return norm(name)

def decode_ehf(code):
    """Beau: EHF=Electric HotFlo; litres; S/T; ##=kW×10; P=Plugin; H=Hard Water.
    Optional series letter: D=Compact (sheet); A omitted as series noise.
    """
    m = re.match(r"^EHF([A-Z]?)(\\d+)([ST])(\\d{2})(H?)(P?)$", code)
    if not m:
        return None
    series, litres, elem, kw10, hard, plugin = m.groups()
    kw_s = f"{int(kw10) / 10.0:.1f}"  # 18 → 1.8kW
    parts = ["Electric HotFlo"]
    if series == "D":
        parts.append("Compact")
    elif series and series not in ("A",):
        # Unknown series letter — keep visible so names stay unique / askable
        parts.append(f"Series {series}")
    parts.append(f"{int(litres)}L")
    parts.append("Single" if elem == "S" else "Twin")
    parts.append(f"{kw_s}kW")
    if hard == "H":
        parts.append("Hard Water")
    if plugin == "P":
        parts.append("Plugin")
    return " ".join(parts)

def decode_ghf(code):
    """Gas HotFlo: GHF + star + litres + N/L (+ optional H Hard Water)."""
    m = re.match(r"^GHF(\\d)(\\d{3,4})([NL])(H?)$", code)
    if not m:
        return None
    star, litres, gas, hard = m.groups()
    gas_s = "Natural Gas" if gas == "N" else "LPG"
    parts = ["Gas HotFlo", f"{star} Star", f"{int(litres)}L", gas_s]
    if hard == "H":
        parts.append("Hard Water")
    return " ".join(parts)

def decode_order_code(code):
    return decode_ehf(code) or decode_ghf(code)

def compose_name(section, product, order_code=""):
    decoded = decode_order_code(order_code) if order_code else None
    if decoded:
        return decoded
    product = norm(product)
    section_h = humanize_section(section) if section else ""
    if not product:
        return expand_hard_water(section_h or "", order_code)
    short = bool(re.match(r"^\\d{2,4}\\s*L\\b", product, re.I)) or (
        len(product) < 48 and section and "TANK" in section.upper()
    )
    dash = "\\u2014"
    if section_h and short and section_h.upper() not in product.upper():
        base = f"{section_h} {dash} {product}"
    else:
        base = product
    return expand_hard_water(base, order_code)

low_conf = []
families_out = []
items = []

for fid, flabel, sheet_name in FAMILIES:
    if sheet_name not in wb.sheetnames:
        low_conf.append({"sheet": sheet_name, "reason": "sheet missing"})
        continue
    ws = wb[sheet_name]
    cols = None
    section = ""
    last_net = None
    last_raw_name = ""
    for r in range(1, ws.max_row + 1):
        row_vals = [ws.cell(r, c).value for c in range(1, min(ws.max_column, 16) + 1)]
        if all(v is None or str(v).strip() == "" for v in row_vals):
            continue
        if is_section_title(ws, r, row_vals):
            section = clean_section(row_vals[0])
            last_net = None
            last_raw_name = ""
            continue
        if looks_like_header(row_vals):
            cols = header_map(row_vals)
            if "code" not in cols or "netEx" not in cols:
                low_conf.append({
                    "sheet": sheet_name,
                    "row": r,
                    "reason": "header missing ORDER CODE or NET INVOICE EX GST",
                    "headers": [norm(v) for v in row_vals if v is not None][:12],
                })
                cols = None
            last_net = None
            continue
        if not cols:
            continue
        code_v = row_vals[cols["code"]] if cols["code"] < len(row_vals) else None
        if code_v is None:
            continue
        code = norm(code_v)
        if not code or "ORDER" in code.upper():
            continue
        if not re.match(r"^[A-Za-z0-9]", code):
            continue

        name_i = cols.get("name", 0)
        raw_name = row_vals[name_i] if name_i < len(row_vals) else None
        if raw_name not in (None, ""):
            last_raw_name = norm(raw_name)

        net_i = cols["netEx"]
        net_v = row_vals[net_i] if net_i < len(row_vals) else None
        net = float(net_v) if isinstance(net_v, (int, float)) else None
        if net is not None and 0 < net <= 1:
            low_conf.append({
                "sheet": sheet_name,
                "row": r,
                "col": net_i + 1,
                "cell": net,
                "code": code,
                "reason": "NET EX GST looked like discount fraction; not used",
            })
            net = None
        if net is not None and net > 1:
            last_net = round(net, 2)
            use_net = last_net
        elif last_net is not None:
            use_net = last_net
        else:
            continue

        # Keep BOTH rows when order codes duplicate (e.g. SHPR50 Hard Water kits).
        display = compose_name(section, last_raw_name or code, code)

        items.append({
            "familyId": fid,
            "name": display,
            "orderCode": code,
            "netExGst": use_net,
        })

    families_out.append({"id": fid, "label": flabel, "count": 0})

# Drop ghosts; strip debug fields from shipped items
clean = []
for it in items:
    if it["netExGst"] > 1:
        clean.append({
            "familyId": it["familyId"],
            "name": it["name"],
            "orderCode": it["orderCode"],
            "netExGst": it["netExGst"],
        })
items = clean
for f in families_out:
    f["count"] = sum(1 for it in items if it["familyId"] == f["id"])

payload = {
    "version": 1,
    "meta": {
        "title": "Finished-goods Hot Water price rows",
        "effectiveDate": effective,
        "label": label,
        "sourceFile": workbook_file,
        "generatedFile": generated.replace("\\\\", "/"),
        "notes": "Net = Net Invoice Price (EX GST) by header text (re-bound each header row). Red banner rows = section titles for labels. Sibling blank-price rows inherit prior real Net (> $1). Not spare-parts Bible pricing.",
    },
    "families": families_out,
    "items": items,
    "ingestLowConfidence": low_conf,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\\n")
print(json.dumps({"items": len(items), "families": families_out, "lowConfidence": len(low_conf)}, indent=2))
for x in low_conf[:25]:
    print("LOW", json.dumps(x))
kits = [it for it in items if it["orderCode"].startswith("KSHP")]
print("KSHP", [(it["orderCode"], it["netExGst"], it["name"][:60]) for it in kits[:12]])
ehf = [it for it in items if it["orderCode"].startswith("EHF")]
print("EHF15_19", [(it["orderCode"], it["name"]) for it in ehf[:8]])
print("EHF_UNIQUE", len(ehf), "names", len({it["name"] for it in ehf}))
ghf = [it for it in items if it["orderCode"].startswith("GHF")]
print("GHF", [(it["orderCode"], it["name"]) for it in ghf])
`;

const pyFile = path.join(root, "scripts", "_tmp_ingest_zone_hwt_fg.py");
fs.writeFileSync(pyFile, pyBody);
const r = spawnSync(
  "python",
  [
    pyFile,
    xlsxPath,
    outPath,
    String(fgCfg.effectiveDate || "2026-02-01"),
    String(fgCfg.label || "Finished goods Hot Water"),
    String(fgCfg.workbookFile || path.basename(xlsxPath)),
    outRel.replace(/\\/g, "/"),
  ],
  { encoding: "utf8" }
);
try {
  fs.unlinkSync(pyFile);
} catch {
  /* ignore */
}
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.status !== 0) process.exit(r.status || 1);
console.log("Wrote", outPath);
