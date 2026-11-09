// Source / target question panels.
import { S, linksFrom, linksTo, update } from './state.js';
import { typeMeta, hasOptions, linkInfo } from './model.js';
import { esc, ic, $ } from './ui.js';

const built = { src: null, tgt: null };
const SIDE_LABEL = { src: 'Source', tgt: 'Target' };

export function resetPanel(side) { built[side] = null; }

export function renderPanel(side, H) {
  const el = $(side === 'src' ? '#srcPanel' : '#tgtPanel');
  const ds = S[side];
  if (!ds) {
    if (built[side] !== 'empty') {
      el.innerHTML = emptyHTML(side);
      built[side] = 'empty';
      H.bindEmpty(el, side);
    }
    return;
  }
  if (built[side] !== ds) {
    el.innerHTML = skeletonHTML(side, ds);
    built[side] = ds;
    bindPanel(el, side, H);
  }
  const visible = filtered(side, ds);
  const linked = side === 'src' ? new Set(S.links.map((l) => l.s)) : new Set(S.links.map((l) => l.t));
  el.querySelector('[data-count]').textContent = `${linked.size}/${ds.questions.length} ${side === 'src' ? 'mapped' : 'receiving data'}`;
  el.querySelector('[data-bar]').style.width = `${ds.questions.length ? (linked.size / ds.questions.length) * 100 : 0}%`;
  const list = el.querySelector('[data-list]');
  list.innerHTML = visible.length ? visible.map((q) => cardHTML(side, q)).join('')
    : `<div class="text-center text-sm text-zinc-400 py-16">${ic('search-x', 'w-5 h-5 mx-auto mb-2')}No questions match the filters</div>`;
}

function filtered(side, ds) {
  const f = S.filter[side];
  const q = f.q.trim().toLowerCase();
  return ds.questions.filter((x) => {
    if (f.type && f.type !== 'all' && x.type !== f.type) return false;
    if (f.status !== 'all') {
      const n = side === 'src' ? linksFrom(x.id).length : linksTo(x.id).length;
      if (f.status === 'mapped' && !n) return false;
      if (f.status === 'unmapped' && n) return false;
    }
    if (!q) return true;
    return String(x.code).toLowerCase().includes(q) || x.label.toLowerCase().includes(q) || x.norm.toLowerCase().includes(q)
      || x.options.some((o) => o.desc.toLowerCase().includes(q) || String(o.code).toLowerCase() === q);
  });
}

function emptyHTML(side) {
  return `
  <div class="panel-head h-12 px-4 flex items-center gap-2 shrink-0">
    <span class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">${SIDE_LABEL[side]}</span>
  </div>
  <div class="flex-1 p-4 flex">
    <div class="dropzone flex-1 flex flex-col items-center justify-center text-center px-6 py-10" data-drop>
      <div class="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">${ic(side === 'src' ? 'database' : 'database-zap', 'w-5 h-5')}</div>
      <h3 class="text-sm font-semibold text-zinc-900">Load ${side === 'src' ? 'source' : 'target'} survey model</h3>
      <p class="text-[13px] text-zinc-500 mt-1 max-w-[260px]">${side === 'src' ? 'The system you are migrating data from.' : 'The system that will receive the migrated data.'} Drop a DomainSchema JSON file here.</p>
      <div class="flex flex-wrap justify-center gap-2 mt-5">
        <button class="btn btn-primary" data-act="file">${ic('upload')}Upload JSON</button>
        <button class="btn" data-act="paste">${ic('clipboard')}Paste</button>
      </div>
      <button class="mt-3 text-[13px] text-indigo-600 hover:text-indigo-700 font-medium" data-act="sample">Use sample ${side === 'src' ? 'PS' : 'RDS'} dataset</button>
    </div>
  </div>`;
}

