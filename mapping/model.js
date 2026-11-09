// Mapping model — ALIGNED with Survey Domain Studio's persistence model.
//
// Where the imported mappingModels project and this app's data model differ,
// THIS APP'S MODEL WINS:
//  • ResponseType enum comes from this app's schema (adds DICTIONARY,
//    DICTIONARY_INCOMPLETE; ENTITY_KYC is treated as an unknown-but-accepted value).
//  • Source/target models are normalized SYSTEMS from this app's persistence
//    layer (System / QuestionSet / Question / QuestionOption collections with
//    technical ids) — the mapper works on those ids and codes, never on raw JSON.
//  • Mappings are persisted with the same store pattern as Systems
//    (kv index + kv record), so both features share one storage model.

import { SEED } from '../domain.js';

// This app's ResponseType enum is the authority.
export const DEFAULT_TYPES = SEED.ResponseType;

// Values used by legacy mapping datasets that this app's schema does not define.
// They are surfaced in the UI but flagged so users can align them.
export const LEGACY_TYPES = ['ENTITY_KYC'];

const TYPE_META = {
  SINGLE: { label: 'Single', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  MULTI: { label: 'Multi', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  YES_NO: { label: 'Yes / No', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  TEXT: { label: 'Text', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
  CALLBACK: { label: 'Callback', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  DICTIONARY: { label: 'Dictionary', cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
  DICTIONARY_INCOMPLETE: { label: 'Dict (incomplete)', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  PERSON_KYC: { label: 'Person KYC', cls: 'bg-pink-50 text-pink-700 ring-pink-200' },
  ENTITY_KYC: { label: 'Entity KYC', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
export const typeMeta = (t) => TYPE_META[t] || { label: t || '—', cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200' };

export const MODE_META = {
  options: { label: 'Response mapping', icon: 'git-merge', desc: 'Each source answer is translated into zero or more target answers.' },
  toText: { label: 'Answer → free text', icon: 'type', desc: 'The description of the selected source answer is written into the target text field.' },
  toRef: { label: 'Answer → structured reference', icon: 'link', desc: 'Target expects a structured reference; the source answer needs a custom transformation.' },
  fromText: { label: 'Free text → fixed value', icon: 'pin', desc: 'Free-form source values cannot be translated automatically. A fallback answer is written instead.' },
  direct: { label: 'Direct copy', icon: 'copy', desc: 'The value is copied to the target question as-is.' },
};

/* ---------------- Validation (schema = this app's) ---------------- */

export function validateDataset(data, types = DEFAULT_TYPES) {
  const errors = [], warnings = [];
  if (data && !Array.isArray(data) && (data.$schema || data.type === 'array')) {
    errors.push('This file looks like the JSON Schema definition itself, not a survey dataset. Load a dataset that conforms to the schema.');
    return { errors, warnings };
  }
  if (!Array.isArray(data)) {
    errors.push('Root element must be an array of response-set groups.');
    return { errors, warnings };
  }
  if (data.length < 1) errors.push('Dataset must contain at least one response-set group.');
  data.forEach((g, i) => {
    const p = `Group #${i + 1}`;
    if (!g || typeof g !== 'object' || Array.isArray(g)) { errors.push(`${p}: must be an object.`); return; }
    if (!Array.isArray(g.ResponseOptions)) errors.push(`${p}: "ResponseOptions" array is required.`);
    if (!Array.isArray(g.QuestionSet) || g.QuestionSet.length < 1) errors.push(`${p}: "QuestionSet" must be a non-empty array.`);
    if (g.ResponseType !== undefined) {
      if (!types.includes(g.ResponseType)) {
        warnings.push(`${p}: unknown ResponseType "${g.ResponseType}"${LEGACY_TYPES.includes(g.ResponseType) ? ' (legacy mapping value — not in this schema)' : ''}.`);
      }
    }
    if (typeof g.count === 'number' && Array.isArray(g.QuestionSet) && g.count !== g.QuestionSet.length)
      warnings.push(`${p}: count is ${g.count} but QuestionSet has ${g.QuestionSet.length} entries.`);
    (Array.isArray(g.ResponseOptions) ? g.ResponseOptions : []).forEach((o, j) => {
      if (!o || o.ResponseCode === undefined || o.ResponseDescription === undefined)
        errors.push(`${p}, option #${j + 1}: "ResponseCode" and "ResponseDescription" are required.`);
    });
    (Array.isArray(g.QuestionSet) ? g.QuestionSet : []).forEach((q, j) => {
      if (!q || q.QuestionCode === undefined || q.QuestionLabel === undefined)
        errors.push(`${p}, question #${j + 1}: "QuestionCode" and "QuestionLabel" are required.`);
    });
  });
  return { errors: errors.slice(0, 60), warnings: warnings.slice(0, 60), more: errors.length > 60 };
}

/* ---------------- Normalisation into mapping datasets ----------------
   Accepts either this app's persisted SYSTEM model (preferred) or a raw
   schema-format array (aligned through the same collections first). */

function isSystemModel(x) {
  return !!(x && typeof x === 'object' && Array.isArray(x.QuestionSets) && Array.isArray(x.Questions) && x.id && x.id.startsWith('sys_'));
}

function isExpired(end) {
  if (!end) return false;
  const d = new Date(String(end).trim().replace(/\./g, '-'));
  return !isNaN(d) && d < new Date();
}

// Build a mapping dataset FROM THIS APP'S SYSTEM MODEL (priority path).
export function datasetFromSystem(system) {
  const groups = [], questions = [], byId = new Map(), codeCount = new Map();
  const rtName = (id) => { const r = (system.ResponseTypes || []).find((x) => x.id === id); return r ? r.name : null; };
  const surveyTypesOf = (qid) => system.QuestionSurveyTypes.filter((r) => r.questionId === qid)
    .map((r) => (system.SurveyTypes.find((s) => s.id === r.surveyTypeId) || {}).name).filter(Boolean);
  const contextsOf = (qid) => system.QuestionContexts.filter((r) => r.questionId === qid)
    .map((r) => (system.Contexts.find((c) => c.id === r.contextId) || {}).name).filter(Boolean);
  const unpack = (j) => { try { return JSON.parse(j || '{}') || {}; } catch { return {}; } };

  system.QuestionSets.forEach((set, gi) => {
    const options = [], keys = new Set();
    system.QuestionOptions.filter((o) => o.questionSetId === set.id).forEach((o) => {
      let key = String(o.ResponseCode);
      while (keys.has(key)) key += '*';
      keys.add(key);
      const rest = unpack(o.restJson);
      options.push({
        key, code: o.ResponseCode, desc: String(o.ResponseDescription ?? ''), norm: o.ResponseDescriptionNorm || '',
        pp: rest.ppRespCode, start: rest.ResponseStart || '', end: rest.ResponseEnd || '', expired: isExpired(rest.ResponseEnd), raw: { ResponseCode: o.ResponseCode, ResponseDescription: o.ResponseDescription, ResponseDescriptionNorm: o.ResponseDescriptionNorm, ...rest },
      });
    });
    const type = rtName(set.responseTypeId) || (options.length ? 'SINGLE' : 'TEXT');
    const group = { index: gi, id: set.id, type, options, optByKey: new Map(options.map((o) => [o.key, o])), qids: [] };
    system.Questions.filter((q) => q.questionSetId === set.id).forEach((q) => {
      const base = String(q.QuestionCode);
      const n = (codeCount.get(base) || 0) + 1;
      codeCount.set(base, n);
      const id = n > 1 ? `${base}#${n}` : base;
      const raw = {
        QuestionCode: q.QuestionCode, QuestionLabel: q.QuestionLabel, QuestionLabelNorm: q.QuestionLabelNorm,
        SurveyType: surveyTypesOf(q.id), Context: contextsOf(q.id), PersonalContext: q.PersonalContext || undefined,
        SurveyCode: q.SurveyCode || undefined, Notes: q.Notes && q.Notes.length ? q.Notes : undefined,
        QuestionDescription: q.QuestionDescription && q.QuestionDescription.length ? q.QuestionDescription : undefined,
        pp_code_question: q.pp_code_question ?? undefined,
        ...unpack(q.restJson),
      };
      const item = {
        id, code: q.QuestionCode, label: String(q.QuestionLabel ?? ''), norm: q.QuestionLabelNorm || '',
        type, group, options, optByKey: group.optByKey, raw, techId: q.id,
      };
      item.tok = tokens(`${item.norm} ${item.label}`);
      item.tokNorm = tokens(item.norm || item.label);
      item.tokLabel = tokens(item.label);
      questions.push(item);
      byId.set(id, item);
      group.qids.push(id);
    });
    groups.push(group);
  });
  return { name: system.name, systemId: system.id, groups, questions, byId, fromSystem: true };
}

export const hasOptions = (q) => q.options.length > 0;

/* ---------------- Similarity ---------------- */

const STOP = new Set(['the', 'of', 'a', 'an', 'on', 'in', 'to', 'is', 'for', 'and', 'or', 'by', 'with', 'does', 'do', 'are', 'be', 'as', 'at', 'from', 'this', 'that', 'client', 'customer']);
const SYN = { tak: 'yes', nie: 'no', true: 'yes', false: 'no', y: 'yes', n: 'no', pensioner: 'retire', retirement: 'retire', retired: 'retire', pension: 'retire', employee: 'employ', employment: 'employ', employed: 'employ', salary: 'employ', entrepreneur: 'business', entrepreneurship: 'business', company: 'business' };

function stem(t) {
  if (SYN[t]) return SYN[t];
  if (t.length > 5) return t.replace(/(ations|ation|ments|ment|ings|ing|ies|ed|es|s)$/, '');
  return t;
}
export function tokens(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).map(stem).filter((t) => t.length > 1 || /\d/.test(t));
}
export function dice(a, b) {
  const A = a instanceof Set ? a : new Set(a), B = b instanceof Set ? b : new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((x) => { if (B.has(x)) n++; });
  return (2 * n) / (A.size + B.size);
}

export function questionScore(sq, tq) {
  let s = Math.max(dice(sq.tokNorm, tq.tokNorm), dice(sq.tokLabel, tq.tokLabel) * 0.95, dice(sq.tok, tq.tok) * 0.9);
  const so = hasOptions(sq), to = hasOptions(tq);
  if (sq.type === tq.type) s += 0.08;
  else if (so && to) s += 0.04;
  else if (so !== to) s -= 0.1;
  return Math.max(0, Math.min(1, s));
}

export function optionScore(a, b) {
  const da = a.desc.trim().toLowerCase(), db = b.desc.trim().toLowerCase();
  if (da && da === db) return 1;
  return Math.max(
    a.norm && b.norm ? dice(tokens(a.norm), tokens(b.norm)) : 0,
    dice(tokens(a.desc), tokens(b.desc)) * 0.95,
    dice(tokens(`${a.norm} ${a.desc}`), tokens(`${b.norm} ${b.desc}`)) * 0.85,
  );
}

export function autoMatchOptions(sq, tq, threshold = 0.5) {
  const out = {};
  if (!hasOptions(sq) || !hasOptions(tq)) return out;
  sq.options.forEach((so) => {
    let best = null, bs = 0;
    tq.options.forEach((to) => {
      const sc = optionScore(so, to) - (to.expired ? 0.05 : 0);
      if (sc > bs) { bs = sc; best = to; }
    });
    if (best && bs >= threshold) out[so.key] = [best.key];
  });
  return out;
}

export function suggestLinks(src, tgt, links, min = 0.35) {
  const linked = new Set(links.map((l) => l.s));
  const pairs = new Set(links.map((l) => `${l.s}\u0000${l.t}`));
  const out = [];
  src.questions.forEach((sq) => {
    if (linked.has(sq.id)) return;
    let best = null, bs = 0;
    tgt.questions.forEach((tq) => {
      if (pairs.has(`${sq.id}\u0000${tq.id}`)) return;
      const sc = questionScore(sq, tq);
      if (sc > bs) { bs = sc; best = tq; }
    });
    if (best && bs >= min) out.push({ s: sq.id, t: best.id, score: bs });
  });
  return out.sort((a, b) => b.score - a.score);
}

export function similarQuestions(q, other, exclude, n = 3) {
  return other.questions.filter((o) => !exclude.has(o.id))
    .map((o) => ({ q: o, score: questionScore(q, o) }))
    .filter((x) => x.score > 0.2).sort((a, b) => b.score - a.score).slice(0, n);
}

/* ---------------- Link analysis ---------------- */

export function linkInfo(link, sq, tq) {
  const warnings = [];
  const so = hasOptions(sq), to = hasOptions(tq);
  const fallback = link.fallback || [];
  let mode, total = 0, mapped = 0;
  if (so && to) {
    mode = 'options';
    total = sq.options.length;
    mapped = sq.options.filter((o) => (link.opt[o.key] || []).length).length;
    if (tq.type !== 'MULTI') {
      const multi = sq.options.filter((o) => (link.opt[o.key] || []).length > 1).length;
      if (multi) warnings.push(`${multi} source answer${multi > 1 ? 's map' : ' maps'} to several values, but the target accepts a single answer.`);
      if (sq.type === 'MULTI') warnings.push('Source allows multiple answers but the target accepts one — conflicting values need a resolution rule.');
    }
    if (mapped < total && !fallback.length) warnings.push(`${total - mapped} of ${total} source answers are unmapped and no fallback is set.`);
    const usedExpired = new Set();
    Object.values(link.opt).flat().concat(fallback).forEach((k) => { const o = tq.optByKey.get(k); if (o?.expired) usedExpired.add(o.desc); });
    if (usedExpired.size) warnings.push(`Mapped to expired target answer${usedExpired.size > 1 ? 's' : ''}: ${[...usedExpired].join(', ')}.`);
  } else if (so && !to) {
    mode = tq.type === 'TEXT' ? 'toText' : 'toRef';
    if (mode === 'toRef') warnings.push(`Target type ${tq.type} expects a structured reference — define a custom transformation in the note.`);
  } else if (!so && to) {
    mode = 'fromText';
    if (!fallback.length) warnings.push('Free-form source values cannot be mapped automatically. Choose a fallback answer.');
  } else {
    mode = 'direct';
    if (sq.type !== tq.type) warnings.push(`Different value types (${sq.type} → ${tq.type}); verify the transformation.`);
  }
  let status = warnings.length ? 'warn' : 'ok';
  if (mode === 'options' && mapped === 0 && !fallback.length) status = 'empty';
  return { mode, total, mapped, warnings, status };
}

/* ---------------- Export / import ---------------- */

export function buildMapping(S) {
  return {
    format: 'survey-migration-mapping',
    version: 1,
    name: S.name,
    exportedAt: new Date().toISOString(),
    source: { name: S.src?.name || null, systemId: S.src?.systemId || null, questions: S.src?.questions.length || 0 },
    target: { name: S.tgt?.name || null, systemId: S.tgt?.systemId || null, questions: S.tgt?.questions.length || 0 },
    mappings: S.links.map((l) => {
      const sq = S.src.byId.get(l.s), tq = S.tgt.byId.get(l.t);
      const info = linkInfo(l, sq, tq);
      const codes = (keys) => (keys || []).map((k) => tq.optByKey.get(k)?.code).filter((v) => v !== undefined);
      return {
        sourceQuestion: sq.code, sourceLabel: sq.label, sourceType: sq.type,
        targetQuestion: tq.code, targetLabel: tq.label, targetType: tq.type,
        mode: info.mode, status: info.status,
        responses: sq.options.map((o) => ({ sourceCode: o.code, sourceDescription: o.desc, targetCodes: codes(l.opt[o.key]) })),
        fallbackCodes: codes(l.fallback),
        ...(info.mode === 'toText' ? { textValue: l.textMode || 'desc' } : {}),
        note: l.note || '',
      };
    }),
  };
}

const findQ = (ds, code) => ds.byId.get(String(code)) || ds.questions.find((q) => String(q.code) === String(code));
const findOpt = (q, code) => q.options.find((o) => String(o.code) === String(code))?.key;

export function applyMapping(json, src, tgt, nextId) {
  const links = [];
  let skipped = 0;
  (json.mappings || []).forEach((m) => {
    const sq = findQ(src, m.sourceQuestion), tq = findQ(tgt, m.targetQuestion);
    if (!sq || !tq) { skipped++; return; }
    if (links.some((l) => l.s === sq.id && l.t === tq.id)) return;
    const opt = {};
    (m.responses || []).forEach((r) => {
      const sk = findOpt(sq, r.sourceCode);
      if (sk === undefined) return;
      const tks = (r.targetCodes || []).map((c) => findOpt(tq, c)).filter((k) => k !== undefined);
      if (tks.length) opt[sk] = tks;
    });
    const fallback = (m.fallbackCodes || []).map((c) => findOpt(tq, c)).filter((k) => k !== undefined);
    links.push({ id: nextId(), s: sq.id, t: tq.id, opt, fallback, note: m.note || '', ...(m.textValue ? { textMode: m.textValue } : {}) });
  });
  return { links, skipped };
}

export function tableRows(S) {
  const rows = [];
  S.links.forEach((l) => {
    const sq = S.src.byId.get(l.s), tq = S.tgt.byId.get(l.t);
    const info = linkInfo(l, sq, tq);
    const base = { link: l, sq, tq, info, sCode: sq.code, sLabel: sq.label, tCode: tq.code, tLabel: tq.label, mode: MODE_META[info.mode].label };
    const fb = (l.fallback || []).map((k) => tq.optByKey.get(k)).filter(Boolean);
    if (info.mode === 'options') {
      sq.options.forEach((o) => {
        const ts = (l.opt[o.key] || []).map((k) => tq.optByKey.get(k)).filter(Boolean);
        if (!ts.length) rows.push({ ...base, sAns: o, tAns: fb[0] || null, viaFallback: !!fb.length });
        ts.forEach((t) => rows.push({ ...base, sAns: o, tAns: t }));
      });
    } else if (info.mode === 'toText') {
      sq.options.forEach((o) => rows.push({ ...base, sAns: o, tAns: { code: '', desc: `“${textValue(o, l.textMode)}”` } }));
    } else if (info.mode === 'fromText') {
      rows.push({ ...base, sAns: { code: '', desc: '(any text)' }, tAns: fb[0] || null, viaFallback: true });
    } else {
      rows.push({ ...base, sAns: { code: '', desc: '(value)' }, tAns: { code: '', desc: '(same value)' } });
    }
  });
  return rows;
}

export function textValue(o, mode = 'desc') {
  if (mode === 'code') return String(o.code);
  if (mode === 'both') return `${o.code} – ${o.desc}`;
  return o.desc;
}

export function toCSV(rows) {
  const head = ['Source question', 'Source label', 'Source answer code', 'Source answer', 'Target question', 'Target label', 'Target answer code', 'Target answer', 'Mode', 'Note'];
  const q = (v) => { const s = String(v ?? ''); return(/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s); };
  const lines = [head.map(q).join(',')];
  rows.forEach((r) => lines.push([
    r.sCode, r.sLabel, r.sAns?.code, r.sAns?.desc, r.tCode, r.tLabel, r.tAns?.code ?? '', r.tAns ? r.tAns.desc + (r.viaFallback ? ' (fallback)' : '') : '(unmapped)', r.mode, r.link.note,
  ].map(q).join(',')));
  return lines.join('\n');
}
