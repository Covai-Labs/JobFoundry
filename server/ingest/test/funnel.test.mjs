import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.mjs';
import { buildApp } from '../src/app.mjs';

test('GET /api/v1/analytics/funnel endpoint tests', async (t) => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-secret', logger: false });

  // Register user A
  const regA = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'userA@example.com', password: 'password123' },
  });
  assert.equal(regA.statusCode, 201);
  const userA = JSON.parse(regA.body).user;

  // Register user B
  const regB = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'userB@example.com', password: 'password123' },
  });
  assert.equal(regB.statusCode, 201);
  const userB = JSON.parse(regB.body).user;

  await t.test('requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/funnel',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('returns empty stages with 0 jobs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/funnel',
      headers: { authorization: `Bearer ${userA.apiKey}` },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.funnel.total, 0);
    assert.equal(Array.isArray(body.funnel.stages), true);

    const stageIds = body.funnel.stages.map((s) => s.id);
    assert.deepEqual(stageIds, ['captured', 'tailored', 'applied', 'interview', 'offer']);

    for (const stage of body.funnel.stages) {
      assert.equal(stage.count, 0);
      assert.equal(stage.conversionRate, 0);
    }
  });

  await t.test(
    'calculates correct funnel and conversion with multiple stages and scoping',
    async () => {
      const now = Date.now();

      // Helper to insert job + user_job
      function insertUserJob(userId, jobId, title, status, tailoredResumeId = null) {
        db.prepare(
          `INSERT OR IGNORE INTO jobs (id, title, company, url, source, created_at, updated_at)
         VALUES (?, ?, 'Acme Inc', ?, 'test', ?, ?)`
        ).run(jobId, title, `https://example.com/jobs/${jobId}`, now, now);

        db.prepare(
          `INSERT INTO user_jobs (id, user_id, job_id, status, tailored_resume_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(`uj-${jobId}`, userId, jobId, status, tailoredResumeId, now, now);
      }

      // Populate jobs for User A:
      // 2 new (only captured)
      insertUserJob(userA.id, 'job-1', 'Engineer 1', 'new');
      insertUserJob(userA.id, 'job-2', 'Engineer 2', 'saved');
      // 2 tailored
      insertUserJob(userA.id, 'job-3', 'Engineer 3', 'tailored', 'res-1');
      insertUserJob(userA.id, 'job-4', 'Engineer 4', 'tailored', 'res-2');
      // 2 applied
      insertUserJob(userA.id, 'job-5', 'Engineer 5', 'applied', 'res-3');
      insertUserJob(userA.id, 'job-6', 'Engineer 6', 'applied', 'res-4');
      // 1 interview
      insertUserJob(userA.id, 'job-7', 'Engineer 7', 'interview', 'res-5');
      // 1 offer
      insertUserJob(userA.id, 'job-8', 'Engineer 8', 'offer', 'res-6');
      // 1 rejected (was applied)
      insertUserJob(userA.id, 'job-9', 'Engineer 9', 'rejected', 'res-7');

      // Populate 1 job for User B (to ensure user isolation)
      insertUserJob(userB.id, 'job-10', 'Engineer 10', 'offer', 'res-8');

      // Query User A
      const resA = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/funnel',
        headers: { authorization: `Bearer ${userA.apiKey}` },
      });
      assert.equal(resA.statusCode, 200);
      const dataA = JSON.parse(resA.body).funnel;

      // Total captured for User A = 9 jobs (job-1 to job-9)
      assert.equal(dataA.total, 9);

      const stagesMap = Object.fromEntries(dataA.stages.map((s) => [s.id, s]));

      // Captured = 9
      assert.equal(stagesMap.captured.count, 9);
      assert.equal(stagesMap.captured.conversionRate, 100);

      // Tailored: tailored(2) + applied(2) + interview(1) + offer(1) + rejected_with_tailored(1) = 7
      assert.equal(stagesMap.tailored.count, 7);
      assert.equal(stagesMap.tailored.conversionRate, Math.round((7 / 9) * 1000) / 10); // 77.8%

      // Applied: applied(2) + interview(1) + offer(1) + rejected_with_tailored(1) = 5
      assert.equal(stagesMap.applied.count, 5);
      assert.equal(stagesMap.applied.conversionRate, Math.round((5 / 7) * 1000) / 10); // 71.4%

      // Interview: interview(1) + offer(1) = 2
      assert.equal(stagesMap.interview.count, 2);
      assert.equal(stagesMap.interview.conversionRate, Math.round((2 / 5) * 1000) / 10); // 40%

      // Offer: offer(1) = 1
      assert.equal(stagesMap.offer.count, 1);
      assert.equal(stagesMap.offer.conversionRate, Math.round((1 / 2) * 1000) / 10); // 50%

      // Verify User B only sees their 1 job
      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/funnel',
        headers: { authorization: `Bearer ${userB.apiKey}` },
      });
      assert.equal(resB.statusCode, 200);
      const dataB = JSON.parse(resB.body).funnel;
      assert.equal(dataB.total, 1);
      const stagesMapB = Object.fromEntries(dataB.stages.map((s) => [s.id, s]));
      assert.equal(stagesMapB.offer.count, 1);
    }
  );
});
