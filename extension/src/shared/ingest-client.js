import { getConfig as readConfig } from './config.ts';

export class ConfigError extends Error {}
export class AuthError extends Error {}
export class HttpError extends Error {
  constructor(status) {
    super(`ingest request failed with HTTP ${status}`);
    this.status = status;
  }
}
export class TimeoutError extends Error {}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_MAX_BATCH_COUNT = 50;
const DEFAULT_MAX_BATCH_BYTES = 512 * 1024; // 512 KiB per POST

/**
 * Split a list of jobs into chunks bounded by both item count and serialized JSON byte length.
 */
export function chunkJobs(
  jobs,
  maxBatchCount = DEFAULT_MAX_BATCH_COUNT,
  maxBatchBytes = DEFAULT_MAX_BATCH_BYTES
) {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  const chunks = [];
  let current = [];
  // Account for `{"jobs":[]}` wrapper overhead (11 bytes) + comma separators
  let currentBytes = 11;

  for (const job of jobs) {
    const serialized = JSON.stringify(job);
    const jobBytes = serialized.length + (current.length > 0 ? 1 : 0);

    if (
      current.length > 0 &&
      (current.length >= maxBatchCount || currentBytes + jobBytes > maxBatchBytes)
    ) {
      chunks.push(current);
      current = [];
      currentBytes = 11;
    }

    current.push(job);
    currentBytes += serialized.length + (current.length > 1 ? 1 : 0);
  }

  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

export async function sendJobs({
  jobs,
  serverUrl,
  apiKey,
  getConfig = readConfig,
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
  retries = 2,
  backoffMs = 500,
  sleep = defaultSleep,
  maxBatchCount = DEFAULT_MAX_BATCH_COUNT,
  maxBatchBytes = DEFAULT_MAX_BATCH_BYTES,
}) {
  const config = serverUrl && apiKey ? { serverUrl, apiKey } : await getConfig();
  const effectiveServerUrl = serverUrl ?? config.serverUrl;
  const effectiveApiKey = apiKey ?? config.apiKey;
  if (!effectiveServerUrl) throw new ConfigError('serverUrl is not configured');
  if (!effectiveApiKey) throw new ConfigError('apiKey is not configured');

  if (!Array.isArray(jobs) || jobs.length === 0) {
    return { ingested: 0, deduped: 0, ids: [] };
  }

  const url = `${String(effectiveServerUrl).replace(/\/+$/, '')}/api/v1/jobs/ingest`;
  const chunks = chunkJobs(jobs, maxBatchCount, maxBatchBytes);

  let totalIngested = 0;
  let totalDeduped = 0;
  const allIds = [];
  let sentCount = 0;

  for (const batch of chunks) {
    try {
      const result = await sendBatch(batch);
      if (chunks.length === 1) {
        return result;
      }
      totalIngested += Number(result?.ingested ?? 0);
      totalDeduped += Number(result?.deduped ?? 0);
      if (Array.isArray(result?.ids)) {
        allIds.push(...result.ids);
      }
      sentCount += batch.length;
    } catch (err) {
      if (err && typeof err === 'object' && sentCount > 0) {
        err.remainingJobs = jobs.slice(sentCount);
      }
      throw err;
    }
  }

  return { ingested: totalIngested, deduped: totalDeduped, ids: allIds };

  async function sendBatch(batch) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await attempt(0);
    } finally {
      clearTimeout(timer);
    }

    async function attempt(tryCount = 0) {
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${effectiveApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobs: batch }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err?.name === 'AbortError')
          throw new TimeoutError(`request timed out after ${timeoutMs}ms`);
        throw err;
      }

      if (response.ok) return response.json();

      if (response.status === 401) {
        throw new AuthError('auth error: ingest server rejected the API key (401)');
      }

      if (response.status >= 500 && tryCount < retries) {
        await sleep(backoffMs * 2 ** tryCount);
        return attempt(tryCount + 1);
      }

      throw new HttpError(response.status);
    }
  }
}
