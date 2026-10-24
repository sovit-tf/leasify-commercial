/* =====================================================================
   Leasify Commercial demo: INVENTORY
   Listings view (grid, list, map, table), unit detail drawer, compare,
   Google Sheet sync and the weekly owner check.
   Entry points: LC.openUnit, LC.openCompare, LC.runOwnerCheck
   View param (LC.go('inventory', param)): { q, city, only: 'stale'|'neg', type, unitId }
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc;

/* ---------------- small helpers ---------------- */
const U = () => LC.state.units;
const FD = () => LC.settings().freshnessDays;
const trim2 = (n) => (Math.round(n * 100) / 100).toString();
const psf = (n) => n == null || isNaN(n) ? 'n/a' : '₹' + trim2(n) + '/sq ft';
const lakh = (n) => LC.fmtLakh(n);
const yn = (v) => v === 'Yes' ? 'Yes' : v === 'No' ? 'No' : (v || 'n/a');
const STATUSES = ['Available', 'Under negotiation', 'LOI signed', 'Leased'];
const statusClass = (s) => ({ 'Available': 'good', 'Under negotiation': 'warn', 'LOI signed': 'brand', 'Leased': 'bad' }[s] || '');
const statusPill = (s) => '<span class="pill ' + statusClass(s) + '" title="Listing status. Only Available units are offered to occupiers.">' + esc(s) + '</span>';
const freshPill = (u) => { const f = LC.unitFreshness(u); return '<span class="pill ' + LC.pillFor(f.level) + '" title="Days since the owner last confirmed this unit is available on these terms. Over ' + FD() + ' days it drops out of matching.">' + esc(f.label) + '</span>'; };
const gradePill = (u) => '<span class="pill" title="Building grade. A is newest with the best specs and management.">Grade ' + esc(u.grade) + '</span>';
const mandatePill = (u) => u.mandate === 'Exclusive' ? '<span class="pill brand" title="Exclusive mandate: this desk is the only agency authorised to market the unit.">Exclusive</span>' : '';
const ICON = {
  heart: (on) => '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.700 3.700 4.500 7 4.500c2 0 3.500 1.100 5 3 1.500-1.900 3-3 5-3 3.300 0 5.400 3.200 4.200 6.600-1.700 4.800-9.200 9.400-9.200 9.400z"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.200 7-12a7 7 0 1 0-14 0c0 5.800 7 12 7 12z"/><circle cx="12" cy="9" r="2.500"/></svg>',
};
const todayISO = () => LC.iso(LC.today());
const daysOnMarket = (u) => Math.max(0, LC.daysAgo(u.listed_date));
function audit(u, field, from, to, by) {
  LC.state.audit.unshift({ ts: Date.now(), unitId: u.unit_id, field, from: from == null ? '' : String(from), to: to == null ? '' : String(to), by: by || LC.state.me });
}
async function copyText(text) { return LC.copy(text); }

/* ---------------- module CSS (tokens only) ---------------- */
LC.css(`
#v-inventory > * { min-width:0; }
.inv-head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; }
.inv-head .lede { flex:1 1 320px; }
.inv-acts { display:flex; gap:8px; flex-wrap:wrap; }
.inv-kpi { text-align:left; font:inherit; color:inherit; cursor:pointer; width:100%; }
.inv-kpi:hover, .inv-kpi[aria-pressed="true"] { border-color:var(--brand); }
.inv-kpi[aria-pressed="true"] { box-shadow:0 0 0 3px var(--glow); }
.inv-kpi.static { cursor:default; }
.inv-kpi.static:hover { border-color:var(--hair); }
.inv-fb { display:grid; gap:12px; }
.inv-fgrid { display:grid; grid-template-columns:repeat(auto-fit, minmax(132px, 1fr)); gap:10px 12px; align-items:end; }
.inv-fgrid .wide { grid-column:span 2; }
.inv-sizes { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.inv-frow { display:flex; flex-wrap:wrap; gap:8px 18px; align-items:center; }
.inv-frow .lbl { font-size:11.5px; font-weight:600; color:var(--muted); letter-spacing:.02em; }
.chip[aria-pressed="true"] { background:var(--brand); border-color:var(--brand); color:var(--on-brand); }
.chip[aria-pressed="true"]:hover { color:var(--on-brand); filter:brightness(1.08); }
.inv-more { border-top:1px solid var(--hair); padding-top:12px; display:grid; gap:12px; }
.inv-more[hidden] { display:none; }
.inv-checks { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:8px 16px; }
.inv-ac { display:inline-flex; align-items:center; gap:6px; background:var(--glow); border-color:transparent; color:var(--brand-ink); }
.inv-ac b { font-weight:700; }
.inv-bar { display:flex; gap:10px 14px; align-items:center; flex-wrap:wrap; justify-content:space-between; }
.inv-bar .count { font-weight:600; }
.inv-bar .right { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.inv-bar select.input { width:auto; }

.inv-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:16px; }
.inv-card { background:var(--surface); border:1px solid var(--hair); border-radius:var(--r); box-shadow:var(--shadow); overflow:hidden; display:flex; flex-direction:column; min-width:0; cursor:pointer; position:relative; }
.inv-card:hover { border-color:var(--brand); }
.inv-card.dim .inv-ph img { opacity:.6; }
.inv-ph { position:relative; aspect-ratio:16/10; background:var(--surface-2); flex:none; }
.inv-ph img { width:100%; height:100%; object-fit:cover; display:block; }
.inv-badges { position:absolute; left:8px; top:8px; right:50px; display:flex; gap:4px; flex-wrap:wrap; }
.inv-badges .pill { box-shadow:0 1px 3px rgba(0,0,0,.28); }
.inv-badges .pill:not(.good):not(.warn):not(.bad):not(.brand) { background:var(--surface); }
.inv-side { position:absolute; right:8px; top:8px; }
.inv-ic { width:32px; height:32px; border-radius:50%; border:0; background:var(--surface); color:var(--fg); display:grid; place-items:center; box-shadow:0 1px 3px rgba(0,0,0,.28); padding:0; }
.inv-ic[aria-pressed="true"] { color:var(--bad); }
.inv-ic:hover { color:var(--brand-ink); }
.inv-cmp { position:absolute; right:8px; bottom:8px; background:var(--surface); border-radius:6px; padding:3px 8px 3px 6px; font-size:12px; display:flex; gap:6px; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,.28); cursor:pointer; }
.inv-cmp input { margin:0; }
.inv-cb { padding:12px 14px 14px; display:grid; gap:7px; align-content:start; min-width:0; flex:1; }
.inv-title { font-family:var(--f-head); font-weight:600; font-size:14.5px; line-height:1.3; text-align:left; background:none; border:0; padding:0; color:var(--fg); }
.inv-title:hover { color:var(--brand-ink); }
.inv-addr { font-size:12px; color:var(--muted); }
.inv-price { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.inv-price b { font-family:var(--f-head); font-size:20px; letter-spacing:-.01em; }
.inv-price span { color:var(--muted); font-size:12.5px; }
.inv-facts { display:flex; flex-wrap:wrap; gap:3px 12px; font-size:12px; color:var(--fg-2); }
.inv-facts i { font-style:normal; color:var(--muted); }
.inv-hl { display:flex; flex-wrap:wrap; gap:5px; }
.inv-hl span { background:var(--surface-2); border-radius:999px; padding:2px 9px; font-size:11.5px; color:var(--fg-2); }
.inv-flag { display:flex; gap:7px; align-items:flex-start; background:var(--warn-bg); color:var(--warn); border-radius:6px; padding:6px 9px; font-size:12px; }
.inv-flag svg { flex:none; margin-top:2px; }
.inv-list { display:grid; gap:12px; }
.inv-list .inv-card { flex-direction:row; }
.inv-list .inv-ph { width:260px; aspect-ratio:auto; min-height:170px; }
.inv-list .inv-cb { grid-template-columns:minmax(0,1fr); }
.inv-th { background:none; border:0; padding:0; font:inherit; font-weight:600; font-size:11px; letter-spacing:.03em; color:var(--muted); cursor:pointer; white-space:nowrap; }
.inv-th:hover { color:var(--brand-ink); }
.tbl .unit-id { white-space:nowrap; }
.inv-tcell-t { max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.inv-mapgrid { display:grid; grid-template-columns:minmax(0,620px) minmax(0,1fr); gap:16px; align-items:start; }
.inv-mapwrap { position:relative; border:1px solid var(--hair); border-radius:var(--r); overflow:hidden; background:var(--surface-2); }
svg.inv-map { width:100%; height:auto; display:block; }
.inv-map .gl { stroke:var(--grid); stroke-width:1; }
.inv-map .rd { stroke:var(--axis); stroke-width:3.5; fill:none; stroke-linecap:round; stroke-linejoin:round; }
.inv-map .rd.by { stroke-dasharray:2 7; stroke-width:3; }
.inv-map .ld { fill:var(--axis); }
.inv-map .lt { font-size:10px; fill:var(--muted); paint-order:stroke; stroke:var(--surface-2); stroke-width:3px; stroke-linejoin:round; }
.inv-map .lc { font-size:13px; font-weight:700; fill:var(--fg-2); letter-spacing:.04em; text-transform:uppercase; paint-order:stroke; stroke:var(--surface-2); stroke-width:4px; }
.inv-map .sb { stroke:var(--fg-2); stroke-width:2; }
.inv-map .sbt { font-size:10px; fill:var(--fg-2); }
.inv-pin { cursor:pointer; outline:none; }
.inv-pin circle { stroke:var(--surface); stroke-width:2; }
.inv-pin.s-av circle { fill:var(--good); }
.inv-pin.s-ng circle { fill:var(--warn); }
.inv-pin.s-loi circle { fill:var(--brand); }
.inv-pin.s-ls circle { fill:var(--s3); }
.inv-pin:hover circle, .inv-pin:focus-visible circle, .inv-pin.on circle { stroke:var(--fg); stroke-width:2.5; }
.inv-pin .ring { fill:none; stroke:var(--fg); stroke-width:1.5; opacity:0; }
.inv-pin.on .ring { opacity:.6; }
.inv-mini { position:absolute; width:226px; background:var(--surface); border:1px solid var(--border); border-radius:8px; box-shadow:0 8px 28px rgba(0,0,0,.22); overflow:hidden; z-index:5; font-size:12px; }
.inv-mini[hidden] { display:none; }
.inv-mini img { width:100%; height:92px; object-fit:cover; display:block; }
.inv-mini .b { padding:8px 10px 10px; display:grid; gap:4px; }
.inv-mini .b b { font-size:12.5px; line-height:1.3; }
.inv-legend { display:flex; flex-wrap:wrap; gap:6px 14px; font-size:11.5px; color:var(--muted); align-items:center; }
.inv-legend i { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:5px; vertical-align:-1px; }
.inv-legend .ln { display:inline-block; width:22px; height:0; border-top:3px solid var(--axis); margin-right:5px; vertical-align:middle; }
.inv-legend .ln.by { border-top-style:dotted; }
.inv-onmap { display:grid; gap:0; max-height:560px; overflow-y:auto; }
.inv-onmap button { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:2px 10px; text-align:left; background:none; border:0; border-bottom:1px solid var(--hair); padding:8px 4px; }
.inv-onmap button:hover, .inv-onmap button.on { background:var(--surface-2); }
.inv-onmap .t { font-size:12.5px; font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.inv-onmap .s { font-size:11.5px; color:var(--muted); }
.inv-onmap .p { font-family:var(--f-mono); font-size:12px; text-align:right; grid-row:span 2; align-self:center; }

.inv-tray { position:fixed; left:232px; right:0; bottom:0; z-index:40; background:var(--surface); border-top:1px solid var(--border); box-shadow:0 -6px 24px rgba(0,0,0,.14); padding:10px 28px calc(10px + env(safe-area-inset-bottom, 0px)); display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.inv-tray[hidden] { display:none; }
.inv-tray .th { display:flex; gap:8px; flex-wrap:wrap; }
.inv-tray .th span { position:relative; display:block; }
.inv-tray .th img { width:56px; height:42px; object-fit:cover; border-radius:5px; display:block; border:1px solid var(--hair); }
.inv-tray .th button { position:absolute; top:-6px; right:-6px; width:18px; height:18px; border-radius:50%; border:1px solid var(--border); background:var(--surface); font-size:12px; line-height:1; padding:0; color:var(--fg); }
.inv-tray .sp { flex:1; }
.view.inv-pad { padding-bottom:76px; }

/* unit drawer */
.inv-ud { display:grid; gap:18px; }
.inv-gal { display:grid; gap:8px; }
.inv-gmain { position:relative; border-radius:var(--r); overflow:hidden; background:var(--surface-2); aspect-ratio:16/10; }
.inv-gmain img { width:100%; height:100%; object-fit:cover; display:block; }
.inv-gmain .fpbox { padding:12px; height:100%; display:grid; align-items:center; background:var(--surface-2); }
.inv-gmain .tag { position:absolute; right:8px; top:8px; }
.inv-gthumbs { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; }
.inv-gthumbs button { flex:none; width:76px; height:56px; padding:0; border:2px solid transparent; border-radius:6px; overflow:hidden; background:var(--surface-2); }
.inv-gthumbs button[aria-pressed="true"] { border-color:var(--brand); }
.inv-gthumbs img { width:100%; height:100%; object-fit:cover; display:block; }
.inv-gthumbs .fpb { width:auto; padding:0 12px; font-size:12px; font-weight:600; }
.inv-pills { display:flex; flex-wrap:wrap; gap:6px; }
.inv-sec { border:1px solid var(--hair); border-radius:var(--r); }
.inv-sec > h3 { font-size:14px; padding:10px 14px; border-bottom:1px solid var(--hair); font-weight:600; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.inv-sec > .b { padding:12px 14px; display:grid; gap:12px; }
.inv-kv3 { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px 16px; }
.inv-kv3 div { display:grid; gap:1px; min-width:0; }
.inv-kv3 div > span { font-size:11px; color:var(--muted); }
.inv-kv3 b { font-weight:500; font-size:13px; }
.inv-kv3 b.big { font-family:var(--f-head); font-size:17px; font-weight:700; }
.inv-grp { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); font-weight:600; margin-bottom:6px; }
.inv-form { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px 12px; align-items:end; }
.inv-out { display:grid; gap:10px; }
.inv-mini-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; }
.inv-mini-kpis div { background:var(--surface-2); border-radius:7px; padding:8px 10px; display:grid; }
.inv-mini-kpis b { font-family:var(--f-head); font-size:17px; font-variant-numeric:tabular-nums; }
.inv-mini-kpis span { font-size:11px; color:var(--muted); }
.inv-fit { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 12px; align-items:center; padding:9px 0; border-bottom:1px solid var(--hair); }
.inv-fit:last-child { border-bottom:0; }
.inv-fit .n { font-weight:600; font-size:13px; }
.inv-fit .m { font-size:11.5px; color:var(--muted); }
.inv-acts2 { display:flex; flex-wrap:wrap; gap:8px; }
.inv-pre { margin:0; white-space:pre-wrap; font-family:var(--f-mono); font-size:11.5px; background:var(--surface-2); border:1px solid var(--hair); border-radius:6px; padding:12px; line-height:1.55; }
.inv-sim { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:10px; }
.inv-simc { background:var(--surface); border:1px solid var(--hair); border-radius:8px; overflow:hidden; text-align:left; padding:0; display:grid; }
.inv-simc:hover { border-color:var(--brand); }
.inv-simc img { width:100%; height:84px; object-fit:cover; display:block; }
.inv-simc div { padding:8px 10px; display:grid; gap:2px; font-size:12px; }
.inv-simc b { font-size:12.5px; line-height:1.3; }
.inv-chiprow { display:flex; flex-wrap:wrap; gap:6px; }
.inv-chiprow span { background:var(--surface-2); border-radius:999px; padding:3px 10px; font-size:12px; }
.inv-cmpt th.sticky, .inv-cmpt td.sticky { position:sticky; left:0; background:var(--surface); z-index:1; min-width:116px; }
.inv-cmpt td, .inv-cmpt th { min-width:170px; vertical-align:top; }
.inv-cmpt th:first-child, .inv-cmpt td:first-child { min-width:116px; }
.inv-cmpt img { width:100%; height:92px; object-fit:cover; border-radius:6px; display:block; margin-bottom:6px; }
.inv-cmpt .best { margin-left:6px; }

/* sync + owner check */
.inv-sy { display:grid; gap:16px; }
.inv-tiles { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; }
.inv-tiles div { background:var(--surface-2); border-radius:7px; padding:8px 10px; display:grid; }
.inv-tiles b { font-family:var(--f-head); font-size:20px; font-variant-numeric:tabular-nums; }
.inv-tiles span { font-size:11px; color:var(--muted); }
.inv-chg { list-style:none; margin:0; padding:0; display:grid; gap:8px; font-size:12.5px; }
.inv-chg li { border-bottom:1px solid var(--hair); padding-bottom:8px; }
.inv-chg code { font-family:var(--f-mono); font-size:11.5px; background:var(--surface-2); border-radius:4px; padding:1px 5px; }
.inv-chg .f { display:flex; flex-wrap:wrap; gap:4px 6px; margin-top:4px; }
.inv-wa { background:var(--wa-bg); color:var(--wa-fg); border-radius:10px; padding:10px; max-height:52vh; overflow-y:auto; display:flex; flex-direction:column; gap:12px; }
.inv-wrow { display:flex; flex-direction:column; gap:5px; }
.inv-wrow .who { font-size:11px; color:var(--wa-meta); font-weight:600; }
.inv-wrow .bub { max-width:92%; }
.inv-wrow .wait { align-self:flex-end; font-size:11px; color:var(--wa-meta); }
.inv-prog { height:6px; background:var(--grid); border-radius:3px; overflow:hidden; }
.inv-prog i { display:block; height:100%; background:var(--brand); width:0; transition:width .25s; }
details.inv-det > summary { cursor:pointer; font-weight:600; font-size:13px; padding:6px 0; }
.inv-dict { max-height:300px; overflow:auto; }

@media (max-width: 860px) {
  .inv-tray { left:0; padding:10px 16px calc(10px + env(safe-area-inset-bottom, 0px)); }
  .inv-mapgrid { grid-template-columns:minmax(0,1fr); }
  .inv-list .inv-card { flex-direction:column; }
  .inv-list .inv-ph { width:100%; aspect-ratio:16/10; min-height:0; }
  .inv-tiles { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .inv-fgrid .wide { grid-column:auto; }
}
`);

