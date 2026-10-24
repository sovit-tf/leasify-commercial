/* =====================================================================
   Leasify Commercial demo: DASHBOARD (landing view)
   KPI tiles, 30-day pipeline, "needs attention now", live feed,
   quick actions and a 10-minute demo guide.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc, DAY = LC.DAY;

LC.css(`
.db-greet { display: flex; gap: 14px 24px; justify-content: space-between; align-items: center; flex-wrap: wrap; padding: 16px 18px; }
.db-greet h2 { font-size: 18px; font-weight: 700; }
.db-greet p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
.db-qa { display: flex; gap: 8px; flex-wrap: wrap; }
#db-mine:empty { display: none; }
.db-mine-g { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.db-mine-t { all: unset; box-sizing: border-box; cursor: pointer; border: 1px solid var(--hair); background: var(--surface-2); border-radius: 8px; padding: 10px 12px; display: grid; gap: 2px; min-width: 0; }
.db-mine-t:hover { border-color: var(--brand); }
.db-mine-t:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.db-mine-t .l { font-size: 12px; color: var(--muted); font-weight: 500; }
.db-mine-t .v { font-family: var(--f-head); font-size: 24px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.db-mine-t .v.bad { color: var(--bad); }
.db-mine-t .d { font-size: 11.5px; color: var(--muted); }
.db-kpis .kpi .v { font-size: 28px; }
.db-kpis .kpi .d .bad { color: var(--bad); font-weight: 600; }
.db-kpis .kpi .d .warn { color: var(--warn); font-weight: 600; }
.db-kpis .kpi .l { display: flex; gap: 4px; align-items: center; }
.db-kpis .kpi .l i { font-style: normal; font-size: 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 50%; width: 14px; height: 14px; display: inline-grid; place-items: center; cursor: help; }
.db-pipe { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.db-stage { border: 1px solid var(--hair); background: var(--surface-2); border-radius: 8px; padding: 12px; display: grid; gap: 4px; min-width: 0; align-content: start; }
.db-stage .t { font-size: 12px; font-weight: 600; display: flex; gap: 4px; align-items: center; }
.db-stage .t i { font-style: normal; font-size: 10px; color: var(--muted); border: 1px solid var(--border); border-radius: 50%; width: 14px; height: 14px; display: inline-grid; place-items: center; cursor: help; flex: none; }
.db-stage .n { font-family: var(--f-head); font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
.db-stage .bar { height: 8px; background: var(--grid); border-radius: 3px; overflow: hidden; }
.db-stage .bar i { display: block; height: 100%; background: var(--brand); border-radius: 3px; }
.db-stage .c { font-size: 11.5px; color: var(--muted); }
.db-stage .c b { color: var(--fg); font-weight: 600; font-family: var(--f-mono); }
.db-pipe-foot { display: flex; gap: 8px 18px; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-top: 12px; }
.db-defs summary { cursor: pointer; font-size: 12px; color: var(--brand-ink); font-weight: 500; }
.db-defs .defs { margin-top: 8px; }
.db-att { list-style: none; margin: 0; padding: 0; }
.db-att li { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 11px 18px; border-bottom: 1px solid var(--hair); }
.db-att li:last-child { border-bottom: 0; }
.db-att .tt { font-weight: 600; font-size: 13px; overflow-wrap: anywhere; }
.db-att .ss { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.db-att .pill { justify-self: start; }
.db-foot { display: flex; gap: 8px 16px; flex-wrap: wrap; align-items: center; padding: 10px 18px; border-top: 1px solid var(--hair); font-size: 12px; color: var(--muted); }
.db-foot a, .db-link { color: var(--brand-ink); font-weight: 500; text-decoration: none; background: none; border: 0; padding: 0; font-size: 12px; }
.db-foot a:hover, .db-link:hover { text-decoration: underline; }
.db-feed { list-style: none; margin: 0; padding: 0; }
.db-feed li { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; padding: 8px 18px; border-bottom: 1px solid var(--hair); font-size: 12.5px; }
.db-feed li:last-child { border-bottom: 0; }
.db-feed .when { font-family: var(--f-mono); font-size: 10.5px; color: var(--muted); padding-top: 2px; }
.db-feed button { all: unset; cursor: pointer; color: var(--fg); overflow-wrap: anywhere; display: block; width: 100%; }
.db-feed button:hover { color: var(--brand-ink); }
.db-feed button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.db-feed .k-handoff { color: var(--warn); font-weight: 600; }
.db-guide-h { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.db-guide-h h2 { font-size: 15px; font-weight: 600; }
.db-guide-h p { margin: 2px 0 0; font-size: 12.5px; color: var(--fg-2); }
.guide li a .gt { display: grid; gap: 1px; min-width: 0; align-content: start; }
.guide li a .gt b { display: block; font-weight: 600; }
.guide li a .gt em { font-style: normal; color: var(--muted); font-size: 11.5px; }
@media (max-width: 1180px) { .db-pipe { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 860px) {
  .db-pipe { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .db-att li { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .db-att li .btn { justify-self: start; }
  .db-qa .btn { flex: 1 1 auto; justify-content: center; }
}
`);

let guideOpen = true;      // kept in memory only
let ticker = null, debounceT = null;
let rootEl = null;

/* ---------------- numbers ---------------- */
function stats() {
  const S = LC.state, now = Date.now(), t0 = +LC.today(), t1 = t0 + DAY;
  const fresh = LC.settings().freshnessDays;
  const waiting = LC.queue.waiting();
  const vToday = S.visits.filter(v => v.when >= t0 && v.when < t1 && v.status !== 'Cancelled');
  const avail = S.units.filter(u => u.status === 'Available');
  return {
    now, t0, fresh,
    newToday: S.clients.filter(c => c.createdAt >= t0).length,
    new7: S.clients.filter(c => c.createdAt >= now - 7 * DAY).length,
    aiLive: S.leads.filter(l => l.status === 'ai').length,
    leadsTotal: S.leads.length,
    waiting: waiting.length,
    breach: waiting.filter(q => q.slaDue < now).length,
    vToday: vToday.length,
    vConfirmed: vToday.filter(v => v.confirmation === 'Confirmed').length,
    vPending: vToday.filter(v => v.confirmation !== 'Confirmed').length,
    proposals: S.clients.filter(c => c.stage === 'Proposal').length,
    avail: avail.length,
    stale: avail.filter(u => LC.unitFreshness(u).days > fresh).length,
  };
}
function kpiHtml() {
  const s = stats(), sla = LC.settings().slaMinutes;
  const k = (label, value, detail, def) => '<div class="kpi" title="' + esc(def) + '"><div class="l">' + esc(label) + ' <i aria-hidden="true">?</i></div><div class="v">' + value + '</div><div class="d">' + detail + '</div></div>';
  return k('New enquiries today', LC.fmtNum(s.newToday), LC.fmtNum(s.new7) + ' in the last 7 days', 'Clients whose first contact arrived since midnight, from any source.') +
    k('Live AI conversations', LC.fmtNum(s.aiLive), s.leadsTotal ? LC.fmtNum(s.leadsTotal) + ' conversations in the inbox' : 'Start the simulator to see these', 'Conversations the AI agent is handling right now, with no person involved yet.') +
    k('Waiting for a person', LC.fmtNum(s.waiting), s.breach ? '<b class="bad">' + s.breach + ' past SLA</b>' : (s.waiting ? 'None past SLA' : 'Nothing waiting'), 'Conversations handed to a person that nobody has picked up yet. Past SLA means waiting longer than the response target in Settings (' + sla + ' minutes now).') +
    k('Visits today', LC.fmtNum(s.vToday), LC.fmtNum(s.vConfirmed) + ' confirmed, ' + (s.vPending ? '<b class="warn">' + s.vPending + ' pending</b>' : '0 pending'), 'Site visits scheduled for today. Confirmed means the occupier said yes on the confirmation call.') +
    k('Proposals out', LC.fmtNum(s.proposals), 'Waiting on a decision', LC.STAGE_DEFS['Proposal']) +
    k('Available units', LC.fmtNum(s.avail), s.stale ? '<b class="warn">' + s.stale + ' not confirmed in ' + s.fresh + ' days</b>' : 'All confirmed in ' + s.fresh + ' days', 'Units with status Available. The second number counts those the owner has not confirmed within ' + s.fresh + ' days. The AI agent will not send those out.');
}

