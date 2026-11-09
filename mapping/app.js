// Mapping Studio orchestration — datasets come from this app's persisted
// Systems (technical ids). The imported project's raw-file loading was replaced
// by a System picker; everything else keeps its behaviour.
import { S, onRender, onChange, update, commit, undo, redo, canUndo, canRedo, resetHistory, setSystemDataset, toggleLink, linkById, uid, serializeProject } from './state.js';
import { DEFAULT_TYPES, LEGACY_TYPES, typeMeta, linkInfo, suggestLinks, buildMapping, applyMapping, tableRows, toCSV, similarQuestions, autoMatchOptions } from './model.js';
import { renderPanel, resetPanel, scrollToCard } from './panels.js';
import { scheduleWires, drawWires, initWires } from './wires.js';
import { renderInspector, pickerOpen } from './inspector.js';
import { renderTable } from './table.js';
import * as store from './storage.js';
import { $, $$, esc, ic, paintIcons, toast, modal, menu, closeMenu, download, pickFile, timeAgo } from './ui.js';
import { buildSystemModel } from '../domain.js';
import { SAMPLE_DOMAIN } from '../sample.js';
import { SAMPLE_PS, SAMPLE_RDS } from './samples.js';
import { listSystems, loadSystem } from './systems.js';

const isDesktop = () => innerWidth >= 768;
const slug = (s) => String(s || 'mapping').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mapping';

/* ======================= Handlers shared with modules ======================= */

const H = {
  paint: paintIcons,
  onScroll: scheduleWires,
  onHover: () => { scheduleWires(); },
  setView,
  exportCSV,

  bindEmpty(el, side) {
    el.querySelector('[data-act="pick"]').addEventListener('click', () => systemPicker(side));
    el.querySelector('[data-act="sample"]').addEventListener('click', () => loadSample(side));
  },

  datasetMenu(anchor, side) {
    const ds = S[side];
    const groups = ds.groups.length, opts = ds.groups.reduce((n, g) => n + g.options.length, 0);
    menu(anchor, [
      { header: `${ds.questions.length} questions · ${groups} response sets · ${opts} answers` },
      { label: 'Switch to another System…', icon: 'repeat', onClick: () => systemPicker(side) },
      { label: 'Refresh from Studio', icon: 'refresh-cw', onClick: () => refreshSystem(side) },
      { label: 'Download as domain JSON', icon: 'download', onClick: () => download(`${slug(ds.name)}.json`, JSON.stringify(datasetToSchemaArray(ds), null, 2)) },
      { label: 'Expand all questions', icon: 'chevrons-up-down', onClick: () => { ds.questions.forEach((q) => S.expanded.add(`${side}:${q.id}`)); update(); } },
      { label: 'Collapse all', icon: 'chevrons-down-up', onClick: () => { [...S.expanded].filter((k) => k.startsWith(side + ':')).forEach((k) => S.expanded.delete(k)); update(); } },
      '-',
      { label: 'Unload dataset', icon: 'circle-x', danger: true, onClick: () => unloadDataset(side) },
    ], side === 'src' ? 'left' : 'right');
  },

  cardClick(side, id) {
    if (side === 'src') {
      if (S.activeSrc === id) { S.activeSrc = null; }
      else { S.activeSrc = id; S.activeTgt = null; S.selLink = null; }
      if (!isDesktop() && S.activeSrc && S.tgt) { S.mobilePane = 'tgt'; toast('Tap a target question to connect'); }
      update();
      return;
    }
    if (S.activeSrc) { H.connect(S.activeSrc, id); return; }
    S.activeTgt = S.activeTgt === id ? null : id;
    S.selLink = null;
    update();
  },

  connect(sid, tid) {
    const existing = S.links.find((l) => l.s === sid && l.t === tid);
    if (existing) { H.openLink(existing.id); return; }
    const sq = S.src.byId.get(sid), tq = S.tgt.byId.get(tid);
    const link = toggleLink(sid, tid);
    const n = Object.keys(link.opt).length;
    const info = linkInfo(link, sq, tq);
    toast(info.mode === 'options' ? `Connected · ${n} of ${sq.options.length} answers auto-matched` : `Connected · ${typeMeta(sq.type).label} → ${typeMeta(tq.type).label}`, 'success');
  },

  openLink(id) {
    const l = linkById(id);
    if (!l) return;
    S.selLink = id;
    if (isDesktop()) { S.activeSrc = l.s; S.activeTgt = null; }
    update();
    requestAnimationFrame(() => { scrollToCard('src', l.s); scrollToCard('tgt', l.t); setTimeout(scheduleWires, 350); });
  },

  focusLink(id) {
    const l = linkById(id);
    if (!l) return;
    S.filter.src = { q: '', status: 'all', type: 'all' };
    S.filter.tgt = { q: '', status: 'all', type: 'all' };
    resetPanel('src'); resetPanel('tgt');
    S.activeSrc = l.s;
    update();
    requestAnimationFrame(() => { scrollToCard('src', l.s); scrollToCard('tgt', l.t); setTimeout(scheduleWires, 350); });
  },

  deleteLink(id) {
    const l = linkById(id);
    if (!l) return;
    commit(() => { S.links = S.links.filter((x) => x.id !== id); if (S.selLink === id) S.selLink = null; });
    toast('Connection removed', 'info', { label: 'Undo', onClick: () => undo() });
  },
};

