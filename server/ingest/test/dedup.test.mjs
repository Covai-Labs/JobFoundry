import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.mjs';
import { normalizeJob } from '../src/jobs/normalize.mjs';
import { fingerprintFor, insertIfNew } from '../src/jobs/dedup.mjs';
import {
  fingerprintText,
  similarity,
  normalizeJdText,
  CROSSLIST_THRESHOLD,
} from '../src/jobs/dedup/fingerprint-core.mjs';

const JD_A =
  'Senior backend engineer working on distributed payment platforms. You will design and operate high throughput services, own reliability, and mentor other engineers across the payments organisation. Experience with Go, Kubernetes and event driven systems is expected for this role.';

const JD_B =
  'Frontend designer responsible for our design system and component library. You will collaborate closely with product managers and engineers to ship polished, accessible interfaces. A strong eye for typography, motion and spacing is essential for this role.';

test('same JD text produces the same fingerprint', () => {
  assert.equal(fingerprintText(JD_A), fingerprintText(JD_A));
  assert.equal(fingerprintFor({ description: JD_A }), fingerprintFor({ description: JD_A }));
  assert.match(fingerprintText(JD_A), /^[0-9a-f]{16}$/);
});

test('semantically identical postings by different agencies share a fingerprint', () => {
  const direct = fingerprintFor({
    title: 'Backend Engineer',
    company: 'Acme Corp',
    description: JD_A,
  });
  const agency = fingerprintFor({
    title: 'Platform Engineer (Contract)',
    company: 'Hays',
    description: JD_A,
  });
  assert.equal(direct, agency);
  assert.ok(direct.length > 0);
});

test('distinct JDs produce different fingerprints', () => {
  assert.notEqual(fingerprintText(JD_A), fingerprintText(JD_B));
});

test('short descriptions are not fingerprintable (no body, no signal)', () => {
  assert.equal(fingerprintText('Come join our team!'), '');
  assert.equal(fingerprintFor({ description: 'Apply now.' }), '');
});

test('fingerprinting is deterministic and URL/title/company independent', () => {
  assert.equal(fingerprintFor({ description: JD_A }), fingerprintFor({ description: JD_A }));
  assert.equal(
    fingerprintFor({ description: JD_A, title: 'X', company: 'Y' }),
    fingerprintFor({ description: JD_A })
  );
});

test('similarity mirrors the career-ops cross-listing threshold (≤5 bits match at 0.92)', () => {
  const f = fingerprintText(JD_A);
  assert.equal(similarity(f, f), 1);
  const near = atDistance(f, 5);
  const far = atDistance(f, 6);
  assert.ok(similarity(f, near) >= CROSSLIST_THRESHOLD);
  assert.ok(similarity(f, far) < CROSSLIST_THRESHOLD);
});

test('malformed fingerprints never match (similarity 0)', () => {
  assert.equal(similarity('', fingerprintText(JD_A)), 0);
  assert.equal(similarity(null, fingerprintText(JD_A)), 0);
  assert.equal(similarity('zzzz', fingerprintText(JD_A)), 0);
});

