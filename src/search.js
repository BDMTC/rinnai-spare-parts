/**
 * Local catalogue search for Rinnai spare parts.
 *
 * Ranking (pinned model/series):
 *   1. Chassis / series fit for the pin (exact → related family → none)
 *   2. Trade-alias strength (preferPatterns → officialPatterns → weak)
 *   3. Code / name / token match quality
 *
 * Fit is inferred from chassis tokens in the price-list description against
 * series-aliases documentKeys (modelIds are not populated on ingest yet).
 */

import { documentKeysForPin } from "./series.js";
import { unitClassOf, seriesKeyMatchesTag, normalise as normaliseKey } from "./documents.js";

function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/+.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text) {
  return normalise(text).split(" ").filter(Boolean);
}

function alnum(text) {
  return normaliseKey(text);
}

/**
 * Build a lookup index for part-name abbreviation ↔ long-form groups.
 * @param {object|null|undefined} abbrevDoc
 */
export function buildAbbrevIndex(abbrevDoc) {
  const groups = [];
  const formToGroup = new Map();
  const phrases = [];

  for (const raw of abbrevDoc?.groups || []) {
    if (!raw || raw.status === "unset") continue;
    const forms = [
      ...new Set((raw.forms || []).map((f) => normalise(f)).filter(Boolean)),
    ];
    if (!forms.length) continue;
    const group = {
      id: String(raw.id || `g${groups.length}`),
      status: raw.status || "locked",
      forms,
      formSet: new Set(forms),
      numericSuffix: Boolean(raw.numericSuffix),
      excludeNamePatterns: (raw.excludeNamePatterns || [])
        .map((p) => normalise(p))
        .filter(Boolean),
    };
    groups.push(group);
    for (const form of forms) {
      // Prefer first group if a form were duplicated; should not happen.
      if (!formToGroup.has(form)) formToGroup.set(form, group);
      if (form.includes(" ") || form.includes("/")) {
        phrases.push({ form, group });
      }
    }
  }

  phrases.sort((a, b) => b.form.length - a.form.length);
  return { groups, formToGroup, phrases };
}

function nameExcludedForGroup(nameN, group) {
  for (const pat of group.excludeNamePatterns || []) {
    if (pat && nameN.includes(pat)) return true;
  }
  return false;
}

function queryExcludedForGroup(q, group) {
  for (const pat of group.excludeNamePatterns || []) {
    if (pat && q.includes(pat)) return true;
  }
  return false;
}

function resolveSegmentGroup(segment, index) {
  if (!segment || !index) return null;
  const direct = index.formToGroup.get(segment);
  if (direct) return direct;
  // 2mtr / 10mtr length shorthand
  const m = segment.match(/^(\d+)(mtr)$/);
  if (m) {
    const g = index.formToGroup.get(m[2]);
    if (g?.numericSuffix) return g;
  }
  return null;
}

/**
 * Whole-token / phrase presence — avoids false hits like C/W inside WC/WD,
 * and avoids mining CONV out of CONV/KIT (known slash-forms stay atomic).
 * @param {string} nameN
 * @param {string} form
 * @param {{ formToGroup?: Map }|null} [index]
 */
function formPresentInName(nameN, form, index = null) {
  if (!nameN || !form) return false;
  if (form.includes(" ")) {
    return ` ${nameN} `.includes(` ${form} `);
  }
  const spaceToks = nameN.split(" ").filter(Boolean);
  if (form.includes("/")) {
    return spaceToks.includes(form);
  }
  if (spaceToks.includes(form)) return true;

  // Slash pieces (MOTOR/FAN/HSG → hsg), but not inside known slash-forms (CONV/KIT)
  for (const tok of spaceToks) {
    if (!tok.includes("/")) continue;
    if (index?.formToGroup?.get(tok)) continue;
    for (const part of tok.split("/")) {
      if (part === form) return true;
    }
  }

  const group = index?.formToGroup?.get(form);
  if (group?.numericSuffix) {
    return spaceToks.some((s) => new RegExp(`^\\d+${form}$`).test(s));
  }
  return false;
}

/**
 * Expand a normalised name/query with all synonym forms for matched groups.
 * Returns base text plus a Set of full synonym forms (do not space-split the
 * joined blob for single-token checks — that leaked “components” out of
 * “COND COMPONENTS” into unrelated queries).
 * Slash-phrase forms (CONV/KIT, C/W, W/PNL) bind only their own group.
 * @param {string} textN already-normalised text
 * @param {{ formToGroup: Map, phrases: Array }} index
 * @returns {{ text: string, forms: Set<string> }}
 */
export function expandAbbrevs(textN, index) {
  const empty = { text: textN || "", forms: new Set() };
  if (!textN || !index?.groups?.length) return empty;
  const extras = new Set();

  for (const { form, group } of index.phrases) {
    if (!formPresentInName(textN, form, index)) continue;
    if (nameExcludedForGroup(textN, group)) continue;
    for (const f of group.forms) extras.add(f);
  }

  for (const tok of String(textN)
    .split(" ")
    .filter(Boolean)) {
    // Whole slash-token is itself a known form (conv/kit, c/w, w/pnl, …)
    const whole = index.formToGroup.get(tok);
    if (whole && tok.includes("/")) {
      if (!nameExcludedForGroup(textN, whole)) {
        for (const f of whole.forms) extras.add(f);
      }
      continue;
    }

    const segs = tok.includes("/")
      ? [tok, ...tok.split("/").filter(Boolean)]
      : [tok];
    for (const seg of segs) {
      const group = resolveSegmentGroup(seg, index);
      if (!group) continue;
      if (nameExcludedForGroup(textN, group)) continue;
      for (const f of group.forms) extras.add(f);
    }
  }

  if (!extras.size) return { text: textN, forms: extras };
  return { text: `${textN} ${[...extras].join(" ")}`, forms: extras };
}

/** @param {string|{text?: string, forms?: Set<string>}} expanded */
function expandedText(expanded, fallback = "") {
  if (!expanded) return fallback;
  if (typeof expanded === "string") return expanded;
  return expanded.text || fallback;
}

/** @param {string|{text?: string, forms?: Set<string>}} expanded */
function expandedFormSet(expanded) {
  if (!expanded || typeof expanded === "string") return new Set();
  return expanded.forms || new Set();
}

