'use strict';
/* =====================================================================
   AI provider: any OpenAI-compatible chat API.

   Env:  AI_BASE_URL   e.g. https://api.groq.com/openai/v1
         AI_API_KEY    the key (never logged, never sent to the browser)
         AI_MODEL      model name the provider expects
         AI_RATE_PER_MIN (optional) requests per person per minute, default 30
         AI_MAX_TOKENS   (optional) reply cap, default 700, 0 = do not send a cap
   With no key, base URL or model the AI is off and everything keeps working on the rules.

   Routes (signed in; owners allowed because their browser only holds their own data):
     POST /api/ai/chat   { messages, tools?, json? }  ->  { text, tool_calls, assistant, json?, model }
     GET  /api/ai/status                              ->  { configured, model, provider? }

   Server side the model is used for one thing only: reading a WhatsApp message that the rules
   could not read (extract below). It never writes replies, never decides a handoff, and never
   sees a phone number: numbers are replaced before anything leaves this process.
   ===================================================================== */
const { stripPhones, maskPhonesForLog, rateLimiter, cut } = require('./util');

const CHAT_TIMEOUT_MS = 20000;
const EXTRACT_TIMEOUT_MS = 4000;
const ROLES = new Set(['system', 'user', 'assistant', 'tool']);

class AiError extends Error {
  constructor(message, code, status, extra) { super(message); this.code = code; this.status = status || 502; if (extra) Object.assign(this, extra); }
}

/* ---------------- tolerant JSON ---------------- */
function parseJsonLoose(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  let s = String(text).trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { /* try the next way */ }
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch (e) { /* keep going */ } }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    const body = s.slice(a, b + 1);
    try { return JSON.parse(body); } catch (e) { try { return JSON.parse(body.replace(/,\s*([}\]])/g, '$1')); } catch (e2) { /* give up on objects */ } }
  }
  const c = s.indexOf('['), d = s.lastIndexOf(']');
  if (c >= 0 && d > c) { try { return JSON.parse(s.slice(c, d + 1)); } catch (e) { /* give up */ } }
  return null;
}

const textOf = (content) => {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === 'string' ? p : p && p.text ? p.text : '')).join('');
  return '';
};

