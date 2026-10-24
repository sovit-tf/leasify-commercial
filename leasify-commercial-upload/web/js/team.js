/* =====================================================================
   Leasify Commercial demo: TEAM REPORT CARDS
   View: 'team'
   Entry points: LC.openReportCard(name), LC.team.board(days), LC.team.summary(name)
   Everything is worked out from the clients, visits, tasks and handoffs in the
   system. Where the sample data has no history (completed tasks, past handoff
   pickups) this file adds a small deterministic history of its own on state:ready.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc, DAY = LC.DAY;
const isNum = (v) => typeof v === 'number' && isFinite(v);
const clamp = LC.clamp;
const DASH = '–';
const first = (n) => String(n || '').split(' ')[0];
const initials = (n) => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fN = (v) => isNum(v) ? LC.fmtNum(v) : DASH;
const fPct = (v) => isNum(v) ? Math.round(v * 100) + '%' : DASH;
const fMin = (m) => !isNum(m) ? DASH : m < 90 ? Math.round(m) + ' min' : m < 36 * 60 ? (m / 60).toFixed(1) + ' h' : (m / 1440).toFixed(1) + ' days';
const fMoney = (v) => isNum(v) ? LC.fmtLakh(v) : DASH;
const fRate = (v) => isNum(v) ? v.toFixed(1) + ' / 5' : DASH;
const pl = (n, a, b) => fN(n) + ' ' + (n === 1 ? a : (b || a + 's'));
const isOpen = (c) => !['Lost', 'Signed lease', 'Nurture'].includes(c.stage);
const idx = (s) => LC.STAGES.indexOf(s);

LC.css(`
#v-team > * { min-width: 0; }
.tm-card { display: grid; gap: 16px; min-width: 0; }
.tm-ctl { display: flex; gap: 10px 18px; flex-wrap: wrap; align-items: end; }
.tm-ctl .checkline { padding-bottom: 7px; }
.tm-ctl > .small { padding-bottom: 8px; }
.tm-top { display: grid; gap: 14px; }
.tm-head { display: flex; gap: 14px 24px; justify-content: space-between; align-items: center; flex-wrap: wrap; }
.tm-id { display: flex; gap: 12px; align-items: center; min-width: 0; }
.tm-id h2 { font-size: 20px; font-weight: 700; }
.tm-av { width: 48px; height: 48px; border-radius: 50%; background: var(--brand); color: var(--on-brand); display: grid; place-items: center; font-family: var(--f-head); font-weight: 700; font-size: 17px; flex: none; }
.tm-score { display: flex; gap: 12px; align-items: center; }
.tm-trend { max-width: 30ch; margin-top: 4px; }
.tm-ring { width: 84px; height: 84px; flex: none; }
.tm-ring-n { font-family: var(--f-head); font-weight: 700; font-size: 26px; fill: var(--fg); }
.tm-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px 18px; background: var(--surface-2); border-radius: 8px; padding: 12px 14px; }
.tm-meta div { display: grid; gap: 1px; min-width: 0; }
.tm-meta span { font-size: 11px; color: var(--muted); }
.tm-meta b { font-weight: 500; font-size: 13px; overflow-wrap: anywhere; }
.tm-warn { margin: 0; background: var(--warn-bg); color: var(--warn); border-radius: 6px; padding: 8px 12px; font-size: 12.5px; }
.tm-secs { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.tm-sec { border: 1px solid var(--hair); border-radius: 10px; padding: 14px; display: grid; gap: 8px; align-content: start; background: var(--surface); min-width: 0; }
.tm-sec-h { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.tm-sec h3 { font-size: 14px; font-weight: 600; }
.tm-sc { font-family: var(--f-head); font-size: 28px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.tm-sc.good, .tm-big.good { color: var(--good); } .tm-sc.brand, .tm-big.brand { color: var(--brand-ink); } .tm-sc.warn, .tm-big.warn { color: var(--warn); } .tm-sc.bad, .tm-big.bad { color: var(--bad); }
.tm-bar { height: 8px; background: var(--grid); border-radius: 4px; overflow: hidden; }
.tm-bar i { display: block; height: 100%; border-radius: 4px; background: var(--brand); }
.tm-bar i.good { background: var(--good); } .tm-bar i.warn { background: var(--warn); } .tm-bar i.bad { background: var(--bad); }
.tm-in { margin: 0; display: grid; gap: 0; }
.tm-in > div { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--hair); font-size: 12.5px; cursor: help; }
.tm-in dt { color: var(--muted); }
.tm-in dd { margin: 0; text-align: right; font-weight: 500; font-variant-numeric: tabular-nums; }
.tm-prev, .tm-prev1 { display: block; font-size: 11px; color: var(--muted); font-weight: 400; }
.tm-parts { display: flex; gap: 6px; flex-wrap: wrap; }
.tm-parts span { font-size: 11px; background: var(--surface-2); border-radius: 999px; padding: 2px 8px; color: var(--fg-2); }
.tm-parts b { font-family: var(--f-mono); font-weight: 600; }
.tm-rule { margin: 0; font-size: 11.5px; color: var(--muted); line-height: 1.45; }
.tm-rule b { color: var(--fg-2); }
.tm-low { font-size: 10px; font-weight: 600; letter-spacing: .02em; color: var(--warn); background: var(--warn-bg); border-radius: 4px; padding: 0 5px; white-space: nowrap; }
.tm-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.tm-box { border: 1px solid var(--hair); border-radius: 10px; padding: 14px; display: grid; gap: 8px; align-content: start; min-width: 0; }
.tm-box h3, .tm-list h3 { font-size: 14px; font-weight: 600; display: flex; gap: 8px; align-items: center; }
.tm-ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 13px; }
.tm-ul li { padding-left: 16px; position: relative; }
.tm-ul li::before { content: ''; position: absolute; left: 0; top: .55em; width: 8px; height: 8px; border-radius: 2px; background: var(--brand); }
.tm-ul.good li::before { background: var(--good); } .tm-ul.focus li::before { background: var(--warn); }
.tm-chart { max-width: 560px; }
.tm-chart text { font-size: 9.5px; }
.tm-kpis { grid-template-columns: repeat(auto-fit, minmax(142px, 1fr)); }
.tm-lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.tm-list { border: 1px solid var(--hair); border-radius: 10px; padding: 14px; display: grid; gap: 4px; align-content: start; min-width: 0; }
.tm-li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--hair); align-items: center; }
.tm-li-t { min-width: 0; } .tm-li-t .small { overflow-wrap: anywhere; }
.tm-li-r { font-size: 12px; text-align: right; }
.tm-none { padding: 8px 0; }
.tm-link { border: 0; background: none; padding: 0; color: var(--brand-ink); font-weight: 600; text-align: left; cursor: pointer; font-size: 13px; }
.tm-link:hover { text-decoration: underline; }
.tm-late { color: var(--bad); font-weight: 600; }
.tm-up { color: var(--good); font-weight: 600; } .tm-down { color: var(--bad); font-weight: 600; }
.tm-how { border: 1px solid var(--hair); border-radius: 10px; background: var(--surface); }
.tm-how summary { cursor: pointer; padding: 12px 16px; font-weight: 600; color: var(--brand-ink); font-size: 13px; }
.tm-how-b { padding: 0 16px 16px; display: grid; gap: 12px; font-size: 12.5px; }
.tm-how-b p { margin: 0; color: var(--fg-2); }
.tm-how-b .tbl { max-width: 360px; }
.tm-lb th { padding: 0; }
.tm-sort { border: 0; background: none; padding: 8px 8px; font: inherit; font-weight: 600; color: inherit; cursor: pointer; white-space: normal; line-height: 1.25; text-align: inherit; width: 100%; vertical-align: bottom; }
.tm-sort:hover { color: var(--brand-ink); }
.tm-lb { font-size: 12px; }
.tm-lb td { vertical-align: top; padding: 9px 8px; white-space: nowrap; }
.tm-lb td:first-child { white-space: normal; min-width: 128px; }
.tm-lb th { vertical-align: bottom; }
.tm-lb .tm-prev1 { white-space: nowrap; }
.tm-scorecell { display: grid; gap: 4px; justify-items: start; }
.tm-big { font-family: var(--f-head); font-size: 24px; font-weight: 700; line-height: 1; }
.tm-lb caption.sr { position: absolute; left: -9999px; }
@media (max-width: 860px) {
  .tm-two { grid-template-columns: minmax(0, 1fr); }
  .tm-secs, .tm-lists { grid-template-columns: minmax(0, 1fr); }
  .tm-head { align-items: flex-start; }
}
`);

/* ------------------------------------------------------------------ rules (one place, shown to the reader) */
const STAGE_P = { 'Qualified': 0.10, 'Site visit': 0.25, 'Proposal': 0.45, 'Letter of intent': 0.80 };
const TARGET = { fast: 15, slow: 120, steps: [0.6, 0.5, 0.5, 0.6], earned30: 200000, pipeline: 800000, noShowZero: 0.4 };
const STEP_LABELS = ['Qualified to visit', 'Visit to proposal', 'Proposal to letter of intent', 'Letter of intent to signed'];
const SECTIONS = [
  { key: 'speed', label: 'Speed', w: 20, rule: 'Two parts, averaged. First contact: 100 at ' + TARGET.fast + ' minutes or less, falling in a straight line to 0 at ' + TARGET.slow + ' minutes. Handoffs: the share picked up inside the response target (SLA), as a percentage.' },
  { key: 'follow', label: 'Follow-up discipline', w: 20, rule: 'Three parts, averaged. Overdue: 100 minus 10 for each overdue follow-up, not below 0. Coverage: the share of open clients with a next follow-up date. Tasks: the share of due tasks finished on time.' },
  { key: 'visits', label: 'Site visits', w: 15, rule: 'Three parts, averaged. Confirmed: the share of booked or done visits that had a confirmation call. No-shows: 100 minus 2.5 for each 1% of no-shows, so 0 at 40%. Rating: the average visit rating, with 1 scoring 0 and 5 scoring 100.' },
  { key: 'conv', label: 'Conversion', w: 20, rule: 'Four steps, averaged. Each step is the share of clients who moved on, against a target: qualified to visit ' + TARGET.steps[0] * 100 + '%, visit to proposal ' + TARGET.steps[1] * 100 + '%, proposal to letter of intent ' + TARGET.steps[2] * 100 + '%, letter of intent to signed ' + TARGET.steps[3] * 100 + '%. Meeting the target scores 100; below it scores in proportion. A step with nobody in it is skipped.' },
  { key: 'revenue', label: 'Revenue', w: 15, rule: 'Two parts, averaged. Earned: brokerage on leases signed in the period against ₹2 L per 30 days (scaled to the period), capped at 100. Pipeline: weighted pipeline owned against ₹8 L, capped at 100. Both targets are planning assumptions, adjust in Settings later.' },
  { key: 'quality', label: 'Data quality', w: 10, rule: 'Three shares, averaged, across open clients: those with a complete requirement (use, size, budget and area), those with a next follow-up date, and those with any activity in the last 7 days.' },
];
const BANDS = [
  { min: 80, label: 'Strong', cls: 'good', def: '80 and above' },
  { min: 65, label: 'On track', cls: 'brand', def: '65 to 79' },
  { min: 50, label: 'Needs support', cls: 'warn', def: '50 to 64' },
  { min: 0, label: 'At risk', cls: 'bad', def: 'under 50' },
];
const band = (s) => isNum(s) ? BANDS.find(b => s >= b.min) : { label: 'No data yet', cls: '', def: '' };
const slaMin = () => LC.settings().slaMinutes;
const DEF = {
  human: () => 'Median minutes from enquiry to first contact by a person, for this agent\'s clients created in the period. Walk-ins count as 0. ' + LC.METRICS.firstHuman,
  handoffs: () => 'Handoffs assigned to this agent in the period that were picked up inside the response target (' + slaMin() + ' minutes in Settings), divided by handoffs picked up or already past the target. Ones still waiting inside the target are left out.',
  fuSet: () => 'Open clients with a next follow-up date, divided by all open clients. Open means not Lost, Signed lease or Nurture.',
  overdue: () => 'Open clients whose next follow-up date is before today. This is today\'s position, so it does not change with the period.',
  tasks: () => 'Tasks due in the period that were finished on or before the due time, divided by tasks finished or overdue. Tasks not yet due are left out.',
  vDone: () => LC.METRICS.visits + ' Counted for this agent.',
  confirmed: () => 'Visits in the period that are booked or done and had a confirmation call (marked Confirmed), divided by those visits.',
  noShow: () => LC.METRICS.noShow + ' Here: visits marked No-show divided by visits done or no-show.',
  rating: () => 'Average of the 1 to 5 rating recorded after each visit that was done in the period.',
  step: (i) => 'Clients created in the period who reached ' + ['Qualified, and then Site visit', 'Site visit, and then Proposal', 'Proposal, and then Letter of intent', 'Letter of intent, and then Signed lease'][i] + ', divided by those who reached the first of the two. It counts progress so far, so recent clients may not have had time to move on.',
  signed: () => 'Clients who reached Signed lease in the period. ' + LC.METRICS.signed,
  earned: () => 'Brokerage on leases signed in the period: the achieved monthly rent times the unit\'s brokerage months.',
  pipeline: () => 'Expected brokerage of this agent\'s open deals times the stage probability (Qualified 10%, Site visit 25%, Proposal 45%, Letter of intent 80%), added up. Today\'s position, so it does not change with the period.',
  dqReq: () => 'Open clients whose use, size, budget and area are all captured, divided by open clients.',
  dqFu: () => 'Open clients with a next follow-up date, divided by open clients.',
  dqAct: () => 'Open clients with any timeline entry in the last 7 days, divided by open clients.',
};

