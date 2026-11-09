/* ============================================================================
   Persistence layer — Puter.js cloud KV, scoped to the signed-in user.
   Key: "sds.systems" -> index of { id, name, savedAt, stats }
   Key: "sds.system.<id>" -> full normalized model
   ============================================================================ */

const INDEX_KEY = 'sds.systems';
const systemKey = (id) => `sds.system.${id}`;

const hasPuter = () => typeof puter !== 'undefined' && !!puter.kv;
const isSignedIn = () => {
  try { return typeof puter !== 'undefined' && puter.auth && !!puter.auth.isSignedIn(); } catch { return false; }
};

// Session fallback (survives reloads in the same tab, never leaves the browser,
// and is only used until the user signs in — then everything moves to the cloud).
const SESSION_KEY = 'sds.session';
let memory = null;
function loadSession() {
  if (memory) return memory;
  try { memory = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{"index":[],"systems":{}}'); }
    catch { memory = { index: [], systems: {} }; }
  return memory;
}
function saveSession() {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(memory)); } catch { /* quota */ }
}

function fallbackNotice() {
  return 'Not signed in — data is kept only in this browser tab session. Sign in to persist your systems.';
}

// ---- API --------------------------------------------------------------------
export const store = {
  ready: false,
  cloud: false,
  lastNotice: '',

  async init() {
    if (hasPuter() && isSignedIn()) {
      try {
        await puter.kv.get('sds.probe');
        this.cloud = true;
      } catch (e) {
        this.cloud = false;
        this.lastNotice = 'Cloud storage unavailable (' + (e && e.message ? e.message : e) + '). Using session-only storage.';
      }
    } else {
      this.cloud = false;
      this.lastNotice = hasPuter()
        ? 'You are not signed in.'
        : 'Cloud storage (Puter.js) is not available here.';
    }
    loadSession();
    this.ready = true;
    return this.cloud;
  },

  async listSystems() {
    if (this.cloud) {
      try {
        const raw = await puter.kv.get(INDEX_KEY);
        return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      } catch { /* fall through */ }
    }
    return loadSession().index;
  },

  async saveSystem(system, stats) {
    const entry = {
      id: system.id,
      name: system.name,
      savedAt: new Date().toISOString(),
      counts: stats ? stats.counts : null,
    };
    if (this.cloud) {
      await puter.kv.set(systemKey(system.id), JSON.stringify(system));
      const idx = await this.listSystems();
      const next = idx.filter(e => e.id !== system.id).concat(entry).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      await puter.kv.set(INDEX_KEY, JSON.stringify(next));
    } else {
      const m = loadSession();
      m.systems[system.id] = system;
      m.index = [entry, ...m.index.filter(e => e.id !== system.id)];
      saveSession();
    }
    return entry;
  },

  async loadSystem(id) {
    if (this.cloud) {
      const raw = await puter.kv.get(systemKey(id));
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    return loadSession().systems[id] || null;
  },

  async deleteSystem(id) {
    if (this.cloud) {
      await puter.kv.del(systemKey(id));
      const idx = await this.listSystems();
      await puter.kv.set(INDEX_KEY, JSON.stringify(idx.filter(e => e.id !== id)));
    } else {
      const m = loadSession();
      delete m.systems[id];
      m.index = m.index.filter(e => e.id !== id);
      saveSession();
    }
  },

  async updateSystemMeta(system) {
    // persist name/updatedAt changes without a full re-import
    return this.saveSystem(system, computeQuickStats(system));
  },
};

function computeQuickStats(system) {
  return {
    counts: {
      sets: system.QuestionSets.length,
      questions: system.Questions.length,
      options: system.QuestionOptions.length,
      surveyTypes: system.SurveyTypes.length,
      contexts: system.Contexts.length,
      responseTypes: system.ResponseTypes.length,
      processContexts: system.ProcessContexts.length,
    },
  };
}