/**
 * Synonym form present on original name or in the expansion form Set
 * (exact full-form membership — no mining words out of multi-word extras).
 */
function synonymPresent(nameN, expanded, form, index) {
  if (!form) return false;
  if (formPresentInName(nameN, form, index)) return true;
  const forms = expandedFormSet(expanded);
  if (forms.has(form)) return true;
  if (form.includes(" ")) {
    const blob = expandedText(expanded, nameN);
    return ` ${blob} `.includes(` ${form} `);
  }
  return false;
}

/**
 * Human-readable abbrev bridges for UI chips (one chip per group).
 * Example: query "bracket", name has BRKT → "matched BRKT (bracket)".
 * Covers every wired group in part-name-abbreviations.json when that group
 * caused the hit — not BRKT-only.
 * @returns {string[]}
 */
export function matchedAbbrevLabels(nameN, expanded, q, abbrevForms, index) {
  if (!q || !index?.groups?.length) return [];
  const labels = [];
  const seenGroups = new Set();

  const display = (form) => String(form || "").toUpperCase();

  const formsOnName = (group) =>
    (group?.forms || []).filter((f) => formPresentInName(nameN, f, index));

  const considerGroup = (group, queryForm) => {
    if (!group || seenGroups.has(group.id)) return;
    if (nameExcludedForGroup(nameN, group)) return;
    if (queryExcludedForGroup(q, group)) return;
    const onName = formsOnName(group);
    if (!onName.length) return;

    const qry = String(queryForm || q || "").trim();
    // Exact full-word already on the name — no cue (variant did not fire).
    // Cue only when the typed form differs from what's printed on the part.
    if (onName.includes(qry) || onName.includes(q)) return;

    seenGroups.add(group.id);

    // Prefer catalogue spelling that differs from what the user typed
    const catalogueForm =
      onName.find((f) => f !== qry) || onName[0];
    const cat = String(catalogueForm || "").trim();
    if (!cat) return;

    if (qry && qry !== cat) {
      labels.push(`matched ${display(cat)} (${qry})`);
    } else {
      labels.push(`matched ${display(cat)}`);
    }
  };

  const exact = index.formToGroup.get(q);
  if (exact) considerGroup(exact, q);

  for (const t of abbrevForms?.singles || []) {
    considerGroup(index.formToGroup.get(t), q);
  }
  for (const ph of abbrevForms?.phrases || []) {
    considerGroup(index.formToGroup.get(ph), q);
  }

  if (!labels.length) {
    for (const f of expandedFormSet(expanded)) {
      const group = index.formToGroup.get(f);
      if (!group) continue;
      if (!formsOnName(group).length) continue;
      if (
        f === q ||
        abbrevForms?.singles?.includes(f) ||
        abbrevForms?.phrases?.includes(f) ||
        q.includes(f) ||
        f.includes(q)
      ) {
        considerGroup(group, q);
        if (labels.length) break;
      }
    }
  }

  return labels.slice(0, 4);
}

/**
 * True when query text (normalised) hits a name via abbreviation expansion.
 * Used to credit name-level matches like query "bracket" vs name "BRKT …".
 */
function abbrevNameHit(nameN, expanded, q, index) {
  if (!q || !index?.groups?.length) return false;

  const group = index.formToGroup.get(q);
  if (
    group &&
    !nameExcludedForGroup(nameN, group) &&
    !queryExcludedForGroup(q, group)
  ) {
    return group.forms.some((f) => synonymPresent(nameN, expanded, f, index));
  }

  // Expanded long-form landed in synonym set only (e.g. query "bracket", name has BRKT)
  if (!formPresentInName(nameN, q, index) && synonymPresent(nameN, expanded, q, index)) {
    return true;
  }
  return false;
}

/**
 * Synonym forms for the query — single-token forms only for token overlap
 * (do not split "right hand" into independent right/hand tokens).
 * Multi-word / exact phrase matches win so "wall panel" does not also
 * expand bare PANEL, and excludeNamePatterns apply on the query side too.
 */
function abbrevQueryForms(q, qTokens, index) {
  const singles = new Set();
  const phrases = new Set();
  if (!q || !index?.groups?.length) {
    return { singles: [], phrases: [] };
  }

  const addGroup = (group) => {
    if (!group || queryExcludedForGroup(q, group)) return;
    for (const f of group.forms) {
      if (f.includes(" ")) phrases.add(f);
      else singles.add(f);
    }
  };

  // Exact whole-query form (e.g. "conversion kit", "wall panel", "brkt")
  const exact = index.formToGroup.get(q);
  if (exact) {
    addGroup(exact);
    return { singles: [...singles], phrases: [...phrases] };
  }

  // Contained phrase forms (longest first already in index.phrases)
  const padded = ` ${q} `;
  const phraseHits = [];
  let remainder = q;
  for (const { form, group } of index.phrases) {
    if (queryExcludedForGroup(q, group)) continue;
    if (!padded.includes(` ${form} `) && q !== form) continue;
    phraseHits.push({ form, group });
    remainder = remainder.split(form).join(" ");
  }
  if (phraseHits.length) {
    for (const hit of phraseHits) addGroup(hit.group);
    for (const t of remainder.split(/\s+/).filter(Boolean)) {
      addGroup(index.formToGroup.get(t));
    }
    return { singles: [...singles], phrases: [...phrases] };
  }

  for (const t of qTokens) addGroup(index.formToGroup.get(t));
  return { singles: [...singles], phrases: [...phrases] };
}

/**
 * Chassis-like tokens from a price-list description (VRM2632WC, VCM2837, …).
 * Splits on spaces and slashes so "VRM2630WC/WD" yields both sides when useful.
 * @param {string} text
 * @returns {string[]}
 */
export function extractChassisTokens(text) {
  const raw = String(text || "");
  const bits = raw.split(/[\s,/|]+/).filter(Boolean);
  const out = [];
  for (const bit of bits) {
    const n = alnum(bit);
    if (n.length < 4) continue;
    if (!/\d/.test(n) || !/[A-Z]/.test(n)) continue;
    out.push(n);
  }
  return [...new Set(out)];
}

/**
 * Capacity / family digit run (2632, 2837, 3237, …) from a chassis key.
 * @param {string} keyNorm
 */
