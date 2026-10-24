'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { startServer, until, sleep } = require('./helpers');
const { cardSvg } = require('../server/media');

let S;
test.before(async () => { S = await startServer(); });
test.after(async () => { await S.close(); });

const login = async (id) => { const c = S.client(); await c.login(id); return c; };
const ownerId = async () => (await S.client().get('/api/users')).data.users.find((u) => u.role === 'owner').id;

test('only the CEO, managers and executives can run the simulator; owners and strangers cannot', async () => {
  const anon = S.client();
  for (const [m, p, b] of [['post', '/api/sim/start', { n: 3 }], ['get', '/api/sim/stats'], ['post', '/api/test-chat', { text: 'hi' }], ['post', '/api/leads/x/takeover']]) {
    assert.equal((await anon[m](p, b)).status, 401, p);
  }
  const o = S.client(); await o.login(await ownerId());
  for (const [m, p, b] of [['post', '/api/sim/start', { n: 3 }], ['get', '/api/sim/stats'], ['post', '/api/sim/add', {}], ['post', '/api/test-chat', { text: 'hi' }], ['post', '/api/leads/x/takeover'], ['post', '/api/leads/x/send', { text: 'a' }]]) {
    assert.equal((await o[m](p, b)).status, 403, 'owner ' + p);
  }
  for (const id of ['ceo', 'rohit', 'priyanka']) assert.equal((await (await login(id)).get('/api/sim/stats')).status, 200, id);
});

test('bad input is refused with a plain message', async () => {
  const c = await login('ceo');
  assert.equal((await c.post('/api/sim/start', { n: 0 })).status, 400);
  assert.equal((await c.post('/api/sim/start', { n: 500 })).status, 400);
  assert.equal((await c.post('/api/sim/start', { n: 'many' })).status, 400);
  assert.equal((await c.post('/api/sim/speed', { x: 2 })).status, 400);
  assert.equal((await c.post('/api/sim/add', { source: 'Smoke signals' })).status, 400);
  assert.equal((await c.post('/api/sim/team', { on: 'yes' })).status, 400);
  assert.equal((await c.post('/api/leads/nope/takeover')).status, 404);
  const r = await c.post('/api/sim/start', { n: 0 });
  assert.ok(r.data.error && !/\u2014/.test(r.data.error));
});

test('start, speed, pause, resume and stats: 30 chats appear on the server and in a second browser', async () => {
  const a = await login('ceo'), b = await login('rohit');
  const ev = await b.events();
  try {
    assert.equal((await a.post('/api/sim/speed', { x: 6 })).data.sim.speed, 6);
    const r = await a.post('/api/sim/start', { n: 30 });
    assert.equal(r.status, 200); assert.equal(r.data.started, 30); assert.equal(r.data.sim.active, true);
    await until(() => S.rt.state.leads.length >= 30, 20000, 100);
    assert.equal(S.rt.state.leads.length, 30);
    const second = await b.bootstrap();
    assert.ok(second.state.leads.length >= 20, 'the second browser holds the same chats');
    const sim = await ev.waitFor((m) => m.type === 'sim' && m.sim.active, 6000);
    assert.equal(sim.sim.speed, 6);
    const st = await a.get('/api/sim/stats');
    assert.equal(st.data.stats.total, 30);
    assert.ok(st.data.stats.live >= 1);
    assert.equal((await a.post('/api/sim/stop')).data.sim.paused, true);
    assert.equal((await a.post('/api/sim/resume')).data.sim.paused, false);
    assert.equal((await a.post('/api/sim/team', { on: false })).data.sim.teamWorks, false);
    assert.equal((await a.post('/api/sim/team', { on: true })).data.sim.teamWorks, true);
    assert.equal((await a.post('/api/sim/add', { source: '99acres' })).status, 200);
    // lead updates reach the second browser's event stream under the right collection
    await ev.waitFor((m) => m.type === 'patch' && JSON.stringify(m).includes('"leads"'), 6000);
    // owners never see leads
    const own = S.client(); await own.login(await ownerId());
    assert.equal((await own.bootstrap()).state.leads.length, 0);
  } finally { ev.close(); await (await login('ceo')).post('/api/sim/stop'); }
});

test('take over, type, hand back: the name on the message is the signed-in person', async () => {
  const c = await login('priyanka');
  const lead = S.rt.state.leads.find((l) => l.status === 'ai' || l.status === 'handoff');
  assert.ok(lead, 'there is a chat to take');
  const t = await c.post('/api/leads/' + lead.id + '/takeover');
  assert.equal(t.status, 200); assert.equal(t.data.lead.status, 'human'); assert.equal(t.data.lead.humanBy, 'Priyanka Das');
  assert.equal((await c.post('/api/leads/' + lead.id + '/takeover')).data.unchanged, true, 'taking it twice changes nothing');
  const other = await login('rohit');
  assert.equal((await other.post('/api/leads/' + lead.id + '/takeover')).status, 409);
  const exec2 = await login('ananya');
  assert.equal((await exec2.post('/api/leads/' + lead.id + '/send', { text: 'let me in' })).status, 403, 'someone else cannot type in a chat a colleague holds');
  assert.equal((await c.post('/api/leads/' + lead.id + '/send', { text: '   ' })).status, 400);
  const s = await c.post('/api/leads/' + lead.id + '/send', { text: 'Hello, this is Priyanka from Leasify.' });
  assert.equal(s.status, 200);
  const m = lead.messages.filter((x) => x.from === 'agent').pop();
  assert.equal(m.text, 'Hello, this is Priyanka from Leasify.'); assert.equal(m.by, 'Priyanka Das');
  assert.equal((await other.post('/api/leads/' + lead.id + '/handback')).status, 200, 'a manager may hand back any chat');
  assert.equal(lead.status === 'ai' || lead.status === 'handoff' || lead.status === 'nurture' || lead.status === 'booked' || lead.status === 'closed', true);
  assert.equal((await c.post('/api/leads/' + lead.id + '/send', { text: 'again' })).status, 409, 'not holding it any more');
});

