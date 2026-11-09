// Inspector: map response options of a connected question pair.
import { S, commit, linkById, removeLink, linksFrom, update } from './state.js';
import { typeMeta, linkInfo, autoMatchOptions, MODE_META, textValue } from './model.js';
import { esc, ic, $, paintIcons, toast, menu } from './ui.js';

let tab = 'list';
let built = null;
let picker = null;

export function renderInspector(H) {
  const el = $('#inspector');
  const link = S.selLink ? linkById(S.selLink) : null;
  document.querySelector('.inspector-backdrop')?.remove();
  if (!link || S.view !== 'map' || !S.src || !S.tgt) { el.classList.add('hidden'); built = null; closePicker(); return; }
  el.classList.remove('hidden');
  if (innerWidth < 1280) {
    const bd = document.createElement('div');
    bd.className = 'inspector-backdrop';
    bd.addEventListener('click', () => { S.selLink = null; update(); });
    el.parentElement.insertBefore(bd, el);
  }
  const sq = S.src.byId.get(link.s), tq = S.tgt.byId.get(link.t);
  const info = linkInfo(link, sq, tq);
  const scroll = el.querySelector('[data-scroll]')?.scrollTop || 0;
  const same = built === link.id;
  el.innerHTML = html(link, sq, tq, info);
  if (same) el.querySelector('[data-scroll]').scrollTop = scroll;
  built = link.id;
  bind(el, link, sq, tq, H);
  paintIcons();
}

function qHeader(label, q) {
  const tm = typeMeta(q.type);
  return `<div class="min-w-0 flex-1 rounded-lg border border-zinc-200 p-2.5">
    <div class="flex items-center gap-1.5"><span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">${label}</span><span class="chip ${tm.cls} ml-auto">${esc(tm.label)}</span></div>
    <div class="code mt-1 truncate" title="${esc(q.code)}">${esc(q.code)}</div>
    <div class="text-[13px] text-zinc-800 leading-snug line-clamp-2 mt-0.5" title="${esc(q.label)}">${esc(q.label)}</div>
  </div>`;
}

function chip(o, sk) {
  return `<span class="tchip ${o.expired ? 'expired' : ''}" title="${esc(o.code)} — ${esc(o.desc)}${o.expired ? ' (expired)' : ''}">
    <span class="font-mono text-[10px] opacity-70">${esc(o.code)}</span><span class="truncate">${esc(o.desc)}</span>
    <button data-rm="${esc(sk)}" data-tk="${esc(o.key)}" aria-label="Remove">${ic('x', 'w-3 h-3')}</button></span>`;
}