function capacityCore(keyNorm) {
  const m = String(keyNorm || "").match(/(\d{3,5})/);
  return m ? m[1] : null;
}

/**
 * Build pin match context from series aliases + model sku/item.
 * Works for any series/model in series-aliases.json — not HD200e-specific.
 * @param {{ kind?: string, series?: object|null, model?: object|null, modelIds?: string[] }|null} pin
 */
export function buildPinContext(pin) {
  if (!pin || !pin.kind || pin.kind === "none") {
    return null;
  }

  const keySet = new Set();
  for (const k of documentKeysForPin(pin)) {
    const n = alnum(k);
    if (n && n.length >= 3) keySet.add(n);
  }
  if (pin.series?.label) {
    const n = alnum(pin.series.label);
    if (n) keySet.add(n);
  }
  if (pin.model) {
    for (const field of ["sku", "marketingCode", "itemNumber", "name"]) {
      const n = alnum(pin.model[field]);
      if (n && n.length >= 4) keySet.add(n);
    }
  }

  const keys = [...keySet].sort((a, b) => b.length - a.length);
  const cores = [
    ...new Set(keys.map(capacityCore).filter(Boolean)),
  ];
  const unitClasses = (pin.series?.match?.unitClasses || []).map((u) =>
    String(u).toUpperCase()
  );
  const relatedFamilies = (pin.series?.relatedFamilies || []).map((u) =>
    String(u).toUpperCase()
  );

  return {
    kind: pin.kind,
    modelIds: new Set(pin.modelIds || []),
    keys,
    cores,
    unitClasses,
    relatedFamilies,
    series: pin.series || null,
    model: pin.model || null,
    label:
      pin.series?.label ||
      pin.model?.sku ||
      pin.model?.marketingCode ||
      "pinned model",
  };
}

/**
 * @param {object|null|undefined} tradeDoc
 * @param {string} query
 */
export function matchTradeAliases(tradeDoc, query) {
  const q = normalise(query);
  if (!q || !tradeDoc?.aliases?.length) return [];
  const hits = [];
  for (const entry of tradeDoc.aliases) {
    const terms = (entry.terms || []).map(normalise).filter(Boolean);
    let termHit = null;
    let termStrength = 0;
    for (const term of terms) {
      if (q === term) {
        termHit = term;
        termStrength = 100;
        break;
      }
      if (term.length >= 4 && (q.includes(term) || term.includes(q))) {
        const strength = Math.min(90, 50 + term.length);
        if (strength > termStrength) {
          termHit = term;
          termStrength = strength;
        }
      }
    }
    if (!termHit) continue;
    hits.push({
      entry,
      termHit,
      termStrength,
      official: (entry.officialPatterns || []).map(normalise),
      prefer: (entry.preferPatterns || []).map(normalise),
    });
  }
  hits.sort((a, b) => b.termStrength - a.termStrength);
  return hits;
}

/**
 * How well a part description fits the pinned series/model chassis.
 * @returns {{ tier: 'exact'|'related'|'none', strength: number, matchedKey: string|null, reason: string|null }}
 */
export function scorePartFit(part, pinCtx) {
  if (!pinCtx) {
    return { tier: "none", strength: 0, matchedKey: null, reason: null };
  }

  const partModelIds = part.modelIds || [];
  if (partModelIds.some((id) => pinCtx.modelIds.has(id))) {
    return {
      tier: "exact",
      strength: 120,
      matchedKey: "modelId",
      reason: "linked model id",
    };
  }

  const haystack = alnum(
    [part.name, part.code, ...(part.aliases || [])].join(" ")
  );
  const chassis = extractChassisTokens(
    [part.name, ...(part.aliases || [])].join(" ")
  );

  let bestExact = null;
  for (const key of pinCtx.keys) {
    if (key.length < 4) continue;
    // Direct containment in description blob
    if (haystack.includes(key)) {
      // If pin requires a unit class, reject conflicting classes in haystack
      if (conflictsPinUnitClass(haystack, chassis, pinCtx, key)) {
        continue;
      }
      const strength = 80 + Math.min(40, key.length);
      if (!bestExact || strength > bestExact.strength) {
        bestExact = {
          tier: "exact",
          strength,
          matchedKey: key,
          reason: `chassis ${key}`,
        };
      }
      continue;
    }
    // Token soft-match (REUVCM2837 ↔ VCM2837) without unit-class conflict
    for (const token of chassis) {
      if (!seriesKeyMatchesTag(key, token)) continue;
      if (conflictsPinUnitClass(haystack, chassis, pinCtx, key)) continue;
      const strength = 70 + Math.min(35, Math.min(key.length, token.length));
      if (!bestExact || strength > bestExact.strength) {
        bestExact = {
          tier: "exact",
          strength,
          matchedKey: key,
          reason: `chassis ${token}≈${key}`,
        };
      }
    }
  }
  if (bestExact) return bestExact;

  // Soft-exact: series.relatedFamilies (e.g. HD200i ↔ FFU heritage parts)
  for (const fam of pinCtx.relatedFamilies) {
    for (const token of chassis) {
      const uc = unitClassOf(token);
      if (uc && uc === fam) {
        return {
          tier: "exact",
          strength: 60 + Math.min(20, token.length),
          matchedKey: fam,
          reason: `related family ${fam} (${token})`,
        };
      }
    }
  }

  // Related: shared capacity digits across the platform line
  let related = null;
  for (const core of pinCtx.cores) {
    if (core && haystack.includes(core)) {
      const strength = 40 + Math.min(20, core.length);
      if (!related || strength > related.strength) {
        related = {
          tier: "related",
          strength,
          matchedKey: core,
          reason: `family ${core}`,
        };
      }
    }
  }

  if (related) return related;
  return { tier: "none", strength: 0, matchedKey: null, reason: null };
}

/**
 * Reject exact fit when the pin is unit-class specific (WC vs FFUC) and the
 * part description carries a conflicting class.
 */