/* ======================= Rendering ======================= */

function render() {
  $('#mapView').classList.toggle('hidden', S.view !== 'map');
  $('#tableView').classList.toggle('hidden', S.view !== 'table');
  $('#tableView').classList.toggle('flex', S.view === 'table');
  $('#mobileTabs').classList.toggle('!hidden', S.view !== 'map');
  $$('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === S.view)));
  $$('[data-pane]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.pane === S.mobilePane)));

  if (!isDesktop()) {
    $('#srcPanel').classList.toggle('hidden', S.mobilePane !== 'src');
    $('#tgtPanel').classList.toggle('hidden', S.mobilePane !== 'tgt');
  } else {
    $('#srcPanel').classList.remove('hidden');
    $('#tgtPanel').classList.remove('hidden');
  }

  const scrolls = {};
  ['src', 'tgt'].forEach((s) => { scrolls[s] = $(`#${s}Panel [data-list]`)?.scrollTop || 0; });
  if (S.view === 'map') {
    renderPanel('src', H);
    renderPanel('tgt', H);
    ['src', 'tgt'].forEach((s) => { const l = $(`#${s}Panel [data-list]`); if (l) l.scrollTop = scrolls[s]; });
  } else {
    renderTable(H);
  }
  renderInspector(H);
  renderStats();
  const ub = $('#undoBtn'), rb = $('#redoBtn'), sb = $('#suggestBtn');
  if (ub) ub.disabled = !canUndo();
  if (rb) rb.disabled = !canRedo();
  if (sb) sb.disabled = !(S.src && S.tgt);
  paintIcons();
  drawWires();
}

function renderStats() {
  const el = $('#stats');
  if (!S.src || !S.tgt) {
    el.innerHTML = `<span class="flex items-center gap-1.5">${ic('info', 'w-3.5 h-3.5')}Load a source and a target System to start mapping.</span>
      <button class="ml-auto text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap" data-samples>Load both sample Systems</button>`;
    el.querySelector('[data-samples]')?.addEventListener('click', loadBothSamples);
    return;
  }
  const srcMapped = new Set(S.links.map((l) => l.s)).size;
  const tgtCovered = new Set(S.links.map((l) => l.t)).size;
  let ans = 0, ansMapped = 0, warn = 0;
  S.links.forEach((l) => {
    const i = linkInfo(l, S.src.byId.get(l.s), S.tgt.byId.get(l.t));
    if (i.mode === 'options') { ans += i.total; ansMapped += i.mapped; }
    if (i.status !== 'ok') warn++;
  });
  const item = (icon, label, val, cls = '') => `<span class="flex items-center gap-1.5 whitespace-nowrap">${ic(icon, 'w-3.5 h-3.5 text-gray-400')}${label}<b class="font-semibold text-gray-800 ${cls}">${val}</b></span>`;
  el.innerHTML = `
    ${item('arrow-up-from-line', 'Source mapped', `${srcMapped}/${S.src.questions.length}`)}
    ${item('arrow-down-to-line', 'Target covered', `${tgtCovered}/${S.tgt.questions.length}`)}
    ${item('cable', 'Connections', S.links.length)}
    ${item('list-checks', 'Answers mapped', ans ? `${ansMapped}/${ans}` : '—')}
    <button class="flex items-center gap-1.5 whitespace-nowrap hover:text-gray-800" data-issues>${ic('triangle-alert', `w-3.5 h-3.5 ${warn ? 'text-amber-500' : 'text-gray-400'}`)}Needs review<b class="font-semibold ${warn ? 'text-amber-600' : 'text-gray-800'}">${warn}</b></button>
    <span class="ml-auto hidden lg:flex items-center gap-1.5 text-gray-400 whitespace-nowrap">${S.activeSrc ? `${ic('mouse-pointer-click', 'w-3.5 h-3.5')}Click target questions to connect · <kbd>Esc</kbd> to stop` : `${ic('mouse-pointer-click', 'w-3.5 h-3.5')}Select a source question, or drag its handle onto a target`}</span>`;
  el.querySelector('[data-issues]').addEventListener('click', reviewIssues);
}

function reviewIssues() {
  const issues = S.links.map((l) => ({ l, i: linkInfo(l, S.src.byId.get(l.s), S.tgt.byId.get(l.t)) })).filter((x) => x.i.status !== 'ok');
  const unmappedSrc = S.src.questions.filter((q) => !S.links.some((l) => l.s === q.id));
  modal({
    title: 'Review',
    wide: true,
    body: `
      <div class="text-xs font-medium text-gray-500 mb-2">Connections needing attention · ${issues.length}</div>
      ${issues.length ? issues.map(({ l, i }) => { const sq = S.src.byId.get(l.s), tq = S.tgt.byId.get(l.t); return `
        <button data-open="${esc(l.id)}" class="w-full text-left border border-gray-200 rounded-lg p-2.5 mb-1.5 hover:bg-gray-50">
          <div class="flex items-center gap-2 text-xs"><span class="code">${esc(sq.code)}</span>${ic('arrow-right', 'w-3 h-3 text-gray-300')}<span class="code">${esc(tq.code)}</span><span class="truncate text-gray-700">${esc(sq.label)}</span></div>
          <div class="text-xs text-amber-700 mt-1">${i.warnings.map(esc).join(' ') || 'No answers mapped yet.'}</div>
        </button>`; }).join('') : '<div class="text-xs text-gray-400 mb-3">All connections look good.</div>'}
      <div class="text-xs font-medium text-gray-500 mt-4 mb-2">Source questions not migrated · ${unmappedSrc.length}</div>
      <div class="flex flex-wrap gap-1">${unmappedSrc.slice(0, 80).map((q) => `<button data-src="${esc(q.id)}" class="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50" title="${esc(q.label)}"><span class="font-mono text-gray-500">${esc(q.code)}</span></button>`).join('')}${unmappedSrc.length > 80 ? `<span class="text-xs text-gray-400 px-2 py-1">+${unmappedSrc.length - 80} more</span>` : ''}</div>`,
    onMount: (root, close) => {
      root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { close(); H.focusLink(b.dataset.open); H.openLink(b.dataset.open); }));
      root.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => {
        close();
        S.filter.src = { q: '', status: 'all', type: 'all' }; resetPanel('src');
        S.activeSrc = b.dataset.src; S.selLink = null; S.mobilePane = 'src'; update();
        requestAnimationFrame(() => scrollToCard('src', b.dataset.src));
        const q = S.src.byId.get(b.dataset.src);
        const sim = similarQuestions(q, S.tgt, new Set(), 1)[0];
        if (sim) toast(`Closest target: ${sim.q.code} — ${sim.q.label}`);
      }));
    },
  });
}

