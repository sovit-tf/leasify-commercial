'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let S;
test.before(async () => { S = await startServer(); });
test.after(async () => { await S.close(); });

test('the public people list has no PINs and covers every role', async () => {
  const r = await S.client().get('/api/users');
  assert.equal(r.status, 200);
  const users = r.data.users;
  assert.ok(users.length >= 20);
  assert.ok(!JSON.stringify(users).match(/pin|hash|scrypt/i));
  const byRole = (role) => users.filter((u) => u.role === role);
  assert.equal(byRole('ceo').length, 1); assert.equal(byRole('ceo')[0].name, 'Sanjeev Das');
  assert.equal(byRole('manager').length, 1); assert.equal(byRole('manager')[0].name, 'Rohit Mohanty');
  assert.equal(byRole('executive').length, 4);
  assert.equal(byRole('owner').length, 15);
  assert.ok(users.every((u) => u.id && u.name && u.roleLabel));
});

test('wrong PIN is 401 and sets no cookie; unknown person is 401', async () => {
  const c = S.client();
  const bad = await c.post('/api/login', { userId: 'ceo', pin: '1111' });
  assert.equal(bad.status, 401); assert.equal(bad.setCookie, null);
  assert.equal((await c.post('/api/login', { userId: 'nobody', pin: '2580' })).status, 401);
  assert.equal((await c.post('/api/login', { userId: 'ceo', pin: 'abcd' })).status, 400);
  assert.equal((await c.get('/api/me')).status, 401);
  assert.equal((await c.get('/api/bootstrap')).status, 401);
});

test('right PIN sets an httpOnly cookie that works; logout ends the session', async () => {
  const c = S.client();
  const ok = await c.post('/api/login', { userId: 'rohit', pin: '2580' });
  assert.equal(ok.status, 200);
  assert.match(ok.setCookie, /lc_session=/); assert.match(ok.setCookie, /HttpOnly/i); assert.match(ok.setCookie, /SameSite=Lax/i);
  const me = await c.get('/api/me');
  assert.equal(me.status, 200); assert.equal(me.data.user.name, 'Rohit Mohanty'); assert.equal(me.data.user.role, 'manager');
  assert.equal((await c.get('/api/bootstrap')).status, 200);
  const old = c.cookie;
  assert.equal((await c.post('/api/logout')).status, 200);
  const again = S.client(); again.cookie = old;
  assert.equal((await again.get('/api/me')).status, 401, 'the old cookie no longer works');
});

test('the session is stored as a hash, and logins are logged', async () => {
  const c = S.client(); await c.login('ceo');
  const token = decodeURIComponent(c.cookie.split('=')[1]);
  const rows = (await S.app.pool.query('SELECT token_hash FROM sessions')).rows;
  assert.ok(rows.length >= 1 && rows.every((r) => r.token_hash !== token && r.token_hash.length === 64));
  const n = (await S.app.pool.query("SELECT count(*)::int n FROM login_log WHERE user_id = 'ceo' AND ok")).rows[0].n;
  assert.ok(n >= 1);
});

test('PINs are scrypt hashes (not the PIN)', async () => {
  const r = await S.app.pool.query("SELECT pin_hash FROM users WHERE id = 'ceo'");
  assert.match(r.rows[0].pin_hash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.ok(!r.rows[0].pin_hash.includes('2580'));
});

test('too many wrong PINs are slowed down (429)', async () => {
  const c = S.client(); let last;
  for (let i = 0; i < 10; i++) last = await c.post('/api/login', { userId: 'satya', pin: '0000' });
  assert.equal(last.status, 429);
  assert.equal((await c.post('/api/login', { userId: 'satya', pin: '2580' })).status, 429, 'even the right PIN waits');
});

test('the API refuses requests that come from another site', async () => {
  const c = S.client(); await c.login('ceo');
  const r = await c.req('POST', '/api/sync', { changes: [] }, { Origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('only the CEO can reset; /healthz checks the database; page is served with security headers', async () => {
  const mgr = S.client(); await mgr.login('rohit');
  assert.equal((await mgr.post('/api/reset')).status, 403);
  const h = await S.client().get('/healthz');
  assert.equal(h.status, 200); assert.equal(h.data.db, true);
  const page = await fetch(S.base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /window\.LC_SERVER = true/);
  assert.ok(page.headers.get('content-security-policy')); assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(page.headers.get('x-powered-by'), null);
});

test('the served page does not embed the inventory', async () => {
  const html = await (await fetch(S.base + '/')).text();
  assert.ok(!html.includes('owner_phone":"'), 'no unit data in the page');
  assert.match(html, /id="lc-inventory">\[\]</);
});
