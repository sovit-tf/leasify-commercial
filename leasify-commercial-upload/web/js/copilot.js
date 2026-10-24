/* =====================================================================
   Leasify Commercial demo: LEASING CO-PILOT
   Plain-words questions answered from live page data (units, clients,
   visits, tasks, handoff queue). A deterministic router handles the known
   questions. Claude (LC.ai.sample) is an optional extra for free-form ones.
   Guardrail: answers come only from named data and written definitions.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc;
const DAY = LC.DAY;

LC.css(`
.cp-split { align-items: start; }
.cp-chat { height: min(760px, calc(100vh - 150px)); min-height: 540px; }
.cp-chat .card-h { padding: 10px 16px; }
.cp-link { background: none; border: 0; padding: 0; margin: 0; font: inherit; font-weight: 600; color: var(--brand-ink); cursor: pointer; text-align: left; text-decoration: underline; text-decoration-color: var(--hair); text-underline-offset: 3px; }
.cp-link:hover { text-decoration-color: var(--brand); }
.cp-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.cp-lede { font-size: 12px; color: var(--muted); margin: 0; }
.cp-foot { padding: 8px 14px 12px; display: grid; gap: 4px; font-size: 11.5px; color: var(--muted); border-top: 1px solid var(--hair); }
.cp-foot .cp-guard { color: var(--fg-2); }
.cp-voice-note { color: var(--warn); }
.cp-mic[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.cp-mic svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
select.input.cp-lang { width: auto; flex: none; padding: 7px 6px; font-size: 12px; }
.cp-chat .chat-input input { flex: 1 1 auto; }
.cp-chat .chat-input .btn { flex: none; }
.cp-sug { display: grid; gap: 14px; }
.cp-sug h3 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 0 0 6px; }
.cp-sug .chip { cursor: pointer; }
.cp-typing { color: var(--muted); font-size: 12.5px; }
.msg .tbl .cp-sub { font-size: 11px; color: var(--muted); font-weight: 400; }
.msg ul.cp-list { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 13px; }
.msg .cp-tl { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 12.5px; }
.msg .cp-tl li { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 8px; }
.msg .cp-tl .w { color: var(--muted); font-size: 11.5px; }
.msg .cp-h { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 4px 0 2px; }
.msg .cp-hl td { background: var(--glow); }
@media (max-width: 760px) { .cp-chat { height: 72vh; min-height: 480px; } .msg .cp-tl li { grid-template-columns: minmax(0, 1fr); gap: 0; } }
`);

/* ------------------------------------------------------------------ helpers */
const now = () => Date.now();
const clientName = (c) => c.company || c.name;
const isOpen = (c) => !['Lost', 'Signed lease', 'Nurture'].includes(c.stage);
const firstName = (n) => String(n || '').split(' ')[0];
const lastTouch = (c) => Math.max(c.createdAt || 0, ...(c.timeline || []).map(e => e.ts || 0));
const daysSince = (ts) => Math.floor((now() - ts) / DAY);
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : (b || a + 's'));
const pill = (txt, cls, title) => '<span class="pill ' + (cls || '') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(txt) + '</span>';
const unitLink = (id) => '<button type="button" class="cp-link unit-id" data-unit="' + esc(id) + '">' + esc(id) + '</button>';
const clientLink = (c) => '<button type="button" class="cp-link" data-client="' + esc(c.id) + '">' + esc(clientName(c)) + '</button>' + (c.company ? '<div class="cp-sub small muted">' + esc(c.name) + '</div>' : '');
const startOfToday = () => +LC.today();
const dayLabelTs = (ts) => LC.fmtDate(LC.iso(ts));
const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function tbl(cols, rows, hlRow) {
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map(c => '<th' + (c.r ? ' class="r"' : '') + (c.t ? ' title="' + esc(c.t) + '"' : '') + '>' + esc(c.h) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map((r, ri) => '<tr' + (hlRow === ri ? ' class="cp-hl"' : '') + '>' + r.map((x, i) => '<td' + (cols[i].r ? ' class="r"' : '') + '>' + x + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function A(intent, lead, html, o = {}) { return Object.assign({ intent, lead, html: html || '', actions: [], src: null, units: null, client: null }, o); }
const act = (label, fn, primary) => ({ label, fn, primary });
/** call another module's entry point, guarded */
function call(name, ...args) {
  if (typeof LC[name] === 'function') return LC[name](...args);
  LC.toast('That screen is not loaded in this build.');
}
function goTo(view, param) { if (LC.views[view]) LC.go(view, param); else LC.toast('That screen is not loaded in this build.'); }

function numFrom(t, dflt, unitsRx) {
  let m = t.match(/(\d+)\s*(?:\+\s*)?(?:-|\s)?\s*(days?|weeks?)/);
  if (m) return +m[1] * (/week/.test(m[2]) ? 7 : 1);
  m = t.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(days?|weeks?)/);
  if (m) return NUMW[m[1]] * (/week/.test(m[2]) ? 7 : 1);
  if (/\b(a|one) week\b|\bweek\b/.test(t) && /(in|for|over|than|past|last) (a |the )?week/.test(t)) return 7;
  if (/\bfortnight\b/.test(t)) return 14;
  return dflt;
}
function periodOf(t) {
  if (/this month|last 30|past 30|past month|last month|30 days/.test(t)) return { days: 30, label: 'in the last 30 days' };
  if (/this week|last 7|past 7|past week|last week|7 days/.test(t)) return { days: 7, label: 'in the last 7 days' };
  if (/today/.test(t)) return { days: 1, label: 'today' };
  return null;
}
function unitIdsIn(raw) {
  const out = []; const rx = /\bLC[-\s]?0*(\d{1,3})\b/gi; let m;
  while ((m = rx.exec(raw))) { const id = 'LC-' + String(+m[1]).padStart(3, '0'); if (LC.unit(id) && !out.includes(id)) out.push(id); }
  return out;
}
let lastUnits = [], lastClient = null;
function unitsFrom(t, raw, allowThis) {
  let ids = unitIdsIn(raw);
  if (ids.length) return ids;
  if (!lastUnits.length) return [];
  const mN = t.match(/\b(?:these|those|top|the)\s+(one|two|three|four|five|\d)\b/);
  if (/\b(these|them|those|both|all of them|all three|all of these)\b/.test(t) || mN) {
    const n = mN ? (NUMW[mN[1]] || +mN[1]) : 4; return lastUnits.slice(0, Math.min(n || 4, 4));
  }
  if (/\b(first|top|best|number one|1st)\b/.test(t)) return [lastUnits[0]];
  if (/\b(second|2nd)\b/.test(t)) return lastUnits[1] ? [lastUnits[1]] : [];
  if (/\b(third|3rd)\b/.test(t)) return lastUnits[2] ? [lastUnits[2]] : [];
  if (allowThis && /\b(this|it|that)( one| unit)?\b/.test(t)) return [lastUnits[0]];
  return [];
}
const STOP = new Set(['services', 'service', 'solutions', 'private', 'limited', 'pvt', 'ltd', 'house', 'the', 'and', 'labs', 'studios', 'digital', 'clinic', 'cafe', 'agency', 'branch', 'traders', 'distributors', 'exports', 'consulting', 'software', 'insurance', 'pharmacy', 'grocery', 'restaurant', 'training', 'academy', 'coaching', 'tutorials', 'diagnostics', 'logistics', 'courier', 'organics', 'furniture', 'electronics', 'dental', 'motors', 'shipping', 'cooperative', 'bank', 'salon', 'boutique', 'opticals', 'kitchen', 'cloud', 'street', 'store', 'shop', 'office']);
function clientHits(text) {
  const tl = text.toLowerCase(); const out = [];
  LC.state.clients.forEach(c => {
    let s = 0; const comp = (c.company || '').toLowerCase(), nm = (c.name || '').toLowerCase();
    if (comp && tl.includes(comp)) s = 10;
    else if (nm && tl.includes(nm)) s = 9;
    else if (comp) {
      const toks = comp.split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w));
      const hit = toks.filter(w => new RegExp('\\b' + w + '\\b').test(tl));
      if (hit.length >= 2 || hit.some(w => w.length >= 4)) s = hit.length;
    }
    if (s) out.push({ c, s });
  });
  if (!out.length) return [];
  const top = Math.max(...out.map(x => x.s));
  return out.filter(x => x.s === top).map(x => x.c).sort((a, b) => (isOpen(b) - isOpen(a)) || (b.updatedAt - a.updatedAt));
}
function placeIn(t) {
  const locs = [];
  for (const [name, L] of Object.entries(LC.LOCALITIES)) if (L.aliases.some(a => new RegExp('\\b' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t))) locs.push(name);
  let city = null;
  if (!locs.length) for (const [c, al] of Object.entries(LC.CITIES)) if (al.some(a => t.includes(a))) { city = c; break; }
  return { localities: locs, city: locs.length ? LC.LOCALITIES[locs[0]].city.split(' (')[0] : city };
}
function agentIn(t) {
  return LC.TEAM.find(a => new RegExp('\\b' + firstName(a.name).toLowerCase() + '\\b').test(t) || t.includes(a.name.toLowerCase()));
}
const STAGE_RANK = (s) => LC.STAGES.indexOf(s);

/* ------------------------------------------------------------------ term sheet */
LC.draftTermSheet = (unitId, clientId) => {
  const u = LC.unit(unitId); if (!u) return '';
  const c = clientId ? LC.crm.get(clientId) : null;
  const tbc = '[to be confirmed]';
  const R = LC.fmtINR;
  const sqft = u.chargeable_sqft;
  const camMonthly = u.cam_per_sqft != null && sqft ? Math.round(u.cam_per_sqft * sqft / 5) * 5 : null;
  const everyY = u.escalation_every_years || 1;
  const pb = u.power_backup || tbc;
  const L = [];
  L.push('Draft term sheet (for discussion)');
  L.push('Date: ' + LC.fmtDateY(LC.today()));
  L.push('');
  L.push('Owner: ' + (u.owner_name || tbc));
  L.push('Occupier: ' + (c ? clientName(c) : '[Occupier]'));
  L.push('Premises: ' + u.unit_no + ', ' + u.building_name + ', ' + u.address.replace(new RegExp('^' + u.unit_no.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ',\\s*' + u.building_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ',\\s*'), '') +
    '. Carpet ' + LC.fmtSqft(u.carpet_sqft) + ', chargeable ' + LC.fmtSqft(sqft) + ', loading ' + (u.loading_pct != null ? u.loading_pct + '%' : tbc) + '.');
  L.push('Permitted use: ' + ((u.permitted_uses || []).join(', ') || tbc));
  L.push('Rent: ' + R(u.rent_per_sqft) + '/sq ft a month on chargeable area, ' + R(u.monthly_rent) + ' a month.' + (u.pricing_model === 'Per seat' && u.price_per_seat ? ' Seat rate on offer: ' + R(u.price_per_seat) + ' per seat a month for ' + u.seats + ' seats.' : ''));
  L.push('CAM (common area maintenance): ' + (u.cam_per_sqft != null ? R(u.cam_per_sqft) + '/sq ft a month, ' + R(camMonthly) + ' a month' : tbc));
  L.push('GST: ' + (u.gst_pct || 18) + '% extra on rent and CAM.');
  L.push('Security deposit: ' + (u.deposit_months != null ? u.deposit_months + ' months of rent (' + R(u.deposit_amount) + '), interest-free, refundable at exit.' : tbc));
  L.push('Term and lock-in: ' + (u.lease_term_years != null ? u.lease_term_years + ' years' : tbc) + ', with a lock-in of ' + (u.lock_in_months != null ? u.lock_in_months + ' months' : tbc) + '.');
  L.push('Escalation: ' + (u.escalation_pct != null ? u.escalation_pct + '% every ' + (everyY === 1 ? 'year' : everyY + ' years') : tbc) + '.');
  L.push('Rent-free fit-out period: ' + (u.rent_free_days ? u.rent_free_days + ' days from handover.' : 'None.'));
  L.push('Handover condition: ' + (u.furnishing || tbc) + ', available from ' + LC.fmtDateY(u.available_from) + '.');
  L.push('Parking: ' + (u.parking_4w != null ? u.parking_4w + ' car' : tbc) + (u.parking_2w != null ? ', ' + u.parking_2w + ' two-wheeler' : '') + '.');
  L.push('Power load and backup: ' + (u.power_load_kw != null ? u.power_load_kw + ' kW load' : tbc) + ', ' + (pb === '100%' ? '100% backup' : pb + ' backup') + '.');
  L.push('Stamp duty and registration: shared 50:50 (to be confirmed).');
  L.push('Notice period: 3 months after lock-in (to be confirmed).');
  L.push('Offer valid for 15 days, until ' + LC.fmtDateY(LC.addDays(LC.today(), 15)) + '.');
  L.push('');
  L.push('Draft for discussion only. Not a binding offer. Legal terms to be reviewed by both parties\' advisers.');
  return L.join('\n');
};

/* ------------------------------------------------------------------ intents */
function help() {
  const items = [
    ['Find space', 'What fits a 2,500 sq ft clinic in Patia, ready by March?'],
    ['Follow-ups', 'Which enquiries haven\'t been followed up in 5 days?'],
    ['Compare units', 'Compare LC-001, LC-005 and LC-008'],
    ['Term sheet', 'Draft the term sheet for LC-001'],
    ['Visited but no offer', 'Which units have had visits but no offer?'],
    ['Unit visit history', 'Who visited ' + busyUnit() + ' this month and what did they say?'],
    ['Stuck clients', 'What\'s stuck in the pipeline?'],
    ['Visits', 'What visits are booked for tomorrow?'],
    ['Stale units', 'Which units haven\'t been confirmed in 14 days?'],
    ['Sources', 'Which source brings signed leases?'],
    ['Market rents', 'What\'s the average all-in rent for offices in Patia?'],
    ['Days vacant', 'Which available units have been vacant the longest?'],
    ['Workload', 'Show Priyanka\'s open clients'],
    ['Handoffs', 'Who is waiting for a person?'],
    ['Client brief', 'Brief me on ' + sampleCompany()],
  ];
  const html = '<ul class="cp-list">' + items.map(([k, q]) => '<li><b>' + esc(k) + ':</b> <button type="button" class="cp-link" data-ask="' + esc(q) + '">' + esc(q) + '</button></li>').join('') + '</ul>' +
    '<p class="cp-lede">If a question is not covered by one of these, I say so and pass it to a person.</p>';
  return A('help', 'I answer from the units, clients, visits, tasks, handoff queue and leads on this page. Here is what you can ask.', html, { src: { from: 'The question list in this co-pilot', def: 'Each answer names the data it used and the definition behind any number.' } });
}

function findSpace(raw) {
  const p = LC.parseRequirement(raw); const req = p.req;
  const m = LC.match(req, { limit: 3 });
  const read = LC.reqSummary(req);
  const factorDef = LC.MATCH_FACTORS.map(f => f.label.toLowerCase() + ' ' + f.weight).join(', ');
  const src = { from: LC.state.units.length + ' units, match rules and factors', def: 'Score is a 0–100 weighted total (' + factorDef + '). A fit passes every rule. A close option misses exactly one. Only units confirmed in the last ' + LC.settings().freshnessDays + ' days are shown.' };
  const reqBtn = act('Open in Requirement match', () => goTo('match', { req }), true);
  if (!m.exact.length && !m.close.length) {
    const ex = Object.entries(m.excluded).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => { const r = LC.MATCH_RULES.find(x => x.key === k); return (r ? r.label.toLowerCase() : k) + ' (' + n + ')'; });
    return A('find', 'No unit fits that requirement right now.', '<p class="cp-lede">I read it as: ' + esc(read) + '.</p>' + (ex.length ? '<p class="cp-lede">Most units were left out for: ' + esc(ex.join(', ')) + '.</p>' : ''), { actions: [reqBtn], src });
  }
  const rows = m.exact.length ? m.exact : m.close;
  const closeOnly = !m.exact.length;
  const body = tbl([{ h: 'Unit' }, { h: 'All-in', t: 'Rent plus maintenance per sq ft, and the monthly total on chargeable area.' }, { h: 'Size', t: 'Chargeable area.' }, { h: 'Ready', t: 'Date the occupier can trade, given the fit-out they need.' }, { h: 'Score', r: true, t: 'Weighted total of the six match factors, 0 to 100.' }, { h: closeOnly ? 'What it misses' : 'Why' }],
    rows.map(r => {
      const u = r.u; const tip = r.factors.map(f => f.label + ' ' + f.score + ' (weight ' + f.weight + ')').join('; ');
      return [unitLink(u.unit_id) + '<div class="cp-sub small muted">' + esc(u.building_name + ', ' + u.locality) + '</div>',
        '<b>₹' + esc(u.all_in_per_sqft) + '/sq ft</b><div class="cp-sub small muted">' + esc(LC.fmtLakh(u.all_in_monthly)) + ' a month</div>',
        esc(LC.fmtSqft(u.chargeable_sqft)), esc(LC.fmtDate(LC.readyDate(u, req.furnishing))),
        pill(String(r.score), r.score >= 80 ? 'good' : r.score >= 60 ? 'warn' : 'bad', tip),
        esc(closeOnly ? r.missed.map(x => x.label + ': ' + x.note).join('; ') : r.why)];
    }));
  const more = closeOnly ? m.closeCount : m.closeCount;
  const lead = closeOnly
    ? 'No unit passes every check. ' + (rows.length === 1 ? 'The closest one misses a single thing.' : 'Here are the ' + rows.length + ' closest, each missing one thing.')
    : (m.exactCount === 1 ? '1 unit fits.' : m.exactCount + ' units fit. These are the top ' + rows.length + '.');
  const exc = Object.entries(m.excluded).filter(([k]) => !(closeOnly && false)).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, n]) => { const r = LC.MATCH_RULES.find(z => z.key === k); return (r ? r.label.toLowerCase() : k) + ' (' + n + ')'; });
  const foot = '<p class="cp-lede">I read your request as: ' + esc(read) + '.' + (closeOnly && exc.length ? ' Most other units were left out for: ' + esc(exc.join(', ')) + '.' : '') + (more && !closeOnly ? ' ' + plural(more, 'more option') + ' miss exactly one check.' : '') + '</p>';
  const actions = [reqBtn].concat(rows.map(r => act('Open ' + r.u.unit_id, () => call('openUnit', r.u.unit_id))));
  if (rows.length > 1) actions.push(act('Compare these', () => ask('Compare these')));
  return A('find', lead, body + foot, { actions, src, units: rows.map(r => r.u.unit_id) });
}

