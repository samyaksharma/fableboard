import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import authRouter from '../src/routes/auth.js';
import { requireAuth } from '../src/middleware/auth.js';
import * as authService from '../src/services/authService.js';

let http: Server;
let base: string;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', authRouter);
  app.get('/api/protected', requireAuth, (req, res) => res.json({ user: req.user }));
  http = createServer(app);
  await new Promise<void>((r) => http.listen(0, r));
  base = `http://localhost:${(http.address() as AddressInfo).port}/api`;
});

after(async () => {
  await new Promise((r) => http.close(r));
});

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const email = () => `user-${Math.random().toString(36).slice(2)}@example.com`;

test('password hashing: salted, verifiable, rejects wrong password', async () => {
  const a = await authService.hashPassword('correct horse battery');
  const b = await authService.hashPassword('correct horse battery');
  assert.notEqual(a, b, 'each hash has its own salt');
  assert.ok(a.startsWith('scrypt$'));
  assert.ok(!a.includes('correct horse'));
  assert.equal(await authService.verifyPassword('correct horse battery', a), true);
  assert.equal(await authService.verifyPassword('wrong', a), false);
  assert.equal(await authService.verifyPassword('x', 'garbage'), false);
});

test('register then log in; the token works on a protected route', async () => {
  const e = email();
  const reg = await post('/auth/register', { email: e, password: 'hunter2hunter2', displayName: 'Ada' });
  assert.equal(reg.status, 201);
  const { token } = await reg.json();

  const login = await post('/auth/login', { email: e.toUpperCase(), password: 'hunter2hunter2' });
  assert.equal(login.status, 200, 'email is case-insensitive');
  const { token: token2 } = await login.json();

  const me = await fetch(base + '/protected', { headers: { authorization: `Bearer ${token2}` } });
  const body = await me.json();
  assert.equal(body.user.displayName, 'Ada');
  assert.equal(body.user.provider, 'password');
  // Same account, same stable user id
  const first = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  assert.equal(first.userId, body.user.userId);
});

test('duplicate email is rejected; the password is never returned', async () => {
  const e = email();
  const ok = await post('/auth/register', { email: e, password: 'password-one', displayName: 'A' });
  assert.equal(ok.status, 201);
  const dup = await post('/auth/register', { email: e, password: 'password-two', displayName: 'B' });
  assert.equal(dup.status, 409);
  assert.ok(!JSON.stringify(await ok.clone().json()).includes('password-one'));
});

test('validation: short password, bad email, missing name', async () => {
  assert.equal((await post('/auth/register', { email: email(), password: 'short', displayName: 'A' })).status, 400);
  assert.equal((await post('/auth/register', { email: 'nope', password: 'longenough1', displayName: 'A' })).status, 400);
  assert.equal((await post('/auth/register', { email: email(), password: 'longenough1', displayName: '  ' })).status, 400);
});

test('wrong password and unknown email give the same generic answer', async () => {
  const e = email();
  await post('/auth/register', { email: e, password: 'right-password', displayName: 'A' });
  const wrong = await post('/auth/login', { email: e, password: 'bad-password' });
  const unknown = await post('/auth/login', { email: email(), password: 'bad-password' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
});

test('repeated failures lock that email even for the right password', async () => {
  const e = email();
  await post('/auth/register', { email: e, password: 'right-password', displayName: 'A' });
  for (let i = 0; i < 8; i++) {
    assert.equal((await post('/auth/login', { email: e, password: 'nope-nope' })).status, 401);
  }
  const locked = await post('/auth/login', { email: e, password: 'right-password' });
  assert.equal(locked.status, 429);
});

test('providers endpoint reports what is available', async () => {
  const res = await fetch(base + '/auth/providers');
  const p = await res.json();
  assert.equal(p.password, true);
  assert.equal(p.guest, true);
  assert.equal(typeof p.google, 'boolean');
});

test('per-IP rate limit eventually returns 429 with Retry-After', async () => {
  let last: Response | undefined;
  for (let i = 0; i < 40; i++) {
    last = await post('/auth/login', { email: email(), password: 'whatever1' });
    if (last.status === 429) break;
  }
  assert.equal(last!.status, 429);
  assert.ok(Number(last!.headers.get('retry-after')) > 0);
});
