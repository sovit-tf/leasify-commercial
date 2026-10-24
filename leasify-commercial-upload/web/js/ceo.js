/* =====================================================================
   Leasify Commercial demo: CEO CO-PILOT (view 'ceo')
   Business questions in plain words: money, forecast, team, sources,
   demand vs supply, risks and "what should I focus on".
   A deterministic router answers the known questions from named data and
   written definitions. Claude (LC.ai.sample) is an optional extra for
   free-form questions. Anything else gets an honest "I can't answer that".
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc;
const DAY = LC.DAY;

LC.css(`
.ceo-brief .card-h { gap: 12px; }
.ceo-range { font-size: 12px; color: var(--muted); }
.ceo-kpis { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.ceo-kpis .kpi .v { font-size: 23px; }
.ceo-kpis .kpi .d { line-height: 1.35; }
.ceo-good { color: var(--good); font-weight: 600; }
.ceo-bad { color: var(--bad); font-weight: 600; }
.ceo-flat { color: var(--muted); font-weight: 600; }
.ceo-low { font-size: 10.5px; color: var(--muted); border: 1px solid var(--hair); border-radius: 4px; padding: 0 4px; margin-left: 4px; white-space: nowrap; font-weight: 400; }
.ceo-bullets { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 13.5px; max-width: 96ch; }
.ceo-brief-acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.ceo-how { margin-top: 14px; border-top: 1px solid var(--hair); padding-top: 10px; }
.ceo-how summary { cursor: pointer; font-weight: 600; font-size: 13px; color: var(--brand-ink); }
.ceo-how .defs { margin-top: 10px; }
.ceo-how .tbl-wrap { margin-top: 10px; max-width: 520px; }
.ceo-chat { height: min(780px, calc(100vh - 140px)); min-height: 560px; }
@media (min-width: 1181px) { .ceo-split { grid-template-columns: minmax(0, 1fr) 310px; } }
.msg table.tbl { font-size: 12px; }
.msg .tbl th, .msg .tbl td { padding: 7px 8px; }
.msg .tbl td.r, .msg .tbl td.ceo-nw, .msg .tbl th.ceo-nw { white-space: nowrap; }
.ceo-link.ceo-mono { white-space: nowrap; }
.ceo-chat .card-h { padding: 10px 16px; }
.ceo-chat .chat-input input { flex: 1 1 auto; }
.ceo-chat .chat-input .btn { flex: none; }
select.input.ceo-lang { width: auto; flex: none; padding: 7px 6px; font-size: 12px; }
.ceo-mic[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.ceo-mic svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ceo-foot { padding: 8px 14px 12px; display: grid; gap: 4px; font-size: 11.5px; color: var(--muted); border-top: 1px solid var(--hair); }
.ceo-foot .ceo-guard { color: var(--fg-2); }
.ceo-voice-note { color: var(--warn); }
.ceo-link { background: none; border: 0; padding: 0; margin: 0; font: inherit; font-weight: 600; color: var(--brand-ink); cursor: pointer; text-align: left; text-decoration: underline; text-decoration-color: var(--hair); text-underline-offset: 3px; }
.ceo-link:hover { text-decoration-color: var(--brand); }
.ceo-mono { font-family: var(--f-mono); font-size: .95em; }
.ceo-sub { font-size: 11px; color: var(--muted); font-weight: 400; }
.ceo-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.ceo-lede { font-size: 12.5px; color: var(--fg-2); margin: 0; }
.ceo-typing { color: var(--muted); font-size: 12.5px; }
.ceo-sug { display: grid; gap: 14px; }
.ceo-sug h3 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 0 0 6px; font-family: var(--f-body); }
.ceo-sug .chip { cursor: pointer; }
.msg .ceo-h { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 6px 0 0; }
.msg ul.ceo-list { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 13px; }
.msg ol.ceo-focus { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; counter-reset: f; }
.msg ol.ceo-focus li { counter-increment: f; background: var(--surface); border: 1px solid var(--hair); border-radius: 8px; padding: 10px 12px 10px 40px; position: relative; display: grid; gap: 4px; }
.msg ol.ceo-focus li::before { content: counter(f); position: absolute; left: 10px; top: 10px; width: 22px; height: 22px; border-radius: 50%; background: var(--brand); color: var(--on-brand); display: grid; place-items: center; font-weight: 700; font-size: 11.5px; font-family: var(--f-mono); }
.msg ol.ceo-focus b { font-weight: 600; }
.msg ol.ceo-focus .ceo-why { font-size: 12.5px; color: var(--fg-2); }
.msg .ceo-hl td { background: var(--glow); }
.msg .ceo-gap { display: grid; gap: 8px; }
.msg .ceo-gap-card { background: var(--surface); border: 1px solid var(--hair); border-radius: 8px; padding: 10px 12px; display: grid; gap: 4px; font-size: 12.5px; }
.msg .ceo-gap-card b { font-weight: 600; }
.msg .ceo-bar { display: grid; grid-template-columns: 112px minmax(0, 1fr) 92px; gap: 10px; align-items: center; font-size: 12.5px; }
.msg .ceo-bar + .ceo-bar { margin-top: 6px; }
.msg .ceo-bar .track { height: 10px; background: var(--grid); border-radius: 3px; overflow: hidden; }
.msg .ceo-bar .track i { display: block; height: 100%; background: var(--brand); border-radius: 3px; }
.msg .ceo-bar.hot .track i { background: var(--warn); }
.msg .ceo-bar .val { text-align: right; font-family: var(--f-mono); font-size: 12px; }
.msg .ceo-kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
.msg .ceo-kv div { background: var(--surface); border: 1px solid var(--hair); border-radius: 8px; padding: 8px 10px; display: grid; gap: 0; }
.msg .ceo-kv b { font-family: var(--f-head); font-size: 18px; font-variant-numeric: tabular-nums; }
.msg .ceo-kv span { font-size: 11.5px; color: var(--muted); }
@media (max-width: 860px) {
  .ceo-chat { height: 74vh; min-height: 500px; }
  .msg .ceo-bar { grid-template-columns: 88px minmax(0, 1fr) 78px; }
}
`);

/* ------------------------------------------------------------------ small helpers */
const DASH = '–';
const isNum = (v) => typeof v === 'number' && isFinite(v);
const fN = (v) => isNum(v) ? LC.fmtNum(v) : DASH;
const fM = (v) => isNum(v) ? LC.fmtLakh(v) : DASH;
const fPct = (a, b, d = 0) => (isNum(a) && isNum(b) && b > 0) ? (a / b * 100).toFixed(d) + '%' : DASH;
const fSec = (s) => !isNum(s) ? DASH : s < 90 ? Math.round(s) + ' s' : (s / 60).toFixed(1) + ' min';
const fMin = (m) => { if (!isNum(m)) return DASH; if (m < 90) return Math.round(m) + ' min'; if (m < 36 * 60) return (m / 60).toFixed(1) + ' h'; return (m / 1440).toFixed(1) + ' days'; };
const fDay = (d) => isNum(d) ? Math.round(d) + (Math.round(d) === 1 ? ' day' : ' days') : DASH;
const plural = (n, a, b) => fN(n) + ' ' + (n === 1 ? a : (b || a + 's'));
const med = (a) => a.length ? LC.median(a) : null;
const S = () => LC.state;
const now = () => Date.now();
const nameOf = (c) => c.company || c.name;
const first = (n) => String(n || '').split(' ')[0];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const isOpen = (c) => !['Lost', 'Signed lease', 'Nurture'].includes(c.stage);
const idx = (s) => LC.STAGES.indexOf(s);
const goView = (id, param) => { if (LC.views[id]) LC.go(id, param); else LC.toast('That screen is not loaded in this build.'); };
const callFn = (name, ...a) => { if (typeof LC[name] === 'function') return LC[name](...a); LC.toast('That screen is not loaded in this build.'); };
const pill = (txt, cls, title) => '<span class="pill ' + (cls || '') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(txt) + '</span>';
const lowN = (n, min = 5) => (isNum(n) && n < min) ? '<span class="ceo-low" title="Fewer than ' + min + ' records, so read this with care.">n=' + n + '</span>' : '';
const clLink = (c) => '<button type="button" class="ceo-link" data-client="' + esc(c.id) + '">' + esc(nameOf(c)) + '</button>' + (c.company ? '<div class="ceo-sub">' + esc(c.name) + '</div>' : '');
const unLink = (u) => '<button type="button" class="ceo-link ceo-mono" data-unit="' + esc(u.unit_id) + '">' + esc(u.unit_id) + '</button><div class="ceo-sub">' + esc(u.building_name + ', ' + u.locality) + '</div>';
const unLinkS = (u) => '<button type="button" class="ceo-link ceo-mono" data-unit="' + esc(u.unit_id) + '">' + esc(u.unit_id) + '</button>';
const chips = (qs) => qs && qs.length ? '<div class="chips">' + qs.map(q => '<button type="button" class="chip" data-ask="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' : '';
const list = (items) => '<ul class="ceo-list">' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>';
const hd = (t) => '<div class="ceo-h">' + esc(t) + '</div>';
const kv = (pairs) => '<div class="ceo-kv">' + pairs.map(([v, l, t]) => '<div' + (t ? ' title="' + esc(t) + '"' : '') + '><b>' + v + '</b><span>' + esc(l) + '</span></div>').join('') + '</div>';
function tbl(cols, rows, o = {}) {
  return '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map(c => '<th' + (c.r ? ' class="r"' : c.nw ? ' class="ceo-nw"' : '') + (c.t ? ' title="' + esc(c.t) + '"' : '') + '>' + esc(c.h) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map((r, i) => '<tr' + (o.hl === i ? ' class="ceo-hl"' : '') + '>' + r.map((x, j) => '<td' + (cols[j].r ? ' class="r num"' : cols[j].nw ? ' class="ceo-nw"' : '') + '>' + x + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function A(intent, lead, html, o = {}) { return Object.assign({ intent, lead, html: html || '', actions: [], src: null }, o); }
const act = (label, fn, primary) => ({ label, fn, primary });
const srcOf = (from, def) => ({ from, def });

/* ------------------------------------------------------------------ definitions (shown in the card and in source footers) */
const STAGE_P = { 'Qualified': 0.10, 'Site visit': 0.25, 'Proposal': 0.45, 'Letter of intent': 0.80 };
const DEF = {
  earned: 'Brokerage earned is the brokerage on leases signed in the period. For each lease it is the achieved monthly rent times the unit\'s brokerage months.',
  expected: 'Expected brokerage (open deal) is the monthly rent of the deal\'s unit times that unit\'s brokerage months. The unit is the one linked to the client, or else the client\'s top exact match.',
  weighted: 'Weighted pipeline is expected brokerage times the stage probability, added up over open clients. Probabilities: Qualified 10%, Site visit 25%, Proposal 45%, Letter of intent 80%, New enquiry and Nurture 0%. They are planning assumptions, adjust in Settings later.',
  forecast: 'The 30/60/90-day forecast splits the weighted pipeline by each client\'s move-in date. Signing usually comes before move-in, so cash can arrive earlier than the bucket shows.',
  period: 'This week is the last 7 days and last week is the 7 days before that. This month is the last 30 days and last month is the 30 days before that.',
};

/* ------------------------------------------------------------------ cache (rebuilt when data changes) */
let cache = null;
const dirty = () => { cache = null; };
['clients:changed', 'units:changed', 'visits:changed', 'tasks:changed', 'queue:changed', 'reset'].forEach(e => LC.on(e, dirty));
function memo(key, fn) {
  if (!cache || now() - cache.t > 5000) cache = { t: now(), m: {} };
  if (!(key in cache.m)) cache.m[key] = fn();
  return cache.m[key];
}

/* ------------------------------------------------------------------ time windows and period stats */
function periodDef(kind) { return kind === 'month' ? { kind: 'month', days: 30, cur: 'This month', prev: 'Last month', unit: 'month' } : { kind: 'week', days: 7, cur: 'This week', prev: 'Last week', unit: 'week' }; }
function winOf(kind, off) { const p = periodDef(kind); const end = now() - off * p.days * DAY; return { kind, off, start: end - p.days * DAY, end }; }
const inW = (ts, w) => isNum(ts) && ts > w.start && ts <= w.end;
const rangeText = (w) => LC.fmtDate(new Date(w.start + 1)) + ' to ' + LC.fmtDate(new Date(w.end));
function reachedTs(c, stage) {
  const k = idx(stage); if (k < 0) return null; let best = null;
  (c.stageHistory || []).forEach(h => { if (idx(h.stage) >= k && (best == null || h.ts < best)) best = h.ts; });
  return best;
}
function earned(c) {
  if (isNum(c.brokerage)) return c.brokerage;
  const u = c.unitId ? LC.unit(c.unitId) : null;
  return u && isNum(u.monthly_rent) && isNum(u.brokerage_months) ? Math.round(u.monthly_rent * u.brokerage_months) : 0;
}
function stats(w) {
  const C = S().clients, V = S().visits;
  const enq = C.filter(c => inW(c.createdAt, w));
  const qual = C.filter(c => inW(reachedTs(c, 'Qualified'), w));
  const vis = V.filter(v => v.status === 'Done' && inW(v.when, w));
  const prop = C.filter(c => inW(reachedTs(c, 'Proposal'), w));
  const loi = C.filter(c => inW(reachedTs(c, 'Letter of intent'), w));
  const signed = C.filter(c => inW(reachedTs(c, 'Signed lease'), w));
  const rep = enq.filter(c => isNum(c.firstReplySec)).map(c => c.firstReplySec);
  const hum = enq.filter(c => isNum(c.firstHumanMin)).map(c => c.firstHumanMin);
  const booked = V.filter(v => inW(v.when, w) && (v.status === 'Done' || v.status === 'No-show'));
  const ns = booked.filter(v => v.status === 'No-show').length;
  return {
    w, lists: { enq, qual, prop, loi, signed }, vis,
    n: { enq: enq.length, qual: qual.length, vis: vis.length, prop: prop.length, loi: loi.length, signed: signed.length, rep: rep.length, hum: hum.length, booked: booked.length },
    brokerage: LC.sum(signed, earned), reply: med(rep), human: med(hum), noShow: booked.length ? ns / booked.length : null, noShowN: ns,
  };
}

/* ------------------------------------------------------------------ deals, expected brokerage, weighted pipeline */
function stageSince(c) { const h = (c.stageHistory || []).filter(x => x.stage === c.stage); return h.length ? h[h.length - 1].ts : c.createdAt; }
function dealOf(c) {
  return memo('deal:' + c.id, () => {
    let u = c.unitId ? LC.unit(c.unitId) : null, basis = u ? 'linked unit' : null;
    if (!u && c.req && c.req.use && LC.reqHas(c.req, 'location')) { const r = LC.match(c.req, { limit: 1 }).exact[0]; if (r) { u = r.u; basis = 'best match'; } }
    const ok = u && isNum(u.monthly_rent) && isNum(u.brokerage_months);
    return { c, u: u || null, basis, exp: ok ? Math.round(u.monthly_rent * u.brokerage_months) : null };
  });
}
function deals() {
  return memo('deals', () => S().clients.filter(c => STAGE_P[c.stage]).map(c => {
    const d = dealOf(c), p = STAGE_P[c.stage], since = stageSince(c);
    return Object.assign({}, d, { p, w: isNum(d.exp) ? d.exp * p : 0, since, days: Math.max(0, Math.floor((now() - since) / DAY)) });
  }));
}
function stageAt(c, T) {
  if (T >= now() - 1000) return c.stage;
  if (c.createdAt > T) return null;
  let st = null; (c.stageHistory || []).forEach(h => { if (h.ts <= T) st = h.stage; });
  return st || 'New enquiry';
}
function weightedAt(T) {
  return memo('wp:' + Math.round(T / 60000), () => {
    let w = 0, n = 0;
    S().clients.forEach(c => { const p = STAGE_P[stageAt(c, T)]; if (!p) return; const d = dealOf(c); if (isNum(d.exp)) { w += d.exp * p; n++; } });
    return { w, n };
  });
}
function nextStep(c) {
  const base = { 'Qualified': 'Book a site visit', 'Site visit': 'Send a proposal', 'Proposal': 'Chase the decision', 'Letter of intent': 'Get the lease signed' }[c.stage] || 'Follow up';
  if (c.nextFollowUp) { const late = c.nextFollowUp < now(); return esc(base) + '<div class="ceo-sub' + (late ? ' ceo-bad' : '') + '">' + (late ? 'follow-up overdue since ' : 'follow-up ') + esc(LC.fmtDate(LC.iso(c.nextFollowUp))) + '</div>'; }
  return esc(base);
}
function sharedUnitNote() {
  const by = LC.groupBy(deals().filter(d => isNum(d.exp) && d.u), d => d.u.unit_id);
  const dup = Object.keys(by).filter(k => by[k].length > 1);
  const n = LC.sum(dup, k => by[k].length);
  return n ? ' ' + n + ' deals share ' + dup.length + ' units as their best match, so some brokerage is counted more than once. Read the totals as an upper estimate.' : '';
}
function forecast() {
  return memo('forecast', () => {
    const t0 = +LC.today(); const B = [
      { k: '30', label: 'Next 30 days', hint: 'Move-in within 30 days, or already past', deals: [] },
      { k: '60', label: '31 to 60 days', hint: 'Move-in in 31 to 60 days', deals: [] },
      { k: '90', label: '61 to 90 days', hint: 'Move-in in 61 to 90 days', deals: [] },
      { k: 'far', label: 'Beyond 90 days', hint: 'Move-in more than 90 days away', deals: [] },
      { k: 'none', label: 'No move-in date', hint: 'Move-in date not captured yet', deals: [] },
    ];
    deals().filter(d => isNum(d.exp)).forEach(d => {
      const mi = d.c.req && d.c.req.moveIn ? LC.parseDate(d.c.req.moveIn) : null;
      if (!mi) return B[4].deals.push(d);
      const days = Math.round((+mi - t0) / DAY);
      (days <= 30 ? B[0] : days <= 60 ? B[1] : days <= 90 ? B[2] : B[3]).deals.push(d);
    });
    B.forEach(b => { b.exp = LC.sum(b.deals, d => d.exp); b.w = LC.sum(b.deals, d => d.w); });
    return { buckets: B, total: LC.sum(B, b => b.w), in90: LC.sum(B.slice(0, 3), b => b.w), n: LC.sum(B, b => b.deals.length) };
  });
}

/* ------------------------------------------------------------------ team */
function team() {
  return memo('team', () => {
    const C = S().clients, V = S().visits, w = winOf('month', 0), t = +LC.today();
    return LC.TEAM.map(a => {
      const mine = C.filter(c => c.agent === a.name), open = mine.filter(isOpen);
      const signed = mine.filter(c => inW(reachedTs(c, 'Signed lease'), w));
      const hum = mine.filter(c => inW(c.createdAt, w) && isNum(c.firstHumanMin)).map(c => c.firstHumanMin);
      const overdue = open.filter(c => c.nextFollowUp && c.nextFollowUp < t);
      const vReach = mine.filter(c => reachedTs(c, 'Site visit') != null).length, pReach = mine.filter(c => reachedTs(c, 'Site visit') != null && reachedTs(c, 'Proposal') != null).length;
      return {
        a, mine, open, overdue: overdue.sort((x, y) => x.nextFollowUp - y.nextFollowUp),
        visits: V.filter(v => v.status === 'Done' && v.agent === a.name && inW(v.when, w)).length,
        proposals: mine.filter(c => inW(reachedTs(c, 'Proposal'), w)).length,
        signed: signed.length, brokerage: LC.sum(signed, earned), human: med(hum), humanN: hum.length,
        v2pN: vReach, v2p: vReach ? pReach / vReach : null, v2pHit: pReach,
        oldestOverdue: overdue.length ? Math.floor((t - overdue[0].nextFollowUp) / DAY) : 0,
      };
    });
  });
}

/* ------------------------------------------------------------------ sources */
function sourceRows(w) {
  const C = S().clients.filter(c => !w || inW(c.createdAt, w));
  return LC.SOURCES.map(s => {
    const m = C.filter(c => c.source === s); const signed = m.filter(c => reachedTs(c, 'Signed lease') != null);
    return {
      s, enq: m.length, qual: m.filter(c => reachedTs(c, 'Qualified') != null).length, vis: m.filter(c => reachedTs(c, 'Site visit') != null).length,
      prop: m.filter(c => reachedTs(c, 'Proposal') != null).length, signed: signed.length, brokerage: LC.sum(signed, earned), s2c: m.length ? signed.length / m.length : null,
    };
  }).filter(r => r.enq);
}
function sourceVerdict(rows) {
  const total = LC.sum(rows, r => r.enq), signedAll = LC.sum(rows, r => r.signed), visAll = LC.sum(rows, r => r.vis);
  const pool = rows.filter(r => r.enq >= 6);
  let best = null;
  if (signedAll > 0) best = pool.filter(r => r.signed > 0).sort((a, b) => b.brokerage / b.enq - a.brokerage / a.enq || b.signed - a.signed)[0] || null;
  if (!best) best = pool.slice().sort((a, b) => b.vis / b.enq - a.vis / a.enq)[0] || null;
  const avgVis = total ? visAll / total : 0;
  const weak = pool.filter(r => r.vis / r.enq < avgVis * 0.6 && r.enq >= 8).sort((a, b) => a.vis / a.enq - b.vis / b.enq)[0] || null;
  return { best, weak, total, signedAll, visAll, avgVis };
}

/* ------------------------------------------------------------------ lost deals */
function lostInfo() {
  return memo('lost', () => {
    const C = S().clients, fun = LC.funnel(C);
    const steps = fun.slice(1).map((f, i) => ({ from: fun[i].stage, to: f.stage, a: fun[i].n, b: f.n, lost: fun[i].n - f.n, rate: fun[i].n ? f.n / fun[i].n : null }));
    const cand = steps.filter(s => s.a >= 5 && s.rate != null && s.to !== 'Signed lease');
    const worst = (cand.length ? cand : steps.filter(s => s.rate != null)).slice().sort((x, y) => x.rate - y.rate)[0] || null;
    const lost = C.filter(c => c.stage === 'Lost');
    const byReason = LC.groupBy(lost, c => c.lostReason || 'No reason recorded');
    const reasons = Object.keys(byReason).map(r => ({ r, n: byReason[r].length })).sort((a, b) => b.n - a.n);
    const atStage = {}; lost.forEach(c => { const h = (c.stageHistory || []).filter(x => x.stage !== 'Lost'); const st = h.length ? h[h.length - 1].stage : 'New enquiry'; atStage[st] = (atStage[st] || 0) + 1; });
    const nurture = C.filter(c => c.stage === 'Nurture').length;
    return { fun, steps, worst, lost, reasons, atStage, nurture, total: C.length };
  });
}

/* ------------------------------------------------------------------ demand vs supply */
function demand() {
  return memo('demand', () => {
    const cl = S().clients.filter(c => ['New enquiry', 'Qualified', 'Site visit', 'Proposal', 'Letter of intent'].includes(c.stage) && c.req && c.req.use && LC.reqHas(c.req, 'location'));
    const rows = cl.map(c => {
      const m = LC.match(c.req, { limit: 99 });
      const loc = c.req.localities[0] || null;
      const city = c.req.city || (loc && LC.LOCALITIES[loc] ? LC.LOCALITIES[loc].city.split(' (')[0] : null) || 'Other';
      return { c, use: c.req.use, loc, city, ex: m.exact.map(r => r.u.unit_id), unmet: m.exactCount === 0 && !c.unitId };
    });
    const avail = S().units.filter(LC.isMatchable);
    const monthsFor = (use) => { const us = avail.filter(u => LC.useAllowed(u, use)); return us.length ? LC.sum(us, u => u.brokerage_months) / us.length : 1.5; };
    const build = (level) => {
      const g = LC.groupBy(rows, r => r.use + '|' + (level === 'city' ? r.city : (r.loc || r.city)));
      return Object.keys(g).map(k => {
        const rs = g[k], use = rs[0].use, area = level === 'city' ? rs[0].city : (rs[0].loc || rs[0].city);
        const units = avail.filter(u => LC.useAllowed(u, use) && (level === 'city' ? LC.cityOf(u) === rs[0].city : u.locality === area));
        const fit = new Set(); rs.forEach(r => r.ex.forEach(id => fit.add(id)));
        const un = rs.filter(r => r.unmet);
        const lows = un.map(r => LC.reqSizeBand(r.c.req)).filter(Boolean), buds = un.map(r => LC.reqBudgetPsf(r.c.req)).filter(isNum);
        const stake = LC.sum(un, r => { const sz = LC.reqSizeMid(r.c.req), b = LC.reqBudgetPsf(r.c.req); return isNum(sz) && isNum(b) ? sz * b * monthsFor(use) : 0; });
        const pressure = rs.length / Math.max(1, fit.size);
        const status = un.length && !fit.size ? 'bad' : un.length ? 'warn' : (rs.length >= 3 && pressure >= 2.5) ? 'warn' : 'good';
        return {
          use, area, level, city: rs[0].city, clients: rs, n: rs.length, units: units.length, fit: fit.size, unmet: un.length, unmetClients: un.map(r => r.c), pressure, status, stake,
          sizeLo: lows.length ? Math.round(med(lows.map(b => b[0])) / 50) * 50 : null, sizeHi: lows.length ? Math.round(med(lows.map(b => b[1])) / 50) * 50 : null, budget: buds.length ? Math.round(med(buds)) : null,
        };
      }).sort((a, b) => b.unmet - a.unmet || b.pressure - a.pressure || b.n - a.n);
    };
    const covered = new Set(); rows.forEach(r => r.ex.forEach(id => covered.add(id)));
    const orphan = avail.filter(u => !covered.has(u.unit_id));
    return { rows, city: build('city'), loc: build('loc'), totalUnmet: rows.filter(r => r.unmet).length, n: rows.length, orphan, avail };
  });
}
const areaLabel = (cell) => cell.level === 'loc' ? cell.area + ' (' + cell.city + ')' : cell.area;

/* ------------------------------------------------------------------ inventory: vacancy, health */
function hasOffer(u) {
  return S().clients.some(c => idx(c.stage) >= 3 && (c.unitId === u.unit_id || (c.timeline || []).some(e => e.type === 'document' && String(e.text).includes(u.unit_id))));
}
function similarMedian(u) {
  const sim = S().units.filter(x => x.unit_id !== u.unit_id && x.status === 'Available' && x.property_type === u.property_type && LC.cityOf(x) === LC.cityOf(u));
  return sim.length >= 3 ? { med: med(sim.map(x => x.all_in_per_sqft)), n: sim.length } : null;
}
function stuckUnits() {
  return memo('stuck', () => {
    const V = S().visits;
    return S().units.filter(u => u.status === 'Available').map(u => {
      const days = Math.max(0, LC.daysAgo(u.available_from));
      const vs = V.filter(v => v.unitId === u.unit_id && v.status === 'Done'), offer = hasOffer(u), sm = similarMedian(u);
      const over = sm && isNum(sm.med) && sm.med > 0 ? (u.all_in_per_sqft - sm.med) / sm.med : null;
      let action, kind;
      if (over != null && over > 0.08) { action = 'Price check: ₹' + u.all_in_per_sqft + '/sq ft all-in is ' + Math.round(over * 100) + '% above the ₹' + Math.round(sm.med) + ' median of ' + sm.n + ' similar units. Ask the owner about the rent.'; kind = 'price'; }
      else if (vs.length >= 2 && !offer) { action = vs.length + ' visits but no offer. Call the owner about terms and ask visitors what put them off.'; kind = 'owner'; }
      else if (!vs.length) { action = 'No visits yet. Send it to matching clients and check the photos and listing text.'; kind = 'push'; }
      else if (!offer) { action = 'One visit and no offer. Follow up with that client and ask for feedback.'; kind = 'follow'; }
      else { action = 'An offer exists. Keep the owner updated.'; kind = 'ok'; }
      return { u, days, visits: vs.length, offer, over, sm, action, kind };
    }).sort((a, b) => b.days - a.days);
  });
}
function health() {
  return memo('health', () => {
    const us = S().units, avail = us.filter(u => u.status === 'Available'), t = now(), w30 = t - 30 * DAY;
    const fr = avail.map(u => ({ u, f: LC.unitFreshness(u) }));
    const fresh = fr.filter(x => x.f.days <= 7), aging = fr.filter(x => x.f.days > 7 && x.f.days <= 14), stale = fr.filter(x => x.f.level === 'stale');
    const noReplyTasks = S().tasks.filter(x => !x.done && /no reply/i.test(x.title || ''));
    const byUnit = {}; us.forEach(u => byUnit[u.unit_id] = u);
    const noReplyOwners = new Set(); noReplyTasks.forEach(x => { (String(x.title).match(/LC-\d+/g) || []).forEach(id => { if (byUnit[id]) noReplyOwners.add(byUnit[id].owner_name); }); if (x.unitId && byUnit[x.unitId]) noReplyOwners.add(byUnit[x.unitId].owner_name); });
    const staleOwners = new Set(stale.map(x => x.u.owner_name));
    const flagged = us.filter(u => u.data_flag);
    const listed = us.filter(u => u.listed_date && LC.parseDate(u.listed_date) >= new Date(w30));
    const A = S().audit || [];
    const addedLog = A.filter(a => a.ts >= w30 && a.field === '(new unit)').length;
    const leasedLog = A.filter(a => a.ts >= w30 && a.field === 'status' && /^Leased/.test(a.to)).length;
    const ourLeases = S().clients.filter(c => inW(reachedTs(c, 'Signed lease'), { start: w30, end: t })).length;
    const sync = (S().syncLog || [])[0] || null;
    return { avail, fresh, aging, stale, flagged, noReplyOwners, staleOwners, listed, addedLog, leasedLog, ourLeases, sync };
  });
}

/* ------------------------------------------------------------------ speed and service */
function speed() {
  return memo('speed', () => {
    const w = winOf('month', 0), wp = winOf('month', 1), cur = stats(w), prev = stats(wp);
    const sla = S().settings.slaMinutes || 15;
    const hum = S().clients.filter(c => inW(c.createdAt, w) && isNum(c.firstHumanMin));
    const within = hum.filter(c => c.firstHumanMin <= sla).length, within60 = hum.filter(c => c.firstHumanMin <= 60).length;
    const waiting = LC.queue.waiting(), breached = waiting.filter(q => q.slaDue < now());
    const pend = S().visits.filter(v => v.status === 'Booked' && v.confirmation === 'Pending');
    const pend24 = pend.filter(v => v.when <= now() + 36 * 36e5);
    const tasksLate = S().tasks.filter(t => !t.done && t.type === 'Confirm visit' && t.due < now()).length;
    const slow = hum.slice().sort((a, b) => b.firstHumanMin - a.firstHumanMin).slice(0, 3);
    return { cur, prev, sla, hum, within, within60, waiting, breached, pend, pend24, tasksLate, slow };
  });
}

/* ------------------------------------------------------------------ owners */
function ownerRows() {
  return memo('owners', () => {
    const g = LC.groupBy(S().units, u => u.owner_name), V = S().visits, C = S().clients, D = deals();
    return Object.keys(g).map(name => {
      const us = g[name], ids = new Set(us.map(u => u.unit_id));
      const vis = V.filter(v => v.status === 'Done' && ids.has(v.unitId)).length;
      const signed = C.filter(c => reachedTs(c, 'Signed lease') != null && ids.has(c.unitId));
      const open = D.filter(d => d.u && ids.has(d.u.unit_id) && d.p >= 0.45);
      return {
        name, type: us[0].owner_type, units: us.length, avail: us.filter(u => u.status === 'Available').length, excl: us.filter(u => u.mandate === 'Exclusive').length,
        visits: vis, signed: signed.length, brokerage: LC.sum(signed, earned), open: open.length, openExp: LC.sum(open, d => d.exp || 0),
      };
    }).sort((a, b) => b.brokerage - a.brokerage || b.openExp - a.openExp || b.visits - a.visits || b.units - a.units);
  });
}

/* ------------------------------------------------------------------ metrics list (tiles, compare table, brief) */
function delta(a, b, lower) {
  if (!isNum(a) || !isNum(b)) return { cls: 'flat', arrow: '', txt: DASH, same: false };
  if (a === b) return { cls: 'flat', arrow: '', txt: 'no change', same: true };
  const up = a > b, good = lower ? !up : up;
  return { cls: good ? 'good' : 'bad', arrow: up ? '▲' : '▼', txt: b > 0 ? Math.round(Math.abs(a - b) / b * 100) + '%' : 'from 0', same: false };
}
function metricList(kind, off = 0) {
  const wc = winOf(kind, off), wp = winOf(kind, off + 1), c = stats(wc), p = stats(wp), pc = weightedAt(wc.end), pp = weightedAt(wc.start);
  const M = LC.METRICS;
  const rows = [
    { k: 'enq', label: 'Enquiries', def: M.enquiries, a: c.n.enq, b: p.n.enq, f: fN, n: Math.max(c.n.enq, p.n.enq) },
    { k: 'qual', label: 'Qualified', def: M.qualified, a: c.n.qual, b: p.n.qual, f: fN, n: Math.max(c.n.qual, p.n.qual) },
    { k: 'vis', label: 'Site visits done', def: M.visits, a: c.n.vis, b: p.n.vis, f: fN, n: Math.max(c.n.vis, p.n.vis) },
    { k: 'prop', label: 'Proposals sent', def: M.proposals, a: c.n.prop, b: p.n.prop, f: fN, n: Math.max(c.n.prop, p.n.prop) },
    { k: 'loi', label: 'Letters of intent', def: M.lois, a: c.n.loi, b: p.n.loi, f: fN, n: Math.max(c.n.loi, p.n.loi) },
    { k: 'signed', label: 'Signed leases', def: M.signed, a: c.n.signed, b: p.n.signed, f: fN, n: Math.max(c.n.signed, p.n.signed) },
    { k: 'brokerage', label: 'Brokerage earned', def: DEF.earned, a: c.brokerage, b: p.brokerage, f: fM, n: Math.max(c.n.signed, p.n.signed) },
    { k: 'wp', label: 'Weighted pipeline', def: DEF.weighted, a: pc.w, b: pp.w, f: fM, n: pc.n, prevLabel: 'at the start' },
    { k: 'reply', label: 'Median first reply (AI)', def: M.firstReply, a: c.reply, b: p.reply, f: fSec, lower: true, n: c.n.rep },
    { k: 'human', label: 'Median first human contact', def: M.firstHuman, a: c.human, b: p.human, f: fMin, lower: true, n: c.n.hum },
  ];
  return { kind, off, p: periodDef(kind), wc, wp, c, pr: p, pc, pp, rows };
}

/* ------------------------------------------------------------------ focus rules */
function focusItems() {
  return memo('focus', () => {
    const items = [];
    const T = team(), dm = demand(), hl = health(), sp = speed(), su = stuckUnits(), sv = sourceVerdict(sourceRows(null));
    const openClient = (c) => () => callFn('openClient', c.id);
    // 1. big deals stuck in Proposal or Letter of intent
    deals().filter(d => ['Proposal', 'Letter of intent'].includes(d.c.stage) && d.days > 10 && isNum(d.exp)).sort((a, b) => b.exp - a.exp).slice(0, 2).forEach((d, i) => {
      items.push({ key: 'deal' + i, risk: true, score: 100 - i * 6 + (d.c.stage === 'Letter of intent' ? 4 : 0), title: 'Call ' + nameOf(d.c) + ' about the ' + d.c.stage.toLowerCase(),
        why: d.c.stage + ' for ' + fDay(d.days) + ', owned by ' + first(d.c.agent) + '. Expected brokerage ' + fM(d.exp) + ', ' + fM(d.w) + ' after weighting.', btns: [act('Open client', openClient(d.c), true)] });
    });
    // 2. demand gap
    const gap = dm.loc.find(g => g.unmet >= 2) || dm.loc.find(g => g.unmet >= 1);
    if (gap) items.push({ key: 'gap', risk: true, score: 72 + Math.min(10, gap.unmet * 2), title: 'Source ' + gap.use + ' space in ' + areaLabel(gap),
      why: plural(gap.unmet, 'client') + ' want it and no listed unit fits' + (gap.stake > 0 ? ', worth up to ' + fM(gap.stake) + ' in brokerage' : '') + '.', btns: [act('See the gap', () => ask('What are occupiers asking for that we don\'t have?'), true), act('Open inventory', () => goView('inventory'))] });
    // 3. agent with many overdue follow-ups
    const od = T.filter(t => t.open.length >= 4).sort((a, b) => b.overdue.length - a.overdue.length)[0];
    if (od && od.overdue.length >= 3) items.push({ key: 'agent', risk: true, score: 60 + Math.min(10, od.overdue.length), title: 'Review overdue follow-ups with ' + first(od.a.name),
      why: od.overdue.length + ' of ' + od.open.length + ' open clients are past their follow-up date. The oldest is ' + fDay(od.oldestOverdue) + ' late.', btns: [act('Show their clients', () => goView('crm', { agent: od.a.name }), true)] });
    // 4. stale inventory
    if (hl.stale.length >= 3) items.push({ key: 'stale', risk: true, score: 50 + Math.min(10, hl.stale.length), title: 'Run the owner check',
      why: plural(hl.stale.length, 'available unit') + ' not confirmed for over 14 days. They are held back from clients until the owner replies.', btns: [act('Run owner check', () => callFn('runOwnerCheck'), true)] });
    // 5. a source with leads but few visits
    if (sv.weak) items.push({ key: 'source', risk: true, score: 45, title: 'Check the lead quality from ' + sv.weak.s,
      why: sv.weak.enq + ' enquiries but only ' + sv.weak.vis + ' reached a site visit (' + fPct(sv.weak.vis, sv.weak.enq) + ', against ' + (sv.avgVis * 100).toFixed(0) + '% for all sources).', btns: [act('Open analytics', () => goView('analytics'), true)] });
    // 6. service speed
    if (sp.breached.length) items.push({ key: 'sla', risk: true, score: 68, title: 'Clear the handoff queue',
      why: plural(sp.breached.length, 'occupier') + ' waiting longer than the ' + sp.sla + ' minute target for a person.', btns: [act('Open inbox', () => goView('inbox'), true)] });
    else if (sp.pend24.length >= 3) items.push({ key: 'conf', risk: false, score: 42, title: 'Confirm the visits coming up',
      why: plural(sp.pend24.length, 'visit') + ' in the next day and a half still need the confirmation call.', btns: [act('Open visits', () => goView('visits'), true)] });
    // 7. vacant unit with visits but no offer
    const vu = su.filter(x => x.days >= 30 && x.visits >= 1 && !x.offer).sort((a, b) => (b.visits - a.visits) || (b.days - a.days))[0];
    if (vu) items.push({ key: 'vacant', risk: false, score: 56, title: 'Call the owner of ' + vu.u.unit_id,
      why: fDay(vu.days) + ' vacant, ' + plural(vu.visits, 'visit') + ', no offer' + (vu.over != null && vu.over > 0.08 ? ', priced ' + Math.round(vu.over * 100) + '% above similar units' : '') + '.', btns: [act('Open unit', () => callFn('openUnit', vu.u.unit_id), true)] });
    // 8. qualified clients waiting for a visit
    const waitQ = S().clients.filter(c => c.stage === 'Qualified' && now() - stageSince(c) > 7 * DAY);
    if (waitQ.length >= 3) items.push({ key: 'qual', risk: false, score: 40, title: 'Book visits for qualified clients',
      why: plural(waitQ.length, 'client') + ' have been Qualified for over a week with no visit done.', btns: [act('Show them', () => goView('crm', { stage: 'Qualified' }), true)] });
    if (items.length < 3) items.push({ key: 'steady', risk: false, score: 10, title: 'Keep the weekly rhythm', why: 'Nothing is flagged. Check the biggest deals once a week and run the owner check on Monday.', btns: [act('Biggest deals', () => ask('What are the biggest deals in the pipeline?'), true)] });
    return items.sort((a, b) => b.score - a.score);
  });
}

/* ------------------------------------------------------------------ brief (tiles + short written bullets) */
function briefBullets(kind) {
  const m = metricList(kind, 0), p = m.p, c = m.c, pr = m.pr, out = [];
  const lbl = { enq: 'enquiries', qual: 'qualified clients', vis: 'site visits done', prop: 'proposals sent', loi: 'letters of intent', signed: 'signed leases' };
  const cands = Object.keys(lbl).map(k => ({ k, a: c.n[k], b: pr.n[k] })).filter(x => Math.max(x.a, x.b) >= 3 && x.a !== x.b).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b) || x.k.localeCompare(y.k));
  if (cands.length) { const x = cands[0]; out.push(cap(lbl[x.k]) + ' ' + (x.a > x.b ? 'rose' : 'fell') + ' from ' + x.b + ' to ' + x.a + ' compared with ' + p.prev.toLowerCase() + '.'); }
  else out.push('Counts are small, so changes are hard to read: ' + plural(c.n.enq, 'enquiry', 'enquiries') + ' and ' + plural(c.n.signed, 'signed lease') + ' ' + p.cur.toLowerCase() + '.');
  out.push('Brokerage earned ' + p.cur.toLowerCase() + ' is ' + fM(c.brokerage) + ' from ' + plural(c.n.signed, 'signed lease') + ' (' + p.prev.toLowerCase() + ': ' + fM(pr.brokerage) + ' from ' + plural(pr.n.signed, 'lease') + '). Weighted pipeline is ' + fM(m.pc.w) + ' across ' + plural(m.pc.n, 'open deal') + '.');
  const sv = sourceVerdict(sourceRows(null));
  if (sv.best) out.push('Best source so far is ' + sv.best.s + ': ' + sv.best.signed + ' signed and ' + plural(sv.best.vis, 'site visit') + ' from ' + sv.best.enq + ' enquiries over the last 70 days. Numbers are small.');
  const top = deals().filter(d => isNum(d.exp)).sort((a, b) => b.exp - a.exp || b.p - a.p)[0];
  if (top) out.push('Biggest open deal is ' + nameOf(top.c) + ' at ' + top.c.stage + ': expected brokerage ' + fM(top.exp) + ', ' + fM(top.w) + ' weighted.');
  const F = focusItems(); const risk = F.find(i => i.risk), action = F.find(i => i !== risk) || F[0];
  if (risk) out.push('Main risk: ' + risk.title.charAt(0).toLowerCase() + risk.title.slice(1) + '. ' + risk.why);
  if (action && action !== risk) out.push('Suggested action: ' + action.title.charAt(0).toLowerCase() + action.title.slice(1) + '. ' + action.why);
  return { bullets: out.slice(0, 6), risk, action, top };
}
function brief(kind) {
  kind = kind === 'month' ? 'month' : 'week';
  const m = metricList(kind, 0), b = briefBullets(kind);
  return {
    period: kind, current: rangeText(m.wc), previous: rangeText(m.wp),
    tiles: m.rows.map(r => ({ key: r.k, label: r.label, value: r.f(r.a), previous: r.f(r.b), change: delta(r.a, r.b, r.lower).txt })),
    bullets: b.bullets,
  };
}

