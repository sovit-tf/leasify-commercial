'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('../server/runtime');
const { sleep } = require('./helpers');

test('runtime boots headless and seeds the demo data', () => {
  const rt = createRuntime();
  try {
    rt.seed();
    const S = rt.state;
    assert.equal(S.units.length, 50);
    assert.equal(S.clients.length, 96);
    assert.ok(S.visits.length > 30 && S.tasks.length > 10);
    assert.equal(S.leads.length, 0);
    assert.equal(rt.LC.unit('LC-001').unit_id, 'LC-001');
    assert.equal(typeof rt.engine.createLead, 'function');
    for (const name of ['createLead', 'receive', 'takeOver', 'handBack', 'agentSend', 'leadById', 'pickUp', 'aiRespond', 'ensureTicker']) assert.equal(typeof rt.engine[name], 'function', name);
  } finally { rt.close(); }
});

test('units come from data/inventory.json through the shared normaliser', () => {
  const rt = createRuntime();
  try {
    rt.seed();
    const u = rt.state.units[0];
    assert.ok(Array.isArray(u.permitted_uses) && u.permitted_uses.length > 0);
    assert.equal(typeof u.all_in_per_sqft, 'number');
    assert.ok(rt.LC.INVENTORY_COLUMNS.includes('owner_phone'));
  } finally { rt.close(); }
});

test('the simulator runs in Node and produces leads, queue items and clients', async () => {
  const rt = createRuntime();
  try {
    rt.seed();
    const seen = new Set(); rt.onEmit((e) => seen.add(e));
    const msgs = []; rt.onMessage((lead, m) => msgs.push(m));
    const clientsBefore = rt.state.clients.length;
    rt.LC.sim.speed = 6;
    rt.LC.sim.start(20);
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !(rt.state.leads.length >= 20 && rt.state.queue.length >= 1 && msgs.some((m) => m.cards && m.cards.length))) await sleep(250);
    assert.ok(rt.state.leads.length >= 20, 'leads: ' + rt.state.leads.length);
    assert.ok(rt.state.queue.length >= 1, 'queue items');
    assert.ok(rt.state.clients.length > clientsBefore, 'new clients');
    assert.ok(seen.has('leads:changed') && seen.has('queue:changed') && seen.has('clients:changed'));
    assert.ok(msgs.some((m) => m.from === 'ai') && msgs.some((m) => m.from === 'lead'), 'onMessage sees both sides');
    assert.ok(msgs.some((m) => m.cards && m.cards.length), 'cards are attached when the hook runs');
  } finally { rt.close(); }
});

test('a test lead can be driven through the engine hooks (the way the WhatsApp module will)', async () => {
  const rt = createRuntime();
  try {
    rt.seed();
    const E = rt.engine; const out = [];
    rt.onMessage((lead, m) => { if (m.from === 'ai' || m.from === 'agent') out.push(m); });
    const lead = E.createLead({ name: 'Test Occupier', company: '', phone: '+91 9000000001', source: 'Office WhatsApp', language: 'English', test: true });
    lead.channel = 'whatsapp';
    E.ensureTicker();
    E.receive(lead, 'Hi, I need an office of about 2000 sq ft near Patia, budget 70 per sq ft');
    await until(() => out.length > 0, 6000);
    assert.equal(lead.status, 'ai');
    assert.ok(lead.clientId, 'a client was created');
    E.takeOver(lead, 'Rohit Mohanty');
    assert.equal(lead.status, 'human');
    E.agentSend(lead, 'Hello, Rohit here.');
    assert.equal(out[out.length - 1].from, 'agent');
    E.handBack(lead);
    assert.equal(lead.status, 'ai');
  } finally { rt.close(); }
});

async function until(fn, ms) { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await sleep(50); } }
