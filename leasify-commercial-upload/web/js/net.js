/* =====================================================================
   Leasify Commercial: NET (server mode only)
   Included right after core.js by `build.py --server`, which also sets window.LC_SERVER.
   The page then works on a replica of the server's state:
     - LC.initState / LC.boot wait for /api/bootstrap (after sign-in)
     - /api/events (SSE) patches the replica live and emits the usual LC events
     - the browser's own edits are diffed and pushed to /api/sync (debounced 250 ms, no echo)
   shortlist and compare stay local. Leads are server-owned: the browser never pushes them.
   Live agent layer: the inbox sends its actions to the server (see inbox.js, remote mode) and the AI shim below
   gives LC.ai.sample a /api/ai/chat backed implementation (the tool loop runs here, page tools stay in the page).
   Entry points: LC.net.api, LC.net.login, LC.net.logout, LC.net.users, LC.net.ownerReply,
                 LC.net.pushNow, LC.net.status, LC.net.ingest, LC.net.aiStatus. LC.remote is true.
   ===================================================================== */
(function () {
'use strict';
if (!window.LC_SERVER) return;
const LC = window.LC;
const net = LC.net = { clientId: 'b' + Math.random().toString(36).slice(2, 10), booted: false, connected: false, version: 0, epoch: null, boot: null };
LC.remote = true;

const RECORDS = ['units', 'clients', 'leads', 'visits', 'tasks', 'queue'];
const PUSHED = ['units', 'clients', 'visits', 'tasks', 'queue'];         // leads are server-owned
const APPENDS = ['activity', 'audit', 'consent', 'syncLog'];
const PUSHED_APPENDS = ['activity', 'consent', 'syncLog'];               // audit rows are written by the server
const ID = { units: (r) => r.unit_id };
const idOf = (coll, r) => (ID[coll] ? ID[coll](r) : r.id);
const FRONT = { clients: true, queue: true, activity: true, audit: true, syncLog: true };   // arrays the engine fills with unshift
const EVENT = { units: 'units:changed', clients: 'clients:changed', leads: 'leads:changed', visits: 'visits:changed', tasks: 'tasks:changed', queue: 'queue:changed' };
const J = JSON.stringify;

/* ---------------- http ---------------- */
async function api(method, url, body, opts = {}) {
  const res = await fetch(url, {
    method, credentials: 'same-origin', keepalive: !!opts.keepalive,
    headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    body: body !== undefined ? J(body) : undefined,
  });
  let data = null; try { data = await res.json(); } catch (e) { /* not json */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'The server said no (' + res.status + ').'); err.status = res.status; err.data = data;
    if (res.status === 401 && net.booted && !opts.quiet401) sessionEnded();
    throw err;
  }
  return data;
}
net.api = api;
net.users = () => api('GET', '/api/users').then((d) => d.users);
net.login = (userId, pin) => api('POST', '/api/login', { userId, pin }, { quiet401: true });
net.logout = async () => { try { await api('POST', '/api/logout', {}, { quiet401: true }); } catch (e) { /* already signed out */ } location.reload(); };
net.ownerReply = (unitId, n) => api('POST', '/api/owner/reply', { unitId, n });

function sessionEnded() {
  if (net._ending) return; net._ending = true;
  try { LC.toast('Your session ended. Please sign in again.'); } catch (e) { /* ignore */ }
  setTimeout(() => location.reload(), 900);
}

/* ---------------- replica bookkeeping ---------------- */
const synced = {};                 // coll -> Map(id -> json of the last version the server knows)
let settingsSynced = null;
const seenAppend = {};             // coll -> Set(_id)
let counter = 0;
const unsent = { activity: new Set(), consent: new Set(), syncLog: new Set() };   // log entries made here and not yet saved

function snapshot() {
  const S = LC.state;
  RECORDS.forEach((k) => { const m = new Map(); (S[k] || []).forEach((r) => m.set(idOf(k, r), J(r))); synced[k] = m; });
  settingsSynced = J(S.settings);
  APPENDS.forEach((k) => { seenAppend[k] = new Set((S[k] || []).filter((e) => e._id).map((e) => e._id)); });
}

function applyBootstrap(b) {
  const prev = LC.state;
  const st = { shortlist: prev ? prev.shortlist : [], compare: prev ? prev.compare : [], me: LC.session.role === 'owner' ? LC.CEO.name : LC.session.name };
  RECORDS.concat(APPENDS).forEach((k) => { st[k] = b.state[k] || []; });
  st.settings = b.state.settings;
  LC.state = st;
  if (b.columns) LC.INVENTORY_COLUMNS = b.columns;
  net.version = b.version; net.epoch = b.epoch;
  snapshot();
}

/* The page boots once the state is here: core.js calls LC.initState() from LC.boot(). */
LC.initState = function () {
  applyBootstrap(net.boot);
  LC.emit('state:ready');
};

/* ---------------- push: local edits -> /api/sync ---------------- */
let pushTimer = null, inflight = false, again = false, applying = 0;
const canPush = () => !!LC.state && LC.session.role !== 'owner' && net.booted;
function schedulePush(ms = 250) { if (applying || !canPush()) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => net.pushNow(), ms); }

