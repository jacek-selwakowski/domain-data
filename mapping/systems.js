// Access to this app's persisted Systems (same store pattern as store.js).
const INDEX_KEY = 'sds.systems';
const systemKey = (id) => `sds.system.${id}`;

const hasPuter = () => typeof puter !== 'undefined' && !!puter.kv;
const isSignedIn = () => {
  try { return typeof puter !== 'undefined' && puter.auth && !!puter.auth.isSignedIn(); } catch { return false; }
};

// Session fallback — same key the main app's store uses, so both views of the
// same data stay consistent while signed out.
const SESSION_KEY = 'sds.session';
let memory = null;
function loadSession() {
  if (memory) return memory;
  try { memory = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{"index":[],"systems":{}}'); }
  catch { memory = { index: [], systems: {} }; }
  return memory;
}

export async function listSystems() {
  if (hasPuter() && isSignedIn()) {
    try {
      const raw = await puter.kv.get(INDEX_KEY);
      return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch { /* fall through */ }
  }
  return loadSession().index;
}

export async function loadSystem(id) {
  if (hasPuter() && isSignedIn()) {
    const raw = await puter.kv.get(systemKey(id));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
  return loadSession().systems[id] || null;
}