function followups(raw, t) {
  const N = numFrom(t, 5); const agent = agentIn(t);
  let list = LC.state.clients.filter(c => isOpen(c) && (!agent || c.agent === agent.name)).map(c => ({ c, last: lastTouch(c) })).filter(x => daysSince(x.last) >= N).sort((a, b) => a.last - b.last);
  const src = { from: LC.state.clients.length + ' clients and their timelines', def: 'Open means not Lost, Signed lease or Nurture. Last touch is the newest timeline entry (message, call, visit, stage move).' };
  const who = agent ? ' for ' + agent.name : '';
  if (!list.length) return A('followups', 'Every open client' + who + ' has had activity in the last ' + plural(N, 'day') + '.', '', { src });
  const total = list.length; list = list.slice(0, 12);
  const body = tbl([{ h: 'Client' }, { h: 'Stage' }, { h: 'Agent' }, { h: 'Last touch', t: 'Newest timeline entry for this client.' }, { h: 'Next follow-up' }],
    list.map(({ c, last }) => [clientLink(c), LC.stagePill(c.stage), esc(c.agent), '<b>' + daysSince(last) + ' d ago</b><div class="cp-sub small muted">' + esc(dayLabelTs(last)) + '</div>',
      c.nextFollowUp ? esc(dayLabelTs(c.nextFollowUp)) + (c.nextFollowUp < startOfToday() ? ' ' + pill('Overdue', 'bad') : '') : pill('Not set', 'warn')]));
  const oldest = list[0];
  return A('followups', plural(total, 'open client') + who + (total === 1 ? ' has' : ' have') + ' had no activity for ' + plural(N, 'day') + ' or more. The longest is ' + clientName(oldest.c) + ' at ' + plural(daysSince(oldest.last), 'day') + '.',
    body + (total > list.length ? '<p class="cp-lede">Showing the oldest ' + list.length + ' of ' + total + '.</p>' : ''), { src, client: oldest.c.id });
}

