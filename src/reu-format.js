/**
 * Format REU Item Numbers to Rinnai’s hyphenated schema (data-plate / tech-sheet style).
 *
 * Examples:
 *   REUA2626WB50AKN     → REU-A2626WB-50-AKN
 *   REUVCM2837WC50KL    → REU-VCM2837WC-50-KL
 *   REUNB3237WC42AK     → REU-NB3237WC-42-AK
 *   REUAM3237W50AKL     → REU-AM3237W-50-AKL
 *   REUKM2635WDAKL      → REU-KM2635WD-AKL
 *   REUVR2632FFG75UAL   → REU-VR2632FFG-75-UAL
 *   REUV2632WCAKNCN     → REU-V2632WC-AKNCN
 *   REUCUG1             → REU-CUG1
 *
 * Matching code already strips non-alnum, so hyphens are display/schema only.
 */

const TEMPS = [
  "95",
  "85",
  "75",
  "70",
  "65",
  "60",
  "55",
  "50",
  "42",
  "40",
];

/**
 * @param {string|null|undefined} itemNumber
 * @returns {string|null}
 */
export function formatReuItemNumber(itemNumber) {
  const raw = String(itemNumber || "").trim();
  if (!raw) return null;

  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  if (!alnum.startsWith("REU") || alnum.length <= 3) {
    // Non-REU or too short — keep trimmed original (or REU- if somehow "REU")
    if (/^REU$/i.test(alnum)) return "REU";
    return raw;
  }

  let body = alnum.slice(3);
  /** @type {string[]} */
  const tail = []; // segments after chassis, left-to-right order built via unshift

  // Trailing revision digit used on a few K26* rows (…KL2 / …KN2).
  if (/(?:KL|KN|KB|AKL|AKN|AKB)2$/.test(body)) {
    tail.unshift("2");
    body = body.slice(0, -1);
  }

  if (body.endsWith("NZ")) {
    tail.unshift("NZ");
    body = body.slice(0, -2);
  }
  if (body.endsWith("BLK")) {
    tail.unshift("BLK");
    body = body.slice(0, -3);
  }

  // Legacy two-letter market/fuel blobs (…AKNCN / …ANCL / …FFUANCN).
  const legacyPack = body.match(/(AKNCN|AKNCL|ANCN|ANCL)$/);
  if (legacyPack) {
    tail.unshift(legacyPack[1]);
    body = body.slice(0, -legacyPack[1].length);
    return ["REU", body, ...tail].filter(Boolean).join("-");
  }

  // Optional fuel letter N/L/B when preceded by temp / K / AK / UA / Z.
  let fuel = "";
  if (/[NLB]$/.test(body) && body.length >= 2) {
    const prev = body.slice(0, -1);
    if (
      /(?:AK|UA|ZK|K)$/.test(prev) ||
      /\d{2}$/.test(prev) ||
      /(?:AK|K|UA)\d{0}$/.test(prev)
    ) {
      fuel = body.slice(-1);
      body = prev;
    }
  }

  // Packing marker: UA | AK | ZK | K (K only after a digit).
  let marker = "";
  if (body.endsWith("UA")) {
    marker = "UA";
    body = body.slice(0, -2);
  } else if (body.endsWith("AK")) {
    marker = "AK";
    body = body.slice(0, -2);
  } else if (body.endsWith("ZK")) {
    marker = "ZK";
    body = body.slice(0, -2);
  } else if (/[0-9]K$/.test(body)) {
    marker = "K";
    body = body.slice(0, -1);
  }

  let temp = "";
  for (const t of TEMPS) {
    if (body.endsWith(t)) {
      temp = t;
      body = body.slice(0, -t.length);
      break;
    }
  }

  const pack = `${marker}${fuel}`;
  if (pack) tail.unshift(pack);
  if (temp) tail.unshift(temp);

  const chassis = body || alnum.slice(3);
  return ["REU", chassis, ...tail].join("-");
}

/**
 * Mutate model.itemNumber into hyphenated REU schema.
 * @param {object} model
 */
export function applyReuItemNumberFormat(model) {
  if (!model || model.itemNumber == null) return model;
  model.itemNumber = formatReuItemNumber(model.itemNumber);
  return model;
}
