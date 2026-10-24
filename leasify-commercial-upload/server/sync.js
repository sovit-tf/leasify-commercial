'use strict';
/* =====================================================================
   Sync: bootstrap, live updates (SSE) and writes from browsers.

     GET  /api/bootstrap   role-filtered state { session, state, version, epoch }
     GET  /api/events      SSE: patches batched every 150 ms, filtered per connection
     POST /api/sync        browser changes { clientId, changes:[{collection, upserts, removes, patch}], meta }
     POST /api/owner/reply an owner answers the weekly availability check (1, 2 or 3)

   Every change, wherever it comes from (a browser, the engine, the WhatsApp agent), reaches
   the browsers through the same tracker diff that the store uses.
   ===================================================================== */
const crypto = require('node:crypto');
const express = require('express');
const { COLLECTIONS, ORDER, newId, recordOf } = require('./collections');
const { viewRecord, viewState, makeCtx, authorizeUpsert, authorizeRemove, maskPhone, STAFF, ADMIN } = require('./access');

const MAX_UPSERTS = 600;
const MAX_RECORD_BYTES = 262144;
const UNIT_STATUSES = ['Available', 'Under negotiation', 'LOI signed', 'Leased'];
const DERIVED_UNIT_FIELDS = new Set(['monthly_rent', 'all_in_per_sqft', 'all_in_monthly', 'deposit_amount', 'loading_pct']);
const APPEND_FIELDS = {
  activity: ['ts', 'text', 'kind', 'clientId', 'leadId', 'unitId'],
  consent: ['ts', 'phone', 'name', 'channel', 'text', 'optOut'],
  syncLog: ['ts', 'source', 'added', 'changed', 'removed', 'by'],
};

const isPlain = (o) => o && typeof o === 'object' && !Array.isArray(o);
const hasBadKey = (o) => Object.prototype.hasOwnProperty.call(o, '__proto__') || Object.prototype.hasOwnProperty.call(o, 'constructor') || Object.prototype.hasOwnProperty.call(o, 'prototype');
const publicSession = (s) => ({ userId: s.userId, name: s.name, role: s.role, owner: s.owner });

/** Replace the contents of an engine object without changing its identity (the engine may hold references). */
function replaceInPlace(target, src) {
  for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
  for (const k of Object.keys(src)) if (k !== '__proto__') target[k] = src[k];
}

/* ---------------------------------------------------------------------
   Audit helpers
   --------------------------------------------------------------------- */
const asText = (v) => (v == null ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v));

function unitAuditRows(before, after, session, meta) {
  const rows = []; const now = Date.now();
  const channel = meta && meta.channel === 'sheet' ? 'sheet' : 'app';
  const by = session.name + (channel === 'sheet' ? ' via ' + String(meta.source || 'Google Sheet').slice(0, 40) : '');
  if (!before) { rows.push({ ts: now, unitId: after.unit_id, entity: 'unit', field: '(new unit)', from: '', to: asText(after.listing_title), by, channel }); return rows; }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === 'unit_id' || DERIVED_UNIT_FIELDS.has(k) || k.startsWith('_')) continue;
    let a = asText(before[k]), b = asText(after[k]);
    if (a === b) continue;
    if (k === 'owner_phone') { a = maskPhone(a); b = maskPhone(b); }
    rows.push({ ts: now, unitId: after.unit_id, entity: 'unit', field: k, from: a.slice(0, 300), to: b.slice(0, 300), by, channel });
  }
  return rows;
}

