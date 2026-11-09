/* ============================================================================
   Survey Domain Studio — application controller
   ============================================================================ */
import { buildSystemModel, computeStats } from './domain.js';
import { store } from './store.js';
import { $, $$, h, esc, toast, refreshIcons, fmtBytes, fmtDate, confirmDialog, initAuthBox } from './ui.js';
import { ModelView } from './model.js';
import { Editor } from './editors.js';
import { renderDocs } from './docs.js';
import { SAMPLE_DOMAIN } from './sample.js';

class App {
  constructor() {
    this.modelView = new ModelView(this);
    this.editor = new Editor(this);
    this.currentSystem = null;
    this.pendingFile = null; // { name, size, text, data }
    this.nav('upload');
    this.bindNav();
    this.bindUpload();
    this.bindSystems();
    this.bindModel();
    renderDocs();
    initAuthBox();
    refreshIcons();
    window.addEventListener('sds:storage-changed', async () => {
      await store.init();
      await this.refreshSystemsList();
      const banner = $('#storageBanner');
      if (!store.cloud) {
        banner.classList.remove('hidden');
        banner.innerHTML = `<b>Session storage only.</b> ${esc(store.lastNotice || '')} Sign in from the left panel to keep your systems in the cloud.`;
      } else {
        banner.classList.add('hidden');
      }
    });
    this.boot();
  }

  async boot() {
    await store.init();
    await this.refreshSystemsList();
    const banner = $('#storageBanner');
    if (!store.cloud) {
      banner.classList.remove('hidden');
      banner.innerHTML = `<b>Session storage only.</b> ${esc(store.lastNotice || 'Sign in to keep your systems in the cloud.')} You can upload and try everything; data is kept in this browser session.`;
    } else {
      banner.classList.add('hidden');
    }
  }

  // ================= NAVIGATION =================
  bindNav() {
    $$('.navbtn').forEach(b => {
      b.onclick = () => { this.nav(b.getAttribute('data-nav')); this.closeMenu(); };
    });
    const menu = $('#mobileMenu');
    const openBtn = $('#btnMobileMenu');
    const closeBtn = $('#btnCloseMenu');
    const backdrop = $('#mobileMenuBackdrop');
    if (openBtn) openBtn.onclick = () => { if (menu) menu.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
    if (closeBtn) closeBtn.onclick = () => this.closeMenu();
    if (backdrop) backdrop.onclick = () => this.closeMenu();
  }

  closeMenu() {
    const menu = $('#mobileMenu');
    if (menu) menu.classList.add('hidden');
    const editor = $('#editorOverlay');
    if (!editor || editor.classList.contains('hidden')) document.body.style.overflow = '';
  }

  nav(where) {
    for (const s of ['upload', 'systems', 'model', 'docs']) {
      const el = $('#section-' + s);
      if (el) el.classList.toggle('hidden', s !== where);
    }
    $$('.navbtn').forEach(b => b.classList.toggle('active', b.getAttribute('data-nav') === where));
    const titles = { upload: 'Upload System', systems: 'Uploaded Systems', model: 'Model Explorer', docs: 'Persistence Model' };
    const t = $('#mobileTitle');
    if (t) t.textContent = titles[where] || '';
    if (where === 'systems') this.refreshSystemsList();
    if (where === 'model' && this.currentSystem) { this.modelView.render(); }
    window.scrollTo({ top: 0 });
  }

  // ================= 1. UPLOAD =================
  bindUpload() {
    const drop = $('#dropZone');
    const input = $('#fileInput');
    if (!drop || !input) return;
    drop.onclick = () => input.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('border-indigo-400', 'bg-indigo-50/60'); };
    drop.ondragleave = () => drop.classList.remove('border-indigo-400', 'bg-indigo-50/60');
    drop.ondrop = (e) => {
      e.preventDefault();
      drop.classList.remove('border-indigo-400', 'bg-indigo-50/60');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) this.readFile(f);
    };
    input.onchange = () => { if (input.files[0]) this.readFile(input.files[0]); };

