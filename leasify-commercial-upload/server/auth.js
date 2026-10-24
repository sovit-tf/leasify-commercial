'use strict';
/* =====================================================================
   Auth: demo people, scrypt PIN hashes, sessions in Postgres, httpOnly cookie.
     users   seeded from LC.TEAM, LC.CEO and one owner per distinct owner_name in the inventory
     routes  POST /api/login  POST /api/logout  GET /api/me  GET /api/users (public, no PINs)
   ===================================================================== */
const crypto = require('node:crypto');
const express = require('express');

const COOKIE = 'lc_session';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const scrypt = (pin, salt) => new Promise((res, rej) => crypto.scrypt(pin, salt, 32, (e, k) => (e ? rej(e) : res(k))));

async function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pin), salt);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}
async function verifyPin(pin, stored) {
  const [alg, saltHex, keyHex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = await scrypt(String(pin), Buffer.from(saltHex, 'hex'));
  const want = Buffer.from(keyHex, 'hex');
  return key.length === want.length && crypto.timingSafeEqual(key, want);
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((p) => {
    const i = p.indexOf('='); if (i < 0) return;
    const k = p.slice(0, i).trim(); if (!k) return;
    try { out[k] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) { /* ignore bad cookie */ }
  });
  return out;
}

function createAuth({ pool, runtime, demoPin = '2580', sessionHours = 12, log = console }) {
  const LC = runtime.LC;
  const cache = new Map();                 // token hash -> { session, at }
  const fails = new Map();                 // ip|user -> { n, first }
  const ROLE_LABEL = (r) => (LC.ROLES[r] || {}).label || r;

  /* ---------------- users ---------------- */
  function wantedUsers() {
    const list = [{ id: LC.CEO.id, name: LC.CEO.name, role: 'ceo', owner_name: null, title: 'CEO', detail: 'All cities' }];
    LC.TEAM.forEach((t) => list.push({ id: t.id, name: t.name, role: t.senior ? 'manager' : 'executive', owner_name: null, title: t.senior ? 'Leasing manager' : 'Leasing executive', detail: t.cities.join(', ') }));
    const owners = new Map();
    ((runtime.state && runtime.state.units) || []).forEach((u) => { if (u.owner_name) owners.set(u.owner_name, (owners.get(u.owner_name) || 0) + 1); });
    Array.from(owners.keys()).sort((a, b) => a.localeCompare(b)).forEach((name) => {
      const n = owners.get(name);
      list.push({ id: 'owner-' + slug(name), name, role: 'owner', owner_name: name, title: 'Owner', detail: n + (n === 1 ? ' unit' : ' units') });
    });
    return list;
  }

  /** Create any demo person that is missing. Existing people (and their PINs) are left alone. */
  async function ensureUsers() {
    const have = new Set((await pool.query('SELECT id FROM users')).rows.map((r) => r.id));
    let added = 0;
    for (const u of wantedUsers()) {
      if (have.has(u.id)) continue;
      const pin = await hashPin(demoPin);
      await pool.query('INSERT INTO users (id, name, role, owner_name, title, detail, pin_hash) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING', [u.id, u.name, u.role, u.owner_name, u.title, u.detail, pin]);
      added++;
    }
    return added;
  }

  async function publicUsers() {
    const r = await pool.query("SELECT id, name, role, owner_name, title, detail FROM users WHERE active ORDER BY CASE role WHEN 'ceo' THEN 0 WHEN 'manager' THEN 1 WHEN 'executive' THEN 2 ELSE 3 END, name");
    return r.rows.map((u) => ({ id: u.id, name: u.name, role: u.role, roleLabel: ROLE_LABEL(u.role), kind: u.role === 'owner' ? 'owner' : 'person', ownerName: u.owner_name, title: u.title, detail: u.detail }));
  }

  /* ---------------- sessions ---------------- */
  const toSession = (row, hash) => ({ userId: row.user_id || row.id, name: row.name, role: row.role, owner: row.owner_name || null, tokenHash: hash, expiresAt: +new Date(row.expires_at) });

  async function resolve(token) {
    if (!token || token.length < 20 || token.length > 200) return null;
    const hash = sha256(token); const hit = cache.get(hash);
    if (hit && Date.now() - hit.at < 20000 && hit.session.expiresAt > Date.now()) return hit.session;
    const r = await pool.query('SELECT s.user_id, s.expires_at, u.name, u.role, u.owner_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active', [hash]);
    if (!r.rows.length) { cache.delete(hash); return null; }
    const session = toSession(r.rows[0], hash);
    cache.set(hash, { session, at: Date.now() });
    return session;
  }

  async function login(userId, pin, ip) {
    const key = (ip || '?') + '|' + userId;
    const f = fails.get(key); const now = Date.now();
    if (f && now - f.first < 600000 && f.n >= 8) return { error: 'Too many wrong PINs. Wait a few minutes and try again.', status: 429 };
    const r = await pool.query('SELECT id, name, role, owner_name, pin_hash, active FROM users WHERE id = $1', [String(userId || '')]);
    const u = r.rows[0];
    const ok = !!(u && u.active && await verifyPin(pin, u.pin_hash));
    await pool.query('INSERT INTO login_log (user_id, role, ok) VALUES ($1,$2,$3)', [u ? u.id : null, u ? u.role : null, ok]);
    if (!ok) {
      const cur = f && now - f.first < 600000 ? f : { n: 0, first: now };
      cur.n++; fails.set(key, cur);
      return { error: 'That PIN is not right.', status: 401 };
    }
    fails.delete(key);
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = sha256(token);
    const exp = new Date(now + sessionHours * 3600e3);
    await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [hash, u.id, exp]);
    const session = { userId: u.id, name: u.name, role: u.role, owner: u.owner_name || null, tokenHash: hash, expiresAt: +exp };
    cache.set(hash, { session, at: now });
    return { token, session, maxAge: sessionHours * 3600 };
  }

  async function logout(token) {
    if (!token) return null;
    const hash = sha256(token); cache.delete(hash);
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hash]);
    return hash;
  }

  async function recentLogins(userId) {
    const r = await pool.query('SELECT ts, role FROM login_log WHERE user_id = $1 AND ok ORDER BY ts DESC LIMIT 5', [userId]);
    return r.rows.map((x) => ({ ts: +new Date(x.ts), role: x.role }));
  }

  async function cleanup() {
    await pool.query('DELETE FROM sessions WHERE expires_at < now()');
    for (const [h, v] of cache) if (v.session.expiresAt < Date.now()) cache.delete(h);
    const cutoff = Date.now() - 600000;
    for (const [k, v] of fails) if (v.first < cutoff) fails.delete(k);
  }

  /* ---------------- http ---------------- */
  const publicSession = (s) => ({ userId: s.userId, name: s.name, role: s.role, owner: s.owner });
  const isSecure = (req) => req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const cookieHeader = (req, value, maxAge) => COOKIE + '=' + encodeURIComponent(value) + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + maxAge + (isSecure(req) ? '; Secure' : '');

  /** Adds req.session when the cookie is good. Never rejects. */
  async function attach(req, res, next) {
    try {
      const token = parseCookies(req.headers.cookie)[COOKIE];
      req.sessionToken = token || null;
      req.session = token ? await resolve(token) : null;
      next();
    } catch (e) { next(e); }
  }
  function requireSession(req, res, next) {
    if (!req.session) return res.status(401).json({ error: 'Please sign in.' });
    next();
  }
  const requireRole = (...roles) => (req, res, next) => {
    if (!req.session) return res.status(401).json({ error: 'Please sign in.' });
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Your role cannot do this.' });
    next();
  };

  const router = express.Router();
  router.get('/users', async (req, res, next) => {
    try { res.set('Cache-Control', 'no-store'); res.json({ users: await publicUsers() }); } catch (e) { next(e); }
  });
  router.post('/login', async (req, res, next) => {
    try {
      const { userId, pin } = req.body || {};
      if (typeof userId !== 'string' || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Pick a person and enter the 4-digit PIN.' });
      const out = await login(userId, pin, req.ip);
      if (out.error) { if (out.status === 429) res.set('Retry-After', '300'); return res.status(out.status).json({ error: out.error }); }
      res.set('Set-Cookie', cookieHeader(req, out.token, out.maxAge));
      res.set('Cache-Control', 'no-store');
      res.json({ user: publicSession(out.session), logins: await recentLogins(out.session.userId) });
    } catch (e) { next(e); }
  });
  router.post('/logout', async (req, res, next) => {
    try {
      const hash = await logout(req.sessionToken);
      if (hash && api.onLogout) api.onLogout(hash);
      res.set('Set-Cookie', cookieHeader(req, '', 0));
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
  router.get('/me', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store');
      if (!req.session) return res.status(401).json({ error: 'Not signed in.' });
      res.json({ user: publicSession(req.session), logins: await recentLogins(req.session.userId), expiresAt: req.session.expiresAt });
    } catch (e) { next(e); }
  });

  const api = { ensureUsers, publicUsers, login, logout, resolve, cleanup, attach, requireSession, requireRole, router, hashPin, verifyPin, COOKIE, onLogout: null };
  return api;
}

module.exports = { createAuth, hashPin, verifyPin, parseCookies, COOKIE };
