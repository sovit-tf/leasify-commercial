'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient, parseJsonLoose, validateFields, buildLine, extractRequirement, cleanMessages, AiError } = require('../server/ai');
const { createRuntime } = require('../server/runtime');
const { startServer } = require('./helpers');
const { boot, until, sleep, textMsg, settle } = require('./wa_harness');
const { fakeAI } = require('./fakes');

const quiet = { info() {}, warn() {}, error() {} };
const envFor = (a, extra = {}) => ({ AI_BASE_URL: a.base, AI_API_KEY: 'k-secret', AI_MODEL: a.model, ...extra });

test('chat: plain answer, bearer key, model and messages sent as given', async () => {
  const a = await fakeAI({ handler: () => ({ content: 'Hello there' }) });
  try {
    const c = createClient({ env: envFor(a), log: quiet });
    assert.equal(c.enabled, true);
    const r = await c.chat({ messages: [{ role: 'user', content: 'Say hello' }] });
    assert.equal(r.text, 'Hello there');
    assert.deepEqual(r.tool_calls, []);
    assert.equal(a.requests.length, 1);
    assert.equal(a.requests[0].auth, 'Bearer k-secret');
    assert.equal(a.requests[0].url, '/v1/chat/completions');
    assert.equal(a.requests[0].body.model, 'fake-model');
    assert.equal(a.requests[0].body.messages[0].content, 'Say hello');
  } finally { await a.close(); }
});

test('chat: tool_calls come back parsed and echo back in the OpenAI shape', async () => {
  const a = await fakeAI({ handler: (body, n) => n === 1 ? { tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'find_units', arguments: '{"locality":"Patia","seats":40}' } }] } : { content: 'Two units in Patia.' } });
  try {
    const c = createClient({ env: envFor(a), log: quiet });
    const tools = [{ name: 'find_units', description: 'Find units', parameters: { type: 'object', properties: { locality: { type: 'string' } } } }];
    const r1 = await c.chat({ messages: [{ role: 'user', content: 'units in Patia?' }], tools });
    assert.equal(r1.tool_calls.length, 1);
    assert.equal(r1.tool_calls[0].name, 'find_units');
    assert.deepEqual(r1.tool_calls[0].arguments, { locality: 'Patia', seats: 40 });
    assert.equal(r1.assistant.tool_calls[0].function.arguments, '{"locality":"Patia","seats":40}');
    const sentTool = a.requests[0].body.tools[0];
    assert.equal(sentTool.type, 'function'); assert.equal(sentTool.function.name, 'find_units');
    const r2 = await c.chat({ messages: [{ role: 'user', content: 'units in Patia?' }, r1.assistant, { role: 'tool', tool_call_id: 'call_1', content: '[{"unit":"LC-001"}]' }], tools });
    assert.equal(r2.text, 'Two units in Patia.');
    assert.equal(a.requests[1].body.messages[1].role, 'assistant');
    assert.equal(a.requests[1].body.messages[2].tool_call_id, 'call_1');
  } finally { await a.close(); }
});

test('chat: JSON mode asks for json_object, and a fenced or chatty answer is still read', async () => {
  const a = await fakeAI({ handler: (b, n) => n === 1 ? { content: '{"use":"Office"}' } : { content: 'Sure! Here you go:\n```json\n{"use": "Retail", "seats": 12,}\n```\nHope that helps.' } });
  try {
    const c = createClient({ env: envFor(a), log: quiet });
    const r1 = await c.chat({ messages: [{ role: 'user', content: 'x' }], json: true });
    assert.deepEqual(r1.json, { use: 'Office' });
    assert.deepEqual(a.requests[0].body.response_format, { type: 'json_object' });
    const r2 = await c.chat({ messages: [{ role: 'user', content: 'x' }], json: true });
    assert.deepEqual(r2.json, { use: 'Retail', seats: 12 });
    assert.equal(parseJsonLoose('nothing here'), null);
  } finally { await a.close(); }
});

test('chat: a provider that refuses response_format is asked again without it', async () => {
  const a = await fakeAI({ handler: (b) => b.response_format ? { status: 400, body: { error: { message: "'response_format' of type 'json_object' is not supported" } } } : { content: '{"ok":true}' } });
  try {
    const c = createClient({ env: envFor(a), log: quiet });
    const r = await c.chat({ messages: [{ role: 'user', content: 'x' }], json: true });
    assert.deepEqual(r.json, { ok: true });
    assert.equal(a.requests.length, 2);
    assert.equal(a.requests[1].body.response_format, undefined);
  } finally { await a.close(); }
});