function html(link, sq, tq, info) {
  const mm = MODE_META[info.mode];
  const siblings = linksFrom(sq.id).filter((l) => l.id !== link.id);
  let body = '';

  if (info.mode === 'options') {
    const pct = info.total ? Math.round((info.mapped / info.total) * 100) : 0;
    body += `
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="seg">
        <button class="seg-btn" data-tab="list" aria-selected="${tab === 'list'}">${ic('list', 'w-3.5 h-3.5')}List</button>
        <button class="seg-btn" data-tab="matrix" aria-selected="${tab === 'matrix'}">${ic('grid-3x3', 'w-3.5 h-3.5')}Matrix</button>
      </div>
      <div class="flex items-center gap-1">
        <button class="btn btn-sm" data-act="auto" title="Match answers by meaning">${ic('wand-sparkles', 'w-3.5 h-3.5')}Auto-match</button>
        <button class="icon-btn icon-btn-sm" data-act="optmenu" title="More">${ic('ellipsis', 'w-4 h-4')}</button>
      </div>
    </div>
    <div class="flex items-center gap-2 mb-3 text-xs text-zinc-500">
      <div class="bar flex-1"><span style="width:${pct}%"></span></div>
      <span>${info.mapped} of ${info.total} answers mapped</span>
    </div>
    ${tab === 'list' ? listHTML(link, sq, tq) : matrixHTML(link, sq, tq)}
    ${fallbackHTML(link, tq, 'Fallback for unmapped answers', 'Written to the target when a source answer has no mapping.')}`;
  } else if (info.mode === 'toText') {
    const tm = link.textMode || 'desc';
    body += `
    <div class="text-xs font-medium text-zinc-500 mb-1.5">Value written to the text field</div>
    <div class="seg mb-3">
      <button class="seg-btn" data-tm="desc" aria-selected="${tm === 'desc'}">Description</button>
      <button class="seg-btn" data-tm="code" aria-selected="${tm === 'code'}">Code</button>
      <button class="seg-btn" data-tm="both" aria-selected="${tm === 'both'}">Code – description</button>
    </div>
    <div>${sq.options.map((o) => `<div class="resp-row flex items-center gap-2 text-xs">
      <span class="font-mono text-zinc-400 w-12 truncate shrink-0">${esc(o.code)}</span><span class="flex-1 min-w-0 truncate text-zinc-700">${esc(o.desc)}</span>
      ${ic('arrow-right', 'w-3.5 h-3.5 text-zinc-300 shrink-0')}<span class="flex-1 min-w-0 truncate text-indigo-700 font-medium">“${esc(textValue(o, tm))}”</span></div>`).join('')}</div>`;
  } else if (info.mode === 'fromText') {
    body += fallbackHTML(link, tq, 'Value to write', 'Every migrated record receives this target answer. Leave empty to skip and capture the rule in the note.');
  } else {
    body += `<div class="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-xs text-zinc-600 flex gap-2">${ic('info', 'w-4 h-4 text-zinc-400 shrink-0')}
      <span>${info.mode === 'direct' ? 'No response options on either side. The value will be transferred as-is.' : 'The source has predefined answers, but the target expects a structured value. Describe the transformation in the note below.'}</span></div>`;
  }

  return `
  <div class="flex items-center gap-2 px-4 h-12 border-b border-zinc-200 shrink-0">
    <span class="text-indigo-600">${ic(mm.icon)}</span>
    <h2 class="text-sm font-semibold flex-1 truncate">${esc(mm.label)}</h2>
    <button class="icon-btn" data-act="swap" title="Focus questions in panels">${ic('locate-fixed')}</button>
    <button class="icon-btn hover:!text-red-600" data-act="delete" title="Remove connection (Del)">${ic('trash-2')}</button>
    <button class="icon-btn" data-act="close" title="Close (Esc)">${ic('x')}</button>
  </div>
  <div class="flex-1 min-h-0 overflow-y-auto scroll-thin p-4" data-scroll>
    <div class="flex items-stretch gap-2">
      ${qHeader('Source', sq)}
      <div class="flex items-center text-zinc-300">${ic('arrow-right')}</div>
      ${qHeader('Target', tq)}
    </div>
    <p class="text-xs text-zinc-500 mt-2.5">${esc(mm.desc)}</p>
    ${info.warnings.length ? `<div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">${info.warnings.map((w) =>
      `<div class="flex gap-2 text-xs text-amber-800">${ic('triangle-alert', 'w-3.5 h-3.5 shrink-0 mt-px')}<span>${esc(w)}</span></div>`).join('')}</div>` : ''}
    <div class="mt-4">${body}</div>
    <div class="mt-5">
      <label class="text-xs font-medium text-zinc-500" for="linkNote">Migration note</label>
      <textarea id="linkNote" rows="3" class="mt-1.5 w-full border border-zinc-200 rounded-lg p-2.5 text-[13px] resize-y" placeholder="Transformation rules, assumptions, open questions…">${esc(link.note || '')}</textarea>
    </div>
    ${siblings.length ? `<div class="mt-4">
      <div class="text-xs font-medium text-zinc-500 mb-1.5">This source question also migrates to</div>
      ${siblings.map((l) => { const q = S.tgt.byId.get(l.t); return `<button data-goto="${esc(l.id)}" class="w-full flex items-center gap-2 text-left text-xs px-2.5 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 mb-1.5"><span class="code">${esc(q.code)}</span><span class="truncate flex-1 text-zinc-700">${esc(q.label)}</span>${ic('chevron-right', 'w-3.5 h-3.5 text-zinc-400')}</button>`; }).join('')}
    </div>` : ''}
  </div>`;
}

