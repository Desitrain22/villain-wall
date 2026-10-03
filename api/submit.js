import { addSubmission, deleteSubmission, approveSubmission, approveAll, isClosed, setClosed, makeId } from '../lib/store.js';
import { moderate } from '../lib/moderate.js';

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
// Hard slurs are rejected outright (evil is the point; hate isn't). Admin can still delete anything else.
const SLURS = [
  /\bn+\s*[i1!|]+(?:\s*[gq9]){2,}\s*(?:[ae3@]+[rh]?[sz]*|[a@4]+[sz]*)\b/i,  // n-word, plurals, spaced/leet variants (not "Niger"/"snigger")
  /\bn[*#@]+[gq9]+[ae3]+r/i,                                            // n*gger style
  /\bf+\s*[a@4]+(?:\s*[gq9]){1,}\s*[oi0]*t+s?\b/i,                    // f-slur
  /\bk+[iy1!]+k+[e3]+s?\b/i, /\bsp+[i1!]+c+k*s?\b/i, /\bch+[i1!]+n+k+s?\b/i, /\bw+[e3]+t+b+[a@4]+c+k+s?\b/i,
  /\bt+r+[a@4]+n+n+[yi1]+e?s?\b/i,
];
const hateful = s => SLURS.some(r => r.test(s));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'PATCH') {
    const key = String(req.query.key || '');
    if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'bad key' });
    if (req.query.closed !== undefined) { await setClosed(String(req.query.closed) === '1'); return res.status(200).json({ ok: true, closed: String(req.query.closed) === '1' }); }
    if (req.query.all === '1') { await approveAll(); return res.status(200).json({ ok: true }); }
    const ok = await approveSubmission(String(req.query.id || ''));
    return res.status(200).json({ ok });
  }
  if (req.method === 'DELETE') {
    const key = String(req.query.key || '');
    if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'bad key' });
    const ok = await deleteSubmission(String(req.query.id || ''));
    return res.status(200).json({ ok });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (await isClosed()) return res.status(403).json({ error: 'Confessions are closed for the night. Thanks for being evil.', closed: true });
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
  if (hateful(text) || hateful(name)) return res.status(400).json({ error: 'Keep it evil, not hateful. Try again without the slur.' });

  // LLM gate: block = refused now, review = wait for the host, allow = straight to the wall
  const mod = await moderate({ name, text });
  if (mod.verdict === 'block') return res.status(400).json({ error: 'Keep it evil, not hateful. That one stays off the wall.', blocked: true });
  const item = { id: makeId(), ts: Date.now(), name, text, screen, approved: mod.verdict === 'allow', mod: { verdict: mod.verdict, reason: mod.reason, model: mod.model, ms: mod.ms } };
  try {
    await addSubmission(item);
  } catch (e) {
    console.error('store error', e);
    return res.status(500).json({ error: 'Could not save. Try again.' });
  }
  return res.status(200).json({ ok: true, item });
}