function diffKeys(baseJson, rec) {
  const base = JSON.parse(baseJson); const keys = [];
  Object.keys(rec).forEach((k) => { if (J(rec[k]) !== J(base[k])) keys.push(k); });
  Object.keys(base).forEach((k) => { if (!(k in rec)) keys.push(k); });
  return keys;
}

function buildChanges() {
  const S = LC.state; const changes = []; const sent = []; const pendingAudit = [];
  PUSHED.forEach((k) => {
    const ups = [], patch = {}, removes = []; const now = new Set();
    (S[k] || []).forEach((r) => {
      const id = idOf(k, r); now.add(id);
      const json = J(r); const was = synced[k].get(id);
      if (was === json) return;
      if (was === undefined) { ups.push(r); } else { const keys = diffKeys(was, r); if (!keys.length) { synced[k].set(id, json); return; } ups.push(r); patch[id] = keys; }
      sent.push({ k, id, was, json });
    });
    if (k !== 'units' && k !== 'queue') for (const [id, was] of synced[k]) if (!now.has(id)) { removes.push(id); sent.push({ k, id, was, json: undefined }); }
    if (ups.length || removes.length) changes.push({ collection: k, upserts: ups, patch, removes });
  });
  if (J(S.settings) !== settingsSynced) {
    const base = JSON.parse(settingsSynced); const keys = Object.keys(S.settings).filter((x) => J(S.settings[x]) !== J(base[x]));
    if (keys.length) { changes.push({ collection: 'settings', upserts: [S.settings], patch: { main: keys } }); sent.push({ k: 'settings', id: 'main', was: settingsSynced, json: J(S.settings) }); }
  }
  PUSHED_APPENDS.forEach((k) => {
    (S[k] || []).forEach((e) => { if (!e._id) { e._id = 'n_' + net.clientId + '_' + (++counter); seenAppend[k].add(e._id); unsent[k].add(e); } });
    const list = Array.from(unsent[k]);
    if (list.length) { changes.push({ collection: k, upserts: list.map((e) => Object.assign({}, e)), removes: [] }); sent.push({ k, append: true, entries: list }); }
  });
  (S.audit || []).forEach((e) => { if (!e._id) pendingAudit.push(e); });
  return { changes, sent, pendingAudit };
}

