// SVG connection lines between source and target question cards, plus drag-to-connect.
import { S } from './state.js';
import { linkInfo } from './model.js';
import { $ } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
let raf = 0;
let drag = null;

export function scheduleWires() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(drawWires);
}

function anchor(card, listRect, areaRect, side) {
  const r = card.getBoundingClientRect();
  let y = r.top + 24;
  let clipped = false;
  if (y < listRect.top + 4) { y = listRect.top + 4; clipped = true; }
  if (y > listRect.bottom - 4) { y = listRect.bottom - 4; clipped = true; }
  const x = side === 'src' ? r.right : r.left;
  return { x: x - areaRect.left, y: y - areaRect.top, clipped };
}

const curve = (a, b) => {
  const dx = Math.max(40, (b.x - a.x) * 0.5);
  return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
};

export function drawWires() {
  const svg = $('#wires');
  if (!svg || S.view !== 'map' || !S.src || !S.tgt || innerWidth < 768) { if (svg) svg.innerHTML = ''; return; }
  const area = $('#mapArea').getBoundingClientRect();
  const sList = $('#srcPanel [data-list]'), tList = $('#tgtPanel [data-list]');
  if (!sList || !tList) { svg.innerHTML = ''; return; }
  const sRect = sList.getBoundingClientRect(), tRect = tList.getBoundingClientRect();
  const sCards = new Map([...sList.querySelectorAll('.qcard')].map((c) => [c.dataset.id, c]));
  const tCards = new Map([...tList.querySelectorAll('.qcard')].map((c) => [c.dataset.id, c]));

  const focus = S.hover || (S.activeSrc ? { side: 'src', id: S.activeSrc } : S.activeTgt ? { side: 'tgt', id: S.activeTgt } : null);
  let out = '';
  const ends = [];
  S.links.forEach((l) => {
    const sc = sCards.get(l.s), tc = tCards.get(l.t);
    if (!sc || !tc) return;
    const a = anchor(sc, sRect, area, 'src'), b = anchor(tc, tRect, area, 'tgt');
    if (a.clipped && b.clipped && ((a.y < sRect.top - area.top + 10 && b.y < tRect.top - area.top + 10) || (a.y > sRect.bottom - area.top - 10 && b.y > tRect.bottom - area.top - 10))) return;
    const info = linkInfo(l, S.src.byId.get(l.s), S.tgt.byId.get(l.t));
    const cls = ['wire'];
    if (info.status === 'warn') cls.push('warn');
    if (info.status === 'empty') cls.push('empty');
    const isFocus = focus && ((focus.side === 'src' && focus.id === l.s) || (focus.side === 'tgt' && focus.id === l.t));
    if (S.selLink === l.id) cls.push('sel');
    else if (isFocus) cls.push('hl');
    else if (focus || S.selLink) cls.push('dim');
    const d = curve(a, b);
    const op = a.clipped || b.clipped ? ' style="opacity:.35"' : '';
    out += `<path class="wire-hit" data-link="${l.id}" d="${d}"></path><path class="${cls.join(' ')}" data-link="${l.id}" d="${d}"${op}></path>`;
    if (!b.clipped) ends.push(b);
  });
  if (drag?.to) out += `<path class="drag" d="${curve(drag.from, drag.to)}"></path>`;
  svg.innerHTML = out;
}

export function initWires(H) {
  const svg = $('#wires');
  svg.addEventListener('click', (e) => {
    const p = e.target.closest('[data-link]');
    if (p) H.openLink(p.dataset.link);
  });
  svg.addEventListener('pointerover', (e) => {
    const p = e.target.closest('path.wire-hit');
    if (!p) return;
    const l = S.links.find((x) => x.id === p.dataset.link);
    if (l) svg.querySelector(`path.wire[data-link="${l.id}"]`)?.classList.add('hl');
  });
  svg.addEventListener('pointerout', (e) => {
    const p = e.target.closest('path.wire-hit');
    if (p && S.selLink !== p.dataset.link) svg.querySelector(`path.wire[data-link="${p.dataset.link}"]`)?.classList.remove('hl');
  });

  // Drag from a source port to a target card.
  $('#srcPanel').addEventListener('pointerdown', (e) => {
    const port = e.target.closest('[data-port]');
    if (!port || !S.tgt) return;
    e.preventDefault();
    const card = port.closest('.qcard');
    const area = $('#mapArea').getBoundingClientRect();
    const pr = port.getBoundingClientRect();
    drag = { sid: card.dataset.id, from: { x: pr.left + pr.width / 2 - area.left, y: pr.top + pr.height / 2 - area.top }, to: null, over: null };
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';
    const move = (ev) => {
      const a = $('#mapArea').getBoundingClientRect();
      drag.to = { x: ev.clientX - a.left, y: ev.clientY - a.top };
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('#tgtPanel .qcard');
      if (drag.over !== under) { drag.over?.classList.remove('is-drop'); under?.classList.add('is-drop'); drag.over = under; }
      // Auto-scroll target list when near edges.
      const list = $('#tgtPanel [data-list]');
      const lr = list.getBoundingClientRect();
      if (ev.clientX > lr.left) {
        if (ev.clientY < lr.top + 40) list.scrollTop -= 12;
        else if (ev.clientY > lr.bottom - 40) list.scrollTop += 12;
      }
      drawWires();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const target = drag.over;
      target?.classList.remove('is-drop');
      const sid = drag.sid;
      drag = null;
      if (target) H.connect(sid, target.dataset.id);
      drawWires();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}
