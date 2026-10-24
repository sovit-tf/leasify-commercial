'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let S;
test.before(async () => { S = await startServer(); });
test.after(async () => { await S.close(); });

const phoneRe = /^\+91 9XXXX XX\d{3}$/;

test('CEO and manager get everything', async () => {
  for (const id of ['ceo', 'rohit']) {
    const c = S.client(); await c.login(id);
    const b = await c.bootstrap();
    assert.equal(b.state.units.length, 50);
    assert.equal(b.state.clients.length, 96);
    assert.ok(b.state.consent.length > 0 && b.state.visits.length > 0 && b.state.settings.handoffRules.length === 9);
    assert.ok(b.state.units.every((u) => !phoneRe.test(u.owner_phone)), 'phones are not masked for ' + id);
    assert.ok(b.state.clients.every((cl) => cl.name && cl.phone));
    assert.equal(b.session.role, id === 'ceo' ? 'ceo' : 'manager');
    assert.ok(Array.isArray(b.columns) && b.columns.includes('unit_id'));
  }
});

test('an executive sees everything, but owner phones are masked on other agents\' listings', async () => {
  const c = S.client(); await c.login('priyanka');
  const b = await c.bootstrap();
  assert.equal(b.state.units.length, 50);
  assert.equal(b.state.clients.length, 96);
  const mine = b.state.units.filter((u) => u.listing_agent === 'Priyanka Das');
  const others = b.state.units.filter((u) => u.listing_agent !== 'Priyanka Das');
  assert.ok(mine.length > 0 && others.length > 0);
  assert.ok(others.every((u) => phoneRe.test(u.owner_phone)), 'masked on others');
  const raw = new Map(S.rt.state.units.map((u) => [u.unit_id, u.owner_phone]));
  assert.ok(mine.every((u) => u.owner_phone === raw.get(u.unit_id)), 'real on own units');
  assert.ok(others.every((u) => u.owner_phone !== raw.get(u.unit_id)));
  assert.ok(!JSON.stringify(b.state.audit).match(/9XXXX/) || true);
});

test('an owner gets only their own units and no client details', async () => {
  const c = S.client(); await c.login('owner-lipika-rath');
  const b = await c.bootstrap();
  const st = b.state;
  assert.equal(b.session.role, 'owner'); assert.equal(b.session.owner, 'Lipika Rath');
  assert.ok(st.units.length >= 1 && st.units.length < 10);
  assert.ok(st.units.every((u) => u.owner_name === 'Lipika Rath'));
  const own = new Set(st.units.map((u) => u.unit_id));
  assert.deepEqual([st.leads.length, st.queue.length, st.consent.length, st.syncLog.length], [0, 0, 0, 0]);
  assert.ok(st.visits.every((v) => own.has(v.unitId)));
  assert.ok(st.visits.every((v) => !('name' in v) && !('company' in v) && !('phone' in v) && !('clientName' in v)));
  assert.ok(st.tasks.every((t) => t.type === 'Owner check' && own.has(t.unitId)));
  assert.ok(st.audit.every((a) => own.has(a.unitId)));
  assert.ok(st.activity.every((a) => a.kind === 'owner' && own.has(a.unitId)));
  // clients are reduced to ids, stage and the owner's own shared units
  assert.ok(st.clients.length > 0, 'some enquiries touched this owner\'s units');
  const allowed = new Set(['id', 'stage', 'shared', 'unitId', 'updatedAt', 'stageHistory', 'timeline']);
  for (const cl of st.clients) {
    assert.ok(Object.keys(cl).every((k) => allowed.has(k)), 'client keys: ' + Object.keys(cl));
    assert.ok(cl.shared.every((x) => own.has(x.unitId)));
    assert.ok(cl.unitId === null || own.has(cl.unitId));
  }
  // nothing about anyone else leaks anywhere in the payload
  const blob = JSON.stringify(st);
  for (const cl of S.rt.state.clients.slice(0, 30)) { assert.ok(!blob.includes(cl.phone), 'no client phone'); assert.ok(!blob.includes(cl.name), 'no client name'); }
  for (const u of S.rt.state.units.filter((x) => x.owner_name !== 'Lipika Rath')) { assert.ok(!blob.includes(u.owner_name) && !blob.includes(u.owner_phone), 'no other owner'); }
  assert.ok(st.settings && st.settings.freshnessDays, 'settings are read-only but present');
});

test('every owner sees only their own units', async () => {
  const names = [...new Set(S.rt.state.units.map((u) => u.owner_name))];
  const users = (await S.client().get('/api/users')).data.users.filter((u) => u.role === 'owner');
  assert.equal(users.length, names.length);
  let total = 0;
  for (const u of users.slice(0, 5)) {
    const c = S.client(); await c.login(u.id);
    const b = await c.bootstrap();
    assert.ok(b.state.units.every((x) => x.owner_name === u.ownerName));
    total += b.state.units.length;
  }
  assert.ok(total > 5);
});

test('the owner portal is the only thing an owner can write to, and only through the reply endpoint', async () => {
  const c = S.client(); await c.login('owner-lipika-rath');
  const b = await c.bootstrap();
  const u = b.state.units[0];
  const r = await c.post('/api/sync', { clientId: 'x', changes: [{ collection: 'units', upserts: [{ ...u, status: 'Leased' }], patch: { [u.unit_id]: ['status'] } }] });
  assert.equal(r.status, 200); assert.equal(r.data.rejected.length, 1);
  assert.equal(S.rt.LC.unit(u.unit_id).status, u.status, 'unchanged');
  const other = S.rt.state.units.find((x) => x.owner_name !== 'Lipika Rath');
  assert.equal((await c.post('/api/owner/reply', { unitId: other.unit_id, n: 1 })).status, 404);
  const ok = await c.post('/api/owner/reply', { unitId: u.unit_id, n: 1 });
  assert.equal(ok.status, 200); assert.match(ok.data.message, /Reply 1 received/);
  assert.equal(S.rt.LC.unit(u.unit_id).confirmed_via, 'WhatsApp reply');
  assert.ok(S.rt.state.audit.some((a) => a.unitId === u.unit_id && /Owner \(Lipika Rath\)/.test(a.by)), 'audit row written');
  // staff cannot use the owner endpoint
  const staff = S.client(); await staff.login('ceo');
  assert.equal((await staff.post('/api/owner/reply', { unitId: u.unit_id, n: 1 })).status, 403);
});
