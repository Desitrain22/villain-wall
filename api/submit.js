import { addSubmission, deleteSubmission, makeId } from '../lib/store.js';

const SCREENS = new Set(['A', 'B', 'C']);
// Light per-IP throttle (per warm instance). Venue WiFi puts every guest behind one IP, so keep it generous: 60/min.
const hits = new Map();
function throttled(ip) {
  const now = Date.now(), win = 60_000, limit = 60;
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > limit;
}
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'DELETE') {
    const key = String(req.query.key || '');
    if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'bad key' });
    const ok = await deleteSubmission(String(req.query.id || ''));
    return res.status(200).json({ ok });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (throttled(ip)) return res.status(429).json({ error: 'Slow down, villain. Try again in a minute.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const name = clean(body.name, 40) || 'Anonymous';
  const text = clean(body.text, 180);
  let screen = String(body.screen || '').toUpperCase();
  if (!SCREENS.has(screen)) screen = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
  if (text.length < 2) return res.status(400).json({ error: 'Tell us what you did.' });

  const item = { id: makeId(), ts: Date.now(), name, text, screen };
  try {
    await addSubmission(item);
  } catch (e) {
    console.error('store error', e);
    return res.status(500).json({ error: 'Could not save. Try again.' });
  }
  return res.status(200).json({ ok: true, item });
}
