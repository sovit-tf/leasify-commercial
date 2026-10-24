/* =====================================================================
   Leasify Commercial demo: OWNER PORTAL (view 'owners')
   Weekly owner report, WhatsApp preview, availability check, owner co-pilot.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const DAY = LC.DAY;

LC.css(`
#v-owners { grid-template-columns: minmax(0, 1fr); }
#v-owners > * { min-width: 0; }
#own-data, #own-top, #own-chatwrap { display: grid; gap: 20px; min-width: 0; }
.own-bar { display: flex; gap: 14px 18px; flex-wrap: wrap; align-items: end; }
.own-bar .own-pick { min-width: 260px; flex: 1 1 260px; max-width: 420px; }
.own-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 12.5px; color: var(--fg-2); }
.own-banner { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; background: var(--glow); border: 1px solid transparent; border-radius: var(--r); padding: 12px 16px; font-size: 13.5px; }
.own-banner b { font-weight: 600; }
.own-sel td { background: var(--glow); }
.own-reps { display: grid; gap: 16px; min-width: 0; }
.own-side { display: grid; gap: 16px; min-width: 0; align-content: start; }
.mini-kpis.own-mk { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.own-mk div[title] { cursor: help; }
.own-sug { background: var(--surface-2); }
.own-sug p { margin: 0; font-size: 13.5px; }
.own-sug .eyebrow { margin-bottom: 2px; }
.own-internal { background: var(--warn-bg); }
.own-internal h4 { color: var(--warn); }
.own-internal .kv b { font-size: 12.5px; }
.own-sim { display: grid; gap: 6px; }
.own-sim .hbar { grid-template-columns: 110px minmax(0, 1fr) 70px; }
.own-sim .hbar + .hbar { margin-top: 0; }
.own-wa.phone { height: auto; max-height: 560px; max-width: 360px; }
.own-wa .wa-body { min-height: 220px; padding-bottom: 14px; }
.own-wa .bub { max-width: 96%; }
.own-wa .bub.in { max-width: 96%; }
.own-av { display: grid; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--hair); }
.own-av:last-child { border-bottom: 0; }
.own-av .btns { display: flex; gap: 6px; flex-wrap: wrap; }
.own-av .res { font-size: 12px; color: var(--fg-2); }
.own-ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 4px; font-size: 13px; }
.own-chatcard .chat { height: 460px; }
.own-chips { padding: 8px 18px; border-top: 1px solid var(--hair); }
.own-q { font-size: 12.5px; color: var(--fg-2); margin: 0 0 6px; }
.own-dl { margin-top: 4px; }
@media (max-width: 860px) {
  .mini-kpis.own-mk { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .own-bar .own-pick { max-width: none; }
  .own-chatcard .chat { height: 520px; }
}
`);

/* ---------------- module state ---------------- */
const st = { owner: null, mode: 'team', lang: 'English', chats: {}, replies: {}, sent: {} };
let root = null;
const E = LC.esc;

const DEF = {
  units: 'Units of this owner in our listings, in any status.',
  available: 'Units whose status is Available.',
  enq: 'Distinct clients who were sent one of these units on WhatsApp, or who visited or booked a visit to it, in the last 30 days.',
  enqW: 'The same count for the last 7 days.',
  visits: 'Site visits marked Done in the last 7 days.',
  visitsM: 'Site visits marked Done in the last 30 days.',
  offers: 'Clients now at Proposal, Letter of intent or Signed lease for this unit (a term sheet was sent for it or it is their chosen unit).',
  days: 'Days since the listing date, for units that are not yet leased.',
  sim: 'Other units of the same property type within 3 km (for warehouses and industrial sheds: the same city). The median is of their all-in rent per sq ft. All-in means rent plus maintenance.',
  leased: 'Similar units marked Leased, or with a lease signed in the last 30 days.',
};

/* ---------------- data helpers ---------------- */
const unitName = (u) => u.building_name + ' ' + u.unit_no;
const psf = (n) => '₹' + (Math.round(n * 10) / 10) + '/sq ft';
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