/* ---------------- the client ---------------- */
function createClient({ env = process.env, log = console, fetchImpl } = {}) {
  const base = String(env.AI_BASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.AI_API_KEY || '').trim();
  const model = String(env.AI_MODEL || '').trim();
  const enabled = !!(base && key && model);
  const maxTokens = env.AI_MAX_TOKENS === '0' ? 0 : (Number(env.AI_MAX_TOKENS) > 0 ? Number(env.AI_MAX_TOKENS) : 700);
  const url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  let host = '';
  try { host = new URL(base).host; } catch (e) { host = ''; }

  const wrapTool = (t) => (t && t.type === 'function' && t.function ? t : {
    type: 'function', function: { name: String(t.name), description: String(t.description || ''), parameters: t.parameters || t.inputSchema || { type: 'object', properties: {} } },
  });

  async function call(body, timeoutMs) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const res = await doFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body), signal: ctl.signal });
      const raw = await res.text();
      let data = null; try { data = JSON.parse(raw); } catch (e) { data = null; }
      if (!res.ok) {
        const detail = (data && data.error && (data.error.message || data.error)) || raw;
        throw new AiError('The AI service answered with an error (' + res.status + ').', 'upstream', res.status === 429 ? 429 : 502, { detail: cut(typeof detail === 'string' ? detail : JSON.stringify(detail), 300) });
      }
      if (!data) throw new AiError('The AI service sent something that was not JSON.', 'bad_response');
      return { data, ms: Date.now() - t0 };
    } catch (e) {
      if (e instanceof AiError) { e.detail = e.detail || e.message; throw e; }
      if (e && e.name === 'AbortError') throw new AiError('The AI service took too long to answer.', 'timeout', 504);
      throw new AiError('The AI service could not be reached.', 'network');
    } finally { clearTimeout(timer); }
  }

  /**
   * messages: OpenAI-style. tools: [{name, description, parameters}]. json: ask for a JSON object.
   * Returns { text, tool_calls:[{id,name,arguments}], assistant, json, model, finish_reason, ms }.
   */
  async function chat({ messages, tools, json = false, timeoutMs = CHAT_TIMEOUT_MS, maxTokens: cap, temperature = 0.2 } = {}) {
    if (!enabled) throw new AiError('AI is not set up on this server.', 'off', 503);
    const msgs = messages.slice();
    if (json && !msgs.some((m) => typeof m.content === 'string' && /json/i.test(m.content))) msgs.unshift({ role: 'system', content: 'Reply with one JSON object only. No other text.' });
    const body = { model, messages: msgs, temperature };
    const limit = cap != null ? cap : maxTokens;
    if (limit > 0) body.max_tokens = limit;
    if (tools && tools.length) { body.tools = tools.map(wrapTool); body.tool_choice = 'auto'; }
    if (json && !(tools && tools.length)) body.response_format = { type: 'json_object' };
    let out;
    try { out = await call(body, timeoutMs); }
    catch (e) {
      // some providers refuse response_format: ask again in plain mode, the tolerant parser reads the answer
      if (body.response_format && e.code === 'upstream' && e.status !== 429 && /response_format|json_object|json mode/i.test(e.detail || '')) {
        delete body.response_format; out = await call(body, timeoutMs);
      } else throw e;
    }
    const choice = out.data.choices && out.data.choices[0];
    const msg = (choice && choice.message) || {};
    const text = textOf(msg.content);
    const calls = (Array.isArray(msg.tool_calls) ? msg.tool_calls : []).filter((c) => c && c.function && c.function.name).map((c, i) => {
      let args = c.function.arguments;
      if (typeof args === 'string') args = parseJsonLoose(args) || {};
      return { id: String(c.id || 'call_' + Date.now().toString(36) + i), name: String(c.function.name), arguments: args && typeof args === 'object' ? args : {} };
    });
    const assistant = calls.length
      ? { role: 'assistant', content: text || null, tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.arguments) } })) }
      : { role: 'assistant', content: text };
    return { text, tool_calls: calls, assistant, json: json ? parseJsonLoose(text) : undefined, model: out.data.model || model, finish_reason: (choice && choice.finish_reason) || null, ms: out.ms };
  }

  return { enabled, model, host, chat };
}

/* ---------------- what the browser may send ---------------- */
function cleanMessages(arr) {
  if (!Array.isArray(arr) || !arr.length) return { error: 'Send messages: [{ role, content }].' };
  if (arr.length > 60) return { error: 'Too many messages in one request.' };
  const out = []; let total = 0;
  for (const m of arr) {
    if (!m || typeof m !== 'object' || !ROLES.has(m.role)) return { error: 'Each message needs a role of system, user, assistant or tool.' };
    const c = { role: m.role };
    if (typeof m.content === 'string') c.content = stripPhones(cut(m.content, 40000));
    else if (Array.isArray(m.content)) {
      c.content = [];
      for (const p of m.content.slice(0, 6)) {
        if (p && p.type === 'text' && typeof p.text === 'string') c.content.push({ type: 'text', text: stripPhones(cut(p.text, 40000)) });
        else if (p && p.type === 'image_url' && p.image_url && typeof p.image_url.url === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(p.image_url.url) && p.image_url.url.length < 1800000) c.content.push({ type: 'image_url', image_url: { url: p.image_url.url } });
        else return { error: 'A message part is not supported.' };
      }
    } else if (m.content == null && m.role === 'assistant') c.content = null;
    else return { error: 'A message has no content.' };
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      if (m.tool_calls.length > 8) return { error: 'Too many tool calls.' };
      c.tool_calls = [];
      for (const t of m.tool_calls) {
        if (!t || !t.function || typeof t.function.name !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(t.function.name)) return { error: 'A tool call is not valid.' };
        c.tool_calls.push({ id: cut(String(t.id || ''), 100), type: 'function', function: { name: t.function.name, arguments: cut(typeof t.function.arguments === 'string' ? t.function.arguments : JSON.stringify(t.function.arguments || {}), 8000) } });
      }
    }
    if (m.role === 'tool') { if (typeof m.tool_call_id !== 'string' || !m.tool_call_id) return { error: 'A tool message needs tool_call_id.' }; c.tool_call_id = cut(m.tool_call_id, 100); }
    total += JSON.stringify(c).length; if (total > 400000) return { error: 'That request is too large.' };
    out.push(c);
  }
  return { messages: out };
}