net.pushNow = async function (opts = {}) {
  clearTimeout(pushTimer);
  if (!canPush()) return;
  if (inflight) { again = true; return; }
  const { changes, sent, pendingAudit } = buildChanges();
  if (!changes.length) return;
  inflight = true;
  const meta = net._meta || {}; net._meta = null;
  // optimistic: what we send is now "known", so edits made during the request show up as new changes
  const undo = [];
  sent.forEach((s) => {
    if (s.append) return;
    if (s.k === 'settings') { undo.push([s, settingsSynced]); settingsSynced = s.json; return; }
    const m = synced[s.k]; undo.push([s, m.get(s.id)]);
    if (s.json === undefined) m.delete(s.id); else m.set(s.id, s.json);
  });
  try {
    const res = await api('POST', '/api/sync', { clientId: net.clientId, changes, meta }, opts);
    sent.forEach((s) => { if (s.append) s.entries.forEach((e) => unsent[s.k].delete(e)); });
    applying++;
    try { afterSync(res, pendingAudit); } finally { applying--; }
    setPill(!net.connected);
  } catch (e) {
    undo.forEach(([s, prev]) => {                     // not saved: the next change tries again
      if (s.k === 'settings') { settingsSynced = prev; return; }
      if (prev === undefined) synced[s.k].delete(s.id); else synced[s.k].set(s.id, prev);
    });
    if (e.status !== 401) { setPill(true); schedulePush(4000); }
  } finally {
    inflight = false;
    if (again) { again = false; schedulePush(50); }
  }
};

function afterSync(res, pendingAudit) {
  const S = LC.state;
  // the server writes the audit rows for unit and settings changes: swap our local drafts for its rows
  if (pendingAudit.length) {
    S.audit = S.audit.filter((e) => !pendingAudit.includes(e));
  }
  if (res.audit && res.audit.length) {
    const fresh = res.audit.filter((e) => !seenAppend.audit.has(e._id));
    fresh.forEach((e) => seenAppend.audit.add(e._id));
    S.audit.unshift(...fresh);
  }
  if (pendingAudit.length || (res.audit && res.audit.length)) LC.emit('audit:changed');
  const touched = new Set();
  (res.rejected || []).forEach((r) => {
    const k = r.collection;
    if (k === 'settings') { if (r.current) { replaceKeys(S.settings, r.current); settingsSynced = J(r.current); touched.add('settings'); } return; }
    if (!synced[k]) return;
    if (r.current) upsertLocal(k, r.current, true); else if (r.id != null) { removeLocal(k, r.id); }
    touched.add(k);
  });
  if ((res.rejected || []).length) {
    const first = res.rejected[0];
    LC.toast('Not saved: ' + first.reason + ((res.rejected.length > 1) ? ' (and ' + (res.rejected.length - 1) + ' more)' : ''), 5200);
  }
  touched.forEach(emitFor);
}

/* ---------------- pull: server patches -> replica ---------------- */
function replaceKeys(target, src) {
  Object.keys(target).forEach((k) => { if (!(k in src)) delete target[k]; });
  Object.keys(src).forEach((k) => { target[k] = src[k]; });
}
const findLocal = (k, id) => (LC.state[k] || []).find((r) => idOf(k, r) === id);

/** Put a server record into the replica. Keys the person changed locally and has not pushed yet are kept (3-way merge). */
function upsertLocal(k, rec, force) {
  const id = idOf(k, rec); const incoming = J(rec); const was = synced[k].get(id);
  if (!force && was === incoming) return false;                       // our own echo, or nothing new
  const local = findLocal(k, id);
  if (!local) {
    if (FRONT[k]) LC.state[k].unshift(rec); else LC.state[k].push(rec);
  } else if (force || was === undefined) {
    replaceKeys(local, rec);
  } else {
    const base = JSON.parse(was);
    Object.keys(rec).forEach((key) => { if (J(local[key]) === J(base[key])) local[key] = rec[key]; });
    Object.keys(local).forEach((key) => { if (!(key in rec) && J(local[key]) === J(base[key])) delete local[key]; });
  }
  synced[k].set(id, incoming);
  return true;
}
function removeLocal(k, id) {
  const i = (LC.state[k] || []).findIndex((r) => idOf(k, r) === id);
  if (i >= 0) LC.state[k].splice(i, 1);
  synced[k].delete(id);
}

function emitFor(k, ids) {
  if (k === 'settings') return LC.emit('settings:changed');
  if (k === 'clients') (ids || []).forEach((id) => LC.emit('client:updated', id));
  if (k === 'leads') { LC.emit('leads:changed'); (ids || []).forEach((id) => LC.emit('lead:updated', id)); LC.emit('sim:tick'); return; }
  if (EVENT[k]) LC.emit(EVENT[k]);
}