/* ------------------------------------------------------------------ the brief card */
let period = 'week', rootEl = null, briefTimer = null;
function tileHtml(r, p) {
  const d = delta(r.a, r.b, r.lower), prevWord = r.prevLabel ? r.prevLabel : p.prev.toLowerCase();
  const chg = d.same ? '<span class="ceo-flat">no change</span>' : isNum(r.a) && isNum(r.b) ? '<span class="ceo-' + d.cls + '">' + d.arrow + ' ' + esc(d.txt) + '</span>' : '<span class="ceo-flat">' + DASH + '</span>';
  const prevTxt = r.prevLabel ? ' vs ' + esc(r.f(r.b)) + ' a ' + p.unit + ' ago' : ' vs ' + esc(r.f(r.b)) + ' ' + esc(prevWord);
  return '<div class="kpi" title="' + esc(r.label + ': ' + r.def) + '"><span class="l">' + esc(r.label) + '</span><span class="v">' + esc(r.f(r.a)) + '</span><span class="d">' + chg + prevTxt + (r.k !== 'wp' ? lowN(r.n) : '') + '</span></div>';
}
function howHtml() {
  const M = LC.METRICS;
  const probs = tbl([{ h: 'Stage' }, { h: 'Probability', r: true }], ['New enquiry', 'Qualified', 'Site visit', 'Proposal', 'Letter of intent', 'Nurture'].map(s => [esc(s), STAGE_P[s] ? Math.round(STAGE_P[s] * 100) + '%' : '0%']));
  return '<details class="ceo-how"><summary>How these numbers work</summary><dl class="defs">' +
    '<dt>Brokerage earned</dt><dd>' + esc(DEF.earned) + '</dd>' +
    '<dt>Expected brokerage</dt><dd>' + esc(DEF.expected) + '</dd>' +
    '<dt>Weighted pipeline</dt><dd>Expected brokerage times stage probability, added up over open clients. The probabilities below are planning assumptions, adjust in Settings later.</dd>' +
    '<dt>30/60/90-day forecast</dt><dd>' + esc(DEF.forecast) + '</dd>' +
    '<dt>This week, this month</dt><dd>' + esc(DEF.period) + '</dd>' +
    '<dt>Change</dt><dd>The arrow compares the period with the one before it. Green is better, red is worse (for reply times, lower is better). "n=" marks small counts that can swing a lot.</dd>' +
    '<dt>Enquiries</dt><dd>' + esc(M.enquiries) + '</dd><dt>Qualified</dt><dd>Clients who reached Qualified in the period. ' + esc(LC.STAGE_DEFS['Qualified']) + '</dd>' +
    '<dt>Site visits done</dt><dd>' + esc(M.visits) + '</dd><dt>Proposals</dt><dd>' + esc(M.proposals) + '</dd><dt>Letters of intent</dt><dd>' + esc(M.lois) + '</dd><dt>Signed leases</dt><dd>' + esc(M.signed) + '</dd>' +
    '<dt>First reply (AI)</dt><dd>' + esc(M.firstReply) + '</dd><dt>First human contact</dt><dd>' + esc(M.firstHuman) + '</dd>' +
    '<dt>Source to close</dt><dd>' + esc(M.sourceToClose) + '</dd><dt>No-show rate</dt><dd>' + esc(M.noShow) + '</dd>' +
    '<dt>Days vacant</dt><dd>' + esc(M.daysVacant) + '</dd><dt>Asking vs achieved</dt><dd>' + esc(M.askingVsAchieved) + '</dd></dl>' + probs + '</details>';
}
function briefCard() {
  const m = metricList(period, 0), b = briefBullets(period), p = m.p;
  const acts = [];
  if (b.top) acts.push('<button type="button" class="btn sm" data-brief="client" data-id="' + esc(b.top.c.id) + '">Open top deal</button>');
  acts.push('<button type="button" class="btn sm" data-brief="ask" data-q="What should I focus on this week?">What should I focus on?</button>');
  acts.push('<button type="button" class="btn sm" data-brief="ask" data-q="' + esc('Compare this ' + p.unit + ' with last ' + p.unit) + '">Compare with last ' + esc(p.unit) + '</button>');
  return '<div class="card-h"><h2>' + esc(p.cur) + ' at a glance</h2><div class="seg" role="group" aria-label="Period">' +
    '<button type="button" data-period="week" aria-pressed="' + (period === 'week') + '">This week vs last week</button>' +
    '<button type="button" data-period="month" aria-pressed="' + (period === 'month') + '">This month vs last month</button></div><span class="spacer"></span>' +
    '<span class="ceo-range" title="' + esc(DEF.period) + '">' + esc(rangeText(m.wc)) + ' against ' + esc(rangeText(m.wp)) + '</span></div>' +
    '<div class="card-b stack"><div class="kpis ceo-kpis">' + m.rows.map(r => tileHtml(r, p)).join('') + '</div>' +
    '<div><div class="eyebrow" style="margin-bottom:6px">In short</div><ul class="ceo-bullets">' + b.bullets.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><div class="ceo-brief-acts">' + acts.join('') + '</div></div>' + howHtml() + '</div>';
}
function paintBrief() {
  const el = rootEl && LC.$('#ceo-brief', rootEl); if (!el) return;
  const open = LC.$('.ceo-how', el) && LC.$('.ceo-how', el).open;
  el.innerHTML = briefCard();
  if (open) LC.$('.ceo-how', el).open = true;
}
function afterData() { if (!LC.isActive('ceo')) return; clearTimeout(briefTimer); briefTimer = setTimeout(() => { if (LC.isActive('ceo')) paintBrief(); }, 900); }
['clients:changed', 'units:changed', 'visits:changed', 'queue:changed'].forEach(e => LC.on(e, afterData));

