/* ============================================================================
   Domain model — normalization of the uploaded schema JSON into dedicated
   persistent collections. Every collection item carries a technical unique ID.
   ============================================================================ */

// ---- Technical ID generation ------------------------------------------------
// Compact, collision-resistant, human-friendly prefix ids: e.g. "sys_k3x9p2"
export function makeId(prefix, existing) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let key;
  do {
    key = '';
    const rnd = new Uint32Array(6);
    if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(rnd);
    else for (let i = 0; i < rnd.length; i++) rnd[i] = (Math.random() * 0xffffffff) >>> 0;
    for (let i = 0; i < rnd.length; i++) key += abc[rnd[i] % abc.length];
    key = `${prefix}_${key}`;
  } while (existing && existing.has(key));
  return key;
}

// Normalization helper: strip diacritics, lowercase, collapse whitespace.
export function normalizeLabel(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Canonical JSON string for the "rest" extension property of an item.
export function packRest(obj, keep, indent) {
  const rest = {};
  const keys = Object.keys(obj || {});
  for (const k of keys) if (!keep.includes(k)) rest[k] = obj[k];
  keys.sort ? null : null;
  return JSON.stringify(rest, Object.keys(rest).sort(), indent === undefined ? 0 : indent);
}

export function unpackRest(json) {
  try { return JSON.parse(json || '{}') || {}; } catch { return {}; }
}

// ---- Enum seed values from the provided schema ------------------------------
export const SEED = {
  ResponseType: ['SINGLE', 'TEXT', 'YES_NO', 'MULTI', 'CALLBACK', 'DICTIONARY_INCOMPLETE', 'DICTIONARY', 'PERSON_KYC'],
  SurveyType: ['RETAIL', 'PZK', 'CORPO', 'SME', 'AGRO', 'ACCOUNT'],
  Context: ['KYC', 'EDD', 'CALLBACK', 'PERSONAL'],
  ProcessContext: ['ONBOARDING', 'KYC', 'EDD', 'CALLBACK', 'BACKOFFICE', 'COMPLIANCE', 'AUDIT', 'SCREENING', 'PROFILING', 'ASSESSMENT', 'TECHNICAL', 'INVESTIGATION'],
};

const QUESTION_DESIGNATED = [
  'QuestionCode', 'QuestionLabel', 'QuestionLabelNorm', 'SurveyType', 'Context',
  'PersonalContext', 'SurveyCode', 'Notes', 'QuestionDescription', 'pp_code_question',
];

const OPTION_DESIGNATED = [
  'ResponseCode', 'ResponseDescription', 'ResponseDescriptionNorm',
  'ppRespCode', 'ResponseStart', 'ResponseEnd',
];

// ---- Model construction ------------------------------------------------------
/**
 * Builds a normalized System model from a parsed JSON array (schema format).
 * Returns { system, report } where report lists validation warnings.
 */
export function buildSystemModel(arrayData, systemName, opts = {}) {
  const report = { warnings: [], info: [], skippedSets: 0, groups: 0 };

  if (!Array.isArray(arrayData)) throw new Error('Root of the file must be a JSON array of question/response groups.');

  const ids = new Set();
  const uid = (p) => makeId(p, ids);

  // --- System (name, id) ---
  const system = {
    id: uid('sys'),
    name: (systemName || '').trim() || `System ${new Date().toISOString().slice(0, 10)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceFileName: opts.fileName || null,
    schemaTitle: 'System Survey Domain Model. Typed question and response set dictionary.',
    // dedicated collections
    ResponseTypes: [],      // ResponseType enum (name, id)
    SurveyTypes: [],        // SurveyType enum, unique name, relation to the system
    Contexts: [],           // Context enum, unique name, relation to the system
    ProcessContexts: [],    // ProcessContext (name, id)
    QuestionSets: [],       // each group in the file
    Questions: [],          // designated props + rest JSON + relations by id
    QuestionOptions: [],    // ResponseOptions items, own tech ids, parent QuestionSetId
    QuestionSurveyTypes: [], // question -> SurveyType ids
    QuestionContexts: [],    // question -> Context ids
    QuestionResponseTypes: [], // question -> ResponseType id
  };

  // --- ResponseType enum structure (name, id) — seeded from the schema ---
  for (const name of SEED.ResponseType) {
    system.ResponseTypes.push({ id: uid('rt'), name, isSeed: true });
  }

  // --- ProcessContext (name, id) — seeded from the schema ---
  for (const name of SEED.ProcessContext) {
    system.ProcessContexts.push({ id: uid('pc'), name, isSeed: true });
  }

  const surveyTypeByName = new Map();
  const contextByName = new Map();
  const responseTypeByName = new Map(system.ResponseTypes.map(e => [e.name, e]));

  const ensureSurveyType = (name) => {
    if (!surveyTypeByName.has(name)) {
      const item = { id: uid('st'), name, systemId: system.id };
      system.SurveyTypes.push(item);
      surveyTypeByName.set(name, item);
    }
    return surveyTypeByName.get(name);
  };
  const ensureContext = (name) => {
    if (!contextByName.has(name)) {
      const item = { id: uid('ctx'), name, systemId: system.id };
      system.Contexts.push(item);
      contextByName.set(name, item);
    }
    return contextByName.get(name);
  };
  const ensureResponseType = (name) => {
    if (!responseTypeByName.has(name)) {
      const item = { id: uid('rt'), name, isSeed: false };
      system.ResponseTypes.push(item);
      responseTypeByName.set(name, item);
      report.info.push(`ResponseType "${name}" is not in the schema enum; registered as a new enum entry.`);
    }
    return responseTypeByName.get(name);
  };

  // Seed the enum dictionaries so every (name,id) structure exists even when
  // the file does not use all values.
  for (const name of SEED.SurveyType) ensureSurveyType(name);
  for (const name of SEED.Context) ensureContext(name);

  // Pre-scan file for unknown enum names so dictionaries are complete
  // (also keeps SurveyTypes ordered: seeds first, then discovered).
  for (const g of arrayData) {
    if (!g || typeof g !== 'object') continue;
    if (g.ResponseType) ensureResponseType(String(g.ResponseType));
    const qs = Array.isArray(g.QuestionSet) ? g.QuestionSet : [];
    for (const q of qs) {
      if (Array.isArray(q?.SurveyType)) for (const v of q.SurveyType) if (v) ensureSurveyType(String(v));
      if (Array.isArray(q?.Context)) for (const v of q.Context) if (v) ensureContext(String(v));
    }
  }

  system.groups = arrayData.length;
  report.groups = arrayData.length;

  arrayData.forEach((group, gi) => {
    if (!group || typeof group !== 'object') {
      report.skippedSets++;
      report.warnings.push(`Group #${gi + 1}: not an object — skipped.`);
      return;
    }
    const options = Array.isArray(group.ResponseOptions) ? group.ResponseOptions : [];
    const questions = Array.isArray(group.QuestionSet) ? group.QuestionSet : [];

    if (!options.length && !questions.length) {
      report.skippedSets++;
      report.warnings.push(`Group #${gi + 1}: has neither ResponseOptions nor QuestionSet — skipped.`);
      return;
    }

    // --- QuestionSet: unique ID + System id ---
    const set = {
      id: uid('qs'),
      systemId: system.id,
      index: system.QuestionSets.length + 1,
      responseTypeRaw: group.ResponseType != null ? String(group.ResponseType) : null,
      responseTypeId: group.ResponseType != null ? ensureResponseType(String(group.ResponseType)).id : null,
      optionCount: options.length,
      questionCount: questions.length,
      restJson: packRest(group, ['ResponseOptions', 'QuestionSet', 'ResponseType']),
      createdAt: new Date().toISOString(),
    };
    system.QuestionSets.push(set);

    // --- QuestionOptions (ResponseOptions items) ---
    options.forEach((opt, oi) => {
      if (!opt || typeof opt !== 'object') {
        report.warnings.push(`Group #${gi + 1} option #${oi + 1}: not an object — skipped.`);
        return;
      }
      if (opt.ResponseCode == null || opt.ResponseDescription == null) {
        report.warnings.push(`Group #${gi + 1} option #${oi + 1}: missing ResponseCode or ResponseDescription — skipped.`);
        return;
      }
      system.QuestionOptions.push({
        id: uid('opt'),
        questionSetId: set.id,
        systemId: system.id,
        ResponseCode: opt.ResponseCode,
        ResponseDescription: String(opt.ResponseDescription ?? ''),
        ResponseDescriptionNorm: opt.ResponseDescriptionNorm != null ? String(opt.ResponseDescriptionNorm) : '',
        restJson: packRest(opt, OPTION_DESIGNATED),
      });
    });

    // --- Questions ---
    questions.forEach((q, qi) => {
      if (!q || typeof q !== 'object') {
        report.warnings.push(`Group #${gi + 1} question #${qi + 1}: not an object — skipped.`);
        return;
      }
      if (q.QuestionCode == null || q.QuestionLabel == null) {
        report.warnings.push(`Group #${gi + 1} question #${qi + 1}: missing QuestionCode or QuestionLabel — skipped.`);
        return;
      }
      const question = {
        id: uid('q'),
        systemId: system.id,
        questionSetId: set.id,
        QuestionCode: q.QuestionCode,
        QuestionLabel: String(q.QuestionLabel ?? ''),
        QuestionLabelNorm: q.QuestionLabelNorm != null ? String(q.QuestionLabelNorm) : '',
        SurveyCode: q.SurveyCode != null ? String(q.SurveyCode) : '',
        PersonalContext: q.PersonalContext != null ? String(q.PersonalContext) : '',
        Notes: Array.isArray(q.Notes) ? q.Notes : [],
        QuestionDescription: Array.isArray(q.QuestionDescription) ? q.QuestionDescription : [],
        pp_code_question: q.pp_code_question ?? null,
        restJson: packRest(q, QUESTION_DESIGNATED),
      };
      system.Questions.push(question);

      // --- Relations by id ---
      if (set.responseTypeId) {
        system.QuestionResponseTypes.push({ id: uid('qrt'), questionId: question.id, responseTypeId: set.responseTypeId });
      }
      const stVals = Array.isArray(q.SurveyType) ? q.SurveyType.filter(Boolean).map(String) : [];
      for (const v of new Set(stVals)) {
        system.QuestionSurveyTypes.push({ id: uid('qst'), questionId: question.id, surveyTypeId: ensureSurveyType(v).id });
      }
      const ctxVals = Array.isArray(q.Context) ? q.Context.filter(Boolean).map(String) : [];
      for (const v of new Set(ctxVals)) {
        system.QuestionContexts.push({ id: uid('qctx'), questionId: question.id, contextId: ensureContext(v).id });
      }
    });
  });

  if (!system.Questions.length && !system.QuestionOptions.length) {
    throw new Error('No valid questions or options found in the file.');
  }

  return { system, report };
}

