import { fingerprintText } from './dedup/fingerprint-core.mjs';

export function fingerprintFor(job) {
  return fingerprintText(String(job?.description ?? ''));
}

const INSERT_SQL = `
  INSERT INTO jobs (
    id, title, company, location, url, source, posted_at, description,
    fingerprint, liveness, fit_score, fit_notes, status, tailored_resume_id,
    repost_status, repost_confidence,
    created_at, updated_at
  ) VALUES (
    @id, @title, @company, @location, @url, @source, @posted_at, @description,
    @fingerprint, @liveness, @fit_score, @fit_notes, @status, @tailored_resume_id,
    @repost_status, @repost_confidence,
    @created_at, @updated_at
  ) ON CONFLICT(url) DO NOTHING
`;

export function insertIfNew(db, row) {
  const existing = db
    .prepare(
      "SELECT id, description, fingerprint FROM jobs WHERE url = ? OR id = ? OR (fingerprint IS NOT NULL AND fingerprint != '' AND fingerprint = ?)"
    )
    .get(row.url, row.id, row.fingerprint || null);

  if (existing) {
    const storedLength = (existing.description || '').trim().length;
    const incomingLength = (row.description || '').trim().length;
    if (incomingLength > storedLength) {
      try {
        db.prepare(
          'UPDATE jobs SET description = ?, fingerprint = ?, updated_at = ? WHERE id = ?'
        ).run(row.description, row.fingerprint, row.updated_at, existing.id);
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
          // If fingerprint conflicts with an existing duplicate job, update description without the conflicting fingerprint
          db.prepare('UPDATE jobs SET description = ?, updated_at = ? WHERE id = ?').run(
            row.description,
            row.updated_at,
            existing.id
          );
        } else {
          throw err;
        }
      }

      try {
        // Only reset unscored/in-triage/auto-rejected jobs to 'new'; preserve user statuses (applied, saved, interview, etc.)
        db.prepare(
          "UPDATE user_jobs SET status = 'new', attempt_count = 0, fit_score = NULL, fit_notes = NULL, updated_at = ?" +
            " WHERE job_id = ? AND status IN ('new', 'queued', 'evaluating', 'rejected_by_score', 'score_failed', 'invalid_job')"
        ).run(row.updated_at, existing.id);
      } catch {}
    }
    return { id: existing.id, deduped: true };
  }

  const rowToInsert = {
    repost_status: null,
    repost_confidence: 'none',
    ...row,
  };

  let res;
  try {
    res = db.prepare(INSERT_SQL).run(rowToInsert);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const found = db
        .prepare('SELECT id FROM jobs WHERE id = ? OR fingerprint = ? OR url = ?')
        .get(row.id, row.fingerprint || null, row.url);
      return { id: found?.id ?? row.id, deduped: true };
    }
    throw err;
  }
  if (res.changes === 1) return { id: row.id, deduped: false };
  const found = db.prepare('SELECT id FROM jobs WHERE url = ?').get(row.url);
  return { id: found?.id ?? row.id, deduped: true };
}