function conflictsPinUnitClass(haystack, chassis, pinCtx, matchedKey) {
  const required = pinCtx.unitClasses || [];
  if (!required.length) return false;

  const keyClass = unitClassOf(matchedKey);
  // A bare platform key (N3237, VRM2632) matching a part that only states that
  // platform is OK; conflict only when the part shows a different unit class.
  const partClasses = new Set();
  for (const token of chassis) {
    const uc = unitClassOf(token);
    if (uc) partClasses.add(uc);
  }
  // Also scan haystack for embedded unit classes after digits
  for (const suffix of ["WCAK", "FFUDC", "FFUC", "FFUG", "FFUD", "FFC", "FFU", "WDC", "WC", "WD", "WG"]) {
    const re = new RegExp(`\\d${suffix}(?=[A-Z0-9]|$)`);
    if (re.test(haystack)) partClasses.add(suffix);
  }

  if (!partClasses.size) return false;

  // If any part class is allowed, no conflict
  for (const pc of partClasses) {
    if (required.includes(pc)) return false;
  }
  // Part only shows disallowed classes
  if (keyClass && required.includes(keyClass) && ![...partClasses].includes(keyClass)) {
    return true;
  }
  return [...partClasses].every((pc) => !required.includes(pc));
}

/**
 * Typical sellable Rinnai AU part code = exactly 8 digits.
 * Non-8-digit / RA-supplier-style identifiers are not purchaseable (Beau).
 * @param {string|null|undefined} code
 */
export function isSellablePartCode(code) {
  return /^\d{8}$/.test(String(code || "").trim());
}

/**
 * @param {string|null|undefined} code
 */
export function isNotPurchasableCode(code) {
  const c = String(code || "").trim();
  if (!c) return false;
  if (isSellablePartCode(c)) return false;
  // Hyphenated supplier / RA-style, letter prefixes, or any non-8-digit token
  return true;
}

/**
 * Build lookup indexes from assembly-hierarchy.json.
 * @param {object|null|undefined} hierarchyDoc
 */
export function buildAssemblyIndex(hierarchyDoc) {
  const concepts = [];
  /** @type {Map<string, object>} */
  const childByCode = new Map();
  const parentByCode = new Map();
  const demotionCues = (hierarchyDoc?.demotionCues || [])
    .map((c) => normalise(c))
    .filter(Boolean);

  for (const raw of hierarchyDoc?.concepts || []) {
    if (!raw?.id) continue;
    concepts.push({
      id: String(raw.id),
      queryTerms: (raw.queryTerms || []).map(normalise).filter(Boolean),
      assemblyNamePatterns: (raw.assemblyNamePatterns || [])
        .map(normalise)
        .filter(Boolean),
    });
  }

  for (const raw of hierarchyDoc?.assemblies || []) {
    const parentCode = String(raw.parentCode || "").trim();
    if (!parentCode) continue;
    const duoRaw = raw.duoGroup || null;
    const parent = {
      parentCode,
      parentName: String(raw.parentName || "").trim(),
      shortName: String(raw.shortName || raw.parentName || parentCode).trim(),
      conceptId: raw.conceptId ? String(raw.conceptId) : null,
      seriesTokens: (raw.seriesTokens || [])
        .map((t) => alnum(t))
        .filter(Boolean),
      assemblyRole: raw.assemblyRole ? String(raw.assemblyRole) : null,
      demoteForBareConcept: Boolean(raw.demoteForBareConcept),
      duoGroup: duoRaw
        ? {
            id: String(duoRaw.id || "").trim(),
            role: String(duoRaw.role || "").trim(), // top | bottom
            partnerCode: String(duoRaw.partnerCode || "").trim(),
            label: String(duoRaw.label || duoRaw.role || "").trim(),
            needBothNote: String(
              duoRaw.needBothNote ||
                "Check if both TOP and BTM are required; if not, order the singular one"
            ).trim(),
          }
        : null,
      children: [],
    };
    parentByCode.set(parentCode, parent);

    for (const ch of raw.children || []) {
      const code = String(ch.code || "").trim();
      if (!code) continue;
      const link = {
        code,
        role: ch.role ? String(ch.role) : null,
        shared: Boolean(ch.shared),
        parentCode,
        parentName: parent.parentName,
        shortName: parent.shortName,
        conceptId: parent.conceptId,
        seriesTokens: parent.seriesTokens,
      };
      parent.children.push(link);

      // Shared children (e.g. HEX gasket 142) may sit under multiple parent loops.
      const existing = childByCode.get(code);
      if (!existing) {
        childByCode.set(code, {
          code,
          role: link.role,
          shared: link.shared,
          parents: [
            {
              parentCode,
              parentName: parent.parentName,
              shortName: parent.shortName,
              conceptId: parent.conceptId,
              seriesTokens: parent.seriesTokens,
            },
          ],
          // Back-compat single-parent fields = first parent
          parentCode,
          parentName: parent.parentName,
          shortName: parent.shortName,
          conceptId: parent.conceptId,
          seriesTokens: parent.seriesTokens,
        });
      } else {
        existing.shared = existing.shared || link.shared || true;
        if (
          !existing.parents.some((p) => p.parentCode === parentCode)
        ) {
          existing.parents.push({
            parentCode,
            parentName: parent.parentName,
            shortName: parent.shortName,
            conceptId: parent.conceptId,
            seriesTokens: parent.seriesTokens,
          });
        }
      }
    }
  }

  return { concepts, childByCode, parentByCode, demotionCues };
}

/**
 * Which assembly concept (if any) the query is aiming at.
 * @returns {object|null}
 */
export function matchAssemblyConcept(hierarchyIndex, query) {
  if (!hierarchyIndex?.concepts?.length) return null;
  const q = normalise(query);
  if (!q) return null;
  let best = null;
  for (const concept of hierarchyIndex.concepts) {
    for (const term of concept.queryTerms) {
      if (!term) continue;
      let strength = 0;
      if (q === term) strength = 100;
      else if (q.includes(term) || (term.length >= 4 && term.includes(q))) {
        strength = Math.min(95, 50 + term.length);
      }
      if (strength > 0 && (!best || strength > best.strength)) {
        best = { concept, term, strength };
      }
    }
  }
  return best;
}

/**
 * True when the typed query already names a demotion cue (gasket, top, …)
 * so we should not demote those rows.
 */
function queryAsksForCue(q, cue) {
  if (!q || !cue) return false;
  if (cue.includes(" ")) return ` ${q} `.includes(` ${cue} `) || q.includes(cue);
  const toks = q.split(" ").filter(Boolean);
  return toks.includes(cue);
}

/**
 * Name looks like a sub-piece of an assembly concept (TOP / GASKET / …).
 */