function settingsAuditRows(before, after, session) {
  const rows = []; const now = Date.now();
  const push = (field, a, b) => rows.push({ ts: now, unitId: 'Settings', entity: 'settings', field, from: asText(a).slice(0, 300), to: asText(b).slice(0, 300), by: session.name, channel: 'app' });
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (k === 'handoffRules') {
      const old = new Map((before.handoffRules || []).map((r) => [r.id, r]));
      for (const r of after.handoffRules || []) {
        const o = old.get(r.id) || {};
        for (const f of new Set([...Object.keys(o), ...Object.keys(r)])) if (f !== 'id' && asText(o[f]) !== asText(r[f])) push('handoffRules.' + r.id + '.' + f, o[f], r[f]);
      }
    } else if (asText(before[k]) !== asText(after[k])) push(k, before[k], after[k]);
  }
  return rows;
}

/* ---------------------------------------------------------------------
   Validation (light: shape and size, plus the few values the UI relies on)
   --------------------------------------------------------------------- */
function validateRecord(coll, rec, LC) {
  if (!isPlain(rec) || hasBadKey(rec)) return 'That record is not valid.';
  const id = COLLECTIONS[coll].id(rec);
  if (typeof id !== 'string' || !id || id.length > 120) return 'The record has no id.';
  if (JSON.stringify(rec).length > MAX_RECORD_BYTES) return 'That record is too large.';
  if (coll === 'units' && !UNIT_STATUSES.includes(rec.status)) return 'Unit status must be one of: ' + UNIT_STATUSES.join(', ') + '.';
  if (coll === 'clients') {
    if (![...LC.STAGES, ...LC.OFF_STAGES].includes(rec.stage)) return 'Unknown client stage.';
    if (!isPlain(rec.req)) return 'The client needs a requirement.';
  }
  if (coll === 'visits' && (typeof rec.unitId !== 'string' || typeof rec.when !== 'number')) return 'A visit needs a unit and a time.';
  if (coll === 'tasks' && typeof rec.done !== 'boolean') return 'A task needs a done flag.';
  return null;
}

function validateSettings(rec, current) {
  if (!isPlain(rec) || hasBadKey(rec)) return 'Settings are not valid.';
  for (const k of Object.keys(rec)) {
    if (!(k in current)) return 'Unknown setting: ' + k + '.';
    if (typeof current[k] === 'number' && !(typeof rec[k] === 'number' && Number.isFinite(rec[k]))) return 'Setting ' + k + ' must be a number.';
    if (Array.isArray(current[k]) && !Array.isArray(rec[k])) return 'Setting ' + k + ' must be a list.';
  }
  if (rec.handoffRules) {
    if (!Array.isArray(rec.handoffRules) || rec.handoffRules.length !== current.handoffRules.length) return 'The handoff rules list cannot change size.';
    const ids = current.handoffRules.map((r) => r.id);
    for (const r of rec.handoffRules) if (!isPlain(r) || !ids.includes(r.id) || typeof r.on !== 'boolean') return 'A handoff rule is not valid.';
  }
  return null;
}

/* ---------------------------------------------------------------------
   Apply a browser's changes to the engine state
   --------------------------------------------------------------------- */
