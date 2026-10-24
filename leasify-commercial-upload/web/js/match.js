/* =====================================================================
   Leasify Commercial demo: REQUIREMENT MATCH
   Capture a requirement (type, speak, voice note, document), see it as an
   editable form, and see which units fit and why. Also defines LC.shareText.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc;
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------------
   Reference lists used by the form
   --------------------------------------------------------------- */
const LANDMARKS = [
  { name: 'Biju Patnaik Airport', city: 'Bhubaneswar', lat: 20.2444, lng: 85.8178 },
  { name: 'Bhubaneswar railway station', city: 'Bhubaneswar', lat: 20.2672, lng: 85.8436 },
  { name: 'KIIT University', city: 'Bhubaneswar', lat: 20.3558, lng: 85.8187 },
  { name: 'Infocity', city: 'Bhubaneswar', lat: 20.3445, lng: 85.8065 },
  { name: 'Cuttack railway station', city: 'Cuttack', lat: 20.4655, lng: 85.879 },
  { name: 'Puri railway station', city: 'Puri', lat: 19.8175, lng: 85.8325 },
  { name: 'Jagannath Temple, Puri', city: 'Puri', lat: 19.8048, lng: 85.818 },
  { name: 'Jatni railway station', city: 'Jatni', lat: 20.165, lng: 85.707 },
];
const CITY_LIST = ['Bhubaneswar', 'Cuttack', 'Puri', 'Jatni'];
const AMENITY_LIST = ['Lift', 'Fire NOC', 'Main road facing', 'Loading dock', 'Occupancy certificate'];
const loc2city = (name) => LC.LOCALITIES[name] ? LC.LOCALITIES[name].city.split(' (')[0] : null;

/* ---------------------------------------------------------------
   Samples
   --------------------------------------------------------------- */
const SAMPLES = [
  { id: 's1', chip: 'Call notes: corporate admin', label: 'English call notes from a corporate admin',
    text: 'Call notes, Thursday. Caller: my name is Meera Nanda, admin head at Finlogic IT Services, and they are moving a growing team. They want about 3,000 sq ft of office in Infocity, Chandrasekharpur or Patia. Budget ₹80 per sq ft all-in. Needs 3 car parking and 100% power backup. Plug and play preferred, move in by 1 December. 5 year lease.' },
  { id: 's2', chip: 'WhatsApp (Hinglish): shop owner', label: 'Hinglish WhatsApp message from a shop owner',
    text: 'Janpath me dukan chahiye 500 sqft, 1.2 lakh tak. Ground floor hi chahiye, main road facing. Next month tak shuru karna hai. Mera naam Rakesh Panda hai.' },
  { id: 's3', chip: 'WhatsApp (Odia): office search', label: 'Odia WhatsApp message',
    text: 'ନମସ୍କାର ସାର୍। ମୁଁ Patia ବା Infocity ରେ ଏକ ଅଫିସ୍ ଖୋଜୁଛି। ଆମ ଦଳରେ 35 seats ଦରକାର। ମାସିକ ଭଡ଼ା 2 ଲକ୍ଷ ଭିତରେ। 2 car parking ଲାଗିବ। ଆସନ୍ତା ମାସ ଆରମ୍ଭରୁ ଦରକାର।' },
  { id: 's4', chip: 'Email: IT facilities head', label: 'Forwarded email from an IT company facilities head',
    text: 'Subject: Fwd: Office requirement, Cuttack\n\nHi Ananya,\n\nMy name is Sandeep Rout, facilities head at Bluefin Digital Pvt Ltd, and our software team in Cuttack is growing. We need a new office.\n\nRequirement:\n- Around 2,000 sq ft, 30 seats\n- Location: Badambadi or Link Road in Cuttack, or Saheed Nagar in Bhubaneswar\n- Budget: ₹55 per sq ft all-in (rent plus maintenance)\n- Lift and fire NOC are a must\n- 2 car parking\n- Semi-furnished is fine\n- Move in by 15 January\n- 3 year lease\n\nPlease send options by Friday.\nRegards, Sandeep' },
  { id: 's5', chip: 'Broker forward: warehouse', label: 'Broker-to-broker WhatsApp forward for a warehouse',
    text: 'Forwarded as received: Bhai ek party hai, godown chahiye Trisulia ya Phulnakhara side. 8000 to 10000 sqft, loading dock zaroori hai aur 24 ft clear height. Rs 25 per sq ft all-in tak budget hai. Immediate chahiye. Party is from Coastal Seafood Exports, cold storage ka kaam hai. 3 year lease. Dekh ke bata.' },
  { id: 's6', chip: 'Restaurant, VIP Road Puri', label: 'Restaurant owner on VIP Road, Puri',
    text: 'Hello sir, my name is Debasis Mohanty from Sea Breeze Cafe, and we want a restaurant space on VIP Road, Puri. Around 2,500 sq ft, ground floor, at least 10 ft frontage. Budget ₹110 per sq ft all-in. 1 car parking. Bare shell is fine, we will do our own interiors. Need it in 2 months, 5 year lease.' },
];
const VOICE = [
  { id: 'v1', caller: 'Dr. Mishra, clinic owner', lang: 'Hindi (Hinglish)', dur: '0:31', seed: 3,
    text: 'Namaste sir, mera naam Dr Mishra hai. Mujhe Chandrasekharpur mein clinic ke liye jagah chahiye, 1200 sqft, ground floor pe. Budget 1.2 lakh mahina, lift ho aur fire NOC bhi. Within 3 months chahiye.' },
  { id: 'v2', caller: 'Pharmacy owner', lang: 'Odia', dur: '0:24', seed: 7,
    text: 'ନମସ୍କାର, ମୁଁ Khandagiri ରେ pharmacy ପାଇଁ ଦୋକାନ ଖୋଜୁଛି। 700 sq ft ରହିଲେ ଚଳିବ, ground floor ଦରକାର। ମାସକୁ rent 80 ହଜାର ଭିତରେ। ଆସନ୍ତା ମାସ ଆରମ୍ଭକୁ ଦରକାର।' },
  { id: 'v3', caller: 'Anita Sahu, coaching institute', lang: 'English', dur: '0:38', seed: 11,
    text: 'Hello, this is Anita Sahu from Bright Minds Coaching, and we run NEET and JEE classes and need a bigger centre. Around 2,400 sq ft near KIIT in Patia. We can pay up to ₹70 per sq ft all-in. A lift is a must for the students. 2 car parking if possible, and we want to move in within 2 months.' },
];

/* Words the core parser's \b patterns cannot see in Odia and Devanagari script.
   We swap them for the English word before parsing. */
function prep(t) {
  return String(t || '')
    .replace(/ଭ(?:ଡ଼|ଢ଼|ଡ଼|ଢ଼|ଡ)ା/g, ' rent ')
    .replace(/किराया/g, ' rent ')
    .replace(/ଲକ୍ଷ|लाख/g, ' lakh ')
    .replace(/ହଜାର|हजार/g, ' thousand ')
    .replace(/ଏବେ|ତୁରନ୍ତ|तुरंत/g, ' immediately ')
    .replace(/ଆସନ୍ତା ମାସ|ପରବର୍ତ୍ତୀ ମାସ|अगले महीने/g, ' next month ')
    .replace(/ପାର୍କିଂ|पार्किंग/g, ' parking ');
}

/* ---------------------------------------------------------------
   WhatsApp text (also used by the lead inbox)
   --------------------------------------------------------------- */
const ODIA_RENT = 'ଭଡ଼ା';
const SHARE = {
  English: {
    intro: (n, s) => 'Hi, here ' + (n === 1 ? 'is 1 option' : 'are ' + n + ' options') + ' that fit what you asked for' + (s ? ' (' + s + ')' : '') + ':',
    allin: (psf, mo) => 'All-in ₹' + psf + '/sq ft (' + mo + ' a month + GST)',
    line3: (size, fit, from) => size + ' · ' + fit + ' · available from ' + from,
    now: 'now',
    close: (n) => 'Reply ' + (n === 1 ? '1' : n === 2 ? '1 or 2' : '1, 2 or 3') + ' to book a visit.',
  },
  Hindi: {
    intro: (n, s) => 'नमस्ते, आपकी ज़रूरत के हिसाब से ' + (n === 1 ? '1 जगह मिली है' : n + ' जगहें मिली हैं') + (s ? ' (' + s + ')' : '') + ':',
    allin: (psf, mo) => 'कुल किराया, मेंटेनेंस सहित: ₹' + psf + '/sq ft (' + mo + ' महीना + GST)',
    line3: (size, fit, from) => size + ' · फिट-आउट: ' + fit + ' · उपलब्ध: ' + from,
    now: 'अभी',
    close: (n) => 'विज़िट बुक करने के लिए ' + (n === 1 ? '1' : n === 2 ? '1 या 2' : '1, 2 या 3') + ' लिखकर भेजें।',
  },
  Odia: {
    intro: (n, s) => 'ନମସ୍କାର, ଆପଣଙ୍କ ଆବଶ୍ୟକତା ଅନୁସାରେ ' + n + 'ଟି ସ୍ଥାନ ମିଳିଛି' + (s ? ' (' + s + ')' : '') + ':',
    allin: (psf, mo) => 'ମୋଟ ' + ODIA_RENT + ', ମେଣ୍ଟେନାନ୍ସ ସହିତ: ₹' + psf + '/sq ft (ମାସକୁ ' + mo + ' + GST)',
    line3: (size, fit, from) => size + ' · ଫିଟ୍-ଆଉଟ୍: ' + fit + ' · ଉପଲବ୍ଧ: ' + from,
    now: 'ଏବେ',
    close: (n) => 'ଭିଜିଟ୍ ବୁକ୍ କରିବାକୁ ' + (n === 1 ? '1' : n === 2 ? '1 କିମ୍ବା 2' : '1, 2 କିମ୍ବା 3') + ' ଲେଖି ପଠାନ୍ତୁ।',
  },
};
function shortReq(req) {
  const p = [];
  if (req && req.use) p.push(req.use);
  const band = req && LC.reqSizeBand(req);
  if (band) p.push(LC.fmtNum(band[0]) + '–' + LC.fmtNum(band[1]) + ' sq ft');
  if (req && req.localities && req.localities.length) p.push(req.localities.join(' / '));
  else if (req && req.landmark) p.push('near ' + req.landmark.name);
  else if (req && req.city) p.push(req.city);
  return p.join(', ');
}
/** WhatsApp-ready text for up to 3 units. Names, numbers and links stay in Latin script. */
LC.shareText = function (unitIds, req, language = 'English') {
  const T = SHARE[language] || SHARE.English;
  const units = (unitIds || []).map(id => LC.unit(id)).filter(Boolean).slice(0, 3);
  if (!units.length) return '';
  const blocks = units.map((u, i) => {
    const from = LC.daysBetween(LC.today(), u.available_from) <= 0 ? T.now : LC.fmtDate(u.available_from);
    return (i + 1) + '. ' + u.listing_title + '\n' +
      T.allin(u.all_in_per_sqft, LC.fmtLakh(u.all_in_monthly)) + '\n' +
      T.line3(LC.fmtSqft(u.chargeable_sqft), u.furnishing, from) + '\n' +
      LC.mapsLink(u);
  });
  return T.intro(units.length, shortReq(req)) + '\n\n' + blocks.join('\n\n') + '\n\n' + T.close(units.length);
};