test('chat: timeouts, errors and "off" are typed, and never leak the key', async () => {
  const a = await fakeAI({ handler: (b, n) => n === 1 ? { content: 'late', delay: 700 } : { status: 401, body: { error: { message: 'bad key k-secret' } } } });
  try {
    const c = createClient({ env: envFor(a), log: quiet });
    await assert.rejects(c.chat({ messages: [{ role: 'user', content: 'x' }], timeoutMs: 150 }), (e) => e instanceof AiError && e.code === 'timeout');
    await assert.rejects(c.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === 'upstream' && !/k-secret/.test(e.message));
    const off = createClient({ env: {}, log: quiet });
    assert.equal(off.enabled, false);
    await assert.rejects(off.chat({ messages: [{ role: 'user', content: 'x' }] }), (e) => e.code === 'off');
  } finally { await a.close(); }
});

test('phone numbers are removed from anything sent to the model', () => {
  const r = cleanMessages([{ role: 'user', content: 'Call me on 9876543210 or +91 98765 43210, rent is 150000 and the size is 4,500 sq ft' }]);
  assert.ok(!/9876543210|98765 43210/.test(JSON.stringify(r.messages)));
  assert.match(r.messages[0].content, /150000/);
  assert.match(r.messages[0].content, /4,500 sq ft/);
  assert.ok(cleanMessages([]).error); assert.ok(cleanMessages([{ role: 'robot', content: 'x' }]).error);
});

test('extraction: every value is checked and bad ones are dropped', () => {
  const rt = createRuntime(); rt.seed();
  try {
    const LC = rt.LC;
    const raw = { use: 'Spaceship', size_sqft_min: 5, size_sqft_max: 9999999, seats: 40, budget_per_sqft: 99999, budget_monthly: 200000, localities: ['Patia', 'Atlantis'], city: 'Gotham', move_in_days: -5, furnishing: 'Gold plated', parking_cars: 999 };
    const { fields, dropped } = validateFields(raw, LC);
    assert.equal(fields.use, undefined);
    assert.equal(fields.sizeMin, undefined);
    assert.equal(fields.seats, 40);
    assert.equal(fields.budgetPsf, undefined);
    assert.equal(fields.budgetMonthly, 200000);
    assert.deepEqual(fields.localities, ['Patia']);
    assert.equal(fields.city, undefined);
    assert.equal(fields.moveInDays, undefined);
    assert.equal(fields.furnishing, undefined);
    assert.equal(fields.parking4w, undefined);
    for (const k of ['use', 'size_sqft_min', 'size_sqft_max', 'budget_per_sqft', 'move_in_days', 'furnishing', 'parking_cars']) assert.ok(dropped.includes(k), k + ' dropped');
    assert.ok(dropped.some((d) => /Atlantis/.test(d)));
    const good = validateFields({ use: 'office', size_sqft_min: 2000, size_sqft_max: 2500, budget_per_sqft: 80, localities: ['patia'], move_in_days: 30, furnishing: 'plug-and-play', parking_cars: 2 }, LC);
    assert.equal(good.fields.use, 'Office'); assert.equal(good.fields.furnishing, 'Plug-and-play'); assert.deepEqual(good.fields.localities, ['Patia']);
    assert.equal(good.dropped.length, 0);
    const line = buildLine(good.fields, LC);
    const p = LC.parseRequirement(line, LC.emptyReq(), {});
    assert.equal(p.req.use, 'Office'); assert.equal(p.req.sizeMin, 2000); assert.equal(p.req.budgetPsf, 80); assert.deepEqual(Array.from(p.req.localities), ['Patia']); assert.equal(p.req.parking4w, 2); assert.equal(p.req.furnishing, 'Plug-and-play');
    assert.equal(buildLine({}, LC), null);
    assert.deepEqual(validateFields('nonsense', LC).fields, {});
  } finally { rt.close(); }
});

