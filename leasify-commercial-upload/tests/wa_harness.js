'use strict';
/* Shared set-up for the WhatsApp tests: the app with a fake Graph server behind it, and a signed-webhook sender. */
const { startServer, until, sleep } = require('./helpers');
const { fakeGraph, fakeAI, signed, waPayload, textMsg } = require('./fakes');

const SECRET = 'test-app-secret-123';
const VERIFY = 'test-verify-token';

/** Boots the app with WhatsApp pointed at a fake Graph. opts.ai true adds a fake OpenAI service too. */
async function boot({ graph = {}, ai = null, env = {}, publicBaseUrl = 'https://leasify.example.test', production = false, secret = SECRET } = {}) {
  const g = await fakeGraph(graph);
  const a = ai ? await fakeAI(ai) : null;
  const full = {
    WA_TOKEN: 'tok-test', WA_PHONE_NUMBER_ID: g.phoneId, WA_APP_SECRET: secret || '', WA_VERIFY_TOKEN: VERIFY, WA_GRAPH_BASE: g.base, WA_RETRY_MS: '30',
    ...(a ? { AI_BASE_URL: a.base, AI_API_KEY: 'k-test', AI_MODEL: a.model } : {}), ...env,
  };
  const S = await startServer({ env: full, publicBaseUrl, production });
  const ctx = S.app.ctx;
  const post = async (payload, opts = {}) => {
    const s = signed(opts.secret === undefined ? secret : opts.secret, payload);
    const headers = { ...s.headers }; if (opts.noSig) delete headers['X-Hub-Signature-256']; if (opts.sig) headers['X-Hub-Signature-256'] = opts.sig;
    const res = await fetch(S.base + '/webhook/whatsapp', { method: 'POST', headers, body: s.raw });
    return { status: res.status, text: await res.text() };
  };
  const idle = () => ctx.wa.whenIdle();
  /** Send one occupier message and wait until it is handled. */
  const say = async (from, message, name) => { const r = await post(waPayload({ phoneId: g.phoneId, from, name, message })); await sleep(40); await idle(); return r; };
  const leadOf = (from) => S.rt.state.leads.filter((l) => l.channel === 'whatsapp' && String(l.phone).replace(/\D/g, '').slice(-10) === String(from).slice(-10)).pop();
  return {
    S, g, a, ctx, post, idle, say, leadOf, SECRET, VERIFY, phoneId: g.phoneId,
    async close() { await S.close(); await g.close(); if (a) await a.close(); },
  };
}
module.exports = { boot, SECRET, VERIFY, until, sleep, waPayload, textMsg, signed, fakeAI, fakeGraph };

/** Wait until the chat has gone quiet: nothing typing, nothing being sent, no new message for `quietMs`. */
async function settle(H, from, quietMs = 450, maxMs = 12000) {
  const t0 = Date.now(); let last = -1, since = Date.now();
  for (;;) {
    await H.idle();
    const l = H.leadOf(from); const n = l ? l.messages.length : 0;
    if (!l || l._typing || n !== last) { last = n; since = Date.now(); }
    else if (Date.now() - since >= quietMs) return l;
    if (Date.now() - t0 > maxMs) throw new Error('chat did not settle');
    await sleep(60);
  }
}
module.exports.settle = settle;

/** An English office requirement that the match engine can satisfy today (the demo data ages with the calendar). */
function officeScenario(rt) {
  const LC = rt.LC;
  for (const u of rt.state.units.filter((x) => x.property_type === 'Office' && x.status === 'Available')) {
    const text = 'Need an office in ' + u.locality + ', around ' + u.chargeable_sqft + ' sq ft, budget ' + Math.ceil(u.all_in_per_sqft * 1.1) + ' per sq ft, ' + u.furnishing.toLowerCase() + ', 1 car park, move in 90 days';
    const p = LC.parseRequirement(text, LC.emptyReq(), {});
    if (LC.match(p.req).exact.length > 0) return { text, unit: u, req: p.req };
  }
  throw new Error('no office scenario matches today');
}
/** Answers for the questions the agent may still ask. */
const ANSWERS = { use: 'office', size: '2500 sq ft', budget: 'about 90 rs per sq ft', locality: 'Patia', moveIn: 'in 90 days', furnishing: 'plug-and-play', parking4w: '1 car park', powerBackup: 'yes' };
/** Play the occupier until the visit is booked (or the chat leaves the AI). Returns the lead. */
async function playToBooking(H, from, first, { name } = {}) {
  const { waPayload, textMsg } = require('./fakes');
  await H.say(from, textMsg(first), name);
  let l = await settle(H, from);
  for (let i = 0; i < 12 && l.status === 'ai' && l._e.stage !== 'booked'; i++) {
    let text;
    if (l._e.stage === 'pick') text = '1';
    else if (l._e.stage === 'slot') text = H.S.rt.LC.fmtDT(l._e.slots[0]);
    else text = ANSWERS[l._e.expect] || 'yes';
    await H.say(from, textMsg(text)); l = await settle(H, from);
  }
  return l;
}
module.exports.officeScenario = officeScenario;
module.exports.playToBooking = playToBooking;
