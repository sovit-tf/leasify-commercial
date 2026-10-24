/* =====================================================================
   Leasify Commercial demo: CORE
   Shared state, utilities, domain logic (requirement parser, match engine),
   CRM/visit/task/queue APIs, seeded history, router, AI capability hooks.
   Every module file registers views with LC.registerView and talks to the
   rest of the app only through the LC namespace and LC events.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC = {};

/* ---------------- tiny utilities ---------------- */
LC.$ = (s, r = document) => r.querySelector(s);
LC.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
LC.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
LC.uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 9);
LC.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
LC.sum = (a, f = x => x) => a.reduce((s, x) => s + (f(x) || 0), 0);
LC.groupBy = (a, f) => a.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
LC.median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
let _seed = 20261010;
LC.rand = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };   // deterministic
LC.pick = (a) => a[Math.floor(LC.rand() * a.length)];
LC.rint = (a, b) => a + Math.floor(LC.rand() * (b - a + 1));

/* Indian number formatting */
LC.fmtNum = (n) => n == null || isNaN(n) ? '–' : Math.round(n).toLocaleString('en-IN');
LC.fmtINR = (n) => n == null || isNaN(n) ? '–' : '₹' + Math.round(n).toLocaleString('en-IN');
LC.fmtLakh = (n) => {                 // ₹1.61 L, ₹2.3 Cr, ₹85,500
  if (n == null || isNaN(n)) return '–';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  return LC.fmtINR(n);
};
LC.fmtSqft = (n) => n == null ? '–' : LC.fmtNum(n) + ' sq ft';
LC.pct = (x, d = 0) => x == null || isNaN(x) ? '–' : (x * 100).toFixed(d) + '%';

/* ---------------- dates: demo "now" is the real now ---------------- */
LC.NOW = new Date();
const DAY = 864e5; LC.DAY = DAY;
LC.today = () => { const d = new Date(LC.NOW); d.setHours(0, 0, 0, 0); return d; };
LC.addDays = (d, n) => new Date(+new Date(d) + n * DAY);
LC.iso = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
LC.parseDate = (s) => { if (!s) return null; if (s instanceof Date) return s; if (typeof s === 'number') { const d = new Date(s); d.setHours(0, 0, 0, 0); return d; } const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
LC.daysBetween = (a, b) => Math.round((LC.parseDate(b) - LC.parseDate(a)) / DAY);
LC.daysAgo = (s) => Math.round((LC.today() - LC.parseDate(s)) / DAY);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
LC.MON = MON; LC.WD = WD;
LC.fmtDate = (s) => { const d = LC.parseDate(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] : '–'; };
LC.fmtDateY = (s) => { const d = LC.parseDate(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : '–'; };
LC.fmtTime = (ts) => { const d = new Date(ts); let h = d.getHours(), m = d.getMinutes(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; };
LC.fmtDT = (ts) => { const d = new Date(ts); return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()] + ', ' + LC.fmtTime(ts); };
LC.relTime = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 0) { const f = -s; if (f < 3600) return 'in ' + Math.round(f / 60) + ' min'; if (f < 86400) return 'in ' + Math.round(f / 3600) + ' h'; return 'in ' + Math.round(f / 86400) + ' d'; }
  if (s < 45) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago';
};
LC.dayLabel = (ts) => { const d = LC.daysBetween(LC.today(), LC.parseDate(LC.iso(ts))); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : LC.fmtDT(ts).split(',')[0]; };

/* ---------------- events ---------------- */
const _subs = {};
LC.on = (evt, fn) => { (_subs[evt] = _subs[evt] || []).push(fn); return () => { _subs[evt] = _subs[evt].filter(f => f !== fn); }; };
LC.emit = (evt, payload) => { (_subs[evt] || []).slice().forEach(fn => { try { fn(payload); } catch (e) { console.error('[LC] handler for', evt, e); } }); };
/* Events used across modules:
   units:changed, leads:changed, lead:updated(id), clients:changed, client:updated(id),
   visits:changed, tasks:changed, queue:changed, sim:tick, route(viewId), ai:ready, settings:changed */

/* ---------------- static reference data ---------------- */
LC.LOCALITIES = {
  'Patia': { city: 'Bhubaneswar', lat: 20.3540, lng: 85.8215, aliases: ['patia', 'kiit', 'kiit square', 'kalinga institute'] },
  'Chandrasekharpur': { city: 'Bhubaneswar', lat: 20.3245, lng: 85.8170, aliases: ['chandrasekharpur', 'chandrashekharpur', 'csp', 'damana', 'nalco square'] },
  'Infocity': { city: 'Bhubaneswar', lat: 20.3445, lng: 85.8065, aliases: ['infocity', 'info city', 'chandaka', 'it park'] },
  'Jaydev Vihar': { city: 'Bhubaneswar', lat: 20.2985, lng: 85.8195, aliases: ['jaydev vihar', 'jayadev vihar', 'jaydev', 'kalinga stadium'] },
  'Saheed Nagar': { city: 'Bhubaneswar', lat: 20.2880, lng: 85.8445, aliases: ['saheed nagar', 'shahid nagar', 'sahid nagar', 'vani vihar'] },
  'Janpath': { city: 'Bhubaneswar', lat: 20.2700, lng: 85.8395, aliases: ['janpath', 'kharvel nagar', 'master canteen', 'unit 3', 'railway station bhubaneswar'] },
  'Nayapalli': { city: 'Bhubaneswar', lat: 20.2925, lng: 85.8085, aliases: ['nayapalli', 'nayapali', 'ids'] },
  'Rasulgarh': { city: 'Bhubaneswar', lat: 20.2960, lng: 85.8640, aliases: ['rasulgarh', 'rasulgad'] },
  'Khandagiri': { city: 'Bhubaneswar', lat: 20.2565, lng: 85.7790, aliases: ['khandagiri', 'khandgiri', 'aiims'] },
  'Mancheswar': { city: 'Bhubaneswar', lat: 20.3115, lng: 85.8580, aliases: ['mancheswar', 'mancheswar industrial'] },
  'Bomikhal': { city: 'Bhubaneswar', lat: 20.2845, lng: 85.8560, aliases: ['bomikhal', 'cuttack road'] },
  'Cuttack-Puri Bypass': { city: 'Bhubaneswar', lat: 20.2520, lng: 85.8505, aliases: ['cuttack puri bypass', 'cuttack-puri bypass', 'bypass', 'puri bypass', 'uttara', 'pipili road', 'kalpana'] },
  'Buxi Bazaar': { city: 'Cuttack', lat: 20.4685, lng: 85.8790, aliases: ['buxi bazaar', 'bakshi bazar', 'buxi bazar'] },
  'Badambadi': { city: 'Cuttack', lat: 20.4560, lng: 85.8890, aliases: ['badambadi', 'badambari'] },
  'Link Road': { city: 'Cuttack', lat: 20.4505, lng: 85.8870, aliases: ['link road'] },
  'Cantonment Road': { city: 'Cuttack', lat: 20.4720, lng: 85.8885, aliases: ['cantonment road', 'cantonment', 'scb'] },
  'Jagatpur': { city: 'Cuttack', lat: 20.4440, lng: 85.9180, aliases: ['jagatpur'] },
  'CDA Markat Nagar': { city: 'Cuttack', lat: 20.4870, lng: 85.8380, aliases: ['cda', 'markat nagar', 'sector 9'] },
  'Grand Road': { city: 'Puri', lat: 19.8065, lng: 85.8235, aliases: ['grand road', 'bada danda', 'temple road'] },
  'VIP Road': { city: 'Puri', lat: 19.7980, lng: 85.8320, aliases: ['vip road'] },
  'Chakratirtha Road': { city: 'Puri', lat: 19.7920, lng: 85.8400, aliases: ['chakratirtha', 'ct road', 'beach road'] },
  'Station Road': { city: 'Puri', lat: 19.8175, lng: 85.8325, aliases: ['station road', 'puri station'] },
  'Trisulia': { city: 'Cuttack (Trisulia)', lat: 20.4250, lng: 85.8330, aliases: ['trisulia', 'trishulia'] },
  'Phulnakhara': { city: 'Cuttack (Phulnakhara)', lat: 20.4040, lng: 85.8780, aliases: ['phulnakhara', 'phulnakhra'] },
  'Jatni': { city: 'Jatni', lat: 20.1700, lng: 85.7070, aliases: ['jatni', 'khurda road', 'iit bhubaneswar', 'khordha road'] },
};
LC.CITIES = {
  'Bhubaneswar': ['bhubaneswar', 'bbsr', 'bhubaneshwar', 'ଭୁବନେଶ୍ୱର', 'भुवनेश्वर'],
  'Cuttack': ['cuttack', 'ctc', 'kataka', 'କଟକ', 'कटक'],
  'Puri': ['puri', 'ପୁରୀ', 'पुरी'],
  'Jatni': ['jatni', 'ଜଟଣୀ'],
};
LC.cityOf = (u) => String(u.city).split(' (')[0];   // 'Cuttack (Trisulia)' -> 'Cuttack'

LC.TYPES = ['Office', 'Coworking', 'Retail shop', 'Showroom', 'F&B space', 'Clinic', 'Institutional', 'Warehouse', 'Industrial shed'];
/* Requirement "use" values and which property types serve them */
LC.USES = {
  'Office': { types: ['Office', 'Coworking'], words: ['office', 'it', 'back office', 'corporate'] },
  'Coworking': { types: ['Coworking', 'Office'], words: ['coworking', 'startup'] },
  'Retail': { types: ['Retail shop', 'Showroom'], words: ['retail', 'pharmacy', 'mobile'] },
  'Showroom': { types: ['Showroom', 'Retail shop'], words: ['showroom'] },
  'F&B': { types: ['F&B space', 'Retail shop'], words: ['restaurant', 'cafe', 'cloud kitchen'] },
  'Clinic': { types: ['Clinic', 'Office', 'Retail shop'], words: ['clinic', 'diagnostics'] },
  'Institutional': { types: ['Institutional', 'Office'], words: ['coaching', 'training', 'education'] },
  'Warehouse': { types: ['Warehouse', 'Industrial shed'], words: ['warehouse', 'distribution'] },
  'Industrial': { types: ['Industrial shed', 'Warehouse'], words: ['manufacturing', 'workshop'] },
};
LC.useAllowed = (u, use) => {
  if (!use) return true;
  const spec = LC.USES[use]; if (!spec) return true;
  const pu = (u.permitted_uses || []).join(' ').toLowerCase();
  if (use === 'F&B') return /restaurant|cafe|cloud kitchen/.test(pu);
  if (use === 'Clinic') return /clinic|diagnostic/.test(pu);
  if (use === 'Institutional') return /coaching|education|training/.test(pu);
  return spec.types.includes(u.property_type) && (spec.words.some(w => pu.includes(w)) || spec.types[0] === u.property_type);
};
LC.FURNISHING = ['Bare shell', 'Warm shell', 'Semi-furnished', 'Plug-and-play'];
LC.FITOUT_WEEKS = [10, 6, 2, 0];   // weeks to reach plug-and-play from each stage
LC.STAGES = ['New enquiry', 'Qualified', 'Site visit', 'Proposal', 'Letter of intent', 'Signed lease'];
LC.OFF_STAGES = ['Nurture', 'Lost'];
LC.STAGE_DEFS = {
  'New enquiry': 'Any first contact about a space requirement, from any source.',
  'Qualified': 'Use, size, budget and area are captured.',
  'Site visit': 'At least one visit has taken place, marked by the team after it happened.',
  'Proposal': 'Written options or terms sent to the occupier.',
  'Letter of intent': 'The occupier has signed a letter of intent.',
  'Signed lease': 'The lease agreement is executed.',
  'Nurture': 'Real requirement, but move-in is more than 90 days away or the occupier paused.',
  'Lost': 'Closed without a lease. Reason recorded.',
};
LC.SOURCES = ['99acres', 'Magicbricks', 'Housing.com', 'Website form', 'Meta lead ads', 'Google Ads', 'JustDial', 'Office WhatsApp', 'Phone call (IVR)', 'Referral', 'Walk-in'];
LC.LANGS = ['English', 'Hindi', 'Odia'];
LC.TEAM = [
  { id: 'rohit', name: 'Rohit Mohanty', role: 'Senior leasing manager', cities: ['Bhubaneswar'], langs: ['English', 'Hindi', 'Odia'], senior: true },
  { id: 'priyanka', name: 'Priyanka Das', role: 'Leasing executive', cities: ['Bhubaneswar'], langs: ['English', 'Odia'] },
  { id: 'subham', name: 'Subham Sahoo', role: 'Leasing executive', cities: ['Bhubaneswar', 'Jatni'], langs: ['English', 'Hindi', 'Odia'] },
  { id: 'ananya', name: 'Ananya Patnaik', role: 'Leasing executive', cities: ['Cuttack'], langs: ['English', 'Hindi', 'Odia'] },
  { id: 'satya', name: 'Satya Prakash Jena', role: 'Leasing executive', cities: ['Puri'], langs: ['English', 'Odia'] },
];
LC.teamBy = (name) => LC.TEAM.find(t => t.name === name || t.id === name);
/* ---------------- users, roles, access ---------------- */
LC.CEO = { id: 'ceo', name: 'Sanjeev Das', role: 'CEO' };
LC.ROLES = {
  ceo:       { label: 'CEO', views: '*' },
  manager:   { label: 'Leasing manager', views: ['dashboard', 'inbox', 'inventory', 'match', 'copilot', 'crm', 'visits', 'owners', 'ceo', 'analytics', 'team'] },
  executive: { label: 'Leasing executive', views: ['dashboard', 'inbox', 'inventory', 'match', 'copilot', 'crm', 'visits', 'team'] },
  owner:     { label: 'Owner', views: ['owners'] },
};
/* session survives "Reset demo data"; default is the CEO so the demo opens with every screen */
LC.session = { name: LC.CEO.name, role: 'ceo', owner: null, signedIn: false, at: null, logins: [] };
LC.can = (viewId) => { const r = LC.ROLES[LC.session.role]; return !!r && (r.views === '*' || r.views.includes(viewId)); };
LC.homeView = () => ({ owner: 'owners' }[LC.session.role] || 'dashboard');
LC.isAgent = () => LC.session.role === 'executive' || LC.session.role === 'manager';
/** sign in as a person. role: ceo | manager | executive | owner ; owner = owner_name for owners */
LC.signIn = ({ name, role, owner = null }) => {
  LC.session = { ...LC.session, name, role, owner, signedIn: true, at: Date.now() };
  LC.session.logins.unshift({ ts: Date.now(), name, role });
  if (LC.state) LC.state.me = role === 'owner' ? LC.CEO.name : name;
  LC.applyRole(); LC.emit('session:changed', LC.session);
  const want = (location.hash || '').slice(1);
  LC.go(LC.can(want) ? want : LC.homeView());
};
LC.applyRole = () => {
  LC.$$('.nav a[data-v]').forEach(a => { a.hidden = !LC.can(a.dataset.v); });
  LC.$$('.nav-group').forEach(g => { const nav = g.nextElementSibling; if (nav && nav.classList.contains('nav')) g.hidden = nav.querySelectorAll('a:not([hidden])').length === 0; });
  const chip = LC.$('#user-chip'); if (chip) chip.innerHTML = '<span class="uc-av">' + LC.esc(LC.session.name.split(' ').map(x => x[0]).join('').slice(0, 2)) + '</span><span class="uc-t"><b>' + LC.esc(LC.session.name) + '</b><span>' + LC.esc(LC.ROLES[LC.session.role].label) + '</span></span>';
};