/* ------------------------------------------------------------------ sample history added on state:ready */
/* Completed tasks and past handoff pickups do not exist in the seeded clients, so this adds a small, repeatable set.
   It uses its own random numbers, so it never changes the rest of the demo data. */
const PROFILE = {
  'Rohit Mohanty':      { ho: 7,  slow: 0.10, wait: [4, 13],  late: 0.10, tasks: 20, seen: 0.7 },
  'Priyanka Das':       { ho: 11, slow: 0.12, wait: [3, 12],  late: 0.14, tasks: 26, seen: 1.4 },
  'Subham Sahoo':       { ho: 10, slow: 0.32, wait: [6, 19],  late: 0.26, tasks: 24, seen: 2.6 },
  'Ananya Patnaik':     { ho: 9,  slow: 0.05, wait: [3, 11],  late: 0.08, tasks: 22, seen: 1.1 },
  'Satya Prakash Jena': { ho: 8,  slow: 0.55, wait: [9, 24],  late: 0.36, tasks: 18, seen: 20 },
};
function seedHistory() {
  const S = LC.state; if (!S) return;
  let s = 90210; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const now = Date.now(), seed = { handoffs: [], tasks: [], lastSeen: {} };
  const RULES = ['Price negotiation', 'Legal or agreement terms', 'Asks for a person', 'No good match', 'Agent not understood twice', 'Existing client'];
  const TT = [['Follow up', 'Follow up with '], ['Chase proposal', 'Chase decision from '], ['Nurture check-in', 'Check in with '], ['Confirm visit', 'Call to confirm visit for ']];
  LC.TEAM.forEach(a => {
    const p = PROFILE[a.name] || { ho: 6, slow: .2, wait: [4, 15], late: .15, tasks: 16, seen: 2 };
    for (let i = 0; i < p.ho; i++) {
      const slow = rnd() < p.slow;
      seed.handoffs.push({ agent: a.name, at: now - (1.5 + rnd() * 68) * DAY, waitMin: slow ? ri(LC.settings().slaMinutes + 2, 55) : ri(p.wait[0], p.wait[1]), rule: RULES[ri(0, RULES.length - 1)] });
    }
    for (let i = 0; i < p.tasks; i++) {
      const due = now - (0.5 + rnd() * 69) * DAY, late = rnd() < p.late, t = TT[ri(0, TT.length - 1)];
      seed.tasks.push({ agent: a.name, type: t[0], due, doneAt: late ? due + ri(1, 30) * 36e5 : due - ri(0, 16) * 36e5 });
    }
    seed.lastSeen[a.name] = now - p.seen * 36e5;
  });
  S.teamSeed = seed;
  bump();
}