function ownersList() {
  const g = LC.groupBy(LC.state.units, u => u.owner_name);
  return Object.keys(g).map(name => ({ name, type: g[name][0].owner_type, units: g[name] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function ownerObj(name) { return ownersList().find(o => o.name === name); }
/* signed in as an owner: the portal is locked to that owner's own units, in owner view */
const lockedOwner = () => (LC.session && LC.session.role === 'owner' && LC.session.owner) || null;
function ensureOwner() {
  const list = ownersList();
  if (!list.length) return null;
  const lk = lockedOwner(); if (lk && list.find(o => o.name === lk)) { st.owner = lk; st.mode = 'owner'; }
  if (!st.owner || !list.find(o => o.name === st.owner)) {
    st.owner = list.slice().sort((a, b) => b.units.length - a.units.length || a.name.localeCompare(b.name))[0].name;
  }
  return ownerObj(st.owner);
}

function signedTs(c) { const h = (c.stageHistory || []).filter(x => x.stage === 'Signed lease').pop(); return h ? h.ts : c.updatedAt; }

function similarOf(u) {
  const wh = ['Warehouse', 'Industrial shed'].includes(u.property_type);
  return LC.state.units.filter(x => x.unit_id !== u.unit_id && x.property_type === u.property_type &&
    (wh ? LC.cityOf(x) === LC.cityOf(u) : LC.dist(u.lat, u.lng, x.lat, x.lng) <= 3));
}

function unitStats(u) {
  const S = LC.state, now = Date.now(), d7 = now - 7 * DAY, d30 = now - 30 * DAY, id = u.unit_id;
  const vis = S.visits.filter(v => v.unitId === id);
  const enqSet = (cut) => {
    const s = new Set();
    S.clients.forEach(c => { if ((c.shared || []).some(x => x.unitId === id && x.ts >= cut)) s.add(c.id); });
    vis.forEach(v => { if (v.when >= cut && v.status !== 'Cancelled' && v.status !== 'No-show') s.add(v.clientId); });
    return s;
  };
  const done = vis.filter(v => v.status === 'Done');
  const offers = S.clients.filter(c => LC.STAGES.indexOf(c.stage) >= 3 &&
    (c.unitId === id || (c.timeline || []).some(e => e.type === 'document' && String(e.text).indexOf('for ' + id) >= 0)));
  const fb = done.filter(v => v.feedback).sort((a, b) => b.when - a.when);
  const upcoming = vis.filter(v => v.status === 'Booked' && v.when > now).sort((a, b) => a.when - b.when);
  const sims = similarOf(u);
  const med = LC.median(sims.map(x => x.all_in_per_sqft));
  const diff = med ? Math.round((u.all_in_per_sqft - med) / med * 100) : null;
  const leased30 = sims.filter(x => x.status === 'Leased' ||
    S.clients.some(c => c.stage === 'Signed lease' && c.unitId === x.unit_id && signedTs(c) >= d30)).length;
  const s = {
    u, enq7: enqSet(d7).size, enq30: enqSet(d30).size,
    visits7: done.filter(v => v.when >= d7).length, visits30: done.filter(v => v.when >= d30).length, visitsAll: done.length,
    offers, feedback: fb, upcoming,
    days: u.status === 'Leased' ? null : Math.max(0, LC.daysAgo(u.listed_date)),
    fresh: LC.unitFreshness(u),
    sim: { n: sims.length, median: med, diff, leased30 },
  };
  s.sug = suggestKey(u, s);
  return s;
}

/* "What we suggest": simple rules, first match wins */
function suggestKey(u, s) {
  if (u.status === 'Leased') return 'leased';
  if (u.status !== 'Available') return 'deal';
  if (s.offers.length) return 'offer';
  if (s.sim.n >= 1 && s.sim.diff != null && s.sim.diff > 10 && s.visitsAll >= 3) return 'price';
  if (s.fresh.days >= 7) return 'confirm';
  if (s.enq30 === 0) return 'few';
  return 'steady';
}
const SUG = {
  price: {
    English: 'Visitors like the space but compare it with cheaper units nearby. A 60-day rent-free period may close faster than a rent cut.',
    Hindi: 'आने वाले लोगों को जगह पसंद आती है, पर वे आसपास की सस्ती यूनिट से तुलना करते हैं। किराया घटाने से ज़्यादा जल्दी सौदा 60 दिन के रेंट-फ्री से हो सकता है।',
    Odia: 'ଦେଖିବାକୁ ଆସୁଥିବା ଲୋକଙ୍କୁ ସ୍ଥାନଟି ଭଲ ଲାଗୁଛି, କିନ୍ତୁ ସେମାନେ ପାଖର ସସ୍ତା ୟୁନିଟ୍ ସହ ତୁଳନା କରୁଛନ୍ତି। ଭଡ଼ା କମାଇବା ଅପେକ୍ଷା ୬୦ ଦିନର ଭଡ଼ା-ମୁକ୍ତ ଅବଧି ଦେଲେ ଚୁକ୍ତି ଶୀଘ୍ର ହୋଇପାରେ।',
  },
  confirm: {
    English: 'Please confirm availability so we keep showing it.',
    Hindi: 'कृपया उपलब्धता की पुष्टि करें, ताकि हम इसे दिखाते रहें।',
    Odia: 'ଦୟାକରି ଉପଲବ୍ଧତା ନିଶ୍ଚିତ କରନ୍ତୁ, ଯେପରି ଆମେ ଏହାକୁ ଦେଖାଉଥିବୁ।',
  },
  few: {
    English: 'Few enquiries match this size. We suggest allowing smaller splits or retail use, if the building permits.',
    Hindi: 'इस साइज़ के लिए कम पूछताछ आ रही है। अगर बिल्डिंग इजाज़त दे, तो छोटे हिस्सों में बाँटने या रिटेल उपयोग की अनुमति दें।',
    Odia: 'ଏହି ଆକାର ପାଇଁ କମ୍ ପଚରାଉଚରା ଆସୁଛି। ବିଲ୍ଡିଂ ଅନୁମତି ଦେଲେ, ଛୋଟ ଭାଗରେ ବିଭକ୍ତ କରିବା କିମ୍ବା ରିଟେଲ ବ୍ୟବହାରକୁ ଅନୁମତି ଦେବାକୁ ଆମେ ପରାମର୍ଶ ଦେଉଛୁ।',
  },
  steady: {
    English: 'Interest is steady. No change needed.',
    Hindi: 'रुचि बनी हुई है। किसी बदलाव की ज़रूरत नहीं।',
    Odia: 'ଆଗ୍ରହ ସ୍ଥିର ଅଛି। କୌଣସି ପରିବର୍ତ୍ତନ ଦରକାର ନାହିଁ।',
  },
  deal: {
    English: 'A deal is in progress. We will tell you as soon as terms are agreed.',
    Hindi: 'सौदा चल रहा है। शर्तें तय होते ही हम आपको बताएँगे।',
    Odia: 'ଚୁକ୍ତି ଆଲୋଚନା ଚାଲିଛି। ସର୍ତ୍ତ ଠିକ୍ ହେଲେ ଆମେ ଆପଣଙ୍କୁ ଜଣାଇବୁ।',
  },
  offer: {
    English: 'You have an offer on this unit. Your listing agent will call you to go through the terms.',
    Hindi: 'इस यूनिट पर ऑफ़र आया है। आपके लिस्टिंग एजेंट शर्तों पर बात करने के लिए आपको कॉल करेंगे।',
    Odia: 'ଏହି ୟୁନିଟ୍ ପାଇଁ ଏକ ପ୍ରସ୍ତାବ ଆସିଛି। ସର୍ତ୍ତ ବିଷୟରେ କହିବା ପାଇଁ ଆପଣଙ୍କ ଲିଷ୍ଟିଂ ଏଜେଣ୍ଟ କଲ୍ କରିବେ।',
  },
  leased: {
    English: 'This unit is leased. No action needed.',
    Hindi: 'यह यूनिट किराये पर जा चुकी है। किसी कार्रवाई की ज़रूरत नहीं।',
    Odia: 'ଏହି ୟୁନିଟ୍ ଭଡ଼ାରେ ଦିଆଯାଇଛି। କୌଣସି କାର୍ଯ୍ୟ ଦରକାର ନାହିଁ।',
  },
};
const sugText = (s, lang = 'English') => SUG[s.sug][lang] || SUG[s.sug].English;

/* ---------------- WhatsApp report text ---------------- */
const MSG = {
  English: {
    hello: (o, d) => `Hello ${o}, this is your weekly report from Leasify Commercial, for the week to ${d}.`,
    enq: (w, m) => `Enquiries: ${w} this week, ${m} this month`,
    vis: (n) => `Visits this week: ${n}`,
    off: (n) => `Offers: ${n}`,
    days: (n) => `On the market ${n} days`,
    sim: (n, x, y, p) => n ? `Similar units nearby (${n}): ${x}, yours ${y} (${p})` : 'Similar units nearby: none to compare',
    above: (p) => `${p}% above`, below: (p) => `${p}% below`, inline: 'in line',
    sug: 'Our suggestion:',
    reply: 'Reply 1 if a unit is still available, 2 if something changed, 3 if it is leased.',
    leasedNote: (n) => n ? `${n} similar leased in 30 days` : '',
  },
  Hindi: {
    hello: (o, d) => `नमस्ते ${o}, यह Leasify Commercial की ओर से ${d} तक के हफ़्ते की आपकी रिपोर्ट है।`,
    enq: (w, m) => `पूछताछ: इस हफ़्ते ${w}, इस महीने ${m}`,
    vis: (n) => `इस हफ़्ते विज़िट: ${n}`,
    off: (n) => `ऑफ़र: ${n}`,
    days: (n) => `बाज़ार में ${n} दिन से`,
    sim: (n, x, y, p) => n ? `आसपास की समान यूनिट (${n}): ${x}, आपकी ${y} (${p})` : 'आसपास तुलना के लिए कोई समान यूनिट नहीं',
    above: (p) => `${p}% ऊपर`, below: (p) => `${p}% नीचे`, inline: 'बराबर',
    sug: 'हमारा सुझाव:',
    reply: 'यूनिट अभी उपलब्ध है तो 1, कुछ बदला है तो 2, किराये पर जा चुकी है तो 3 भेजें।',
    leasedNote: (n) => n ? `30 दिन में ${n} समान यूनिट किराये पर गईं` : '',
  },
  Odia: {
    hello: (o, d) => `ନମସ୍କାର ${o}, ଏହା ${d} ପର୍ଯ୍ୟନ୍ତ ସପ୍ତାହ ପାଇଁ Leasify Commercial ତରଫରୁ ଆପଣଙ୍କ ରିପୋର୍ଟ।`,
    enq: (w, m) => `ପଚରାଉଚରା: ଏହି ସପ୍ତାହରେ ${w}, ଏହି ମାସରେ ${m}`,
    vis: (n) => `ଏହି ସପ୍ତାହରେ ପରିଦର୍ଶନ: ${n}`,
    off: (n) => `ପ୍ରସ୍ତାବ: ${n}`,
    days: (n) => `ବଜାରରେ ${n} ଦିନ ହେଲା`,
    sim: (n, x, y, p) => n ? `ପାଖର ସମାନ ୟୁନିଟ୍ (${n}): ${x}, ଆପଣଙ୍କର ${y} (${p})` : 'ତୁଳନା ପାଇଁ ପାଖରେ ସମାନ ୟୁନିଟ୍ ନାହିଁ',
    above: (p) => `${p}% ଅଧିକ`, below: (p) => `${p}% କମ୍`, inline: 'ସମାନ',
    sug: 'ଆମର ପରାମର୍ଶ:',
    reply: 'ୟୁନିଟ୍ ଏବେ ବି ଉପଲବ୍ଧ ହେଲେ 1, କିଛି ବଦଳିଥିଲେ 2, ଭଡ଼ାରେ ଦିଆଯାଇଥିଲେ 3 ପଠାନ୍ତୁ।',
    leasedNote: (n) => n ? `30 ଦିନରେ ${n}ଟି ସମାନ ୟୁନିଟ୍ ଭଡ଼ାରେ ଗଲା` : '',
  },
};
function pctLabel(M, s) {
  if (s.sim.diff == null) return '';
  const p = Math.abs(s.sim.diff);
  return p < 1 ? M.inline : (s.sim.diff > 0 ? M.above(p) : M.below(p));
}
function reportText(owner, lang) {
  const M = MSG[lang] || MSG.English;
  const date = LC.fmtDate(LC.today());
  const parts = [M.hello(owner.name, date), ''];
  owner.units.forEach(u => {
    const s = unitStats(u);
    parts.push(`${unitName(u)} (${u.unit_id})`);
    parts.push(`${M.enq(s.enq7, s.enq30)} · ${M.vis(s.visits7)} · ${M.off(s.offers.length)}`);
    if (s.days != null) parts.push(M.days(s.days));
    parts.push(M.sim(s.sim.n, s.sim.median ? psf(s.sim.median) : '', psf(u.all_in_per_sqft), pctLabel(M, s)));
    parts.push(`${M.sug} ${sugText(s, lang)}`);
    parts.push('');
  });
  parts.push(M.reply);
  return parts.join('\n');
}

/* ---------------- render: shell ---------------- */
LC.registerView('owners', {
  title: 'Owner portal',
  sub: 'Owners see what happened to their unit every week, without calling',
  render(el) {
    root = el;
    ensureOwner();
    el.innerHTML = '<p class="lede">Every week each owner gets one short WhatsApp report for each unit: who asked, who visited, what they said, and how similar units nearby are moving. The owner can confirm availability with a single reply. All names and numbers are sample data.</p>' +
      '<div id="own-top"></div><div id="own-data"></div><div id="own-chatwrap"></div>';
    wire(el);
    renderTop(); renderData(); renderChat();
  },
});

function wire(el) {
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !el.contains(b)) return;
    const act = b.dataset.act;
    if (act === 'mode') { st.mode = b.dataset.v; renderTop(); renderData(); renderChat(); }
    else if (act === 'pick') { st.owner = b.dataset.owner; st.mode = b.dataset.view || st.mode; renderTop(); renderData(); renderChat(); window.scrollTo(0, 0); }
    else if (act === 'send') sendReport();
    else if (act === 'avail') availReply(b.dataset.unit, +b.dataset.n);
    else if (act === 'ask') ask(b.dataset.q);
  };
  el.onchange = (e) => {
    if (e.target.id === 'own-pick') { st.owner = e.target.value; renderTop(); renderData(); renderChat(); }
    else if (e.target.id === 'own-lang') { st.lang = e.target.value; renderWa(); }
  };
  el.onsubmit = (e) => {
    if (e.target.id === 'own-chat-form') {
      e.preventDefault();
      const inp = LC.$('#own-q', el); const q = inp.value.trim(); if (!q) return;
      inp.value = ''; ask(q);
    }
  };
}

function renderTop() {
  const host = LC.$('#own-top', root); if (!host) return;
  const o = ensureOwner();
  if (!o) { host.innerHTML = LC.empty('No units loaded.'); return; }
  const owners = ownersList();
  const team = st.mode === 'team';
  if (lockedOwner()) {
    host.innerHTML = '<div class="card"><div class="card-b own-bar"><div class="field"><label>Signed in as owner</label><b>' + E(o.name) + '</b></div>' +
      '<div class="own-meta"><span class="pill brand">' + E(o.type) + '</span><span>' + plural(o.units.length, 'unit', 'units') + ' listed</span><span class="small muted">You can only see your own units.</span></div></div></div>';
    return;
  }
  host.innerHTML = '<div class="card"><div class="card-b own-bar">' +
    '<div class="field"><label>Show</label><div class="seg" role="group" aria-label="Team view or owner view">' +
    '<button type="button" data-act="mode" data-v="team" aria-pressed="' + team + '">Team view</button>' +
    '<button type="button" data-act="mode" data-v="owner" aria-pressed="' + !team + '">Owner view</button></div></div>' +
    (team ? '<div class="field own-pick"><label for="own-pick">Owner</label><select id="own-pick" class="input">' +
      owners.map(x => '<option value="' + E(x.name) + '"' + (x.name === o.name ? ' selected' : '') + '>' + E(x.name) + ' (' + x.units.length + (x.units.length === 1 ? ' unit, ' : ' units, ') + E(x.type) + ')</option>').join('') +
      '</select></div>' : '') +
    '<div class="own-meta"><span class="pill brand">' + E(o.type) + '</span><span>' + plural(o.units.length, 'unit', 'units') + ' listed</span></div>' +
    '</div></div>';
}

/* ---------------- render: data area ---------------- */
function renderData() {
  const host = LC.$('#own-data', root); if (!host) return;
  const o = ensureOwner(); if (!o) { host.innerHTML = ''; return; }
  const team = st.mode === 'team';
  const stats = o.units.map(unitStats);
  let html = '';
  if (!team) {
    html += '<div class="own-banner" role="note"><span>This is what <b>' + E(o.name) + '</b> sees. Owners only see their own units.</span>' +
      '<span class="row"><span class="pill brand">Owner view</span>' + (lockedOwner() ? '' : '<button type="button" class="btn sm" data-act="mode" data-v="team">Back to team view</button>') + '</span></div>';
  } else {
    html += teamTable();
  }
  html += kpis(o, stats);
  html += '<div class="split"><div class="own-reps" id="own-reps">' +
    '<div class="between"><h2 style="font-size:16px">Weekly report, one card per unit</h2><span class="small muted">Week to ' + E(LC.fmtDateY(LC.today())) + '</span></div>' +
    stats.map(s => reportCard(s, team)).join('') + '</div>' +
    '<div class="own-side"><div id="own-wa-card"></div>' + availCard(o) + '</div></div>';
  html += defsBlock();
  host.innerHTML = html;
  renderWa();
}

function teamTable() {
  const o = st.owner;
  const rows = ownersList().map(ow => {
    const ss = ow.units.map(unitStats);
    const enq = new Set(); const now = Date.now();
    LC.state.clients.forEach(c => { if ((c.shared || []).some(x => ow.units.some(u => u.unit_id === x.unitId) && x.ts >= now - 30 * DAY)) enq.add(c.id); });
    LC.state.visits.forEach(v => { if (v.when >= now - 30 * DAY && v.status !== 'Cancelled' && ow.units.some(u => u.unit_id === v.unitId)) enq.add(v.clientId); });
    const stale = ss.filter(s => s.u.status === 'Available' && s.fresh.days >= 7).length;
    return '<tr class="click' + (ow.name === o ? ' own-sel' : '') + '" data-act="pick" data-owner="' + E(ow.name) + '"><td><b>' + E(ow.name) + '</b></td><td>' + E(ow.type) + '</td>' +
      '<td class="r num">' + ow.units.length + '</td><td class="r num">' + ow.units.filter(u => u.status === 'Available').length + '</td>' +
      '<td class="r num">' + enq.size + '</td><td class="r num">' + LC.sum(ss, s => s.visits7) + '</td><td class="r num">' + LC.sum(ss, s => s.offers.length) + '</td>' +
      '<td class="r num">' + (stale ? '<span class="pill warn">' + stale + '</span>' : '0') + '</td>' +
      '<td><button type="button" class="btn sm" data-act="pick" data-owner="' + E(ow.name) + '" data-view="owner">View as owner</button></td></tr>';
  }).join('');
  return '<div class="card"><div class="card-h"><h2>All owners</h2><span class="small muted">Team view only. Click a row to open that owner.</span></div>' +
    '<div class="tbl-wrap" style="max-height:340px;overflow-y:auto"><table class="tbl"><thead><tr>' +
    '<th>Owner</th><th>Type</th><th class="r" title="' + E(DEF.units) + '">Units</th><th class="r" title="' + E(DEF.available) + '">Available</th>' +
    '<th class="r" title="' + E(DEF.enq) + '">Enquiries, 30 days</th><th class="r" title="' + E(DEF.visits) + '">Visits, 7 days</th><th class="r" title="' + E(DEF.offers) + '">Offers</th>' +
    '<th class="r" title="Available units the owner has not confirmed in the last 7 days.">Not confirmed 7d+</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

function kpis(o, stats) {
  const now = Date.now();
  const ids = new Set(o.units.map(u => u.unit_id));
  const enq = new Set();
  LC.state.clients.forEach(c => { if ((c.shared || []).some(x => ids.has(x.unitId) && x.ts >= now - 30 * DAY)) enq.add(c.id); });
  LC.state.visits.forEach(v => { if (ids.has(v.unitId) && v.when >= now - 30 * DAY && v.status !== 'Cancelled' && v.status !== 'No-show') enq.add(v.clientId); });
  const offers = LC.sum(stats, s => s.offers.length);
  const live = stats.filter(s => s.days != null);
  const avg = live.length ? Math.round(LC.sum(live, s => s.days) / live.length) : null;
  const k = (l, v, d, def) => '<div class="kpi" title="' + E(def) + '"><div class="l">' + E(l) + '</div><div class="v">' + v + '</div><div class="d">' + E(d) + '</div></div>';
  return '<div class="kpis">' +
    k('Units listed', o.units.length, 'any status', DEF.units) +
    k('Available', o.units.filter(u => u.status === 'Available').length, 'open to occupiers now', DEF.available) +
    k('Enquiries this month', enq.size, 'clients, last 30 days', DEF.enq) +
    k('Visits this week', LC.sum(stats, s => s.visits7), 'marked Done, last 7 days', DEF.visits) +
    k('Offers', offers, 'Proposal or later', DEF.offers) +
    k('Average days on market', avg == null ? '–' : avg, 'since listing date', DEF.days) +
    '</div>';
}

function statusPill(u) {
  const c = u.status === 'Available' ? 'good' : u.status === 'Leased' ? '' : 'warn';
  return '<span class="pill ' + c + '">' + E(u.status) + '</span>';
}

function reportCard(s, team) {
  const u = s.u; const sim = s.sim;
  const mk = (b, l, def) => '<div title="' + E(def) + '"><b>' + b + '</b><span>' + E(l) + '</span></div>';
  const quotes = s.feedback.slice(0, 3).map(v => {
    const c = LC.crm.get(v.clientId);
    const who = team && c ? (c.company || c.name) : 'A visitor';
    return '<blockquote class="quote">“' + E(v.feedback) + '”<br><span class="small muted">' + E(who) + ', ' + E(LC.fmtDate(LC.iso(v.when))) + (v.rating ? ', rated ' + v.rating + ' of 5' : '') + '</span></blockquote>';
  }).join('') || '<div class="small muted">No visit feedback yet for this unit.</div>';
  const nextV = s.upcoming[0];
  let simHtml;
  if (!sim.n) simHtml = '<div class="small muted">No similar units nearby in our listings, so there is nothing to compare yet.</div>';
  else {
    const mx = Math.max(u.all_in_per_sqft, sim.median) * 1.15;
    const d = sim.diff;
    const dtxt = Math.abs(d) < 1 ? 'in line with' : Math.abs(d) + '% ' + (d > 0 ? 'above' : 'below');
    simHtml = '<p class="small" style="margin:0"><b>' + plural(sim.n, 'similar unit', 'similar units') + '</b> nearby. Your unit is <b>' + dtxt + '</b> their median. <span title="' + E(DEF.leased) + '"><b>' + sim.leased30 + '</b> of them leased in the last 30 days.</span></p>' +
      '<div class="own-sim" role="img" aria-label="This unit ' + psf(u.all_in_per_sqft) + ' all-in, similar units median ' + psf(sim.median) + ' all-in">' +
      '<div class="hbar"><span>This unit</span><div class="track"><i style="width:' + (u.all_in_per_sqft / mx * 100).toFixed(1) + '%"></i></div><span class="val">₹' + (Math.round(u.all_in_per_sqft * 10) / 10) + '</span></div>' +
      '<div class="hbar"><span>Similar, median</span><div class="track"><i style="width:' + (sim.median / mx * 100).toFixed(1) + '%;background:var(--s2)"></i></div><span class="val">₹' + (Math.round(sim.median * 10) / 10) + '</span></div></div>' +
      '<div class="small muted">All-in rent per sq ft a month (rent plus maintenance). ' + E(DEF.sim) + '</div>';
  }
  const agent = LC.teamBy(u.listing_agent);
  return '<article class="report" aria-label="Weekly report for ' + E(unitName(u)) + '">' +
    '<div class="report-h"><b>' + E(unitName(u)) + ' <span style="font-weight:400;font-size:12px;opacity:.8">' + E(u.unit_id) + '</span></b>' +
    '<span>' + E(u.property_type) + ' · ' + E(u.locality) + ', ' + E(LC.cityOf(u)) + ' · ' + E(LC.fmtSqft(u.chargeable_sqft)) + ' · ' + E(psf(u.all_in_per_sqft)) + ' all-in</span>' +
    '<span style="margin-top:6px">' + statusPill(u) + '</span></div>' +
    '<div class="report-sec"><h4>This week and this month</h4><div class="mini-kpis own-mk">' +
    mk(s.enq7, 'Enquiries, 7 days', DEF.enqW) + mk(s.enq30, 'Enquiries, 30 days', DEF.enq) +
    mk(s.visits7, 'Visits, 7 days', DEF.visits) + mk(s.visits30, 'Visits, 30 days', DEF.visitsM) +
    mk(s.offers.length, 'Offers received', DEF.offers) + mk(s.days == null ? '–' : s.days, 'Days on market', DEF.days) + '</div></div>' +
    '<div class="report-sec"><h4>What visitors said</h4>' + quotes + '</div>' +
    '<div class="report-sec"><h4>Where it stands</h4><div class="kv">' +
    '<div><span>Last confirmed by you</span><b><span class="pill ' + LC.pillFor(s.fresh.level) + '">' + E(s.fresh.label) + '</span> ' + (u.confirmed_via ? '<span class="small muted">via ' + E(u.confirmed_via) + '</span>' : '') + '</b></div>' +
    '<div><span>Next visit</span><b>' + (nextV ? E(LC.fmtDT(nextV.when)) : 'None booked yet') + '</b></div>' +
    '<div><span>Available from</span><b>' + E(LC.fmtDateY(u.available_from)) + '</b></div>' +
    '<div><span>Your contact at the desk</span><b>' + E(u.listing_agent) + (agent ? ' <span class="small muted">' + E(agent.role) + '</span>' : '') + '</b></div></div></div>' +
    '<div class="report-sec"><h4>How similar units nearby are moving</h4>' + simHtml + '</div>' +
    '<div class="report-sec own-sug"><div class="eyebrow">Suggestion from our team</div><p><b>What we suggest:</b> ' + E(sugText(s)) + '</p></div>' +
    (team ? '<div class="report-sec own-internal"><h4>Internal, not shown to the owner</h4><div class="kv">' +
      '<div><span>Mandate</span><b>' + E(u.mandate) + '</b></div><div><span>Brokerage</span><b>' + E(u.brokerage_months) + ' months of rent</b></div>' +
      '<div><span>Listing agent</span><b>' + E(u.listing_agent) + '</b></div><div><span>Owner phone (masked)</span><b>' + E(u.owner_phone) + '</b></div>' +
      '<div><span>Rule that gave the suggestion</span><b>' + E(RULE_NAME[s.sug]) + '</b></div></div></div>' : '') +
    '</article>';
}
const RULE_NAME = {
  price: 'Priced more than 10% above similar units, 3 or more visits, no offer',
  confirm: 'Not confirmed in 7 or more days',
  few: 'No enquiries in 30 days',
  steady: 'None of the above',
  deal: 'Unit is under negotiation or LOI signed',
  offer: 'An offer is on the table',
  leased: 'Unit is leased',
};

function defsBlock() {
  return '<div class="card"><div class="card-h"><h2>How these numbers work</h2></div><div class="card-b"><dl class="defs">' +
    '<dt>Enquiries</dt><dd>' + E(DEF.enq) + ' The week figure uses the last 7 days.</dd>' +
    '<dt>Visits</dt><dd>' + E(DEF.visits) + '</dd>' +
    '<dt>Offers</dt><dd>' + E(DEF.offers) + '</dd>' +
    '<dt>Days on market</dt><dd>' + E(DEF.days) + '</dd>' +
    '<dt>Similar units</dt><dd>' + E(DEF.sim) + '</dd>' +
    '<dt>Leased nearby</dt><dd>' + E(DEF.leased) + '</dd>' +
    '<dt>What we suggest</dt><dd>One of five fixed rules, first match wins: an offer is in hand; priced more than 10% above similar units with 3 or more visits and no offer; not confirmed for 7 or more days; no enquiries in 30 days; otherwise steady.</dd>' +
    '</dl></div></div>';
}

/* ---------------- WhatsApp preview ---------------- */
function renderWa() {
  const host = LC.$('#own-wa-card', root); if (!host) return;
  const o = ensureOwner(); if (!o) return;
  const text = reportText(o, st.lang);
  const sent = st.sent[o.name];
  host.innerHTML = '<div class="card"><div class="card-h"><h2>WhatsApp preview</h2><span class="spacer"></span>' +
    '<div class="field" style="min-width:130px"><label for="own-lang">Message language</label><select id="own-lang" class="input">' +
    LC.LANGS.map(l => '<option' + (l === st.lang ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div></div>' +
    '<div class="card-b stack">' +
    '<div class="phone own-wa" role="img" aria-label="Preview of the WhatsApp report message"><div class="wa-head"><div class="wa-av">L</div><div><b>Leasify Commercial</b><span>Business account</span></div></div>' +
    '<div class="wa-body"><div class="bub sys">Today</div><div class="bub in">' + E(text) + '<span class="t">' + E(LC.fmtTime(Date.now())) + '</span></div></div></div>' +
    (st.lang !== 'English' ? '<p class="note">Hindi and Odia wording is a draft. It needs review by a native speaker before owners receive it.</p>' : '') +
    '<div class="row"><button type="button" class="btn primary" data-act="send">Send this week\'s report</button>' +
    '<span class="small muted" role="status">' + (sent ? 'Last sent ' + E(LC.relTime(sent.ts)) + ' in ' + E(sent.lang) + ' (simulated)' : 'Not sent yet this week') + '</span></div>' +
    '<p class="small muted" style="margin:0">One message per owner, with every unit in it. Sent as an approved Utility template (see Settings, WhatsApp templates).</p></div></div>';
}
function sendReport() {
  const o = ensureOwner(); if (!o) return;
  st.sent[o.name] = { ts: Date.now(), lang: st.lang };
  LC.log('Weekly report sent on WhatsApp to ' + o.name + ' (' + st.lang + ', ' + plural(o.units.length, 'unit', 'units') + ')', { kind: 'owner' });
  LC.toast('Report sent on WhatsApp to ' + o.name + ' (simulated)');
  renderWa();
}

/* ---------------- availability check ---------------- */
function availCard(o) {
  const rows = o.units.map(u => {
    const f = LC.unitFreshness(u); const rep = st.replies[u.unit_id];
    return '<div class="own-av"><div class="between"><div><b>' + E(unitName(u)) + '</b> <span class="small muted">' + E(u.unit_id) + '</span></div><div class="row">' + statusPill(u) +
      '<span class="pill ' + LC.pillFor(f.level) + '">' + E(f.label) + '</span></div></div>' +
      '<div class="small muted">Weekly check message: “Is ' + E(unitName(u)) + ' still available at ' + E(psf(u.rent_per_sqft)) + ' plus maintenance? Reply 1, 2 or 3.”</div>' +
      '<div class="btns" role="group" aria-label="Simulated WhatsApp reply for ' + E(unitName(u)) + '">' +
      '<button type="button" class="btn sm" data-act="avail" data-unit="' + E(u.unit_id) + '" data-n="1">1 Still available</button>' +
      '<button type="button" class="btn sm" data-act="avail" data-unit="' + E(u.unit_id) + '" data-n="2">2 Something changed</button>' +
      '<button type="button" class="btn sm" data-act="avail" data-unit="' + E(u.unit_id) + '" data-n="3">3 Leased</button></div>' +
      (rep ? '<div class="res" role="status">' + E(rep) + '</div>' : '') + '</div>';
  }).join('');
  return '<div class="card"><div class="card-h"><h2>Availability check</h2></div><div class="card-b">' +
    '<p class="note" style="margin-bottom:6px">These buttons act like the owner\'s WhatsApp reply to the weekly check. Each reply is written to the audit log (Settings, Audit log).</p>' + rows + '</div></div>';
}
function availReply(unitId, n) {
  const u = LC.unit(unitId); if (!u) return;
  /* SERVER MODE (net.js): an owner's reply goes to the server, which makes the same changes and writes the audit rows */
  if (LC.remote && LC.net && LC.session.role === 'owner') {
    LC.net.ownerReply(unitId, n).then((r) => { st.replies[unitId] = r.message; LC.toast(r.message); if (LC.isActive('owners')) renderData(); }).catch((e) => LC.toast(e.message || 'The reply was not saved.'));
    return;
  }
  const S = LC.state; const o = u.owner_name; const by = 'Owner (' + o + ') via WhatsApp reply';
  const t = LC.fmtTime(Date.now()); const today = LC.iso(LC.today());
  if (n === 1) {
    if (u.last_confirmed !== today) S.audit.unshift({ ts: Date.now(), unitId, field: 'last_confirmed', from: u.last_confirmed, to: today, by });
    if (u.confirmed_via !== 'WhatsApp reply') S.audit.unshift({ ts: Date.now(), unitId, field: 'confirmed_via', from: u.confirmed_via, to: 'WhatsApp reply', by });
    if (u.status === 'Leased') { S.audit.unshift({ ts: Date.now(), unitId, field: 'status', from: 'Leased', to: 'Available', by }); u.status = 'Available'; }
    u.last_confirmed = today; u.confirmed_via = 'WhatsApp reply';
    st.replies[unitId] = 'Reply 1 received at ' + t + '. Last confirmed is now today.';
    LC.log('Owner ' + o + ' replied 1: ' + unitName(u) + ' is still available', { unitId, kind: 'owner' });
  } else if (n === 2) {
    LC.tasks.add({ type: 'Owner check', title: 'Owner says something changed at ' + unitName(u) + ' (' + unitId + '). Call ' + o + ' for the new terms', due: Date.now() + 2 * 36e5, unitId, assignee: u.listing_agent, priority: 'High' });
    u.data_flag = 'Owner says terms changed. Confirm with the owner before offering.';
    S.audit.unshift({ ts: Date.now(), unitId, field: 'owner_reply', from: '', to: 'Something changed (task opened for ' + u.listing_agent + ', unit flagged)', by });
    st.replies[unitId] = 'Reply 2 received at ' + t + '. A high-priority task was opened for ' + u.listing_agent + ' to call the owner.';
    LC.log('Owner ' + o + ' replied 2: something changed at ' + unitName(u), { unitId, kind: 'owner' });
  } else {
    S.audit.unshift({ ts: Date.now(), unitId, field: 'status', from: u.status, to: 'Leased', by });
    if (u.last_confirmed !== today) S.audit.unshift({ ts: Date.now(), unitId, field: 'last_confirmed', from: u.last_confirmed, to: today, by });
    u.status = 'Leased'; u.last_confirmed = today; u.confirmed_via = 'WhatsApp reply';
    st.replies[unitId] = 'Reply 3 received at ' + t + '. The unit is now marked Leased and will not be sent to occupiers.';
    LC.log('Owner ' + o + ' replied 3: ' + unitName(u) + ' is leased', { unitId, kind: 'owner' });
  }
  LC.toast(st.replies[unitId]);
  LC.emit('units:changed');
  if (LC.isActive('owners')) { renderData(); }
}

/* ---------------- owner co-pilot ---------------- */
const SUGGESTED = [
  'How many people asked about my unit this month?',
  'Why hasn\'t it leased yet?',
  'What are similar units nearby getting?',
  'When is the next visit?',
  'Is my unit\'s information up to date?',
  'What did visitors say?',
];
function renderChat() {
  const host = LC.$('#own-chatwrap', root); if (!host) return;
  const o = ensureOwner(); if (!o) return;
  host.innerHTML = '<p class="note">Owners start with the weekly report. Chat is turned on once they start asking questions.</p>' +
    '<div class="card own-chatcard" style="margin-top:12px"><div class="card-h"><h2>Owner co-pilot</h2><span class="pill brand">Answers only about ' + E(o.name) + '\'s ' + plural(o.units.length, 'unit', 'units') + '</span></div>' +
    '<div class="chat"><div class="chat-body" id="own-chat-body" aria-live="polite"></div>' +
    '<div class="own-chips"><div class="own-q">Suggested questions</div><div class="chips">' +
    SUGGESTED.map(q => '<button type="button" class="chip" data-act="ask" data-q="' + E(q) + '">' + E(q) + '</button>').join('') + '</div></div>' +
    '<form class="chat-input" id="own-chat-form" autocomplete="off"><input class="input" id="own-q" aria-label="Ask a question about your unit" placeholder="Ask about your unit"><button class="btn primary" type="submit">Ask</button></form></div></div>';
  renderChatBody();
}
function chatArr() { const k = st.owner; return st.chats[k] || (st.chats[k] = []); }
function renderChatBody() {
  const b = LC.$('#own-chat-body', root); if (!b) return;
  const o = ensureOwner(); const arr = chatArr();
  let html = '<div class="msg ai"><p>Hello. I can only see ' + E(o.name) + '\'s ' + plural(o.units.length, 'unit', 'units') + ': ' + E(o.units.map(unitName).join(', ')) + '. Ask me about enquiries, visits, nearby units or whether your details are up to date.</p></div>';
  html += arr.map(m => m.from === 'me' ? '<div class="msg me">' + E(m.text) + '</div>' : '<div class="msg ai">' + m.html + '</div>').join('');
  b.innerHTML = html; b.scrollTop = b.scrollHeight;
}
function push(owner, m) { (st.chats[owner] || (st.chats[owner] = [])).push(m); if (st.owner === owner) renderChatBody(); }
const src = (t) => '<div class="src"><b>How this is worked out:</b> ' + E(t) + '</div>';

function foreignRef(t, o) {
  const mine = new Set(o.units.map(u => u.unit_id));
  const ids = t.match(/lc-\d{2,4}/g) || [];
  if (ids.some(i => !mine.has(i.toUpperCase()))) return true;
  const myB = new Set(o.units.map(u => u.building_name.toLowerCase()));
  for (const x of LC.state.units) {
    if (x.owner_name === o.name) continue;
    if (t.includes((x.building_name + ' ' + x.unit_no).toLowerCase())) return true;
    const b = x.building_name.toLowerCase();
    if (!myB.has(b) && t.includes(b)) return true;
  }
  for (const ow of ownersList()) if (ow.name !== o.name && t.includes(ow.name.toLowerCase())) return true;
  return /(other|another|different) (owner|landlord)s?|other people'?s? (unit|building|rent)|someone else'?s unit/.test(t);
}
function focusUnits(t, o) {
  const f = o.units.filter(u => t.includes(u.unit_id.toLowerCase()) || t.includes((unitName(u)).toLowerCase()) || t.includes(u.building_name.toLowerCase()));
  return f.length ? f : o.units;
}

function deterministic(q) {
  const o = ensureOwner(); const t = q.toLowerCase().replace(/[’‘]/g, "'");
  if (foreignRef(t, o)) return { html: '<p>You can only see your own units.</p>' };
  const us = focusUnits(t, o); const ss = us.map(unitStats);
  const li = (fn) => '<ul class="own-ul">' + ss.map(s => '<li><b>' + E(unitName(s.u)) + ':</b> ' + fn(s) + '</li>').join('') + '</ul>';
  if (/^(hi|hello|hey|namaste|namaskar|thanks|thank you)\b/.test(t)) return { html: '<p>Hello. Ask me about enquiries, visits, similar units nearby, or whether your unit\'s details are up to date.</p>' };
  if (/next visit|upcoming visit|scheduled visit|when .*(visit|come|see)|who .*(visit|coming)/.test(t)) {
    const any = ss.some(s => s.upcoming.length);
    return { html: '<p>' + (any ? 'Here are the visits booked.' : 'No visit is booked yet.') + '</p>' + li(s => s.upcoming.length ? E(LC.fmtDT(s.upcoming[0].when)) + (s.upcoming.length > 1 ? ' (and ' + (s.upcoming.length - 1) + ' more)' : '') : 'none booked yet. ' + plural(s.enq30, 'occupier was', 'occupiers were') + ' sent or shown this unit in 30 days') +
      src('Next visit is the earliest booked site visit in the future for the unit. We do not share the occupier\'s name with owners.') };
  }
  if (/up to date|up-to-date|uptodate|information|details|confirmed|accurate|correct|current/.test(t)) {
    return { html: '<p>This is what we show occupiers for each unit.</p>' + li(s => {
      const u = s.u;
      return E(s.fresh.label.toLowerCase()) + (u.confirmed_via ? ' via ' + E(u.confirmed_via) : '') + '. Rent ' + E(psf(u.rent_per_sqft)) + ' plus ' + E(psf(u.cam_per_sqft || 0)) + ' maintenance (' + E(psf(u.all_in_per_sqft)) + ' all-in), available from ' + E(LC.fmtDate(u.available_from)) + ', deposit ' + E(u.deposit_months) + ' months, lock-in ' + E(u.lock_in_months) + ' months.' + (s.fresh.days >= 7 ? ' <b>Please reply 1 on WhatsApp to confirm.</b>' : '');
    }) + '<p style="margin-top:8px" class="small">If any of these changed, reply 2 and your agent will call you.</p>' +
      src('Last confirmed is the date you or your agent last confirmed availability and terms. A unit not confirmed for 14 days stops being sent to occupiers.') };
  }
  if (/visitor|feedback|said|say about|comment|thought|opinion|review/.test(t)) {
    const any = ss.some(s => s.feedback.length);
    return { html: '<p>' + (any ? 'This is what visitors told our team after seeing your unit.' : 'No visitor feedback has been recorded yet.') + '</p>' +
      ss.map(s => s.feedback.length ? '<div><b>' + E(unitName(s.u)) + '</b>' + s.feedback.slice(0, 3).map(v => '<blockquote class="quote">“' + E(v.feedback) + '”<br><span class="small muted">A visitor, ' + E(LC.fmtDate(LC.iso(v.when))) + (v.rating ? ', rated ' + v.rating + ' of 5' : '') + '</span></blockquote>').join('') + '</div>' : '').join('') +
      src('Quotes are the notes our agent types after each site visit marked Done. Names are removed.') };
  }
  if (/similar|nearby|near by|compar|around|other units|market|getting|competition|\brates?\b|\bprices?\b|\brents?\b/.test(t) && !/why/.test(t)) {
    return { html: '<p>Here is how similar units nearby compare.</p>' + li(s => {
      if (!s.sim.n) return 'no similar units nearby in our listings.';
      const d = s.sim.diff; const dt = Math.abs(d) < 1 ? 'in line with them' : Math.abs(d) + '% ' + (d > 0 ? 'above' : 'below') + ' them';
      return plural(s.sim.n, 'similar unit', 'similar units') + ', median ' + E(psf(s.sim.median)) + ' all-in. Yours is ' + E(psf(s.u.all_in_per_sqft)) + ', ' + dt + '. ' + plural(s.sim.leased30, 'has', 'have') + ' leased in the last 30 days.';
    }) + src(DEF.sim + ' ' + DEF.leased) };
  }
  if (/why|leased yet|not leased|taking so long|slow|how long|so long|still vacant|vacant|reduce|cut/.test(t)) {
    return { html: '<p>Here is where each unit stands.</p>' + li(s => {
      const u = s.u; const bits = [];
      if (s.days != null) bits.push('on the market ' + plural(s.days, 'day', 'days'));
      bits.push(plural(s.enq30, 'enquiry', 'enquiries') + ' and ' + plural(s.visits30, 'visit', 'visits') + ' in 30 days');
      bits.push(s.offers.length ? plural(s.offers.length, 'offer', 'offers') : 'no offer yet');
      if (s.sim.n >= 1 && s.sim.diff != null && Math.abs(s.sim.diff) >= 1) bits.push('priced ' + Math.abs(s.sim.diff) + '% ' + (s.sim.diff > 0 ? 'above' : 'below') + ' similar units');
      return E(bits.join('; ')) + '. <b>Suggestion from our team:</b> ' + E(sugText(s));
    }) + src('Counts come from the CRM and visit log. The suggestion follows five fixed rules (see "How these numbers work"). ' + DEF.days) };
  }
  if (/how many|enquir|inquir|asked|interest|people|leads|calls|visits|footfall/.test(t)) {
    const tot = new Set(); const now = Date.now();
    LC.state.clients.forEach(c => { if ((c.shared || []).some(x => us.some(u => u.unit_id === x.unitId) && x.ts >= now - 30 * DAY)) tot.add(c.id); });
    LC.state.visits.forEach(v => { if (us.some(u => u.unit_id === v.unitId) && v.when >= now - 30 * DAY && v.status !== 'Cancelled' && v.status !== 'No-show') tot.add(v.clientId); });
    return { html: '<p>In the last 30 days, <b>' + tot.size + '</b> ' + (tot.size === 1 ? 'occupier was' : 'occupiers were') + ' sent ' + (us.length > 1 ? 'your units' : 'your unit') + ' or visited.</p>' +
      li(s => plural(s.enq30, 'enquiry', 'enquiries') + ' this month (' + s.enq7 + ' this week), ' + plural(s.visits30, 'visit', 'visits') + ' done in 30 days') +
      src(DEF.enq) };
  }
  return null;
}

async function askClaudeScoped(q, o) {
  const ctx = o.units.map(u => { const s = unitStats(u); return {
    unit_id: u.unit_id, name: unitName(u), type: u.property_type, locality: u.locality, status: u.status, area_sqft: u.chargeable_sqft,
    rent_psf: u.rent_per_sqft, maintenance_psf: u.cam_per_sqft, all_in_psf: u.all_in_per_sqft, available_from: u.available_from, listed_date: u.listed_date,
    last_confirmed: u.last_confirmed, enquiries_7d: s.enq7, enquiries_30d: s.enq30, visits_7d: s.visits7, visits_30d: s.visits30, offers: s.offers.length,
    days_on_market: s.days, next_visit: s.upcoming[0] ? LC.fmtDT(s.upcoming[0].when) : null,
    similar_units: s.sim.n, similar_median_all_in_psf: s.sim.median, vs_similar_pct: s.sim.diff, similar_leased_30d: s.sim.leased30,
    visitor_feedback: s.feedback.slice(0, 4).map(v => v.feedback), team_suggestion: sugText(s),
  }; });
  const prompt = 'You are the owner co-pilot for Leasify Commercial, a commercial leasing desk in Odisha, India. You are talking to the owner "' + o.name + '". ' +
    'Answer only from the JSON below, which holds only this owner\'s units. Never mention or guess anything about other units or other owners. ' +
    'If the question is about another owner or a unit that is not in the data, reply exactly: You can only see your own units. ' +
    'If the data cannot answer the question, reply exactly: NO_ANSWER. Otherwise answer in at most 3 short sentences of plain English. Do not use em-dashes.\n\nDATA:\n' + JSON.stringify(ctx) + '\n\nQUESTION: ' + q;
  let text = String(await LC.askClaude(prompt)).trim();
  text = text.replace(/\u2014/g, ',');
  const mine = new Set(o.units.map(u => u.unit_id));
  if ((text.match(/LC-\d{2,4}/g) || []).some(i => !mine.has(i))) return 'You can only see your own units.';
  return text;
}

function ask(q) {
  const o = ensureOwner(); if (!o) return;
  const owner = o.name;
  push(owner, { from: 'me', text: q });
  const r = deterministic(q);
  if (r) { push(owner, { from: 'ai', html: r.html }); return; }
  const agent = o.units[0].listing_agent;
  const fallback = () => {
    LC.tasks.add({ type: 'Owner question', title: 'Owner ' + owner + ' asked: "' + q.slice(0, 80) + '"', due: Date.now() + 4 * 36e5, assignee: agent, priority: 'Normal' });
    LC.log('Owner question passed to ' + agent + ': ' + q.slice(0, 80), { kind: 'owner' });
    return { from: 'ai', html: '<p>I can\'t answer that from your unit\'s data. I\'ve passed your question to ' + E(agent) + '.</p>' };
  };
  if (LC.ai && LC.ai.sample) {
    const m = { from: 'ai', html: '<div class="typing" aria-label="' + LC.aiName + ' is writing"><i></i><i></i><i></i></div>' };
    push(owner, m);
    askClaudeScoped(q, o).then(text => {
      const arr = st.chats[owner]; const i = arr.indexOf(m);
      if (!text || /NO_ANSWER/.test(text)) { arr[i] = fallback(); }
      else arr[i] = { from: 'ai', html: '<p>' + E(text) + '</p><div class="src"><span class="ai-tag">' + LC.aiName + '</span> Answered from this owner\'s unit data only. Check figures against the report above.</div>' };
      if (st.owner === owner) renderChatBody();
    }).catch(() => {
      const arr = st.chats[owner]; const i = arr.indexOf(m); arr[i] = fallback(); if (st.owner === owner) renderChatBody();
    });
    return;
  }
  push(owner, fallback());
}

/* ---------------- live updates ---------------- */
let _t = null;
function refresh() {
  clearTimeout(_t);
  _t = setTimeout(() => { if (LC.isActive('owners') && root) { const a = document.activeElement; if (a && a.id === 'own-q') return; renderTop(); renderData(); } }, 250);
}
['units:changed', 'clients:changed', 'visits:changed'].forEach(e => LC.on(e, refresh));
LC.on('reset', () => { st.chats = {}; st.replies = {}; st.sent = {}; st.owner = null; });
LC.on('ai:ready', () => {});
})();