// ---- Statistics --------------------------------------------------------------
export function computeStats(system) {
  const counts = {
    sets: system.QuestionSets.length,
    questions: system.Questions.length,
    options: system.QuestionOptions.length,
    surveyTypes: system.SurveyTypes.length,
    contexts: system.Contexts.length,
    responseTypes: system.ResponseTypes.length,
    processContexts: system.ProcessContexts.length,
    relations: system.QuestionSurveyTypes.length + system.QuestionContexts.length + system.QuestionResponseTypes.length,
  };
  const byResponseType = {};
  for (const set of system.QuestionSets) {
    const key = set.responseTypeRaw || '(none)';
    byResponseType[key] = byResponseType[key] || { sets: 0, questions: 0, options: 0 };
    byResponseType[key].sets++;
    byResponseType[key].questions += set.questionCount;
    byResponseType[key].options += set.optionCount;
  }
  const bySurveyType = {};
  for (const rel of system.QuestionSurveyTypes) {
    const st = system.SurveyTypes.find(s => s.id === rel.surveyTypeId);
    const key = st ? st.name : '?';
    bySurveyType[key] = (bySurveyType[key] || 0) + 1;
  }
  const byContext = {};
  for (const rel of system.QuestionContexts) {
    const c = system.Contexts.find(s => s.id === rel.contextId);
    const key = c ? c.name : '?';
    byContext[key] = (byContext[key] || 0) + 1;
  }
  const warnings = [];
  const seen = new Set();
  for (const q of system.Questions) {
    const k = String(q.QuestionCode);
    if (seen.has(k)) warnings.push(`Duplicate QuestionCode "${k}".`);
    seen.add(k);
  }
  for (const q of system.Questions) {
    if (!q.QuestionLabelNorm) warnings.push(`Question "${q.QuestionCode}" has no QuestionLabelNorm.`);
  }
  const optionsSeen = new Set();
  for (const o of system.QuestionOptions) {
    const k = o.questionSetId + '|' + String(o.ResponseCode);
    if (optionsSeen.has(k)) warnings.push(`Duplicate option code "${o.ResponseCode}" inside one question set.`);
    optionsSeen.add(k);
  }
  return { counts, byResponseType, bySurveyType, byContext, warnings: [...new Set(warnings)] };
}

