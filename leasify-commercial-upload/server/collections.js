'use strict';
/* =====================================================================
   Collections: how each part of LC.state maps to a Postgres table, and the
   one differ that both the store (write-behind) and the sync hub (live
   updates) use.

   Two kinds:
     records  arrays of objects with an id (units, clients, leads, visits, tasks, queue)
              plus the single settings object.
     append   arrays that only grow (activity, audit, consent, syncLog). Each entry gets a
              stable `_id` the first time it is seen; only new entries are stored.
   ===================================================================== */
const crypto = require('node:crypto');

const ts = (v) => (typeof v === 'number' && Number.isFinite(v) ? new Date(v) : null);
const text = (v) => (v == null || v === '' ? null : String(v).slice(0, 500));
const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const bool = (v) => (v == null ? null : !!v);

/* Leads hold engine-only fields. `_p` (the simulator persona) and `_demo` never leave the process. */
function leadRecord(l) {
  const { _p, _demo, ...rest } = l; // eslint-disable-line no-unused-vars
  if (!rest.channel) rest.channel = _p ? 'sim' : l._test ? 'test' : 'sim';
  return rest;
}

const COLLECTIONS = {
  units: {
    key: 'units', table: 'units', kind: 'records', insertAt: 'back', event: 'units:changed',
    id: (r) => r.unit_id,
    cols: [['status', (r) => text(r.status)], ['city', (r) => text(r.city)], ['property_type', (r) => text(r.property_type)],
      ['owner_name', (r) => text(r.owner_name)], ['listing_agent', (r) => text(r.listing_agent)], ['last_confirmed', (r) => day(r.last_confirmed)]],
  },
  clients: {
    key: 'clients', table: 'clients', kind: 'records', insertAt: 'front', event: 'clients:changed',
    id: (r) => r.id,
    cols: [['stage', (r) => text(r.stage)], ['agent', (r) => text(r.agent)], ['phone', (r) => text(r.phone)], ['source', (r) => text(r.source)], ['created_at', (r) => ts(r.createdAt)]],
  },
  leads: {
    key: 'leads', table: 'leads', kind: 'records', insertAt: 'back', event: 'leads:changed', serverOwned: true,
    id: (r) => r.id, record: leadRecord,
    cols: [['status', (r) => text(r.status)], ['phone', (r) => text(r.phone)], ['source', (r) => text(r.source)], ['channel', (r) => text(r.channel)],
      ['client_id', (r) => text(r.clientId)], ['last_at', (r) => ts(r.lastAt)]],
  },
  visits: {
    key: 'visits', table: 'visits', kind: 'records', insertAt: 'back', event: 'visits:changed',
    id: (r) => r.id,
    cols: [['client_id', (r) => text(r.clientId)], ['unit_id', (r) => text(r.unitId)], ['status', (r) => text(r.status)], ['when_at', (r) => ts(r.when)], ['agent', (r) => text(r.agent)]],
  },
  tasks: {
    key: 'tasks', table: 'tasks', kind: 'records', insertAt: 'back', event: 'tasks:changed',
    id: (r) => r.id,
    cols: [['type', (r) => text(r.type)], ['assignee', (r) => text(r.assignee)], ['due_at', (r) => ts(r.due)], ['done', (r) => bool(r.done)]],
  },
  queue: {
    key: 'queue', table: 'queue_items', kind: 'records', insertAt: 'front', event: 'queue:changed',
    id: (r) => r.id,
    cols: [['lead_id', (r) => text(r.leadId)], ['rule', (r) => text(r.rule)], ['status', (r) => text(r.status)], ['assignee', (r) => text(r.assignee)], ['sla_due', (r) => ts(r.slaDue)]],
  },
  activity: {
    key: 'activity', table: 'activity', kind: 'append', insertAt: 'front', prefix: 'a', cap: 400, keep: 400,
    cols: [['ts', (r) => ts(r.ts)], ['kind', (r) => text(r.kind)]],
  },
  audit: {
    key: 'audit', table: 'audit_log', kind: 'append', insertAt: 'front', prefix: 'u', keep: 2000,
    cols: [['ts', (r) => ts(r.ts)], ['entity', (r) => text(r.entity || (r.unitId ? 'unit' : null))], ['record_id', (r) => text(r.unitId)], ['"by"', (r) => text(r.by)]],
  },
  consent: {
    key: 'consent', table: 'consent_log', kind: 'append', insertAt: 'back', prefix: 'c', keep: 5000,
    cols: [['ts', (r) => ts(r.ts)], ['phone', (r) => text(r.phone)], ['channel', (r) => text(r.channel)]],
  },
  syncLog: {
    key: 'syncLog', table: 'sync_runs', kind: 'append', insertAt: 'front', prefix: 's', keep: 500,
    cols: [['ts', (r) => ts(r.ts)]],
  },
  settings: { key: 'settings', table: 'settings', kind: 'single', event: 'settings:changed', id: () => 'main', cols: [] },
};

const ORDER = ['settings', 'units', 'clients', 'leads', 'visits', 'tasks', 'queue', 'activity', 'audit', 'consent', 'syncLog'];
const RECORD_KEYS = ORDER.filter((k) => COLLECTIONS[k].kind === 'records');
const APPEND_KEYS = ORDER.filter((k) => COLLECTIONS[k].kind === 'append');

const newId = (prefix) => prefix + '_' + crypto.randomBytes(9).toString('base64url');

