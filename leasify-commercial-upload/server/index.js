'use strict';
// The desk runs on India time (visit slots, staffed hours, 'today'), whatever the host's zone is.
process.env.TZ = process.env.TZ || 'Asia/Kolkata';
/* =====================================================================
   Leasify Commercial server.
   createApp(config) builds everything (engine, database, auth, live sync, HTTP) and returns
   { start, close, ... }. `node server/index.js` starts it from environment variables.
   ===================================================================== */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

const { createRuntime, ROOT } = require('./runtime');
const { Tracker } = require('./collections');
const { Store, createPool, migrate } = require('./store');
const { createAuth } = require('./auth');
const { createSync } = require('./sync');

const PAGE = path.join(ROOT, 'web', 'dist', 'app.html');

function configFromEnv(env = process.env) {
  const num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    port: num(env.PORT, 3000),
    host: env.HOST || undefined,
    databaseUrl: env.DATABASE_URL || 'postgres://leasify:leasify@localhost:5432/leasify',
    schema: env.DB_SCHEMA || undefined,
    demoPin: env.DEMO_PIN || '2580',
    sessionHours: num(env.SESSION_HOURS, 12),
    flushMs: num(env.FLUSH_MS, 500),
    publicBaseUrl: (env.PUBLIC_BASE_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, ''),   // Render sets RENDER_EXTERNAL_URL
    trustProxy: env.TRUST_PROXY || 'loopback, linklocal, uniquelocal',
    allowAnyOrigin: env.ALLOW_ANY_ORIGIN === '1',
    production: env.NODE_ENV === 'production',
    quiet: false,
    env,
  };
}

/** Build web/dist/app.html when it is missing or older than its sources. */
function ensureBuilt(log) {
  const sources = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { if (e.isDirectory()) { if (e.name !== 'dist' && e.name !== 'tests') walk(path.join(d, e.name)); } else if (/\.(js|html|css|py)$/.test(e.name)) sources.push(path.join(d, e.name)); });
  walk(path.join(ROOT, 'web')); sources.push(path.join(ROOT, 'data', 'inventory.json'));
  const newest = Math.max(...sources.map((f) => fs.statSync(f).mtimeMs));
  if (fs.existsSync(PAGE) && fs.statSync(PAGE).mtimeMs >= newest) return;
  log.info('building the app page (python3 web/build.py --server)');
  const r = spawnSync('python3', [path.join(ROOT, 'web', 'build.py'), '--server'], { encoding: 'utf8' });
  if (r.status !== 0 && !fs.existsSync(PAGE)) throw new Error('Could not build the app page: ' + (r.stderr || r.error || 'python3 failed'));
  if (r.status !== 0) log.warn('page build failed, serving the old build: ' + r.stderr);
}

const maskPath = (p) => String(p).split('?')[0].replace(/\d{6,}/g, '***');

