/* ============================================================================
   Model explorer — view a whole System model and edit its parts
   ============================================================================ */
import { computeStats, exportSystemDocument, unpackRest, normalizeLabel } from './domain.js';
import { $, $$, h, esc, toast, refreshIcons, confirmDialog } from './ui.js';

export class ModelView {
  constructor(app) {
    this.app = app;
    this.system = null;
    this.qFilter = { s: '', st: '', ctx: '', rt: '' };
    this.setFilter = '';
    this.expandedSets = new Set();
  }

  setSystem(system) {
    this.system = system;
    this.qFilter = { s: '', st: '', ctx: '', rt: '' };
    this.expandedSets = new Set();
  }

  // ---- helpers ----
  surveyTypesOf(q) {
    return this.system.QuestionSurveyTypes
      .filter(r => r.questionId === q.id)
      .map(r => this.system.SurveyTypes.find(s => s.id === r.surveyTypeId))
      .filter(Boolean);
  }
  contextsOf(q) {
    return this.system.QuestionContexts
      .filter(r => r.questionId === q.id)
      .map(r => this.system.Contexts.find(s => s.id === r.contextId))
      .filter(Boolean);
  }
  responseTypeName(id) {
    const rt = this.system.ResponseTypes.find(r => r.id === id);
    return rt ? rt.name : '';
  }
  setOf(id) { return this.system.QuestionSets.find(s => s.id === id); }
  optionsOf(setId) { return this.system.QuestionOptions.filter(o => o.questionSetId === setId); }
  questionsOf(setId) { return this.system.Questions.filter(q => q.questionSetId === setId); }

  rtColor(name) {
    const m = {
      SINGLE: 'bg-indigo-50 text-indigo-700',
      MULTI: 'bg-violet-50 text-violet-700',
      YES_NO: 'bg-emerald-50 text-emerald-700',
      TEXT: 'bg-sky-50 text-sky-700',
      CALLBACK: 'bg-amber-50 text-amber-700',
      DICTIONARY: 'bg-teal-50 text-teal-700',
      DICTIONARY_INCOMPLETE: 'bg-orange-50 text-orange-700',
      PERSON_KYC: 'bg-rose-50 text-rose-700',
    };
    return m[name] || 'bg-gray-100 text-gray-600';
  }

  // ---- render all tabs ----
  render() {
    const s = this.system;
    $('#modelTitle').textContent = s.name;
    $('#modelSubtitle').innerHTML = `<span class="mono">${esc(s.id)}</span> · updated ${esc((s.updatedAt || '').slice(0, 16).replace('T', ' '))}`;
    $('#modelEmpty').classList.add('hidden');
    $('#modelBody').classList.remove('hidden');
    this.renderOverview();
    this.renderDicts();
    this.renderQuestions();
    this.renderSets();
    refreshIcons();
  }