function compare(raw, t) {
  const ids = unitsFrom(t, raw, false).slice(0, 4);
  if (ids.length < 2) return A('compare', (lastUnits.length === 1 && !unitIdsIn(raw).length ? 'My last answer had only one unit, so there is nothing to compare it with. ' : '') + 'Name two or more units, for example "Compare LC-001, LC-005 and LC-008". After a find-space answer with several units, you can say "compare these".', '', { src: { from: LC.state.units.length + ' units', def: 'Fields come straight from the inventory sheet.' } });
  const us = ids.map(LC.unit);
  const F = [
    ['Building', u => u.building_name + ', ' + u.unit_no], ['Locality', u => u.locality + ', ' + LC.cityOf(u)], ['Type', u => u.property_type + ' (grade ' + u.grade + ')'], ['Status', u => u.status],
    ['Chargeable area', u => LC.fmtSqft(u.chargeable_sqft)], ['Carpet area', u => LC.fmtSqft(u.carpet_sqft)], ['Rent', u => '₹' + u.rent_per_sqft + '/sq ft'], ['Maintenance', u => '₹' + (u.cam_per_sqft || 0) + '/sq ft'],
    ['All-in', u => '₹' + u.all_in_per_sqft + '/sq ft'], ['All-in monthly', u => LC.fmtINR(u.all_in_monthly)], ['Deposit', u => u.deposit_months + ' months (' + LC.fmtLakh(u.deposit_amount) + ')'],
    ['Lock-in and term', u => u.lock_in_months + ' months, ' + u.lease_term_years + ' years'], ['Escalation', u => u.escalation_pct + '% every ' + (u.escalation_every_years || 1) + ' yr'],
    ['Available from', u => LC.fmtDateY(u.available_from)], ['Furnishing', u => u.furnishing], ['Parking (cars)', u => u.parking_4w], ['Power backup', u => u.power_backup],
    ['Owner confirmed', u => LC.unitFreshness(u).label],
  ];
  const body = tbl([{ h: 'Field' }].concat(us.map(u => ({ h: u.unit_id }))), F.map(([k, f]) => ['<b>' + esc(k) + '</b>'].concat(us.map(u => esc(f(u) == null ? '–' : f(u))))));
  return A('compare', 'Side by side: ' + ids.join(', ') + '.', body, { units: ids, actions: [act('Open compare view', () => call('openCompare', ids), true), act('Draft term sheet for ' + ids[0], () => ask('Draft the term sheet for ' + ids[0]))], src: { from: 'Inventory rows for ' + ids.join(', '), def: 'All-in is rent plus maintenance per sq ft. Freshness is days since the owner last confirmed.' } });
}

function termSheet(raw, t) {
  const hits = clientHits(raw.replace(/\bLC[-\s]?\d{1,3}\b/gi, ' '));
  const c = hits[0] || null;
  let ids = unitsFrom(t, raw, true);
  let unitId = ids[0];
  if (!unitId && c) {
    unitId = c.unitId || (c.shared[0] && c.shared[0].unitId) || (LC.match(c.req, { limit: 1 }).exact[0] || {}).u && LC.match(c.req, { limit: 1 }).exact[0].u.unit_id;
  }
  if (!unitId) return A('termsheet', 'Which unit is the term sheet for? Say, for example, "Draft the term sheet for LC-001". You can add "for" and a company name.', '', { src: { from: 'Inventory sheet', def: 'A term sheet is built from one unit row.' } });
  const u = LC.unit(unitId); const text = LC.draftTermSheet(unitId, c && c.id);
  const note = u.status !== 'Available' ? '<p class="cp-lede">Note: ' + esc(unitId) + ' is marked "' + esc(u.status) + '". Check with the owner before sending.</p>' : '';
  const acts = [act('Copy text', () => LC.copy(text), true), act('Open ' + unitId, () => call('openUnit', unitId))];
  if (c) acts.push(act('Log on client timeline', () => { LC.crm.addActivity(c.id, 'document', 'Term sheet drafted for ' + unitId, LC.state.me); LC.toast('Added to ' + clientName(c) + ' timeline'); }));
  return A('termsheet', 'Here is a draft term sheet for ' + unitId + (c ? ' for ' + clientName(c) : '') + '. The terms come from the unit sheet, so check them with the owner before it goes out.',
    '<pre>' + esc(text) + '</pre>' + note, { actions: acts, units: [unitId], client: c && c.id, src: { from: 'Unit row ' + unitId + (c ? ' and the client record' : ''), def: 'Stamp duty split and notice period are placeholders to be confirmed. This is a draft, not an offer.' } });
}

function noOffer() {
  const rows = [];
  LC.state.units.filter(u => u.status !== 'Leased').forEach(u => {
    const vs = LC.state.visits.filter(v => v.unitId === u.unit_id && v.status === 'Done');
    if (!vs.length) return;
    const offered = LC.state.clients.some(c => STAGE_RANK(c.stage) >= 3 && (c.unitId === u.unit_id || c.timeline.some(e => e.type === 'document' && e.text.includes(u.unit_id))));
    if (offered) return;
    vs.sort((a, b) => b.when - a.when); rows.push({ u, vs });
  });
  rows.sort((a, b) => b.vs.length - a.vs.length || b.vs[0].when - a.vs[0].when);
  const src = { from: LC.state.visits.length + ' visits and ' + LC.state.clients.length + ' clients', def: 'Visited means at least one visit marked Done. Offer means a client at Proposal or later is linked to the unit, or a term sheet for it is on a client timeline.' };
  if (!rows.length) return A('nooffer', 'Every visited unit already has an offer.', '', { src });
  const shown = rows.slice(0, 12);
  const body = tbl([{ h: 'Unit' }, { h: 'Visits', r: true }, { h: 'Last visit' }, { h: 'Last feedback' }],
    shown.map(({ u, vs }) => { const lv = vs[0]; const c = LC.crm.get(lv.clientId); return [unitLink(u.unit_id) + '<div class="cp-sub small muted">' + esc(u.building_name + ', ' + u.locality) + '</div>', String(vs.length), esc(dayLabelTs(lv.when)) + (c ? '<div class="cp-sub small muted">' + esc(clientName(c)) + '</div>' : ''), esc(lv.feedback || 'No feedback recorded')]; }));
  return A('nooffer', plural(rows.length, 'unit') + (rows.length === 1 ? ' has' : ' have') + ' been visited but ' + (rows.length === 1 ? 'has' : 'have') + ' no offer yet.', body + (rows.length > shown.length ? '<p class="cp-lede">Showing the top ' + shown.length + ' by number of visits.</p>' : ''), { src, units: shown.map(r => r.u.unit_id) });
}

function unitHistory(raw, t) {
  const ids = unitsFrom(t, raw, true); const id = ids[0]; const u = LC.unit(id);
  const per = periodOf(t) || (/this month/.test(t) ? { days: 30, label: 'in the last 30 days' } : null);
  let vs = LC.state.visits.filter(v => v.unitId === id && v.status !== 'Cancelled').sort((a, b) => b.when - a.when);
  const all = vs.length; let label = 'so far';
  if (per) { const f = vs.filter(v => v.when >= now() - per.days * DAY); if (f.length) { vs = f; label = per.label; } else if (all) label = 'none ' + per.label + ', showing all'; }
  const src = { from: 'Visit log for ' + id + ' (' + all + ' visits)', def: 'Feedback and rating are what the agent recorded after the visit. Rating is out of 5.' };
  if (!vs.length) return A('unithistory', 'Nobody has visited ' + id + ' yet.', '', { src, units: [id], actions: [act('Open ' + id, () => call('openUnit', id))] });
  const body = tbl([{ h: 'Client' }, { h: 'Date' }, { h: 'Rating', t: 'Out of 5, recorded by the agent after the visit.' }, { h: 'What they said' }],
    vs.map(v => { const c = LC.crm.get(v.clientId); return [c ? clientLink(c) : '–', esc(LC.fmtDate(LC.iso(v.when))) + (v.status === 'Booked' ? '<div class="cp-sub small muted">Booked</div>' : ''), v.rating ? v.rating + '/5' : '–', esc(v.feedback || (v.status === 'Booked' ? 'Visit not done yet' : 'No feedback recorded'))]; }));
  const done = vs.filter(v => v.status === 'Done'); const rated = done.filter(v => v.rating);
  const avg = rated.length ? ' Average rating ' + (LC.sum(rated, v => v.rating) / rated.length).toFixed(1) + '/5.' : '';
  return A('unithistory', plural(vs.length, 'visit') + ' to ' + id + ' (' + LC.unitShort(u) + ') ' + label + '.' + avg, body, { src, units: [id], actions: [act('Open ' + id, () => call('openUnit', id))] });
}

