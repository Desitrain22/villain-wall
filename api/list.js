import { listSubmissions, storageName, isClosed } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const since = Number(req.query.since || 0) || 0;
  try {
    const [all, closed] = await Promise.all([listSubmissions(), isClosed()]);
    const admin = req.query.all === '1' && !!process.env.ADMIN_KEY && String(req.query.key || '') === process.env.ADMIN_KEY;
    if (req.query.all === '1' && !admin) return res.status(401).json({ error: 'bad key' });
    const visible = admin ? all : all.filter(i => i.approved);
    const items = visible.filter(i => i.ts > since).map(({ id, ts, name, text, screen, approved, mod }) => admin ? { id, ts, name, text, screen, approved: !!approved, mod: mod || null } : { id, ts, name, text, screen });
    return res.status(200).json({ now: Date.now(), complete: true, closed, storage: storageName(), build: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || null, count: visible.length, pending: all.filter(i => !i.approved).length, ids: visible.map(i => i.id), items });
  } catch (e) {
    console.error('list error', e);
    return res.status(500).json({ error: 'list failed' });
  }
}
