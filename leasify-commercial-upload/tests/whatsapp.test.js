'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifySignature, fmtPhone, nearestLocality, quickPayload, textPayload, imagePayload } = require('../server/whatsapp');
const { boot, until, sleep, waPayload, textMsg, signed, settle } = require('./wa_harness');

const FROM = '919876543210';
const sig = (secret, raw) => 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
const sendsTo = (H) => H.g.sends().map((r) => r.body);

/* ---------------------------------------------------------------- pure helpers */
test('signature check: good, bad, wrong secret, missing and malformed', () => {
  const raw = Buffer.from('{"a":1}');
  assert.equal(verifySignature(raw, sig('s3cret', raw), 's3cret'), true);
  assert.equal(verifySignature(raw, sig('other', raw), 's3cret'), false);
  assert.equal(verifySignature(raw, sig('s3cret', Buffer.from('{"a":2}')), 's3cret'), false);
  assert.equal(verifySignature(raw, undefined, 's3cret'), false);
  assert.equal(verifySignature(raw, 'sha256=zz', 's3cret'), false);
  assert.equal(verifySignature(raw, sig('s3cret', raw).replace('sha256=', ''), 's3cret'), false);
  assert.equal(verifySignature(raw, sig('s3cret', raw), ''), false);
  assert.equal(verifySignature(null, sig('s3cret', raw), 's3cret'), false);
});

test('phone numbers are shown the way the CRM shows them', () => {
  assert.equal(fmtPhone('919876543210'), '+91 98765 43210');
  assert.equal(fmtPhone('9876543210'), '+91 98765 43210');
  assert.equal(fmtPhone('447911123456'), '+447911123456');
});

test('buttons: up to 3 options, titles cut to 20 characters', () => {
  const p = quickPayload(FROM, 'Which one?', ['Plug-and-play', 'Warm shell', 'Bare shell (own interiors)']);
  assert.equal(p.type, 'interactive');
  assert.equal(p.interactive.type, 'button');
  assert.equal(p.interactive.body.text, 'Which one?');
  const b = p.interactive.action.buttons;
  assert.equal(b.length, 3);
  for (const x of b) { assert.equal(x.type, 'reply'); assert.ok(x.reply.title.length <= 20 && x.reply.title.length > 0); assert.ok(x.reply.id); }
  assert.equal(b[2].reply.title, 'Bare shell (own inte');
  assert.equal(new Set(b.map((x) => x.reply.id)).size, 3);
});

test('a list is used for more than 3 options; rows are cut to 24 characters with the full text in the description', () => {
  const opts = ['Mon 26 Oct, 11:00 am', 'Mon 26 Oct, 3:00 pm', 'Tue 27 Oct, 11:00 am', 'Tue 27 Oct, 3:00 pm', 'Wed 28 Oct, 11:00 am'];
  const p = quickPayload(FROM, 'Pick a time', opts);
  assert.equal(p.interactive.type, 'list');
  const rows = p.interactive.action.sections[0].rows;
  assert.equal(rows.length, 5);
  for (const r of rows) assert.ok(r.title.length <= 24);
  assert.equal(rows[4].title, 'Wed 28 Oct, 11:00 am');
  const long = quickPayload(FROM, 'x', ['A very long option title that keeps going', 'b', 'c', 'd']);
  const lr = long.interactive.action.sections[0].rows[0];
  assert.equal(lr.title.length, 24);
  assert.equal(lr.description, 'A very long option title that keeps going');
  assert.ok(long.interactive.action.button.length <= 20);
  const many = quickPayload(FROM, 'x', Array.from({ length: 14 }, (_, i) => 'Option ' + i));
  assert.equal(many.interactive.action.sections[0].rows.length, 10);
});

test('buttons whose cut titles would collide fall back to a list; text and image payloads have the right shape', () => {
  const p = quickPayload(FROM, 'x', ['Plug-and-play office A', 'Plug-and-play office B']);
  assert.equal(p.interactive.type, 'list');
  assert.deepEqual(textPayload(FROM, 'hello').text, { preview_url: false, body: 'hello' });
  assert.equal(textPayload(FROM, 'see https://x.test').text.preview_url, true);
  const im = imagePayload(FROM, 'https://x.test/a.png', 'cap');
  assert.deepEqual(im.image, { link: 'https://x.test/a.png', caption: 'cap' });
  assert.equal(im.messaging_product, 'whatsapp');
  assert.equal(im.to, FROM);
});