function cleanTools(arr) {
  if (arr == null) return { tools: [] };
  if (!Array.isArray(arr) || arr.length > 12) return { error: 'tools must be a list of at most 12.' };
  const tools = [];
  for (const t of arr) {
    if (!t || typeof t.name !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(t.name)) return { error: 'A tool needs a simple name.' };
    const params = t.parameters && typeof t.parameters === 'object' ? t.parameters : { type: 'object', properties: {} };
    if (JSON.stringify(params).length > 6000) return { error: 'A tool description is too large.' };
    tools.push({ name: t.name, description: cut(String(t.description || ''), 600), parameters: params });
  }
  return { tools };
}

/* ---------------- requirement reading for WhatsApp (the one server-side use) ---------------- */
const USE_WORD = { Office: 'office', Coworking: 'coworking space', Retail: 'retail shop', Showroom: 'showroom', 'F&B': 'restaurant', Clinic: 'clinic', Institutional: 'coaching centre', Warehouse: 'warehouse', Industrial: 'workshop' };
const FURN_WORD = { 'Plug-and-play': 'plug and play', 'Semi-furnished': 'semi-furnished', 'Warm shell': 'warm shell', 'Bare shell': 'bare shell' };

function extractionPrompt(LC) {
  return [
    'You read ONE WhatsApp message from a business looking for commercial space to rent in Odisha, India. The message may be English, Hindi, Odia or a mix (for example Hinglish).',
    'Return the requirement as one JSON object. Do not write a reply. Use null for anything the message does not say. Never guess.',
    'Keys:',
    '- use: one of ' + Object.keys(LC.USES).join(', ') + '.',
    '- size_sqft_min, size_sqft_max: numbers in square feet (same number in both if only one is given).',
    '- seats: number of desks or people, only when no area is given.',
    '- budget_per_sqft: rupees per square foot per month, rent plus maintenance.',
    '- budget_monthly: rupees per month in total (write 2 lakh as 200000).',
    '- localities: list of names, only from: ' + Object.keys(LC.LOCALITIES).join(', ') + '.',
    '- city: one of ' + Object.keys(LC.CITIES).join(', ') + ', only when no locality is named.',
    '- move_in_days: whole days from today until they want to move in (0 for immediately).',
    '- furnishing: one of ' + LC.FURNISHING.join(', ') + '.',
    '- parking_cars: number of car parks (0 if they say none).',
  ].join('\n');
}

const num = (v) => { if (v == null || v === '') return null; const n = typeof v === 'number' ? v : Number(String(v).replace(/[, ]/g, '')); return Number.isFinite(n) ? n : null; };