test('end-to-end: two ingests of the same job in one DB is a no-op returning the existing id', () => {
  const db = openDb({ path: ':memory:' });
  try {
    const first = normalizeJob({
      title: 'Backend Engineer',
      company: 'Acme Corp',
      url: 'https://acme.example/j/42',
      source: 'greenhouse',
      postedAt: '2026-08-01T12:00:00Z',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    const { id: id1 } = insertIfNew(db, first);

    const second = normalizeJob({
      title: 'Backend Engineer',
      company: 'Acme Corp',
      url: 'https://acme.example/j/42',
      source: 'greenhouse',
      postedAt: '2026-08-01T12:00:00Z',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    const { id: id2 } = insertIfNew(db, second);

    assert.equal(id2, id1);
    const rows = db
      .prepare('SELECT COUNT(*) AS n FROM jobs WHERE url = ?')
      .get('https://acme.example/j/42');
    assert.equal(rows.n, 1);
  } finally {
    db.close();
  }
});

test('same fingerprint from a different agency URL is treated as one authoritative job', () => {
  const db = openDb({ path: ':memory:' });
  try {
    const direct = normalizeJob({
      title: 'Backend Engineer',
      company: 'Acme Corp',
      url: 'https://acme.example/j/42',
      source: 'greenhouse',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    const { id: id1 } = insertIfNew(db, direct);

    const agency = normalizeJob({
      title: 'Platform Engineer',
      company: 'Hays',
      url: 'https://hays.example/listing/7',
      source: 'lever',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    const { id: id2 } = insertIfNew(db, agency);

    assert.equal(id2, id1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n, 1);
  } finally {
    db.close();
  }
});

function atDistance(fp, n) {
  let v = BigInt('0x' + fp);
  const bits = new Set();
  while (bits.size < n) bits.add(Math.floor(Math.random() * 64));
  for (const b of bits) v ^= 1n << BigInt(b);
  return v.toString(16).padStart(16, '0');
}

test('normalizeJdText strips tags, entities and URLs', () => {
  assert.equal(
    normalizeJdText('<p>Hello &amp; welcome</p> https://acme.example/a/b\n\nHello world'),
    'hello welcome hello world'
  );
});

test('existing job with empty description is enriched when re-ingested with full description', () => {
  const db = openDb({ path: ':memory:' });
  try {
    const emptyJob = normalizeJob({
      title: 'Senior Engineer',
      company: 'Acme',
      url: 'https://acme.example/jobs/99',
      source: 'linkedin',
      description: '',
      fingerprint: '',
    });
    const { id: id1 } = insertIfNew(db, emptyJob);

    let saved = db.prepare('SELECT description FROM jobs WHERE id = ?').get(id1);
    assert.equal(saved.description, '');

    const fullJob = normalizeJob({
      title: 'Senior Engineer',
      company: 'Acme',
      url: 'https://acme.example/jobs/99',
      source: 'linkedin',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    const { id: id2 } = insertIfNew(db, fullJob);
    assert.equal(id2, id1);

    saved = db.prepare('SELECT description, fingerprint FROM jobs WHERE id = ?').get(id1);
    assert.equal(saved.description, JD_A);
    assert.equal(saved.fingerprint, fingerprintFor({ description: JD_A }));
  } finally {
    db.close();
  }
});

test('existing job with short stub description is enriched when re-ingested with fuller description', () => {
  const db = openDb({ path: ':memory:' });
  try {
    const stubJob = normalizeJob({
      title: 'Senior Engineer',
      company: 'Acme',
      url: 'https://acme.example/jobs/100',
      source: 'linkedin',
      description: 'Short preview text under 50 characters.',
      fingerprint: fingerprintFor({ description: 'Short preview text under 50 characters.' }),
    });
    const { id: id1 } = insertIfNew(db, stubJob);

    let saved = db.prepare('SELECT description FROM jobs WHERE id = ?').get(id1);
    assert.equal(saved.description, 'Short preview text under 50 characters.');

    const fullJob = normalizeJob({
      title: 'Senior Engineer',
      company: 'Acme',
      url: 'https://acme.example/jobs/100',
      source: 'linkedin',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    const { id: id2 } = insertIfNew(db, fullJob);
    assert.equal(id2, id1);

    saved = db.prepare('SELECT description, fingerprint FROM jobs WHERE id = ?').get(id1);
    assert.equal(saved.description, JD_A);
    assert.equal(saved.fingerprint, fingerprintFor({ description: JD_A }));
  } finally {
    db.close();
  }
});

test('description enrichment preserves user-selected status (saved, applied) and resets new/evaluating', () => {
  const db = openDb({ path: ':memory:' });
  try {
    // Insert test users to satisfy FK constraint
    db.prepare(
      "INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES ('u1', 'u1@example.com', 'hash', 'key1', '2026-01-01', '2026-01-01'), ('u2', 'u2@example.com', 'hash', 'key2', '2026-01-01', '2026-01-01'), ('u3', 'u3@example.com', 'hash', 'key3', '2026-01-01', '2026-01-01')"
    ).run();

    const job = normalizeJob({
      title: 'Senior Engineer',
      company: 'Acme',
      url: 'https://acme.example/jobs/101',
      source: 'linkedin',
      description: 'Initial stub',
      fingerprint: fingerprintFor({ description: 'Initial stub' }),
    });
    const { id } = insertIfNew(db, job);

    // User marks job as 'applied'
    db.prepare(
      "INSERT INTO user_jobs (id, user_id, job_id, status, fit_score, created_at, updated_at) VALUES ('uj_1', 'u1', ?, 'applied', 85, '2026-01-01', '2026-01-01')"
    ).run(id);

    // Another user has job in 'new'
    db.prepare(
      "INSERT INTO user_jobs (id, user_id, job_id, status, fit_score, created_at, updated_at) VALUES ('uj_2', 'u2', ?, 'new', 60, '2026-01-01', '2026-01-01')"
    ).run(id);

    // Third user had preview auto-rejected by score
    db.prepare(
      "INSERT INTO user_jobs (id, user_id, job_id, status, fit_score, created_at, updated_at) VALUES ('uj_3', 'u3', ?, 'rejected_by_score', 25, '2026-01-01', '2026-01-01')"
    ).run(id);

    // Enriched description arrives
    const enriched = normalizeJob({
      title: 'Senior Engineer',
      company: 'Acme',
      url: 'https://acme.example/jobs/101',
      source: 'linkedin',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    insertIfNew(db, enriched);

    const uj1 = db.prepare("SELECT status, fit_score FROM user_jobs WHERE id = 'uj_1'").get();
    assert.equal(uj1.status, 'applied'); // Preserved!
    assert.equal(uj1.fit_score, 85);

    const uj2 = db.prepare("SELECT status, fit_score FROM user_jobs WHERE id = 'uj_2'").get();
    assert.equal(uj2.status, 'new'); // Reset for re-scoring
    assert.equal(uj2.fit_score, null);

    const uj3 = db.prepare("SELECT status, fit_score FROM user_jobs WHERE id = 'uj_3'").get();
    assert.equal(uj3.status, 'new'); // Auto-rejection reset for re-scoring with full description!
    assert.equal(uj3.fit_score, null);
  } finally {
    db.close();
  }
});

test('description enrichment handles fingerprint collisions gracefully without throwing', () => {
  const db = openDb({ path: ':memory:' });
  try {
    // Job 1 already has full JD description and fingerprint
    const job1 = normalizeJob({
      title: 'Staff Engineer',
      company: 'Beta',
      url: 'https://beta.example/jobs/1',
      source: 'linkedin',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });
    insertIfNew(db, job1);

    // Job 2 initially has a stub
    const job2 = normalizeJob({
      title: 'Staff Engineer Duplicate',
      company: 'Beta',
      url: 'https://beta.example/jobs/2',
      source: 'linkedin',
      description: 'Stub preview',
      fingerprint: fingerprintFor({ description: 'Stub preview' }),
    });
    const { id: id2 } = insertIfNew(db, job2);

    // Job 2 is re-ingested with JD_A (which shares Job 1's fingerprint)
    const job2Full = normalizeJob({
      title: 'Staff Engineer Duplicate',
      company: 'Beta',
      url: 'https://beta.example/jobs/2',
      source: 'linkedin',
      description: JD_A,
      fingerprint: fingerprintFor({ description: JD_A }),
    });

    // Must not throw SQLITE_CONSTRAINT_UNIQUE on fingerprint
    assert.doesNotThrow(() => {
      insertIfNew(db, job2Full);
    });

    const saved2 = db.prepare('SELECT description FROM jobs WHERE id = ?').get(id2);
    assert.equal(saved2.description, JD_A);
  } finally {
    db.close();
  }
});