/* ---------------- my work (leasing executives only) ---------------- */
function myWorkHtml() {
  if (!LC.session || LC.session.role !== 'executive') return '';
  const me = LC.session.name, S = LC.state, t0 = +LC.today(), t1 = t0 + DAY;
  const open = S.clients.filter(c => c.agent === me && !['Lost', 'Signed lease', 'Nurture'].includes(c.stage));
  const over = open.filter(c => c.nextFollowUp && c.nextFollowUp < t0);
  const vis = S.visits.filter(v => v.agent === me && v.when >= t0 && v.when < t1 && v.status !== 'Cancelled');
  const pend = vis.filter(v => v.confirmation !== 'Confirmed').length;
  const ho = LC.queue.waiting().filter(q => q.assignee === me);
  const tile = (go, label, n, detail, def, bad) => '<button type="button" class="db-mine-t" data-mine="' + go + '" title="' + esc(def) + '"><span class="l">' + esc(label) + '</span><span class="v' + (bad ? ' bad' : '') + '">' + LC.fmtNum(n) + '</span><span class="d">' + esc(detail) + '</span></button>';
  return '<div class="card db-mine"><div class="card-h"><h2>My work</h2><span class="small muted">' + esc(me) + ' · ' + esc(LC.WD[new Date().getDay()]) + ' ' + esc(LC.fmtDate(LC.today())) + '</span><span class="spacer"></span><button type="button" class="btn sm" data-mine="team">My report card</button></div><div class="card-b db-mine-g">' +
    tile('crm', 'My open clients', open.length, 'Not lost, signed or paused', 'Your clients that are not Lost, Signed lease or Nurture.') +
    tile('visits', 'My visits today', vis.length, pend ? pend + ' to confirm by call' : 'All confirmed', 'Site visits today with you as the agent. Confirmed means the occupier said yes on the confirmation call.', pend > 0) +
    tile('crm', 'My overdue follow-ups', over.length, over.length ? 'Oldest ' + Math.max(1, LC.daysAgo(LC.iso(over.slice().sort((a, b) => a.nextFollowUp - b.nextFollowUp)[0].nextFollowUp))) + ' days late' : 'None overdue', 'Open clients of yours whose next follow-up date is before today.', over.length > 0) +
    tile('inbox', 'Handoffs assigned to me', ho.length, ho.length ? 'Waiting for you to pick up' : 'Nothing waiting', 'Conversations the AI agent handed to you that nobody has picked up yet.', ho.length > 0) +
    '</div></div>';
}