function setView(v) { S.view = v; update(); }

/* ======================= System datasets (this app's store) ======================= */

function systemPicker(side) {
  modal({
    title: `Choose ${side === 'src' ? 'source' : 'target'} System`,
    wide: true,
    body: `<div class="py-8 text-center text-xs text-gray-400">Loading Systems…</div>`,
    actions: [{ label: 'Cancel' }],
    onMount: async (root) => {
      const body = root.querySelector('[data-body]');
      let systems;
      try { systems = await listSystems(); }
      catch { systems = null; }
      if (!body.isConnected) return;
      if (systems === null) { body.innerHTML = '<div class="py-8 text-center text-xs text-red-600">Could not load Systems.</div>'; return; }
      if (!systems.length) {
        body.innerHTML = `<div class="py-10 text-center">
          <div class="text-sm font-medium text-gray-700">No Systems uploaded yet</div>
          <div class="text-xs text-gray-400 mt-1 mb-4">Upload survey domain data in the Studio first, or load a sample System here.</div>
          <button class="mbtn mbtn-primary" data-sample>Load sample ${side === 'src' ? 'PS' : 'RDS'} System</button></div>`;
        body.querySelector('[data-sample]').addEventListener('click', () => { root.remove(); loadSample(side); });
        return;
      }
      body.innerHTML = `<div class="space-y-1.5">${systems.map((e) => `
        <button data-sys="${esc(e.id)}" class="w-full flex items-center gap-3 text-left border ${S[side]?.systemId === e.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200'} rounded-lg p-3 hover:bg-gray-50">
          <div class="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">${ic('database')}</div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-gray-900 truncate">${esc(e.name)}</div>
            <div class="text-xs text-gray-500 truncate">${e.counts ? `${e.counts.questions} questions · ${e.counts.sets} sets · ${e.counts.options} options` : esc(e.id)}</div>
          </div>
          ${ic('chevron-right', 'w-4 h-4 text-gray-300 shrink-0')}
        </button>`).join('')}</div>
        <div class="text-xs text-gray-400 mt-3">Samples: <button class="text-indigo-600 font-medium" data-sample>load sample ${side === 'src' ? 'PS' : 'RDS'} System</button></div>`;
      paintIcons();
      body.querySelectorAll('[data-sys]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const system = await loadSystem(b.dataset.sys);
          if (!system) throw new Error('not found');
          root.remove();
          applySystem(side, system);
        } catch { toast('Could not open that System', 'error'); b.disabled = false; }
      }));
      body.querySelector('[data-sample]').addEventListener('click', () => { root.remove(); loadSample(side); });
    },
  });
}

