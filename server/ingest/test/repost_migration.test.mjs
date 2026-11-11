import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate, backfillReposts } from '../src/db/migrate.mjs';

test('migration: adds repost_status and repost_confidence columns and is idempotent', () => {
  const db = new Database(':memory:');
  migrate(db);

  // Check columns exist on jobs table
  const tableInfo = db.prepare("PRAGMA table_info('jobs')").all();
  const columnNames = tableInfo.map((c) => c.name);

  assert.ok(columnNames.includes('repost_status'), 'jobs table has repost_status column');
  assert.ok(columnNames.includes('repost_confidence'), 'jobs table has repost_confidence column');

  // Verify default value for repost_confidence
  const confidenceCol = tableInfo.find((c) => c.name === 'repost_confidence');
  assert.equal(confidenceCol.dflt_value, "'none'");

  // Running migrate again should not fail
  assert.doesNotThrow(() => migrate(db), 'migrate is idempotent');
});

test('migration: backfillReposts populates unanalyzed rows across company history', () => {
  const db = new Database(':memory:');
  migrate(db);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Insert legacy jobs where repost_status is NULL
  db.prepare(
    `
    INSERT INTO jobs (
      id, title, company, url, source, posted_at, liveness, status, created_at, updated_at, repost_status, repost_confidence
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'new', ?, ?, NULL, 'none')
  `
  ).run(
    'job-old-1',
    'Senior Backend Engineer',
    'Acme Corp',
    'https://acme.example/jobs/1',
    'greenhouse',
    now - 60 * dayMs,
    now - 60 * dayMs,
    now - 60 * dayMs
  );

  db.prepare(
    `
    INSERT INTO jobs (
      id, title, company, url, source, posted_at, liveness, status, created_at, updated_at, repost_status, repost_confidence
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'new', ?, ?, NULL, 'none')
  `
  ).run(
    'job-old-2',
    'Staff Backend Engineer',
    'Acme Corp',
    'https://acme.example/jobs/2',
    'greenhouse',
    now - 30 * dayMs,
    now - 30 * dayMs,
    now - 30 * dayMs
  );

  db.prepare(
    `
    INSERT INTO jobs (
      id, title, company, url, source, posted_at, liveness, status, created_at, updated_at, repost_status, repost_confidence
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'new', ?, ?, NULL, 'none')
  `
  ).run(
    'job-new-3',
    'Backend Engineer',
    'Acme Corp',
    'https://acme.example/jobs/3',
    'greenhouse',
    now,
    now,
    now
  );

  // Run backfill
  const backfilledCount = backfillReposts(db);
  assert.equal(backfilledCount, 3, 'backfilled 3 jobs');

  // Verify job-new-3 was identified with high confidence
  const job3 = db
    .prepare('SELECT repost_status, repost_confidence FROM jobs WHERE id = ?')
    .get('job-new-3');
  assert.equal(job3.repost_confidence, 'high');
  const parsed3 = JSON.parse(job3.repost_status);
  assert.equal(parsed3.isRepost, true);
  assert.equal(parsed3.count, 2);
  assert.ok(parsed3.daysSpan >= 60);

  // Calling backfill again when all rows have repost_status should do 0 updates
  assert.equal(backfillReposts(db), 0);
});