/* ---------------- pipeline (last 30 days) ---------------- */
function pipelineHtml() {
  const from = Date.now() - 30 * DAY;
  const cl = LC.state.clients.filter(c => c.createdAt >= from);
  const f = LC.funnel(cl);
  const top = Math.max(1, f[0].n);
  let h = '<div class="db-pipe">';
  f.forEach((x, i) => {
    const prev = i ? f[i - 1].n : null;
    const conv = i === 0 ? null : (prev > 0 ? Math.round(x.n / prev * 100) + '%' : '–');
    const w = x.n ? Math.max(2, Math.round(x.n / top * 100)) : 0;
    h += '<div class="db-stage" title="' + esc(x.stage + ': ' + (LC.STAGE_DEFS[x.stage] || '')) + '">' +
      '<div class="t">' + esc(x.stage) + ' <i aria-hidden="true">?</i></div><div class="n">' + LC.fmtNum(x.n) + '</div>' +
      '<div class="bar" aria-hidden="true"><i style="width:' + w + '%"></i></div>' +
      '<div class="c">' + (i === 0 ? 'All clients created' : '<b>' + conv + '</b> of ' + esc(f[i - 1].stage.toLowerCase())) + '</div></div>';
  });
  h += '</div>';
  const signed = f[5].n;
  h += '<div class="db-pipe-foot"><span class="small muted">' + LC.fmtNum(cl.length) + ' clients created in the last 30 days (sample data). Enquiry to signed lease: <b class="num" style="color:var(--fg)">' + (cl.length ? (signed / cl.length * 100).toFixed(1) + '%' : '–') + '</b> (' + signed + ' of ' + cl.length + '). Bars are drawn to the same scale. A client counts at every stage they reached, even if they were later lost or paused.</span>' +
    '<details class="db-defs"><summary>What each stage means</summary><dl class="defs">' + LC.STAGES.concat(LC.OFF_STAGES).map(s => '<dt>' + esc(s) + '</dt><dd>' + esc(LC.STAGE_DEFS[s] || '') + '</dd>').join('') + '</dl></details></div>';
  return h;
}