function applySystem(side, system) {
  const hadLinks = S.links.length;
  setSystemDataset(side, system);
  resetPanel(side);
  S.filter[side] = { q: '', status: 'all', type: 'all' };
  const dropped = reconcileLinks();
  if (S.selLink && !linkById(S.selLink)) S.selLink = null;
  S.dirty = true;
  scheduleSave();
  update();
  let msg = `Loaded ${S[side].questions.length} questions from “${system.name}”`;
  if (hadLinks && dropped) msg += ` · ${dropped} connection${dropped > 1 ? 's' : ''} removed`;
  toast(msg, 'success');
}

async function refreshSystem(side) {
  const ds = S[side];
  if (!ds?.systemId) return;
  try {
    const system = await loadSystem(ds.systemId);
    if (!system) { toast('That System no longer exists in the Studio', 'warn'); return; }
    applySystem(side, system);
  } catch { toast('Could not refresh', 'error'); }
}

async function loadSample(side) {
  try {
    const raw = side === 'src' ? SAMPLE_PS : SAMPLE_RDS;
    // Align the sample through THIS APP's persistence model first.
    const { system } = buildSystemModel(raw, side === 'src' ? 'PS – KYC survey (sample)' : 'RDS – Risk survey (sample)', { fileName: side === 'src' ? 'ps-survey.json' : 'rds-survey.json' });
    system.id = side === 'src' ? 'sys_sample_ps' : 'sys_sample_rds';
    applySystem(side, system);
  } catch (e) { toast('Could not load sample System', 'error'); }
}
async function loadBothSamples() { await loadSample('src'); await loadSample('tgt'); }

function reconcileLinks() {
  if (!S.src || !S.tgt) return 0;
  const before = S.links.length;
  S.links = S.links.filter((l) => S.src.byId.has(l.s) && S.tgt.byId.has(l.t));
  S.links.forEach((l) => {
    const sq = S.src.byId.get(l.s), tq = S.tgt.byId.get(l.t);
    Object.keys(l.opt).forEach((k) => {
      if (!sq.optByKey.has(k)) { delete l.opt[k]; return; }
      l.opt[k] = l.opt[k].filter((t) => tq.optByKey.has(t));
      if (!l.opt[k].length) delete l.opt[k];
    });
    l.fallback = (l.fallback || []).filter((t) => tq.optByKey.has(t));
  });
  return before - S.links.length;
}

function unloadDataset(side) {
  const go = () => {
    S[side] = null;
    S.links = [];
    S.selLink = null; S.activeSrc = null; S.activeTgt = null;
    resetHistory();
    resetPanel(side);
    S.dirty = true; scheduleSave();
    update();
  };
  if (!S.links.length) return go();
  modal({ title: 'Unload dataset?', body: `All ${S.links.length} connections will be removed.`, actions: [{ label: 'Cancel' }, { label: 'Unload', danger: true, onClick: go }] });
}