  renderOverview() {
    const s = this.system;
    const stats = computeStats(s);
    this.stats = stats;

    const cards = [
      ['Question sets', stats.counts.sets, 'layers'],
      ['Questions', stats.counts.questions, 'list-checks'],
      ['Response options', stats.counts.options, 'circle-dot'],
      ['Survey types', stats.counts.surveyTypes, 'segments'],
      ['Contexts', stats.counts.contexts, 'git-branch'],
      ['Response types', stats.counts.responseTypes, 'shapes'],
    ];
    $('#statCards').innerHTML = cards.map(([label, val, icon]) => `
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <span class="text-2xl font-semibold tracking-tight">${val}</span>
          <i data-lucide="${icon}" class="w-4 h-4 text-gray-300"></i>
        </div>
        <div class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mt-1.5">${label}</div>
      </div>`).join('');

    const bar = (map) => {
      const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((t, [, v]) => t + v, 0) || 1;
      if (!entries.length) return `<div class="text-xs text-gray-400 py-2">No entries.</div>`;
      return entries.map(([k, v]) => `
        <div class="mb-2.5">
          <div class="flex justify-between text-xs mb-1"><span class="font-medium text-gray-700">${esc(k)}</span><span class="text-gray-400 tabular-nums">${v}</span></div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style="width:${Math.max(3, Math.round((v / total) * 100))}%"></div></div>
        </div>`).join('');
    };

    const setRtStats = Object.entries(stats.byResponseType).map(([k, v]) => `
      <tr class="divide-x divide-gray-100">
        <td class="td font-medium">${esc(k)}</td>
        <td class="td tabular-nums">${v.sets}</td>
        <td class="td tabular-nums">${v.questions}</td>
        <td class="td tabular-nums">${v.options}</td>
      </tr>`).join('');

    $('#overviewCards').innerHTML = `
      <div class="card p-5">
        <div class="flex items-center gap-2 mb-4"><i data-lucide="shapes" class="w-4 h-4 text-gray-400"></i><h3 class="text-sm font-semibold">Questions per ResponseType</h3></div>
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead><tr class="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100"><th class="py-2 pr-3">Type</th><th class="py-2 pr-3">Sets</th><th class="py-2 pr-3">Questions</th><th class="py-2">Options</th></tr></thead>
          <tbody class="divide-y divide-gray-50">${setRtStats}</tbody>
        </table></div>
      </div>
      <div class="grid gap-4">
        <div class="card p-5">
          <div class="flex items-center gap-2 mb-4"><i data-lucide="segments" class="w-4 h-4 text-gray-400"></i><h3 class="text-sm font-semibold">Questions per SurveyType</h3></div>
          ${bar(stats.bySurveyType)}
        </div>
        <div class="card p-5">
          <div class="flex items-center gap-2 mb-4"><i data-lucide="git-branch" class="w-4 h-4 text-gray-400"></i><h3 class="text-sm font-semibold">Questions per Context</h3></div>
          ${bar(stats.byContext)}
        </div>
      </div>`;

    const w = $('#warningsCard');
    if (stats.warnings.length) {
      w.classList.remove('hidden');
      w.innerHTML = `
        <div class="panelhead px-4 py-3 flex items-center gap-2"><i data-lucide="triangle-alert" class="w-4 h-4 text-amber-500"></i><h3 class="text-sm font-semibold">Data quality warnings (${stats.warnings.length})</h3></div>
        <ul class="p-4 text-xs text-gray-600 space-y-1.5 list-disc pl-8">${stats.warnings.slice(0, 30).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    } else {
      w.classList.add('hidden');
    }
  }

  renderDicts() {
    const s = this.system;
    const DICTS = [
      { key: 'rt', label: 'ResponseType enum', icon: 'shapes', items: s.ResponseTypes, tag: r => r.isSeed ? 'schema' : 'added', note: 'Dedicated (name, id) structure for the ResponseType enum.' },
      { key: 'st', label: 'SurveyType enum', icon: 'segments', items: s.SurveyTypes, tag: () => 'sys relation', note: `Unique name + relation to System <span class="mono">${esc(s.id)}</span>.` },
      { key: 'ctx', label: 'Context enum', icon: 'git-branch', items: s.Contexts, tag: () => 'sys relation', note: `Unique name + relation to System <span class="mono">${esc(s.id)}</span>.` },
      { key: 'pc', label: 'ProcessContext', icon: 'workflow', items: s.ProcessContexts, tag: () => 'schema', note: 'Dedicated (name, id) structure; available for process tagging.' },
      { key: 'sys', label: 'System', icon: 'server', items: [{ id: s.id, name: s.name }], tag: () => 'root', note: 'System data name structure (name, id).' },
    ];
    if (!this.dictTab || !DICTS.some(d => d.key === this.dictTab)) this.dictTab = 'rt';
    const active = DICTS.find(d => d.key === this.dictTab);

    const tabsEl = $('#dictTabs');
    tabsEl.innerHTML = DICTS.map(d =>
      `<button class="dicttab ${d.key === this.dictTab ? 'active' : ''}" data-dicttab="${d.key}">${esc(d.label)}<span class="cnt">${d.items.length}</span></button>`
    ).join('');
    $$('#dictTabs [data-dicttab]').forEach(b => {
      b.onclick = () => { this.dictTab = b.getAttribute('data-dicttab'); this.renderDicts(); };
    });

    $('#dictPanel').innerHTML = `
      <div class="card overflow-hidden">
        <div class="panelhead px-4 py-3 flex items-center gap-2 flex-wrap">
          <i data-lucide="${active.icon}" class="w-4 h-4 text-gray-400"></i>
          <h3 class="text-sm font-semibold">${esc(active.label)}</h3>
          <span class="mono hidden sm:inline">${active.items.length} items</span>
        </div>
        <table class="w-full">
          <tbody class="divide-y divide-gray-50">
            ${active.items.map(r => `<tr class="detailrow">
              <td class="td w-24 mono">${esc(r.id)}</td>
              <td class="td font-medium">${esc(r.name)}</td>
              <td class="td text-right"><span class="chip bg-gray-100 text-gray-500">${esc(active.tag(r) || '')}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">${active.note}</div>
      </div>`;
  }

  renderQuestions() {
    const s = this.system;
    // fill filter selects once per system
    for (const [sel, coll, ph] of [['#qFilterSurveyType', s.SurveyTypes, 'All survey types'], ['#qFilterContext', s.Contexts, 'All contexts'], ['#qFilterResponseType', s.ResponseTypes, 'All response types']]) {
      const el = $(sel);
      const cur = el.value;
      el.innerHTML = `<option value="">${ph}</option>` + coll.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
      if ([...el.options].some(o => o.value === cur)) el.value = cur;
    }

    const f = this.qFilter;
    const norm = normalizeLabel(f.s);
    const matchQ = (q) => {
      if (norm) {
        const hay = normalizeLabel(`${q.QuestionCode} ${q.QuestionLabel} ${q.SurveyCode}`);
        if (!hay.includes(norm)) return false;
      }
      if (f.st && !this.surveyTypesOf(q).some(x => x.id === f.st)) return false;
      if (f.ctx && !this.contextsOf(q).some(x => x.id === f.ctx)) return false;
      if (f.rt) {
        const set = this.setOf(q.questionSetId);
        if (!set || set.responseTypeId !== f.rt) return false;
      }
      return true;
    };
    const rows = s.Questions.filter(matchQ);

    $('#questionsTable').innerHTML = rows.length ? rows.map(q => {
      const set = this.setOf(q.questionSetId);
      const rtName = set ? this.responseTypeName(set.responseTypeId) : '';
      return `<tr class="rowlink" data-qrow="${q.id}">
        <td class="td font-medium font-mono text-xs whitespace-nowrap">${esc(q.QuestionCode)}</td>
        <td class="td max-w-xs"><div class="truncate" title="${esc(q.QuestionLabel)}">${esc(q.QuestionLabel)}</div></td>
        <td class="td"><div class="flex flex-wrap gap-1 max-w-[180px]">${this.surveyTypesOf(q).map(x => `<span class="chip bg-indigo-50 text-indigo-700">${esc(x.name)}</span>`).join('') || '<span class="text-gray-300 text-xs">—</span>'}</div></td>
        <td class="td"><div class="flex flex-wrap gap-1 max-w-[150px]">${this.contextsOf(q).map(x => `<span class="chip bg-gray-100 text-gray-600">${esc(x.name)}</span>`).join('') || '<span class="text-gray-300 text-xs">—</span>'}</div></td>
        <td class="td"><span class="chip ${this.rtColor(rtName)}">${esc(rtName || '—')}</span></td>
        <td class="td mono whitespace-nowrap hidden md:table-cell">#${set ? set.index : '?'}</td>
        <td class="td text-right"><button class="btn btn-ghost btn-sm" data-editq="${q.id}">Edit</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="7" class="td text-center text-gray-400 py-8 text-sm">No questions match the filters.</td></tr>`;

    $$('#questionsTable [data-qrow]').forEach(tr => {
      tr.onclick = (e) => {
        if (e.target.closest('[data-editq]')) return;
        this.app.editQuestion(tr.getAttribute('data-qrow'));
      };
    });
    $$('#questionsTable [data-editq]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); this.app.editQuestion(b.getAttribute('data-editq')); };
    });
  }

  renderSets() {
    const s = this.system;
    const norm = normalizeLabel(this.setFilter || '');
    const sets = s.QuestionSets.filter(set => {
      if (!norm) return true;
      const hay = normalizeLabel(`${set.index} ${this.responseTypeName(set.responseTypeId)}`);
      return hay.includes(norm);
    });

    $('#setsList').innerHTML = sets.length ? sets.map(set => {
      const open = this.expandedSets.has(set.id);
      const rtName = this.responseTypeName(set.responseTypeId);
      const opts = this.optionsOf(set.id);
      const qs = this.questionsOf(set.id);
      const rest = unpackRest(set.restJson);
      return `
      <div class="card overflow-hidden">
        <div class="px-4 py-3 flex items-center gap-3 flex-wrap cursor-pointer select-none" data-sethead="${set.id}">
          <i data-lucide="${open ? 'chevron-down' : 'chevron-right'}" class="w-4 h-4 text-gray-400"></i>
          <span class="chip ${this.rtColor(rtName)} font-semibold">${esc(rtName || '—')}</span>
          <span class="text-sm font-semibold">Question set #${set.index}</span>
          <span class="mono">${esc(set.id)}</span>
          <span class="text-xs text-gray-400">${qs.length} question${qs.length === 1 ? '' : 's'} · ${opts.length} option${opts.length === 1 ? '' : 's'}</span>
          <span class="ml-auto flex gap-2">
            ${Object.keys(rest).length ? `<span class="chip bg-gray-100 text-gray-500">+${Object.keys(rest).length} extra</span>` : ''}
            <button class="btn btn-ghost btn-sm" data-editset="${set.id}"><i data-lucide="settings-2" class="w-3.5 h-3.5"></i>Set</button>
          </span>
        </div>
        ${open ? this.renderSetDetail(set, opts, qs, rest) : ''}
      </div>`;
    }).join('') : `<div class="card p-8 text-center text-sm text-gray-400">No question sets match.</div>`;

    $$('#setsList [data-sethead]').forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest('[data-editset]')) return;
        const id = el.getAttribute('data-sethead');
        this.expandedSets.has(id) ? this.expandedSets.delete(id) : this.expandedSets.add(id);
        this.renderSets();
        refreshIcons();
      };
    });
    $$('#setsList [data-editset]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); this.app.editQuestionSet(b.getAttribute('data-editset')); };
    });
    $$('#setsList [data-editopt]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); this.app.editOption(b.getAttribute('data-editopt')); };
    });
    $$('#setsList [data-addopt]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); this.app.editOption(null, b.getAttribute('data-addopt')); };
    });
    $$('#setsList [data-qrow2]').forEach(el => {
      el.onclick = (e) => {
        if (e.target.closest('[data-editq2]')) return;
        this.app.editQuestion(el.getAttribute('data-qrow2'));
      };
    });
    $$('#setsList [data-editq2]').forEach(b => {
      b.onclick = (e) => { e.stopPropagation(); this.app.editQuestion(b.getAttribute('data-editq2')); };
    });
  }

  renderSetDetail(set, opts, qs, rest) {
    const optRows = opts.length ? opts.map(o => `
      <tr class="rowlink" data-optrow="${o.id}">
        <td class="td mono w-20">${esc(o.ResponseCode)}</td>
        <td class="td">${esc(o.ResponseDescription)}</td>
        <td class="td text-gray-400 max-w-[200px]"><div class="truncate" title="${esc(o.ResponseDescriptionNorm)}">${esc(o.ResponseDescriptionNorm || '—')}</div></td>
        <td class="td text-right"><button class="btn btn-ghost btn-sm" data-editopt="${o.id}">Edit</button></td>
      </tr>`).join('') : `<tr><td colspan="4" class="td text-center text-gray-400 py-5 text-xs">Empty response set (free-text questions).</td></tr>`;

    return `
      <div class="border-t border-gray-100 p-4 space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <div class="fld">Response options <span class="normal-case text-gray-400">· QuestionSetId assigned to each item</span></div>
            <div class="rounded-lg border border-gray-200 overflow-hidden">
              <table class="w-full">
                <thead class="bg-gray-50"><tr><th class="th">Code</th><th class="th">Description</th><th class="th">Norm</th><th class="th"></th></tr></thead>
                <tbody class="divide-y divide-gray-50">${optRows}</tbody>
              </table>
            </div>
            <button class="btn btn-ghost btn-sm mt-2" data-addopt="${set.id}"><i data-lucide="plus" class="w-3.5 h-3.5"></i>Add option</button>
          </div>
          <div>
            <div class="fld">Questions in this set</div>
            <div class="rounded-lg border border-gray-200 divide-y divide-gray-50">
              ${qs.length ? qs.map(q => `
                <div class="px-3 py-2.5 flex items-start gap-3 hover:bg-gray-50 cursor-pointer" data-qrow2="${q.id}">
                  <span class="mono whitespace-nowrap mt-0.5">${esc(q.QuestionCode)}</span>
                  <span class="text-xs text-gray-500 flex-1">${esc(q.QuestionLabel)}</span>
                  <button class="btn btn-ghost btn-sm shrink-0" data-editq2="${q.id}">Edit</button>
                </div>`).join('') : '<div class="px-3 py-5 text-center text-xs text-gray-400">No questions.</div>'}
            </div>
          </div>
        </div>
        ${Object.keys(rest).length ? `
        <details class="text-xs">
          <summary class="cursor-pointer text-gray-500 font-medium select-none">Extra group properties (${Object.keys(rest).length})</summary>
          <pre class="jsonview mt-2 p-3 rounded-lg bg-gray-50 border border-gray-100 overflow-auto text-[11px]">${esc(JSON.stringify(rest, null, 2))}</pre>
        </details>` : ''}
      </div>`;
  }

  bindSetEvents() {
    // events are bound inside renderSets(); kept for compatibility
  }

  refreshAfterEdit() {
    this.render();
    this.bindSetEvents();
  }

  exportDocument() {
    return exportSystemDocument(this.system);
  }
}