    const clearBtn = $('#btnClearFile');
    const importBtn = $('#btnImport');
    const sampleBtn = $('#btnFillSample');
    if (clearBtn) clearBtn.onclick = () => this.clearFile();
    if (importBtn) importBtn.onclick = () => this.importFile();
    if (sampleBtn) sampleBtn.onclick = () => this.loadSample();
  }

  loadSample() {
    try {
      const text = JSON.stringify(SAMPLE_DOMAIN, null, 2);
      this.pendingFile = { name: 'sample-domain.json', size: text.length, text };
      $('#systemName').value = $('#systemName').value || 'PS Survey Dictionary (sample)';
      this.previewFile();
      toast('Sample file loaded — review and press Import');
    } catch (e) {
      toast('Could not load the sample file', 'err');
    }
  }

  readFile(f) {
    if (!/\.json$/i.test(f.name) && f.type !== 'application/json') {
      toast('Please choose a .json file', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.pendingFile = { name: f.name, size: f.size, text: String(reader.result) };
      this.previewFile();
    };
    reader.onerror = () => toast('Could not read the file', 'err');
    reader.readAsText(f, 'utf-8');
  }

  clearFile() {
    this.pendingFile = null;
    $('#fileInput').value = '';
    $('#filePreview').classList.add('hidden');
    $('#reportBox').classList.add('hidden');
    $('#btnImport').disabled = true;
    $('#importHint').textContent = 'Select a valid JSON file to enable import.';
  }

  previewFile() {
    const f = this.pendingFile;
    if (!f) return;
    let pretty = f.text;
    try { pretty = JSON.stringify(JSON.parse(f.text), null, 2); } catch { /* keep raw */ }
    $('#previewName').textContent = f.name;
    $('#previewSize').textContent = fmtBytes(f.size);
    $('#previewBody').textContent = pretty.length > 4000 ? pretty.slice(0, 4000) + '\n… (truncated preview)' : pretty;
    $('#filePreview').classList.remove('hidden');
    $('#btnImport').disabled = false;
    $('#importHint').textContent = 'File loaded. Import will validate and normalize the model.';
    refreshIcons();
  }

  async importFile() {
    const f = this.pendingFile;
    if (!f) return;
    const name = $('#systemName').value.trim();
    if (!name) { toast('Enter a System name first', 'err'); $('#systemName').focus(); return; }

    let data;
    try { data = JSON.parse(f.text); }
    catch (e) { toast('Invalid JSON: ' + e.message, 'err'); return; }

    let result;
    try {
      result = buildSystemModel(data, name, { fileName: f.name });
    } catch (e) {
      this.showReport({ warnings: [e.message], info: [], groups: (Array.isArray(data) ? data.length : 0), skippedSets: Array.isArray(data) ? data.length : 0 }, true);
      toast('Import failed — see the report', 'err');
      return;
    }

    try {
      const stats = computeStats(result.system);
      await store.saveSystem(result.system, stats);
      this.currentSystem = result.system;
      this.modelView.setSystem(result.system);
      await this.refreshSystemsList();
      this.showReport(result.report, false, stats);
      toast(`System "${name}" imported`);
    } catch (e) {
      this.showReport({ warnings: ['Saving failed: ' + (e.message || e)], info: [], groups: result.report.groups, skippedSets: 0 }, true);
      toast('Could not save the system', 'err');
    }
  }

  showReport(report, isError, stats) {
    const box = $('#reportBox');
    const cnt = stats ? stats.counts : null;
    box.className = isError
      ? 'mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed'
      : 'mt-5 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 leading-relaxed';
    box.classList.remove('hidden');
    const items = [];
    if (cnt) {
      items.push(`<div class="font-semibold text-gray-800 mb-1.5">Import summary</div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 mb-2">
          <span>${cnt.sets} question sets</span><span>${cnt.questions} questions</span><span>${cnt.options} options</span>
          <span>${cnt.surveyTypes} survey types</span><span>${cnt.contexts} contexts</span><span>${cnt.responseTypes} response types</span>
        </div>`);
    }
    if (report.skippedSets) items.push(`<div class="text-amber-700">${report.skippedSets} group(s) skipped.</div>`);
    if (report.info && report.info.length) items.push(report.info.map(i => `<div class="text-gray-500">• ${esc(i)}</div>`).join(''));
    if (report.warnings && report.warnings.length) items.push(`<div class="font-semibold mt-2 mb-1 text-amber-700">Warnings (${report.warnings.length})</div>` + report.warnings.map(w => `<div class="text-amber-700">• ${esc(w)}</div>`).join(''));
    if (!isError && cnt) items.push(`<div class="mt-2"><button id="btnOpenImported" class="btn btn-primary btn-sm">Open system model</button></div>`);
    box.innerHTML = items.join('');
    if (!isError && cnt) {
      $('#btnOpenImported').onclick = () => { this.nav('model'); this.modelView.render(); };
    }
  }

  // ================= 2. SYSTEMS LIST =================
  bindSystems() {
    const b = $('#btnGotoUpload');
    if (b) b.onclick = () => this.nav('upload');
  }

  async refreshSystemsList() {
    const list = await store.listSystems();
    $$('.navcount').forEach(el => el.textContent = String(list.length));
    const wrap = $('#systemsList');
    if (!list.length) {
      wrap.innerHTML = `<div class="card p-12 text-center">
        <i data-lucide="database" class="w-8 h-8 text-gray-300 mx-auto"></i>
        <div class="text-sm text-gray-500 mt-3">No systems uploaded yet.</div>
        <button class="btn btn-primary mt-4" onclick="document.querySelector('[data-nav=upload]').click()">Upload the first one</button>
      </div>`;
      refreshIcons();
      return;
    }
    wrap.innerHTML = list.map(e => `
      <div class="card p-5" data-syscard="${esc(e.id)}">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h3 class="font-semibold truncate">${esc(e.name)}</h3>
              <span class="mono">${esc(e.id)}</span>
            </div>
            <div class="text-xs text-gray-400 mt-1">saved ${esc(fmtDate(e.savedAt))}${e.counts ? '' : ''}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost btn-sm" data-view="${esc(e.id)}"><i data-lucide="eye" class="w-3.5 h-3.5"></i>View model</button>
            <button class="btn btn-ghost btn-sm" data-editmeta="${esc(e.id)}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Rename</button>
            <button class="btn btn-danger btn-sm" data-del="${esc(e.id)}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Delete</button>
          </div>
        </div>
        ${e.counts ? `<div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
          ${[['Sets', e.counts.sets], ['Questions', e.counts.questions], ['Options', e.counts.options], ['Survey types', e.counts.surveyTypes], ['Contexts', e.counts.contexts], ['Response types', e.counts.responseTypes]]
            .map(([l, v]) => `<div class="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div class="text-lg font-semibold tabular-nums">${v ?? 0}</div>
              <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">${l}</div>
            </div>`).join('')}
        </div>` : ''}
      </div>`).join('');

    $$('#systemsList [data-view]').forEach(b => b.onclick = () => this.openSystem(b.getAttribute('data-view')));
    $$('#systemsList [data-editmeta]').forEach(b => b.onclick = async () => {
      const sys = await store.loadSystem(b.getAttribute('data-editmeta'));
      if (sys) { this.currentSystem = sys; this.modelView.setSystem(sys); this.editor.editSystem(sys); }
    });
    $$('#systemsList [data-del]').forEach(b => b.onclick = async () => {
      const id = b.getAttribute('data-del');
      const card = $(`#systemsList [data-syscard="${id}"]`);
      const nm = card ? card.querySelector('h3').textContent : 'this system';
      if (!(await confirmDialog(`Delete system "${nm}" and all its data?`))) return;
      await store.deleteSystem(id);
      if (this.currentSystem && this.currentSystem.id === id) { this.currentSystem = null; $('#modelBody').classList.add('hidden'); $('#modelEmpty').classList.remove('hidden'); }
      await this.refreshSystemsList();
      toast('System deleted', 'warn');
    });
    refreshIcons();
  }

  // ================= 3/4. MODEL VIEW + EDIT =================
  bindModel() {
    const backBtn = $('#btnBackToList');
    const exportBtn = $('#btnExport');
    const delBtn = $('#btnDeleteSystem');
    if (backBtn) backBtn.onclick = () => this.nav('systems');
    if (exportBtn) exportBtn.onclick = () => this.exportCurrent();
    if (delBtn) delBtn.onclick = () => {
      if (!this.currentSystem) return;
      const b = $('#systemsList [data-del="' + this.currentSystem.id + '"]');
      if (b) b.click();
      else this.nav('systems');
    };
    const qSearch = $('#qSearch');
    if (qSearch) qSearch.oninput = (e) => { this.modelView.qFilter.s = e.target.value; this.modelView.renderQuestions(); };
    const fst = $('#qFilterSurveyType');
    if (fst) fst.onchange = (e) => { this.modelView.qFilter.st = e.target.value; this.modelView.renderQuestions(); };
    const fctx = $('#qFilterContext');
    if (fctx) fctx.onchange = (e) => { this.modelView.qFilter.ctx = e.target.value; this.modelView.renderQuestions(); };
    const frt = $('#qFilterResponseType');
    if (frt) frt.onchange = (e) => { this.modelView.qFilter.rt = e.target.value; this.modelView.renderQuestions(); };
    const setSearch = $('#setSearch');
    if (setSearch) setSearch.oninput = (e) => { this.modelView.setFilter = e.target.value; this.modelView.renderSets(); refreshIcons(); };

    $$('.tabbtn').forEach(b => {
      b.onclick = () => {
        $$('.tabbtn').forEach(x => x.classList.toggle('active', x === b));
        const t = b.getAttribute('data-tab');
        $$('[data-tabpane]').forEach(p => p.classList.toggle('hidden', p.getAttribute('data-tabpane') !== t));
      };
    });
  }

  async openSystem(id) {
    const sys = await store.loadSystem(id);
    if (!sys) { toast('System not found', 'err'); return; }
    this.currentSystem = sys;
    this.modelView.setSystem(sys);
    this.nav('model');
    this.modelView.render();
  }

  async persistEditedSystem() {
    const sys = this.currentSystem;
    sys.updatedAt = new Date().toISOString();
    // keep set counters exact
    for (const set of sys.QuestionSets) {
      set.questionCount = sys.Questions.filter(q => q.questionSetId === set.id).length;
      set.optionCount = sys.QuestionOptions.filter(o => o.questionSetId === set.id).length;
    }
    await store.saveSystem(sys, computeStats(sys));
    await this.refreshSystemsList();
    this.modelView.setSystem(sys);
    this.modelView.render();
  }

  exportCurrent() {
    const doc = this.modelView.exportDocument();
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.currentSystem.name.replace(/[^\w.-]+/g, '_')}.domain.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Exported in the original schema format');
  }

  // ---- editor entry points ----
  editQuestion(qid) {
    const q = this.currentSystem.Questions.find(x => x.id === qid);
    if (q) this.editor.editQuestion(q, this.currentSystem);
  }
  editOption(optId, setId) {
    if (optId) {
      const o = this.currentSystem.QuestionOptions.find(x => x.id === optId);
      if (o) this.editor.editOption(o, this.currentSystem);
    } else {
      this._addOptSetId = setId;
      this.editor.editOption(null, this.currentSystem);
    }
  }
  editQuestionSet(setId) {
    const s = this.currentSystem.QuestionSets.find(x => x.id === setId);
    if (s) this.editor.editQuestionSet(s, this.currentSystem);
  }
}

// Boot: the module script sits at the end of <body>, so the DOM is ready —
// but guard against both orders so the app always starts exactly once.
function bootApp() {
  if (window.app) return;
  try {
    window.app = new App();
    document.body.setAttribute('data-app-ready', '1');
  } catch (e) {
    document.body.setAttribute('data-app-error', String(e && e.message || e));
    console.error('App failed to start', e);
  }
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootApp, { once: true });
} else {
  bootApp();
}