/* ---------------------------------------------------------------- webhook security and handshake */
test('verify handshake and signature checks', async () => {
  const H = await boot();
  try {
    let r = await fetch(H.S.base + '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=' + H.VERIFY + '&hub.challenge=12345');
    assert.equal(r.status, 200); assert.equal(await r.text(), '12345');
    r = await fetch(H.S.base + '/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345');
    assert.equal(r.status, 403);
    r = await fetch(H.S.base + '/webhook/whatsapp?hub.mode=subscribe&hub.challenge=12345');
    assert.equal(r.status, 403);

    const payload = waPayload({ phoneId: H.phoneId, from: FROM, message: textMsg('Need an office in Patia') });
    assert.equal((await H.post(payload, { noSig: true })).status, 401);
    assert.equal((await H.post(payload, { sig: 'sha256=' + '0'.repeat(64) })).status, 401);
    assert.equal((await H.post(payload, { secret: 'not-the-secret' })).status, 401);
    await sleep(100);
    assert.equal(H.leadOf(FROM), undefined, 'a refused post must not create a lead');
    const ok = await H.post(payload);
    assert.equal(ok.status, 200);
    await until(() => H.leadOf(FROM), 3000);
    const c = H.S.client(); await c.login('ceo');
    const st = await c.get('/api/wa/status');
    assert.equal(st.status, 200);
    assert.equal(st.data.configured, true);
    assert.equal(st.data.counts.badSignatures, 3);
    assert.ok(!JSON.stringify(st.data).includes('tok-test') && !JSON.stringify(st.data).includes(H.SECRET), 'no secrets in the status answer');
  } finally { await H.close(); }
});

test('in production a missing app secret refuses every post', async () => {
  const H = await boot({ production: true, secret: '' });
  try {
    const payload = waPayload({ phoneId: H.phoneId, from: FROM, message: textMsg('Need an office in Patia') });
    const r = await H.post(payload, { secret: 'anything' });
    assert.equal(r.status, 401);
    await sleep(100);
    assert.equal(H.leadOf(FROM), undefined);
  } finally { await H.close(); }
});

test('the status route is for managers and above only', async () => {
  const H = await boot();
  try {
    const anon = H.S.client(); assert.equal((await anon.get('/api/wa/status')).status, 401);
    const ex = H.S.client(); await ex.login('priyanka'); assert.equal((await ex.get('/api/wa/status')).status, 403);
    const mgr = H.S.client(); await mgr.login('rohit'); assert.equal((await mgr.get('/api/wa/status')).status, 200);
  } finally { await H.close(); }
});

