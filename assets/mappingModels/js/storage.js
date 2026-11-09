// Cloud persistence via Puter (per-user): project files in puter.fs, index in puter.kv.
const IDX = 'survey-mapper:index';
const DIR = 'survey-mapper';

export const isSignedIn = () => { try { return !!window.puter && puter.auth.isSignedIn(); } catch { return false; } };
export const signIn = () => puter.auth.signIn();
export const signOut = () => puter.auth.signOut();
export const getUser = () => puter.auth.getUser();

async function readIndex() {
  const v = await puter.kv.get(IDX);
  if (!v) return [];
  try { const list = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(list) ? list : []; } catch { return []; }
}
const writeIndex = (list) => puter.kv.set(IDX, JSON.stringify(list));

export async function listProjects() {
  return (await readIndex()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(p) {
  await puter.fs.write(`${DIR}/${p.id}.json`, JSON.stringify(p), { createMissingParents: true, overwrite: true });
  const list = (await readIndex()).filter((x) => x.id !== p.id);
  list.push({ id: p.id, name: p.name, updatedAt: p.updatedAt, source: p.source?.name || null, target: p.target?.name || null, links: p.links.length });
  await writeIndex(list);
}

export async function loadProject(id) {
  const blob = await puter.fs.read(`${DIR}/${id}.json`);
  return JSON.parse(await blob.text());
}

export async function deleteProject(id) {
  try { await puter.fs.delete(`${DIR}/${id}.json`); } catch { /* already gone */ }
  await writeIndex((await readIndex()).filter((x) => x.id !== id));
}