/* ---------------- filter state ---------------- */
const CITY_MAP = { 'Bhubaneswar': 'Bhubaneswar', 'Cuttack': 'Cuttack', 'Puri': 'Puri', 'Trisulia': 'Cuttack (Trisulia)', 'Phulnakhara': 'Cuttack (Phulnakhara)', 'Jatni': 'Jatni' };
const DEF = () => ({
  q: '', city: 'All', types: new Set(), sizeMin: '', sizeMax: '', maxPsf: '', furn: '', avail: 'any', incNeg: false, incLeased: false,
  parking: '', power100: false, ground: false, frontage: '', clearH: '', fireNoc: false, oc: false, lift: false, mainRoad: false,
  grades: new Set(), exclusive: false, hideStale: false, use: '',
  only: null, shortOnly: false,
});
let F = Object.assign(DEF(), { sort: 'rec', view: 'grid', mapTab: 'region', tsort: null, moreOpen: false });
let root = null;
let recMap = null;
LC.on('reset', () => { F = Object.assign(DEF(), { sort: 'rec', view: 'grid', mapTab: 'region', tsort: null, moreOpen: false }); });

function haystack(u) {
  const L = LC.LOCALITIES[u.locality]; const city = LC.cityOf(u);
  return [u.listing_title, u.building_name, u.locality, u.micro_market, u.address, u.unit_id, u.unit_no, u.city, u.property_type, u.pincode,
    L ? L.aliases.join(' ') : '', (LC.CITIES[city] || []).join(' ')].join(' ').toLowerCase();
}
function passes(u) {
  const fd = FD(); const f = LC.unitFreshness(u);
  if (F.only === 'neg') { if (u.status !== 'Under negotiation' && u.status !== 'LOI signed') return false; }
  else if (F.only === 'stale') { if (u.status !== 'Available' || f.days <= fd) return false; }
  else {
    const ok = u.status === 'Available' || (F.incNeg && (u.status === 'Under negotiation' || u.status === 'LOI signed')) || (F.incLeased && u.status === 'Leased');
    if (!ok) return false;
  }
  if (F.avail !== 'any') { const d = LC.parseDate(u.available_from); const lim = F.avail === 'now' ? LC.today() : LC.addDays(LC.today(), 30); if (!d || d > lim) return false; }
  if (F.city !== 'All' && u.city !== CITY_MAP[F.city]) return false;
  if (F.types.size && !F.types.has(u.property_type)) return false;
  if (F.sizeMin !== '' && u.chargeable_sqft < +F.sizeMin) return false;
  if (F.sizeMax !== '' && u.chargeable_sqft > +F.sizeMax) return false;
  if (F.maxPsf !== '' && u.all_in_per_sqft > +F.maxPsf) return false;
  if (F.furn && u.furnishing !== F.furn) return false;
  if (F.parking !== '' && !(u.parking_4w >= +F.parking)) return false;
  if (F.power100 && u.power_backup !== '100%') return false;
  if (F.ground && u.floor !== 0) return false;
  if (F.frontage !== '' && !(u.frontage_ft >= +F.frontage)) return false;
  if (F.clearH !== '' && !(u.clear_height_ft >= +F.clearH)) return false;
  if (F.fireNoc && u.fire_noc !== 'Yes') return false;
  if (F.oc && u.occupancy_certificate !== 'Yes') return false;
  if (F.lift && !u.amenities.includes('Lift')) return false;
  if (F.mainRoad && !u.amenities.includes('Main road facing')) return false;
  if (F.grades.size && !F.grades.has(u.grade)) return false;
  if (F.exclusive && u.mandate !== 'Exclusive') return false;
  if (F.hideStale && f.days > fd) return false;
  if (F.use.trim() && !u.permitted_uses.join(' ').toLowerCase().includes(F.use.trim().toLowerCase())) return false;
  if (F.shortOnly && !LC.state.shortlist.includes(u.unit_id)) return false;
  if (F.q.trim()) { const h = haystack(u); if (!F.q.toLowerCase().split(/\s+/).filter(Boolean).every(t => h.includes(t))) return false; }
  return true;
}
function buildRec() {
  recMap = {};
  const byType = LC.groupBy(U(), u => u.property_type);
  Object.values(byType).forEach(arr => {
    const s = [...arr].sort((a, b) => a.all_in_per_sqft - b.all_in_per_sqft);
    s.forEach((u, i) => { recMap[u.unit_id] = s.length > 1 ? i / (s.length - 1) : 0; });
  });
}
function recScore(u) {
  const lv = { fresh: 0, aging: 1, stale: 2 }[LC.unitFreshness(u).level];
  const gr = { A: 0, B: 1, C: 2 }[u.grade] ?? 2;
  return (u.status === 'Available' ? 0 : 1000) + lv * 100 + gr * 10 + (recMap[u.unit_id] || 0) * 9.99;
}
const SORTS = {
  rec: ['Recommended', (a, b) => recScore(a) - recScore(b)],
  lo: ['All-in cost, low to high', (a, b) => a.all_in_per_sqft - b.all_in_per_sqft],
  hi: ['All-in cost, high to low', (a, b) => b.all_in_per_sqft - a.all_in_per_sqft],
  size: ['Size, large to small', (a, b) => b.chargeable_sqft - a.chargeable_sqft],
  new: ['Newest listed', (a, b) => LC.parseDate(b.listed_date) - LC.parseDate(a.listed_date)],
  conf: ['Recently confirmed', (a, b) => LC.parseDate(b.last_confirmed) - LC.parseDate(a.last_confirmed)],
  mkt: ['Longest on market', (a, b) => LC.parseDate(a.listed_date) - LC.parseDate(b.listed_date)],
};
const TCOLS = [
  { k: 'unit_id', l: 'Unit', get: u => u.unit_id },
  { k: 'listing_title', l: 'Listing', get: u => u.building_name + ' ' + u.unit_no },
  { k: 'locality', l: 'Locality', get: u => u.locality },
  { k: 'city', l: 'City', get: u => u.city },
  { k: 'property_type', l: 'Type', get: u => u.property_type },
  { k: 'status', l: 'Status', get: u => u.status },
  { k: 'chargeable_sqft', l: 'Chargeable sq ft', num: true, get: u => u.chargeable_sqft },
  { k: 'carpet_sqft', l: 'Carpet sq ft', num: true, get: u => u.carpet_sqft },
  { k: 'rent_per_sqft', l: 'Rent ₹/sq ft', num: true, get: u => u.rent_per_sqft },
  { k: 'cam_per_sqft', l: 'CAM ₹/sq ft', num: true, get: u => u.cam_per_sqft },
  { k: 'all_in_per_sqft', l: 'All-in ₹/sq ft', num: true, get: u => u.all_in_per_sqft },
  { k: 'all_in_monthly', l: 'All-in ₹/month', num: true, get: u => u.all_in_monthly },
  { k: 'deposit_months', l: 'Deposit (months)', num: true, get: u => u.deposit_months },
  { k: 'lock_in_months', l: 'Lock-in (months)', num: true, get: u => u.lock_in_months },
  { k: 'parking_4w', l: 'Car parks', num: true, get: u => u.parking_4w },
  { k: 'furnishing', l: 'Furnishing', get: u => u.furnishing },
  { k: 'available_from', l: 'Available from', get: u => u.available_from },
  { k: 'last_confirmed', l: 'Last confirmed', get: u => u.last_confirmed },
  { k: 'grade', l: 'Grade', get: u => u.grade },
  { k: 'mandate', l: 'Mandate', get: u => u.mandate },
];
function results() {
  if (!recMap) buildRec();
  const list = U().filter(passes);
  if (F.view === 'table' && F.tsort) {
    const c = TCOLS.find(x => x.k === F.tsort.k); const d = F.tsort.d;
    list.sort((a, b) => { const x = c.get(a), y = c.get(b); const r = c.num ? (x ?? -1) - (y ?? -1) : String(x ?? '').localeCompare(String(y ?? ''), 'en', { numeric: true }); return r * d || recScore(a) - recScore(b); });
  } else list.sort(SORTS[F.sort][1]);
  return list;
}

/* ---------------- shortlist and compare ---------------- */
function toggleShort(id) {
  const s = LC.state.shortlist; const i = s.indexOf(id);
  if (i >= 0) s.splice(i, 1); else s.push(id);
  LC.emit('shortlist:changed', id);
}
function toggleCompare(id) {
  const c = LC.state.compare; const i = c.indexOf(id);
  if (i >= 0) c.splice(i, 1);
  else { if (c.length >= 4) { LC.toast('You can compare up to 4 units. Remove one first.'); return false; } c.push(id); }
  LC.emit('compare:changed', id); return true;
}

/* ---------------- cards ---------------- */
function cardHTML(u, mode) {
  const sl = LC.state.shortlist.includes(u.unit_id), cp = LC.state.compare.includes(u.unit_id);
  const dim = u.status === 'Leased' ? ' dim' : '';
  const hl = (u.highlights || []).slice(0, 3).map(h => '<span>' + esc(h) + '</span>').join('');
  const isSeat = u.pricing_model === 'Per seat';
  return '<article class="inv-card' + dim + '" data-card="' + esc(u.unit_id) + '">' +
    '<div class="inv-ph"><img loading="lazy" src="' + LC.photo(u, 0) + '" alt="Illustration of ' + esc(u.property_type.toLowerCase()) + ' ' + esc(u.unit_id) + '">' +
    '<div class="inv-badges">' + statusPill(u.status) + freshPill(u) + gradePill(u) + mandatePill(u) + '</div>' +
    '<div class="inv-side"><button type="button" class="inv-ic" data-heart="' + esc(u.unit_id) + '" aria-pressed="' + sl + '" aria-label="' + (sl ? 'Remove ' : 'Add ') + esc(u.unit_id) + (sl ? ' from' : ' to') + ' shortlist">' + ICON.heart(sl) + '</button></div>' +
    '<label class="inv-cmp" title="Add to compare, up to 4 units"><input type="checkbox" id="inv-cmp-' + mode + '-' + esc(u.unit_id) + '" data-cmp="' + esc(u.unit_id) + '"' + (cp ? ' checked' : '') + '> Compare</label></div>' +
    '<div class="inv-cb">' +
    '<button type="button" class="inv-title" data-open="' + esc(u.unit_id) + '">' + esc(u.listing_title) + '</button>' +
    '<div class="inv-addr">' + esc(u.unit_id) + ' · ' + esc(u.address) + '</div>' +
    '<div class="inv-price"><b title="Rent plus common area maintenance per sq ft per month, before GST.">' + psf(u.all_in_per_sqft) + '</b><span>all-in · ' + lakh(u.all_in_monthly) + '/month</span></div>' +
    '<div class="inv-facts"><span><i>Chargeable</i> ' + LC.fmtSqft(u.chargeable_sqft) + '</span><span><i>Carpet</i> ' + LC.fmtSqft(u.carpet_sqft) + '</span><span>' + esc(u.furnishing) + '</span><span><i>From</i> ' + LC.fmtDate(u.available_from) + '</span>' + (isSeat ? '<span>' + u.seats + ' seats · ' + LC.fmtINR(u.price_per_seat) + '/seat</span>' : '') + '</div>' +
    (hl ? '<div class="inv-hl">' + hl + '</div>' : '') +
    (u.data_flag ? '<div class="inv-flag" role="note">' + ICON.warn + '<span>' + esc(u.data_flag) + '</span></div>' : '') +
    '</div></article>';
}