/* ------------------------------------------------------------------ data version and cache */
let ver = 0, cache = new Map();
function bump() { ver++; cache = new Map(); }
['clients:changed', 'visits:changed', 'tasks:changed', 'queue:changed', 'units:changed', 'reset'].forEach(e => LC.on(e, bump));
LC.on('state:ready', seedHistory);
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

/* ------------------------------------------------------------------ building blocks */
const inW = (ts, w) => isNum(ts) && ts > w.start && ts <= w.end;
const winOf = (days, off) => { const end = Date.now() - off * days * DAY; return { start: end - days * DAY, end, days, off }; };
function reachedTs(c, stage) {
  const k = idx(stage); if (k < 0) return null; let best = null;
  (c.stageHistory || []).forEach(h => { if (idx(h.stage) >= k && (best == null || h.ts < best)) best = h.ts; });
  return best;
}
function earnedOf(c) {
  if (isNum(c.brokerage)) return c.brokerage;
  if (isNum(c.achievedPsf)) { const u = c.unitId ? LC.unit(c.unitId) : null; if (u && isNum(u.chargeable_sqft) && isNum(u.brokerage_months)) return Math.round(c.achievedPsf * u.chargeable_sqft * u.brokerage_months); }
  const u = c.unitId ? LC.unit(c.unitId) : null;
  return u && isNum(u.monthly_rent) && isNum(u.brokerage_months) ? Math.round(u.monthly_rent * u.brokerage_months) : 0;
}
function stageSince(c) { const h = c.stageHistory || []; return h.length ? h[h.length - 1].ts : c.createdAt; }
function dealExp(c) {
  return memo('deal:' + c.id, () => {
    let u = c.unitId ? LC.unit(c.unitId) : null;
    if (!u && c.req && c.req.use && LC.reqHas(c.req, 'location')) { const r = LC.match(c.req, { limit: 1 }).exact[0]; if (r) u = r.u; }
    return u && isNum(u.monthly_rent) && isNum(u.brokerage_months) ? Math.round(u.monthly_rent * u.brokerage_months) : null;
  });
}
function handoffsOf(name) {
  const S = LC.state, out = [];
  ((S.teamSeed && S.teamSeed.handoffs) || []).filter(h => h.agent === name).forEach(h => out.push({ at: h.at, waitMin: h.waitMin, picked: true }));
  S.queue.filter(q => q.assignee === name).forEach(q => {
    if (q.status === 'Picked up') {
      const lead = S.leads.find(l => l.id === q.leadId);
      const w = lead && lead.handoff && isNum(lead.handoff.waited) ? lead.handoff.waited : (q.pickedAt - q.at) / 60e3;
      out.push({ at: q.at, waitMin: w, picked: true });
    } else out.push({ at: q.at, picked: false, overdue: q.slaDue < Date.now() });
  });
  return out;
}
function tasksOf(name) {
  const S = LC.state, out = [];
  ((S.teamSeed && S.teamSeed.tasks) || []).filter(t => t.agent === name).forEach(t => out.push({ due: t.due, doneAt: t.doneAt }));
  S.tasks.filter(t => t.assignee === name && isNum(t.due)).forEach(t => out.push({ due: t.due, doneAt: t.done ? (isNum(t.doneAt) ? t.doneAt : t.due) : null }));
  return out;
}

/* ------------------------------------------------------------------ the numbers for one agent in one window */
function compute(a, days, off) {
  return memo('m:' + a.name + ':' + days + ':' + off, () => {
    const S = LC.state, w = winOf(days, off), now = Date.now(), t0 = +LC.today();
    const mine = S.clients.filter(c => c.agent === a.name), open = mine.filter(isOpen);
    const m = { a, w, mineN: mine.length, openN: open.length };
    // speed
    const cohort = mine.filter(c => inW(c.createdAt, w));
    const hum = cohort.filter(c => isNum(c.firstHumanMin)).map(c => c.firstHumanMin);
    m.cohortN = cohort.length; m.humanList = hum; m.human = hum.length ? LC.median(hum) : null; m.humanN = hum.length;
    const hos = handoffsOf(a.name).filter(h => inW(h.at, w)), sla = slaMin();
    const done = hos.filter(h => h.picked), missedWaiting = hos.filter(h => !h.picked && h.overdue);
    m.hoN = done.length + missedWaiting.length; m.hoMet = done.filter(h => h.waitMin <= sla).length; m.hoAll = hos.length;
    // follow-up discipline (today's position)
    const withFu = open.filter(c => c.nextFollowUp), over = open.filter(c => c.nextFollowUp && c.nextFollowUp < t0).sort((x, y) => x.nextFollowUp - y.nextFollowUp);
    m.fuSet = withFu.length; m.overdue = over.length; m.oldestOverdue = over.length ? Math.max(1, LC.daysAgo(LC.iso(over[0].nextFollowUp))) : 0;
    const tk = tasksOf(a.name).filter(t => inW(t.due, w));
    m.tasksOn = tk.filter(t => t.doneAt != null && t.doneAt <= t.due).length;
    m.tasksLate = tk.filter(t => (t.doneAt != null && t.doneAt > t.due) || (t.doneAt == null && t.due < now)).length;
    m.tasksN = m.tasksOn + m.tasksLate;
    // site visits
    const vs = S.visits.filter(v => v.agent === a.name && inW(v.when, w) && v.status !== 'Cancelled');
    const vDone = vs.filter(v => v.status === 'Done'), vNs = vs.filter(v => v.status === 'No-show'), vConf = vs.filter(v => v.status === 'Booked' || v.status === 'Done');
    m.vDone = vDone.length; m.vNoShow = vNs.length; m.vDue = vDone.length + vNs.length;
    m.vConfN = vConf.length; m.vConf = vConf.filter(v => v.confirmation === 'Confirmed').length;
    const rated = vDone.filter(v => isNum(v.rating)); m.ratingN = rated.length; m.rating = rated.length ? LC.sum(rated, v => v.rating) / rated.length : null;
    // conversion (clients created in the period, progress so far)
    const R = (st) => cohort.filter(c => LC.stageReached(c, st)).length;
    m.cQ = R('Qualified'); m.cV = R('Site visit'); m.cP = R('Proposal'); m.cL = R('Letter of intent'); m.cS = R('Signed lease');
    m.steps = [[m.cQ, m.cV], [m.cV, m.cP], [m.cP, m.cL], [m.cL, m.cS]].map(([d, n]) => ({ d, n, rate: d > 0 ? n / d : null }));
    // revenue
    const signed = mine.filter(c => inW(reachedTs(c, 'Signed lease'), w));
    m.signed = signed.length; m.earned = LC.sum(signed, earnedOf);
    m.proposals = mine.filter(c => inW(reachedTs(c, 'Proposal'), w)).length;
    m.pipeline = LC.sum(mine.filter(c => STAGE_P[c.stage]), c => (dealExp(c) || 0) * STAGE_P[c.stage]);
    m.pipelineN = mine.filter(c => STAGE_P[c.stage] && isNum(dealExp(c))).length;
    // data quality (today's position)
    m.dqReq = open.filter(c => LC.reqIsQualified(c.req)).length;
    m.dqAct = open.filter(c => (c.timeline || []).some(e => e.ts >= now - 7 * DAY)).length;
    return m;
  });
}