// Rebuild a schema-format array from the current dataset (for export).
function datasetToSchemaArray(ds) {
  return ds.groups.map((g) => ({
    ResponseType: g.type,
    ResponseOptions: g.options.map((o) => ({ ResponseCode: o.code, ResponseDescription: o.desc, ...(o.norm ? { ResponseDescriptionNorm: o.norm } : {}), ...(o.pp !== undefined ? { ppRespCode: o.pp } : {}), ...(o.start ? { ResponseStart: o.start } : {}), ...(o.end ? { ResponseEnd: o.end } : {}) })),
    QuestionSet: g.qids.map((id) => ds.byId.get(id).raw),
  }));
}

/* ======================= Suggestions ======================= */

function suggestDialog() {
  if (!S.src || !S.tgt) return;
  const list = suggestLinks(S.src, S.tgt, S.links);
  if (!list.length) { toast('No new confident suggestions — all similar questions are already connected'); return; }
  const chosen = new Set(list.filter((x) => x.score >= 0.55).map((_, i) => i));
  modal({
    title: 'Suggested connections',
    wide: true,
    body: `<p class="text-xs text-gray-500 mb-3">Based on similarity of question labels, normalized subjects and response types. Answers are auto-matched when accepted.</p>
      <div class="flex items-center justify-between mb-2 text-xs"><span class="text-gray-500" data-cnt></span>
      <span class="flex gap-3"><button class="text-indigo-600 font-medium" data-all>Select all</button><button class="text-gray-500" data-none>Clear</button></span></div>
      <div class="space-y-1.5" data-list>${list.map((x, i) => { const sq = S.src.byId.get(x.s), tq = S.tgt.byId.get(x.t); const pct = Math.round(x.score * 100); return `
        <label class="flex items-center gap-3 border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:bg-gray-50">
          <input type="checkbox" data-i="${i}" class="accent-indigo-600 w-4 h-4 shrink-0" ${chosen.has(i) ? 'checked' : ''}>
          <div class="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div class="min-w-0"><div class="code truncate">${esc(sq.code)}</div><div class="text-xs text-gray-800 truncate" title="${esc(sq.label)}">${esc(sq.label)}</div></div>
            <span class="text-gray-300">${ic('arrow-right', 'w-3.5 h-3.5')}</span>
            <div class="min-w-0"><div class="code truncate">${esc(tq.code)}</div><div class="text-xs text-gray-800 truncate" title="${esc(tq.label)}">${esc(tq.label)}</div></div>
          </div>
          <span class="text-[11px] font-medium px-1.5 py-0.5 rounded ${pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-600'} shrink-0">${pct}%</span>
        </label>`; }).join('')}</div>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Add selected', primary: true, onClick: (root) => {
        const idx = [...root.querySelectorAll('[data-i]:checked')].map((c) => +c.dataset.i);
        if (!idx.length) return;
        commit(() => idx.forEach((i) => {
          const x = list[i];
          if (S.links.some((l) => l.s === x.s && l.t === x.t)) return;
          S.links.push({ id: uid(), s: x.s, t: x.t, opt: autoOpt(x.s, x.t), fallback: [], note: '' });
        }));
        toast(`Added ${idx.length} connection${idx.length > 1 ? 's' : ''}`, 'success');
      },
    }],
    onMount: (root) => {
      const cnt = () => { root.querySelector('[data-cnt]').textContent = `${root.querySelectorAll('[data-i]:checked').length} of ${list.length} selected`; };
      root.querySelector('[data-list]').addEventListener('change', cnt);
      root.querySelector('[data-all]').addEventListener('click', () => { root.querySelectorAll('[data-i]').forEach((c) => { c.checked = true; }); cnt(); });
      root.querySelector('[data-none]').addEventListener('click', () => { root.querySelectorAll('[data-i]').forEach((c) => { c.checked = false; }); cnt(); });
      cnt();
    },
  });
}
const autoOpt = (s, t) => autoMatchOptions(S.src.byId.get(s), S.tgt.byId.get(t));

/* ======================= Export / import ======================= */

function exportMenu(anchor) {
  const ready = S.src && S.tgt && S.links.length;
  menu(anchor, [
    { header: 'Export' },
    { label: 'Mapping definition (JSON)', icon: 'file-json', disabled: !ready, onClick: () => download(`${slug(S.name)}.mapping.json`, JSON.stringify(buildMapping(S), null, 2)) },
    { label: 'Migration table (CSV)', icon: 'file-spreadsheet', disabled: !ready, onClick: exportCSV },
    { label: 'Full project (re-openable)', icon: 'package', disabled: !(S.src || S.tgt), onClick: () => download(`${slug(S.name)}.project.json`, JSON.stringify({ format: 'survey-domain-mapping-project', ...serializeProject() }, null, 2)) },
  ]);
}

function exportCSV() {
  if (!S.links.length) return toast('Nothing to export yet');
  download(`${slug(S.name)}.migration.csv`, '\ufeff' + toCSV(tableRows(S)), 'text/csv');
}

async function importFile() {
  const f = await pickFile();
  if (!f) return;
  let json;
  try { json = JSON.parse(await f.text()); } catch { return toast('Invalid JSON file', 'error'); }
  if (json.format === 'survey-domain-mapping-project') return openProjectData(json);
  if (json.format === 'survey-migration-mapping' || Array.isArray(json.mappings)) {
    if (!S.src || !S.tgt) return toast('Load both Systems before importing a mapping', 'warn');
    const { links, skipped } = applyMapping(json, S.src, S.tgt, uid);
    let added = 0;
    commit(() => links.forEach((l) => { if (!S.links.some((x) => x.s === l.s && x.t === l.t)) { S.links.push(l); added++; } }));
    toast(`Imported ${added} connection${added === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped (questions not found)` : ''}`, skipped ? 'warn' : 'success');
    return;
  }
  if (Array.isArray(json)) {
    // Raw domain array → align through this app's persistence model.
    try {
      const { system } = buildSystemModel(json, f.name.replace(/\.json$/i, '') || 'Imported system', { fileName: f.name });
      const side = !S.src ? 'src' : 'tgt';
      applySystem(side, system);
      toast(`Loaded as ${side === 'src' ? 'source' : 'target'} System (aligned to this app's model)`, 'success');
    } catch (e) { toast(e.message || 'Not a valid domain dataset', 'error'); }
    return;
  }
  toast('Unrecognised file. Expected a mapping, project or domain dataset.', 'error');
}

async function openProjectData(p) {
  S.id = p.id || uid();
  S.name = p.name || 'Untitled mapping';
  S.src = null; S.tgt = null;
  const sysSide = async (side, ref) => {
    if (!ref?.systemId) return;
    try {
      const system = await loadSystem(ref.systemId);
      if (system) setSystemDataset(side, system);
      else toast(`Saved ${side} System “${ref.name}” is no longer available`, 'warn');
    } catch { toast(`Could not load the saved ${side} System`, 'error'); }
  };
  await sysSide('src', p.source);
  await sysSide('tgt', p.target);
  S.links = Array.isArray(p.links) ? p.links : [];
  reconcileLinks();
  S.selLink = null; S.activeSrc = null; S.activeTgt = null;
  S.filter = { src: { q: '', status: 'all', type: 'all' }, tgt: { q: '', status: 'all', type: 'all' } };
  resetPanel('src'); resetPanel('tgt');
  resetHistory();
  const nameInp = $('#projectName');
  if (nameInp) nameInp.value = S.name;
  S.dirty = false;
  setSaveStatus(p.updatedAt ? `Saved ${timeAgo(p.updatedAt)}` : 'Not saved');
  update();
}

function newProject() {
  const go = () => openProjectData({ id: uid(), name: 'Untitled mapping', links: [] });
  if (S.links.length && S.dirty && !store.auth.isSignedIn()) {
    modal({ title: 'Start a new mapping?', body: 'Unsaved connections in the current mapping will be lost.', actions: [{ label: 'Cancel' }, { label: 'New mapping', danger: true, onClick: go }] });
  } else go();
}

/* ======================= Cloud save ======================= */

let saveTimer = 0, saving = false;
function setSaveStatus(t) { const el = $('#saveStatus'); if (el) el.textContent = t; }

function scheduleSave() {
  if (!store.auth.isSignedIn()) { setSaveStatus(S.dirty ? 'Unsaved · sign in to save' : 'Not saved'); return; }
  setSaveStatus('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
}

async function saveNow() {
  if (!store.auth.isSignedIn() || saving) return;
  if (!S.src && !S.tgt && !S.links.length) { setSaveStatus('Not saved'); return; }
  saving = true;
  try {
    if (!S.id) S.id = uid();
    await store.saveProject(serializeProject());
    S.dirty = false;
    setSaveStatus('Saved');
  } catch {
    setSaveStatus('Save failed');
    toast('Could not save to cloud', 'error');
  } finally { saving = false; }
}

async function projectsDialog() {
  if (!store.auth.isSignedIn()) return signInPrompt('Sign in to save mappings to your cloud and open them from any device.');
  const m = modal({ title: 'Saved mappings', wide: true, body: `<div class="py-8 text-center text-xs text-gray-400">Loading…</div>` });
  let list = [];
  try { list = await store.listProjects(); } catch { list = null; }
  const body = m.root.querySelector('[data-body]');
  if (!body.isConnected) return;
  if (list === null) { body.innerHTML = '<div class="py-8 text-center text-xs text-red-600">Could not load saved mappings.</div>'; return; }
  body.innerHTML = list.length ? `<div class="space-y-1.5">${list.map((p) => `
    <div class="flex items-center gap-3 border ${p.id === S.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200'} rounded-lg p-3">
      <div class="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">${ic('waypoints')}</div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-gray-900 truncate">${esc(p.name)}${p.id === S.id ? ' <span class="text-[11px] text-indigo-600 font-normal">· current</span>' : ''}</div>
        <div class="text-xs text-gray-500 truncate">${esc(p.source || '—')} → ${esc(p.target || '—')} · ${p.links} connection${p.links === 1 ? '' : 's'} · ${timeAgo(p.updatedAt)}</div>
      </div>
      <button class="mbtn mbtn-sm" data-open="${esc(p.id)}">Open</button>
      <button class="micon !w-7 !h-7 hover:!text-red-600" data-del="${esc(p.id)}" title="Delete">${ic('trash-2', 'w-3.5 h-3.5')}</button>
    </div>`).join('')}</div>` : `<div class="py-10 text-center"><div class="text-sm font-medium text-gray-700">No saved mappings yet</div><div class="text-xs text-gray-400 mt-1">Your work is saved automatically while you're signed in.</div></div>`;
  paintIcons();
  body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Opening…';
    try {
      const p = await store.loadProject(b.dataset.open);
      if (!p) throw new Error();
      m.close(); await openProjectData(p); toast('Mapping opened', 'success');
    } catch { toast('Could not open mapping', 'error'); b.disabled = false; b.textContent = 'Open'; }
  }));
  body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    await store.deleteProject(b.dataset.del);
    if (b.dataset.del === S.id) { S.id = uid(); S.dirty = true; setSaveStatus('Unsaved'); }
    b.closest('.flex').remove();
    toast('Mapping deleted');
  }));
}