function nameHasDemotionCue(nameN, cues, q) {
  if (!nameN || !cues?.length) return null;
  for (const cue of cues) {
    if (!cue) continue;
    if (queryAsksForCue(q, cue)) continue;
    if (cue.includes(" ")) {
      if (nameN.includes(cue)) return cue;
      continue;
    }
    const toks = nameN.split(" ").filter(Boolean);
    if (toks.includes(cue)) return cue;
  }
  return null;
}

function nameMatchesAssemblyPatterns(nameN, patterns) {
  if (!nameN || !patterns?.length) return false;
  const padded = ` ${nameN} `;
  return patterns.some((p) => {
    if (!p) return false;
    // Prefer whole-phrase containment so "front panel" does not hit "brkt front panel" wait —
    // actually "brkt front panel" legitimately contains the phrase; require start-ish /
    // assembly-shaped: pattern at token boundary and not preceded by brace/brkt noise.
    if (!padded.includes(` ${p} `) && nameN !== p) return false;
    if (/^(brkt|brace|bracket|gasket|o ring|o-ring|seal)\b/.test(nameN)) {
      return false;
    }
    return true;
  });
}

/**
 * Pin chassis tokens for scoping assembly maps (N3237, VRM2632, …).
 */
function pinChassisTokens(pinCtx) {
  if (!pinCtx) return [];
  const out = new Set();
  for (const k of pinCtx.keys || []) {
    const n = alnum(k);
    if (n) out.add(n);
  }
  for (const c of pinCtx.cores || []) {
    if (c) out.add(String(c));
  }
  return [...out];
}

function assemblyInPinScope(entry, pinTokens) {
  if (!pinTokens?.length) return true;
  const series = entry?.seriesTokens || [];
  if (!series.length) return true;
  for (const tok of series) {
    for (const pin of pinTokens) {
      if (pin === tok) return true;
      if (pin.includes(tok) || tok.includes(pin)) return true;
      // capacity core soft match (3237 inside N3237 / KM3237)
      const core = capacityCore(tok);
      if (core && pin.includes(core)) return true;
    }
  }
  return false;
}

/**
 * Score / annotate assembly vs sub-component for a matched part.
 * @returns {{
 *   delta: number,
 *   assemblyRank: number,
 *   isSubComponent: boolean,
 *   isAssembly: boolean,
 *   subOf: null|{code: string, shortName: string, name: string, parents?: Array<{code: string, shortName: string, name: string}>},
 *   reason: string|null
 * }}
 */
export function scoreAssemblyRole(part, query, hierarchyIndex, pinCtx = null) {
  const empty = {
    delta: 0,
    assemblyRank: 0,
    isSubComponent: false,
    isAssembly: false,
    subOf: null,
    reason: null,
  };
  if (!hierarchyIndex || !query) return empty;

  const conceptHit = matchAssemblyConcept(hierarchyIndex, query);
  if (!conceptHit) return empty;

  const q = normalise(query);
  const nameN = normalise(part.name);
  const code = String(part.code || "").trim();
  const pinTokens = pinChassisTokens(pinCtx);
  const hasPin = Boolean(pinCtx);
  const concept = conceptHit.concept;
  const child = hierarchyIndex.childByCode.get(code);
  const parent = hierarchyIndex.parentByCode.get(code);

  // Explicit child of a mapped parent (may be shared across multiple loops)
  if (child) {
    const parentLinks = child.parents?.length
      ? child.parents
      : [
          {
            parentCode: child.parentCode,
            parentName: child.parentName,
            shortName: child.shortName,
            seriesTokens: child.seriesTokens,
          },
        ];
    const scoped = parentLinks.some((p) =>
      assemblyInPinScope(
        { seriesTokens: p.seriesTokens || child.seriesTokens },
        pinTokens
      )
    );
    // Free search: always demote known children. Pinned: only chassis-scoped.
    if (!hasPin || scoped) {
      const parents = parentLinks.map((p) => {
        const parentRec = hierarchyIndex.parentByCode.get(p.parentCode);
        return {
          code: p.parentCode,
          shortName: p.shortName || parentRec?.shortName || p.parentCode,
          name:
            p.parentName ||
            parentRec?.parentName ||
            p.shortName ||
            p.parentCode,
        };
      });
      const label = parents
        .map((p) => `${p.code} ${p.shortName}`.trim())
        .join(" / ");
      return {
        delta: hasPin && scoped ? -55 : -45,
        assemblyRank: -2,
        isSubComponent: true,
        isAssembly: false,
        subOf: {
          code: parents[0].code,
          shortName: parents[0].shortName,
          name: parents[0].name,
          parents,
        },
        reason: `sub-component of ${label}`,
      };
    }
  }

  // Mapped parent / top-half assembly
  if (parent && (!parent.conceptId || parent.conceptId === concept.id)) {
    const scoped = assemblyInPinScope(parent, pinTokens);
    if (hasPin && !scoped) {
      // Other chassis assembly — leave alone beyond heuristics below
    } else if (parent.demoteForBareConcept || parent.assemblyRole === "top-half") {
      const cue = nameHasDemotionCue(nameN, hierarchyIndex.demotionCues, q);
      if (cue) {
        return {
          delta: hasPin && scoped ? -35 : -28,
          assemblyRank: -1,
          isSubComponent: true,
          isAssembly: false,
          subOf: null,
          reason: `partial assembly (${cue})`,
        };
      }
    } else {
      return {
        delta: hasPin && scoped ? 70 : 55,
        assemblyRank: 3,
        isSubComponent: false,
        isAssembly: true,
        subOf: null,
        reason: "complete assembly",
      };
    }
  }

  // Heuristic: name matches concept patterns
  if (!nameMatchesAssemblyPatterns(nameN, concept.assemblyNamePatterns)) {
    return empty;
  }

  const cue = nameHasDemotionCue(nameN, hierarchyIndex.demotionCues, q);
  if (cue) {
    // Infer parent note from hierarchy when possible (same chassis token)
    let subOf = null;
    const chassis = extractChassisTokens(part.name);
    for (const [, p] of hierarchyIndex.parentByCode) {
      if (p.conceptId && p.conceptId !== concept.id) continue;
      if (p.demoteForBareConcept) continue;
      if (!assemblyInPinScope(p, chassis.length ? chassis : pinTokens)) continue;
      if (hasPin && !assemblyInPinScope(p, pinTokens)) continue;
      subOf = {
        code: p.parentCode,
        shortName: p.shortName,
        name: p.parentName || p.shortName,
      };
      break;
    }
    return {
      delta: -30,
      assemblyRank: -1,
      isSubComponent: true,
      isAssembly: false,
      subOf,
      reason: `demotion cue ${cue}`,
    };
  }

  // Clean assembly-shaped name for this concept (heuristic — below mapped parents)
  return {
    delta: hasPin ? 28 : 22,
    assemblyRank: 1,
    isSubComponent: false,
    isAssembly: true,
    subOf: null,
    reason: "assembly name match",
  };
}