function applyPatch(msg) {
  const k = msg.collection; if (!LC.state) return;
  applying++;
  try {
    if (APPENDS.includes(k)) {
      const rows = (msg.upserts || []).filter((e) => e._id && !seenAppend[k].has(e._id));
      if (!rows.length) return;
      rows.forEach((e) => seenAppend[k].add(e._id));
      if (FRONT[k]) LC.state[k].unshift(...rows); else LC.state[k].push(...rows);
      if (k === 'activity' && LC.state.activity.length > 400) LC.state.activity.length = 400;
      LC.emit(k + ':changed');
      if (k === 'audit') LC.emit('units:changed');
      return;
    }
    if (!synced[k]) return;
    const ids = [];
    (msg.upserts || []).forEach((rec) => { if (upsertLocal(k, rec, false)) ids.push(idOf(k, rec)); });
    (msg.removes || []).forEach((id) => { removeLocal(k, id); ids.push(id); });
    if (ids.length) emitFor(k, ids);
  } finally { applying--; }
}

/** Put a record that came back from an action (for example a lead after "take over") into the replica at once.
    Only if it is newer than what we hold, so a slow reply never undoes a fresher live update. */
net.ingest = function (k, rec) {
  if (!rec || !synced[k] || !LC.state) return;
  const local = findLocal(k, idOf(k, rec));
  if (local && local._ver != null && rec._ver != null && rec._ver < local._ver) return;
  applying++;
  try { if (upsertLocal(k, rec, false)) emitFor(k, [idOf(k, rec)]); } finally { applying--; }
};

function applySettings(settings) {
  applying++;
  try {
    const was = settingsSynced ? JSON.parse(settingsSynced) : null; const S = LC.state.settings;
    if (J(settings) === settingsSynced) return;
    if (!was) replaceKeys(S, settings);
    else Object.keys(settings).forEach((key) => { if (J(S[key]) === J(was[key])) S[key] = settings[key]; });
    settingsSynced = J(settings);
    LC.emit('settings:changed');
  } finally { applying--; }
}

/* ---------------- full reload of the replica (reset, server restart, missed updates) ---------------- */
let rehydrating = null;
net.rehydrate = function (why) {
  if (rehydrating) return rehydrating;
  rehydrating = (async () => {
    try {
      const b = await api('GET', '/api/bootstrap');
      applying++;
      try {
        if (why === 'reset') LC.emit('reset');
        applyBootstrap(b);
        LC.emit('state:ready');
        ['units:changed', 'clients:changed', 'visits:changed', 'tasks:changed', 'queue:changed', 'leads:changed', 'settings:changed'].forEach((e) => LC.emit(e));
        LC.emit('activity:changed');
        LC.show(LC.current || 'dashboard');
      } finally { applying--; }
      if (why === 'reset') LC.toast('Demo data was reset.');
      connectEvents();
    } catch (e) { /* the event stream will try again */ } finally { rehydrating = null; }
  })();
  return rehydrating;
};

/* ---------------- live updates (SSE) ---------------- */
let es = null, retry = 0, retryTimer = null;
function setPill(show) { const p = document.getElementById('net-pill'); if (p) p.hidden = !show; }

function connectEvents() {
  clearTimeout(retryTimer);
  if (es) { es.onmessage = es.onerror = null; es.close(); es = null; }
  const url = '/api/events?since=' + encodeURIComponent(net.version) + '&epoch=' + encodeURIComponent(net.epoch || '');
  es = new EventSource(url);
  es.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.v != null) net.version = Math.max(net.version, msg.v);
    switch (msg.type) {
      case 'hello': net.connected = true; retry = 0; setPill(false); if (net.epoch && msg.epoch !== net.epoch) { net.rehydrate('resync'); } LC.emit('net:hello'); break;
      case 'sim': LC.emit('sim:remote', msg.sim); break;                  // simulator state, from the server (inbox.js listens)
      case 'patch': applyPatch(msg); break;
      case 'settings': applySettings(msg.settings); break;
      case 'reset': net.rehydrate('reset'); break;
      case 'resync': net.rehydrate('resync'); break;
      case 'signed-out': sessionEnded(); break;
      default: break;
    }
  };
  es.onerror = () => {
    net.connected = false; setPill(true);
    if (es) { es.onmessage = es.onerror = null; es.close(); es = null; }
    const wait = Math.min(15000, 1000 * Math.pow(2, retry++));
    retryTimer = setTimeout(connectEvents, wait);
    // a 401 shows up as a failed connection: check the session now and then
    if (retry % 3 === 0) api('GET', '/api/me', undefined, { quiet401: true }).catch((e) => { if (e.status === 401) sessionEnded(); });
  };
}