/* ------------------------------------------------------------------ scoring */
const avg = (parts) => { const p = parts.filter(x => x != null); return p.length ? Math.round(LC.sum(p) / p.length) : null; };
const pc = (n, d) => d > 0 ? Math.round(n / d * 100) : null;
/** snap = include today's position items (overdue, coverage, pipeline, data quality). The trend leaves them out on both sides. */
function sectionsOf(m, snap) {
  const days = m.w.days, short = days < 30;
  const S = [];
  // speed
  const humanS = m.human == null ? null : clamp(Math.round(100 - (m.human - TARGET.fast) / (TARGET.slow - TARGET.fast) * 100), 0, 100);
  const slaS = pc(m.hoMet, m.hoN);
  S.push({ key: 'speed', score: avg([humanS, slaS]), parts: [['First contact', humanS], ['Handoffs on time', slaS]], low: m.humanN < 3 && m.hoN < 3 });
  // follow-up
  const overS = snap && m.openN ? Math.max(0, 100 - 10 * m.overdue) : null;
  const covS = snap && m.openN ? pc(m.fuSet, m.openN) : null;
  const taskS = pc(m.tasksOn, m.tasksN);
  S.push({ key: 'follow', score: avg([overS, covS, taskS]), parts: [['No overdue', overS], ['Follow-up set', covS], ['Tasks on time', taskS]], low: m.openN < 5 && m.tasksN < 5 });
  // visits
  const confS = pc(m.vConf, m.vConfN), nsS = m.vDue ? clamp(Math.round(100 - m.vNoShow / m.vDue / TARGET.noShowZero * 100), 0, 100) : null;
  const ratS = m.rating == null ? null : Math.round((m.rating - 1) / 4 * 100);
  S.push({ key: 'visits', score: avg([confS, nsS, ratS]), parts: [['Confirmed', confS], ['Low no-shows', nsS], ['Rating', ratS]], low: m.vDue < 3 });
  // conversion
  const stepS = m.steps.map((s, i) => s.rate == null ? null : Math.min(100, Math.round(s.rate / TARGET.steps[i] * 100)));
  S.push({ key: 'conv', score: avg(stepS), parts: stepS.map((v, i) => [STEP_LABELS[i], v]), low: m.cohortN < 5 });
  // revenue
  const earnS = Math.min(100, Math.round(m.earned / (TARGET.earned30 * days / 30) * 100));
  const pipeS = snap ? Math.min(100, Math.round(m.pipeline / TARGET.pipeline * 100)) : null;
  S.push({ key: 'revenue', score: avg([earnS, pipeS]), parts: [['Earned', earnS], ['Pipeline', pipeS]], low: short });
  // data quality
  const q1 = snap && m.openN ? pc(m.dqReq, m.openN) : null, q2 = snap && m.openN ? pc(m.fuSet, m.openN) : null, q3 = snap && m.openN ? pc(m.dqAct, m.openN) : null;
  S.push({ key: 'quality', score: avg([q1, q2, q3]), parts: [['Requirement complete', q1], ['Follow-up set', q2], ['Recent activity', q3]], low: m.openN < 5 });
  S.forEach((s, i) => { s.label = SECTIONS[i].label; s.w = SECTIONS[i].w; s.rule = SECTIONS[i].rule; });
  return S;
}
function overallOf(secs) {
  const ok = secs.filter(s => isNum(s.score)); if (!ok.length) return null;
  return Math.round(LC.sum(ok, s => s.score * s.w) / LC.sum(ok, s => s.w));
}

/** one row per agent for a period */
function board(days) {
  return memo('board:' + days, () => LC.TEAM.map(a => {
    const m = compute(a, days, 0), pm = compute(a, days, 1);
    const secs = sectionsOf(m, true), score = overallOf(secs);
    const cur = overallOf(sectionsOf(m, false)), prev = pm.cohortN >= 5 ? overallOf(sectionsOf(pm, false)) : null;
    const trend = isNum(cur) && isNum(prev) ? cur - prev : null;
    return { a, m, pm, secs, score, band: band(score), trend, prevScore: prev, curScore: cur };
  }));
}

/* ------------------------------------------------------------------ small helpers for display */
function lastSignedIn(name) {
  const S = LC.state, logins = (LC.session.logins || []).filter(l => l.name === name);
  const seen = S.teamSeed && S.teamSeed.lastSeen ? S.teamSeed.lastSeen[name] : null;
  const real = logins.length ? logins[0].ts : null;
  if (LC.session.signedIn && LC.session.name === name) return 'Signed in now (since ' + LC.fmtTime(LC.session.at) + ')';
  const ts = Math.max(real || 0, seen || 0); if (!ts) return 'Not yet';
  return LC.dayLabel(ts) + ', ' + LC.fmtTime(ts) + (real && real >= (seen || 0) ? '' : ' (sample)');
}
const clientLabel = (c) => c.company || c.name;
function listsOf(a) {
  const S = LC.state, t0 = +LC.today(), now = Date.now();
  const mine = S.clients.filter(c => c.agent === a.name && isOpen(c));
  const overdue = mine.filter(c => c.nextFollowUp && c.nextFollowUp < t0).sort((x, y) => x.nextFollowUp - y.nextFollowUp);
  const stuck = mine.map(c => ({ c, days: Math.floor((now - stageSince(c)) / DAY) })).filter(x => x.days > 10).sort((x, y) => y.days - x.days);
  const pending = S.visits.filter(v => v.agent === a.name && v.status === 'Booked' && v.when >= t0 && v.confirmation !== 'Confirmed').sort((x, y) => x.when - y.when);
  return { overdue, stuck, pending };
}
function weekly(a) {
  const S = LC.state, now = Date.now(), out = [];
  for (let i = 9; i >= 0; i--) {
    const w = { start: now - (i + 1) * 7 * DAY, end: now - i * 7 * DAY };
    out.push({ start: w.start, visits: S.visits.filter(v => v.agent === a.name && v.status === 'Done' && inW(v.when, w)).length, signed: S.clients.filter(c => c.agent === a.name && inW(reachedTs(c, 'Signed lease'), w)).length });
  }
  return out;
}
function chartHtml(a) {
  const W = weekly(a), top = Math.max(1, ...W.map(x => Math.max(x.visits, x.signed)));
  const base = 112, hmax = 78, slot = 36, bw = 13;
  let g = '<line class="ax" x1="0" y1="' + base + '" x2="360" y2="' + base + '"/>';
  W.forEach((x, i) => {
    const x0 = i * slot + 4, h1 = Math.round(x.visits / top * hmax), h2 = Math.round(x.signed / top * hmax);
    if (x.visits) g += '<rect x="' + x0 + '" y="' + (base - h1) + '" width="' + bw + '" height="' + h1 + '" rx="2" fill="var(--brand)"/><text class="lbl" x="' + (x0 + bw / 2) + '" y="' + (base - h1 - 4) + '" text-anchor="middle">' + x.visits + '</text>';
    if (x.signed) g += '<rect x="' + (x0 + bw + 2) + '" y="' + (base - h2) + '" width="' + bw + '" height="' + h2 + '" rx="2" fill="var(--s2)"/><text class="lbl" x="' + (x0 + bw + 2 + bw / 2) + '" y="' + (base - h2 - 4) + '" text-anchor="middle">' + x.signed + '</text>';
  });
  g += '<text x="4" y="130" text-anchor="start">' + esc(LC.fmtDate(W[0].start + 1)) + '</text><text x="' + (4 * slot + 20) + '" y="130" text-anchor="middle">' + esc(LC.fmtDate(W[4].start + 1)) + '</text><text x="356" y="130" text-anchor="end">This week</text>';
  const label = 'Weekly counts for ' + a.name + ' over the last 10 weeks, oldest first. Visits done: ' + W.map(x => x.visits).join(', ') + '. Leases signed: ' + W.map(x => x.signed).join(', ') + '.';
  return '<svg class="chart tm-chart" viewBox="0 0 360 138" role="img" aria-label="' + esc(label) + '">' + g + '</svg>' +
    '<div class="legend"><span><i style="background:var(--brand)"></i>Visits done</span><span><i style="background:var(--s2)"></i>Leases signed</span><span>Each pair is one week, oldest on the left.</span></div>';
}

