'use strict';
/* =====================================================================
   Simulator and lead actions (the engine runs here; every browser sees the same chats).

   Staff only (CEO, manager, executive). Owners never reach these.
     POST /api/sim/start   { n }          queue n simulated leads (default 30, up to 200)
     POST /api/sim/stop                    pause the simulator
     POST /api/sim/resume                  carry on after a pause
     POST /api/sim/add     { source? }    one more lead
     POST /api/sim/speed   { x }          1, 3 or 6
     POST /api/sim/team    { on }         simulated team picks up waiting leads (on) or not
     GET  /api/sim/stats                   state of the simulator and the live counters

     POST /api/leads/:id/takeover          a person takes the chat (or picks it up from the queue)
     POST /api/leads/:id/pickup            same, only for a lead that is waiting in the queue
     POST /api/leads/:id/handback          give the chat back to the AI agent
     POST /api/leads/:id/send    { text }  a person types; for a WhatsApp chat the text goes to the phone
     POST /api/test-chat  { text, leadId?, source?, language?, name?, company? }
                                           the "Test as an occupier" phone (real-time clock)

   The person's name comes from the session: it is on every message they send and in the audit trail.
   Changes reach the browsers through the same tracker diff as everything else.
   ===================================================================== */
const { COLLECTIONS, recordOf } = require('./collections');
const { rateLimiter, cut } = require('./util');

const STAFF = ['ceo', 'manager', 'executive'];
const ADMIN = new Set(['ceo', 'manager']);

class HttpError extends Error { constructor(status, message) { super(message); this.http = status; } }

