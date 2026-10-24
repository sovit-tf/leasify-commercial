'use strict';
/* =====================================================================
   Store: Postgres persistence for LC.state.
     - migrate()           run server/migrations/*.sql once each
     - load()              rebuild LC.state from the database (false when the database is empty)
     - seedAndPersist()    build the demo state with LC.initState() and write all of it
     - write-behind        the tracker reports changed records; a flusher writes them every
                           500 ms in one transaction (per-record JSON diff, parameterised SQL)
     - reset()             truncate and reseed ("Reset demo data")
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { COLLECTIONS, ORDER, RECORD_KEYS, APPEND_KEYS } = require('./collections');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error('bad identifier ' + s); return '"' + s + '"'; };

/** Pool bound to one schema when `schema` is given (tests use this to stay isolated). */
async function createPool({ databaseUrl, schema, max = 8 }) {
  if (schema) {
    const admin = new Pool({ connectionString: databaseUrl, max: 1 });
    try { await admin.query('CREATE SCHEMA IF NOT EXISTS ' + ident(schema)); } finally { await admin.end(); }
  }
  const pool = new Pool({ connectionString: databaseUrl, max, options: schema ? '-c search_path=' + schema : undefined });
  pool.on('error', (e) => console.error('[pg] idle client error:', e.message));
  return pool;
}

async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(727001)'); } catch (e) { /* ignore */ }
    client.release();
  }
}

const noNul = (json) => (json.includes('\\u0000') ? json.replace(/\\u0000/g, '') : json);   // jsonb cannot hold NUL

class Store {
  constructor({ pool, runtime, tracker, flushMs = 500, log = console }) {
    this.pool = pool; this.rt = runtime; this.tracker = tracker; this.flushMs = flushMs; this.log = log;
    this.pending = this._emptyPending();
    this.chain = Promise.resolve();
    this.timer = null;
    this.lastError = null; this.flushed = 0;
    tracker.onChange((changes, meta) => this._enqueue(changes, meta));
  }

  _emptyPending() {
    const p = {}; for (const k of ORDER) p[k] = { upserts: new Map(), removes: new Set(), rows: [] }; return p;
  }

  _enqueue(changes, meta) {
    const by = (meta && meta.by) || 'system';
    for (const k of Object.keys(changes)) {
      const c = COLLECTIONS[k]; const ch = changes[k]; const p = this.pending[k];
      if (c.kind === 'append') {
        // rows must be inserted oldest first so `seq` follows the order of the engine's array
        const items = ch.order === 'front' ? ch.upserts.slice().reverse() : ch.upserts;
        for (const it of items) p.rows.push({ ...it, by });
      } else {
        for (const it of ch.upserts) { p.removes.delete(it.id); p.upserts.set(it.id, { ...it, by }); }
        for (const id of ch.removes) { p.upserts.delete(id); p.removes.add(id); }
      }
    }
  }

  /* ---------------- loading ---------------- */
  async load() {
    const rt = this.rt; const q = (sql, params) => this.pool.query(sql, params);
    const units = await q('SELECT count(*)::int AS n FROM units');
    const settings = await q("SELECT data::text AS j FROM settings WHERE id = 'main'");
    if (!units.rows[0].n || !settings.rows.length) return false;
    const state = { shortlist: [], compare: [], me: 'Rohit Mohanty' };
    for (const k of RECORD_KEYS) {
      const c = COLLECTIONS[k];
      const res = await q('SELECT id, ord, data::text AS j FROM ' + ident(c.table) + ' ORDER BY ord ASC');
      state[k] = res.rows.map((r) => { this.tracker.adoptOrd(k, r.id, Number(r.ord)); return rt.parse(r.j); });
    }
    for (const k of APPEND_KEYS) {
      const c = COLLECTIONS[k];
      const res = await q('SELECT data::text AS j FROM ' + ident(c.table) + ' ORDER BY seq DESC LIMIT $1', [c.keep]);
      const arr = res.rows.map((r) => rt.parse(r.j));
      state[k] = c.insertAt === 'front' ? arr : arr.reverse();       // front arrays hold newest first
    }
    state.settings = rt.parse(settings.rows[0].j);
    rt.setState(state);
    this.tracker.baseline();
    return true;
  }

  /** Build the demo data in the engine and write all of it. */
  async seedAndPersist() {
    this.tracker.reset();
    this.pending = this._emptyPending();
    this.rt.seed();
    this.tracker.collect({ by: 'seed' });
    await this.flush();
  }

