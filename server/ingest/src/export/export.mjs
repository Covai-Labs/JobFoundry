import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import JSZip from 'jszip';
import { isRegisteredUser } from '../settings/settings.mjs';

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SAFE_ARTIFACT_FILENAME = /^[a-zA-Z0-9_-]+\.(json|pdf|txt|md)$/;
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

const CSV_COLUMNS = [
  'job_id',
  'title',
  'company',
  'location',
  'source',
  'url',
  'fit_score',
  'status',
  'tailored_resume_id',
  'posted_at',
  'created_at',
  'updated_at',
];

/**
 * Return every job visible to the user, mirroring the `/api/v1/jobs` scoping rules
 * but without pagination.
 *
 * @returns {Array<object>} Job rows ordered by creation date, newest first.
 */
export function getExportJobs(db, userId) {
  if (isRegisteredUser(db, userId)) {
    return db
      .prepare(
        `SELECT
           j.id, j.title, j.company, j.location, j.url, j.source, j.description, j.posted_at,
           j.liveness,
           COALESCE(uj.fit_score, j.fit_score) AS fit_score,
           COALESCE(uj.fit_notes, j.fit_notes) AS fit_notes,
           COALESCE(uj.status, j.status) AS status,
           COALESCE(uj.tailored_resume_id, j.tailored_resume_id) AS tailored_resume_id,
           COALESCE(uj.created_at, j.created_at) AS created_at,
           COALESCE(uj.updated_at, j.updated_at) AS updated_at
         FROM user_jobs uj
         JOIN jobs j ON uj.job_id = j.id
         WHERE uj.user_id = ?
         ORDER BY COALESCE(uj.created_at, j.created_at) DESC`
      )
      .all(userId);
  }

  return db
    .prepare(
      `SELECT
         j.id, j.title, j.company, j.location, j.url, j.source, j.description, j.posted_at,
         j.liveness, j.fit_score, j.fit_notes, j.status, j.tailored_resume_id, j.created_at, j.updated_at
       FROM jobs j
       ORDER BY j.created_at DESC`
    )
    .all();
}

/**
 * Return the user's master profile as a JSON Resume document, preferring the active
 * resume and falling back to the most recently updated one.
 *
 * @returns {object|null} Parsed JSON Resume object, or null when none exists.
 */
export function getMasterResume(db, userId) {
  const row = db
    .prepare(
      `SELECT resume_json FROM user_resumes
       WHERE user_id = ?
       ORDER BY is_active DESC, updated_at DESC
       LIMIT 1`
    )
    .get(userId);

  if (!row?.resume_json) return null;
  try {
    return JSON.parse(row.resume_json);
  } catch {
    return null;
  }
}

/**
 * Read a tailored resume variant from local artifacts.
 *
 * @returns {object|null} Parsed JSON Resume object, or null when it does not exist.
 */
export function getTailoredResume(artifactsDir, userId, jobId) {
  if (!SAFE_ID.test(userId) || !SAFE_ID.test(jobId)) return null;

  const base = resolve(artifactsDir);
  const filePath = resolve(base, userId, jobId, 'resume.json');
  const rel = relative(base, filePath);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;

  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Return the user's artifact files on disk that are safe to bundle in an export.
 *
 * @returns {Array<{ name: string, path: string }>} Whitelisted artifact files.
 */
export function getArtifactFiles(artifactsDir, userId, jobId) {
  if (!SAFE_ID.test(userId) || !SAFE_ID.test(jobId)) return [];

  const base = resolve(artifactsDir);
  const jobDir = resolve(base, userId, jobId);
  const rel = relative(base, jobDir);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return [];

  try {
    const entries = readdirSync(jobDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && SAFE_ARTIFACT_FILENAME.test(entry.name))
      .map((entry) => ({
        name: entry.name,
        path: resolve(jobDir, entry.name),
      }));
  } catch {
    return [];
  }
}

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const isoDate = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

/**
 * Render the job search history as RFC 4180-style CSV.
 *
 * @returns {string} CSV document with a header row.
 */
export function jobsToCsv(jobs) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const job of jobs) {
    lines.push(
      [
        job.id,
        job.title,
        job.company,
        job.location,
        job.source,
        job.url,
        job.fit_score,
        job.status,
        job.tailored_resume_id,
        isoDate(job.posted_at),
        isoDate(job.created_at),
        isoDate(job.updated_at),
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Build a complete ZIP archive containing database records, the master profile,
 * tailored resumes, and generated artifacts.
 *
 * @returns {Promise<{ buffer: Buffer, filename: string, counts: object }>} Archive payload.
 */
export async function buildExportArchive({ db, userId, artifactsDir, now = new Date() }) {
  const zip = new JSZip();
  const jobs = getExportJobs(db, userId);
  const masterResume = getMasterResume(db, userId);
  const exportedAt = now.toISOString();
  const artifactFiles = [];

  zip.file('jobs.json', JSON.stringify({ exported_at: exportedAt, jobs }, null, 2));
  zip.file('jobs.csv', jobsToCsv(jobs));

  if (masterResume) {
    zip.file('master-resume.json', JSON.stringify(masterResume, null, 2));
  }

  for (const job of jobs) {
    if (!SAFE_ID.test(job.id)) continue;
    for (const artifact of getArtifactFiles(artifactsDir, userId, job.id)) {
      try {
        const content = readFileSync(artifact.path);
        const entry = `artifacts/${job.id}/${artifact.name}`;
        zip.file(entry, content);
        artifactFiles.push(entry);
      } catch {
        // Skip inaccessible artifact
      }
    }
  }

  const manifest = {
    generator: 'JobFoundry',
    format_version: 1,
    exported_at: exportedAt,
    user_id: userId,
    counts: {
      jobs: jobs.length,
      artifacts: artifactFiles.length,
      has_master_resume: Boolean(masterResume),
    },
    files: [
      'manifest.json',
      'jobs.json',
      'jobs.csv',
      ...(masterResume ? ['master-resume.json'] : []),
      ...artifactFiles,
    ],
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    buffer,
    filename: `jobfoundry-export-${exportedAt.slice(0, 10)}.zip`,
    counts: manifest.counts,
  };
}