/* ---------------- table ---------------- */
function tableHTML(list) {
  const ts = F.tsort;
  const head = TCOLS.map(c => {
    const on = ts && ts.k === c.k; const arrow = on ? (ts.d === 1 ? ' ▲' : ' ▼') : '';
    return '<th class="' + (c.num ? 'r' : '') + '" scope="col" aria-sort="' + (on ? (ts.d === 1 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="inv-th" data-th="' + c.k + '" title="Sort by ' + esc(c.l) + '">' + esc(c.l) + arrow + '</button></th>';
  }).join('');
  const body = list.map(u => '<tr class="click' + (u.status === 'Leased' ? ' dim' : '') + '" data-row="' + esc(u.unit_id) + '" tabindex="0">' + TCOLS.map(c => {
    const v = c.get(u);
    if (c.k === 'unit_id') return '<td><span class="unit-id">' + esc(v) + '</span></td>';
    if (c.k === 'status') return '<td>' + statusPill(v) + '</td>';
    if (c.k === 'listing_title') return '<td class="inv-tcell-t" title="' + esc(u.listing_title) + '">' + esc(v) + '</td>';
    if (c.k === 'available_from') return '<td>' + LC.fmtDateY(v) + '</td>';
    if (c.k === 'last_confirmed') return '<td>' + freshPill(u) + '</td>';
    if (c.num) return '<td class="r num">' + (v == null ? 'n/a' : (v % 1 ? trim2(v) : LC.fmtNum(v))) + '</td>';
    return '<td>' + esc(v == null ? '' : v) + '</td>';
  }).join('') + '</tr>').join('');
  return '<div class="card"><div class="card-h"><h2>Table view</h2><span class="small muted">Click a heading to sort. Click a row to open the listing.</span><span class="spacer"></span><button type="button" class="btn sm" id="inv-csv">Copy as CSV</button></div><div class="tbl-wrap"><table class="tbl" aria-label="Inventory table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
}
function csvOf(list) {
  const cols = TCOLS.filter(c => c.k !== 'listing_title').concat([{ l: 'Listing title', get: u => u.listing_title }, { l: 'Address', get: u => u.address }]);
  return LC.toCSV([cols.map(c => c.l)].concat(list.map(u => cols.map(c => c.get(u)))));
}

/* ---------------- map ---------------- */
const ROADS = {
  region: [
    { cls: '', names: ['Cantonment Road', 'Badambadi', 'Link Road', 'Phulnakhara', 'Bomikhal', 'Saheed Nagar', 'Janpath'] },
    { cls: 'by', names: ['Rasulgarh', 'Bomikhal', 'Cuttack-Puri Bypass', 'Khandagiri', 'Jatni'] },
  ],
  puri: [{ cls: '', names: ['Station Road', 'Grand Road', 'VIP Road', 'Chakratirtha Road'] }],
};
const CITY_LABELS = { region: [['CUTTACK', 20.4400, 85.8000], ['BHUBANESWAR', 20.3000, 85.7700], ['JATNI', 20.1600, 85.7400]], puri: [] };
const PIN_CLS = { 'Available': 's-av', 'Under negotiation': 's-ng', 'LOI signed': 's-loi', 'Leased': 's-ls' };
let mapPinned = null;
function mapModel() {
  const tab = F.mapTab; const inTab = (isPuri) => (tab === 'puri') === isPuri;
  const units = U().filter(u => inTab(u.city === 'Puri'));
  const locs = Object.entries(LC.LOCALITIES).filter(([n, L]) => inTab(L.city === 'Puri'));
  const pts = units.map(u => [u.lat, u.lng]).concat(locs.map(([n, L]) => [L.lat, L.lng]));
  let la0 = Math.min(...pts.map(p => p[0])), la1 = Math.max(...pts.map(p => p[0])), ln0 = Math.min(...pts.map(p => p[1])), ln1 = Math.max(...pts.map(p => p[1]));
  const pl = (la1 - la0) * 0.08 + 0.002, pn = (ln1 - ln0) * 0.1 + 0.002;
  la0 -= pl; la1 += pl; ln0 -= pn; ln1 += pn;
  const k = Math.cos(((la0 + la1) / 2) * Math.PI / 180);
  const wKm = (ln1 - ln0) * 111.32 * k, hKm = (la1 - la0) * 110.57;
  const sc = Math.min(560 / wKm, 640 / hKm); const W = Math.max(300, Math.round(wKm * sc)), H = Math.round(hKm * sc);
  const proj = (lat, lng) => [(lng - ln0) / (ln1 - ln0) * W, (la1 - lat) / (la1 - la0) * H];
  return { tab, W, H, sc, proj, locs, la0, la1, ln0, ln1 };
}
function mapHTML(list) {
  const M = mapModel(); const { W, H, proj, sc } = M;
  const inTab = list.filter(u => (M.tab === 'puri') === (u.city === 'Puri'));
  const counts = { region: list.filter(u => u.city !== 'Puri').length, puri: list.filter(u => u.city === 'Puri').length };
  // grid lines
  const step = (M.la1 - M.la0) < 0.1 ? 0.01 : 0.05; let g = '';
  for (let la = Math.ceil(M.la0 / step) * step; la < M.la1; la += step) { const y = proj(la, M.ln0)[1]; g += '<line class="gl" x1="0" x2="' + W + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>'; }
  for (let ln = Math.ceil(M.ln0 / step) * step; ln < M.ln1; ln += step) { const x = proj(M.la0, ln)[0]; g += '<line class="gl" y1="0" y2="' + H + '" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '"/>'; }
  // roads
  let rd = '';
  (ROADS[M.tab] || []).forEach(r => { const p = r.names.map(n => LC.LOCALITIES[n]).filter(Boolean).map(L => proj(L.lat, L.lng).map(v => v.toFixed(1)).join(',')); if (p.length > 1) rd += '<polyline class="rd ' + r.cls + '" points="' + p.join(' ') + '"/>'; });
  // city labels
  let cl = '';
  (CITY_LABELS[M.tab] || []).forEach(([t, la, ln]) => { const [x, y] = proj(la, ln); cl += '<text class="lc" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle">' + t + '</text>'; });
  // locality labels with simple collision avoidance
  const placed = []; let lt = '';
  const hit = (b) => placed.some(p => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y);
  M.locs.map(([n, L]) => ({ n, xy: proj(L.lat, L.lng) })).sort((a, b) => a.xy[1] - b.xy[1]).forEach(({ n, xy: [x, y] }) => {
    const w = n.length * 5.3 + 4, h = 11;
    const opts = [[7, 3, 'start'], [-7, 3, 'end'], [7, -9, 'start'], [-7, -9, 'end'], [7, 14, 'start'], [-7, 14, 'end']];
    let pick = opts[0];
    for (const o of opts) { const bx = o[2] === 'start' ? x + o[0] : x + o[0] - w; if (!hit({ x: bx, y: y + o[1] - 9, w, h }) && bx > 0 && bx + w < W) { pick = o; break; } }
    const bx = pick[2] === 'start' ? x + pick[0] : x + pick[0] - w; placed.push({ x: bx, y: y + pick[1] - 9, w, h });
    lt += '<circle class="ld" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.4"/><text class="lt" x="' + (x + pick[0]).toFixed(1) + '" y="' + (y + pick[1]).toFixed(1) + '" text-anchor="' + pick[2] + '">' + esc(n) + '</text>';
  });
  // pins, nudged apart
  const pts = []; let pins = '';
  inTab.forEach(u => {
    let [x, y] = proj(u.lat, u.lng);
    for (let t = 0; t < 14 && pts.some(p => Math.hypot(p[0] - x, p[1] - y) < 12); t++) { const a = t * 2.4, r = 6 + t * 1.6; const [bx, by] = proj(u.lat, u.lng); x = bx + Math.cos(a) * r; y = by + Math.sin(a) * r; }
    pts.push([x, y]);
    pins += '<g class="inv-pin ' + PIN_CLS[u.status] + (mapPinned === u.unit_id ? ' on' : '') + '" data-pin="' + esc(u.unit_id) + '" data-x="' + x.toFixed(1) + '" data-y="' + y.toFixed(1) + '" transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')" tabindex="0" role="button" aria-label="' + esc(u.unit_id + ', ' + u.building_name + ', ' + u.locality + ', ' + psf(u.all_in_per_sqft) + ', ' + u.status) + '"><circle class="ring" r="12"/><circle r="7"/></g>';
  });
  const kmBar = M.tab === 'puri' ? 1 : 5; const bw = kmBar * sc;
  const scale = '<g transform="translate(14,' + (H - 16) + ')"><line class="sb" x1="0" x2="' + bw.toFixed(1) + '" y1="0" y2="0"/><line class="sb" x1="0" x2="0" y1="-4" y2="4"/><line class="sb" x1="' + bw.toFixed(1) + '" x2="' + bw.toFixed(1) + '" y1="-4" y2="4"/><text class="sbt" x="' + (bw / 2).toFixed(1) + '" y="-7" text-anchor="middle">' + kmBar + ' km</text></g><g transform="translate(' + (W - 22) + ',26)"><path class="sb" d="M0 8 L0 -10 M-5 -4 L0 -10 L5 -4" fill="none"/><text class="sbt" x="0" y="22" text-anchor="middle">N</text></g>';
  const svg = '<svg class="inv-map" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Schematic map of listings, ' + (M.tab === 'puri' ? 'Puri' : 'Bhubaneswar to Cuttack region') + '" data-w="' + W + '" data-h="' + H + '"><rect width="' + W + '" height="' + H + '" fill="none"/>' + g + rd + cl + lt + pins + scale + '</svg>';
  const side = inTab.length ? '<div class="inv-onmap">' + inTab.map(u => '<button type="button" data-mapitem="' + esc(u.unit_id) + '"><span class="t">' + esc(u.unit_id + ' · ' + u.building_name + ' ' + u.unit_no) + '</span><span class="p">' + psf(u.all_in_per_sqft) + '</span><span class="s">' + esc(u.status + ' · ' + u.locality + ' · ' + u.property_type + ' · ' + LC.fmtNum(u.chargeable_sqft) + ' sq ft') + '</span></button>').join('') + '</div>' : LC.empty('No listings on this map match your filters.');
  return '<div class="card"><div class="card-h"><h2>Map view</h2><div class="tabs" role="tablist" aria-label="Map area" style="border:0">' +
    '<button type="button" role="tab" data-maptab="region" aria-selected="' + (M.tab === 'region') + '">Bhubaneswar–Cuttack region (' + counts.region + ')</button>' +
    '<button type="button" role="tab" data-maptab="puri" aria-selected="' + (M.tab === 'puri') + '">Puri (' + counts.puri + ')</button></div></div>' +
    '<div class="card-b"><div class="inv-mapgrid"><div class="stack"><div class="inv-mapwrap" id="inv-mapwrap">' + svg + '<div class="inv-mini" id="inv-mini" hidden></div></div>' +
    '<div class="inv-legend"><span><i style="background:var(--good)"></i>Available</span><span><i style="background:var(--warn)"></i>Under negotiation</span><span><i style="background:var(--brand)"></i>LOI signed</span><span><i style="background:var(--s3)"></i>Leased</span>' + (M.tab === 'region' ? '<span><span class="ln"></span>Main road</span><span><span class="ln by"></span>Bypass</span>' : '<span><span class="ln"></span>Main road</span>') + '</div>' +
    '<p class="note">Schematic map. Each listing links to Google Maps.</p></div>' +
    '<div><div class="eyebrow" style="margin-bottom:6px">On this map (' + inTab.length + ')</div>' + side + '</div></div></div></div>';
}
function wireMap(el, list) {
  const wrap = LC.$('#inv-mapwrap', el); if (!wrap) return;
  const mini = LC.$('#inv-mini', wrap); const svg = LC.$('svg', wrap);
  const W = +svg.dataset.w, H = +svg.dataset.h;
  const show = (id, pin) => {
    const u = LC.unit(id); if (!u) return;
    mini.innerHTML = '<img src="' + LC.photo(u, 0) + '" alt="Illustration of ' + esc(u.property_type.toLowerCase()) + '"><div class="b"><div class="row" style="gap:4px">' + statusPill(u.status) + freshPill(u) + '</div><b>' + esc(u.listing_title) + '</b><div><b>' + psf(u.all_in_per_sqft) + '</b> all-in · ' + lakh(u.all_in_monthly) + '/month</div><div class="row"><button type="button" class="btn sm primary" data-minio="' + esc(id) + '">Open listing</button><a class="btn sm" href="' + esc(LC.mapsLink(u)) + '" target="_blank" rel="noopener">Google Maps</a></div></div>';
    mini.hidden = false;
    const cw = wrap.clientWidth, ch = wrap.clientHeight; const k = cw / W;
    const px = +pin.dataset.x * k, py = +pin.dataset.y * k; const mw = mini.offsetWidth, mh = mini.offsetHeight;
    let left = LC.clamp(px - mw / 2, 4, Math.max(4, cw - mw - 4)); let top = py - mh - 14; if (top < 4) top = Math.min(py + 14, Math.max(4, ch - mh - 4));
    mini.style.left = left + 'px'; mini.style.top = top + 'px';
    LC.$$('.inv-onmap button', el).forEach(b => b.classList.toggle('on', b.dataset.mapitem === id));
  };
  const hide = () => { if (!mapPinned) { mini.hidden = true; LC.$$('.inv-pin.on', wrap).forEach(p => p.classList.remove('on')); } };
  LC.$$('.inv-pin', wrap).forEach(p => {
    p.addEventListener('mouseenter', () => { if (!mapPinned) show(p.dataset.pin, p); });
    p.addEventListener('mouseleave', () => { if (!mapPinned) mini.hidden = true; });
    const pinIt = () => { mapPinned = p.dataset.pin; LC.$$('.inv-pin.on', wrap).forEach(x => x.classList.remove('on')); p.classList.add('on'); show(p.dataset.pin, p); };
    p.addEventListener('click', (ev) => { ev.stopPropagation(); pinIt(); });
    p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pinIt(); } });
  });
  svg.addEventListener('click', () => { mapPinned = null; mini.hidden = true; LC.$$('.inv-pin.on', wrap).forEach(p => p.classList.remove('on')); });
  mini.addEventListener('click', (ev) => { const b = ev.target.closest('[data-minio]'); if (b) LC.openUnit(b.dataset.minio); });
  LC.$$('.inv-onmap button', el).forEach(b => {
    const go = () => { const pin = LC.$('.inv-pin[data-pin="' + b.dataset.mapitem + '"]', wrap); if (pin) { mapPinned = b.dataset.mapitem; LC.$$('.inv-pin.on', wrap).forEach(x => x.classList.remove('on')); pin.classList.add('on'); show(b.dataset.mapitem, pin); } };
    b.addEventListener('click', go);
  });
}

/* ---------------- the view ---------------- */
const FEATURE_CHECKS = [
  ['power100', '100% power backup'], ['ground', 'Ground floor'], ['fireNoc', 'Fire NOC on file'], ['oc', 'Occupancy certificate on file'],
  ['lift', 'Lift'], ['mainRoad', 'Main road facing'], ['exclusive', 'Exclusive mandate only'], ['hideStale', 'Hide units not confirmed in 14 days'],
];
function viewHTML() {
  const typeChips = LC.TYPES.map(t => '<button type="button" class="chip" data-type="' + esc(t) + '" aria-pressed="' + F.types.has(t) + '">' + esc(t) + '</button>').join('');
  const cities = ['All', 'Bhubaneswar', 'Cuttack', 'Puri', 'Trisulia', 'Phulnakhara', 'Jatni'].map(c => '<option value="' + c + '">' + (c === 'All' ? 'All cities' : c) + '</option>').join('');
  const furn = '<option value="">Any</option>' + LC.FURNISHING.map(f => '<option>' + f + '</option>').join('');
  const sorts = Object.entries(SORTS).map(([k, v]) => '<option value="' + k + '">' + esc(v[0]) + '</option>').join('');
  const checks = FEATURE_CHECKS.map(([k, l]) => '<label class="checkline" for="inv-f-' + k + '"><input type="checkbox" id="inv-f-' + k + '" data-f="' + k + '" data-t="bool"> ' + esc(l) + '</label>').join('');
  const views = [['grid', 'Grid'], ['list', 'List'], ['map', 'Map'], ['table', 'Table']].map(([k, l]) => '<button type="button" data-view="' + k + '" aria-pressed="' + (F.view === k) + '">' + l + '</button>').join('');
  return '<div class="inv-head"><p class="lede">Every listing with its real terms. Rent and maintenance are shown together as an all-in cost per sq ft. The freshness tag shows when the owner last confirmed the unit is still available on these terms.</p>' +
    '<div class="inv-acts"><button type="button" class="btn" id="inv-sync">Sync from Google Sheet</button><button type="button" class="btn" id="inv-check">Run weekly owner check</button><button type="button" class="btn" id="inv-short" aria-pressed="false">Shortlist (0)</button></div></div>' +
    '<div class="kpis" id="inv-kpis"></div>' +
    '<div class="card"><div class="card-b inv-fb">' +
    '<div class="inv-fgrid">' +
    '<div class="field wide"><label for="inv-q">Search</label><input class="input" id="inv-q" type="search" data-f="q" data-t="text" placeholder="Building, locality, landmark, unit ID or city, for example KIIT or Patia" autocomplete="off"></div>' +
    '<div class="field"><label for="inv-city">City</label><select class="input" id="inv-city" data-f="city" data-t="sel">' + cities + '</select></div>' +
    '<div class="field"><label>Chargeable size (sq ft)</label><div class="inv-sizes"><input class="input" id="inv-smin" type="number" min="0" step="50" data-f="sizeMin" data-t="text" placeholder="Min" aria-label="Minimum size in sq ft"><input class="input" id="inv-smax" type="number" min="0" step="50" data-f="sizeMax" data-t="text" placeholder="Max" aria-label="Maximum size in sq ft"></div></div>' +
    '<div class="field"><label for="inv-maxpsf">Max all-in (₹/sq ft)</label><input class="input" id="inv-maxpsf" type="number" min="0" step="1" data-f="maxPsf" data-t="text" placeholder="No limit"></div>' +
    '<div class="field"><label for="inv-furn">Furnishing</label><select class="input" id="inv-furn" data-f="furn" data-t="sel">' + furn + '</select></div>' +
    '<div class="field"><label for="inv-avail">Available</label><select class="input" id="inv-avail" data-f="avail" data-t="sel"><option value="any">Any date</option><option value="now">Available now</option><option value="30">Within 30 days</option></select></div>' +
    '</div>' +
    '<div class="inv-frow"><span class="lbl">Property type</span><div class="chips" id="inv-types" role="group" aria-label="Property type">' + typeChips + '</div></div>' +
    '<div class="inv-frow"><label class="checkline" for="inv-f-incNeg"><input type="checkbox" id="inv-f-incNeg" data-f="incNeg" data-t="bool"> Include under negotiation and LOI</label><label class="checkline" for="inv-f-incLeased"><input type="checkbox" id="inv-f-incLeased" data-f="incLeased" data-t="bool"> Include leased</label><button type="button" class="btn sm" id="inv-moreb" aria-expanded="false" aria-controls="inv-more">More filters</button></div>' +
    '<div class="inv-more" id="inv-more" hidden>' +
    '<div class="inv-fgrid">' +
    '<div class="field"><label for="inv-parking">Min car parks</label><select class="input" id="inv-parking" data-f="parking" data-t="sel"><option value="">Any</option><option>1</option><option>2</option><option>4</option><option>6</option><option>10</option></select></div>' +
    '<div class="field"><label for="inv-frontage">Min frontage (ft)</label><input class="input" id="inv-frontage" type="number" min="0" step="5" data-f="frontage" data-t="text" placeholder="Any"></div>' +
    '<div class="field"><label for="inv-clearh">Min clear height (ft)</label><input class="input" id="inv-clearh" type="number" min="0" step="1" data-f="clearH" data-t="text" placeholder="Any"></div>' +
    '<div class="field"><label for="inv-use">Permitted use contains</label><input class="input" id="inv-use" type="text" data-f="use" data-t="text" placeholder="For example cafe or clinic"></div>' +
    '<div class="field"><label>Building grade</label><div class="chips" id="inv-grades" role="group" aria-label="Building grade">' + ['A', 'B', 'C'].map(g => '<button type="button" class="chip" data-grade="' + g + '" aria-pressed="' + F.grades.has(g) + '">Grade ' + g + '</button>').join('') + '</div></div>' +
    '</div><div class="inv-checks">' + checks + '</div></div>' +
    '</div></div>' +
    '<div class="row" id="inv-active" aria-label="Active filters"></div>' +
    '<div class="inv-bar"><div class="count" id="inv-count" aria-live="polite"></div><div class="right"><div class="field" style="display:flex;gap:6px;align-items:center"><label for="inv-sort" style="margin:0">Sort</label><select class="input" id="inv-sort" data-f="sort" data-t="sel">' + sorts + '</select></div><div class="seg" id="inv-views" role="group" aria-label="View">' + views + '</div></div></div>' +
    '<div id="inv-results"></div>' +
    '<div class="inv-tray" id="inv-tray" hidden role="region" aria-label="Compare tray"></div>';
}

