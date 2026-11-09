// Small UI helpers: escaping, icons, toasts, modals, dropdown menus.
import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/+esm';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function paintIcons() {
  createIcons({ icons, attrs: { 'stroke-width': 1.75 } });
}

export const ic = (name, cls = 'w-4 h-4') => `<i data-lucide="${name}" class="${cls}"></i>`;

export function toast(msg, kind = 'info', action = null) {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  const tone = kind === 'error' ? 'text-red-400' : kind === 'success' ? 'text-emerald-400' : kind === 'warn' ? 'text-amber-400' : 'text-indigo-300';
  const icon = kind === 'error' ? 'circle-alert' : kind === 'success' ? 'circle-check' : kind === 'warn' ? 'triangle-alert' : 'info';
  el.className = 'toast pointer-events-auto flex items-center gap-2.5 bg-zinc-900 text-white text-sm rounded-lg pl-3.5 pr-2 py-2 max-w-md';
  el.innerHTML = `<span class="${tone} shrink-0">${ic(icon)}</span><span class="leading-snug pr-1.5">${esc(msg)}</span>${action ? `<button class="shrink-0 text-indigo-300 hover:text-white font-medium text-[13px] px-2 py-1 rounded-md hover:bg-white/10">${esc(action.label)}</button>` : ''}`;
  wrap.appendChild(el);
  while (wrap.children.length > 3) wrap.firstChild.remove();
  if (action) el.querySelector('button').addEventListener('click', () => { action.onClick(); el.remove(); });
  paintIcons();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, action ? 5000 : 3200);
}

export function modal({ title, body = '', actions = [], wide = false, onMount }) {
  const root = document.createElement('div');
  root.className = 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6';
  root.innerHTML = `
    <div class="absolute inset-0 bg-zinc-900/40 fade-in" data-close></div>
    <div class="relative bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-2xl sm:rounded-2xl border border-zinc-200 flex flex-col max-h-[90vh] pop-in">
      <div class="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 class="text-[15px] font-semibold">${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Close">${ic('x')}</button>
      </div>
      <div class="px-5 pb-4 overflow-y-auto text-sm text-zinc-600" data-body>${body}</div>
      ${actions.length ? `<div class="flex justify-end gap-2 px-5 py-3 border-t border-zinc-100">${actions.map((a, i) =>
        `<button data-act="${i}" class="btn ${a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : ''}">${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
  document.body.appendChild(root);
  const close = () => { root.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const a = actions[+b.dataset.act];
    const r = a.onClick ? await a.onClick(root) : undefined;
    if (r !== false) close();
  }));
  paintIcons();
  onMount?.(root, close);
  return { root, close };
}

let openMenu = null;
export function menu(anchor, items, align = 'right') {
  closeMenu();
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'menu fixed z-[70] bg-white border border-zinc-200 rounded-xl py-1.5 min-w-[220px] pop-in';
  el.innerHTML = items.map((it, i) => it === '-' ? '<div class="my-1.5 border-t border-zinc-100"></div>'
    : it.header ? `<div class="px-3 pt-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">${esc(it.header)}</div>`
    : `<button data-i="${i}" ${it.disabled ? 'disabled' : ''} class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent ${it.danger ? 'text-red-600' : 'text-zinc-700'}">
        ${it.icon ? `<span class="${it.danger ? '' : 'text-zinc-400'}">${ic(it.icon)}</span>` : ''}<span class="flex-1">${esc(it.label)}</span>${it.hint ? `<span class="text-xs text-zinc-400">${esc(it.hint)}</span>` : ''}
      </button>`).join('');
  document.body.appendChild(el);
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let left = align === 'right' ? r.right - w : r.left;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  let top = r.bottom + 6;
  if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    closeMenu();
    items[+b.dataset.i].onClick?.();
  });
  paintIcons();
  openMenu = el;
  setTimeout(() => document.addEventListener('pointerdown', outside), 0);
}
function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
export function closeMenu() {
  openMenu?.remove();
  openMenu = null;
  document.removeEventListener('pointerdown', outside);
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}

export function timeAgo(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}
