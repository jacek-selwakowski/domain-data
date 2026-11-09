// App orchestration: rendering, interactions, loading, export, persistence.
import { S, onRender, onChange, update, commit, undo, redo, canUndo, canRedo, resetHistory, setDataset, toggleLink, linkById, uid, serializeProject } from './state.js';
import { DEFAULT_TYPES, validateDataset, linkInfo, suggestLinks, buildMapping, applyMapping, tableRows, toCSV, typeMeta, similarQuestions, autoMatchOptions } from './model.js';
import { renderPanel, resetPanel, scrollToCard } from './panels.js';
import { scheduleWires, drawWires, initWires } from './wires.js';
import { renderInspector, pickerOpen } from './inspector.js';
import { renderTable } from './table.js';
import * as store from './storage.js';
import { $, $$, esc, ic, paintIcons, toast, modal, menu, closeMenu, download, pickFile, timeAgo } from './ui.js';

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
    el.querySelector('[data-act="file"]').addEventListener('click', async () => { const f = await pickFile(); if (f) loadFile(side, f); });
    el.querySelector('[data-act="paste"]').addEventListener('click', () => pasteDialog(side));
    el.querySelector('[data-act="sample"]').addEventListener('click', () => loadSample(side));
    const dz = el.querySelector('[data-drop]');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('over');
      const f = e.dataTransfer.files[0];
      if (f) loadFile(side, f);
    });
  },

  datasetMenu(anchor, side) {
    const ds = S[side];
    const groups = ds.groups.length, opts = ds.groups.reduce((n, g) => n + g.options.length, 0);
    menu(anchor, [
      { header: `${ds.questions.length} questions · ${groups} response sets · ${opts} answers` },
      { label: 'Replace with file…', icon: 'upload', onClick: async () => { const f = await pickFile(); if (f) loadFile(side, f); } },
      { label: 'Replace by pasting JSON…', icon: 'clipboard', onClick: () => pasteDialog(side) },
      { label: 'Download dataset', icon: 'download', onClick: () => download(`${slug(ds.name)}.json`, JSON.stringify(ds.raw, null, 2)) },
      { label: side === 'src' ? 'Expand all questions' : 'Expand all questions', icon: 'chevrons-up-down', onClick: () => { ds.questions.forEach((q) => S.expanded.add(`${side}:${q.id}`)); update(); } },
      { label: 'Collapse all', icon: 'chevrons-down-up', onClick: () => { [...S.expanded].filter((k) => k.startsWith(side + ':')).forEach((k) => S.expanded.delete(k)); update(); } },
      '-',
      { label: 'Unload dataset', icon: 'x-circle', danger: true, onClick: () => unloadDataset(side) },
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
    if (S.activeSrc) {
      H.connect(S.activeSrc, id);
      return;
    }
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
    S.filter.src.q = ''; S.filter.tgt.q = ''; S.filter.src.status = 'all'; S.filter.tgt.status = 'all';
    S.filter.src.type = 'all'; S.filter.tgt.type = 'all';
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
  $('#undoBtn').disabled = !canUndo();
  $('#redoBtn').disabled = !canRedo();
  $('#suggestBtn').disabled = !(S.src && S.tgt);
  paintIcons();
  drawWires();
}

function renderStats() {
  const el = $('#stats');
  if (!S.src || !S.tgt) {
    el.innerHTML = `<span class="flex items-center gap-1.5">${ic('info', 'w-3.5 h-3.5')}Load a source and a target survey model to start mapping.</span>
      ${!S.src && !S.tgt ? `<button class="ml-auto text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap" data-samples>Load both sample datasets</button>` : ''}`;
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
  const item = (icon, label, val, cls = '') => `<span class="flex items-center gap-1.5 whitespace-nowrap">${ic(icon, 'w-3.5 h-3.5 text-zinc-400')}${label}<b class="font-semibold text-zinc-800 ${cls}">${val}</b></span>`;
  el.innerHTML = `
    ${item('arrow-up-from-line', 'Source mapped', `${srcMapped}/${S.src.questions.length}`)}
    ${item('arrow-down-to-line', 'Target covered', `${tgtCovered}/${S.tgt.questions.length}`)}
    ${item('cable', 'Connections', S.links.length)}
    ${item('list-checks', 'Answers mapped', ans ? `${ansMapped}/${ans}` : '—')}
    <button class="flex items-center gap-1.5 whitespace-nowrap hover:text-zinc-800" data-issues>${ic('triangle-alert', `w-3.5 h-3.5 ${warn ? 'text-amber-500' : 'text-zinc-400'}`)}Needs review<b class="font-semibold ${warn ? 'text-amber-600' : 'text-zinc-800'}">${warn}</b></button>
    <span class="ml-auto hidden lg:flex items-center gap-1.5 text-zinc-400 whitespace-nowrap">${S.activeSrc ? `${ic('mouse-pointer-click', 'w-3.5 h-3.5')}Click target questions to connect · <kbd>Esc</kbd> to stop` : `${ic('mouse-pointer-click', 'w-3.5 h-3.5')}Select a source question, or drag its handle onto a target`}</span>`;
  el.querySelector('[data-issues]').addEventListener('click', () => reviewIssues());
}

function reviewIssues() {
  const issues = S.links.map((l) => ({ l, i: linkInfo(l, S.src.byId.get(l.s), S.tgt.byId.get(l.t)) })).filter((x) => x.i.status !== 'ok');
  const unmappedSrc = S.src.questions.filter((q) => !S.links.some((l) => l.s === q.id));
  modal({
    title: 'Review',
    wide: true,
    body: `
      <div class="text-xs font-medium text-zinc-500 mb-2">Connections needing attention · ${issues.length}</div>
      ${issues.length ? issues.map(({ l, i }) => { const sq = S.src.byId.get(l.s), tq = S.tgt.byId.get(l.t); return `
        <button data-open="${esc(l.id)}" class="w-full text-left border border-zinc-200 rounded-lg p-2.5 mb-1.5 hover:bg-zinc-50">
          <div class="flex items-center gap-2 text-xs"><span class="code">${esc(sq.code)}</span>${ic('arrow-right', 'w-3 h-3 text-zinc-300')}<span class="code">${esc(tq.code)}</span><span class="truncate text-zinc-700">${esc(sq.label)}</span></div>
          <div class="text-xs text-amber-700 mt-1">${i.warnings.map(esc).join(' ') || 'No answers mapped yet.'}</div>
        </button>`; }).join('') : '<div class="text-xs text-zinc-400 mb-3">All connections look good.</div>'}
      <div class="text-xs font-medium text-zinc-500 mt-4 mb-2">Source questions not migrated · ${unmappedSrc.length}</div>
      <div class="flex flex-wrap gap-1">${unmappedSrc.slice(0, 80).map((q) => `<button data-src="${esc(q.id)}" class="text-xs px-2 py-1 rounded-md border border-zinc-200 hover:bg-zinc-50" title="${esc(q.label)}"><span class="font-mono text-zinc-500">${esc(q.code)}</span></button>`).join('')}${unmappedSrc.length > 80 ? `<span class="text-xs text-zinc-400 px-2 py-1">+${unmappedSrc.length - 80} more</span>` : ''}</div>`,
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

function setView(v) {
  S.view = v;
  update();
}

/* ======================= Loading datasets ======================= */

async function parseText(text) {
  try { return JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
}

async function loadFile(side, file) {
  try {
    const data = await parseText(await file.text());
    applyDataset(side, data, file.name.replace(/\.json$/i, ''));
  } catch (e) { toast(e.message, 'error'); }
}

function applyDataset(side, data, name) {
  const { errors, warnings, more } = validateDataset(data, S.types);
  if (errors.length) {
    modal({
      title: 'Dataset does not match DomainSchema',
      body: `<p class="mb-3">Fix these issues and try again:</p><ul class="space-y-1.5">${errors.map((e) => `<li class="flex gap-2 text-xs text-red-700">${ic('circle-x', 'w-3.5 h-3.5 shrink-0 mt-px')}<span>${esc(e)}</span></li>`).join('')}</ul>${more ? '<p class="text-xs text-zinc-400 mt-2">…and more</p>' : ''}`,
      actions: [{ label: 'Close', primary: true }],
    });
    return false;
  }
  const hadLinks = S.links.length;
  setDataset(side, data, name);
  resetPanel(side);
  S.filter[side] = { q: '', status: 'all', type: 'all' };
  const dropped = reconcileLinks();
  if (S.selLink && !linkById(S.selLink)) S.selLink = null;
  S.dirty = true;
  scheduleSave();
  update();
  const ds = S[side];
  let msg = `Loaded ${ds.questions.length} questions into ${side === 'src' ? 'source' : 'target'}`;
  if (hadLinks && dropped) msg += ` · ${dropped} connection${dropped > 1 ? 's' : ''} removed`;
  toast(msg, 'success');
  if (warnings.length) setTimeout(() => toast(`${warnings.length} schema warning${warnings.length > 1 ? 's' : ''}: ${warnings[0]}`, 'warn'), 400);
  return true;
}

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

function pasteDialog(side) {
  modal({
    title: `Paste ${side === 'src' ? 'source' : 'target'} dataset`,
    wide: true,
    body: `<input data-name class="w-full h-9 border border-zinc-200 rounded-lg px-3 text-sm mb-2" placeholder="Dataset name" value="${side === 'src' ? 'Source system' : 'Target system'}">
      <textarea data-json rows="12" class="w-full border border-zinc-200 rounded-lg p-3 font-mono text-xs" placeholder='[ { "ResponseType": "SINGLE", "ResponseOptions": [...], "QuestionSet": [...] } ]'></textarea>`,
    actions: [{ label: 'Cancel' }, {
      label: 'Load', primary: true, onClick: async (root) => {
        try {
          const data = await parseText(root.querySelector('[data-json]').value);
          return applyDataset(side, data, root.querySelector('[data-name]').value.trim() || 'Pasted dataset');
        } catch (e) { toast(e.message, 'error'); return false; }
      },
    }],
    onMount: (root) => root.querySelector('[data-json]').focus(),
  });
}

async function loadSample(side) {
  try {
    const url = side === 'src' ? 'assets/samples/ps-survey.json' : 'assets/samples/rds-survey.json';
    const data = await (await fetch(url)).json();
    applyDataset(side, data, side === 'src' ? 'PS – KYC survey' : 'RDS – Risk survey');
  } catch (e) { toast('Could not load sample dataset', 'error'); }
}
async function loadBothSamples() { await loadSample('src'); await loadSample('tgt'); }

/* ======================= Suggestions ======================= */

function suggestDialog() {
  if (!S.src || !S.tgt) return;
  const list = suggestLinks(S.src, S.tgt, S.links);
  if (!list.length) { toast('No new confident suggestions — all similar questions are already connected'); return; }
  const chosen = new Set(list.filter((x) => x.score >= 0.55).map((_, i) => i));
  modal({
    title: 'Suggested connections',
    wide: true,
    body: `<p class="text-xs text-zinc-500 mb-3">Based on similarity of question labels, normalized subjects and response types. Answers are auto-matched when accepted.</p>
      <div class="flex items-center justify-between mb-2 text-xs"><span class="text-zinc-500" data-cnt></span>
      <span class="flex gap-3"><button class="text-indigo-600 font-medium" data-all>Select all</button><button class="text-zinc-500" data-none>Clear</button></span></div>
      <div class="space-y-1.5" data-list>${list.map((x, i) => { const sq = S.src.byId.get(x.s), tq = S.tgt.byId.get(x.t); const pct = Math.round(x.score * 100); return `
        <label class="flex items-center gap-3 border border-zinc-200 rounded-lg p-2.5 cursor-pointer hover:bg-zinc-50">
          <input type="checkbox" data-i="${i}" class="accent-indigo-600 w-4 h-4 shrink-0" ${chosen.has(i) ? 'checked' : ''}>
          <div class="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div class="min-w-0"><div class="code truncate">${esc(sq.code)}</div><div class="text-xs text-zinc-800 truncate" title="${esc(sq.label)}">${esc(sq.label)}</div></div>
            <span class="text-zinc-300">${ic('arrow-right', 'w-3.5 h-3.5')}</span>
            <div class="min-w-0"><div class="code truncate">${esc(tq.code)}</div><div class="text-xs text-zinc-800 truncate" title="${esc(tq.label)}">${esc(tq.label)}</div></div>
          </div>
          <span class="text-[11px] font-medium px-1.5 py-0.5 rounded ${pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-sky-50 text-sky-700' : 'bg-zinc-100 text-zinc-600'} shrink-0">${pct}%</span>
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
    { label: 'Full project (re-openable)', icon: 'package', disabled: !(S.src || S.tgt), onClick: () => download(`${slug(S.name)}.project.json`, JSON.stringify({ format: 'survey-mapper-project', ...serializeProject() }, null, 2)) },
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
  try { json = JSON.parse(await f.text()); } catch (e) { return toast('Invalid JSON file', 'error'); }
  if (json.format === 'survey-mapper-project') return openProjectData(json);
  if (json.format === 'survey-migration-mapping' || Array.isArray(json.mappings)) {
    if (!S.src || !S.tgt) return toast('Load both survey models before importing a mapping', 'warn');
    const { links, skipped } = applyMapping(json, S.src, S.tgt, uid);
    let added = 0;
    commit(() => links.forEach((l) => { if (!S.links.some((x) => x.s === l.s && x.t === l.t)) { S.links.push(l); added++; } }));
    toast(`Imported ${added} connection${added === 1 ? '' : 's'}${skipped ? ` · ${skipped} skipped (questions not found)` : ''}`, skipped ? 'warn' : 'success');
    return;
  }
  toast('Unrecognised file. Expected a mapping or project export.', 'error');
}

function openProjectData(p) {
  S.id = p.id || uid();
  S.name = p.name || 'Untitled mapping';
  S.src = null; S.tgt = null;
  if (p.source?.data) setDataset('src', p.source.data, p.source.name);
  if (p.target?.data) setDataset('tgt', p.target.data, p.target.name);
  S.links = Array.isArray(p.links) ? p.links : [];
  reconcileLinks();
  S.selLink = null; S.activeSrc = null; S.activeTgt = null;
  S.filter = { src: { q: '', status: 'all', type: 'all' }, tgt: { q: '', status: 'all', type: 'all' } };
  resetPanel('src'); resetPanel('tgt'); resetHistory();
  $('#projectName').value = S.name;
  S.dirty = false;
  setSaveStatus(p.updatedAt ? `Saved ${timeAgo(p.updatedAt)}` : 'Not saved');
  update();
}

function newProject() {
  const go = () => openProjectData({ id: uid(), name: 'Untitled mapping', links: [] });
  if (S.links.length && S.dirty && !store.isSignedIn()) {
    modal({ title: 'Start a new mapping?', body: 'Unsaved connections in the current mapping will be lost.', actions: [{ label: 'Cancel' }, { label: 'New mapping', danger: true, onClick: go }] });
  } else go();
}

/* ======================= Cloud save ======================= */

let saveTimer = 0, saving = false;
function setSaveStatus(t) { $('#saveStatus').textContent = t; }

function scheduleSave() {
  if (!store.isSignedIn()) { setSaveStatus(S.dirty ? 'Unsaved · sign in to save' : 'Not saved'); return; }
  setSaveStatus('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1200);
}

async function saveNow() {
  if (!store.isSignedIn() || saving) return;
  if (!S.src && !S.tgt && !S.links.length) { setSaveStatus('Not saved'); return; }
  saving = true;
  try {
    if (!S.id) S.id = uid();
    await store.saveProject(serializeProject());
    S.dirty = false;
    setSaveStatus('Saved');
  } catch (e) {
    setSaveStatus('Save failed');
    toast('Could not save to cloud', 'error');
  } finally { saving = false; }
}

async function projectsDialog() {
  if (!store.isSignedIn()) return signInPrompt('Sign in to save mappings to your cloud and open them from any device.');
  const m = modal({ title: 'Saved mappings', wide: true, body: `<div class="py-8 text-center text-xs text-zinc-400">Loading…</div>` });
  let list = [];
  try { list = await store.listProjects(); } catch { list = null; }
  const body = m.root.querySelector('[data-body]');
  if (!body.isConnected) return;
  if (list === null) { body.innerHTML = '<div class="py-8 text-center text-xs text-red-600">Could not load saved mappings.</div>'; return; }
  body.innerHTML = list.length ? `<div class="space-y-1.5">${list.map((p) => `
    <div class="flex items-center gap-3 border ${p.id === S.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-zinc-200'} rounded-lg p-3">
      <div class="w-9 h-9 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0">${ic('waypoints')}</div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium text-zinc-900 truncate">${esc(p.name)}${p.id === S.id ? ' <span class="text-[11px] text-indigo-600 font-normal">· current</span>' : ''}</div>
        <div class="text-xs text-zinc-500 truncate">${esc(p.source || '—')} → ${esc(p.target || '—')} · ${p.links} connection${p.links === 1 ? '' : 's'} · ${timeAgo(p.updatedAt)}</div>
      </div>
      <button class="btn btn-sm" data-open="${esc(p.id)}">Open</button>
      <button class="icon-btn icon-btn-sm hover:!text-red-600" data-del="${esc(p.id)}" title="Delete">${ic('trash-2', 'w-3.5 h-3.5')}</button>
    </div>`).join('')}</div>` : `<div class="py-10 text-center"><div class="text-sm font-medium text-zinc-700">No saved mappings yet</div><div class="text-xs text-zinc-400 mt-1">Your work is saved automatically while you're signed in.</div></div>`;
  paintIcons();
  body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Opening…';
    try { openProjectData(await store.loadProject(b.dataset.open)); m.close(); toast('Mapping opened', 'success'); }
    catch { toast('Could not open mapping', 'error'); b.disabled = false; b.textContent = 'Open'; }
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
    await store.signIn();
    await refreshAccount();
    if (!S.id) S.id = uid();
    S.dirty = true;
    scheduleSave();
    toast('Signed in · your mapping is now saved automatically', 'success');
  } catch { toast('Sign-in was cancelled', 'warn'); }
}

async function refreshAccount() {
  const btn = $('#accountBtn');
  if (store.isSignedIn()) {
    let name = '';
    try { name = (await store.getUser()).username; } catch { /* ignore */ }
    btn.innerHTML = `<span class="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center uppercase">${esc((name || '?')[0])}</span><span class="hidden sm:inline max-w-[100px] truncate">${esc(name)}</span>`;
    btn.classList.add('pl-1');
    if (!S.dirty) setSaveStatus(S.id ? 'Saved' : 'Not saved');
  } else {
    btn.innerHTML = `${ic('log-in', 'w-3.5 h-3.5')}<span>Sign in</span>`;
    btn.classList.remove('pl-1');
    setSaveStatus(S.dirty ? 'Unsaved · sign in to save' : 'Not saved');
  }
  paintIcons();
}

/* ======================= Shortcuts dialog ======================= */

function shortcutsDialog() {
  const row = (k, d) => `<div class="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0"><span>${d}</span><span class="flex gap-1">${k.map((x) => `<kbd>${x}</kbd>`).join('')}</span></div>`;
  modal({
    title: 'How it works',
    wide: true,
    body: `
    <ol class="space-y-2 mb-4 text-[13px] list-decimal pl-4">
      <li>Load the <b>source</b> model (system you migrate from) and the <b>target</b> model (system you migrate to).</li>
      <li>Select a source question, then click one or more target questions to connect them — or drag the handle on the right edge of a source card onto a target. A source can feed 0..n target questions.</li>
      <li>For each connection, map every source answer to 0..n target answers in the panel on the right (list or matrix). Set a fallback for answers with no equivalent.</li>
      <li>Review gaps in the <b>Migration table</b> and export the mapping as JSON or CSV.</li>
    </ol>
    <div class="text-xs font-medium text-zinc-500 mb-1">Keyboard</div>
    ${row(['Ctrl', 'Z'], 'Undo')}${row(['Ctrl', 'Shift', 'Z'], 'Redo')}${row(['Esc'], 'Close panel / clear selection')}${row(['Del'], 'Remove the open connection')}${row(['/'], 'Search source questions')}`,
    actions: [{ label: 'Got it', primary: true }],
  });
}

/* ======================= Boot ======================= */

function bindChrome() {
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('[data-pane]').forEach((b) => b.addEventListener('click', () => { S.mobilePane = b.dataset.pane; update(); }));
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#suggestBtn').addEventListener('click', suggestDialog);
  $('#exportBtn').addEventListener('click', (e) => exportMenu(e.currentTarget));
  $('#accountBtn').addEventListener('click', (e) => {
    if (!store.isSignedIn()) return doSignIn();
    menu(e.currentTarget, [
      { label: 'Saved mappings', icon: 'folder-open', onClick: projectsDialog },
      { label: 'Save now', icon: 'cloud-upload', onClick: () => { S.dirty = true; saveNow(); } },
      '-',
      { label: 'Sign out', icon: 'log-out', onClick: () => { store.signOut(); refreshAccount(); toast('Signed out'); } },
    ]);
  });
  $('#moreBtn').addEventListener('click', (e) => menu(e.currentTarget, [
    { label: 'New mapping', icon: 'file-plus', onClick: newProject },
    { label: 'Saved mappings…', icon: 'folder-open', onClick: projectsDialog },
    { label: 'Import mapping or project…', icon: 'file-input', onClick: importFile },
    '-',
    { label: 'Suggest links', icon: 'sparkles', disabled: !(S.src && S.tgt), onClick: suggestDialog },
    { label: 'Undo', icon: 'undo-2', disabled: !canUndo(), onClick: undo },
    { label: 'Redo', icon: 'redo-2', disabled: !canRedo(), onClick: redo },
    { label: 'Load sample datasets', icon: 'flask-conical', onClick: loadBothSamples },
    { label: 'Download DomainSchema', icon: 'braces', onClick: async () => download('DomainSchema.json', await (await fetch('assets/DomainSchema.json')).text()) },
    '-',
    { label: 'Clear all connections', icon: 'trash', danger: true, disabled: !S.links.length, onClick: () => { commit(() => { S.links = []; S.selLink = null; }); toast('All connections cleared', 'info', { label: 'Undo', onClick: undo }); } },
    { label: 'How it works', icon: 'circle-help', onClick: shortcutsDialog },
  ]));
  const nameInp = $('#projectName');
  nameInp.addEventListener('change', () => { S.name = nameInp.value.trim() || 'Untitled mapping'; nameInp.value = S.name; S.dirty = true; scheduleSave(); });
  nameInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInp.blur(); });

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); store.isSignedIn() ? (S.dirty = true, saveNow()) : doSignIn(); return; }
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
  new ResizeObserver(scheduleWires).observe($('#mapArea'));
  window.addEventListener('beforeunload', (e) => { if (S.dirty && S.links.length && !store.isSignedIn()) { e.preventDefault(); e.returnValue = ''; } });
}

async function loadSchemaTypes() {
  try {
    const schema = await (await fetch('assets/DomainSchema.json')).json();
    const en = schema?.items?.properties?.ResponseType?.enum;
    S.types = Array.isArray(en) && en.length ? en : DEFAULT_TYPES;
  } catch { S.types = DEFAULT_TYPES; }
}

async function boot() {
  onRender(render);
  onChange(scheduleSave);
  S.id = uid();
  S.filter = { src: { q: '', status: 'all', type: 'all' }, tgt: { q: '', status: 'all', type: 'all' } };
  bindChrome();
  initWires(H);
  await loadSchemaTypes();
  update();
  refreshAccount();
  if (store.isSignedIn()) {
    try {
      const list = await store.listProjects();
      if (list.length && !S.src && !S.tgt) {
        openProjectData(await store.loadProject(list[0].id));
        toast(`Opened “${list[0].name}”`, 'info');
      }
    } catch { /* first run or offline */ }
  }
}

boot();