/* ---------------------------------------------------------------
   Module CSS
   --------------------------------------------------------------- */
LC.css(`
.mt-top { align-items: start; }
.mt-lede { margin: 0 0 14px; }
.mt-samples { display: flex; flex-wrap: wrap; gap: 6px; }
.mt-panel { display: grid; gap: 12px; padding-top: 14px; }
.mt-panel[hidden] { display: none; }
.mt-mic { display: inline-flex; align-items: center; gap: 8px; }
.mt-mic svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.mt-live { min-height: 54px; border: 1px dashed var(--border); border-radius: var(--r-s); padding: 10px 12px; background: var(--surface-2); font-size: 13px; color: var(--fg-2); }
.mt-live i { color: var(--muted); font-style: normal; }
.mt-rec { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--bad); margin-right: 6px; animation: mtpulse 1.1s infinite; }
@keyframes mtpulse { 0%, 100% { opacity: .35 } 50% { opacity: 1 } }
.mt-warn { background: var(--warn-bg); color: var(--warn); border-radius: var(--r-s); padding: 9px 12px; font-size: 12.5px; }
.mt-vgrid { display: grid; gap: 8px; }
.mt-vcard { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; border: 1px solid var(--hair); border-radius: var(--r-s); padding: 9px 12px; background: var(--surface); }
.mt-vcard b { font-weight: 600; font-size: 13px; }
.mt-vcard .small { grid-column: 1; }
.mt-wave { width: 100%; max-width: 220px; height: 28px; display: block; margin-top: 2px; }
.mt-wave rect { fill: var(--brand); opacity: .75; }
.mt-vcard .btn { grid-column: 2; grid-row: 1 / span 3; }
.mt-audio { width: 100%; max-width: 100%; }
.mt-found { display: grid; gap: 10px; border-top: 1px solid var(--hair); padding-top: 14px; margin-top: 14px; }
.mt-found > * { min-width: 0; }
.mt-found .pill { white-space: normal; }
.mt-found h3 { font-size: 13px; font-weight: 600; }
.mt-chip { display: inline-flex; gap: 6px; align-items: baseline; background: var(--glow); color: var(--fg); border-radius: 999px; padding: 4px 11px; font-size: 12px; }
.mt-chip span { color: var(--muted); }
.mt-chip b { font-weight: 600; color: var(--brand-ink); }
.mt-ask { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 12.5px; color: var(--fg-2); }
.mt-src { font-size: 12px; color: var(--fg-2); border-left: 2px solid var(--axis); padding: 4px 10px; margin: 0; white-space: pre-wrap; max-height: 120px; overflow: auto; }
.mt-fgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.mt-group { display: grid; gap: 6px; }
.mt-group > .lbl { font-size: 11.5px; font-weight: 600; color: var(--muted); letter-spacing: .02em; }
.mt-loc { display: grid; gap: 4px; }
.mt-loc .cty { font-size: 11px; color: var(--muted); }
.mt-toggle { border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 4px 11px; font-size: 12px; }
.mt-toggle:hover { border-color: var(--brand); }
.mt-toggle[aria-pressed="true"] { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.mt-checks { display: flex; flex-wrap: wrap; gap: 8px 16px; }
.mt-budget { display: flex; gap: 8px; flex-wrap: wrap; }
.mt-budget .input { flex: 1; min-width: 100px; }
.mt-sum { background: var(--surface-2); border-radius: var(--r-s); padding: 9px 12px; font-size: 13px; font-weight: 500; }
.mt-save { display: grid; gap: 10px; border-top: 1px solid var(--hair); padding-top: 14px; }
.mt-newc { display: grid; gap: 10px; background: var(--surface-2); border-radius: var(--r-s); padding: 12px; }
.mt-err { color: var(--bad); font-size: 12.5px; }
.mt-count { font-size: 14px; }
.mt-count b { font-family: var(--f-head); font-size: 20px; margin-right: 2px; }
.mt-count .sep { color: var(--muted); margin: 0 6px; }
.mt-ringt { fill: var(--fg); font: 600 16px var(--f-head); }
.mt-title { background: none; border: 0; padding: 0; font-family: var(--f-head); font-weight: 600; font-size: 15px; color: var(--brand-ink); text-align: left; }
.mt-title:hover { text-decoration: underline; }
.mt-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; color: var(--fg-2); margin-top: 3px; }
.mt-meta .price { font-weight: 600; color: var(--fg); }
.mt-fnote { color: var(--muted); font-size: 11px; line-height: 1.3; }
.mt-miss { margin-top: 8px; font-size: 12.5px; color: var(--warn); background: var(--warn-bg); border-radius: var(--r-s); padding: 6px 10px; }
.mt-miss b { font-weight: 600; }
.mt-flag { margin-top: 6px; font-size: 12px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.mt-side { display: grid; gap: 8px; justify-items: start; font-size: 12.5px; }
.mt-side a { color: var(--brand-ink); }
.mt-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.mt-more { padding: 12px 18px; }
.mt-gap { font-size: 12.5px; color: var(--fg-2); background: var(--surface-2); border-radius: var(--r-s); padding: 8px 12px; }
.mt-how summary { cursor: pointer; font-weight: 600; font-size: 14px; padding: 14px 18px; }
.mt-how .body { padding: 0 18px 16px; display: grid; gap: 12px; }
.mt-how ol { margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 13px; }
.mt-wa { background: var(--wa-bg); border-radius: var(--r); padding: 14px; }
.mt-wa .bub { max-width: 100%; font-size: 13px; }
.mt-dirty { font-size: 11.5px; }
@media (max-width: 860px) { .mt-vcard { grid-template-columns: minmax(0, 1fr); } .mt-vcard .btn { grid-column: 1; grid-row: auto; justify-self: start; } }
`);

/* ---------------------------------------------------------------
   Module state
   --------------------------------------------------------------- */
const S = {
  req: LC.emptyReq(), clientId: null, tab: 'type', text: '', found: [], hasExtracted: false,
  srcLabel: '', srcText: '', addTo: false, budgetMode: 'psf', showNew: false,
  selected: new Set(), showAllExact: false, showAllClose: false, res: null,
  aiBusy: false, aiMsg: '', voiceMsg: '', listening: false, liveFinal: '', liveInterim: '',
  noteName: '', noteUrl: null, docMsg: '', docImg: null, docImgUrl: null,
};
let root = null, rec = null, tm = null;

const $ = (s) => root ? root.querySelector(s) : null;
const hasReq = () => !!(S.req.use || S.req.sizeMin || S.req.sizeMax || S.req.seats || S.req.budgetPsf || S.req.budgetMonthly || S.req.localities.length || S.req.city || S.req.landmark || S.req.moveIn || S.req.furnishing || S.req.parking4w != null || S.req.powerBackup || S.req.groundFloor || S.req.frontageMin || S.req.clearHeightMin || (S.req.mustHave || []).length);
const client = () => S.clientId ? LC.crm.get(S.clientId) : null;
const clientName = (c) => c ? (c.company || c.name) : '';
const dirty = () => { const c = client(); return !!c && JSON.stringify(c.req) !== JSON.stringify(S.req); };
function setBudgetModeFromReq() { S.budgetMode = (S.req.budgetMonthly && !S.req.budgetPsf) ? 'monthly' : 'psf'; }

/* ---------------------------------------------------------------
   Extraction
   --------------------------------------------------------------- */
function extract(text, label) {
  text = String(text || '').trim();
  if (!text) { S.found = []; S.hasExtracted = false; renderFound(); return; }
  const base = S.addTo ? clone(S.req) : LC.emptyReq();
  const r = LC.parseRequirement(prep(text), base);
  S.req = r.req; S.found = r.found; S.hasExtracted = true; S.text = text;
  S.srcLabel = label || 'typed text'; S.srcText = text; S.aiMsg = '';
  setBudgetModeFromReq();
  S.selected.clear();
  renderFound(); renderForm(); runMatch();
}
function setText(t) { S.text = t; const ta = $('#mt-text'); if (ta) ta.value = t; }

