/* ============================================================================
   Small shared UI helpers: icons, toasts, dom builder, auth box
   ============================================================================ */

// Lucide is loaded in the background so a blocked or slow CDN never delays
// or breaks the app — worst case icons simply don't render.
let createIcons = () => { };
let _icons = {};
import('https://cdn.jsdelivr.net/npm/lucide@latest/+esm')
  .then(lucide => {
    createIcons = lucide.createIcons;
    _icons = lucide.icons;
    try { createIcons({ icons: _icons }); } catch { }
  })
  .catch(() => { /* icons unavailable */ });

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function refreshIcons() {
  try { createIcons({ icons: _icons }); } catch (e) { /* icon lib unavailable */ }
}

export function toast(msg, kind = 'ok') {
  const wrap = $('#toastWrap');
  if (!wrap) return;
  const colors = {
    ok: 'bg-gray-900 text-white',
    err: 'bg-red-700 text-white',
    warn: 'bg-amber-600 text-white',
  };
  const el = h(`<div class="toast px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg max-w-md ${colors[kind] || colors.ok}">${esc(msg)}</div>`);
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

export function fmtBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

// Auth box in the sidebar + mobile drawer: explicit sign-in, never the implicit popup.
export function initAuthBox() {
  const render = () => {
    const boxes = $$('.authbox');
    if (!boxes.length) return;
    if (typeof puter === 'undefined' || !puter.auth) { boxes.forEach(b => b.innerHTML = 'Storage: session only'); return; }
    let signedIn = false;
    try { signedIn = !!puter.auth.isSignedIn(); } catch { signedIn = false; }
    let html;
    if (signedIn) {
      let username = 'user';
      try { username = puter.auth.getUsername() || 'user'; } catch { }
      html = `
        <div class="flex items-center gap-2 text-gray-200 font-medium text-sm"><i data-lucide="circle-check" class="w-4 h-4 text-emerald-400"></i>${esc(username)}</div>
        <button class="btnsignout mt-2 w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs">Sign out</button>`;
    } else {
      html = `
        <div class="text-gray-400 mb-2">Sign in to persist systems in cloud storage.</div>
        <button class="btnsignin w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Sign in</button>`;
    }
    boxes.forEach(b => b.innerHTML = html);
    $$('.btnsignout').forEach(b => b.onclick = async () => {
      try { await puter.auth.signOut(); } catch { }
      render();
      window.dispatchEvent(new CustomEvent('sds:storage-changed'));
    });
    $$('.btnsignin').forEach(b => b.onclick = async () => {
      try { await puter.auth.signIn(); } catch (e) { toast('Sign-in cancelled', 'warn'); }
      render();
      window.dispatchEvent(new CustomEvent('sds:storage-changed'));
    });
    refreshIcons();
  };
  render();
  window.addEventListener('sds:storage-changed', render);
  return render;
}

export function confirmDialog(message) {
  // lightweight promise-based confirm styled by the app
  return new Promise((resolve) => {
    const ok = window.confirm(message);
    resolve(ok);
  });
}