/* ---------------- boot ---------------- */
function installPill() {
  if (document.getElementById('net-pill')) return;
  const bar = document.querySelector('.topbar'); if (!bar) return;
  const p = document.createElement('span'); p.className = 'pill warn'; p.id = 'net-pill'; p.hidden = true; p.setAttribute('role', 'status');
  p.innerHTML = '<span class="dot"></span>Reconnecting';
  const sim = document.getElementById('sim-pill'); bar.insertBefore(p, sim || document.getElementById('user-chip'));
}

function installResetButton() {
  const old = document.getElementById('btn-reset'); if (!old) return;
  const btn = old.cloneNode(true); old.replaceWith(btn);          // drops the local-only reset handler from core.js
  if (LC.session.role !== 'ceo') { btn.hidden = true; return; }
  btn.title = 'Rebuilds the sample data for everyone who is signed in. Only the CEO can do this.';
  let armed = false, timer = null;
  btn.addEventListener('click', async () => {
    if (!armed) {
      armed = true; btn.textContent = 'Click again to reset for everyone';
      timer = setTimeout(() => { armed = false; btn.textContent = 'Reset demo data'; }, 4000); return;
    }
    clearTimeout(timer); armed = false; btn.disabled = true; btn.textContent = 'Resetting...';
    try { await api('POST', '/api/reset', {}); await net.rehydrate('reset'); }
    catch (e) { LC.toast('Reset failed: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = 'Reset demo data'; }
  });
}

/** Called after the cookie is good: load the state, start the app, open the live connection. */
net.start = async function (me) {
  net.boot = await api('GET', '/api/bootstrap');
  const s = net.boot.session;
  const logins = (me.logins || []).slice(1).map((l) => ({ ts: l.ts, name: s.name, role: s.role }));
  LC.session = { name: s.name, role: s.role, owner: s.owner, signedIn: false, at: null, logins };
  window.__LC_SKIP_LOGIN = true;                                  // auth.js must not show the demo sign-in panel
  origBoot();
  net.booted = true;
  installPill(); installResetButton();
  LC.signIn({ name: s.name, role: s.role, owner: s.owner });
  connectEvents();
};

const origBoot = LC.boot;
LC.boot = async function () {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme || 'light';
  let me = null;
  try { me = await api('GET', '/api/me', undefined, { quiet401: true }); } catch (e) { me = null; }
  if (me) { try { await net.start(me); return; } catch (e) { console.error('[net] start failed', e); } }
  window.__LC_SKIP_LOGIN = false;
  if (LC.auth) LC.auth.show();
};

/* ---------------- AI shim: window.claude.use('sample') on top of /api/ai/chat ---------------- */
LC.aiName = 'AI';                                                  // the label on answers in server mode (the offline build says Claude)
const MAX_ROUNDS = 6;
let aiStatusP = null;
net.aiStatus = (force) => {
  if (!aiStatusP || force) aiStatusP = api('GET', '/api/ai/status', undefined, { quiet401: true }).catch(() => ({ configured: false }));
  return aiStatusP;
};

/** Images are shrunk before they go to the server: at most 1280 px on the long side, JPEG. */
async function blobToDataUrl(blob) {
  const raw = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob); });
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } catch (e) { return raw; }
}

