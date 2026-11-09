// Migration table view: flattened answer-level migration plan.
import { S } from './state.js';
import { tableRows, typeMeta } from './model.js';
import { esc, ic, $ } from './ui.js';

let q = '';
let onlyIssues = false;

export function renderTable(H) {
  const el = $('#tableView');
  if (!S.src || !S.tgt || !S.links.length) {
    el.innerHTML = `<div class="flex-1 flex items-center justify-center p-8"><div class="text-center max-w-sm">
      <div class="w-11 h-11 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto mb-4">${ic('table-2', 'w-5 h-5')}</div>
      <h3 class="text-sm font-semibold">No migration rules yet</h3>
      <p class="text-[13px] text-zinc-500 mt-1">Load both survey models and connect questions in the Map view. Every answer-level rule will be listed here.</p>
      <button class="btn mt-4" data-go-map>${ic('waypoints')}Go to map</button></div></div>`;
    el.querySelector('[data-go-map]').addEventListener('click', () => H.setView('map'));
    return;
  }
  let rows = tableRows(S);
  const ql = q.trim().toLowerCase();
  if (ql) rows = rows.filter((r) => [r.sCode, r.sLabel, r.tCode, r.tLabel, r.sAns?.desc, r.tAns?.desc, r.sAns?.code, r.tAns?.code].some((v) => String(v ?? '').toLowerCase().includes(ql)));
  if (onlyIssues) rows = rows.filter((r) => !r.tAns || r.viaFallback || r.info.status !== 'ok');

  const focused = document.activeElement?.dataset?.tsearch !== undefined;
  let prev = null;
  el.innerHTML = `
  <div class="shrink-0 bg-white border-b border-zinc-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2">
    <div class="relative w-full sm:w-72">
      <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">${ic('search', 'w-3.5 h-3.5')}</span>
      <input class="input" data-tsearch placeholder="Search rules…" value="${esc(q)}">
    </div>
    <label class="inline-flex items-center gap-2 text-[13px] text-zinc-600 cursor-pointer select-none">
      <input type="checkbox" data-issues ${onlyIssues ? 'checked' : ''} class="accent-indigo-600 w-3.5 h-3.5">Only gaps &amp; warnings
    </label>
    <span class="text-xs text-zinc-400 sm:ml-2">${rows.length} rule${rows.length === 1 ? '' : 's'}</span>
    <div class="ml-auto flex gap-2">
      <button class="btn" data-csv>${ic('file-spreadsheet')}Export CSV</button>
    </div>
  </div>
  <div class="flex-1 min-h-0 overflow-auto scroll-thin bg-white">
    <table class="dtable min-w-[880px]">
      <thead><tr>
        <th class="w-[24%]">Source question</th><th class="w-[18%]">Source answer</th><th class="w-6"></th>
        <th class="w-[24%]">Target question</th><th class="w-[18%]">Target answer</th><th>Status</th>
      </tr></thead>
      <tbody>${rows.map((r) => {
        const first = prev !== r.link.id;
        prev = r.link.id;
        const st = !r.tAns ? ['Unmapped', 'text-amber-700 bg-amber-50'] : r.viaFallback ? ['Fallback', 'text-zinc-600 bg-zinc-100'] : r.info.status === 'warn' ? ['Review', 'text-amber-700 bg-amber-50'] : ['OK', 'text-emerald-700 bg-emerald-50'];
        const ans = (a) => a ? `<span class="font-mono text-[11px] text-zinc-400 mr-1.5">${esc(a.code)}</span><span class="text-zinc-800">${esc(a.desc)}</span>` : '<span class="text-zinc-400 italic">— not migrated —</span>';
        return `<tr class="${first ? 'grp-start' : ''} cursor-pointer" data-open="${esc(r.link.id)}">
          <td>${first ? `<div class="code">${esc(r.sCode)}</div><div class="text-zinc-800 leading-snug">${esc(r.sLabel)}</div><span class="chip ${typeMeta(r.sq.type).cls} mt-1">${esc(typeMeta(r.sq.type).label)}</span>` : ''}</td>
          <td>${ans(r.sAns)}</td>
          <td class="text-zinc-300">${ic('arrow-right', 'w-3.5 h-3.5')}</td>
          <td>${first ? `<div class="code">${esc(r.tCode)}</div><div class="text-zinc-800 leading-snug">${esc(r.tLabel)}</div><span class="chip ${typeMeta(r.tq.type).cls} mt-1">${esc(typeMeta(r.tq.type).label)}</span>` : ''}</td>
          <td>${ans(r.tAns)}</td>
          <td><span class="inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded ${st[1]}">${st[0]}</span>${first && r.link.note ? `<div class="text-[11px] text-zinc-500 mt-1 line-clamp-2" title="${esc(r.link.note)}">${ic('sticky-note', 'w-3 h-3 inline -mt-0.5 mr-0.5')}${esc(r.link.note)}</div>` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    ${rows.length ? '' : '<div class="text-center text-sm text-zinc-400 py-16">No rules match</div>'}
  </div>`;
  const inp = el.querySelector('[data-tsearch]');
  inp.addEventListener('input', () => { q = inp.value; renderTable(H); H.paint(); });
  if (focused) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
  el.querySelector('[data-issues]').addEventListener('change', (e) => { onlyIssues = e.target.checked; renderTable(H); H.paint(); });
  el.querySelector('[data-csv]').addEventListener('click', () => H.exportCSV());
  el.querySelectorAll('[data-open]').forEach((tr) => tr.addEventListener('click', () => { H.setView('map'); H.openLink(tr.dataset.open); }));
}