function register(ctx) {
  const { app, rt, tracker, hub, auth, log } = ctx;
  const LC = rt.LC, E = rt.engine;
  const staff = auth.requireRole(...STAFF);
  const limiter = rateLimiter(300, 60000);

  // the engine's clock and its real-time queue (used by test chats and WhatsApp) need the ticker, always
  for (const l of rt.state.leads) if (l._typing) l._typing = false;      // a restart ends any "typing" that was in flight
  E.ensureTicker();

  const view = (lead) => JSON.parse(JSON.stringify(recordOf(COLLECTIONS.leads, lead)));
  const simState = () => {
    const s = E.simState();
    return { running: s.active && !s.paused, active: s.active, paused: s.paused, speed: s.speed, teamWorks: s.teamWorks, simNow: s.simNow, serverTime: Date.now() };
  };
  const pushState = () => hub.broadcast({ type: 'sim', sim: simState() }, (c) => STAFF.includes(c.session.role));

  /* typing indicators and replies should reach the screens within a fraction of a second: while any chat shows
     "typing", diff and publish every 200 ms instead of waiting for the engine's slower 480 ms tick */
  let wasTyping = false, closed = false;
  const fast = setInterval(() => {
    if (closed) return;
    const typing = rt.state.leads.some((l) => l._typing);
    if (typing || wasTyping) tracker.collect({ by: 'system' });
    wasTyping = typing;
  }, 200); fast.unref();
  const beat = setInterval(() => { if (!closed && hub.conns.size) pushState(); }, 4000); beat.unref();
  if (ctx.onClose) ctx.onClose(() => { closed = true; clearInterval(fast); clearInterval(beat); });

  /** Run fn as the signed-in person, then publish what changed under their name. */
  function run(req, res, fn) {
    if (!limiter.allow(req.session.userId)) return res.status(429).set('Retry-After', '10').json({ error: 'That is too many actions in a minute. Wait a moment.' });
    tracker.collect({ by: 'system' });
    let out;
    try { out = rt.withActor(req.session.name, () => fn(req.session.name)); }
    catch (e) {
      tracker.collect({ by: req.session.name });
      if (e instanceof HttpError) return res.status(e.http).json({ error: e.message });
      throw e;
    }
    tracker.collect({ by: req.session.name });
    pushState();
    res.set('Cache-Control', 'no-store').json({ ok: true, sim: simState(), ...out });
  }

  const needLead = (id) => { const l = E.leadById(String(id || '')); if (!l) throw new HttpError(404, 'That conversation was not found.'); return l; };
  /** Only the person who holds a chat (or a manager) may type in it or give it back. */
  const mustHold = (lead, actor, role) => {
    if (lead.status !== 'human') throw new HttpError(409, 'A person has not taken this chat yet.');
    if (lead.humanBy !== actor && !ADMIN.has(role)) throw new HttpError(403, 'This chat is with ' + lead.humanBy + '.');
  };
  const note = (actor, text) => LC.log(actor + ' ' + text, { kind: 'sim' });

  /* ---------------- simulator ---------------- */
  app.get('/api/sim/stats', staff, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ ...simState(), stats: E.computeStats() });
  });
  app.post('/api/sim/start', staff, (req, res) => {
    const raw = req.body && req.body.n;
    const n = raw == null || raw === '' ? 30 : Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 200) return res.status(400).json({ error: 'n must be a whole number from 1 to 200.' });
    run(req, res, (actor) => { LC.sim.start(n); note(actor, 'started the simulator with ' + n + ' leads'); return { started: n }; });
  });
  app.post('/api/sim/stop', staff, (req, res) => run(req, res, (actor) => { LC.sim.stop(); note(actor, 'paused the simulator'); return {}; }));
  app.post('/api/sim/resume', staff, (req, res) => run(req, res, (actor) => { LC.sim.resume(); note(actor, 'resumed the simulator'); return {}; }));
  app.post('/api/sim/add', staff, (req, res) => {
    const src = req.body && req.body.source;
    if (src != null && src !== '' && !LC.SOURCES.includes(src)) return res.status(400).json({ error: 'That lead source is not on the list.' });
    run(req, res, () => { LC.sim.addOne(src || null); return {}; });
  });
  app.post('/api/sim/speed', staff, (req, res) => {
    const x = Number(req.body && req.body.x);
    if (![1, 3, 6].includes(x)) return res.status(400).json({ error: 'Speed must be 1, 3 or 6.' });
    run(req, res, () => { LC.sim.speed = x; return {}; });
  });
  app.post('/api/sim/team', staff, (req, res) => {
    const on = req.body && req.body.on;
    if (typeof on !== 'boolean') return res.status(400).json({ error: 'Send { on: true } or { on: false }.' });
    run(req, res, (actor) => { LC.sim.teamWorks = on; note(actor, on ? 'turned the simulated team on' : 'turned the simulated team off'); return {}; });
  });

  /* ---------------- lead actions ---------------- */
  app.post('/api/leads/:id/takeover', staff, (req, res) => run(req, res, (actor) => {
    const lead = needLead(req.params.id);
    if (lead.status === 'human') {
      if (lead.humanBy === actor) return { lead: view(lead), unchanged: true };
      throw new HttpError(409, 'This chat is already with ' + lead.humanBy + '.');
    }
    E.takeOver(lead, actor);
    return { lead: view(lead) };
  }));
  app.post('/api/leads/:id/pickup', staff, (req, res) => run(req, res, (actor) => {
    const lead = needLead(req.params.id);
    if (lead.status !== 'handoff') throw new HttpError(409, 'This lead is not waiting in the queue.');
    E.takeOver(lead, actor);
    return { lead: view(lead) };
  }));
  app.post('/api/leads/:id/handback', staff, (req, res) => run(req, res, (actor) => {
    const lead = needLead(req.params.id);
    mustHold(lead, actor, req.session.role);
    E.handBack(lead);
    return { lead: view(lead) };
  }));
  app.post('/api/leads/:id/send', staff, (req, res) => run(req, res, (actor) => {
    const lead = needLead(req.params.id);
    const text = cut(String((req.body && req.body.text) == null ? '' : req.body.text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim(), 2000);
    if (!text) throw new HttpError(400, 'Type a message first.');
    mustHold(lead, actor, req.session.role);
    E.agentSend(lead, text);
    const m = lead.messages[lead.messages.length - 1];
    if (m && m.from === 'agent') m.by = actor;           // the engine labels it with whoever took the chat; the sender is the signed-in person
    return { lead: view(lead) };
  }));

  /* ---------------- "Test as an occupier" ---------------- */
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  app.post('/api/test-chat', staff, (req, res) => {
    const b = req.body || {};
    const text = cut(String(b.text == null ? '' : b.text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim(), 1000);
    if (!text) return res.status(400).json({ error: 'Type a message first.' });
    run(req, res, (actor) => {
      if (b.leadId) {
        const lead = needLead(b.leadId);
        if (!lead._test || lead.channel !== 'test') throw new HttpError(400, 'That conversation is not a test chat.');
        E.receive(lead, text);
        return { leadId: lead.id, lead: view(lead) };
      }
      const ivr = b.ivr === true;
      const phone = LC.fakePhone();
      const source = LC.SOURCES.includes(b.source) ? b.source : 'Office WhatsApp';
      const language = LC.LANGS.includes(b.language) ? b.language : 'English';
      const name = ivr ? 'Caller ' + phone.replace(/\D/g, '').slice(-4) : (clean(b.name, 60) || 'Test occupier');
      const lead = E.createLead({ name, company: ivr ? '' : clean(b.company, 80), phone, source, language, test: true });
      lead.channel = 'test'; lead.startedBy = actor;
      E.ensureTicker();
      E.receive(lead, text, { ivr });
      return { leadId: lead.id, lead: view(lead) };
    });
  });

  ctx.sim = { simState, view };
}

module.exports = { register };