function applySync({ rt, tracker, session, body }) {
  const LC = rt.LC;
  tracker.collect({ by: 'system' });          // anything the engine did before this request is not this person's change
  const S = rt.state; const ctx = makeCtx(LC, S);
  const result = { accepted: {}, rejected: [], ignored: {} };
  const index = {}; const events = new Map(); const clientEvents = new Set(); const auditRows = [];
  const idx = (coll) => {
    if (!index[coll]) { const c = COLLECTIONS[coll]; index[coll] = new Map(S[coll].map((o) => [c.id(o), o])); }
    return index[coll];
  };
  const reject = (coll, id, reason, existing) => {
    const cur = existing ? viewRecord(coll, recordOf(COLLECTIONS[coll], existing), session, ctx) : null;
    result.rejected.push({ collection: coll, id: id == null ? null : id, reason, current: cur ? JSON.parse(JSON.stringify(cur)) : null });
  };
  const ok = (coll) => { result.accepted[coll] = (result.accepted[coll] || 0) + 1; };

  let total = 0;
  for (const ch of body.changes) {
    if (!isPlain(ch)) continue;
    const coll = ch.collection; const c = COLLECTIONS[coll];
    const ups = Array.isArray(ch.upserts) ? ch.upserts : []; const rems = Array.isArray(ch.removes) ? ch.removes : [];
    total += ups.length + rems.length;
    if (total > MAX_UPSERTS) { reject(coll, null, 'Too many changes in one request.'); break; }
    if (!c) { reject(String(coll), null, 'Unknown collection.'); continue; }

    if (c.serverOwned) {
      ups.forEach((r) => reject(coll, isPlain(r) ? c.id(r) : null, coll === 'leads' ? 'Conversations are managed by the server. Use the inbox actions.' : 'Handoff items are managed by the server.', isPlain(r) ? idx(coll).get(c.id(r)) : null));
      rems.forEach((id) => reject(coll, id, 'This record cannot be deleted.', idx(coll).get(id)));
      continue;
    }

    if (c.kind === 'append') {
      if (coll === 'audit') { result.ignored.audit = (result.ignored.audit || 0) + ups.length; continue; }   // the server writes audit rows itself
      const allowed = coll === 'syncLog' ? ADMIN.has(session.role) : STAFF.has(session.role);
      const fields = APPEND_FIELDS[coll];
      const seen = tracker.seen[coll];
      const fresh = [];
      for (const e of ups) {
        if (!allowed) { result.rejected.push({ collection: coll, id: isPlain(e) ? e._id : null, reason: 'Your role cannot add to this log.', current: null }); continue; }
        if (!isPlain(e) || typeof e._id !== 'string' || e._id.length > 60 || typeof e.ts !== 'number') { result.rejected.push({ collection: coll, id: null, reason: 'That log entry is not valid.', current: null }); continue; }
        if (seen.has(e._id) || fresh.some((f) => f._id === e._id)) continue;           // already stored (replay)
        const clean = { _id: e._id };
        for (const f of fields) if (e[f] !== undefined && (typeof e[f] !== 'object' || e[f] === null)) clean[f] = typeof e[f] === 'string' ? e[f].slice(0, 600) : e[f];
        fresh.push(clean);
      }
      if (fresh.length) {
        if (c.insertAt === 'front') S[coll].unshift(...fresh); else S[coll].push(...fresh);
        fresh.forEach(() => ok(coll));
        if (coll === 'activity' && S.activity.length > c.cap) S.activity.length = c.cap;
      }
      continue;
    }

    if (c.kind === 'single') {        // settings
      const rec = ups[0];
      if (!ups.length) continue;
      const patchKeys = ch.patch && Array.isArray(ch.patch.main) ? ch.patch.main : Object.keys(rec || {});
      const part = {}; if (isPlain(rec)) for (const k of patchKeys) if (k in rec) part[k] = rec[k];
      const verdict = authorizeUpsert('settings', S.settings, part, session, ctx);
      if (!verdict.ok) { reject('settings', 'main', verdict.reason, S.settings); continue; }
      const bad = validateSettings(part, S.settings);
      if (bad) { reject('settings', 'main', bad, S.settings); continue; }
      const before = JSON.parse(JSON.stringify(S.settings));
      const after = rt.clone(Object.assign({}, before, part));
      const rows = settingsAuditRows(before, after, session);
      if (rows.length) { replaceInPlace(S.settings, after); auditRows.push(...rows); events.set('settings:changed', null); }
      ok('settings');
      continue;
    }

    /* records */
    const map = idx(coll);
    for (const rec of ups) {
      if (!isPlain(rec)) { reject(coll, null, 'That record is not valid.'); continue; }
      const id = c.id(rec); const existing = typeof id === 'string' ? map.get(id) : null;
      let merged = rec;
      const keys = ch.patch && Array.isArray(ch.patch[id]) ? ch.patch[id] : null;
      if (existing && keys) {
        merged = JSON.parse(JSON.stringify(recordOf(c, existing)));
        for (const k of keys) { if (k === '__proto__') continue; if (k in rec) merged[k] = rec[k]; else delete merged[k]; }
      }
      const bad = validateRecord(coll, merged, LC);
      if (bad) { reject(coll, typeof id === 'string' ? id : null, bad, existing); continue; }
      const verdict = authorizeUpsert(coll, existing ? JSON.parse(JSON.stringify(existing)) : null, merged, session, ctx);
      if (!verdict.ok) { reject(coll, id, verdict.reason, existing); continue; }
      const adopted = rt.clone(merged);
      if (existing) {
        const before = coll === 'units' ? JSON.parse(JSON.stringify(existing)) : null;
        replaceInPlace(existing, adopted);
        if (coll === 'units') auditRows.push(...unitAuditRows(before, existing, session, body.meta));
      } else {
        if (c.insertAt === 'front') S[coll].unshift(adopted); else S[coll].push(adopted);
        map.set(id, adopted);
        if (coll === 'units') auditRows.push(...unitAuditRows(null, adopted, session, body.meta));
      }
      if (coll === 'clients') clientEvents.add(id);
      events.set(c.event, null); ok(coll);
    }
    for (const id of rems) {
      const existing = map.get(id);
      const verdict = authorizeRemove(coll, existing, session, ctx);
      if (!verdict.ok) { reject(coll, id, verdict.reason, existing); continue; }
      if (!existing) continue;
      S[coll].splice(S[coll].indexOf(existing), 1); map.delete(id);
      events.set(c.event, null); ok(coll);
    }
  }

  if (auditRows.length) S.audit.unshift(...auditRows);
  for (const id of clientEvents) LC.emit('client:updated', id);
  for (const evt of events.keys()) LC.emit(evt);
  const changes = tracker.collect({ by: session.name, origin: body.clientId || null });
  result.audit = changes && changes.audit ? changes.audit.upserts.map((u) => JSON.parse(u.json)) : [];
  return result;
}

