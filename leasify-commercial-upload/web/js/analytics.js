/* =====================================================================
   Leasify Commercial demo: ANALYTICS
   Ten sections, each a card with a chart or table drawn to scale and a
   one-line definition. Charts are inline SVG sized to their container.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc, DAY = LC.DAY;

LC.css(`
.an-bar { display: flex; gap: 12px 18px; align-items: center; flex-wrap: wrap; }
.an-bar .small { max-width: 70ch; }
.an-ch { min-width: 0; }
.an-def { margin: 12px 0 0; font-size: 12px; color: var(--muted); border-left: 2px solid var(--brand); padding: 2px 0 2px 10px; }
.an-sub { font-size: 12px; font-weight: 600; color: var(--fg-2); margin: 0 0 6px; }
.an-n { font-family: var(--f-mono); font-size: 11px; color: var(--muted); font-weight: 400; }
.an-big { display: flex; gap: 10px 28px; flex-wrap: wrap; margin-bottom: 14px; }
.an-big div { display: grid; gap: 0; }
.an-big b { font-family: var(--f-head); font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.an-big span { font-size: 12px; color: var(--muted); }
.an-low { font-size: 10.5px; color: var(--muted); border: 1px solid var(--hair); border-radius: 4px; padding: 0 4px; margin-left: 6px; white-space: nowrap; }
svg.chart .an-b { fill: var(--brand); }
svg.chart .an-b2 { fill: var(--s4); }
svg.chart .an-good { fill: var(--good); }
svg.chart .an-warn { fill: var(--warn); }
svg.chart .an-bad { fill: var(--bad); }
svg.chart .an-sub-t { fill: var(--muted); font-size: 10.5px; }
svg.chart .an-lab { fill: var(--fg-2); }
svg.chart .an-click { cursor: pointer; }
svg.chart .an-click:hover .an-b, svg.chart .an-click:focus .an-b { filter: brightness(1.15); }
svg.chart .an-click:focus { outline: none; }
svg.chart .an-click:focus-visible .an-lab { text-decoration: underline; }
.an-sec { display: grid; gap: 20px; }
.an-wide { overflow-wrap: anywhere; }
.an-tbl td.sm, .an-tbl th.sm { white-space: nowrap; }
@media (max-width: 860px) { .an-big b { font-size: 22px; } }
`);

const PERIODS = [7, 30, 70];
let period = 30;
let rootEl = null, lastW = 0, roT = null, refT = null, ro = null;
const draws = [];               // chart drawers for the current render

/* ---------------- helpers ---------------- */
const dash = '–';
const fnum = (v) => v == null || isNaN(v) ? dash : LC.fmtNum(v);
const fpct = (a, b, d = 0) => b > 0 ? (a / b * 100).toFixed(d) + '%' : dash;
const med = (arr) => arr.length ? LC.median(arr) : null;
function fmtSec(s) { return s == null || isNaN(s) ? dash : s < 90 ? Math.round(s) + ' s' : (s / 60).toFixed(1) + ' min'; }
function fmtMin(m) { if (m == null || isNaN(m)) return dash; if (m < 90) return Math.round(m) + ' min'; if (m < 60 * 36) return (m / 60).toFixed(1) + ' h'; return (m / 1440).toFixed(1) + ' d'; }
function fmtD(d) { return d == null || isNaN(d) ? dash : (Math.round(d * 10) / 10) + ' d'; }
function trunc(s, chars) { s = String(s); return s.length <= chars ? s : s.slice(0, Math.max(1, chars - 1)) + '…'; }
function lowN(n, min = 10) { return n < min ? '<span class="an-low" title="Fewer than ' + min + ' records: read with care">low n</span>' : ''; }
const readable = { enquiries: 'Enquiries', qualified: 'Qualified', visits: 'Site visits done', proposals: 'Proposals', lois: 'Letters of intent', signed: 'Signed leases', firstReply: 'First AI reply', firstHuman: 'First human contact', daysVacant: 'Days vacant', askingVsAchieved: 'Asking vs achieved rent', sourceToClose: 'Source to close', noShow: 'No-show rate' };
const prettyKey = (k) => readable[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

/* ---------------- data for the chosen period ---------------- */
function data() {
  const S = LC.state, now = Date.now(), start = now - period * DAY;
  const clients = S.clients.filter(c => c.createdAt >= start);
  const visits = S.visits.filter(v => v.when >= start && v.when <= now);
  return { S, now, start, clients, visits };
}
const reached = (c, s) => LC.stageReached(c, s);
const stageTs = (c, stage) => { const h = (c.stageHistory || []).find(x => x.stage === stage); return h ? h.ts : null; };

/* ---------------- SVG chart builders ---------------- */
function endRound(x, y, w, h, r) {            // left edge square (on the axis), right end rounded
  r = Math.min(r, w, h / 2);
  return 'M' + x + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + x + 'Z';
}
function topRound(x, y, w, h, r) {            // bottom edge square (on the baseline), top rounded
  r = Math.min(r, w / 2, h);
  return 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z';
}
/** Horizontal bars. rows: {label, sub?, v, text, cls?, id?, title?}. Drawn at 1:1 scale for width w. */
function hbar(rows, w, aria, o = {}) {
  if (!rows.length) return '';
  const hasSub = rows.some(r => r.sub);
  const rh = o.rh || (hasSub ? 40 : 27), bh = 12;
  const lw = o.lw || Math.round(Math.min(168, Math.max(86, w * 0.36)));
  const tail = Math.max(...rows.map(r => String(r.text).length)) * 6.8 + 10;
  const bw = Math.max(24, w - lw - tail);
  const max = o.max || Math.max(...rows.map(r => r.v), 0) || 1;
  const H = rows.length * rh + 2;
  const chars = Math.floor((lw - 6) / 5.9);
  let g = '';
  rows.forEach((r, i) => {
    const y = i * rh, by = y + (hasSub ? 8 : (rh - bh) / 2), len = r.v > 0 ? Math.max(3, r.v / max * bw) : 0;
    const ty = hasSub ? y + 17 : y + rh / 2 + 4;
    const inner = '<title>' + esc((r.title || r.label) + ': ' + r.text) + '</title>' +
      '<text x="0" y="' + ty + '" class="an-lab">' + esc(trunc(r.label, chars)) + '</text>' +
      (r.sub ? '<text x="0" y="' + (ty + 14) + '" class="an-sub-t">' + esc(trunc(r.sub, chars + 4)) + '</text>' : '') +
      (len ? '<path d="' + endRound(lw, by, len, bh, 4) + '" class="' + (r.cls || 'an-b') + '"/>' : '') +
      '<text x="' + (lw + len + 6) + '" y="' + (by + bh - 2) + '" class="lbl">' + esc(r.text) + '</text>';
    g += r.id ? '<g class="an-click" data-unit="' + esc(r.id) + '" role="link" tabindex="0" aria-label="Open ' + esc(r.title || r.label) + '">' + inner + '</g>' : '<g>' + inner + '</g>';
  });
  return '<svg class="chart" viewBox="0 0 ' + w + ' ' + H + '" width="' + w + '" height="' + H + '" role="img" aria-label="' + esc(aria) + '"><line x1="' + lw + '" x2="' + lw + '" y1="0" y2="' + (H - 2) + '" class="ax"/>' + g + '</svg>';
}
function niceMax(m) { if (m <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
/** Vertical bars. rows: {label, v, text, cls?, title?} */
function vbar(rows, w, aria) {
  const H = 210, mt = 22, mb = 26, ml = 30, mr = 6, ph = H - mt - mb;
  const max = niceMax(Math.max(...rows.map(r => r.v), 0) || 1);
  const band = (w - ml - mr) / rows.length, bw = Math.min(46, band * 0.64);
  const step = Math.max(1, Math.ceil(46 / band));
  let g = '';
  [0, 0.5, 1].forEach(t => {
    const y = mt + ph - t * ph;
    g += '<line x1="' + ml + '" x2="' + (w - mr) + '" y1="' + y + '" y2="' + y + '" class="' + (t === 0 ? 'ax' : 'gl') + '"/><text x="' + (ml - 5) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(max * t) + '</text>';
  });
  rows.forEach((r, i) => {
    const cx = ml + band * i + band / 2, h = r.v / max * ph, x = cx - bw / 2, y = mt + ph - h;
    g += '<g><title>' + esc((r.title || r.label) + ': ' + r.text) + '</title>' + (h > 0 ? '<path d="' + topRound(x, y, bw, Math.max(2, h), 4) + '" class="' + (r.cls || 'an-b') + '"/>' : '') +
      '<text x="' + cx + '" y="' + (y - 6) + '" text-anchor="middle" class="lbl">' + esc(r.text) + '</text>' +
      ((rows.length - 1 - i) % step === 0 ? '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(r.label) + '</text>' : '') + '</g>';
  });
  return '<svg class="chart" viewBox="0 0 ' + w + ' ' + H + '" width="' + w + '" height="' + H + '" role="img" aria-label="' + esc(aria) + '">' + g + '</svg>';
}

/* register a chart slot: returns the placeholder markup, remembers how to draw it */
function slot(id, fn) { draws.push({ id, fn }); return '<div class="an-ch" id="an-ch-' + id + '"></div>'; }
function drawCharts() {
  draws.forEach(d => { const e = LC.$('#an-ch-' + d.id, rootEl); if (!e) return; const w = Math.floor(e.clientWidth) || 300; e.innerHTML = d.fn(w) || LC.empty('No data in this period.'); });
}
const defP = (t) => '<p class="an-def">' + t + '</p>';
const card = (title, body, extra = '') => '<div class="card"><div class="card-h"><h2>' + esc(title) + '</h2><span class="spacer"></span>' + extra + '</div><div class="card-b">' + body + '</div></div>';

/* ---------------- sections ---------------- */
function secEnquiries(D) {
  const weeks = Math.ceil(period / 7), rows = [];
  for (let k = weeks - 1; k >= 0; k--) {
    const hi = D.now - k * 7 * DAY, lo = Math.max(D.start, hi - 7 * DAY), days = Math.round((hi - lo) / DAY);
    const n = D.clients.filter(c => c.createdAt >= lo && c.createdAt < hi + (k === 0 ? 1 : 0)).length;
    rows.push({ label: LC.fmtDate(new Date(lo)), v: n, text: String(n), cls: days < 7 ? 'an-b2' : 'an-b', title: 'Week from ' + LC.fmtDate(new Date(lo)) + (days < 7 ? ' (' + days + ' days only)' : '') });
  }
  const partial = rows.some(r => r.cls === 'an-b2');
  const by = LC.groupBy(D.clients, c => c.source); const src = Object.keys(by).map(k => ({ s: k, n: by[k].length })).sort((a, b) => b.n - a.n);
  const total = D.clients.length;
  const tbl = '<div class="tbl-wrap"><table class="tbl an-tbl"><thead><tr><th>Source</th><th class="r">Enquiries</th><th class="r">Share</th></tr></thead><tbody>' +
    src.map(x => '<tr><td>' + esc(x.s) + '</td><td class="r num">' + x.n + '</td><td class="r num">' + fpct(x.n, total) + '</td></tr>').join('') +
    '<tr><td><b>All sources</b></td><td class="r num"><b>' + total + '</b></td><td class="r num">100%</td></tr></tbody></table></div>';
  return '<div class="split"><div class="card"><div class="card-h"><h2>Enquiries per week</h2><span class="spacer"></span><span class="an-n">n = ' + total + '</span></div><div class="card-b">' +
    slot('enq', w => vbar(rows, w, 'Bar chart of enquiries per week over the last ' + period + ' days. ' + rows.map(r => r.label + ': ' + r.text).join('; ') + '.')) +
    defP(esc(LC.METRICS.enquiries) + ' Each bar is one week, labelled with its first day.' + (partial ? ' The lighter bar covers fewer than 7 days.' : '')) + '</div></div>' +
    card('Enquiries by source', total ? tbl : LC.empty('No enquiries in this period.'), '<span class="an-n">n = ' + total + '</span>') + '</div>';
}
function secFunnel(D) {
  const f = LC.funnel(D.clients); const rows = f.map((x, i) => ({ label: x.stage, sub: i ? fpct(x.n, f[i - 1].n) + ' of previous stage' : 'All clients created', v: x.n, text: String(x.n), title: x.stage + ' (' + (LC.STAGE_DEFS[x.stage] || '') + ')' }));
  const sg = f[5].n;
  return card('Funnel', slot('fun', w => hbar(rows, w, 'Horizontal bar chart of clients reaching each stage: ' + f.map(x => x.stage + ' ' + x.n).join('; ') + '.')) +
    defP('Clients created in the period that reached each stage, and the share that moved on from the stage before. Enquiry to signed lease: ' + fpct(sg, f[0].n, 1) + ' (' + sg + ' of ' + f[0].n + '). ' + esc(LC.METRICS.qualified) + ' ' + esc(LC.METRICS.proposals)), '<span class="an-n">n = ' + f[0].n + '</span>');
}
function secSource(D) {
  const by = LC.groupBy(D.clients, c => c.source);
  const rows = Object.keys(by).map(k => { const a = by[k]; return { s: k, n: a.length, q: a.filter(c => reached(c, 'Qualified')).length, v: a.filter(c => reached(c, 'Site visit')).length, sg: a.filter(c => reached(c, 'Signed lease')).length }; })
    .sort((a, b) => b.sg - a.sg || b.n - a.n);
  const body = !rows.length ? LC.empty('No enquiries in this period.') : '<div class="tbl-wrap"><table class="tbl an-tbl"><thead><tr><th>Source</th><th class="r">Enquiries</th><th class="r" title="Share of enquiries that reached Qualified">Qualified %</th><th class="r" title="Clients who reached the Site visit stage">Visited</th><th class="r">Signed</th><th class="r" title="' + esc(LC.METRICS.sourceToClose) + '">Source to close %</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td>' + esc(r.s) + lowN(r.n) + '</td><td class="r num">' + r.n + '</td><td class="r num">' + fpct(r.q, r.n) + '</td><td class="r num">' + r.v + '</td><td class="r num">' + r.sg + '</td><td class="r num">' + fpct(r.sg, r.n, 1) + '</td></tr>').join('') +
    '</tbody></table></div>';
  return card('Source to close', body + defP(esc(LC.METRICS.sourceToClose) + ' Sorted by signed leases, then enquiries. "Visited" counts clients who reached the Site visit stage. Sources with fewer than 10 enquiries are marked low n: do not rank them on this alone.'), '<span class="an-n">n = ' + D.clients.length + '</span>');
}
function secSpeed(D) {
  const ai = D.clients.filter(c => typeof c.firstReplySec === 'number').map(c => c.firstReplySec);
  const hu = D.clients.filter(c => typeof c.firstHumanMin === 'number').map(c => c.firstHumanMin);
  const agents = LC.TEAM.map(t => t.name);
  const per = (field, fmt) => agents.map(a => { const v = D.clients.filter(c => c.agent === a && typeof c[field] === 'number').map(c => c[field]); return { a, n: v.length, m: med(v) }; })
    .filter(x => x.n).map(x => ({ label: x.a, sub: 'n = ' + x.n, v: x.m, text: fmt(x.m) }));
  const aiR = per('firstReplySec', fmtSec), huR = per('firstHumanMin', fmtMin);
  return card('Speed', '<div class="an-big"><div><b>' + fmtSec(med(ai)) + '</b><span>Median first AI reply (n = ' + ai.length + ')</span></div><div><b>' + fmtMin(med(hu)) + '</b><span>Median first human contact (n = ' + hu.length + ')</span></div></div>' +
    '<div class="grid-2"><div><p class="an-sub">First human contact, by agent (median)</p>' + slot('sp-h', w => hbar(huR, w, 'Bar chart of median minutes to first human contact by agent: ' + huR.map(r => r.label + ' ' + r.text).join('; ') + '.')) + '</div>' +
    '<div><p class="an-sub">First AI reply, by owning agent (median)</p>' + slot('sp-a', w => hbar(aiR, w, 'Bar chart of median seconds to first AI reply by owning agent: ' + aiR.map(r => r.label + ' ' + r.text).join('; ') + '.')) + '</div></div>' +
    defP(esc(LC.METRICS.firstReply) + ' ' + esc(LC.METRICS.firstHuman) + ' Walk-ins count as 0 minutes. The AI replies the same way whoever owns the client; the per-agent view shows the client mix, not AI speed.'), '<span class="an-n">n = ' + D.clients.length + '</span>');
}
function secVisits(D) {
  const v = D.visits, done = v.filter(x => x.status === 'Done'), ns = v.filter(x => x.status === 'No-show');
  const signed = D.clients.filter(c => reached(c, 'Signed lease')).length;
  const rated = done.filter(x => typeof x.rating === 'number');
  const avg = rated.length ? (LC.sum(rated, x => x.rating) / rated.length).toFixed(1) : null;
  const t = (b, s, ttl) => '<div title="' + esc(ttl) + '"><b>' + b + '</b><span>' + s + '</span></div>';
  const upcoming = LC.state.visits.filter(x => x.status === 'Booked' && x.when > D.now && x.when < D.now + 7 * DAY).length;
  return card('Visits', '<div class="mini-kpis">' + t(done.length, 'Visits done', LC.METRICS.visits) + t(fpct(ns.length, v.length, 1), 'No-show rate (' + ns.length + ' of ' + v.length + ')', LC.METRICS.noShow) +
    t(signed ? (done.length / signed).toFixed(1) : dash, 'Visits per signed lease (' + signed + ' signed)', 'Visits done in the period divided by leases signed by clients created in the period.') + t(avg || dash, 'Average rating, 1 to 5 (n = ' + rated.length + ')', 'Average of the 1 to 5 rating the agent records after each visit.') + '</div>' +
    defP(esc(LC.METRICS.visits) + ' ' + esc(LC.METRICS.noShow) + ' Counts visits scheduled in the period that are already due. ' + upcoming + ' more are booked for the next 7 days.'), '<span class="an-n">n = ' + v.length + ' visits</span>');
}
function secInventory(D) {
  const S = D.S, avail = S.units.filter(u => u.status === 'Available'), today = LC.today();
  const vac = avail.map(u => ({ u, d: Math.max(0, LC.daysBetween(u.available_from, today)) })).sort((a, b) => b.d - a.d).slice(0, 15);
  const noVacancy = !vac.length || vac[0].d === 0;      // every available unit is ready today or later
  const listed = avail.map(u => ({ u, d: Math.max(0, LC.daysBetween(u.listed_date, today)) })).sort((a, b) => b.d - a.d).slice(0, 15);
  const readyNow = avail.filter(u => LC.daysBetween(u.available_from, today) >= 0).length;
  const src = noVacancy ? listed : vac;
  const vrows = src.map(x => ({ label: x.u.unit_id, sub: trunc(x.u.building_name, 22), v: x.d, text: x.d + ' d', id: x.u.unit_id, title: LC.unitShort(x.u), cls: !noVacancy && x.d > 60 ? 'an-warn' : 'an-b' }));
  const byCity = LC.groupBy(avail, u => LC.cityOf(u));
  const crows = Object.keys(byCity).map(c => ({ label: c, sub: byCity[c].length + ' units', v: LC.sum(byCity[c], u => u.chargeable_sqft), text: LC.fmtNum(LC.sum(byCity[c], u => u.chargeable_sqft)) + ' sq ft' })).sort((a, b) => b.v - a.v);
  const fr = { f: 0, a: 0, s: 0 }; avail.forEach(u => { const d = LC.unitFreshness(u).days; if (d <= 7) fr.f++; else if (d <= 14) fr.a++; else fr.s++; });
  const frows = [{ label: 'Within 7 days', v: fr.f, text: String(fr.f), cls: 'an-good' }, { label: '8 to 14 days', v: fr.a, text: String(fr.a), cls: 'an-warn' }, { label: '15+ days', v: fr.s, text: String(fr.s), cls: 'an-bad' }];
  return '<div class="split r"><div class="card"><div class="card-h"><h2>Inventory</h2><span class="spacer"></span><span class="an-n">n = ' + avail.length + ' available units, today</span></div><div class="card-b">' +
    '<p class="an-sub">Available square feet by city</p>' + slot('inv-c', w => hbar(crows, w, 'Bar chart of available square feet by city: ' + crows.map(r => r.label + ' ' + r.text).join('; ') + '.')) +
    '<p class="an-sub" style="margin-top:18px">Days since the owner last confirmed</p>' + slot('inv-f', w => hbar(frows, w, 'Bar chart of available units by how recently the owner confirmed: ' + frows.map(r => r.label + ' ' + r.text).join('; ') + '.', { lw: Math.min(110, Math.round(w * 0.4)) })) +
    defP('Freshness: days since the owner last confirmed availability and terms. Units over ' + LC.settings().freshnessDays + ' days are not sent to occupiers.') + '</div></div>' +
    '<div class="card"><div class="card-h"><h2>' + (noVacancy ? 'Days on the market, top 15' : 'Days vacant, top 15') + '</h2><span class="spacer"></span><span class="small muted">Click a bar to open the listing</span></div><div class="card-b">' +
    slot('inv-v', w => hbar(vrows, w, (noVacancy ? 'Bar chart of days since listing for the 15 longest-listed available units: ' : 'Bar chart of days vacant for the 15 longest-vacant available units: ') + vrows.map(r => r.label + ' ' + r.text).join('; ') + '.')) + defP(esc(LC.METRICS.daysVacant) + ' Zero if the unit is not yet available.' + (noVacancy ? ' Right now no available unit has passed its available-from date (' + readyNow + ' are ready today, the rest are coming), so days vacant is 0 for all of them. This chart shows days since listing instead.' : '') + (noVacancy ? '' : ' Bars over 60 days are shown in amber.')) + '</div></div></div>';
}
function secRent(D) {
  const rows = D.clients.filter(c => reached(c, 'Signed lease') && c.achievedPsf != null).map(c => { const u = c.unitId ? LC.unit(c.unitId) : null; return { c, u, ask: u ? u.rent_per_sqft : null, ach: c.achievedPsf }; });
  const ratios = rows.filter(r => r.ask).map(r => r.ach / r.ask);
  const avg = ratios.length ? LC.sum(ratios) / ratios.length : null;
  const body = !rows.length ? LC.empty('No leases signed by clients created in this period. Try a longer period.') :
    '<div class="tbl-wrap"><table class="tbl an-tbl"><thead><tr><th>Unit</th><th>Client</th><th class="r">Asking rent</th><th class="r">Achieved rent</th><th class="r">Achieved / asking</th></tr></thead><tbody>' +
    rows.map(r => '<tr' + (r.u ? ' class="click" data-unit="' + esc(r.u.unit_id) + '"' : '') + '><td>' + (r.u ? '<span class="unit-id">' + esc(r.u.unit_id) + '</span> <span class="muted">' + esc(r.u.building_name) + '</span>' : esc(r.c.unitId || dash)) + '</td><td>' + esc(r.c.company || r.c.name) + '</td><td class="r num">' + (r.ask ? '₹' + r.ask + '/sq ft' : dash) + '</td><td class="r num">₹' + r.ach + '/sq ft</td><td class="r num">' + (r.ask ? Math.round(r.ach / r.ask * 100) + '%' : dash) + '</td></tr>').join('') +
    '<tr><td colspan="4"><b>Average</b> <span class="muted">(rent only, before maintenance; n = ' + ratios.length + ')</span></td><td class="r num"><b>' + (avg == null ? dash : (avg * 100).toFixed(1) + '%') + '</b></td></tr></tbody></table></div>';
  return card('Asking vs achieved rent', body + defP(esc(LC.METRICS.askingVsAchieved) + ' Signed leases from clients created in the period.'), '<span class="an-n">n = ' + rows.length + (rows.length === 1 ? ' lease' : ' leases') + '</span>');
}
function secTeam(D) {
  const rows = LC.TEAM.map(t => {
    const mine = D.clients.filter(c => c.agent === t.name);
    const open = LC.state.clients.filter(c => c.agent === t.name && !['Lost', 'Signed lease', 'Nurture'].includes(c.stage)).length;
    const days = mine.map(c => { const ts = stageTs(c, 'Site visit'); return ts ? (ts - c.createdAt) / DAY : null; }).filter(x => x != null);
    return { t, open, done: D.visits.filter(v => v.agent === t.name && v.status === 'Done').length, prop: mine.filter(c => reached(c, 'Proposal')).length, sg: mine.filter(c => reached(c, 'Signed lease')).length, d: med(days), dn: days.length, n: mine.length };
  });
  const body = '<div class="tbl-wrap"><table class="tbl an-tbl"><thead><tr><th>Team member</th><th class="r" title="Clients right now that are not Lost, Signed or in Nurture">Open clients</th><th class="r">Visits done</th><th class="r">Proposals</th><th class="r">Signed</th><th class="r" title="Median days from enquiry to the Site visit stage">Median days to visit</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td>' + esc(r.t.name) + '<div class="small muted">' + esc(r.t.role) + ' · ' + esc(r.t.cities.join(', ')) + '</div></td><td class="r num">' + r.open + '</td><td class="r num">' + r.done + '</td><td class="r num">' + r.prop + '</td><td class="r num">' + r.sg + '</td><td class="r num">' + fmtD(r.d) + (r.dn ? ' <span class="muted">(n = ' + r.dn + ')</span>' : '') + '</td></tr>').join('') + '</tbody></table></div>';
  return card('Team', body + defP('Open clients is today\'s count. Visits, proposals and signed leases cover the chosen period (proposals and signed use clients created in it). Median days to visit is the middle time from enquiry to the Site visit stage, for clients who got there.'), '<span class="an-n">n = ' + D.clients.length + ' clients</span>');
}
function secLost(D) {
  const lost = D.clients.filter(c => c.stage === 'Lost'); const by = LC.groupBy(lost, c => c.lostReason || 'No reason recorded');
  const rows = Object.keys(by).map(k => ({ label: k, v: by[k].length, text: by[k].length + ' (' + fpct(by[k].length, lost.length) + ')' })).sort((a, b) => b.v - a.v);
  return card('Lost reasons', (rows.length ? slot('lost', w => hbar(rows, w, 'Bar chart of why clients were lost: ' + rows.map(r => r.label + ' ' + r.v).join('; ') + '.', { lw: Math.min(230, Math.round(w * 0.5)), rh: 30 })) : LC.empty('No clients lost in this period.')) +
    defP('The reason the agent recorded when closing the client as Lost. Clients created in the period only. Lost: ' + esc(LC.STAGE_DEFS['Lost'])), '<span class="an-n">n = ' + lost.length + ' lost of ' + D.clients.length + '</span>');
}
function secLive(D) {
  const leads = D.S.leads; if (!leads.length) return '';
  const names = { ai: 'AI is replying', handoff: 'Waiting for a person', human: 'With a person', booked: 'Visit booked', nurture: 'Nurture', closed: 'Closed' };
  const bs = LC.groupBy(leads, l => l.status); const srows = Object.keys(names).filter(k => bs[k]).map(k => ({ label: names[k], v: bs[k].length, text: String(bs[k].length) }));
  const br = LC.groupBy(D.S.queue, q => q.ruleName || q.rule); const rrows = Object.keys(br).map(k => ({ label: k, v: br[k].length, text: String(br[k].length) })).sort((a, b) => b.v - a.v);
  const fr = leads.filter(l => typeof l.firstReplyMs === 'number' && l.firstReplyMs > 0).map(l => l.firstReplyMs / 1000);
  return card('Live AI agent', '<div class="an-big"><div><b>' + fmtSec(med(fr)) + '</b><span>Median first reply (n = ' + fr.length + ')</span></div><div><b>' + leads.length + '</b><span>Conversations</span></div><div><b>' + D.S.queue.length + '</b><span>Handoffs to a person</span></div></div>' +
    '<div class="grid-2"><div><p class="an-sub">Conversations by status</p>' + slot('lv-s', w => hbar(srows, w, 'Bar chart of conversations by status: ' + srows.map(r => r.label + ' ' + r.text).join('; ') + '.', { lw: Math.min(150, Math.round(w * 0.5)) })) + '</div>' +
    '<div><p class="an-sub">Handoffs by rule</p>' + (rrows.length ? slot('lv-r', w => hbar(rrows, w, 'Bar chart of handoffs by rule: ' + rrows.map(r => r.label + ' ' + r.text).join('; ') + '.', { lw: Math.min(180, Math.round(w * 0.55)) })) : LC.empty('No handoffs yet.')) + '</div></div>' +
    defP('From the lead inbox, all time since the simulator started. ' + esc(LC.METRICS.firstReply) + ' A handoff is a conversation passed to a person by one of the rules in Settings and rules.'), '<span class="an-n">n = ' + leads.length + ' conversations</span>');
}
function secDefs() {
  return card('Metric definitions', '<div class="grid-2"><div><p class="an-sub">Metrics</p><dl class="defs">' + Object.keys(LC.METRICS).map(k => '<dt>' + esc(prettyKey(k)) + '</dt><dd>' + esc(LC.METRICS[k]) + '</dd>').join('') + '</dl></div>' +
    '<div><p class="an-sub">Stages</p><dl class="defs">' + LC.STAGES.concat(LC.OFF_STAGES).map(s => '<dt>' + esc(s) + '</dt><dd>' + esc(LC.STAGE_DEFS[s] || '') + '</dd>').join('') + '</dl></div></div>');
}

/* ---------------- view ---------------- */
function build(el) {
  draws.length = 0;
  const D = data();
  el.innerHTML =
    '<div class="an-bar"><div class="seg" role="group" aria-label="Period">' + PERIODS.map(p => '<button type="button" data-p="' + p + '" aria-pressed="' + (p === period) + '">Last ' + p + ' days</button>').join('') + '</div>' +
    '<span class="small muted">' + D.clients.length + ' clients created since ' + esc(LC.fmtDate(new Date(D.start))) + '. Sample data covers 70 days. Small groups show their n.</span></div>' +
    '<div class="an-sec">' + secEnquiries(D) + secFunnel(D) + secSource(D) + secSpeed(D) + secVisits(D) + secInventory(D) + secRent(D) + secTeam(D) + secLost(D) + secLive(D) + secDefs() + '</div>';
  drawCharts(); lastW = el.clientWidth;
}
function rebuild() {
  if (!rootEl || !LC.isActive('analytics')) return;
  const y = window.scrollY; build(rootEl); window.scrollTo(0, y);
}

LC.registerView('analytics', {
  title: 'Analytics', sub: "What's working, by source, unit, area and team member",
  render(el) {
    rootEl = el; build(el);
    el.onclick = (e) => {
      const p = e.target.closest('[data-p]'); if (p) { period = +p.dataset.p; rebuild(); return; }
      const u = e.target.closest('[data-unit]'); if (u && LC.openUnit) LC.openUnit(u.dataset.unit);
    };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { const u = e.target.closest && e.target.closest('g[data-unit]'); if (u) { e.preventDefault(); LC.openUnit && LC.openUnit(u.dataset.unit); } } };
    if (ro) ro.disconnect();
    if (window.ResizeObserver) { ro = new ResizeObserver(() => { clearTimeout(roT); roT = setTimeout(() => { if (rootEl && LC.isActive('analytics') && Math.abs(rootEl.clientWidth - lastW) > 2) { lastW = rootEl.clientWidth; drawCharts(); } }, 150); }); ro.observe(el); }
  },
  onHide() { if (ro) ro.disconnect(); },
});

['clients:changed', 'visits:changed', 'units:changed', 'queue:changed', 'leads:changed'].forEach(evt => {
  LC.on(evt, () => { if (!LC.isActive('analytics')) return; clearTimeout(refT); refT = setTimeout(rebuild, 2000); });
});
})();