function renderKPIs() {
  const el = LC.$('#inv-kpis'); if (!el) return;
  const fd = FD(); const av = U().filter(u => u.status === 'Available');
  const offices = av.filter(u => u.property_type === 'Office');
  const stale = av.filter(u => LC.unitFreshness(u).days > fd).length;
  const fresh7 = av.filter(u => LC.unitFreshness(u).days <= 7).length;
  const neg = U().filter(u => u.status === 'Under negotiation' || u.status === 'LOI signed').length;
  const tile = (l, v, d, tip, extra) => '<' + (extra ? 'button type="button" ' + extra : 'div') + ' class="kpi inv-kpi' + (extra ? '' : ' static') + '" title="' + esc(tip) + '"><span class="l">' + esc(l) + '</span><span class="v">' + v + '</span><span class="d">' + d + '</span></' + (extra ? 'button' : 'div') + '>';
  el.innerHTML =
    tile('Available units', av.length, 'of ' + U().length + ' listed', 'Units with status Available. Includes units whose owner has not confirmed recently.') +
    tile('Sq ft available', LC.fmtNum(LC.sum(av, u => u.chargeable_sqft)), 'chargeable area, available units', 'Total chargeable (billed) area of Available units.') +
    tile('Median all-in, offices', offices.length ? psf(LC.median(offices.map(u => u.all_in_per_sqft))) : 'n/a', offices.length + ' available offices', 'Middle value of rent plus maintenance per sq ft, across Available units of type Office.') +
    tile('Confirmed in last 7 days', av.length ? Math.round(fresh7 / av.length * 100) + '%' : 'n/a', fresh7 + ' of ' + av.length + ' available units', 'Share of Available units where the owner confirmed availability and terms in the last 7 days.') +
    tile('Not confirmed in over ' + fd + ' days', stale, 'click to see them', 'Available units the owner has not confirmed for more than ' + fd + ' days. They are left out of client matching until someone confirms.', 'data-kpi="stale" aria-pressed="' + (F.only === 'stale') + '"') +
    tile('Under negotiation or LOI', neg, 'click to see them', 'Units with status Under negotiation or LOI signed. They are not offered to new clients.', 'data-kpi="neg" aria-pressed="' + (F.only === 'neg') + '"');
}

/* active filter chips: each has a label and a clearing function */
function activeChips() {
  const out = []; const d = DEF();
  const add = (label, clear) => out.push({ label, clear });
  if (F.q.trim()) add('Search: ' + F.q.trim(), () => F.q = '');
  if (F.city !== 'All') add('City: ' + F.city, () => F.city = 'All');
  F.types.forEach(t => add(t, () => F.types.delete(t)));
  if (F.sizeMin !== '' || F.sizeMax !== '') add('Size: ' + (F.sizeMin !== '' ? LC.fmtNum(+F.sizeMin) : 'any') + '–' + (F.sizeMax !== '' ? LC.fmtNum(+F.sizeMax) : 'any') + ' sq ft', () => { F.sizeMin = ''; F.sizeMax = ''; });
  if (F.maxPsf !== '') add('Up to ₹' + F.maxPsf + '/sq ft all-in', () => F.maxPsf = '');
  if (F.furn) add(F.furn, () => F.furn = '');
  if (F.avail !== 'any') add(F.avail === 'now' ? 'Available now' : 'Available within 30 days', () => F.avail = 'any');
  if (F.incNeg) add('Including under negotiation and LOI', () => F.incNeg = false);
  if (F.incLeased) add('Including leased', () => F.incLeased = false);
  if (F.parking !== '') add(F.parking + '+ car parks', () => F.parking = '');
  if (F.frontage !== '') add('Frontage ' + F.frontage + '+ ft', () => F.frontage = '');
  if (F.clearH !== '') add('Clear height ' + F.clearH + '+ ft', () => F.clearH = '');
  FEATURE_CHECKS.forEach(([k, l]) => { if (F[k]) add(l, () => F[k] = false); });
  F.grades.forEach(g => add('Grade ' + g, () => F.grades.delete(g)));
  if (F.use.trim()) add('Use: ' + F.use.trim(), () => F.use = '');
  if (F.only === 'stale') add('Only units not confirmed in over ' + FD() + ' days', () => F.only = null);
  if (F.only === 'neg') add('Only under negotiation and LOI', () => F.only = null);
  if (F.shortOnly) add('Shortlist only', () => F.shortOnly = false);
  return out;
}
let chipFns = [];
function syncControls() {
  if (!root) return;
  LC.$$('[data-f]', root).forEach(c => {
    const k = c.dataset.f, t = c.dataset.t;
    if (t === 'bool') c.checked = !!F[k]; else c.value = F[k];
  });
  LC.$$('[data-type]', root).forEach(b => b.setAttribute('aria-pressed', F.types.has(b.dataset.type)));
  LC.$$('[data-grade]', root).forEach(b => b.setAttribute('aria-pressed', F.grades.has(b.dataset.grade)));
  LC.$$('[data-view]', root).forEach(b => b.setAttribute('aria-pressed', F.view === b.dataset.view));
  const sb = LC.$('#inv-short', root); if (sb) { sb.setAttribute('aria-pressed', F.shortOnly); sb.classList.toggle('primary', F.shortOnly); sb.textContent = 'Shortlist (' + LC.state.shortlist.length + ')'; }
}
function renderTray() {
  const tray = LC.$('#inv-tray', root); if (!tray) return;
  const ids = LC.state.compare.filter(id => LC.unit(id));
  tray.hidden = !ids.length; root.classList.toggle('inv-pad', !!ids.length);
  if (!ids.length) { tray.innerHTML = ''; return; }
  tray.innerHTML = '<div class="th">' + ids.map(id => { const u = LC.unit(id); return '<span><img src="' + LC.photo(u, 0) + '" alt="' + esc(id) + '" title="' + esc(u.listing_title) + '"><button type="button" data-trayx="' + esc(id) + '" aria-label="Remove ' + esc(id) + ' from compare">×</button></span>'; }).join('') + '</div>' +
    '<div class="small muted">' + ids.length + ' of 4 selected' + (ids.length < 2 ? '. Pick at least one more.' : '') + '</div><span class="sp"></span>' +
    '<button type="button" class="btn sm" id="inv-trayclear">Clear</button><button type="button" class="btn primary" id="inv-trayopen"' + (ids.length < 2 ? ' disabled' : '') + '>Compare ' + ids.length + ' unit' + (ids.length === 1 ? '' : 's') + '</button>';
}
function update() {
  if (!root || !LC.$('#inv-results', root)) return;
  const list = results();
  syncControls();
  const chips = activeChips(); chipFns = chips.map(c => c.clear);
  const act = LC.$('#inv-active', root);
  act.innerHTML = chips.length ? chips.map((c, i) => '<button type="button" class="chip inv-ac" data-clear="' + i + '" aria-label="Remove filter: ' + esc(c.label) + '">' + esc(c.label) + ' <b aria-hidden="true">×</b></button>').join('') + '<button type="button" class="btn sm" id="inv-clearall">Clear all</button>' : '';
  LC.$('#inv-count', root).textContent = list.length + (list.length === 1 ? ' unit' : ' units') + ' shown, out of ' + U().length + ' listed';
  const res = LC.$('#inv-results', root);
  if (F.view === 'map') { res.innerHTML = mapHTML(list); wireMap(res, list); }
  else if (!list.length) {
    res.innerHTML = '<div class="card"><div class="empty">No units match these filters.' + (chips.length ? '<div style="margin-top:10px"><button type="button" class="btn" id="inv-clearall2">Clear all filters</button></div>' : '') + '</div></div>';
  } else if (F.view === 'grid') res.innerHTML = '<div class="inv-grid">' + list.map(u => cardHTML(u, 'g')).join('') + '</div>';
  else if (F.view === 'list') res.innerHTML = '<div class="inv-list">' + list.map(u => cardHTML(u, 'l')).join('') + '</div>';
  else res.innerHTML = tableHTML(list);
  res._list = list;
  renderTray();
}
function refresh() { if (!root || !LC.isActive('inventory')) return; renderKPIs(); buildRec(); update(); }
function resetFilters() { const keep = { sort: F.sort, view: F.view, mapTab: F.mapTab, moreOpen: F.moreOpen }; F = Object.assign(DEF(), keep, { tsort: null }); }

function renderInventory(el, param) {
  root = el; buildRec(); mapPinned = null;
  if (param) {
    resetFilters();
    if (param.q) F.q = param.q;
    if (param.city && CITY_MAP[param.city]) F.city = param.city;
    if (param.only) F.only = param.only;
    if (param.type) F.types = new Set([].concat(param.type));
  }
  el.innerHTML = viewHTML();
  const more = LC.$('#inv-more', el), moreB = LC.$('#inv-moreb', el);
  const setMore = (open) => { F.moreOpen = open; more.hidden = !open; moreB.setAttribute('aria-expanded', open); moreB.textContent = open ? 'Hide more filters' : 'More filters'; };
  setMore(F.moreOpen);
  moreB.addEventListener('click', () => setMore(!F.moreOpen));
  renderKPIs(); update();

  /* generic controls (delegated on the persistent section element, wired once) */
  if (!el._invWired) { el._invWired = true;
  let deb = null;
  const onCtl = (ev) => {
    const c = ev.target.closest('[data-f]'); if (!c) return;
    const k = c.dataset.f, t = c.dataset.t;
    if (t === 'bool') F[k] = c.checked; else F[k] = c.value;
    if (k === 'sort') F.tsort = null;
    if (k === 'incNeg' || k === 'incLeased') F.only = null;
    clearTimeout(deb); deb = setTimeout(update, t === 'text' && ev.type === 'input' ? 120 : 0);
  };
  el.addEventListener('input', (ev) => { if (ev.target.matches('[data-t="text"]')) onCtl(ev); });
  el.addEventListener('change', (ev) => { if (!ev.target.matches('[data-t="text"]')) onCtl(ev); });

  el.addEventListener('click', (ev) => {
    const t = ev.target;
    let b;
    if ((b = t.closest('[data-type]'))) { const v = b.dataset.type; F.types.has(v) ? F.types.delete(v) : F.types.add(v); return update(); }
    if ((b = t.closest('[data-grade]'))) { const v = b.dataset.grade; F.grades.has(v) ? F.grades.delete(v) : F.grades.add(v); return update(); }
    if ((b = t.closest('[data-view]'))) { F.view = b.dataset.view; return update(); }
    if ((b = t.closest('[data-clear]'))) { const fn = chipFns[+b.dataset.clear]; if (fn) fn(); return update(); }
    if (t.closest('#inv-clearall') || t.closest('#inv-clearall2')) { resetFilters(); return update(); }
    if ((b = t.closest('[data-kpi]'))) { F.only = F.only === b.dataset.kpi ? null : b.dataset.kpi; renderKPIs(); return update(); }
    if (t.closest('#inv-short')) { F.shortOnly = !F.shortOnly; return update(); }
    if (t.closest('#inv-sync')) return LC.openSync();
    if (t.closest('#inv-check')) return LC.runOwnerCheck();
    if ((b = t.closest('[data-maptab]'))) { F.mapTab = b.dataset.maptab; mapPinned = null; return update(); }
    if ((b = t.closest('[data-th]'))) { const k = b.dataset.th; F.tsort = F.tsort && F.tsort.k === k ? { k, d: -F.tsort.d } : { k, d: 1 }; return update(); }
    if (t.closest('#inv-csv')) { const l = LC.$('#inv-results', el)._list || []; return copyText(csvOf(l)); }
    if ((b = t.closest('[data-heart]'))) { ev.stopPropagation(); toggleShort(b.dataset.heart); return; }
    if ((b = t.closest('[data-trayx]'))) { toggleCompare(b.dataset.trayx); return; }
    if (t.closest('#inv-trayclear')) { LC.state.compare.length = 0; LC.emit('compare:changed'); return; }
    if (t.closest('#inv-trayopen')) return LC.openCompare();
    if (t.closest('.inv-cmp')) return;   // handled by change
    if ((b = t.closest('[data-open]'))) return LC.openUnit(b.dataset.open);
    if ((b = t.closest('[data-card]')) && !t.closest('a,button,input,label')) return LC.openUnit(b.dataset.card);
    if ((b = t.closest('[data-row]'))) return LC.openUnit(b.dataset.row);
  });
  el.addEventListener('keydown', (ev) => { const r = ev.target.closest && ev.target.closest('[data-row]'); if (r && ev.target === r && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); LC.openUnit(r.dataset.row); } });
  el.addEventListener('change', (ev) => {
    const c = ev.target.closest('[data-cmp]'); if (!c) return;
    if (!toggleCompare(c.dataset.cmp)) c.checked = false;
  });
  }
  if (param && param.unitId) setTimeout(() => LC.openUnit(param.unitId), 0);
}

/* repaint cheaply when shared state moves under us */
const lazy = (fn) => { let t = null; return (a) => { clearTimeout(t); t = setTimeout(() => fn(a), 90); }; };
LC.on('units:changed', lazy(() => { recMap = null; if (LC.isActive('inventory')) refresh(); repaintOpen(); }));
LC.on('shortlist:changed', () => { if (LC.isActive('inventory')) { syncControls(); update(); } repaintOpen(); });
LC.on('compare:changed', () => { if (LC.isActive('inventory')) update(); repaintOpen(); });

LC.registerView('inventory', {
  title: 'Inventory',
  sub: 'Every unit, its real terms, and when the owner last confirmed it',
  render: renderInventory,
  onHide() { mapPinned = null; },
});

/* =====================================================================
   Unit detail drawer
   ===================================================================== */
let openUid = null;       // unit currently shown in the drawer
let repaintFn = null;     // repaints the open unit or compare drawer
function repaintOpen() {
  const d = LC.$('#drawer-root .inv-ud, #drawer-root .inv-cmpwrap');
  if (d && repaintFn) repaintFn();
}