/* ---------------------------------------------------------------------
   Owner replies to the weekly availability check (same effects as the prototype's owners.js)
   --------------------------------------------------------------------- */
function applyOwnerReply({ rt, tracker, session, unitId, n }) {
  const LC = rt.LC; const S = rt.state;
  tracker.collect({ by: 'system' });
  const u = LC.unit(unitId);
  if (!u || u.owner_name !== session.owner) return { status: 404, error: 'That unit is not on your list.' };
  if (![1, 2, 3].includes(n)) return { status: 400, error: 'Reply with 1, 2 or 3.' };
  const o = u.owner_name; const by = 'Owner (' + o + ') via WhatsApp reply';
  const t = LC.fmtTime(Date.now()); const today = LC.iso(LC.today()); const name = u.building_name + ' ' + u.unit_no;
  let message;
  if (n === 1) {
    if (u.last_confirmed !== today) S.audit.unshift({ ts: Date.now(), unitId, entity: 'unit', field: 'last_confirmed', from: u.last_confirmed, to: today, by, channel: 'owner' });
    if (u.confirmed_via !== 'WhatsApp reply') S.audit.unshift({ ts: Date.now(), unitId, entity: 'unit', field: 'confirmed_via', from: u.confirmed_via, to: 'WhatsApp reply', by, channel: 'owner' });
    if (u.status === 'Leased') { S.audit.unshift({ ts: Date.now(), unitId, entity: 'unit', field: 'status', from: 'Leased', to: 'Available', by, channel: 'owner' }); u.status = 'Available'; }
    u.last_confirmed = today; u.confirmed_via = 'WhatsApp reply';
    message = 'Reply 1 received at ' + t + '. Last confirmed is now today.';
    LC.log('Owner ' + o + ' replied 1: ' + name + ' is still available', { unitId, kind: 'owner' });
  } else if (n === 2) {
    LC.tasks.add({ type: 'Owner check', title: 'Owner says something changed at ' + name + ' (' + unitId + '). Call ' + o + ' for the new terms', due: Date.now() + 2 * 36e5, unitId, assignee: u.listing_agent, priority: 'High' });
    u.data_flag = 'Owner says terms changed. Confirm with the owner before offering.';
    S.audit.unshift({ ts: Date.now(), unitId, entity: 'unit', field: 'owner_reply', from: '', to: 'Something changed (task opened for ' + u.listing_agent + ', unit flagged)', by, channel: 'owner' });
    message = 'Reply 2 received at ' + t + '. A high-priority task was opened for ' + u.listing_agent + ' to call the owner.';
    LC.log('Owner ' + o + ' replied 2: something changed at ' + name, { unitId, kind: 'owner' });
  } else {
    S.audit.unshift({ ts: Date.now(), unitId, entity: 'unit', field: 'status', from: u.status, to: 'Leased', by, channel: 'owner' });
    if (u.last_confirmed !== today) S.audit.unshift({ ts: Date.now(), unitId, entity: 'unit', field: 'last_confirmed', from: u.last_confirmed, to: today, by, channel: 'owner' });
    u.status = 'Leased'; u.last_confirmed = today; u.confirmed_via = 'WhatsApp reply';
    message = 'Reply 3 received at ' + t + '. The unit is now marked Leased and will not be sent to occupiers.';
    LC.log('Owner ' + o + ' replied 3: ' + name + ' is leased', { unitId, kind: 'owner' });
  }
  LC.emit('units:changed');
  tracker.collect({ by: by });
  return { status: 200, message };
}