function listHTML(link, sq, tq) {
  return `<div>${sq.options.map((o) => {
    const ts = (link.opt[o.key] || []).map((k) => tq.optByKey.get(k)).filter(Boolean);
    return `<div class="resp-row ${ts.length ? '' : 'unmapped'}">
      <div class="flex items-center gap-2 text-xs">
        <span class="font-mono text-zinc-400 shrink-0 max-w-[60px] truncate" title="${esc(o.code)}">${esc(o.code)}</span>
        <span class="flex-1 min-w-0 text-zinc-800 font-medium ${o.expired ? 'line-through text-zinc-400' : ''}">${esc(o.desc)}</span>
        ${ts.length ? '' : '<span class="text-[10px] text-amber-700 font-medium shrink-0">Unmapped</span>'}
      </div>
      <div class="flex flex-wrap items-center gap-1 mt-1.5 pl-0">
        ${ic('corner-down-right', 'w-3.5 h-3.5 text-zinc-300 shrink-0 mr-0.5')}
        ${ts.map((t) => chip(t, o.key)).join('')}
        <button class="add-chip" data-add="${esc(o.key)}">${ic('plus', 'w-3 h-3')}${ts.length ? 'Add' : 'Map answer'}</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function matrixHTML(link, sq, tq) {
  return `<div class="border border-zinc-200 rounded-lg overflow-auto max-h-[420px] scroll-thin">
    <table class="matrix">
      <thead><tr><th class="text-left text-[11px] text-zinc-400 font-medium p-2 align-bottom min-w-[150px]">Source ↓ / Target →</th>
        ${tq.options.map((t) => `<th title="${esc(t.code)} — ${esc(t.desc)}"><div class="vhead ${t.expired ? 'text-orange-600' : 'text-zinc-600'}">${esc(t.desc)}</div></th>`).join('')}
      </tr></thead>
      <tbody>${sq.options.map((o) => {
        const set = new Set(link.opt[o.key] || []);
        return `<tr><th class="px-2 py-1 max-w-[180px]"><div class="truncate text-zinc-700" title="${esc(o.desc)}"><span class="font-mono text-[10px] text-zinc-400 mr-1">${esc(o.code)}</span>${esc(o.desc)}</div></th>
          ${tq.options.map((t) => `<td class="mcell ${set.has(t.key) ? 'on' : ''}" data-cell="${esc(o.key)}" data-tk="${esc(t.key)}"><span class="dot">${set.has(t.key) ? ic('check', 'w-3 h-3') : ''}</span></td>`).join('')}
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function fallbackHTML(link, tq, title, sub) {
  const fb = (link.fallback || []).map((k) => tq.optByKey.get(k)).filter(Boolean);
  return `<div class="mt-4 rounded-lg border border-dashed border-zinc-200 p-3">
    <div class="text-xs font-medium text-zinc-700">${esc(title)}</div>
    <div class="text-[11px] text-zinc-400 mt-0.5">${esc(sub)}</div>
    <div class="flex flex-wrap items-center gap-1 mt-2">
      ${fb.map((t) => chip(t, '__fb')).join('')}
      <button class="add-chip" data-add="__fb">${ic('plus', 'w-3 h-3')}${fb.length ? 'Add' : 'Choose answer'}</button>
    </div>
  </div>`;
}

function getKeys(link, sk) { return sk === '__fb' ? (link.fallback || []) : (link.opt[sk] || []); }
function setKeys(link, sk, keys) {
  if (sk === '__fb') link.fallback = keys;
  else if (keys.length) link.opt[sk] = keys;
  else delete link.opt[sk];
}

function toggleKey(linkId, sk, tk) {
  commit(() => {
    const l = linkById(linkId);
    const cur = getKeys(l, sk);
    setKeys(l, sk, cur.includes(tk) ? cur.filter((k) => k !== tk) : [...cur, tk]);
  });
}

function bind(el, link, sq, tq, H) {
  const id = link.id;
  el.querySelector('[data-act="close"]').addEventListener('click', () => { S.selLink = null; update(); });
  el.querySelector('[data-act="delete"]').addEventListener('click', () => H.deleteLink(id));
  el.querySelector('[data-act="swap"]').addEventListener('click', () => H.focusLink(id));
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderInspector(H); }));
  el.querySelectorAll('[data-tm]').forEach((b) => b.addEventListener('click', () => commit(() => { linkById(id).textMode = b.dataset.tm; })));
  el.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => H.openLink(b.dataset.goto)));
  el.querySelector('[data-act="auto"]')?.addEventListener('click', () => {
    const m = autoMatchOptions(sq, tq, 0.34);
    let n = 0;
    commit(() => {
      const l = linkById(id);
      Object.entries(m).forEach(([sk, tks]) => { if (!(l.opt[sk] || []).length) { l.opt[sk] = tks; n++; } });
    });
    toast(n ? `Auto-matched ${n} answer${n > 1 ? 's' : ''}` : 'No additional confident matches found', n ? 'success' : 'info');
  });
  el.querySelector('[data-act="optmenu"]')?.addEventListener('click', (e) => menu(e.currentTarget, [
    { label: 'Match by identical code', icon: 'hash', onClick: () => {
      let n = 0;
      commit(() => { const l = linkById(id); sq.options.forEach((o) => { const t = tq.options.find((x) => String(x.code) === String(o.code)); if (t && !(l.opt[o.key] || []).length) { l.opt[o.key] = [t.key]; n++; } }); });
      toast(n ? `Matched ${n} answer${n > 1 ? 's' : ''} by code` : 'No identical codes found');
    } },
    { label: 'Match by position', icon: 'list-ordered', onClick: () => {
      commit(() => { const l = linkById(id); sq.options.forEach((o, i) => { const t = tq.options[i]; if (t && !(l.opt[o.key] || []).length) l.opt[o.key] = [t.key]; }); });
    } },
    '-',
    { label: 'Clear all answer mappings', icon: 'eraser', danger: true, onClick: () => commit(() => { const l = linkById(id); l.opt = {}; l.fallback = []; }) },
  ]));
  el.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); toggleKey(id, b.dataset.rm, b.dataset.tk); }));
  el.querySelectorAll('[data-cell]').forEach((c) => c.addEventListener('click', () => toggleKey(id, c.dataset.cell, c.dataset.tk)));
  el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openPicker(b, id, b.dataset.add, sq, tq); }));
  const note = el.querySelector('#linkNote');
  note.addEventListener('change', () => commit(() => { linkById(id).note = note.value; }, { silent: true }));
}