/* cost calculator: pure function so it is easy to read and test */
function leaseCost(u, years, rentFreeDays, withGst) {
  const R = u.monthly_rent || 0, C = Math.round((u.cam_per_sqft || 0) * (u.chargeable_sqft || 0));
  const esc_ = (u.escalation_pct || 0) / 100, every = Math.max(1, u.escalation_every_years || 1), g = (u.gst_pct || 18) / 100;
  const rows = []; let freeLeft = Math.max(0, rentFreeDays);
  for (let y = 1; y <= years; y++) {
    const mR = R * Math.pow(1 + esc_, Math.floor((y - 1) / every));
    let rent = mR * 12;
    const freeDays = Math.min(freeLeft, 365); freeLeft -= freeDays;
    const credit = Math.min(rent, mR * freeDays / 30); rent -= credit;
    const cam = C * 12; const gst = withGst ? (rent + cam) * g : 0;
    rows.push({ y, mR, mC: C, rent, cam, gst, total: rent + cam + gst, credit });
  }
  const total = LC.sum(rows, r => r.total), net = LC.sum(rows, r => r.rent + r.cam);
  const moveGst = withGst ? (R + C) * g : 0;
  const move = { deposit: u.deposit_amount || 0, rent: R, cam: C, gst: moveGst, total: (u.deposit_amount || 0) + R + C + moveGst };
  const eff = years > 0 && u.chargeable_sqft ? net / (years * 12 * u.chargeable_sqft) : 0;
  return { rows, total, move, eff, credit: LC.sum(rows, r => r.credit) };
}

function groupHTML(title, pairs) {
  return '<div><div class="inv-grp">' + esc(title) + '</div><div class="inv-kv3">' + pairs.filter(Boolean).map(([k, v, tip]) => '<div' + (tip ? ' title="' + esc(tip) + '"' : '') + '><span>' + esc(k) + '</span><b>' + (v == null || v === '' ? 'n/a' : v) + '</b></div>').join('') + '</div></div>';
}
function chipsHTML(arr) { return arr.length ? '<div class="inv-chiprow">' + arr.map(a => '<span>' + esc(a) + '</span>').join('') + '</div>' : '<span class="muted small">None listed</span>'; }

function fitsFor(u) {
  const open = LC.state.clients.filter(c => !['Lost', 'Signed lease'].includes(c.stage));
  const ex = [], cl = [];
  open.forEach(c => { const r = LC.match(c.req, { units: [u] }); if (r.exact[0]) ex.push({ c, r: r.exact[0] }); else if (r.close[0]) cl.push({ c, r: r.close[0] }); });
  ex.sort((a, b) => b.r.score - a.r.score);
  return { ex, closeN: cl.length, openN: open.length };
}
function fitRowHTML(c, r, u) {
  const shared = c.shared.some(s => s.unitId === u.unit_id);
  return '<div class="inv-fit"><div><div class="n">' + esc(c.company || c.name) + ' ' + LC.stagePill(c.stage) + '</div><div class="m">' + esc(c.name) + ' · ' + esc(LC.reqSummary(c.req)) + '</div></div>' +
    '<div class="row" style="gap:6px"><span class="pill brand" title="Match score out of 100. Weighted from all-in cost, size, location, readiness, specs and data freshness.">Score ' + r.score + '</span><button type="button" class="btn sm" data-openclient="' + esc(c.id) + '">Open client</button><button type="button" class="btn sm' + (shared ? '' : ' primary') + '" data-shareclient="' + esc(c.id) + '"' + (shared ? ' disabled' : '') + '>' + (shared ? 'Shared' : 'Share with client') + '</button></div></div>';
}

function shareFallback(u) {
  return 'Leasify Commercial\n' + u.listing_title + '\n' + u.address + '\n\n' +
    'Rent ₹' + trim2(u.rent_per_sqft) + ' + maintenance ₹' + trim2(u.cam_per_sqft) + ' = ₹' + trim2(u.all_in_per_sqft) + '/sq ft all-in (' + LC.fmtINR(u.all_in_monthly) + '/month, GST extra)\n' +
    LC.fmtNum(u.chargeable_sqft) + ' sq ft chargeable, ' + LC.fmtNum(u.carpet_sqft) + ' sq ft carpet. ' + u.furnishing + '.\n' +
    'Deposit ' + u.deposit_months + ' months. Lock-in ' + u.lock_in_months + ' months. Available from ' + LC.fmtDateY(u.available_from) + '.\n' +
    'Location: ' + LC.mapsLink(u) + '\n\nReply to book a visit.';
}
function termFallback(u) {
  return 'TERM SHEET (DRAFT, SAMPLE)\nUnit: ' + u.unit_id + ', ' + u.listing_title + '\nAddress: ' + u.address + '\nOwner: ' + u.owner_name + ' (' + u.owner_type + ')\n\n' +
    'Area: ' + LC.fmtNum(u.chargeable_sqft) + ' sq ft chargeable (' + LC.fmtNum(u.carpet_sqft) + ' sq ft carpet)\n' +
    'Rent: ₹' + trim2(u.rent_per_sqft) + '/sq ft/month (' + LC.fmtINR(u.monthly_rent) + '/month)\nMaintenance: ₹' + trim2(u.cam_per_sqft) + '/sq ft/month\nGST: ' + u.gst_pct + '% extra\n' +
    'Security deposit: ' + u.deposit_months + ' months (' + LC.fmtINR(u.deposit_amount) + ')\nLock-in: ' + u.lock_in_months + ' months\nTerm: ' + u.lease_term_years + ' years\nEscalation: ' + u.escalation_pct + '% every ' + u.escalation_every_years + ' year(s)\nRent-free: ' + u.rent_free_days + ' days\nAvailable from: ' + LC.fmtDateY(u.available_from) + '\n\nThis is a draft for discussion and not a legal document.';
}