/* ------------------------------------------------------------------ strengths and focus (plain rules) */
function insights(row, rows) {
  const m = row.m, good = [], focus = [], sla = slaMin();
  const fastest = rows.filter(r => isNum(r.m.human) && r.m.humanN >= 3).sort((x, y) => x.m.human - y.m.human)[0];
  if (fastest && fastest.a.name === m.a.name) good.push([90, 'Fastest first contact on the team: ' + fMin(m.human) + '.']);
  else if (isNum(m.human) && m.humanN >= 3 && m.human <= TARGET.fast) good.push([70, 'First contact is inside ' + TARGET.fast + ' minutes (median ' + fMin(m.human) + ').']);
  if (m.hoN >= 3 && m.hoMet / m.hoN >= 0.9) good.push([85, m.hoMet + ' of ' + m.hoN + ' handoffs picked up inside the ' + sla + ' minute target.']);
  if (m.openN >= 3 && m.overdue === 0) good.push([80, 'No overdue follow-ups across ' + pl(m.openN, 'open client') + '.']);
  if (m.vConfN >= 3 && m.vConf === m.vConfN) good.push([75, 'Every visit had a confirmation call (' + m.vConf + ' of ' + m.vConfN + ').']);
  if (m.ratingN >= 3 && m.rating >= 4.2) good.push([65, 'Visit ratings average ' + fRate(m.rating) + ' across ' + pl(m.ratingN, 'visit') + '.']);
  const top = rows.filter(r => r.m.earned > 0).sort((x, y) => y.m.earned - x.m.earned)[0];
  if (top && top.a.name === m.a.name) good.push([88, 'Highest brokerage on the team in this period: ' + fMoney(m.earned) + ' from ' + pl(m.signed, 'signed lease') + '.']);
  const best = m.steps[1];
  if (best.d >= 3 && best.rate >= TARGET.steps[1]) good.push([60, 'Visit to proposal is ' + fPct(best.rate) + ', at or above the ' + fPct(TARGET.steps[1]) + ' target.']);
  if (m.openN >= 5 && m.dqReq === m.openN) good.push([55, 'Every open client has a complete requirement.']);
  if (m.overdue > 0) focus.push([60 + Math.min(40, m.overdue * 8), m.overdue + ' follow-up' + (m.overdue === 1 ? '' : 's') + ' overdue, oldest ' + m.oldestOverdue + ' day' + (m.oldestOverdue === 1 ? '' : 's') + ': clear these first.']);
  if (isNum(m.human) && m.humanN >= 3 && m.human > 30) focus.push([45 + Math.min(45, (m.human - 30) / 2), 'Median first contact is ' + fMin(m.human) + '. Aim for ' + TARGET.fast + ' minutes or less.']);
  if (m.hoN >= 3 && m.hoMet / m.hoN < 0.7) focus.push([70, (m.hoN - m.hoMet) + ' of ' + m.hoN + ' handoffs waited longer than the ' + sla + ' minute target.']);
  if (m.vConfN >= 3 && m.vConf / m.vConfN < 0.9) focus.push([65, (m.vConfN - m.vConf) + ' of ' + m.vConfN + ' visits had no confirmation call before the visit.']);
  if (m.vDue >= 3 && m.vNoShow / m.vDue > 0.2) focus.push([62, m.vNoShow + ' of ' + m.vDue + ' visits were no-shows. Call to confirm the day before.']);
  if (m.ratingN >= 3 && m.rating < 3.5) focus.push([50, 'Visit ratings average ' + fRate(m.rating) + '. Read the feedback and adjust the shortlist.']);
  const noFu = m.openN - m.fuSet; if (noFu > 0) focus.push([40 + Math.min(30, noFu * 6), pl(noFu, 'open client') + ' ha' + (noFu === 1 ? 's' : 've') + ' no follow-up date.']);
  const L = listsOf(m.a); if (L.stuck.length) focus.push([48 + Math.min(30, L.stuck.length * 6), pl(L.stuck.length, 'deal') + ' ha' + (L.stuck.length === 1 ? 's' : 've') + ' sat over 10 days in one stage, longest ' + L.stuck[0].days + ' days.']);
  if (m.openN >= 5 && m.dqReq / m.openN < 0.8) focus.push([42, (m.openN - m.dqReq) + ' of ' + m.openN + ' open clients have an incomplete requirement.']);
  if (m.openN >= 5 && m.dqAct / m.openN < 0.4) focus.push([38, 'Only ' + m.dqAct + ' of ' + m.openN + ' open clients had activity in the last 7 days.']);
  const weak = m.steps.map((s, i) => ({ s, i })).filter(x => x.s.d >= 4 && x.s.rate < TARGET.steps[x.i] * 0.6).sort((x, y) => x.s.rate / TARGET.steps[x.i] - y.s.rate / TARGET.steps[y.i])[0];
  if (weak) focus.push([52, STEP_LABELS[weak.i] + ' is ' + fPct(weak.s.rate) + ' (' + weak.s.n + ' of ' + weak.s.d + '), against a ' + fPct(TARGET.steps[weak.i]) + ' target.']);
  const pick = (a, n) => a.sort((x, y) => y[0] - x[0]).slice(0, n).map(x => x[1]);
  return { good: pick(good, 2), focus: pick(focus, 3) };
}

/* ------------------------------------------------------------------ view state */
const P = { days: 30, cmp: true, sort: 'score', dir: -1, more: {}, howOpen: false };
const hosts = new Set();

/* ------------------------------------------------------------------ html: pieces */
const ctlHtml = () => '<div class="tm-ctl"><div class="field"><label id="tm-lp">Period</label><div class="seg" role="group" aria-labelledby="tm-lp">' +
  [7, 30, 70].map(d => '<button type="button" data-days="' + d + '" aria-pressed="' + (P.days === d) + '">Last ' + d + ' days</button>').join('') + '</div></div>' +
  '<label class="checkline"><input type="checkbox" data-cmp ' + (P.cmp ? 'checked' : '') + '> Compare with the previous ' + P.days + ' days</label>' +
  '<span class="small muted">' + esc(LC.fmtDate(Date.now() - P.days * DAY)) + ' to ' + esc(LC.fmtDate(Date.now())) + (P.cmp ? '. Before that: ' + esc(LC.fmtDate(Date.now() - 2 * P.days * DAY)) + ' to ' + esc(LC.fmtDate(Date.now() - P.days * DAY)) : '') + '</span></div>';
const bandPill = (b) => '<span class="pill ' + b.cls + '" title="' + esc(b.def) + '">' + esc(b.label) + '</span>';
const trendHtml = (t) => !isNum(t) ? '<span class="muted" title="No earlier period with enough clients to compare against.">' + DASH + '</span>' :
  t > 0 ? '<span class="tm-up" title="Period-based score is up ' + t + ' points on the previous period.">▲ ' + t + '</span>' : t < 0 ? '<span class="tm-down" title="Period-based score is down ' + (-t) + ' points on the previous period.">▼ ' + (-t) + '</span>' : '<span class="muted" title="No change on the previous period.">0</span>';
const lowTag = (cond, why) => cond ? ' <span class="tm-low" title="' + esc(why || 'Few records, so read this with care.') + '">low n</span>' : '';
function ring(score, b) {
  const R = 34, C = 2 * Math.PI * R, d = isNum(score) ? score / 100 * C : 0;
  return '<svg class="tm-ring" viewBox="0 0 84 84" role="img" aria-label="' + esc('Overall score ' + (isNum(score) ? score + ' out of 100, ' + b.label : 'not available')) + '"><circle cx="42" cy="42" r="' + R + '" fill="none" stroke="var(--grid)" stroke-width="8"/>' +
    '<circle cx="42" cy="42" r="' + R + '" fill="none" stroke="var(--' + (b.cls || 's3') + ')" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + d.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 42 42)"/>' +
    '<text x="42" y="48" text-anchor="middle" class="tm-ring-n">' + (isNum(score) ? score : DASH) + '</text></svg>';
}
const barCls = (s) => isNum(s) ? band(s).cls || 'brand' : '';