function signInPrompt(text) {
  modal({
    title: 'Sign in',
    body: `<p>${esc(text)}</p>`,
    actions: [{ label: 'Not now' }, { label: 'Sign in', primary: true, onClick: () => doSignIn() }],
  });
}

async function doSignIn() {
  try {
    await store.auth.signIn();
    if (!S.id) S.id = uid();
    S.dirty = true;
    scheduleSave();
    toast('Signed in · your mapping is now saved automatically', 'success');
  } catch { toast('Sign-in was cancelled', 'warn'); }
}

/* ======================= How it works ======================= */

function howDialog() {
  const row = (k, d) => `<div class="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"><span>${d}</span><span class="flex gap-1">${k.map((x) => `<kbd>${x}</kbd>`).join('')}</span></div>`;
  modal({
    title: 'How it works',
    wide: true,
    body: `
    <ol class="space-y-2 mb-4 text-[13px] list-decimal pl-4">
      <li>Pick a <b>source</b> and a <b>target</b> System — these are the survey domain models uploaded in Survey Domain Studio, with their technical ids and relations.</li>
      <li>Select a source question, then click one or more target questions to connect them — or drag the handle on the right edge of a source card onto a target. A source can feed 0..n target questions.</li>
      <li>For each connection, map every source answer to 0..n target answers in the panel on the right (list or matrix). Set a fallback for answers with no equivalent.</li>
      <li>Review gaps in the <b>Migration table</b> and export the mapping as JSON or CSV.</li>
    </ol>
    <div class="text-xs text-gray-500 mt-3">Response types follow this Studio's schema${LEGACY_TYPES.length ? `; legacy values (${LEGACY_TYPES.join(', ')}) are accepted and flagged` : ''}.</div>
    <div class="text-xs font-medium text-gray-500 mt-3 mb-1">Keyboard</div>
    ${row(['Ctrl', 'Z'], 'Undo')}${row(['Ctrl', 'Shift', 'Z'], 'Redo')}${row(['Esc'], 'Close panel / clear selection')}${row(['Del'], 'Remove the open connection')}${row(['/'], 'Search source questions')}`,
    actions: [{ label: 'Got it', primary: true }],
  });
}