function unitHTML(u, cs) {
  cs = cs || {};
  const f = LC.unitFreshness(u); const isSeat = u.pricing_model === 'Per seat';
  const sl = LC.state.shortlist.includes(u.unit_id), cp = LC.state.compare.includes(u.unit_id);
  const dom = daysOnMarket(u);
  const thumbs = [0, 1, 2, 3, 4].map(i => '<button type="button" data-gal="' + i + '" aria-pressed="' + (i === 0) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + LC.photo(u, i) + '" alt="Illustration, photo ' + (i + 1) + '"></button>').join('') + '<button type="button" class="fpb" data-gal="fp" aria-pressed="false">Floor plan</button>';
  const fits = fitsFor(u); const matchable = LC.isMatchable(u);
  const fitShow = fits.ex.slice(0, 6);
  const visits = LC.state.visits.filter(v => v.unitId === u.unit_id).sort((a, b) => b.when - a.when);
  const hist = LC.state.audit.filter(a => a.unitId === u.unit_id).slice(0, 12);
  const sims = U().filter(x => x.unit_id !== u.unit_id && x.property_type === u.property_type && x.city === u.city && x.status === 'Available').sort((a, b) => Math.abs(a.all_in_per_sqft - u.all_in_per_sqft) - Math.abs(b.all_in_per_sqft - u.all_in_per_sqft)).slice(0, 3);
  const mask = u.owner_phone;
  return '<div class="inv-ud" data-uid="' + esc(u.unit_id) + '">' +
    /* gallery */
    '<div class="inv-gal"><div class="inv-gmain" id="inv-gmain"><img src="' + LC.photo(u, 0) + '" alt="Illustration of ' + esc(u.property_type.toLowerCase()) + ' ' + esc(u.unit_id) + '"><span class="pill demo tag">Illustration</span></div><div class="inv-gthumbs" role="group" aria-label="Photos">' + thumbs + '</div>' +
    '<div class="small muted">Sample illustrations stand in for real photos. This listing has ' + u.photos + ' photos on file' + (u.floor_plan === 'Yes' ? ', a floor plan' : '') + (u.video_tour === 'Yes' ? ' and a video tour' : '') + '.</div></div>' +
    /* title */
    '<div class="stack" style="gap:8px"><div class="inv-pills">' + statusPill(u.status) + freshPill(u) + gradePill(u) + '<span class="pill ' + (u.mandate === 'Exclusive' ? 'brand' : '') + '" title="Exclusive: this desk is the only agency marketing the unit. Open: other agencies may also list it.">' + esc(u.mandate) + ' mandate</span><span class="pill">' + esc(u.property_type) + '</span></div>' +
    '<div class="small muted">' + esc(u.unit_id) + ' · ' + esc(u.address) + ' ' + esc(u.pincode) + '</div>' +
    (u.data_flag ? '<div class="inv-flag" role="note">' + ICON.warn + '<span><b>Check before offering.</b> ' + esc(u.data_flag) + '</span></div>' : '') + '</div>' +
    /* price */
    '<section class="inv-sec" aria-labelledby="inv-h-price"><h3 id="inv-h-price">Price and terms</h3><div class="b"><div class="inv-kv3">' +
    '<div title="Monthly rent per chargeable sq ft, before GST."><span>Rent</span><b>' + psf(u.rent_per_sqft) + '</b></div>' +
    '<div title="Common area maintenance per sq ft per month."><span>Maintenance (CAM)</span><b>' + psf(u.cam_per_sqft) + '</b></div>' +
    '<div title="Rent plus maintenance per sq ft. The number occupiers compare."><span>All-in</span><b class="big">' + psf(u.all_in_per_sqft) + '</b></div>' +
    '<div><span>Monthly rent</span><b>' + LC.fmtINR(u.monthly_rent) + ' <span class="muted">(' + lakh(u.monthly_rent) + ')</span></b></div>' +
    '<div><span>Monthly all-in</span><b class="big">' + LC.fmtINR(u.all_in_monthly) + '</b></div>' +
    '<div><span>GST</span><b>' + u.gst_pct + '% extra</b></div>' +
    '<div title="Refundable security deposit, in months of rent."><span>Deposit</span><b>' + u.deposit_months + ' months · ' + LC.fmtINR(u.deposit_amount) + '</b></div>' +
    '<div><span>Lock-in</span><b>' + u.lock_in_months + ' months</b></div>' +
    '<div><span>Lease term</span><b>' + u.lease_term_years + ' years</b></div>' +
    '<div><span>Escalation</span><b>' + u.escalation_pct + '% every ' + u.escalation_every_years + ' year' + (u.escalation_every_years === 1 ? '' : 's') + '</b></div>' +
    '<div><span>Rent-free</span><b>' + u.rent_free_days + ' days</b></div>' +
    '<div title="Owner\'s stated room on the rent."><span>Negotiable</span><b>' + esc(u.negotiable) + '</b></div>' +
    (isSeat ? '<div><span>Seats</span><b>' + u.seats + '</b></div><div><span>Price per seat</span><b>' + LC.fmtINR(u.price_per_seat) + '/month</b></div>' : '') +
    '</div><div class="small muted">GST of ' + u.gst_pct + '% is charged on rent and maintenance. The desk earns ' + u.brokerage_months + ' months of rent as brokerage.</div></div></section>' +
    /* calculator */
    '<section class="inv-sec" aria-labelledby="inv-h-calc"><h3 id="inv-h-calc">Cost calculator</h3><div class="b">' +
    '<div class="inv-form"><div class="field"><label for="inv-c-years">Lease years</label><input class="input" id="inv-c-years" type="number" min="1" max="15" step="1" value="' + (cs.years != null ? cs.years : u.lease_term_years) + '"></div>' +
    '<div class="field"><label for="inv-c-free">Rent-free days</label><input class="input" id="inv-c-free" type="number" min="0" max="365" step="5" value="' + (cs.free != null ? cs.free : u.rent_free_days) + '"></div>' +
    '<label class="checkline" for="inv-c-gst" style="padding-bottom:8px"><input type="checkbox" id="inv-c-gst"' + (cs.gst ? ' checked' : '') + '> Include GST ' + u.gst_pct + '%</label></div>' +
    '<div class="inv-out" id="inv-c-out"></div>' +
    '<p class="note">Method: rent rises ' + u.escalation_pct + '% every ' + u.escalation_every_years + ' year' + (u.escalation_every_years === 1 ? '' : 's') + ', maintenance stays flat, and rent-free days take rent off year 1 only. The deposit is refundable, so it is counted in move-in cost but not in lease value.</p></div></section>' +
    /* key facts */
    '<section class="inv-sec" aria-labelledby="inv-h-facts"><h3 id="inv-h-facts">Key facts</h3><div class="b">' +
    groupHTML('Area and layout', [
      ['Carpet area', LC.fmtSqft(u.carpet_sqft), 'Usable floor area inside the walls.'],
      ['Super built-up', LC.fmtSqft(u.super_builtup_sqft), 'Carpet area plus a share of common areas.'],
      ['Chargeable area', LC.fmtSqft(u.chargeable_sqft), 'The area the rent is billed on.'],
      ['Loading', u.loading_pct + '%', 'Loading is the share of the billed area that is common area, shown as extra over carpet: (super built-up minus carpet) divided by carpet.'],
      ['Floor', (u.floor === 0 ? 'Ground' : u.floor) + ' of ' + u.total_floors],
      ['Furnishing', esc(u.furnishing)],
      u.workstations ? ['Workstations', u.workstations] : null, u.cabins ? ['Cabins', u.cabins] : null, u.meeting_rooms ? ['Meeting rooms', u.meeting_rooms] : null,
      ['Washrooms', esc(u.washrooms)], ['Air conditioning', esc(u.ac_type)],
    ]) +
    groupHTML('Building and compliance', [
      ['Power backup', esc(u.power_backup)], ['Sanctioned load', u.power_load_kw ? u.power_load_kw + ' kW' : 'n/a'],
      ['Car parks', u.parking_4w], ['Two-wheeler parks', u.parking_2w],
      ['Frontage', u.frontage_ft ? u.frontage_ft + ' ft' : 'Not applicable'], ['Clear height', u.clear_height_ft ? u.clear_height_ft + ' ft' : 'Not applicable'],
      ['Road width', u.road_width_ft ? u.road_width_ft + ' ft' : 'n/a'],
      ['Fire NOC', '<span class="' + (u.fire_noc === 'Yes' ? '' : 'sla-warn') + '">' + yn(u.fire_noc) + '</span>'], ['Occupancy certificate', '<span class="' + (u.occupancy_certificate === 'Yes' ? '' : 'sla-warn') + '">' + yn(u.occupancy_certificate) + '</span>'],
      ['Building age', u.building_age_years + ' years'], ['Lift', u.amenities.includes('Lift') ? 'Yes' : 'No'],
    ]) +
    '<div><div class="inv-grp">Permitted use</div>' + chipsHTML(u.permitted_uses) + '</div>' +
    '<div><div class="inv-grp">Amenities</div>' + chipsHTML(u.amenities) + '</div>' +
    '<div><div class="inv-grp">Nearby</div>' + chipsHTML(u.nearby) + '</div>' +
    groupHTML('Availability and owner', [
      ['Available from', LC.fmtDateY(u.available_from)], ['Listed', LC.fmtDateY(u.listed_date) + ' · ' + dom + ' days on market'],
      ['Last confirmed', LC.fmtDateY(u.last_confirmed) + ' · ' + f.days + (f.days === 1 ? ' day' : ' days') + ' ago, ' + esc(u.confirmed_via)],
      ['Owner', esc(u.owner_name)], ['Owner type', esc(u.owner_type)], ['Owner phone', '<span class="mono">' + esc(mask) + '</span>', 'Masked in the demo.'],
      ['Listing agent', esc(u.listing_agent)],
    ]) + '</div></section>' +
    /* location */
    '<section class="inv-sec" aria-labelledby="inv-h-loc"><h3 id="inv-h-loc">Location</h3><div class="b"><div class="row"><a class="btn" href="' + esc(LC.mapsLink(u)) + '" target="_blank" rel="noopener">' + ICON.pin + ' Open in Google Maps</a><span class="small muted">' + esc(u.locality) + ', ' + esc(u.city) + ' · ' + esc(u.micro_market) + '</span></div>' +
    '<div class="row" style="align-items:end"><div class="field" style="flex:1 1 220px"><label for="inv-dir">Directions to</label><input class="input" id="inv-dir" type="text" placeholder="For example Biju Patnaik Airport" autocomplete="off"></div><a class="btn" id="inv-dir-go" href="#" target="_blank" rel="noopener" aria-disabled="true" style="opacity:.5;pointer-events:none">Get directions</a></div></div></section>' +
    /* reverse match */
    '<section class="inv-sec" aria-labelledby="inv-h-fit"><h3 id="inv-h-fit">Clients this unit fits <span class="pill brand">' + fits.ex.length + ' exact</span>' + (fits.closeN ? '<span class="pill">' + fits.closeN + ' close</span>' : '') + '</h3><div class="b">' +
    (!matchable ? '<p class="note">This unit is not offered to clients right now (' + (u.status !== 'Available' ? 'status is ' + esc(u.status) : 'not confirmed in over ' + FD() + ' days') + '). Confirm it to bring it back into matching.</p>' : '') +
    (fitShow.length ? '<div id="inv-fits">' + fitShow.map(x => fitRowHTML(x.c, x.r, u)).join('') + '</div>' + (fits.ex.length > 6 ? '<button type="button" class="btn sm" id="inv-fitmore">Show all ' + fits.ex.length + '</button>' : '') : (matchable ? LC.empty('No open client matches every requirement for this unit. ' + fits.closeN + ' are close.') : '')) +
    '<div class="small muted">Checked against ' + fits.openN + ' open clients using the same rules as Requirement match. Exact means every must-have passes. Close means one requirement is missed.</div></div></section>' +
    /* visits and history */
    '<section class="inv-sec" aria-labelledby="inv-h-vis"><h3 id="inv-h-vis">Visits at this unit <span class="pill">' + visits.length + '</span></h3><div class="b">' +
    (visits.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Client</th><th>Status</th><th>Feedback</th><th class="r">Rating</th></tr></thead><tbody>' + visits.slice(0, 8).map(v => { const c = LC.crm.get(v.clientId); return '<tr><td class="num">' + esc(LC.fmtDT(v.when)) + '</td><td>' + esc(c ? (c.company || c.name) : 'Unknown') + '</td><td>' + esc(v.status) + '</td><td>' + esc(v.feedback || 'No feedback yet') + '</td><td class="r num">' + (v.rating ? v.rating + '/5' : 'n/a') + '</td></tr>'; }).join('') + '</tbody></table></div>' : LC.empty('No visits yet.')) + '</div></section>' +
    '<section class="inv-sec" aria-labelledby="inv-h-hist"><h3 id="inv-h-hist">Change history</h3><div class="b">' +
    (hist.length ? '<ul class="timeline">' + hist.map(a => '<li><span class="when">' + esc(LC.relTime(a.ts)) + '</span><span><b>' + esc(a.field) + '</b>' + (a.from !== '' || a.to !== '' ? ': ' + esc(a.from === '' ? 'blank' : a.from) + ' → ' + esc(a.to === '' ? 'blank' : a.to) : '') + '<br><span class="muted small">' + esc(a.by) + '</span></span></li>').join('') + '</ul>' : '<span class="muted small">No changes recorded yet. Edits from the sheet, the owner check and this panel appear here.</span>') + '</div></section>' +
    /* similar */
    '<section class="inv-sec" aria-labelledby="inv-h-sim"><h3 id="inv-h-sim">Similar units</h3><div class="b">' +
    (sims.length ? '<div class="inv-sim">' + sims.map(x => '<button type="button" class="inv-simc" data-sim="' + esc(x.unit_id) + '"><img src="' + LC.photo(x, 0) + '" alt="Illustration of ' + esc(x.property_type.toLowerCase()) + '"><div><b>' + esc(x.building_name + ' ' + x.unit_no) + '</b><span class="muted">' + esc(x.locality) + ' · ' + LC.fmtNum(x.chargeable_sqft) + ' sq ft</span><span><b>' + psf(x.all_in_per_sqft) + '</b> all-in</span></div></button>').join('') + '</div>' : '<span class="muted small">No other available ' + esc(u.property_type.toLowerCase()) + ' units in ' + esc(LC.cityOf(u)) + '.</span>') + '</div></section>' +
    /* actions */
    '<section class="inv-sec" aria-labelledby="inv-h-act"><h3 id="inv-h-act">Actions</h3><div class="b">' +
    '<div class="inv-acts2"><button type="button" class="btn" id="inv-a-short" aria-pressed="' + sl + '">' + (sl ? 'Remove from shortlist' : 'Add to shortlist') + '</button><button type="button" class="btn" id="inv-a-cmp" aria-pressed="' + cp + '">' + (cp ? 'Remove from compare' : 'Add to compare') + '</button>' +
    '<button type="button" class="btn" id="inv-a-wa">Share on WhatsApp</button><button type="button" class="btn" id="inv-a-visit">Book a visit</button><button type="button" class="btn" id="inv-a-term">Draft term sheet</button><button type="button" class="btn" id="inv-a-conf">Owner confirmed today</button></div>' +
    '<div class="field" style="max-width:260px"><label for="inv-a-status">Status</label><select class="input" id="inv-a-status">' + STATUSES.map(s => '<option' + (s === u.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
    '<div id="inv-a-out"></div></div></section>' +
    '</div>';
}

function bindUnit(el, u) {
  const q = (s) => LC.$(s, el);
  /* gallery */
  const main = q('#inv-gmain');
  el.querySelectorAll('[data-gal]').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('[data-gal]').forEach(x => x.setAttribute('aria-pressed', x === b));
    const k = b.dataset.gal;
    main.innerHTML = (k === 'fp' ? '<div class="fpbox">' + LC.floorPlan(u) + '</div>' : '<img src="' + LC.photo(u, +k) + '" alt="Illustration, photo ' + (+k + 1) + '">') + '<span class="pill demo tag">Illustration</span>';
  }));
  /* calculator */
  const calc = () => {
    const years = LC.clamp(Math.round(+q('#inv-c-years').value) || 1, 1, 15), free = LC.clamp(Math.round(+q('#inv-c-free').value) || 0, 0, 365), gst = q('#inv-c-gst').checked;
    const r = leaseCost(u, years, free, gst); const m = r.move;
    q('#inv-c-out').innerHTML =
      '<div class="inv-mini-kpis"><div title="Deposit plus the first month of rent and maintenance' + (gst ? ', with GST' : '') + '. Rent-free days are not applied to this figure."><b>' + LC.fmtINR(m.total) + '</b><span>Move-in cost</span></div>' +
      '<div title="Rent and maintenance over the whole term' + (gst ? ' plus GST' : ', before GST') + ', after rent-free days. Deposit not included."><b>' + lakh(r.total) + '</b><span>Total lease value, ' + years + ' years</span></div>' +
      '<div title="Rent plus maintenance over the term, after rent-free days, divided by chargeable sq ft and months. GST not included."><b>' + psf(Math.round(r.eff * 100) / 100) + '</b><span>Effective all-in over the term</span></div>' +
      '<div><b>' + lakh(r.credit) + '</b><span>Rent-free saving (' + free + ' days)</span></div></div>' +
      '<div class="small muted">Move-in: deposit ' + LC.fmtINR(m.deposit) + ' + first month rent ' + LC.fmtINR(m.rent) + ' + maintenance ' + LC.fmtINR(m.cam) + (gst ? ' + GST ' + LC.fmtINR(m.gst) : '') + ' = <b>' + LC.fmtINR(m.total) + '</b></div>' +
      '<div class="tbl-wrap"><table class="tbl" aria-label="Year by year cost"><thead><tr><th>Year</th><th class="r">Monthly rent</th><th class="r">Monthly CAM</th><th class="r">Rent for year</th><th class="r">CAM for year</th>' + (gst ? '<th class="r">GST</th>' : '') + '<th class="r">Year total</th></tr></thead><tbody>' +
      r.rows.map(x => '<tr><td>' + x.y + '</td><td class="r num">' + LC.fmtINR(x.mR) + '</td><td class="r num">' + LC.fmtINR(x.mC) + '</td><td class="r num">' + LC.fmtINR(x.rent) + (x.credit > 0 ? ' <span class="muted small" title="Rent-free days taken off this year">(−' + LC.fmtLakh(x.credit) + ')</span>' : '') + '</td><td class="r num">' + LC.fmtINR(x.cam) + '</td>' + (gst ? '<td class="r num">' + LC.fmtINR(x.gst) + '</td>' : '') + '<td class="r num"><b>' + LC.fmtINR(x.total) + '</b></td></tr>').join('') +
      '</tbody><tfoot><tr><td colspan="' + (gst ? 6 : 5) + '"><b>Total lease value</b></td><td class="r num"><b>' + LC.fmtINR(r.total) + '</b></td></tr></tfoot></table></div>';
  };
  ['#inv-c-years', '#inv-c-free', '#inv-c-gst'].forEach(s => { q(s).addEventListener('input', calc); q(s).addEventListener('change', calc); });
  calc();
  /* directions */
  const dir = q('#inv-dir'), go = q('#inv-dir-go');
  dir.addEventListener('input', () => { const v = dir.value.trim(); if (v) { go.href = LC.mapsLink(u, v); go.style.opacity = ''; go.style.pointerEvents = ''; go.setAttribute('aria-disabled', 'false'); } else { go.href = '#'; go.style.opacity = '.5'; go.style.pointerEvents = 'none'; go.setAttribute('aria-disabled', 'true'); } });
  /* reverse match */
  const fits = fitsFor(u);
  const fitBox = q('#inv-fits');
  const bindFits = () => {
    el.querySelectorAll('[data-openclient]').forEach(b => b.onclick = () => { if (LC.openClient) LC.openClient(b.dataset.openclient); else LC.toast('The client view is not loaded in this build.'); });
    el.querySelectorAll('[data-shareclient]').forEach(b => b.onclick = () => {
      const c = LC.crm.get(b.dataset.shareclient); if (!c) return;
      LC.crm.share(c.id, [u.unit_id]); LC.log('Shared ' + u.unit_id + ' with ' + (c.company || c.name), { clientId: c.id, unitId: u.unit_id, kind: 'shared' });
      LC.emit('clients:changed'); b.textContent = 'Shared'; b.disabled = true; b.classList.remove('primary'); LC.toast('Shared ' + u.unit_id + ' with ' + (c.company || c.name) + ' on WhatsApp');
    });
  };
  bindFits();
  const more = q('#inv-fitmore'); if (more) more.addEventListener('click', () => { fitBox.innerHTML = fits.ex.map(x => fitRowHTML(x.c, x.r, u)).join(''); more.remove(); bindFits(); });
  el.querySelectorAll('[data-sim]').forEach(b => b.addEventListener('click', () => LC.openUnit(b.dataset.sim)));
  /* actions */
  const out = q('#inv-a-out');
  q('#inv-a-short').addEventListener('click', () => toggleShort(u.unit_id));
  q('#inv-a-cmp').addEventListener('click', () => toggleCompare(u.unit_id));
  const showText = async (title, getter, fallback) => {
    out.innerHTML = '<div class="small muted">Preparing…</div>';
    let text; try { text = await Promise.resolve(getter()); } catch (e) { text = null; }
    if (!text) text = fallback();
    out.innerHTML = '<div class="between"><b class="small">' + esc(title) + '</b><button type="button" class="btn sm" id="inv-a-copy">Copy</button></div><pre class="inv-pre" id="inv-a-pre"></pre>';
    LC.$('#inv-a-pre', out).textContent = text;
    LC.$('#inv-a-copy', out).addEventListener('click', () => copyText(text));
  };
  q('#inv-a-wa').addEventListener('click', () => showText('WhatsApp message preview', () => LC.shareText ? LC.shareText([u.unit_id], null, 'English') : null, () => shareFallback(u)));
  q('#inv-a-term').addEventListener('click', () => showText('Term sheet draft', () => LC.draftTermSheet ? LC.draftTermSheet(u.unit_id) : null, () => termFallback(u)));
  q('#inv-a-visit').addEventListener('click', () => { if (LC.openBookVisit) LC.openBookVisit({ unitId: u.unit_id }); else LC.toast('Visit booking is not loaded in this build.'); });
  q('#inv-a-conf').addEventListener('click', () => { confirmUnit(u, 'Call', LC.state.me); LC.emit('units:changed'); LC.toast(u.unit_id + ' confirmed by the owner today'); });
  q('#inv-a-status').addEventListener('change', (ev) => {
    const to = ev.target.value; if (to === u.status) return;
    audit(u, 'status', u.status, to, LC.state.me); u.status = to;
    LC.log(u.unit_id + ' status changed to ' + to, { unitId: u.unit_id, kind: 'unit' }); LC.emit('units:changed'); LC.toast(u.unit_id + ' is now ' + to);
  });
}

/* mark a unit confirmed today: audit entry, close open owner-check tasks. Caller emits units:changed. */
function confirmUnit(u, via, by) {
  const from = u.last_confirmed; u.last_confirmed = todayISO(); u.confirmed_via = via;
  audit(u, 'last_confirmed', from, u.last_confirmed + ' via ' + via, by);
  if (via === 'Call' && /terms changed/.test(u.data_flag || '')) { audit(u, 'data_flag', u.data_flag, '(cleared after call)', by); u.data_flag = ''; }
  LC.state.tasks.filter(t => !t.done && t.type === 'Owner check' && t.unitId === u.unit_id).forEach(t => LC.tasks.complete(t.id));
  LC.log(u.unit_id + ' confirmed by owner (' + via + ')', { unitId: u.unit_id, kind: 'unit' });
}

LC.openUnit = (unitId) => {
  const u = LC.unit(unitId);
  if (!u) { LC.toast('Unit ' + unitId + ' was not found.'); return; }
  openUid = unitId;
  const d = LC.drawer({ title: u.listing_title, sub: esc(u.unit_id) + ' · ' + esc(u.building_name) + ' ' + esc(u.unit_no), wide: true, html: '', onClose: () => { openUid = null; } });
  const paint = () => {
    const cur = LC.unit(unitId); if (!cur) return;
    const top = d.el.scrollTop; const yi = LC.$('#inv-c-years', d.el);
    const cs = yi ? { years: yi.value, free: LC.$('#inv-c-free', d.el).value, gst: LC.$('#inv-c-gst', d.el).checked } : null;
    d.el.innerHTML = unitHTML(cur, cs); bindUnit(d.el, cur); d.el.scrollTop = top;
  };
  paint();
  repaintFn = () => { if (LC.$('#drawer-root .inv-ud[data-uid="' + unitId + '"]')) paint(); };
};

/* =====================================================================
   Compare
   ===================================================================== */