// ---- Rebuild the original schema-format document from the model --------------
export function exportSystemDocument(system) {
  const groups = system.QuestionSets.map(set => {
    const options = system.QuestionOptions
      .filter(o => o.questionSetId === set.id)
      .map(o => {
        const base = {
          ResponseCode: o.ResponseCode,
          ResponseDescription: o.ResponseDescription,
          ResponseDescriptionNorm: o.ResponseDescriptionNorm,
        };
        return { ...unpackRest(o.restJson), ...base };
      });
    const questions = system.Questions
      .filter(q => q.questionSetId === set.id)
      .map(q => {
        const SurveyType = system.QuestionSurveyTypes
          .filter(r => r.questionId === q.id)
          .map(r => (system.SurveyTypes.find(s => s.id === r.surveyTypeId) || {}).name)
          .filter(Boolean);
        const Context = system.QuestionContexts
          .filter(r => r.questionId === q.id)
          .map(r => (system.Contexts.find(s => s.id === r.contextId) || {}).name)
          .filter(Boolean);
        const base = {
          QuestionCode: q.QuestionCode,
          QuestionLabel: q.QuestionLabel,
          QuestionLabelNorm: q.QuestionLabelNorm,
        };
        const out = { ...unpackRest(q.restJson), ...base };
        if (SurveyType.length) out.SurveyType = SurveyType;
        if (Context.length) out.Context = Context;
        if (q.SurveyCode) out.SurveyCode = q.SurveyCode;
        if (q.PersonalContext) out.PersonalContext = q.PersonalContext;
        if (q.Notes && q.Notes.length) out.Notes = q.Notes;
        if (q.QuestionDescription && q.QuestionDescription.length) out.QuestionDescription = q.QuestionDescription;
        if (q.pp_code_question != null) out.pp_code_question = q.pp_code_question;
        return out;
      });
    const out = JSON.parse(set.restJson || '{}');
    const rt = (system.ResponseTypes.find(r => r.id === set.responseTypeId) || {}).name;
    if (rt) out.ResponseType = rt;
    out.ResponseOptions = options;
    out.QuestionSet = questions;
    return out;
  });
  return groups;
}

// ---- Merge dictionaries when a System is edited ------------------------------
// Adds any enum values discovered in one system to a shared global dictionary.
export function mergeEnumIntoGlobal(globalDict, systemEnum, keyField, system) {
  for (const item of systemEnum) {
    const name = item.name;
    const found = globalDict.find(g => g.name === name);
    if (found) {
      found.systemIds = found.systemIds || [];
      if (!found.systemIds.includes(system.id)) found.systemIds.push(system.id);
    } else {
      globalDict.push({ id: item.id, name, systemIds: [system.id] });
    }
  }
  return globalDict;
}
