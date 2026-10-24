'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, until } = require('./helpers');

let S;
test.before(async () => { S = await startServer(); });
test.after(async () => { await S.close(); });

const sync = (c, changes, meta) => c.post('/api/sync', { clientId: 'test', changes, meta });
const clientOf = (agent) => S.rt.state.clients.find((c) => c.agent === agent && !['Lost', 'Signed lease'].includes(c.stage));

test('an executive cannot edit another agent\'s client: rejected, with the server version returned', async () => {
  const c = S.client(); await c.login('priyanka');
  const theirs = S.rt.state.clients.find((x) => x.agent !== 'Priyanka Das');
  const r = await sync(c, [{ collection: 'clients', upserts: [{ ...theirs, notes: 'hacked' }], patch: { [theirs.id]: ['notes'] }, removes: [] }]);
  assert.equal(r.status, 200);
  assert.equal(r.data.rejected.length, 1);
  assert.match(r.data.rejected[0].reason, /only change clients assigned to you/);
  assert.equal(r.data.rejected[0].current.id, theirs.id);
  assert.notEqual(S.rt.LC.crm.get(theirs.id).notes, 'hacked');
});

test('an executive can edit their own client; only the changed fields are applied', async () => {
  const c = S.client(); await c.login('priyanka');
  const mine = clientOf('Priyanka Das');
  const before = JSON.parse(JSON.stringify(mine));
  // another change happens on the server at the same time (field the browser does not touch)
  S.rt.LC.crm.addActivity(mine.id, 'note', 'Server side note', 'AI agent');
  const r = await sync(c, [{ collection: 'clients', upserts: [{ ...before, notes: 'call back Friday' }], patch: { [mine.id]: ['notes'] }, removes: [] }]);
  assert.equal(r.data.rejected.length, 0); assert.equal(r.data.accepted.clients, 1);
  const now = S.rt.LC.crm.get(mine.id);
  assert.equal(now.notes, 'call back Friday');
  assert.ok(now.timeline.some((e) => e.text === 'Server side note'), 'the server\'s timeline change was not overwritten');
});

test('an executive can create a client, then owns edits to it only if assigned to them', async () => {
  const c = S.client(); await c.login('priyanka');
  const rec = JSON.parse(JSON.stringify(S.rt.state.clients[5])); rec.id = 'cl-new-1'; rec.name = 'Brand New'; rec.agent = 'Priyanka Das';
  const r = await sync(c, [{ collection: 'clients', upserts: [rec], removes: [] }]);
  assert.equal(r.data.accepted.clients, 1);
  assert.equal(S.rt.state.clients[0].id, 'cl-new-1', 'new clients go to the front, like the engine does');
  assert.equal(S.rt.LC.crm.get('cl-new-1').name, 'Brand New');
});

test('bad data is refused', async () => {
  const c = S.client(); await c.login('ceo');
  const cl = S.rt.state.clients[3];
  let r = await sync(c, [{ collection: 'clients', upserts: [{ ...cl, stage: 'Made up' }], removes: [] }]);
  assert.match(r.data.rejected[0].reason, /Unknown client stage/);
  r = await sync(c, [{ collection: 'nonsense', upserts: [{ id: 'x' }], removes: [] }]);
  assert.match(r.data.rejected[0].reason, /Unknown collection/);
  r = await sync(c, [{ collection: 'clients', upserts: [JSON.parse('{"id":"zz","__proto__":{"x":1}}')], removes: [] }]);
  assert.equal(r.data.rejected.length, 1);
  assert.equal((await c.post('/api/sync', { nope: true })).status, 400);
});

test('leads and handoff creation cannot be pushed from a browser', async () => {
  const c = S.client(); await c.login('ceo');
  const r = await sync(c, [{ collection: 'leads', upserts: [{ id: 'ld-x', name: 'x' }], removes: [] }, { collection: 'queue', upserts: [{ id: 'q-x', status: 'Waiting' }], removes: [] }]);
  assert.match(r.data.rejected[0].reason, /managed by the server/);
  assert.equal(S.rt.state.leads.length, 0);
});