const CMP_ROWS = [
  { l: 'All-in ₹/sq ft', g: u => psf(u.all_in_per_sqft), v: u => u.all_in_per_sqft, best: 'low', tip: 'Rent plus maintenance per sq ft. Lower is better.' },
  { l: 'All-in per month', g: u => LC.fmtINR(u.all_in_monthly), v: u => u.all_in_monthly, best: 'low' },
  { l: 'Chargeable area', g: u => LC.fmtSqft(u.chargeable_sqft) },
  { l: 'Carpet area', g: u => LC.fmtSqft(u.carpet_sqft), v: u => u.carpet_sqft, best: 'high', tip: 'Usable area inside the walls. Larger is better.' },
  { l: 'Loading', g: u => u.loading_pct + '%', v: u => u.loading_pct, best: 'low', tip: 'Share of the billed area that is common area. Lower is better.' },
  { l: 'Furnishing', g: u => esc(u.furnishing), v: u => LC.FURNISHING.indexOf(u.furnishing), best: 'high', tip: 'More fitted out means faster move-in.' },
  { l: 'Deposit', g: u => u.deposit_months + ' months · ' + lakh(u.deposit_amount), v: u => u.deposit_amount, best: 'low' },
  { l: 'Lock-in', g: u => u.lock_in_months + ' months', v: u => u.lock_in_months, best: 'low', tip: 'Shorter lock-in gives the occupier more freedom.' },
  { l: 'Escalation', g: u => u.escalation_pct + '% every ' + u.escalation_every_years + ' yr', v: u => u.escalation_pct / u.escalation_every_years, best: 'low', tip: 'Yearly rent increase, averaged per year. Lower is better.' },
  { l: 'Rent-free', g: u => u.rent_free_days + ' days', v: u => u.rent_free_days, best: 'high' },
  { l: 'Car parks', g: u => u.parking_4w, v: u => u.parking_4w, best: 'high' },
  { l: 'Power backup', g: u => esc(u.power_backup), v: u => ({ '100%': 2, 'Partial': 1, 'None': 0 }[u.power_backup]), best: 'high' },
  { l: 'Frontage', g: u => u.frontage_ft ? u.frontage_ft + ' ft' : 'Not applicable', v: u => u.frontage_ft || null, best: 'high' },
  { l: 'Fire NOC', g: u => yn(u.fire_noc), v: u => u.fire_noc === 'Yes' ? 1 : 0, best: 'high' },
  { l: 'Available from', g: u => LC.fmtDateY(u.available_from), v: u => +LC.parseDate(u.available_from), best: 'low', tip: 'Earlier is better.' },
  { l: 'Freshness', g: u => freshPill(u), v: u => LC.unitFreshness(u).days, best: 'low', tip: 'More recently confirmed is better.' },
];
function compareHTML(ids) {
  const us = ids.map(LC.unit).filter(Boolean);
  if (!us.length) return '<div class="inv-cmpwrap">' + LC.empty('Nothing to compare yet. Tick Compare on up to 4 listings.') + '</div>';
  const head = '<tr><th class="sticky" scope="col"></th>' + us.map(u => '<th scope="col"><img src="' + LC.photo(u, 0) + '" alt="Illustration of ' + esc(u.property_type.toLowerCase()) + ' ' + esc(u.unit_id) + '"><div><button type="button" class="inv-title" data-cmpopen="' + esc(u.unit_id) + '">' + esc(u.listing_title) + '</button></div><div class="small muted" style="font-weight:400">' + esc(u.unit_id) + ' · ' + esc(u.locality) + '</div><div style="margin-top:6px"><button type="button" class="btn sm" data-cmpx="' + esc(u.unit_id) + '" aria-label="Remove ' + esc(u.unit_id) + ' from compare">Remove</button></div></th>').join('') + '</tr>';
  const rows = CMP_ROWS.map(r => {
    let bestSet = new Set();
    if (r.v && us.length > 1) {
      const vals = us.map(u => r.v(u)); const ok = vals.filter(x => x != null && !isNaN(x));
      if (ok.length > 1) { const target = r.best === 'low' ? Math.min(...ok) : Math.max(...ok); if (ok.some(x => x !== target)) vals.forEach((x, i) => { if (x === target) bestSet.add(i); }); }
    }
    return '<tr><td class="sticky" scope="row"' + (r.tip ? ' title="' + esc(r.tip) + '"' : '') + '><b>' + esc(r.l) + '</b></td>' + us.map((u, i) => '<td>' + r.g(u) + (bestSet.has(i) ? '<span class="pill good best" title="Best value in this row">Best</span>' : '') + '</td>').join('') + '</tr>';
  }).join('');
  return '<div class="inv-cmpwrap stack"><p class="note">Illustrations stand in for real photos. A green Best tag marks the better value in each row: lowest cost, largest carpet, lowest loading, most parking and so on. Rows where every unit is equal get no tag.</p><div class="tbl-wrap"><table class="tbl inv-cmpt" aria-label="Side by side comparison"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div></div>';
}
LC.openCompare = (unitIds) => {
  const ids = (unitIds && unitIds.length ? unitIds : LC.state.compare).filter(id => LC.unit(id)).slice(0, 4);
  const useState = !(unitIds && unitIds.length);
  const d = LC.drawer({ title: 'Compare units', sub: 'Up to 4 units side by side', wide: true, html: '' });
  let cur = ids.slice();
  const paint = () => {
    if (useState) cur = LC.state.compare.filter(id => LC.unit(id)).slice(0, 4);
    const top = d.el.scrollTop; d.el.innerHTML = compareHTML(cur); d.el.scrollTop = top;
    d.el.querySelectorAll('[data-cmpopen]').forEach(b => b.addEventListener('click', () => LC.openUnit(b.dataset.cmpopen)));
    d.el.querySelectorAll('[data-cmpx]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.cmpx;
      if (useState) toggleCompare(id); else { cur = cur.filter(x => x !== id); paint(); }
    }));
  };
  paint();
  repaintFn = () => { if (LC.$('#drawer-root .inv-cmpwrap')) paint(); };
};

/* =====================================================================
   Google Sheet sync
   ===================================================================== */
const SY = { tab: 'live', text: '', parsed: null, files: null, busy: false, msg: '', msgBad: false, pickedTitle: '' };
const DERIVED = ['monthly_rent', 'all_in_per_sqft', 'all_in_monthly', 'deposit_amount', 'loading_pct'];

function b64ToText(b64) {
  const bin = atob(String(b64).replace(/\s+/g, '')); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
async function mcpCall(tool, args) {
  for (let attempt = 0; ; attempt++) {
    try { return await LC.ai.mcp.callTool('Google Drive', tool, args); }
    catch (err) { if (err && err.retryable && attempt === 0) continue; throw err; }
  }
}
function mcpMessage(err) {
  switch (err && err.code) {
    case 'server_not_connected': case 'needs_reauth': return 'Connect Google Drive in claude.ai Settings, Connectors, then try again.';
    case 'not_in_manifest': return 'Google Drive is turned off for this page.';
    case 'selection_required': return 'Pick which Google Drive account to use when Claude asks.';
    case 'tool_error': return (err && err.message) || 'Google Drive returned an error.';
    default: return (err && err.message) || 'Could not reach Google Drive.';
  }
}

/* parse text from any source into a reviewed preview */
function prepare(text, source) {
  const rows = LC.parseCSV(text);
  const res = LC.rowsToUnits(rows);
  const warnings = res.errors.slice();
  if (!res.units.length) return { source, units: [], diff: null, warnings, columns: res.columns || [] };
  // duplicate ids: last row wins
  const seen = new Map(); res.units.forEach(u => { if (seen.has(u.unit_id)) warnings.push('Unit ' + u.unit_id + ' appears more than once. The last row is used.'); seen.set(u.unit_id, u); });
  const units = Array.from(seen.values());
  // keep only the columns the sheet really has, so a missing column never blanks existing data
  const cols = new Set(res.columns);
  const missingCols = LC.INVENTORY_COLUMNS.filter(c => !cols.has(c));
  const derivedOk = cols.has('rent_per_sqft') && cols.has('chargeable_sqft');
  units.forEach(u => Object.keys(u).forEach(k => { if (!cols.has(k) && !(derivedOk && DERIVED.includes(k))) delete u[k]; }));
  if (missingCols.length) warnings.push('Columns not in this sheet, left unchanged: ' + missingCols.slice(0, 8).join(', ') + (missingCols.length > 8 ? ' and ' + (missingCols.length - 8) + ' more' : '') + '.');
  const diff = LC.diffUnits(units);
  return { source, units, diff, warnings, columns: res.columns };
}

function shortVal(v) { v = String(v); if (v === '') return 'blank'; return v.length > 38 ? v.slice(0, 36) + '…' : v; }
function previewHTML(P) {
  if (!P) return '';
  if (!P.diff) return '<div class="inv-flag" role="alert">' + ICON.warn + '<span>' + (P.warnings.map(esc).join(' ') || 'Nothing could be read from that.') + '</span></div>';
  const d = P.diff; const nothing = !d.added.length && !d.changed.length && !d.removed.length;
  const tiles = '<div class="inv-tiles"><div title="Unit IDs in the sheet that are not in the system yet."><b>' + d.added.length + '</b><span>New units</span></div><div title="Units whose values differ from what the system holds."><b>' + d.changed.length + '</b><span>Changed</span></div><div><b>' + d.same + '</b><span>Unchanged</span></div><div title="Units in the system that are not in the sheet."><b>' + d.removed.length + '</b><span>Missing from sheet</span></div></div>';
  const warn = P.warnings.length ? '<ul class="small sla-warn" style="margin:0;padding-left:18px">' + P.warnings.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '';
  const changed = d.changed.length ? '<div><div class="inv-grp">Changed units</div><ul class="inv-chg">' + d.changed.slice(0, 25).map(c => { const u = LC.unit(c.id); return '<li><b>' + esc(c.id) + '</b> <span class="muted">' + esc(u ? u.building_name + ' ' + u.unit_no : '') + '</span><div class="f">' + c.fields.slice(0, 6).map(f => '<code>' + esc(f.k) + ': ' + esc(shortVal(f.from)) + ' → ' + esc(shortVal(f.to)) + '</code>').join('') + (c.fields.length > 6 ? '<span class="muted small">+' + (c.fields.length - 6) + ' more</span>' : '') + '</div></li>'; }).join('') + '</ul>' + (d.changed.length > 25 ? '<div class="small muted">+' + (d.changed.length - 25) + ' more changed units</div>' : '') + '</div>' : '';
  const added = d.added.length ? '<div><div class="inv-grp">New units</div><ul class="inv-chg">' + d.added.slice(0, 15).map(u => '<li><b>' + esc(u.unit_id) + '</b> ' + esc(u.listing_title || 'Untitled') + '</li>').join('') + '</ul></div>' : '';
  const removed = d.removed.length ? '<div><div class="inv-grp">Missing from the sheet</div><p class="small" style="margin:0">' + d.removed.slice(0, 12).map(u => '<code class="mono">' + esc(u.unit_id) + '</code>').join(' ') + (d.removed.length > 12 ? ' and ' + (d.removed.length - 12) + ' more' : '') + '<br><span class="muted">These will be marked Leased, not deleted. If the sheet is only part of your list, add the missing rows first.</span></p></div>' : '';
  return '<div class="card" style="box-shadow:none"><div class="card-h"><h3>Preview: ' + esc(P.source) + '</h3></div><div class="card-b stack">' + tiles + warn + changed + added + removed +
    (nothing ? '<p class="note">The sheet matches the system. Nothing to apply.</p>' : '') +
    '<div class="row"><button type="button" class="btn primary" id="inv-sy-apply"' + (nothing ? ' disabled' : '') + '>Apply ' + (d.added.length + d.changed.length + d.removed.length) + ' change' + (d.added.length + d.changed.length + d.removed.length === 1 ? '' : 's') + '</button><button type="button" class="btn" id="inv-sy-discard">Discard</button></div></div></div>';
}

/* build a sample "edited" sheet from the current units */
function sampleSheet() {
  const units = U().map(u => ({ ...u }));
  const avail = units.filter(u => u.status === 'Available');
  const A = avail[0], B = avail[3], L = avail[9];
  const stale = avail.filter(u => ![A, B, L].includes(u)).sort((a, b) => LC.unitFreshness(b).days - LC.unitFreshness(a).days)[0];
  const edit = (u, patch) => { const n = LC.normalizeUnit({ ...u, ...patch }, 0); Object.assign(u, n); };
  edit(A, { rent_per_sqft: A.rent_per_sqft + 3 });
  edit(B, { rent_per_sqft: Math.max(5, B.rent_per_sqft - 2) });
  L.status = 'Leased';
  stale.last_confirmed = todayISO(); stale.confirmed_via = 'Call';
  const maxN = Math.max(...units.map(u => parseInt(String(u.unit_id).replace(/\D/g, ''), 10) || 0));
  const base = units.find(u => u.property_type === 'Retail shop' && u.status === 'Available') || avail[0];
  const nu = { ...base, unit_id: 'LC-' + String(maxN + 1).padStart(3, '0'), unit_no: 'Shop 12', status: 'Available', listed_date: todayISO(), last_confirmed: todayISO(), confirmed_via: 'Call', owner_name: 'Sample Owner', lat: +(base.lat + 0.0006).toFixed(5), lng: +(base.lng + 0.0006).toFixed(5), description: 'New listing added from the sheet.' };
  nu.listing_title = 'Ground floor shop in ' + base.building_name + ', ' + base.locality;
  nu.address = String(base.address).replace(base.unit_no, 'Shop 12');
  units.push(LC.normalizeUnit(nu, 0));
  const cell = (v) => { v = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v); return v.replace(/[\t\r\n]+/g, ' '); };
  const cols = LC.INVENTORY_COLUMNS;
  return [cols.join('\t')].concat(units.map(u => cols.map(c => cell(u[c])).join('\t'))).join('\n');
}