/* ---------------------------------------------------------------------
   SSE hub
   --------------------------------------------------------------------- */
class Hub {
  constructor({ rt, flushMs = 150, heartbeatMs = 20000, ring = 400, ringMs = 180000, maxPerUser = 12, log = console }) {
    this.rt = rt; this.log = log;
    this.epoch = crypto.randomBytes(6).toString('hex');
    this.version = 0; this.conns = new Set(); this.ring = []; this.ringMax = ring; this.ringMs = ringMs; this.maxPerUser = maxPerUser;
    this.pending = null; this.suppress = false;
    this.timer = setInterval(() => this.flush(), flushMs); this.timer.unref();
    this.hb = setInterval(() => this._heartbeat(), heartbeatMs); this.hb.unref();
  }

  /** Called by the tracker with every batch of changes. */
  accept(changes, meta = {}) {
    if (meta.reset) { this.pending = null; return; }              // a reset sends its own message
    const m = this.pending || (this.pending = {});
    for (const k of Object.keys(changes)) {
      const ch = changes[k]; const c = COLLECTIONS[k];
      const e = m[k] || (m[k] = { upserts: new Map(), removes: new Map(), append: [], order: c.insertAt });
      if (c.kind === 'append') {
        const batch = ch.upserts.map((u) => JSON.parse(u.json));
        e.append = ch.order === 'front' ? batch.concat(e.append) : e.append.concat(batch);
      } else {
        for (const u of ch.upserts) { e.removes.delete(u.id); e.upserts.set(u.id, { rec: JSON.parse(u.json), origin: meta.origin || null }); }
        for (const id of ch.removes) { e.upserts.delete(id); e.removes.set(id, meta.origin || null); }
      }
    }
  }

  flush() {
    if (!this.pending) return;
    const merged = this.pending; this.pending = null;
    const entry = { v: ++this.version, at: Date.now(), merged };
    this.ring.push(entry);
    const cutoff = Date.now() - this.ringMs;
    while (this.ring.length > this.ringMax || (this.ring.length && this.ring[0].at < cutoff)) this.ring.shift();
    if (!this.conns.size) return;
    const ctx = makeCtx(this.rt.LC, this.rt.state);
    for (const conn of this.conns) this._send(conn, entry, ctx);
  }

