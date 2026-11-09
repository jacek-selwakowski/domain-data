// Mapping persistence — ALIGNED with Survey Domain Studio's store:
// puter.kv index + puter.kv records (no puter.fs), same session fallback.
// Records reference System ids from this app's persistence layer.

const IDX = 'sds.mappings.index';
const recKey = (id) => `sds.mapping.${id}`;

const hasPuter = () => typeof puter !== 'undefined' && !!puter.kv;
const isSignedIn = () => {
  try { return typeof puter !== 'undefined' && puter.auth && !!puter.auth.isSignedIn(); } catch { return false; }
};

// Session fallback mirrors store.js in the main app.
const SESSION_KEY = 'sds.mappings.session';
let memory = null;
function loadSession() {
  if (memory) return memory;
  try { memory = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{"index":[],"records":{}}'); }
  catch { memory = { index: [], records: {} }; }
  return memory;
}
function saveSession() {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(memory)); } catch { /* quota */ }
}

async function readIndex() {
  if (hasPuter() && isSignedIn()) {
    try {
      const v = await puter.kv.get(IDX);
      if (!v) return [];
      const list = typeof v === 'string' ? JSON.parse(v) : v;
      return Array.isArray(list) ? list : [];
    } catch { /* fall through */ }
  }
  return loadSession().index;
}
async function writeIndex(list) {
  if (hasPuter() && isSignedIn()) {
    await puter.kv.set(IDX, JSON.stringify(list));
    return;
  }
  const m = loadSession();
  m.index = list;
  saveSession();
}

export const auth = {
  isSignedIn,
  signIn: () => puter.auth.signIn(),
  signOut: () => puter.auth.signOut(),
};

export async function listProjects() {
  return (await readIndex()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(p) {
  if (hasPuter() && isSignedIn()) {
    await puter.kv.set(recKey(p.id), JSON.stringify(p));
  } else {
    const m = loadSession();
    m.records[p.id] = p;
    saveSession();
  }
  const list = (await readIndex()).filter((x) => x.id !== p.id);
  list.push({
    id: p.id, name: p.name, updatedAt: p.updatedAt,
    source: p.source?.name || null, target: p.target?.name || null,
    sourceSystemId: p.source?.systemId || null, targetSystemId: p.target?.systemId || null,
    links: p.links.length,
  });
  await writeIndex(list);
}

export async function loadProject(id) {
  if (hasPuter() && isSignedIn()) {
    const raw = await puter.kv.get(recKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
  return loadSession().records[id] || null;
}

export async function deleteProject(id) {
  if (hasPuter() && isSignedIn()) {
    try { await puter.kv.del(recKey(id)); } catch { /* already gone */ }
  } else {
    const m = loadSession();
    delete m.records[id];
    saveSession();
  }
  await writeIndex((await readIndex()).filter((x) => x.id !== id));
}