function unitInfo(id) {
  const u = LC.unit(id); const fr = LC.unitFreshness(u);
  const visits = LC.state.visits.filter(v => v.unitId === id && v.status === 'Done').length;
  const kv = [['Type', u.property_type], ['Place', u.locality + ', ' + LC.cityOf(u)], ['Chargeable area', LC.fmtSqft(u.chargeable_sqft)], ['All-in', '₹' + u.all_in_per_sqft + '/sq ft, ' + LC.fmtLakh(u.all_in_monthly) + ' a month'], ['Status', u.status], ['Available from', LC.fmtDateY(u.available_from)], ['Owner', u.owner_name + ' (' + u.owner_type + ')'], ['Listing agent', u.listing_agent], ['Owner confirmed', fr.label], ['Visits done', String(visits)]];
  return A('unitinfo', LC.unitShort(u) + ' is ' + u.status.toLowerCase() + '.', '<div class="kv">' + kv.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>',
    { units: [id], actions: [act('Open ' + id, () => call('openUnit', id), true), act('Who visited it?', () => ask('Who visited ' + id + ' and what did they say?')), act('Draft term sheet', () => ask('Draft the term sheet for ' + id))], src: { from: 'Inventory row ' + id + ' and the visit log', def: 'All-in is rent plus maintenance per sq ft. Confirmed means the owner last confirmed availability and terms.' } });
}

function stuck(raw, t) {
  const N = numFrom(t, 10);
  const stageSince = (c) => { const h = (c.stageHistory || []).filter(x => x.stage === c.stage); return h.length ? h[h.length - 1].ts : c.createdAt; };
  const stages = LC.STAGES.concat(LC.OFF_STAGES);
  const live = ['New enquiry', 'Qualified', 'Site visit', 'Proposal', 'Letter of intent'];
  const by = LC.groupBy(LC.state.clients, c => c.stage);
  const stuckList = LC.state.clients.filter(c => live.includes(c.stage) && daysSince(stageSince(c)) > N).sort((a, b) => stageSince(a) - stageSince(b));
  const t1 = tbl([{ h: 'Stage' }, { h: 'Clients', r: true }, { h: 'Stuck > ' + N + ' days', r: true, t: 'Clients who have been in this stage for more than ' + N + ' days.' }],
    stages.map(s => { const arr = by[s] || []; const k = stuckList.filter(c => c.stage === s).length; return ['<span title="' + esc(LC.STAGE_DEFS[s]) + '">' + esc(s) + '</span>', String(arr.length), live.includes(s) ? (k ? pill(String(k), 'warn') : '0') : '–']; }));
  const shown = stuckList.slice(0, 10);
  const t2 = shown.length ? '<div class="cp-h">Longest in the same stage</div>' + tbl([{ h: 'Client' }, { h: 'Stage' }, { h: 'Days in stage', r: true }, { h: 'Agent' }],
    shown.map(c => [clientLink(c), LC.stagePill(c.stage), '<b>' + daysSince(stageSince(c)) + '</b>', esc(c.agent)])) : '';
  return A('stuck', stuckList.length ? plural(stuckList.length, 'client') + (stuckList.length === 1 ? ' has' : ' have') + ' been in the same stage for more than ' + plural(N, 'day') + '. Counts per stage are below.' : 'Nobody has been in the same stage for more than ' + plural(N, 'day') + '. Counts per stage are below.', t1 + t2 + (stuckList.length > shown.length ? '<p class="cp-lede">Showing the longest ' + shown.length + ' of ' + stuckList.length + '.</p>' : ''),
    { src: { from: LC.state.clients.length + ' clients and their stage history', def: 'Stuck means the client has been in the current stage for more than ' + N + ' days. Hover a stage name for its written definition. Lost, Nurture and Signed lease are not counted as stuck.' } });
}

function visitsDay(raw, t) {
  const pendingOnly = /pending|unconfirmed|not confirmed|still to confirm|yet to confirm|confirmation/.test(t);
  let from = startOfToday(), to, label;
  if (/tomorrow/.test(t)) { from += DAY; to = from + DAY; label = 'tomorrow'; }
  else if (/today/.test(t)) { to = from + DAY; label = 'today'; }
  else { to = from + 7 * DAY; label = 'in the next 7 days'; }
  let vs = LC.state.visits.filter(v => v.when >= from && v.when < to && v.status !== 'Cancelled').sort((a, b) => a.when - b.when);
  const pend = vs.filter(v => v.status === 'Booked' && v.confirmation !== 'Confirmed');
  if (pendingOnly) vs = pend;
  const src = { from: LC.state.visits.length + ' visits and the confirmation tasks', def: 'Confirmed means a person called the occupier the day before and recorded it. Pending visits have an open confirmation call task.' };
  const acts = [act('Open Site visits', () => goTo('visits'))];
  if (!vs.length) return A('visits', pendingOnly ? 'No visits ' + label + ' are waiting for confirmation.' : 'No visits are booked ' + label + '.', '', { src, actions: acts });
  const body = tbl([{ h: 'When' }, { h: 'Client' }, { h: 'Unit' }, { h: 'Agent' }, { h: 'Status' }, { h: 'Confirmation' }],
    vs.map(v => { const c = LC.crm.get(v.clientId); const u = LC.unit(v.unitId); return [esc(LC.fmtDT(v.when)), c ? clientLink(c) : '–', unitLink(v.unitId) + (u ? '<div class="cp-sub small muted">' + esc(u.building_name) + '</div>' : ''), esc(v.agent || '–'),
      esc(v.status), v.status === 'Done' ? '–' : (v.confirmation === 'Confirmed' ? pill('Confirmed', 'good') : pill('Pending', 'warn', 'Not confirmed yet. A call is due.'))]; }));
  return A('visits', (pendingOnly ? plural(vs.length, 'visit') + ' ' + label + (vs.length === 1 ? ' is' : ' are') + ' waiting for confirmation.' : plural(vs.length, 'visit') + ' ' + label + '. ' + (pend.length ? pend.length + ' not confirmed yet.' : 'All confirmed.')), body, { src, actions: acts, units: Array.from(new Set(vs.map(v => v.unitId))) });
}

function staleUnits(raw, t) {
  const N = numFrom(t, 14);
  const list = LC.state.units.filter(u => u.status !== 'Leased' && LC.unitFreshness(u).days > N).sort((a, b) => LC.unitFreshness(b).days - LC.unitFreshness(a).days);
  const src = { from: LC.state.units.length + ' units (last confirmed dates)', def: 'Confirmed means the owner last confirmed availability and terms. After ' + LC.settings().freshnessDays + ' days a unit is not sent to occupiers until it is checked again.' };
  const acts = [act('Run owner check', () => call('runOwnerCheck'), true)];
  if (!list.length) return A('stale', 'Every active unit was confirmed within ' + plural(N, 'day') + '.', '', { src });
  const shown = list.slice(0, 15);
  const body = tbl([{ h: 'Unit' }, { h: 'Status' }, { h: 'Last confirmed', t: 'Days since the owner last confirmed.' }, { h: 'Owner' }, { h: 'Listing agent' }],
    shown.map(u => { const fr = LC.unitFreshness(u); return [unitLink(u.unit_id) + '<div class="cp-sub small muted">' + esc(u.building_name + ', ' + u.locality) + '</div>', esc(u.status), pill(fr.days + ' days ago', LC.pillFor(fr.level)), esc(u.owner_name), esc(u.listing_agent)]; }));
  return A('stale', plural(list.length, 'unit') + (list.length === 1 ? ' has' : ' have') + ' not been confirmed for more than ' + plural(N, 'day') + '.', body + (list.length > shown.length ? '<p class="cp-lede">Showing the ' + shown.length + ' longest of ' + list.length + '.</p>' : ''), { src, actions: acts, units: shown.map(u => u.unit_id) });
}

const SRC_RX = [['99acres', /99 ?acres/], ['Magicbricks', /magic ?bricks/], ['Housing.com', /housing/], ['Website form', /website/], ['Meta lead ads', /\bmeta\b|facebook|instagram/], ['Google Ads', /google/], ['JustDial', /just ?dial/], ['Office WhatsApp', /office whatsapp/], ['Phone call (IVR)', /ivr|phone call|call-?in/], ['Referral', /referral/], ['Walk-in', /walk-?in/]];
function sources(raw, t) {
  const per = periodOf(t) || (() => { const oldest = Math.min(...LC.state.clients.map(c => c.createdAt)); const d = Math.max(1, Math.ceil((now() - oldest) / DAY)); return { days: d, label: 'in the last ' + d + ' days (all history in this demo)' }; })();
  const cs = LC.state.clients.filter(c => c.createdAt >= now() - per.days * DAY);
  const ids = new Set(cs.map(c => c.id));
  const rows = LC.SOURCES.map(s => {
    const mine = cs.filter(c => c.source === s);
    const vis = LC.state.visits.filter(v => v.status === 'Done' && ids.has(v.clientId) && (LC.crm.get(v.clientId) || {}).source === s).length;
    const signed = mine.filter(c => LC.stageReached(c, 'Signed lease')).length;
    return { s, enq: mine.length, q: mine.filter(c => LC.stageReached(c, 'Qualified')).length, vis, signed, rate: mine.length ? signed / mine.length : 0 };
  }).filter(r => r.enq > 0).sort((a, b) => b.signed - a.signed || b.rate - a.rate || b.enq - a.enq);
  const named = SRC_RX.find(([, rx]) => rx.test(t));
  const tot = { enq: LC.sum(rows, r => r.enq), q: LC.sum(rows, r => r.q), vis: LC.sum(rows, r => r.vis), signed: LC.sum(rows, r => r.signed) };
  const body = tbl([{ h: 'Source' }, { h: 'Enquiries', r: true, t: LC.METRICS.enquiries }, { h: 'Qualified', r: true, t: LC.METRICS.qualified }, { h: 'Visits', r: true, t: LC.METRICS.visits }, { h: 'Signed', r: true, t: LC.METRICS.signed }, { h: 'Source to close', r: true, t: LC.METRICS.sourceToClose }],
    rows.map(r => [esc(r.s), String(r.enq), String(r.q), String(r.vis), '<b>' + r.signed + '</b>', LC.pct(r.rate)]).concat([['<b>All sources</b>', '<b>' + tot.enq + '</b>', '<b>' + tot.q + '</b>', '<b>' + tot.vis + '</b>', '<b>' + tot.signed + '</b>', '<b>' + LC.pct(tot.enq ? tot.signed / tot.enq : 0) + '</b>']]),
    named ? rows.findIndex(r => r.s === named[0]) : (/signed|close|lease|best|brings|deal/.test(t) ? 0 : undefined));
  let lead;
  if (named) { const r = rows.find(x => x.s === named[0]); lead = r ? named[0] + ': ' + plural(r.enq, 'enquiry', 'enquiries') + ' ' + per.label + ', ' + r.q + ' qualified, ' + r.signed + ' signed (' + LC.pct(r.rate) + ' source to close).' : 'No enquiries came from ' + named[0] + ' ' + per.label + '.'; }
  else if (/signed|close|lease|best|brings|deal/.test(t) && rows.length) { const top = rows[0]; const ties = rows.slice(1).filter(r => r.signed === top.signed).map(r => r.s); lead = top.signed ? top.s + ' brings the most signed leases: ' + top.signed + ' of ' + plural(top.enq, 'enquiry', 'enquiries') + ' (' + LC.pct(top.rate) + ') ' + per.label + '.' + (ties.length ? ' ' + ties.join(', ') + (ties.length === 1 ? ' also has' : ' also have') + ' ' + top.signed + '.' : '') : 'No source has a signed lease ' + per.label + '.'; }
  else lead = plural(tot.enq, 'enquiry', 'enquiries') + ' ' + per.label + ', by source.';
  return A('sources', lead, body + '<p class="cp-lede">Counts are small, so read them as a guide, not a ranking.</p>', { src: { from: tot.enq + ' clients created ' + per.label, def: 'Source to close: ' + LC.METRICS.sourceToClose + ' Qualified: ' + LC.METRICS.qualified + ' Visits: ' + LC.METRICS.visits } });
}