  _write(conn, v, msg) {
    if (conn.res.writableEnded || conn.res.destroyed) return;
    if (conn.res.writableLength > 4 * 1024 * 1024) { this._drop(conn); return; }       // a stuck client: let it reconnect
    conn.res.write((v != null ? 'id: ' + v + '\n' : '') + 'data: ' + JSON.stringify(msg) + '\n\n');
  }

  _send(conn, entry, ctx) {
    const s = conn.session; const { v, merged } = entry;
    for (const k of Object.keys(merged)) {
      const c = COLLECTIONS[k]; const e = merged[k];
      if (c.kind === 'single') {
        for (const { rec } of e.upserts.values()) { const view = viewRecord(k, rec, s, ctx); if (view) this._write(conn, v, { type: 'settings', settings: view, v }); }
        continue;
      }
      if (c.kind === 'append') {
        const rows = e.append.map((r) => viewRecord(k, r, s, ctx)).filter(Boolean);
        if (rows.length) this._write(conn, v, { type: 'patch', collection: k, upserts: rows, removes: [], order: e.order, origin: null, v });
        continue;
      }
      const byOrigin = new Map();
      const bucket = (o) => { if (!byOrigin.has(o)) byOrigin.set(o, { upserts: [], removes: [] }); return byOrigin.get(o); };
      for (const [id, { rec, origin }] of e.upserts) {
        const view = viewRecord(k, rec, s, ctx);
        if (view) { bucket(origin).upserts.push(view); if (conn.visible) conn.visible[k].add(id); }
        else if (conn.visible && conn.visible[k].has(id)) { bucket(origin).removes.push(id); conn.visible[k].delete(id); }
      }
      for (const [id, origin] of e.removes) {
        if (!conn.visible || conn.visible[k].has(id)) { bucket(origin).removes.push(id); if (conn.visible) conn.visible[k].delete(id); }
      }
      for (const [origin, b] of byOrigin) if (b.upserts.length || b.removes.length) this._write(conn, v, { type: 'patch', collection: k, upserts: b.upserts, removes: b.removes, origin, v });
    }
  }