test('with no WhatsApp settings the module stays loaded and says so', async () => {
  const { startServer } = require('./helpers');
  const S = await startServer({ env: {} });
  try {
    assert.ok(S.app.ctx.modules.includes('whatsapp'));
    const c = S.client(); await c.login('ceo');
    const st = await c.get('/api/wa/status');
    assert.equal(st.data.configured, false);
    const res = await fetch(S.base + '/webhook/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(waPayload({ phoneId: '1', from: FROM, message: textMsg('hello') })) });
    assert.equal(res.status, 200);
    await sleep(150);
    assert.equal(S.rt.state.leads.length, 0, 'nothing happens while WhatsApp is off');
  } finally { await S.close(); }
});

/* ---------------------------------------------------------------- inbound and outbound */
test('an inbound text creates a live WhatsApp lead and the engine answers over Graph', async () => {
  const H = await boot();
  try {
    await H.say(FROM, textMsg('Hello, I am looking for an office in Patia'), 'Amit Patnaik');
    const lead = await until(() => H.leadOf(FROM), 3000);
    assert.equal(lead.channel, 'whatsapp');
    assert.equal(lead.name, 'Amit Patnaik');
    assert.equal(lead.source, 'Office WhatsApp');
    assert.equal(lead.phone, '+91 98765 43210');
    assert.equal(lead.messages[0].from, 'lead');
    await until(() => lead.messages.some((m) => m.from === 'ai'), 8000);
    await H.idle();
    const sent = sendsTo(H);
    assert.ok(sent.length >= 1);
    const first = H.g.sends()[0];
    assert.equal(first.url, '/v21.0/' + H.phoneId + '/messages');
    assert.equal(first.auth, 'Bearer tok-test');
    assert.equal(first.body.messaging_product, 'whatsapp');
    assert.equal(first.body.to, FROM);
    assert.equal(first.body.type, 'text');
    assert.match(first.body.text.body, /Leasify/);
    const aiMsg = lead.messages.find((m) => m.from === 'ai');
    assert.equal(aiMsg.wa.status, 'sent');
    assert.ok(/^wamid\.FAKE/.test(aiMsg.wa.id));
    // the raw webhook post and the send are both logged
    const ev = await H.S.app.pool.query('SELECT direction, status FROM wa_events ORDER BY id');
    assert.ok(ev.rows.some((r) => r.direction === 'in' && r.status === 'received'));
    assert.ok(ev.rows.some((r) => r.direction === 'out' && r.status === 'accepted'));
    // the same person writing again joins the same lead
    await H.say(FROM, textMsg('around 2000 sq ft'));
    assert.equal(H.S.rt.state.leads.filter((l) => l.channel === 'whatsapp').length, 1);
  } finally { await H.close(); }
});

test('the same message id is handled once', async () => {
  const H = await boot();
  try {
    const payload = waPayload({ phoneId: H.phoneId, from: FROM, message: textMsg('Need an office in Patia') });
    await H.post(payload); await H.post(payload); await H.post(payload);
    await sleep(100); await H.idle();
    const lead = H.leadOf(FROM);
    assert.equal(lead.messages.filter((m) => m.from === 'lead').length, 1);
    const n = await H.S.app.pool.query("SELECT count(*)::int AS n FROM wa_events WHERE direction = 'in' AND status = 'received'");
    assert.equal(n.rows[0].n, 1);
    assert.equal(H.ctx.wa.configured, true);
  } finally { await H.close(); }
});

test('the de-dupe also holds for a second server process (it is checked in the database)', async () => {
  const H = await boot();
  try {
    const payload = waPayload({ phoneId: H.phoneId, from: FROM, message: textMsg('Need an office in Patia') });
    await H.post(payload); await sleep(100); await H.idle();
    const { startServer } = require('./helpers');
    const S2 = await startServer({ schema: H.S.schema, env: { WA_TOKEN: 't', WA_PHONE_NUMBER_ID: H.phoneId, WA_APP_SECRET: H.SECRET, WA_VERIFY_TOKEN: 'v', WA_GRAPH_BASE: H.g.base, WA_RETRY_MS: '30' } });
    try {
      const s = signed(H.SECRET, payload);
      const r = await fetch(S2.base + '/webhook/whatsapp', { method: 'POST', headers: s.headers, body: s.raw });
      assert.equal(r.status, 200);
      await sleep(200); await S2.app.ctx.wa.whenIdle();
      const carried = S2.rt.state.leads.filter((l) => l.channel === 'whatsapp');       // the lead was saved by the first process
      assert.equal(carried.reduce((n, l) => n + l.messages.filter((m) => m.from === 'lead').length, 0), 1, 'the second process saw the id in wa_events and did nothing');
      const n = await H.S.app.pool.query("SELECT count(*)::int AS n FROM wa_events WHERE direction = 'in' AND status = 'received'");
      assert.equal(n.rows[0].n, 1);
    } finally { await S2.app.close(); }
  } finally { await H.close(); }
});

test('delivery status callbacks update the ticks on the message', async () => {
  const H = await boot();
  try {
    await H.say(FROM, textMsg('Hello, I am looking for an office in Patia'));
    const lead = await until(() => H.leadOf(FROM), 3000);
    await until(() => lead.messages.some((m) => m.from === 'ai' && m.wa && m.wa.id), 8000);
    await H.idle();
    const m = lead.messages.find((x) => x.from === 'ai');
    const id = m.wa.id;
    const status = (s, extra) => H.post(waPayload({ phoneId: H.phoneId, statuses: [{ id, status: s, timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: FROM, ...extra }] }));
    await status('delivered'); await H.idle();
    assert.equal(m.wa.status, 'delivered');
    await status('read'); await H.idle();
    assert.equal(m.wa.status, 'read');
    await status('delivered'); await H.idle();
    assert.equal(m.wa.status, 'read', 'a late "delivered" never lowers a "read"');
    await status('failed', { errors: [{ code: 131047, title: 'Re-engagement message' }] }); await H.idle();
    assert.equal(m.wa.status, 'failed');
    assert.match(m.wa.error, /Re-engagement/);
    const ev = await H.S.app.pool.query("SELECT status FROM wa_events WHERE raw->>'kind' = 'status' ORDER BY id");
    assert.deepEqual(ev.rows.map((r) => r.status), ['delivered', 'read', 'delivered', 'failed']);
  } finally { await H.close(); }
});

test('a Graph error marks the message failed, with the reason, and a 5xx is tried once more', async () => {
  let calls = 0;
  const H = await boot({ graph: { behave: (n) => { calls++; if (n === 1) return { status: 500, body: { error: { message: 'temporary' } } }; if (n === 2) return null; if (n === 3) return { status: 400, body: { error: { message: 'Recipient not allowed', code: 131030 } } }; return null; } } });
  try {
    await H.say(FROM, textMsg('Hello, I am looking for an office in Patia'));
    const lead = await until(() => H.leadOf(FROM), 3000);
    await until(() => lead.messages.some((m) => m.from === 'ai' && m.wa && m.wa.status === 'sent'), 8000);
    assert.equal(calls >= 2, true);
    assert.equal(lead.messages.find((m) => m.from === 'ai').wa.status, 'sent', 'the retry delivered it');
    await H.say(FROM, textMsg('around 2000 sq ft'));
    await until(() => lead.messages.filter((m) => m.from === 'ai').some((m) => m.wa && m.wa.status === 'failed'), 8000);
    const bad = lead.messages.filter((m) => m.from === 'ai').find((m) => m.wa.status === 'failed');
    assert.match(bad.wa.error, /Recipient not allowed/);
  } finally { await H.close(); }
});

test('what is sent: text first, then one picture per card with a caption, then the choices', async () => {
  const H = await boot();
  try {
    const { officeScenario, playToBooking } = require('./wa_harness');
    const sc = officeScenario(H.S.rt);
    const lead = await playToBooking(H, FROM, sc.text, { name: 'Amit Patnaik' });
    assert.equal(lead.status, 'booked');
    const sent = sendsTo(H);
    const img = sent.filter((b) => b.type === 'image');
    assert.ok(img.length >= 1, 'a picture goes out for the unit card');
    assert.match(img[0].image.link, /^https:\/\/leasify\.example\.test\/media\/unit\/LC-\d+\.png$/);
    assert.match(img[0].image.caption, /sq ft/);
    assert.match(img[0].image.caption, /all-in/);
    // the message that carried the card: its text, its picture(s), then the buttons, in that order
    const idx = sent.indexOf(img[0]);
    assert.equal(sent[idx - 1].type, 'text');
    let end = idx; while (sent[end + 1] && sent[end + 1].type === 'image') end++;   // up to 3 cards in a row
    assert.equal(sent[end + 1].type, 'interactive');
    // strictly ordered: the arrival order at Graph equals the order the engine wrote the messages
    const wrote = Array.from(lead.messages).filter((m) => m.from === 'ai').map((m) => m.text.split('\n')[0].slice(0, 25));
    const textsSent = sent.filter((b) => b.type === 'text').map((b) => b.text.body.split('\n')[0].slice(0, 25));
    const seq = wrote.filter((w) => textsSent.includes(w));
    assert.deepEqual(textsSent.filter((t) => seq.includes(t)), Array.from(seq));
    for (const m of lead.messages.filter((x) => x.from === 'ai')) assert.ok(m.wa && ['sent', 'delivered', 'read'].includes(m.wa.status), 'every message was accepted: ' + JSON.stringify(m.wa));
    // the picture the link points at exists and is a PNG
    const png = await fetch(H.S.base + new URL(img[0].image.link).pathname);
    assert.equal(png.status, 200); assert.equal(png.headers.get('content-type'), 'image/png');
    // a visit was booked through the engine's normal path
    assert.ok(lead.visitId); assert.ok(H.S.rt.state.visits.find((v) => v.id === lead.visitId));
  } finally { await H.close(); }
});

test('tapping a button feeds the full option text to the agent, not the cut-down title', async () => {
  const H = await boot();
  try {
    await H.say(FROM, textMsg('Need an office in Patia, 2000 sq ft, budget 80 per sq ft, move in 60 days'));
    let lead = await settle(H, FROM);
    assert.equal(lead._e.expect, 'furnishing');
    await H.say(FROM, textMsg('hmm not sure'));          // an answer the agent cannot read: it asks again, now with buttons
    lead = await settle(H, FROM);
    const btn = sendsTo(H).filter((b) => b.type === 'interactive').pop();
    assert.equal(btn.interactive.type, 'button');
    const tapped = btn.interactive.action.buttons[2].reply;
    assert.equal(tapped.title, 'Bare shell (own inte');
    await H.say(FROM, { type: 'interactive', interactive: { type: 'button_reply', button_reply: tapped } });
    lead = await settle(H, FROM);
    assert.equal(lead.messages.filter((m) => m.from === 'lead').pop().text, 'Bare shell (own interiors)');
    assert.equal(lead.req.furnishing, 'Bare shell');
  } finally { await H.close(); }
});

test('a shared location becomes "in <nearest area>"', async () => {
  const H = await boot();
  try {
    const patia = H.S.rt.LC.LOCALITIES.Patia;
    await H.say(FROM, { type: 'location', location: { latitude: patia.lat + 0.001, longitude: patia.lng, name: 'Our current office' } });
    const lead = await settle(H, FROM);
    assert.deepEqual(Array.from(lead.req.localities), ['Patia']);
    assert.match(lead.messages[0].text, /Location shared/);
    assert.match(lead.messages[0].text, /nearest area Patia/);
    const far = nearestLocality(H.S.rt.LC, 28.6, 77.2);
    assert.ok(far.km > 1000);
    await H.say('919800000001', { type: 'location', location: { latitude: 28.6, longitude: 77.2 } });
    const l2 = await settle(H, '919800000001');
    assert.deepEqual(Array.from(l2.req.localities), []);
    assert.match(l2.messages[0].text, /outside the areas we cover/);
  } finally { await H.close(); }
});

test('voice notes, photos and documents get a polite reply and a task for the area agent', async () => {
  const H = await boot();
  try {
    const tasksBefore = H.S.rt.state.tasks.length;
    await H.say(FROM, { type: 'audio', audio: { id: 'media-1', mime_type: 'audio/ogg', voice: true } }, 'Amit Patnaik');
    const lead = await settle(H, FROM);
    assert.match(lead.messages[0].text, /voice note received/);
    const reply = lead.messages.find((m) => m.from === 'ai');
    assert.ok(reply && /person from our team/.test(reply.text));
    await until(() => reply.wa && reply.wa.status === 'sent', 3000);
    const t = H.S.rt.state.tasks.find((x) => x.type === 'WhatsApp media');
    assert.ok(t, 'a task was added'); assert.equal(H.S.rt.state.tasks.length, tasksBefore + 1);
    assert.equal(t.leadId, lead.id);
    await H.say(FROM, { type: 'image', image: { id: 'media-2', mime_type: 'image/jpeg' } });
    await H.say(FROM, { type: 'sticker', sticker: { id: 'media-3' } });
    assert.equal(H.S.rt.state.tasks.filter((x) => x.type === 'WhatsApp media').length, 3);
  } finally { await H.close(); }
});

test('a webhook for another phone number id is ignored', async () => {
  const H = await boot();
  try {
    await H.post(waPayload({ phoneId: '999999', from: FROM, message: textMsg('Need an office') }));
    await sleep(150); await H.idle();
    assert.equal(H.leadOf(FROM), undefined);
  } finally { await H.close(); }
});

/* ---------------------------------------------------------------- scripted conversations over the fake webhook */
test('English: office requirement through unit cards to a booked visit, with a consent line and an audit trail', async () => {
  const H = await boot();
  try {
    const { officeScenario, playToBooking } = require('./wa_harness');
    const sc = officeScenario(H.S.rt);
    const lead = await playToBooking(H, FROM, sc.text, { name: 'Amit Patnaik' });
    assert.equal(lead.status, 'booked');
    assert.ok(lead.matches.length >= 1);
    assert.ok(lead.clientId, 'a CRM client was created');
    const client = H.S.rt.state.clients.find((c) => c.id === lead.clientId);
    assert.equal(client.phone, '+91 98765 43210');
    assert.ok(H.S.rt.state.visits.length > 0);
    const first = lead.messages.find((m) => m.from === 'ai');
    assert.match(first.text, /STOP/, 'the first message carries the opt-out line');
    assert.ok(H.g.sends().length >= 4);
  } finally { await H.close(); }
});

test('Hindi: a Hindi message is answered in Hindi', async () => {
  const H = await boot();
  try {
    await H.say(FROM, textMsg('नमस्ते, मुझे पटिया में ऑफिस चाहिए'), 'Sunita');
    const lead = await settle(H, FROM);
    assert.equal(lead.language, 'Hindi');
    const reply = lead.messages.find((m) => m.from === 'ai');
    assert.ok(reply && /[ऀ-ॿ]/.test(reply.text), 'the reply is in Devanagari');
    await until(() => reply.wa && reply.wa.status === 'sent', 3000);
    assert.ok(sendsTo(H).some((b) => b.type === 'text' && /[ऀ-ॿ]/.test(b.text.body)));
  } finally { await H.close(); }
});

test('"discount do": rule H1 hands the chat to a person and the queue shows it', async () => {
  const H = await boot();
  try {
    await H.say(FROM, textMsg('Need an office in Patia, 2000 sq ft'), 'Amit Patnaik');
    await settle(H, FROM);
    const queueBefore = H.S.rt.state.queue.length;
    await H.say(FROM, textMsg('rent mein discount do, thoda kam karo'));
    const lead = await settle(H, FROM);
    assert.equal(lead.status, 'handoff');
    assert.ok(lead.rulesFired.includes('H1'), JSON.stringify(lead.rulesFired));
    assert.equal(lead.handoff.rule, 'H1');
    assert.ok(H.S.rt.state.queue.length > queueBefore, 'a queue item was added');
    assert.ok(H.S.rt.state.queue.some((q) => q.leadId === lead.id || q.lead === lead.id || JSON.stringify(q).includes(lead.id) || JSON.stringify(q).includes(lead.name)));
    const last = lead.messages.filter((m) => m.from === 'ai').pop();
    await until(() => last.wa && last.wa.status === 'sent', 3000);
  } finally { await H.close(); }
});

test('STOP closes the chat, records the withdrawal of consent and nothing more is sent', async () => {
  const H = await boot();
  try {
    await H.say(FROM, textMsg('Need an office in Patia, 2000 sq ft'), 'Amit Patnaik');
    await settle(H, FROM);
    const consentBefore = H.S.rt.state.consent.length;
    await H.say(FROM, textMsg('STOP'));
    const lead = await settle(H, FROM);
    assert.equal(lead.status, 'closed');
    assert.equal(lead._e.optOut, true);
    const c = H.S.rt.state.consent.slice(consentBefore).find((x) => x.optOut);
    assert.ok(c, 'consent withdrawal logged'); assert.equal(c.channel, 'WhatsApp');
    const sentBefore = H.g.sends().length;
    await H.say(FROM, textMsg('hello are you there'));
    await sleep(2500); await H.idle();
    assert.equal(H.g.sends().length, sentBefore, 'no message goes to someone who said STOP');
  } finally { await H.close(); }
});

test('a person who takes over a WhatsApp chat sends through Graph under their own name', async () => {
  const H = await boot();
  try {
    await H.say(FROM, textMsg('Need an office in Patia, 2000 sq ft'), 'Amit Patnaik');
    const lead = await settle(H, FROM);
    const c = H.S.client(); await c.login('priyanka');
    assert.equal((await c.post('/api/leads/' + lead.id + '/takeover')).status, 200);
    const r = await c.post('/api/leads/' + lead.id + '/send', { text: 'Hi Amit, this is Priyanka. Can I call you now?' });
    assert.equal(r.status, 200);
    await H.idle();
    const last = H.g.sends().pop();
    assert.equal(last.body.type, 'text');
    assert.equal(last.body.text.body, 'Hi Amit, this is Priyanka. Can I call you now?');
    assert.equal(last.body.to, FROM);
    const m = lead.messages.filter((x) => x.from === 'agent').pop();
    assert.equal(m.by, 'Priyanka Das'); assert.equal(m.wa.status, 'sent');
    assert.equal((await c.post('/api/leads/' + lead.id + '/handback')).status, 200);
  } finally { await H.close(); }
});