  /* ---------------- writing ---------------- */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.flush().catch((e) => this.log.error('[store] flush failed:', e.message)); }, this.flushMs);
    this.timer.unref();
  }

  /** Write everything pending, in order, one transaction. Safe to call at any time. */
  flush() {
    this.chain = this.chain.then(() => this._flushNow()).catch((e) => { this.lastError = e; this.log.error('[store] flush error:', e.message); });
    return this.chain;
  }

  async _flushNow() {
    const taken = this.pending;
    const empty = ORDER.every((k) => !taken[k].upserts.size && !taken[k].removes.size && !taken[k].rows.length);
    if (empty) return;
    this.pending = this._emptyPending();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const k of ORDER) await this._writeCollection(client, k, taken[k]);
      await client.query('COMMIT');
      this.flushed++; this.lastError = null;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (e2) { /* ignore */ }
      client.release();
      if (e.code && /^(22|23)/.test(e.code)) {            // bad data: isolate the row that fails, store the rest
        this.log.error('[store] bad row, retrying one by one:', e.message);
        await this._flushRowByRow(taken);
      } else {                                              // connection trouble: put it back and try again later
        this._putBack(taken); throw e;
      }
      return;
    }
    client.release();
  }

  _putBack(taken) {
    for (const k of ORDER) {
      const t = taken[k], n = this.pending[k];
      for (const [id, it] of t.upserts) if (!n.upserts.has(id) && !n.removes.has(id)) n.upserts.set(id, it);
      for (const id of t.removes) if (!n.upserts.has(id)) n.removes.add(id);
      n.rows = t.rows.concat(n.rows);
    }
  }

  async _flushRowByRow(taken) {
    for (const k of ORDER) {
      const t = taken[k];
      const parts = [];
      for (const it of t.upserts.values()) parts.push({ upserts: new Map([[it.id, it]]), removes: new Set(), rows: [] });
      for (const id of t.removes) parts.push({ upserts: new Map(), removes: new Set([id]), rows: [] });
      for (const r of t.rows) parts.push({ upserts: new Map(), removes: new Set(), rows: [r] });
      for (const part of parts) {
        const client = await this.pool.connect();
        try { await client.query('BEGIN'); await this._writeCollection(client, k, part); await client.query('COMMIT'); }
        catch (e) { try { await client.query('ROLLBACK'); } catch (e2) { /* ignore */ } this.log.error('[store] dropped a row in ' + k + ':', e.message); }
        finally { client.release(); }
      }
    }
  }

  async _writeCollection(client, k, p) {
    const c = COLLECTIONS[k]; const t = ident(c.table);
    if (c.kind === 'single') {
      for (const it of p.upserts.values()) {
        await client.query('INSERT INTO ' + t + " (id, data, updated_by) VALUES ('main', $1::jsonb, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now(), updated_by = EXCLUDED.updated_by", [noNul(it.json), it.by]);
      }
      return;
    }
    if (c.kind === 'records') {
      const colNames = c.cols.map(([n]) => n);
      const names = ['id', 'ord', ...colNames, 'data', 'updated_by'];
      const items = Array.from(p.upserts.values());
      for (let i = 0; i < items.length; i += 300) {
        const chunk = items.slice(i, i + 300); const params = []; const rows = [];
        for (const it of chunk) {
          const base = params.length;
          params.push(it.id, it.ord, ...it.cols, noNul(it.json), it.by);
          rows.push('(' + names.map((n, j) => (n === 'data' ? '$' + (base + j + 1) + '::jsonb' : '$' + (base + j + 1))).join(',') + ')');
        }
        const set = [...colNames.map((n) => (n.startsWith('"') ? n : ident(n))), 'data', 'updated_by'].map((n) => n + ' = EXCLUDED.' + n).join(', ');
        await client.query('INSERT INTO ' + t + ' (' + names.map((n) => (n.startsWith('"') ? n : ident(n))).join(',') + ') VALUES ' + rows.join(',') + ' ON CONFLICT (id) DO UPDATE SET ' + set + ', updated_at = now()', params);
      }
      if (p.removes.size) await client.query('DELETE FROM ' + t + ' WHERE id = ANY($1::text[])', [Array.from(p.removes)]);
      return;
    }
    // append-only
    const colNames = c.cols.map(([n]) => n);
    const names = ['id', ...colNames, 'data', 'updated_by'];
    for (let i = 0; i < p.rows.length; i += 300) {
      const chunk = p.rows.slice(i, i + 300); const params = []; const rows = [];
      for (const it of chunk) {
        const base = params.length;
        params.push(it.id, ...it.cols, noNul(it.json), it.by);
        rows.push('(' + names.map((n, j) => (n === 'data' ? '$' + (base + j + 1) + '::jsonb' : '$' + (base + j + 1))).join(',') + ')');
      }
      await client.query('INSERT INTO ' + t + ' (' + names.map((n) => (n.startsWith('"') ? n : ident(n))).join(',') + ') VALUES ' + rows.join(',') + ' ON CONFLICT (id) DO NOTHING', params);
    }
  }

  /* ---------------- reset ---------------- */
  /** Truncate the state tables and rebuild the demo data. Users, sessions and WhatsApp logs stay. */
  reset(by = 'reset') {
    const job = this.chain.then(async () => {
      this.pending = this._emptyPending();
      const tables = ORDER.map((k) => ident(COLLECTIONS[k].table)).join(', ');
      await this.pool.query('TRUNCATE ' + tables + ' RESTART IDENTITY');
      this.tracker.reset();
      this.rt.reset();
      this.tracker.collect({ by, reset: true });
      await this._flushNow();
    });
    this.chain = job.catch((e) => { this.log.error('[store] reset error:', e.message); });
    return job;
  }

  async close() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    await this.flush();
  }

  async health() {
    const r = await this.pool.query('SELECT 1 AS ok');
    return { db: r.rows[0].ok === 1, lastError: this.lastError ? this.lastError.message : null, pending: ORDER.reduce((n, k) => n + this.pending[k].upserts.size + this.pending[k].rows.length, 0) };
  }
}

module.exports = { Store, createPool, migrate };
