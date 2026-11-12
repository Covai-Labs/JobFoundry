import { readFileSync } from 'node:fs';
import { analyzeRepost, normalizeCompany } from '../jobs/detect-reposts.mjs';

const SCHEMA_SQL = new URL('./schema.sql', import.meta.url);

export function backfillReposts(db) {
  let threshold = 45;
  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'repost_threshold_days'")
      .get();
    if (row?.value) {
      const parsed = Number(row.value);
      if (!Number.isNaN(parsed) && parsed > 0) threshold = parsed;
    }
  } catch {}

  const rows = db
    .prepare(
      'SELECT id, title, company, posted_at, created_at, url FROM jobs WHERE repost_status IS NULL'
    )
    .all();
  if (!rows || rows.length === 0) return 0;

  const updateStmt = db.prepare(
    'UPDATE jobs SET repost_status = ?, repost_confidence = ? WHERE id = ?'
  );

  db.transaction(() => {
    for (const job of rows) {
      const normComp = normalizeCompany(job.company);
      const candidates = normComp
        ? db
            .prepare(
              'SELECT id, title, company, posted_at, created_at, url FROM jobs WHERE id != ? AND (company LIKE ? OR company = ? COLLATE NOCASE)'
            )
            .all(job.id, `${normComp}%`, job.company)
        : db
            .prepare(
              'SELECT id, title, company, posted_at, created_at, url FROM jobs WHERE id != ? AND company = ? COLLATE NOCASE'
            )
            .all(job.id, job.company);

      const history = normComp
        ? candidates.filter((c) => normalizeCompany(c.company) === normComp)
        : candidates;

      const analysis = analyzeRepost(job, history, { repostThresholdDays: threshold });
      updateStmt.run(JSON.stringify(analysis), analysis.confidence || 'none', job.id);
    }
  })();

  return rows.length;
}

export function migrate(db) {
  const sql = readFileSync(SCHEMA_SQL, 'utf8');
  db.exec(sql);
  try {
    db.exec('ALTER TABLE jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0');
  } catch {}
  try {
    db.exec('ALTER TABLE user_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0');
  } catch {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  } catch (err) {
    if (!String(err?.message || err).includes('duplicate column name')) throw err;
  }
  try {
    db.exec('ALTER TABLE jobs ADD COLUMN repost_status TEXT');
  } catch (err) {
    if (!String(err?.message || err).includes('duplicate column name')) throw err;
  }
  try {
    db.exec("ALTER TABLE jobs ADD COLUMN repost_confidence TEXT NOT NULL DEFAULT 'none'");
  } catch (err) {
    if (!String(err?.message || err).includes('duplicate column name')) throw err;
  }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_facts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL DEFAULT 'general',
        fact_text TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_user_facts_user ON user_facts(user_id);
    `);
  } catch (err) {
    if (!String(err?.message || err).includes('already exists')) {
      throw err;
    }
  }

  db.exec(
    `UPDATE users
     SET is_admin = 1
     WHERE id = (SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1)`
  );
  backfillReposts(db);
}
