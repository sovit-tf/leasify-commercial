'use strict';
/* Local stand-ins for the outside services, so the tests never touch the internet:
   fakeGraph  the Meta Graph "send message" endpoint
   fakeAI     an OpenAI-compatible /chat/completions endpoint
   Both record every request they get. */
const http = require('node:http');
const crypto = require('node:crypto');

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}
const readBody = (req) => new Promise((resolve) => { const parts = []; req.on('data', (c) => parts.push(c)); req.on('end', () => resolve(Buffer.concat(parts).toString('utf8'))); });

/** behave(n, body) may return { status, body } to answer with an error. n counts requests from 1. */
async function fakeGraph({ phoneId = '1555000111', behave } = {}) {
  const requests = []; let n = 0;
  const { server, port } = await listen(async (req, res) => {
    const raw = await readBody(req); let body = null; try { body = JSON.parse(raw); } catch (e) { body = null; }
    n++;
    const rec = { n, method: req.method, url: req.url, auth: req.headers.authorization || '', body, at: Date.now() };
    requests.push(rec);
    const m = /^\/(v[\d.]+)\/([^/]+)\/messages$/.exec(req.url);
    const forced = behave && behave(n, body);
    if (forced) { res.writeHead(forced.status, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(forced.body || { error: { message: 'forced error', code: 1 } })); }
    if (!m || req.method !== 'POST') { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":{"message":"no route"}}'); }
    rec.id = 'wamid.FAKE' + crypto.randomBytes(5).toString('hex');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messaging_product: 'whatsapp', contacts: [{ input: body && body.to, wa_id: body && body.to }], messages: [{ id: rec.id }] }));
  });
  return {
    port, base: 'http://127.0.0.1:' + port, phoneId, requests,
    /** the posts that carry a message (not the read receipts etc.) */
    sends() { return requests.filter((r) => r.body && r.body.messaging_product === 'whatsapp' && r.body.type); },
    close() { return new Promise((r) => { server.close(() => r()); if (server.closeAllConnections) server.closeAllConnections(); }); },
  };
}

/** handler(body, n) returns an assistant message object { content?, tool_calls? }, or { status, body } for an error. */
async function fakeAI({ handler, model = 'fake-model' } = {}) {
  const requests = []; let n = 0;
  const { server, port } = await listen(async (req, res) => {
    const raw = await readBody(req); let body = null; try { body = JSON.parse(raw); } catch (e) { body = null; }
    n++;
    requests.push({ n, url: req.url, auth: req.headers.authorization || '', body, raw });
    if (req.method !== 'POST' || !/\/chat\/completions$/.test(req.url)) { res.writeHead(404); return res.end('{}'); }
    const out = handler ? await handler(body, n) : { content: 'ok' };
    if (out && out.status) { res.writeHead(out.status, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(out.body || { error: { message: 'forced' } })); }
    if (out && out.delay) await new Promise((r) => setTimeout(r, out.delay));
    const msg = { role: 'assistant', content: out.content == null ? null : out.content };
    if (out.tool_calls) msg.tool_calls = out.tool_calls;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'chatcmpl-' + n, object: 'chat.completion', model, choices: [{ index: 0, message: msg, finish_reason: out.tool_calls ? 'tool_calls' : 'stop' }] }));
  });
  return {
    port, base: 'http://127.0.0.1:' + port + '/v1', requests, model,
    close() { return new Promise((r) => { server.close(() => r()); if (server.closeAllConnections) server.closeAllConnections(); }); },
  };
}

/** Build a signed webhook post the way Meta sends it. */
function signed(secret, payload) {
  const raw = JSON.stringify(payload);
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return { raw, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig } };
}

/** A webhook payload with one inbound message (or statuses). */
function waPayload({ phoneId, from = '919876543210', name = 'Amit Patnaik', message, statuses } = {}) {
  const value = { messaging_product: 'whatsapp', metadata: { display_phone_number: '15550001111', phone_number_id: phoneId } };
  if (message) { value.contacts = [{ profile: { name }, wa_id: from }]; value.messages = [{ from, id: 'wamid.IN' + crypto.randomBytes(6).toString('hex'), timestamp: String(Math.floor(Date.now() / 1000)), ...message }]; }
  if (statuses) value.statuses = statuses;
  return { object: 'whatsapp_business_account', entry: [{ id: '100200300', changes: [{ field: 'messages', value }] }] };
}
const textMsg = (body) => ({ type: 'text', text: { body } });

module.exports = { fakeGraph, fakeAI, signed, waPayload, textMsg };
