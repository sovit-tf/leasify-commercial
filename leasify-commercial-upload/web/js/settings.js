/* =====================================================================
   Leasify Commercial demo: SETTINGS AND RULES (view 'settings')
   Areas, languages, lead sources, handoff rules, team and access,
   WhatsApp templates, consent log, audit log, integrations.
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const E = LC.esc;

LC.css(`
#v-settings { grid-template-columns: minmax(0, 1fr); }
#v-settings > * { min-width: 0; }
.st-tabs { margin-bottom: 0; }
.st-body { display: grid; gap: 20px; margin-top: 16px; }
.st-chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; background: var(--surface-2); border: 1px solid var(--hair); color: var(--fg-2); }
.st-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.st-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; align-items: end; }
.st-form .wide { grid-column: 1 / -1; }
.st-msg { font-size: 12.5px; min-height: 18px; }
.st-msg.bad { color: var(--bad); font-weight: 600; }
.st-msg.good { color: var(--good); font-weight: 600; }
.st-sw { display: inline-flex; gap: 8px; align-items: center; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.st-sw input { width: 18px; height: 18px; accent-color: var(--brand); }
.st-off td { opacity: .6; }
.st-off td:first-child { opacity: 1; }
.st-nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
.st-nums .help { font-size: 11.5px; color: var(--muted); }
.st-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.st-tpls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.st-tpl { display: grid; align-content: start; gap: 8px; padding: 14px 16px; }
.st-tpl .nm { font-family: var(--f-mono); font-size: 12.5px; font-weight: 600; word-break: break-all; }
.st-tpl .bd { background: var(--wa-bg); color: var(--wa-fg); border-radius: 8px; padding: 10px 12px; font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; }
.st-var { font-family: var(--f-mono); font-size: 11.5px; background: var(--glow); color: var(--brand-ink); border-radius: 3px; padding: 0 3px; }
.st-why { font-size: 12px; color: var(--bad); background: var(--bad-bg); border-radius: 6px; padding: 6px 9px; }
.st-acc td, .st-acc th { text-align: center; }
.st-acc td:first-child, .st-acc th:first-child { text-align: left; }
.st-yes { color: var(--good); font-weight: 600; }
.st-own { color: var(--warn); font-weight: 600; }
.st-no { color: var(--bad); font-weight: 600; }
.st-wrap { max-width: 340px; word-break: break-word; }
.st-integ { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.st-live { display: grid; }
.st-kvr { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px; padding: 6px 0; border-top: 1px solid var(--hair); font-size: 12.5px; align-items: center; }
.st-kvr span { color: var(--muted); }
.st-kvr b { font-weight: 500; overflow-wrap: anywhere; }
.st-url { font-family: var(--f-mono); font-size: 12px; background: var(--surface-2); border-radius: 4px; padding: 2px 6px; overflow-wrap: anywhere; }
@media (max-width: 860px) {
  .st-tpls, .st-integ { grid-template-columns: minmax(0, 1fr); }
  .st-kvr { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .st-pair { grid-template-columns: 1fr 1fr; }
}
`);

const TABS = [
  ['areas', 'Areas'], ['sources', 'Sources'], ['handoff', 'Handoff rules'], ['team', 'Team and access'],
  ['templates', 'WhatsApp templates'], ['consent', 'Consent log'], ['audit', 'Audit log'], ['integrations', 'Integrations'],
];
const st = { tab: 'areas', addedCities: new Set() };
let root = null, selfEmit = false;

const S = () => LC.settings();
function langs() { const s = S(); if (!s.languages) s.languages = { English: true, Hindi: true, Odia: true }; return s.languages; }
function emitSettings() { selfEmit = true; try { LC.emit('settings:changed'); } finally { selfEmit = false; } }
const saved = () => LC.toast('Saved');

LC.registerView('settings', {
  title: 'Settings and rules',
  sub: 'Cities, languages, sources and handoff rules are settings, not code',
  render(el) {
    root = el; langs();
    el.innerHTML = '<div><div class="tabs st-tabs" role="tablist" aria-label="Settings sections">' +
      TABS.map(t => '<button type="button" role="tab" id="st-tab-' + t[0] + '" data-tab="' + t[0] + '" aria-selected="' + (t[0] === st.tab) + '" aria-controls="st-body">' + E(t[1]) + '</button>').join('') +
      '</div><div class="st-body" id="st-body" role="tabpanel"></div></div>';
    wire(el);
    renderSection();
  },
});

function wire(el) {
  el.onclick = (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab && el.contains(tab)) { st.tab = tab.dataset.tab; LC.$$('[data-tab]', el).forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab))); renderSection(); return; }
    const rm = e.target.closest('[data-rm-area]');
    if (rm) { removeArea(rm.dataset.rmArea); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) { LC.copy(cp.dataset.copy); return; }
  };
  el.onsubmit = (e) => { if (e.target.id === 'st-area-form') { e.preventDefault(); addArea(); } };
  el.onchange = (e) => {
    const t = e.target;
    if (t.dataset.lang) setLang(t);
    else if (t.dataset.rule) setRule(t);
    else if (t.dataset.set) setNum(t);
  };
}

function renderSection() {
  const host = LC.$('#st-body', root); if (!host) return;
  const fn = { areas, sources, handoff, team, templates, consent, audit, integrations }[st.tab] || areas;
  host.innerHTML = fn();
}

/* ---------------- 1. Areas and languages ---------------- */
function areas() {
  const byCity = {};
  Object.keys(LC.LOCALITIES).forEach(n => { const L = LC.LOCALITIES[n]; (byCity[L.city] = byCity[L.city] || []).push(n); });
  const units = LC.state.units;
  const cards = Object.keys(byCity).map(city => {
    const names = byCity[city];
    const n = LC.sum(names, x => units.filter(u => u.locality === x).length);
    return '<div class="card"><div class="card-h"><h3>' + E(city) + '</h3><span class="pill">' + names.length + (names.length === 1 ? ' area' : ' areas') + '</span><span class="pill brand">' + n + (n === 1 ? ' unit' : ' units') + '</span></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Area</th><th>Aliases the agent understands</th><th class="r">Latitude</th><th class="r">Longitude</th><th class="r" title="Units in the inventory whose locality is this area.">Units</th></tr></thead><tbody>' +
      names.map(x => {
        const L = LC.LOCALITIES[x]; const c = units.filter(u => u.locality === x).length;
        return '<tr><td><b>' + E(x) + '</b>' + (L.custom ? ' <span class="pill brand">Added here</span>' : '') + '</td><td><div class="st-chips">' + (L.aliases || []).map(a => '<span class="st-chip">' + E(a) + '</span>').join('') + '</div></td>' +
          '<td class="r num">' + E(L.lat) + '</td><td class="r num">' + E(L.lng) + '</td><td class="r num">' + c + (L.custom && !c ? ' <button type="button" class="btn sm" data-rm-area="' + E(x) + '" aria-label="Remove ' + E(x) + '">Remove</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }).join('');
  const cityOptions = Array.from(new Set(Object.values(LC.LOCALITIES).map(L => L.city))).map(c => '<option value="' + E(c) + '"></option>').join('');
  const lg = langs();
  return '<p class="lede">The agent, the requirement parser and the match engine all read this list. To open a new city, add its areas here. Nothing city-specific is in the code.</p>' +
    '<div class="card"><div class="card-h"><h2>Add an area</h2></div><div class="card-b stack">' +
    '<form id="st-area-form" class="st-form" autocomplete="off">' +
    '<div class="field"><label for="st-an">Area name</label><input class="input" id="st-an" placeholder="Sundarpada"></div>' +
    '<div class="field"><label for="st-ac">City</label><input class="input" id="st-ac" list="st-cities" placeholder="Bhubaneswar"><datalist id="st-cities">' + cityOptions + '</datalist></div>' +
    '<div class="field"><label for="st-alat">Latitude</label><input class="input" id="st-alat" inputmode="decimal" placeholder="20.2400"></div>' +
    '<div class="field"><label for="st-alng">Longitude</label><input class="input" id="st-alng" inputmode="decimal" placeholder="85.7900"></div>' +
    '<div class="field wide"><label for="st-aal">Aliases, separated by commas</label><input class="input" id="st-aal" placeholder="sundarpada, sundar pada, ring road"></div>' +
    '<div class="wide row"><button class="btn primary" type="submit">Add area</button><span class="st-msg" id="st-area-msg" role="status"></span></div></form>' +
    '<p class="note">New cities go live by adding areas here. Nothing city-specific is in the code. The area name is added as an alias by itself, so people can type it in English, Hindi or Odia spellings you list.</p></div></div>' +
    cards +
    '<div class="card"><div class="card-h"><h2>Languages</h2></div><div class="card-b stack">' +
    '<div class="row">' + LC.LANGS.map(l => '<label class="st-sw"><input type="checkbox" data-lang="' + E(l) + '"' + (lg[l] !== false ? ' checked' : '') + '> ' + E(l) + ' <span class="muted" style="font-weight:500">' + (lg[l] !== false ? 'On' : 'Off') + '</span></label>').join('') + '</div>' +
    '<p class="note">The agent replies in the language the occupier writes in. Keep at least one language on.</p></div></div>';
}
function addArea() {
  const msg = LC.$('#st-area-msg', root); const say = (t, k) => { msg.textContent = t; msg.className = 'st-msg ' + k; };
  const v = (id) => LC.$('#' + id, root).value.trim();
  const name = v('st-an'), city = v('st-ac'), lat = parseFloat(v('st-alat')), lng = parseFloat(v('st-alng'));
  if (!name) return say('Enter the area name.', 'bad');
  if (name.length > 40) return say('Keep the area name under 40 characters.', 'bad');
  if (Object.keys(LC.LOCALITIES).some(k => k.toLowerCase() === name.toLowerCase())) return say(name + ' is already in the list.', 'bad');
  if (!city) return say('Enter the city.', 'bad');
  if (isNaN(lat) || lat < -90 || lat > 90) return say('Latitude must be a number between -90 and 90.', 'bad');
  if (isNaN(lng) || lng < -180 || lng > 180) return say('Longitude must be a number between -180 and 180.', 'bad');
  const aliases = Array.from(new Set([name.toLowerCase()].concat(v('st-aal').split(',').map(a => a.trim().toLowerCase()).filter(Boolean))));
  LC.LOCALITIES[name] = { city, lat, lng, aliases, custom: true };
  const base = city.split(' (')[0];
  if (!LC.CITIES[base]) { LC.CITIES[base] = [base.toLowerCase()]; st.addedCities.add(base); }
  emitSettings();
  LC.log('Area added: ' + name + ', ' + city, { kind: 'settings' });
  LC.toast(name + ' added. The agent now understands it.');
  renderSection();
  const m2 = LC.$('#st-area-msg', root); if (m2) { m2.textContent = name + ' added to ' + city + '.'; m2.className = 'st-msg good'; }
}
function removeArea(name) {
  const L = LC.LOCALITIES[name]; if (!L || !L.custom) return;
  delete LC.LOCALITIES[name];
  const base = L.city.split(' (')[0];
  if (st.addedCities.has(base) && !Object.values(LC.LOCALITIES).some(x => x.city.split(' (')[0] === base)) { delete LC.CITIES[base]; st.addedCities.delete(base); }
  emitSettings(); LC.toast(name + ' removed'); renderSection();
}
function setLang(t) {
  const lg = langs(); const l = t.dataset.lang;
  lg[l] = t.checked;
  if (!LC.LANGS.some(x => lg[x] !== false)) { lg[l] = true; t.checked = true; LC.toast('Keep at least one language on.'); return; }
  emitSettings(); saved(); renderSection();
}

/* ---------------- 3. Lead sources ---------------- */
const CONNECT = {
  '99acres': ['Portal email parser', 'Lead emails from the portal go to a Leasify inbox. A parser reads name, phone, unit and message.'],
  'Magicbricks': ['Portal email parser', 'Lead emails from the portal go to a Leasify inbox. A parser reads name, phone, unit and message.'],
  'Housing.com': ['Portal email parser', 'Lead emails from the portal go to a Leasify inbox. A parser reads name, phone, unit and message.'],
  'JustDial': ['Portal email parser', 'Lead emails from the portal go to a Leasify inbox. A parser reads name, phone, unit and message.'],
  'Website form': ['Webhook', 'The form posts each submission to Leasify as it happens.'],
  'Meta lead ads': ['Webhook', 'Facebook and Instagram lead forms post to Leasify as they are filled.'],
  'Google Ads': ['Webhook', 'Lead form extensions post to Leasify as they are filled.'],
  'Office WhatsApp': ['WhatsApp Business API', 'Messages to the office number reach the agent directly.'],
  'Phone call (IVR)': ['IVR missed-call webhook', 'A missed call to the office number triggers a WhatsApp message to the caller.'],
  'Referral': ['Manual entry', 'The team adds the client in the CRM.'],
  'Walk-in': ['Manual entry', 'The team adds the client in the CRM.'],
};
function sources() {
  const cl = LC.state.clients; const tot = cl.length || 1;
  const rows = LC.SOURCES.map(s => {
    const n = cl.filter(c => c.source === s).length; const c = CONNECT[s] || ['Manual entry', ''];
    const manual = c[0] === 'Manual entry';
    return '<tr><td><b>' + E(s) + '</b></td><td>' + E(c[0]) + '<div class="small muted st-wrap">' + E(c[1]) + '</div></td>' +
      '<td>' + (manual ? '<span class="pill">Manual, no link needed</span>' : '<span class="pill good"><span class="dot"></span>Connected (simulated)</span>') + '</td>' +
      '<td class="r num">' + n + '</td><td class="r num">' + Math.round(n / tot * 100) + '%</td></tr>';
  }).join('');
  return '<p class="lede">Every source ends up in the same inbox and the same CRM. Adding a source means adding a connection here, not changing the agent.</p>' +
    '<div class="card"><div class="card-h"><h2>Lead sources</h2><span class="small muted">Enquiries are counted from the CRM.</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Source</th><th>How it connects</th><th>Status</th><th class="r" title="Clients in the CRM from this source.">Enquiries</th><th class="r" title="Share of all clients in the CRM.">Share</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

/* ---------------- 4. Handoff rules ---------------- */
function handoff() {
  const s = S();
  const rules = s.handoffRules.map(r => '<tr class="' + (r.on ? '' : 'st-off') + '"><td><label class="st-sw"><input type="checkbox" data-rule="' + E(r.id) + '"' + (r.on ? ' checked' : '') + ' aria-label="' + E(r.name) + ' on or off"> <span>' + (r.on ? 'On' : 'Off') + '</span></label></td>' +
    '<td class="num">' + E(r.id) + '</td><td><b>' + E(r.name) + '</b></td><td class="st-wrap">' + E(r.trigger) + '</td><td class="st-wrap">' + E(r.action) + '</td></tr>').join('');
  const num = (key, label, val, help, min = 1, max = 100000, step = 1) => '<div class="field"><label for="st-n-' + key + '">' + E(label) + '</label><input class="input" type="number" id="st-n-' + key + '" data-set="' + key + '" data-min="' + min + '" data-max="' + max + '" step="' + step + '" value="' + E(val) + '"><div class="help">' + E(help) + '</div></div>';
  return '<p class="lede">These rules decide when the agent stops replying and a person takes over. Switch a rule off and the agent keeps going on its own for that case.</p>' +
    '<div class="card"><div class="card-h"><h2>Handoff rules</h2><span class="small muted">' + s.handoffRules.filter(r => r.on).length + ' of ' + s.handoffRules.length + ' on</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>State</th><th>Rule</th><th>Name</th><th>Trigger</th><th>What happens</th></tr></thead><tbody>' + rules + '</tbody></table></div></div>' +
    '<div class="card"><div class="card-h"><h2>Numbers behind the rules</h2><span class="small muted">Each change saves as you leave the field.</span></div><div class="card-b"><div class="st-nums">' +
    num('slaMinutes', 'SLA, minutes', s.slaMinutes, 'Time a person has to pick up a handed-over conversation.', 1, 1440) +
    num('freshnessDays', 'Freshness, days', s.freshnessDays, 'A unit not confirmed in this many days is no longer sent to occupiers.', 1, 90) +
    num('largeDealSqft', 'Large deal, sq ft', s.largeDealSqft, 'Requirements above this go to the senior manager.', 100, 1000000, 100) +
    num('largeDealMonthly', 'Large deal, ₹ a month', s.largeDealMonthly, 'All-in monthly rent above this also counts as a large deal.', 10000, 100000000, 10000) +
    num('minMatchScore', 'Minimum match score', s.minMatchScore, 'Below this, the agent calls it no good match (rule H6).', 0, 100) +
    num('maxQuestions', 'Maximum questions', s.maxQuestions, 'The most questions the agent asks before showing options.', 1, 20) +
    '<div class="field"><label>Nudge after, hours</label><div class="st-pair"><input class="input" type="number" aria-label="First nudge, hours" data-set="nudge0" data-min="1" data-max="720" value="' + E(s.nudgeHours[0]) + '"><input class="input" type="number" aria-label="Second nudge, hours" data-set="nudge1" data-min="1" data-max="720" value="' + E(s.nudgeHours[1]) + '"></div><div class="help">First and second reminder to an occupier who went quiet (24 and 72 by default).</div></div>' +
    '<div class="field"><label>Staffed hours (24-hour clock)</label><div class="st-pair"><input class="input" type="number" aria-label="Staffed from hour" data-set="staff0" data-min="0" data-max="23" value="' + E(s.staffedHours[0]) + '"><input class="input" type="number" aria-label="Staffed until hour" data-set="staff1" data-min="1" data-max="24" value="' + E(s.staffedHours[1]) + '"></div><div class="help">Outside these hours the agent tells the occupier a person will reply in the morning.</div></div>' +
    '</div><p class="st-msg" id="st-num-msg" role="status" style="margin:10px 0 0"></p></div></div>';
}
function setRule(t) {
  const r = S().handoffRules.find(x => x.id === t.dataset.rule); if (!r) return;
  r.on = t.checked;
  const tr = t.closest('tr'); if (tr) tr.classList.toggle('st-off', !r.on);
  const lab = t.parentElement.querySelector('span'); if (lab) lab.textContent = r.on ? 'On' : 'Off';
  const cnt = LC.$('.card-h .small', t.closest('.card')); if (cnt) cnt.textContent = S().handoffRules.filter(x => x.on).length + ' of ' + S().handoffRules.length + ' on';
  emitSettings(); saved();
}
function setNum(t) {
  const s = S(); const k = t.dataset.set; const msg = LC.$('#st-num-msg', root);
  const say = (m, c) => { if (msg) { msg.textContent = m; msg.className = 'st-msg ' + (c || ''); } };
  const v = parseFloat(t.value); const min = +t.dataset.min, max = +t.dataset.max;
  const cur = { slaMinutes: s.slaMinutes, freshnessDays: s.freshnessDays, largeDealSqft: s.largeDealSqft, largeDealMonthly: s.largeDealMonthly, minMatchScore: s.minMatchScore, maxQuestions: s.maxQuestions, nudge0: s.nudgeHours[0], nudge1: s.nudgeHours[1], staff0: s.staffedHours[0], staff1: s.staffedHours[1] };
  if (isNaN(v) || v < min || v > max) { t.value = cur[k]; say('Enter a number from ' + LC.fmtNum(min) + ' to ' + LC.fmtNum(max) + '. The old value was kept.', 'bad'); return; }
  if (k === 'nudge0' || k === 'nudge1') {
    const a = k === 'nudge0' ? v : s.nudgeHours[0], b = k === 'nudge1' ? v : s.nudgeHours[1];
    if (a >= b) { t.value = cur[k]; say('The second nudge must come after the first.', 'bad'); return; }
    s.nudgeHours = [a, b];
  } else if (k === 'staff0' || k === 'staff1') {
    const a = k === 'staff0' ? v : s.staffedHours[0], b = k === 'staff1' ? v : s.staffedHours[1];
    if (a >= b) { t.value = cur[k]; say('Staffed hours must start before they end.', 'bad'); return; }
    s.staffedHours = [a, b];
  } else s[k] = v;
  // keep the written rule text in step with the numbers
  const h5 = s.handoffRules.find(r => r.id === 'H5'); if (h5) h5.trigger = 'Requirement above ' + LC.fmtNum(s.largeDealSqft) + ' sq ft or above ' + LC.fmtLakh(s.largeDealMonthly) + ' a month all-in.';
  const h6 = s.handoffRules.find(r => r.id === 'H6'); if (h6) h6.trigger = 'Best match scores under ' + s.minMatchScore + ', or no unit passes the must-haves.';
  say('Saved.', 'good');
  emitSettings(); saved();
}

/* ---------------- 5. Team and access ---------------- */
function team() {
  const cl = LC.state.clients;
  const rows = LC.TEAM.map(t => {
    const open = cl.filter(c => c.agent === t.name && !['Lost', 'Signed lease', 'Nurture'].includes(c.stage)).length;
    return '<tr><td><b>' + E(t.name) + '</b>' + (t.name === LC.state.me ? ' <span class="pill brand">You</span>' : '') + '</td><td>' + E(t.role) + '</td>' +
      '<td><div class="st-chips">' + t.cities.map(c => '<span class="st-chip">' + E(c) + '</span>').join('') + '</div></td>' +
      '<td><div class="st-chips">' + t.langs.map(c => '<span class="st-chip">' + E(c) + '</span>').join('') + '</div></td>' +
      '<td class="r num" title="Clients assigned to this person that are not Lost, Signed lease or Nurture.">' + open + '</td></tr>';
  }).join('');
  const Y = '<span class="st-yes">✓ Yes</span>', O = '<span class="st-own">Own only</span>', N = '<span class="st-no">✗ No</span>';
  const M = [
    ['All clients', Y, Y, N, N],
    ['Own clients', Y, Y, Y, N],
    ['Inventory edit', Y, Y, O, N],
    ['Owner data', Y, Y, O, O],
    ['Analytics', Y, Y, O, N],
    ['Settings', Y, N, N, N],
  ];
  return '<div class="card"><div class="card-h"><h2>Team</h2><span class="small muted">Agents are assigned by city, language and current load.</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Role</th><th>Cities</th><th>Languages</th><th class="r">Open clients</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="card"><div class="card-h"><h2>Access matrix</h2><span class="small muted">✓ Yes = full access. Own only = their own clients, listings or units. ✗ No = cannot open it.</span></div><div class="tbl-wrap"><table class="tbl st-acc"><thead><tr><th>What</th><th>Admin</th><th>Leasing manager</th><th>Leasing executive</th><th>Owner</th></tr></thead><tbody>' +
    M.map(r => '<tr><td><b>' + E(r[0]) + '</b></td>' + r.slice(1).map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
    '<div class="card-b"><p class="note">Owners see only the units in their own name, through the weekly report and the owner co-pilot. They never see other owners, brokerage or mandate notes.</p></div></div>';
}

/* ---------------- 6. WhatsApp templates ---------------- */
const TPL = [
  { n: 'first_reply_en', cat: 'Utility', lang: 'English', ok: 'Approved', vars: '{{1}} occupier name, {{2}} city or area', body: 'Hello {{1}}, this is Leasify Commercial. Thanks for asking about commercial space in {{2}}. To find the right options, tell us what you will use the space for and roughly how many sq ft you need.' },
  { n: 'first_reply_hi', cat: 'Utility', lang: 'Hindi', ok: 'Approved', vars: '{{1}} occupier name, {{2}} city or area', body: 'नमस्ते {{1}}, हम Leasify Commercial से हैं। {{2}} में कमर्शियल जगह के बारे में पूछने के लिए धन्यवाद। सही विकल्प खोजने के लिए बताइए कि आप जगह का क्या उपयोग करेंगे और लगभग कितने वर्ग फ़ुट चाहिए।' },
  { n: 'first_reply_od', cat: 'Utility', lang: 'Odia', ok: 'Approved', vars: '{{1}} occupier name, {{2}} city or area', body: 'ନମସ୍କାର {{1}}, ଆମେ Leasify Commercial ରୁ କହୁଛୁ। {{2}}ରେ ବ୍ୟବସାୟିକ ସ୍ଥାନ ବିଷୟରେ ପଚାରିଥିବାରୁ ଧନ୍ୟବାଦ। ଠିକ୍ ବିକଳ୍ପ ଖୋଜିବା ପାଇଁ, ସ୍ଥାନଟି କେଉଁ କାମରେ ବ୍ୟବହାର କରିବେ ଏବଂ ପ୍ରାୟ କେତେ ବର୍ଗ ଫୁଟ୍ ଦରକାର ଜଣାନ୍ତୁ।' },
  { n: 'nudge_24h', cat: 'Utility', lang: 'English', ok: 'Approved', vars: '{{1}} occupier name, {{2}} what is still missing (for example budget)', body: 'Hello {{1}}, we are still holding your space search. To send the best options, we just need your {{2}}. Reply here whenever you are ready.' },
  { n: 'nudge_72h', cat: 'Marketing', lang: 'English', ok: 'Pending', vars: '{{1}} occupier name, {{2}} area', body: 'Hello {{1}}, new spaces have come up in {{2}} since we last spoke. Reply YES and we will send the ones that fit your budget and size.' },
  { n: 'shortlist_sent', cat: 'Utility', lang: 'English', ok: 'Approved', vars: '{{1}} occupier name, {{2}} number of units, {{3}} area', body: 'Hello {{1}}, here are {{2}} units in {{3}} that fit what you told us. Reply with a number to book a site visit, or ask us to change the search.' },
  { n: 'visit_booked', cat: 'Utility', lang: 'English', ok: 'Approved', vars: '{{1}} occupier name, {{2}} building and unit, {{3}} date and time, {{4}} map link', body: 'Hello {{1}}, your site visit to {{2}} is booked for {{3}}. Location: {{4}}. Our team will call you the day before to confirm.' },
  { n: 'visit_reminder', cat: 'Utility', lang: 'English', ok: 'Approved', vars: '{{1}} occupier name, {{2}} building and unit, {{3}} time, {{4}} agent name', body: 'Reminder: your site visit to {{2}} is today at {{3}}. {{4}} will meet you there. Reply 1 to confirm, 2 to reschedule.' },
  { n: 'owner_weekly_check', cat: 'Utility', lang: 'English', ok: 'Approved', vars: '{{1}} owner name, {{2}} building and unit, {{3}} rent per sq ft', body: 'Hello {{1}}, is {{2}} still available at ₹{{3}} per sq ft plus maintenance? Reply 1 Still available, 2 Something changed, 3 Leased.' },
  { n: 'owner_weekly_report', cat: 'Utility', lang: 'English', ok: 'Approved', vars: '{{1}} owner name, {{2}} week ending, {{3}} report text', body: 'Hello {{1}}, here is your weekly report from Leasify Commercial for the week to {{2}}.\n\n{{3}}\n\nReply 1, 2 or 3 to tell us if anything has changed.' },
  { n: 'owner_weekly_report_od', cat: 'Utility', lang: 'Odia', ok: 'Rejected', why: 'Rejected by Meta: the variable {{3}} is the last thing in the message. Variables cannot sit at the start or end. Add a closing line after it and submit again.', vars: '{{1}} owner name, {{2}} week ending, {{3}} report text', body: 'ନମସ୍କାର {{1}}, {{2}} ପର୍ଯ୍ୟନ୍ତ ସପ୍ତାହ ପାଇଁ Leasify Commercial ତରଫରୁ ଆପଣଙ୍କ ରିପୋର୍ଟ:\n\n{{3}}' },
  { n: 'nurture_checkin', cat: 'Marketing', lang: 'English', ok: 'Approved', vars: '{{1}} occupier name, {{2}} move-in month', body: 'Hello {{1}}, you told us you plan to move in around {{2}}. Is that still right? Reply 1 if yes, 2 if the plan changed, and we will update your search.' },
];
function templates() {
  const pill = { Approved: 'good', Pending: 'warn', Rejected: 'bad' };
  const ok = TPL.filter(t => t.ok === 'Approved').length;
  return '<p class="lede">Business-initiated messages must use templates approved by Meta. Submit them in week 1. Inside the 24 hours after an occupier writes, the agent can reply freely.</p>' +
    '<div class="row"><span class="pill good">' + ok + ' approved</span><span class="pill warn">' + TPL.filter(t => t.ok === 'Pending').length + ' pending</span><span class="pill bad">' + TPL.filter(t => t.ok === 'Rejected').length + ' rejected</span><span class="small muted">Statuses are sample data.</span></div>' +
    '<div class="st-tpls">' + TPL.map(t => '<div class="card st-tpl"><div class="between"><span class="nm">' + E(t.n) + '</span><span class="pill ' + pill[t.ok] + '">' + E(t.ok) + '</span></div>' +
      '<div class="row"><span class="pill ' + (t.cat === 'Utility' ? 'brand' : '') + '" title="Utility templates carry service messages. Marketing templates carry promotions and cost more per message.">' + E(t.cat) + '</span><span class="pill">' + E(t.lang) + '</span></div>' +
      '<div class="bd">' + E(t.body).replace(/\{\{(\d)\}\}/g, '<span class="st-var">{{$1}}</span>') + '</div>' +
      '<div class="small muted">Variables: ' + E(t.vars) + '</div>' + (t.why ? '<div class="st-why" role="note">' + E(t.why) + '</div>' : '') + '</div>').join('') + '</div>';
}

/* ---------------- 7. Consent log ---------------- */
function maskPhone(p) {
  const d = String(p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? '+91 ' + d.slice(0, 2) + 'XXX XXX' + d.slice(-2) : 'hidden';
}
function consent() {
  const log = LC.state.consent.slice().sort((a, b) => b.ts - a.ts).slice(0, 30);
  const out = LC.state.clients.filter(c => c.consent === false).length;
  const rows = log.map(c => '<tr><td class="num" style="white-space:nowrap">' + E(LC.fmtDT(c.ts)) + '</td><td>' + E(c.name) + '</td><td class="num">' + E(maskPhone(c.phone)) + '</td><td>' + E(c.channel) + '</td><td class="st-wrap">' + E(c.text) + '</td></tr>').join('');
  return '<p class="lede">Under the Digital Personal Data Protection Act, we ask for permission before the first message and keep a record of it.</p>' +
    '<div class="kpis"><div class="kpi"><div class="l">Consents on file</div><div class="v">' + LC.state.consent.length + '</div><div class="d">one per client</div></div>' +
    '<div class="kpi"><div class="l">Opted out</div><div class="v">' + out + '</div><div class="d">asked us to stop</div></div></div>' +
    '<div class="card"><div class="card-h"><h2>Latest 30 entries</h2></div>' + (rows ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Name</th><th>Phone (masked)</th><th>Channel</th><th>What they agreed to</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : LC.empty('No consent entries yet. Each new client adds one here.')) + '</div>' +
    '<div class="card"><div class="card-b stack"><p class="note">Opt-in comes before the first message. Portal and form leads agree on the form. For a walk-in or a call, the agent asks on WhatsApp first and sends nothing else until the client says yes.</p>' +
    '<p class="note">STOP handling: when a client replies STOP, the agent confirms once, marks the client Do not contact, cancels any nudges, and stops all business-initiated messages. The time of the STOP is kept in the same log.</p>' +
    '<p class="note">Phone numbers are masked on screen. Clients can ask for their data to be corrected or deleted, and the team does it from the client record.</p></div></div>';
}

/* ---------------- 8. Audit log ---------------- */
function audit() {
  const a = LC.state.audit.slice(0, 100);
  const rows = a.map(x => { const u = LC.unit(x.unitId);
    return '<tr><td class="num" style="white-space:nowrap">' + E(LC.fmtDT(x.ts)) + '</td><td><span class="unit-id">' + E(x.unitId) + '</span>' + (u ? '<div class="small muted">' + E(LC.unitShort(u)) + '</div>' : '') + '</td><td class="num">' + E(x.field) + '</td>' +
      '<td class="st-wrap" title="' + E((x.from || '(empty)') + ' → ' + (x.to || '(empty)')) + '"><span class="muted">' + E(x.from === '' || x.from == null ? '(empty)' : trunc(x.from)) + '</span> → <b>' + E(x.to === '' || x.to == null ? '(empty)' : trunc(x.to)) + '</b></td><td>' + E(x.by) + '</td></tr>'; }).join('');
  return '<p class="lede">Every change to a unit\'s terms or status is kept here with who made it and when. Owner replies on WhatsApp and Google Sheet syncs both write to this log.</p>' +
    '<div class="card"><div class="card-h"><h2>Unit changes</h2><span class="small muted">' + (LC.state.audit.length > 100 ? 'Latest 100 of ' + LC.state.audit.length : LC.state.audit.length + (LC.state.audit.length === 1 ? ' entry' : ' entries')) + '</span></div>' +
    (rows ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Unit</th><th>Field</th><th>Change</th><th>By</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : LC.empty('Changes to unit terms appear here with who made them and when.')) + '</div>';
}
const trunc = (s) => { s = String(s); return s.length > 60 ? s.slice(0, 57) + '...' : s; };

/* ---------------- 9. Integrations ---------------- */
function integrations() {
  const last = LC.state.syncLog[0];
  const live = !!LC.remote;                         // server build: WhatsApp and the AI service are real, so their cards show live status
  const I = [
    ['Google Sheet inventory sync', 'good', 'Connected (simulated)', 'Owners and agents edit one sheet. Leasify reads it, shows the changes, and only then applies them.' + (last ? ' Last sync ' + LC.relTime(last.ts) + ': ' + last.added + ' added, ' + last.changed + ' changed, ' + last.removed + ' off market.' : ' No sync has run in this demo yet. Run one from the Inventory screen.')],
    live ? null : ['WhatsApp Business API (provider)', 'good', 'Connected (simulated)', 'Messages go through an approved WhatsApp Business provider on the office number. Templates are listed under WhatsApp templates.'],
    ['Property portals', 'good', 'Connected (simulated)', '99acres, Magicbricks, Housing.com and JustDial lead emails are read automatically and pushed into the inbox.'],
    ['Google Calendar for visits', 'warn', 'Optional, not connected', 'Each booked visit would become an event for the agent, with the map link and the occupier\'s name.'],
    live ? ['Data hosting', 'good', 'Saved on the server', 'Everything is saved on the server, in a database, and shared with everyone who is signed in. It is not kept in your browser. Host it in an India region for client and owner data.']
      : ['Data hosting (India)', 'brand', 'Set at go-live', 'Client and owner data is stored in an India region and encrypted at rest. This demo keeps everything in your browser and sends nothing out.'],
  ].filter(Boolean);
  const card = (i) => '<div class="card"><div class="card-h"><h3>' + E(i[0]) + '</h3><span class="spacer"></span><span class="pill ' + i[1] + '">' + E(i[2]) + '</span></div><div class="card-b"><p class="small" style="margin:0;color:var(--fg-2)">' + E(i[3]) + '</p></div></div>';
  const lede = live ? 'What Leasify Commercial connects to. WhatsApp and the AI service show their real status. The other connections are simulated in this demo.'
    : 'What Leasify Commercial connects to. In this demo every connection is simulated.';
  if (live && Date.now() - liveCache.at > 10000) setTimeout(loadLive, 0);       // the screen redraws often while the simulator runs: ask the server at most every 10 s
  return '<p class="lede">' + lede + '</p><div class="st-integ">' + (live ? '<div class="card" id="st-wa-card">' + (liveCache.wa || liveShell('WhatsApp Business API')) + '</div><div class="card" id="st-ai-card">' + (liveCache.ai || liveShell('AI service')) + '</div>' : '') + I.map(card).join('') + '</div>';
}
const liveCache = { wa: '', ai: '', at: 0 };
const liveShell = (title) => '<div class="card-h"><h3>' + E(title) + '</h3><span class="spacer"></span><span class="pill">Checking</span></div><div class="card-b"><p class="small" style="margin:0;color:var(--fg-2)">Asking the server...</p></div>';
const liveCard = (title, pill, tone, body) => '<div class="card-h"><h3>' + E(title) + '</h3><span class="spacer"></span><span class="pill ' + tone + '">' + E(pill) + '</span></div><div class="card-b st-live">' + body + '</div>';
const kvRow = (k, v) => '<div class="st-kvr"><span>' + E(k) + '</span><b>' + v + '</b></div>';

function waCard(s) {
  if (!s) return liveCard('WhatsApp Business API', 'Not available', 'warn', '<p class="small" style="margin:0">The server did not answer. Try again in a moment.</p>');
  const rows = [];
  const url = s.webhookUrl
    ? '<code class="st-url" id="st-wa-url">' + E(s.webhookUrl) + '</code> <button type="button" class="btn sm" data-copy="' + E(s.webhookUrl) + '">Copy</button>'
    : '<span class="st-no">Set PUBLIC_BASE_URL on the server to get the link.</span>';
  rows.push(kvRow('Webhook URL to paste into Meta', url));
  rows.push(kvRow('Verify token', s.verifyTokenSet ? 'Set on the server (paste the same value into Meta)' : '<span class="st-no">Not set. Add WA_VERIFY_TOKEN.</span>'));
  rows.push(kvRow('Signature check', s.appSecretSet ? 'On' : '<span class="st-no">Off. Add WA_APP_SECRET.</span>'));
  rows.push(kvRow('Last message received', s.lastInboundAt ? E(LC.relTime(s.lastInboundAt)) : 'None yet'));
  rows.push(kvRow('Last problem', s.lastError ? E(s.lastError.message) + ' (' + E(LC.relTime(s.lastError.at)) + ')' : 'None'));
  const c = s.counts || {};
  rows.push(kvRow('Since the server started', E((c.inbound || 0) + ' received, ' + (c.sent || 0) + ' sent, ' + (c.failed || 0) + ' failed')));
  const lead = s.configured
    ? 'Connected. Messages go through the WhatsApp Cloud API on phone number id ' + E(s.phoneNumberId) + '. In Meta, open WhatsApp, then Configuration, paste the webhook URL and the verify token, and subscribe to the messages field.'
    : 'Not connected. Add WA_TOKEN and WA_PHONE_NUMBER_ID to the server settings. Until then the simulator and the test chat still work.';
  return liveCard('WhatsApp Business API', s.configured ? 'Connected' : 'Not connected', s.configured ? 'good' : 'warn', '<p class="small" style="margin:0 0 10px;color:var(--fg-2)">' + lead + '</p>' + rows.join(''));
}
function aiCard(s) {
  if (!s) return liveCard('AI service', 'Not available', 'warn', '<p class="small" style="margin:0">The server did not answer. Try again in a moment.</p>');
  const lead = s.configured
    ? 'On. It answers free-form questions in the co-pilot screens, reads pasted requirements, and reads WhatsApp messages the rules could not. It never writes the agent\'s replies and never decides a handoff. Phone numbers are removed before anything is sent.'
    : 'Off. Everything works on the built-in rules. Add AI_BASE_URL, AI_API_KEY and AI_MODEL to the server settings to turn it on.';
  const rows = s.configured ? kvRow('Model', E(s.model)) + (s.provider ? kvRow('Service', E(s.provider)) : '') : '';
  return liveCard('AI service', s.configured ? 'On' : 'Off', s.configured ? 'good' : 'warn', '<p class="small" style="margin:0 0 10px;color:var(--fg-2)">' + lead + '</p>' + rows);
}
async function loadLive() {
  liveCache.at = Date.now();
  const paint = (id, html) => { liveCache[id === 'st-wa-card' ? 'wa' : 'ai'] = html; const n = root && root.querySelector('#' + id); if (n && st.tab === 'integrations') n.innerHTML = html; };
  LC.net.api('GET', '/api/wa/status', undefined, { quiet401: true }).then((s) => paint('st-wa-card', waCard(s)), (e) => paint('st-wa-card', e && e.status === 403 ? liveCard('WhatsApp Business API', 'Managers only', 'warn', '<p class="small" style="margin:0">Only the CEO and managers can see the WhatsApp status.</p>') : waCard(null)));
  LC.net.aiStatus(true).then((s) => paint('st-ai-card', aiCard(s && s.configured !== undefined ? s : null)), () => paint('st-ai-card', aiCard(null)));
}

/* ---------------- live updates ---------------- */
let _t = null;
function refresh() {
  clearTimeout(_t);
  _t = setTimeout(() => {
    if (!LC.isActive('settings') || !root) return;
    if (['handoff', 'templates'].includes(st.tab)) return;
    const a = document.activeElement;
    if (a && root.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
    renderSection();
  }, 350);
}
['units:changed', 'clients:changed'].forEach(e => LC.on(e, refresh));
LC.on('settings:changed', () => { if (!selfEmit) refresh(); });
})();