/**
 * Trade-alias hit quality against a part name.
 * @returns {{ strength: number, label: string|null, preferred: boolean }}
 */
function scoreTradeHit(partNameN, tradeHits) {
  if (!tradeHits.length) {
    return { strength: 0, label: null, preferred: false };
  }
  let best = { strength: 0, label: null, preferred: false };
  for (const hit of tradeHits) {
    for (const pref of hit.prefer) {
      if (pref && partNameN.includes(pref)) {
        const strength = 90 + Math.min(10, pref.length);
        if (strength > best.strength) {
          best = {
            strength,
            label: hit.entry.id || "trade",
            preferred: true,
          };
        }
      }
    }
    for (const pat of hit.official) {
      if (pat && partNameN.includes(pat)) {
        const strength = 70 + Math.min(15, pat.length);
        if (strength > best.strength) {
          best = {
            strength,
            label: hit.entry.id || "trade",
            preferred: hit.prefer.some((p) => partNameN.includes(p)),
          };
        }
      }
    }
  }
  return best;
}

/**
 * @param {object} catalogue
 * @param {string} query
 * @param {string|null} modelId
 * @param {{
 *   limit?: number,
 *   modelIds?: string[],
 *   pin?: object|null,
 *   tradeAliases?: object|null,
 *   partAbbrevs?: object|null,
 *   abbrevIndex?: object|null,
 *   assemblyHierarchy?: object|null,
 *   assemblyIndex?: object|null,
 *   isPartVisible?: ((part: object) => boolean)|null,
 * }} [opts]
 * @returns {Array<object>}
 */
