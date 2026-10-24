'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, sleep } = require('./helpers');

let S;
test.before(async () => { S = await startServer(); });
test.after(async () => { await S.close(); });

const sync = (c, changes) => c.post('/api/sync', { clientId: 'test', changes });

test('a change from one session arrives as a patch on another session\'s stream', async () => {
  const a = S.client(); await a.login('ceo');
  const b = S.client(); await b.login('rohit');
  const boot = await b.bootstrap();
  const es = await b.events('?since=' + boot.version + '&epoch=' + boot.epoch);
  try {
    await es.waitFor((m) => m.type === 'hello');
    const cl = S.rt.state.clients[4];
    const r = await sync(a, [{ collection: 'clients', upserts: [{ ...JSON.parse(JSON.stringify(cl)), notes: 'seen over SSE' }], patch: { [cl.id]: ['notes'] }, removes: [] }]);
    assert.equal(r.data.rejected.length, 0);
    const m = await es.waitFor((x) => x.type === 'patch' && x.collection === 'clients' && x.upserts.some((u) => u.id === cl.id));
    assert.equal(m.upserts.find((u) => u.id === cl.id).notes, 'seen over SSE');
    assert.ok(m.v > boot.version);
  } finally { es.close(); }
});

test('a change made by the engine itself is broadcast too', async () => {
  const b = S.client(); await b.login('priyanka');
  const es = await b.events();
  try {
    await es.waitFor((m) => m.type === 'hello');
    const cl = S.rt.state.clients[7];
    S.rt.LC.crm.addActivity(cl.id, 'note', 'engine says hello', 'AI agent');
    const m = await es.waitFor((x) => x.type === 'patch' && x.collection === 'clients' && x.upserts.some((u) => u.id === cl.id));
    assert.ok(m.upserts[0].timeline.some((e) => e.text === 'engine says hello'));
  } finally { es.close(); }
});

test('an owner stream only carries that owner\'s records', async () => {
  const owner = S.rt.state.units[0].owner_name;
  const other = S.rt.state.units.find((u) => u.owner_name !== owner);
  const mine = S.rt.state.units.find((u) => u.owner_name === owner);
  const o = S.client(); await o.login('owner-' + owner.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60));
  const es = await o.events();
  try {
    await es.waitFor((m) => m.type === 'hello');
    other.highlights = 'engine touched';
    mine.highlights = 'engine touched';
    const m = await es.waitFor((x) => x.type === 'patch' && x.collection === 'units');
    assert.ok(m.upserts.every((u) => u.owner_name === owner));
    assert.ok(m.upserts.some((u) => u.unit_id === mine.unit_id));
    await sleep(400);
    const leaked = es.msgs.filter((x) => x.type === 'patch' && ['leads', 'queue', 'consent'].includes(x.collection));
    assert.equal(leaked.length, 0);
    assert.ok(!es.msgs.some((x) => x.type === 'patch' && x.collection === 'units' && x.upserts.some((u) => u.unit_id === other.unit_id)));
  } finally { es.close(); }
});

test('a browser that missed a batch is caught up, and a stale epoch is told to resync', async () => {
  const a = S.client(); await a.login('ceo');
  const boot = await a.bootstrap();
  const cl = S.rt.state.clients[9];
  await sync(a, [{ collection: 'clients', upserts: [{ ...JSON.parse(JSON.stringify(cl)), notes: 'missed one' }], patch: { [cl.id]: ['notes'] }, removes: [] }]);
  await sleep(300);
  const es = await a.events('?since=' + boot.version + '&epoch=' + boot.epoch);
  try {
    const m = await es.waitFor((x) => x.type === 'patch' && x.collection === 'clients' && x.upserts.some((u) => u.id === cl.id));
    assert.equal(m.upserts.find((u) => u.id === cl.id).notes, 'missed one');
    assert.ok(!es.msgs.some((x) => x.type === 'resync'));
  } finally { es.close(); }
  const stale = await a.events('?since=1&epoch=not-this-server');
  try { await stale.waitFor((x) => x.type === 'resync'); } finally { stale.close(); }
});

test('reset tells every stream to reload, and signing out ends that session\'s stream', async () => {
  const ceo = S.client(); await ceo.login('ceo');
  const b = S.client(); await b.login('rohit');
  const esB = await b.events();
  try {
    await esB.waitFor((m) => m.type === 'hello');
    assert.equal((await b.post('/api/reset')).status, 403, 'only the CEO can reset');
    const r = await ceo.post('/api/reset'); assert.equal(r.status, 200);
    await esB.waitFor((m) => m.type === 'reset');
    assert.ok(S.rt.state.clients.length > 90, 'demo data is back');
  } finally { esB.close(); }
  const c = S.client(); await c.login('ananya');
  const esC = await c.events();
  try {
    await esC.waitFor((m) => m.type === 'hello');
    await c.post('/api/logout');
    await esC.waitFor((m) => m.type === 'signed-out');
  } finally { esC.close(); }
});
