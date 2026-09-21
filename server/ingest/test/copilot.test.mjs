import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.mjs';
import { openDb } from '../src/db/index.mjs';
import { saveUserResume } from '../src/resumes/resumes.mjs';

const VALID_RESUME = {
  basics: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    label: 'Senior Platform Engineer',
  },
  work: [
    {
      name: 'TechCo',
      position: 'Staff Engineer',
      highlights: ['Scaled platform to 10M DAU'],
    },
  ],
  skills: [{ name: 'Backend', keywords: ['Node.js', 'Python', 'Go'] }],
};

test('copilot API endpoints in ingest', async (t) => {
  const artifactsDir = mkdtempSync(join(tmpdir(), 'jf-copilot-test-'));
  const db = openDb({ path: ':memory:' });
  const app = buildApp({
    db,
    apiKeys: ['test-api-key'],
    artifactsDir,
    serverUrl: 'http://localhost:8080',
    logger: false,
  });

  t.after(() => {
    rmSync(artifactsDir, { recursive: true, force: true });
  });

  db.prepare(
    'INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('dev-user', 'dev@example.com', 'hash', 'test-api-key', 1000, 1000);

  // 1. GET prompt templates defaults
  const defaultsResp = await app.inject({
    method: 'GET',
    url: '/api/v1/settings/prompt-templates/defaults',
    headers: { authorization: 'Bearer test-api-key' },
  });
  assert.equal(defaultsResp.statusCode, 200);
  const defaultsData = JSON.parse(defaultsResp.payload);
  assert.equal(defaultsData.ok, true);
  assert.ok(defaultsData.defaults.copilot_system_prompt_template);
  assert.ok(defaultsData.defaults.copilot_outreach_prompt_template);
  assert.ok(defaultsData.defaults.copilot_qa_prompt_template);
  assert.ok(defaultsData.defaults.copilot_cover_letter_prompt_template);

  // 2. Insert a test job
  db.prepare(
    `
    INSERT INTO jobs (id, title, company, url, source, description, created_at, updated_at)
    VALUES ('job-copilot-1', 'Staff Distributed Systems Engineer', 'CloudCorp', 'https://example.com/job/1', 'linkedin', 'Looking for an engineer with high scale backend experience.', 1000, 1000)
  `
  ).run();

  db.prepare(
    `
    INSERT INTO user_jobs (user_id, job_id, status, created_at, updated_at)
    VALUES ('dev-user', 'job-copilot-1', 'discovered', 1000, 1000)
  `
  ).run();

  // 3. GET copilot data for job before anything generated (should return empty structure)
  const getCopilotResp = await app.inject({
    method: 'GET',
    url: '/api/v1/jobs/job-copilot-1/copilot',
    headers: { authorization: 'Bearer test-api-key' },
  });
  assert.equal(getCopilotResp.statusCode, 200);
  const copilotData = JSON.parse(getCopilotResp.payload);
  assert.equal(copilotData.ok, true);
  assert.equal(copilotData.data.outreach, null);
  assert.deepEqual(copilotData.data.qa_history, []);
  assert.equal(copilotData.data.cover_letter, null);

  // 4. Copilot requires active master resume
  const noResumeOutreach = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/job-copilot-1/copilot/outreach',
    headers: { authorization: 'Bearer test-api-key' },
    payload: { persona: 'recruiter' },
  });
  assert.equal(noResumeOutreach.statusCode, 400);
  assert.match(JSON.parse(noResumeOutreach.payload).error, /master resume/i);

  // 5. Add master resume for dev-user
  saveUserResume(db, {
    userId: 'dev-user',
    title: 'Master Resume',
    resumeJson: VALID_RESUME,
    setActive: true,
  });

  // 6. QA requires question string
  const badQaResp = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/job-copilot-1/copilot/qa',
    headers: { authorization: 'Bearer test-api-key' },
    payload: { question: '' },
  });
  assert.equal(badQaResp.statusCode, 400);

  // 7. Non-existent job returns 404
  const missingJobResp = await app.inject({
    method: 'GET',
    url: '/api/v1/jobs/non-existent-id/copilot',
    headers: { authorization: 'Bearer test-api-key' },
  });
  assert.equal(missingJobResp.statusCode, 404);
});