export function searchParts(catalogue, query, modelId = null, opts = {}) {
  const q = normalise(query);
  const qTokens = tokens(query);
  const limit = opts.limit ?? 80;
  const pinCtx =
    opts.pin && opts.pin.kind && opts.pin.kind !== "none"
      ? buildPinContext(opts.pin)
      : buildPinContext(
          modelId || (opts.modelIds && opts.modelIds.length)
            ? {
                kind: "model",
                modelIds:
                  opts.modelIds && opts.modelIds.length
                    ? opts.modelIds
                    : [modelId],
                series: null,
                model: (catalogue.models || []).find((m) => m.id === modelId) || null,
              }
            : null
        );
  const hasPin = Boolean(pinCtx);
  const tradeHits = matchTradeAliases(opts.tradeAliases, query);
  const hasTrade = tradeHits.length > 0;
  const abbrevIndex =
    opts.abbrevIndex ||
    (opts.partAbbrevs ? buildAbbrevIndex(opts.partAbbrevs) : null);
  const abbrevForms = abbrevIndex
    ? abbrevQueryForms(q, qTokens, abbrevIndex)
    : { singles: [], phrases: [] };
  /** Whole query is itself a locked form — don't token-flood on words like "with"/"panel". */
  const exactAbbrevQuery = Boolean(abbrevIndex?.formToGroup.has(q));
  const assemblyIndex =
    opts.assemblyIndex ||
    (opts.assemblyHierarchy
      ? buildAssemblyIndex(opts.assemblyHierarchy)
      : null);
  const assemblyConcept = assemblyIndex
    ? matchAssemblyConcept(assemblyIndex, query)
    : null;
  const modelsById = Object.fromEntries(
    (catalogue.models || []).map((m) => [m.id, m])
  );
  const isPartVisible =
    typeof opts.isPartVisible === "function" ? opts.isPartVisible : null;

  if (!q && !hasPin) {
    return [];
  }

  const results = [];

  for (const part of catalogue.parts || []) {
    if (isPartVisible && !isPartVisible(part)) continue;

    const nameN = normalise(part.name);
    const nameExpanded = abbrevIndex
      ? expandAbbrevs(nameN, abbrevIndex)
      : { text: nameN, forms: new Set() };
    const nameX = nameExpanded.text;
    const codeN = normalise(part.code);
    const aliasesN = (part.aliases || []).map(normalise);
    const aliasesExpanded = abbrevIndex
      ? aliasesN.map((a) => expandAbbrevs(a, abbrevIndex))
      : aliasesN.map((a) => ({ text: a, forms: new Set() }));
    const aliasesX = aliasesExpanded.map((a) => a.text);
    const categoryN = normalise(part.category);
    const sheetN = normalise(part.sheet);
    const partModelIds = part.modelIds || [];

    const fit = scorePartFit(part, pinCtx);
    const fitsModel =
      !hasPin ? null : fit.tier === "exact" ? true : fit.tier === "related" ? "related" : false;

    let score = 0;
    let matchedOn = [];
    let aliasStrength = 0;
    let abbrevLabels = [];

    const trade = scoreTradeHit(nameN, tradeHits);
    if (trade.strength > 0) {
      score += trade.strength;
      aliasStrength = trade.strength;
      matchedOn.push(trade.preferred ? "trade-prefer" : "trade-alias");
    }

    if (q) {
      if (codeN === q) {
        score += 100;
        matchedOn.push("code");
      } else if (codeN.includes(q) || (q.length >= 3 && q.includes(codeN))) {
        score += 70;
        matchedOn.push("code");
      }

      if (nameN === q) {
        score += 90;
        matchedOn.push("name");
      } else if (
        abbrevIndex?.formToGroup.has(q)
          ? formPresentInName(nameN, q, abbrevIndex)
          : q.includes("/")
            ? formPresentInName(nameN, q, abbrevIndex)
            : nameN.includes(q)
      ) {
        score += 55;
        matchedOn.push("name");
      } else if (
        abbrevNameHit(nameN, nameExpanded, q, abbrevIndex) ||
        abbrevForms.phrases.some((ph) =>
          synonymPresent(nameN, nameExpanded, ph, abbrevIndex)
        )
      ) {
        score += 55;
        aliasStrength = Math.max(aliasStrength, 55);
        matchedOn.push("abbrev");
        abbrevLabels = matchedAbbrevLabels(
          nameN,
          nameExpanded,
          q,
          abbrevForms,
          abbrevIndex
        );
      }

      for (let i = 0; i < aliasesN.length; i += 1) {
        const alias = aliasesN[i];
        const aliasExpanded = aliasesExpanded[i] || {
          text: alias,
          forms: new Set(),
        };
        if (alias === q) {
          score += 85;
          aliasStrength = Math.max(aliasStrength, 85);
          matchedOn.push("alias");
          break;
        }
        if (alias.includes(q) || q.includes(alias)) {
          score += 50;
          aliasStrength = Math.max(aliasStrength, 50);
          matchedOn.push("alias");
          break;
        }
        if (abbrevNameHit(alias, aliasExpanded, q, abbrevIndex)) {
          score += 50;
          aliasStrength = Math.max(aliasStrength, 50);
          matchedOn.push("abbrev");
          break;
        }
      }

      if (categoryN.includes(q) || sheetN.includes(q)) {
        score += 25;
        matchedOn.push("category");
      }

      // Token overlap — trade official patterns + single-token abbrev synonyms
      const extraTokens = hasTrade
        ? tradeHits.flatMap((h) =>
            [...h.prefer, ...h.official].flatMap((p) => p.split(" "))
          )
        : [];
      const searchTokens = [
        ...new Set([
          ...(exactAbbrevQuery ? [] : qTokens),
          ...extraTokens,
          ...abbrevForms.singles,
        ]),
      ].filter((t) => t.length >= 2);

      if (
        searchTokens.length > 1 ||
        score === 0 ||
        hasTrade ||
        abbrevForms.singles.length ||
        abbrevForms.phrases.length
      ) {
        const haystack = [
          nameX,
          codeN,
          categoryN,
          sheetN,
          ...aliasesX,
        ].join(" ");
        let hits = 0;
        let weighed = 0;
        let abbrevTokenHit = false;
        for (const t of searchTokens) {
          const isAbbrevForm = abbrevForms.singles.includes(t);
          const present = isAbbrevForm
            ? synonymPresent(nameN, nameExpanded, t, abbrevIndex)
            : haystack.includes(t);
          if (present) {
            hits += 1;
            // Prefer meaningful trade tokens over stop-ish shorts
            weighed += t.length >= 4 ? 2 : 1;
            if (
              isAbbrevForm &&
              !qTokens.includes(t) &&
              // Variant fired: typed form is not literally on the name
              !formPresentInName(nameN, q, abbrevIndex)
            ) {
              abbrevTokenHit = true;
            }
          }
        }
        for (const ph of abbrevForms.phrases) {
          if (synonymPresent(nameN, nameExpanded, ph, abbrevIndex)) {
            hits += 1;
            weighed += 2;
            if (!formPresentInName(nameN, q, abbrevIndex)) {
              abbrevTokenHit = true;
            }
          }
        }
        if (hits > 0) {
          const denom = Math.max(1, qTokens.length);
          score += Math.round((hits / Math.max(denom, searchTokens.length)) * 35);
          score += Math.min(20, weighed);
          if (!matchedOn.length) {
            matchedOn.push(abbrevTokenHit ? "abbrev" : "token");
          } else if (abbrevTokenHit && !matchedOn.includes("abbrev")) {
            matchedOn.push("abbrev");
          }
          if (abbrevTokenHit && !abbrevLabels.length) {
            abbrevLabels = matchedAbbrevLabels(
              nameN,
              nameExpanded,
              q,
              abbrevForms,
              abbrevIndex
            );
          }
        }
      }

      // Pure trade-query with no textual overlap and no trade pattern hit → skip
      if (hasTrade && score === 0 && trade.strength === 0) {
        // allow token path above; if still 0, drop
      }
    } else if (hasPin && fit.tier !== "none") {
      score = 10 + fit.strength / 10;
      matchedOn.push("model");
    }

    if (score <= 0) continue;

    // Trade query (e.g. "flow servo"): keep official-pattern hits (+ exact code),
    // drop weak chassis/token-only noise like harness clips.
    if (hasTrade && trade.strength <= 0 && codeN !== q) {
      continue;
    }

    // Pin ranking boosts — exact fit first, related demoted but above unrelated
    let fitRank = 0;
    if (hasPin) {
      if (fit.tier === "exact") {
        score += 50 + fit.strength / 10;
        fitRank = 2;
      } else if (fit.tier === "related") {
        score += 8;
        fitRank = 1;
      } else {
        score = Math.max(1, score - 30);
        fitRank = 0;
      }
    }

    const assembly = scoreAssemblyRole(part, query, assemblyIndex, pinCtx);
    if (assembly.delta) {
      score += assembly.delta;
      if (assembly.isAssembly) matchedOn.push("assembly");
      else if (assembly.isSubComponent) matchedOn.push("sub-component");
    }

    const fittedModels = partModelIds
      .map((id) => modelsById[id])
      .filter(Boolean);

    if (
      matchedOn.includes("abbrev") &&
      !abbrevLabels.length &&
      abbrevIndex
    ) {
      abbrevLabels = matchedAbbrevLabels(
        nameN,
        nameExpanded,
        q,
        abbrevForms,
        abbrevIndex
      );
    }

    const parentRec = assemblyIndex?.parentByCode?.get(
      String(part.code || "").trim()
    );

    results.push({
      part,
      score,
      matchedOn: [...new Set(matchedOn)],
      fitsSelectedModel: fitsModel,
      fitTier: fit.tier,
      fitReason: fit.reason,
      aliasStrength,
      abbrevLabels,
      fitRank,
      assemblyRank: assembly.assemblyRank || 0,
      isAssembly: Boolean(assembly.isAssembly),
      isSubComponent: Boolean(assembly.isSubComponent),
      subOf: assembly.subOf || null,
      assemblyReason: assembly.reason,
      duoGroup: parentRec?.duoGroup || null,
      fittedModels,
      isPrimary: false,
      isDuoAssembly: false,
      duoRole: null,
      duoLabel: null,
      duoPartnerCode: null,
      duoNeedBothNote: null,
    });
  }

  results.sort((a, b) => {
    if (hasPin && b.fitRank !== a.fitRank) return b.fitRank - a.fitRank;
    if (assemblyConcept && b.assemblyRank !== a.assemblyRank) {
      return b.assemblyRank - a.assemblyRank;
    }
    if (hasPin && b.aliasStrength !== a.aliasStrength) {
      return b.aliasStrength - a.aliasStrength;
    }
    if (b.score !== a.score) return b.score - a.score;
    return a.part.name.localeCompare(b.part.name);
  });

  const sliced = results.slice(0, limit);
  if (sliced.length) {
    if (hasPin) {
      // Prefer complete assembly among exact-fit when query targets an assembly concept
      if (assemblyConcept) {
        const assemblyExact = sliced.findIndex(
          (r) => r.fitTier === "exact" && r.isAssembly && !r.isSubComponent
        );
        if (assemblyExact >= 0) {
          sliced[assemblyExact].isPrimary = true;
        } else {
          const primaryIdx = sliced.findIndex((r) => r.fitTier === "exact");
          const idx =
            primaryIdx >= 0
              ? primaryIdx
              : sliced[0].fitTier === "related"
                ? 0
                : -1;
          if (idx >= 0) sliced[idx].isPrimary = true;
        }
      } else {
        const primaryIdx = sliced.findIndex((r) => r.fitTier === "exact");
        const idx =
          primaryIdx >= 0
            ? primaryIdx
            : sliced[0].fitTier === "related"
              ? 0
              : -1;
        if (idx >= 0) sliced[idx].isPrimary = true;
      }
    } else if (assemblyConcept) {
      const assemblyIdx = sliced.findIndex(
        (r) => r.isAssembly && !r.isSubComponent
      );
      if (assemblyIdx >= 0) sliced[assemblyIdx].isPrimary = true;
    }

    markAssemblyDuos(sliced, assemblyIndex, assemblyConcept);
  }

  return sliced;
}