/* ---------------- needs attention ---------------- */
const KIND_ORDER = ['handoff', 'visit', 'followup', 'stuck', 'stale'];
const KIND_LABEL = { handoff: ['Handoff', 'bad'], visit: ['Visit call', 'warn'], followup: ['Follow-up', 'warn'], stuck: ['Stuck', 'warn'], stale: ['Listings', 'brand'] };
const nm = (c) => c ? (c.company || c.name) : 'Client';
function ageText(ms) { const m = Math.round(ms / 60e3); if (m < 1) return 'under a minute'; if (m < 60) return m + ' min'; if (m < 1440) return Math.round(m / 60) + ' h'; return Math.round(m / 1440) + ' d'; }

function attentionItems() {
  const S = LC.state, now = Date.now(), t1 = +LC.today() + DAY, out = [];
  // 1. handoffs waiting, past SLA first
  LC.queue.waiting().slice().sort((a, b) => a.slaDue - b.slaDue).forEach(q => {
    const lead = S.leads.find(l => l.id === q.leadId); const c = LC.crm.get(q.clientId || (lead && lead.clientId));
    const late = now > q.slaDue;
    const who = c ? nm(c) : (lead ? (lead.company || lead.name) : 'Occupier');
    out.push({ kind: 'handoff', sev: late ? 2 : 1, title: who + ' · ' + q.ruleName,
      sub: (q.reason || '') + ' · waiting ' + ageText(now - q.at) + (late ? ' (' + ageText(now - q.slaDue) + ' past SLA)' : ''), late,
      btn: 'Open conversation', act: q.leadId ? 'lead' : 'inbox', id: q.leadId });
  });
  // 2. visit confirmation calls due today
  S.tasks.filter(t => !t.done && t.type === 'Confirm visit' && t.due < t1).sort((a, b) => a.due - b.due).forEach(t => {
    const c = LC.crm.get(t.clientId), v = LC.visits.get(t.visitId); if (v && v.status !== 'Booked') return;
    const over = t.due < now;
    out.push({ kind: 'visit', sev: over ? 2 : 1, title: 'Confirm visit call: ' + nm(c),
      sub: (v ? 'Visit ' + LC.dayLabel(v.when).toLowerCase() + ' at ' + LC.fmtTime(v.when) + ', ' + v.unitId : '') + ' · call ' + (over ? 'was due ' + LC.relTime(t.due) : 'due ' + LC.relTime(t.due)), late: over,
      btn: 'Open client', act: 'client', id: t.clientId });
  });
  // 3. overdue follow-ups
  S.tasks.filter(t => !t.done && t.clientId && !['Confirm visit', 'Owner check'].includes(t.type) && t.due < now).sort((a, b) => a.due - b.due).forEach(t => {
    const c = LC.crm.get(t.clientId); if (!c || ['Lost', 'Signed lease'].includes(c.stage)) return;
    out.push({ kind: 'followup', sev: 1, title: t.title || ('Follow up: ' + nm(c)), sub: t.type + ' · overdue by ' + ageText(now - t.due) + (c.agent ? ' · ' + c.agent : ''), late: true, btn: 'Open client', act: 'client', id: c.id });
  });
  // 4. stuck more than 10 days in a stage
  S.clients.filter(c => !['Lost', 'Signed lease', 'Nurture'].includes(c.stage)).forEach(c => {
    const hist = c.stageHistory || []; const last = hist.length ? hist[hist.length - 1].ts : c.createdAt; const d = Math.floor((now - last) / DAY);
    if (d > 10) out.push({ kind: 'stuck', sev: d, title: nm(c) + ' has been at ' + c.stage + ' for ' + d + ' days', sub: (c.agent || '') + ' · ' + LC.reqSummary(c.req), late: false, btn: 'Open client', act: 'client', id: c.id });
  });
  // 5. units not confirmed
  const fr = LC.settings().freshnessDays;
  const stale = S.units.filter(u => u.status === 'Available' && LC.unitFreshness(u).days > fr).sort((a, b) => LC.unitFreshness(b).days - LC.unitFreshness(a).days);
  if (stale.length) out.push({ kind: 'stale', sev: 1, title: stale.length + ' unit' + (stale.length > 1 ? 's' : '') + ' not confirmed in ' + fr + ' days', sub: stale.slice(0, 3).map(u => u.unit_id + ' (' + LC.unitFreshness(u).days + ' d)').join(', ') + (stale.length > 3 ? ' and ' + (stale.length - 3) + ' more' : '') + '. The AI agent will not send these out until the owner confirms.', late: false, btn: 'Run owner check', act: 'owner' });
  return out;
}
function pickAttention(all, cap) {
  const by = {}; KIND_ORDER.forEach(k => by[k] = all.filter(x => x.kind === k).sort((a, b) => b.sev - a.sev));
  const chosen = new Set();
  KIND_ORDER.forEach(k => by[k].slice(0, 2).forEach(x => chosen.size < cap && chosen.add(x)));
  KIND_ORDER.forEach(k => by[k].forEach(x => chosen.size < cap && chosen.add(x)));
  return KIND_ORDER.flatMap(k => by[k].filter(x => chosen.has(x)));
}
function attentionHtml() {
  const all = attentionItems(); const shown = pickAttention(all, 8);
  let h;
  if (!shown.length) h = LC.empty('Nothing needs a person right now.');
  else h = '<ul class="db-att">' + shown.map(x => {
    const [lab, cls] = KIND_LABEL[x.kind];
    return '<li><span class="pill ' + (x.late && x.kind !== 'stale' ? 'bad' : cls) + '">' + esc(lab) + '</span><div><div class="tt">' + esc(x.title) + '</div><div class="ss">' + esc(x.sub) + '</div></div><button type="button" class="btn sm' + (x.late ? ' primary' : '') + '" data-act="' + x.act + '"' + (x.id ? ' data-id="' + esc(x.id) + '"' : '') + '>' + esc(x.btn) + '</button></li>';
  }).join('') + '</ul>';
  const n = (k) => all.filter(x => x.kind === k).length;
  h += '<div class="db-foot"><span>' + (all.length > shown.length ? 'Showing ' + shown.length + ' of ' + all.length + '.' : 'Showing all ' + all.length + '.') + '</span>' +
    '<a href="#visits" data-go="visits">See all visits (' + n('visit') + (n('visit') === 1 ? ' call' : ' calls') + ' due)</a><a href="#crm" data-go="crm">See all clients (' + (n('stuck') + n('followup')) + ' to chase)</a>' + (n('handoff') ? '<a href="#inbox" data-go="inbox">See inbox (' + n('handoff') + ' waiting)</a>' : '') + '</div>';
  return h;
}