/** Check every value the model gave against what the product allows. Anything else is dropped. */
function validateFields(raw, LC) {
  const f = {}; const dropped = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { fields: f, dropped: ['all'] };
  const ci = (list, v) => { const s = String(v == null ? '' : v).trim().toLowerCase(); return list.find((x) => x.toLowerCase() === s) || null; };
  const drop = (k) => { if (raw[k] != null && raw[k] !== '') dropped.push(k); };

  const use = raw.use != null ? ci(Object.keys(LC.USES), raw.use) : null;
  if (use) f.use = use; else drop('use');

  let lo = num(raw.size_sqft_min), hi = num(raw.size_sqft_max);
  if (lo != null && (lo < 100 || lo > 200000)) { dropped.push('size_sqft_min'); lo = null; }
  if (hi != null && (hi < 100 || hi > 200000)) { dropped.push('size_sqft_max'); hi = null; }
  if (lo == null && hi != null) lo = hi; if (hi == null && lo != null) hi = lo;
  if (lo != null && hi != null) { if (lo > hi) [lo, hi] = [hi, lo]; if (hi > lo * 4) { dropped.push('size_range'); lo = hi = null; } }
  if (lo != null) { f.sizeMin = Math.round(lo); f.sizeMax = Math.round(hi); }

  const seats = num(raw.seats);
  if (seats != null && Number.isInteger(seats) && seats >= 1 && seats <= 2000 && f.sizeMin == null) f.seats = seats; else if (seats != null && f.sizeMin == null) dropped.push('seats');

  const psf = num(raw.budget_per_sqft), mon = num(raw.budget_monthly);
  if (psf != null && psf >= 5 && psf <= 1000) f.budgetPsf = Math.round(psf * 100) / 100; else if (psf != null) dropped.push('budget_per_sqft');
  if (f.budgetPsf == null && mon != null && mon >= 10000 && mon <= 50000000) f.budgetMonthly = Math.round(mon); else if (mon != null && f.budgetPsf == null) dropped.push('budget_monthly');

  if (Array.isArray(raw.localities)) {
    const names = Object.keys(LC.LOCALITIES); const seen = [];
    for (const v of raw.localities.slice(0, 6)) { const hit = ci(names, v); if (hit && !seen.includes(hit)) seen.push(hit); else if (!hit) dropped.push('locality:' + cut(String(v), 30)); }
    if (seen.length) f.localities = seen.slice(0, 3);
  } else if (raw.localities != null) dropped.push('localities');
  if (!f.localities) { const city = raw.city != null ? ci(Object.keys(LC.CITIES), raw.city) : null; if (city) f.city = city; else drop('city'); }

  const days = num(raw.move_in_days);
  if (days != null && Number.isInteger(days) && days >= 0 && days <= 540) f.moveInDays = days; else if (days != null) dropped.push('move_in_days');

  const fur = raw.furnishing != null ? ci(LC.FURNISHING, raw.furnishing) : null;
  if (fur) f.furnishing = fur; else drop('furnishing');

  const park = num(raw.parking_cars);
  if (park != null && Number.isInteger(park) && park >= 0 && park <= 50) f.parking4w = park; else if (park != null) dropped.push('parking_cars');
  return { fields: f, dropped };
}

/** The English line the rules can read. Each part is checked by reading it back; a part the rules do not read is left out. */
function buildLine(f, LC) {
  const parts = [];
  if (f.use) parts.push(['use', USE_WORD[f.use]]);
  if (f.sizeMin != null) parts.push(['size', f.sizeMin === f.sizeMax ? f.sizeMin + ' sq ft' : f.sizeMin + ' to ' + f.sizeMax + ' sq ft']);
  else if (f.seats != null) parts.push(['size', f.seats + ' seats']);
  if (f.budgetPsf != null) parts.push(['budget', 'budget ' + f.budgetPsf + ' per sq ft']);
  else if (f.budgetMonthly != null) parts.push(['budget', 'budget ' + f.budgetMonthly + ' rupees a month']);
  if (f.localities) parts.push(['location', 'in ' + f.localities.join(', ')]);
  else if (f.city) parts.push(['location', 'in ' + f.city]);
  if (f.moveInDays != null) parts.push(['moveIn', f.moveInDays === 0 ? 'immediately' : 'in ' + f.moveInDays + ' days']);
  if (f.furnishing) parts.push(['furnishing', FURN_WORD[f.furnishing]]);
  if (f.parking4w != null) parts.push(['parking4w', f.parking4w === 0 ? 'no parking' : f.parking4w + ' car parks']);
  const keep = parts.filter(([, w]) => w);
  if (!keep.length) return null;
  const read = new Set(LC.parseRequirement(keep.map((p) => p[1]).join(' '), LC.emptyReq(), {}).found.map((x) => x.key));
  const ok = keep.filter(([k]) => read.has(k));
  return ok.length ? ok.map((p) => p[1]).join(' ') : null;
}

