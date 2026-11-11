import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.mjs';
import { buildApp } from '../src/app.mjs';

test('GET /api/v1/diagnostics requires admin authentication', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-secret', logger: false });

  // Register first user (admin) and second user (member)
  const firstReg = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'admin@example.com', password: 'password123' },
  });
  assert.equal(firstReg.statusCode, 201);
  const admin = JSON.parse(firstReg.body).user;
  assert.equal(admin.isAdmin, true);

  const secondReg = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'member@example.com', password: 'password123' },
  });
  assert.equal(secondReg.statusCode, 201);
  const member = JSON.parse(secondReg.body).user;
  assert.equal(member.isAdmin, false);

  // 1. Unauthenticated request -> 401
  const unauthRes = await app.inject({
    method: 'GET',
    url: '/api/v1/diagnostics',
  });
  assert.equal(unauthRes.statusCode, 401);
  assert.equal(JSON.parse(unauthRes.body).database, undefined);
  assert.doesNotMatch(unauthRes.body, /totalUsers|totalResumes/);

  // 2. Authenticated non-admin -> 403
  const nonAdminRes = await app.inject({
    method: 'GET',
    url: '/api/v1/diagnostics',
    headers: { authorization: `Bearer ${member.apiKey}` },
  });
  assert.equal(nonAdminRes.statusCode, 403);
  assert.equal(JSON.parse(nonAdminRes.body).database, undefined);
  assert.doesNotMatch(nonAdminRes.body, /totalUsers|totalResumes/);

  // 3. Authenticated admin -> 200 with diagnostics payload
  const adminRes = await app.inject({
    method: 'GET',
    url: '/api/v1/diagnostics',
    headers: { authorization: `Bearer ${admin.apiKey}` },
  });
  assert.equal(adminRes.statusCode, 200);
  const data = JSON.parse(adminRes.body);
  assert.equal(data.status, 'healthy');
  assert.equal(typeof data.database.totalJobs, 'number');
  assert.equal(typeof data.database.totalUsers, 'number');
  assert.equal(typeof data.uptime, 'number');
});

test('request ID propagation: honors incoming x-request-id or generates one', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-secret', logger: false });

  // 1. Custom x-request-id header passed
  const resCustom = await app.inject({
    method: 'GET',
    url: '/health',
    headers: {
      'x-request-id': 'custom-req-trace-12345',
    },
  });
  assert.equal(resCustom.statusCode, 200);
  assert.equal(resCustom.headers['x-request-id'], 'custom-req-trace-12345');

  // 2. No x-request-id passed -> auto generated
  const resAuto = await app.inject({
    method: 'GET',
    url: '/health',
  });
  assert.equal(resAuto.statusCode, 200);
  assert.match(resAuto.headers['x-request-id'], /^req_/);
});