test('the CEO can change settings and an audit row appears; manager and executive cannot', async () => {
  const ceo = S.client(); await ceo.login('ceo');
  const s = JSON.parse(JSON.stringify(S.rt.state.settings));
  const r = await sync(ceo, [{ collection: 'settings', upserts: [{ ...s, slaMinutes: 20 }], patch: { main: ['slaMinutes'] } }]);
  assert.equal(r.data.rejected.length, 0);
  assert.equal(S.rt.state.settings.slaMinutes, 20);
  const row = S.rt.state.audit.find((a) => a.entity === 'settings' && a.field === 'slaMinutes');
  assert.ok(row, 'settings audit row'); assert.equal(row.from, '15'); assert.equal(row.to, '20'); assert.equal(row.by, 'Sanjeev Das'); assert.ok(row._id);
  assert.equal(r.data.audit.length, 1, 'the response carries the new audit row');
  // a handoff rule switch
  const rules = JSON.parse(JSON.stringify(S.rt.state.settings.handoffRules)); rules[0].on = false;
  await sync(ceo, [{ collection: 'settings', upserts: [{ ...s, handoffRules: rules }], patch: { main: ['handoffRules'] } }]);
  assert.ok(S.rt.state.audit.some((a) => a.field === 'handoffRules.H1.on' && a.to === 'false'));
  for (const id of ['rohit', 'ananya']) {
    const c = S.client(); await c.login(id);
    const x = await sync(c, [{ collection: 'settings', upserts: [{ ...s, slaMinutes: 99 }], patch: { main: ['slaMinutes'] } }]);
    assert.match(x.data.rejected[0].reason, /Only the CEO/);
  }
  assert.equal(S.rt.state.settings.slaMinutes, 20);
  // and a nonsense value is refused
  const bad = await sync(ceo, [{ collection: 'settings', upserts: [{ slaMinutes: 'soon' }], patch: { main: ['slaMinutes'] } }]);
  assert.match(bad.data.rejected[0].reason, /must be a number/);
});

test('unit changes write audit rows on the server (field, from, to, who); sheet syncs say so', async () => {
  const c = S.client(); await c.login('rohit');
  const u = JSON.parse(JSON.stringify(S.rt.LC.unit('LC-002')));
  const was = u.rent_per_sqft;
  const r = await sync(c, [{ collection: 'units', upserts: [{ ...u, rent_per_sqft: was + 3, monthly_rent: 1, status: 'Under negotiation' }], patch: { 'LC-002': ['rent_per_sqft', 'monthly_rent', 'status'] } }]);
  assert.equal(r.data.rejected.length, 0);
  const rows = S.rt.state.audit.filter((a) => a.unitId === 'LC-002');
  const rent = rows.find((a) => a.field === 'rent_per_sqft');
  assert.deepEqual([rent.from, rent.to, rent.by, rent.channel], [String(was), String(was + 3), 'Rohit Mohanty', 'app']);
  assert.ok(rows.some((a) => a.field === 'status' && a.to === 'Under negotiation'));
  assert.ok(!rows.some((a) => a.field === 'monthly_rent'), 'derived fields are not logged');
  const u3 = JSON.parse(JSON.stringify(S.rt.LC.unit('LC-003')));
  await sync(c, [{ collection: 'units', upserts: [{ ...u3, floor: 9 }], patch: { 'LC-003': ['floor'] } }], { channel: 'sheet', source: 'Google Sheet' });
  const sheet = S.rt.state.audit.find((a) => a.unitId === 'LC-003' && a.field === 'floor');
  assert.equal(sheet.channel, 'sheet'); assert.match(sheet.by, /Rohit Mohanty via Google Sheet/);
  // browser-sent audit rows are not trusted
  const before = S.rt.state.audit.length;
  await sync(c, [{ collection: 'audit', upserts: [{ _id: 'fake', ts: Date.now(), unitId: 'LC-001', field: 'x', from: '', to: '', by: 'Someone Else' }], removes: [] }]);
  assert.equal(S.rt.state.audit.length, before);
});

