import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { buildApp } from '../src/app.mjs';
import { openDb } from '../src/db/index.mjs';
import { saveUserResume, validateResumeJson } from '../src/resumes/resumes.mjs';

const MASTER_RESUME = {
  basics: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    label: 'Senior Platform Engineer',
    location: { city: 'Bengaluru', region: 'KA', countryCode: 'IN' },
  },
  work: [
    {
      name: 'TechCo',
      position: 'Staff Engineer',
      startDate: '2020-01-01',
      highlights: ['Scaled platform to 10M DAU'],
    },
  ],
  skills: [{ name: 'Backend', keywords: ['Node.js', 'Python', 'Go'] }],
};

const TAILORED_RESUME = {
  ...MASTER_RESUME,
  basics: { ...MASTER_RESUME.basics, label: 'Staff Distributed Systems Engineer' },
};

function setup(t) {
  const artifactsDir = mkdtempSync(join(tmpdir(), 'jf-export-test-'));
  const db = openDb({ path: ':memory:' });
  const app = buildApp({
    db,
    apiKeys: ['test-api-key'],
    artifactsDir,
    serverUrl: 'http://localhost:8080',
    logger: false,
  });

  t.after(() => rmSync(artifactsDir, { recursive: true, force: true }));

  const now = 1700000000000;
  db.prepare(
    'INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('user-1', 'jane@example.com', 'hash', 'user-1-key', now, now);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('user-2', 'other@example.com', 'hash', 'user-2-key', now, now);

  saveUserResume(db, {
    userId: 'user-1',
    title: 'Master Resume',
    resumeJson: MASTER_RESUME,
    setActive: true,
  });

  const insertJob = db.prepare(
    `INSERT INTO jobs (id, title, company, location, url, source, description, posted_at, fit_score, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertJob.run(
    'job-1',
    'Staff Distributed Systems Engineer',
    'Acme, Inc. "North"',
    'Remote',
    'https://example.com/jobs/1',
    'greenhouse',
    'Build distributed systems.',
    1699990000000,
    92,
    'interview',
    now,
    now
  );
  insertJob.run(
    'job-2',
    'Platform Engineer',
    'BetaCorp',
    'Hybrid',
    'https://example.com/jobs/2',
    'lever',
    'Own the platform.',
    null,
    71,
    'applied',
    now - 1000,
    now - 1000
  );

  const linkJob = db.prepare(
    `INSERT INTO user_jobs (id, user_id, job_id, fit_score, status, tailored_resume_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  linkJob.run('uj-1', 'user-1', 'job-1', 92, 'interview', 'tailored-job-1', now, now);
  linkJob.run('uj-2', 'user-1', 'job-2', 71, 'applied', null, now - 1000, now - 1000);

  const jobDir = join(artifactsDir, 'user-1', 'job-1');
  mkdirSync(jobDir, { recursive: true });
  writeFileSync(join(jobDir, 'resume.json'), JSON.stringify(TAILORED_RESUME, null, 2));
  writeFileSync(join(jobDir, 'resume.pdf'), Buffer.from('%PDF-1.4 fake pdf'));
  writeFileSync(join(jobDir, 'resume.txt'), 'Jane Doe — Staff Distributed Systems Engineer');
  writeFileSync(join(jobDir, 'cover-letter.md'), '# Tailored cover letter');
  writeFileSync(join(jobDir, 'payload.exe'), 'not an exported artifact');

  return { app, db, artifactsDir };
}

test('export API', async (t) => {
  const { app } = setup(t);
  const auth = { authorization: 'Bearer user-1-key' };

  await t.test('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/export?format=csv' });
    assert.equal(res.statusCode, 401);
  });

  await t.test('rejects unsupported formats', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export?format=xlsx',
      headers: auth,
    });
    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.payload).error, /Unsupported format/);
  });

  await t.test('exports CSV with RFC 4180 escaping and ISO dates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export?format=csv',
      headers: auth,
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /attachment; filename="jobfoundry-jobs-/);

    const lines = res.payload.trimEnd().split('\n');
    assert.equal(
      lines[0],
      'job_id,title,company,location,source,url,fit_score,status,tailored_resume_id,posted_at,created_at,updated_at'
    );
    assert.equal(lines.length, 3);
    assert.match(lines[1], /^job-1,/);
    assert.match(lines[1], /"Acme, Inc\. ""North"""/);
    assert.match(lines[1], /2023-11-14T22:13:20\.000Z/);
    assert.match(lines[2], /^job-2,/);
  });

  await t.test('exports the master profile as JSON Resume', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export?format=json-resume',
      headers: auth,
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.match(res.headers['content-disposition'], /filename="json-resume\.json"/);

    const resume = JSON.parse(res.payload);
    assert.doesNotThrow(() => validateResumeJson(resume));
    assert.equal(resume.basics.name, 'Jane Doe');
    assert.equal(resume.basics.label, 'Senior Platform Engineer');
  });

  await t.test('exports a tailored variant by job id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export?format=json-resume&job_id=job-1',
      headers: auth,
    });

    assert.equal(res.statusCode, 200);
    const resume = JSON.parse(res.payload);
    assert.doesNotThrow(() => validateResumeJson(resume));
    assert.equal(resume.basics.label, 'Staff Distributed Systems Engineer');
  });

  await t.test('does not leak another user’s tailored resume', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export?format=json-resume&job_id=job-1',
      headers: { authorization: 'Bearer user-2-key' },
    });
    assert.equal(res.statusCode, 404);
  });

  await t.test('exports a full archive with records and artifacts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export?format=archive',
      headers: auth,
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/zip/);
    assert.match(res.headers['content-disposition'], /attachment; filename="jobfoundry-export-/);

    const zip = await JSZip.loadAsync(res.rawPayload);
    assert.ok(zip.file('manifest.json'));
    assert.ok(zip.file('jobs.json'));
    assert.ok(zip.file('job-search.csv'));
    assert.ok(zip.file('resume/master.json'));
    assert.ok(zip.file('artifacts/job-1/resume.json'));
    assert.ok(zip.file('artifacts/job-1/resume.pdf'));
    assert.ok(zip.file('artifacts/job-1/resume.txt'));
    assert.ok(zip.file('artifacts/job-1/cover-letter.md'));
    assert.equal(zip.file('artifacts/job-1/payload.exe'), null);

    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    assert.equal(manifest.generator, 'JobFoundry');
    assert.equal(manifest.user_id, 'user-1');
    assert.deepEqual(manifest.counts, { jobs: 2, artifacts: 4, has_master_resume: true });

    const jobs = JSON.parse(await zip.file('jobs.json').async('string'));
    assert.equal(jobs.jobs.length, 2);
    assert.ok(jobs.jobs.every((job) => job.description));
  });
});
