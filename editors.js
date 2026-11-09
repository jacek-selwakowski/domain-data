/* ============================================================================
   Editors — slide-over panel for Question / QuestionOption / QuestionSet /
   System meta editing
   ============================================================================ */
import { packRest, unpackRest, makeId, normalizeLabel } from './domain.js';
import { $, $$, h, esc, toast, refreshIcons, confirmDialog } from './ui.js';

const QUESTION_DESIGNATED = [
  'QuestionCode', 'QuestionLabel', 'QuestionLabelNorm', 'SurveyType', 'Context',
  'PersonalContext', 'SurveyCode', 'Notes', 'QuestionDescription', 'pp_code_question',
];
const OPTION_DESIGNATED = [
  'ResponseCode', 'ResponseDescription', 'ResponseDescriptionNorm',
  'ppRespCode', 'ResponseStart', 'ResponseEnd',
];

function field(label, inputHtml, hint) {
  return `<div>
    <label class="fld">${label}</label>
    ${inputHtml}
    ${hint ? `<p class="text-xs text-gray-400 mt-1.5">${hint}</p>` : ''}
  </div>`;
}

function kvEditor(id, rows) {
  return `<div id="${id}" class="space-y-2">
    ${rows.map(r => `<div class="flex gap-2 items-start kvrow">
      <input class="input flex-1 kv-key" placeholder="key (e.g. Doradca)" value="${esc(r.key)}">
      <input class="input flex-[2] kv-val" placeholder="value" value="${esc(r.value)}">
      <button class="btn btn-ghost btn-sm mt-0.5 kv-del" type="button"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    </div>`).join('') || '<div class="text-xs text-gray-400">No entries.</div>'}
    <button class="btn btn-ghost btn-sm kv-add" type="button"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add entry</button>
  </div>`;
}

function linesEditor(id, lines) {
  return `<div id="${id}" class="space-y-2">
    ${lines.map(l => `<div class="flex gap-2 items-start lnrow">
      <input class="input flex-1 ln-val" placeholder="note text" value="${esc(l)}">
      <button class="btn btn-ghost btn-sm mt-0.5 ln-del" type="button"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    </div>`).join('') || '<div class="text-xs text-gray-400">No notes.</div>'}
    <button class="btn btn-ghost btn-sm ln-add" type="button"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add note</button>
  </div>`;
}

export class Editor {
  constructor(app) {
    this.app = app;
    this.mode = null; // 'question' | 'option' | 'set' | 'system'
    this.item = null;
    this.onSave = null;

    const closeBtn = $('#btnCloseEditor');
    const backdrop = $('#editorBackdrop');
    const cancelBtn = $('#btnCancelEditor');
    const saveBtn = $('#btnSaveEditor');
    if (closeBtn) closeBtn.onclick = () => this.close();
    if (backdrop) backdrop.onclick = () => this.close();
    if (cancelBtn) cancelBtn.onclick = () => this.close();
    if (saveBtn) saveBtn.onclick = () => this.commit();
  }

