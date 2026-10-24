'use strict';
/* Shared helpers for the node:test suites: a throwaway server on its own Postgres schema,
   a tiny cookie-keeping client and an SSE reader. */
const crypto = require('node:crypto');
const { createApp } = require('../server/index');

const DB = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://leasify:leasify@localhost:5432/leasify';

async function startServer(opts = {}) {
  const schema = opts.schema || 't_' + crypto.randomBytes(5).toString('hex');
  const app = await createApp({ databaseUrl: DB, schema, quiet: true, port: 0, host: '127.0.0.1', flushMs: 100, ...opts });
  const port = await app.start(0, '127.0.0.1');
  const base = 'http://127.0.0.1:' + port;
  const dropSchema = async () => {
    const { Pool } = require('pg'); const p = new Pool({ connectionString: DB, max: 1 });
    try { await p.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE'); } finally { await p.end(); }
  };
  return {
    app, base, schema, rt: app.rt, DB,
    async close(drop = true) { await app.close(); if (drop) await dropSchema(); },
    dropSchema,
    client: () => new Client(base),
  };
}

/** A fetch wrapper that remembers the session cookie. */
class Client {
  constructor(base) { this.base = base; this.cookie = null; }
  async req(method, path, body, headers = {}) {
    const res = await fetch(this.base + path, {
      method, redirect: 'manual',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc && /lc_session=/.test(sc)) { const v = sc.split(';')[0]; this.cookie = /lc_session=;?$/.test(v) ? null : v; }
    let data = null; const text = await res.text();
    try { data = JSON.parse(text); } catch (e) { data = text; }
    return { status: res.status, data, headers: res.headers, setCookie: sc };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b === undefined ? {} : b); }
  async login(userId, pin = '2580') { const r = await this.post('/api/login', { userId, pin }); if (r.status !== 200) throw new Error('login failed ' + r.status + ' ' + JSON.stringify(r.data)); return r; }
  async bootstrap() { const r = await this.get('/api/bootstrap'); if (r.status !== 200) throw new Error('bootstrap ' + r.status); return r.data; }
  /** Open the event stream. messages() returns what arrived; waitFor(pred) resolves on the first match. */
  async events(query = '') {
    const ctl = new AbortController();
    const res = await fetch(this.base + '/api/events' + query, { headers: { Cookie: this.cookie, Accept: 'text/event-stream' }, signal: ctl.signal });
    if (res.status !== 200) { ctl.abort(); return { status: res.status, close() {} }; }
    const msgs = []; const waiters = [];
    (async () => {
      const dec = new TextDecoder(); let buf = '';
      try {
        for await (const chunk of res.body) {
          buf += dec.decode(chunk, { stream: true });
          let i; while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i); buf = buf.slice(i + 2);
            const line = block.split('\n').find((l) => l.startsWith('data: ')); if (!line) continue;
            const m = JSON.parse(line.slice(6)); msgs.push(m);
            for (const w of waiters.slice()) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
          }
        }
      } catch (e) { /* aborted */ }
    })();
    return {
      status: 200, msgs,
      waitFor(pred, ms = 4000) {
        const hit = msgs.find(pred); if (hit) return Promise.resolve(hit);
        return new Promise((resolve, reject) => {
          const w = { pred, resolve }; waiters.push(w);
          setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); reject(new Error('no matching event within ' + ms + ' ms; got ' + JSON.stringify(msgs.map((m) => m.type + ':' + (m.collection || ''))))); } }, ms);
        });
      },
      close() { ctl.abort(); },
    };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000, step = 40) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting'); await sleep(step); }
}

module.exports = { startServer, Client, sleep, until, DB };
