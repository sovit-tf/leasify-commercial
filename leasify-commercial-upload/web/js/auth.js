/* =====================================================================
   Leasify Commercial demo: SIGN-IN and USER MENU
   Loads last. Shows a sign-in page over the app on boot (skipped when
   window.__LC_SKIP_LOGIN is true), a user menu on the top bar, and keeps
   the role in force after "Reset demo data".
   SERVER MODE (window.LC_SERVER, see net.js): the people come from /api/users, the PIN is checked by
   /api/login, sign-out calls /api/logout and the role comes from the server session.
   Entry points: LC.auth.show(), LC.auth.hide()
   ===================================================================== */
(function () {
'use strict';
const LC = window.LC;
const esc = LC.esc;
const initials = (n) => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

LC.css(`
#login-root:empty { display: none; }
.au { position: fixed; inset: 0; z-index: 90; background: var(--bg); overflow-y: auto; display: grid; place-items: start center; padding: 28px 16px 40px; }
.au-card { width: min(920px, 100%); background: var(--surface); border: 1px solid var(--hair); border-radius: 14px; box-shadow: var(--shadow); display: grid; gap: 0; overflow: hidden; }
.au-top { padding: 22px 26px 6px; display: grid; gap: 6px; }
.au-brand { display: flex; align-items: center; gap: 10px; font-family: var(--f-head); font-weight: 700; font-size: 16px; }
.au-mark { width: 32px; height: 32px; border-radius: 8px; background: var(--brand); color: var(--on-brand); display: grid; place-items: center; font-weight: 700; }
.au-top h1 { font-size: 26px; font-weight: 700; margin-top: 10px; }
.au-top p { margin: 0; color: var(--muted); font-size: 13.5px; }
.au-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 26px; padding: 18px 26px 26px; align-items: start; }
.au-form { display: grid; gap: 14px; }
.au-form .btn.primary { justify-content: center; padding: 10px 14px; font-size: 14px; }
.au-who { display: flex; gap: 10px; align-items: center; background: var(--surface-2); border-radius: 8px; padding: 10px 12px; min-width: 0; }
.au-who b { font-weight: 600; } .au-who div span { font-size: 12px; color: var(--muted); display: block; }
.au-err { margin: 0; color: var(--bad); background: var(--bad-bg); border-radius: 6px; padding: 8px 10px; font-size: 12.5px; }
.au-err:empty { display: none; }
.au-demo { display: grid; gap: 8px; }
.au-demo h2 { font-size: 13px; font-weight: 600; letter-spacing: .02em; }
.au-demo p { margin: 0 0 2px; font-size: 12px; color: var(--muted); }
.au-list { display: grid; gap: 6px; }
.au-p { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 10px; align-items: center; text-align: left; width: 100%; border: 1px solid var(--hair); background: var(--surface); border-radius: 10px; padding: 8px 10px; }
.au-p:hover { border-color: var(--brand); }
.au-p[aria-checked="true"] { border-color: var(--brand); background: var(--glow); box-shadow: 0 0 0 1px var(--brand); }
.au-av { width: 38px; height: 38px; border-radius: 50%; background: var(--brand); color: var(--on-brand); display: grid; place-items: center; font-weight: 700; font-size: 13px; font-family: var(--f-head); flex: none; }
.au-av.owner { background: var(--s2); }
.au-p b { display: block; font-weight: 600; font-size: 13.5px; overflow-wrap: anywhere; }
.au-p .s { font-size: 12px; color: var(--muted); }
.au-owner { display: grid; gap: 6px; border: 1px solid var(--hair); border-radius: 10px; padding: 8px 10px 10px; background: var(--surface); }
.au-owner[data-on="true"] { border-color: var(--brand); background: var(--glow); box-shadow: 0 0 0 1px var(--brand); }
.au-owner .au-p { border: 0; padding: 0; background: transparent; box-shadow: none; }
.au-owner .au-p[aria-checked="true"] { background: transparent; box-shadow: none; }
.au-note { font-size: 12px; color: var(--muted); margin: 0; border-left: 2px solid var(--brand); padding: 2px 0 2px 10px; }
.au-pop { position: fixed; z-index: 60; width: min(300px, calc(100vw - 24px)); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 12px 40px rgba(0, 0, 0, .22); padding: 14px; display: grid; gap: 10px; }
.au-pop .au-who { background: transparent; padding: 0; }
.au-pop dl { margin: 0; display: grid; gap: 4px; font-size: 12.5px; }
.au-pop dl div { display: flex; justify-content: space-between; gap: 10px; }
.au-pop dt { color: var(--muted); } .au-pop dd { margin: 0; text-align: right; font-weight: 500; }
.au-pop .au-btns { display: grid; gap: 6px; }
.au-pop .btn { justify-content: center; }
.user-chip[aria-expanded="true"] { border-color: var(--brand); }
@media (max-width: 860px) {
  .au-body { grid-template-columns: minmax(0, 1fr); gap: 20px; padding: 14px 16px 20px; }
  .au-top { padding: 18px 16px 4px; }
  .au-top h1 { font-size: 22px; }
}
`);

/* ------------------------------------------------------------------ the people in the demo panel */
const PH = (n) => '+91 90000 ' + (10000 + n);
const mail = (name) => name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.').replace(/^(\w+)\.\w+\.(\w+)$/, '$1.$2') + '@leasify.example';
let serverUsers = null;     // server mode: [{id, name, role, kind, ownerName, title, detail}]
function people() {
  if (serverUsers) return serverUsers.filter(u => u.kind === 'person').map(u => ({ key: u.id, name: u.name, role: u.role, title: u.title, city: u.detail }));
  const list = [{ key: 'ceo', name: LC.CEO.name, role: 'ceo', title: 'CEO', city: 'All cities', phone: PH(0), email: mail(LC.CEO.name) }];
  LC.TEAM.forEach((t, i) => list.push({ key: t.id, name: t.name, role: t.senior ? 'manager' : 'executive', title: t.senior ? 'Leasing manager' : 'Leasing executive', city: t.cities.join(', '), phone: PH(i + 1), email: mail(t.name) }));
  return list;
}
const owners = () => serverUsers
  ? serverUsers.filter(u => u.kind === 'owner').map(u => u.ownerName || u.name).sort((a, b) => a.localeCompare(b))
  : Array.from(new Set((LC.state ? LC.state.units : []).map(u => u.owner_name))).sort((a, b) => a.localeCompare(b));
const ownerId = (name) => { const u = (serverUsers || []).find(x => x.kind === 'owner' && (x.ownerName || x.name) === name); return u ? u.id : null; };
const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);

/* ------------------------------------------------------------------ sign-in page */
let sel = null;          // { kind: 'person', key } | { kind: 'owner', name }
const root = () => LC.$('#login-root');
let lastFocus = null;

function show() {
  const el = root(); if (!el) return;
  if (LC.net && !serverUsers) {
    el.innerHTML = '<div class="au"><div class="au-card"><div class="au-top"><div class="au-brand"><span class="au-mark" aria-hidden="true">L</span>Leasify Commercial</div><p id="au-load" role="status">Loading the sign-in page...</p></div></div></div>';
    LC.net.users().then(u => { serverUsers = u; show(); }).catch(() => { const l = LC.$('#au-load', el); if (l) l.textContent = 'The server did not answer. Reload the page in a moment.'; });
    return;
  }
  closePop();
  if (LC.closeDrawer) LC.closeDrawer();
  lastFocus = document.activeElement;
  const P = people(), ow = owners();
  if (!sel) { const cur = LC.session && LC.session.role === 'owner' ? { kind: 'owner', name: LC.session.owner } : P.find(p => p.name === LC.session.name) ? { kind: 'person', key: P.find(p => p.name === LC.session.name).key } : { kind: 'person', key: 'ceo' }; sel = cur; }
  if (sel.kind === 'owner' && !ow.includes(sel.name)) sel = { kind: 'owner', name: ow[0] };
  el.innerHTML = '<div class="au" role="dialog" aria-modal="true" aria-labelledby="au-h"><div class="au-card">' +
    '<div class="au-top"><div class="au-brand"><span class="au-mark" aria-hidden="true">L</span>Leasify Commercial</div><h1 id="au-h">Sign in to your leasing desk</h1><p>Odisha commercial leasing. This is a sample workspace: every person, unit and company is invented.</p></div>' +
    '<div class="au-body"><form class="au-form" id="au-form" novalidate>' +
    '<div class="au-who" id="au-who" aria-live="polite"></div>' +
    (serverUsers ? '' : '<div class="field"><label for="au-id">Phone number or email</label><input class="input" id="au-id" type="text" autocomplete="off" inputmode="email" spellcheck="false"></div>') +
    '<div class="field"><label for="au-pin">4-digit PIN</label><input class="input" id="au-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="' + (serverUsers ? 'current-password' : 'off') + '" value="' + (serverUsers ? '' : '1234') + '"></div>' +
    '<p class="au-err" id="au-err" role="alert"></p>' +
    '<button type="submit" class="btn primary" id="au-go">Sign in</button>' +
    (serverUsers ? '<p class="au-note">Demo PIN: 2580</p></form>' : '<p class="au-note">Demo: any PIN works. In the live product each person signs in with their phone number and a one-time code.</p></form>') +
    '<div class="au-demo"><h2 id="au-dh">Demo panel: pick who to sign in as</h2><p>Each person sees a different set of screens. ' + (serverUsers ? 'Pick someone, then enter the PIN.' : 'The sign-in details on the left fill in when you pick someone.') + '</p>' +
    '<div class="au-list" role="radiogroup" aria-labelledby="au-dh">' +
    P.map(p => personBtn(p)).join('') +
    '<div class="au-owner" id="au-owner" data-on="false"><button type="button" role="radio" class="au-p" data-owner-radio aria-checked="false"><span class="au-av owner" aria-hidden="true">O</span><span><b>Sign in as an owner</b><span class="s">Only the owner portal, only their own units</span></span><span></span></button>' +
    '<div class="field"><label for="au-owner-sel">Owner</label><select class="input" id="au-owner-sel">' + ow.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('') + '</select></div></div>' +
    '</div></div></div></div></div>';
  wire(el);
  paintSel(true);
  el.dataset.ready = '1';
  inertApp(true);
  const first = LC.$('[role="radio"][aria-checked="true"]', el) || LC.$('[role="radio"]', el); if (first) first.focus();
}
function personBtn(p) {
  const r = LC.ROLES[p.role].label;
  return '<button type="button" role="radio" class="au-p" data-key="' + esc(p.key) + '" aria-checked="false"><span class="au-av" aria-hidden="true">' + esc(initials(p.name)) + '</span><span><b>' + esc(p.name) + '</b><span class="s">' + esc(r) + ' · ' + esc(p.city) + '</span></span><span class="pill ' + (p.role === 'ceo' ? 'brand' : p.role === 'manager' ? 'good' : '') + '">' + esc(p.role === 'ceo' ? 'Every screen' : p.role === 'manager' ? 'All but Settings' : 'Own work') + '</span></button>';
}
function paintSel(setField) {
  const el = root(), P = people();
  LC.$$('[data-key]', el).forEach(b => { const on = sel.kind === 'person' && sel.key === b.dataset.key; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  const ob = LC.$('[data-owner-radio]', el), on = sel.kind === 'owner';
  ob.setAttribute('aria-checked', String(on)); ob.tabIndex = on ? 0 : -1; LC.$('#au-owner', el).dataset.on = String(on);
  if (!LC.$('[role="radio"][tabindex="0"]', el)) LC.$('[role="radio"]', el).tabIndex = 0;
  if (on) LC.$('#au-owner-sel', el).value = sel.name;
  let name, sub, id;
  if (on) { name = sel.name; sub = 'Owner · own units only'; id = '+91 90000 ' + (20000 + owners().indexOf(sel.name)); }
  else { const p = P.find(x => x.key === sel.key); name = p.name; sub = LC.ROLES[p.role].label + ' · ' + p.city; id = p.phone; }
  LC.$('#au-who', el).innerHTML = '<span class="au-av' + (on ? ' owner' : '') + '" aria-hidden="true">' + esc(initials(name)) + '</span><div><b>' + esc(name) + '</b><span>' + esc(sub) + '</span></div>';
  if (setField) { const f = LC.$('#au-id', el); if (f) f.value = id; LC.$('#au-err', el).textContent = ''; }
  if (serverUsers && setField) { const pin = LC.$('#au-pin', el); if (pin && document.activeElement && document.activeElement.closest && document.activeElement.closest('.au-list') && el.dataset.ready) pin.focus(); }
}
function wire(el) {
  const radios = () => LC.$$('[role="radio"]', el);
  el.onclick = (e) => {
    const b = e.target.closest('[data-key]'); if (b) { sel = { kind: 'person', key: b.dataset.key }; paintSel(true); b.focus(); return; }
    const o = e.target.closest('[data-owner-radio]'); if (o) { sel = { kind: 'owner', name: LC.$('#au-owner-sel', el).value }; paintSel(true); o.focus(); }
  };
  el.onkeydown = (e) => {
    const r = e.target.closest && e.target.closest('[role="radio"]');
    if (r && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault(); const L = radios(), i = L.indexOf(r), n = L[(i + (/Down|Right/.test(e.key) ? 1 : -1) + L.length) % L.length]; n.click();
    }
  };
  LC.$('#au-owner-sel', el).onchange = (e) => { sel = { kind: 'owner', name: e.target.value }; paintSel(true); };
  LC.$('#au-form', el).onsubmit = (e) => { e.preventDefault(); submit(); };
}
async function submitServer() {
  const el = root(), err = LC.$('#au-err', el), pin = LC.$('#au-pin', el).value.trim(), btn = LC.$('#au-go', el);
  const userId = sel.kind === 'owner' ? ownerId(sel.name) : sel.key;
  if (!/^\d{4}$/.test(pin)) { err.textContent = 'Enter the 4-digit PIN.'; LC.$('#au-pin', el).focus(); return; }
  btn.disabled = true; err.textContent = '';
  try {
    const me = await LC.net.login(userId, pin);
    hide();
    await LC.net.start(me);
    LC.toast('Signed in as ' + LC.session.name + ' (' + LC.ROLES[LC.session.role].label.toLowerCase() + ').');
  } catch (e) {
    err.textContent = e.message || 'Sign-in failed. Try again.';
    const p = LC.$('#au-pin', el); if (p) { p.value = ''; p.focus(); }
    btn.disabled = false;
  }
}
function submit() {
  if (serverUsers) return submitServer();
  const el = root(), err = LC.$('#au-err', el), id = LC.$('#au-id', el).value.trim(), pin = LC.$('#au-pin', el).value.trim();
  const P = people();
  if (!id) { err.textContent = 'Enter a phone number or an email.'; LC.$('#au-id', el).focus(); return; }
  if (!/^\d{4}$/.test(pin)) { err.textContent = 'Enter a 4-digit PIN. Any four digits work in this demo.'; LC.$('#au-pin', el).focus(); return; }
  let who = null;
  const match = P.find(p => p.email === id.toLowerCase() || (digits(p.phone) && digits(p.phone) === digits(id) && /\d{10}/.test(id.replace(/\D/g, ''))));
  if (sel.kind === 'owner') {
    const expect = '+91 90000 ' + (20000 + owners().indexOf(sel.name));
    if (digits(id) !== digits(expect) && !match) { err.textContent = 'That phone number is not on the demo list. Pick a person on the right, or use the number that fills in.'; return; }
    if (match) who = { name: match.name, role: match.role, owner: null }; else who = { name: sel.name, role: 'owner', owner: sel.name };
  } else {
    if (match) who = { name: match.name, role: match.role, owner: null };
    else { const p = P.find(x => x.key === sel.key); if (digits(id) === digits(p.phone) || id.toLowerCase() === p.email) who = { name: p.name, role: p.role, owner: null }; }
    if (!who) { err.textContent = 'That phone number or email is not on the demo list. Pick a person on the right, or use the details that fill in.'; return; }
  }
  sel = who.role === 'owner' ? { kind: 'owner', name: who.owner } : { kind: 'person', key: P.find(p => p.name === who.name).key };
  hide();
  LC.signIn(who);
  LC.toast('Signed in as ' + who.name + ' (' + LC.ROLES[who.role].label.toLowerCase() + ').');
}
function inertApp(on) {
  ['.app', '#drawer-root'].forEach(s => { const n = LC.$(s); if (n) { if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert'); } });
}
function hide() {
  const el = root(); if (el) el.innerHTML = '';
  inertApp(false);
  if (lastFocus && lastFocus.isConnected && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { } }
}
LC.auth = { show, hide };

/* ------------------------------------------------------------------ user menu */
let pop = null;
function closePop() {
  if (pop) { pop.remove(); pop = null; }
  const chip = LC.$('#user-chip'); if (chip) chip.setAttribute('aria-expanded', 'false');
}
function openPop() {
  const chip = LC.$('#user-chip'); if (!chip) return;
  closePop();
  const s = LC.session, role = LC.ROLES[s.role];
  const since = s.signedIn && s.at ? LC.dayLabel(s.at) + ', ' + LC.fmtTime(s.at) : 'Not signed in (demo default)';
  const prev = (s.logins || []).filter(l => l.name === s.name)[1];
  const btns = (s.role === 'ceo' || s.role === 'manager' ? '<button type="button" class="btn" data-pop="team">My team\'s report cards</button>' : s.role === 'executive' ? '<button type="button" class="btn" data-pop="team">My report card</button>' : '') +
    '<button type="button" class="btn" data-pop="switch">Switch user</button><button type="button" class="btn" data-pop="out">Sign out</button>';
  pop = document.createElement('div'); pop.className = 'au-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Your account');
  pop.innerHTML = '<div class="au-who"><span class="au-av' + (s.role === 'owner' ? ' owner' : '') + '" aria-hidden="true">' + esc(initials(s.name)) + '</span><div><b>' + esc(s.name) + '</b><span>' + esc(role.label) + '</span></div></div>' +
    '<dl><div><dt>Role</dt><dd>' + esc(role.label) + '</dd></div><div><dt>Signed in since</dt><dd>' + esc(since) + '</dd></div>' + (prev ? '<div><dt>Time before</dt><dd>' + esc(LC.dayLabel(prev.ts) + ', ' + LC.fmtTime(prev.ts)) + '</dd></div>' : '') + (s.role === 'owner' ? '<div><dt>Units</dt><dd>Own units only</dd></div>' : '<div><dt>Screens</dt><dd>' + (role.views === '*' ? 'Every screen' : role.views.length + ' screens') + '</dd></div>') + '</dl>' +
    '<div class="au-btns">' + btns + '</div>';
  document.body.appendChild(pop);
  const r = chip.getBoundingClientRect(); const w = pop.offsetWidth;
  pop.style.top = Math.round(r.bottom + 8) + 'px'; pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w)) + 'px';
  chip.setAttribute('aria-expanded', 'true');
  const f = LC.$('button', pop); if (f) f.focus();
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pop]'); if (!b) return; const a = b.dataset.pop; closePop();
    if (a === 'team') LC.go('team');
    else if (LC.net) { LC.net.logout(); }
    else { if (a === 'out') { LC.session.signedIn = false; } sel = null; show(); }
  });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop) { closePop(); const c = LC.$('#user-chip'); if (c) c.focus(); } });
document.addEventListener('click', (e) => { if (pop && !pop.contains(e.target) && !e.target.closest('#user-chip')) closePop(); });
window.addEventListener('resize', closePop);
LC.on('route', closePop);

/* ------------------------------------------------------------------ role in force */
const baseApply = LC.applyRole;
LC.applyRole = function () {
  baseApply();
  const a = LC.$('.nav a[data-v="team"]');
  if (a) { const tn = Array.from(a.childNodes).find(n => n.nodeType === 3); if (tn) tn.nodeValue = LC.session.role === 'executive' ? 'My report card' : 'Team report cards'; }
};
LC.on('state:ready', () => {
  if (LC.state && LC.session.role === 'owner') LC.state.me = LC.CEO.name;
  LC.applyRole();
});
LC.on('boot', () => {
  const chip = LC.$('#user-chip');
  if (chip) { chip.setAttribute('aria-expanded', 'false'); chip.setAttribute('aria-label', 'Your account and sign-out'); chip.addEventListener('click', () => { if (pop) closePop(); else openPop(); }); }
  LC.applyRole();
  if (!window.__LC_SKIP_LOGIN) show();
});
})();