  open(mode, item, { title, sub, icon, onSave, onDelete }) {
    this.mode = mode;
    this.item = item;
    this.onSave = onSave;
    this.onDelete = onDelete;

    $('#editorTitle').textContent = title;
    $('#editorSub').textContent = sub;
    $('#editorIcon').innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i>`;

    const overlay = $('#editorOverlay');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    refreshIcons();
  }

  close() {
    $('#editorOverlay').classList.add('hidden');
    document.body.style.overflow = '';
    this.mode = null; this.item = null; this.onSave = null; this.onDelete = null;
  }

  form() { return $('#editorForm'); }

  bindListButtons(scopeSel) {
    const scope = $(scopeSel);
    if (!scope) return;
    scope.querySelectorAll('.kv-add').forEach(b => b.onclick = () => {
      const row = h(`<div class="flex gap-2 items-start kvrow">
        <input class="input flex-1 kv-key" placeholder="key">
        <input class="input flex-[2] kv-val" placeholder="value">
        <button class="btn btn-ghost btn-sm mt-0.5 kv-del" type="button"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
      </div>`);
      const empty = scope.querySelector('.kvrow') ? null : scope.querySelector('.text-xs.text-gray-400');
      if (empty) empty.remove();
      scope.insertBefore(row, b);
      this.bindListButtons(scopeSel);
      refreshIcons();
    });
    scope.querySelectorAll('.kv-del').forEach(b => b.onclick = () => b.closest('.kvrow').remove());
    scope.querySelectorAll('.ln-add').forEach(b => b.onclick = () => {
      const row = h(`<div class="flex gap-2 items-start lnrow">
        <input class="input flex-1 ln-val" placeholder="note text">
        <button class="btn btn-ghost btn-sm mt-0.5 ln-del" type="button"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
      </div>`);
      const empty = scope.querySelector('.lnrow') ? null : scope.querySelector('.text-xs.text-gray-400');
      if (empty) empty.remove();
      scope.insertBefore(row, b);
      this.bindListButtons(scopeSel);
      refreshIcons();
    });
    scope.querySelectorAll('.ln-del').forEach(b => b.onclick = () => b.closest('.lnrow').remove());
  }

  readKv(scopeSel) {
    return $$(scopeSel + ' .kvrow').map(r => {
      const key = r.querySelector('.kv-key').value.trim();
      const value = r.querySelector('.kv-val').value;
      return { key, value };
    }).filter(x => x.key);
  }
  readLines(scopeSel) {
    return $$(scopeSel + ' .lnrow').map(r => r.querySelector('.ln-val').value).filter(x => x.trim());
  }

  async commit() {
    if (this.onSave) {
      try {
        await this.onSave();
        this.close();
      } catch (e) {
        toast(e.message || 'Could not save', 'err');
      }
    }
  }

  async remove() {
    if (this.onDelete) {
      if (!(await confirmDialog('Delete this item?'))) return;
      try {
        await this.onDelete();
        this.close();
      } catch (e) {
        toast(e.message || 'Could not delete', 'err');
      }
    }
  }

  // ================= QUESTION =================
  editQuestion(q, system) {
    const mv = this.app.modelView;
    const sts = system.SurveyTypes;
    const ctxs = system.Contexts;
    const sets = system.QuestionSets;
    const qStIds = new Set(mv.surveyTypesOf(q).map(x => x.id));
    const qCtxIds = new Set(mv.contextsOf(q).map(x => x.id));

    const rest = unpackRest(q.restJson);

    this.form().innerHTML = `
      <div class="grid grid-cols-2 gap-4">
        ${field('QuestionCode', `<input id="f_code" class="input font-mono" value="${esc(q.QuestionCode)}">`)}
        ${field('SurveyCode', `<input id="f_surveycode" class="input" value="${esc(q.SurveyCode || '')}" placeholder="e.g. KYC_PZK">`)}
      </div>
      ${field('QuestionLabel', `<textarea id="f_label" rows="2" class="input">${esc(q.QuestionLabel)}</textarea>`)}
      ${field('QuestionLabelNorm', `<textarea id="f_labelnorm" rows="2" class="input">${esc(q.QuestionLabelNorm || '')}</textarea>`, 'Embedding-oriented normalized subject. Empty value can be generated from the label.')}
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-ghost btn-sm" id="f_genNorm" type="button"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i>Generate norm from label</button>
        <button class="btn btn-danger btn-sm ml-auto" id="f_delQuestion" type="button"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete question</button>
      </div>
      <div>
        <label class="fld">Question set</label>
        <select id="f_set" class="input">${sets.map(s => `<option value="${s.id}" ${s.id === q.questionSetId ? 'selected' : ''}>#${s.index} · ${esc(mv.responseTypeName(s.responseTypeId) || 'no type')} · ${s.questionCount}q/${s.optionCount}o</option>`).join('')}</select>
        <p class="text-xs text-gray-400 mt-1.5">Moving the question reassigns its response type relation.</p>
      </div>
      <div>
        <label class="fld">SurveyTypes <span class="normal-case text-gray-400 font-normal">· relation by id</span></label>
        <div class="grid grid-cols-2 gap-1.5" id="f_sts">
          ${sts.map(s => `<label class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" class="rounded accent-indigo-600" value="${s.id}" ${qStIds.has(s.id) ? 'checked' : ''}>
            <span>${esc(s.name)}</span></label>`).join('')}
        </div>
      </div>
      <div>
        <label class="fld">Contexts <span class="normal-case text-gray-400 font-normal">· relation by id</span></label>
        <div class="grid grid-cols-2 gap-1.5" id="f_ctxs">
          ${ctxs.map(c => `<label class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
            <input type="checkbox" class="rounded accent-indigo-600" value="${c.id}" ${qCtxIds.has(c.id) ? 'checked' : ''}>
            <span>${esc(c.name)}</span></label>`).join('')}
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${field('PersonalContext', `<select id="f_personal" class="input">
          <option value="">—</option>
          <option value="true" ${q.PersonalContext === 'true' ? 'selected' : ''}>true</option>
          <option value="false" ${q.PersonalContext === 'false' ? 'selected' : ''}>false</option>
        </select>`)}
        ${field('pp_code_question', `<input id="f_ppq" class="input" value="${esc(q.pp_code_question ?? '')}">`, 'RDS legacy code, optional.')}
      </div>
      ${field('Notes', linesEditor('f_notes', q.Notes || []))}
      ${field('QuestionDescription', kvEditor('f_desc', q.QuestionDescription || []), 'Keyed description entries, e.g. [Doradca], [Infotip_PL].')}
      <details class="rounded-lg border border-gray-200 overflow-hidden" ${Object.keys(rest).length ? '' : ''}>
        <summary class="px-4 py-2.5 text-sm font-medium cursor-pointer bg-gray-50 select-none">Rest properties (JSON) — ${Object.keys(rest).length}</summary>
        <textarea id="f_rest" rows="6" class="w-full font-mono text-xs p-3 border-t border-gray-200 focus:outline-none">${esc(JSON.stringify(rest, null, 2))}</textarea>
      </details>
      <div class="text-[11px] text-gray-400 mono">${esc(q.id)}</div>
    `;

    this.open('question', q, {
      title: 'Edit question',
      sub: `${q.QuestionCode}`,
      icon: 'pencil',
      onSave: async () => {
        const code = $('#f_code').value.trim();
        const label = $('#f_label').value.trim();
        if (!code) throw new Error('QuestionCode is required.');
        if (!label) throw new Error('QuestionLabel is required.');
        q.QuestionCode = code;
        q.QuestionLabel = label;
        q.QuestionLabelNorm = $('#f_labelnorm').value.trim();
        q.SurveyCode = $('#f_surveycode').value.trim();
        q.PersonalContext = $('#f_personal').value;
        q.pp_code_question = $('#f_ppq').value === '' ? null : $('#f_ppq').value;
        q.Notes = this.readLines('#f_notes');
        q.QuestionDescription = this.readKv('#f_desc');
        let restObj = {};
        try { restObj = JSON.parse($('#f_rest').value || '{}'); } catch { throw new Error('Rest properties must be valid JSON.'); }
        if (typeof restObj !== 'object' || Array.isArray(restObj)) throw new Error('Rest properties must be a JSON object.');
        q.restJson = JSON.stringify(restObj);

        // set membership
        const newSetId = $('#f_set').value;
        if (newSetId !== q.questionSetId) {
          q.questionSetId = newSetId;
          const set = system.QuestionSets.find(s => s.id === newSetId);
          // rebuild response type relation rows
          system.QuestionResponseTypes = system.QuestionResponseTypes.filter(r => r.questionId !== q.id);
          if (set && set.responseTypeId) {
            system.QuestionResponseTypes.push({ id: makeId('qrt', new Set(system.QuestionResponseTypes.map(r => r.id))), questionId: q.id, responseTypeId: set.responseTypeId });
          }
        }

        // relations
        const selSt = new Set($$('#f_sts input:checked').map(i => i.value));
        const selCtx = new Set($$('#f_ctxs input:checked').map(i => i.value));
        system.QuestionSurveyTypes = system.QuestionSurveyTypes.filter(r => r.questionId !== q.id);
        system.QuestionContexts = system.QuestionContexts.filter(r => r.questionId !== q.id);
        for (const id of selSt) system.QuestionSurveyTypes.push({ id: makeId('qst', new Set(system.QuestionSurveyTypes.map(r => r.id))), questionId: q.id, surveyTypeId: id });
        for (const id of selCtx) system.QuestionContexts.push({ id: makeId('qctx', new Set(system.QuestionContexts.map(r => r.id))), questionId: q.id, contextId: id });

        await this.app.persistEditedSystem();
        toast('Question saved');
      },
      onDelete: async () => {
        system.Questions = system.Questions.filter(x => x.id !== q.id);
        system.QuestionSurveyTypes = system.QuestionSurveyTypes.filter(r => r.questionId !== q.id);
        system.QuestionContexts = system.QuestionContexts.filter(r => r.questionId !== q.id);
        system.QuestionResponseTypes = system.QuestionResponseTypes.filter(r => r.questionId !== q.id);
        const set = system.QuestionSets.find(s => s.id === q.questionSetId);
        if (set) set.questionCount = Math.max(0, system.Questions.filter(x => x.questionSetId === set.id).length);
        await this.app.persistEditedSystem();
        toast('Question deleted', 'warn');
      },
    });

    $('#f_genNorm').onclick = () => { $('#f_labelnorm').value = normalizeLabel($('#f_label').value); };
    $('#f_delQuestion').onclick = () => this.remove();
    this.bindListButtons('#f_notes');
    this.bindListButtons('#f_desc');
    refreshIcons();
  }

  // ================= QUESTION OPTION =================
  editOption(opt, system) {
    const isNew = !opt;
    const set = system.QuestionSets.find(s => s.id === (opt ? opt.questionSetId : this.app._addOptSetId));
    if (isNew) {
      opt = {
        id: makeId('opt', new Set(system.QuestionOptions.map(o => o.id))),
        questionSetId: this.app._addOptSetId,
        systemId: system.id,
        ResponseCode: '',
        ResponseDescription: '',
        ResponseDescriptionNorm: '',
        restJson: '{}',
      };
    }
    const rest = unpackRest(opt.restJson);

    this.form().innerHTML = `
      <div class="rounded-lg bg-indigo-50/60 border border-indigo-100 px-4 py-3 text-xs text-indigo-900">
        <span class="font-semibold">Question set #${set ? set.index : '?'} · ${esc(set ? this.app.modelView.responseTypeName(set.responseTypeId) : '')}</span>
        <span class="mono ml-2">${esc(set ? set.id : '')}</span>
      </div>
      <div class="grid grid-cols-2 gap-4">
        ${field('ResponseCode', `<input id="o_code" class="input font-mono" value="${esc(opt.ResponseCode)}">`)}
        ${field('ppRespCode', `<input id="o_pp" class="input" value="${esc(unpackRest(opt.restJson).ppRespCode ?? '')}">`, 'RDS legacy answer code, optional.')}
      </div>
      ${field('ResponseDescription', `<textarea id="o_desc" rows="2" class="input">${esc(opt.ResponseDescription)}</textarea>`)}
      ${field('ResponseDescriptionNorm', `<textarea id="o_norm" rows="2" class="input">${esc(opt.ResponseDescriptionNorm || '')}</textarea>`)}
      ${!isNew ? `<button class="btn btn-danger btn-sm" id="o_del" type="button"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete option</button>` : ''}
      <div class="grid grid-cols-2 gap-4">
        ${field('ResponseStart', `<input id="o_start" class="input" value="${esc(unpackRest(opt.restJson).ResponseStart ?? '')}" placeholder="2016.07.17">`, 'RDS validity start.')}
        ${field('ResponseEnd', `<input id="o_end" class="input" value="${esc(unpackRest(opt.restJson).ResponseEnd ?? '')}" placeholder="empty = still valid">`, 'RDS validity end.')}
      </div>
      <details class="rounded-lg border border-gray-200 overflow-hidden">
        <summary class="px-4 py-2.5 text-sm font-medium cursor-pointer bg-gray-50 select-none">Rest properties (JSON) — ${Object.keys(rest).length}</summary>
        <textarea id="o_rest" rows="6" class="w-full font-mono text-xs p-3 border-t border-gray-200 focus:outline-none">${esc(JSON.stringify(rest, null, 2))}</textarea>
      </details>
      <div class="text-[11px] text-gray-400 mono">${esc(opt.id)}</div>
    `;

    this.open('option', opt, {
      title: isNew ? 'Add response option' : 'Edit response option',
      sub: set ? `Question set #${set.index}` : '',
      icon: 'circle-dot',
      onSave: async () => {
        const code = $('#o_code').value.trim();
        const desc = $('#o_desc').value.trim();
        if (code === '') throw new Error('ResponseCode is required.');
        if (!desc) throw new Error('ResponseDescription is required.');
        const existing = system.QuestionOptions.find(o => o.questionSetId === opt.questionSetId && String(o.ResponseCode) === code && o.id !== opt.id);
        if (existing) throw new Error(`An option with code "${code}" already exists in this set.`);
        opt.ResponseCode = code;
        opt.ResponseDescription = desc;
        opt.ResponseDescriptionNorm = $('#o_norm').value.trim();
        let restObj = {};
        try { restObj = JSON.parse($('#o_rest').value || '{}'); } catch { throw new Error('Rest properties must be valid JSON.'); }
        const pp = $('#o_pp').value.trim();
        const start = $('#o_start').value.trim();
        const end = $('#o_end').value.trim();
        if (pp !== '') restObj.ppRespCode = pp;
        else delete restObj.ppRespCode;
        if (start !== '') restObj.ResponseStart = start; else delete restObj.ResponseStart;
        if (end !== '') restObj.ResponseEnd = end; else delete restObj.ResponseEnd;
        opt.restJson = JSON.stringify(restObj);
        if (isNew) {
          system.QuestionOptions.push(opt);
          if (set) set.optionCount = system.QuestionOptions.filter(o => o.questionSetId === set.id).length;
        }
        await this.app.persistEditedSystem();
        toast(isNew ? 'Option added' : 'Option saved');
      },
      onDelete: isNew ? null : async () => {
        system.QuestionOptions = system.QuestionOptions.filter(o => o.id !== opt.id);
        if (set) set.optionCount = system.QuestionOptions.filter(o => o.questionSetId === set.id).length;
        await this.app.persistEditedSystem();
        toast('Option deleted', 'warn');
      },
    });
    if (!isNew) $('#o_del').onclick = () => this.remove();
    refreshIcons();
  }

  // ================= QUESTION SET =================
  editQuestionSet(set, system) {
    const mv = this.app.modelView;
    const rts = system.ResponseTypes;
    const rest = unpackRest(set.restJson);

    this.form().innerHTML = `
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="fld">Index</label>
          <div class="input bg-gray-50">#${set.index}</div>
        </div>
        ${field('ResponseType relation', `<select id="s_rt" class="input">${rts.map(r => `<option value="${r.id}" ${r.id === set.responseTypeId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`, 'Links every question in this set to the ResponseType by id.')}
      </div>
      <div class="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
        <div class="px-4 py-3 flex justify-between"><span class="text-gray-500">Technical id</span><span class="mono">${esc(set.id)}</span></div>
        <div class="px-4 py-3 flex justify-between"><span class="text-gray-500">System id</span><span class="mono">${esc(set.systemId)}</span></div>
        <div class="px-4 py-3 flex justify-between"><span class="text-gray-500">Questions</span><span class="tabular-nums">${set.questionCount}</span></div>
        <div class="px-4 py-3 flex justify-between"><span class="text-gray-500">Response options</span><span class="tabular-nums">${set.optionCount}</span></div>
      </div>
      <details class="rounded-lg border border-gray-200 overflow-hidden">
        <summary class="px-4 py-2.5 text-sm font-medium cursor-pointer bg-gray-50 select-none">Rest properties (JSON) — ${Object.keys(rest).length}</summary>
        <textarea id="s_rest" rows="6" class="w-full font-mono text-xs p-3 border-t border-gray-200 focus:outline-none">${esc(JSON.stringify(rest, null, 2))}</textarea>
      </details>
      <div class="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <div class="text-sm font-semibold text-red-700 mb-1">Danger zone</div>
        <p class="text-xs text-red-600/80 mb-3">Deleting this set removes its ${set.questionCount} question(s) and ${set.optionCount} option(s).</p>
        <button id="s_delete" class="btn btn-danger btn-sm"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete question set</button>
      </div>
    `;

    this.open('set', set, {
      title: `Edit question set #${set.index}`,
      sub: mv.responseTypeName(set.responseTypeId) || 'no response type',
      icon: 'layers',
      onSave: async () => {
        const newRtId = $('#s_rt').value;
        let restObj = {};
        try { restObj = JSON.parse($('#s_rest').value || '{}'); } catch { throw new Error('Rest properties must be valid JSON.'); }
        if (typeof restObj !== 'object' || Array.isArray(restObj)) throw new Error('Rest properties must be a JSON object.');
        set.restJson = JSON.stringify(restObj);
        if (newRtId !== set.responseTypeId) {
          set.responseTypeId = newRtId;
          set.responseTypeRaw = (rts.find(r => r.id === newRtId) || {}).name || null;
          for (const q of system.Questions.filter(x => x.questionSetId === set.id)) {
            system.QuestionResponseTypes = system.QuestionResponseTypes.filter(r => r.questionId !== q.id);
            system.QuestionResponseTypes.push({ id: makeId('qrt', new Set(system.QuestionResponseTypes.map(r => r.id))), questionId: q.id, responseTypeId: newRtId });
          }
        }
        await this.app.persistEditedSystem();
        toast('Question set saved');
      },
    });

    $('#s_delete').onclick = async () => {
      const qIds = new Set(system.Questions.filter(q => q.questionSetId === set.id).map(q => q.id));
      system.Questions = system.Questions.filter(q => q.questionSetId !== set.id);
      system.QuestionOptions = system.QuestionOptions.filter(o => o.questionSetId !== set.id);
      system.QuestionSets = system.QuestionSets.filter(x => x.id !== set.id);
      system.QuestionSets.forEach((x, i) => { x.index = i + 1; });
      system.QuestionSurveyTypes = system.QuestionSurveyTypes.filter(r => !qIds.has(r.questionId));
      system.QuestionContexts = system.QuestionContexts.filter(r => !qIds.has(r.questionId));
      system.QuestionResponseTypes = system.QuestionResponseTypes.filter(r => !qIds.has(r.questionId));
      await this.app.persistEditedSystem();
      this.close();
      toast('Question set deleted', 'warn');
    };
    refreshIcons();
  }

  // ================= SYSTEM META =================
  editSystem(system) {
    this.form().innerHTML = `
      ${field('System name', `<input id="sys_name" class="input" value="${esc(system.name)}">`)}
      <div class="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
        <div class="px-4 py-3 flex justify-between gap-4"><span class="text-gray-500 shrink-0">Technical id</span><span class="mono">${esc(system.id)}</span></div>
        <div class="px-4 py-3 flex justify-between gap-4"><span class="text-gray-500 shrink-0">Created</span><span class="text-xs">${esc(system.createdAt)}</span></div>
        <div class="px-4 py-3 flex justify-between gap-4"><span class="text-gray-500 shrink-0">Source file</span><span class="text-xs truncate">${esc(system.sourceFileName || '—')}</span></div>
      </div>
    `;
    this.open('system', system, {
      title: 'Edit System name',
      sub: system.name,
      icon: 'server',
      onSave: async () => {
        const name = $('#sys_name').value.trim();
        if (!name) throw new Error('System name is required.');
        system.name = name;
        await this.app.persistEditedSystem();
        toast('System saved');
      },
      onDelete: null,
    });
  }
}
