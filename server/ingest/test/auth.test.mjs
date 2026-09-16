import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.mjs';
import { buildApp } from '../src/app.mjs';
import { hashPassword, verifyPassword } from '../src/auth/passwords.mjs';
import { createToken, verifyToken } from '../src/auth/tokens.mjs';

test('passwords: hashing and verification with scrypt', async () => {
  const hash = await hashPassword('SecretPassword123!');
  assert.ok(hash.includes(':'), 'Hash format should be salt:key');
  assert.equal(await verifyPassword('SecretPassword123!', hash), true);
  assert.equal(await verifyPassword('WrongPassword', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('tokens: JWT create and verify with expiration and tamper resistance', () => {
  const secret = 'custom-test-secret-42';
  const token = createToken({ userId: 'u_123', email: 'test@example.com' }, secret, 1);
  assert.ok(token);

  const payload = verifyToken(token, secret);
  assert.equal(payload.userId, 'u_123');
  assert.equal(payload.email, 'test@example.com');

  // Wrong secret fails
  assert.equal(verifyToken(token, 'wrong-secret'), null);

  // Tampered payload fails
  const parts = token.split('.');
  const tampered = `${parts[0]}.eyJhZG1pbiI6dHJ1ZX0.${parts[2]}`;
  assert.equal(verifyToken(tampered, secret), null);
});

test('auth routes: register, login, me, rotate-api-key flow', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-jwt-key' });

  // 1. Register a new user
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: 'Alice@Example.com',
      password: 'password123',
      name: 'Alice Developer',
    },
  });
  assert.equal(regRes.statusCode, 201);
  const regBody = JSON.parse(regRes.body);
  assert.equal(regBody.user.email, 'alice@example.com');
  assert.equal(regBody.user.name, 'Alice Developer');
  assert.equal(regBody.user.isAdmin, true);
  assert.ok(regBody.user.apiKey.startsWith('jf_'));
  assert.ok(regBody.token);

  const token = regBody.token;
  const userApiKey = regBody.user.apiKey;

  // 2. Duplicate registration returns 409
  const dupRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: 'alice@example.com',
      password: 'anotherpassword',
    },
  });
  assert.equal(dupRes.statusCode, 409);

  // 3. Login with correct credentials
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'alice@example.com',
      password: 'password123',
    },
  });
  assert.equal(loginRes.statusCode, 200);
  const loginBody = JSON.parse(loginRes.body);
  assert.equal(loginBody.user.id, regBody.user.id);
  assert.equal(loginBody.user.isAdmin, true);
  assert.ok(loginBody.token);

  // 4. Login with wrong password returns 401
  const badLoginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'alice@example.com',
      password: 'wrongpassword',
    },
  });
  assert.equal(badLoginRes.statusCode, 401);

  // 5. GET /api/v1/auth/me with JWT
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.statusCode, 200);
  assert.equal(JSON.parse(meRes.body).user.email, 'alice@example.com');

  // 6. GET /api/v1/auth/me with personal API key
  const meApiRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { Authorization: `Bearer ${userApiKey}` },
  });
  assert.equal(meApiRes.statusCode, 200);
  assert.equal(JSON.parse(meApiRes.body).user.id, regBody.user.id);

  // 7. Rotate API key
  const rotateRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/api-key/rotate',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(rotateRes.statusCode, 200);
  const newApiKey = JSON.parse(rotateRes.body).apiKey;
  assert.ok(newApiKey.startsWith('jf_'));
  assert.notEqual(newApiKey, userApiKey);

  // Old API key no longer valid
  const oldKeyRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { Authorization: `Bearer ${userApiKey}` },
  });
  assert.equal(oldKeyRes.statusCode, 401);

  // New API key works
  const newKeyRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { Authorization: `Bearer ${newApiKey}` },
  });
  assert.equal(newKeyRes.statusCode, 200);
});

test('unauthenticated dev-user cannot access administrator routes', async () => {
  const priorMode = process.env.REGISTRATION_MODE;
  process.env.REGISTRATION_MODE = 'open';
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-jwt-key' });

  try {
    const status = await app.inject({ method: 'GET', url: '/api/v1/auth/registration' });
    assert.deepEqual(JSON.parse(status.body), { open: true, environmentLocked: false });

    const update = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/registration',
      headers: { authorization: 'Bearer dev-user' },
      payload: { open: false },
    });
    assert.equal(update.statusCode, 403);
  } finally {
    if (priorMode === undefined) delete process.env.REGISTRATION_MODE;
    else process.env.REGISTRATION_MODE = priorMode;
    await app.close();
    db.close();
  }
});

test('registration policy is admin-controlled and environment locks take precedence', async () => {
  const priorMode = process.env.REGISTRATION_MODE;
  process.env.REGISTRATION_MODE = 'open';

  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-jwt-key' });

  try {
    const firstRegistration = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'admin@example.com', password: 'password123' },
    });
    assert.equal(firstRegistration.statusCode, 201);
    const admin = JSON.parse(firstRegistration.body).user;
    assert.equal(admin.isAdmin, true);

    const secondRegistration = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'member@example.com', password: 'password123' },
    });
    assert.equal(secondRegistration.statusCode, 201);
    const member = JSON.parse(secondRegistration.body).user;
    assert.equal(member.isAdmin, false);

    const denied = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/registration',
      headers: { authorization: `Bearer ${member.apiKey}` },
      payload: { open: false },
    });
    assert.equal(denied.statusCode, 403);

    const closed = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/registration',
      headers: { authorization: `Bearer ${admin.apiKey}` },
      payload: { open: false },
    });
    assert.equal(closed.statusCode, 200);
    assert.deepEqual(JSON.parse(closed.body), { open: false, environmentLocked: false });

    const blockedRegistration = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'blocked@example.com', password: 'password123' },
    });
    assert.equal(blockedRegistration.statusCode, 403);
    assert.deepEqual(JSON.parse(blockedRegistration.body), {
      error: 'registration is currently closed',
    });
  } finally {
    await app.close();
    db.close();
  }

  process.env.REGISTRATION_MODE = 'disabled';
  const lockedDb = openDb({ path: ':memory:' });
  const lockedApp = buildApp({
    db: lockedDb,
    apiKeys: ['operator-key'],
    jwtSecret: 'test-jwt-key',
  });

  try {
    const status = await lockedApp.inject({ method: 'GET', url: '/api/v1/auth/registration' });
    assert.deepEqual(JSON.parse(status.body), { open: false, environmentLocked: true });

    const update = await lockedApp.inject({
      method: 'PUT',
      url: '/api/v1/admin/registration',
      headers: { authorization: 'Bearer operator-key' },
      payload: { open: true },
    });
    assert.equal(update.statusCode, 409);
  } finally {
    if (priorMode === undefined) delete process.env.REGISTRATION_MODE;
    else process.env.REGISTRATION_MODE = priorMode;
    await lockedApp.close();
    lockedDb.close();
  }
});