/**
 * Ask the model for the requirement in a message the rules could not read.
 * Resolves { ok, line, fields, dropped } or { ok:false, reason }. Never throws.
 */
async function extractRequirement(client, LC, text, { timeoutMs = EXTRACT_TIMEOUT_MS, log = console } = {}) {
  if (!client.enabled) return { ok: false, reason: 'off' };
  const clean = stripPhones(cut(String(text || ''), 600)).trim();
  if (!clean) return { ok: false, reason: 'empty' };
  try {
    const out = await client.chat({
      messages: [{ role: 'system', content: extractionPrompt(LC) }, { role: 'user', content: clean }],
      json: true, timeoutMs, maxTokens: 300, temperature: 0,
    });
    const { fields, dropped } = validateFields(out.json, LC);
    const line = buildLine(fields, LC);
    if (!line) return { ok: false, reason: 'nothing_usable', dropped };
    return { ok: true, line, fields, dropped, ms: out.ms };
  } catch (e) {
    log.warn('[ai] extraction skipped: ' + (e && e.code ? e.code : 'error'));
    return { ok: false, reason: e && e.code ? e.code : 'error' };
  }
}

/* ---------------- module ---------------- */
function register(ctx) {
  const { app, log, auth } = ctx;
  const env = ctx.config.env || process.env;
  const client = createClient({ env, log });
  const perMin = Number(env.AI_RATE_PER_MIN) > 0 ? Number(env.AI_RATE_PER_MIN) : 30;
  const limiter = rateLimiter(perMin, 60000);

  const api = {
    enabled: client.enabled, model: client.model, chat: client.chat,
    extract: (text, opts) => extractRequirement(client, ctx.rt.LC, text, { log, ...opts }),
  };
  ctx.ai = api;
  log.info(client.enabled ? 'AI on: model ' + client.model + ' via ' + client.host : 'AI off (set AI_BASE_URL, AI_API_KEY and AI_MODEL to turn it on)');

  app.get('/api/ai/status', auth.requireSession, (req, res) => {
    const admin = req.session.role === 'ceo' || req.session.role === 'manager';
    res.set('Cache-Control', 'no-store').json({ configured: client.enabled, model: client.enabled ? client.model : null, provider: client.enabled && admin ? client.host : undefined });
  });

  app.post('/api/ai/chat', auth.requireSession, async (req, res) => {
    if (!client.enabled) return res.status(503).json({ error: 'AI is not set up on this server. Everything still works on the built-in rules.', off: true });
    const body = req.body || {};
    const m = cleanMessages(body.messages); if (m.error) return res.status(400).json({ error: m.error });
    const t = cleanTools(body.tools); if (t.error) return res.status(400).json({ error: t.error });
    if (!limiter.allow(req.session.userId)) return res.status(429).set('Retry-After', '20').json({ error: 'That is a lot of AI questions in a minute. Wait a moment and try again.' });
    try {
      const out = await client.chat({ messages: m.messages, tools: t.tools, json: body.json === true });
      log.info('[ai] chat', req.session.role, client.model, out.ms + 'ms', t.tools.length ? 'tools:' + t.tools.length : '', out.tool_calls.length ? 'calls:' + out.tool_calls.length : '');
      res.set('Cache-Control', 'no-store').json({ text: out.text, tool_calls: out.tool_calls, assistant: out.assistant, json: out.json === undefined ? undefined : out.json, model: out.model, finish_reason: out.finish_reason });
    } catch (e) {
      log.warn('[ai] chat failed: ' + (e.code || 'error') + ' ' + maskPhonesForLog(e.detail || e.message || ''));
      const status = e.code === 'timeout' ? 504 : e.status === 429 ? 429 : 502;
      res.status(status).json({ error: e.code === 'timeout' ? 'The AI service took too long to answer.' : e.status === 429 ? 'The AI service is busy. Try again in a moment.' : 'The AI service could not answer right now.', code: e.code || 'error' });
    }
  });
}

module.exports = { register, createClient, parseJsonLoose, validateFields, buildLine, extractRequirement, cleanMessages, AiError };