function syncHistoryHTML() {
  const log = LC.state.syncLog;
  return log.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Source</th><th class="r">Added</th><th class="r">Changed</th><th class="r">Off market</th><th>By</th></tr></thead><tbody>' + log.slice(0, 10).map(s => '<tr><td class="num">' + esc(LC.fmtDT(s.ts)) + '</td><td>' + esc(s.source) + '</td><td class="r num">' + s.added + '</td><td class="r num">' + s.changed + '</td><td class="r num">' + s.removed + '</td><td>' + esc(s.by) + '</td></tr>').join('') + '</tbody></table></div>' : '<span class="muted small">No syncs yet. Run one and it will be listed here.</span>';
}
function dictHTML() {
  let dict = {}; try { dict = JSON.parse(document.getElementById('lc-dictionary').textContent); } catch (e) { /* ignore */ }
  const cols = LC.INVENTORY_COLUMNS || Object.keys(dict);
  return '<details class="inv-det"><summary>Sheet columns (' + cols.length + ')</summary><div class="stack"><div class="row"><button type="button" class="btn sm" id="inv-sy-hdr">Copy header row</button><span class="small muted">Paste it into row 1 of a new Google Sheet.</span></div><div class="tbl-wrap inv-dict"><table class="tbl"><thead><tr><th>Column</th><th>Meaning</th></tr></thead><tbody>' + cols.map(c => '<tr><td><code class="mono">' + esc(c) + '</code></td><td>' + esc(dict[c] || '') + '</td></tr>').join('') + '</tbody></table></div></div></details>';
}
function liveTabHTML() {
  if (!LC.ai.mcp) return '<p class="note">Live sync works when this demo runs as the published Leasify page with Google Drive connected. Here, paste the sheet or upload a CSV instead.</p>';
  const files = SY.files;
  return '<div class="stack"><p class="lede">Reads the sheet only when you click. Nothing is read when the page loads.</p>' +
    '<div class="row"><button type="button" class="btn primary" id="inv-sy-find"' + (SY.busy ? ' disabled' : '') + '>Find my inventory sheet</button><span class="small muted">Looks for a Google Sheet titled "Leasify Commercial Inventory".</span></div>' +
    (files ? (files.length ? '<div class="stack">' + files.map(f => '<div class="between" style="border:1px solid var(--hair);border-radius:8px;padding:8px 12px"><div><b>' + esc(f.title) + '</b><div class="small muted">Edited ' + (f.modifiedTime ? esc(LC.relTime(Date.parse(f.modifiedTime))) : 'at an unknown time') + (f.viewUrl && /^https:\/\//.test(f.viewUrl) ? ' · <a href="' + esc(f.viewUrl) + '" target="_blank" rel="noopener">Open in Google Sheets</a>' : '') + '</div></div><button type="button" class="btn sm primary" data-usefile="' + esc(f.id) + '" data-title="' + esc(f.title) + '"' + (SY.busy ? ' disabled' : '') + '>Use this sheet</button></div>').join('') + '</div>' : '<p class="note">No sheet with that title was found in your Google Drive. You can paste the sheet link below.</p>') : '') +
    '<div class="row" style="align-items:end"><div class="field" style="flex:1 1 260px"><label for="inv-sy-url">Or paste a sheet link</label><input class="input" id="inv-sy-url" type="url" placeholder="https://docs.google.com/spreadsheets/d/…/edit" autocomplete="off"></div><button type="button" class="btn" id="inv-sy-urlgo"' + (SY.busy ? ' disabled' : '') + '>Load sheet</button></div>' +
    (SY.busy ? '<div class="small muted" role="status">Reading from Google Drive…</div>' : '') + '</div>';
}
function pasteTabHTML() {
  return '<div class="stack"><p class="lede">In Google Sheets press Ctrl+A then Ctrl+C, then paste here.</p>' +
    '<div class="field"><label for="inv-sy-text">Sheet contents</label><textarea class="input" id="inv-sy-text" rows="6" placeholder="Paste the copied sheet here, header row first" spellcheck="false" style="font-family:var(--f-mono);font-size:11.5px"></textarea></div>' +
    '<div class="row"><button type="button" class="btn primary" id="inv-sy-check">Check changes</button><button type="button" class="btn" id="inv-sy-sample">Load a sample edited sheet</button></div></div>';
}
function uploadTabHTML() {
  return '<div class="stack"><p class="lede">Use File, then Download, then Comma-separated values in Google Sheets. Upload that file here.</p>' +
    '<div class="field"><label for="inv-sy-file">CSV or TSV file</label><input class="input" id="inv-sy-file" type="file" accept=".csv,.tsv,.txt"></div></div>';
}
function syncHTML() {
  const tabs = [['live', 'Live Google Sheet'], ['paste', 'Paste from the sheet'], ['upload', 'Upload CSV']];
  return '<div class="inv-sy" id="inv-sy"><p class="lede">One Google Sheet holds the inventory. The team edits it, and this page compares it with what is here before anything changes. Nothing is deleted: a unit missing from the sheet is marked Leased.</p>' +
    '<div class="tabs" role="tablist" aria-label="Sync source">' + tabs.map(([k, l]) => '<button type="button" role="tab" data-sytab="' + k + '" aria-selected="' + (SY.tab === k) + '">' + l + '</button>').join('') + '</div>' +
    '<div id="inv-sy-panel">' + (SY.tab === 'live' ? liveTabHTML() : SY.tab === 'paste' ? pasteTabHTML() : uploadTabHTML()) + '</div>' +
    '<div id="inv-sy-msg" role="status" aria-live="polite">' + (SY.msg ? '<div class="' + (SY.msgBad ? 'inv-flag' : 'note') + '">' + (SY.msgBad ? ICON.warn : '') + '<span>' + esc(SY.msg) + '</span></div>' : '') + '</div>' +
    '<div id="inv-sy-prev">' + previewHTML(SY.parsed) + '</div>' +
    '<p class="note">The ' + FD() + '-day rule: a unit whose last_confirmed date is more than ' + FD() + ' days old is hidden from client matching and flagged for a call. Update last_confirmed in the sheet to bring it back.</p>' +
    '<section class="inv-sec"><h3>Sync history</h3><div class="b" id="inv-sy-hist">' + syncHistoryHTML() + '</div></section>' + dictHTML() + '</div>';
}

LC.openSync = () => {
  SY.parsed = null; SY.msg = ''; SY.msgBad = false; SY.busy = false;
  if (!LC.ai.mcp && SY.tab === 'live') SY.tab = 'paste';
  const d = LC.drawer({ title: 'Sync from Google Sheet', sub: 'Compare the sheet with the inventory, then apply', wide: true, html: '' });
  const el = d.el;
  const alive = () => LC.$('#inv-sy', el);
  const paintAll = () => { if (!el.isConnected) return; const top = el.scrollTop; el.innerHTML = syncHTML(); bind(); el.scrollTop = top; };
  const setMsg = (m, bad) => { SY.msg = m; SY.msgBad = !!bad; const box = LC.$('#inv-sy-msg', el); if (box) box.innerHTML = m ? '<div class="' + (bad ? 'inv-flag' : 'note') + '">' + (bad ? ICON.warn : '') + '<span>' + esc(m) + '</span></div>' : ''; };
  const showPreview = (P) => { SY.parsed = P; const box = LC.$('#inv-sy-prev', el); if (box) { box.innerHTML = previewHTML(P); bindPreview(); } };
  const bindPreview = () => {
    const ap = LC.$('#inv-sy-apply', el), dc = LC.$('#inv-sy-discard', el);
    if (dc) dc.addEventListener('click', () => { SY.parsed = null; showPreview(null); setMsg(''); });
    if (ap) ap.addEventListener('click', () => {
      const P = SY.parsed; if (!P || !P.diff) return;
      const d0 = P.diff; const n = d0.added.length + d0.changed.length + d0.removed.length;
      LC.applyUnitDiff(P.units, d0, P.source, LC.state.me);
      SY.parsed = null; recMap = null;
      LC.toast('Synced: ' + d0.added.length + ' new, ' + d0.changed.length + ' changed, ' + d0.removed.length + ' marked Leased');
      setMsg('Applied ' + n + ' change' + (n === 1 ? '' : 's') + ' from ' + P.source + '. The inventory is up to date.', false);
      const box = LC.$('#inv-sy-prev', el); if (box) box.innerHTML = '';
      const h = LC.$('#inv-sy-hist', el); if (h) h.innerHTML = syncHistoryHTML();
      if (LC.isActive('inventory')) refresh();
    });
  };
  const loadText = (text, source) => {
    if (!String(text).trim()) { setMsg('Paste or choose a sheet first.', true); return; }
    let P; try { P = prepare(text, source); } catch (e) { P = { source, units: [], diff: null, warnings: ['Could not read that sheet: ' + e.message] }; }
    setMsg(''); showPreview(P);
  };
  const loadFromDrive = async (fileId, title) => {
    SY.busy = true; setMsg('Reading ' + (title || 'the sheet') + ' from Google Drive…', false); paintLivePanel();
    try {
      const r = await mcpCall('download_file_content', { fileId, exportMimeType: 'text/csv' });
      const pl = r && r.payload; if (!pl || pl.content == null) throw { code: 'tool_error', message: 'Google Drive returned no content for that file.' };
      const text = b64ToText(pl.content);
      SY.busy = false; paintLivePanel(); loadText(text, 'Google Sheet "' + (pl.title || title || 'sheet') + '"');
    } catch (err) { SY.busy = false; paintLivePanel(); setMsg(mcpMessage(err), true); }
  };
  const paintLivePanel = () => { if (SY.tab !== 'live' || !alive()) return; const p = LC.$('#inv-sy-panel', el); p.innerHTML = liveTabHTML(); bindLive(); };
  const bindLive = () => {
    const find = LC.$('#inv-sy-find', el);
    if (find) find.addEventListener('click', async () => {
      SY.busy = true; setMsg('', false); paintLivePanel();
      try {
        const r = await mcpCall('search_files', { query: "title contains 'Leasify Commercial Inventory' and mimeType = 'application/vnd.google-apps.spreadsheet'", pageSize: 5, excludeContentSnippets: true });
        SY.files = (r && r.payload && r.payload.files) || [];
      } catch (err) { SY.files = null; setMsg(mcpMessage(err), true); }
      SY.busy = false; paintLivePanel();
    });
    LC.$$('[data-usefile]', el).forEach(b => b.addEventListener('click', () => loadFromDrive(b.dataset.usefile, b.dataset.title)));
    const go = LC.$('#inv-sy-urlgo', el);
    if (go) go.addEventListener('click', () => {
      const m = String(LC.$('#inv-sy-url', el).value).match(/\/d\/([A-Za-z0-9_-]+)/);
      if (!m) { setMsg('That does not look like a Google Sheets link. It should contain /d/ followed by the sheet ID.', true); return; }
      loadFromDrive(m[1], 'the sheet');
    });
  };
  const bind = () => {
    LC.$$('[data-sytab]', el).forEach(b => b.addEventListener('click', () => { SY.tab = b.dataset.sytab; SY.parsed = null; SY.msg = ''; paintAll(); }));
    bindLive(); bindPreview();
    const ta = LC.$('#inv-sy-text', el);
    if (ta) {
      ta.value = SY.text;
      ta.addEventListener('input', () => { SY.text = ta.value; });
      ta.addEventListener('paste', () => setTimeout(() => { SY.text = ta.value; loadText(ta.value, 'pasted sheet'); }, 0));
      LC.$('#inv-sy-check', el).addEventListener('click', () => { SY.text = ta.value; loadText(ta.value, 'pasted sheet'); });
      LC.$('#inv-sy-sample', el).addEventListener('click', () => { const t = sampleSheet(); ta.value = t; SY.text = t; loadText(t, 'sample edited sheet'); });
    }
    const fi = LC.$('#inv-sy-file', el);
    if (fi) fi.addEventListener('change', () => {
      const f = fi.files && fi.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => loadText(String(rd.result), 'CSV file "' + f.name + '"');
      rd.onerror = () => setMsg('Could not read that file.', true);
      rd.readAsText(f);
    });
    const hdr = LC.$('#inv-sy-hdr', el); if (hdr) hdr.addEventListener('click', () => copyText(LC.INVENTORY_COLUMNS.join('\t')));
  };
  paintAll();
  /* light up the live tab if the runtime finishes connecting while the drawer is open */
  const off = LC.on('ai:ready', () => { if (!alive()) { off(); return; } if (SY.tab !== 'live' && LC.ai.mcp && !SY.parsed) { /* keep the user's tab */ } if (SY.tab === 'live') paintLivePanel(); else { const t = LC.$('[data-sytab="live"]', el); if (t) t.title = 'Google Drive is connected'; } });
};

/* =====================================================================
   Weekly owner check (simulated WhatsApp replies)
   ===================================================================== */
let ownerRuns = 0, ownerBusy = false;
LC.runOwnerCheck = () => {
  if (ownerBusy) { LC.toast('The owner check is already running.'); return; }
  const groupsMap = new Map();
  U().filter(u => u.status === 'Available').forEach(u => { if (!groupsMap.has(u.owner_name)) groupsMap.set(u.owner_name, { owner: u.owner_name, type: u.owner_type, phone: u.owner_phone, units: [] }); groupsMap.get(u.owner_name).units.push(u); });
  const groups = Array.from(groupsMap.values()).sort((a, b) => a.owner.localeCompare(b.owner));
  const first = ownerRuns === 0; ownerRuns++;
  const days = (g) => Math.max(...g.units.map(u => LC.unitFreshness(u).days));
  groups.forEach(g => {
    const hello = g.type === 'Individual' ? g.owner.split(' ')[0] : g.owner;
    const desc = (u) => 'Unit ' + u.unit_no + ' (' + LC.fmtNum(u.chargeable_sqft) + ' sq ft, ' + u.building_name + ')';
    g.msg = g.units.length === 1
      ? 'Hi ' + hello + ', is ' + desc(g.units[0]) + ' still available on the same terms? Reply 1 if yes, 2 if something changed, 3 if it is leased.'
      : 'Hi ' + hello + ', are these still available on the same terms?\n' + g.units.map((u, i) => (i + 1) + ') ' + desc(u)).join('\n') + '\nReply 1 if yes, 2 if something changed, 3 if any is leased.';
    g.reply = 1;
  });
  // choose who does not just say yes: the least recently confirmed owners
  const order = groups.slice().sort((a, b) => days(b) - days(a) || a.owner.localeCompare(b.owner));
  const singles = order.filter(g => g.units.length === 1);
  const used = new Set(); const take = (list) => { const g = list.find(x => !used.has(x)); if (g) used.add(g); return g; };
  const none = take(order), leased = first ? take(singles) : null, c1 = take(singles), c2 = take(singles);
  if (none) none.reply = 0; if (leased) leased.reply = 3; if (c1) c1.reply = 2; if (c2) c2.reply = 2;
  // reply sequence: yes replies in a fixed scramble, with the special ones spread through it
  let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const yes = groups.filter(g => g.reply === 1).sort(() => rnd() - 0.5);
  const seq = yes.slice();
  [[c1, 0.28], [c2, 0.55], [leased, 0.78]].forEach(([g, at]) => { if (g) seq.splice(Math.floor(seq.length * at), 0, g); });
  const total = groups.length; const totalMs = 3600, gap = Math.max(40, Math.round(totalMs / Math.max(1, seq.length)));

  const stats = { sent: total, yes: 0, changed: 0, leased: 0, none: 0, units: 0 };
  const d = LC.drawer({ title: 'Weekly owner check', sub: 'WhatsApp availability check, simulated replies', wide: true, html: '' });
  const el = d.el;
  const rows = groups.map((g, i) => '<div class="inv-wrow" data-g="' + i + '"><div class="who">' + esc(g.owner) + ' · ' + esc(g.phone) + ' · ' + g.units.map(u => esc(u.unit_id)).join(', ') + '</div><div class="bub out">' + esc(g.msg) + '<span class="t">Sent</span></div><div class="wait" data-wait>Waiting for a reply</div></div>').join('');
  el.innerHTML = '<div class="inv-sy" id="inv-oc"><p class="lede">One message goes to each owner with available units. A reply of 1 confirms the units today. A reply of 2 creates a call task. A reply of 3 marks the unit Leased. Owners who do not reply get a call.</p>' +
    '<div class="inv-tiles" id="inv-oc-tiles"></div><div class="inv-prog" aria-hidden="true"><i id="inv-oc-bar"></i></div><div class="inv-wa" id="inv-oc-list">' + rows + '</div><div id="inv-oc-sum" role="status" aria-live="polite"></div></div>';
  const tiles = () => { const t = LC.$('#inv-oc-tiles', el); if (t) t.innerHTML = '<div><b>' + stats.sent + '</b><span>Messages sent</span></div><div><b>' + stats.yes + '</b><span>Confirmed</span></div><div><b>' + stats.changed + '</b><span>Terms changed</span></div><div><b>' + stats.leased + '</b><span>Now leased</span></div>'; };
  tiles();
  ownerBusy = true;
  const rowEl = (g) => LC.$('[data-g="' + groups.indexOf(g) + '"]', el);
  const putReply = (g, text, tag) => {
    const r = rowEl(g); if (!r) return; const w = LC.$('[data-wait]', r);
    const b = document.createElement('div'); b.className = 'bub in'; b.innerHTML = esc(text) + '<span class="t">' + esc(tag) + '</span>';
    if (w) w.replaceWith(b); else r.appendChild(b);
    const list = LC.$('#inv-oc-list', el); if (list) list.scrollTop = Math.max(0, r.offsetTop - list.offsetTop - 40);
  };
  const doReply = (g) => {
    const by = g.owner + ' via WhatsApp check';
    if (g.reply === 1) {
      g.units.forEach(u => { confirmUnit(u, 'WhatsApp reply', by); stats.units++; }); stats.yes++;
      putReply(g, '1', 'Confirmed today');
    } else if (g.reply === 2) {
      g.units.forEach(u => { u.data_flag = 'Owner says terms changed. Confirm with the owner before offering.'; const title = 'Call owner: terms changed for ' + u.unit_id; if (!LC.state.tasks.some(t => !t.done && t.title === title)) LC.tasks.add({ type: 'Owner check', title, due: Date.now() + 2 * 36e5, unitId: u.unit_id, assignee: u.listing_agent, priority: 'High' }); audit(u, 'owner check', '', 'Owner replied 2: something changed', by); });
      stats.changed++; putReply(g, '2', 'Terms changed: call task created');
    } else if (g.reply === 3) {
      g.units.forEach(u => { audit(u, 'status', u.status, 'Leased', by); u.status = 'Leased'; u.last_confirmed = todayISO(); u.confirmed_via = 'WhatsApp reply'; LC.log(u.unit_id + ' marked Leased after owner reply', { unitId: u.unit_id, kind: 'unit' }); });
      stats.leased++; putReply(g, '3', 'Leased: status updated');
    }
    tiles();
  };
  let i = 0;
  const step = () => {
    if (i >= seq.length) return finish();
    setTimeout(() => {
      doReply(seq[i]); i++;
      const bar = LC.$('#inv-oc-bar', el); if (bar) bar.style.width = Math.round(i / seq.length * 100) + '%';
      step();
    }, i === 0 ? 450 : gap);
  };
  const finish = () => {
    if (none) {
      stats.none++;
      const nu = none.units[0], ids = none.units.map(u => u.unit_id).join(', '), title = 'Call owner: no reply to weekly check for ' + ids;
      if (!LC.state.tasks.some(t => !t.done && t.title === title)) LC.tasks.add({ type: 'Owner check', title, due: Date.now() + 3 * 36e5, unitId: nu.unit_id, assignee: nu.listing_agent, priority: 'Normal' });
      const r = rowEl(none); const w = r && LC.$('[data-wait]', r); if (w) { w.textContent = 'No reply yet: the team will call'; w.style.fontWeight = '600'; }
    }
    LC.log('Weekly owner check: ' + stats.yes + ' confirmed, ' + stats.changed + ' changed, ' + stats.leased + ' leased, ' + stats.none + ' no reply', { kind: 'sync' });
    const sum = LC.$('#inv-oc-sum', el);
    if (sum) sum.innerHTML = '<div class="card" style="box-shadow:none"><div class="card-b stack"><b>Done. ' + stats.sent + ' owners were asked.</b><ul class="small" style="margin:0;padding-left:18px"><li>' + stats.yes + ' confirmed (' + stats.units + ' units now show Confirmed today).</li><li>' + stats.changed + ' said the terms changed. A high priority call task was added for each, and the unit is flagged so it is not sent until someone confirms.</li><li>' + stats.leased + ' said the unit is leased. Its status is now Leased.</li><li>' + stats.none + ' did not reply. The team will call.</li></ul><div class="row"><button type="button" class="btn primary" id="inv-oc-done">Close</button></div></div></div>';
    const dn = LC.$('#inv-oc-done', el); if (dn) dn.addEventListener('click', () => LC.closeDrawer());
    ownerBusy = false;
    LC.emit('units:changed');
    LC.toast('Owner check finished: ' + stats.yes + ' confirmed, ' + stats.changed + ' to call, ' + stats.leased + ' leased');
  };
  step();
};

})();
