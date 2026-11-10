import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { buildApp } from '../src/app.mjs';
import { openDb } from '../src/db/index.mjs';
import { saveUserResume, validateResumeJson } from '../src/resumes/resumes.mjs';
import {
  archiveSlots,
  buildExportArchive,
  ExportBusyError,
  ExportLimitError,
} from '../src/export/export.mjs';

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
  insertJob.run(
    'job-3',
    '=1+1',
    '@EvilCorp',
    '+Remote',
    'https://example.com/jobs/3',
    'custom',
    'Formula test.',
    null,
    null,
    'new',
    now - 2000,
    now - 2000
  );

  const linkJob = db.prepare(
    `INSERT INTO user_jobs (id, user_id, job_id, fit_score, fit_notes, status, tailored_resume_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  linkJob.run(
    'uj-1',
    'user-1',
    'job-1',
    92,
    JSON.stringify({ match: 'Strong' }),
    'interview',
    'tailored-job-1',
    now,
    now
  );
  linkJob.run('uj-2', 'user-1', 'job-2', 71, null, 'applied', null, now - 1000, now - 1000);
  linkJob.run('uj-3', 'user-1', 'job-3', null, null, 'new', null, now - 2000, now - 2000);

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
  const { app, db, artifactsDir } = setup(t);
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

  await t.test(
    'exports CSV with RFC 4180 escaping, CRLF separators, formula neutralization, and ISO dates',
    async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/export?format=csv',
        headers: auth,
      });

      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'], /text\/csv/);
      assert.match(res.headers['content-disposition'], /attachment; filename="jobfoundry-jobs-/);

      assert.ok(res.payload.includes('\r\n'), 'CSV must use CRLF delimiters');
      const lines = res.payload.trimEnd().split('\r\n');
      assert.equal(
        lines[0],
        'job_id,title,company,location,source,url,fit_score,status,tailored_resume_id,posted_at,created_at,updated_at'
      );
      assert.equal(lines.length, 4);
      assert.match(lines[1], /^job-1,/);
      assert.match(lines[1], /"Acme, Inc\. ""North"""/);
      assert.match(lines[1], /,92,/); // Numeric fit_score is NOT prefixed with single quote
      assert.match(lines[1], /2023-11-14T22:13:20\.000Z/);
      assert.match(lines[2], /^job-2,/);
      // job-3 tests formula trigger characters neutralization
      assert.match(lines[3], /^job-3,'=1\+1,'@EvilCorp,'\+Remote,/);
    }
  );

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

  await t.test('exports a full archive with records, fit notes, and artifacts', async () => {
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
    assert.ok(zip.file('jobs.csv'));
    assert.ok(zip.file('master-resume.json'));
    assert.equal(zip.file('job-search.csv'), null);
    assert.equal(zip.file('resume/master.json'), null);
    assert.ok(zip.file('artifacts/job-1/resume.json'));
    assert.ok(zip.file('artifacts/job-1/resume.pdf'));
    assert.ok(zip.file('artifacts/job-1/resume.txt'));
    assert.ok(zip.file('artifacts/job-1/cover-letter.md'));
    assert.equal(zip.file('artifacts/job-1/payload.exe'), null);

    // Automatic tailoring would omit Markdown; the archive synthesizes it from resume.json.
    const markdown = await zip.file('artifacts/job-1/resume.md').async('string');
    assert.match(markdown, /^# Jane Doe/);
    assert.match(markdown, /Staff Distributed Systems Engineer/);

    const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
    assert.equal(manifest.generator, 'JobFoundry');
    assert.equal(manifest.user_id, 'user-1');
    assert.deepEqual(manifest.counts, { jobs: 3, artifacts: 5, has_master_resume: true });
    assert.ok(manifest.archive_bytes > 0);
    assert.ok(manifest.artifact_bytes > 0);
    assert.ok(manifest.files.includes('jobs.csv'));
    assert.ok(manifest.files.includes('master-resume.json'));

    const jobs = JSON.parse(await zip.file('jobs.json').async('string'));
    assert.equal(jobs.jobs.length, 3);
    assert.ok(jobs.jobs.every((job) => job.description));
    assert.equal(jobs.jobs[0].fit_notes, JSON.stringify({ match: 'Strong' }));
  });

  await t.test('rejects tailored resumes that fail JSON Resume validation', async () => {
    const jobDir = join(artifactsDir, 'user-1', 'job-2');
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(
      join(jobDir, 'resume.json'),
      JSON.stringify({ basics: { name: 42, email: 'not-an-email' } })
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export?format=json-resume&job_id=job-2',
      headers: auth,
    });

    assert.equal(res.statusCode, 422);
    assert.match(JSON.parse(res.payload).error, /JSON Resume/);
  });

  await t.test('rejects archives that exceed the configured size limits', async () => {
    await assert.rejects(
      () =>
        buildExportArchive({
          db,
          userId: 'user-1',
          artifactsDir,
          limits: { maxArtifactBytes: 8, maxArchiveBytes: 10 * 1024 * 1024 },
        }),
      (err) => {
        assert.ok(err instanceof ExportLimitError);
        assert.match(err.message, /exceeds/);
        assert.equal(err.details.limit, 8);
        return true;
      }
    );

    // The cap covers serialized entries too, so a tiny total limit trips on jobs.json.
    await assert.rejects(
      () =>
        buildExportArchive({
          db,
          userId: 'user-1',
          artifactsDir,
          limits: { maxArtifactBytes: 1024, maxArchiveBytes: 10 },
        }),
      (err) => {
        assert.ok(err instanceof ExportLimitError);
        assert.match(err.message, /uncompressed export limit/);
        return true;
      }
    );
  });

  await t.test('excludes artifacts for jobs without a completed tailored variant', async () => {
    const jobDir = join(artifactsDir, 'user-1', 'job-3');
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(join(jobDir, 'resume.json'), JSON.stringify(TAILORED_RESUME));
    writeFileSync(join(jobDir, 'resume.md'), '# In-progress variant');

    const archive = await buildExportArchive({ db, userId: 'user-1', artifactsDir });
    const zip = await JSZip.loadAsync(archive.buffer);

    assert.equal(zip.file('artifacts/job-3/resume.json'), null);
    assert.equal(zip.file('artifacts/job-3/resume.md'), null);
  });

  await t.test('rejects concurrent archive builds at the process limit', async () => {
    const previousMax = archiveSlots.max;
    archiveSlots.max = 1;
    try {
      const results = await Promise.allSettled([
        buildExportArchive({ db, userId: 'user-1', artifactsDir }),
        buildExportArchive({ db, userId: 'user-1', artifactsDir }),
      ]);
      const rejected = results.filter((result) => result.status === 'rejected');
      assert.equal(rejected.length, 1);
      assert.ok(rejected[0].reason instanceof ExportBusyError);
    } finally {
      archiveSlots.max = previousMax;
    }
  });

  await t.test('lists tailored jobs through a dedicated endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export/tailored-jobs',
      headers: auth,
    });

    assert.equal(res.statusCode, 200);
    const { jobs } = JSON.parse(res.payload);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, 'job-1');
    assert.equal(jobs[0].tailored_resume_id, 'tailored-job-1');
    assert.equal(jobs[0].title, 'Staff Distributed Systems Engineer');
  });

  await t.test('does not advertise another user’s tailored variants', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/export/tailored-jobs',
      headers: { authorization: 'Bearer user-2-key' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.payload).jobs, []);
  });
});