/** inputs shown under each section: [label, value text, previous text|null, definition, snapshotOnly] */
function inputsFor(key, m, pm, showPrev) {
  const pv = (fn, snapOnly) => showPrev && pm && !snapOnly ? fn(pm) : null;
  const rate = (n, d) => d > 0 ? n / d : null;
  const x = {
    speed: [
      ['Median first contact', fMin(m.human) + lowTag(m.humanN > 0 && m.humanN < 3), pv(p => fMin(p.human)), DEF.human()],
      ['Handoffs on time', m.hoN ? m.hoMet + ' of ' + m.hoN + ' (' + fPct(m.hoMet / m.hoN) + ')' + lowTag(m.hoN < 3) : DASH + ' no data yet', pv(p => p.hoN ? fPct(p.hoMet / p.hoN) : DASH), DEF.handoffs()],
    ],
    follow: [
      ['Overdue follow-ups', fN(m.overdue) + (m.oldestOverdue ? ', oldest ' + m.oldestOverdue + ' d' : ''), null, DEF.overdue()],
      ['Open clients with a follow-up date', m.openN ? m.fuSet + ' of ' + m.openN + ' (' + fPct(m.fuSet / m.openN) + ')' : DASH, null, DEF.fuSet()],
      ['Tasks done on time', m.tasksN ? m.tasksOn + ' of ' + m.tasksN + ' (' + fPct(m.tasksOn / m.tasksN) + '), ' + m.tasksLate + ' late' : DASH + ' no data yet', pv(p => p.tasksN ? fPct(p.tasksOn / p.tasksN) : DASH), DEF.tasks()],
    ],
    visits: [
      ['Visits done', fN(m.vDone), pv(p => fN(p.vDone)), DEF.vDone()],
      ['Confirmation call before the visit', m.vConfN ? m.vConf + ' of ' + m.vConfN + ' (' + fPct(m.vConf / m.vConfN) + ')' + lowTag(m.vConfN < 3) : DASH + ' no data yet', pv(p => p.vConfN ? fPct(p.vConf / p.vConfN) : DASH), DEF.confirmed()],
      ['No-shows', m.vDue ? m.vNoShow + ' of ' + m.vDue + ' (' + fPct(m.vNoShow / m.vDue) + ')' : DASH + ' no data yet', pv(p => p.vDue ? fPct(p.vNoShow / p.vDue) : DASH), DEF.noShow()],
      ['Average rating', m.rating == null ? DASH + ' no data yet' : fRate(m.rating) + lowTag(m.ratingN < 3), pv(p => fRate(p.rating)), DEF.rating()],
    ],
    conv: m.steps.map((s, i) => [STEP_LABELS[i], s.d ? s.n + ' of ' + s.d + ' (' + fPct(s.rate) + ')' + lowTag(s.d < 4) : DASH + ' no clients yet', pv(p => p.steps[i].d ? fPct(p.steps[i].rate) : DASH), DEF.step(i)])
      .concat([['Signed leases', fN(m.cS) + ' from clients created in the period', null, DEF.signed()]]),
    revenue: [
      ['Brokerage earned', fMoney(m.earned) + ' from ' + pl(m.signed, 'signed lease'), pv(p => fMoney(p.earned)), DEF.earned()],
      ['Weighted pipeline owned', fMoney(m.pipeline) + ' across ' + pl(m.pipelineN, 'open deal'), null, DEF.pipeline()],
    ],
    quality: [
      ['Complete requirement', m.openN ? m.dqReq + ' of ' + m.openN + ' (' + fPct(m.dqReq / m.openN) + ')' : DASH, null, DEF.dqReq()],
      ['Next follow-up date set', m.openN ? m.fuSet + ' of ' + m.openN + ' (' + fPct(m.fuSet / m.openN) + ')' : DASH, null, DEF.dqFu()],
      ['Activity in the last 7 days', m.openN ? m.dqAct + ' of ' + m.openN + ' (' + fPct(m.dqAct / m.openN) + ')' : DASH, null, DEF.dqAct()],
    ],
  };
  return x[key];
}
function sectionHtml(s, m, pm, showPrev) {
  const ins = inputsFor(s.key, m, pm, showPrev);
  const has = isNum(s.score);
  return '<section class="tm-sec" aria-label="' + esc(s.label) + '"><div class="tm-sec-h"><div><h3>' + esc(s.label) + '</h3><div class="small muted">' + s.w + '% of the overall score' + lowTag(s.low && has, 'Few records behind this score, so read it with care.') + '</div></div>' +
    '<div class="tm-sc ' + barCls(s.score) + '" title="' + esc(s.label + ' score, 0 to 100') + '">' + (has ? s.score : DASH) + '</div></div>' +
    '<div class="tm-bar" aria-hidden="true"><i class="' + barCls(s.score) + '" style="width:' + (has ? s.score : 0) + '%"></i></div>' +
    (has ? '' : '<div class="small muted">No data yet in this period. This section is left out of the overall score.</div>') +
    '<dl class="tm-in">' + ins.map(r => '<div title="' + esc(r[3]) + '"><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + (r[2] != null ? '<span class="tm-prev">before: ' + r[2] + '</span>' : '') + '</dd></div>').join('') + '</dl>' +
    (s.parts.some(p => isNum(p[1])) ? '<div class="tm-parts">' + s.parts.filter(p => isNum(p[1])).map(p => '<span title="Part score, 0 to 100">' + esc(p[0]) + ' <b>' + p[1] + '</b></span>').join('') + '</div>' : '') +
    '<p class="tm-rule"><b>Rule.</b> ' + esc(s.rule) + '</p></section>';
}
function howHtml() {
  const sla = slaMin();
  return '<details class="tm-how" id="tm-how"' + (P.howOpen ? ' open' : '') + '><summary>How the score works</summary><div class="tm-how-b">' +
    '<p><b>Overall score</b> = the six section scores, each 0 to 100, weighted: Speed 20, Follow-up discipline 20, Site visits 15, Conversion 20, Revenue 15, Data quality 10 (total 100). If a section has no data yet it is left out and the others are re-weighted, so a missing number never counts as zero.</p>' +
    '<table class="tbl"><thead><tr><th>Band</th><th>Score</th></tr></thead><tbody>' + BANDS.map(b => '<tr><td>' + bandPill(b) + '</td><td>' + esc(b.def) + '</td></tr>').join('') + '</tbody></table>' +
    '<dl class="defs">' + SECTIONS.map(s => '<dt>' + esc(s.label) + ' (' + s.w + ')</dt><dd>' + esc(s.rule) + '</dd>').join('') + '</dl>' +
    '<dl class="defs"><dt>Response target (SLA)</dt><dd>' + sla + ' minutes, set in Settings and rules. A handoff counts as on time when a person picked it up inside this target.</dd>' +
    '<dt>Overdue</dt><dd>A follow-up date before today. This matches the CRM and the CEO co-pilot.</dd>' +
    '<dt>Period</dt><dd>Visits, tasks, handoffs, brokerage and first contact use the period you pick. Conversion looks at clients created in the period and how far they got. Overdue follow-ups, follow-up coverage, weighted pipeline and data quality are today\'s position.</dd>' +
    '<dt>Trend</dt><dd>The score from the period-based items only (everything except today\'s position) compared with the same score for the previous period. It shows a dash when the previous period has fewer than 5 clients for that person.</dd>' +
    '<dt>low n</dt><dd>Fewer than 3 to 5 records behind the number. One more visit or lease can move it a lot.</dd>' +
    '<dt>Short periods</dt><dd>Seven days is a small window. Revenue and conversion swing from week to week, so use 30 days or more to judge a person.</dd>' +
    '<dt>Sample history</dt><dd>Completed tasks, past handoff pickups and sign-in times before this demo session are invented sample values added to fill the history. Everything else comes from the clients, visits and tasks in the system.</dd></dl>' +
    '</div></details>';
}
function listHtml(title, items, key, a, cta) {
  const lim = P.more[key] ? 99 : 5;
  return '<section class="tm-list"><h3>' + esc(title) + ' <span class="badge-n">' + items.length + '</span></h3>' +
    (items.length ? items.slice(0, lim).map(r => '<div class="tm-li"><div class="tm-li-t"><button type="button" class="tm-link" data-client="' + esc(r.id) + '">' + esc(r.title) + '</button><div class="small muted">' + esc(r.sub) + '</div></div><div class="tm-li-r">' + r.right + '</div></div>').join('') +
      (items.length > 5 ? '<button type="button" class="btn sm" data-more="' + key + '">' + (P.more[key] ? 'Show fewer' : 'Show all ' + items.length) + '</button>' : '') : '<div class="small muted tm-none">' + esc(cta) + '</div>') + '</section>';
}

/* ------------------------------------------------------------------ html: the full report card */
function cardHtml(name) {
  const rows = board(P.days), row = rows.find(r => r.a.name === name); if (!row) return LC.empty('No such team member.');
  const a = row.a, m = row.m, pm = row.pm, b = row.band, ins = insights(row, rows), L = listsOf(a);
  const open = L;
  const overdueItems = open.overdue.map(c => ({ id: c.id, title: clientLabel(c), sub: c.stage + ' · ' + c.name + ' · due ' + LC.fmtDate(LC.iso(c.nextFollowUp)), right: '<span class="tm-late">' + Math.max(1, LC.daysAgo(LC.iso(c.nextFollowUp))) + ' d late</span>' }));
  const stuckItems = open.stuck.map(x => ({ id: x.c.id, title: clientLabel(x.c), sub: x.c.stage + ' · ' + x.c.name, right: '<span class="tm-late">' + x.days + ' days</span>' }));
  const pendItems = open.pending.map(v => { const c = LC.crm.get(v.clientId), u = LC.unit(v.unitId); return { id: v.clientId, title: c ? clientLabel(c) : v.clientId, sub: (u ? LC.unitShort(u) : v.unitId) + ' · ' + LC.dayLabel(v.when) + ' ' + LC.fmtTime(v.when), right: '<span class="pill warn">Not confirmed</span>' }; });
  const few = m.cohortN < 5 || m.openN < 5;
  const prevNote = P.cmp ? (isNum(row.trend) ? 'Trend ' + trendHtml(row.trend) + ' on the previous ' + P.days + ' days (period-based items only).' : 'No earlier period with enough clients to compare against.') : '';
  return '<div class="tm-card" data-agent="' + esc(name) + '">' + ctlHtml() +
    '<div class="tm-head"><div class="tm-id"><span class="tm-av" aria-hidden="true">' + esc(initials(a.name)) + '</span><div><h2>' + esc(a.name) + '</h2><div class="small muted">' + esc(a.role) + ' · ' + esc(a.cities.join(', ')) + ' · ' + esc(a.langs.join(', ')) + '</div></div></div>' +
    '<div class="tm-score">' + ring(row.score, b) + '<div><div>' + bandPill(b) + '</div><div class="small muted tm-trend">' + prevNote + '</div></div></div></div>' +
    '<div class="tm-meta"><div><span>Open clients</span><b>' + fN(m.openN) + '</b></div><div><span>Clients in the period</span><b>' + fN(m.cohortN) + '</b></div><div><span>Last signed in</span><b>' + esc(lastSignedIn(name)) + '</b></div><div><span>Period</span><b>Last ' + P.days + ' days</b></div></div>' +
    (few ? '<p class="tm-warn" role="note">Few records behind this card (' + fN(m.cohortN) + ' clients in the period, ' + fN(m.openN) + ' open). Small numbers move a lot, so read the scores with care.</p>' : '') +
    '<div class="tm-secs">' + row.secs.map(s => sectionHtml(s, m, pm, P.cmp)).join('') + '</div>' +
    '<div class="tm-two"><section class="tm-box"><h3>Strengths</h3>' + (ins.good.length ? '<ul class="tm-ul good">' + ins.good.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '<p class="small muted">Nothing stands out yet. More records will show it.</p>') + '</section>' +
    '<section class="tm-box"><h3>Focus</h3>' + (ins.focus.length ? '<ul class="tm-ul focus">' + ins.focus.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '<p class="small muted">Nothing needs fixing right now.</p>') + '</section></div>' +
    '<section class="tm-box"><h3>Last 10 weeks</h3>' + chartHtml(a) + '</section>' +
    '<div class="tm-lists">' + listHtml('Overdue follow-ups', overdueItems, 'o' + name, a, 'None. Every open client has a follow-up date from today onwards.') +
    listHtml('Stuck for more than 10 days in a stage', stuckItems, 's' + name, a, 'No deal has sat over 10 days in one stage.') +
    listHtml('Visits waiting for a confirmation call', pendItems, 'v' + name, a, 'Every upcoming visit is confirmed.') + '</div>' +
    '<div class="row"><button type="button" class="btn sm" data-crm="' + esc(name) + '">Open ' + (LC.session.role === 'executive' ? 'my' : esc(first(name)) + '\'s') + ' clients in the CRM</button></div>' +
    howHtml() + '</div>';
}

/* ------------------------------------------------------------------ html: leaderboard */
const COLS = [
  { k: 'name', h: 'Agent', t: 'Name, role and cities.', get: r => r.a.name, asc: true },
  { k: 'score', h: 'Overall score', t: 'Weighted score from 0 to 100. See "How the score works".', get: r => r.score },
  { k: 'signed', h: 'Signed leases', get t() { return DEF.signed(); }, r: true, get: r => r.m.signed },
  { k: 'earned', h: 'Brokerage earned', get t() { return DEF.earned(); }, r: true, get: r => r.m.earned },
  { k: 'proposals', h: 'Proposals', t: LC.METRICS.proposals, r: true, get: r => r.m.proposals },
  { k: 'visits', h: 'Visits done', t: LC.METRICS.visits, r: true, get: r => r.m.vDone },
  { k: 'v2p', h: 'Visit to proposal', get t() { return DEF.step(1); }, r: true, get: r => r.m.steps[1].rate },
  { k: 'human', h: 'First contact', get t() { return DEF.human(); }, r: true, get: r => r.m.human, asc: true },
  { k: 'sla', h: 'Handoffs on time', get t() { return DEF.handoffs(); }, r: true, get: r => r.m.hoN ? r.m.hoMet / r.m.hoN : null },
  { k: 'overdue', h: 'Overdue follow-ups', get t() { return DEF.overdue(); }, r: true, get: r => r.m.overdue, asc: true },
  { k: 'rating', h: 'Visit rating', get t() { return DEF.rating(); }, r: true, get: r => r.m.rating },
  { k: 'trend', h: 'Trend', t: 'Change in the period-based score on the previous period. Up is better.', r: true, get: r => r.trend },
];
function sortedRows() {
  const col = COLS.find(c => c.k === P.sort) || COLS[1];
  return board(P.days).slice().sort((x, y) => {
    const a = col.get(x), b = col.get(y), an = a == null || (typeof a === 'number' && !isFinite(a)), bn = b == null || (typeof b === 'number' && !isFinite(b));
    if (an && bn) return 0; if (an) return 1; if (bn) return -1;
    const c = typeof a === 'string' ? a.localeCompare(b) : a - b;
    return c * P.dir || x.a.name.localeCompare(y.a.name);
  });
}
function kpiHtml(rows) {
  const k = (l, v, d, t) => '<div class="kpi" title="' + esc(t) + '"><div class="l">' + esc(l) + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
  const M = rows.map(r => r.m), hum = M.flatMap(m => m.humanList), hoN = LC.sum(M, m => m.hoN), hoMet = LC.sum(M, m => m.hoMet);
  const scored = rows.filter(r => isNum(r.score));
  return '<div class="kpis tm-kpis">' +
    k('Team score (average)', scored.length ? Math.round(LC.sum(scored, r => r.score) / scored.length) : DASH, scored.length + ' of ' + rows.length + ' people scored', 'Simple average of the overall scores below.') +
    k('Signed leases', fN(LC.sum(M, m => m.signed)), 'in the last ' + P.days + ' days', DEF.signed()) +
    k('Brokerage earned', fMoney(LC.sum(M, m => m.earned)), 'in the last ' + P.days + ' days', DEF.earned()) +
    k('Visits done', fN(LC.sum(M, m => m.vDone)), LC.sum(M, m => m.vNoShow) + ' no-shows', LC.METRICS.visits) +
    k('Median first contact', hum.length ? fMin(LC.median(hum)) : DASH, 'across ' + pl(hum.length, 'client'), DEF.human()) +
    k('Handoffs on time', hoN ? fPct(hoMet / hoN) : DASH, hoN ? hoMet + ' of ' + hoN : 'no data yet', DEF.handoffs()) +
    k('Overdue follow-ups', fN(LC.sum(M, m => m.overdue)), 'today, across the team', DEF.overdue()) + '</div>';
}
function boardHtml() {
  const rows = sortedRows();
  const cell = (r, c) => {
    const m = r.m, pm = r.pm, pv = (t) => P.cmp && t != null ? '<div class="tm-prev1">before: ' + t + '</div>' : '';
    switch (c.k) {
      case 'name': return '<td><button type="button" class="tm-link" data-card="' + esc(r.a.name) + '">' + esc(r.a.name) + '</button><div class="small muted">' + esc(r.a.role === 'Leasing executive' ? 'Executive' : 'Manager') + ' · ' + esc(r.a.cities.join(', ')) + '</div></td>';
      case 'score': return '<td><div class="tm-scorecell"><b class="tm-big ' + (r.band.cls || '') + '">' + (isNum(r.score) ? r.score : DASH) + '</b>' + bandPill(r.band) + '</div></td>';
      case 'signed': return '<td class="r num">' + fN(m.signed) + pv(fN(pm.signed)) + '</td>';
      case 'earned': return '<td class="r num">' + fMoney(m.earned) + pv(fMoney(pm.earned)) + '</td>';
      case 'proposals': return '<td class="r num">' + fN(m.proposals) + pv(fN(pm.proposals)) + '</td>';
      case 'visits': return '<td class="r num">' + fN(m.vDone) + pv(fN(pm.vDone)) + '</td>';
      case 'v2p': return '<td class="r num">' + (m.steps[1].d ? fPct(m.steps[1].rate) + '<div class="tm-prev1">' + m.steps[1].n + ' of ' + m.steps[1].d + lowTag(m.steps[1].d < 4) + '</div>' : DASH) + (m.steps[1].d && pm.steps[1].d ? pv(fPct(pm.steps[1].rate)) : '') + '</td>';
      case 'human': return '<td class="r num">' + fMin(m.human) + lowTag(m.humanN > 0 && m.humanN < 3) + pv(isNum(pm.human) ? fMin(pm.human) : null) + '</td>';
      case 'sla': return '<td class="r num">' + (m.hoN ? fPct(m.hoMet / m.hoN) + '<div class="tm-prev1">' + m.hoMet + ' of ' + m.hoN + lowTag(m.hoN < 3) + '</div>' : DASH) + (m.hoN && pm.hoN ? pv(fPct(pm.hoMet / pm.hoN)) : '') + '</td>';
      case 'overdue': return '<td class="r num">' + (m.overdue ? '<span class="' + (m.overdue >= 4 ? 'tm-late' : '') + '">' + m.overdue + '</span>' : '0') + (m.oldestOverdue ? '<div class="tm-prev1">oldest ' + m.oldestOverdue + ' d</div>' : '') + '</td>';
      case 'rating': return '<td class="r num">' + (m.rating == null ? DASH : m.rating.toFixed(1) + lowTag(m.ratingN < 3)) + '</td>';
      case 'trend': return '<td class="r num">' + trendHtml(r.trend) + '</td>';
    }
    return '<td></td>';
  };
  return '<div class="tbl-wrap"><table class="tbl tm-lb"><caption class="sr">Leaderboard of leasing agents. Sort by any column heading.</caption><thead><tr>' + COLS.map(c => {
    const on = P.sort === c.k;
    return '<th scope="col"' + (c.r ? ' class="r"' : '') + ' title="' + esc(c.t) + '"' + (on ? ' aria-sort="' + (P.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '><button type="button" class="tm-sort" data-sort="' + c.k + '">' + esc(c.h) + (on ? (P.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
  }).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr class="click" data-card="' + esc(r.a.name) + '">' + COLS.map(c => cell(r, c)).join('') + '</tr>').join('') + '</tbody></table></div>';
}

/* ------------------------------------------------------------------ mounting and events */
function wire(el) {
  if (el._tmBound) return; el._tmBound = true;
  el.addEventListener('click', (e) => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-days]'))) { P.days = +b.dataset.days; repaintAll(); return; }
    if ((b = t.closest('[data-sort]'))) { const k = b.dataset.sort; if (P.sort === k) P.dir = -P.dir; else { P.sort = k; P.dir = (COLS.find(c => c.k === k) || {}).asc ? 1 : -1; } repaintAll(); return; }
    if ((b = t.closest('[data-client]'))) { LC.openClient && LC.openClient(b.dataset.client); return; }
    if ((b = t.closest('[data-more]'))) { P.more[b.dataset.more] = !P.more[b.dataset.more]; repaintAll(); return; }
    if ((b = t.closest('[data-crm]'))) { LC.closeDrawer(); LC.go('crm', { agent: b.dataset.crm }); return; }
    if ((b = t.closest('[data-card]'))) { LC.openReportCard(b.dataset.card); return; }
  });
  el.addEventListener('change', (e) => { if (e.target.matches('[data-cmp]')) { P.cmp = e.target.checked; repaintAll(); } });
  el.addEventListener('toggle', (e) => { if (e.target.id === 'tm-how') P.howOpen = e.target.open; }, true);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-card]')) LC.openReportCard(e.target.dataset.card); });
}
function repaintAll() {
  hosts.forEach(h => { if (!h.el.isConnected) { hosts.delete(h); return; } h.paint(); });
}
function mount(el, paint) {
  const h = { el, paint: () => {
    const y = window.scrollY, dy = el.closest('.drawer-b') ? el.closest('.drawer-b').scrollTop : 0, f = document.activeElement && document.activeElement.dataset ? { d: document.activeElement.dataset.days, s: document.activeElement.dataset.sort, c: 'cmp' in (document.activeElement.dataset || {}) } : null;
    paint();
    const sc = el.closest('.drawer-b'); if (sc) sc.scrollTop = dy; else window.scrollTo(0, y);
    if (f) { const sel = f.d ? '[data-days="' + f.d + '"]' : f.s ? '[data-sort="' + f.s + '"]' : f.c ? '[data-cmp]' : null; const n = sel && LC.$(sel, el); if (n) n.focus({ preventScroll: true }); }
  } };
  hosts.forEach(x => { if (x.el === el) hosts.delete(x); });
  hosts.add(h); wire(el); h.paint(); return h;
}

const isExec = () => LC.session && LC.session.role === 'executive';
const myName = () => LC.session.name;

LC.openReportCard = (name) => {
  if (isExec()) name = myName();
  const a = LC.teamBy(name); if (!a) { LC.toast('No report card for ' + name + '.'); return; }
  const dr = LC.drawer({ title: isExec() ? 'My report card' : a.name + ': report card', sub: esc(a.role) + ' · sample data', wide: true });
  mount(dr.el, () => { dr.el.innerHTML = cardHtml(a.name); });
};

LC.registerView('team', {
  title: 'Team report cards', sub: 'How each leasing agent is doing, from the work in the system',
  render(el, param) {
    if (isExec()) {
      LC.$('#v-title').textContent = 'My report card'; LC.$('#v-sub').textContent = 'How you are doing, from the work in the system';
      mount(el, () => { el.innerHTML = cardHtml(myName()); });
      return;
    }
    mount(el, () => {
      el.innerHTML = '<div class="card"><div class="card-b tm-top"><p class="lede">Every leasing agent is scored from 0 to 100 on six things: speed, follow-up, site visits, conversion, revenue and data quality. Open any row for the full report card, the inputs behind each score and what to do next. All people, clients and figures are sample data.</p>' + ctlHtml() + '</div></div>' +
        kpiHtml(board(P.days)) +
        '<div class="card"><div class="card-h"><h2>Leaderboard</h2><span class="spacer"></span><span class="small muted">Click a heading to sort. Click a row to open the report card.</span></div>' + boardHtml() + '</div>' +
        howHtml();
    });
    if (param && param.agent) setTimeout(() => LC.openReportCard(param.agent), 0);
  },
  onHide() { hosts.forEach(h => { if (h.el.id === 'v-team') hosts.delete(h); }); },
});

let t = null;
['clients:changed', 'visits:changed', 'tasks:changed', 'queue:changed'].forEach(e => LC.on(e, () => {
  if (!hosts.size) return; clearTimeout(t);
  t = setTimeout(() => { if (LC.isActive('team') || LC._drawerClose) repaintAll(); }, 900);
}));
LC.on('session:changed', () => { hosts.forEach(h => { if (h.el.id === 'v-team') hosts.delete(h); }); });
LC.on('state:ready', () => { P.more = {}; });

/* ------------------------------------------------------------------ small public surface (used by the CEO co-pilot and tests) */
LC.team = {
  /** plain rows for a period: name, score, band, trend and the main counts */
  board: (days = 30) => board(days).map(r => ({ name: r.a.name, score: r.score, band: r.band.label, trend: r.trend, signed: r.m.signed, brokerage: r.m.earned, proposals: r.m.proposals, visits: r.m.vDone, v2p: r.m.steps[1].rate, human: r.m.human, sla: r.m.hoN ? r.m.hoMet / r.m.hoN : null, overdue: r.m.overdue, rating: r.m.rating, pipeline: r.m.pipeline, open: r.m.openN, sections: r.secs.map(s => ({ key: s.key, score: s.score })) })),
  summary: (name, days = 30) => { const r = board(days).find(x => x.a.name === name); return r ? { score: r.score, band: r.band.label, focus: insights(r, board(days)).focus[0] || null } : null; },
  period: P,
};
})();