test('extraction: the model sees the message with no phone number, and a failing model gives { ok: false }', async () => {
  const rt = createRuntime(); rt.seed();
  const a = await fakeAI({ handler: (b, n) => n === 1 ? { content: '{"use":"Office","seats":40}' } : { status: 500 } });
  try {
    const c = createClient({ env: envFor(a), log: quiet });
    const r = await extractRequirement(c, rt.LC, 'team of forty, call 9876543210 please', { log: quiet });
    assert.equal(r.ok, true); assert.match(r.line, /office/); assert.match(r.line, /40 seats/);
    assert.ok(!/9876543210/.test(a.requests[0].raw));
    const bad = await extractRequirement(c, rt.LC, 'team of forty', { log: quiet });
    assert.equal(bad.ok, false);
    const none = await extractRequirement(createClient({ env: {}, log: quiet }), rt.LC, 'team of forty', { log: quiet });
    assert.deepEqual(none, { ok: false, reason: 'off' });
  } finally { await a.close(); rt.close(); }
});

/* ---------------------------------------------------------------- routes */
test('POST /api/ai/chat: signed-in people only, owners included, rate limited, and phone numbers stripped', async () => {
  const a = await fakeAI({ handler: () => ({ content: 'fine' }) });
  const S = await startServer({ env: envFor(a, { AI_RATE_PER_MIN: '3' }) });
  try {
    const anon = S.client();
    assert.equal((await anon.post('/api/ai/chat', { messages: [{ role: 'user', content: 'hi' }] })).status, 401);
    assert.equal((await anon.get('/api/ai/status')).status, 401);
    const ceo = S.client(); await ceo.login('ceo');
    const st = await ceo.get('/api/ai/status');
    assert.equal(st.data.configured, true); assert.equal(st.data.model, 'fake-model'); assert.ok(st.data.provider);
    assert.ok(!JSON.stringify(st.data).includes('k-secret'));
    const users = (await anon.get('/api/users')).data.users;
    const owner = users.find((u) => u.role === 'owner');
    const o = S.client(); await o.login(owner.id);
    const ostat = await o.get('/api/ai/status');
    assert.equal(ostat.data.configured, true); assert.equal(ostat.data.provider, undefined, 'owners do not see the provider');
    const r = await o.post('/api/ai/chat', { messages: [{ role: 'user', content: 'my phone is 9876543210' }] });
    assert.equal(r.status, 200); assert.equal(r.data.text, 'fine');
    assert.ok(!/9876543210/.test(a.requests[0].raw));
    assert.equal((await o.post('/api/ai/chat', { messages: [] })).status, 400);
    assert.equal((await o.post('/api/ai/chat', { messages: [{ role: 'user', content: 'a' }] })).status, 200);
    assert.equal((await o.post('/api/ai/chat', { messages: [{ role: 'user', content: 'b' }] })).status, 200);
    const limited = await o.post('/api/ai/chat', { messages: [{ role: 'user', content: 'c' }] });
    assert.equal(limited.status, 429);
    // someone else is not limited by this person's use
    assert.equal((await ceo.post('/api/ai/chat', { messages: [{ role: 'user', content: 'd' }] })).status, 200);
  } finally { await S.close(); await a.close(); }
});

test('POST /api/ai/chat returns tool calls and JSON to the browser, and a provider failure as a generic error', async () => {
  const a = await fakeAI({ handler: (b, n) => n === 1 ? { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'lookup', arguments: '{"q":"x"}' } }] } : n === 2 ? { content: '{"a":1}' } : { status: 500, body: { error: { message: 'secret detail k-secret' } } } });
  const S = await startServer({ env: envFor(a) });
  try {
    const c = S.client(); await c.login('ceo');
    const t = await c.post('/api/ai/chat', { messages: [{ role: 'user', content: 'x' }], tools: [{ name: 'lookup', description: 'd', parameters: { type: 'object', properties: {} } }] });
    assert.equal(t.data.tool_calls[0].name, 'lookup'); assert.deepEqual(t.data.tool_calls[0].arguments, { q: 'x' }); assert.ok(t.data.assistant.tool_calls);
    const j = await c.post('/api/ai/chat', { messages: [{ role: 'user', content: 'x' }], json: true });
    assert.deepEqual(j.data.json, { a: 1 });
    const bad = await c.post('/api/ai/chat', { messages: [{ role: 'user', content: 'x' }] });
    assert.equal(bad.status, 502); assert.ok(!JSON.stringify(bad.data).includes('k-secret'));
    assert.equal((await c.post('/api/ai/chat', { messages: [{ role: 'user', content: 'x' }], tools: [{ name: 'bad name!' }] })).status, 400);
  } finally { await S.close(); await a.close(); }
});

test('with no AI settings the routes say so and the app carries on', async () => {
  const S = await startServer({ env: {} });
  try {
    const c = S.client(); await c.login('ceo');
    assert.deepEqual((await c.get('/api/ai/status')).data.configured, false);
    const r = await c.post('/api/ai/chat', { messages: [{ role: 'user', content: 'x' }] });
    assert.equal(r.status, 503); assert.equal(r.data.off, true);
  } finally { await S.close(); }
});