/* ---------------- live feed ---------------- */
function feedHtml() {
  const rows = LC.state.activity.slice(0, 15);
  if (!rows.length) return LC.empty('Nothing has happened yet. Start the lead simulator to see activity.');
  return '<ul class="db-feed">' + rows.map(e => {
    const act = e.leadId ? ['lead', e.leadId] : e.clientId ? ['client', e.clientId] : e.unitId ? ['unit', e.unitId] : null;
    const txt = esc(e.text);
    return '<li><span class="when" title="' + esc(LC.fmtDT(e.ts)) + '">' + esc(LC.relTime(e.ts)) + '</span>' +
      (act ? '<button type="button" data-act="' + act[0] + '" data-id="' + esc(act[1]) + '" class="' + (e.kind === 'handoff' ? 'k-handoff' : '') + '">' + txt + '</button>' : '<span class="' + (e.kind === 'handoff' ? 'k-handoff' : '') + '">' + txt + '</span>') + '</li>';
  }).join('') + '</ul>';
}

/* ---------------- guide ---------------- */
const GUIDE = [
  ['Start the simulator', 'Watch 30 enquiries get answered', 'inbox', 'sim'],
  ['See a handoff', 'Open a conversation passed to a person and see why', 'inbox'],
  ['Test as an occupier', 'Chat in Odia as a new enquirer', 'inbox'],
  ['Open a listing', 'Cost calculator and the clients it fits', 'inventory'],
  ['Sync the inventory', 'Pull changes from the Google Sheet', 'inventory'],
  ['Match a requirement', 'Paste a WhatsApp message and match it', 'match'],
  ['Ask the co-pilot', 'What is stuck, and who to chase', 'copilot'],
  ['Open a client', 'Requirement history and movement', 'crm'],
  ['Owner report', 'Show an owner their weekly report', 'owners'],
  ['Analytics', 'What is working, by source, unit and team member', 'analytics'],
];
function guideHtml() {
  return '<div class="guide"><div class="db-guide-h"><div><h2>Demo guide: a 10-minute walkthrough</h2><p>Follow the steps in order. Each one jumps to the right screen.</p></div>' +
    '<button type="button" class="btn sm" id="db-guide-t" aria-expanded="' + guideOpen + '" aria-controls="db-guide-body">' + (guideOpen ? 'Hide guide' : 'Show guide') + '</button></div>' +
    '<ol id="db-guide-body"' + (guideOpen ? '' : ' hidden') + '>' + GUIDE.map(g => '<li><a href="#' + g[2] + '" data-go="' + g[2] + '"' + (g[3] ? ' data-sim="1"' : '') + '><div class="gt"><b>' + esc(g[0]) + '</b><em>' + esc(g[1]) + '</em></div></a></li>').join('') + '</ol></div>';
}