async function buildMessages(input, opts) {
  let msgs;
  if (typeof input === 'string') msgs = [{ role: 'user', content: input }];
  else if (Array.isArray(input)) msgs = input.map((m) => ({ role: m.role || 'user', content: m.content }));
  else msgs = [{ role: 'user', content: String(input == null ? '' : input) }];
  if (opts.system) msgs.unshift({ role: 'system', content: String(opts.system) });
  const imgs = Array.isArray(opts.images) ? opts.images.slice(0, 3) : [];
  if (imgs.length) {
    const urls = await Promise.all(imgs.map(blobToDataUrl));
    const last = msgs[msgs.length - 1];
    const text = typeof last.content === 'string' ? last.content : '';
    last.content = [{ type: 'text', text }].concat(urls.map((u) => ({ type: 'image_url', image_url: { url: u } })));
  }
  return msgs;
}

function aiError(e) {
  const err = new Error((e && e.message) || 'The AI service did not answer.');
  err.code = e && e.status === 503 ? 'unavailable' : 'failed'; err.status = e && e.status;
  return err;
}

/** The tool loop: ask, run the page tools the model asked for, ask again. At most 6 requests; the last one has no tools. */
async function runSample(input, opts, wantJson) {
  opts = opts || {};
  const tools = wantJson ? [] : (Array.isArray(opts.tools) ? opts.tools.filter((t) => t && t.name) : []);
  const messages = await buildMessages(input, opts);
  const runners = new Map(tools.map((t) => [t.name, t.execute]));
  const defs = tools.map((t) => ({ name: t.name, description: t.description || '', parameters: t.inputSchema || t.parameters || { type: 'object', properties: {} } }));
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const useTools = defs.length > 0 && round < MAX_ROUNDS;
    let res;
    try { res = await api('POST', '/api/ai/chat', { messages, tools: useTools ? defs : undefined, json: wantJson || undefined }, { quiet401: true }); }
    catch (e) { throw aiError(e); }
    if (useTools && res.tool_calls && res.tool_calls.length) {
      messages.push(res.assistant);
      for (const call of res.tool_calls) {
        let out;
        try { const fn = runners.get(call.name); out = fn ? await fn(call.arguments || {}) : { error: 'There is no tool called ' + call.name + '.' }; }
        catch (e) { out = { error: String((e && e.message) || e) }; }
        let text = typeof out === 'string' ? out : JSON.stringify(out === undefined ? null : out);
        if (text.length > 12000) text = text.slice(0, 12000) + '...';
        messages.push({ role: 'tool', tool_call_id: call.id, content: text });
      }
      continue;
    }
    if (wantJson) return res.json != null ? res.json : res.text;
    return { text: res.text || '' };
  }
  throw aiError({ message: 'The AI service kept asking for tools.' });
}

function makeSample() {
  const sample = (input, opts) => runSample(input, opts, false);
  sample.json = (input, opts) => runSample(input, opts, true);
  return sample;
}

if (!window.claude) {
  window.claude = {
    use(name) {
      if (name === 'sample') return net.aiStatus().then((s) => (s && s.configured ? makeSample() : null));
      return Promise.resolve(null);                                // no connectors in server mode
    },
  };
}

/* ---------------- wiring ---------------- */
const baseEmit = LC.emit;
const PUSH_EVENTS = new Set(['units:changed', 'clients:changed', 'client:updated', 'visits:changed', 'tasks:changed', 'queue:changed', 'settings:changed', 'audit:changed', 'activity:changed']);
LC.emit = function (evt, payload) {
  baseEmit(evt, payload);
  if (PUSH_EVENTS.has(evt)) schedulePush();
};
// units sync from a sheet should be recorded as "sheet" in the audit log
const baseApply = LC.applyUnitDiff;
LC.applyUnitDiff = function (incoming, diff, source, by) { net._meta = { channel: 'sheet', source: source || 'Google Sheet' }; return baseApply.apply(LC, arguments); };
setInterval(() => { if (document.visibilityState === 'visible') schedulePush(0); }, 5000);   // safety net for edits that fire no event
window.addEventListener('pagehide', () => { net.pushNow({ keepalive: true }); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && net.booted && !net.connected) { retry = 0; connectEvents(); } });

net.status = () => ({ connected: net.connected, version: net.version, epoch: net.epoch, inflight, clientId: net.clientId });
})();