const TYPE_RX = [['Office', /\boffices?\b/], ['Coworking', /\bco-?working\b/], ['Retail shop', /\b(retail|shops?|stores?)\b/], ['Showroom', /\bshowrooms?\b/], ['F&B space', /\b(f&b|restaurants?|cafes?|cafés?|food)\b/], ['Clinic', /\b(clinics?|diagnostics?)\b/], ['Institutional', /\b(institutional|coaching|institutes?|training)\b/], ['Warehouse', /\b(warehouses?|godowns?)\b/], ['Industrial shed', /\b(industrial|sheds?|factory|factories)\b/]];
function market(raw, t) {
  const tp = TYPE_RX.find(([, rx]) => rx.test(t)); const place = placeIn(t);
  let us = LC.state.units.filter(u => u.status !== 'Leased' && u.all_in_per_sqft != null);
  const parts = []; let scope = 'all property types';
  if (tp) { us = us.filter(u => u.property_type === tp[0]); scope = tp[0].toLowerCase() + ' units'; }
  let where = 'across all areas'; let widened = false;
  let sub = us;
  if (place.localities.length) { sub = us.filter(u => place.localities.includes(u.locality)); where = 'in ' + place.localities.join(' and '); }
  else if (place.city) { sub = us.filter(u => LC.cityOf(u) === place.city); where = 'in ' + place.city; }
  if (!sub.length && place.localities.length) { sub = us.filter(u => LC.cityOf(u) === place.city); if (sub.length) { widened = true; where = 'in ' + place.city + ' (none in ' + place.localities.join(' or ') + ')'; } }
  const src = { from: LC.state.units.length + ' units (asking rents)', def: 'All-in is rent plus maintenance per sq ft per month, before GST. These are asking rents in our inventory, not market-wide rates.' };
  if (!sub.length) return A('market', 'I have no ' + scope + ' ' + where + ' in the inventory, so I can\'t give a rate.', '', { src });
  const v = sub.map(u => u.all_in_per_sqft).sort((a, b) => a - b);
  const med = LC.median(v);
  const kp = '<div class="kpis"><div class="kpi"><div class="l">Median all-in</div><div class="v">₹' + esc(Math.round(med * 10) / 10) + '</div><div class="d">per sq ft a month</div></div><div class="kpi"><div class="l">Lowest</div><div class="v">₹' + esc(v[0]) + '</div><div class="d">per sq ft a month</div></div><div class="kpi"><div class="l">Highest</div><div class="v">₹' + esc(v[v.length - 1]) + '</div><div class="d">per sq ft a month</div></div><div class="kpi"><div class="l">Units counted</div><div class="v">' + sub.length + '</div><div class="d">not leased</div></div></div>';
  const list = tbl([{ h: 'Unit' }, { h: 'Locality' }, { h: 'Size', r: true }, { h: 'All-in', r: true }], sub.slice().sort((a, b) => a.all_in_per_sqft - b.all_in_per_sqft).slice(0, 8).map(u => [unitLink(u.unit_id), esc(u.locality), esc(LC.fmtSqft(u.chargeable_sqft)), '₹' + esc(u.all_in_per_sqft)]));
  return A('market', 'Median all-in asking rent for ' + scope + ' ' + where + ' is ₹' + (Math.round(med * 10) / 10) + '/sq ft (from ' + plural(sub.length, 'unit') + ', range ₹' + v[0] + ' to ₹' + v[v.length - 1] + ').',
    kp + list + '<p class="cp-lede">These are asking rents in our inventory, not market-wide.' + (widened ? ' I widened the search to the whole city.' : '') + '</p>', { src, units: sub.slice(0, 8).map(u => u.unit_id) });
}

function vacant() {
  const av = LC.state.units.filter(u => u.status === 'Available');
  const free = av.map(u => ({ u, d: LC.daysAgo(u.available_from), listed: u.listed_date ? LC.daysAgo(u.listed_date) : 0 })).filter(x => x.d >= 0).sort((a, b) => b.d - a.d || b.listed - a.listed);
  const list = free.slice(0, 10);
  const later = av.length - free.length;
  const src = { from: av.length + ' available units', def: 'Days vacant: ' + LC.METRICS.daysVacant + ' Days listed is the days since the unit was added to the inventory.' };
  if (!list.length) return A('vacant', 'No available unit has reached its available-from date yet.', '', { src });
  const body = tbl([{ h: 'Unit' }, { h: 'Type' }, { h: 'Available from' }, { h: 'Days vacant', r: true, t: LC.METRICS.daysVacant }, { h: 'Days listed', r: true, t: 'Days since the unit was added to the inventory.' }, { h: 'All-in', r: true }, { h: 'Owner confirmed' }],
    list.map(({ u, d, listed }) => [unitLink(u.unit_id) + '<div class="cp-sub small muted">' + esc(u.building_name + ', ' + u.locality) + '</div>', esc(u.property_type), esc(LC.fmtDateY(u.available_from)), '<b>' + d + '</b>', String(listed), '₹' + esc(u.all_in_per_sqft) + '/sq ft', esc(LC.unitFreshness(u).label)]));
  const lead = list[0].d > 0 ? 'The longest vacant is ' + list[0].u.unit_id + ' at ' + plural(list[0].d, 'day') + '. Here are the top ' + list.length + '.'
    : 'No unit has stayed vacant past its available-from date yet. Here are the top ' + list.length + ' that are free now, longest on the list first.';
  return A('vacant', lead, body + (later ? '<p class="cp-lede">' + plural(later, 'more available unit') + ' ' + (later === 1 ? 'is' : 'are') + ' not free yet (available-from date is ahead).</p>' : ''), { src, units: list.map(x => x.u.unit_id) });
}

function workload(raw, t) {
  const agent = agentIn(t); const src = { from: LC.state.clients.length + ' clients, ' + LC.state.visits.length + ' visits and ' + LC.state.tasks.length + ' tasks', def: 'Open clients are not Lost, Signed lease or Nurture. Follow-up due means the next follow-up date is today or earlier.' };
  const endToday = startOfToday() + DAY;
  const stat = (a) => { const cs = LC.state.clients.filter(c => c.agent === a.name && isOpen(c)); return { a, open: cs.length, due: cs.filter(c => c.nextFollowUp && c.nextFollowUp < endToday).length, over: cs.filter(c => c.nextFollowUp && c.nextFollowUp < startOfToday()).length, pend: LC.state.visits.filter(v => v.agent === a.name && v.status === 'Booked' && v.confirmation !== 'Confirmed').length, tasks: LC.state.tasks.filter(x => !x.done && x.assignee === a.name).length }; };
  if (agent && !/most|fewest|busiest|who has/.test(t)) {
    const cs = LC.state.clients.filter(c => c.agent === agent.name && isOpen(c)).sort((a, b) => (a.nextFollowUp || 9e15) - (b.nextFollowUp || 9e15));
    const s = stat(agent);
    if (!cs.length) return A('workload', agent.name + ' has no open clients.', '', { src });
    const shown = cs.slice(0, 15);
    const body = tbl([{ h: 'Client' }, { h: 'Stage' }, { h: 'Looking for' }, { h: 'Last touch' }, { h: 'Next follow-up' }],
      shown.map(c => [clientLink(c), LC.stagePill(c.stage), esc(LC.reqSummary(c.req)), esc(daysSince(lastTouch(c)) + ' d ago'), c.nextFollowUp ? esc(dayLabelTs(c.nextFollowUp)) + (c.nextFollowUp < startOfToday() ? ' ' + pill('Overdue', 'bad') : '') : pill('Not set', 'warn')]));
    return A('workload', agent.name + ' has ' + plural(cs.length, 'open client') + ', ' + s.due + ' with a follow-up due or overdue.', body + (cs.length > shown.length ? '<p class="cp-lede">Showing the first ' + shown.length + ' by next follow-up date.</p>' : ''), { src, client: shown[0].id });
  }
  const rows = LC.TEAM.map(stat).sort((a, b) => b.due - a.due || b.open - a.open);
  const body = tbl([{ h: 'Agent' }, { h: 'Open clients', r: true }, { h: 'Follow-ups due', r: true, t: 'Next follow-up date is today or earlier.' }, { h: 'Overdue', r: true, t: 'Next follow-up date is before today.' }, { h: 'Visits to confirm', r: true }, { h: 'Open tasks', r: true }],
    rows.map(r => ['<b>' + esc(r.a.name) + '</b><div class="cp-sub small muted">' + esc(r.a.role) + '</div>', String(r.open), '<b>' + r.due + '</b>', String(r.over), String(r.pend), String(r.tasks)]), 0);
  return A('workload', rows[0].a.name + ' has the most follow-ups due: ' + rows[0].due + ' (' + rows[0].open + ' open clients).', body, { src });
}