function skeletonHTML(side, ds) {
  const types = [...new Set(ds.questions.map((q) => q.type))];
  const f = S.filter[side];
  return `
  <div class="panel-head px-3 sm:px-4 pt-2.5 pb-3 shrink-0">
    <div class="flex items-center gap-2 h-8">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">${SIDE_LABEL[side]}</span>
      <button class="min-w-0 flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 rounded-md px-1.5 py-0.5" data-act="dsmenu" title="Dataset options">
        <span class="truncate">${esc(ds.name)}</span>${ic('chevron-down', 'w-3.5 h-3.5 text-zinc-400 shrink-0')}
      </button>
      <span class="ml-auto text-xs text-zinc-500 whitespace-nowrap" data-count></span>
    </div>
    <div class="bar mt-1.5 mb-2.5"><span data-bar style="width:0"></span></div>
    <div class="flex gap-2">
      <div class="relative flex-1 min-w-0">
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">${ic('search', 'w-3.5 h-3.5')}</span>
        <input class="input" data-search placeholder="Search ${ds.questions.length} questions…" value="${esc(f.q)}">
      </div>
      <select class="sel" data-status aria-label="Status filter">
        <option value="all">All</option>
        <option value="mapped" ${f.status === 'mapped' ? 'selected' : ''}>${side === 'src' ? 'Mapped' : 'Linked'}</option>
        <option value="unmapped" ${f.status === 'unmapped' ? 'selected' : ''}>${side === 'src' ? 'Unmapped' : 'Unlinked'}</option>
      </select>
      <select class="sel hidden sm:block" data-type aria-label="Type filter">
        <option value="all">All types</option>
        ${types.map((t) => `<option value="${esc(t)}" ${f.type === t ? 'selected' : ''}>${esc(typeMeta(t).label)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="qlist flex-1 min-h-0 scroll-thin" data-list data-side="${side}"></div>`;
}

function bindPanel(el, side, H) {
  el.querySelector('[data-act="dsmenu"]').addEventListener('click', (e) => H.datasetMenu(e.currentTarget, side));
  el.querySelector('[data-search]').addEventListener('input', (e) => { S.filter[side].q = e.target.value; update(); });
  el.querySelector('[data-status]').addEventListener('change', (e) => { S.filter[side].status = e.target.value; update(); });
  el.querySelector('[data-type]').addEventListener('change', (e) => { S.filter[side].type = e.target.value; update(); });
  const list = el.querySelector('[data-list]');
  list.addEventListener('scroll', () => H.onScroll(), { passive: true });
  list.addEventListener('click', (e) => {
    const linkBtn = e.target.closest('[data-link]');
    if (linkBtn) { e.stopPropagation(); H.openLink(linkBtn.dataset.link); return; }
    const exp = e.target.closest('[data-expand]');
    const card = e.target.closest('.qcard');
    if (!card) return;
    const id = card.dataset.id;
    if (exp) {
      e.stopPropagation();
      const k = `${side}:${id}`;
      S.expanded.has(k) ? S.expanded.delete(k) : S.expanded.add(k);
      update();
      return;
    }
    H.cardClick(side, id);
  });
  list.addEventListener('pointerover', (e) => {
    const card = e.target.closest('.qcard');
    const h = card ? { side, id: card.dataset.id } : null;
    if ((h?.id || null) !== (S.hover?.side === side ? S.hover.id : null)) { S.hover = h; H.onHover(); }
  });
  list.addEventListener('pointerleave', () => { if (S.hover) { S.hover = null; H.onHover(); } });
}

function cardHTML(side, q) {
  const tm = typeMeta(q.type);
  const links = side === 'src' ? linksFrom(q.id) : linksTo(q.id);
  const sel = S.selLink ? S.links.find((l) => l.id === S.selLink) : null;
  const cls = ['qcard'];
  if (side === 'src') {
    if (S.activeSrc === q.id) cls.push('is-active');
    if ((S.activeTgt && links.some((l) => l.t === S.activeTgt)) || (sel && sel.s === q.id && S.activeSrc !== q.id)) cls.push('is-linked-to-active');
  } else {
    if (S.activeTgt === q.id) cls.push('is-active');
    else if (S.activeSrc) cls.push(links.some((l) => l.s === S.activeSrc) ? 'is-linked-to-active' : 'is-candidate');
    else if (sel && sel.t === q.id) cls.push('is-linked-to-active');
  }
  const expanded = S.expanded.has(`${side}:${q.id}`);
  const other = side === 'src' ? S.tgt : S.src;

  let linkChips = '';
  if (links.length && other) {
    linkChips = `<div class="flex flex-wrap gap-1 mt-2">${links.map((l) => {
      const oq = other.byId.get(side === 'src' ? l.t : l.s);
      const info = linkInfo(l, S.src.byId.get(l.s), S.tgt.byId.get(l.t));
      const dot = info.status === 'ok' ? 'bg-emerald-500' : info.status === 'warn' ? 'bg-amber-400' : 'bg-zinc-300';
      const prog = info.mode === 'options' ? `<span class="text-zinc-400">${info.mapped}/${info.total}</span>` : '';
      return `<button data-link="${esc(l.id)}" class="max-w-full inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-md border ${S.selLink === l.id ? 'border-indigo-400 bg-indigo-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'} text-[11px] text-zinc-700">
        <span class="w-1.5 h-1.5 rounded-full ${dot} shrink-0"></span>
        ${side === 'src' ? ic('arrow-right', 'w-3 h-3 text-zinc-400 shrink-0') : ic('arrow-left', 'w-3 h-3 text-zinc-400 shrink-0')}
        <span class="font-mono shrink-0">${esc(oq?.code)}</span><span class="truncate max-w-[140px]">${esc(oq?.label)}</span>${prog}
      </button>`;
    }).join('')}</div>`;
  }

  let detail = '';
  if (expanded) {
    const meta = [];
    const r = q.raw;
    if (q.norm) meta.push(['Normalized', esc(q.norm)]);
    if (r.SurveyCode) meta.push(['Survey', esc(r.SurveyCode)]);
    if (Array.isArray(r.SurveyType) && r.SurveyType.length) meta.push(['Segments', r.SurveyType.map(esc).join(', ')]);
    if (Array.isArray(r.Context) && r.Context.length) meta.push(['Context', r.Context.map(esc).join(', ')]);
    if (r.PersonalContext !== undefined) meta.push(['Personal', esc(r.PersonalContext)]);
    if (r.pp_code_question !== undefined) meta.push(['Legacy code', `<span class="font-mono">${esc(r.pp_code_question)}</span>`]);
    if (Array.isArray(r.Notes) && r.Notes.length) meta.push(['Notes', r.Notes.map(esc).join('<br>')]);
    if (Array.isArray(r.QuestionDescription)) r.QuestionDescription.forEach((d) => meta.push([esc(d.key), esc(d.value)]));
    if (q.group.qids.length > 1) meta.push(['Shared set', `${q.group.qids.length} questions share these responses`]);
    detail = `<div class="mt-3 pt-3 border-t border-zinc-100 space-y-3" data-noclick>
      ${q.options.length ? `<div>
        <div class="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mb-1">Responses · ${q.options.length}</div>
        <div>${q.options.map((o) => `<div class="opt-row"><span class="font-mono text-[11px] text-zinc-500 w-12 shrink-0 truncate" title="${esc(o.code)}">${esc(o.code)}</span><span class="flex-1 text-zinc-700 ${o.expired ? 'line-through text-zinc-400' : ''}">${esc(o.desc)}</span>${o.expired ? `<span class="text-[10px] text-orange-600">ended ${esc(o.end)}</span>` : ''}${o.pp !== undefined ? `<span class="font-mono text-[10px] text-zinc-400" title="Legacy code">pp ${esc(o.pp)}</span>` : ''}</div>`).join('')}</div>
      </div>` : `<div class="text-xs text-zinc-400 flex items-center gap-1.5">${ic('text-cursor-input', 'w-3.5 h-3.5')}No predefined responses — ${q.type === 'TEXT' ? 'free text' : 'structured value'}</div>`}
      ${meta.length ? `<dl class="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-xs">${meta.map(([k, v]) => `<dt class="text-zinc-400">${k}</dt><dd class="text-zinc-600 break-words">${v}</dd>`).join('')}</dl>` : ''}
    </div>`;
  }

  const port = side === 'src'
    ? `<span class="port right ${links.length ? 'on' : ''}" data-port title="Drag to a target question"></span>`
    : `<span class="port left ${links.length ? 'on' : ''}"></span>`;

  return `<div class="${cls.join(' ')}" data-id="${esc(q.id)}" data-side="${side}">
    ${port}
    <div class="p-3">
      <div class="flex items-center gap-2">
        <span class="code truncate" title="${esc(q.code)}">${esc(q.code)}</span>
        <span class="chip ${tm.cls}">${esc(tm.label)}</span>
        ${q.options.length ? `<span class="text-[11px] text-zinc-400">${q.options.length} opt</span>` : ''}
        <button class="icon-btn icon-btn-sm ml-auto -mr-1 -my-1 text-zinc-400" data-expand title="${expanded ? 'Collapse' : 'Show details'}">${ic(expanded ? 'chevron-up' : 'chevron-down', 'w-4 h-4')}</button>
      </div>
      <div class="mt-1.5 text-[13px] leading-snug text-zinc-800 ${expanded ? '' : 'line-clamp-2'}">${esc(q.label)}</div>
      ${linkChips}
      ${detail}
    </div>
  </div>`;
}

export function scrollToCard(side, id) {
  const card = document.querySelector(`#${side}Panel .qcard[data-id="${CSS.escape(id)}"]`);
  card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function hasLinks(side, id) { return side === 'src' ? linksFrom(id).length > 0 : linksTo(id).length > 0; }
export { hasOptions };