/* what changed between two requirement objects, as chips */
function diffFound(a, b) {
  const out = []; const j = (x) => JSON.stringify(x);
  const add = (l, v) => out.push({ label: l, value: v });
  if (a.use !== b.use && b.use) add('Type of use', b.use);
  if ((a.sizeMin !== b.sizeMin || a.sizeMax !== b.sizeMax) && (b.sizeMin || b.sizeMax)) add('Size', (b.sizeMin && b.sizeMax) ? LC.fmtNum(b.sizeMin) + '–' + LC.fmtNum(b.sizeMax) + ' sq ft' : LC.fmtSqft(b.sizeMin || b.sizeMax));
  if (a.seats !== b.seats && b.seats) add('Seats', b.seats + ' seats');
  if (b.budgetPsf && a.budgetPsf !== b.budgetPsf) add('Budget', '₹' + b.budgetPsf + ' per sq ft all-in');
  if (b.budgetMonthly && a.budgetMonthly !== b.budgetMonthly) add('Budget', LC.fmtLakh(b.budgetMonthly) + ' a month all-in');
  if (b.city && a.city !== b.city) add('City', b.city);
  if (j(a.localities) !== j(b.localities) && b.localities.length) add('Area', b.localities.join(', '));
  if (j(a.landmark) !== j(b.landmark) && b.landmark) add('Landmark', b.landmark.name);
  if (a.radiusKm !== b.radiusKm && b.radiusKm) add('Radius', b.radiusKm + ' km');
  if (a.moveIn !== b.moveIn && b.moveIn) add('Move-in', LC.fmtDate(b.moveIn));
  if (a.furnishing !== b.furnishing && b.furnishing) add('Fit-out', b.furnishing);
  if (a.parking4w !== b.parking4w && b.parking4w != null) add('Parking', b.parking4w + ' car parks');
  if (a.powerBackup !== b.powerBackup && b.powerBackup) add('Power backup', '100% needed');
  if (a.groundFloor !== b.groundFloor && b.groundFloor) add('Floor', 'ground floor');
  if (a.frontageMin !== b.frontageMin && b.frontageMin) add('Frontage', b.frontageMin + ' ft');
  if (a.clearHeightMin !== b.clearHeightMin && b.clearHeightMin) add('Clear height', b.clearHeightMin + ' ft');
  (b.mustHave || []).filter(x => !(a.mustHave || []).includes(x)).forEach(x => add('Must have', x));
  if (a.leaseYears !== b.leaseYears && b.leaseYears) add('Lease term', b.leaseYears + ' years');
  if (a.contactName !== b.contactName && b.contactName) add('Contact', b.contactName);
  if (a.company !== b.company && b.company) add('Company', b.company);
  return out;
}

/* Claude extraction (optional). Everything it returns is validated before it touches the form. */
function mergeAI(o) {
  const r = clone(S.req); if (!o || typeof o !== 'object') return r;
  const num = (v, lo, hi) => { if (typeof v === 'string') v = parseFloat(v.replace(/,/g, '')); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };
  let v;
  if (typeof o.use === 'string' && LC.USES[o.use]) r.use = o.use;
  if ((v = num(o.sizeMin, 50, 1e6)) != null) r.sizeMin = Math.round(v);
  if ((v = num(o.sizeMax, 50, 1e6)) != null) r.sizeMax = Math.round(v);
  if (r.sizeMin && r.sizeMax && r.sizeMin > r.sizeMax) [r.sizeMin, r.sizeMax] = [r.sizeMax, r.sizeMin];
  if ((v = num(o.seats, 1, 5000)) != null) r.seats = Math.round(v);
  if ((v = num(o.budgetPsf, 1, 5000)) != null) { r.budgetPsf = Math.round(v); r.budgetMonthly = null; }
  else if ((v = num(o.budgetMonthly, 1000, 1e8)) != null) { r.budgetMonthly = Math.round(v); r.budgetPsf = null; }
  if (typeof o.city === 'string' && CITY_LIST.includes(o.city)) r.city = o.city;
  if (Array.isArray(o.localities)) {
    const ok = o.localities.filter(n => typeof n === 'string' && LC.LOCALITIES[n]);
    if (ok.length) { r.localities = Array.from(new Set(ok)); r.city = loc2city(ok[0]); }
  }
  if (o.landmark) { const nm = typeof o.landmark === 'string' ? o.landmark : o.landmark.name; const L = LANDMARKS.find(x => String(nm).toLowerCase() === x.name.toLowerCase()); if (L) { r.landmark = { name: L.name, lat: L.lat, lng: L.lng }; r.city = r.city || L.city; } }
  if ((v = num(o.radiusKm, 0.5, 100)) != null) r.radiusKm = v;
  if (typeof o.moveIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.moveIn) && !isNaN(LC.parseDate(o.moveIn))) r.moveIn = o.moveIn;
  if (typeof o.furnishing === 'string' && LC.FURNISHING.includes(o.furnishing)) r.furnishing = o.furnishing;
  if ((v = num(o.parking4w, 0, 500)) != null) r.parking4w = Math.round(v);
  if (o.powerBackup === '100%') r.powerBackup = '100%';
  if ((v = num(o.frontageMin, 1, 500)) != null) r.frontageMin = Math.round(v);
  if ((v = num(o.clearHeightMin, 1, 100)) != null) r.clearHeightMin = Math.round(v);
  if (o.groundFloor === true) r.groundFloor = true;
  if (Array.isArray(o.mustHave)) r.mustHave = Array.from(new Set([...(r.mustHave || []), ...o.mustHave.filter(x => AMENITY_LIST.includes(x))]));
  if ((v = num(o.leaseYears, 1, 30)) != null) r.leaseYears = Math.round(v);
  if (typeof o.company === 'string' && o.company.trim()) r.company = o.company.trim().slice(0, 80);
  if (typeof o.contactName === 'string' && o.contactName.trim()) r.contactName = o.contactName.trim().slice(0, 60);
  if (typeof o.notes === 'string' && o.notes.trim()) r.notes = o.notes.trim().slice(0, 300);
  return r;
}
function aiPrompt(text, hasImage) {
  return 'You read a message from a person looking for commercial space in Odisha, India, and return their requirement as JSON.\n' +
    (hasImage ? 'The message is in the attached image.\n' : 'Message:\n"""\n' + text + '\n"""\n') +
    'It may be English, Hindi, Odia or a mix. Today is ' + LC.iso(LC.today()) + '.\n' +
    'Return JSON only, no other text, with exactly these keys: ' + Object.keys(LC.emptyReq()).join(', ') + '.\n' +
    'Use null (or [] for lists) when the message does not say.\n' +
    '- use: one of ' + Object.keys(LC.USES).join(', ') + '.\n' +
    '- sizeMin, sizeMax: square feet. If one size is given, use about 15% either side.\n' +
    '- seats: number of seats or people.\n' +
    '- budgetPsf: all-in rupees per sq ft per month, or budgetMonthly: all-in rupees per month. Fill one, not both.\n' +
    '- city: one of ' + CITY_LIST.join(', ') + '.\n' +
    '- localities: only names from this list: ' + Object.keys(LC.LOCALITIES).join(', ') + '.\n' +
    '- landmark: one of ' + LANDMARKS.map(l => l.name).join(', ') + ', or null.\n' +
    '- radiusKm: number.\n' +
    '- moveIn: a date as YYYY-MM-DD.\n' +
    '- furnishing: one of ' + LC.FURNISHING.join(', ') + '.\n' +
    '- parking4w: number of car parks (0 if none needed). powerBackup: "100%" or null. groundFloor: true or null.\n' +
    '- frontageMin: feet. clearHeightMin: feet.\n' +
    '- mustHave: any of ' + AMENITY_LIST.join(', ') + '.\n' +
    '- leaseYears: number. company, contactName: text. notes: anything else important, in one short sentence.';
}
async function aiExtract(text, imageBlob) {
  if (!LC.ai.sample || S.aiBusy) return;
  S.aiBusy = true; S.aiMsg = ''; renderAI();
  try {
    let out = await LC.askClaudeJSON(aiPrompt(text, !!imageBlob), imageBlob ? { images: [imageBlob] } : {});
    if (typeof out === 'string') { const m = out.match(/\{[\s\S]*\}/); out = JSON.parse(m ? m[0] : out); }
    const before = clone(S.req); const merged = mergeAI(out);
    const chips = diffFound(before, merged);
    S.req = merged; S.found = chips; S.hasExtracted = true; S.srcLabel = (imageBlob ? 'image, read by ' + LC.aiName : 'text, read by ' + LC.aiName); S.srcText = text || '';
    setBudgetModeFromReq(); S.selected.clear();
    S.aiMsg = chips.length ? '' : LC.aiName + ' found nothing new to add.';
    renderFound(); renderForm(); runMatch();
  } catch (e) {
    S.aiMsg = LC.aiName + ' could not read this one. The built-in reader result stays as it is.';
  }
  S.aiBusy = false; renderAI();
}

/* ---------------------------------------------------------------
   Capture card
   --------------------------------------------------------------- */
function sampleChips() {
  return '<div class="mt-samples">' + SAMPLES.map(s => '<button type="button" class="chip" data-sample="' + s.id + '" title="' + esc(s.label) + '">' + esc(s.chip) + '</button>').join('') + '</div>';
}
function wave(seed) {
  let h = '';
  for (let i = 0; i < 48; i++) {
    const a = Math.abs(Math.sin(i * 0.55 + seed)) * 0.55 + Math.abs(Math.sin(i * 1.7 + seed * 2.3)) * 0.35 + 0.1;
    const ht = Math.max(3, Math.round(a * 26));
    h += '<rect x="' + (i * 4.6) + '" y="' + ((28 - ht) / 2) + '" width="2.6" height="' + ht + '" rx="1.3"/>';
  }
  return '<svg class="mt-wave" viewBox="0 0 220 28" role="img" aria-label="Waveform of a sample voice note">' + h + '</svg>';
}
const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