test('pick up from the queue works only for a chat that is waiting', async () => {
  const c = await login('priyanka');
  const waiting = S.rt.state.leads.find((l) => l.status === 'handoff');
  if (waiting) {
    const r = await c.post('/api/leads/' + waiting.id + '/pickup');
    assert.equal(r.status, 200); assert.equal(r.data.lead.status, 'human');
    assert.equal((await c.post('/api/leads/' + waiting.id + '/pickup')).status, 409);
  }
  const ai = S.rt.state.leads.find((l) => l.status === 'ai');
  if (ai) assert.equal((await c.post('/api/leads/' + ai.id + '/pickup')).status, 409);
});

test('"Test as an occupier": a real-time chat that the same person can carry on', async () => {
  const c = await login('ceo');
  assert.equal((await c.post('/api/test-chat', { text: '' })).status, 400);
  const r = await c.post('/api/test-chat', { text: 'Need an office in Patia, 2000 sq ft, budget 80 per sq ft', source: 'Website form', language: 'English', name: 'Test occupier', company: 'Acme' });
  assert.equal(r.status, 200); assert.ok(r.data.leadId);
  const lead = S.rt.state.leads.find((l) => l.id === r.data.leadId);
  assert.equal(lead.channel, 'test'); assert.equal(lead.source, 'Website form'); assert.equal(lead._test, true);
  await until(() => lead.messages.some((m) => m.from === 'ai'), 8000);
  const r2 = await c.post('/api/test-chat', { text: 'plug-and-play', leadId: lead.id });
  assert.equal(r2.status, 200);
  await until(() => lead.messages.filter((m) => m.from === 'lead').length === 2, 3000);
  assert.equal((await c.post('/api/test-chat', { text: 'hi', leadId: 'nope' })).status, 404);
  const sim = S.rt.state.leads.find((l) => l.channel === 'sim');
  if (sim) assert.equal((await c.post('/api/test-chat', { text: 'hi', leadId: sim.id })).status, 400, 'only test chats can be continued here');
});

test('actions are rate limited per person, and reading is not', async () => {
  const c = await login('subham');
  let limited = 0;
  for (let i = 0; i < 40; i++) { const r = await c.get('/api/sim/stats'); if (r.status === 429) limited++; }
  assert.equal(limited, 0, 'reading stats is not limited');
  let first429 = 0;
  for (let i = 0; i < 320 && !first429; i++) { const r = await c.post('/api/sim/speed', { x: 1 }); if (r.status === 429) first429 = i; }
  assert.ok(first429 > 250, 'about 300 actions a minute are allowed, then 429 (stopped at ' + first429 + ')');
  const other = await login('ceo');
  assert.equal((await other.post('/api/sim/speed', { x: 1 })).status, 200, 'another person is not affected');
});

/* ---------------------------------------------------------------- unit card pictures */
test('GET /media/unit/<id>.png: a 1000 x 1000 PNG for a real unit, public, cached, nothing private in it', async () => {
  const u = S.rt.state.units[0];
  const res = await fetch(S.base + '/media/unit/' + u.unit_id + '.png');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.match(res.headers.get('cache-control'), /public/);
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  assert.equal(meta.format, 'png'); assert.equal(meta.width, 1000); assert.equal(meta.height, 1000);
  const again = await fetch(S.base + '/media/unit/' + u.unit_id + '.png');
  assert.deepEqual(Buffer.from(await again.arrayBuffer()), buf, 'the cached picture is the same');
  const svg = cardSvg(S.rt.LC, u);
  assert.match(svg, /Sample listing/); assert.match(svg, /Available from/); assert.match(svg, /sq ft chargeable/);
  assert.ok(!svg.includes(u.owner_name) && !svg.includes(u.owner_phone) && !svg.includes(String(u.owner_phone).replace(/\D/g, '')), 'no owner data in the picture');
});

test('the picture route only serves real unit ids', async () => {
  for (const p of ['/media/unit/NOPE.png', '/media/unit/LC-999.png', '/media/unit/..%2F..%2Fetc%2Fpasswd.png', '/media/unit/LC-001', '/media/unit/LC-001.jpg', '/media/unit/%00.png']) {
    const r = await fetch(S.base + p); assert.equal(r.status, 404, p);
  }
});