async function createApp(userConfig = {}) {
  const config = { ...configFromEnv(), ...userConfig };
  const log = config.log || (config.quiet
    ? { info() {}, warn() {}, error() {} }
    : { info: (...a) => console.log(new Date().toISOString(), ...a), warn: (...a) => console.warn(new Date().toISOString(), ...a), error: (...a) => console.error(new Date().toISOString(), ...a) });

  ensureBuilt(log);

  const pool = await createPool({ databaseUrl: config.databaseUrl, schema: config.schema });
  await migrate(pool);
  const rt = createRuntime();
  const tracker = new Tracker(rt);
  const store = new Store({ pool, runtime: rt, tracker, flushMs: config.flushMs, log });

  if (await store.load()) log.info('state loaded from the database: ' + rt.state.units.length + ' units, ' + rt.state.clients.length + ' clients, ' + rt.state.leads.length + ' leads');
  else { await store.seedAndPersist(); log.info('database was empty: demo data created (' + rt.state.units.length + ' units, ' + rt.state.clients.length + ' clients)'); }

  const auth = createAuth({ pool, runtime: rt, demoPin: config.demoPin, sessionHours: config.sessionHours, log });
  const added = await auth.ensureUsers();
  if (added) log.info('demo people created: ' + added);
  await auth.cleanup();

  const sync = createSync({ rt, tracker, auth, log });
  store.start();

  /* ---------------- http ---------------- */
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'"], mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' },
  }));
  app.use(compression({ filter: (req, res) => !String(res.getHeader('Content-Type') || '').startsWith('text/event-stream') && compression.filter(req, res) }));
  app.use((req, res, next) => {          // one line per request, never the query string or a phone number
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      if (req.path === '/healthz') return;
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      log.info(req.method, maskPath(req.originalUrl), res.statusCode, ms.toFixed(0) + 'ms', req.session ? req.session.role : '-');
    });
    next();
  });
  app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));   // rawBody is kept for webhook signatures
  app.use((err, req, res, next) => {     // bad JSON
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request was not valid JSON.' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
    next(err);
  });
  app.use((req, res, next) => auth.attach(req, res, next));

  const baseHost = (() => { try { return config.publicBaseUrl ? new URL(config.publicBaseUrl).host : null; } catch (e) { return null; } })();
  app.use((req, res, next) => {          // cross-site writes are refused (the cookie is also SameSite=Lax)
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || config.allowAnyOrigin) return next();
    const origin = req.headers.origin; if (!origin) return next();
    let host; try { host = new URL(origin).host; } catch (e) { return res.status(403).json({ error: 'Blocked.' }); }
    const ok = [req.headers.host, String(req.headers['x-forwarded-host'] || '').split(',')[0].trim(), baseHost].filter(Boolean).includes(host);
    return ok ? next() : res.status(403).json({ error: 'This request came from another site.' });
  });

  app.get('/healthz', async (req, res) => {
    try { const h = await store.health(); res.set('Cache-Control', 'no-store').json({ ok: true, uptime: Math.round(process.uptime()), ...h, connections: sync.hub.conns.size }); }
    catch (e) { res.status(503).set('Cache-Control', 'no-store').json({ ok: false, db: false }); }
  });

  app.get('/', (req, res, next) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(PAGE, (err) => { if (err) next(err); });
  });

  app.use('/api', auth.router);
  app.use('/api', (req, res, next) => (req.session ? next() : res.status(401).json({ error: 'Please sign in.' })));   // everything below needs a session
  app.use('/api', sync.router);

  app.post('/api/reset', auth.requireRole('ceo'), async (req, res, next) => {
    try {
      await store.reset(req.session.name);
      sync.hub.reset();
      rt.LC.log('Demo data was reset by ' + req.session.name, { kind: 'reset' });
      log.info('demo data reset by', req.session.role);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  /* Optional modules (AI, media, WhatsApp, simulator) plug in here. Each exports register(ctx). */
  const closers = [];
  const ctx = {
    app, config, log, pool, rt, runtime: rt, tracker, store, sync, hub: sync.hub, auth, express,
    requireSession: auth.requireSession, requireRole: auth.requireRole,
    /** modules register what to stop on shutdown (timers, queues) */
    onClose: (fn) => { closers.push(fn); },
  };
  const loaded = [];
  for (const name of ['ai', 'media', 'whatsapp', 'sim']) {
    const file = path.join(__dirname, name + '.js');
    if (!fs.existsSync(file)) continue;
    const mod = require(file);
    if (typeof mod.register === 'function') { await mod.register(ctx); loaded.push(name); }
  }
  ctx.modules = loaded;
  if (loaded.length) log.info('modules loaded: ' + loaded.join(', '));

  app.use('/api', (req, res) => res.status(404).json({ error: 'No such endpoint.' }));
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  app.use((err, req, res, next) => {     // eslint-disable-line no-unused-vars
    log.error('request failed:', req.method, maskPath(req.originalUrl), err && err.stack ? err.stack : err);
    if (res.headersSent) return res.end();
    res.status(500).json({ error: 'Something went wrong on our side.' });
  });

  const server = http.createServer(app);
  server.keepAliveTimeout = 65000;
  const hourly = setInterval(() => { auth.cleanup().catch((e) => log.error('cleanup failed:', e.message)); }, 3600e3); hourly.unref();

  let closed = false;
  const api = {
    app, server, config, pool, rt, tracker, store, sync, auth, ctx,
    async start(port = config.port, host = config.host) {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
      const addr = server.address(); api.port = addr.port;
      log.info('Leasify Commercial is listening on port ' + addr.port);
      return addr.port;
    },
    async close() {
      if (closed) return; closed = true;
      clearInterval(hourly);
      for (const fn of closers) { try { fn(); } catch (e) { log.error('module shutdown failed:', e && e.message); } }
      sync.close();                                   // ends every live connection
      await new Promise((resolve) => { server.close(() => resolve()); if (server.closeAllConnections) server.closeAllConnections(); });
      tracker.collect({ by: 'system' });              // last diff, then the last write
      await store.close();
      rt.close();
      await pool.end();
    },
  };
  return api;
}

async function main() {
  const config = configFromEnv();
  const app = await createApp(config);
  await app.start();
  let stopping = false;
  const stop = async (sig) => {
    if (stopping) return; stopping = true;
    console.log(new Date().toISOString(), sig + ': saving and shutting down');
    const force = setTimeout(() => process.exit(1), 10000); force.unref();
    try { await app.close(); } catch (e) { console.error('shutdown error:', e); }
    process.exit(0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('unhandledRejection', (e) => console.error('unhandled rejection:', e));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { createApp, configFromEnv };