function captureHtml() {
  const tabs = [['type', 'Type or paste'], ['speak', 'Speak'], ['note', 'Voice note'], ['doc', 'Upload a document']];
  return `
  <div class="card">
    <div class="card-h"><h2>Capture the requirement</h2></div>
    <div class="card-b">
      <p class="lede mt-lede">Type it, say it, or upload a voice note or a document. I read the text, fill in the form and then show what fits. If the qualification chat has already captured a requirement, pick that client in the form and it loads as is.</p>
      <div class="tabs" role="tablist" aria-label="Ways to capture a requirement">
        ${tabs.map(([id, l]) => `<button type="button" role="tab" id="mt-tab-${id}" data-tab="${id}" aria-selected="${S.tab === id}" aria-controls="mt-p-${id}">${l}</button>`).join('')}
      </div>

      <div class="mt-panel" id="mt-p-type" role="tabpanel" aria-labelledby="mt-tab-type" ${S.tab === 'type' ? '' : 'hidden'}>
        <div class="field"><label for="mt-text">Call notes, a WhatsApp message, an email or anything the occupier sent</label>
          <textarea class="input" id="mt-text" rows="6" placeholder="For example: Need 1,500 sq ft office in Patia, budget 70 per sq ft, move in next month, 2 car parking">${esc(S.text)}</textarea></div>
        <div class="row"><button type="button" class="btn primary" id="mt-go">Extract requirement</button>
          <label class="checkline small"><input type="checkbox" id="mt-addto" ${S.addTo ? 'checked' : ''}> Add to the requirement below instead of starting fresh</label></div>
        <div><div class="eyebrow" style="margin-bottom:6px">Try a sample</div>${sampleChips()}</div>
      </div>

      <div class="mt-panel" id="mt-p-speak" role="tabpanel" aria-labelledby="mt-tab-speak" ${S.tab === 'speak' ? '' : 'hidden'}>
        <div class="toolbar">
          <div class="field" style="min-width:150px"><label for="mt-lang">Language spoken</label>
            <select class="input" id="mt-lang"><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option><option value="or-IN">Odia</option></select></div>
          <button type="button" class="btn primary mt-mic" id="mt-mic">${MIC}<span id="mt-mic-t">Start speaking</span></button>
        </div>
        <div class="mt-live" id="mt-live" aria-live="polite"><i>Your words show up here as you speak.</i></div>
        <div class="mt-warn" id="mt-voice-msg" role="status" hidden></div>
        <p class="note">When you stop, the words go into the text box and the requirement is read from them.</p>
      </div>

      <div class="mt-panel" id="mt-p-note" role="tabpanel" aria-labelledby="mt-tab-note" ${S.tab === 'note' ? '' : 'hidden'}>
        <p class="note">In the live product, voice notes are transcribed on our server in English, Hindi and Odia. For this demo, type what was said, or pick a sample voice note.</p>
        <div class="field"><label for="mt-audio-file">Upload a voice note</label><input class="input" type="file" id="mt-audio-file" accept="audio/*"></div>
        <div id="mt-audio-box"></div>
        <div class="field"><label for="mt-note-text">Type what was said</label>
          <textarea class="input" id="mt-note-text" rows="3" placeholder="Type or paste the words from the voice note"></textarea></div>
        <div><button type="button" class="btn" id="mt-note-go">Extract requirement</button></div>
        <div><div class="eyebrow" style="margin-bottom:6px">Sample voice notes (no audio file, transcript only)</div>
          <div class="mt-vgrid">${VOICE.map(v => `<div class="mt-vcard"><div><b>${esc(v.caller)}</b></div><button type="button" class="btn sm" data-voice="${v.id}">Use this voice note</button><div class="small muted">${esc(v.lang)} · ${esc(v.dur)} · sample</div>${wave(v.seed)}</div>`).join('')}</div></div>
      </div>

      <div class="mt-panel" id="mt-p-doc" role="tabpanel" aria-labelledby="mt-tab-doc" ${S.tab === 'doc' ? '' : 'hidden'}>
        <div class="field"><label for="mt-doc-file">Upload a text file, an email or a screenshot</label>
          <input class="input" type="file" id="mt-doc-file" accept=".txt,.eml,.md,.csv,.json,image/*,.pdf,.doc,.docx"></div>
        <p class="note">Text files (.txt, .eml, .md, .csv, .json) are read here. Images can be read with ${LC.aiName} when it is available. PDF and Word files are read on our server in the live product.</p>
        <div id="mt-doc-box"></div>
      </div>

      <div id="mt-ai-row" class="row" style="margin-top:12px"></div>
      <div id="mt-found"></div>
    </div>
  </div>`;
}
function renderAI() {
  const el = $('#mt-ai-row'); if (!el) return;
  if (!LC.ai.sample) { el.innerHTML = ''; return; }
  const can = !!(S.srcText || S.text || S.docImg);
  el.innerHTML = '<button type="button" class="btn" id="mt-ai" ' + (S.aiBusy || !can ? 'disabled' : '') + '><span class="ai-tag">' + LC.aiName + '</span> ' + (S.aiBusy ? 'Reading...' : 'Extract with ' + LC.aiName) + '</button>' +
    '<span class="small muted">' + esc(S.aiMsg || 'Optional. It reads messy or mixed-language text better. You still check the form.') + '</span>';
  const b = $('#mt-ai'); if (b) b.addEventListener('click', () => aiExtract(S.srcText || S.text || '', null));
}
function renderFound() {
  const el = $('#mt-found'); if (!el) return;
  if (!S.hasExtracted) { el.innerHTML = ''; renderAI(); return; }
  const miss = LC.reqMissing(S.req).map(k => LC.REQ_FIELDS.find(f => f.key === k)).filter(Boolean);
  el.innerHTML = `<div class="mt-found">
    ${S.srcText && S.srcLabel && !/^typed/.test(S.srcLabel) ? `<div><div class="eyebrow">Text read from ${esc(S.srcLabel)}</div><p class="mt-src">${esc(S.srcText.slice(0, 700))}${S.srcText.length > 700 ? '...' : ''}</p></div>` : ''}
    <div><h3>What I found</h3>
      ${S.found.length ? `<div class="chips" style="margin-top:6px">${S.found.map(f => `<span class="mt-chip"><span>${esc(f.label)}</span><b>${esc(f.value)}</b></span>`).join('')}</div>` : '<p class="small muted" style="margin:6px 0 0">I did not recognise anything. Add the use, the size, the budget and the area.</p>'}</div>
    ${miss.length ? `<div><h3>Still to ask</h3><ul class="mt-ask" style="margin-top:6px">${miss.map(f => `<li>${esc(f.q)}</li>`).join('')}</ul></div>` : '<p class="small" style="margin:0"><span class="pill good">Use, size, budget, area, move-in, fit-out and parking are all captured</span></p>'}
    <p class="note">Check these before matching. Change anything in the form and the results update.</p>
  </div>`;
  renderAI();
}

/* ---------------------------------------------------------------
   Form card
   --------------------------------------------------------------- */
