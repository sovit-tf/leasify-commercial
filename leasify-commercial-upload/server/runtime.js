'use strict';
/* =====================================================================
   Headless LC engine.
   Loads web/js/core.js and web/js/inbox.js into a Node vm context with a
   tiny window/document stub (nothing is rendered). The LC.state held here is
   the source of truth for the whole product.

   Use createRuntime() to get an isolated engine. Tests create several.
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CORE_FILE = path.join(ROOT, 'web', 'js', 'core.js');
const INBOX_FILE = path.join(ROOT, 'web', 'js', 'inbox.js');
const INVENTORY_FILE = path.join(ROOT, 'data', 'inventory.json');

/** A stand-in element: swallows every call so UI code that slipped through cannot crash the server. */
function stubElement() {
  const el = {
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [], childNodes: [], hidden: false, textContent: '', innerHTML: '', value: '',
    appendChild(c) { return c; }, removeChild() {}, remove() {}, setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
    addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    focus() {}, blur() {}, click() {}, contains: () => false, getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  };
  return el;
}

function createRuntime(opts = {}) {
  const timers = new Set();
  const track = (fn) => (...a) => { const h = fn(...a); timers.add(h); return h; };
  const doc = {
    ...stubElement(),
    documentElement: stubElement(), body: stubElement(), head: stubElement(),
    getElementById: () => null, createElement: () => stubElement(), createTextNode: () => stubElement(),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  };
  const sandbox = {
    console, URL, URLSearchParams, // JS built-ins (Date, Array, JSON...) come from the context itself
    setTimeout: track(setTimeout), setInterval: track(setInterval), clearTimeout, clearInterval,
    queueMicrotask, performance, TextEncoder, TextDecoder,
    document: doc,
    location: { hash: '', search: '', href: 'http://localhost/' },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} }, userAgent: 'leasify-server' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    innerWidth: 1280, scrollTo() {}, addEventListener() {}, removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox, { name: 'leasify-engine' });

  const run = (file) => vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  run(CORE_FILE);
  const LC = sandbox.LC;

  /* ---- no-op UI helpers (the server never renders) ---- */
  LC.registerView = () => {};
  LC.css = () => {};
  LC.toast = () => {};
  LC.drawer = () => ({ el: stubElement(), close() {} });
  LC.closeDrawer = () => {};
  LC.copy = async () => true;
  LC.applyRole = () => {};
  LC.updateNavCounts = () => {};
  LC.go = () => {};
  LC.show = () => {};

  /* ---- inventory from data/inventory.json, through the same normaliser the browser uses ---- */
  const inventoryFile = opts.inventoryFile || INVENTORY_FILE;
  LC.loadInventory = () => {
    const raw = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
    LC.INVENTORY_COLUMNS = Object.keys(raw[0]);
    // the dataset was generated relative to 10 Oct 2026; shift its dates so freshness reads the same today
    // pass a string: a host-realm Date fails `instanceof Date` inside the vm, which made the shift NaN (no shift)
    const shift = LC.daysBetween('2026-10-10', LC.today());
    return raw.map((r) => LC.normalizeUnit(r, shift));
  };

  /* ---- the demo clock: LC.NOW is "today" for every date helper ---- */
  const vmNow = vm.runInContext('(function () { return new Date(); })', sandbox);   // a Date from the engine's own realm
  const refreshNow = () => { LC.NOW = vmNow(); };
  refreshNow();
  const nowTimer = setInterval(refreshNow, 30000); nowTimer.unref(); timers.add(nowTimer);

  run(INBOX_FILE);
  if (!LC._engine) throw new Error('inbox.js did not export LC._engine');

  /* ---- event tap: server code sees every LC event ---- */
  const listeners = new Set();
  const origEmit = LC.emit;
  LC.emit = (evt, payload) => {
    origEmit(evt, payload);
    for (const fn of listeners) { try { fn(evt, payload); } catch (e) { console.error('[runtime] listener', e); } }
  };
  const onEmit = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  /* ---- message tap: every message the engine appends to a lead (see inbox.js, addMsg) ---- */
  const msgListeners = new Set();
  LC.onMessage = (lead, msg) => { for (const fn of msgListeners) { try { fn(lead, msg); } catch (e) { console.error('[runtime] onMessage', e); } } };
  const onMessage = (fn) => { msgListeners.add(fn); return () => msgListeners.delete(fn); };

  // keep the engine's own ids stable across the process: LC.uid uses Math.random, which is fine.
  LC.session = { name: 'Leasify server', role: 'ceo', owner: null, signedIn: true, at: Date.now(), logins: [] };

  /* JSON.parse inside the context, so records loaded from the database or a request are made by the engine's own realm */
  const parse = vm.runInContext('(function (s) { return JSON.parse(s); })', sandbox);

  const api = {
    LC,
    parse,
    clone: (o) => parse(JSON.stringify(o)),
    getLC: () => LC,
    get state() { return LC.state; },
    onEmit,
    onMessage,
    /** engine internals (createLead, receive, takeOver, handBack, agentSend, leadById, ...). See inbox.js. */
    get engine() { return LC._engine; },
    /** Build the demo state from the inventory file (units, ~96 clients, visits, tasks, ...). */
    seed() { refreshNow(); LC.initState(); return LC.state; },
    /** Same as the browser's "Reset demo data": engine timers and queues are cleared, then the state is rebuilt. */
    reset() { refreshNow(); LC.emit('reset'); LC.initState(); LC.emit('units:changed'); LC.emit('clients:changed'); return LC.state; },
    /** Replace the state wholesale (used when loading from the database). */
    setState(state) { LC.state = state; LC.emit('state:ready'); },
    /** Run fn with LC.state.me set to a person, so engine defaults ("by") read correctly. */
    withActor(name, fn) {
      const prev = LC.state && LC.state.me;
      if (LC.state) LC.state.me = name;
      try { return fn(); } finally { if (LC.state) LC.state.me = prev; }
    },
    close() {
      try { LC.sim && LC.sim.stop && LC.sim.stop(); } catch (e) { /* ignore */ }
      for (const h of timers) { clearInterval(h); clearTimeout(h); }
      timers.clear(); listeners.clear(); msgListeners.clear();
    },
  };
  return api;
}

module.exports = { createRuntime, ROOT };
