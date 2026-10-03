// Storage: a single JSON file in a private GitHub repo, updated through the
// GitHub Contents API with SHA-based optimistic concurrency. Durable, versioned
// (every confession is a commit), no quota surprises. Falls back to memory
// when GH_TOKEN is missing (local dev only).
const { GH_TOKEN, GH_REPO } = process.env;
const GH_PATH = process.env.GH_PATH || 'data.json';
const GH_BRANCH = process.env.GH_BRANCH || 'main';
const hasGithub = () => !!(GH_TOKEN && GH_REPO);

let memory = [];
let cache = { items: null, sha: null, at: 0 };
const CACHE_MS = 2000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function gh(path, init = {}) {
  return fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'villain-wall',
      ...(init.headers || {}),
    },
  });
}

async function readFile() {
  const r = await gh(`${GH_PATH}?ref=${encodeURIComponent(GH_BRANCH)}&t=${Date.now()}`, { cache: 'no-store' });
  if (r.status === 404) return { items: [], sha: null };
  if (!r.ok) throw new Error(`github read ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  let items = [];
  try { items = JSON.parse(Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf8')); } catch { items = []; }
  if (!Array.isArray(items)) items = [];
  cache = { items, sha: j.sha, at: Date.now() };
  return { items, sha: j.sha };
}

async function writeFile(items, sha, message) {
  const body = { message, branch: GH_BRANCH, content: Buffer.from(JSON.stringify(items)).toString('base64') };
  if (sha) body.sha = sha;
  const r = await gh(GH_PATH, { method: 'PUT', body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) return null;            // someone else wrote first; caller retries
  if (!r.ok) throw new Error(`github write ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  cache = { items, sha: j.content?.sha || null, at: Date.now() };
  return j.content?.sha || true;
}

async function mutate(fn, message) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { items, sha } = await readFile();
    const next = fn(items.slice());
    if (next === null) return false;                                   // nothing to do
    if (await writeFile(next, sha, message)) return true;
    await sleep(150 + Math.random() * 400 * (attempt + 1));
  }
  throw new Error('github write conflict after retries');
}

export async function addSubmission(item) {
  if (!hasGithub()) { memory.push(item); return item; }
  await mutate(items => { if (items.some(i => i.id === item.id)) return null; items.push(item); return items; }, `confession ${item.id} (${item.name})`);
  return item;
}

export async function listSubmissions() {
  if (!hasGithub()) return [...memory].sort((a, b) => a.ts - b.ts);
  if (cache.items && Date.now() - cache.at < CACHE_MS) return cache.items.slice().sort((a, b) => a.ts - b.ts);
  const { items } = await readFile();
  return items.slice().sort((a, b) => a.ts - b.ts);
}

export async function deleteSubmission(id) {
  if (!id) return false;
  if (!hasGithub()) { const n = memory.length; memory = memory.filter(i => i.id !== id); return memory.length < n; }
  return mutate(items => items.some(i => i.id === id) ? items.filter(i => i.id !== id) : null, `delete ${id}`);
}

export async function approveSubmission(id) {
  if (!id) return false;
  if (!hasGithub()) { const i = memory.find(x => x.id === id); if (!i) return false; i.approved = true; return true; }
  let found = false;
  await mutate(items => { const i = items.find(x => x.id === id); if (!i) return null; found = true; if (i.approved) return null; i.approved = true; return items; }, `approve ${id}`);
  return found;
}

export async function approveAll() {
  if (!hasGithub()) { memory.forEach(i => i.approved = true); return true; }
  await mutate(items => items.some(i => !i.approved) ? items.map(i => ({ ...i, approved: true })) : null, 'approve all pending');
  return true;
}

export const storageName = () => hasGithub() ? 'github' : 'memory';