function handoffs() {
  const w = LC.queue.waiting(); const sla = LC.settings().slaMinutes;
  const src = { from: 'The handoff queue and ' + LC.settings().handoffRules.length + ' handoff rules', def: 'A lead waits here when a rule fires. SLA is ' + sla + ' minutes from the handoff to a person picking it up.' };
  if (!w.length) {
    const rules = LC.settings().handoffRules.filter(r => r.on);
    return A('handoffs', 'Nobody is waiting for a person right now. The queue is empty.', '<div class="cp-h">When a lead is handed to a person</div>' + tbl([{ h: 'Rule' }, { h: 'When it fires' }], rules.map(r => ['<b>' + esc(r.name) + '</b>', esc(r.trigger)])), { src, actions: [act('Open lead inbox', () => goTo('inbox'))] });
  }
  const body = tbl([{ h: 'Rule' }, { h: 'Reason' }, { h: 'Assigned to' }, { h: 'Waiting', t: 'Minutes since the handoff.' }, { h: 'SLA (' + sla + ' min)' }, { h: '' }],
    w.map(q => { const min = Math.max(0, Math.round((now() - q.at) / 60e3)); return ['<b>' + esc(q.ruleName) + '</b>' + (q.priority && q.priority !== 'Normal' ? '<div class="cp-sub small muted">' + esc(q.priority) + ' priority</div>' : ''), esc(q.reason), esc(q.assignee || 'Unassigned'), min + ' min', min > sla ? pill('Over SLA', 'bad') : pill('Within SLA', 'good'), q.leadId ? '<button type="button" class="btn sm" data-lead="' + esc(q.leadId) + '">Open</button>' : '']; }));
  const over = w.filter(q => (now() - q.at) / 60e3 > sla).length;
  return A('handoffs', plural(w.length, 'lead') + (w.length === 1 ? ' is' : ' are') + ' waiting for a person' + (over ? ', ' + over + ' past the ' + sla + ' minute SLA.' : ', all within the SLA.'), body, { src, actions: [act('Open lead inbox', () => goTo('inbox'))] });
}

function brief(raw, t) {
  const hits = clientHits(raw);
  const src = { from: 'The client record, its timeline, shared units and visits', def: 'Next step comes from the open task if there is one, otherwise from the stage playbook.' };
  if (!hits.length) {
    const eg = LC.state.clients.filter(isOpen).slice(0, 3).map(c => clientName(c));
    return A('brief', 'I can\'t find a client with that name in the CRM. Try a company name or a contact name, for example "Brief me on ' + (eg[0] || 'a company') + '".', eg.length ? '<div class="chips">' + eg.map(n => '<button type="button" class="chip" data-ask="Brief me on ' + esc(n) + '">Brief me on ' + esc(n) + '</button>').join('') + '</div>' : '', { src });
  }
  const c = hits[0]; const others = hits.slice(1);
  const tl = (c.timeline || []).slice().sort((a, b) => b.ts - a.ts).slice(0, 5);
  const vs = LC.state.visits.filter(v => v.clientId === c.id).sort((a, b) => b.when - a.when);
  const task = LC.state.tasks.filter(x => !x.done && x.clientId === c.id).sort((a, b) => a.due - b.due)[0];
  const miss = LC.reqMissing(c.req).map(k => (LC.REQ_FIELDS.find(f => f.key === k) || {}).label).filter(Boolean);
  const PLAY = { 'New enquiry': 'Qualify: ask for ' + (miss.slice(0, 3).join(', ').toLowerCase() || 'the missing details') + '.', 'Qualified': 'Share matched units and book a site visit.', 'Site visit': 'Collect visit feedback and send a term sheet.', 'Proposal': 'Chase a decision on the term sheet.', 'Letter of intent': 'Prepare the lease draft for legal review.', 'Nurture': 'Check in before the move-in date.', 'Lost': 'Closed: ' + (c.lostReason || 'no reason recorded') + '.', 'Signed lease': 'Lease signed. Hand over to the owner and plan the move-in.' };
  const next = task ? task.title + ' (due ' + LC.fmtDT(task.due) + ')' : PLAY[c.stage];
  const kv = [['Stage', c.stage], ['Agent', c.agent], ['Source', c.source + (c.language !== 'English' ? ', ' + c.language : '')], ['Contact', c.name + (c.phone ? ', ' + c.phone : '')], ['Looking for', LC.reqSummary(c.req)], ['Next follow-up', c.nextFollowUp ? LC.fmtDate(LC.iso(c.nextFollowUp)) : 'Not set'], ['Next step', next]];
  let html = '<div class="kv">' + kv.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>';
  html += '<div class="cp-h">Last ' + tl.length + ' timeline items</div><ul class="cp-tl">' + tl.map(e => '<li><span class="w">' + esc(LC.fmtDT(e.ts)) + '</span><span>' + esc(e.text) + '</span></li>').join('') + '</ul>';
  html += '<div class="cp-h">Units shared</div>' + (c.shared.length ? '<div class="row">' + c.shared.map(s => unitLink(s.unitId) + (s.reaction ? ' <span class="small muted">(' + esc(s.reaction.toLowerCase()) + ')</span>' : '')).join(' ') + '</div>' : '<p class="cp-lede">None yet.</p>');
  html += '<div class="cp-h">Visits</div>' + (vs.length ? '<ul class="cp-list">' + vs.slice(0, 5).map(v => '<li>' + unitLink(v.unitId) + ', ' + esc(LC.fmtDate(LC.iso(v.when))) + ', ' + esc(v.status.toLowerCase()) + (v.feedback ? ': "' + esc(v.feedback) + '"' : '') + '</li>').join('') + '</ul>' : '<p class="cp-lede">No visits yet.</p>');
  if (others.length) html += '<p class="cp-lede">' + plural(others.length, 'other client') + ' also match this name: ' + others.slice(0, 4).map(o => '<button type="button" class="cp-link" data-client="' + esc(o.id) + '">' + esc(o.name) + ' (' + esc(o.stage) + ')</button>').join(', ') + '.</p>';
  const acts = [act('Open client', () => call('openClient', c.id), true), act('Find matches', () => goTo('match', { clientId: c.id }))];
  const su = (c.unitId || (c.shared[0] && c.shared[0].unitId)); if (su) acts.push(act('Draft term sheet', () => ask('Draft the term sheet for ' + su + ' for ' + clientName(c))));
  return A('brief', clientName(c) + ' (' + c.name + ') is at ' + c.stage + ', handled by ' + c.agent + '.', html, { src, actions: acts, client: c.id, units: c.shared.map(s => s.unitId).slice(0, 4) });
}

