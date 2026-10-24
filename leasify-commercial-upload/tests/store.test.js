'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('../server/runtime');
const { Tracker } = require('../server/collections');
const { Store, createPool, migrate } = require('../server/store');
const { DB, sleep } = require('./helpers');
const crypto = require('node:crypto');

const KEYS = ['units', 'clients', 'leads', 'visits', 'tasks', 'queue', 'activity', 'audit', 'consent', 'syncLog'];
const counts = (S) => Object.fromEntries(KEYS.map((k) => [k, S[k].length]));
const quiet = { info() {}, warn() {}, error() {} };

async function boot(pool) {
  const rt = createRuntime(); const tracker = new Tracker(rt);
  const store = new Store({ pool, runtime: rt, tracker, flushMs: 80, log: quiet });
  const loaded = await store.load();
  return { rt, tracker, store, loaded };
}

test('store: seed, write, restart and load gives the same data', async (t) => {
  const schema = 't_' + crypto.randomBytes(5).toString('hex');
  const pool = await createPool({ databaseUrl: DB, schema });
  t.after(async () => { await pool.query('DROP SCHEMA "' + schema + '" CASCADE'); await pool.end(); });
  await migrate(pool);

  const a = await boot(pool);
  assert.equal(a.loaded, false, 'empty database');
  await a.store.seedAndPersist();
  assert.equal(a.rt.state.units.length, 50);
  assert.equal(a.rt.state.clients.length, 96);
  // typed columns are filled
  const row = (await pool.query("SELECT stage, agent, phone, source, created_at FROM clients LIMIT 1")).rows[0];
  assert.ok(row.stage && row.agent && row.phone && row.source && row.created_at);
  const urow = (await pool.query("SELECT status, city, property_type, owner_name, listing_agent, last_confirmed FROM units WHERE id = 'LC-001'")).rows[0];
  assert.equal(urow.status, 'Available'); assert.ok(urow.owner_name && urow.listing_agent && urow.last_confirmed);

  // change things the way the engine does, then let the flusher write them
  a.store.start();
  const noteId = a.rt.state.clients[0].id; const stageId = a.rt.state.clients[1].id;
  a.rt.state.clients[0].notes = 'persisted note';
  a.rt.LC.crm.moveStage(stageId, 'Proposal', 'Test');
  a.rt.LC.log('A test entry', { kind: 'test' });
  a.rt.state.settings.slaMinutes = 21;
  a.rt.LC.sim.speed = 6; a.rt.LC.sim.start(6);
  const stop = a.rt.onEmit(() => { clearTimeout(a.t); a.t = setTimeout(() => a.tracker.collect({ by: 'engine' }), 30); });
  await sleep(2500);
  stop(); a.rt.LC.sim.stop();
  a.tracker.collect({ by: 'engine' });
  await a.store.close();
  const before = counts(a.rt.state);
  const ids = { clients: Array.from(a.rt.state.clients, (c) => c.id), leads: Array.from(a.rt.state.leads, (l) => l.id), activity: Array.from(a.rt.state.activity.slice(0, 5), (e) => e._id) };
  assert.ok(before.leads >= 6, 'simulator made leads');
  a.rt.close();

  const b = await boot(pool);
  assert.equal(b.loaded, true, 'second boot loads from the database');
  assert.deepEqual(counts(b.rt.state), before);
  assert.deepEqual(Array.from(b.rt.state.clients, (c) => c.id), ids.clients, 'array order survives');
  assert.deepEqual(Array.from(b.rt.state.leads, (l) => l.id), ids.leads);
  assert.deepEqual(Array.from(b.rt.state.activity.slice(0, 5), (e) => e._id), ids.activity, 'append-only ids are stable');
  assert.equal(b.rt.LC.crm.get(noteId).notes, 'persisted note');
  assert.equal(b.rt.LC.crm.get(stageId).stage, 'Proposal');
  assert.equal(b.rt.state.settings.slaMinutes, 21);
  assert.ok(b.rt.state.activity.some((e) => e.text === 'A test entry'));
  // a second flush with nothing changed writes nothing
  b.tracker.collect({ by: 'x' });
  assert.equal(Object.values(b.store.pending).reduce((n, p) => n + p.upserts.size + p.rows.length, 0), 0);
  b.rt.close();
});

test('store: reset truncates and reseeds', async (t) => {
  const schema = 't_' + crypto.randomBytes(5).toString('hex');
  const pool = await createPool({ databaseUrl: DB, schema });
  t.after(async () => { await pool.query('DROP SCHEMA "' + schema + '" CASCADE'); await pool.end(); });
  await migrate(pool);
  const a = await boot(pool);
  await a.store.seedAndPersist();
  const firstId = a.rt.state.clients[0].id;
  a.rt.LC.crm.add({ name: 'Extra', phone: '+91 9111111111' });
  a.tracker.collect({ by: 'test' }); await a.store.flush();
  assert.equal((await pool.query('SELECT count(*)::int n FROM clients')).rows[0].n, 97);
  await a.store.reset('tester');
  assert.equal(a.rt.state.clients.length, 96);
  assert.notEqual(a.rt.state.clients[0].id, firstId, 'new seed, new ids');
  assert.equal((await pool.query('SELECT count(*)::int n FROM clients')).rows[0].n, 96);
  assert.equal((await pool.query('SELECT count(*)::int n FROM units')).rows[0].n, 50);
  a.rt.close();
});