/* ------------------------------------------------------------------ answers */
function ansBrief(kind, off) {
  const m = metricList(kind, off), p = m.p, c = m.c, pr = m.pr;
  const curL = off ? p.prev : p.cur, prevL = off ? 'the ' + p.unit + ' before' : p.prev;
  const lead = curL + ': ' + plural(c.n.enq, 'enquiry', 'enquiries') + ', ' + plural(c.n.vis, 'site visit') + ' done, ' + plural(c.n.signed, 'signed lease') + ' and ' + fM(c.brokerage) + ' brokerage earned. Weighted pipeline is ' + fM(m.pc.w) + '.';
  const body = tbl([{ h: 'Measure' }, { h: curL, r: true }, { h: cap(prevL), r: true }, { h: 'Change', r: true }],
    m.rows.map(r => { const d = delta(r.a, r.b, r.lower); return ['<span title="' + esc(r.def) + '">' + esc(r.label) + '</span>', esc(r.f(r.a)) + (r.k !== 'wp' ? lowN(r.n) : ''), esc(r.f(r.b)), d.same ? '<span class="ceo-flat">no change</span>' : isNum(r.a) && isNum(r.b) ? '<span class="ceo-' + d.cls + '">' + d.arrow + ' ' + esc(d.txt) + '</span>' : DASH]; }));
  const bl = briefBullets(kind);
  return A('brief', lead, body + hd('In short') + list(bl.bullets.map(esc)) + chips(['What should I focus on this week?', 'Compare this ' + p.unit + ' with last ' + p.unit]),
    { src: srcOf(plural(S().clients.length, 'client') + ' and ' + plural(S().visits.length, 'visit') + ' on this page. ' + rangeText(m.wc) + ' against ' + rangeText(m.wp), DEF.earned + ' ' + DEF.weighted + ' ' + DEF.period) });
}
function ansCompare(kind) {
  const p = periodDef(kind), m = metricList(kind, 0), best = m.rows.filter(r => isNum(r.a) && isNum(r.b) && r.a !== r.b).map(r => ({ r, d: delta(r.a, r.b, r.lower) }));
  const better = best.filter(x => x.d.cls === 'good').length, worse = best.filter(x => x.d.cls === 'bad').length;
  const lead = p.cur + ' against ' + p.prev.toLowerCase() + ': ' + better + ' measures are better, ' + worse + ' are worse. Brokerage is ' + fM(m.c.brokerage) + ' against ' + fM(m.pr.brokerage) + '.';
  const o = ansBrief(kind, 0);
  return A('compare', lead, o.html.replace(/<div class="ceo-h">In short<\/div>[\s\S]*$/, '') + chips(['Compare this ' + (kind === 'week' ? 'month' : 'week') + ' with last ' + (kind === 'week' ? 'month' : 'week'), 'What brokerage did we earn this month?']), { src: o.src });
}
function ansRevenue(kind, off) {
  const p = periodDef(kind), w = winOf(kind, off), wp = winOf(kind, off + 1), c = stats(w), pr = stats(wp);
  const label = (off ? 'Last ' : 'This ') + p.unit, list0 = c.lists.signed.slice().sort((a, b) => earned(b) - earned(a));
  const avg = list0.length ? c.brokerage / list0.length : null;
  const ratio = list0.filter(x => x.achievedPsf && LC.unit(x.unitId)).map(x => x.achievedPsf / LC.unit(x.unitId).rent_per_sqft);
  let lead, body = '';
  if (!list0.length) {
    const lastSigned = S().clients.filter(x => reachedTs(x, 'Signed lease') != null).sort((a, b) => reachedTs(b, 'Signed lease') - reachedTs(a, 'Signed lease'))[0];
    lead = 'No leases were signed ' + label.toLowerCase() + ' (' + rangeText(w) + '), so brokerage earned is ₹0.';
    body = '<p class="ceo-lede">' + (lastSigned ? 'The last signed lease was ' + esc(nameOf(lastSigned)) + ' on ' + esc(LC.fmtDate(new Date(reachedTs(lastSigned, 'Signed lease')))) + ' (' + esc(fM(earned(lastSigned))) + '). ' : '') + 'Previous ' + esc(p.unit) + ': ' + esc(fM(pr.brokerage)) + ' from ' + esc(plural(pr.n.signed, 'lease')) + '.</p>';
  } else {
    lead = 'Brokerage earned ' + label.toLowerCase() + ' is ' + fM(c.brokerage) + ' from ' + plural(list0.length, 'signed lease') + ', about ' + fM(avg) + ' per lease.';
    const rows = list0.map(x => { const u = x.unitId ? LC.unit(x.unitId) : null; return [clLink(x), u ? unLink(u) : DASH, esc(isNum(x.achievedPsf) ? '₹' + x.achievedPsf + '/sq ft' : DASH) + '<div class="ceo-sub">' + esc(fM(x.dealValueMonthly)) + ' a month</div>', esc(first(x.agent)), '<b>' + esc(fM(earned(x))) + '</b>']; });
    body = kv([[esc(fM(c.brokerage)), 'Brokerage earned', DEF.earned], [esc(fN(list0.length)), 'Signed leases'], [esc(fM(avg)), 'Average per lease'], [esc(fM(pr.brokerage)), 'Previous ' + p.unit + ' (' + pr.n.signed + ' leases)']]) +
      tbl([{ h: 'Client' }, { h: 'Unit' }, { h: 'Achieved rent', r: true }, { h: 'Agent' }, { h: 'Brokerage', r: true }], rows) +
      (ratio.length ? '<p class="ceo-lede">Rent achieved was ' + Math.round(LC.sum(ratio) / ratio.length * 100) + '% of the listed rent on average (asking vs achieved).</p>' : '') + (list0.length < 5 ? '<p class="ceo-lede">Only ' + list0.length + ' lease' + (list0.length === 1 ? '' : 's') + ', so one deal moves the total a lot.</p>' : '');
  }
  return A('revenue', lead, body + chips(['What\'s the forecast for the next 90 days?', 'Compare this ' + p.unit + ' with last ' + p.unit]),
    { src: srcOf('Signed leases in ' + rangeText(w) + ' (' + plural(S().clients.length, 'client') + ' on this page)', DEF.earned + ' ' + DEF.period), actions: [act('Open CRM', () => goView('crm', { stage: 'Signed lease' }))] });
}
function ansForecast() {
  const F = forecast(), wp = weightedAt(now()), top = deals().filter(d => d.w > 0).sort((a, b) => b.w - a.w).slice(0, 5), noVal = deals().filter(d => !isNum(d.exp)).length;
  const lead = 'The weighted pipeline for the next 90 days is ' + fM(F.in90) + ' in brokerage. The full weighted pipeline is ' + fM(F.total) + ' across ' + plural(F.n, 'open deal') + '.';
  const body = tbl([{ h: 'Move-in date' }, { h: 'Deals', r: true }, { h: 'Expected', r: true, t: DEF.expected }, { h: 'Weighted', r: true, t: DEF.weighted }],
    F.buckets.map(b => ['<span title="' + esc(b.hint) + '">' + esc(b.label) + '</span>', fN(b.deals.length), esc(fM(b.exp)), '<b>' + esc(fM(b.w)) + '</b>']).concat([['<b>All open deals</b>', '<b>' + fN(F.n) + '</b>', '<b>' + esc(fM(LC.sum(F.buckets, b => b.exp))) + '</b>', '<b>' + esc(fM(F.total)) + '</b>']])) +
    hd('Top contributors') +
    tbl([{ h: 'Client' }, { h: 'Stage' }, { h: 'Move-in' }, { h: 'Weighted', r: true }], top.map(d => [clLink(d.c), LC.stagePill(d.c.stage), esc(d.c.req && d.c.req.moveIn ? LC.fmtDate(d.c.req.moveIn) : DASH), '<b>' + esc(fM(d.w)) + '</b>'])) +
    '<p class="ceo-lede"><b>Method:</b> expected brokerage times stage probability (Qualified 10%, Site visit 25%, Proposal 45%, Letter of intent 80%), then split by move-in date. These probabilities are planning assumptions, adjust in Settings later.' + (noVal ? ' ' + plural(noVal, 'open deal') + ' with no unit to price are left out.' : '') + esc(sharedUnitNote()) + '</p>';
  return A('forecast', lead, body + chips(['What are the biggest deals in the pipeline?', 'Which big deals are stuck?']), { src: srcOf(plural(deals().length, 'open deal') + ' at Qualified or later, with each deal\'s unit rent and brokerage months', DEF.expected + ' ' + DEF.weighted + ' ' + DEF.forecast) });
}
function ansDeals(onlyStuck) {
  let D = deals().filter(d => isNum(d.exp));
  const all = D.length;
  if (onlyStuck) D = D.filter(d => d.days > 10 && ['Site visit', 'Proposal', 'Letter of intent'].includes(d.c.stage));
  D = D.sort((a, b) => onlyStuck ? (b.exp - a.exp) : (b.exp - a.exp || b.p - a.p));
  const shown = D.slice(0, 8), tot = LC.sum(D, d => d.exp);
  let lead;
  if (onlyStuck) lead = D.length ? plural(D.length, 'deal') + ' ' + (D.length === 1 ? 'has' : 'have') + ' sat in the same stage for over 10 days, with ' + fM(tot) + ' of expected brokerage. The biggest is ' + nameOf(shown[0].c) + ' (' + fM(shown[0].exp) + ', ' + fDay(shown[0].days) + ' at ' + shown[0].c.stage + ').' : 'No deal at Site visit or later has sat in the same stage for more than 10 days.';
  else lead = shown.length ? 'The biggest open deal is ' + nameOf(shown[0].c) + ' at ' + shown[0].c.stage + ', with ' + fM(shown[0].exp) + ' expected brokerage. The top ' + shown.length + ' deals add up to ' + fM(LC.sum(shown, d => d.exp)) + ' (' + fM(LC.sum(shown, d => d.w)) + ' weighted).' : 'There are no open deals with a unit to price yet.';
  const rows = shown.map(d => [clLink(d.c) + '<div style="margin-top:3px">' + LC.stagePill(d.c.stage) + '</div>', d.u ? '<span title="' + esc('Unit used for the estimate: ' + d.basis) + '">' + unLink(d.u) + '</span>' : DASH, '<b>' + esc(fM(d.exp)) + '</b>', esc(fM(d.w)), esc(first(d.c.agent)), (d.days > 10 ? '<span class="ceo-bad">' : '<span>') + esc(fN(d.days)) + '</span>', nextStep(d.c)]);
  const body = shown.length ? tbl([{ h: 'Client and stage' }, { h: 'Unit', t: 'The unit linked to the client, or their best match. It sets the expected brokerage.' }, { h: 'Expected', r: true, t: DEF.expected }, { h: 'Weighted', r: true, t: DEF.weighted }, { h: 'Agent', nw: true }, { h: 'Days', r: true, t: 'Days in the current stage.' }, { h: 'Next step' }], rows) : '';
  return A(onlyStuck ? 'stuck_deals' : 'deals', lead, body + '<p class="ceo-lede">' + (D.length > shown.length ? 'Showing the top ' + shown.length + ' of ' + D.length + ' by expected brokerage.' : '') + esc(sharedUnitNote()) + '</p>' + chips(onlyStuck ? ['What should I focus on this week?'] : ['Which big deals are stuck?', 'What\'s the forecast for the next 90 days?']),
    { src: srcOf(plural(all, 'open deal') + ' at Qualified or later (stage history gives the days in stage)', DEF.expected + ' ' + DEF.weighted), actions: [act('Open the pipeline', () => goView('crm'))] });
}
function pickAgent(t) { return LC.TEAM.find(a => t.includes(first(a.name).toLowerCase()) || t.includes(a.id)); }
function ansTeam(t) {
  const T = team(), who = pickAgent(t || '');
  const src = srcOf(plural(S().clients.length, 'client') + ', ' + plural(S().visits.length, 'visit') + ' and each client\'s assigned agent. Activity counts are for the last 30 days', 'Visits done, proposals, signed leases and brokerage are for the last 30 days. Visit to proposal is clients who reached Proposal divided by clients who reached Site visit, over all clients in the data. Overdue follow-up means the next follow-up date was before today. ' + LC.METRICS.firstHuman);
  if (/\breport cards?\b/.test(t || '') && who && typeof LC.openReportCard === 'function') {
    const sm = LC.team && LC.team.summary ? LC.team.summary(who.name, 30) : null;
    setTimeout(() => LC.openReportCard(who.name), 0);
    return A('team', 'Opening ' + who.name + '\'s report card' + (sm && isNum(sm.score) ? ': overall ' + sm.score + ' out of 100 (' + sm.band.toLowerCase() + ') over the last 30 days.' : '.'), '', { src: srcOf('The clients, visits, tasks and handoffs assigned to ' + who.name, 'Six scores from 0 to 100 (speed, follow-up, site visits, conversion, revenue, data quality), weighted into one. The rules are on the report card under "How the score works".'), actions: [act('Open all report cards', () => goView('team'))] });
  }
  if (who) {
    const r = T.find(x => x.a.name === who.name), others = T.filter(x => x !== r);
    const m = (f) => med(others.map(f).filter(isNum));
    const lead = r.a.name + ' (' + r.a.role.toLowerCase() + ', ' + r.a.cities.join(' and ') + ') has ' + plural(r.open.length, 'open client') + ', ' + plural(r.visits, 'visit') + ' done and ' + plural(r.proposals, 'proposal') + ' in the last 30 days, and ' + r.overdue.length + ' overdue ' + (r.overdue.length === 1 ? 'follow-up' : 'follow-ups') + '.';
    const rows = [
      ['Open clients', fN(r.open.length), fN(m(x => x.open.length))], ['Visits done (30 days)', fN(r.visits), fN(m(x => x.visits))], ['Proposals (30 days)', fN(r.proposals), fN(m(x => x.proposals))],
      ['Signed leases (30 days)', fN(r.signed), fN(m(x => x.signed))], ['Brokerage (30 days)', fM(r.brokerage), fM(m(x => x.brokerage))], ['Median first human contact', fMin(r.human) + lowN(r.humanN, 3), fMin(m(x => x.human))],
      ['Overdue follow-ups', fN(r.overdue.length), fN(m(x => x.overdue.length))], ['Visit to proposal', r.v2p == null ? DASH : fPct(r.v2pHit, r.v2pN) + ' (' + r.v2pHit + ' of ' + r.v2pN + ')', fPct(LC.sum(others, x => x.v2pHit), LC.sum(others, x => x.v2pN))],
    ];
    const od = r.overdue.slice(0, 5);
    const body = tbl([{ h: 'Measure' }, { h: first(r.a.name), r: true }, { h: 'Rest of team (median)', r: true }], rows) +
      (od.length ? hd('Overdue follow-ups') + tbl([{ h: 'Client' }, { h: 'Stage' }, { h: 'Due', r: true }], od.map(c => [clLink(c), LC.stagePill(c.stage), esc(LC.fmtDate(LC.iso(c.nextFollowUp)))])) : '') + chips(['Who\'s performing best?']);
    return A('team', lead, body, { src, actions: [act('Show ' + first(r.a.name) + '\'s clients', () => goView('crm', { agent: r.a.name }), true), act('Open ' + first(r.a.name) + '\'s report card', () => callFn('openReportCard', r.a.name))] });
  }
  const ranked = T.slice().sort((a, b) => b.brokerage - a.brokerage || b.signed - a.signed || (b.proposals + b.visits) - (a.proposals + a.visits));
  const best = ranked[0], helpPool = T.filter(x => x.open.length >= 4 && x.overdue.length >= 2).sort((a, b) => b.overdue.length - a.overdue.length || b.overdue.length / b.open.length - a.overdue.length / a.open.length);
  const helpOf = helpPool.find(x => x !== best) || helpPool[0] || null;
  const bestWhy = best.brokerage > 0 ? first(best.a.name) + ' leads on brokerage in the last 30 days: ' + fM(best.brokerage) + ' from ' + plural(best.signed, 'signed lease') + '.' : 'No agent has a signed lease in the last 30 days. ' + first(best.a.name) + ' leads on activity: ' + plural(best.visits, 'visit') + ' and ' + plural(best.proposals, 'proposal') + '.';
  const helpTxt = helpOf ? ' ' + first(helpOf.a.name) + ' has the most follow-ups past due: ' + helpOf.overdue.length + ' of ' + helpOf.open.length + ' open clients, the oldest ' + fDay(helpOf.oldestOverdue) + ' late, so a review there would help most.' : '';
  const rows = T.map(r => ['<b>' + esc(first(r.a.name)) + '</b><div class="ceo-sub">' + esc(r.a.cities.join(', ')) + '</div>', fN(r.open.length), fN(r.visits), fN(r.proposals), fN(r.signed), esc(fM(r.brokerage)), esc(fMin(r.human)) + lowN(r.humanN, 3), (r.overdue.length ? '<span class="' + (r.overdue.length >= 4 ? 'ceo-bad' : '') + '">' + r.overdue.length + '</span>' : '0'), r.v2pN ? esc(fPct(r.v2pHit, r.v2pN)) + '<div class="ceo-sub">' + r.v2pHit + ' of ' + r.v2pN + '</div>' : DASH]);
  const order = T.indexOf(best);
  const body = '<p class="ceo-lede">Last 30 days, except open clients, overdue follow-ups and visit to proposal.</p>' + tbl([{ h: 'Agent' }, { h: 'Open', r: true, t: 'Open clients: not Lost, Signed or Nurture.' }, { h: 'Visits', r: true, t: LC.METRICS.visits }, { h: 'Proposals', r: true }, { h: 'Signed', r: true }, { h: 'Brokerage', r: true, t: DEF.earned }, { h: '1st contact', r: true, t: LC.METRICS.firstHuman }, { h: 'Overdue', r: true, t: 'Open clients whose next follow-up date was before today.' }, { h: 'Visit to proposal', r: true, t: 'Clients who reached Proposal divided by clients who reached Site visit.' }], rows, { hl: order }) +
    '<p class="ceo-lede">Small numbers: a single lease changes the ranking. Agents cover different cities and different sizes of book, so compare with that in mind.</p>' + chips(['How is ' + first(T[0].a.name) + ' doing?', 'Are we replying fast enough?']);
  return A('team', bestWhy + helpTxt, body, { src, actions: (helpOf ? [act('Show ' + first(helpOf.a.name) + '\'s clients', () => goView('crm', { agent: helpOf.a.name }), true)] : []).concat([act('Open report cards', () => goView('team'), !helpOf)]) });
}
function ansSources(t) {
  const kind = /\bweek\b/.test(t || '') ? 'week' : /\bmonth\b|30.?day/.test(t || '') ? 'month' : null;
  const w = kind ? winOf(kind, 0) : null, rows = sourceRows(w), V = sourceVerdict(rows), scope = kind ? 'the last ' + periodDef(kind).days + ' days' : 'the last 70 days';
  rows.sort((a, b) => b.brokerage - a.brokerage || b.signed - a.signed || b.vis / b.enq - a.vis / a.enq);
  const named = rows.find(r => new RegExp('\\b' + r.s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])').test(t || ''));
  let lead;
  if (named) lead = named.s + ' over ' + scope + ': ' + plural(named.enq, 'enquiry', 'enquiries') + ', ' + fPct(named.qual, named.enq) + ' qualified, ' + plural(named.vis, 'site visit') + ', ' + named.signed + ' signed' + (named.brokerage ? ' (' + fM(named.brokerage) + ' brokerage)' : '') + '. ' + (V.best && V.best !== named ? V.best.s + ' leads so far.' : 'Counts are small.') + ' Spend can\'t be compared yet because it is not in the system.';
  else if (V.best) lead = V.best.s + ' looks strongest over ' + scope + ': ' + V.best.signed + ' signed and ' + plural(V.best.vis, 'site visit') + ' from ' + V.best.enq + ' enquiries' + (V.best.brokerage ? ', ' + fM(V.best.brokerage) + ' brokerage' : '') + '. Counts are small, so treat this as a lean, not a result.';
  else lead = 'No source has enough enquiries (6 or more) in ' + scope + ' to call a winner yet.';
  const wk = V.weak ? ' ' + V.weak.s + ' sends volume (' + V.weak.enq + ' enquiries) but few reach a visit (' + fPct(V.weak.vis, V.weak.enq) + ' against ' + (V.avgVis * 100).toFixed(0) + '% overall).' : '';
  const body = tbl([{ h: 'Source' }, { h: 'Enquiries', r: true }, { h: 'Qualified', r: true, t: 'Share of enquiries that reached Qualified.' }, { h: 'Visits', r: true, t: 'Clients who reached Site visit.' }, { h: 'Signed', r: true }, { h: 'Brokerage', r: true, t: DEF.earned }, { h: 'Source to close', r: true, t: LC.METRICS.sourceToClose }],
    rows.map(r => ['<b>' + esc(r.s) + '</b>' + (r === V.best ? ' ' + pill('leads', 'good') : '') + (r === V.weak ? ' ' + pill('few visits', 'warn') : ''), esc(fN(r.enq)) + lowN(r.enq, 6), esc(fPct(r.qual, r.enq)), fN(r.vis), fN(r.signed), esc(fM(r.brokerage)), esc(fPct(r.signed, r.enq, 1))]), { hl: V.best ? rows.indexOf(V.best) : undefined }) +
    '<p class="ceo-lede"><b>Cost per lease can\'t be worked out yet.</b> Ad and portal spend is not in the system. To get it, add the monthly spend per source in Settings. Then this table can show cost per enquiry, per visit and per signed lease, and the answer to "where should I spend more" becomes firm.</p>' + wk;
  return A('sources', lead, body + chips(['Where are we losing deals?']), { src: srcOf(plural(LC.sum(rows, r => r.enq), 'enquiry', 'enquiries') + ' by lead source over ' + scope, LC.METRICS.sourceToClose + ' Qualified and visits count clients who reached that stage at any time.'), actions: [act('Open analytics', () => goView('analytics')), act('Open Settings', () => goView('settings'))] });
}
function ansLost() {
  const L = lostInfo(), w = L.worst;
  const lead = w ? 'The biggest drop is ' + w.from + ' to ' + w.to + ': only ' + fPct(w.b, w.a) + ' move on (' + w.b + ' of ' + w.a + '). ' + plural(L.lost.length, 'client') + ' ' + (L.lost.length === 1 ? 'is' : 'are') + ' marked Lost' + (L.reasons[0] ? ', most often "' + L.reasons[0].r.toLowerCase() + '" (' + L.reasons[0].n + ').' : '.') : 'There is not enough history to show drop-offs yet.';
  const top = L.fun[0].n || 1;
  const bars = L.fun.map((f, i) => { const st = i ? L.steps[i - 1] : null; const hot = st && st === w; return '<div class="ceo-bar' + (hot ? ' hot' : '') + '" title="' + esc(LC.STAGE_DEFS[f.stage] || '') + '"><span>' + esc(f.stage) + '</span><div class="track"><i style="width:' + Math.max(2, Math.round(f.n / top * 100)) + '%"></i></div><span class="val">' + (hot ? '▼ ' : '') + f.n + (st ? ' · ' + fPct(st.b, st.a) : '') + '</span></div>'; }).join('');
  const rrows = L.reasons.map(r => [esc(r.r), fN(r.n), esc(fPct(r.n, L.lost.length))]);
  const at = Object.keys(L.atStage).map(k => [k, L.atStage[k]]).sort((a, b) => b[1] - a[1]);
  const body = hd('Clients who reached each stage, and the share that moved on') + '<div>' + bars + '</div>' +
    (w ? '<p class="ceo-lede">Marked with ▼: ' + esc(w.from) + ' to ' + esc(w.to) + ', where ' + w.lost + ' clients did not move on. Clients still in progress have not had time to reach later stages, so the drop looks larger than it will end up.</p>' : '') +
    hd('Why deals were lost') + (rrows.length ? tbl([{ h: 'Reason' }, { h: 'Clients', r: true }, { h: 'Share', r: true }], rrows) : '<p class="ceo-lede">No lost deals recorded.</p>') +
    (at.length ? '<p class="ceo-lede">Where they were when lost: ' + at.map(([k, n]) => esc(k) + ' ' + n).join(', ') + '. Another ' + L.nurture + ' are parked in Nurture (move-in more than 90 days away).</p>' : '');
  return A('lost', lead, body + chips(['Which lead source should I spend more on?', 'Which big deals are stuck?']), { src: srcOf(plural(L.total, 'client') + ' and their stage history; ' + plural(L.lost.length, 'lost client') + ' with a recorded reason', 'Reached a stage means the client was at that stage or later at some point. ' + Object.entries(LC.STAGE_DEFS).filter(([k]) => ['Lost', 'Nurture'].includes(k)).map(([k, v]) => k + ': ' + v).join(' ')), actions: [act('Open CRM', () => goView('crm', { stage: 'Lost' }))] });
}
function gapCard(g) {
  const need = g.sizeLo ? 'about ' + LC.fmtNum(g.sizeLo) + '–' + LC.fmtNum(g.sizeHi) + ' sq ft' + (g.budget ? ', up to ₹' + g.budget + '/sq ft all-in' : '') : (g.budget ? 'up to ₹' + g.budget + '/sq ft all-in' : 'size not captured');
  return '<div class="ceo-gap-card"><div class="between"><b>' + esc(g.use) + ' in ' + esc(areaLabel(g)) + '</b>' + pill(plural(g.unmet, 'client') + ' with no fit', g.status) + '</div>' +
    '<div>' + esc(plural(g.n, 'client')) + ' want it, ' + esc(plural(g.fit, 'unit')) + ' fit' + (g.fit === 1 ? 's' : '') + ', ' + esc(plural(g.units, 'unit')) + ' of that use listed in the area.</div>' +
    '<div><b>Source:</b> ' + esc(need) + (g.stake > 0 ? '. Up to ' + esc(fM(g.stake)) + ' in brokerage.' : '.') + '</div></div>';
}
function ansDemand() {
  const D = demand(), city = D.city.slice(0, 10), gaps = D.loc.filter(g => g.unmet >= 1).slice(0, 4);
  let lead;
  if (!D.n) lead = 'There are no open client requirements with a use and an area yet.';
  else {
    const ref = gaps[0] || D.city.slice().sort((a, b) => b.pressure - a.pressure)[0];
    lead = D.totalUnmet + ' of ' + D.n + ' open clients have no unit that fits right now. ' + (gaps[0] ? 'The biggest gap is ' + gaps[0].use + ' in ' + areaLabel(gaps[0]) + ': ' + gaps[0].n + ' ' + (gaps[0].n === 1 ? 'client wants' : 'clients want') + ' it and ' + gaps[0].fit + ' ' + (gaps[0].fit === 1 ? 'unit fits' : 'units fit') + '.' : 'The tightest market is ' + ref.use + ' in ' + areaLabel(ref) + ': ' + ref.n + ' clients for ' + ref.fit + ' fitting ' + (ref.fit === 1 ? 'unit' : 'units') + '.');
  }
  const rows = city.map(g => ['<b>' + esc(g.use) + '</b><div class="ceo-sub">' + esc(areaLabel(g)) + '</div>', fN(g.n), fN(g.units), fN(g.fit), g.unmet ? '<b class="ceo-bad">' + g.unmet + '</b>' : '0', pill(g.status === 'bad' ? 'Gap' : g.status === 'warn' ? (g.unmet ? 'Partly served' : 'Tight') : 'Covered', g.status, g.n + ' clients for ' + g.fit + ' fitting units (' + (isFinite(g.pressure) ? g.pressure.toFixed(1) : DASH) + ' per unit). Tight means 2.5 or more clients per fitting unit.')]);
  const body = hd('Demand against supply, by use and city') +
    tbl([{ h: 'Use and city' }, { h: 'Want', r: true, t: 'Clients who want it: open clients (New enquiry to Letter of intent) with this use in this city.' }, { h: 'Listed', r: true, t: 'Available units confirmed within 14 days that allow this use, in this city.' }, { h: 'Fit', r: true, t: 'Units that fit: distinct units that are an exact match for at least one of these clients.' }, { h: 'No fit', r: true, t: 'Clients for whom no unit passes every must-have.' }, { h: 'Read', nw: true, t: 'Gap: nobody fits. Partly served: some clients have no fit. Tight: 2.5 or more clients per fitting unit.' }], rows) +
    '<p class="ceo-lede"><b>Want</b> is clients who want it. <b>Listed</b> is available units of that use in the city. <b>Fit</b> is units that are an exact match for at least one of those clients. <b>No fit</b> is clients with no matching unit at all.</p>' +
    (gaps.length ? hd('Where to source next') + '<div class="ceo-gap">' + gaps.map(gapCard).join('') + '</div>' : '<p class="ceo-lede">Every open client has at least one unit that fits. Watch the "Tight" rows: many clients are chasing a few units.</p>') +
    '<p class="ceo-lede">' + (D.orphan.length ? esc(plural(D.orphan.length, 'available unit')) + ' ' + (D.orphan.length === 1 ? 'is' : 'are') + ' not an exact fit for any open client. That is the opposite problem: stock nobody is asking for right now.' : 'Every available unit fits at least one open client.') + '</p>' + chips(['Which units should we push?', 'What should I focus on this week?']);
  return A('demand', lead, body, { src: srcOf(plural(D.n, 'open client') + ' requirements against ' + plural(D.avail.length, 'available unit') + ' (the same match engine as Requirement match)', 'Clients with a unit already linked are not counted as "no fit". "Up to" brokerage assumes the client takes their size at their full all-in budget and the average brokerage months of units with that use. It is an upper bound.'), actions: [act('Open inventory', () => goView('inventory'), true), act('Open Requirement match', () => goView('match'))] });
}
function ansStuckUnits() {
  const U = stuckUnits(), long = U.filter(x => x.days >= 60), shown = U.slice(0, 8), noOffer = U.filter(x => x.visits >= 1 && !x.offer);
  const lead = U.length ? plural(long.length, 'available unit') + ' ' + (long.length === 1 ? 'has' : 'have') + ' been vacant for 60 days or more. The longest is ' + shown[0].u.unit_id + ' at ' + fDay(shown[0].days) + '. ' + plural(noOffer.length, 'unit') + ' had visits but no offer.' : 'No available units to review.';
  const rows = shown.map(x => [unLink(x.u), esc(x.u.property_type) + '<div class="ceo-sub">' + esc(x.u.locality) + '</div>', esc(fN(x.days)), fN(x.visits), x.offer ? pill('Offer', 'good') : pill('No offer', x.visits ? 'warn' : ''), esc(x.action)]);
  const body = tbl([{ h: 'Unit' }, { h: 'Type' }, { h: 'Days vacant', r: true, t: LC.METRICS.daysVacant }, { h: 'Visits', r: true, t: 'Site visits marked Done.' }, { h: 'Offer' }, { h: 'Suggested action' }], rows) +
    '<p class="ceo-lede">Ranked by days vacant. "Similar units" means available units of the same type in the same city (at least 3 needed to compare price).</p>' + chips(['What are occupiers asking for that we don\'t have?', 'Is our inventory up to date?']);
  return A('stuck_inventory', lead, body, { src: srcOf(plural(U.length, 'available unit') + ', ' + plural(S().visits.length, 'visit') + ' and the client stages', LC.METRICS.daysVacant + ' An offer means a client at Proposal or later is linked to the unit, or a term sheet for it is on a client timeline.'), actions: shown[0] ? [act('Open ' + shown[0].u.unit_id, () => callFn('openUnit', shown[0].u.unit_id))] : [] });
}
function ansSpeed() {
  const P = speed(), c = P.cur, pr = P.prev;
  const lead = 'Median first human contact is ' + fMin(c.human) + ' (' + fMin(pr.human) + ' the month before), and the AI replies in ' + fSec(c.reply) + '. ' + (P.breached.length ? plural(P.breached.length, 'occupier') + ' ' + (P.breached.length === 1 ? 'is' : 'are') + ' past the ' + P.sla + ' minute target in the handoff queue.' : 'Nobody in the handoff queue is past the ' + P.sla + ' minute target.') + ' No-show rate is ' + fPct(c.noShowN, c.n.booked, 1) + ' (' + c.noShowN + ' of ' + c.n.booked + ' booked visits), and ' + plural(P.pend.length, 'confirmation call') + ' ' + (P.pend.length === 1 ? 'is' : 'are') + ' pending.';
  const rows = [
    ['Median first reply (AI)', fSec(c.reply) + lowN(c.n.rep), fSec(pr.reply), LC.METRICS.firstReply],
    ['Median first human contact', fMin(c.human) + lowN(c.n.hum), fMin(pr.human), LC.METRICS.firstHuman],
    ['Human contact within ' + P.sla + ' min', fPct(P.within, P.hum.length) + ' (' + P.within + ' of ' + P.hum.length + ')', DASH, 'Share of enquiries in the last 30 days that a person contacted within the target set in Settings.'],
    ['Human contact within 60 min', fPct(P.within60, P.hum.length), DASH, 'Same, with a one hour limit.'],
    ['No-show rate', fPct(c.noShowN, c.n.booked, 1) + lowN(c.n.booked, 10), isNum(pr.noShow) ? (pr.noShow * 100).toFixed(1) + '%' : DASH, LC.METRICS.noShow],
  ].map(r => ['<span title="' + esc(r[3]) + '">' + esc(r[0]) + '</span>', r[1], esc(r[2])]);
  const body = kv([[fN(P.waiting.length), 'Waiting for a person'], [fN(P.breached.length), 'Past the ' + P.sla + ' min target'], [fN(P.pend.length), 'Visit confirmation calls pending'], [fN(P.tasksLate), 'Confirmation calls overdue']]) +
    tbl([{ h: 'Measure' }, { h: 'Last 30 days', r: true }, { h: 'Month before', r: true }], rows) +
    (P.slow.length ? hd('Slowest first contact, last 30 days') + tbl([{ h: 'Client' }, { h: 'Source' }, { h: 'Agent' }, { h: 'First human contact', r: true }], P.slow.map(x => [clLink(x), esc(x.source), esc(first(x.agent)), esc(fMin(x.firstHumanMin))])) : '') + chips(['Who\'s performing best?']);
  return A('speed', lead, body, { src: srcOf(plural(S().clients.length, 'client') + ', the handoff queue (' + S().queue.length + ' items), booked visits and open confirmation tasks', LC.METRICS.firstReply + ' ' + LC.METRICS.firstHuman + ' ' + LC.METRICS.noShow + ' The SLA target is ' + P.sla + ' minutes (Settings).'), actions: [act('Open inbox', () => goView('inbox')), act('Open visits', () => goView('visits'))] });
}
function ansHealth() {
  const H = health(), n = H.avail.length;
  const lead = fPct(H.fresh.length, n) + ' of available units were confirmed in the last 7 days. ' + plural(H.stale.length, 'unit') + ' ' + (H.stale.length === 1 ? 'is' : 'are') + ' stale (not confirmed for over 14 days) and held back from clients. ' + (H.noReplyOwners.size ? plural(H.noReplyOwners.size, 'owner') + ' ' + (H.noReplyOwners.size === 1 ? 'has' : 'have') + ' not replied to the weekly check' : 'No owner is waiting on a call after the weekly check') + ', and ' + plural(H.staleOwners.size, 'owner') + ' ' + (H.staleOwners.size === 1 ? 'has' : 'have') + ' a stale unit.';
  const body = kv([[fPct(H.fresh.length, n), 'Confirmed in 7 days', n + ' available units'], [fN(H.aging.length), 'Confirmed 8 to 14 days ago'], [fN(H.stale.length), 'Not confirmed for 14+ days'], [fN(H.flagged.length), 'Flagged for checking', 'Units carrying a data flag are never sent automatically.'], [fN(H.noReplyOwners.size), 'Owners with no reply', 'Owners with an open call task after the weekly check got no answer.'], [fN(H.staleOwners.size), 'Owners with a stale unit']]) +
    (H.stale.length ? hd('Longest unconfirmed') + tbl([{ h: 'Unit' }, { h: 'Owner' }, { h: 'Last confirmed', r: true }], H.stale.slice().sort((a, b) => b.f.days - a.f.days).slice(0, 5).map(x => [unLink(x.u), esc(x.u.owner_name), esc(x.f.days + ' days ago')])) : '') +
    (H.flagged.length ? hd('Flagged') + list(H.flagged.map(u => unLinkS(u) + ': ' + esc(u.data_flag))) : '') +
    hd('Movement in the last 30 days') + list([
      esc(plural(H.listed.length, 'unit')) + ' listed (by listed date).',
      esc(plural(H.ourLeases, 'lease')) + ' signed through us. ' + esc(plural(H.leasedLog, 'unit')) + ' marked Leased after an owner reply or sheet sync, and ' + esc(plural(H.addedLog, 'unit')) + ' added by sync.',
      H.sync ? 'Last sheet sync: ' + esc(H.sync.source) + ', ' + esc(LC.relTime(H.sync.ts)) + ' (' + H.sync.added + ' added, ' + H.sync.changed + ' changed, ' + H.sync.removed + ' off market).' : 'No sheet sync has run since the demo opened.']) + chips(['Which owners bring us the most business?']);
  return A('health', lead, body, { src: srcOf(plural(S().units.length, 'unit') + ' (' + n + ' available), open owner-check tasks, the unit audit log and sync log', 'Fresh means confirmed within 7 days. Stale means over 14 days. Units that are not confirmed within the Settings window (' + S().settings.freshnessDays + ' days) are not matched to clients.'), actions: [act('Run owner check', () => callFn('runOwnerCheck'), true), act('Open inventory', () => goView('inventory'))] });
}
function ansOwners() {
  const O = ownerRows(), top = O[0], shown = O.slice(0, 8), excl = LC.sum(O, o => o.excl), tot = LC.sum(O, o => o.units);
  const lead = top.brokerage > 0 ? top.name + ' brings the most business so far: ' + plural(top.signed, 'signed lease') + ' worth ' + fM(top.brokerage) + ' and ' + plural(top.visits, 'visit') + ' across ' + plural(top.units, 'unit') + '.' : top.name + ' leads on activity with ' + plural(top.visits, 'visit') + ' across ' + plural(top.units, 'unit') + '. No lease is signed on any owner\'s unit yet.';
  const rows = shown.map(o => ['<b>' + esc(o.name) + '</b><div class="ceo-sub">' + esc(o.type) + '</div>', fN(o.units), o.excl ? '<b>' + o.excl + '</b>' : '0', fN(o.visits), fN(o.signed), esc(fM(o.brokerage)), o.open ? fN(o.open) + '<div class="ceo-sub">' + esc(fM(o.openExp)) + ' expected</div>' : '0']);
  const body = tbl([{ h: 'Owner' }, { h: 'Units', r: true }, { h: 'Exclusive', r: true, t: 'Units where the owner gave us an exclusive mandate.' }, { h: 'Visits', r: true, t: 'Site visits marked Done on this owner\'s units.' }, { h: 'Signed', r: true }, { h: 'Brokerage', r: true, t: DEF.earned }, { h: 'Open late-stage deals', r: true, t: 'Clients at Proposal or Letter of intent whose unit is one of this owner\'s.' }], rows) +
    '<p class="ceo-lede">' + esc(excl + ' of ' + tot + ' units are on exclusive mandates.') + (O.length > shown.length ? ' Showing the top ' + shown.length + ' of ' + O.length + ' owners.' : '') + ' Visits cover the whole data window (about 70 days).</p>' + chips(['Is our inventory up to date?']);
  return A('owners', lead, body, { src: srcOf(plural(tot, 'unit') + ' grouped by owner, with visits and signed leases linked to those units', 'Signed and brokerage count leases whose unit belongs to the owner. ' + DEF.earned), actions: [act('Open owners', () => goView('owners'))] });
}
function ansFocus() {
  const F = focusItems().slice(0, 5), acts = [];
  const btn = (b) => { acts.push(Object.assign({ inline: true }, b)); return '<button type="button" class="btn sm' + (b.primary ? ' primary' : '') + '" data-act="' + (acts.length - 1) + '">' + esc(b.label) + '</button>'; };
  const lead = F.length + ' things to focus on this week, in order. ' + (F[0] ? 'First: ' + F[0].title.charAt(0).toLowerCase() + F[0].title.slice(1) + '.' : '');
  const body = '<ol class="ceo-focus">' + F.map(i => '<li><b>' + esc(i.title) + '</b><div class="ceo-why">' + esc(i.why) + '</div><div class="ceo-acts">' + i.btns.map(btn).join('') + '</div></li>').join('') + '</ol>' +
    '<p class="ceo-lede">Each item comes from a fixed rule (a big deal stuck over 10 days, a demand gap, 3 or more overdue follow-ups, 3 or more stale units, a source with few visits, a long handoff wait, a long-vacant unit). Money at stake ranks first.</p>';
  return A('focus', lead, body, { actions: acts, src: srcOf('The deals, team, demand, inventory, source and speed numbers behind the questions above', DEF.expected + ' ' + DEF.weighted) });
}
function ansHelp() {
  const groups = suggestions();
  const body = '<ul class="ceo-list"><li><b>Money:</b> brokerage earned, the 30/60/90-day forecast, this period against the last.</li><li><b>Pipeline:</b> biggest deals, stuck deals, where deals are lost, which lead source is working.</li><li><b>Team:</b> who is performing, one agent\'s numbers, overdue follow-ups, reply speed.</li><li><b>Market and inventory:</b> what occupiers ask for that you do not have, units to push, inventory health, which owners bring business.</li><li><b>Focus:</b> three to five things to do this week, each with the number behind it.</li></ul>' +
    '<p class="ceo-lede">I answer only from the clients, visits, units, owners, tasks and queue on this page, using the written definitions in "How these numbers work". If a question does not map to that data, I say so. Try one:</p>' + chips([groups[0][1][0], groups[1][1][0], groups[3][1][0], groups[5][1][0]]);
  return A('help', 'I can answer business questions about money, the pipeline, the team, the market and your inventory.', body, { src: srcOf('This page: clients, visits, units, owners, tasks and the handoff queue', 'Definitions are in "How these numbers work" at the top of this screen.') });
}