/* ------------------------------------------------------------------ router */
const RX = {
  help: /^(hi|hello|hey|namaste|namaskar)\b|what can (you|i)|\bhelp\b|what do you (know|do)|how (do|can) i use|capabilit|what (questions|else)|\bexamples?\b/,
  term: /term ?sheet|draft (the |an |a )?(offer|terms?|loi|letter)|offer letter|letter of intent|prepare (the |an |a )?(offer|terms?)/,
  compare: /\bcompare\b|side by side|\bversus\b|\bvs\b|difference between/,
  noOffer: /visit/,
  noOfferB: /(no|without|not|yet)\s+(an?\s+)?(offers?|proposals?|term ?sheets?|quotes?)|haven'?t (got|had|sent)\s+(an?\s+)?(offers?|proposals?)|never (got|had) (an? )?offer|no one has made an offer/,
  brief: /\bbrief\b|tell me about|status of|update on|what'?s happening with|summar(y|ise|ize) of|catch me up on|background on/,
  handoff: /waiting for (a )?(person|human|agent|someone|us)|hand-?offs?|hand(ed)? (over|off)|(needs?|need) (a )?(person|human)|human queue|escalat|who needs (a )?(person|call)|\bqueue\b/,
  staleU: /(haven'?t|have not|hasn'?t|has not|not|never|no)\b[^.?]*(confirmed|updated|checked|verified)|\bstale\b|unconfirmed|out of date|outdated|need(s)? (an? )?(owner )?(check|call)/,
  vacant: /vacan|sitting empty|\bempty\b|unlet|unleased|longest[^.?]*(available|market|on)|on the market[^.?]*longest|oldest (listing|unit)|slowest to let/,
  stat: /average|\bavg\b|median|typical|going (rate|price)|market (rate|rent|price)|\bmean\b|price range|rent range|\brange\b|how much (is|does|do|are)|what (do|does) .*(cost|rent|charge)|what('?s| is| are) the (rent|rate|price)s?|rents? (for|in|of)\b/,
  money: /rent|rate|price|cost|psf|charge/,
  notMarket: /\b(fits?|need|looking|find|under|below|budget|within|max|at most|up ?to|ready by|match)\b/,
  source: /\bsources?\b|\bchannels?\b|\bportals?\b|99 ?acres|magic ?bricks|housing\.com|just ?dial|meta (lead )?ads|google ads|walk-?ins?\b|referrals?\b|where do (our )?(enquiries|leads|clients) come|lead sources/,
  visitDay: /visit|tour|site visits?/,
  visitWhen: /today|tomorrow|this week|next (7|seven)|upcoming|scheduled|booked|coming up|next week|pending|unconfirmed|not confirmed|confirmation|to confirm/,
  stuck: /stuck|stalled|pipeline|by stage|each stage|per stage|funnel|bottleneck|how many (clients|enquiries) are|dragging/,
  followNot: /(haven'?t|have not|hasn'?t|not|never|yet to be|no|without)\s+(been\s+)?(follow(ed)?[- ]?up|contacted|touched|called|chased|replied|reached)|gone (cold|quiet)|overdue|no (contact|activity|touch)|untouched|neglected|cold (leads|enquiries|clients)|need(s)? (a )?(follow|chas)|who should i (follow|call|chase)|waiting (for|on) (a )?(reply|response|call)/,
  work: /most (follow|clients|work|enquiries|leads)|fewest|busiest|workload|per agent|by agent|who has the|each agent|team load|open clients?|my clients|(clients|enquiries|leads|pipeline|list|follow-?ups?) (of|for|with)\b|'s (open )?(clients|enquiries|leads|pipeline|list|follow)/,
};

function route(raw) {
  const t = raw.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  const uids = unitIdsIn(raw);
  if (RX.help.test(t)) return help();
  if (RX.term.test(t)) return termSheet(raw, t);
  if (RX.compare.test(t)) return compare(raw, t);
  if (RX.noOffer.test(t) && RX.noOfferB.test(t)) return noOffer();
  if (uids.length && /visit|feedback|\bsay\b|\bsaid\b|think|seen|toured|history|comments?|reaction/.test(t)) return unitHistory(raw, t);
  if (RX.brief.test(t)) { if (uids.length && !clientHits(raw).length) return unitInfo(uids[0]); return brief(raw, t); }
  if (RX.handoff.test(t)) return handoffs();
  if (/\bunits?\b|listings?|properties|availability/.test(t) && RX.staleU.test(t)) return staleUnits(raw, t);
  if (RX.vacant.test(t)) return vacant();
  if (RX.stat.test(t) && RX.money.test(t) && !RX.notMarket.test(t)) return market(raw, t);
  if (RX.source.test(t)) return sources(raw, t);
  if (RX.visitDay.test(t) && RX.visitWhen.test(t)) return visitsDay(raw, t);
  if (RX.stuck.test(t)) return stuck(raw, t);
  if (RX.followNot.test(t) && !RX.work.test(t.replace(/follow-?ups?/, ''))) return followups(raw, t);
  if (RX.work.test(t) || (agentIn(t) && /client|enquir|lead|pipeline|list|follow|show|open|handling|working on|assigned|portfolio/.test(t))) return workload(raw, t);
  if (RX.followNot.test(t)) return followups(raw, t);
  if (uids.length && uids.length === 1 && t.replace(/\bLC[-\s]?\d+\b/gi, '').trim().length < 14) return unitInfo(uids[0]);
  // find space
  const p = LC.parseRequirement(raw); const keys = new Set(p.found.map(f => f.key));
  const core = keys.has('use') || keys.has('size') || keys.has('budget');
  if ((core && (keys.size >= 2 || /space|units?|fit|find|need|looking|require|available|premises|options|want/.test(t))) || (keys.has('location') && /space|units?|premises|available|propert|listings?|what fits/.test(t))) return findSpace(raw);
  return null;
}

/* ------------------------------------------------------------------ Claude (optional) */
function compactUnit(r) { const u = r.u; return { unit_id: u.unit_id, building: u.building_name, locality: u.locality, type: u.property_type, size_sqft: u.chargeable_sqft, all_in_rs_per_sqft: u.all_in_per_sqft, all_in_monthly_rs: u.all_in_monthly, available_from: u.available_from, score: r.score, why: r.why }; }
function summariseClient(c) {
  const vs = LC.state.visits.filter(v => v.clientId === c.id).slice(0, 4).map(v => ({ unit: v.unitId, when: LC.iso(v.when), status: v.status, feedback: v.feedback }));
  return { company: c.company, contact: c.name, stage: c.stage, agent: c.agent, source: c.source, requirement: LC.reqSummary(c.req), next_follow_up: c.nextFollowUp ? LC.iso(c.nextFollowUp) : null, last_touch_days_ago: daysSince(lastTouch(c)), shared_units: c.shared.map(s => s.unitId), visits: vs, recent: (c.timeline || []).slice(0, 5).map(e => e.text) };
}
function claudeTools() {
  const obj = (props, req) => ({ type: 'object', properties: props, required: req || [] });
  return [
    { name: 'search_units', description: 'Find the top 5 units for a requirement written in plain words (use, size, budget, area, move-in date). Returns compact rows.', inputSchema: obj({ requirement: { type: 'string' } }, ['requirement']),
      execute: (i) => { const r = LC.parseRequirement(String(i.requirement || '')); const m = LC.match(r.req, { limit: 5 }); return { understood: LC.reqSummary(r.req), fits: m.exactCount, rows: (m.exact.length ? m.exact : m.close).slice(0, 5).map(compactUnit), note: m.exact.length ? 'exact fits' : 'close options, each misses one check' }; } },
    { name: 'get_client', description: 'Summary of a client by company or contact name.', inputSchema: obj({ name: { type: 'string' } }, ['name']),
      execute: (i) => { const h = clientHits(String(i.name || '')); return h.length ? { matches: h.length, client: summariseClient(h[0]) } : { matches: 0 }; } },
    { name: 'pipeline_counts', description: 'Number of clients per stage and how many have been in the same stage for more than 10 days.', inputSchema: obj({}),
      execute: () => { const by = LC.groupBy(LC.state.clients, c => c.stage); return LC.STAGES.concat(LC.OFF_STAGES).map(s => ({ stage: s, clients: (by[s] || []).length })); } },
    { name: 'list_visits', description: 'Site visits for a day: today, tomorrow or week (next 7 days).', inputSchema: obj({ day: { type: 'string', enum: ['today', 'tomorrow', 'week'] } }, ['day']),
      execute: (i) => { let from = startOfToday(), to = from + 7 * DAY; if (i.day === 'today') to = from + DAY; if (i.day === 'tomorrow') { from += DAY; to = from + DAY; } return LC.state.visits.filter(v => v.when >= from && v.when < to).sort((a, b) => a.when - b.when).slice(0, 20).map(v => { const c = LC.crm.get(v.clientId); return { when: LC.fmtDT(v.when), client: c ? clientName(c) : '', unit: v.unitId, status: v.status, confirmation: v.confirmation }; }); } },
    { name: 'source_stats', description: 'Enquiries, qualified, visits and signed leases per lead source.', inputSchema: obj({}),
      execute: () => LC.SOURCES.map(s => { const m = LC.state.clients.filter(c => c.source === s); return { source: s, enquiries: m.length, qualified: m.filter(c => LC.stageReached(c, 'Qualified')).length, signed: m.filter(c => LC.stageReached(c, 'Signed lease')).length }; }).filter(r => r.enquiries) },
  ];
}
async function claudeAnswer(q) {
  const instr = 'You are the leasing co-pilot for a commercial real estate leasing desk in Odisha, India. Answer only from the results of the tools you call. If the tool results do not cover the question, say plainly that the data does not cover it. Use plain English and keep it short (under 120 words). Do not use em-dashes. Write rupees with Indian grouping, for example ₹1,61,000. Do not invent units, clients or numbers.';
  const r = await LC.ai.sample([{ role: 'user', content: instr + '\n\nQuestion: ' + q }], { tools: claudeTools(), cache: false });
  const text = String((r && r.text) || '').replace(/\s*[\u2014]\s*/g, ', ').trim();
  if (!text) throw new Error('empty');
  return text;
}
function textToHtml(text) {
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => { const lines = b.split('\n'); if (lines.every(l => /^\s*[-*•]\s+/.test(l))) return '<ul class="cp-list">' + lines.map(l => '<li>' + esc(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>'; return '<p>' + esc(b).replace(/\n/g, '<br>') + '</p>'; }).join('');
}

/* ------------------------------------------------------------------ chat */
let chatBody = null, busy = false, fbN = 0;
const FALLBACK_SUG = ['What\'s stuck in the pipeline?', 'Which units haven\'t been confirmed in 14 days?', 'What fits a 2,500 sq ft clinic in Patia, ready by March?', 'Which enquiries haven\'t been followed up in 5 days?', 'What visits are booked for tomorrow?'];
function busyUnit() {
  const n = {}; LC.state.visits.forEach(v => { if (v.status === 'Done') n[v.unitId] = (n[v.unitId] || 0) + 1; });
  const best = Object.entries(n).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  return best ? best[0] : 'LC-007';
}
function sampleCompany() {
  const c = LC.state && LC.state.clients.filter(isOpen).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return c ? clientName(c) : 'a company';
}
function toBottom(node) { if (!chatBody) return; if (node) chatBody.scrollTop += node.getBoundingClientRect().top - chatBody.getBoundingClientRect().top - 8; else chatBody.scrollTop = chatBody.scrollHeight; }
function addMe(text) { const d = document.createElement('div'); d.className = 'msg me'; d.textContent = text; chatBody.appendChild(d); return d; }
function aiNode(a) {
  const d = document.createElement('div'); d.className = 'msg ai'; d.dataset.intent = a.intent;
  d.innerHTML = '<p>' + esc(a.lead) + '</p>' + (a.html || '') +
    (a.actions && a.actions.length ? '<div class="cp-acts">' + a.actions.map((x, i) => '<button type="button" class="btn sm' + (x.primary ? ' primary' : '') + '" data-act="' + i + '">' + esc(x.label) + '</button>').join('') + '</div>' : '') +
    (a.src ? '<div class="src"><b>From:</b> ' + esc(a.src.from) + ' · <b>Definition:</b> ' + esc(a.src.def) + '</div>' : '');
  d._acts = a.actions || [];
  return d;
}
function postAI(a, replace) {
  const d = aiNode(a);
  if (replace && replace.parentNode) replace.replaceWith(d); else chatBody.appendChild(d);
  if (a.units && a.units.length) lastUnits = a.units.slice();
  if (a.client) lastClient = a.client;
  return d;
}
function fallback(q) {
  const key = 'Answer a co-pilot question: "' + q + '"';
  if (!LC.state.tasks.some(x => x.title === key && !x.done)) LC.tasks.add({ type: 'Co-pilot question', title: key, due: now() + 2 * 36e5, assignee: LC.state.me, priority: 'Normal' });
  LC.log('Co-pilot question passed to a person: ' + q, { kind: 'copilot' });
  const sug = []; for (let i = 0; i < 3; i++) sug.push(FALLBACK_SUG[(fbN + i) % FALLBACK_SUG.length]); fbN++;
  return A('fallback', 'I can\'t answer that from the data I have. I\'ve noted it for a person on the team.',
    '<p class="cp-lede">I only answer from the units, clients, visits, tasks and handoff queue, using written definitions. Here are three I can answer now:</p><div class="chips">' + sug.map(s => '<button type="button" class="chip" data-ask="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>',
    { src: { from: 'No named data or definition covers this question', def: 'A task was added to your list so a person can answer it.' } });
}
async function ask(text) {
  text = String(text || '').trim(); if (!text || !chatBody) return;
  if (busy) return;
  const me = addMe(text); toBottom(me);
  let a = null;
  try { a = route(text); } catch (e) { console.error('[copilot] route', e); }
  if (a) { const n = postAI(a); toBottom(me); return n; }
  if (LC.ai && LC.ai.sample) {
    busy = true;
    const wait = document.createElement('div'); wait.className = 'msg ai'; wait.dataset.intent = 'thinking'; wait.innerHTML = '<p class="cp-typing">Checking the data…</p>'; chatBody.appendChild(wait); toBottom(me);
    try {
      const out = await claudeAnswer(text);
      const d = postAI(A('claude', '', textToHtml(out), { src: { from: 'Page tools: units, clients, visits and lead sources', def: LC.aiName + ' answers only from what those tools return. If the data does not cover it, it says so.' } }), wait);
      d.firstElementChild.outerHTML = '<p class="cp-lede"><span class="ai-tag">' + LC.aiName + '</span></p>';
      busy = false; return d;
    } catch (e) { busy = false; const d = postAI(fallback(text), wait); return d; }
  }
  const d = postAI(fallback(text)); toBottom(me); return d;
}

function welcome() {
  const qs = ['What fits a 2,500 sq ft clinic in Patia, ready by March?', 'Which enquiries haven\'t been followed up in 5 days?', 'What\'s stuck in the pipeline?', 'What can you answer?'];
  const d = document.createElement('div'); d.className = 'msg ai'; d.dataset.intent = 'welcome';
  d.innerHTML = '<p>Ask me about units, clients, visits and numbers in plain words. I answer from the live data on this page and say where each answer came from.</p><div class="chips">' + qs.map(q => '<button type="button" class="chip" data-ask="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>';
  chatBody.appendChild(d);
}

/* ------------------------------------------------------------------ voice */
const VOICE_MSG = 'Voice needs microphone access; it works when the demo file is opened in Chrome.';
let rec = null;
function setupVoice(root) {
  const btn = LC.$('#cp-mic', root), note = LC.$('#cp-voice-note', root), inp = LC.$('#cp-in', root), langSel = LC.$('#cp-lang', root);
  const say = (m) => { note.textContent = m || ''; };
  btn.addEventListener('click', () => {
    if (rec) { try { rec.stop(); } catch (e) { } return; }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { say(VOICE_MSG); return; }
    say('');
    try {
      rec = new Rec(); rec.lang = langSel.value; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => { btn.setAttribute('aria-pressed', 'true'); say('Listening…'); };
      rec.onresult = (ev) => { const txt = ev.results[0][0].transcript; inp.value = txt; say(''); ask(txt); inp.value = ''; };
      rec.onerror = (ev) => { say(ev.error === 'no-speech' ? 'I did not hear anything. Try again.' : ev.error === 'aborted' ? '' : VOICE_MSG); };
      rec.onend = () => { btn.setAttribute('aria-pressed', 'false'); rec = null; if (note.textContent === 'Listening…') say(''); };
      rec.start();
    } catch (e) { rec = null; btn.setAttribute('aria-pressed', 'false'); say(VOICE_MSG); }
  });
}

/* ------------------------------------------------------------------ view */
function suggestions() {
  const co = sampleCompany();
  return [
    ['Find space', ['What fits a 2,500 sq ft clinic in Patia, ready by March?', 'Office for 20 seats in Infocity under ₹70 per sq ft', 'Show warehouses around 8,000 sq ft near Jatni']],
    ['Clients and follow-ups', ['Which enquiries haven\'t been followed up in 5 days?', 'Show Priyanka\'s open clients', 'Who has the most follow-ups?', 'Brief me on ' + co, 'Who is waiting for a person?']],
    ['Visits', ['What visits are booked for tomorrow?', 'Which visits are still unconfirmed this week?', 'Who visited ' + busyUnit() + ' this month and what did they say?']],
    ['Units and owners', ['Which units haven\'t been confirmed in 14 days?', 'Which units have had visits but no offer?', 'Compare LC-001, LC-005 and LC-008', 'Which available units have been vacant the longest?']],
    ['Numbers', ['What\'s stuck in the pipeline?', 'Which source brings signed leases?', 'How many enquiries came from 99acres this month?', 'What\'s the average all-in rent for offices in Patia?']],
    ['Paperwork', ['Draft the term sheet for LC-001', 'Draft the term sheet for LC-005 for ' + co, 'What can you answer?']],
  ];
}

LC.registerView('copilot', {
  title: 'Leasing co-pilot', sub: 'Ask about units, clients, visits and numbers. Answers come from live data.',
  render(el) {
    const mic = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    el.innerHTML = '<div class="split cp-split">' +
      '<div class="card chat cp-chat"><div class="card-h"><h2>Ask the co-pilot</h2><span class="spacer"></span><span class="pill brand" title="Answers are built from the units, clients, visits, tasks and handoff queue on this page.">Live data</span><button type="button" class="btn sm" id="cp-clear">Clear chat</button></div>' +
      '<div class="chat-body" id="cp-body" aria-live="polite"></div>' +
      '<form class="chat-input" id="cp-form" autocomplete="off"><input class="input" id="cp-in" type="text" placeholder="Ask in plain words, for example: what\'s stuck?" aria-label="Your question" maxlength="300">' +
      '<select class="input cp-lang" id="cp-lang" aria-label="Voice language"><option value="en-IN">English</option><option value="hi-IN">Hindi</option></select>' +
      '<button type="button" class="btn cp-mic" id="cp-mic" aria-label="Speak your question" aria-pressed="false" title="Speak your question">' + mic + '</button>' +
      '<button type="submit" class="btn primary">Ask</button></form>' +
      '<div class="cp-foot"><div class="cp-voice-note" id="cp-voice-note" role="status"></div><div class="cp-guard">Answers come only from named data and written definitions. If a question is not covered, I say so and pass it to a person.</div></div></div>' +
      '<div class="card"><div class="card-h"><h2>Suggested questions</h2></div><div class="card-b cp-sug">' +
      suggestions().map(([g, qs]) => '<div><h3>' + esc(g) + '</h3><div class="chips">' + qs.map(q => '<button type="button" class="chip" data-ask="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div></div>').join('') +
      '<p class="cp-lede" id="cp-ai-note"></p></div></div></div>';
    const slot = LC.$('#cp-body', el);
    if (chatBody) slot.replaceWith(chatBody);
    else {
      chatBody = slot; welcome();
      chatBody.addEventListener('click', onClick);
    }
    LC.$('#cp-form', el).addEventListener('submit', (e) => { e.preventDefault(); const i = LC.$('#cp-in', el); const v = i.value; i.value = ''; ask(v); });
    LC.$('#cp-clear', el).addEventListener('click', () => { chatBody.innerHTML = ''; lastUnits = []; lastClient = null; welcome(); });
    LC.$$('.cp-sug .chip', el).forEach(b => b.addEventListener('click', () => ask(b.dataset.ask)));
    setupVoice(el);
    aiNote();
    chatBody.scrollTop = chatBody.scrollHeight;
  },
  onHide() { if (rec) { try { rec.abort(); } catch (e) { } rec = null; } },
});

function aiNote() { const n = LC.$('#cp-ai-note'); if (n) n.innerHTML = LC.ai && LC.ai.sample ? '<span class="ai-tag">' + LC.aiName + '</span> is on: if a question is not in the list, I will try it with ' + LC.aiName + ' using only the page data.' : 'Free-form questions outside this list are passed to a person.'; }
LC.on('ai:ready', aiNote);
LC.on('reset', () => { lastUnits = []; lastClient = null; chatBody = null; busy = false; });

function onClick(e) {
  const t = e.target.closest('[data-act],[data-unit],[data-client],[data-lead],[data-ask]'); if (!t || !chatBody.contains(t)) return;
  if (t.dataset.ask) return void ask(t.dataset.ask);
  if (t.dataset.unit) return void call('openUnit', t.dataset.unit);
  if (t.dataset.client) return void call('openClient', t.dataset.client);
  if (t.dataset.lead) return void call('openLead', t.dataset.lead);
  if (t.dataset.act != null) { const m = t.closest('.msg.ai'); const a = m && m._acts[+t.dataset.act]; if (a) a.fn(); }
}

LC.copilot = { ask, route: (q) => { const a = route(q); return a ? a.intent : null; } };
})();
