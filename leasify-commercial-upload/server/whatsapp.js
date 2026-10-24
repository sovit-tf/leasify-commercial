'use strict';
/* =====================================================================
   WhatsApp (Meta Cloud API), service window only: the occupier writes first.

   Env: WA_TOKEN, WA_PHONE_NUMBER_ID, WA_APP_SECRET, WA_VERIFY_TOKEN, WA_GRAPH_VERSION (v21.0), PUBLIC_BASE_URL
        WA_GRAPH_BASE (optional, defaults to https://graph.facebook.com; tests point it at a local fake)
        WA_RETRY_MS   (optional, wait before the one retry, default 1200)

   Routes
     GET  /webhook/whatsapp   Meta's verify handshake
     POST /webhook/whatsapp   inbound messages and delivery statuses (X-Hub-Signature-256 checked)
     GET  /api/wa/status      manager and above: configured or not, last inbound, last error, webhook URL

   Inbound: each message goes to the same engine the simulator uses (a lead with channel 'whatsapp', real-time clock).
   Outbound: every message the engine adds to a whatsapp lead from the AI agent or a person is sent, strictly in order.
   Every webhook message, send and status callback is logged to wa_events. Phone numbers are masked in server logs.
   ===================================================================== */
const crypto = require('node:crypto');
const { digits, lastTen, maskNum, maskPhonesForLog, sleep, cut } = require('./util');

const RANK = { pending: 0, sent: 1, delivered: 2, read: 3 };
const RANK_NAME = ['pending', 'sent', 'delivered', 'read'];
const MEDIA_TYPES = new Set(['audio', 'voice', 'image', 'document', 'sticker', 'video']);
const MEDIA_LABEL = { audio: 'voice note', voice: 'voice note', image: 'photo', document: 'document', sticker: 'sticker', video: 'video', other: 'message' };
const NEAR_KM = 35;
const BUTTON_TITLE = 20, ROW_TITLE = 24, ROW_DESC = 72, MAX_BUTTONS = 3, MAX_ROWS = 10, BODY_MAX = 1024, TEXT_MAX = 4096;

/* Hindi and Odia lines are drafts, like the rest of the agent's Hindi and Odia text: a native speaker should review them. */
const MEDIA_REPLY = {
  English: 'Thanks, I got your {what}. I can\'t open it here, so a person from our team will check it and get back to you. You can also type your requirement here.',
  Hindi: 'धन्यवाद, आपका {what} मिल गया। मैं इसे यहाँ खोल नहीं सकता, इसलिए हमारी टीम का एक व्यक्ति इसे देखकर आपसे संपर्क करेगा। आप अपनी ज़रूरत यहाँ लिखकर भी भेज सकते हैं।',
  Odia: 'ଧନ୍ୟବାଦ, ଆପଣଙ୍କ {what} ମିଳିଲା। ମୁଁ ଏହାକୁ ଏଠାରେ ଖୋଲିପାରିବି ନାହିଁ, ତେଣୁ ଆମ ଟିମ୍ ର ଜଣେ ବ୍ୟକ୍ତି ଏହା ଦେଖି ଆପଣଙ୍କୁ ଯୋଗାଯୋଗ କରିବେ। ଆପଣ ଆପଣଙ୍କ ଆବଶ୍ୟକତା ଏଠାରେ ଲେଖି ମଧ୍ୟ ପଠାଇପାରିବେ।',
};
const MEDIA_WORD = {
  English: { 'voice note': 'voice note', photo: 'photo', document: 'document', sticker: 'sticker', video: 'video', message: 'message' },
  Hindi: { 'voice note': 'वॉइस नोट', photo: 'फोटो', document: 'दस्तावेज़', sticker: 'स्टिकर', video: 'वीडियो', message: 'मैसेज' },
  Odia: { 'voice note': 'ଭଏସ୍ ନୋଟ୍', photo: 'ଫଟୋ', document: 'ଡକ୍ୟୁମେଣ୍ଟ', sticker: 'ଷ୍ଟିକର', video: 'ଭିଡିଓ', message: 'ମେସେଜ୍' },
};
const STOP_LINE = ' You can reply STOP at any time to stop messages.';
const OUT_OF_AREA = 'location outside our areas';

