import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.mjs';
import { buildApp } from '../src/app.mjs';

const SAMPLE_RESUME = {
  basics: {
    name: 'Alice Developer',
    label: 'Senior Staff Engineer',
    email: 'alice@example.com',
    summary: 'Distributed systems architect with 10+ years experience.',
  },
  skills: [
    { name: 'Distributed Systems', keywords: ['Raft', 'Paxos', 'Kafka'] },
  ],
};

test('PATCH /api/v1/resumes/:id updates title and resume_json in place', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-secret' });

  // Register user
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'alice@test.com', password: 'password123' },
  });
  const token = JSON.parse(regRes.body).token;
  const headers = { Authorization: `Bearer ${token}` };

  // Create resume
  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes',
    headers,
    payload: {
      title: 'Original Title',
      resumeJson: SAMPLE_RESUME,
    },
  });
  assert.equal(uploadRes.statusCode, 201);
  const r1 = JSON.parse(uploadRes.body).resume;
  assert.equal(r1.title, 'Original Title');

  // PATCH title only
  const patchTitleRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/resumes/${r1.id}`,
    headers,
    payload: { title: 'Updated Title' },
  });
  assert.equal(patchTitleRes.statusCode, 200);
  const r1Updated = JSON.parse(patchTitleRes.body).resume;
  assert.equal(r1Updated.title, 'Updated Title');
  assert.equal(r1Updated.resume.basics.name, 'Alice Developer');

  // PATCH resumeJson content
  const updatedJson = {
    ...SAMPLE_RESUME,
    basics: { ...SAMPLE_RESUME.basics, name: 'Alice Smith' },
  };
  const patchContentRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/resumes/${r1.id}`,
    headers,
    payload: { resumeJson: updatedJson },
  });
  assert.equal(patchContentRes.statusCode, 200);
  const r1UpdatedContent = JSON.parse(patchContentRes.body).resume;
  assert.equal(r1UpdatedContent.resume.basics.name, 'Alice Smith');
  assert.equal(r1UpdatedContent.title, 'Updated Title');

  // Reject invalid JSON schema on PATCH
  const badPatchRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/resumes/${r1.id}`,
    headers,
    payload: { resumeJson: { illegalProp: true } },
  });
  assert.equal(badPatchRes.statusCode, 400);

  // Return 404 for unknown resume id
  const notFoundRes = await app.inject({
    method: 'PATCH',
    url: '/api/v1/resumes/res_non_existent',
    headers,
    payload: { title: 'Nope' },
  });
  assert.equal(notFoundRes.statusCode, 404);
});

test('user_facts API: CRUD, categories, active filtering, and isolation', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-secret' });

  // Register User 1
  const u1Reg = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'u1@test.com', password: 'password123' },
  });
  const u1Token = JSON.parse(u1Reg.body).token;
  const u1Headers = { Authorization: `Bearer ${u1Token}` };

  // Register User 2
  const u2Reg = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'u2@test.com', password: 'password123' },
  });
  const u2Token = JSON.parse(u2Reg.body).token;
  const u2Headers = { Authorization: `Bearer ${u2Token}` };

  // 1. Initial list is empty
  const list0 = await app.inject({ method: 'GET', url: '/api/v1/facts', headers: u1Headers });
  assert.equal(list0.statusCode, 200);
  assert.deepEqual(JSON.parse(list0.body).facts, []);

  // 2. Reject empty factText
  const badCreate = await app.inject({
    method: 'POST',
    url: '/api/v1/facts',
    headers: u1Headers,
    payload: { category: 'preference', factText: '   ' },
  });
  assert.equal(badCreate.statusCode, 400);

  // 3. Create facts
  const create1 = await app.inject({
    method: 'POST',
    url: '/api/v1/facts',
    headers: u1Headers,
    payload: { category: 'preference', factText: 'Remote only, UTC+5:30' },
  });
  assert.equal(create1.statusCode, 201);
  const f1 = JSON.parse(create1.body).fact;
  assert.equal(f1.category, 'preference');
  assert.equal(f1.factText, 'Remote only, UTC+5:30');
  assert.equal(f1.isActive, true);

  const create2 = await app.inject({
    method: 'POST',
    url: '/api/v1/facts',
    headers: u1Headers,
    payload: { category: 'constraint', factText: 'Notice period 60 days', isActive: false },
  });
  assert.equal(create2.statusCode, 201);
  const f2 = JSON.parse(create2.body).fact;
  assert.equal(f2.isActive, false);

  // 4. List all facts vs activeOnly
  const listAll = await app.inject({ method: 'GET', url: '/api/v1/facts', headers: u1Headers });
  assert.equal(JSON.parse(listAll.body).facts.length, 2);

  const listActive = await app.inject({ method: 'GET', url: '/api/v1/facts?active=true', headers: u1Headers });
  const activeFacts = JSON.parse(listActive.body).facts;
  assert.equal(activeFacts.length, 1);
  assert.equal(activeFacts[0].id, f1.id);

  // 5. Update fact
  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/v1/facts/${f2.id}`,
    headers: u1Headers,
    payload: { isActive: true, category: 'compensation' },
  });
  assert.equal(updateRes.statusCode, 200);
  const f2Updated = JSON.parse(updateRes.body).fact;
  assert.equal(f2Updated.isActive, true);
  assert.equal(f2Updated.category, 'compensation');

  // 6. User 2 cannot see or modify User 1's facts
  const u2List = await app.inject({ method: 'GET', url: '/api/v1/facts', headers: u2Headers });
  assert.deepEqual(JSON.parse(u2List.body).facts, []);

  const u2Del = await app.inject({
    method: 'DELETE',
    url: `/api/v1/facts/${f1.id}`,
    headers: u2Headers,
  });
  assert.equal(u2Del.statusCode, 404);

  // 7. Delete fact
  const delRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/facts/${f1.id}`,
    headers: u1Headers,
  });
  assert.equal(delRes.statusCode, 200);

  const listAfterDel = await app.inject({ method: 'GET', url: '/api/v1/facts', headers: u1Headers });
  assert.equal(JSON.parse(listAfterDel.body).facts.length, 1);
});