/**
 * When a concept needs TOP+BTM halves (e.g. N3237 HEX), highlight both cards
 * together and label roles so admin knows both are required.
 */
function markAssemblyDuos(sliced, assemblyIndex, assemblyConcept) {
  if (!sliced?.length || !assemblyIndex?.parentByCode || !assemblyConcept) {
    return;
  }
  const conceptId = assemblyConcept.concept?.id;
  const byCode = new Map(sliced.map((r) => [String(r.part.code || ""), r]));

  /** @type {Map<string, Array<object>>} */
  const groups = new Map();
  for (const row of sliced) {
    const duo = row.duoGroup;
    if (!duo?.id || !duo.partnerCode) continue;
    const parent = assemblyIndex.parentByCode.get(String(row.part.code || ""));
    if (parent?.conceptId && conceptId && parent.conceptId !== conceptId) {
      continue;
    }
    if (!groups.has(duo.id)) groups.set(duo.id, []);
    groups.get(duo.id).push(row);
  }

  for (const [, members] of groups) {
    // Ensure partner rows are included when present in the result set
    const codes = new Set(members.map((r) => String(r.part.code || "")));
    for (const row of [...members]) {
      const partnerCode = row.duoGroup?.partnerCode;
      if (!partnerCode || codes.has(partnerCode)) continue;
      const partner = byCode.get(partnerCode);
      if (!partner) continue;
      members.push(partner);
      codes.add(partnerCode);
    }
    if (members.length < 2) continue;

    // Clear lone Primary — both halves share Primary/duo highlight
    for (const row of sliced) row.isPrimary = false;

    for (const row of members) {
      const duo =
        row.duoGroup ||
        assemblyIndex.parentByCode.get(String(row.part.code || ""))?.duoGroup;
      if (!duo) continue;
      row.isPrimary = true;
      row.isDuoAssembly = true;
      row.duoRole = duo.role || null;
      row.duoLabel = duo.label || (duo.role === "top" ? "TOP" : "BTM");
      row.duoPartnerCode = duo.partnerCode || null;
      row.duoNeedBothNote =
        duo.needBothNote ||
        "Check if both TOP and BTM are required; if not, order the singular one";
      row.assemblyRank = Math.max(row.assemblyRank || 0, 4);
    }

    // Keep the duo at the top: TOP then BTM, then the rest
    const roleOrder = (r) =>
      r.duoRole === "top" ? 0 : r.duoRole === "bottom" ? 1 : 2;
    members.sort((a, b) => roleOrder(a) - roleOrder(b));
    const duoCodes = new Set(members.map((r) => String(r.part.code || "")));
    const rest = sliced.filter((r) => !duoCodes.has(String(r.part.code || "")));
    sliced.splice(0, sliced.length, ...members, ...rest);
  }
}

export function getModelLabel(model) {
  if (!model) return "";
  const sku = model.sku || model.marketingCode;
  return sku ? `${model.name} (${sku})` : model.name;
}

/**
 * Prefer marketing display names (HD200e / HD200i) when series or name implies them.
 * @param {object} model
 * @param {object|null} [series]
 */
export function getModelDisplayName(model, series = null) {
  if (!model) return "";
  const sku = String(model.sku || model.marketingCode || "");
  const name = String(model.name || model.description || "");
  const nameU = name.toUpperCase().replace(/\s+/g, "");

  const named =
    nameU.match(/\bHD(\d+)([EI])\b/) ||
    nameU.match(/HD(\d+)([EI])(?=[^A-Z]|$)/);
  if (named) {
    const label = `HD${named[1]}${named[2].toLowerCase()}`;
    return sku ? `${label} · ${sku}` : label;
  }

  if (series?.label && /^HD\d+[ei]$/i.test(series.label)) {
    return sku ? `${series.label} · ${sku}` : series.label;
  }

  const skuU = sku.toUpperCase();
  if (/^HD\d+I/.test(skuU)) {
    const n = skuU.match(/^HD(\d+)/)?.[1];
    if (n) return `HD${n}i · ${sku}`;
  }
  if (/^HD\d+E/.test(skuU)) {
    const n = skuU.match(/^HD(\d+)/)?.[1];
    if (n) return `HD${n}e · ${sku}`;
  }

  return getModelLabel(model);
}