  /** Attach an SSE response. since/epoch let a browser that missed a few batches catch up. */
  connect(req, res, session, { since, epoch }) {
    if (session.role !== 'ceo') {
      let n = 0; for (const c of this.conns) if (c.session.userId === session.userId) n++;
      if (n >= this.maxPerUser) { res.status(429).json({ error: 'Too many open tabs for this person.' }); return null; }
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    const conn = { res, session, visible: null, id: crypto.randomBytes(4).toString('hex') };
    if (session.role === 'owner') {
      conn.visible = {}; const ctx = makeCtx(this.rt.LC, this.rt.state);
      for (const k of ORDER) {
        const c = COLLECTIONS[k]; conn.visible[k] = new Set();
        if (c.kind !== 'records') continue;
        for (const obj of this.rt.state[k]) { if (viewRecord(k, recordOf(c, obj), session, ctx)) conn.visible[k].add(c.id(obj)); }
      }
    }
    this.conns.add(conn);
    res.on('close', () => this.conns.delete(conn));
    this._write(conn, null, { type: 'hello', version: this.version, epoch: this.epoch, connection: conn.id });
    // catch up
    const first = this.ring.length ? this.ring[0].v : this.version + 1;
    const resync = (since != null && (epoch !== this.epoch || since > this.version || (since < this.version && first > since + 1)));
    if (resync) this._write(conn, null, { type: 'resync' });
    else if (since != null && since < this.version) {
      const ctx = makeCtx(this.rt.LC, this.rt.state);
      for (const entry of this.ring) if (entry.v > since) this._send(conn, entry, ctx);
    }
    return conn;
  }

  _heartbeat() {
    const now = Date.now();
    for (const conn of this.conns) {
      if (conn.session.expiresAt && conn.session.expiresAt < now) { this._write(conn, null, { type: 'signed-out' }); this._drop(conn); continue; }
      if (!conn.res.writableEnded) conn.res.write(': ping\n\n');
    }
  }

  _drop(conn) { try { conn.res.end(); } catch (e) { /* ignore */ } this.conns.delete(conn); }

  /** Send a message to every open connection, or only those the filter accepts. */
  broadcast(msg, filter) { for (const conn of this.conns) if (!filter || filter(conn)) this._write(conn, null, msg); }
  /** After "Reset demo data" every browser loads the state again. */
  reset() { this.pending = null; this.ring.length = 0; this.version++; this.broadcast({ type: 'reset' }); }
  dropSession(tokenHash) {
    for (const conn of Array.from(this.conns)) if (conn.session.tokenHash === tokenHash) { this._write(conn, null, { type: 'signed-out' }); this._drop(conn); }
  }
  close() {
    clearInterval(this.timer); clearInterval(this.hb);
    for (const conn of Array.from(this.conns)) this._drop(conn);
  }
}

/* ---------------------------------------------------------------------
   Wiring
   --------------------------------------------------------------------- */
function createSync({ rt, tracker, auth, log = console, collectDebounceMs = 40, sweepMs = 2000 }) {
  const LC = rt.LC;
  const hub = new Hub({ rt, log });
  tracker.onChange((changes, meta) => hub.accept(changes, meta));

  // every LC event (a browser change, the simulator, the WhatsApp agent) triggers a diff soon after
  let t = null;
  const schedule = () => { if (t) return; t = setTimeout(() => { t = null; try { tracker.collect({ by: 'system' }); } catch (e) { log.error('[sync] collect failed:', e); } }, collectDebounceMs); t.unref(); };
  const offEmit = rt.onEmit(schedule);
  const sweep = setInterval(schedule, sweepMs); sweep.unref();

  const router = express.Router();
  const need = auth.requireSession;

  router.get('/bootstrap', need, (req, res) => {
    tracker.collect({ by: 'system' });
    const state = viewState(rt.state, req.session, LC, COLLECTIONS);
    res.set('Cache-Control', 'no-store');
    res.json({ session: publicSession(req.session), state, columns: LC.INVENTORY_COLUMNS, version: hub.version, epoch: hub.epoch, serverTime: Date.now() });
  });

  router.get('/events', need, (req, res) => {
    const since = req.query.since != null && req.query.since !== '' ? Number(req.query.since) : (req.headers['last-event-id'] ? Number(req.headers['last-event-id']) : null);
    req.socket.setKeepAlive(true); req.socket.setNoDelay(true); req.socket.setTimeout(0);
    hub.connect(req, res, req.session, { since: Number.isFinite(since) ? since : null, epoch: String(req.query.epoch || '') });
  });

  router.post('/sync', need, (req, res) => {
    const body = req.body;
    if (!isPlain(body) || !Array.isArray(body.changes)) return res.status(400).json({ error: 'Send { changes: [...] }.' });
    const out = applySync({ rt, tracker, session: req.session, body: { ...body, clientId: typeof body.clientId === 'string' ? body.clientId.slice(0, 40) : null, meta: isPlain(body.meta) ? body.meta : {} } });
    res.json({ ok: true, ...out, version: hub.version });
  });

  router.post('/owner/reply', auth.requireRole('owner'), (req, res) => {
    const { unitId, n } = req.body || {};
    const out = applyOwnerReply({ rt, tracker, session: req.session, unitId: String(unitId || ''), n: Number(n) });
    if (out.error) return res.status(out.status).json({ error: out.error });
    res.json({ ok: true, message: out.message });
  });

  auth.onLogout = (hash) => hub.dropSession(hash);

  return {
    hub, router, applySync: (session, body) => applySync({ rt, tracker, session, body }),
    close() { offEmit(); clearInterval(sweep); if (t) clearTimeout(t); hub.close(); },
  };
}

module.exports = { createSync, applySync, applyOwnerReply, Hub, newId };
