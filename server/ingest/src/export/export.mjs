import { readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import JSZip from 'jszip';
import { isRegisteredUser } from '../settings/settings.mjs';
import { renderResumeMarkdown } from '../resumes/resume-markdown.mjs';

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const SAFE_ARTIFACT_FILENAME = /^[a-zA-Z0-9_-]+\.(json|pdf|txt|md)$/;
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Upper bounds that keep a single archive build from exhausting process memory.
 * Both values are measured against uncompressed bytes, including the serialized
 * job records, master resume, artifacts, and manifest.
 */
export const DEFAULT_EXPORT_LIMITS = Object.freeze({
  maxArtifactBytes: 25 * 1024 * 1024,
  maxArchiveBytes: 100 * 1024 * 1024,
});

/**
 * Process-wide guard so concurrent archive builds cannot exhaust memory even when
 * each individual archive stays under `maxArchiveBytes`.
 */
export const archiveSlots = {
  max: Number(process.env.MAX_CONCURRENT_EXPORT_ARCHIVES) || 2,
  active: 0,
};

export class ExportLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ExportLimitError';
    this.details = details;
  }
}

export class ExportBusyError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ExportBusyError';
    this.details = details;
  }
}

const escapesParent = (rel) =>
  !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);

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
 * Return every job the user has successfully tailored, without pagination.
 *
 * Registered users are scoped through `user_jobs.tailored_resume_id` so a shared
 * job's global tailored ID never advertises a variant the user does not own.
 *
 * @returns {Array<object>} Job rows ordered by most recently updated first.
 */
export function getTailoredJobs(db, userId) {
  if (isRegisteredUser(db, userId)) {
    return db
      .prepare(
        `SELECT
           j.id, j.title, j.company, uj.tailored_resume_id, uj.updated_at
         FROM user_jobs uj
         JOIN jobs j ON uj.job_id = j.id
         WHERE uj.user_id = ? AND uj.tailored_resume_id IS NOT NULL AND uj.tailored_resume_id != ''
         ORDER BY uj.updated_at DESC`
      )
      .all(userId);
  }

  return db
    .prepare(
      `SELECT j.id, j.title, j.company, j.tailored_resume_id, j.updated_at
       FROM jobs j
       WHERE j.tailored_resume_id IS NOT NULL AND j.tailored_resume_id != ''
       ORDER BY j.updated_at DESC`
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
  if (escapesParent(relative(base, filePath))) return null;

  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Return the user's artifact files on disk that are safe to bundle in an export.
 *
 * @returns {Array<{ name: string, path: string, size: number }>} Whitelisted artifact files.
 */
export function getArtifactFiles(artifactsDir, userId, jobId) {
  if (!SAFE_ID.test(userId) || !SAFE_ID.test(jobId)) return [];

  const base = resolve(artifactsDir);
  const jobDir = resolve(base, userId, jobId);
  if (escapesParent(relative(base, jobDir))) return [];

  try {
    return readdirSync(jobDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && SAFE_ARTIFACT_FILENAME.test(entry.name))
      .flatMap((entry) => {
        const path = resolve(jobDir, entry.name);
        try {
          return [{ name: entry.name, path, size: statSync(path).size }];
        } catch {
          return [];
        }
      });
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
export async function buildExportArchive({
  db,
  userId,
  artifactsDir,
  now = new Date(),
  limits = DEFAULT_EXPORT_LIMITS,
}) {
  if (archiveSlots.active >= archiveSlots.max) {
    throw new ExportBusyError('Another export archive is already being generated', {
      active: archiveSlots.active,
      limit: archiveSlots.max,
    });
  }

  archiveSlots.active += 1;
  try {
    return await buildArchive({ db, userId, artifactsDir, now, limits });
  } finally {
    archiveSlots.active -= 1;
  }
}

async function buildArchive({ db, userId, artifactsDir, now, limits }) {
  const zip = new JSZip();
  const jobs = getExportJobs(db, userId);
  const completedTailoredJobIds = new Set(getTailoredJobs(db, userId).map((job) => job.id));
  const masterResume = getMasterResume(db, userId);
  const exportedAt = now.toISOString();
  const artifactFiles = [];
  let archiveBytes = 0;
  let artifactBytes = 0;

  const byteLength = (content) =>
    Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf8');

  const addEntry = (name, content, { artifact = false } = {}) => {
    const size = byteLength(content);
    if (artifact && size > limits.maxArtifactBytes) {
      throw new ExportLimitError(
        `Artifact ${name} exceeds the ${limits.maxArtifactBytes} byte export limit`,
        { file: name, size, limit: limits.maxArtifactBytes }
      );
    }
    if (archiveBytes + size > limits.maxArchiveBytes) {
      throw new ExportLimitError(
        `Archive exceeds the ${limits.maxArchiveBytes} byte uncompressed export limit`,
        { file: name, size: archiveBytes + size, limit: limits.maxArchiveBytes }
      );
    }
    archiveBytes += size;
    if (artifact) artifactBytes += size;
    zip.file(name, content);
  };

  addEntry('jobs.json', JSON.stringify({ exported_at: exportedAt, jobs }, null, 2));
  addEntry('jobs.csv', jobsToCsv(jobs));

  if (masterResume) {
    addEntry('master-resume.json', JSON.stringify(masterResume, null, 2));
  }

  for (const job of jobs) {
    if (!SAFE_ID.test(job.id)) continue;
    // Only bundle variants that finished successfully for this user. During tailoring
    // the DB row keeps the previous value, so half-written files are excluded.
    if (!completedTailoredJobIds.has(job.id)) continue;

    const files = getArtifactFiles(artifactsDir, userId, job.id);
    const available = new Set(files.map((file) => file.name));
    let resumeJson = null;

    for (const artifact of files) {
      // Reject oversized files before reading them into memory.
      if (artifact.size > limits.maxArtifactBytes) {
        throw new ExportLimitError(
          `Artifact ${artifact.name} for job ${job.id} exceeds the ${limits.maxArtifactBytes} byte export limit`,
          {
            job_id: job.id,
            file: artifact.name,
            size: artifact.size,
            limit: limits.maxArtifactBytes,
          }
        );
      }

      let content;
      try {
        content = readFileSync(artifact.path);
      } catch {
        // Skip unreadable artifact; it does not count towards the byte budget.
        continue;
      }
      if (artifact.name === 'resume.json') resumeJson = content;

      const entry = `artifacts/${job.id}/${artifact.name}`;
      addEntry(entry, content, { artifact: true });
      artifactFiles.push(entry);
    }

    // Automatic tailoring (scorer worker) writes resume.json without Markdown.
    if (!available.has('resume.md') && resumeJson) {
      let parsed;
      try {
        parsed = JSON.parse(resumeJson.toString('utf8'));
      } catch {
        parsed = null;
      }
      if (parsed) {
        const entry = `artifacts/${job.id}/resume.md`;
        addEntry(entry, renderResumeMarkdown(parsed), { artifact: true });
        artifactFiles.push(entry);
      }
    }
  }

  const manifest = {
    generator: 'JobFoundry',
    format_version: 1,
    exported_at: exportedAt,
    user_id: userId,
    archive_bytes: archiveBytes,
    artifact_bytes: artifactBytes,
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
  addEntry('manifest.json', JSON.stringify(manifest, null, 2));

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
