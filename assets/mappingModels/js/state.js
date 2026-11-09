// Central application state with undo/redo and a single render hook.
import { normalizeDataset, autoMatchOptions, hasOptions } from './model.js';

export const S = {
  id: null,
  name: 'Untitled mapping',
  src: null,
  tgt: null,
  links: [],
  activeSrc: null,      // question id in source currently focused
  activeTgt: null,      // question id in target currently focused
  selLink: null,        // link id open in inspector
  hover: null,          // { side, id }
  view: 'map',
  mobilePane: 'src',
  filter: { src: { q: '', status: 'all' }, tgt: { q: '', status: 'all' } },
  expanded: new Set(),
  types: [],
  dirty: false,
};

let renderer = () => {};
let changeHook = () => {};
export const onRender = (fn) => { renderer = fn; };
export const onChange = (fn) => { changeHook = fn; };
export const update = () => renderer();

const undoStack = [], redoStack = [];
const snap = () => JSON.stringify(S.links);

export function commit(fn, { silent = false } = {}) {
  const before = snap();
  fn();
  if (snap() !== before) {
    undoStack.push(before);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    S.dirty = true;
    changeHook();
  }
  if (!silent) update();
}
export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(snap());
  S.links = JSON.parse(undoStack.pop());
  fixSelection();
  S.dirty = true; changeHook(); update();
  return true;
}
export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(snap());
  S.links = JSON.parse(redoStack.pop());
  fixSelection();
  S.dirty = true; changeHook(); update();
  return true;
}
export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;
export function resetHistory() { undoStack.length = 0; redoStack.length = 0; }

function fixSelection() {
  if (S.selLink && !S.links.some((l) => l.id === S.selLink)) S.selLink = null;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12);

export function setDataset(side, raw, name) {
  const ds = normalizeDataset(raw, name);
  S[side] = ds;
  S.expanded.clear();
  if (side === 'src') S.activeSrc = null; else S.activeTgt = null;
  return ds;
}

export const linkById = (id) => S.links.find((l) => l.id === id);
export const linksFrom = (sid) => S.links.filter((l) => l.s === sid);
export const linksTo = (tid) => S.links.filter((l) => l.t === tid);

export function toggleLink(sid, tid, { open = true } = {}) {
  const existing = S.links.find((l) => l.s === sid && l.t === tid);
  if (existing) {
    commit(() => { S.links = S.links.filter((l) => l !== existing); if (S.selLink === existing.id) S.selLink = null; });
    return null;
  }
  const sq = S.src.byId.get(sid), tq = S.tgt.byId.get(tid);
  const link = { id: uid(), s: sid, t: tid, opt: autoMatchOptions(sq, tq), fallback: [], note: '' };
  if (!hasOptions(sq) && hasOptions(tq)) link.fallback = [];
  commit(() => { S.links.push(link); if (open) S.selLink = link.id; });
  return link;
}

export function removeLink(id) {
  commit(() => { S.links = S.links.filter((l) => l.id !== id); if (S.selLink === id) S.selLink = null; });
}

export function serializeProject() {
  return {
    id: S.id, name: S.name, updatedAt: Date.now(),
    source: S.src ? { name: S.src.name, data: S.src.raw } : null,
    target: S.tgt ? { name: S.tgt.name, data: S.tgt.raw } : null,
    links: S.links,
  };
}