function clientOptions() {
  const open = LC.state.clients.filter(c => !['Lost', 'Signed lease'].includes(c.stage) || c.id === S.clientId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return '<option value="">No client (just exploring)</option>' + open.map(c => `<option value="${esc(c.id)}" ${c.id === S.clientId ? 'selected' : ''}>${esc(clientName(c))} · ${esc(c.stage)}</option>`).join('');
}
const nv = (v) => v == null ? '' : v;
function formHtml() {
  const r = S.req; const c = client();
  const lm = LANDMARKS.slice(); if (r.landmark && !lm.find(l => l.name === r.landmark.name)) lm.push({ name: r.landmark.name, city: r.city, lat: r.landmark.lat, lng: r.landmark.lng });
  const byCity = {}; Object.keys(LC.LOCALITIES).forEach(n => { const cc = loc2city(n); (byCity[cc] = byCity[cc] || []).push(n); });
  const bval = S.budgetMode === 'psf' ? r.budgetPsf : r.budgetMonthly;
  return `
  <div class="card-h"><h2>The requirement</h2><span class="spacer"></span><span class="mt-dirty" id="mt-dirty"></span><button type="button" class="btn sm" id="mt-clear">Clear</button></div>
  <div class="card-b stack">
    <div class="field"><label for="mt-client">Load a client</label>
      <div class="row" style="flex-wrap:nowrap"><select class="input" id="mt-client">${clientOptions()}</select>${c && LC.openClient ? '<button type="button" class="btn sm" id="mt-openc">Open</button>' : ''}</div></div>
    <div class="mt-sum" id="mt-summary" title="The requirement in one line">${esc(LC.reqSummary(r))}</div>
    <div class="mt-fgrid">
      <div class="field"><label for="mt-use">Type of use</label><select class="input" id="mt-use" data-k="use"><option value="">Not set</option>${Object.keys(LC.USES).map(u => `<option ${r.use === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
      <div class="field"><label for="mt-smin">Size from (sq ft)</label><input class="input" type="number" min="0" id="mt-smin" data-k="sizeMin" value="${nv(r.sizeMin)}"></div>
      <div class="field"><label for="mt-smax">Size up to (sq ft)</label><input class="input" type="number" min="0" id="mt-smax" data-k="sizeMax" value="${nv(r.sizeMax)}"></div>
      <div class="field"><label for="mt-seats">Seats (if sized by team)</label><input class="input" type="number" min="0" id="mt-seats" data-k="seats" value="${nv(r.seats)}"></div>
      <div class="field" style="grid-column:1/-1"><label for="mt-budget">Budget, all-in (rent plus maintenance)</label>
        <div class="mt-budget"><div class="seg" role="group" aria-label="Budget unit"><button type="button" data-bm="psf" aria-pressed="${S.budgetMode === 'psf'}">₹ per sq ft</button><button type="button" data-bm="monthly" aria-pressed="${S.budgetMode === 'monthly'}">₹ per month</button></div>
        <input class="input" type="number" min="0" id="mt-budget" value="${nv(bval)}" placeholder="${S.budgetMode === 'psf' ? 'For example 70' : 'For example 150000'}"></div></div>
      <div class="field"><label for="mt-city">City</label><select class="input" id="mt-city" data-k="city"><option value="">Not set</option>${CITY_LIST.map(x => `<option ${r.city === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="mt-lm">Near a landmark</label><select class="input" id="mt-lm"><option value="">None</option>${lm.map(l => `<option ${r.landmark && r.landmark.name === l.name ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="mt-rad">Search radius (km)</label><input class="input" type="number" min="0" step="0.5" id="mt-rad" data-k="radiusKm" value="${nv(r.radiusKm)}" placeholder="Default ${LC.defaultRadius(Object.assign({}, r, { radiusKm: null }))}"></div>
      <div class="field"><label for="mt-move">Move-in date</label><input class="input" type="date" id="mt-move" data-k="moveIn" value="${nv(r.moveIn)}"></div>
      <div class="field"><label for="mt-fit">Fit-out needed</label><select class="input" id="mt-fit" data-k="furnishing"><option value="">Not set</option>${LC.FURNISHING.map(x => `<option ${r.furnishing === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label for="mt-park">Car parks</label><input class="input" type="number" min="0" id="mt-park" data-k="parking4w" value="${nv(r.parking4w)}"></div>
      <div class="field"><label for="mt-front">Min frontage (ft)</label><input class="input" type="number" min="0" id="mt-front" data-k="frontageMin" value="${nv(r.frontageMin)}"></div>
      <div class="field"><label for="mt-clear-h">Min clear height (ft)</label><input class="input" type="number" min="0" id="mt-clear-h" data-k="clearHeightMin" value="${nv(r.clearHeightMin)}"></div>
      <div class="field"><label for="mt-lease">Lease (years)</label><input class="input" type="number" min="0" id="mt-lease" data-k="leaseYears" value="${nv(r.leaseYears)}"></div>
      <div class="field"><label for="mt-co">Company</label><input class="input" type="text" id="mt-co" data-k="company" value="${esc(nv(r.company))}"></div>
      <div class="field"><label for="mt-contact">Contact</label><input class="input" type="text" id="mt-contact" data-k="contactName" value="${esc(nv(r.contactName))}"></div>
    </div>
    <div class="mt-group"><span class="lbl">Areas (tap to pick one or more)</span>
      ${Object.keys(byCity).map(cc => `<div class="mt-loc"><span class="cty">${esc(cc)}</span><div class="chips">${byCity[cc].map(n => `<button type="button" class="mt-toggle" data-loc="${esc(n)}" aria-pressed="${r.localities.includes(n)}">${esc(n)}</button>`).join('')}</div></div>`).join('')}
      <span class="small muted">A landmark is used only when no area is picked.</span></div>
    <div class="mt-group"><span class="lbl">Must-haves (a unit that lacks one, or does not say, cannot fully match)</span>
      <div class="mt-checks">
        <label class="checkline"><input type="checkbox" data-k="powerBackup" ${r.powerBackup === '100%' ? 'checked' : ''}> 100% power backup</label>
        <label class="checkline"><input type="checkbox" data-k="groundFloor" ${r.groundFloor ? 'checked' : ''}> Ground floor</label>
        ${AMENITY_LIST.map(a => `<label class="checkline"><input type="checkbox" data-am="${esc(a)}" ${(r.mustHave || []).includes(a) ? 'checked' : ''}> ${esc(a)}</label>`).join('')}
      </div></div>
    <div class="save-area mt-save" id="mt-save">${saveHtml()}</div>
  </div>`;
}
function saveHtml() {
  const c = client(); const r = S.req;
  const src = LC.SOURCES.map(s => `<option>${esc(s)}</option>`).join('');
  return `
    ${c ? `<div class="field"><label for="mt-why">Why did it change? (optional, goes in the client history)</label><input class="input" id="mt-why" type="text" placeholder="For example: asked for more parking on the call"></div>` : ''}
    <div class="row">
      ${c ? `<button type="button" class="btn primary" id="mt-save-btn">Save to ${esc(clientName(c))}</button>` : ''}
      <button type="button" class="btn ${c ? '' : 'primary'}" id="mt-newc-btn">Create a client from this</button>
    </div>
    <div id="mt-saved" class="small" aria-live="polite"></div>
    <div class="mt-newc" id="mt-newc" ${S.showNew ? '' : 'hidden'}>
      <div class="mt-fgrid">
        <div class="field"><label for="mt-nn">Name</label><input class="input" id="mt-nn" type="text" value="${esc(nv(r.contactName))}"></div>
        <div class="field"><label for="mt-np">Phone</label><input class="input" id="mt-np" type="tel" placeholder="+91 98XXX XXXXX"></div>
        <div class="field"><label for="mt-ns">Source</label><select class="input" id="mt-ns">${src}</select></div>
        <div class="field"><label for="mt-nl">Language</label><select class="input" id="mt-nl">${LC.LANGS.map(l => `<option>${l}</option>`).join('')}</select></div>
      </div>
      <div class="mt-err" id="mt-nerr" role="alert"></div>
      <div class="row"><button type="button" class="btn primary" id="mt-ncreate">Create client</button><button type="button" class="btn" id="mt-ncancel">Cancel</button></div>
    </div>`;
}
function renderForm() {
  const el = $('#mt-form'); if (!el) return;
  el.innerHTML = formHtml();
  updateDirty();
}
function updateDirty() {
  const e = $('#mt-dirty'); if (!e) return;
  e.innerHTML = client() ? (dirty() ? '<span class="pill warn">Unsaved changes</span>' : '<span class="pill good">Same as saved</span>') : '';
}
function refreshClientSelect() {
  const s = $('#mt-client'); if (!s) return;
  s.innerHTML = clientOptions();
}
function updateSummary() {
  const e = $('#mt-summary'); if (e) e.textContent = LC.reqSummary(S.req);
  updateDirty();
}
function changed() { updateSummary(); schedule(); }
function schedule() { clearTimeout(tm); tm = setTimeout(runMatch, 200); }

function onFormInput(e) {
  const t = e.target; const k = t.dataset && t.dataset.k;
  const r = S.req;
  if (t.id === 'mt-budget') {
    const v = t.value === '' ? null : parseFloat(t.value);
    if (S.budgetMode === 'psf') { r.budgetPsf = v; r.budgetMonthly = null; } else { r.budgetMonthly = v; r.budgetPsf = null; }
    return changed();
  }
  if (t.id === 'mt-lm') {
    const L = LANDMARKS.find(x => x.name === t.value) || (r.landmark && r.landmark.name === t.value ? r.landmark : null);
    r.landmark = L ? { name: L.name, lat: L.lat, lng: L.lng } : null;
    if (L && !r.city && L.city) { r.city = L.city; const c = $('#mt-city'); if (c) c.value = L.city; }
    return changed();
  }
  if (t.dataset && t.dataset.am) {
    const a = t.dataset.am; const set = new Set(r.mustHave || []);
    if (t.checked) set.add(a); else set.delete(a);
    r.mustHave = Array.from(set); return changed();
  }
  if (!k) return;
  if (t.type === 'checkbox') {
    if (k === 'powerBackup') r.powerBackup = t.checked ? '100%' : null;
    else if (k === 'groundFloor') r.groundFloor = t.checked ? true : null;
    return changed();
  }
  if (t.type === 'number') r[k] = t.value === '' ? null : parseFloat(t.value);
  else r[k] = t.value === '' ? null : t.value;
  changed();
}
function onFormClick(e) {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.loc) {
    const n = t.dataset.loc; const r = S.req; const i = r.localities.indexOf(n);
    if (i >= 0) r.localities.splice(i, 1); else r.localities.push(n);
    t.setAttribute('aria-pressed', String(i < 0));
    if (r.localities.length) { r.city = loc2city(r.localities[0]); const c = $('#mt-city'); if (c) c.value = r.city; }
    return changed();
  }
  if (t.dataset.bm) {
    const mode = t.dataset.bm; if (mode === S.budgetMode) return;
    const r = S.req; const mid = LC.reqSizeMid(r);
    if (mode === 'monthly') { r.budgetMonthly = (r.budgetPsf && mid) ? Math.round(r.budgetPsf * mid / 500) * 500 : null; r.budgetPsf = null; }
    else { r.budgetPsf = (r.budgetMonthly && mid) ? Math.round(r.budgetMonthly / mid) : null; r.budgetMonthly = null; }
    S.budgetMode = mode; renderForm(); return changed();
  }
  if (t.id === 'mt-clear') { S.req = LC.emptyReq(); S.found = []; S.hasExtracted = false; S.text = ''; S.srcText = ''; S.selected.clear(); S.budgetMode = 'psf'; const ta = $('#mt-text'); if (ta) ta.value = ''; renderFound(); renderForm(); runMatch(); return; }
  if (t.id === 'mt-openc') { const c = client(); if (c && LC.openClient) LC.openClient(c.id); return; }
  if (t.id === 'mt-newc-btn') { S.showNew = !S.showNew; const b = $('#mt-newc'); if (b) b.hidden = !S.showNew; return; }
  if (t.id === 'mt-ncancel') { S.showNew = false; const b = $('#mt-newc'); if (b) b.hidden = true; return; }
  if (t.id === 'mt-ncreate') return createClient();
  if (t.id === 'mt-save-btn') return saveToClient();
}
function loadClient(id) {
  const c = LC.crm.get(id);
  if (!c) { S.clientId = null; renderForm(); return runMatch(); }
  S.clientId = id; S.req = clone(c.req); S.found = []; S.hasExtracted = false; S.addTo = true; S.selected.clear();
  setBudgetModeFromReq();
  const cb = $('#mt-addto'); if (cb) cb.checked = true;
  renderFound(); renderForm(); runMatch();
}
function saveToClient() {
  const c = client(); if (!c) return;
  const why = ($('#mt-why') && $('#mt-why').value.trim()) || '';
  LC.crm.setReq(c.id, S.req, LC.state.me, why);
  LC.toast('Requirement saved to ' + clientName(c));
  const e = $('#mt-saved'); if (e) e.innerHTML = '<span class="pill good">Saved to ' + esc(clientName(c)) + '</span>';
  const w = $('#mt-why'); if (w) w.value = '';
  updateDirty(); renderResults();
}
function createClient() {
  const name = ($('#mt-nn').value || '').trim(); const phone = ($('#mt-np').value || '').trim();
  const err = $('#mt-nerr'); err.textContent = '';
  if (!name) { err.textContent = 'Add a name first.'; return; }
  const ex = phone ? LC.crm.findByPhone(phone) : null;
  if (ex) {
    S.showNew = false; S.clientId = ex.id; renderForm();
    const e2 = $('#mt-saved'); if (e2) e2.innerHTML = '<span class="mt-err">' + esc('That number already belongs to ' + clientName(ex) + ' (' + ex.stage + '). Loaded them. Your requirement is kept as unsaved changes, so use Save to update theirs.') + '</span>';
    runMatch(); return;
  }
  const c = LC.crm.add({ name, company: S.req.company || '', phone, source: $('#mt-ns').value, language: $('#mt-nl').value, req: clone(S.req), by: LC.state.me });
  LC.crm.setReq(c.id, S.req, LC.state.me, 'Created from requirement match');
  S.clientId = c.id; S.showNew = false; S.addTo = true;
  LC.toast('Client created: ' + clientName(c));
  renderForm(); const e = $('#mt-saved'); if (e) e.innerHTML = '<span class="pill good">Created ' + esc(clientName(c)) + ' with this requirement</span>';
  runMatch();
}

/* ---------------------------------------------------------------
   Results
   --------------------------------------------------------------- */
function runMatch() {
  clearTimeout(tm);
  if (!hasReq()) { S.res = null; renderResults(); return; }
  try { S.res = LC.match(S.req); } catch (e) { console.error('[match]', e); S.res = null; }
  const ids = new Set(S.res ? S.res.exact.concat(S.res.close).map(r => r.u.unit_id) : []);
  Array.from(S.selected).forEach(id => { if (!ids.has(id)) S.selected.delete(id); });
  renderResults();
}
function ring(score) {
  const C = 2 * Math.PI * 24; const off = C * (1 - score / 100);
  const col = score >= 80 ? 'var(--good)' : score >= 60 ? 'var(--brand)' : 'var(--warn)';
  return `<svg class="score-ring" viewBox="0 0 56 56" role="img" aria-label="Match score ${score} out of 100"><title>Match score ${score} out of 100. It is the weighted average of the six factor scores below.</title><circle cx="28" cy="28" r="24" fill="none" stroke="var(--grid)" stroke-width="5"/><circle cx="28" cy="28" r="24" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 28 28)"/><text x="28" y="33" text-anchor="middle" class="mt-ringt">${score}</text></svg>`;
}
function destText() {
  const r = S.req;
  if (r.landmark) return r.landmark.name + ', Odisha';
  if (r.localities.length) return r.localities[0] + ', Odisha';
  if (r.city) return r.city + ', Odisha';
  return null;
}
function rowHtml(r, isClose) {
  const u = r.u; const sel = S.selected.has(u.unit_id); const fr = LC.unitFreshness(u);
  const ready = LC.readyDate(u, S.req.furnishing); const readyTxt = LC.daysBetween(LC.today(), ready) <= 0 ? 'Ready now' : 'Ready ' + LC.fmtDate(ready);
  const c = client(); const sent = c && c.shared.find(s => s.unitId === u.unit_id);
  const dest = destText();
  const defs = {}; LC.MATCH_FACTORS.forEach(f => defs[f.key] = f);
  return `<div class="match-row" data-unit="${esc(u.unit_id)}">
    <div>${ring(r.score)}</div>
    <div style="min-width:0">
      <div class="row" style="gap:8px"><button type="button" class="mt-title" data-open="${esc(u.unit_id)}">${esc(u.listing_title)}</button>
        <span class="pill ${LC.pillFor(fr.level)}" title="When the owner last confirmed this unit is available and the terms are current">${esc(fr.label)}</span>
        ${sent ? '<span class="pill brand" title="Already shared with this client">Already sent</span>' : ''}</div>
      <div class="mt-meta"><span>${esc(u.locality)}, ${esc(LC.cityOf(u))}</span><span class="price" title="Rent plus maintenance (CAM) per sq ft per month, before GST">₹${esc(u.all_in_per_sqft)}/sq ft all-in</span><span class="price" title="All-in per sq ft times chargeable area, per month, before GST">${esc(LC.fmtLakh(u.all_in_monthly))} a month</span><span>${esc(LC.fmtSqft(u.chargeable_sqft))}</span><span>${esc(u.furnishing)}</span><span title="Date the occupier could start trading, counting the fit-out time to the condition they asked for">${esc(readyTxt)}</span></div>
      <div class="factors">${r.factors.map(f => `<div class="factor" title="${esc(f.label + ', weight ' + f.weight + '%. ' + (defs[f.key] ? defs[f.key].def : ''))}"><div class="fl"><span>${esc(f.label)}</span><b>${f.score}</b></div><div class="ft"><i class="${f.score === 0 ? 'zero' : f.score < 60 ? 'lo' : ''}" style="width:${f.score === 0 ? 3 : f.score}%"></i></div><div class="mt-fnote">${esc(f.note)}</div></div>`).join('')}</div>
      ${isClose ? `<div class="mt-miss"><b>Misses:</b> ${r.missed.map(m => esc(m.label) + ' (' + esc(m.note) + ')').join('; ')}</div>` : `<div class="why">${esc(r.why)}</div>`}
      ${u.data_flag ? `<div class="mt-flag"><span class="pill warn">Check before offering</span><span class="small">${esc(u.data_flag)}</span></div>` : ''}
    </div>
    <div class="mt-side">
      <label class="checkline"><input type="checkbox" data-sel="${esc(u.unit_id)}" ${sel ? 'checked' : ''}> Select</label>
      ${r.km != null ? `<span class="small muted" title="Straight-line distance to the nearest requested area or landmark">${r.km.toFixed(1)} km away</span>` : ''}
      <a href="${esc(LC.mapsLink(u, dest))}" target="_blank" rel="noopener">Directions</a>
    </div></div>`;
}
function gapNotes(res) {
  const out = []; const avail = LC.state.units.filter(u => u.status === 'Available');
  if (S.req.frontageMin) { const n = avail.filter(u => u.frontage_ft == null).length; out.push(n + ' of ' + avail.length + ' available units have no frontage on file (offices and warehouses mostly). A unit with no value cannot pass a frontage must-have.'); }
  if (S.req.clearHeightMin) { const n = avail.filter(u => u.clear_height_ft == null).length; out.push(n + ' of ' + avail.length + ' available units have no clear height on file (only warehouses and sheds have it). A unit with no value cannot pass this must-have.'); }
  if (res && !res.exactCount && !res.closeCount) {
    const top = Object.entries(res.excluded).filter(([k]) => !['status', 'stale', 'use'].includes(k)).sort((a, b) => b[1] - a[1])[0];
    const rule = top && LC.MATCH_RULES.find(x => x.key === top[0]);
    out.push('Nothing fits right now.' + (rule ? ' The most common reason is "' + rule.label.toLowerCase() + '" (' + top[1] + ' units). Try widening that one first.' : ' Check the type of use and the area.'));
  }
  return out;
}
function renderResults() {
  const el = $('#mt-results'); if (!el) return;
  updateSummary();
  if (!hasReq() || !S.res) {
    el.innerHTML = `<div class="card"><div class="card-h"><h2>What fits</h2></div><div class="card-b stack"><div class="empty">No requirement yet. Capture one on the left, load a client, or try a sample.</div>${sampleChips()}</div></div>${howHtml()}`;
    return;
  }
  const res = S.res; const total = res.considered; const K = total - res.exactCount - res.closeCount;
  const ex = S.showAllExact ? res.exact : res.exact.slice(0, 8); const cl = S.showAllClose ? res.close : res.close.slice(0, 5);
  const closeByKey = {}; res.close.forEach(r => { const k = r.missed[0].key; closeByKey[k] = (closeByKey[k] || 0) + 1; });
  const notShown = Object.entries(res.excluded).map(([k, n]) => [k, n - (closeByKey[k] || 0)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const nSel = S.selected.size; const gaps = gapNotes(res); const c = client();
  const ruleOf = (k) => LC.MATCH_RULES.find(r => r.key === k) || { label: k, def: '' };
  el.innerHTML = `
  <div class="card">
    <div class="card-h"><h2>What fits</h2><span class="spacer"></span>
      <div class="mt-actions"><span class="small muted" id="mt-nsel">${nSel} selected</span>
        <button type="button" class="btn sm primary" id="mt-wa" ${nSel ? '' : 'disabled'}>Send on WhatsApp</button>
        <button type="button" class="btn sm" id="mt-cmp" ${nSel ? '' : 'disabled'}>Compare</button>
        <button type="button" class="btn sm" id="mt-book" ${nSel ? '' : 'disabled'}>Book a visit</button></div></div>
    <div class="card-b stack">
      <div class="mt-count" id="mt-count"><span title="Units that pass every must-have: use, size, budget, area, specs and ready date, and are not flagged."><b>${res.exactCount}</b> fit every must-have</span><span class="sep">·</span><span title="Units that miss exactly one must-have. Each one shows what it misses."><b>${res.closeCount}</b> close options</span><span class="sep">·</span><span title="Units left out because they miss two or more must-haves, or are not available, or have not been confirmed by the owner in ${LC.settings().freshnessDays} days."><b>${K}</b> excluded</span></div>
      <p class="lede">${esc(LC.reqSummary(S.req))}</p>
      <p class="small muted" style="margin:0">${total} units on the desk. Only units the owner confirmed in the last ${LC.settings().freshnessDays} days are matched. Scores run from 0 to 100; hover a score or a bar for its meaning.${c ? ' Matching for ' + esc(clientName(c)) + '.' : ''}</p>
      ${gaps.map(g => `<div class="mt-gap">${esc(g)}</div>`).join('')}
    </div>
  </div>
  <div class="card">
    <div class="card-h"><h3>Fits every must-have</h3><span class="pill good">${res.exactCount}</span></div>
    ${ex.length ? ex.map(r => rowHtml(r, false)).join('') : '<div class="empty">No unit passes every must-have. See the close options below.</div>'}
    ${res.exact.length > 8 ? `<div class="mt-more"><button type="button" class="btn sm" id="mt-all-ex">${S.showAllExact ? 'Show fewer' : 'Show all ' + res.exact.length}</button></div>` : ''}
  </div>
  <div class="card">
    <div class="card-h"><h3>Close options</h3><span class="pill warn">${res.closeCount}</span><span class="small muted">Each misses exactly one must-have.</span></div>
    ${cl.length ? cl.map(r => rowHtml(r, true)).join('') : '<div class="empty">No close options.</div>'}
    ${res.close.length > 5 ? `<div class="mt-more"><button type="button" class="btn sm" id="mt-all-cl">${S.showAllClose ? 'Show fewer' : 'Show all ' + res.close.length}</button></div>` : ''}
  </div>
  <div class="card">
    <div class="card-h"><h3>Not shown</h3><span class="pill">${K}</span></div>
    <div class="card-b">${notShown.length ? `<dl class="defs">${notShown.map(([k, n]) => `<dt>${esc(ruleOf(k).label)}: ${n}</dt><dd>${esc(ruleOf(k).def)}</dd>`).join('')}</dl><p class="note" style="margin-top:12px">Each unit is counted once, under the first rule it failed.</p>` : '<p class="small muted" style="margin:0">Every unit on the desk is shown above.</p>'}</div>
  </div>
  ${howHtml()}`;
}
function howHtml() {
  return `<details class="card mt-how" id="mt-how"><summary>How the match works</summary><div class="body">
    <ol>
      <li><b>Must-haves are hard filters.</b> A unit that lacks one, or has no value on file, does not pass. Unknown is never treated as a yes.</li>
      <li><b>Flagged units never go out automatically.</b> They show "Check before offering" and a person looks at them first.</li>
      <li><b>Rank what passes, and show near misses.</b> Units that pass are ranked by the weighted score. Units that miss exactly one must-have appear as close options, with what they miss.</li>
    </ol>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Factor</th><th class="r">Weight</th><th>How it is scored</th></tr></thead><tbody>
      ${LC.MATCH_FACTORS.map(f => `<tr><td>${esc(f.label)}</td><td class="r num">${f.weight}%</td><td>${esc(f.def)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="note">This is the renter match we built and run for a US leasing operation, with the factors changed for commercial space.</p>
  </div></details>`;
}

/* ---------------------------------------------------------------
   Selected-unit actions
   --------------------------------------------------------------- */
function selIds() {
  if (!S.res) return [];
  return S.res.exact.concat(S.res.close).map(r => r.u.unit_id).filter(id => S.selected.has(id));
}
function openWhatsApp() {
  const ids = selIds(); if (!ids.length) return;
  const c = client(); let lang = (c && LC.LANGS.includes(c.language)) ? c.language : 'English';
  const sentIds = ids.slice(0, 3);
  const flagged = sentIds.map(id => LC.unit(id)).filter(u => u && u.data_flag);
  const d = LC.drawer({ title: 'Send on WhatsApp', sub: c ? 'To ' + esc(clientName(c)) + (c.phone ? ' · ' + esc(c.phone) : '') : 'No client loaded', html: `
    <div class="field"><label for="mt-wl">Language</label><select class="input" id="mt-wl">${LC.LANGS.map(l => `<option ${l === lang ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${ids.length > 3 ? '<p class="note">One message carries up to 3 units. The first 3 selected are in it.</p>' : ''}
    ${flagged.length ? `<div class="mt-warn">${flagged.length === 1 ? 'One unit in this message is' : 'Some units in this message are'} flagged: ${esc(flagged.map(u => u.unit_id + ': ' + u.data_flag).join(' '))} Check before you send.</div>` : ''}
    <div class="mt-wa"><div class="bub out" id="mt-wtext"></div></div>
    <p class="small muted" id="mt-wnote"></p>
    <div class="row"><button type="button" class="btn" id="mt-wcopy">Copy</button>
      ${c ? `<button type="button" class="btn primary" id="mt-wmark">Mark as sent to ${esc(clientName(c))}</button>` : '<span class="small muted">Load a client in the form to log this against their record.</span>'}</div>
    <div id="mt-wdone" class="small" aria-live="polite"></div>` });
  const q = (s) => d.el.querySelector(s);
  const fill = () => { lang = q('#mt-wl').value; const t = LC.shareText(sentIds, S.req, lang); q('#mt-wtext').textContent = t; q('#mt-wnote').textContent = lang === 'English' ? '' : lang + ' text is a draft. Have a native speaker read it before you send.'; };
  fill();
  q('#mt-wl').addEventListener('change', fill);
  q('#mt-wcopy').addEventListener('click', () => LC.copy(q('#mt-wtext').textContent));
  const mk = q('#mt-wmark');
  if (mk) mk.addEventListener('click', () => { LC.crm.share(c.id, sentIds, LC.state.me, 'WhatsApp'); mk.disabled = true; q('#mt-wdone').innerHTML = '<span class="pill good">Marked as sent to ' + esc(clientName(c)) + '</span>'; renderResults(); });
}
function onResultsClick(e) {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.open) { return LC.openUnit ? LC.openUnit(t.dataset.open) : LC.toast('The listing detail is not available in this build.'); }
  if (t.id === 'mt-all-ex') { S.showAllExact = !S.showAllExact; return renderResults(); }
  if (t.id === 'mt-all-cl') { S.showAllClose = !S.showAllClose; return renderResults(); }
  if (t.id === 'mt-wa') return openWhatsApp();
  if (t.id === 'mt-cmp') { const ids = selIds(); return LC.openCompare ? LC.openCompare(ids) : LC.toast('Compare is not available in this build.'); }
  if (t.id === 'mt-book') {
    const ids = selIds(); const c = client();
    if (!c) return LC.toast('Load or create a client first, then book the visit.');
    return LC.openBookVisit ? LC.openBookVisit({ clientId: c.id, unitId: ids[0] }) : LC.toast('Booking is not available in this build.');
  }
}
function onResultsChange(e) {
  const id = e.target.dataset && e.target.dataset.sel; if (!id) return;
  if (e.target.checked) S.selected.add(id); else S.selected.delete(id);
  const n = S.selected.size;
  const a = $('#mt-nsel'); if (a) a.textContent = n + ' selected';
  ['#mt-wa', '#mt-cmp', '#mt-book'].forEach(s => { const b = $(s); if (b) b.disabled = !n; });
}

/* ---------------------------------------------------------------
   Capture inputs: samples, voice, voice note, document
   --------------------------------------------------------------- */
function loadSample(id) {
  const s = SAMPLES.find(x => x.id === id); if (!s) return;
  S.tab = 'type'; freshUnlessClient();
  syncTabs(); setText(s.text); extract(s.text, 'typed text');
  const el = $('#mt-found'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function freshUnlessClient() { if (!client()) { S.addTo = false; const cb = $('#mt-addto'); if (cb) cb.checked = false; } }
function syncTabs() {
  LC.$$('[data-tab]', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  ['type', 'speak', 'note', 'doc'].forEach(id => { const p = $('#mt-p-' + id); if (p) p.hidden = S.tab !== id; });
}
const VOICE_MSG = 'Voice input needs microphone access. It works when this demo file is opened in Chrome. Here, try a sample voice note or type it.';
function voiceFail(msg) {
  S.listening = false; S.voiceMsg = msg || VOICE_MSG;
  const m = $('#mt-voice-msg'); if (m) { m.textContent = S.voiceMsg; m.hidden = false; }
  paintMic();
}
function paintMic() {
  const b = $('#mt-mic-t'); if (b) b.textContent = S.listening ? 'Stop' : 'Start speaking';
  const mb = $('#mt-mic'); if (mb) mb.classList.toggle('primary', !S.listening);
  paintLive();
}
function paintLive() {
  const l = $('#mt-live'); if (!l) return;
  const t = (S.liveFinal + ' ' + S.liveInterim).trim();
  l.innerHTML = (S.listening ? '<span class="mt-rec"></span>' : '') + (t ? esc(S.liveFinal) + (S.liveInterim ? ' <i>' + esc(S.liveInterim) + '</i>' : '') : '<i>' + (S.listening ? 'Listening...' : 'Your words show up here as you speak.') + '</i>');
}
function toggleMic() {
  if (S.listening && rec) { try { rec.stop(); } catch (e) { /* already stopped */ } return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return voiceFail();
  const m = $('#mt-voice-msg'); if (m) m.hidden = true;
  let r;
  try { r = new SR(); } catch (e) { return voiceFail(); }
  rec = r; S.liveFinal = ''; S.liveInterim = '';
  let failed = false;
  try {
    r.lang = $('#mt-lang').value || 'en-IN'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    r.onstart = () => { S.listening = true; paintMic(); };
    r.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const x = ev.results[i]; if (x.isFinal) S.liveFinal += (S.liveFinal ? ' ' : '') + x[0].transcript.trim(); else interim += x[0].transcript; }
      S.liveInterim = interim; paintLive();
    };
    r.onerror = (ev) => {
      const code = ev && ev.error;
      if (code === 'no-speech' || code === 'aborted') { S.voiceMsg = 'I did not hear anything. Try again, closer to the microphone.'; const mm = $('#mt-voice-msg'); if (mm) { mm.textContent = S.voiceMsg; mm.hidden = false; } return; }
      failed = true; voiceFail();
    };
    r.onend = () => {
      S.listening = false; rec = null;
      const t = (S.liveFinal + ' ' + S.liveInterim).trim(); S.liveFinal = t; S.liveInterim = '';
      paintMic();
      if (t && !failed) { setText(t); freshUnlessClient(); extract(t, 'what you said'); }
    };
    r.start();
  } catch (e) { voiceFail(); }
}
function showAudio(file) {
  if (S.noteUrl) { URL.revokeObjectURL(S.noteUrl); S.noteUrl = null; }
  const box = $('#mt-audio-box'); if (!box) return;
  if (!file) { box.innerHTML = ''; return; }
  S.noteUrl = URL.createObjectURL(file); S.noteName = file.name;
  box.innerHTML = `<div class="stack"><div class="small"><b>${esc(file.name)}</b> · ${Math.max(1, Math.round(file.size / 1024))} KB</div><audio class="mt-audio" controls src="${S.noteUrl}"></audio><p class="mt-warn">This demo cannot turn the sound into text. Listen to it, type what was said in the box below, or pick a sample voice note.</p></div>`;
}
function readDoc(file) {
  const box = $('#mt-doc-box'); if (!box || !file) return;
  if (S.docImgUrl) { URL.revokeObjectURL(S.docImgUrl); S.docImgUrl = null; } S.docImg = null;
  const name = file.name || 'file'; const ext = (name.split('.').pop() || '').toLowerCase();
  if (/^image\//.test(file.type) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(ext)) {
    S.docImg = file; S.docImgUrl = URL.createObjectURL(file);
    box.innerHTML = `<div class="stack"><img src="${S.docImgUrl}" alt="Uploaded image" style="max-width:100%;max-height:220px;object-fit:contain;border:1px solid var(--hair);border-radius:var(--r-s)">
      ${LC.ai.sample ? '<div><button type="button" class="btn" id="mt-img-ai"><span class="ai-tag">' + LC.aiName + '</span> Read with ' + LC.aiName + '</button></div>' : '<p class="mt-warn">Reading an image needs ' + LC.aiName + ', which is not connected in this view. In the live product, images are read on our server. Type the text from the image into the first tab for now.</p>'}</div>`;
    const b = $('#mt-img-ai'); if (b) b.addEventListener('click', async () => { b.disabled = true; await aiExtract('', file); b.disabled = false; });
    renderAI(); return;
  }
  if (['pdf', 'doc', 'docx'].includes(ext)) {
    box.innerHTML = '<p class="mt-warn">PDF and Word files are read on our server in the live product. Copy the text in here for now.</p><div><button type="button" class="btn sm" id="mt-to-type">Go to Type or paste</button></div>';
    const b = $('#mt-to-type'); if (b) b.addEventListener('click', () => { S.tab = 'type'; syncTabs(); const ta = $('#mt-text'); if (ta) ta.focus(); });
    return;
  }
  if (file.size > 400 * 1024) { box.innerHTML = '<p class="mt-warn">That file is large. Use a file under 400 KB, or paste the part that has the requirement.</p>'; return; }
  const fr = new FileReader();
  fr.onerror = () => { box.innerHTML = '<p class="mt-warn">I could not read that file. Try pasting the text instead.</p>'; };
  fr.onload = () => {
    let txt = String(fr.result || '');
    if (ext === 'eml') { const i = txt.search(/\r?\n\r?\n/); const head = i > 0 ? txt.slice(0, i) : ''; const sub = (head.match(/^Subject:\s*(.+)$/mi) || [])[1]; txt = (sub ? 'Subject: ' + sub + '\n\n' : '') + (i > 0 ? txt.slice(i).trim() : txt); }
    if (!txt.trim()) { box.innerHTML = '<p class="mt-warn">That file has no text in it.</p>'; return; }
    box.innerHTML = '<p class="small muted">Read ' + esc(name) + '. The text is in the first tab if you want to edit it.</p>';
    setText(txt); freshUnlessClient(); extract(txt, name);
  };
  fr.readAsText(file);
}

function bindCapture() {
  const r = root;
  r.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; syncTabs(); return; }
    const sm = e.target.closest('[data-sample]'); if (sm) return loadSample(sm.dataset.sample);
    const vo = e.target.closest('[data-voice]');
    if (vo) { const v = VOICE.find(x => x.id === vo.dataset.voice); if (v) { freshUnlessClient(); setText(v.text); const nt = $('#mt-note-text'); if (nt) nt.value = v.text; extract(v.text, 'sample voice note: ' + v.caller + ', ' + v.lang); } return; }
    if (e.target.closest('#mt-go')) return extract(($('#mt-text') || {}).value, 'typed text');
    if (e.target.closest('#mt-note-go')) { const v = ($('#mt-note-text') || {}).value; setText(v); return extract(v, 'voice note'); }
    if (e.target.closest('#mt-mic')) return toggleMic();
  });
  r.addEventListener('change', (e) => {
    if (e.target.id === 'mt-addto') S.addTo = e.target.checked;
    if (e.target.id === 'mt-audio-file') showAudio(e.target.files && e.target.files[0]);
    if (e.target.id === 'mt-doc-file') readDoc(e.target.files && e.target.files[0]);
  });
  r.addEventListener('input', (e) => { if (e.target.id === 'mt-text') S.text = e.target.value; });
}

/* ---------------------------------------------------------------
   View
   --------------------------------------------------------------- */
LC.registerView('match', {
  title: 'Requirement match',
  sub: 'Capture what the occupier needs, then see what fits and why',
  render(el, param) {
    root = el;
    if (param && (param.clientId || param.req || param.text)) {
      S.showAllExact = false; S.showAllClose = false; S.selected.clear();
      if (param.clientId && LC.crm.get(param.clientId)) { S.clientId = param.clientId; S.req = clone(LC.crm.get(param.clientId).req); S.addTo = true; S.found = []; S.hasExtracted = false; S.tab = 'type'; }
      if (param.req) { S.req = Object.assign(LC.emptyReq(), clone(param.req)); if (!param.clientId) S.clientId = null; S.found = []; S.hasExtracted = false; }
      setBudgetModeFromReq();
    }
    el.innerHTML = `<div class="grid-2 mt-top"><div id="mt-capture">${captureHtml()}</div><div class="card" id="mt-form"></div></div><div id="mt-results" class="stack" style="gap:20px"></div>`;
    if (!el._mtBound) {
      el._mtBound = true;
      bindCapture();
      el.addEventListener('input', (e) => { if (e.target.closest('#mt-form')) onFormInput(e); });
      el.addEventListener('change', (e) => {
        if (e.target.id === 'mt-client') loadClient(e.target.value);
        if (e.target.closest('#mt-results')) onResultsChange(e);
      });
      el.addEventListener('click', (e) => { if (e.target.closest('#mt-form')) onFormClick(e); if (e.target.closest('#mt-results')) onResultsClick(e); });
    }
    renderForm(); renderFound(); renderAI(); paintMic();
    if (S.hasExtracted === false && !S.text) { /* nothing extracted yet */ }
    runMatch();
    if (param && param.text) { S.tab = 'type'; syncTabs(); if (param.clientId) S.addTo = true; setText(param.text); extract(param.text, 'typed text'); }
  },
  onHide() {
    clearTimeout(tm);
    if (rec) { try { rec.abort(); } catch (e) { /* ignore */ } rec = null; S.listening = false; }
    if (S.noteUrl) { URL.revokeObjectURL(S.noteUrl); S.noteUrl = null; }
    if (S.docImgUrl) { URL.revokeObjectURL(S.docImgUrl); S.docImgUrl = null; }
  },
});

LC.on('clients:changed', () => { if (LC.isActive('match')) { refreshClientSelect(); updateDirty(); } });
LC.on('units:changed', () => { if (LC.isActive('match')) runMatch(); });
LC.on('ai:ready', () => { if (LC.isActive('match')) renderAI(); });
LC.on('reset', () => { S.req = LC.emptyReq(); S.clientId = null; S.found = []; S.hasExtracted = false; S.text = ''; S.srcText = ''; S.selected.clear(); S.res = null; });
})();
