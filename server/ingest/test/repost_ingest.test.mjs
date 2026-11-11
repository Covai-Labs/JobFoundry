import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.mjs';
import { buildApp } from '../src/app.mjs';

function makeApp() {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, apiKeys: ['testkey'] });
  return { app, db };
}

test('ingest computes and persists repost_confidence and repost_status', async () => {
  const { app } = makeApp();
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Ingest first posting 60 days ago
  const res1 = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: { authorization: 'Bearer testkey' },
    payload: [
      {
        title: 'Backend Engineer',
        company: 'Stark Industries',
        url: 'https://stark.test/jobs/req-1',
        postedAt: new Date(now - 60 * dayMs).toISOString(),
      },
    ],
  });
  assert.equal(res1.statusCode, 200);

  // Ingest second posting 30 days ago
  const res2 = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: { authorization: 'Bearer testkey' },
    payload: [
      {
        title: 'Senior Backend Engineer',
        company: 'Stark Industries',
        url: 'https://stark.test/jobs/req-2',
        postedAt: new Date(now - 30 * dayMs).toISOString(),
      },
    ],
  });
  assert.equal(res2.statusCode, 200);

  // Ingest third posting today
  const res3 = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: { authorization: 'Bearer testkey' },
    payload: [
      {
        title: 'Staff Backend Engineer',
        company: 'Stark Industries',
        url: 'https://stark.test/jobs/req-3',
        postedAt: new Date(now).toISOString(),
      },
    ],
  });
  assert.equal(res3.statusCode, 200);
  const { ids } = res3.json();
  const latestId = ids[0];

  // Verify GET /api/v1/jobs returns repost_confidence and repost_status
  const listRes = await app.inject({
    method: 'GET',
    url: '/api/v1/jobs',
    headers: { authorization: 'Bearer testkey' },
  });
  assert.equal(listRes.statusCode, 200);
  const { jobs } = listRes.json();
  const latestJob = jobs.find((j) => j.id === latestId);
  assert.ok(latestJob, 'latest job found in list');
  assert.equal(latestJob.repost_confidence, 'high');
  assert.ok(latestJob.repost_status, 'repost_status is present');
  const parsedStatus = JSON.parse(latestJob.repost_status);
  assert.equal(parsedStatus.isRepost, true);
  assert.equal(parsedStatus.count, 2);
  assert.ok(parsedStatus.daysSpan >= 60);

  // Verify GET /api/v1/jobs/:id returns repost_confidence and repost_status
  const singleRes = await app.inject({
    method: 'GET',
    url: `/api/v1/jobs/${latestId}`,
    headers: { authorization: 'Bearer testkey' },
  });
  assert.equal(singleRes.statusCode, 200);
  const { job } = singleRes.json();
  assert.equal(job.repost_confidence, 'high');
  assert.ok(job.repost_status);

  await app.close();
});

test('ingest respects configurable repost_threshold_days via system_settings', async () => {
  const { app, db } = makeApp();
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Set threshold to 90 days in system_settings
  db.prepare(
    "INSERT INTO system_settings (key, value, updated_at) VALUES ('repost_threshold_days', '90', ?)"
  ).run(now);

  // Ingest first posting 60 days ago
  await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: { authorization: 'Bearer testkey' },
    payload: [
      {
        title: 'Frontend Engineer',
        company: 'Wayne Enterprises',
        url: 'https://wayne.test/jobs/fe-1',
        postedAt: new Date(now - 60 * dayMs).toISOString(),
      },
    ],
  });

  // Ingest second posting today (span = 60 days < 90 days threshold)
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: { authorization: 'Bearer testkey' },
    payload: [
      {
        title: 'Frontend Engineer',
        company: 'Wayne Enterprises',
        url: 'https://wayne.test/jobs/fe-2',
        postedAt: new Date(now).toISOString(),
      },
    ],
  });
  assert.equal(res.statusCode, 200);
  const latestId = res.json().ids[0];

  const singleRes = await app.inject({
    method: 'GET',
    url: `/api/v1/jobs/${latestId}`,
    headers: { authorization: 'Bearer testkey' },
  });
  assert.equal(singleRes.statusCode, 200);
  const { job } = singleRes.json();

  // With a 90-day threshold, a 60-day span with only 1 match is not high confidence and isRepost is false
  assert.notEqual(job.repost_confidence, 'high');
  const parsed = JSON.parse(job.repost_status);
  assert.equal(parsed.isRepost, false);

  await app.close();
});

test('multi-tenant user retrieves repost_confidence and repost_status', async () => {
  const { app, db } = makeApp();
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Create registered user
  db.prepare(
    `
    INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at)
    VALUES ('u1', 'user1@example.com', 'hash', 'user-api-key-1', ?, ?)
  `
  ).run(now, now);

  // Ingest two postings for Acme
  await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: { authorization: 'Bearer user-api-key-1' },
    payload: [
      {
        title: 'Software Engineer',
        company: 'Acme Corp',
        url: 'https://acme.example/req-1',
        postedAt: new Date(now - 60 * dayMs).toISOString(),
      },
      {
        title: 'Staff Software Engineer',
        company: 'Acme Corp',
        url: 'https://acme.example/req-2',
        postedAt: new Date(now - 30 * dayMs).toISOString(),
      },
    ],
  });

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: { authorization: 'Bearer user-api-key-1' },
    payload: [
      {
        title: 'Senior Software Engineer',
        company: 'Acme Corp',
        url: 'https://acme.example/req-3',
        postedAt: new Date(now).toISOString(),
      },
    ],
  });
  const latestId = res.json().ids[0];

  const listRes = await app.inject({
    method: 'GET',
    url: '/api/v1/jobs',
    headers: { authorization: 'Bearer user-api-key-1' },
  });
  assert.equal(listRes.statusCode, 200);
  const found = listRes.json().jobs.find((j) => j.id === latestId);
  assert.equal(found.repost_confidence, 'high');

  const singleRes = await app.inject({
    method: 'GET',
    url: `/api/v1/jobs/${latestId}`,
    headers: { authorization: 'Bearer user-api-key-1' },
  });
  assert.equal(singleRes.statusCode, 200);
  assert.equal(singleRes.json().job.repost_confidence, 'high');

  await app.close();
});
