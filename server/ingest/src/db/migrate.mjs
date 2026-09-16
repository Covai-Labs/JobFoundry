import { readFileSync } from 'node:fs';

const SCHEMA_SQL = new URL('./schema.sql', import.meta.url);

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
  db.exec(
    `UPDATE users
     SET is_admin = 1
     WHERE id = (SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1)`
  );
}
