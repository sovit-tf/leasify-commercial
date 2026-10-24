/* =====================================================================
   Leasify Commercial demo: CRM + Site visits
   Views: 'crm', 'visits'
   Entry points: LC.openClient(clientId, tab?), LC.openBookVisit({clientId, unitId})
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc;

LC.css(`
#v-crm > *, #v-visits > * { min-width: 0; }
#crm-body { max-width: 100%; }
.crm-tabs { position: sticky; top: -16px; background: var(--surface); z-index: 3; margin: -16px -20px 0; padding: 8px 20px 0; min-height: 46px; overflow-y: hidden; }
.crm-tabs button { flex: none; }
.crm-tb { align-items: end; }
.crm-tb .field { flex: 1 1 128px; }
.crm-tb .field.grow { flex: 2 1 220px; }
.crm-tb .field.fixed { flex: 0 0 auto; }
.crm-tb .field.sortf { flex: 0 1 170px; }
.crm-sub { font-size: 12px; color: var(--muted); }
.crm-board { display: flex; gap: 10px; overflow-x: auto; align-items: flex-start; padding-bottom: 8px; max-width: 100%; }
.crm-col { flex: 0 0 254px; background: var(--surface-2); border-radius: 8px; padding: 8px; display: grid; gap: 8px; align-content: start; border: 1px solid transparent; min-width: 0; }
.crm-col.over { border-color: var(--brand); background: var(--glow); }
.crm-col.collapsed { flex-basis: 170px; }
.crm-col-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 2px 4px; font-weight: 600; font-size: 12.5px; cursor: help; }
.crm-col-h .num { font-size: 11.5px; color: var(--muted); }
.crm-col-b { display: grid; gap: 8px; max-height: 72vh; overflow-y: auto; align-content: start; }
.crm-drop { font-size: 11.5px; color: var(--muted); text-align: center; padding: 14px 6px; border: 1px dashed var(--border); border-radius: 6px; }
.crm-card { background: var(--surface); border: 1px solid var(--hair); border-radius: 7px; padding: 9px 10px; display: grid; gap: 5px; font-size: 12px; cursor: pointer; min-width: 0; }
.crm-card:hover { border-color: var(--brand); }
.crm-card.drag { opacity: .45; }
.crm-card b { font-weight: 600; font-size: 12.8px; overflow-wrap: anywhere; }
.crm-card .who { color: var(--muted); font-size: 11.5px; }
.crm-card .req { color: var(--fg-2); font-size: 11.5px; line-height: 1.35; }
.crm-card .foot { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.crm-card select.input { padding: 4px 6px; font-size: 11.5px; }
.crm-av { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--glow); color: var(--brand-ink); font-size: 10px; font-weight: 700; font-family: var(--f-mono); flex: none; }
.crm-chip { display: inline-block; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--surface-2); color: var(--fg-2); border: 1px solid var(--hair); white-space: nowrap; }
.crm-days { font-size: 11px; color: var(--muted); font-family: var(--f-mono); }
.crm-days.warn { color: var(--warn); background: var(--warn-bg); border-radius: 4px; padding: 0 5px; font-weight: 600; }
.crm-fu { font-size: 11px; color: var(--muted); }
.crm-fu.late { color: var(--bad); font-weight: 600; }
.crm-lost { display: grid; gap: 6px; padding-top: 6px; border-top: 1px dashed var(--border); }
.crm-lost label { font-size: 11px; font-weight: 600; color: var(--bad); }
.crm-count { font-size: 12px; color: var(--muted); }
.crm-link { border: 0; background: none; padding: 0; color: var(--brand-ink); font-weight: 600; text-align: left; cursor: pointer; font-size: inherit; }
.crm-link:hover { text-decoration: underline; }
.crm-parsed { display: grid; gap: 4px; font-size: 12.5px; background: var(--surface-2); border-radius: 6px; padding: 8px 10px; }
.crm-parsed div { display: flex; gap: 8px; justify-content: space-between; }
.crm-parsed span { color: var(--muted); }
.crm-warnbox { background: var(--warn-bg); color: var(--warn); border-radius: 6px; padding: 8px 10px; font-size: 12.5px; }
.crm-sec { display: grid; gap: 10px; }
.crm-sec h3 { font-size: 13.5px; font-weight: 600; }
.crm-sec-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.crm-acts { display: flex; gap: 8px; flex-wrap: wrap; }
.crm-ctl { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
.crm-ctl .field .row { flex-wrap: nowrap; }
.crm-box { border: 1px solid var(--hair); border-radius: 8px; padding: 12px 14px; display: grid; gap: 10px; background: var(--surface); }
.crm-box.soft { background: var(--surface-2); }
.crm-pre { margin: 0; white-space: pre-wrap; font-family: var(--f-mono); font-size: 11.5px; background: var(--surface-2); border: 1px solid var(--hair); border-radius: 6px; padding: 10px 12px; line-height: 1.5; }
.crm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px 18px; }
.crm-grid div { display: grid; gap: 1px; min-width: 0; }
.crm-grid span { font-size: 11px; color: var(--muted); }
.crm-grid b { font-weight: 500; font-size: 13px; overflow-wrap: anywhere; }
.crm-hist { display: grid; gap: 10px; }
.crm-hist-i { border: 1px solid var(--hair); border-radius: 8px; padding: 10px 12px; display: grid; gap: 6px; }
.crm-hist-h { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; font-size: 12px; color: var(--muted); }
.crm-hist-h b { color: var(--fg); font-weight: 600; }
.crm-diff { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; font-size: 13px; }
.crm-diff li b { font-weight: 600; }
.crm-diff .arrow { color: var(--brand-ink); }
.crm-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
.crm-steps li { display: grid; gap: 3px; justify-items: start; font-size: 11.5px; color: var(--muted); min-width: 0; }
.crm-steps li i { display: block; width: 100%; height: 6px; border-radius: 3px; background: var(--grid); }
.crm-steps li.done i { background: var(--brand); }
.crm-steps li.cur i { background: var(--brand); box-shadow: 0 0 0 3px var(--glow); }
.crm-steps li b { font-weight: 600; color: var(--fg-2); font-size: 11.5px; }
.crm-steps li.todo b { color: var(--muted); font-weight: 500; }
.crm-steps li em { font-style: normal; font-family: var(--f-mono); font-size: 10.5px; }
.crm-tl { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.crm-tl li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--hair); font-size: 12.5px; }
.crm-ic { width: 26px; height: 26px; border-radius: 50%; background: var(--glow); color: var(--brand-ink); display: grid; place-items: center; }
.crm-ic svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.crm-tl .meta { font-size: 11px; color: var(--muted); font-family: var(--f-mono); }
.crm-match { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--hair); }
.crm-score { width: 42px; height: 42px; border-radius: 50%; border: 3px solid var(--brand); display: grid; place-items: center; font-family: var(--f-mono); font-weight: 600; font-size: 13px; }
.crm-score.lo { border-color: var(--warn); }
.crm-task { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--hair); font-size: 12.5px; }
.crm-task.done { opacity: .6; }
.crm-task.done .t { text-decoration: line-through; }
.crm-late { color: var(--bad); font-weight: 600; }
.crm-slots { display: flex; flex-wrap: wrap; gap: 6px; }
.crm-slot { border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 6px 12px; font-size: 12.5px; }
.crm-slot:hover { border-color: var(--brand); }
.crm-slot[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
/* site visits */
.vs-day { display: flex; align-items: baseline; gap: 10px; padding: 12px 18px 6px; background: var(--surface-2); border-bottom: 1px solid var(--hair); }
.vs-day b { font-family: var(--f-head); font-size: 14px; }
.vs-day span { font-size: 12px; color: var(--muted); }
.vs-row { display: grid; grid-template-columns: 74px minmax(0, 1.6fr) minmax(0, 1fr); gap: 8px 12px; padding: 12px 18px; border-bottom: 1px solid var(--hair); align-items: start; }
.vs-time { font-family: var(--f-mono); font-size: 12.5px; font-weight: 600; padding-top: 1px; }
.vs-main { display: grid; gap: 2px; min-width: 0; font-size: 13px; }
.vs-main .small { color: var(--muted); }
.vs-meta { display: grid; gap: 6px; justify-items: start; font-size: 12px; }
.vs-meta .pills { display: flex; gap: 6px; flex-wrap: wrap; }
.vs-act { display: flex; gap: 6px; flex-wrap: wrap; grid-column: 2 / -1; align-items: center; }
.vs-act:empty { display: none; }
.vs-form { grid-column: 1 / -1; background: var(--surface-2); border-radius: 8px; padding: 12px 14px; display: grid; gap: 10px; }
.vs-form .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.vs-fb { font-size: 12px; color: var(--fg-2); margin-top: 2px; }
.vs-grp { padding: 8px 18px 4px; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; color: var(--muted); display: flex; gap: 8px; align-items: center; }
.vs-grp.late { color: var(--bad); }
.vs-grp .badge-n { background: var(--surface-3); color: var(--fg-2); }
.vs-grp.late .badge-n { background: var(--bad); color: var(--bad-bg); }
.vs-task { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 8px 18px; border-bottom: 1px solid var(--hair); font-size: 12.5px; align-items: center; }
.vs-task .t { font-weight: 500; }
.vs-task .m { color: var(--muted); font-size: 11.5px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
@media (max-width: 860px) {
  .vs-row { grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 12px 16px; }
  .vs-act { grid-column: 1 / -1; }
  .crm-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 12px; }
  .crm-match { grid-template-columns: 42px minmax(0, 1fr); }
  .crm-match > :last-child { grid-column: 1 / -1; }
  .crm-task { grid-template-columns: minmax(0, 1fr); }
}
`);

/* ------------------------------------------------------------------ helpers */
const me = () => LC.state.me;
const initials = (n) => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const isOpen = (c) => !['Lost', 'Signed lease'].includes(c.stage);
const stageSince = (c) => { const h = c.stageHistory; return h && h.length ? h[h.length - 1].ts : c.createdAt; };
const daysIn = (c) => Math.floor((Date.now() - stageSince(c)) / LC.DAY);
const startToday = () => +LC.today();
const endToday = () => startToday() + LC.DAY;
const name2 = (c) => c.company || c.name;
const LOST_REASONS = ['Chose another broker', 'Budget too low for the area', 'Requirement on hold', 'Took a unit directly from owner', 'No response after 3 follow-ups', 'Location did not work'];
const cityOfClient = (c) => c.req.city || ((c.req.localities || [])[0] && LC.LOCALITIES[c.req.localities[0]] ? LC.LOCALITIES[c.req.localities[0]].city.split(' (')[0] : '');
const opts = (arr, sel, ph) => (ph != null ? '<option value="">' + esc(ph) + '</option>' : '') + arr.map(x => {
  const v = typeof x === 'string' ? x : x.v, l = typeof x === 'string' ? x : x.l;
  return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(l) + '</option>';
}).join('');
const debounce = (fn, ms) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
const typingIn = (root) => { const a = document.activeElement; return !!(a && root && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !['checkbox', 'button', 'radio'].includes(a.type)); };
const fuTs = (d, hour = 10) => +LC.parseDate(d) + hour * 36e5;
const fuLabel = (c) => {
  if (!c.nextFollowUp || !isOpen(c)) return null;
  const late = c.nextFollowUp < startToday();
  const d = LC.daysBetween(LC.today(), LC.iso(c.nextFollowUp));
  const t = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : LC.fmtDate(LC.iso(c.nextFollowUp));
  return { text: t, late };
};
function reqShort(r) {
  const p = []; if (r.use) p.push(r.use);
  const band = LC.reqSizeBand(r);
  if (r.seats && !r.sizeMin) p.push(r.seats + ' seats'); else if (band) p.push(LC.fmtNum(band[0]) + '–' + LC.fmtNum(band[1]) + ' sq ft');
  if (r.localities.length) p.push(r.localities.slice(0, 2).join(' / ')); else if (r.landmark) p.push('near ' + r.landmark.name); else if (r.city) p.push(r.city);
  return p.join(' · ') || 'No requirement yet';
}
const locLabel = (u) => u.locality === LC.cityOf(u) ? u.locality : u.locality + ', ' + LC.cityOf(u);
const spanFmt = (ms) => {
  const h = ms / 36e5; if (h < 1) return 'under 1 h'; if (h < 24) return Math.round(h) + ' h';
  const d = Math.round(ms / LC.DAY); return d + (d === 1 ? ' day' : ' days');
};

/* requirement rows: [key, label, getter -> [main, unit] | null] */
const sizeStr = (r) => (r.sizeMin && r.sizeMax) ? LC.fmtNum(r.sizeMin) + '–' + LC.fmtNum(r.sizeMax) : (r.sizeMin || r.sizeMax) ? LC.fmtNum(r.sizeMin || r.sizeMax) : null;
const REQ_ROWS = [
  ['use', 'Type of use', r => r.use ? [r.use, ''] : null],
  ['size', 'Size', r => sizeStr(r) ? [sizeStr(r), 'sq ft'] : null],
  ['seats', 'Seats', r => r.seats ? [String(r.seats), 'seats'] : null],
  ['budget', 'Budget (all-in)', r => r.budgetPsf ? ['₹' + r.budgetPsf, 'per sq ft'] : r.budgetMonthly ? [LC.fmtLakh(r.budgetMonthly), 'a month'] : null],
  ['localities', 'Area', r => r.localities.length ? [r.localities.join(', '), ''] : null],
  ['city', 'City', r => r.city ? [r.city, ''] : null],
  ['landmark', 'Near', r => r.landmark ? [r.landmark.name, ''] : null],
  ['radiusKm', 'Search radius', r => r.radiusKm ? [r.radiusKm + ' km', ''] : null],
  ['moveIn', 'Move-in', r => r.moveIn ? [LC.fmtDate(r.moveIn), ''] : null],
  ['furnishing', 'Fit-out', r => r.furnishing ? [r.furnishing, ''] : null],
  ['parking4w', 'Car parks', r => r.parking4w != null ? [String(r.parking4w), ''] : null],
  ['powerBackup', 'Power backup', r => r.powerBackup ? [r.powerBackup, ''] : null],
  ['groundFloor', 'Ground floor', r => r.groundFloor ? ['Required', ''] : null],
  ['frontageMin', 'Frontage (min)', r => r.frontageMin ? [r.frontageMin + ' ft', ''] : null],
  ['clearHeightMin', 'Clear height (min)', r => r.clearHeightMin ? [r.clearHeightMin + ' ft', ''] : null],
  ['mustHave', 'Must have', r => (r.mustHave || []).length ? [r.mustHave.join(', '), ''] : null],
  ['leaseYears', 'Lease term', r => r.leaseYears ? [r.leaseYears + ' years', ''] : null],
  ['company', 'Company (as stated)', r => r.company ? [r.company, ''] : null],
  ['contactName', 'Contact (as stated)', r => r.contactName ? [r.contactName, ''] : null],
  ['notes', 'Notes', r => r.notes ? [r.notes, ''] : null],
];
const joinVal = (v) => v ? (v[1] ? v[0] + ' ' + v[1] : v[0]) : '';
function reqDiff(from, to) {
  const out = [];
  REQ_ROWS.forEach(([k, label, get]) => {
    const a = get(from || LC.emptyReq()), b = get(to || LC.emptyReq());
    if (joinVal(a) === joinVal(b)) return;
    let text;
    if (a && b) text = (a[1] && a[1] === b[1]) ? a[0] + ' → ' + b[0] + ' ' + a[1] : joinVal(a) + ' → ' + joinVal(b);
    else if (b) text = 'added ' + joinVal(b);
    else text = 'removed (was ' + joinVal(a) + ')';
    out.push({ label, text });
  });
  return out;
}

/* timeline icons */
const IC = {
  created: '<path d="M12 5v14M5 12h14"/>',
  message: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.4A8 8 0 1 1 21 12z"/>',
  stage: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  requirement: '<path d="M4 6h16M4 12h10M4 18h6"/>',
  shared: '<path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4"/>',
  visit: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  document: '<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>',
  call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  note: '<path d="M5 4h14v12l-4 4H5zM15 20v-4h4"/>',
};
const icon = (t) => '<span class="crm-ic" title="' + esc(t) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[t] || IC.note) + '</svg></span>';

/* ------------------------------------------------------------------ shared actions */
function completeConfirmTasks(visitId) {
  LC.state.tasks.filter(t => t.visitId === visitId && !t.done).forEach(t => { t.done = true; t.doneAt = Date.now(); });
  LC.emit('tasks:changed');
}
function confirmVisit(v) {
  LC.visits.update(v.id, { confirmation: 'Confirmed' }, me());
  const u = LC.unit(v.unitId);
  LC.crm.addActivity(v.clientId, 'call', 'Confirmed the visit at ' + (u ? LC.unitShort(u) : v.unitId) + ' by phone for ' + LC.fmtDT(v.when), me());
  LC.toast('Visit confirmed on call.');
}
function cancelVisit(v, why) {
  LC.visits.update(v.id, { status: 'Cancelled' }, me());
  completeConfirmTasks(v.id);
  const u = LC.unit(v.unitId);
  LC.crm.addActivity(v.clientId, 'visit', (why || 'Visit cancelled') + ': ' + (u ? LC.unitShort(u) : v.unitId) + ', ' + LC.fmtDT(v.when), me());
}
function markLost(id, reason) {
  const c = LC.crm.get(id); if (!c) return;
  LC.crm.update(id, { lostReason: reason });
  LC.crm.moveStage(id, 'Lost', me(), reason);
  LC.toast((name2(c)) + ' marked lost: ' + reason);
}

/* =====================================================================
   CRM view
   ===================================================================== */
const F = { q: '', stage: '', agent: '', source: '', city: '', use: '', lang: '', sort: 'updated', view: 'board' };
let crmHost = null;
let lostOpen = false;
let pendingLost = null;
let dragging = false, dragDirty = false;

function filtered() {
  const q = F.q.trim().toLowerCase(), qd = q.replace(/\D/g, '');
  return LC.state.clients.filter(c => {
    if (F.stage && c.stage !== F.stage) return false;
    if (F.agent && c.agent !== F.agent) return false;
    if (F.source && c.source !== F.source) return false;
    if (F.city && cityOfClient(c) !== F.city) return false;
    if (F.use && c.req.use !== F.use) return false;
    if (F.lang && c.language !== F.lang) return false;
    if (q) {
      const hay = (c.name + ' ' + c.company).toLowerCase();
      const ph = String(c.phone || '');
      if (!(hay.includes(q) || ph.toLowerCase().includes(q) || (qd.length >= 3 && ph.replace(/\D/g, '').includes(qd)))) return false;
    }
    return true;
  });
}
function sorted(list) {
  const s = F.sort, a = list.slice();
  if (s === 'created') a.sort((x, y) => y.createdAt - x.createdAt);
  else if (s === 'followup') a.sort((x, y) => (fuLabel(x) ? x.nextFollowUp : Infinity) - (fuLabel(y) ? y.nextFollowUp : Infinity));
  else if (s === 'stagedays') a.sort((x, y) => stageSince(x) - stageSince(y));
  else a.sort((x, y) => y.updatedAt - x.updatedAt);
  return a;
}

function kpiData() {
  const cl = LC.state.clients, open = cl.filter(isOpen);
  const week = Date.now() - 7 * LC.DAY;
  const dueToday = open.filter(c => c.nextFollowUp && c.nextFollowUp >= startToday() && c.nextFollowUp < endToday());
  const overdue = open.filter(c => c.nextFollowUp && c.nextFollowUp < startToday());
  return [
    { l: 'Open clients', v: open.length, d: 'of ' + cl.length + ' in total', t: 'Clients not yet signed or lost. Nurture clients count as open.' },
    { l: 'New this week', v: cl.filter(c => c.createdAt >= week).length, d: 'created in the last 7 days', t: 'Clients created in the last 7 days, from any source.' },
    { l: 'At proposal or LOI', v: open.filter(c => ['Proposal', 'Letter of intent'].includes(c.stage)).length, d: 'close to a decision', t: LC.STAGE_DEFS['Proposal'] + ' Letter of intent: ' + LC.STAGE_DEFS['Letter of intent'] },
    { l: 'Follow-ups due today', v: dueToday.length, d: 'open clients, set for today', t: 'Open clients whose next follow-up date is today.' },
    { l: 'Overdue follow-ups', v: overdue.length, d: 'date has passed', t: 'Open clients whose next follow-up date is before today.', bad: overdue.length > 0 },
  ];
}
function kpiHtml() {
  return kpiData().map(k => '<div class="kpi" title="' + esc(k.t) + '"><div class="l">' + esc(k.l) + '</div><div class="v"' + (k.bad ? ' style="color:var(--bad)"' : '') + '>' + k.v + '</div><div class="d">' + esc(k.d) + '</div></div>').join('');
}

function cardHtml(c) {
  const fu = fuLabel(c), d = daysIn(c);
  const warn = d > 10 && LC.STAGES.indexOf(c.stage) >= 0 && c.stage !== 'Signed lease';
  const lost = pendingLost && pendingLost.id === c.id;
  return '<article class="crm-card' + '" draggable="true" data-id="' + esc(c.id) + '" tabindex="0" aria-label="' + esc(name2(c) + ', ' + c.stage) + '">' +
    '<b>' + esc(name2(c)) + '</b>' +
    '<div class="who">' + esc(c.name) + '</div>' +
    '<div class="req">' + esc(reqShort(c.req)) + '</div>' +
    '<div class="foot"><span class="crm-av" title="Agent: ' + esc(c.agent) + '">' + esc(initials(c.agent)) + '</span>' +
    '<span class="crm-days' + (warn ? ' warn' : '') + '" title="Days in the current stage' + (warn ? '. More than 10 days: check if this deal is stuck.' : '') + '">' + d + 'd in stage</span>' +
    '<span class="crm-chip" title="Lead source">' + esc(c.source) + '</span></div>' +
    '<div class="crm-fu' + (fu && fu.late ? ' late' : '') + '" title="Next follow-up">' + (fu ? 'Follow-up: ' + esc(fu.text) + (fu.late ? ' (overdue)' : '') : 'No follow-up set') + '</div>' +
    (lost ? '<div class="crm-lost"><label for="lr-' + esc(c.id) + '">Why was this client lost?</label><select class="input" id="lr-' + esc(c.id) + '" data-lost-reason>' + opts(LOST_REASONS, LOST_REASONS[0]) + '</select><div class="row"><button class="btn sm primary" type="button" data-lost-ok>Mark lost</button><button class="btn sm" type="button" data-lost-cancel>Cancel</button></div></div>'
      : '<select class="input crm-moveto" aria-label="Move ' + esc(name2(c)) + ' to another stage" data-moveto>' + opts(LC.STAGES.concat(LC.OFF_STAGES).filter(s => s !== c.stage), '', 'Move to…') + '</select>') +
    '</article>';
}
function colHtml(stage, list) {
  const def = LC.STAGE_DEFS[stage] || '';
  if (stage === 'Lost' && !lostOpen) {
    return '<section class="crm-col collapsed" data-stage="Lost" aria-label="Lost, collapsed"><div class="crm-col-h" title="' + esc(def) + '"><span>Lost</span><span class="num">' + list.length + '</span></div><div class="crm-drop">Drop a card here to mark it lost</div><button class="btn sm" type="button" data-lost-toggle>Show ' + list.length + ' lost</button></section>';
  }
  return '<section class="crm-col" data-stage="' + esc(stage) + '" aria-label="' + esc(stage) + ', ' + list.length + ' clients"><div class="crm-col-h" title="' + esc(def) + '"><span>' + esc(stage) + '</span><span class="num">' + list.length + '</span></div>' +
    (stage === 'Lost' ? '<button class="btn sm" type="button" data-lost-toggle>Hide lost</button>' : '') +
    '<div class="crm-col-b">' + (list.length ? list.map(cardHtml).join('') : '<div class="crm-drop">Nothing here</div>') + '</div></section>';
}
function boardHtml(list) {
  const by = LC.groupBy(sorted(list), c => c.stage);
  return '<div class="crm-board" id="crm-board" aria-label="Pipeline board">' + LC.STAGES.concat(LC.OFF_STAGES).map(s => colHtml(s, by[s] || [])).join('') + '</div>' +
    '<p class="note">Drag a card to another column, or use "Move to" on the card. Hover a column name to see what the stage means. A days-in-stage count turns amber after 10 days.</p>';
}
function listHtml(list) {
  const a = sorted(list);
  if (!a.length) return '<div class="card">' + LC.empty('No clients match these filters.') + '</div>';
  return '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Company</th><th>Contact</th><th>Stage</th><th>Requirement</th><th>Agent</th><th>Source</th><th>Created</th><th>Last activity</th><th>Next follow-up</th><th class="r" title="Days since the client entered the current stage">Days in stage</th></tr></thead><tbody>' +
    a.map(c => { const fu = fuLabel(c), d = daysIn(c); const warn = d > 10 && LC.STAGES.indexOf(c.stage) >= 0 && c.stage !== 'Signed lease';
      return '<tr class="click" data-id="' + esc(c.id) + '" tabindex="0"><td><b>' + esc(name2(c)) + '</b></td><td>' + esc(c.name) + '<div class="small muted">' + esc(c.phone) + '</div></td><td>' + LC.stagePill(c.stage) + '</td><td>' + esc(reqShort(c.req)) + '</td><td>' + esc(c.agent) + '</td><td>' + esc(c.source) + '</td><td>' + LC.fmtDate(LC.iso(c.createdAt)) + '</td><td>' + esc(LC.relTime(c.updatedAt)) + '</td><td' + (fu && fu.late ? ' class="crm-late"' : '') + '>' + (fu ? esc(fu.text) + (fu.late ? ' (overdue)' : '') : '–') + '</td><td class="r"><span class="crm-days' + (warn ? ' warn' : '') + '">' + d + '</span></td></tr>'; }).join('') +
    '</tbody></table></div></div>';
}

function paintBody() {
  if (!crmHost) return;
  const body = LC.$('#crm-body', crmHost); if (!body) return;
  const list = filtered();
  const cnt = LC.$('#crm-count', crmHost); if (cnt) cnt.textContent = 'Showing ' + list.length + ' of ' + LC.state.clients.length + ' clients';
  const kp = LC.$('#crm-kpis', crmHost); if (kp) kp.innerHTML = kpiHtml();
  const boardScroll = LC.$('#crm-board', body); const sl = boardScroll ? boardScroll.scrollLeft : 0;
  body.innerHTML = F.view === 'board' ? boardHtml(list) : listHtml(list);
  if (F.view === 'board') { const b = LC.$('#crm-board', body); if (b) b.scrollLeft = sl; wireBoard(body); }
  else LC.$$('tr.click', body).forEach(tr => {
    tr.addEventListener('click', () => LC.openClient(tr.dataset.id));
    tr.addEventListener('keydown', e => { if (e.key === 'Enter') LC.openClient(tr.dataset.id); });
  });
}
const repaintSoon = debounce(() => {
  if (!LC.isActive('crm') || !crmHost) return;
  if (dragging) { dragDirty = true; return; }
  if (pendingLost && typingIn(LC.$('#crm-body', crmHost))) return;
  paintBody();
}, 150);

function wireBoard(body) {
  const board = LC.$('#crm-board', body);
  board.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-lost-toggle]')) { lostOpen = !lostOpen; paintBody(); return; }
    if (t.closest('[data-lost-ok]')) {
      const card = t.closest('.crm-card'); const sel = LC.$('[data-lost-reason]', card);
      const id = card.dataset.id; pendingLost = null; markLost(id, sel.value); paintBody(); return;
    }
    if (t.closest('[data-lost-cancel]')) { pendingLost = null; paintBody(); return; }
    if (t.closest('select, button, .crm-lost')) return;
    const card = t.closest('.crm-card'); if (card) LC.openClient(card.dataset.id);
  });
  board.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('crm-card')) LC.openClient(e.target.dataset.id);
  });
  board.addEventListener('change', e => {
    const sel = e.target.closest('[data-moveto]'); if (!sel || !sel.value) return;
    const card = sel.closest('.crm-card'); moveCard(card.dataset.id, sel.value);
  });
  // drag and drop (desktop)
  LC.$$('.crm-card', board).forEach(card => {
    card.addEventListener('dragstart', e => {
      dragging = true; card.classList.add('drag');
      e.dataTransfer.setData('text/plain', card.dataset.id); e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => { dragging = false; card.classList.remove('drag'); LC.$$('.crm-col.over', board).forEach(x => x.classList.remove('over')); if (dragDirty) { dragDirty = false; repaintSoon(); } });
  });
  LC.$$('.crm-col', board).forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('over'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('over'); dragging = false;
      const id = e.dataTransfer.getData('text/plain'); if (id) moveCard(id, col.dataset.stage);
    });
  });
}
function moveCard(id, stage) {
  const c = LC.crm.get(id); if (!c || c.stage === stage) { paintBody(); return; }
  if (stage === 'Lost') { pendingLost = { id }; paintBody(); setTimeout(() => { const s = LC.$('[data-lost-reason]', crmHost); if (s) s.focus(); }, 30); return; }
  if (c.stage === 'Lost') LC.crm.update(id, { lostReason: null });
  LC.crm.moveStage(id, stage, me());
  LC.toast(name2(c) + ' moved to ' + stage + '.');
  paintBody();
}

LC.registerView('crm', {
  title: 'CRM', sub: 'Every occupier, what they need, and where they are in the deal',
  render(el, param) {
    crmHost = el; pendingLost = null;
    /* a leasing executive opens the CRM on their own clients; they can clear the filter */
    if (LC.session && LC.session.role === 'executive' && LC._crmDefaultFor !== LC.session.name) { F.agent = LC.session.name; LC._crmDefaultFor = LC.session.name; }
    else if (LC._crmDefaultFor && LC.session && LC.session.role !== 'executive') { if (F.agent === LC._crmDefaultFor) F.agent = ''; LC._crmDefaultFor = null; }
    if (param) {
      if (param.stage) F.stage = param.stage;
      if (param.agent) F.agent = param.agent;
      if (param.source) F.source = param.source;
      if (param.q != null) F.q = param.q;
      if (param.view) F.view = param.view;
    }
    const cities = Array.from(new Set(LC.state.clients.map(cityOfClient).filter(Boolean))).sort();
    el.innerHTML =
      '<div class="kpis" id="crm-kpis"></div>' +
      '<div class="card"><div class="card-b" style="display:grid;gap:12px">' +
      '<div class="toolbar crm-tb">' +
      '<div class="field grow"><label for="crm-q">Search</label><input class="input" id="crm-q" type="search" placeholder="Name, company or phone" value="' + esc(F.q) + '"></div>' +
      '<div class="field"><label for="crm-f-stage">Stage</label><select class="input" id="crm-f-stage">' + opts(LC.STAGES.concat(LC.OFF_STAGES), F.stage, 'All stages') + '</select></div>' +
      '<div class="field"><label for="crm-f-agent">Agent</label><select class="input" id="crm-f-agent">' + opts(LC.TEAM.map(t => t.name), F.agent, 'All agents') + '</select></div>' +
      '<div class="field"><label for="crm-f-source">Source</label><select class="input" id="crm-f-source">' + opts(LC.SOURCES, F.source, 'All sources') + '</select></div>' +
      '<div class="field"><label for="crm-f-city">City</label><select class="input" id="crm-f-city">' + opts(cities, F.city, 'All cities') + '</select></div>' +
      '<div class="field"><label for="crm-f-use">Use</label><select class="input" id="crm-f-use">' + opts(Object.keys(LC.USES), F.use, 'All uses') + '</select></div>' +
      '<div class="field"><label for="crm-f-lang">Language</label><select class="input" id="crm-f-lang">' + opts(LC.LANGS, F.lang, 'All languages') + '</select></div>' +
      '<div class="field sortf"><label for="crm-sort">Sort by</label><select class="input" id="crm-sort">' + opts([{ v: 'updated', l: 'Last updated' }, { v: 'created', l: 'Created' }, { v: 'followup', l: 'Next follow-up' }, { v: 'stagedays', l: 'Days in stage' }], F.sort) + '</select></div>' +
      '<div class="field fixed"><label>View</label><div class="seg" role="group" aria-label="View"><button type="button" data-view="board" aria-pressed="' + (F.view === 'board') + '">Board</button><button type="button" data-view="list" aria-pressed="' + (F.view === 'list') + '">List</button></div></div>' +
      '<div class="field fixed"><label>&nbsp;</label><button class="btn primary" type="button" id="crm-add">Add client</button></div>' +
      '</div>' +
      '<div class="between"><span class="crm-count" id="crm-count"></span><button class="btn sm" type="button" id="crm-clear">Clear filters</button></div>' +
      '</div></div>' +
      '<div id="crm-body"></div>';
    const bind = (id, key) => { const n = LC.$('#' + id, el); n.addEventListener(n.tagName === 'INPUT' ? 'input' : 'change', () => { F[key] = n.value; paintBody(); }); };
    bind('crm-q', 'q'); bind('crm-f-stage', 'stage'); bind('crm-f-agent', 'agent'); bind('crm-f-source', 'source'); bind('crm-f-city', 'city'); bind('crm-f-use', 'use'); bind('crm-f-lang', 'lang'); bind('crm-sort', 'sort');
    LC.$$('[data-view]', el).forEach(b => b.addEventListener('click', () => {
      F.view = b.dataset.view; LC.$$('[data-view]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); paintBody();
    }));
    LC.$('#crm-clear', el).addEventListener('click', () => {
      Object.assign(F, { q: '', stage: '', agent: '', source: '', city: '', use: '', lang: '' });
      ['q', 'f-stage', 'f-agent', 'f-source', 'f-city', 'f-use', 'f-lang'].forEach(k => { LC.$('#crm-' + k, el).value = ''; });
      paintBody();
    });
    LC.$('#crm-add', el).addEventListener('click', openAddClient);
    paintBody();
    if (param && param.clientId) LC.openClient(param.clientId);
  },
  onHide() { pendingLost = null; },
});
LC.on('clients:changed', repaintSoon);

/* ------------------------------------------------------------------ Add client drawer */
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function findDup(phone) {
  if (!String(phone).trim()) return null;
  const x = LC.crm.findByPhone(phone.trim()); if (x) return x;
  const d = digits(phone).slice(-10); if (d.length < 10) return null;
  return LC.state.clients.find(c => isOpen(c) && digits(c.phone).slice(-10) === d) || null;
}
function openAddClient() {
  const dr = LC.drawer({
    title: 'Add client', sub: 'A person or a call that did not come through the AI chat',
    html: '<form class="stack" id="ac-form" autocomplete="off">' +
      '<div class="grid-2"><div class="field"><label for="ac-name">Contact name</label><input class="input" id="ac-name" required></div><div class="field"><label for="ac-company">Company</label><input class="input" id="ac-company"></div></div>' +
      '<div class="field"><label for="ac-phone">Phone</label><input class="input" id="ac-phone" inputmode="tel" placeholder="+91 98765 43210"><div id="ac-dup"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="ac-source">Source</label><select class="input" id="ac-source">' + opts(LC.SOURCES, 'Phone call (IVR)') + '</select></div><div class="field"><label for="ac-lang">Language</label><select class="input" id="ac-lang">' + opts(LC.LANGS, 'English') + '</select></div></div>' +
      '<div class="field"><label for="ac-text">Paste the requirement</label><textarea class="input" id="ac-text" placeholder="For example: 2,500 sq ft office in Patia, budget ₹70 per sq ft, move in by December, 4 car parks"></textarea><div class="row"><button class="btn sm" type="button" id="ac-parse">Read requirement</button><span class="small muted">Works on call notes, WhatsApp messages and emails.</span></div></div>' +
      '<div id="ac-found"></div>' +
      '<div class="field"><label for="ac-agent">Agent</label><select class="input" id="ac-agent"></select><span class="small muted" id="ac-agent-note"></span></div>' +
      '<div class="row"><button class="btn primary" type="submit">Add client</button><button class="btn" type="button" data-x>Cancel</button></div>' +
      '</form>',
  });
  const root = dr.el; const $ = (s) => LC.$(s, root);
  let req = LC.emptyReq(), agentTouched = false;
  const agentOpts = (sel) => opts(LC.TEAM.map(t => t.name), sel);
  const setAgent = (name, note) => { $('#ac-agent').innerHTML = agentOpts(name); $('#ac-agent').value = name; $('#ac-agent-note').textContent = note || ''; };
  const autoAgent = () => {
    if (agentTouched) return;
    const dup = findDup($('#ac-phone').value);
    if (dup) setAgent(dup.agent, 'Rule H9: this number already belongs to ' + dup.agent + '.');
    else { const a = LC.crm.assignAgent(req, $('#ac-lang').value); setAgent(a, 'Picked by area, language and current workload. You can change it.'); }
  };
  setAgent(LC.crm.assignAgent(req, 'English'), 'Picked by area, language and current workload. You can change it.');
  $('#ac-agent').addEventListener('change', () => { agentTouched = true; $('#ac-agent-note').textContent = 'Set by you.'; });
  $('#ac-lang').addEventListener('change', autoAgent);
  $('#ac-phone').addEventListener('input', () => {
    const dup = findDup($('#ac-phone').value);
    $('#ac-dup').innerHTML = dup ? '<div class="crm-warnbox">This number already belongs to ' + esc(name2(dup)) + '. Rule H9 routes it to their agent. <button type="button" class="crm-link" data-open-dup="' + esc(dup.id) + '">Open ' + esc(name2(dup)) + '</button></div>' : '';
    const b = LC.$('[data-open-dup]', root); if (b) b.addEventListener('click', () => LC.openClient(b.dataset.openDup));
    autoAgent();
  });
  const parse = () => {
    const t = $('#ac-text').value.trim();
    if (!t) { req = LC.emptyReq(); $('#ac-found').innerHTML = ''; autoAgent(); return; }
    const r = LC.parseRequirement(t, null, {}); req = r.req;
    if (req.company && !$('#ac-company').value) $('#ac-company').value = req.company;
    if (req.contactName && !$('#ac-name').value) $('#ac-name').value = req.contactName;
    $('#ac-found').innerHTML = r.found.length
      ? '<div class="crm-parsed" aria-live="polite"><div class="eyebrow">What we found</div>' + r.found.map(f => '<div><span>' + esc(f.label) + '</span><b>' + esc(f.value) + '</b></div>').join('') + (r.missing.length ? '<div class="small muted" style="display:block">Still missing: ' + esc(r.missing.map(k => (LC.REQ_FIELDS.find(f => f.key === k) || {}).label || k).join(', ')) + '</div>' : '') + '</div>'
      : '<div class="crm-parsed">Nothing readable found yet. Add a use, a size, a budget or an area.</div>';
    autoAgent();
  };
  $('#ac-parse').addEventListener('click', parse);
  $('#ac-form').addEventListener('submit', e => {
    e.preventDefault();
    if (LC.$('#ac-text', root).value.trim() && !LC.$('#ac-found', root).innerHTML) parse();
    const name = $('#ac-name').value.trim(), company = $('#ac-company').value.trim();
    if (!name && !company) { LC.toast('Add a contact name or a company.'); return; }
    const c = LC.crm.add({ name: name || company, company, phone: $('#ac-phone').value.trim(), source: $('#ac-source').value, language: $('#ac-lang').value, req, agent: $('#ac-agent').value, by: me(), nextFollowUp: fuTs(LC.iso(LC.addDays(LC.today(), 1))) });
    LC.crm.setReq(c.id, req, me(), 'First enquiry');
    LC.state.consent.push({ ts: Date.now(), phone: c.phone, name: c.name, channel: 'Phone', text: 'Consent noted by ' + me() + ' when the client was added' });
    LC.toast(name2(c) + ' added. ' + c.agent + ' has the follow-up for tomorrow.');
    dr.close();
    if (LC.isActive('crm')) paintBody();
    LC.openClient(c.id);
  });
}

/* =====================================================================
   Client drawer
   ===================================================================== */
let cur = null;   // {id, tab, dr, ui}
const TABS = [['overview', 'Overview'], ['requirement', 'Requirement'], ['movement', 'Movement'], ['units', 'Units'], ['timeline', 'Timeline'], ['tasks', 'Tasks']];

function subHtml(c) {
  return LC.stagePill(c.stage) + ' <span class="muted">· ' + esc(c.name) + ' · agent ' + esc(c.agent) + '</span>';
}
LC.openClient = (id, tab) => {
  const c = LC.crm.get(id); if (!c) { LC.toast('Client not found.'); return; }
  const st = { id, tab: tab || 'overview', ui: {} };
  st.dr = LC.drawer({ title: name2(c), sub: subHtml(c), wide: true, html: '', onClose() { if (cur === st) cur = null; } });
  cur = st; paintClient(st);
};
function curAlive() { return cur && document.body.contains(cur.dr.el); }
const repaintClient = debounce(() => {
  if (!curAlive()) { cur = null; return; }
  if (typingIn(cur.dr.el)) { repaintClient(); return; }
  paintClient(cur);
}, 60);
LC.on('client:updated', id => { if (curAlive() && cur.id === id) repaintClient(); });
LC.on('visits:changed', () => { if (curAlive()) repaintClient(); });
LC.on('tasks:changed', () => { if (curAlive()) repaintClient(); });

function paintClient(st) {
  const c = LC.crm.get(st.id); if (!c) return;
  const body = st.dr.el, scroll = body.scrollTop;
  const sub = LC.$('.drawer-h .small', body.closest('.drawer')); if (sub) sub.innerHTML = subHtml(c);
  const T = { overview: tabOverview, requirement: tabRequirement, movement: tabMovement, units: tabUnits, timeline: tabTimeline, tasks: tabTasks }[st.tab](c, st);
  body.innerHTML =
    '<div class="tabs crm-tabs" role="tablist" aria-label="Client sections">' + TABS.map(([k, l]) => '<button type="button" role="tab" id="ct-' + k + '" data-tab="' + k + '" aria-selected="' + (st.tab === k) + '">' + l + '</button>').join('') + '</div>' +
    '<div role="tabpanel" aria-labelledby="ct-' + st.tab + '" style="display:grid;gap:18px">' + T.html + '</div>';
  LC.$$('[data-tab]', body).forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.tab; st.ui = {}; paintClient(st); body.scrollTop = 0; }));
  T.wire && T.wire(body, c);
  body.scrollTop = scroll;
}

/* ---- Overview ---- */
function tabOverview(c, st) {
  const consent = LC.state.consent.find(x => x.phone === c.phone);
  const lead = c.leadId && LC.state.leads.find(l => l.id === c.leadId);
  const canTerm = typeof LC.draftTermSheet === 'function';
  const closed = !isOpen(c);
  const fuIso = c.nextFollowUp ? LC.iso(c.nextFollowUp) : '';
  const unit = c.unitId && LC.unit(c.unitId);
  const kv = [
    ['Contact', c.name], ['Company', c.company || '–'], ['Phone', c.phone || '–'], ['Email', c.email || '–'],
    ['Source', c.source], ['Language', c.language],
    ['Consent', c.consent ? 'Opted in' + (consent ? ' on ' + LC.fmtDateY(LC.iso(consent.ts)) + ' (' + consent.channel + ')' : '') : 'No consent on file'],
    ['Created', LC.fmtDateY(LC.iso(c.createdAt)) + ' (' + LC.relTime(c.createdAt) + ')'],
    ['Last activity', LC.relTime(c.updatedAt)],
    ['Days in this stage', String(daysIn(c))],
  ];
  const deal = [];
  if (unit) deal.push(['Unit', '<button type="button" class="crm-link" data-unit="' + esc(unit.unit_id) + '">' + esc(LC.unitShort(unit)) + '</button>', true]);
  if (c.stage === 'Signed lease' || c.dealValueMonthly) {
    deal.push(['Deal value', c.dealValueMonthly ? LC.fmtLakh(c.dealValueMonthly) + ' a month' : '–']);
    deal.push(['Achieved rent', c.achievedPsf ? '₹' + c.achievedPsf + '/sq ft' : '–']);
    deal.push(['Brokerage', c.brokerage ? LC.fmtLakh(c.brokerage) : '–']);
  }
  if (c.stage === 'Lost' || c.lostReason) deal.push(['Lost reason', c.lostReason || '–']);
  const html =
    '<div class="crm-sec"><div class="crm-grid">' + kv.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div></div>' +
    (deal.length ? '<div class="crm-box soft"><div class="eyebrow">Deal</div><div class="crm-grid">' + deal.map(([k, v, raw]) => '<div><span>' + esc(k) + '</span><b>' + (raw ? v : esc(v)) + '</b></div>').join('') + '</div></div>' : '') +
    '<div class="crm-sec"><h3>Quick actions</h3><div class="crm-acts">' +
    '<button class="btn primary" type="button" data-act="visit">Book a visit</button>' +
    (lead ? '<button class="btn" type="button" data-act="convo">Open conversation</button>' : '') +
    '<button class="btn" type="button" data-act="match">Find matches</button>' +
    (canTerm ? '<button class="btn" type="button" data-act="term">Draft term sheet</button>' : '') +
    (c.stage !== 'Lost' ? '<button class="btn" type="button" data-act="lost">Mark lost</button>' : '') +
    '</div>' +
    (st.ui.lostOpen ? '<div class="crm-box soft"><div class="field"><label for="ov-lost">Reason</label><select class="input" id="ov-lost">' + opts(LOST_REASONS, LOST_REASONS[0]) + '</select></div><div class="row"><button class="btn primary sm" type="button" data-lost-ok>Mark lost</button><button class="btn sm" type="button" data-lost-cancel>Cancel</button></div></div>' : '') +
    (st.ui.term ? '<div class="crm-box"><div class="between"><b>Term sheet draft' + (st.ui.termUnit ? ' for ' + esc(st.ui.termUnit) : '') + '</b><div class="row"><button class="btn sm" type="button" data-term-copy>Copy</button><button class="btn sm" type="button" data-term-close>Close</button></div></div><pre class="crm-pre">' + esc(st.ui.term) + '</pre></div>' : '') +
    (st.ui.termMsg ? '<p class="note">' + esc(st.ui.termMsg) + '</p>' : '') +
    '</div>' +
    '<div class="crm-sec"><h3>Owner of the client and the deal</h3><div class="crm-ctl">' +
    '<div class="field"><label for="ov-agent">Agent</label><select class="input" id="ov-agent">' + opts(LC.TEAM.map(t => t.name), c.agent) + '</select></div>' +
    '<div class="field"><label for="ov-stage">Stage</label><select class="input" id="ov-stage">' + opts(LC.STAGES.concat(LC.OFF_STAGES), c.stage) + '</select></div>' +
    '<div class="field"><label for="ov-fu">Next follow-up</label><div class="row"><input class="input" type="date" id="ov-fu" value="' + esc(fuIso) + '"' + (closed ? ' disabled' : '') + '><button class="btn sm" type="button" id="ov-fu-save"' + (closed ? ' disabled' : '') + '>Save</button></div></div>' +
    '</div>' +
    '<div class="crm-box soft" id="ov-move" style="gap:8px"><div class="grid-2"><div class="field"><label for="ov-note">Note for the move (optional)</label><input class="input" id="ov-note" placeholder="For example: term sheet sent on email"></div><div class="field" id="ov-lost-wrap" hidden><label for="ov-lost2">Reason lost</label><select class="input" id="ov-lost2">' + opts(LOST_REASONS, LOST_REASONS[0]) + '</select></div></div><div class="row"><button class="btn primary sm" type="button" id="ov-move-go">Move stage</button><span class="small muted">' + esc(LC.STAGE_DEFS[c.stage] || '') + '</span></div></div></div>';
  return {
    html,
    wire(root) {
      const $ = (s) => LC.$(s, root);
      LC.$$('[data-unit]', root).forEach(b => b.addEventListener('click', () => LC.openUnit && LC.openUnit(b.dataset.unit)));
      $('#ov-agent').addEventListener('change', e => {
        const to = e.target.value, from = c.agent; if (to === from) return;
        LC.crm.update(c.id, { agent: to }, me());
        LC.crm.addActivity(c.id, 'note', 'Reassigned from ' + from + ' to ' + to, me());
        LC.toast('Reassigned to ' + to + '.');
      });
      $('#ov-stage').addEventListener('change', e => { $('#ov-lost-wrap').hidden = e.target.value !== 'Lost'; });
      $('#ov-move-go').addEventListener('click', () => {
        const to = $('#ov-stage').value, note = $('#ov-note').value.trim();
        if (to === c.stage) { LC.toast('Pick a different stage first.'); return; }
        if (to === 'Lost') { markLost(c.id, $('#ov-lost2').value); return; }
        if (c.stage === 'Lost') LC.crm.update(c.id, { lostReason: null });
        LC.crm.moveStage(c.id, to, me(), note);
        LC.toast('Moved to ' + to + '.');
      });
      $('#ov-fu-save').addEventListener('click', () => {
        const v = $('#ov-fu').value;
        if (!v) { LC.crm.update(c.id, { nextFollowUp: null }); LC.crm.addActivity(c.id, 'note', 'Next follow-up cleared', me()); LC.toast('Follow-up cleared.'); return; }
        LC.crm.update(c.id, { nextFollowUp: fuTs(v) }); LC.crm.addActivity(c.id, 'note', 'Next follow-up set to ' + LC.fmtDateY(v), me()); LC.toast('Follow-up set for ' + LC.fmtDate(v) + '.');
      });
      LC.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a === 'visit') LC.openBookVisit({ clientId: c.id });
        else if (a === 'convo') { LC.closeDrawer(); LC.openLead && LC.openLead(c.leadId); }
        else if (a === 'match') { LC.closeDrawer(); LC.go('match', { clientId: c.id }); }
        else if (a === 'lost') { st.ui.lostOpen = !st.ui.lostOpen; paintClient(st); }
        else if (a === 'term') {
          let uid = c.unitId; if (!uid) { const m = LC.match(c.req, { limit: 1 }); uid = m.exact[0] ? m.exact[0].u.unit_id : (m.close[0] ? m.close[0].u.unit_id : null); }
          if (!uid) { st.ui.termMsg = 'No unit to draft for yet. Find a match first.'; st.ui.term = null; }
          else { try { st.ui.term = LC.draftTermSheet(uid, c.id); st.ui.termUnit = uid; st.ui.termMsg = null; } catch (e) { st.ui.term = null; st.ui.termMsg = 'The term sheet could not be drafted: ' + e.message; } }
          paintClient(st);
        }
      }));
      const lo = $('[data-lost-ok]'); if (lo) lo.addEventListener('click', () => { st.ui.lostOpen = false; markLost(c.id, $('#ov-lost').value); });
      const lc = $('[data-lost-cancel]'); if (lc) lc.addEventListener('click', () => { st.ui.lostOpen = false; paintClient(st); });
      const tc = $('[data-term-copy]'); if (tc) tc.addEventListener('click', () => LC.copy(st.ui.term));
      const tx = $('[data-term-close]'); if (tx) tx.addEventListener('click', () => { st.ui.term = null; paintClient(st); });
    },
  };
}

/* ---- Requirement ---- */
function tabRequirement(c) {
  const rows = REQ_ROWS.map(([k, l, get]) => [l, get(c.req)]).filter(x => x[1]);
  const hist = (c.reqHistory || []).slice().sort((a, b) => b.ts - a.ts);
  const first = hist.length ? hist[hist.length - 1].from : null;
  const html =
    '<div class="crm-sec"><div class="crm-sec-h"><h3>Current requirement</h3><button class="btn sm" type="button" id="rq-edit">Edit in Requirement match</button></div>' +
    '<p class="lede">' + esc(LC.reqSummary(c.req)) + '</p>' +
    (rows.length ? '<div class="crm-grid">' + rows.map(([l, v]) => '<div><span>' + esc(l) + '</span><b>' + esc(joinVal(v)) + '</b></div>').join('') + '</div>' : LC.empty('Nothing captured yet.')) +
    '</div>' +
    '<div class="crm-sec"><h3>Requirement history</h3>' +
    (hist.length ? (first ? '<p class="note">At the first enquiry: ' + esc(LC.reqSummary(first)) + '</p>' : '') + '<div class="crm-hist">' +
      hist.map(h => { const d = reqDiff(h.from, h.to);
        return '<div class="crm-hist-i"><div class="crm-hist-h"><b>' + esc(LC.fmtDateY(LC.iso(h.ts))) + '</b><span>' + esc(h.by || '') + '</span>' + (h.why ? '<span>· ' + esc(h.why) + '</span>' : '') + '</div>' +
          (d.length ? '<ul class="crm-diff">' + d.map(x => '<li><b>' + esc(x.label) + ':</b> ' + esc(x.text) + '</li>').join('') + '</ul>' : '<div class="small muted">Wording changed, no field differs.</div>') + '</div>'; }).join('') + '</div>'
      : '<div class="crm-box soft">No changes since the first enquiry.</div>') +
    '</div>';
  return { html, wire(root) { LC.$('#rq-edit', root).addEventListener('click', () => { LC.closeDrawer(); LC.go('match', { clientId: c.id }); }); } };
}

/* ---- Movement ---- */
function tabMovement(c) {
  const sh = (c.stageHistory || []).slice().sort((a, b) => a.ts - b.ts);
  const closed = !isOpen(c);
  const end = closed && sh.length ? sh[sh.length - 1].ts : Date.now();
  const first = sh.length ? sh[0].ts : c.createdAt;
  const total = Math.max(0, Math.floor((end - first) / LC.DAY));
  const firstAt = (s) => { const h = sh.find(x => x.stage === s); return h ? LC.fmtDate(LC.iso(h.ts)) : ''; };
  const steps = '<ol class="crm-steps" aria-label="Pipeline progress">' + LC.STAGES.map((s, i) => {
    const reached = LC.stageReached(c, s), isCur = c.stage === s;
    return '<li class="' + (isCur ? 'cur' : reached ? 'done' : 'todo') + '" title="' + esc(LC.STAGE_DEFS[s]) + '"' + (isCur ? ' aria-current="step"' : '') + '><i></i><b>' + (i + 1) + '. ' + esc(s) + '</b><em>' + esc(firstAt(s) || (reached ? '' : 'not yet')) + '</em></li>';
  }).join('') + '</ol>';
  const rows = sh.map((h, i) => {
    const next = sh[i + 1]; const last = !next;
    const span = last ? (['Lost', 'Signed lease'].includes(h.stage) ? 'Closed' : spanFmt(Date.now() - h.ts) + ' so far') : spanFmt(next.ts - h.ts);
    return '<tr><td>' + LC.stagePill(h.stage) + '</td><td>' + esc(LC.fmtDT(h.ts)) + '</td><td>' + esc(span) + '</td><td>' + esc(h.by || '–') + '</td><td>' + esc(h.note || '') + '</td></tr>';
  }).join('');
  const html =
    '<div class="crm-sec"><div class="crm-sec-h"><h3>Where this client is</h3>' + LC.stagePill(c.stage) + '</div>' + steps +
    (['Nurture', 'Lost'].includes(c.stage) ? '<p class="note">' + (c.stage === 'Nurture' ? 'Parked in Nurture: ' : 'Closed as Lost: ') + esc(c.stage === 'Lost' ? (c.lostReason || LC.STAGE_DEFS.Lost) : LC.STAGE_DEFS.Nurture) + '</p>' : '') + '</div>' +
    '<div class="crm-sec"><div class="crm-sec-h"><h3>Stage history</h3><span class="small muted" title="Time from the first enquiry to now, or to the day the deal closed (signed or lost).">' + total + (total === 1 ? ' day' : ' days') + ' from enquiry ' + (closed ? 'to close' : 'to now') + '</span></div>' +
    '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Stage</th><th>Entered</th><th title="Time between entering this stage and the next move">Time in stage</th><th>Moved by</th><th>Note</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="crm-sec"><h3>What each stage means</h3><dl class="defs">' + LC.STAGES.concat(LC.OFF_STAGES).map(s => '<dt>' + esc(s) + '</dt><dd>' + esc(LC.STAGE_DEFS[s]) + '</dd>').join('') + '</dl></div>';
  return { html };
}

/* ---- Units ---- */
function tabUnits(c) {
  const unitBtn = (id) => { const u = LC.unit(id); return '<button type="button" class="crm-link" data-unit="' + esc(id) + '">' + esc(u ? LC.unitShort(u) : id) + '</button>' + (u ? '<div class="small muted">' + esc(locLabel(u)) + '</div>' : ''); };
  const shared = (c.shared || []).slice().sort((a, b) => b.ts - a.ts);
  const visits = LC.state.visits.filter(v => v.clientId === c.id).sort((a, b) => b.when - a.when);
  const m = LC.match(c.req, { limit: 3 });
  const tops = m.exact.map(r => ({ r, close: false })).concat(m.close.map(r => ({ r, close: true }))).slice(0, 3);
  const sharedIds = new Set(shared.map(s => s.unitId));
  const html =
    '<div class="crm-sec"><h3>Units shared with this client</h3>' +
    (shared.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Unit</th><th>Shared</th><th>By</th><th>Channel</th><th>Reaction</th></tr></thead><tbody>' +
      shared.map(s => '<tr><td>' + unitBtn(s.unitId) + '</td><td>' + esc(LC.fmtDT(s.ts)) + '</td><td>' + esc(s.by) + '</td><td>' + esc(s.channel) + '</td><td>' + esc(s.reaction || 'No reaction yet') + '</td></tr>').join('') + '</tbody></table></div>' : LC.empty('Nothing shared yet.')) + '</div>' +
    '<div class="crm-sec"><div class="crm-sec-h"><h3>Site visits</h3><button class="btn sm" type="button" data-book>Book a visit</button></div>' +
    (visits.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Unit</th><th>Status</th><th>Confirmation</th><th>Rating</th><th>Feedback</th></tr></thead><tbody>' +
      visits.map(v => '<tr><td>' + esc(LC.fmtDT(v.when)) + '</td><td>' + unitBtn(v.unitId) + '</td><td>' + visitStatusPill(v) + '</td><td>' + confPill(v) + '</td><td>' + (v.rating ? v.rating + ' / 5' : '–') + '</td><td>' + esc(v.feedback || '–') + '</td></tr>').join('') + '</tbody></table></div>' : LC.empty('No visits yet.')) + '</div>' +
    '<div class="crm-sec"><div class="crm-sec-h"><h3>Best matches now</h3>' + (typeof LC.shareText === 'function' && tops.length ? '<button class="btn sm" type="button" data-copy-msg>Copy WhatsApp message</button>' : '') + '</div>' +
    (tops.length ? tops.map(({ r, close }) => '<div class="crm-match"><div class="crm-score' + (close || r.score < 75 ? ' lo' : '') + '" title="Match score out of 100. Weights: ' + esc(LC.MATCH_FACTORS.map(f => f.label + ' ' + f.weight).join(', ')) + '">' + r.score + '</div><div style="min-width:0">' + unitBtn(r.u.unit_id) + '<div class="small">' + esc(LC.fmtSqft(r.u.chargeable_sqft) + ' · ₹' + r.u.all_in_per_sqft + '/sq ft all-in') + '</div><div class="small muted">' + esc(close ? 'Near miss. ' + r.why : r.why) + '</div></div><div class="row">' +
      (sharedIds.has(r.u.unit_id) ? '<span class="pill good">Shared</span>' : '<button class="btn sm primary" type="button" data-share="' + esc(r.u.unit_id) + '">Share</button>') +
      '<button class="btn sm" type="button" data-book-unit="' + esc(r.u.unit_id) + '">Book visit</button><button class="btn sm" type="button" data-unit="' + esc(r.u.unit_id) + '">Open</button></div></div>').join('')
      : LC.empty('No unit passes this requirement right now. Open Requirement match to widen it.')) +
    '<p class="note">Match score is out of 100. Weights: ' + esc(LC.MATCH_FACTORS.map(f => f.label + ' ' + f.weight + '%').join(', ')) + '. Units confirmed by the owner in the last ' + LC.settings().freshnessDays + ' days only.</p></div>';
  return {
    html,
    wire(root) {
      LC.$$('[data-unit]', root).forEach(b => b.addEventListener('click', () => LC.openUnit && LC.openUnit(b.dataset.unit)));
      LC.$$('[data-share]', root).forEach(b => b.addEventListener('click', () => { LC.crm.share(c.id, [b.dataset.share], me()); LC.toast('Shared ' + b.dataset.share + ' with ' + name2(c) + '.'); }));
      LC.$$('[data-book-unit]', root).forEach(b => b.addEventListener('click', () => LC.openBookVisit({ clientId: c.id, unitId: b.dataset.bookUnit })));
      const bk = LC.$('[data-book]', root); if (bk) bk.addEventListener('click', () => LC.openBookVisit({ clientId: c.id }));
      const cm = LC.$('[data-copy-msg]', root); if (cm) cm.addEventListener('click', () => { try { LC.copy(LC.shareText(tops.map(t => t.r.u.unit_id), c.req, c.language)); } catch (e) { LC.toast('Could not build the message.'); } });
    },
  };
}
const visitStatusPill = (v) => '<span class="pill ' + ({ Booked: 'brand', Done: 'good', 'No-show': 'bad' }[v.status] || '') + '">' + esc(v.status) + '</span>';
const confPill = (v) => '<span class="pill ' + (v.confirmation === 'Confirmed' ? 'good' : 'warn') + '" title="' + (v.confirmation === 'Confirmed' ? 'A person confirmed this visit on a call.' : 'Waiting for the confirmation call the day before.') + '">' + esc(v.confirmation) + '</span>';

/* ---- Timeline ---- */
function tabTimeline(c) {
  const items = (c.timeline || []).slice().sort((a, b) => b.ts - a.ts);
  const html =
    '<form class="crm-box" id="tl-form"><h3 style="font-size:13.5px">Add to timeline</h3><div class="grid-2"><div class="field"><label for="tl-type">Type</label><select class="input" id="tl-type">' + opts(['Call', 'WhatsApp', 'Email', 'Note', 'Meeting'], 'Call') + '</select></div><div class="field"><label for="tl-text">What happened</label><input class="input" id="tl-text" required placeholder="For example: spoke to the director, wants a second visit"></div></div><div class="row"><button class="btn primary sm" type="submit">Add to timeline</button></div></form>' +
    '<div class="crm-sec"><h3>Timeline <span class="small muted">(' + items.length + ' entries, newest first)</span></h3>' +
    (items.length ? '<ul class="crm-tl">' + items.map(e => '<li>' + icon(e.type) + '<div><div>' + esc(e.text) + '</div><div class="meta">' + esc(LC.fmtDT(e.ts)) + ' · ' + esc(e.by || '') + ' · ' + esc(e.type) + '</div></div></li>').join('') + '</ul>' : LC.empty('Nothing yet.')) + '</div>';
  return {
    html,
    wire(root) {
      LC.$('#tl-form', root).addEventListener('submit', e => {
        e.preventDefault();
        const t = LC.$('#tl-type', root).value, txt = LC.$('#tl-text', root).value.trim(); if (!txt) return;
        const map = { Call: 'call', WhatsApp: 'message', Email: 'message', Note: 'note', Meeting: 'note' };
        LC.crm.addActivity(c.id, map[t], (t === 'Note' ? '' : t + ': ') + txt, me(), { channel: t });
        LC.toast('Added to the timeline.');
      });
    },
  };
}

/* ---- Tasks ---- */
function taskRow(t, showClient) {
  const late = !t.done && t.due < startToday();
  return '<div class="crm-task' + (t.done ? ' done' : '') + '"><div style="min-width:0"><div class="t"><span class="pill">' + esc(t.type) + '</span> ' + esc(t.title) + '</div><div class="small muted">' + (t.done ? 'Done ' + esc(LC.relTime(t.doneAt || Date.now())) + ' · ' : '<span class="' + (late ? 'crm-late' : '') + '">Due ' + esc(LC.fmtDT(t.due)) + (late ? ' (overdue)' : '') + '</span> · ') + esc(t.assignee || 'Unassigned') + (t.priority === 'High' ? ' · high priority' : '') + '</div></div>' +
    (t.done ? '' : '<button class="btn sm" type="button" data-done="' + esc(t.id) + '">Complete</button>') + '</div>';
}
function tabTasks(c) {
  const all = LC.state.tasks.filter(t => t.clientId === c.id);
  const open = all.filter(t => !t.done).sort((a, b) => a.due - b.due), done = all.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const html =
    '<div class="crm-sec"><h3>Open tasks (' + open.length + ')</h3>' + (open.length ? open.map(t => taskRow(t)).join('') : LC.empty('No open tasks for this client.')) + '</div>' +
    '<form class="crm-box" id="tk-form"><h3 style="font-size:13.5px">Add a task</h3><div class="grid-2"><div class="field"><label for="tk-type">Type</label><select class="input" id="tk-type">' + opts(['Follow up', 'Call', 'Send proposal', 'Prepare documents', 'Visit preparation', 'Other'], 'Follow up') + '</select></div><div class="field"><label for="tk-title">Task</label><input class="input" id="tk-title" required placeholder="For example: send the floor plan"></div></div><div class="grid-2"><div class="field"><label for="tk-due">Due date</label><input class="input" type="date" id="tk-due" value="' + LC.iso(LC.addDays(LC.today(), 1)) + '"></div><div class="field"><label for="tk-who">Assignee</label><select class="input" id="tk-who">' + opts(LC.TEAM.map(t => t.name), c.agent) + '</select></div></div><div class="row"><button class="btn primary sm" type="submit">Add task</button></div></form>' +
    '<div class="crm-sec"><h3>Done (' + done.length + ')</h3>' + (done.length ? done.map(t => taskRow(t)).join('') : '<div class="small muted">Nothing completed yet.</div>') + '</div>';
  return {
    html,
    wire(root) {
      LC.$$('[data-done]', root).forEach(b => b.addEventListener('click', () => { LC.tasks.complete(b.dataset.done); LC.toast('Task completed.'); }));
      LC.$('#tk-form', root).addEventListener('submit', e => {
        e.preventDefault();
        const title = LC.$('#tk-title', root).value.trim(); if (!title) return;
        LC.tasks.add({ type: LC.$('#tk-type', root).value, title, due: fuTs(LC.$('#tk-due', root).value || LC.iso(LC.addDays(LC.today(), 1)), 10), clientId: c.id, assignee: LC.$('#tk-who', root).value });
        LC.crm.addActivity(c.id, 'note', 'Task added: ' + title, me());
        LC.toast('Task added.');
      });
    },
  };
}

/* =====================================================================
   Book a visit drawer
   ===================================================================== */
LC.openBookVisit = (o = {}) => {
  const back = (curAlive() && o.clientId && cur.id === o.clientId) ? cur.tab : null;
  const S = { clientId: o.clientId || '', unitId: o.unitId || '', when: null, custom: '', agent: '', agentTouched: false };
  const resched = o.rescheduleOf ? LC.visits.get(o.rescheduleOf) : null;
  const dr = LC.drawer({ title: resched ? 'Reschedule visit' : 'Book a site visit', sub: 'A person calls the day before to confirm.', html: '' });
  const clientFixed = !!o.clientId, unitFixed = !!o.unitId;
  const paint = () => {
    const c = S.clientId ? LC.crm.get(S.clientId) : null;
    if (c && !S.agentTouched) S.agent = c.agent;
    if (!S.agent) S.agent = me();
    let unitHtml;
    if (unitFixed) { const u = LC.unit(S.unitId); unitHtml = '<div class="field"><label>Unit</label><div><b>' + esc(u ? LC.unitShort(u) : S.unitId) + '</b>' + (u ? '<div class="small muted">' + esc(locLabel(u) + ' · ' + LC.fmtSqft(u.chargeable_sqft)) + '</div>' : '') + '</div></div>'; }
    else {
      let top = [];
      if (c) { const m = LC.match(c.req, { limit: 5 }); top = m.exact.concat(m.close).slice(0, 5).map(r => r.u); }
      const ids = new Set(top.map(u => u.unit_id));
      const rest = LC.state.units.filter(u => LC.isMatchable(u) && !ids.has(u.unit_id)).sort((a, b) => a.unit_id.localeCompare(b.unit_id));
      const o1 = (u) => ({ v: u.unit_id, l: LC.unitShort(u) + ' · ' + u.locality + ' · ' + LC.fmtSqft(u.chargeable_sqft) });
      unitHtml = '<div class="field"><label for="bv-unit">Unit</label><select class="input" id="bv-unit"><option value="">Choose a unit…</option>' +
        (top.length ? '<optgroup label="Best matches for this client">' + opts(top.map(o1), S.unitId) + '</optgroup>' : '') +
        '<optgroup label="All available units">' + opts(rest.map(o1), S.unitId) + '</optgroup></select></div>';
    }
    let clientHtml;
    if (clientFixed) clientHtml = '<div class="field"><label>Client</label><div><b>' + esc(c ? name2(c) : S.clientId) + '</b>' + (c ? '<div class="small muted">' + esc(c.name + ' · ' + c.phone) + '</div>' : '') + '</div></div>';
    else {
      const list = LC.state.clients.filter(isOpen).sort((a, b) => name2(a).localeCompare(name2(b)));
      clientHtml = '<div class="field"><label for="bv-client">Client</label><select class="input" id="bv-client"><option value="">Choose a client…</option>' + opts(list.map(x => ({ v: x.id, l: name2(x) + ' · ' + x.name })), S.clientId) + '</select></div>';
    }
    const slots = S.unitId ? LC.visits.slots(S.unitId) : [];
    const picked = (ts) => S.when === ts && !S.custom;
    const html =
      '<div class="stack">' + (resched ? '<div class="crm-warnbox">This moves the visit from ' + esc(LC.fmtDT(resched.when)) + '. The old booking is cancelled when you book the new time.</div>' : '') +
      clientHtml + unitHtml +
      '<div class="field"><label>Pick a time</label>' + (S.unitId ? (slots.length ? '<div class="crm-slots" role="group" aria-label="Free slots">' + slots.map(ts => '<button type="button" class="crm-slot" data-slot="' + ts + '" aria-pressed="' + picked(ts) + '">' + esc(LC.fmtDT(ts)) + '</button>').join('') + '</div>' : '<div class="small muted">No free slots in the next 4 days. Use a custom time.</div>') : '<div class="small muted">Choose a unit to see free slots.</div>') + '</div>' +
      '<div class="field"><label for="bv-custom">Or a custom time</label><input class="input" type="datetime-local" id="bv-custom" value="' + esc(S.custom) + '"></div>' +
      '<div class="field"><label for="bv-agent">Agent who will take the client</label><select class="input" id="bv-agent">' + opts(LC.TEAM.map(t => t.name), S.agent) + '</select></div>' +
      '<div class="row"><button class="btn primary" type="button" id="bv-book">Book visit</button><button class="btn" type="button" data-x>Cancel</button></div></div>';
    dr.el.innerHTML = html;
    const $ = (s) => LC.$(s, dr.el);
    const cs = $('#bv-client'); if (cs) cs.addEventListener('change', () => { S.clientId = cs.value; S.agentTouched = false; paint(); });
    const us = $('#bv-unit'); if (us) us.addEventListener('change', () => { S.unitId = us.value; S.when = null; S.custom = ''; paint(); });
    LC.$$('[data-slot]', dr.el).forEach(b => b.addEventListener('click', () => { S.when = +b.dataset.slot; S.custom = ''; paint(); }));
    $('#bv-custom').addEventListener('change', e => { S.custom = e.target.value; S.when = S.custom ? new Date(S.custom).getTime() : null; LC.$$('[data-slot]', dr.el).forEach(b => b.setAttribute('aria-pressed', 'false')); });
    $('#bv-agent').addEventListener('change', e => { S.agent = e.target.value; S.agentTouched = true; });
    LC.$$('[data-x]', dr.el).forEach(b => b.addEventListener('click', dr.close));
    $('#bv-book').addEventListener('click', () => {
      if (!S.clientId) { LC.toast('Choose a client first.'); return; }
      if (!S.unitId) { LC.toast('Choose a unit first.'); return; }
      if (!S.when || isNaN(S.when)) { LC.toast('Pick a time slot or enter a custom time.'); return; }
      if (S.when < Date.now()) { LC.toast('That time has passed. Pick a time in the future.'); return; }
      const v = LC.visits.book({ clientId: S.clientId, unitId: S.unitId, when: S.when, by: me() });
      if (S.agent && S.agent !== v.agent) {
        LC.visits.update(v.id, { agent: S.agent }, me());
        LC.state.tasks.filter(t => t.visitId === v.id).forEach(t => { t.assignee = S.agent; });
        LC.emit('tasks:changed');
      }
      if (resched && resched.status === 'Booked') cancelVisit(resched, 'Rescheduled to ' + LC.fmtDT(S.when));
      LC.toast('Visit booked. A confirmation call is on ' + v.agent + "'s list for the day before.");
      dr.close();
      if (back) LC.openClient(S.clientId, back);
    });
  };
  paint();
};

/* =====================================================================
   Site visits view
   ===================================================================== */
const V = { range: 'up', agent: '', onlyMine: true, doneFor: null, cancelFor: null, more: {} };
let visitsHost = null;

function visitKpis() {
  const vs = LC.state.visits, live = vs.filter(v => v.status !== 'Cancelled');
  const t0 = startToday(), t1 = t0 + LC.DAY;
  const today = live.filter(v => v.when >= t0 && v.when < t1).length;
  const week = live.filter(v => v.when >= t0 && v.when < t0 + 7 * LC.DAY).length;
  const upcoming = vs.filter(v => v.status === 'Booked' && v.when >= Date.now());
  const conf = upcoming.filter(v => v.confirmation === 'Confirmed').length;
  const last30 = live.filter(v => v.when >= Date.now() - 30 * LC.DAY && v.when < Date.now());
  const ns = last30.filter(v => v.status === 'No-show').length;
  const calls = LC.tasks.open().filter(t => t.type === 'Confirm visit' && t.due < t1).length;
  return [
    { l: 'Visits today', v: today, d: 'booked or done today', t: 'Visits scheduled for today, not counting cancelled ones.' },
    { l: 'Visits this week', v: week, d: 'today and the next 6 days', t: 'Visits from today to six days ahead, not counting cancelled ones.' },
    { l: 'Confirmed', v: upcoming.length ? Math.round(conf / upcoming.length * 100) + '%' : '–', d: conf + ' of ' + upcoming.length + ' upcoming', t: 'Share of upcoming booked visits that a person has confirmed on a call.' },
    { l: 'No-show rate, 30 days', v: last30.length ? LC.pct(ns / last30.length) : '–', d: ns + ' of ' + last30.length + ' visits', t: LC.METRICS.noShow + ' Counted over visits in the last 30 days, cancelled ones left out.' },
    { l: 'Confirmation calls due', v: calls, d: 'due today or overdue', t: 'Open "Confirm visit" tasks due today or earlier. A person calls the occupier the day before the visit.' },
  ];
}

function visitRow(v) {
  const c = LC.crm.get(v.clientId), u = LC.unit(v.unitId);
  const booked = v.status === 'Booked';
  let actions = '';
  if (booked) {
    if (V.cancelFor === v.id) actions = '<span class="small">Cancel this visit?</span><button class="btn sm" type="button" data-a="cancel-yes" data-id="' + v.id + '">Yes, cancel</button><button class="btn sm" type="button" data-a="cancel-no" data-id="' + v.id + '">Keep it</button>';
    else actions =
      (v.confirmation !== 'Confirmed' ? '<button class="btn sm primary" type="button" data-a="confirm" data-id="' + v.id + '">Confirmed on call</button>' : '') +
      '<button class="btn sm" type="button" data-a="done" data-id="' + v.id + '">Mark done</button>' +
      '<button class="btn sm" type="button" data-a="noshow" data-id="' + v.id + '">No-show</button>' +
      '<button class="btn sm" type="button" data-a="resched" data-id="' + v.id + '">Reschedule</button>' +
      '<button class="btn sm" type="button" data-a="cancel" data-id="' + v.id + '">Cancel</button>';
  }
  const form = V.doneFor === v.id ?
    '<form class="vs-form" data-doneform="' + v.id + '"><div class="field"><label for="df-fb-' + v.id + '">How did it go?</label><textarea class="input" id="df-fb-' + v.id + '" required placeholder="What the occupier said about the space, the rent, the layout"></textarea></div>' +
    '<div class="cols"><div class="field"><label for="df-r-' + v.id + '">Rating (1 is poor, 5 is excellent)</label><select class="input" id="df-r-' + v.id + '">' + opts(['1', '2', '3', '4', '5'], '4') + '</select></div>' +
    '<div class="field"><label for="df-n-' + v.id + '">Next step</label><select class="input" id="df-n-' + v.id + '">' + opts(['Send proposal', 'Show more units', 'Not interested'], 'Send proposal') + '</select></div>' +
    '<div class="field" data-lostwrap hidden><label for="df-l-' + v.id + '">Reason lost</label><select class="input" id="df-l-' + v.id + '">' + opts(LOST_REASONS, 'Location did not work') + '</select></div></div>' +
    '<div class="row"><button class="btn primary sm" type="submit">Save visit</button><button class="btn sm" type="button" data-a="done-cancel">Close</button><span class="small muted">Send proposal moves the client to Proposal. Not interested marks them lost.</span></div></form>' : '';
  return '<div class="vs-row" data-vid="' + v.id + '"><div class="vs-time">' + esc(LC.fmtTime(v.when)) + '</div>' +
    '<div class="vs-main"><div>' + (c ? '<button type="button" class="crm-link" data-client="' + esc(c.id) + '">' + esc(name2(c)) + '</button> <span class="muted small">' + esc(c.name) + '</span>' : '<span class="muted">Unknown client</span>') + '</div>' +
    '<div class="small">' + (u ? '<button type="button" class="crm-link" data-unit="' + esc(u.unit_id) + '">' + esc(LC.unitShort(u)) + '</button> · ' + esc(u.locality) : esc(v.unitId)) + '</div>' +
    (v.status === 'Done' && (v.feedback || v.rating) ? '<div class="vs-fb">' + (v.rating ? '<b>' + v.rating + '/5</b> ' : '') + esc(v.feedback || '') + '</div>' : '') + '</div>' +
    '<div class="vs-meta"><div><span class="muted">Agent</span> ' + esc(v.agent) + '</div><div class="pills">' + confPill(v) + visitStatusPill(v) + '</div></div>' +
    '<div class="vs-act">' + actions + '</div>' + form + '</div>';
}
function agendaHtml() {
  const t0 = startToday();
  let list = LC.state.visits.slice();
  if (V.agent) list = list.filter(v => v.agent === V.agent);
  list = V.range === 'up' ? list.filter(v => v.when >= t0 && v.when < t0 + 7 * LC.DAY).sort((a, b) => a.when - b.when)
    : list.filter(v => v.when >= t0 - 7 * LC.DAY && v.when < t0).sort((a, b) => b.when - a.when);
  if (!list.length) return LC.empty(V.range === 'up' ? 'No visits in the next 7 days' + (V.agent ? ' for ' + V.agent : '') + '.' : 'No visits in the past 7 days' + (V.agent ? ' for ' + V.agent : '') + '.');
  const groups = LC.groupBy(list, v => LC.iso(v.when));
  return Object.keys(groups).sort((a, b) => V.range === 'up' ? a.localeCompare(b) : b.localeCompare(a)).map(k => {
    const g = groups[k]; const ts = g[0].when;
    return '<div class="vs-day"><b>' + esc(LC.dayLabel(ts)) + '</b><span>' + esc(LC.fmtDateY(k)) + ' · ' + g.length + (g.length === 1 ? ' visit' : ' visits') + '</span></div>' + g.map(visitRow).join('');
  }).join('');
}
function tasksHtml() {
  let list = LC.tasks.open();
  if (V.onlyMine) list = list.filter(t => t.assignee === me());
  const t0 = startToday(), t1 = t0 + LC.DAY;
  const groups = [['overdue', 'Overdue', list.filter(t => t.due < t0), true], ['today', 'Today', list.filter(t => t.due >= t0 && t.due < t1)], ['up', 'Upcoming', list.filter(t => t.due >= t1)]];
  if (!list.length) return LC.empty(V.onlyMine ? 'Nothing open on your list. Untick "Only mine" to see the whole team.' : 'No open tasks.');
  return groups.filter(g => g[2].length).map(([key, label, items, late]) => {
    const show = V.more[key] ? items : items.slice(0, 8);
    return '<div class="vs-grp' + (late ? ' late' : '') + '">' + label + ' <span class="badge-n">' + items.length + '</span></div>' +
      show.map(t => {
        const c = t.clientId && LC.crm.get(t.clientId), u = t.unitId && LC.unit(t.unitId);
        const isConf = t.type === 'Confirm visit' && t.visitId && LC.visits.get(t.visitId);
        return '<div class="vs-task"><div><div class="t"><span class="pill">' + esc(t.type) + '</span> ' + esc(t.title) + '</div><div class="m"><span class="' + (t.due < t0 ? 'crm-late' : '') + '">Due ' + esc(LC.fmtDT(t.due)) + '</span><span>' + esc(t.assignee || 'Unassigned') + '</span>' +
          (c ? '<button type="button" class="crm-link" data-client="' + esc(c.id) + '">' + esc(name2(c)) + '</button>' : '') + (u ? '<button type="button" class="crm-link" data-unit="' + esc(u.unit_id) + '">' + esc(LC.unitShort(u)) + '</button>' : '') + '</div></div>' +
          '<button class="btn sm" type="button" data-task="' + esc(t.id) + '"' + (isConf ? ' data-conf="' + esc(t.visitId) + '" title="Marks the visit as confirmed and closes this task"' : '') + '>' + (isConf ? 'Confirmed on call' : 'Complete') + '</button></div>';
      }).join('') + (items.length > 8 ? '<div style="padding:6px 18px"><button class="btn sm" type="button" data-more="' + key + '">' + (V.more[key] ? 'Show fewer' : 'Show all ' + items.length) + '</button></div>' : '');
  }).join('');
}

function paintVisits() {
  const el = visitsHost; if (!el) return;
  const k = LC.$('#vs-kpis', el); if (k) k.innerHTML = visitKpis().map(x => '<div class="kpi" title="' + esc(x.t) + '"><div class="l">' + esc(x.l) + '</div><div class="v">' + x.v + '</div><div class="d">' + esc(x.d) + '</div></div>').join('');
  LC.$('#vs-agenda', el).innerHTML = agendaHtml();
  LC.$('#vs-tasks', el).innerHTML = tasksHtml();
  wireVisits(el);
}
function wireVisits(el) {
  LC.$$('[data-client]', el).forEach(b => b.addEventListener('click', () => LC.openClient(b.dataset.client)));
  LC.$$('[data-unit]', el).forEach(b => b.addEventListener('click', () => LC.openUnit && LC.openUnit(b.dataset.unit)));
  LC.$$('[data-more]', el).forEach(b => b.addEventListener('click', () => { V.more[b.dataset.more] = !V.more[b.dataset.more]; paintVisits(); }));
  LC.$$('[data-task]', el).forEach(b => b.addEventListener('click', () => {
    if (b.dataset.conf) { const v = LC.visits.get(b.dataset.conf); if (v) { confirmVisit(v); return; } }
    LC.tasks.complete(b.dataset.task); LC.toast('Task completed.');
  }));
  LC.$$('[data-a]', el).forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.a, v = b.dataset.id ? LC.visits.get(b.dataset.id) : null;
    if (a === 'done-cancel') { V.doneFor = null; paintVisits(); return; }
    if (!v) return;
    if (a === 'confirm') confirmVisit(v);
    else if (a === 'done') { V.doneFor = v.id; V.cancelFor = null; paintVisits(); const t = LC.$('#df-fb-' + v.id, el); if (t) t.focus(); }
    else if (a === 'noshow') {
      LC.visits.update(v.id, { status: 'No-show' }, me()); completeConfirmTasks(v.id);
      const c = LC.crm.get(v.clientId), u = LC.unit(v.unitId);
      LC.crm.addActivity(v.clientId, 'visit', 'No-show at ' + (u ? LC.unitShort(u) : v.unitId) + ' on ' + LC.fmtDT(v.when), me());
      LC.tasks.add({ type: 'Follow up', title: 'Call to rebook after no-show: ' + (c ? name2(c) : ''), due: Date.now() + 2 * 36e5, clientId: v.clientId, assignee: v.agent, priority: 'High' });
      LC.toast('Marked as no-show. A call to rebook is on ' + v.agent + "'s list.");
    }
    else if (a === 'resched') LC.openBookVisit({ clientId: v.clientId, unitId: v.unitId, rescheduleOf: v.id });
    else if (a === 'cancel') { V.cancelFor = v.id; V.doneFor = null; paintVisits(); }
    else if (a === 'cancel-no') { V.cancelFor = null; paintVisits(); }
    else if (a === 'cancel-yes') { V.cancelFor = null; cancelVisit(v, 'Visit cancelled'); LC.toast('Visit cancelled.'); }
  }));
  LC.$$('[data-doneform]', el).forEach(f => {
    const id = f.dataset.doneform;
    const nx = LC.$('#df-n-' + id, f); nx.addEventListener('change', () => { LC.$('[data-lostwrap]', f).hidden = nx.value !== 'Not interested'; });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const v = LC.visits.get(id); if (!v) return;
      const fb = LC.$('#df-fb-' + id, f).value.trim(), rating = +LC.$('#df-r-' + id, f).value, next = nx.value, lostWhy = LC.$('#df-l-' + id, f).value;
      if (!fb) { LC.toast('Add a line of feedback first.'); return; }
      V.doneFor = null;
      LC.visits.update(id, { status: 'Done', feedback: fb, rating }, me());
      completeConfirmTasks(id);
      afterVisit(v, next, lostWhy);
    });
  });
}
function afterVisit(v, next, lostWhy) {
  const c = LC.crm.get(v.clientId); if (!c) { LC.toast('Visit saved.'); return; }
  const idx = LC.STAGES.indexOf(c.stage);
  const tomorrow = fuTs(LC.iso(LC.addDays(LC.today(), 1)), 11);
  if (['Lost', 'Signed lease'].includes(c.stage)) { LC.toast('Visit saved.'); return; }
  if (next === 'Send proposal') {
    if (idx < 3) LC.crm.moveStage(c.id, 'Proposal', me(), 'After site visit: send proposal');
    LC.tasks.add({ type: 'Send proposal', title: 'Send term sheet to ' + name2(c), due: tomorrow, clientId: c.id, assignee: c.agent, priority: 'High' });
    LC.crm.update(c.id, { nextFollowUp: tomorrow });
    LC.toast('Visit saved. ' + name2(c) + ' is at Proposal and a task to send the term sheet is on ' + c.agent + "'s list.");
  } else if (next === 'Show more units') {
    LC.crm.addActivity(c.id, 'note', 'Next step after visit: show more units', me());
    LC.tasks.add({ type: 'Follow up', title: 'Share more units with ' + name2(c), due: tomorrow, clientId: c.id, assignee: c.agent });
    LC.crm.update(c.id, { nextFollowUp: tomorrow });
    LC.toast('Visit saved. A task to share more units is on ' + c.agent + "'s list.");
  } else {
    markLost(c.id, lostWhy);
  }
}

LC.registerView('visits', {
  title: 'Site visits', sub: 'Every visit confirmed by a person the day before',
  render(el) {
    visitsHost = el; V.doneFor = null; V.cancelFor = null;
    el.innerHTML =
      '<div class="kpis" id="vs-kpis"></div>' +
      '<div class="card"><div class="card-b"><p class="lede" style="max-width:none"><b>AI books the visit, a person confirms it.</b> At a US leasing operation we worked with, AI-only bookings had over 70% no-shows; with a person confirming, under 20%.</p></div></div>' +
      '<div class="split"><div class="card"><div class="card-h"><h2>Agenda</h2><div class="spacer"></div>' +
      '<div class="seg" role="group" aria-label="Range"><button type="button" data-range="up" aria-pressed="' + (V.range === 'up') + '">Upcoming 7 days</button><button type="button" data-range="past" aria-pressed="' + (V.range === 'past') + '">Past 7 days</button></div>' +
      '<div class="field" style="min-width:150px"><label class="sr" for="vs-agent" style="position:absolute;left:-9999px">Agent</label><select class="input" id="vs-agent" aria-label="Filter by agent">' + opts(LC.TEAM.map(t => t.name), V.agent, 'All agents') + '</select></div></div>' +
      '<div id="vs-agenda"></div></div>' +
      '<div class="card"><div class="card-h"><h2>My tasks</h2><div class="spacer"></div><label class="checkline"><input type="checkbox" id="vs-mine"' + (V.onlyMine ? ' checked' : '') + '> Only mine (' + esc(me()) + ')</label></div><div id="vs-tasks"></div></div></div>';
    LC.$$('[data-range]', el).forEach(b => b.addEventListener('click', () => { V.range = b.dataset.range; V.doneFor = null; V.cancelFor = null; LC.$$('[data-range]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b))); paintVisits(); }));
    LC.$('#vs-agent', el).addEventListener('change', e => { V.agent = e.target.value; paintVisits(); });
    LC.$('#vs-mine', el).addEventListener('change', e => { V.onlyMine = e.target.checked; paintVisits(); });
    paintVisits();
  },
});
const repaintVisitsSoon = debounce(() => {
  if (!LC.isActive('visits') || !visitsHost) return;
  if (typingIn(visitsHost) && document.activeElement.id !== 'vs-agent') { repaintVisitsSoon(); return; }
  paintVisits();
}, 150);
['visits:changed', 'tasks:changed', 'clients:changed'].forEach(e => LC.on(e, repaintVisitsSoon));
})();
