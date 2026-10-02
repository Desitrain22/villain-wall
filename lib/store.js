import { put, list, del } from '@vercel/blob';

const PREFIX = 's/';
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Module-level caches survive across warm invocations. Blob URLs are immutable
// (never overwritten), so caching content by URL is safe.
const contentCache = new Map();
let memory = []; // fallback when no Blob token (local dev only)

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function addSubmission(item) {
  if (!hasBlob()) { memory.push(item); return item; }
  const pathname = `${PREFIX}${String(item.ts).padStart(14, '0')}-${item.id}.json`;
  const blob = await put(pathname, JSON.stringify(item), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  contentCache.set(blob.url, { ...item, url: blob.url });
  return item;
}

export async function listSubmissions() {
  if (!hasBlob()) return [...memory].sort((a, b) => a.ts - b.ts);
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const items = await Promise.all(blobs.map(async (b) => {
    const cached = contentCache.get(b.url);
    if (cached) return cached;
    try {
      const r = await fetch(b.url, { cache: 'no-store' });
      if (!r.ok) return null;
      const item = { ...(await r.json()), url: b.url };
      contentCache.set(b.url, item);
      return item;
    } catch { return null; }
  }));
  return items.filter(Boolean).sort((a, b) => a.ts - b.ts);
}

export async function deleteSubmission(id) {
  if (!id) return false;
  if (!hasBlob()) { const n = memory.length; memory = memory.filter(i => i.id !== id); return memory.length < n; }
  const all = await listSubmissions();
  const hit = all.find(i => i.id === id);
  if (!hit?.url) return false;
  await del(hit.url);
  contentCache.delete(hit.url);
  return true;
}