/* ---------------- pure helpers (also used by the tests) ---------------- */
function verifySignature(raw, header, secret) {
  if (!raw || !header || !secret) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(String(header).trim());
  if (!m) return false;
  const want = crypto.createHmac('sha256', secret).update(raw).digest();
  const got = Buffer.from(m[1], 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/** wa_id (country code first, digits only) -> the format the CRM shows: +91 98765 43210 */
function fmtPhone(waId) {
  const d = digits(waId);
  if (d.length === 12 && d.startsWith('91')) return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
  if (d.length === 10) return '+91 ' + d.slice(0, 5) + ' ' + d.slice(5);
  return '+' + d;
}

function nearestLocality(LC, lat, lng) {
  let best = null;
  for (const [name, L] of Object.entries(LC.LOCALITIES)) {
    const km = LC.dist(lat, lng, L.lat, L.lng);
    if (!best || km < best.km) best = { name, km };
  }
  return best;
}

const cleanName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const cleanText = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, 1000);

/* ---- Graph payloads ---- */
const base = (to) => ({ messaging_product: 'whatsapp', recipient_type: 'individual', to });
function textPayload(to, body) {
  const b = cut(body, TEXT_MAX);
  return { ...base(to), type: 'text', text: { preview_url: /https?:\/\//.test(b), body: b } };
}
function imagePayload(to, link, caption) {
  return { ...base(to), type: 'image', image: { link, caption: cut(caption, BODY_MAX) } };
}
/** Up to 3 options become reply buttons (titles cut to 20), more become a list (row titles cut to 24, full text in the description). */
function quickPayload(to, body, options) {
  const opts = options.map((o) => String(o).trim()).filter(Boolean);
  const bodyText = cut(String(body || '').trim() || 'Please choose one:', BODY_MAX);
  const titles = opts.map((o) => cut(o, BUTTON_TITLE).trim());
  const unique = new Set(titles).size === titles.length;
  if (opts.length >= 1 && opts.length <= MAX_BUTTONS && unique) {
    return { ...base(to), type: 'interactive', interactive: { type: 'button', body: { text: bodyText }, action: { buttons: opts.map((o, i) => ({ type: 'reply', reply: { id: 'q' + i, title: titles[i] } })) } } };
  }
  const rows = opts.slice(0, MAX_ROWS).map((o, i) => {
    const row = { id: 'q' + i, title: cut(o, ROW_TITLE).trim() };
    if (Array.from(o).length > ROW_TITLE) row.description = cut(o, ROW_DESC);
    return row;
  });
  return { ...base(to), type: 'interactive', interactive: { type: 'list', body: { text: bodyText }, action: { button: 'Choose', sections: [{ title: 'Options', rows }] } } };
}

/* ---------------- module ---------------- */
function register(ctx) {
  const { app, rt, pool, log, auth, tracker } = ctx;
  const LC = rt.LC, E = rt.engine;
  const env = ctx.config.env || process.env;
  const cfg = {
    token: String(env.WA_TOKEN || '').trim(), phoneId: String(env.WA_PHONE_NUMBER_ID || '').trim(),
    appSecret: String(env.WA_APP_SECRET || ''), verifyToken: String(env.WA_VERIFY_TOKEN || ''),
    version: String(env.WA_GRAPH_VERSION || 'v21.0').trim(),
    graphBase: String(env.WA_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/+$/, ''),
    publicBase: String(ctx.config.publicBaseUrl || env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    retryMs: Number(env.WA_RETRY_MS) >= 0 && env.WA_RETRY_MS != null && env.WA_RETRY_MS !== '' ? Number(env.WA_RETRY_MS) : 1200,
    production: !!ctx.config.production,
  };
  const configured = !!(cfg.token && cfg.phoneId);
  const webhookUrl = cfg.publicBase ? cfg.publicBase + '/webhook/whatsapp' : '';
  const sendUrl = cfg.graphBase + '/' + cfg.version + '/' + cfg.phoneId + '/messages';
  const stats = { lastInboundAt: null, lastError: null, inbound: 0, dupes: 0, sent: 0, failed: 0, badSignatures: 0 };
  let closed = false, warnedSecret = false, warnedBase = false;
  if (!configured) log.info('WhatsApp off (set WA_TOKEN and WA_PHONE_NUMBER_ID to turn it on)');
  else log.info('WhatsApp on: phone number id ' + cfg.phoneId + (cfg.publicBase ? ', webhook ' + webhookUrl : ', PUBLIC_BASE_URL is not set so pictures cannot be sent'));
  if (ctx.onClose) ctx.onClose(() => { closed = true; });

  const setError = (message) => { stats.lastError = { at: Date.now(), message: cut(String(message), 300) }; };

  /* ---- wa_events (best effort: a logging problem never stops a message) ---- */
  async function logEvent(direction, waId, status, raw) {
    if (closed) return;
    try { await pool.query('INSERT INTO wa_events (direction, wa_id, status, raw) VALUES ($1,$2,$3,$4::jsonb)', [direction, waId ? String(waId).slice(0, 40) : null, status ? String(status).slice(0, 40) : null, JSON.stringify(raw || {})]); }
    catch (e) { if (!closed) log.warn('[wa] could not write wa_events: ' + e.message); }
  }

  /* ================== outbound ================== */
  const registry = new Map();                 // wamid -> { job, jobs, lead, m }
  const quickByLead = new Map();              // lead id -> the options last offered as buttons or a list
  const chains = new Map();                   // lead id -> promise (sends for one lead go out strictly in order)
  const pendingWork = new Set();

  function rollup(lead, m, jobs) {
    const failed = jobs.find((j) => j.status === 'failed');
    const prev = m.wa || {};
    let next;
    if (failed) next = { status: 'failed', error: failed.error || 'The message was not delivered.' };
    else next = { status: RANK_NAME[Math.min(...jobs.map((j) => RANK[j.status] || 0))] };
    const primary = jobs.find((j) => j.primary && j.id) || jobs.find((j) => j.id);
    if (primary) next.id = primary.id; else if (prev.id) next.id = prev.id;
    if (prev.status === next.status && prev.id === next.id && prev.error === next.error) return;
    m.wa = next;
    E.touch(lead); LC.emit('lead:updated', lead.id);
  }

  function remember(id, ref) {
    registry.set(id, ref);
    if (registry.size > 6000) registry.delete(registry.keys().next().value);
  }

  async function graph(payload) {
    let last = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      let retry = false;
      try {
        const res = await fetch(sendUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
        const raw = await res.text(); let data = null; try { data = JSON.parse(raw); } catch (e) { data = null; }
        if (res.ok && data && data.messages && data.messages[0] && data.messages[0].id) return { ok: true, id: String(data.messages[0].id), data };
        const err = data && data.error ? data.error : null;
        last = { ok: false, status: res.status, error: (err && (err.error_user_title || err.message)) || ('WhatsApp answered ' + res.status), code: err && err.code, data: data || { raw: cut(raw, 300) } };
        retry = res.status === 429 || res.status >= 500;
      } catch (e) {
        last = { ok: false, status: 0, error: 'Could not reach WhatsApp (' + (e && e.name === 'TimeoutError' ? 'timed out' : 'network') + ')', data: null };
        retry = true;
      }
      if (!retry || attempt === 1 || closed) break;
      await sleep(cfg.retryMs);
    }
    return last;
  }

  /** One Graph call for one job: log it, record the id, update the tick. */
  async function sendJob(lead, m, jobs, job) {
    const result = await graph(job.payload);
    const to = job.payload.to;
    if (result.ok) {
      job.id = result.id; job.status = 'sent'; stats.sent++;
      remember(job.id, { job, jobs, lead, m });
      await logEvent('out', to, 'accepted', { kind: 'send', id: job.id, request: job.payload, response: result.data });
    } else {
      job.status = 'failed'; job.error = result.error; stats.failed++;
      setError(result.error);
      log.warn('[wa] send failed to ' + maskNum(to) + ': ' + result.error + (result.code ? ' (' + result.code + ')' : ''));
      await logEvent('out', to, 'failed', { kind: 'send', request: job.payload, error: result.data || result.error, http: result.status });
    }
    rollup(lead, m, jobs);
  }

  function buildJobs(lead, m) {
    const to = lead.waId || digits(lead.phone);
    const body = String(m.text == null ? '' : m.text).trim();
    const quick = Array.isArray(m.quick) ? m.quick.map(String).filter(Boolean) : [];
    const cards = (Array.isArray(m.cards) ? m.cards : []).map((id) => LC.unit(id)).filter(Boolean);
    const jobs = [];
    const quickJob = (text) => { const p = quickPayload(to, text, quick); jobs.push({ kind: p.interactive.type, payload: p, status: 'pending', quick: true }); };
    if (cards.length) {
      if (body) jobs.push({ kind: 'text', payload: textPayload(to, body), status: 'pending', primary: true });
      for (const u of cards) {
        const cap = [u.listing_title, '₹' + u.all_in_per_sqft + '/sq ft all-in · ' + LC.fmtLakh(u.all_in_monthly) + ' a month', LC.fmtNum(u.chargeable_sqft) + ' sq ft · ' + u.furnishing + ' · from ' + LC.fmtDate(u.available_from)];
        const fit = m.fit && m.fit[u.unit_id]; if (fit) cap.push(fit + '% fit');
        cap.push('Map: ' + LC.mapsLink(u));
        const caption = cap.join('\n');
        if (cfg.publicBase) jobs.push({ kind: 'image', payload: imagePayload(to, cfg.publicBase + '/media/unit/' + encodeURIComponent(u.unit_id) + '.png', caption), status: 'pending', primary: !body && jobs.length === 0 });
        else { if (!warnedBase) { warnedBase = true; log.warn('[wa] PUBLIC_BASE_URL is not set: unit cards go out as text, without pictures'); } jobs.push({ kind: 'text', payload: textPayload(to, caption), status: 'pending', primary: !body && jobs.length === 0 }); }
      }
      if (quick.length) quickJob('Please choose one:');
    } else if (quick.length) quickJob(body);
    else if (body) jobs.push({ kind: 'text', payload: textPayload(to, body), status: 'pending', primary: true });
    if (jobs.length && !jobs.some((j) => j.primary)) jobs[0].primary = true;
    return jobs;
  }

  async function deliver(lead, m) {
    if (closed) return;
    if (!configured) { m.wa = { status: 'failed', error: 'WhatsApp is not connected on this server.' }; E.touch(lead); LC.emit('lead:updated', lead.id); return; }
    const jobs = buildJobs(lead, m);
    if (!jobs.length) return;
    const q = jobs.find((j) => j.quick);
    if (q) {
      const opts = Array.isArray(m.quick) ? m.quick.map(String).filter(Boolean) : [];
      quickByLead.set(lead.id, opts.map((o, i) => ({ id: 'q' + i, full: o, title: q.kind === 'button' ? cut(o, BUTTON_TITLE).trim() : cut(o, ROW_TITLE).trim() })));
    }
    for (const job of jobs) { if (closed) return; await sendJob(lead, m, jobs, job); }
  }

  /** Called for every message the engine adds. Only whatsapp leads, only what the AI agent or a person wrote. */
  function onEngineMessage(lead, m) {
    if (!lead || lead.channel !== 'whatsapp') return;
    if (m.from !== 'ai' && m.from !== 'agent') return;
    m.wa = { status: 'pending' };
    const prev = chains.get(lead.id) || Promise.resolve();
    const next = prev.then(() => deliver(lead, m)).catch((e) => { log.error('[wa] delivery error: ' + (e && e.message)); });
    chains.set(lead.id, next); pendingWork.add(next);
    next.then(() => { pendingWork.delete(next); if (chains.get(lead.id) === next) chains.delete(lead.id); });
  }
  rt.onMessage(onEngineMessage);

  /* ================== delivery statuses ================== */
  async function handleStatus(st) {
    if (!st || typeof st !== 'object') return;
    const id = String(st.id || ''); const status = String(st.status || '');
    await logEvent('out', st.recipient_id, status || 'unknown', { kind: 'status', id, status: st });
    if (!id || !status) return;
    const err = Array.isArray(st.errors) && st.errors[0] ? st.errors[0] : null;
    const errText = err ? ((err.title || err.message || 'The message failed') + (err.code ? ' (' + err.code + ')' : '')) : null;
    if (status === 'failed') { stats.failed++; setError(errText || 'A message failed'); }
    const ref = registry.get(id);
    if (ref) {
      const { job, jobs, lead, m } = ref;
      if (status === 'failed') { job.status = 'failed'; job.error = errText || 'The message was not delivered.'; }
      else if ((RANK[status] || 0) > (RANK[job.status] || 0) && job.status !== 'failed') job.status = status;
      rollup(lead, m, jobs); return;
    }
    // after a restart the in-memory jobs are gone: find the message by the id stored on it
    for (const lead of rt.state.leads) {
      if (lead.channel !== 'whatsapp') continue;
      const m = lead.messages.find((x) => x.wa && x.wa.id === id);
      if (!m) continue;
      if (status === 'failed') m.wa = { id, status: 'failed', error: errText || 'The message was not delivered.' };
      else if ((RANK[status] || 0) > (RANK[m.wa.status] || 0) && m.wa.status !== 'failed') m.wa = { id, status };
      else return;
      E.touch(lead); LC.emit('lead:updated', lead.id); return;
    }
  }

  /* ================== inbound ================== */
  const seen = new Set();
  async function claim(id, raw) {
    if (seen.has(id)) return false;
    seen.add(id); if (seen.size > 20000) seen.delete(seen.values().next().value);
    try {
      const r = await pool.query("INSERT INTO wa_events (direction, wa_id, status, raw) SELECT 'in', $1, 'received', $2::jsonb WHERE NOT EXISTS (SELECT 1 FROM wa_events WHERE direction = 'in' AND raw->>'id' = $3)", [String(raw.from || '').slice(0, 40), JSON.stringify({ kind: 'message', id, type: raw.type, message: raw }), id]);
      return r.rowCount > 0;
    } catch (e) { if (!closed) log.warn('[wa] could not check or write wa_events: ' + e.message); return true; }
  }

  function findLead(phone) {
    const t = lastTen(phone); let best = null;
    for (const l of rt.state.leads) if (l.channel === 'whatsapp' && lastTen(l.phone) === t && (!best || l.createdAt > best.createdAt)) best = l;
    return best;
  }
  function leadFor(waId, profileName) {
    const phone = fmtPhone(waId);
    const found = findLead(phone);
    if (found) { if (!found.waId) found.waId = waId; return found; }
    // an existing client on this number: reuse the phone text the CRM holds, so the engine's own H9 check finds them
    const existing = LC.state.clients.find((c) => lastTen(c.phone) === lastTen(phone) && !['Lost', 'Signed lease'].includes(c.stage));
    const name = cleanName(profileName) || 'Caller ' + digits(waId).slice(-4);
    const lead = E.createLead({ name, company: '', phone: existing ? existing.phone : phone, source: 'Office WhatsApp', language: 'English', test: true });
    lead.channel = 'whatsapp'; lead.waId = waId;
    E.ensureTicker();
    return lead;
  }

  const INTENT_KEYS = ['negotiate', 'legal', 'complaint', 'human', 'notInterested', 'stop'];
  const REQ_KEYS = new Set(LC.REQ_FIELDS.map((f) => f.key));
  const FAQ_Q = /\?\s*$/;
  const FAQ_WORDS = /\b(gst|deposit|lock.?in|maintenance|parking|photos?|pictures?|location|address)\b/i;

  /** The rules found nothing to act on: worth asking the model what the requirement is. */
  function worthAsking(lead, text) {
    if (!ctx.ai || !ctx.ai.enabled) return false;
    const e = lead._e;
    if (lead.status !== 'ai' || e.optOut || (e.stage !== 'new' && e.stage !== 'qualify')) return false;
    if (text.length < 6 || text.split(/\s+/).length < 2) return false;
    if (FAQ_Q.test(text) && FAQ_WORDS.test(text)) return false;
    const p = LC.parseRequirement(text, lead.req, { expect: e.expect });
    if (p.found.some((f) => REQ_KEYS.has(f.key))) return false;
    if (INTENT_KEYS.some((k) => p.intents && p.intents[k])) return false;
    return true;
  }

  /** Give the engine one occupier message. `forced` replaces the text the rules read; `display` is what the thread shows. */
  async function feed(lead, original, { forced, display } = {}) {
    let line = forced || null;
    if (!line && worthAsking(lead, original)) {
      const r = await ctx.ai.extract(original);
      if (r && r.ok) {
        line = r.line;
        log.info('[wa] AI read a message the rules could not. original="' + maskPhonesForLog(cut(original, 140)) + '" normalised="' + line + '"');
        await logEvent('in', lead.waId, 'ai_read', { kind: 'extraction', original, normalised: line, fields: r.fields, dropped: r.dropped });
      } else log.info('[wa] AI could not read it either (' + (r && r.reason) + '). Using the original text.');
    }
    const at = lead.messages.length;
    E.receive(lead, line || original);
    const m = lead.messages[at];
    if (m && m.from === 'lead') {
      if (display) m.text = display;
      else if (line && !forced) m.text = original;
      if (line) m.read = line;                       // the thread shows "AI read this as ..." under the message
      E.touch(lead);
    }
  }

  function mediaNote(lead, type) {
    const label = MEDIA_LABEL[type] || MEDIA_LABEL.other;
    E.addMsg(lead, 'lead', '[' + label + ' received]', { media: type });
    const c = lead.clientId ? LC.crm.get(lead.clientId) : null;
    const agent = c ? c.agent : LC.crm.assignAgent(lead.req, lead.language);
    LC.tasks.add({ type: 'WhatsApp media', title: 'Check the ' + label + ' ' + (lead.company || lead.name) + ' sent on WhatsApp, then reply', due: Date.now() + 2 * 36e5, clientId: lead.clientId || undefined, leadId: lead.id, assignee: agent, priority: 'Normal' });
    LC.log('WhatsApp ' + label + ' from ' + lead.name + ' needs a person to check it (task for ' + agent + ')', { leadId: lead.id, clientId: lead.clientId || undefined, kind: 'message' });
    if (lead.clientId) LC.crm.addActivity(lead.clientId, 'message', 'Sent a ' + label + ' on WhatsApp. Task added for ' + agent, 'AI agent');
    const closedOut = lead._e.optOut || lead.status === 'human';
    if (!closedOut) {
      const lang = MEDIA_REPLY[lead.language] ? lead.language : 'English';
      const what = (MEDIA_WORD[lang] || MEDIA_WORD.English)[label] || label;
      E.addMsg(lead, 'ai', MEDIA_REPLY[lang].replace('{what}', what) + (lead._e.stage === 'new' && lang === 'English' ? STOP_LINE : ''), { by: 'AI agent' });
    }
    E.touch(lead);
  }

  async function handleMessage(msg, profileName) {
    const id = String(msg.id || '');
    if (!id || !msg.from) return;
    if (!(await claim(id, msg))) { stats.dupes++; return; }
    stats.inbound++; stats.lastInboundAt = Date.now();
    const type = String(msg.type || '');
    if (type === 'reaction') return;
    tracker.collect({ by: 'system' });
    const lead = leadFor(String(msg.from), profileName);

    if (type === 'text') {
      const t = cleanText(msg.text && msg.text.body); if (t) await feed(lead, t);
    } else if (type === 'interactive' || type === 'button') {
      let t = '';
      if (type === 'button') t = cleanText((msg.button && (msg.button.text || msg.button.payload)) || '');
      else {
        const i = msg.interactive || {}; const r = i.button_reply || i.list_reply || null;
        if (r) {
          t = cleanText(r.title);
          const offered = (quickByLead.get(lead.id) || []).find((o) => o.id === r.id && o.title === t);
          if (offered) t = cleanText(offered.full);       // the full option text, not the cut-down button title
        }
      }
      if (t) await feed(lead, t);
    } else if (type === 'location') {
      const lat = Number(msg.location && msg.location.latitude), lng = Number(msg.location && msg.location.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const near = nearestLocality(LC, lat, lng);
        const where = cleanName(msg.location.name || msg.location.address || '');
        const shown = '[Location shared] ' + (where ? where + ' ' : '') + '(' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')';
        if (near && near.km <= NEAR_KM) await feed(lead, shown, { forced: 'in ' + near.name, display: shown + ', nearest area ' + near.name });
        else await feed(lead, shown, { forced: OUT_OF_AREA, display: shown + ', outside the areas we cover' });
      }
    } else if (MEDIA_TYPES.has(type)) mediaNote(lead, type);
    else mediaNote(lead, 'other');
    tracker.collect({ by: 'WhatsApp' });
  }

  const waChains = new Map();                 // wa_id -> promise: one occupier's messages are handled one at a time, in order
  function queueMessage(msg, profileName) {
    const key = String(msg.from || '');
    const prev = waChains.get(key) || Promise.resolve();
    const next = prev.then(() => handleMessage(msg, profileName)).catch((e) => { log.error('[wa] could not handle a message from ' + maskNum(key) + ': ' + (e && e.stack ? e.stack : e)); });
    waChains.set(key, next); pendingWork.add(next);
    next.then(() => { pendingWork.delete(next); if (waChains.get(key) === next) waChains.delete(key); });
    return next;
  }

  /** The body of a webhook POST (already checked). Resolves when everything in it has been handled. */
  async function processPayload(body) {
    if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return;
    const work = [];
    for (const entry of body.entry) {
      for (const ch of (entry && Array.isArray(entry.changes) ? entry.changes : [])) {
        const v = ch && ch.value; if (!v || typeof v !== 'object') continue;
        if (ch.field && ch.field !== 'messages') continue;
        const pid = v.metadata && v.metadata.phone_number_id;
        if (pid && cfg.phoneId && String(pid) !== cfg.phoneId) { log.warn('[wa] webhook for another phone number id ignored'); continue; }
        const names = new Map((Array.isArray(v.contacts) ? v.contacts : []).map((c) => [String(c.wa_id), c.profile && c.profile.name]));
        for (const msg of (Array.isArray(v.messages) ? v.messages : [])) if (msg && typeof msg === 'object') work.push(queueMessage(msg, names.get(String(msg.from)) || (v.contacts && v.contacts[0] && v.contacts[0].profile && v.contacts[0].profile.name)));
        for (const st of (Array.isArray(v.statuses) ? v.statuses : [])) work.push(handleStatus(st).catch((e) => log.error('[wa] status error: ' + e.message)));
      }
    }
    await Promise.all(work);
  }

  /* ================== routes ================== */
  app.get('/webhook/whatsapp', (req, res) => {
    const q = req.query || {};
    const tok = String(q['hub.verify_token'] || '');
    const a = Buffer.from(tok), b = Buffer.from(cfg.verifyToken);
    const ok = q['hub.mode'] === 'subscribe' && cfg.verifyToken && a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(403).type('text/plain').send('Forbidden');
    res.status(200).type('text/plain').send(cut(String(q['hub.challenge'] || ''), 200));
  });

  app.post('/webhook/whatsapp', (req, res) => {
    if (!cfg.appSecret) {
      if (!warnedSecret) { warnedSecret = true; log.warn('[wa] WA_APP_SECRET is not set: webhook signatures cannot be checked' + (cfg.production ? ', so webhook posts are refused' : ' (accepted here because this is not production)')); }
      // Refuse unsigned posts in production, and whenever WhatsApp is switched on (a token is set), so a tunnel on a laptop is safe too.
      if (cfg.production || cfg.token) return res.status(401).json({ error: 'Webhook signature cannot be checked.' });
    } else if (!verifySignature(req.rawBody, req.get('x-hub-signature-256'), cfg.appSecret)) {
      stats.badSignatures++;
      log.warn('[wa] webhook refused: bad or missing signature');
      return res.status(401).json({ error: 'Bad signature.' });
    }
    res.status(200).send('EVENT_RECEIVED');          // answer Meta at once; the work happens after
    if (!configured) { log.info('[wa] webhook post ignored: WhatsApp is off'); return; }
    const body = req.body;
    setImmediate(() => {
      const work = processPayload(body).catch((e) => log.error('[wa] webhook error: ' + (e && e.stack ? e.stack : e)));
      pendingWork.add(work); work.then(() => pendingWork.delete(work));
    });
  });

  app.get('/api/wa/status', auth.requireRole('ceo', 'manager'), async (req, res) => {
    let lastIn = stats.lastInboundAt;
    if (!lastIn && !closed) { try { const r = await pool.query("SELECT max(ts) AS t FROM wa_events WHERE direction = 'in'"); lastIn = r.rows[0] && r.rows[0].t ? +new Date(r.rows[0].t) : null; } catch (e) { lastIn = null; } }
    res.set('Cache-Control', 'no-store').json({
      configured, phoneNumberId: configured ? cfg.phoneId : null, graphVersion: cfg.version,
      webhookUrl, needsPublicUrl: !cfg.publicBase, verifyTokenSet: !!cfg.verifyToken, appSecretSet: !!cfg.appSecret,
      lastInboundAt: lastIn, lastError: stats.lastError, counts: { inbound: stats.inbound, duplicates: stats.dupes, sent: stats.sent, failed: stats.failed, badSignatures: stats.badSignatures },
    });
  });

  ctx.wa = {
    cfg: { ...cfg, token: undefined, appSecret: undefined }, configured, processPayload,
    /** Resolves when every send and every inbound message queued so far has finished (used by tests). */
    async whenIdle() { while (pendingWork.size) await Promise.allSettled(Array.from(pendingWork)); },
  };
}

module.exports = { register, verifySignature, fmtPhone, nearestLocality, textPayload, imagePayload, quickPayload };