/* ---------- Target answer picker (multi-select popover) ---------- */

function closePicker() {
  if (!picker) return;
  picker.el.remove();
  document.removeEventListener('pointerdown', picker.outside, true);
  document.removeEventListener('keydown', picker.key, true);
  picker = null;
}

function openPicker(anchor, linkId, sk, sq, tq) {
  closePicker();
  const el = document.createElement('div');
  el.className = 'fixed z-[70] bg-white border border-zinc-200 rounded-xl w-[300px] pop-in';
  const srcOpt = sk === '__fb' ? null : sq.optByKey.get(sk);
  let q = '', kb = 0;
  const multiOk = tq.type === 'MULTI' || sk === '__fb';
  el.innerHTML = `
    <div class="p-2 border-b border-zinc-100">
      <div class="text-[11px] text-zinc-400 px-1 pb-1.5 truncate">${srcOpt ? `Map “${esc(srcOpt.desc)}” to` : 'Choose target answer'}</div>
      <div class="relative"><span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">${ic('search', 'w-3.5 h-3.5')}</span>
      <input class="input" placeholder="Search ${tq.options.length} answers…" data-q></div>
    </div>
    <div class="picker-list p-1.5 scroll-thin" data-items></div>
    <div class="px-3 py-2 border-t border-zinc-100 text-[11px] text-zinc-400 flex items-center justify-between">
      <span>${multiOk ? 'Select one or more' : 'Target accepts one answer'}</span><span><kbd>↵</kbd> toggle · <kbd>Esc</kbd></span>
    </div>`;
  document.body.appendChild(el);
  const rect = anchor.getBoundingClientRect();
  const w = 300;
  el.style.left = Math.max(8, Math.min(rect.left, innerWidth - w - 8)) + 'px';
  const h = Math.min(380, el.offsetHeight || 380);
  el.style.top = (rect.bottom + 6 + h > innerHeight ? Math.max(8, rect.top - h - 6) : rect.bottom + 6) + 'px';

  const items = el.querySelector('[data-items]');
  const input = el.querySelector('[data-q]');
  let list = [];
  const draw = () => {
    const cur = new Set(getKeys(linkById(linkId), sk));
    const ql = q.toLowerCase();
    list = tq.options.filter((o) => !ql || o.desc.toLowerCase().includes(ql) || String(o.code).toLowerCase().includes(ql) || o.norm.toLowerCase().includes(ql));
    kb = Math.min(kb, Math.max(0, list.length - 1));
    items.innerHTML = list.length ? list.map((o, i) => `<button class="picker-item ${cur.has(o.key) ? 'on' : ''} ${i === kb ? 'kb' : ''}" data-k="${esc(o.key)}">
      <span class="check">${cur.has(o.key) ? ic('check', 'w-3 h-3') : ''}</span>
      <span class="font-mono text-[11px] text-zinc-400 w-10 truncate shrink-0">${esc(o.code)}</span>
      <span class="flex-1 min-w-0 truncate ${o.expired ? 'text-zinc-400' : 'text-zinc-800'}">${esc(o.desc)}</span>
      ${o.expired ? '<span class="text-[10px] text-orange-600 shrink-0">expired</span>' : ''}
    </button>`).join('') : '<div class="text-xs text-zinc-400 text-center py-6">No answers match</div>';
    paintIcons();
  };
  const choose = (k) => {
    toggleKey(linkId, sk, k);
    if (!S.selLink || !multiOk) { closePicker(); return; }
    draw();
  };
  items.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) choose(b.dataset.k); });
  input.addEventListener('input', () => { q = input.value; kb = 0; draw(); });
  const key = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closePicker(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); kb = Math.min(kb + 1, list.length - 1); draw(); items.querySelector('.kb')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); kb = Math.max(kb - 1, 0); draw(); items.querySelector('.kb')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && list[kb]) { e.preventDefault(); choose(list[kb].key); }
  };
  const outside = (e) => { if (!el.contains(e.target)) closePicker(); };
  document.addEventListener('keydown', key, true);
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  picker = { el, outside, key };
  draw();
  input.focus();
}

export const pickerOpen = () => !!picker;