/* ---------------- actions ---------------- */
function act(type, id) {
  if (type === 'lead') { if (LC.openLead) LC.openLead(id); else LC.go('inbox'); }
  else if (type === 'inbox') LC.go('inbox');
  else if (type === 'client') { if (LC.openClient) LC.openClient(id); else LC.go('crm'); }
  else if (type === 'unit') { if (LC.openUnit) LC.openUnit(id); else LC.go('inventory'); }
  else if (type === 'owner') { if (LC.runOwnerCheck) LC.runOwnerCheck(); else LC.go('owners'); }
}
function startSim() { if (LC.sim && !LC.sim.running) LC.sim.start(30); LC.go('inbox'); }

/* ---------------- view ---------------- */
function greeting() {
  const d = new Date(), h = d.getHours(); const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return part + ', ' + esc(String(LC.state.me).split(' ')[0]);
}
function refresh() {
  if (!rootEl || !LC.isActive('dashboard')) return;
  const set = (id, h) => { const e = LC.$(id, rootEl); if (e) e.innerHTML = h; };
  set('#db-mine', myWorkHtml()); set('#db-kpis', kpiHtml()); set('#db-pipe', pipelineHtml()); set('#db-att', attentionHtml()); set('#db-feed', feedHtml());
}

LC.registerView('dashboard', {
  title: 'Dashboard', sub: 'Where every deal is today, and what needs a person',
  render(el) {
    rootEl = el;
    const running = !!(LC.sim && LC.sim.running);
    el.innerHTML =
      '<div id="db-mine"></div>' +
      '<div class="card db-greet"><div><h2>' + greeting() + '</h2><p>' + esc(LC.WD[new Date().getDay()] + ' ' + LC.fmtDateY(new Date())) + '. All figures below are sample data and update as the team works.</p></div>' +
      '<div class="db-qa"><button type="button" class="btn primary" data-q="sim">' + (running ? 'Simulator running: open the inbox' : 'Start the lead simulator (30 leads)') + '</button>' +
      '<button type="button" class="btn" data-q="owner">Run weekly owner check</button><button type="button" class="btn" data-q="match">Match a requirement</button><button type="button" class="btn" data-q="copilot">Ask the co-pilot</button></div></div>' +
      '<div class="kpis db-kpis" id="db-kpis"></div>' +
      '<div class="card"><div class="card-h"><h2>Pipeline, last 30 days</h2><span class="spacer"></span><span class="small muted">Clients created in the last 30 days, by the furthest stage reached</span></div><div class="card-b" id="db-pipe"></div></div>' +
      '<div class="split"><div class="card"><div class="card-h"><h2>Needs attention now</h2><span class="spacer"></span><span class="small muted">Most urgent first</span></div><div id="db-att"></div></div>' +
      '<div class="card"><div class="card-h"><h2>Live activity</h2><span class="spacer"></span><span class="small muted">Last 15 events</span></div><div id="db-feed"></div></div></div>' +
      guideHtml();
    refresh();
    el.onclick = (e) => {
      const mn = e.target.closest('[data-mine]');
      if (mn) { const t = mn.dataset.mine; if (t === 'crm') LC.go('crm', { agent: LC.session.name }); else if (t === 'inbox') LC.go('inbox', { tab: 'mine' }); else LC.go(t); return; }
      const q = e.target.closest('[data-q]');
      if (q) { const t = q.dataset.q; if (t === 'sim') startSim(); else if (t === 'owner') act('owner'); else LC.go(t); return; }
      const a = e.target.closest('[data-act]'); if (a) { act(a.dataset.act, a.dataset.id); return; }
      const g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); if (g.dataset.sim) startSim(); else LC.go(g.dataset.go); return; }
      if (e.target.closest('#db-guide-t')) {
        guideOpen = !guideOpen; const b = LC.$('#db-guide-t', el), body = LC.$('#db-guide-body', el);
        body.hidden = !guideOpen; b.setAttribute('aria-expanded', guideOpen); b.textContent = guideOpen ? 'Hide guide' : 'Show guide';
      }
    };
    clearInterval(ticker); ticker = setInterval(() => { if (LC.isActive('dashboard')) refresh(); }, 30000);
  },
  onHide() { clearInterval(ticker); ticker = null; },
});

/* live updates while the dashboard is the visible view (debounced) */
['clients:changed', 'queue:changed', 'visits:changed', 'units:changed', 'leads:changed', 'tasks:changed'].forEach(evt => {
  LC.on(evt, () => { if (!LC.isActive('dashboard')) return; clearTimeout(debounceT); debounceT = setTimeout(refresh, 400); });
});
})();