test('an executive can edit their own units only', async () => {
  const c = S.client(); await c.login('subham');
  const mine = S.rt.state.units.find((u) => u.listing_agent === 'Subham Sahoo');
  const theirs = S.rt.state.units.find((u) => u.listing_agent !== 'Subham Sahoo');
  let r = await sync(c, [{ collection: 'units', upserts: [{ ...mine, data_flag: 'check fire noc' }], patch: { [mine.unit_id]: ['data_flag'] } }]);
  assert.equal(r.data.rejected.length, 0); assert.equal(S.rt.LC.unit(mine.unit_id).data_flag, 'check fire noc');
  r = await sync(c, [{ collection: 'units', upserts: [{ ...theirs, status: 'Leased' }], patch: { [theirs.unit_id]: ['status'] } }]);
  assert.match(r.data.rejected[0].reason, /listing agent/);
  assert.notEqual(S.rt.LC.unit(theirs.unit_id).status, 'Leased');
});

test('executives can add to the activity log; replays are ignored; ids are kept', async () => {
  const c = S.client(); await c.login('priyanka');
  const entry = { _id: 'n_test_1', ts: Date.now(), text: 'Called the occupier', kind: 'call', evil: '<script>' };
  const n0 = S.rt.state.activity.length;
  let r = await sync(c, [{ collection: 'activity', upserts: [entry], removes: [] }]);
  assert.equal(r.data.accepted.activity, 1);
  r = await sync(c, [{ collection: 'activity', upserts: [entry], removes: [] }]);
  assert.equal(S.rt.state.activity.length, n0 + 1, 'the same entry twice counts once');
  assert.equal(S.rt.state.activity[0]._id, 'n_test_1'); assert.ok(!('evil' in S.rt.state.activity[0]), 'unknown fields are dropped');
  const bad = await sync(c, [{ collection: 'syncLog', upserts: [{ _id: 'n_s', ts: Date.now(), source: 'x', added: 1, changed: 0, removed: 0 }], removes: [] }]);
  assert.equal(bad.data.rejected.length, 1, 'only manager and CEO can add sync runs');
});

test('visits and tasks follow the agent or the client\'s agent', async () => {
  const c = S.client(); await c.login('ananya');
  const mine = S.rt.state.clients.find((x) => x.agent === 'Ananya Patnaik' && !['Lost', 'Signed lease'].includes(x.stage));
  const other = S.rt.state.clients.find((x) => x.agent !== 'Ananya Patnaik');
  const mk = (cl) => ({ id: 'vis-' + cl.id, clientId: cl.id, unitId: 'LC-001', when: Date.now() + 864e5, by: 'Ananya Patnaik', status: 'Booked', confirmation: 'Pending', agent: cl.agent, feedback: '', rating: null, createdAt: Date.now() });
  let r = await sync(c, [{ collection: 'visits', upserts: [mk(mine)], removes: [] }]);
  assert.equal(r.data.accepted.visits, 1);
  r = await sync(c, [{ collection: 'visits', upserts: [mk(other)], removes: [] }]);
  assert.equal(r.data.rejected.length, 1);
  const task = S.rt.state.tasks.find((t) => t.assignee !== 'Ananya Patnaik' && !t.done);
  r = await sync(c, [{ collection: 'tasks', upserts: [{ ...task, done: true }], patch: { [task.id]: ['done'] } }]);
  assert.equal(r.data.rejected.length, 1); assert.equal(S.rt.state.tasks.find((t) => t.id === task.id).done, false);
});

test('a change saved through the API is still there after the server restarts', async () => {
  const c = S.client(); await c.login('ceo');
  const cl = S.rt.state.clients[10];
  await sync(c, [{ collection: 'clients', upserts: [{ ...cl, notes: 'survives restart' }], patch: { [cl.id]: ['notes'] } }]);
  const schema = S.schema;
  await S.close(false);                                         // flushes on the way out, keeps the schema
  const S2 = await startServer({ schema });
  try {
    assert.equal(S2.rt.LC.crm.get(cl.id).notes, 'survives restart');
    assert.equal(S2.rt.state.clients.length, 97 /* 96 seeded + the one created above */);
    assert.equal(S2.rt.state.settings.slaMinutes, 20);
    const c2 = S2.client(); await c2.login('ceo');
    assert.equal((await c2.bootstrap()).state.units.length, 50);
  } finally { await S2.close(); S = { close: async () => {} }; }
});