/** The record as it is stored and served (lead internals trimmed, everything else untouched). */
function recordOf(c, obj) { return c.record ? c.record(obj) : obj; }

/* ---------------------------------------------------------------------
   Tracker: remembers the JSON of every record at the last collect(), and on the
   next collect() reports what changed. Cheap enough to run on every LC event.
   --------------------------------------------------------------------- */
class Tracker {
  constructor(runtime) {
    this.rt = runtime;
    this.snap = {};      // coll -> Map(id -> json string)
    this.ord = {};       // coll -> { map: Map(id -> ord), min, max }
    this.seen = {};      // append coll -> Set(_id)
    this.listeners = new Set();
    this.settingsSnap = null;
    this.reset();
  }

  reset() {
    for (const k of ORDER) {
      this.snap[k] = new Map(); this.ord[k] = { map: new Map(), min: 1, max: 0 }; this.seen[k] = new Set();
    }
    this.settingsSnap = null;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Give the tracker the ord values loaded from the database. */
  adoptOrd(coll, id, ord) {
    const o = this.ord[coll]; o.map.set(id, ord);
    if (o.max < o.min) { o.min = ord; o.max = ord; } else { if (ord < o.min) o.min = ord; if (ord > o.max) o.max = ord; }
  }

  /** ord keeps the order of the engine's array. bulk = the table was empty, so use array order. */
  _ordFor(c, id, indexInArray, bulk) {
    const o = this.ord[c.key];
    if (o.map.has(id)) return o.map.get(id);
    let v;
    if (bulk) { v = indexInArray + 1; if (o.max < o.min) { o.min = v; o.max = v; } else { o.min = Math.min(o.min, v); o.max = Math.max(o.max, v); } }
    else if (o.max < o.min) { v = 1; o.min = 1; o.max = 1; }
    else if (c.insertAt === 'front') { v = o.min - 1; o.min = v; }
    else { v = o.max + 1; o.max = v; }
    o.map.set(id, v); return v;
  }

  /** Remember the current state as "already stored" without reporting anything. */
  baseline() {
    const S = this.rt.state;
    for (const k of RECORD_KEYS) {
      const c = COLLECTIONS[k]; const m = new Map(); const bulk = this.ord[k].map.size === 0;
      (S[k] || []).forEach((obj, i) => { const id = c.id(obj); m.set(id, JSON.stringify(recordOf(c, obj))); this._ordFor(c, id, i, bulk); });
      this.snap[k] = m;
    }
    for (const k of APPEND_KEYS) {
      const c = COLLECTIONS[k]; const set = new Set();
      (S[k] || []).forEach((e) => { if (!e._id) e._id = newId(c.prefix); set.add(e._id); });
      this.seen[k] = set;
    }
    this.settingsSnap = JSON.stringify(S.settings);
  }

  /**
   * Compare the live state with the last snapshot.
   * Returns { coll: { upserts:[{id, json, ord, cols}], removes:[id], order } } for collections that changed,
   * and tells every listener. meta = { by, origin }.
   */
  collect(meta = {}) {
    const S = this.rt.state; if (!S) return null;
    const out = {}; let any = false;
    for (const k of RECORD_KEYS) {
      const c = COLLECTIONS[k]; const prev = this.snap[k]; const next = new Map();
      const upserts = []; const arr = S[k] || []; const bulk = this.ord[k].map.size === 0 && arr.length > 1;
      // front arrays (unshift) are walked oldest first, so new records get ord values and patch order that rebuild the array
      for (let n = 0; n < arr.length; n++) {
        const i = c.insertAt === 'front' ? arr.length - 1 - n : n;
        const obj = arr[i]; const id = c.id(obj); if (id == null) continue;
        const json = JSON.stringify(recordOf(c, obj));
        next.set(id, json);
        if (prev.get(id) !== json) {
          const rec = JSON.parse(json);
          upserts.push({ id, json, ord: this._ordFor(c, id, i, bulk), cols: c.cols.map(([, f]) => f(rec)) });
        }
      }
      const removes = [];
      for (const id of prev.keys()) if (!next.has(id)) { removes.push(id); this.ord[k].map.delete(id); }
      this.snap[k] = next;
      if (upserts.length || removes.length) { out[k] = { upserts, removes }; any = true; }
    }
    for (const k of APPEND_KEYS) {
      const c = COLLECTIONS[k]; const arr = S[k] || []; const prev = this.seen[k]; const cur = new Set(); const upserts = [];
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i]; if (!e || typeof e !== 'object') continue;
        if (!e._id) e._id = newId(c.prefix);
        cur.add(e._id);
        if (!prev.has(e._id)) { upserts.push({ id: e._id, json: JSON.stringify(e), cols: c.cols.map(([, f]) => f(e)) }); }
      }
      this.seen[k] = cur;
      if (upserts.length) { out[k] = { upserts, removes: [], order: c.insertAt }; any = true; }
    }
    const sj = JSON.stringify(S.settings);
    if (sj !== this.settingsSnap) { this.settingsSnap = sj; out.settings = { upserts: [{ id: 'main', json: sj, cols: [] }], removes: [] }; any = true; }
    if (!any) return null;
    for (const fn of this.listeners) { try { fn(out, meta); } catch (e) { console.error('[tracker] listener', e); } }
    return out;
  }
}

module.exports = { COLLECTIONS, ORDER, RECORD_KEYS, APPEND_KEYS, Tracker, newId, recordOf, leadRecord };