/* ======================= Boot ======================= */

function bindChrome() {
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('[data-pane]').forEach((b) => b.addEventListener('click', () => { S.mobilePane = b.dataset.pane; update(); }));
  const ub = $('#undoBtn'); if (ub) ub.addEventListener('click', undo);
  const rb = $('#redoBtn'); if (rb) rb.addEventListener('click', redo);
  const sb = $('#suggestBtn'); if (sb) sb.addEventListener('click', suggestDialog);
  const eb = $('#exportBtn'); if (eb) eb.addEventListener('click', (e) => exportMenu(e.currentTarget));
  const mb = $('#moreBtn');
  if (mb) mb.addEventListener('click', (e) => menu(e.currentTarget, [
    { label: 'New mapping', icon: 'file-plus', onClick: newProject },
    { label: 'Saved mappings…', icon: 'folder-open', onClick: projectsDialog },
    { label: 'Import mapping or dataset…', icon: 'file-input', onClick: importFile },
    '-',
    { label: 'Suggest links', icon: 'sparkles', disabled: !(S.src && S.tgt), onClick: suggestDialog },
    { label: 'Undo', icon: 'undo-2', disabled: !canUndo(), onClick: undo },
    { label: 'Redo', icon: 'redo-2', disabled: !canRedo(), onClick: redo },
    { label: 'Load sample Systems', icon: 'flask-conical', onClick: loadBothSamples },
    '-',
    { label: 'Clear all connections', icon: 'trash', danger: true, disabled: !S.links.length, onClick: () => { commit(() => { S.links = []; S.selLink = null; }); toast('All connections cleared', 'info', { label: 'Undo', onClick: undo }); } },
    { label: 'How it works', icon: 'circle-help', onClick: howDialog },
  ]));
  const nameInp = $('#projectName');
  if (nameInp) {
    nameInp.addEventListener('change', () => { S.name = nameInp.value.trim() || 'Untitled mapping'; nameInp.value = S.name; S.dirty = true; scheduleSave(); });
    nameInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInp.blur(); });
  }

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); store.auth.isSignedIn() ? (S.dirty = true, saveNow()) : doSignIn(); return; }
    if (typing || pickerOpen() || document.querySelector('.fixed.inset-0.z-\\[60\\]')) return;
    if (e.key === 'Escape') {
      closeMenu();
      if (S.selLink) S.selLink = null;
      else { S.activeSrc = null; S.activeTgt = null; }
      update();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.selLink) {
      e.preventDefault(); H.deleteLink(S.selLink);
    } else if (e.key === '/') {
      const s = $('#srcPanel [data-search]');
      if (s) { e.preventDefault(); s.focus(); }
    }
  });

  let rt = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => update()); });
  const area = $('#mapArea');
  if (area && typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleWires).observe(area);
  window.addEventListener('beforeunload', (e) => { if (S.dirty && S.links.length && !store.auth.isSignedIn()) { e.preventDefault(); e.returnValue = ''; } });
}

function boot() {
  onRender(render);
  onChange(scheduleSave);
  S.id = uid();
  S.types = DEFAULT_TYPES;
  S.filter = { src: { q: '', status: 'all', type: 'all' }, tgt: { q: '', status: 'all', type: 'all' } };
  bindChrome();
  initWires(H);
  update();
  // Open the most recent saved mapping, or a System sent from the Studio.
  (async () => {
    const pick = sessionStorage.getItem('sds.mapping.pick');
    if (pick) {
      sessionStorage.removeItem('sds.mapping.pick');
      try {
        const system = await loadSystem(pick);
        if (system) { applySystem(!S.src ? 'src' : 'tgt', system); return; }
      } catch { /* fall through */ }
    }
    if (!store.auth.isSignedIn()) return;
    try {
      const list = await store.listProjects();
      if (list.length && !S.src && !S.tgt) {
        const p = await store.loadProject(list[0].id);
        if (p) { await openProjectData(p); toast(`Opened “${list[0].name}”`); }
      }
    } catch { /* first run or offline */ }
  })();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
