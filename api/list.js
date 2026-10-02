import { listSubmissions } from '../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const since = Number(req.query.since || 0) || 0;
  try {
    const all = await listSubmissions();
    const items = all.filter(i => i.ts > since).map(({ id, ts, name, text, screen }) => ({ id, ts, name, text, screen }));
    return res.status(200).json({ now: Date.now(), count: all.length, ids: all.map(i => i.id), items });
  } catch (e) {
    console.error('list error', e);
    return res.status(500).json({ error: 'list failed' });
  }
}