/* ---------------------------------------------------------------- the WhatsApp extraction fallback */
const VAGUE = 'looking for something nice for my team of forty, around two lakh a month';
test('WhatsApp fallback: a message the rules cannot read is read by the model, validated, and fed to the engine as one clean line', async () => {
  const H = await boot({ ai: { handler: () => ({ content: JSON.stringify({ use: 'Office', seats: 40, budget_monthly: 200000, localities: ['Patia', 'Atlantis'], furnishing: 'Gold plated', parking_cars: 999, reply: 'Hello! Welcome!' }) }) } });
  try {
    await H.say('919876543210', textMsg(VAGUE), 'Amit Patnaik');
    const lead = await settle(H, '919876543210');
    assert.equal(H.a.requests.length, 1);
    assert.ok(!/9876543210/.test(H.a.requests[0].raw), 'the occupier\'s own number never reaches the model');
    assert.ok(!/919876543210/.test(H.a.requests[0].raw));
    assert.equal(lead.req.use, 'Office');
    assert.equal(lead.req.seats, 40);
    assert.equal(lead.req.budgetMonthly, 200000);
    assert.deepEqual(Array.from(lead.req.localities), ['Patia']);
    assert.equal(lead.req.furnishing, null, 'the invalid furnishing was dropped');
    assert.equal(lead.req.parking4w, null, 'the invalid parking was dropped');
    const m = lead.messages[0];
    assert.match(m.text, /looking for something nice/, 'the thread keeps the original words');
    assert.match(m.read, /office/); assert.match(m.read, /40 seats/);
    // the model never writes a reply
    for (const x of lead.messages.filter((y) => y.from === 'ai')) assert.ok(!/Welcome!/.test(x.text));
    const ev = await H.S.app.pool.query("SELECT raw FROM wa_events WHERE status = 'ai_read'");
    assert.equal(ev.rows.length, 1);
    assert.ok(ev.rows[0].raw.original && ev.rows[0].raw.normalised, 'both the original and the normalised line are logged');
  } finally { await H.close(); }
});

test('WhatsApp fallback: messages the rules already read are not sent to the model', async () => {
  const H = await boot({ ai: { handler: () => ({ content: '{}' }) } });
  try {
    await H.say('919876543210', textMsg('Need an office in Patia, 2000 sq ft, budget 80 per sq ft'));
    await settle(H, '919876543210');
    assert.equal(H.a.requests.length, 0);
    await H.say('919876543210', textMsg('rent mein discount do'));
    await settle(H, '919876543210');
    assert.equal(H.a.requests.length, 0, 'an intent the rules read (discount) is not sent either');
  } finally { await H.close(); }
});

test('WhatsApp fallback: when the model is down the original text goes to the rules, as if AI were off', async () => {
  const H = await boot({ ai: { handler: () => ({ status: 500 }) } });
  try {
    await H.say('919876543210', textMsg(VAGUE));
    const lead = await settle(H, '919876543210');
    assert.ok(H.a.requests.length >= 1);
    assert.equal(lead.messages[0].read, undefined);
    assert.equal(lead.status, 'ai');
    assert.ok(lead.messages.some((m) => m.from === 'ai'), 'the agent still answers');
  } finally { await H.close(); }
});

test('AI off: the WhatsApp path never calls out, and the agent still answers on its rules', async () => {
  const H = await boot();
  try {
    assert.equal(H.ctx.ai.enabled, false);
    await H.say('919876543210', textMsg(VAGUE));
    const lead = await settle(H, '919876543210');
    assert.equal(lead.req.use, null);
    assert.ok(lead.messages.some((m) => m.from === 'ai'));
  } finally { await H.close(); }
});

test('the model is never asked about a message that carries a quick-reply answer or a question', async () => {
  const H = await boot({ ai: { handler: () => ({ content: '{"use":"Office"}' }) } });
  try {
    await H.say('919876543210', textMsg('Need an office in Patia, 2000 sq ft, budget 80 per sq ft, move in 60 days'));
    await settle(H, '919876543210');
    const before = H.a.requests.length;
    await H.say('919876543210', textMsg('What is the deposit?'));
    await settle(H, '919876543210');
    assert.equal(H.a.requests.length, before, 'FAQ-style questions stay with the rules');
  } finally { await H.close(); }
});