/* ---------------- inventory load ---------------- */
const SPLIT = ['permitted_uses', 'amenities', 'highlights', 'nearby'];
const NUMS = ['floor', 'total_floors', 'lat', 'lng', 'carpet_sqft', 'super_builtup_sqft', 'chargeable_sqft', 'loading_pct', 'rent_per_sqft', 'monthly_rent', 'seats', 'price_per_seat', 'cam_per_sqft', 'all_in_per_sqft', 'all_in_monthly', 'gst_pct', 'deposit_months', 'deposit_amount', 'lock_in_months', 'lease_term_years', 'escalation_pct', 'escalation_every_years', 'rent_free_days', 'brokerage_months', 'workstations', 'cabins', 'meeting_rooms', 'power_load_kw', 'parking_4w', 'parking_2w', 'frontage_ft', 'clear_height_ft', 'road_width_ft', 'building_age_years', 'photos'];
LC.INVENTORY_COLUMNS = null;            // set from the embedded data (sheet header order)
LC.normalizeUnit = (r, shiftDays = 0) => {
  const u = { ...r };
  NUMS.forEach(k => { if (u[k] === '' || u[k] == null) u[k] = null; else if (typeof u[k] !== 'number') { const n = parseFloat(String(u[k]).replace(/[₹,%\s]/g, '')); u[k] = isNaN(n) ? null : n; } });
  SPLIT.forEach(k => { if (!Array.isArray(u[k])) u[k] = String(u[k] || '').split(';').map(s => s.trim()).filter(Boolean); });
  ['available_from', 'listed_date', 'last_confirmed'].forEach(k => { if (u[k] && shiftDays) u[k] = LC.iso(LC.addDays(LC.parseDate(u[k]), shiftDays)); });
  // derived fields stay consistent with the sheet's own formulas
  if (u.rent_per_sqft != null && u.chargeable_sqft != null) {
    u.monthly_rent = Math.round(u.rent_per_sqft * u.chargeable_sqft / 5) * 5;
    u.all_in_per_sqft = +(u.rent_per_sqft + (u.cam_per_sqft || 0)).toFixed(2);
    u.all_in_monthly = Math.round(u.all_in_per_sqft * u.chargeable_sqft / 5) * 5;
    if (u.deposit_months != null) u.deposit_amount = u.monthly_rent * u.deposit_months;
  }
  if (u.carpet_sqft && u.super_builtup_sqft) u.loading_pct = Math.round((u.super_builtup_sqft - u.carpet_sqft) / u.carpet_sqft * 100);
  u.data_flag = u.data_flag || '';
  return u;
};
LC.loadInventory = () => {
  const raw = JSON.parse(document.getElementById('lc-inventory').textContent);
  LC.INVENTORY_COLUMNS = Object.keys(raw[0]);
  // dataset was generated relative to 10 Oct 2026; shift its dates so freshness reads the same today
  const shift = LC.daysBetween(new Date(2026, 9, 10), LC.today());
  return raw.map(r => LC.normalizeUnit(r, shift));
};
LC.unit = (id) => LC.state.units.find(u => u.unit_id === id);
LC.unitFreshness = (u) => {
  const d = LC.daysAgo(u.last_confirmed);
  if (d <= 7) return { days: d, level: 'fresh', label: d === 0 ? 'Confirmed today' : 'Confirmed ' + d + 'd ago' };
  if (d <= 14) return { days: d, level: 'aging', label: 'Confirmed ' + d + 'd ago' };
  return { days: d, level: 'stale', label: 'Not confirmed for ' + d + 'd' };
};
LC.isMatchable = (u) => u.status === 'Available' && LC.unitFreshness(u).days <= LC.settings().freshnessDays;
LC.unitShort = (u) => u.building_name + ' ' + u.unit_no;
LC.dist = (a, b, c, d) => { const R = 6371, r = Math.PI / 180; const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
LC.mapsLink = (u, dest) => dest
  ? 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(u.lat + ',' + u.lng) + '&destination=' + encodeURIComponent(dest)
  : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(u.lat + ',' + u.lng);
/* readiness: date the occupier can trade, given the furnishing they need */
LC.readyDate = (u, needFurnishing) => {
  const have = LC.FURNISHING.indexOf(u.furnishing), need = needFurnishing ? LC.FURNISHING.indexOf(needFurnishing) : have;
  const gapWeeks = need > have ? (LC.FITOUT_WEEKS[have] - LC.FITOUT_WEEKS[need]) : 0;
  return LC.addDays(LC.parseDate(u.available_from) < LC.today() ? LC.today() : LC.parseDate(u.available_from), gapWeeks * 7);
};

/* ---------------- requirement parser (deterministic, EN/HI/OD) ---------------- */
LC.REQ_FIELDS = [
  { key: 'use', label: 'Type of use', q: 'What will you use the space for? (office, shop, showroom, restaurant, clinic, coaching, warehouse)' },
  { key: 'size', label: 'Size', q: 'Roughly how much space do you need, in sq ft? A range is fine.' },
  { key: 'budget', label: 'Budget (all-in)', q: 'What is your monthly budget including maintenance? Per sq ft or a monthly total, either is fine.' },
  { key: 'location', label: 'Area', q: 'Which area or landmark should it be near?' },
  { key: 'moveIn', label: 'Move-in', q: 'When do you want to move in?' },
  { key: 'furnishing', label: 'Fit-out', q: 'Do you need it ready to use (plug-and-play), or will you do your own interiors?' },
  { key: 'parking4w', label: 'Parking', q: 'How many car parks do you need? Say 0 if none.' },
];
LC.emptyReq = () => ({ use: null, sizeMin: null, sizeMax: null, seats: null, budgetPsf: null, budgetMonthly: null, city: null, localities: [], landmark: null, radiusKm: null, moveIn: null, furnishing: null, parking4w: null, powerBackup: null, frontageMin: null, groundFloor: null, clearHeightMin: null, mustHave: [], leaseYears: null, company: null, contactName: null, notes: '' });
LC.reqHas = (req, key) => {
  switch (key) {
    case 'use': return !!req.use;
    case 'size': return !!(req.sizeMin || req.sizeMax || req.seats);
    case 'budget': return !!(req.budgetPsf || req.budgetMonthly);
    case 'location': return !!(req.localities.length || req.city || req.landmark);
    case 'moveIn': return !!req.moveIn;
    case 'furnishing': return !!req.furnishing;
    case 'parking4w': return req.parking4w != null;
  } return false;
};
LC.reqMissing = (req) => LC.REQ_FIELDS.filter(f => !LC.reqHas(req, f.key)).map(f => f.key);
LC.reqIsQualified = (req) => ['use', 'size', 'budget', 'location'].every(k => LC.reqHas(req, k));
/* effective all-in budget per sq ft (derived from monthly when needed) */
LC.reqBudgetPsf = (req) => {
  if (req.budgetPsf) return req.budgetPsf;
  if (req.budgetMonthly) { const mid = LC.reqSizeMid(req); if (mid) return Math.round(req.budgetMonthly / mid); }
  return null;
};
LC.reqSizeMid = (req) => {
  if (req.sizeMin && req.sizeMax) return (req.sizeMin + req.sizeMax) / 2;
  if (req.sizeMin || req.sizeMax) return req.sizeMin || req.sizeMax;
  if (req.seats) return req.seats * (req.use === 'Coworking' ? 75 : 70);
  return null;
};
LC.reqSizeBand = (req) => {
  let a = req.sizeMin, b = req.sizeMax;
  if (!a && !b && req.seats) { const m = LC.reqSizeMid(req); a = Math.round(m * 0.85); b = Math.round(m * 1.2); }
  if (a && !b) b = Math.round(a * 1.25); if (b && !a) a = Math.round(b * 0.75);
  return a ? [a, b] : null;
};
LC.reqSummary = (req) => {
  const p = [];
  if (req.use) p.push(req.use);
  const band = LC.reqSizeBand(req); if (req.seats && !req.sizeMin) p.push(req.seats + ' seats'); else if (band) p.push(LC.fmtNum(band[0]) + '–' + LC.fmtNum(band[1]) + ' sq ft');
  if (req.budgetPsf) p.push('≤ ₹' + req.budgetPsf + '/sq ft all-in'); else if (req.budgetMonthly) p.push('≤ ' + LC.fmtLakh(req.budgetMonthly) + '/month all-in');
  if (req.localities.length) p.push(req.localities.join(' / ')); else if (req.landmark) p.push('near ' + req.landmark.name); else if (req.city) p.push(req.city);
  if (req.moveIn) p.push('move in by ' + LC.fmtDate(req.moveIn));
  if (req.furnishing) p.push(req.furnishing);
  if (req.parking4w) p.push(req.parking4w + ' car parks');
  return p.join(' · ') || 'No requirement captured yet';
};

const DIGITS = { '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9, '୦': 0, '୧': 1, '୨': 2, '୩': 3, '୪': 4, '୫': 5, '୬': 6, '୭': 7, '୮': 8, '୯': 9 };
const WORDMAP = [[/ଭଡ଼ା|ଭଡା|किराया|किराए/g, ' rent '], [/ଲକ୍ଷ|लाख/g, ' lakh '], [/ହଜାର|हजार|हज़ार/g, ' thousand '], [/ଏବେ|ତୁରନ୍ତ|तुरंत|तुरन्त/g, ' immediately '], [/ଆସନ୍ତା ମାସ|ଆସନ୍ତାମାସ|अगले महीने|अगले महीना/g, ' next month '], [/ପାର୍କିଂ|पार्किंग/g, ' parking '], [/ବର୍ଗଫୁଟ|ବର୍ଗ ଫୁଟ|वर्ग फुट|स्क्वायर फीट/g, ' sqft '], [/ମାସିକ|ପ୍ରତି ମାସ|प्रति माह|महीना|महीने/g, ' per month ']];
const normText = (t) => WORDMAP.reduce((x, [rx, w]) => x.replace(rx, w), String(t || '')).replace(/[०-९୦-୯]/g, c => DIGITS[c]).replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const USE_WORDS = [
  ['Coworking', /\b(co-?working|managed office|shared office|hot ?desks?|dedicated desks?)\b/],
  ['Warehouse', /\b(warehouse|godown|go-down|storage|logistics|distribution|fulfil?ment|cold (chain|storage))\b|गोदाम|ଗୋଦାମ/],
  ['Industrial', /\b(factory|manufactur\w*|workshop|industrial|fabrication|production unit)\b|କାରଖାନା/],
  ['F&B', /\b(restaurant|cafe|café|food|kitchen|bakery|dhaba|bar|qsr|eatery|tiffin)\b|रेस्टोरेंट|ରେଷ୍ଟୁରାଣ୍ଟ/],
  ['Clinic', /\b(clinic|hospital|diagnostic\w*|path ?lab|dental|dentist|physio\w*|doctor|nursing home|eye care|polyclinic)\b|क्लिनिक|କ୍ଲିନିକ/],
  ['Institutional', /\b(coaching|tuition|classes|institute|school|training cent(er|re)|academy|education)\b|କୋଚିଂ|कोचिंग/],
  ['Showroom', /\b(showroom|show room|display cent(er|re)|dealership|(car|bike|auto|two-wheeler|ev|furniture|tiles?) (showroom|dealer\w*|outlet))\b|शोरूम|ସୋରୁମ/],
  ['Retail', /\b(shop|store|retail|outlet|dukan|dokan|pharmacy|medical store|mobile shop|boutique|salon|parlour|atm|bank branch|grocery|mart|opticals?|jewell?ery)\b|दुकान|ଦୋକାନ/],
  ['Office', /\b(office|ofc|workspace|work space|it company|back office|bpo|corporate|daftar|headquarters|branch office)\b|ऑफिस|दफ्तर|ଅଫିସ/],
];
const MONTHS_RX = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/;
const MIDX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/**
 * Parse free text (chat message, call notes, email, transcript) into a requirement.
 * @param {string} text
 * @param {object} base  existing requirement to merge into (not mutated)
 * @param {object} ctx   { expect: 'use'|'size'|... }  the question just asked; lets bare numbers count
 * @returns {{req, found:[{key,label,value}], missing:[keys], intents:{negotiate,legal,complaint,human,callme,notInterested,stop,greeting,yes,no}}}
 */
LC.parseRequirement = (text, base = null, ctx = {}) => {
  const raw = normText(text); const t = raw.toLowerCase();
  const req = JSON.parse(JSON.stringify(base || LC.emptyReq()));
  const found = []; const set = (key, label, value) => found.push({ key, label, value });

  // use
  for (const [use, rx] of USE_WORDS) { if (rx.test(t)) { if (req.use !== use) { req.use = use; set('use', 'Type of use', use); } break; } }

  // seats / team size
  let m = t.match(/(\d{1,4})\s*(seats?|desks?|people|persons?|employees|staff|member team|workstations?)\b/) || t.match(/team of (\d{1,4})/);
  if (m) { req.seats = +m[1]; set('size', 'Seats', req.seats + ' seats'); }

  // size: ranges and single values with units
  const k = (s) => { s = String(s).replace(/,/g, ''); return /k$/.test(s) ? parseFloat(s) * 1000 : parseFloat(s); };
  const SQ = '(?:sq\\.?\\s?ft|sqft|sft|sq\\.?\\s?feet|square\\s?f(?:ee|oo)?t|sf|ft2|वर्ग फुट|ବର୍ଗଫୁଟ)';
  m = t.match(new RegExp('(\\d[\\d,]*(?:\\.\\d+)?k?)\\s*(?:-|–|to|and)\\s*(\\d[\\d,]*(?:\\.\\d+)?k?)\\s*' + SQ));
  if (m) { req.sizeMin = k(m[1]); req.sizeMax = k(m[2]); if (req.sizeMin > req.sizeMax) [req.sizeMin, req.sizeMax] = [req.sizeMax, req.sizeMin]; set('size', 'Size', LC.fmtNum(req.sizeMin) + '–' + LC.fmtNum(req.sizeMax) + ' sq ft'); }
  else if ((m = t.match(new RegExp('(?:around|about|approx\\.?|~|min(?:imum)?|at least|upto|up to|max(?:imum)?)?\\s*(\\d[\\d,]*(?:\\.\\d+)?k?)\\s*\\+?\\s*' + SQ)))) {
    const v = k(m[1]); const pre = m[0];
    if (/min|at least|\+/.test(pre)) { req.sizeMin = v; req.sizeMax = Math.round(v * 1.3); }
    else if (/upto|up to|max/.test(pre)) { req.sizeMax = v; req.sizeMin = Math.round(v * 0.7); }
    else { req.sizeMin = Math.round(v * 0.85); req.sizeMax = Math.round(v * 1.15); }
    set('size', 'Size', 'about ' + LC.fmtNum(v) + ' sq ft');
  } else if (ctx.expect === 'size' && (m = t.match(/^\D*(\d[\d,]*k?)\s*(?:-|–|to)?\s*(\d[\d,]*k?)?\D*$/))) {
    const a = k(m[1]), b = m[2] ? k(m[2]) : null;
    if (a >= 100) { if (b) { req.sizeMin = Math.min(a, b); req.sizeMax = Math.max(a, b); } else { req.sizeMin = Math.round(a * .85); req.sizeMax = Math.round(a * 1.15); } set('size', 'Size', b ? LC.fmtNum(req.sizeMin) + '–' + LC.fmtNum(req.sizeMax) + ' sq ft' : 'about ' + LC.fmtNum(a) + ' sq ft'); }
    else if (a > 0 && a < 100) { req.seats = a; set('size', 'Seats', a + ' seats'); }
  }

  // budget: per sq ft, lakh, thousand, plain rupees
  const bctx = /(budget|rent|afford|pay|kiraya|किराया|ଭଡା|per month|monthly|\/month|a month|p\.?m\.?|maintenance|all.?in|lakh|lac|₹|rs\.?|inr|k\b|thousand|hazar|हजार)/.test(t) || ctx.expect === 'budget';
  m = t.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:\/-)?\s*(?:per|\/|a|psf|rs\/)\s*(?:sq\.?\s?ft|sqft|sft|square f\w+)/) || t.match(/(\d+(?:\.\d+)?)\s*psf\b/);
  if (m) { req.budgetPsf = +m[1]; req.budgetMonthly = null; set('budget', 'Budget', '₹' + req.budgetPsf + ' per sq ft all-in'); }
  else if (bctx) {
    let monthly = null;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:lakh|lakhs|lac|lacs|l\b|लाख|ଲକ୍ଷ)/))) monthly = (+(m[2] || m[1])) * 1e5;
    else if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:k|thousand|hazar|hazaar|हजार|ହଜାର)\b/))) monthly = +m[1] * 1000;
    else if ((m = t.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]{3,})/) || t.match(/(\d{1,3}(?:,\d{2,3})+|\d{5,8})(?![\d,]*\s*(?:sq|sft|sqft|square|feet|ft\b|seats?|desks?))\s*(?:\/-)?\s*(?:per month|a month|monthly|\/month|pm|p\.m\.)?/))) {
      const v = +String(m[1]).replace(/,/g, ''); if (v >= 5000) monthly = v;
    } else if (ctx.expect === 'budget' && (m = t.match(/^\D*(\d{2,3})\D*$/))) { req.budgetPsf = +m[1]; req.budgetMonthly = null; set('budget', 'Budget', '₹' + req.budgetPsf + ' per sq ft all-in'); }
    if (monthly) { req.budgetMonthly = monthly; req.budgetPsf = null; set('budget', 'Budget', LC.fmtLakh(monthly) + ' a month all-in'); }
  }

  // location: localities, landmarks, cities
  const locs = [];
  for (const [name, L] of Object.entries(LC.LOCALITIES)) { if (L.aliases.some(a => new RegExp('\\b' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(t))) locs.push(name); }
  if (locs.length) { req.localities = Array.from(new Set(locs)); req.city = LC.LOCALITIES[locs[0]].city.split(' (')[0]; set('location', 'Area', req.localities.join(', ')); }
  else {
    for (const [city, al] of Object.entries(LC.CITIES)) if (al.some(a => t.includes(a))) { req.city = city; set('location', 'City', city); break; }
    if (/airport/.test(t)) { req.landmark = { name: 'Biju Patnaik Airport', lat: 20.2444, lng: 85.8178 }; req.city = req.city || 'Bhubaneswar'; set('location', 'Landmark', 'near the airport'); }
    if (/(railway station|station)/.test(t) && !req.landmark) { const c = req.city || 'Bhubaneswar'; const L = { Bhubaneswar: [20.2672, 85.8436], Cuttack: [20.4655, 85.879], Puri: [19.8175, 85.8325], Jatni: [20.165, 85.707] }[c] || [20.2672, 85.8436]; req.landmark = { name: c + ' railway station', lat: L[0], lng: L[1] }; set('location', 'Landmark', 'near ' + c + ' railway station'); }
    if (/(temple|mandir)/.test(t) && (req.city === 'Puri' || /puri/.test(t))) { req.landmark = { name: 'Jagannath Temple, Puri', lat: 19.8048, lng: 85.818 }; req.city = 'Puri'; set('location', 'Landmark', 'near the temple, Puri'); }
    if (/(highway|nh-?16|national highway)/.test(t)) { req.mustHave = Array.from(new Set([...(req.mustHave || []), 'Main road facing'])); set('location', 'Frontage', 'highway or main road'); }
  }
  if ((m = t.match(/within (\d+(?:\.\d+)?)\s*(?:km|kms|kilomet)/))) { req.radiusKm = +m[1]; set('location', 'Radius', 'within ' + req.radiusKm + ' km'); }

  // move-in
  const td = LC.today();
  if (/\b(immediate(ly)?|asap|urgent(ly)?|right away|this week|ready to move|abhi|turant|तुरंत|ଏବେ)\b/.test(t)) { req.moveIn = LC.iso(LC.addDays(td, 10)); set('moveIn', 'Move-in', 'within 10 days'); }
  else if (/next month/.test(t)) { const d = new Date(td.getFullYear(), td.getMonth() + 1, 1); req.moveIn = LC.iso(d); set('moveIn', 'Move-in', 'by ' + LC.fmtDate(d)); }
  else if ((m = t.match(/(?:in|within|after)\s*(\d+)\s*(days?|weeks?|months?)/))) { const n = +m[1]; const d = LC.addDays(td, /day/.test(m[2]) ? n : /week/.test(m[2]) ? n * 7 : n * 30); req.moveIn = LC.iso(d); set('moveIn', 'Move-in', 'by ' + LC.fmtDate(d)); }
  else if ((m = t.match(new RegExp('(\\d{1,2})?\\s*(?:st|nd|rd|th)?\\s*(?:of\\s*)?' + MONTHS_RX.source)))) {
    const mi = MIDX[m[2].slice(0, 3)]; let y = td.getFullYear(); if (mi < td.getMonth() || (mi === td.getMonth() && m[1] && +m[1] < td.getDate())) y++;
    const d = new Date(y, mi, m[1] ? +m[1] : 1); req.moveIn = LC.iso(d); set('moveIn', 'Move-in', 'by ' + LC.fmtDate(d));
  } else if (/(no hurry|flexible|not urgent|later this year|next year)/.test(t)) { req.moveIn = LC.iso(LC.addDays(td, /next year/.test(t) ? 120 : 75)); set('moveIn', 'Move-in', 'flexible (about ' + LC.fmtDate(req.moveIn) + ')'); }

  // furnishing / fit-out
  if (/(plug.?(and|&|n).?play|ready.?to.?(use|move)|fully furnished|furnished office|ready office)/.test(t)) { req.furnishing = 'Plug-and-play'; set('furnishing', 'Fit-out', 'Plug-and-play'); }
  else if (/semi.?furnished/.test(t)) { req.furnishing = 'Semi-furnished'; set('furnishing', 'Fit-out', 'Semi-furnished'); }
  else if (/warm.?shell/.test(t)) { req.furnishing = 'Warm shell'; set('furnishing', 'Fit-out', 'Warm shell'); }
  else if (/(bare.?shell|unfurnished|own (interior|fit.?out)|do (the|our own) (interior|fit.?out)|we will do interiors?|raw space)/.test(t)) { req.furnishing = 'Bare shell'; set('furnishing', 'Fit-out', 'Bare shell (own interiors)'); }
  else if (ctx.expect === 'furnishing' && /(no|own|ourselves|we will)/.test(t)) { req.furnishing = 'Bare shell'; set('furnishing', 'Fit-out', 'Bare shell (own interiors)'); }
  else if (ctx.expect === 'furnishing' && /(yes|ready|haan|ha\b|ହଁ)/.test(t)) { req.furnishing = 'Plug-and-play'; set('furnishing', 'Fit-out', 'Plug-and-play'); }

  // parking
  if ((m = t.match(/(\d+)\s*(?:car\s*)?(?:parking|parks?|car spaces?|cars)\b/))) { req.parking4w = +m[1]; set('parking4w', 'Parking', m[1] + ' car parks'); }
  else if (/(no parking|parking not (needed|required)|don'?t need parking)/.test(t)) { req.parking4w = 0; set('parking4w', 'Parking', 'none'); }
  else if (ctx.expect === 'parking4w' && (m = t.match(/^\D*(\d{1,2})\D*$/))) { req.parking4w = +m[1]; set('parking4w', 'Parking', m[1] + ' car parks'); }
  else if (ctx.expect === 'parking4w' && /(no|none|nahi|ନାହିଁ|zero)/.test(t)) { req.parking4w = 0; set('parking4w', 'Parking', 'none'); }
  else if (/\bparking\b/.test(t) && req.parking4w == null) { req.parking4w = 1; set('parking4w', 'Parking', 'needed (count to confirm)'); }

  // specs
  if (/(power back.?up|dg back.?up|generator|100% back.?up|power cut)/.test(t)) { req.powerBackup = '100%'; set('specs', 'Power backup', '100% needed'); }
  if (/ground floor/.test(t)) { req.groundFloor = true; set('specs', 'Floor', 'ground floor'); }
  if ((m = t.match(/(\d{2,3})\s*(?:ft|feet)\s*(?:of\s*)?frontage/) || t.match(/frontage (?:of )?(\d{2,3})/))) { req.frontageMin = +m[1]; set('specs', 'Frontage', m[1] + ' ft'); }
  if ((m = t.match(/(\d{2})\s*(?:ft|feet)\s*(?:clear\s*)?height/))) { req.clearHeightMin = +m[1]; set('specs', 'Clear height', m[1] + ' ft'); }
  if (/(main road|road.?facing|highway facing)/.test(t)) { req.mustHave = Array.from(new Set([...(req.mustHave || []), 'Main road facing'])); set('specs', 'Must have', 'Main road facing'); }
  if (/\blift|elevator\b/.test(t)) { req.mustHave = Array.from(new Set([...(req.mustHave || []), 'Lift'])); set('specs', 'Must have', 'Lift'); }
  if (/fire noc/.test(t)) { req.mustHave = Array.from(new Set([...(req.mustHave || []), 'Fire NOC'])); set('specs', 'Must have', 'Fire NOC'); }
  if (/loading dock/.test(t)) { req.mustHave = Array.from(new Set([...(req.mustHave || []), 'Loading dock'])); set('specs', 'Must have', 'Loading dock'); }
  if ((m = t.match(/(\d+)\s*(?:-|to)?\s*(?:year|yr)s?\s*(?:lease|term|agreement)/))) { req.leaseYears = +m[1]; set('specs', 'Lease term', m[1] + ' years'); }

  // who
  if ((m = raw.match(/(?:[Ii] am|[Ii]'m|[Tt]his is|[Mm]y name is|[Nn]aam)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/))) { req.contactName = m[1]; set('who', 'Contact', m[1]); }
  if ((m = raw.match(/\b(?:from|at|with|company[:\s]+)\s+([A-Z][\w&.]*(?:\s+[A-Z][\w&.]*){0,3}(?:\s+(?:Pvt|Private|Ltd|LLP|Limited|Services|Labs|Clinic|Cafe|Traders|Logistics))*)/))) {
    const c = m[1].trim().replace(/[.,;:]+$/, ''); if (!LC.LOCALITIES[c] && !Object.keys(LC.CITIES).includes(c) && c.length > 2) { req.company = c; set('who', 'Company', c); }
  }

  // conversation intents (used by the agent's handoff rules)
  const intents = {
    negotiate: /(negotia|discount|reduce (the )?rent|lower (the )?rent|best price|final price|kam karo|kam kariye|कम|last price|can you do|too (high|expensive)|bargain|ମୂଲ୍ୟ କମ)/.test(t),
    legal: /(agreement|registration|stamp duty|legal|lawyer|gst (input|invoice)|tds|lease deed|notari[sz]|clause|indemnity|title deed)/.test(t),
    complaint: /(complain|worst|fraud|cheat|scam|angry|pathetic|useless|harass|stop messaging|spam|bakwas|ଖରାପ)/.test(t),
    human: /(talk to (a |an )?(person|human|agent|someone|manager)|call me|speak to|real person|not a bot|are you a bot|phone call|baat karo|call karo|କଲ କରନ୍ତୁ)/.test(t),
    notInterested: /(not interested|found (a|another|one)|already (taken|found|rented)|no longer|cancel)/.test(t),
    stop: /^(stop|unsubscribe)\b/.test(t),
    yes: /^(yes|yeah|yep|ok|okay|sure|haan|ha|ji|ହଁ|हाँ|done|fine|confirm)\b/.test(t),
    no: /^(no|nope|nahi|na|ନା|नहीं)\b/.test(t),
    greeting: /^(hi|hello|hey|namaste|namaskar|good (morning|evening|afternoon)|ନମସ୍କାର|नमस्ते)\b/.test(t),
  };
  return { req, found, missing: LC.reqMissing(req), intents, text: raw };
};

/* ---------------- match engine (ported from our US renter match) ----------------
   Same three rules as the renter match:
   1. Must-haves are hard filters. A field we don't know never passes a must-have.
   2. Flagged units are never sent automatically (a person checks them first).
   3. Rank what passes; show near misses separately with exactly what they miss.
   Commercial factors replace the residential ones (beds/rent/safety/commute). */
LC.MATCH_FACTORS = [
  { key: 'budget', label: 'All-in cost', weight: 30, def: 'Rent + maintenance per sq ft against the stated budget. 100 at or under budget, falls 5 points per 1% over, 0 at 20% over.' },
  { key: 'size', label: 'Size', weight: 20, def: 'Chargeable area against the requested range. 100 inside the range, falls 3 points per 1% outside it.' },
  { key: 'location', label: 'Location', weight: 20, def: '100 in a requested locality or within 1 km of the requested landmark, falling to 0 at 1.5x the search radius. City-only requests score 70 for any unit in that city.' },
  { key: 'ready', label: 'Ready by move-in', weight: 15, def: 'Date the occupier can trade (available date plus fit-out weeks to reach the condition they need) against their move-in date. 100 on time, minus 2 points per day late.' },
  { key: 'specs', label: 'Specs', weight: 10, def: 'Share of these the unit has: requested parking, 100% power backup, lift (upper floors), fire NOC, occupancy certificate.' },
  { key: 'fresh', label: 'Data freshness', weight: 5, def: '100 if the owner confirmed in the last 3 days, 80 within 7, 50 within 14.' },
];
LC.MATCH_RULES = [
  { key: 'status', label: 'Not available', def: 'Status is not Available (under negotiation, LOI signed or leased).' },
  { key: 'stale', label: 'Not confirmed in 14 days', def: 'Owner has not confirmed availability and terms in the last 14 days.' },
  { key: 'use', label: 'Use not permitted', def: 'The building does not allow this type of use.' },
  { key: 'size', label: 'Size out of range', def: 'Chargeable area more than 20% outside the requested range.' },
  { key: 'budget', label: 'Over budget', def: 'All-in cost per sq ft more than 10% over the budget.' },
  { key: 'location', label: 'Outside the area', def: 'Not in the requested localities and further than the search radius from them.' },
  { key: 'specs', label: 'Missing a must-have', def: 'Lacks a stated must-have: parking count, 100% backup, ground floor, frontage, clear height or a named amenity.' },
  { key: 'ready', label: 'Not ready in time', def: 'Cannot be ready more than 45 days after the move-in date.' },
  { key: 'flag', label: 'Flagged for checking', def: 'Unit carries a data flag (for example, fire NOC not on file for food, clinic or education use). Never sent automatically.' },
];
LC.defaultRadius = (req) => req.radiusKm || (['Warehouse', 'Industrial'].includes(req.use) ? 10 : 3);

/**
 * @param {object} req requirement (see LC.emptyReq)
 * @param {object} opt { units?: array (default all), limit?: number }
 * @returns {{exact:[Result], close:[Result], excluded:{[ruleKey]:number}, considered:number}}
 *   Result = { u, score:0-100, factors:[{key,label,score,weight,note}], missed:[{key,label,note}], why:string }
 */
LC.match = (req, opt = {}) => {
  const units = opt.units || LC.state.units;
  const band = LC.reqSizeBand(req); const bud = LC.reqBudgetPsf(req);
  const radius = LC.defaultRadius(req);
  const centers = req.localities.length ? req.localities.map(n => ({ name: n, ...LC.LOCALITIES[n] })) : req.landmark ? [{ name: req.landmark.name, lat: req.landmark.lat, lng: req.landmark.lng }] : [];
  const moveIn = req.moveIn ? LC.parseDate(req.moveIn) : null;
  const exact = [], close = [], excluded = {};
  const bump = (k) => excluded[k] = (excluded[k] || 0) + 1;
  units.forEach(u => {
    if (u.status !== 'Available') return bump('status');
    if (LC.unitFreshness(u).days > LC.settings().freshnessDays) return bump('stale');
    if (!LC.useAllowed(u, req.use)) return bump('use');
    const miss = []; const F = {};
    // size
    if (band) {
      const [a, b] = band; const s = u.chargeable_sqft;
      const off = s < a ? (a - s) / a : s > b ? (s - b) / b : 0;
      F.size = { score: LC.clamp(Math.round(100 - off * 300), 0, 100), note: LC.fmtNum(s) + ' sq ft vs ' + LC.fmtNum(a) + '–' + LC.fmtNum(b) };
      if (off > 0.20) miss.push({ key: 'size', label: 'Size out of range', note: F.size.note });
    } else F.size = { score: 70, note: 'No size given' };
    // budget
    if (bud) {
      const over = (u.all_in_per_sqft - bud) / bud;
      F.budget = { score: over <= 0 ? 100 : LC.clamp(Math.round(100 - over * 500), 0, 100), note: '₹' + u.all_in_per_sqft + ' vs ₹' + bud + '/sq ft all-in' };
      if (over > 0.10) miss.push({ key: 'budget', label: 'Over budget', note: Math.round(over * 100) + '% over (' + F.budget.note + ')' });
    } else F.budget = { score: 70, note: 'No budget given' };
    // location
    if (centers.length) {
      const inLoc = req.localities.includes(u.locality);
      const d = Math.min(...centers.map(c => LC.dist(u.lat, u.lng, c.lat, c.lng)));
      F.location = { score: inLoc || d <= 1 ? 100 : LC.clamp(Math.round(100 - (d - 1) / (radius * 1.5 - 1) * 100), 0, 100), note: inLoc ? 'In ' + u.locality : d.toFixed(1) + ' km from ' + centers.sort((x, y) => LC.dist(u.lat, u.lng, x.lat, x.lng) - LC.dist(u.lat, u.lng, y.lat, y.lng))[0].name, km: d };
      if (!inLoc && d > radius) miss.push({ key: 'location', label: 'Outside the area', note: F.location.note });
    } else if (req.city) {
      const inCity = LC.cityOf(u) === req.city;
      F.location = { score: inCity ? 70 : 0, note: inCity ? 'In ' + req.city : 'Outside ' + req.city };
      if (!inCity) miss.push({ key: 'location', label: 'Outside the area', note: F.location.note });
    } else F.location = { score: 60, note: 'No area given' };
    // ready by move-in
    const ready = LC.readyDate(u, req.furnishing);
    if (moveIn) {
      const late = LC.daysBetween(moveIn, ready);
      F.ready = { score: late <= 0 ? 100 : LC.clamp(100 - late * 2, 0, 100), note: late <= 0 ? 'Ready by ' + LC.fmtDate(ready) : late + ' days after move-in (' + LC.fmtDate(ready) + ')' };
      if (late > 45) miss.push({ key: 'ready', label: 'Not ready in time', note: F.ready.note });
    } else F.ready = { score: 80, note: 'Ready ' + LC.fmtDate(ready) };
    // must-have specs (unknown never passes)
    const specMiss = [];
    if (req.parking4w && !(u.parking_4w >= req.parking4w)) specMiss.push(req.parking4w + ' car parks (has ' + (u.parking_4w ?? 'unknown') + ')');
    if (req.powerBackup === '100%' && u.power_backup !== '100%') specMiss.push('100% power backup (has ' + (u.power_backup || 'unknown') + ')');
    if (req.groundFloor && u.floor !== 0) specMiss.push('ground floor (is floor ' + u.floor + ')');
    if (req.frontageMin && !(u.frontage_ft >= req.frontageMin)) specMiss.push(req.frontageMin + ' ft frontage (has ' + (u.frontage_ft ? u.frontage_ft + ' ft' : 'unknown') + ')');
    if (req.clearHeightMin && !(u.clear_height_ft >= req.clearHeightMin)) specMiss.push(req.clearHeightMin + ' ft clear height (has ' + (u.clear_height_ft ? u.clear_height_ft + ' ft' : 'unknown') + ')');
    (req.mustHave || []).forEach(a => { if (!u.amenities.includes(a)) specMiss.push(a); });
    if (specMiss.length) miss.push({ key: 'specs', label: 'Missing a must-have', note: specMiss.join('; ') });
    const checks = [req.parking4w ? u.parking_4w >= req.parking4w : u.parking_4w > 0, u.power_backup === '100%', u.floor === 0 || u.amenities.includes('Lift'), u.fire_noc === 'Yes', u.occupancy_certificate === 'Yes'];
    F.specs = { score: Math.round(checks.filter(Boolean).length / checks.length * 100), note: checks.filter(Boolean).length + ' of 5 checks' };
    const fd = LC.unitFreshness(u).days;
    F.fresh = { score: fd <= 3 ? 100 : fd <= 7 ? 80 : 50, note: LC.unitFreshness(u).label };
    if (u.data_flag) miss.push({ key: 'flag', label: 'Flagged for checking', note: u.data_flag });
    const factors = LC.MATCH_FACTORS.map(f => ({ key: f.key, label: f.label, weight: f.weight, score: F[f.key].score, note: F[f.key].note }));
    const score = Math.round(LC.sum(factors, f => f.score * f.weight) / 100);
    const res = { u, score, factors, missed: miss, km: F.location.km };
    const best = factors.filter(f => f.score >= 90).map(f => f.label.toLowerCase());
    res.why = miss.length ? 'Misses: ' + miss.map(m => m.label.toLowerCase()).join(', ') : (best.length ? 'Strong on ' + best.slice(0, 3).join(', ') : 'Passes every must-have');
    if (!miss.length) exact.push(res);
    else if (miss.length === 1) { close.push(res); bump(miss[0].key); }
    else bump(miss[0].key);
  });
  const rank = (a, b) => b.score - a.score || a.u.all_in_per_sqft - b.u.all_in_per_sqft || LC.unitFreshness(a.u).days - LC.unitFreshness(b.u).days;
  exact.sort(rank); close.sort(rank);
  const lim = opt.limit || 99;
  return { exact: exact.slice(0, lim), close: close.slice(0, lim), excluded, considered: units.length, exactCount: exact.length, closeCount: close.length };
};

/* ---------------- state ---------------- */
const DEFAULT_SETTINGS = () => ({
  freshnessDays: 14,
  slaMinutes: 15,
  staffedHours: [9, 20],
  nudgeHours: [24, 72],
  largeDealSqft: 5000,
  largeDealMonthly: 500000,
  minMatchScore: 60,
  maxQuestions: 8,
  handoffRules: [
    { id: 'H1', name: 'Price negotiation', trigger: 'Occupier asks for a discount, a lower rent or a final price.', action: 'Hand to the area agent. AI stops replying on price.', on: true },
    { id: 'H2', name: 'Legal or agreement terms', trigger: 'Questions on the agreement, registration, stamp duty, GST invoices, TDS or clauses.', action: 'Hand to the area agent.', on: true },
    { id: 'H3', name: 'Complaint or upset occupier', trigger: 'Complaint, abuse or frustration words.', action: 'Hand to the senior manager, priority.', on: true },
    { id: 'H4', name: 'Asks for a person', trigger: '"Call me", "talk to someone", "are you a bot".', action: 'Hand to the area agent for a call within the SLA.', on: true },
    { id: 'H5', name: 'Large deal', trigger: 'Requirement above 5,000 sq ft or above ₹5 lakh a month all-in.', action: 'Senior manager takes over after qualification.', on: true },
    { id: 'H6', name: 'No good match', trigger: 'Best match scores under 60, or no unit passes the must-haves.', action: 'Agent looks for off-market or upcoming units.', on: true },
    { id: 'H7', name: 'Agent not understood twice', trigger: 'Two replies in a row the agent cannot read.', action: 'Hand to the area agent.', on: true },
    { id: 'H8', name: 'Visit booked', trigger: 'A site visit is booked.', action: 'Person calls the day before to confirm. AI keeps the chat open.', on: true },
    { id: 'H9', name: 'Existing client', trigger: 'Phone number already belongs to an open client.', action: 'Route to the client\'s current agent; no new lead created.', on: true },
  ],
});
LC.settings = () => LC.state.settings;

LC.state = null;
LC.initState = () => {
  _seed = 20261010;
  LC.state = {
    units: LC.loadInventory(),
    leads: [],          // live conversations (lead inbox)
    clients: [],        // CRM records
    visits: [],
    tasks: [],
    queue: [],          // human handoff queue
    activity: [],       // global feed {ts, text, kind, clientId?, leadId?, unitId?}
    audit: [],          // unit term changes {ts, unitId, field, from, to, by}
    consent: [],        // DPDP consent log {ts, phone, name, channel, text}
    syncLog: [],        // inventory sync runs
    shortlist: [],      // unit ids starred by the current user
    compare: [],        // unit ids in compare tray (max 4)
    settings: DEFAULT_SETTINGS(),
    me: 'Rohit Mohanty',
  };
  LC.seedHistory();
  if (LC.session && LC.session.role !== 'owner') LC.state.me = LC.session.name;
  LC.emit('state:ready');
};

LC.log = (text, extra = {}) => { LC.state.activity.unshift({ ts: Date.now(), text, ...extra }); if (LC.state.activity.length > 400) LC.state.activity.length = 400; };

/* ---------------- CRM API ---------------- */
LC.crm = {
  get: (id) => LC.state.clients.find(c => c.id === id),
  findByPhone: (phone) => LC.state.clients.find(c => c.phone === phone && !['Lost', 'Signed lease'].includes(c.stage)),
  /** create a client. fields: name, company, phone, source, language, req, agent, stage */
  add(f) {
    const c = {
      id: LC.uid('cl'), name: f.name || 'Unknown', company: f.company || '', phone: f.phone || '', email: f.email || '',
      source: f.source || 'Website form', language: f.language || 'English', agent: f.agent || LC.crm.assignAgent(f.req, f.language),
      stage: f.stage || 'New enquiry', createdAt: f.createdAt || Date.now(), updatedAt: f.createdAt || Date.now(),
      req: f.req || LC.emptyReq(), reqHistory: [], stageHistory: [{ stage: f.stage || 'New enquiry', ts: f.createdAt || Date.now(), by: f.by || 'AI agent' }],
      shared: [], timeline: [], notes: f.notes || '', nextFollowUp: f.nextFollowUp || null, lostReason: null, leadId: f.leadId || null,
      dealValueMonthly: null, achievedPsf: null, unitId: null, tags: f.tags || [], consent: f.consent !== false,
    };
    c.timeline.push({ ts: c.createdAt, type: 'created', text: 'Enquiry from ' + c.source + (c.language !== 'English' ? ' (' + c.language + ')' : ''), by: f.by || 'AI agent' });
    LC.state.clients.unshift(c);
    LC.emit('clients:changed'); return c;
  },
  update(id, patch, by = LC.state.me) {
    const c = LC.crm.get(id); if (!c) return;
    Object.assign(c, patch); c.updatedAt = Date.now(); LC.emit('client:updated', id); LC.emit('clients:changed'); return c;
  },
  /** replace requirement and record what changed (requirement history) */
  setReq(id, req, by = LC.state.me, why = '') {
    const c = LC.crm.get(id); if (!c) return;
    const before = LC.reqSummary(c.req), after = LC.reqSummary(req);
    if (before !== after) {
      c.reqHistory.unshift({ ts: Date.now(), from: JSON.parse(JSON.stringify(c.req)), to: JSON.parse(JSON.stringify(req)), by, why });
      c.timeline.unshift({ ts: Date.now(), type: 'requirement', text: 'Requirement updated: ' + after, by });
    }
    c.req = JSON.parse(JSON.stringify(req)); c.updatedAt = Date.now();
    if (c.stage === 'New enquiry' && LC.reqIsQualified(c.req)) LC.crm.moveStage(id, 'Qualified', by);
    LC.emit('client:updated', id); LC.emit('clients:changed'); return c;
  },
  moveStage(id, stage, by = LC.state.me, note = '') {
    const c = LC.crm.get(id); if (!c || c.stage === stage) return c;
    c.stageHistory.push({ stage, ts: Date.now(), by, note }); c.stage = stage; c.updatedAt = Date.now();
    c.timeline.unshift({ ts: Date.now(), type: 'stage', text: 'Moved to ' + stage + (note ? ': ' + note : ''), by });
    LC.log((c.company || c.name) + ' moved to ' + stage, { clientId: id, kind: 'stage' });
    LC.emit('client:updated', id); LC.emit('clients:changed'); return c;
  },
  addActivity(id, type, text, by = LC.state.me, extra = {}) {
    const c = LC.crm.get(id); if (!c) return;
    c.timeline.unshift({ ts: Date.now(), type, text, by, ...extra }); c.updatedAt = Date.now();
    LC.emit('client:updated', id); return c;
  },
  share(id, unitIds, by = LC.state.me, channel = 'WhatsApp') {
    const c = LC.crm.get(id); if (!c) return;
    unitIds.forEach(u => { if (!c.shared.find(s => s.unitId === u)) c.shared.push({ unitId: u, ts: Date.now(), by, channel, reaction: null }); });
    c.timeline.unshift({ ts: Date.now(), type: 'shared', text: 'Shared ' + unitIds.join(', ') + ' on ' + channel, by }); c.updatedAt = Date.now();
    LC.emit('client:updated', id); return c;
  },
  /** route new work: area agent who speaks the language, least open clients; senior for large deals */
  assignAgent(req, language) {
    const city = req && (req.city || (req.localities && req.localities[0] && LC.LOCALITIES[req.localities[0]].city.split(' (')[0])) || 'Bhubaneswar';
    let pool = LC.TEAM.filter(t => t.cities.includes(city)); if (!pool.length) pool = LC.TEAM;
    if (language) { const p2 = pool.filter(t => t.langs.includes(language)); if (p2.length) pool = p2; }
    const load = (t) => (LC.state ? LC.state.clients.filter(c => c.agent === t.name && !['Lost', 'Signed lease', 'Nurture'].includes(c.stage)).length : 0);
    return pool.sort((a, b) => load(a) - load(b))[0].name;
  },
};

/* ---------------- visits & tasks ---------------- */
LC.visits = {
  get: (id) => LC.state.visits.find(v => v.id === id),
  /** book a site visit; also creates the day-before confirmation call task (handoff rule H8) */
  book({ clientId, unitId, when, by = 'AI agent', leadId = null }) {
    const c = LC.crm.get(clientId);
    const v = { id: LC.uid('vis'), clientId, unitId, when: +when, by, leadId, status: 'Booked', confirmation: 'Pending', agent: c ? c.agent : LC.state.me, feedback: '', rating: null, createdAt: Date.now() };
    LC.state.visits.push(v);
    const callAt = Math.max(Date.now() + 5 * 60e3, +when - DAY);
    LC.tasks.add({ type: 'Confirm visit', title: 'Call to confirm visit: ' + (c ? (c.company || c.name) : '') + ' at ' + unitId, due: callAt, clientId, visitId: v.id, assignee: v.agent, priority: 'High' });
    if (c) { LC.crm.addActivity(clientId, 'visit', 'Site visit booked at ' + unitId + ' for ' + LC.fmtDT(when), by); }
    LC.log('Visit booked: ' + unitId + ' on ' + LC.fmtDT(when), { clientId, unitId, kind: 'visit' });
    LC.emit('visits:changed'); return v;
  },
  update(id, patch, by = LC.state.me) {
    const v = LC.visits.get(id); if (!v) return; Object.assign(v, patch);
    if (patch.status === 'Done') {
      const c = LC.crm.get(v.clientId);
      if (c) { LC.crm.addActivity(c.id, 'visit', 'Visited ' + v.unitId + (v.feedback ? ': "' + v.feedback + '"' : ''), by); if (LC.STAGES.indexOf(c.stage) < 2) LC.crm.moveStage(c.id, 'Site visit', by); }
    }
    if (patch.confirmation === 'Confirmed') LC.state.tasks.filter(t => t.visitId === id && !t.done).forEach(t => { t.done = true; t.doneAt = Date.now(); });
    LC.emit('visits:changed'); LC.emit('tasks:changed'); return v;
  },
  /** free slots for a unit over the next n days (10:00–18:00, hourly, skipping booked) */
  slots(unitId, days = 4) {
    const out = []; const taken = new Set(LC.state.visits.filter(v => v.unitId === unitId).map(v => v.when));
    for (let d = 1; d <= days; d++) { const day = LC.addDays(LC.today(), d); if (day.getDay() === 0) continue; [11, 15, 17].forEach(h => { const ts = +day + h * 36e5; if (!taken.has(ts)) out.push(ts); }); }
    return out.slice(0, 4);
  },
};
LC.tasks = {
  add(t) { const x = { id: LC.uid('task'), done: false, createdAt: Date.now(), priority: 'Normal', ...t }; LC.state.tasks.push(x); LC.emit('tasks:changed'); return x; },
  complete(id) { const t = LC.state.tasks.find(x => x.id === id); if (t) { t.done = true; t.doneAt = Date.now(); LC.emit('tasks:changed'); } },
  open: () => LC.state.tasks.filter(t => !t.done).sort((a, b) => a.due - b.due),
};
/* ---------------- human handoff queue ---------------- */
LC.queue = {
  add({ leadId, clientId, rule, reason, priority = 'Normal', assignee }) {
    const s = LC.settings(); const r = s.handoffRules.find(h => h.id === rule);
    const q = { id: LC.uid('q'), leadId, clientId, rule, ruleName: r ? r.name : rule, reason, priority, assignee, at: Date.now(), slaDue: Date.now() + s.slaMinutes * 60e3, status: 'Waiting' };
    LC.state.queue.unshift(q); LC.log('Handoff (' + q.ruleName + '): ' + reason, { leadId, clientId, kind: 'handoff' });
    LC.emit('queue:changed'); return q;
  },
  resolve(id, by = LC.state.me) { const q = LC.state.queue.find(x => x.id === id); if (q) { q.status = 'Picked up'; q.pickedAt = Date.now(); q.by = by; LC.emit('queue:changed'); } },
  waiting: () => LC.state.queue.filter(q => q.status === 'Waiting'),
};

/* ---------------- seeded history (CRM, visits, tasks) ---------------- */
const FIRST = ['Amit', 'Sourav', 'Priya', 'Rakesh', 'Sneha', 'Bibhuti', 'Ipsita', 'Manas', 'Pooja', 'Sujit', 'Ritika', 'Deepak', 'Smita', 'Ashish', 'Lopamudra', 'Nihar', 'Anjali', 'Prakash', 'Swati', 'Biswajit', 'Tapas', 'Madhusmita', 'Rahul', 'Sasmita', 'Kunal', 'Itishree', 'Saroj', 'Neha', 'Bijay', 'Sonali'];
const LAST = ['Mohapatra', 'Sahoo', 'Das', 'Mishra', 'Panda', 'Behera', 'Nayak', 'Rath', 'Jena', 'Pradhan', 'Swain', 'Rout', 'Patnaik', 'Acharya', 'Dash', 'Agarwal', 'Sethi', 'Barik', 'Samal', 'Parida'];
const COMPANIES = {
  Office: ['Finlogic IT Services', 'Zenith BPO Solutions', 'Infinity Software Labs', 'Apex Insurance Branch', 'Pixel Forge Studios', 'Northstar Consulting', 'Kalinga Pharma Distributors', 'Coastline Shipping Agency', 'Prime Cooperative Bank', 'Deltaware Analytics'],
  Coworking: ['Launchpad Startups', 'Codecraft Labs', 'Bluefin Digital'],
  Retail: ['Wellness Pharmacy', 'MobileHub', 'Sunshine Opticals', 'QuickMart Grocery', 'Utkal Handloom House', 'Silver Thread Boutique', 'Temple Town Souvenirs', 'Glow Salon'],
  Showroom: ['Trident Motors', 'HomeNest Furniture', 'VoltRide E-bikes', 'Brightline Electronics', 'Granite & Co Tiles'],
  'F&B': ['Brew Street Cafe', 'Saffron Restaurant', 'Tasty Tiffin Cloud Kitchen', 'Sea Breeze Cafe', 'The Dosa Factory'],
  Clinic: ['CarePlus Diagnostics', 'Nova Dental Clinic', 'Lotus Eye Care', 'Healwell Physiotherapy'],
  Institutional: ['Bright Minds Coaching', 'Vidya Tutorials', 'SkillUp Training Academy'],
  Warehouse: ['Swift Logistics', 'Odisha Agro Traders', 'Rapid Courier', 'Greenleaf Organics', 'Coastal Seafood Exports', 'Eastern FMCG Distributors'],
  Industrial: ['Precision Fabricators', 'Kalinga Packaging'],
};
const USE_OF_TYPE = { 'Office': 'Office', 'Coworking': 'Coworking', 'Retail shop': 'Retail', 'Showroom': 'Showroom', 'F&B space': 'F&B', 'Clinic': 'Clinic', 'Institutional': 'Institutional', 'Warehouse': 'Warehouse', 'Industrial shed': 'Industrial' };
LC.USE_OF_TYPE = USE_OF_TYPE;
const FEEDBACK = {
  good: ['Liked the frontage and the road visibility.', 'Layout works, wants to see the floor plan with column positions.', 'Happy with parking. Asked if the owner will do the AC.', 'Good natural light. Will discuss with partners this week.', 'Location is right for their staff. Wants rent-free period of 60 days.'],
  mixed: ['Space is fine but loading is high, carpet feels small.', 'Liked it, but power backup is only partial. Needs 100%.', 'Good unit, but the lock-in of 36 months is too long for them.', 'Wanted ground floor; this is first floor.'],
  bad: ['Too far from their customers. Not interested.', 'Building looks old; lift was not working.', 'Rent too high for this area in their view.'],
};
LC.FEEDBACK = FEEDBACK;
/** Builds a requirement around a unit so seeded clients have realistic matches */
LC.reqAroundUnit = (u, jitter = true) => {
  const r = LC.emptyReq(); r.use = USE_OF_TYPE[u.property_type];
  const s = u.chargeable_sqft; r.sizeMin = Math.round(s * (jitter ? 0.8 + LC.rand() * 0.1 : 0.85) / 50) * 50; r.sizeMax = Math.round(s * (jitter ? 1.1 + LC.rand() * 0.15 : 1.15) / 50) * 50;
  if (u.property_type === 'Coworking') { r.seats = u.seats; r.sizeMin = r.sizeMax = null; }
  r.budgetPsf = Math.round(u.all_in_per_sqft * (jitter ? 0.95 + LC.rand() * 0.15 : 1.05));
  r.localities = [u.locality]; r.city = LC.cityOf(u);
  r.moveIn = LC.iso(LC.addDays(LC.today(), LC.rint(15, 75)));
  r.furnishing = LC.pick(['Bare shell', 'Warm shell', u.furnishing, u.furnishing]);
  r.parking4w = ['Office', 'Showroom', 'Clinic'].includes(u.property_type) ? Math.min(u.parking_4w || 0, LC.rint(0, 4)) : 0;
  if (['Warehouse', 'Industrial shed'].includes(u.property_type)) r.powerBackup = LC.rand() < .3 ? '100%' : null;
  return r;
};
LC.fakePhone = () => '+91 ' + LC.pick(['9', '8', '7']) + LC.rint(100, 999) + LC.rint(10, 99) + ' ' + LC.rint(10000, 99999);

LC.seedHistory = () => {
  const S = LC.state; const units = S.units; const now = Date.now();
  const SOURCE_W = [['99acres', 16], ['Magicbricks', 14], ['Housing.com', 6], ['Website form', 10], ['Meta lead ads', 12], ['Google Ads', 8], ['JustDial', 7], ['Office WhatsApp', 11], ['Phone call (IVR)', 6], ['Referral', 7], ['Walk-in', 3]];
  const wpick = (arr) => { const tot = LC.sum(arr, x => x[1]); let r = LC.rand() * tot; for (const [v, w] of arr) { if ((r -= w) <= 0) return v; } return arr[0][0]; };
  // outcome distribution for ~96 historical clients over the last 70 days
  const OUT = [['Signed lease', 7], ['Letter of intent', 3], ['Proposal', 9], ['Site visit', 15], ['Qualified', 22], ['New enquiry', 8], ['Nurture', 14], ['Lost', 18]];
  const LOST = ['Chose another broker', 'Budget too low for the area', 'Requirement on hold', 'Took a unit directly from owner', 'No response after 3 follow-ups', 'Location did not work'];
  const live = units.filter(u => u.status !== 'Leased');
  for (let i = 0; i < 96; i++) {
    const outcome = wpick(OUT);
    const u = LC.pick(live); const use = USE_OF_TYPE[u.property_type];
    const created = now - LC.rint(outcome === 'New enquiry' ? 0 : 3, outcome === 'New enquiry' ? 2 : 70) * DAY - LC.rint(0, 600) * 60e3;
    const name = LC.pick(FIRST) + ' ' + LC.pick(LAST);
    const company = LC.pick(COMPANIES[use] || COMPANIES.Office);
    const source = wpick(SOURCE_W);
    const language = LC.pick(['English', 'English', 'English', 'Odia', 'Odia', 'Hindi']);
    const req = LC.reqAroundUnit(u);
    const c = LC.crm.add({ name, company, phone: LC.fakePhone(), source, language, req, createdAt: created, stage: 'New enquiry', agent: LC.crm.assignAgent(req, language), by: 'AI agent' });
    c.firstReplySec = LC.rint(18, 55); c.firstHumanMin = source === 'Walk-in' ? 0 : LC.rint(6, 30) + (LC.rand() < .2 ? LC.rint(60, 300) : 0);
    c.timeline = [{ ts: created, type: 'created', text: 'Enquiry from ' + source + (language !== 'English' ? ' (' + language + ')' : ''), by: 'AI agent' }];
    c.stageHistory = [{ stage: 'New enquiry', ts: created, by: 'AI agent' }];
    c.timeline.unshift({ ts: created + c.firstReplySec * 1000, type: 'message', text: 'AI replied on WhatsApp in ' + c.firstReplySec + ' s and started qualifying', by: 'AI agent' });
    let t = created + LC.rint(1, 30) * 60e3; const age = now - created;
    const step = (frac) => { t = Math.min(now - 3600e3, t + Math.max(3600e3, age * frac * (0.6 + LC.rand() * 0.8))); return t; };
    const push = (stage, by) => { c.stageHistory.push({ stage, ts: t, by }); c.stage = stage; c.timeline.unshift({ ts: t, type: 'stage', text: 'Moved to ' + stage, by }); };
    const order = LC.STAGES;
    const target = outcome === 'Nurture' || outcome === 'Lost' ? order[LC.rint(0, 2)] : outcome;
    const ti = order.indexOf(target);
    if (ti >= 1) { step(0.08); push('Qualified', 'AI agent'); c.timeline.unshift({ ts: t, type: 'shared', text: 'AI sent 3 matched units: ' + [u.unit_id].concat(LC.match(req, { limit: 3 }).exact.map(r => r.u.unit_id).filter(x => x !== u.unit_id).slice(0, 2)).join(', '), by: 'AI agent' }); c.shared.push({ unitId: u.unit_id, ts: t, by: 'AI agent', channel: 'WhatsApp', reaction: LC.pick(['Liked', 'Asked for visit', null]) }); }
    if (ti >= 2) {
      step(0.15); const when = t;
      const v = { id: LC.uid('vis'), clientId: c.id, unitId: u.unit_id, when, by: 'AI agent', status: 'Done', confirmation: 'Confirmed', agent: c.agent, feedback: LC.pick(ti >= 3 ? FEEDBACK.good : FEEDBACK.good.concat(FEEDBACK.mixed)), rating: ti >= 3 ? LC.rint(4, 5) : LC.rint(2, 4), createdAt: when - 2 * DAY };
      S.visits.push(v); push('Site visit', c.agent); c.timeline.unshift({ ts: when, type: 'visit', text: 'Visited ' + u.unit_id + ': "' + v.feedback + '"', by: c.agent });
      if (LC.rand() < .35) { const u2 = LC.match(req, { limit: 4 }).exact.find(r => r.u.unit_id !== u.unit_id); if (u2) S.visits.push({ ...v, id: LC.uid('vis'), unitId: u2.u.unit_id, when: when + DAY, feedback: LC.pick(FEEDBACK.mixed.concat(FEEDBACK.bad)), rating: LC.rint(2, 3) }); }
    }
    if (ti >= 1 && ti < 3 && LC.rand() < .18) { const nsu = LC.pick(live); S.visits.push({ id: LC.uid('vis'), clientId: c.id, unitId: nsu.unit_id, when: Math.min(now - DAY, created + 3 * DAY), by: 'AI agent', status: 'No-show', confirmation: LC.rand() < .5 ? 'Pending' : 'Confirmed', agent: c.agent, feedback: '', rating: null, createdAt: created }); c.timeline.unshift({ ts: Math.min(now - DAY, created + 3 * DAY), type: 'visit', text: 'No-show at ' + nsu.unit_id, by: c.agent }); }
    if (ti >= 3) { step(0.15); push('Proposal', c.agent); c.timeline.unshift({ ts: t, type: 'document', text: 'Term sheet sent for ' + u.unit_id, by: c.agent }); }
    if (ti >= 4) { step(0.15); push('Letter of intent', c.agent); c.unitId = u.unit_id; }
    if (ti >= 5) {
      step(0.15); push('Signed lease', c.agent); c.unitId = u.unit_id;
      c.achievedPsf = Math.round(u.rent_per_sqft * (0.92 + LC.rand() * 0.08)); c.dealValueMonthly = c.achievedPsf * u.chargeable_sqft;
      c.brokerage = Math.round(c.dealValueMonthly * u.brokerage_months);
    }
    if (outcome === 'Nurture') { step(0.1); c.req.moveIn = LC.iso(LC.addDays(LC.today(), LC.rint(95, 160))); c.stageHistory.push({ stage: 'Nurture', ts: t, by: c.agent, note: 'Move-in after ' + LC.fmtDate(c.req.moveIn) }); c.stage = 'Nurture'; c.timeline.unshift({ ts: t, type: 'stage', text: 'Moved to Nurture: move-in is more than 90 days away', by: c.agent }); }
    if (outcome === 'Lost') { step(0.1); c.lostReason = LC.pick(LOST); c.stageHistory.push({ stage: 'Lost', ts: t, by: c.agent, note: c.lostReason }); c.stage = 'Lost'; c.timeline.unshift({ ts: t, type: 'stage', text: 'Lost: ' + c.lostReason, by: c.agent }); }
    // requirement change for some (movement tracking)
    if (LC.rand() < .3 && ti >= 1) {
      const before = JSON.parse(JSON.stringify(c.req)); const after = JSON.parse(JSON.stringify(c.req));
      const kind = LC.pick(['budget', 'size', 'moveIn']);
      if (kind === 'budget' && after.budgetPsf) after.budgetPsf = Math.round(after.budgetPsf * 1.1);
      if (kind === 'size' && after.sizeMin) { after.sizeMin = Math.round(after.sizeMin * 1.2); after.sizeMax = Math.round(after.sizeMax * 1.2); }
      if (kind === 'moveIn') after.moveIn = LC.iso(LC.addDays(LC.parseDate(after.moveIn), 30));
      const ts = created + (t - created) * 0.5;
      c.reqHistory.push({ ts, from: before, to: after, by: c.agent, why: { budget: 'Raised budget after first visit', size: 'Team growing; needs more space', moveIn: 'Current lease extended by a month' }[kind] });
      c.req = after; c.timeline.push({ ts, type: 'requirement', text: 'Requirement updated: ' + LC.reqSummary(after), by: c.agent });
      c.timeline.sort((a, b) => b.ts - a.ts);
    }
    c.updatedAt = Math.max(...c.timeline.map(e => e.ts));
    if (!['Lost', 'Signed lease'].includes(c.stage)) c.nextFollowUp = now + LC.rint(-2, 4) * DAY + LC.rint(1, 8) * 36e5;
  }
  // tie units' non-available statuses to clients
  const negotiating = units.filter(u => u.status === 'Under negotiation' || u.status === 'LOI signed');
  const late = S.clients.filter(c => ['Proposal', 'Letter of intent'].includes(c.stage));
  negotiating.forEach((u, i) => { if (late[i]) { late[i].unitId = u.unit_id; } });
  // upcoming visits (today .. +4 days) for clients in Qualified / Site visit
  const upcoming = S.clients.filter(c => ['Qualified', 'Site visit'].includes(c.stage)).slice(0, 14);
  upcoming.forEach((c, i) => {
    const r = LC.match(c.req, { limit: 3 }).exact; const u = r.length ? r[i % r.length].u : null; if (!u) return;
    const day = LC.addDays(LC.today(), Math.floor(i / 4)); const when = +day + [11, 13, 15, 17][i % 4] * 36e5;
    const v = { id: LC.uid('vis'), clientId: c.id, unitId: u.unit_id, when, by: i % 3 ? 'AI agent' : c.agent, status: when < now ? 'Done' : 'Booked', confirmation: i % 3 === 0 ? 'Pending' : 'Confirmed', agent: c.agent, feedback: when < now ? LC.pick(FEEDBACK.good) : '', rating: null, createdAt: when - 2 * DAY };
    S.visits.push(v);
    if (v.confirmation === 'Pending' && v.status === 'Booked') S.tasks.push({ id: LC.uid('task'), type: 'Confirm visit', title: 'Call to confirm visit: ' + (c.company || c.name) + ' at ' + u.unit_id, due: Math.max(now - 2 * 36e5, when - DAY), clientId: c.id, visitId: v.id, assignee: c.agent, priority: 'High', done: false, createdAt: now - DAY });
  });
  // follow-up tasks
  S.clients.filter(c => ['Qualified', 'Proposal', 'Nurture'].includes(c.stage)).slice(0, 12).forEach(c => {
    S.tasks.push({ id: LC.uid('task'), type: c.stage === 'Proposal' ? 'Chase proposal' : c.stage === 'Nurture' ? 'Nurture check-in' : 'Follow up', title: (c.stage === 'Proposal' ? 'Chase decision on term sheet: ' : 'Follow up: ') + (c.company || c.name), due: c.nextFollowUp, clientId: c.id, assignee: c.agent, priority: c.stage === 'Proposal' ? 'High' : 'Normal', done: false, createdAt: now - 2 * DAY });
  });
  // owner check tasks for stale units
  units.filter(u => LC.unitFreshness(u).level !== 'fresh').forEach(u => S.tasks.push({ id: LC.uid('task'), type: 'Owner check', title: 'Call owner to confirm ' + u.unit_id + ' (' + LC.unitFreshness(u).label.toLowerCase() + ')', due: now + 3 * 36e5, unitId: u.unit_id, assignee: u.listing_agent, priority: LC.unitFreshness(u).level === 'stale' ? 'High' : 'Normal', done: false, createdAt: now - DAY }));
  // consent log for every client
  S.clients.forEach(c => S.consent.push({ ts: c.createdAt, phone: c.phone, name: c.name, channel: 'WhatsApp', text: 'Opted in to WhatsApp updates about commercial space (' + c.source + ')' }));
  S.clients.sort((a, b) => b.updatedAt - a.updatedAt);
  S.activity = S.clients.flatMap(c => c.timeline.slice(0, 3).map(e => ({ ts: e.ts, text: (c.company || c.name) + ': ' + e.text, clientId: c.id, kind: e.type }))).sort((a, b) => b.ts - a.ts).slice(0, 200);
};

/* ---------------- metrics (one written definition each) ---------------- */
LC.METRICS = {
  enquiries: 'Clients created in the period, from any source.',
  qualified: 'Clients whose use, size, budget and area were captured.',
  visits: 'Site visits marked Done in the period.',
  proposals: 'Clients who reached Proposal in the period.',
  lois: 'Clients who signed a letter of intent in the period.',
  signed: 'Clients who reached Signed lease in the period.',
  firstReply: 'Median seconds from enquiry to the first reply (AI agent).',
  firstHuman: 'Median minutes from enquiry to first contact by a person.',
  daysVacant: 'Days since the unit\'s available-from date, while it stays unleased.',
  askingVsAchieved: 'Rent per sq ft in signed leases divided by the listed rent.',
  sourceToClose: 'Signed leases divided by enquiries, per lead source.',
  noShow: 'Booked visits that did not happen, divided by booked visits.',
};
LC.stageReached = (c, stage) => c.stageHistory.some(h => h.stage === stage) || LC.STAGES.indexOf(c.stage) >= LC.STAGES.indexOf(stage);
LC.funnel = (clients = LC.state.clients) => LC.STAGES.map(s => ({ stage: s, n: clients.filter(c => LC.stageReached(c, s)).length }));

/* ---------------- UI helpers ---------------- */
LC.css = (text) => { const s = document.createElement('style'); s.textContent = text; (document.body || document.head).appendChild(s); };
LC.toast = (msg, ms = 2600) => {
  const r = LC.$('#toast-root'); r.innerHTML = '<div class="toast" role="status">' + LC.esc(msg) + '</div>';
  clearTimeout(LC._tt); LC._tt = setTimeout(() => { r.innerHTML = ''; }, ms);
};
/** Side drawer. Returns {el (body element), close()}. opts: {title, sub, html, wide, onClose} */
LC.drawer = (opts) => {
  if (LC._drawerClose) { try { LC._drawerClose(); } catch (e) {} }
  const root = LC.$('#drawer-root');
  root.innerHTML = '<div class="scrim" data-x></div><aside class="drawer' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + LC.esc(opts.title || '') + '"><div class="drawer-h"><div style="min-width:0"><h2 style="font-size:17px">' + LC.esc(opts.title || '') + '</h2>' + (opts.sub ? '<div class="small muted">' + opts.sub + '</div>' : '') + '</div><button class="x" type="button" data-x aria-label="Close">×</button></div><div class="drawer-b"></div></aside>';
  const el = LC.$('.drawer-b', root); el.innerHTML = opts.html || '';
  let closed = false;
  const close = () => { if (closed) return; closed = true; if (LC._drawerClose === close) LC._drawerClose = null; root.innerHTML = ''; document.removeEventListener('keydown', esc); opts.onClose && opts.onClose(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  LC.$$('[data-x]', root).forEach(b => b.addEventListener('click', close));
  LC._drawerClose = close;
  return { el, close };
};
LC.closeDrawer = () => LC._drawerClose && LC._drawerClose();
LC.copy = async (text) => { try { await navigator.clipboard.writeText(text); LC.toast('Copied'); return true; } catch (e) { LC.toast('Copy blocked here. Select the text and copy it.'); return false; } };
LC.pillFor = (level) => ({ fresh: 'good', aging: 'warn', stale: 'bad' }[level] || '');
LC.stagePill = (stage) => '<span class="pill stage-' + LC.esc(stage.replace(/\W+/g, '-').toLowerCase()) + '">' + LC.esc(stage) + '</span>';
LC.empty = (text) => '<div class="empty">' + LC.esc(text) + '</div>';

/* deterministic illustrative "photos" (SVG), clearly placeholders */
const PAL = { 'Office': ['#0b4fa8', '#5aa2f0'], 'Coworking': ['#1d6f8a', '#62c2d8'], 'Retail shop': ['#8a3b12', '#f0a35a'], 'Showroom': ['#5a2a86', '#b98af0'], 'F&B space': ['#8a1d3b', '#f07a8f'], 'Clinic': ['#0f6b52', '#5ad6ad'], 'Institutional': ['#6b5a0f', '#e0c650'], 'Warehouse': ['#3b4552', '#9aa7b6'], 'Industrial shed': ['#4a3b2a', '#b89b77'] };
LC.photo = (u, i = 0) => {
  const [a, b] = PAL[u.property_type] || ['#334', '#99a']; const n = (u.unit_id.charCodeAt(5) + i * 7) % 5;
  const scenes = [
    '<rect x="40" y="70" width="320" height="150" fill="rgba(255,255,255,.12)"/><g fill="rgba(255,255,255,.35)">' + Array.from({ length: 6 }, (_, k) => '<rect x="' + (55 + k * 50) + '" y="85" width="38" height="50" rx="2"/>').join('') + '</g><rect x="40" y="220" width="320" height="8" fill="rgba(0,0,0,.25)"/>',
    '<path d="M0 230 L400 230 L400 300 L0 300Z" fill="rgba(0,0,0,.2)"/><rect x="60" y="60" width="280" height="170" fill="rgba(255,255,255,.14)"/><rect x="80" y="80" width="240" height="110" fill="rgba(255,255,255,.3)"/><rect x="180" y="190" width="40" height="40" fill="rgba(0,0,0,.25)"/>',
    '<g fill="rgba(255,255,255,.28)"><rect x="50" y="150" width="70" height="40"/><rect x="140" y="150" width="70" height="40"/><rect x="230" y="150" width="70" height="40"/></g><rect x="0" y="190" width="400" height="110" fill="rgba(0,0,0,.18)"/><g stroke="rgba(255,255,255,.25)" stroke-width="2"><line x1="0" y1="60" x2="400" y2="60"/><line x1="0" y1="100" x2="400" y2="100"/></g>',
    '<rect x="30" y="40" width="340" height="220" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="3"/><line x1="200" y1="40" x2="200" y2="260" stroke="rgba(255,255,255,.3)" stroke-width="2"/><line x1="30" y1="150" x2="200" y2="150" stroke="rgba(255,255,255,.3)" stroke-width="2"/><circle cx="290" cy="150" r="30" fill="rgba(255,255,255,.18)"/>',
    '<path d="M40 240 L40 120 L200 60 L360 120 L360 240Z" fill="rgba(255,255,255,.16)"/><rect x="160" y="160" width="80" height="80" fill="rgba(0,0,0,.25)"/><g fill="rgba(255,255,255,.3)"><rect x="70" y="150" width="50" height="30"/><rect x="280" y="150" width="50" height="30"/></g>',
  ];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/>' + scenes[n] + '<text x="16" y="286" font-family="sans-serif" font-size="13" fill="rgba(255,255,255,.85)">Illustration · photo ' + (i + 1) + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};
/** schematic floor plan sized to the unit (SVG markup string) */
LC.floorPlan = (u) => {
  const W = 520, H = 320; const ratio = u.property_type.match(/Warehouse|Industrial/) ? 1.8 : 1.4;
  const w = 440, h = Math.round(w / ratio); const x0 = (W - w) / 2, y0 = (H - h) / 2;
  let inner = '';
  if (['Office', 'Coworking', 'Institutional', 'Clinic'].includes(u.property_type)) {
    inner += '<rect x="' + (x0 + 10) + '" y="' + (y0 + 10) + '" width="' + (w * .28) + '" height="' + (h * .4) + '" class="fp-room"/><text x="' + (x0 + 18) + '" y="' + (y0 + 30) + '" class="fp-t">Cabin / room</text>';
    inner += '<rect x="' + (x0 + 10) + '" y="' + (y0 + h * .55) + '" width="' + (w * .2) + '" height="' + (h * .4) + '" class="fp-room"/><text x="' + (x0 + 18) + '" y="' + (y0 + h * .55 + 20) + '" class="fp-t">Pantry / WC</text>';
    for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) inner += '<rect x="' + (x0 + w * .38 + k * w * .11) + '" y="' + (y0 + 25 + r * h * .28) + '" width="' + (w * .08) + '" height="' + (h * .12) + '" class="fp-desk"/>';
  } else if (/Warehouse|Industrial/.test(u.property_type)) {
    for (let k = 0; k < 4; k++) inner += '<rect x="' + (x0 + 20 + k * w * .23) + '" y="' + (y0 + 20) + '" width="' + (w * .16) + '" height="' + (h - 70) + '" class="fp-desk"/>';
    inner += '<g class="fp-t"><text x="' + (x0 + 10) + '" y="' + (y0 + h - 15) + '" class="fp-t">Loading bays →</text></g>';
  } else {
    inner += '<rect x="' + (x0 + w * .7) + '" y="' + (y0 + 10) + '" width="' + (w * .28) + '" height="' + (h * .3) + '" class="fp-room"/><text x="' + (x0 + w * .72) + '" y="' + (y0 + 30) + '" class="fp-t">Store / back</text>';
    inner += '<text x="' + (x0 + 12) + '" y="' + (y0 + h + 18) + '" class="fp-t">Frontage ' + (u.frontage_ft ? u.frontage_ft + ' ft' : '') + ' (road side)</text>';
  }
  return '<svg class="fp" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Schematic floor plan"><rect x="' + x0 + '" y="' + y0 + '" width="' + w + '" height="' + h + '" class="fp-wall"/>' + inner + '<text x="' + x0 + '" y="' + (y0 - 8) + '" class="fp-t">' + LC.fmtNum(u.carpet_sqft) + ' sq ft carpet · schematic, not to scale</text></svg>';
};

/* ---------------- router ---------------- */
LC.views = {};
LC.current = null;
/** Register a view. def = {title, sub, render(el), onShow?(el), onHide?()} ; render is called on every show */
LC.registerView = (id, def) => { LC.views[id] = def; };
LC.isActive = (id) => LC.current === id;
LC.go = (id, param) => { LC.routeParam = param || null; if (location.hash !== '#' + id) location.hash = id; else LC.show(id); };
LC.show = (id) => {
  if (!LC.views[id]) id = 'dashboard';
  if (LC.session && !LC.can(id)) { id = LC.homeView(); if (location.hash !== '#' + id) { history.replaceState(null, '', '#' + id); } }
  if (!LC.views[id]) return;
  if (LC.current && LC.views[LC.current] && LC.views[LC.current].onHide) LC.views[LC.current].onHide();
  LC.current = id;
  LC.$$('.view').forEach(v => v.hidden = v.id !== 'v-' + id);
  LC.$$('.nav a').forEach(a => a.setAttribute('aria-current', a.dataset.v === id ? 'page' : 'false'));
  const def = LC.views[id]; const el = LC.$('#v-' + id);
  LC.$('#v-title').textContent = def.title; LC.$('#v-sub').textContent = def.sub || '';
  try { def.render(el, LC.routeParam); } catch (e) { console.error('[LC] render ' + id, e); el.innerHTML = '<div class="card card-b">This screen hit an error: ' + LC.esc(e.message) + '</div>'; }
  LC.routeParam = null;
  window.scrollTo(0, 0);
  LC.emit('route', id);
};
LC.updateNavCounts = () => {
  const s = LC.state; const set = (id, v) => { const e = LC.$('#' + id); if (e) e.textContent = v || ''; };
  set('nav-inbox', LC.queue.waiting().length ? LC.queue.waiting().length + ' waiting' : s.leads.filter(l => l.status === 'ai').length || '');
  set('nav-inventory', s.units.filter(u => u.status === 'Available').length);
  set('nav-crm', s.clients.filter(c => !['Lost', 'Signed lease'].includes(c.stage)).length);
  set('nav-visits', s.visits.filter(v => v.status === 'Booked' && LC.dayLabel(v.when) === 'Today').length || '');
};

/* ---------------- AI capabilities (artifact runtime) ---------------- */
LC.ai = { sample: null, mcp: null, ready: false };
LC.aiName = 'Claude';   // the name shown on AI answers; the server build (net.js) sets it to 'AI'
LC.initAI = () => {
  if (!(window.claude && typeof window.claude.use === 'function')) { LC.ai.ready = true; return; }
  window.claude.use('sample').then(s => { LC.ai.sample = s || null; LC.emit('ai:ready'); }).catch(() => {});
  window.claude.use('mcp').then(m => { LC.ai.mcp = m || null; LC.emit('ai:ready'); }).catch(() => {});
};
/** Ask Claude (when the page runs as a published artifact). Returns text or throws {code}. */
LC.askClaude = async (prompt, opts = {}) => {
  if (!LC.ai.sample) throw { code: 'unavailable', message: 'Claude is not available in this view.' };
  const r = await LC.ai.sample(prompt, { modelTier: opts.tier || 'default', cache: false, ...opts });
  return r.text;
};
LC.askClaudeJSON = async (prompt, opts = {}) => {
  if (!LC.ai.sample) throw { code: 'unavailable', message: 'Claude is not available in this view.' };
  return LC.ai.sample.json(prompt, { modelTier: opts.tier || 'quick', ...opts });
};

/* ---------------- CSV helpers (sheet sync) ---------------- */
LC.parseCSV = (text, delim) => {
  text = String(text).replace(/^﻿/, '');
  if (!delim) delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
};
LC.toCSV = (rows) => rows.map(r => r.map(v => { v = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n');
/** rows (with header) -> {units, errors[]} ; requires unit_id column */
LC.rowsToUnits = (rows) => {
  const errors = []; if (!rows.length) return { units: [], errors: ['The sheet is empty.'] };
  const head = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
  if (!head.includes('unit_id')) return { units: [], errors: ['No unit_id column found. Keep the header row from the template.'] };
  const units = [];
  rows.slice(1).forEach((r, i) => {
    const o = {}; head.forEach((h, k) => o[h] = r[k] != null ? String(r[k]).trim() : '');
    if (!o.unit_id) { errors.push('Row ' + (i + 2) + ': missing unit_id, skipped.'); return; }
    units.push(LC.normalizeUnit(o, 0));
  });
  return { units, errors, columns: head };
};
/** compare incoming units to current; returns {added, removed, changed:[{id, fields:[{k,from,to}]}], same} */
LC.diffUnits = (incoming, current = LC.state.units) => {
  const cur = new Map(current.map(u => [u.unit_id, u])); const inc = new Map(incoming.map(u => [u.unit_id, u]));
  const KEYS = LC.INVENTORY_COLUMNS.filter(k => k !== 'unit_id');
  const added = incoming.filter(u => !cur.has(u.unit_id));
  const removed = current.filter(u => !inc.has(u.unit_id));
  const changed = []; let same = 0;
  incoming.forEach(u => {
    const c = cur.get(u.unit_id); if (!c) return;
    const fields = [];
    KEYS.forEach(k => { if (!(k in u)) return; const a = Array.isArray(c[k]) ? c[k].join('; ') : c[k] == null ? '' : String(c[k]); const b = Array.isArray(u[k]) ? u[k].join('; ') : u[k] == null ? '' : String(u[k]); if (a !== b) fields.push({ k, from: a, to: b }); });
    if (fields.length) changed.push({ id: u.unit_id, fields }); else same++;
  });
  return { added, removed, changed, same };
};
/** apply a diff; removed units are marked Leased (never deleted) */
LC.applyUnitDiff = (incoming, diff, source = 'Google Sheet', by = LC.state.me) => {
  const S = LC.state; const inc = new Map(incoming.map(u => [u.unit_id, u]));
  diff.changed.forEach(ch => { const u = LC.unit(ch.id); const nu = inc.get(ch.id); ch.fields.forEach(f => S.audit.unshift({ ts: Date.now(), unitId: ch.id, field: f.k, from: f.from, to: f.to, by: by + ' via ' + source })); Object.assign(u, nu); });
  diff.added.forEach(u => { S.units.push(u); S.audit.unshift({ ts: Date.now(), unitId: u.unit_id, field: '(new unit)', from: '', to: u.listing_title, by: by + ' via ' + source }); });
  diff.removed.forEach(u => { if (u.status !== 'Leased') { S.audit.unshift({ ts: Date.now(), unitId: u.unit_id, field: 'status', from: u.status, to: 'Leased (not in sheet)', by: by + ' via ' + source }); u.status = 'Leased'; } });
  S.syncLog.unshift({ ts: Date.now(), source, added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length, by });
  LC.log('Inventory synced from ' + source + ': ' + diff.added.length + ' added, ' + diff.changed.length + ' changed, ' + diff.removed.length + ' off market', { kind: 'sync' });
  LC.emit('units:changed');
};

/* ---------------- boot ---------------- */
LC.boot = () => {
  if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = 'light';   // demo opens in light; the rail button switches
  LC.initState();
  LC.initAI();
  const tp = LC.$('#today-pill'); tp.textContent = LC.fmtDT(Date.now()).split(',')[0];
  window.addEventListener('hashchange', () => LC.show((location.hash || '#dashboard').slice(1)));
  LC.$('#btn-theme').addEventListener('click', () => {
    const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
  });
  LC.$('#btn-reset').addEventListener('click', () => { LC.emit('reset'); LC.initState(); LC.emit('units:changed'); LC.emit('clients:changed'); LC.show(LC.current || 'dashboard'); LC.toast('Demo data reset'); });
  ['clients:changed', 'queue:changed', 'units:changed', 'visits:changed', 'leads:changed'].forEach(e => LC.on(e, () => { clearTimeout(LC._nc); LC._nc = setTimeout(LC.updateNavCounts, 120); }));
  LC.applyRole();
  LC.emit('boot');
  LC.updateNavCounts();
  LC.show((location.hash || '#dashboard').slice(1));
};
})();