/* ------------------------------------------------------------------ router */
const PERIOD_RX = /\b(this|last|previous|past)\s+(week|month)\b/;
function periodOf(t, dflt) {
  const m = t.match(PERIOD_RX);
  let kind = dflt, off = 0;
  if (m) { kind = m[2]; off = (m[1] === 'last' || m[1] === 'previous') ? 1 : 0; }
  else if (/\bmonth(ly)?\b|30.?day/.test(t)) kind = 'month';
  else if (/\bweek(ly)?\b|7.?day/.test(t)) kind = 'week';
  if (/\b(vs\.?|versus|compar\w*|than|against)\b/.test(t)) off = 0;
  return { kind, off };
}
const ROUTES = [
  ['help', (t) => /^(help|menu|options|hi|hello|hey|namaste|\?+)\W*$/.test(t.trim()) || /\bwhat (can|could) (you|i)\b|\bwhat (do|questions do) you (answer|know|do)\b|\bhow (do|can) i (use|ask)\b|\bwhat can i ask\b/.test(t)],
  ['compare', (t) => /\bcompar\w*|\bversus\b/.test(t) || (/\b(vs\.?|than|against)\b.*\b(last|previous|prior)\b/.test(t) && !/\b(doing|going|how)\b/.test(t))],
  ['forecast', (t) => /\bforecast\w*|\bprojection|\bproject(ed|ing)\b|\bnext (30|60|90|three|two|few|quarter)\b|\b(30|60|90).?day|\bcoming (days|weeks|months)\b|\bweighted\b|\bpipeline (value|worth)\b|\b(will|can|could|should) we (earn|make|expect|get|close|bring)\b|\bhow much (money |brokerage |revenue )?(will|can|could)\b|\bgoing to (earn|make)\b|\bexpect(ed)? (to )?(earn|close|brokerage|revenue)\b/.test(t)],
  ['lost', (t) => /\blos(e|ing|t|s)\b|\bdrop.?(off|out|ped)\b|\bfall(ing)? out\b|\bwhy .*\b(not|aren'?t|don'?t|never)\b.*\b(clos\w*|sign\w*|win\w*|convert\w*)\b|\bwhere .*\b(deals?|clients?|leads?|enquir\w+)\b.*\b(go|drop|die|leak\w*)\b|\bleak\w*|\bconversion\b|\bfunnel\b|\bchurn\b|\bdidn'?t (sign|close)\b/.test(t)],
  ['demand', (t) => /\bdemand\b|\bsupply\b|\bgaps?\b|\bunmet\b|\b(ask(ing)?|want(ing|s)?|look(ing)? for|need(ing|s)?|request\w*)\b.*\b(don'?t|do not|doesn'?t|not|haven'?t|missing|lack\w*|never|without|can'?t)\b|\b(don'?t|do not|haven'?t|lack|missing|can'?t)\b.*\b(have|offer|supply|source|find|fill|stock)\b|\bnothing to (show|offer)\b|\bsource (more|new|which|what)\b|\bwhat should we (source|list|stock|get|find|add)\b|\bnot enough (units?|space|inventory|stock)\b|\bshortage|\bshortfall/.test(t)],
  ['stuck_deals', (t) => /\b(stuck|stalled|stall|not moving|gone cold|going cold|go cold|cold deals?|waiting too long|no movement|idle)\b/.test(t) && !/\b(units?|inventory|vacan\w*|propert\w*|listings?|space)\b/.test(t)],
  ['deals', (t) => /\b(biggest|largest|top|best|major|big|highest|most valuable|valuable)\b.*\b(deals?|opportunit\w+|prospects?|pipeline|clients?)\b|\bdeals?\b.*\b(worth|value|pipeline|most|biggest|open|live|hot)\b|\b(which|what|show)\b.*\bdeals?\b|\bhot deals?\b/.test(t)],
  ['sources', (t) => /\bsources?\b|\bchannels?\b|\b99acres\b|\bmagicbricks\b|\bhousing\.com\b|\bjustdial\b|\bgoogle ads\b|\bmeta\b|\breferrals?\b|\bwalk.?ins?\b|\bad spend\b|\badvert\w*|\bmarketing\b|\bcost per\b|\broi\b|\bwhere (do|are|did) (our |the |my )?(leads|enquiries|clients|business|customers) (come|coming)\b|\bspend (more|less|money)\b|\bwhat'?s working\b|\bpaid\b/.test(t)],
  ['speed', (t) => /\bspeed\b|\bresponse\b|\brespond\w*|\bsla\b|\bno.?shows?\b|\bconfirmation calls?\b|\bturnaround\b|\bhow (long|fast|quickly|slow)\b|\bfast enough\b|\breply (time|speed)\b|\bfirst repl\w+|\bhandoffs?\b|\bbreach\w*|\bwaiting (for|in)\b|\bservice level\b|\breplying fast\b|\banswer\w* (enquir|lead|client)|\bquick(ly)?\b/.test(t)],
  ['health', (t) => /\bconfirm\w*|\bfresh\w*|\bstale\b|\bflagged\b|\bdata quality\b|\bup.to.date\b|\bout.of.date\b|\bno reply\b|\bnot repl\w+|\bunresponsive\b|\bowner check\b|\binventory health\b|\bhealth\b|\bhow (clean|current|accurate)\b|\bgone quiet\b/.test(t)],
  ['stuck_inventory', (t) => /\b(push|vacan\w*|unlet|empty|longest|dead stock|hard to (let|lease|rent)|not (moving|renting|leasing|getting)|sitting|stuck|stale|slow)\b.*\b(units?|space|inventory|propert\w+|listings?|buildings?|stock)\b|\b(units?|space|inventory|listings?|propert\w+)\b.*\b(push|vacan\w*|unlet|empty|longest|stuck|sitting|no offer|not moving|without (an )?offer)\b|\bvisits? but no (offer|deal)\b|\bwhich units should we\b|\bvacancy\b/.test(t)],
  ['owners', (t) => /\bowners?\b|\blandlords?\b|\bmandates?\b|\bexclusives?\b/.test(t)],
  ['focus', (t) => /\bfocus\b|\bpriorit\w+|\bwhat should (i|we) (do|work|tackle|look|start|handle|fix|change|worry)\b|\bto.?do\b|\btop (3|three|5|five|few)\b|\bactions?\b|\bwhere should i\b|\bwhat matters\b|\bbiggest (risks?|problems?|issues?|worr\w+)\b|\brisks?\b|\bworr\w+|\bneeds? my attention\b|\bneeds? attention (today|now|this)\b|\burgent\b|\bfirefight\w*|\bwhat next\b/.test(t)],
  ['team', (t) => /\bteam\b|\breport cards?\b|\bagents?\b|\bstaff\b|\bscorecard\b|\bleaderboard\b|\bwho('s| is| are)\b.*\b(best|top|strongest|weakest|slowest|working|behind|struggl\w+|needs?)\b|\bwho needs (help|coaching|support)\b|\boverdue\b|\bfollow.?ups?\b|\bworkload\b|\bcoach\w*|\bperform\w*/.test(t) && !(/\bperform\w*/.test(t) && /\b(we|our|business|company|overall)\b/.test(t)) || !!pickAgent(t)],
  ['revenue', (t) => /\bbrokerage\b|\brevenue\b|\bearn\w*|\bincome\b|\bcommission\b|\bmoney\b|\bmade\b|\bsigned (leases?|deals?)\b|\bclosed (deals?|leases?)\b|\bwon\b|\bcash\b|\bsales\b/.test(t)],
  ['brief', (t) => /\bhow (are|is|am) (we|i|things|the business|my business|it|the week|the month|business)\b|\bhow'?s\b|\bdoing\b|\bgoing\b|\bthis (week|month)\b|\blast (week|month)\b|\bat a glance\b|\bstatus\b|\bsnapshot\b|\bsummary\b|\boverview\b|\bupdate\b|\bnumbers\b|\bkpis?\b|\bmonthly\b|\bweekly\b|\bbrief\b|\bhow many\b|\benquir\w+|\bleads?\b/.test(t)],
];
function norm(q) { return String(q || '').toLowerCase().replace(/[’‘]/g, '\'').replace(/\s+/g, ' ').trim(); }
function intentOf(q) { const t = norm(q); if (!t) return null; for (const [name, test] of ROUTES) { if (test(t)) return name; } return null; }
function answerFor(q) {
  const t = norm(q), intent = intentOf(q); if (!intent) return null;
  switch (intent) {
    case 'help': return ansHelp();
    case 'compare': { const p = periodOf(t, 'month'); return ansCompare(p.kind); }
    case 'forecast': return ansForecast();
    case 'lost': return ansLost();
    case 'demand': return ansDemand();
    case 'stuck_deals': return ansDeals(true);
    case 'deals': return ansDeals(false);
    case 'sources': return ansSources(t);
    case 'speed': return ansSpeed();
    case 'health': return ansHealth();
    case 'stuck_inventory': return ansStuckUnits();
    case 'owners': return ansOwners();
    case 'focus': return ansFocus();
    case 'team': return ansTeam(t);
    case 'revenue': { const p = periodOf(t, 'month'); return ansRevenue(p.kind, p.off); }
    case 'brief': { const p = periodOf(t, 'week'); return ansBrief(p.kind, p.off); }
  }
  return null;
}
function route(q) { const a = answerFor(q); return a ? a.intent : null; }

/* ------------------------------------------------------------------ Claude (optional) */
function claudeTools() {
  const obj = (props, req) => ({ type: 'object', properties: props, required: req || [] });
  const r0 = (v) => isNum(v) ? Math.round(v) : null;
  return [
    { name: 'business_summary', description: 'Counts and money for a period: enquiries, qualified, visits, proposals, letters of intent, signed leases, brokerage earned (rupees), weighted pipeline (rupees), against the period before.', inputSchema: obj({ period: { type: 'string', enum: ['week', 'month'] } }, ['period']),
      execute: (i) => { const m = metricList(i.period === 'month' ? 'month' : 'week', 0); return { current_range: rangeText(m.wc), previous_range: rangeText(m.wp), measures: m.rows.map(r => ({ measure: r.label, current: r0(r.a), previous: r0(r.b) })), note: 'Brokerage and pipeline are in rupees. Reply times are seconds (AI) and minutes (human).' }; } },
    { name: 'pipeline_deals', description: 'Top 10 open deals by expected brokerage: client, stage, unit, expected and weighted brokerage in rupees, agent, days in stage.', inputSchema: obj({}),
      execute: () => deals().filter(d => isNum(d.exp)).sort((a, b) => b.exp - a.exp).slice(0, 10).map(d => ({ client: nameOf(d.c), stage: d.c.stage, unit: d.u ? d.u.unit_id : null, expected_brokerage: r0(d.exp), weighted_brokerage: r0(d.w), agent: d.c.agent, days_in_stage: d.days })) },
    { name: 'team_scorecard', description: 'Per agent over the last 30 days: open clients, visits done, proposals, signed leases, brokerage in rupees, overdue follow-ups, median first human contact in minutes.', inputSchema: obj({}),
      execute: () => team().map(r => ({ agent: r.a.name, open_clients: r.open.length, visits_30d: r.visits, proposals_30d: r.proposals, signed_30d: r.signed, brokerage_30d: r0(r.brokerage), overdue_follow_ups: r.overdue.length, median_first_human_min: r0(r.human) })) },
    { name: 'source_stats', description: 'Per lead source over the last 70 days: enquiries, qualified, visits, signed leases, brokerage. Ad spend is not in the data.', inputSchema: obj({}),
      execute: () => sourceRows(null).map(r => ({ source: r.s, enquiries: r.enq, qualified: r.qual, visits: r.vis, signed: r.signed, brokerage: r0(r.brokerage) })) },
    { name: 'demand_supply', description: 'Open client requirements by use and city against available units: clients wanting, units listed, units that fit, clients with no fit.', inputSchema: obj({}),
      execute: () => { const D = demand(); return { open_clients: D.n, clients_with_no_fit: D.totalUnmet, cells: D.city.slice(0, 14).map(g => ({ use: g.use, city: g.area, clients: g.n, units_listed: g.units, units_that_fit: g.fit, clients_no_fit: g.unmet })) }; } },
  ];
}
async function claudeAnswer(q) {
  const instr = 'You are the CEO co-pilot for a commercial real estate leasing agency in Odisha, India. Answer only from the results of the tools you call. If the tool results do not cover the question, say plainly that the data does not cover it. Use plain, short English (under 130 words). Do not use em-dashes. Write rupees with Indian grouping, for example ₹1.6 L or ₹85,500. Do not invent clients, units or numbers.';
  const r = await LC.ai.sample([{ role: 'user', content: instr + '\n\nQuestion: ' + q }], { tools: claudeTools(), cache: false });
  const text = String((r && r.text) || '').replace(/\s*[\u2014]\s*/g, ', ').trim();
  if (!text) throw new Error('empty');
  return text;
}
function textToHtml(text) {
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => { const lines = b.split('\n'); if (lines.every(l => /^\s*[-*•]\s+/.test(l))) return '<ul class="ceo-list">' + lines.map(l => '<li>' + esc(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>'; return '<p>' + esc(b).replace(/\n/g, '<br>') + '</p>'; }).join('');
}

/* ------------------------------------------------------------------ chat */
let chatBody = null, busy = false, fbN = 0, rec = null;
const SAMPLE_QS = ['What brokerage did we earn this month?', 'What\'s the forecast for the next 90 days?', 'What are the biggest deals in the pipeline?', 'Who\'s performing best?', 'What are occupiers asking for that we don\'t have?', 'What should I focus on this week?'];
function toBottom(node) { if (!chatBody) return; if (node) chatBody.scrollTop += node.getBoundingClientRect().top - chatBody.getBoundingClientRect().top - 8; else chatBody.scrollTop = chatBody.scrollHeight; }
function addMe(text) { const d = document.createElement('div'); d.className = 'msg me'; d.textContent = text; chatBody.appendChild(d); return d; }
function aiNode(a) {
  const d = document.createElement('div'); d.className = 'msg ai'; d.dataset.intent = a.intent;
  const bottom = (a.actions || []).map((x, i) => x.inline ? '' : '<button type="button" class="btn sm' + (x.primary ? ' primary' : '') + '" data-act="' + i + '">' + esc(x.label) + '</button>').join('');
  d.innerHTML = (a.lead ? '<p>' + esc(a.lead) + '</p>' : '') + (a.html || '') + (bottom ? '<div class="ceo-acts">' + bottom + '</div>' : '') +
    (a.src ? '<div class="src"><b>From:</b> ' + esc(a.src.from) + ' · <b>Definition:</b> ' + esc(a.src.def) + '</div>' : '');
  d._acts = a.actions || [];
  return d;
}
function postAI(a, replace) { const d = aiNode(a); if (replace && replace.parentNode) replace.replaceWith(d); else chatBody.appendChild(d); return d; }
function fallback() {
  const sug = []; for (let i = 0; i < 3; i++) sug.push(SAMPLE_QS[(fbN + i) % SAMPLE_QS.length]); fbN += 3;
  return A('fallback', 'I can\'t answer that from the data I have yet.',
    '<p class="ceo-lede">I answer from the clients, visits, units, owners, tasks and queue on this page, using written definitions. Here are three I can answer now:</p>' + chips(sug) + '<p class="ceo-lede">Ask "What can you answer?" for the full list.</p>',
    { src: srcOf('No named data or written definition covers this question', 'Nothing was guessed.') });
}
async function ask(text) {
  text = String(text || '').trim(); if (!text || !chatBody) return;
  if (busy) return;
  const me = addMe(text); toBottom(me);
  let a = null;
  try { a = answerFor(text); } catch (e) { console.error('[ceo] route', e); }
  if (a) { const n = postAI(a); toBottom(me); return n; }
  if (LC.ai && LC.ai.sample) {
    busy = true;
    const wait = document.createElement('div'); wait.className = 'msg ai'; wait.dataset.intent = 'thinking'; wait.innerHTML = '<p class="ceo-typing">Checking the data…</p>'; chatBody.appendChild(wait); toBottom(me);
    try {
      const out = await claudeAnswer(text);
      const d = postAI(A('claude', '', '<p class="ceo-lede"><span class="ai-tag">' + LC.aiName + '</span></p>' + textToHtml(out), { src: srcOf('Page tools: business summary, pipeline deals, team scorecard, lead sources, demand and supply', LC.aiName + ' answers only from what those tools return. If the data does not cover it, it says so.') }), wait);
      busy = false; return d;
    } catch (e) { busy = false; return postAI(fallback(), wait); }
  }
  const d = postAI(fallback()); toBottom(me); return d;
}
function welcome() {
  const d = document.createElement('div'); d.className = 'msg ai'; d.dataset.intent = 'welcome';
  d.innerHTML = '<p>Ask me about money, the pipeline, the team, the market or your inventory in plain words. I answer from the live data on this page and say where each answer came from.</p>' + chips(['What should I focus on this week?', 'What are occupiers asking for that we don\'t have?', 'What can you answer?']);
  chatBody.appendChild(d);
}
function onClick(e) {
  const t = e.target.closest('[data-act],[data-unit],[data-client],[data-ask]'); if (!t || !chatBody.contains(t)) return;
  if (t.dataset.ask) return void ask(t.dataset.ask);
  if (t.dataset.unit) return void callFn('openUnit', t.dataset.unit);
  if (t.dataset.client) return void callFn('openClient', t.dataset.client);
  if (t.dataset.act != null) { const m = t.closest('.msg.ai'); const a = m && m._acts[+t.dataset.act]; if (a) a.fn(); }
}

/* ------------------------------------------------------------------ voice */
const VOICE_MSG = 'Voice needs microphone access; it works when the demo file is opened in Chrome.';
function setupVoice(root) {
  const btn = LC.$('#ceo-mic', root), note = LC.$('#ceo-voice-note', root), inp = LC.$('#ceo-in', root), langSel = LC.$('#ceo-lang', root);
  const say = (m) => { note.textContent = m || ''; };
  btn.addEventListener('click', () => {
    if (rec) { try { rec.stop(); } catch (e) { } return; }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { say(VOICE_MSG); return; }
    say('');
    try {
      rec = new Rec(); rec.lang = langSel.value; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onstart = () => { btn.setAttribute('aria-pressed', 'true'); say('Listening…'); };
      rec.onresult = (ev) => { const txt = ev.results[0][0].transcript; inp.value = ''; say(''); ask(txt); };
      rec.onerror = (ev) => { say(ev.error === 'no-speech' ? 'I did not hear anything. Try again.' : ev.error === 'aborted' ? '' : VOICE_MSG); };
      rec.onend = () => { btn.setAttribute('aria-pressed', 'false'); rec = null; if (note.textContent === 'Listening…') say(''); };
      rec.start();
    } catch (e) { rec = null; btn.setAttribute('aria-pressed', 'false'); say(VOICE_MSG); }
  });
}

/* ------------------------------------------------------------------ view */
function suggestions() {
  return [
    ['Money', ['What brokerage did we earn this month?', 'What\'s the forecast for the next 90 days?', 'Compare this month with last month', 'How are we doing this week?']],
    ['Pipeline', ['What are the biggest deals in the pipeline?', 'Which lead source should I spend more on?', 'Which big deals are stuck?']],
    ['Team', ['Who\'s performing best?', 'How is Ananya doing?', 'Are we replying fast enough?']],
    ['Market and inventory', ['What are occupiers asking for that we don\'t have?', 'Which units should we push?', 'Is our inventory up to date?', 'Which owners bring us the most business?']],
    ['Risks', ['Where are we losing deals?', 'What are the biggest risks right now?']],
    ['Focus', ['What should I focus on this week?', 'What can you answer?']],
  ];
}
function aiNote() { const n = LC.$('#ceo-ai-note'); if (n) n.innerHTML = LC.ai && LC.ai.sample ? '<span class="ai-tag">' + LC.aiName + '</span> is on: if a question is not in the list, I will try it with ' + LC.aiName + ' using only the page data.' : 'Questions outside this list get an honest "I can\'t answer that yet".'; }

LC.registerView('ceo', {
  title: 'CEO co-pilot', sub: 'The business in plain numbers, and what to do about it',
  render(el) {
    rootEl = el; cache = null;
    const mic = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    el.innerHTML = '<div class="card ceo-brief" id="ceo-brief"></div>' +
      '<div class="split ceo-split">' +
      '<div class="card chat ceo-chat"><div class="card-h"><h2>Ask the CEO co-pilot</h2><span class="spacer"></span><span class="pill brand" title="Answers are built from the clients, visits, units, owners, tasks and queue on this page.">Live data</span><button type="button" class="btn sm" id="ceo-clear">Clear chat</button></div>' +
      '<div class="chat-body" id="ceo-body" aria-live="polite"></div>' +
      '<form class="chat-input" id="ceo-form" autocomplete="off"><input class="input" id="ceo-in" type="text" placeholder="Ask in plain words, for example: how are we doing?" aria-label="Your question" maxlength="300">' +
      '<select class="input ceo-lang" id="ceo-lang" aria-label="Voice language"><option value="en-IN">English</option><option value="hi-IN">Hindi</option></select>' +
      '<button type="button" class="btn ceo-mic" id="ceo-mic" aria-label="Speak your question" aria-pressed="false" title="Speak your question">' + mic + '</button>' +
      '<button type="submit" class="btn primary">Ask</button></form>' +
      '<div class="ceo-foot"><div class="ceo-voice-note" id="ceo-voice-note" role="status"></div><div class="ceo-guard">Answers come only from named data and written definitions. If a question is not covered, I say so.</div></div></div>' +
      '<div class="card"><div class="card-h"><h2>Suggested questions</h2></div><div class="card-b ceo-sug">' +
      suggestions().map(([g, qs]) => '<div><h3>' + esc(g) + '</h3><div class="chips">' + qs.map(q => '<button type="button" class="chip" data-ask="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div></div>').join('') +
      '<p class="ceo-lede" id="ceo-ai-note"></p></div></div></div>';
    paintBrief();
    const slot = LC.$('#ceo-body', el);
    if (chatBody) slot.replaceWith(chatBody);
    else { chatBody = slot; welcome(); chatBody.addEventListener('click', onClick); }
    LC.$('#ceo-brief', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-period],[data-brief]'); if (!b) return;
      if (b.dataset.period) { period = b.dataset.period; paintBrief(); return; }
      if (b.dataset.brief === 'client') callFn('openClient', b.dataset.id);
      if (b.dataset.brief === 'ask') { ask(b.dataset.q); const c = LC.$('.ceo-chat', el); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
    LC.$('#ceo-form', el).addEventListener('submit', (e) => { e.preventDefault(); const i = LC.$('#ceo-in', el); const v = i.value; i.value = ''; ask(v); });
    LC.$('#ceo-clear', el).addEventListener('click', () => { chatBody.innerHTML = ''; welcome(); });
    LC.$$('.ceo-sug .chip', el).forEach(b => b.addEventListener('click', () => ask(b.dataset.ask)));
    setupVoice(el); aiNote();
    chatBody.scrollTop = chatBody.scrollHeight;
  },
  onHide() { if (rec) { try { rec.abort(); } catch (e) { } rec = null; } clearTimeout(briefTimer); },
});
LC.on('ai:ready', aiNote);
LC.on('reset', () => { chatBody = null; busy = false; fbN = 0; cache = null; rootEl = null; });

LC.ceo = { brief, route, ask, answer: answerFor };
})();
