# JobFoundry MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stdio Model Context Protocol server that exposes five JobFoundry tools to Claude Desktop, Cursor, and local agentic CLIs.

**Architecture:** A new `server/mcp` workspace built on the official `@modelcontextprotocol/sdk`, acting as a thin authenticated HTTP client of the existing ingest API. Tool handlers stay transport-agnostic so a hosted Streamable HTTP transport can be added later without changing logic. No direct SQLite access, no scraping, no LLM keys in the MCP process.

**Tech Stack:** Node.js 26, `@modelcontextprotocol/sdk` 1.32.2, `zod` 4.5.4, Node built-in `fetch`, `node:util` `parseArgs`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-10-jobfoundry-mcp-design.md`

## Global Constraints

- Node engine floor: `>=26` (matches the repository).
- Runtime dependencies: exactly `@modelcontextprotocol/sdk@1.32.2` and `zod@4.5.4`. No other runtime dependencies.
- The MCP process holds only `JOBFOUNDRY_API_KEY`. It never receives or logs LLM provider keys.
- `http://` API URLs are allowed only for hostnames `127.0.0.1`, `::1`, and `localhost`. Every other host must use `https://`.
- stdout is reserved for the MCP protocol. Diagnostics go to stderr. Never print the API key.
- All reads and writes go through the ingest API. Do not open the SQLite database from `server/mcp`.
- Application-stage writes accept canonical Kanban statuses plus aliases; responses always use canonical values.
- Tool errors return `isError: true` with actionable text; handlers must not throw for API or validation failures.
- Search results omit `description`; `limit` is capped at 200.
- Package license: `AGPL-3.0-only`.
- Formatting: Prettier with `singleQuote: true`, `printWidth: 100`, `trailingComma: "es5"`.

## Review Focus

1. A user configures a remote JobFoundry URL over plain `http://` while an API key is set — config must reject it before any request is sent.
2. A proxy returns HTML or an empty body with a 5xx — the client must return an actionable tool error, never crash or print a raw stack.
3. `fit_notes` is malformed JSON or `{ "error": "..." }` — the fit tool must return `scored: false` with the raw value or error, never throw.
4. A user passes an unknown stage or an internal failure stage to `update_application_status` — the tool must reject it and leave the database unchanged.
5. The active resume is missing, the LLM key is missing, tailoring returns 502, or the client times out mid-tailor — the tool must report the server's message and must not claim success.

---

### Task 1: Workspace scaffold, version, and configuration

**Files:**
- Create: `server/mcp/package.json`
- Create: `server/mcp/src/version.mjs`
- Create: `server/mcp/src/config.mjs`
- Create: `server/mcp/test/config.test.mjs`
- Modify: `package.json` (workspaces)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `VERSION: string` from `server/mcp/src/version.mjs`
  - `class ConfigError extends Error`
  - `resolveConfig({ argv?: string[], env?: Record<string, string | undefined> }): { help: boolean, version: boolean, url: string, apiKey: string, timeoutMs: number }`
  - `usage(): string`

- [ ] **Step 1: Create the workspace package and register it**

Create `server/mcp/package.json`:

```json
{
  "name": "jobfoundry-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "AGPL-3.0-only",
  "description": "stdio Model Context Protocol server for JobFoundry",
  "bin": {
    "jobfoundry-mcp": "src/index.mjs"
  },
  "scripts": {
    "start": "node src/index.mjs",
    "test": "node --test test/*.test.mjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "1.32.2",
    "zod": "4.5.4"
  },
  "engines": {
    "node": ">=26"
  }
}
```

Modify the root `package.json` workspaces array to include `server/mcp`:

```json
  "workspaces": [
    "extension",
    "server/ingest",
    "server/mcp",
    "server/web",
    "site"
  ],
```

Install and update the lockfile:

```bash
npm install
```

Expected: `package-lock.json` gains `server/mcp` and `@modelcontextprotocol/sdk`; command exits 0.

- [ ] **Step 2: Write the failing config tests**

Create `server/mcp/test/config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, resolveConfig, usage } from '../src/config.mjs';

test('defaults to the local ingest API and a 30 second timeout', () => {
  const config = resolveConfig({ argv: [], env: {} });
  assert.equal(config.url, 'http://127.0.0.1:8080');
  assert.equal(config.apiKey, '');
  assert.equal(config.timeoutMs, 30000);
  assert.equal(config.help, false);
  assert.equal(config.version, false);
});

test('reads environment variables', () => {
  const config = resolveConfig({
    argv: [],
    env: {
      JOBFOUNDRY_URL: 'https://api.example.com/jobfoundry/',
      JOBFOUNDRY_API_KEY: 'env-key',
      JOBFOUNDRY_TIMEOUT: '45',
    },
  });
  assert.equal(config.url, 'https://api.example.com/jobfoundry');
  assert.equal(config.apiKey, 'env-key');
  assert.equal(config.timeoutMs, 45000);
});

test('CLI flags override environment variables', () => {
  const config = resolveConfig({
    argv: ['--url', 'https://cli.example.com', '--api-key', 'cli-key', '--timeout', '12'],
    env: {
      JOBFOUNDRY_URL: 'http://127.0.0.1:9999',
      JOBFOUNDRY_API_KEY: 'env-key',
      JOBFOUNDRY_TIMEOUT: '45',
    },
  });
  assert.equal(config.url, 'https://cli.example.com');
  assert.equal(config.apiKey, 'cli-key');
  assert.equal(config.timeoutMs, 12000);
});

test('allows plain http only for loopback hosts', () => {
  assert.equal(
    resolveConfig({ argv: ['--url', 'http://localhost:8080'], env: {} }).url,
    'http://localhost:8080'
  );
  assert.equal(
    resolveConfig({ argv: ['--url', 'http://127.0.0.1:8080'], env: {} }).url,
    'http://127.0.0.1:8080'
  );
  assert.equal(
    resolveConfig({ argv: ['--url', 'http://[::1]:8080'], env: {} }).url,
    'http://[::1]:8080'
  );
  assert.throws(
    () => resolveConfig({ argv: ['--url', 'http://api.example.com'], env: {} }),
    (err) => err instanceof ConfigError && /https:\/\//.test(err.message)
  );
});

test('rejects URLs with credentials, queries, fragments, or bad schemes', () => {
  assert.throws(
    () => resolveConfig({ argv: ['--url', 'https://user:pass@example.com'], env: {} }),
    /credentials/
  );
  assert.throws(
    () => resolveConfig({ argv: ['--url', 'https://example.com?x=1'], env: {} }),
    /query or fragment/
  );
  assert.throws(
    () => resolveConfig({ argv: ['--url', 'https://example.com#x'], env: {} }),
    /query or fragment/
  );
  assert.throws(() => resolveConfig({ argv: ['--url', 'ftp://example.com'], env: {} }), /http/);
});

test('rejects invalid timeouts and unknown flags', () => {
  assert.throws(() => resolveConfig({ argv: ['--timeout', '0'], env: {} }), /between 1 and 3600/);
  assert.throws(() => resolveConfig({ argv: ['--timeout', 'abc'], env: {} }), /between 1 and 3600/);
  assert.throws(() => resolveConfig({ argv: ['--timeout', '3601'], env: {} }), /between 1 and 3600/);
  assert.throws(() => resolveConfig({ argv: ['--nope'], env: {} }), (err) => err instanceof ConfigError);
});

test('help and version flags are reported without requiring other config', () => {
  assert.equal(resolveConfig({ argv: ['--help'], env: {} }).help, true);
  assert.equal(resolveConfig({ argv: ['--version'], env: {} }).version, true);
  assert.match(usage(), /--api-key/);
  assert.match(usage(), /JOBFOUNDRY_API_KEY/);
});
```

- [ ] **Step 3: Run the config tests to verify they fail**

```bash
npm --workspace=server/mcp test
```

Expected: FAIL with `Cannot find module '../src/config.mjs'`.

- [ ] **Step 4: Implement version and config**

Create `server/mcp/src/version.mjs`:

```js
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const VERSION = pkg.version;
```

Create `server/mcp/src/config.mjs`:

```js
import { parseArgs } from 'node:util';
import { VERSION } from './version.mjs';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const DEFAULT_URL = 'http://127.0.0.1:8080';
const DEFAULT_TIMEOUT_SECONDS = 30;

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function usage() {
  return `Usage: jobfoundry-mcp [options]

stdio Model Context Protocol server for a local or hosted JobFoundry instance.

Options:
  --url <url>        JobFoundry API base URL (default: ${DEFAULT_URL})
                     Plain http:// is allowed only for loopback hosts.
  --api-key <key>    JobFoundry API key (env: JOBFOUNDRY_API_KEY)
  --timeout <secs>   Base request timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})
  --help             Show this help and exit
  --version          Show the package version and exit

Environment:
  JOBFOUNDRY_URL, JOBFOUNDRY_API_KEY, JOBFOUNDRY_TIMEOUT`;
}

function normalizeUrl(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) throw new ConfigError('JobFoundry URL must not be empty');

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ConfigError(`Invalid JobFoundry URL: ${trimmed}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ConfigError(`JobFoundry URL must use http or https, got ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new ConfigError('JobFoundry URL must not contain credentials');
  }
  if (url.search || url.hash) {
    throw new ConfigError('JobFoundry URL must not contain a query or fragment');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(host)) {
    throw new ConfigError(
      'Plain http:// is only allowed for loopback; use https:// for a remote JobFoundry server'
    );
  }

  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

function parseTimeout(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 3600) {
    throw new ConfigError('Timeout must be an integer between 1 and 3600 seconds');
  }
  return value;
}

export function resolveConfig({ argv = process.argv.slice(2), env = process.env } = {}) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        url: { type: 'string' },
        'api-key': { type: 'string' },
        timeout: { type: 'string' },
        help: { type: 'boolean', default: false },
        version: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    throw new ConfigError(err.message);
  }

  const { values } = parsed;
  const url = normalizeUrl(values.url ?? env.JOBFOUNDRY_URL ?? DEFAULT_URL);
  const apiKey = String(values['api-key'] ?? env.JOBFOUNDRY_API_KEY ?? '').trim();
  const timeoutMs =
    parseTimeout(values.timeout ?? env.JOBFOUNDRY_TIMEOUT ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

  return { help: values.help, version: values.version, url, apiKey, timeoutMs };
}

export { VERSION };
```

- [ ] **Step 5: Run the config tests to verify they pass**

```bash
npm --workspace=server/mcp test
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write server/mcp package.json package-lock.json
git add package.json package-lock.json server/mcp
git commit -m "feat(mcp): scaffold workspace and configuration"
```

---

### Task 2: Authenticated HTTP client

**Files:**
- Create: `server/mcp/src/client.mjs`
- Create: `server/mcp/test/client.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `class ApiError extends Error` with `status: number | null` and `body: string | null`
  - `class JobFoundryClient`
    - `constructor({ baseUrl, apiKey = '', timeoutMs = 30000, fetchImpl = fetch })`
    - `request(path, { method = 'GET', body, timeoutMs } = {}): Promise<object>`
    - `getActiveResume(): Promise<StatusEnvelope>`
    - `listJobs(params): Promise<{ jobs: object[] }>`
    - `getJob(id): Promise<{ job: object }>`
    - `tailorJob(id, { timeoutMs }): Promise<{ ok: boolean, tailored_resume_id: string, job: object }>`
    - `updateJobStatus(id, status): Promise<{ job: object }>`
    - `artifactUrl(id, filename): string`

- [ ] **Step 1: Write the failing client tests**

Create `server/mcp/test/client.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ApiError, JobFoundryClient } from '../src/client.mjs';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test('sends the bearer token and parses JSON', async (t) => {
  let seenAuthorization = null;
  const { server, url } = await startServer((req, res) => {
    seenAuthorization = req.headers.authorization;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ resume: { id: 'r1' } }));
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url, apiKey: 'secret-key' });
  const result = await client.getActiveResume();

  assert.deepEqual(result, { resume: { id: 'r1' } });
  assert.equal(seenAuthorization, 'Bearer secret-key');
});

test('omits the authorization header when no key is configured', async (t) => {
  let seenAuthorization = 'not-called';
  const { server, url } = await startServer((req, res) => {
    seenAuthorization = req.headers.authorization ?? null;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  t.after(() => server.close());

  await new JobFoundryClient({ baseUrl: url }).getActiveResume();
  assert.equal(seenAuthorization, null);
});

test('turns API error bodies into ApiError messages', async (t) => {
  const { server, url } = await startServer((req, res) => {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'No active master resume found' }));
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url });
  await assert.rejects(
    () => client.getJob('job-1'),
    (err) => err instanceof ApiError && err.status === 400 && /No active master resume/.test(err.message)
  );
});

test('handles non-JSON error responses without crashing', async (t) => {
  const { server, url } = await startServer((req, res) => {
    res.writeHead(502, { 'content-type': 'text/html' });
    res.end('<html>Bad gateway</html>');
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url });
  await assert.rejects(() => client.getJob('job-1'), /HTTP 502/);
});

test('reports timeouts as ApiError', async (t) => {
  const { server, url } = await startServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    }, 200);
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const client = new JobFoundryClient({ baseUrl: url, timeoutMs: 20 });
  await assert.rejects(() => client.getActiveResume(), /timed out/);
});

test('never follows redirects', async (t) => {
  let targetHit = false;
  const target = await startServer((req, res) => {
    targetHit = true;
    res.end('{}');
  });
  const source = await startServer((req, res) => {
    res.writeHead(302, { location: `${target.url}/stolen` });
    res.end();
  });
  t.after(() => {
    source.server.close();
    target.server.close();
  });

  const client = new JobFoundryClient({ baseUrl: source.url });
  await assert.rejects(() => client.getActiveResume(), /Could not reach JobFoundry/);
  assert.equal(targetHit, false);
});

test('builds query strings and encodes job ids', async (t) => {
  const paths = [];
  const { server, url } = await startServer((req, res) => {
    paths.push(req.url);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jobs: [], job: {} }));
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url });
  await client.listJobs({ status: 'new', company: 'Acme Corp', limit: 10, search: undefined });
  await client.getJob('job_1');

  assert.equal(paths[0], '/api/v1/jobs?status=new&company=Acme+Corp&limit=10');
  assert.equal(paths[1], '/api/v1/jobs/job_1');
});

test('applies per-call tailoring timeout and builds artifact URLs', async (t) => {
  const { server, url } = await startServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }, 80);
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const client = new JobFoundryClient({ baseUrl: url, timeoutMs: 10 });
  const result = await client.tailorJob('job-1', { timeoutMs: 1000 });
  assert.equal(result.ok, true);
  assert.equal(
    client.artifactUrl('job-1', 'resume.pdf'),
    `${url}/api/v1/jobs/job-1/artifacts/resume.pdf`
  );
});

test('reports unreachable servers as ApiError', async () => {
  const client = new JobFoundryClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 100 });
  await assert.rejects(() => client.getActiveResume(), /Could not reach JobFoundry/);
});
```

- [ ] **Step 2: Run the client tests to verify they fail**

```bash
npm --workspace=server/mcp test
```

Expected: FAIL with `Cannot find module '../src/client.mjs'`.

- [ ] **Step 3: Implement the client**

Create `server/mcp/src/client.mjs`:

```js
export class ApiError extends Error {
  constructor(message, { status = null, body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function encodeId(id) {
  return encodeURIComponent(String(id));
}

export class JobFoundryClient {
  constructor({ baseUrl, apiKey = '', timeoutMs = 30000, fetchImpl = fetch }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body, timeoutMs } = {}) {
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;
    const headers = { Accept: 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(effectiveTimeout),
      });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        const seconds = Math.round(effectiveTimeout / 1000);
        throw new ApiError(`Request to JobFoundry timed out after ${seconds}s`);
      }
      throw new ApiError(`Could not reach JobFoundry at ${this.baseUrl}: ${err.message}`);
    }

    const text = await response.text();
    let data = null;
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const message =
        data && typeof data.error === 'string'
          ? data.error
          : `JobFoundry API returned HTTP ${response.status}`;
      throw new ApiError(message, { status: response.status, body: text.slice(0, 500) });
    }

    if (text.trim() && data === null) {
      throw new ApiError('JobFoundry API returned a non-JSON response');
    }

    return data ?? {};
  }

  getActiveResume() {
    return this.request('/api/v1/resumes/active');
  }

  listJobs(params = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      query.set(key, String(value));
    }
    const qs = query.toString();
    return this.request(`/api/v1/jobs${qs ? `?${qs}` : ''}`);
  }

  getJob(id) {
    return this.request(`/api/v1/jobs/${encodeId(id)}`);
  }

  tailorJob(id, { timeoutMs } = {}) {
    return this.request(`/api/v1/jobs/${encodeId(id)}/tailor`, {
      method: 'POST',
      timeoutMs,
    });
  }

  updateJobStatus(id, status) {
    return this.request(`/api/v1/jobs/${encodeId(id)}`, {
      method: 'PATCH',
      body: { status },
    });
  }

  artifactUrl(id, filename) {
    return `${this.baseUrl}/api/v1/jobs/${encodeId(id)}/artifacts/${encodeURIComponent(filename)}`;
  }
}
```

- [ ] **Step 4: Run the client tests to verify they pass**

```bash
npm --workspace=server/mcp test
```

Expected: PASS, all config and client tests.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write server/mcp/src/client.mjs server/mcp/test/client.test.mjs
git add server/mcp/src/client.mjs server/mcp/test/client.test.mjs
git commit -m "feat(mcp): add authenticated API client"
```

---

### Task 3: Status normalization and job-data projection

**Files:**
- Create: `server/mcp/src/normalize.mjs`
- Create: `server/mcp/test/normalize.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CANONICAL_STATUSES: string[]`
  - `SEARCH_ONLY_STATUSES: string[]`
  - `normalizeStatus(value: unknown): string | null`
  - `normalizeSearchStatus(value: unknown): string | null`
  - `parseFitNotes(raw: unknown): { ok: boolean, value: object | null }`
  - `extractSkills(resume: object | null): string[]`
  - `summarizeExperience(resume: object | null): Array<{ position: string, company: string, startDate: string, endDate: string }>`
  - `summarizeJob(job: object): object`
  - `buildFitBreakdown(job: object): { scored: boolean, breakdown: object | null, error?: string, raw_fit_notes?: string | null }`

- [ ] **Step 1: Write the failing normalization tests**

Create `server/mcp/test/normalize.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFitBreakdown,
  extractSkills,
  normalizeSearchStatus,
  normalizeStatus,
  parseFitNotes,
  summarizeExperience,
  summarizeJob,
} from '../src/normalize.mjs';

test('normalizes aliases to canonical Kanban statuses', () => {
  assert.equal(normalizeStatus('discovered'), 'new');
  assert.equal(normalizeStatus('  INTERVIEWING '), 'interview');
  assert.equal(normalizeStatus('offered'), 'offer');
  assert.equal(normalizeStatus('declined'), 'rejected');
  assert.equal(normalizeStatus('closed'), 'archived');
  assert.equal(normalizeStatus('applied'), 'applied');
});

test('rejects unknown and internal failure statuses for updates', () => {
  assert.equal(normalizeStatus('nonsense'), null);
  assert.equal(normalizeStatus('score_failed'), null);
  assert.equal(normalizeStatus('tailor_failed'), null);
  assert.equal(normalizeStatus(null), null);
});

test('search statuses include internal failure states', () => {
  assert.equal(normalizeSearchStatus('score_failed'), 'score_failed');
  assert.equal(normalizeSearchStatus('discovered'), 'new');
  assert.equal(normalizeSearchStatus('nonsense'), null);
});

test('parses valid, error, malformed, and empty fit_notes', () => {
  assert.deepEqual(parseFitNotes('{"reasoning":"ok"}'), { ok: true, value: { reasoning: 'ok' } });
  assert.deepEqual(parseFitNotes('{"error":"boom"}'), { ok: true, value: { error: 'boom' } });
  assert.deepEqual(parseFitNotes('not-json'), { ok: false, value: null });
  assert.deepEqual(parseFitNotes(''), { ok: false, value: null });
  assert.deepEqual(parseFitNotes(null), { ok: false, value: null });
  assert.deepEqual(parseFitNotes({ reasoning: 'object' }), {
    ok: true,
    value: { reasoning: 'object' },
  });
});

test('builds a fit breakdown from stored scorer notes', () => {
  const result = buildFitBreakdown({
    fit_score: 82,
    fit_notes: JSON.stringify({
      reasoning: 'Strong backend match',
      matching_skills: ['Go', 'SQLite'],
      missing_skills: ['Rust'],
      is_valid_job: true,
      is_truncated: false,
    }),
  });
  assert.equal(result.scored, true);
  assert.equal(result.breakdown.reasoning, 'Strong backend match');
  assert.deepEqual(result.breakdown.matching_skills, ['Go', 'SQLite']);
  assert.deepEqual(result.breakdown.missing_skills, ['Rust']);
});

test('reports scorer errors and malformed notes without throwing', () => {
  const errored = buildFitBreakdown({
    fit_score: null,
    fit_notes: JSON.stringify({ error: 'LLM unavailable' }),
  });
  assert.equal(errored.scored, false);
  assert.equal(errored.error, 'LLM unavailable');

  const malformed = buildFitBreakdown({ fit_score: null, fit_notes: 'not-json' });
  assert.equal(malformed.scored, false);
  assert.equal(malformed.breakdown, null);
  assert.equal(malformed.raw_fit_notes, 'not-json');

  const unscored = buildFitBreakdown({ fit_score: null, fit_notes: null });
  assert.equal(unscored.scored, false);
  assert.equal(unscored.breakdown, null);
  assert.equal(unscored.raw_fit_notes, null);
});

test('flattens skills and projects work history', () => {
  const resume = {
    skills: [
      { name: 'Languages', keywords: ['TypeScript', 'Go'] },
      { name: 'Platform', keywords: ['SQLite', 'Go'] },
    ],
    work: [
      { name: 'Acme Corp', position: 'Staff Engineer', startDate: '2020-01-01' },
      { name: 'Beta Inc', position: 'Engineer', endDate: '2019-12-31' },
    ],
  };
  assert.deepEqual(extractSkills(resume), ['Go', 'SQLite', 'TypeScript']);
  assert.deepEqual(summarizeExperience(resume), [
    { position: 'Staff Engineer', company: 'Acme Corp', startDate: '2020-01-01', endDate: '' },
    { position: 'Engineer', company: 'Beta Inc', startDate: '', endDate: '2019-12-31' },
  ]);
});

test('summarizes a job without leaking fit_notes or description', () => {
  const summary = summarizeJob({
    id: 'j1',
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    source: 'greenhouse',
    url: 'https://example.com/j1',
    status: 'new',
    fit_score: 80,
    fit_notes: '{"secret":true}',
    description: 'Long text',
    liveness: 'live',
    posted_at: 1,
    created_at: 2,
    updated_at: 3,
  });
  assert.deepEqual(summary, {
    id: 'j1',
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    source: 'greenhouse',
    url: 'https://example.com/j1',
    status: 'new',
    fit_score: 80,
    liveness: 'live',
    posted_at: 1,
    created_at: 2,
    updated_at: 3,
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm --workspace=server/mcp test
```

Expected: FAIL with `Cannot find module '../src/normalize.mjs'`.

- [ ] **Step 3: Implement normalization**

Create `server/mcp/src/normalize.mjs`:

```js
export const CANONICAL_STATUSES = [
  'new',
  'saved',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived',
];

export const SEARCH_ONLY_STATUSES = [
  'score_failed',
  'tailor_failed',
  'failed',
  'error',
  'rejected_by_score',
  'invalid_job',
];

const STATUS_ALIASES = {
  discovered: 'new',
  bookmarked: 'saved',
  interviewing: 'interview',
  offered: 'offer',
  declined: 'rejected',
  closed: 'archived',
};

function canonicalize(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return STATUS_ALIASES[key] ?? key;
}

export function normalizeStatus(value) {
  const status = canonicalize(value);
  return CANONICAL_STATUSES.includes(status) ? status : null;
}

export function normalizeSearchStatus(value) {
  const status = canonicalize(value);
  if (CANONICAL_STATUSES.includes(status) || SEARCH_ONLY_STATUSES.includes(status)) {
    return status;
  }
  return null;
}

export function parseFitNotes(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: false, value: null };
  if (typeof raw === 'object') return { ok: true, value: raw };
  if (typeof raw !== 'string') return { ok: false, value: null };
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? { ok: true, value } : { ok: false, value: null };
  } catch {
    return { ok: false, value: null };
  }
}

export function extractSkills(resume) {
  const skills = new Set();
  for (const group of Array.isArray(resume?.skills) ? resume.skills : []) {
    for (const keyword of Array.isArray(group?.keywords) ? group.keywords : []) {
      if (typeof keyword === 'string' && keyword.trim()) skills.add(keyword.trim());
    }
  }
  return [...skills].sort((a, b) => a.localeCompare(b));
}

export function summarizeExperience(resume) {
  return (Array.isArray(resume?.work) ? resume.work : []).map((entry) => ({
    position: entry?.position ?? '',
    company: entry?.name ?? '',
    startDate: entry?.startDate ?? '',
    endDate: entry?.endDate ?? '',
  }));
}

export function summarizeJob(job) {
  return {
    id: job?.id ?? null,
    title: job?.title ?? '',
    company: job?.company ?? '',
    location: job?.location ?? null,
    source: job?.source ?? '',
    url: job?.url ?? '',
    status: job?.status ?? '',
    fit_score: job?.fit_score ?? null,
    liveness: job?.liveness ?? 'unknown',
    posted_at: job?.posted_at ?? null,
    created_at: job?.created_at ?? null,
    updated_at: job?.updated_at ?? null,
  };
}

export function buildFitBreakdown(job) {
  const score = job?.fit_score ?? null;
  const parsed = parseFitNotes(job?.fit_notes);
  if (!parsed.ok) {
    return {
      scored: score !== null,
      breakdown: null,
      raw_fit_notes: typeof job?.fit_notes === 'string' ? job.fit_notes : null,
    };
  }
  if (typeof parsed.value.error === 'string') {
    return { scored: false, error: parsed.value.error, breakdown: null };
  }
  return {
    scored: score !== null,
    breakdown: {
      reasoning: parsed.value.reasoning ?? '',
      matching_skills: Array.isArray(parsed.value.matching_skills)
        ? parsed.value.matching_skills
        : [],
      missing_skills: Array.isArray(parsed.value.missing_skills)
        ? parsed.value.missing_skills
        : [],
      is_valid_job: parsed.value.is_valid_job !== false,
      is_truncated: Boolean(parsed.value.is_truncated),
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm --workspace=server/mcp test
```

Expected: PASS, all config, client, and normalization tests.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write server/mcp/src/normalize.mjs server/mcp/test/normalize.test.mjs
git add server/mcp/src/normalize.mjs server/mcp/test/normalize.test.mjs
git commit -m "feat(mcp): normalize job statuses and fit data"
```

---

### Task 4: MCP server factory and the five tools

**Files:**
- Create: `server/mcp/src/tools.mjs`
- Create: `server/mcp/src/server.mjs`
- Create: `server/mcp/test/tools.test.mjs`

**Interfaces:**
- Consumes:
  - `JobFoundryClient` from `client.mjs` (Task 2)
  - normalizers from `normalize.mjs` (Task 3)
  - `VERSION` from `version.mjs` (Task 1)
- Produces:
  - `registerTools(server: McpServer, client: JobFoundryClient): void`
  - `createServer({ client, version = VERSION }): McpServer`

- [ ] **Step 1: Write the failing tool tests**

Create `server/mcp/test/tools.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.mjs';

const RESUME = {
  basics: { name: 'Alice Developer', email: 'alice@example.com' },
  skills: [
    { name: 'Languages', keywords: ['TypeScript', 'Go'] },
    { name: 'Platform', keywords: ['SQLite'] },
  ],
  work: [{ name: 'Tech Corp', position: 'Staff Engineer', startDate: '2020-01-01' }],
};

const JOB = {
  id: 'job_1',
  title: 'Staff Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  source: 'greenhouse',
  url: 'https://acme.example/j1',
  status: 'new',
  fit_score: 88,
  fit_notes: JSON.stringify({
    reasoning: 'Strong match',
    matching_skills: ['Go'],
    missing_skills: ['Rust'],
    is_valid_job: true,
    is_truncated: false,
  }),
  liveness: 'live',
  posted_at: 1,
  created_at: 2,
  updated_at: 3,
};

function fakeClient(overrides = {}) {
  const calls = [];
  return {
    calls,
    async getActiveResume() {
      return {
        resume: {
          id: 'res_1',
          title: 'Master Resume',
          isActive: true,
          created_at: 1,
          updated_at: 2,
          resume: RESUME,
        },
      };
    },
    async listJobs(params) {
      calls.push(['listJobs', params]);
      return { jobs: [JOB] };
    },
    async getJob(id) {
      calls.push(['getJob', id]);
      return { job: { ...JOB, id } };
    },
    async tailorJob(id, options) {
      calls.push(['tailorJob', id, options]);
      return { ok: true, tailored_resume_id: 'tailored-1', job: { ...JOB, id, status: 'tailored' } };
    },
    async updateJobStatus(id, status) {
      calls.push(['updateJobStatus', id, status]);
      return { job: { ...JOB, id, status } };
    },
    artifactUrl(id, filename) {
      return `https://api.test/api/v1/jobs/${id}/artifacts/${filename}`;
    },
    ...overrides,
  };
}

async function connect(clientImpl) {
  const server = createServer({ client: clientImpl, version: '0.0.0-test' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content.find((item) => item.type === 'text')?.text ?? '';
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  return { isError: Boolean(result.isError), data };
}

test('lists exactly the five required tools', async (t) => {
  const { server, client } = await connect(fakeClient());
  t.after(() => server.close());

  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    [
      'generate_tailored_resume',
      'get_job_fit_score',
      'get_profile',
      'search_saved_jobs',
      'update_application_status',
    ]
  );
  const readOnly = tools.filter((tool) => tool.annotations?.readOnlyHint).map((tool) => tool.name);
  assert.deepEqual(readOnly.sort(), ['get_job_fit_score', 'get_profile', 'search_saved_jobs']);
});

test('get_profile returns metadata, resume, skills, and experience', async (t) => {
  const { server, client } = await connect(fakeClient());
  t.after(() => server.close());

  const { isError, data } = await call(client, 'get_profile');
  assert.equal(isError, false);
  assert.equal(data.profile.title, 'Master Resume');
  assert.equal(data.profile.resume_json, undefined);
  assert.equal(data.resume.basics.name, 'Alice Developer');
  assert.deepEqual(data.skills, ['Go', 'SQLite', 'TypeScript']);
  assert.deepEqual(data.experience, [
    { position: 'Staff Engineer', company: 'Tech Corp', startDate: '2020-01-01', endDate: '' },
  ]);
});

test('get_profile handles a missing active resume without an error', async (t) => {
  const { server, client } = await connect(
    fakeClient({ async getActiveResume() { return { resume: null }; } })
  );
  t.after(() => server.close());

  const { isError, data } = await call(client, 'get_profile');
  assert.equal(isError, false);
  assert.equal(data.profile, null);
  assert.match(data.message, /master resume/i);
});

test('search_saved_jobs normalizes aliases and omits descriptions', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'search_saved_jobs', {
    status: 'discovered',
    company: 'Acme Corp',
    limit: 5,
  });
  assert.equal(isError, false);
  assert.equal(data.count, 1);
  assert.equal(data.jobs[0].description, undefined);
  const params = impl.calls.find(([name]) => name === 'listJobs')[1];
  assert.equal(params.status, 'new');
  assert.equal(params.company, 'Acme Corp');
  assert.equal(params.limit, 5);
});

test('search_saved_jobs rejects unknown statuses', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'search_saved_jobs', { status: 'nonsense' });
  assert.equal(isError, true);
  assert.match(data.message, /Unknown status/);
  assert.equal(impl.calls.length, 0);
});

test('get_job_fit_score returns breakdown and unscored states', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const scored = await call(client, 'get_job_fit_score', { job_id: 'job_1' });
  assert.equal(scored.isError, false);
  assert.equal(scored.data.scored, true);
  assert.equal(scored.data.breakdown.matching_skills[0], 'Go');
  assert.equal(scored.data.job.fit_notes, undefined);

  impl.getJob = async (id) => ({ job: { ...JOB, id, fit_score: null, fit_notes: null } });
  const unscored = await call(client, 'get_job_fit_score', { job_id: 'job_1' });
  assert.equal(unscored.data.scored, false);
  assert.match(unscored.data.message, /not been scored/i);
});

test('update_application_status accepts aliases and writes canonical values', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'update_application_status', {
    job_id: 'job_1',
    status: 'interviewing',
  });
  assert.equal(isError, false);
  assert.equal(data.status, 'interview');
  assert.deepEqual(impl.calls.at(-1), ['updateJobStatus', 'job_1', 'interview']);
});

test('update_application_status rejects internal failure stages', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  for (const status of ['score_failed', 'tailor_failed', 'nonsense']) {
    const { isError, data } = await call(client, 'update_application_status', {
      job_id: 'job_1',
      status,
    });
    assert.equal(isError, true);
    assert.match(data.message, /Unknown application status/);
  }
  assert.equal(impl.calls.length, 0);
});

test('generate_tailored_resume passes the timeout and returns artifact URLs', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'generate_tailored_resume', {
    job_id: 'job_1',
    timeout_seconds: 120,
  });
  assert.equal(isError, false);
  assert.equal(data.ok, true);
  assert.equal(data.tailored_resume_id, 'tailored-1');
  assert.equal(data.job.status, 'tailored');
  assert.equal(
    data.artifacts.pdf,
    'https://api.test/api/v1/jobs/job_1/artifacts/resume.pdf'
  );
  assert.deepEqual(impl.calls.at(-1), ['tailorJob', 'job_1', { timeoutMs: 120000 }]);
});

test('API failures become actionable tool errors', async (t) => {
  const impl = fakeClient({
    async tailorJob() {
      const error = new Error('No API key configured — go to Settings to add your LLM key.');
      throw error;
    },
  });
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'generate_tailored_resume', { job_id: 'job_1' });
  assert.equal(isError, true);
  assert.match(data.message, /No API key configured/);
});

test('maps 401 and timeout failures to actionable messages', async (t) => {
  const unauthorized = fakeClient({
    async getActiveResume() {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    },
  });
  const first = await connect(unauthorized);
  t.after(() => first.server.close());
  const denied = await call(first.client, 'get_profile');
  assert.equal(denied.isError, true);
  assert.match(denied.data.message, /JOBFOUNDRY_API_KEY/);

  const timedOut = fakeClient({
    async tailorJob() {
      throw new Error('Request to JobFoundry timed out after 900s');
    },
  });
  const second = await connect(timedOut);
  t.after(() => second.server.close());
  const timeout = await call(second.client, 'generate_tailored_resume', { job_id: 'job_1' });
  assert.equal(timeout.isError, true);
  assert.match(timeout.data.message, /timed out/);
});
```

- [ ] **Step 2: Run the tool tests to verify they fail**

```bash
npm --workspace=server/mcp test
```

Expected: FAIL with `Cannot find module '../src/server.mjs'`.

- [ ] **Step 3: Implement the tools and server factory**

Create `server/mcp/src/tools.mjs`:

```js
import { z } from 'zod';
import {
  buildFitBreakdown,
  extractSkills,
  normalizeSearchStatus,
  normalizeStatus,
  summarizeExperience,
  summarizeJob,
} from './normalize.mjs';

const JOB_ID = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/)
  .describe('JobFoundry job id (letters, digits, underscore, hyphen).');

const STATUS_LIST = 'new, saved, tailored, applied, interview, offer, rejected, archived';

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function toToolError(err) {
  if (err?.status === 401) {
    return errorResult(
      'JobFoundry rejected the API key (401). Set JOBFOUNDRY_API_KEY or pass --api-key.'
    );
  }
  return errorResult(err?.message || 'Unexpected error while calling JobFoundry');
}

export function registerTools(server, client) {
  server.registerTool(
    'get_profile',
    {
      title: 'Get profile',
      description:
        "Retrieve the user's active master resume, flattened skill inventory, and work history.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const { resume: active } = await client.getActiveResume();
        if (!active) {
          return textResult({
            profile: null,
            resume: null,
            skills: [],
            experience: [],
            message: 'No active master resume found. Upload one in the JobFoundry dashboard.',
          });
        }
        return textResult({
          profile: {
            id: active.id,
            title: active.title,
            isActive: active.isActive,
            created_at: active.created_at,
            updated_at: active.updated_at,
          },
          resume: active.resume,
          skills: extractSkills(active.resume),
          experience: summarizeExperience(active.resume),
        });
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'search_saved_jobs',
    {
      title: 'Search saved jobs',
      description:
        'Filter captured job postings by stage, company, source, minimum fit score, or text.',
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe(`Application stage. Canonical values: ${STATUS_LIST}.`),
        company: z.string().max(200).optional().describe('Exact company name, case-insensitive.'),
        source: z.string().max(100).optional().describe('Capture source, e.g. greenhouse.'),
        min_score: z.number().int().min(0).max(100).optional().describe('Minimum fit score.'),
        search: z.string().max(500).optional().describe('Text search across title, company, and JD.'),
        sort_by: z
          .enum(['fit_score', 'created_at', 'updated_at', 'title', 'company', 'status'])
          .default('updated_at'),
        order: z.enum(['asc', 'desc']).default('desc'),
        limit: z.number().int().min(1).max(200).default(25),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      let status;
      if (args.status !== undefined) {
        status = normalizeSearchStatus(args.status);
        if (!status) {
          return errorResult(`Unknown status "${args.status}". Use one of: ${STATUS_LIST}.`);
        }
      }
      try {
        const { jobs } = await client.listJobs({
          status,
          company: args.company?.trim() || undefined,
          source: args.source?.trim() || undefined,
          min_score: args.min_score,
          search: args.search?.trim() || undefined,
          sort_by: args.sort_by,
          order: args.order,
          limit: args.limit,
        });
        return textResult({ count: jobs.length, jobs: jobs.map(summarizeJob) });
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'get_job_fit_score',
    {
      title: 'Get job fit score',
      description: 'Retrieve fit score details, strengths, and gap analysis for a saved job.',
      inputSchema: { job_id: JOB_ID },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      try {
        const { job } = await client.getJob(args.job_id);
        const fit = buildFitBreakdown(job);
        const payload = { scored: fit.scored, job: summarizeJob(job) };
        if (fit.error) payload.error = fit.error;
        if (fit.breakdown) payload.breakdown = fit.breakdown;
        if (fit.raw_fit_notes) payload.raw_fit_notes = fit.raw_fit_notes;
        if (!fit.scored && !fit.error) {
          payload.message = 'This job has not been scored yet. Trigger scoring in the dashboard.';
        }
        return textResult(payload);
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'generate_tailored_resume',
    {
      title: 'Generate tailored resume',
      description:
        'Run the truthful tailoring pipeline for a saved job and return artifact URLs. This can take several minutes.',
      inputSchema: {
        job_id: JOB_ID,
        timeout_seconds: z.number().int().min(30).max(1800).default(900),
      },
      annotations: { openWorldHint: false },
    },
    async (args) => {
      try {
        const result = await client.tailorJob(args.job_id, {
          timeoutMs: args.timeout_seconds * 1000,
        });
        return textResult({
          ok: true,
          tailored_resume_id: result.tailored_resume_id,
          job: summarizeJob(result.job),
          artifacts: {
            pdf: client.artifactUrl(args.job_id, 'resume.pdf'),
            json: client.artifactUrl(args.job_id, 'resume.json'),
            markdown: client.artifactUrl(args.job_id, 'resume.md'),
            plaintext: client.artifactUrl(args.job_id, 'resume.txt'),
          },
        });
      } catch (err) {
        return toToolError(err);
      }
    }
  );

  server.registerTool(
    'update_application_status',
    {
      title: 'Update application status',
      description:
        'Move an application across Kanban stages. Accepts canonical stages and common aliases.',
      inputSchema: {
        job_id: JOB_ID,
        status: z
          .string()
          .describe(`Stage to set. Canonical values: ${STATUS_LIST}. Aliases: discovered, interviewing, offered, declined, closed.`),
      },
      annotations: { idempotentHint: true },
    },
    async (args) => {
      const status = normalizeStatus(args.status);
      if (!status) {
        return errorResult(
          `Unknown application status "${args.status}". Use one of: ${STATUS_LIST}.`
        );
      }
      try {
        const { job } = await client.updateJobStatus(args.job_id, status);
        return textResult({ ok: true, job_id: args.job_id, status, job: summarizeJob(job) });
      } catch (err) {
        return toToolError(err);
      }
    }
  );
}
```

Create `server/mcp/src/server.mjs`:

```js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VERSION } from './version.mjs';
import { registerTools } from './tools.mjs';

export function createServer({ client, version = VERSION } = {}) {
  const server = new McpServer({ name: 'jobfoundry', version });
  registerTools(server, client);
  return server;
}
```

- [ ] **Step 4: Run the tool tests to verify they pass**

```bash
npm --workspace=server/mcp test
```

Expected: PASS, all suites.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write server/mcp/src/tools.mjs server/mcp/src/server.mjs server/mcp/test/tools.test.mjs
git add server/mcp/src/tools.mjs server/mcp/src/server.mjs server/mcp/test/tools.test.mjs
git commit -m "feat(mcp): expose profile, search, fit, tailor, and status tools"
```

---

### Task 5: CLI entry point over stdio

**Files:**
- Create: `server/mcp/src/index.mjs`
- Create: `server/mcp/test/cli.test.mjs`

**Interfaces:**
- Consumes:
  - `resolveConfig`, `usage`, `ConfigError`, `VERSION` (Task 1)
  - `JobFoundryClient` (Task 2)
  - `createServer` (Task 4)
- Produces: executable `src/index.mjs` with a `#!/usr/bin/env node` shebang.

- [ ] **Step 1: Write the failing CLI tests**

Create `server/mcp/test/cli.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const ENTRY = resolve(import.meta.dirname, '../src/index.mjs');

test('--help prints usage and exits 0', async () => {
  const { stdout } = await execFileAsync(process.execPath, [ENTRY, '--help']);
  assert.match(stdout, /Usage: jobfoundry-mcp/);
  assert.match(stdout, /JOBFOUNDRY_API_KEY/);
});

test('--version prints the package version and exits 0', async () => {
  const { stdout } = await execFileAsync(process.execPath, [ENTRY, '--version']);
  assert.equal(stdout.trim(), '0.1.0');
});

test('invalid remote http URL exits with code 2 and a clear stderr message', async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [ENTRY, '--url', 'http://api.example.com']),
    (err) => {
      assert.equal(err.code, 2);
      assert.match(err.stderr, /https:\/\//);
      return true;
    }
  );
});

test('unknown flags exit with code 2', async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [ENTRY, '--nope']),
    (err) => {
      assert.equal(err.code, 2);
      assert.match(err.stderr, /jobfoundry-mcp:/);
      return true;
    }
  );
});
```

- [ ] **Step 2: Run the CLI tests to verify they fail**

```bash
npm --workspace=server/mcp test
```

Expected: FAIL with `Cannot find module .../src/index.mjs`.

- [ ] **Step 3: Implement the entry point**

Create `server/mcp/src/index.mjs`:

```js
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { VERSION, ConfigError, resolveConfig, usage } from './config.mjs';
import { JobFoundryClient } from './client.mjs';
import { createServer } from './server.mjs';

async function main() {
  let config;
  try {
    config = resolveConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`jobfoundry-mcp: ${err.message}\n\n${usage()}`);
      process.exit(2);
    }
    throw err;
  }

  if (config.help) {
    console.log(usage());
    return;
  }
  if (config.version) {
    console.log(VERSION);
    return;
  }

  const client = new JobFoundryClient({
    baseUrl: config.url,
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
  });
  const server = createServer({ client });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`jobfoundry-mcp: ${err.message}`);
  process.exit(1);
});
```

Make it executable:

```bash
chmod +x server/mcp/src/index.mjs
```

- [ ] **Step 4: Run the CLI tests to verify they pass**

```bash
npm --workspace=server/mcp test
```

Expected: PASS, all suites including `--help`, `--version`, and config failures.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write server/mcp/src/index.mjs server/mcp/test/cli.test.mjs
git add server/mcp/src/index.mjs server/mcp/test/cli.test.mjs
git update-index --chmod=+x server/mcp/src/index.mjs
git commit -m "feat(mcp): add stdio CLI entry point"
```

---

### Task 6: Optional `company` filter on the ingest API

**Files:**
- Modify: `server/ingest/src/app.mjs` (query destructuring around line 1179 and filters around line 1214)
- Test: `server/ingest/test/ingest.test.mjs` (add one test after the sort test)

**Interfaces:**
- Consumes: existing `GET /api/v1/jobs`.
- Produces: `GET /api/v1/jobs?company=<name>` filters case-insensitively in both multi-tenant and legacy modes.

- [ ] **Step 1: Write the failing ingest test**

Add this test to `server/ingest/test/ingest.test.mjs` immediately after the existing `GET /api/v1/jobs supports sort_by and order query parameters` test:

```js
test('GET /api/v1/jobs filters by company case-insensitively', async () => {
  const { app, db } = makeApp();
  const now = Date.now();
  const insert = db.prepare(
    'INSERT INTO jobs (id, title, company, url, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insert.run('jc1', 'Engineer', 'Acme Corp', 'https://example.com/c1', 'test', now, now);
  insert.run('jc2', 'Engineer', 'Beta Inc', 'https://example.com/c2', 'test', now, now);

  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/jobs?company=acme%20corp',
    headers: { authorization: 'Bearer testkey' },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.json().jobs.map((job) => job.id),
    ['jc1']
  );

  await app.close();
});
```

- [ ] **Step 2: Run the ingest test to verify it fails**

```bash
npm --workspace=server/ingest test
```

Expected: FAIL — the unfiltered response includes both `jc1` and `jc2`.

- [ ] **Step 3: Implement the filter**

In `server/ingest/src/app.mjs`, add `company` to the query destructuring:

```js
    const {
      status,
      source,
      company,
      min_score,
      search,
      sort_by = 'created_at',
      order = 'desc',
      limit = 100,
    } = request.query || {};
```

Add this block after the `source` filter and before the `min_score` filter:

```js
    if (company && String(company).trim()) {
      query += isMultiTenant ? ' AND j.company = ? COLLATE NOCASE' : ' AND company = ? COLLATE NOCASE';
      params.push(String(company).trim());
    }
```

- [ ] **Step 4: Run the ingest test suite to verify it passes**

```bash
npm --workspace=server/ingest test
```

Expected: PASS, including the new company filter test.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write server/ingest/src/app.mjs server/ingest/test/ingest.test.mjs
git add server/ingest/src/app.mjs server/ingest/test/ingest.test.mjs
git commit -m "feat(ingest): add company filter to job listing API"
```

---

### Task 7: Stdio end-to-end test against a temporary SQLite database

**Files:**
- Create: `server/mcp/test/mcp.test.mjs`

**Interfaces:**
- Consumes:
  - `openDb` and `buildApp` from `server/ingest`
  - `Client` and `StdioClientTransport` from the MCP SDK
  - the executable entry point from Task 5
  - the company filter from Task 6
- Produces: a single E2E test covering all five tools over real stdio.

- [ ] **Step 1: Write the end-to-end test**

Create `server/mcp/test/mcp.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { openDb } from '../../ingest/src/db/index.mjs';
import { buildApp } from '../../ingest/src/app.mjs';

const RESUME = {
  basics: {
    name: 'Alice Developer',
    label: 'Staff Engineer',
    email: 'alice@example.com',
    summary: 'Distributed systems engineer.',
  },
  skills: [
    { name: 'Languages', keywords: ['Go', 'TypeScript'] },
    { name: 'Platform', keywords: ['SQLite', 'Kubernetes'] },
  ],
  work: [
    {
      name: 'Tech Corp',
      position: 'Staff Engineer',
      startDate: '2020-01-01',
      highlights: ['Scaled streaming platform'],
    },
  ],
};

const JOB_A = {
  title: 'Staff Platform Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  url: 'https://acme.example/jobs/1',
  source: 'greenhouse',
  postedAt: '2026-11-01T00:00:00Z',
  description:
    'We need a Staff Platform Engineer with Go, TypeScript, SQLite, and Kubernetes experience.',
};

const JOB_B = {
  title: 'Backend Engineer',
  company: 'Beta Inc',
  location: 'Berlin, DE',
  url: 'https://beta.example/jobs/2',
  source: 'lever',
  postedAt: '2026-11-02T00:00:00Z',
  description: 'Backend role focused on Rust, Kafka, and distributed systems.',
};

function textOf(result) {
  return result.content.find((item) => item.type === 'text')?.text ?? '';
}

test('MCP stdio server executes all five tools against a temp SQLite database', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jobfoundry-mcp-e2e-'));
  const artifactsDir = join(tmpDir, 'artifacts');
  const db = openDb({ path: join(tmpDir, 'jobfoundry.db') });

  const tailorServer = createHttpServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/v1/tailor') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          pdf_base64: Buffer.from('%PDF-1.4\n% JobFoundry MCP test\n').toString('base64'),
          plain_text: 'TAILORED PLAIN TEXT',
          resume: payload.resume,
        })
      );
    });
  });
  await new Promise((resolveListen) => tailorServer.listen(0, '127.0.0.1', resolveListen));
  const previousTailorPort = process.env.TAILOR_PORT;
  process.env.TAILOR_PORT = String(tailorServer.address().port);

  const app = buildApp({
    db,
    apiKeys: [],
    artifactsDir,
    logger: false,
  });
  const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

  const client = new Client({ name: 'jobfoundry-mcp-e2e', version: '0.0.0' });

  t.after(async () => {
    await client.close().catch(() => {});
    await app.close();
    await new Promise((resolveClose) => tailorServer.close(resolveClose));
    db.close();
    if (previousTailorPort === undefined) delete process.env.TAILOR_PORT;
    else process.env.TAILOR_PORT = previousTailorPort;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Register a real user: the MCP server authenticates with that user's API key,
  // exactly as a dashboard user would copy it from Settings.
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'alice@example.com', password: 'password123', name: 'Alice Developer' },
  });
  assert.equal(registerRes.statusCode, 201);
  const registered = registerRes.json();
  const apiKey = registered.user.apiKey;
  const userId = registered.user.id;
  const auth = { authorization: `Bearer ${apiKey}` };

  // A registered user must supply their own LLM key before tailoring runs.
  db.prepare('INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)').run(
    userId,
    'default_llm_api_key',
    'test-llm-key',
    Date.now()
  );

  const resumeRes = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes',
    headers: auth,
    payload: { title: 'Master Resume', resumeJson: RESUME, setActive: true },
  });
  assert.equal(resumeRes.statusCode, 201);

  const ingestRes = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: auth,
    payload: [JOB_A, JOB_B],
  });
  assert.equal(ingestRes.statusCode, 200);
  const [jobA, jobB] = ingestRes.json().ids;

  db.prepare(
    'UPDATE user_jobs SET fit_score = ?, fit_notes = ? WHERE user_id = ? AND job_id = ?'
  ).run(
    88,
    JSON.stringify({
      reasoning: 'Strong platform match',
      matching_skills: ['Go', 'SQLite'],
      missing_skills: ['Kubernetes operators'],
      is_valid_job: true,
      is_truncated: false,
    }),
    userId,
    jobA
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(import.meta.dirname, '../src/index.mjs')],
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)),
      JOBFOUNDRY_URL: baseUrl,
      JOBFOUNDRY_API_KEY: apiKey,
    },
    stderr: 'pipe',
  });
  await client.connect(transport);

  const list = await client.listTools();
  assert.deepEqual(
    list.tools.map((tool) => tool.name).sort(),
    [
      'generate_tailored_resume',
      'get_job_fit_score',
      'get_profile',
      'search_saved_jobs',
      'update_application_status',
    ]
  );

  const profile = JSON.parse(textOf(await client.callTool({ name: 'get_profile', arguments: {} })));
  assert.equal(profile.resume.basics.name, 'Alice Developer');
  assert.deepEqual(profile.skills, ['Go', 'Kubernetes', 'SQLite', 'TypeScript']);

  const search = JSON.parse(
    textOf(
      await client.callTool({
        name: 'search_saved_jobs',
        arguments: { status: 'discovered', company: 'acme corp' },
      })
    )
  );
  assert.equal(search.count, 1);
  assert.equal(search.jobs[0].id, jobA);

  const badSearch = await client.callTool({
    name: 'search_saved_jobs',
    arguments: { status: 'nonsense' },
  });
  assert.equal(badSearch.isError, true);

  const fit = JSON.parse(
    textOf(await client.callTool({ name: 'get_job_fit_score', arguments: { job_id: jobA } }))
  );
  assert.equal(fit.scored, true);
  assert.equal(fit.breakdown.reasoning, 'Strong platform match');
  assert.deepEqual(fit.breakdown.matching_skills, ['Go', 'SQLite']);

  const applied = JSON.parse(
    textOf(
      await client.callTool({
        name: 'update_application_status',
        arguments: { job_id: jobB, status: 'interviewing' },
      })
    )
  );
  assert.equal(applied.status, 'interview');
  assert.equal(
    db.prepare('SELECT status FROM user_jobs WHERE user_id = ? AND job_id = ?').get(userId, jobB)
      .status,
    'interview'
  );

  const badUpdate = await client.callTool({
    name: 'update_application_status',
    arguments: { job_id: jobB, status: 'score_failed' },
  });
  assert.equal(badUpdate.isError, true);
  assert.equal(
    db.prepare('SELECT status FROM user_jobs WHERE user_id = ? AND job_id = ?').get(userId, jobB)
      .status,
    'interview'
  );

  const tailored = JSON.parse(
    textOf(
      await client.callTool({
        name: 'generate_tailored_resume',
        arguments: { job_id: jobA, timeout_seconds: 60 },
      })
    )
  );
  assert.equal(tailored.ok, true);
  assert.match(tailored.tailored_resume_id, /^tailored-/);
  assert.equal(tailored.job.status, 'tailored');

  const artifactDir = join(artifactsDir, userId, jobA);
  assert.ok(existsSync(join(artifactDir, 'resume.json')));
  assert.ok(existsSync(join(artifactDir, 'resume.txt')));
  const pdf = readFileSync(join(artifactDir, 'resume.pdf'));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});
```

- [ ] **Step 2: Run the MCP test suite**

```bash
npm --workspace=server/mcp test
```

Expected: this is an integration check, so it may pass immediately once Tasks 1–6 are complete. A failure identifies a real integration defect in those tasks; do not proceed until the cause is understood.

- [ ] **Step 3: Run the E2E test and fix defects in the owning task**

```bash
npm --workspace=server/mcp test
```

If it fails, fix the defect in the task that owns the behavior (Tasks 1–6), never by weakening an assertion. The concrete checks are:

- `POST /api/v1/auth/register` must return 201 and yield a user id plus API key. `user_resumes` has a foreign key to `users`, so a legacy pre-shared key cannot own a master resume; the test authenticates as a registered user, exactly like a dashboard user who copies the key from Settings.
- `POST /api/v1/resumes` must return 201. If it returns 400, the `RESUME` fixture failed `validateResumeJson`; correct the fixture until it passes the JSON Resume schema.
- Tailoring must not fail with "No API key configured". A registered user is BYOK, so the test inserts a `default_llm_api_key` row into `user_settings` for that user before calling the tool.
- The child process must resolve `@modelcontextprotocol/sdk`. Run the suite through `npm --workspace=server/mcp test` so resolution starts at the repo root.
- The tailor call must reach the mock. `process.env.TAILOR_PORT` is set before `buildApp` and before the tool call; if it is not, move the assignment above both.
- Artifacts must land under `<artifactsDir>/<userId>/<jobA>/`. If the path differs, print the tailored job response and correct the assertion path while keeping the `%PDF-` magic-byte check.
- Per-user stage changes live in `user_jobs`, so assert against `SELECT status FROM user_jobs WHERE user_id = ? AND job_id = ?`.

- [ ] **Step 4: Run the MCP test suite to verify it passes**

```bash
npm --workspace=server/mcp test
```

Expected: PASS, including the E2E test.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write server/mcp/test/mcp.test.mjs
git add server/mcp/test/mcp.test.mjs
git commit -m "test(mcp): add stdio end-to-end coverage"
```

---

### Task 8: Documentation

**Files:**
- Create: `docs/mcp.md`
- Create: `server/mcp/README.md`
- Modify: `README.md` (add a section after “How It Works”)

**Interfaces:**
- Consumes: the configuration, tool, and timeout behavior from Tasks 1–5.
- Produces: user-facing connection instructions for Claude Desktop and Cursor.

- [ ] **Step 1: Write the user guide**

Create `docs/mcp.md`:

```markdown
# Use JobFoundry from Claude Desktop or Cursor

JobFoundry ships a stdio [Model Context Protocol](https://modelcontextprotocol.io)
server. It lets Claude Desktop, Cursor, and local agentic CLIs read your captured
jobs, fit scores, and master resume, and trigger tailoring or stage changes —
without a second copy of your data.

The MCP server is a thin client of your JobFoundry API. It opens no database and
never holds LLM provider keys.

## Prerequisites

- Node.js 26 or newer.
- A running JobFoundry instance (local container or self-hosted).
- Your JobFoundry API key. Open the dashboard, go to **Settings**, and copy the
  API key. Self-hosted operators using `API_KEYS` can use one of those values.

## Install

The MCP server lives in this repository and is installed with the root
workspace:

```bash
npm ci
```

It is not published to npm. Use an absolute path when configuring a client.

## Configure Claude Desktop

Edit the Claude Desktop configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jobfoundry": {
      "command": "node",
      "args": ["/absolute/path/to/JobFoundry/server/mcp/src/index.mjs"],
      "env": {
        "JOBFOUNDRY_URL": "http://127.0.0.1:8080",
        "JOBFOUNDRY_API_KEY": "your-jobfoundry-api-key"
      }
    }
  }
}
```

Restart Claude Desktop. The five JobFoundry tools appear in the tools menu.

## Configure Cursor

Add the same block to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json`
(project):

```json
{
  "mcpServers": {
    "jobfoundry": {
      "command": "node",
      "args": ["/absolute/path/to/JobFoundry/server/mcp/src/index.mjs"],
      "env": {
        "JOBFOUNDRY_URL": "http://127.0.0.1:8080",
        "JOBFOUNDRY_API_KEY": "your-jobfoundry-api-key"
      }
    }
  }
}
```

## Configuration

CLI flags override environment variables.

| Flag | Environment variable | Default | Notes |
| --- | --- | --- | --- |
| `--url <url>` | `JOBFOUNDRY_URL` | `http://127.0.0.1:8080` | Plain `http://` only for `127.0.0.1`, `::1`, or `localhost` |
| `--api-key <key>` | `JOBFOUNDRY_API_KEY` | none | Sent as a bearer token |
| `--timeout <seconds>` | `JOBFOUNDRY_TIMEOUT` | `30` | Base HTTP timeout; tailoring has its own |
| `--help` | — | — | Print usage |
| `--version` | — | — | Print the version |

## Tools

### `get_profile`

Returns your active master resume, a flattened skill list, and a compact work
history.

### `search_saved_jobs`

Filters saved postings by stage, company, source, minimum fit score, or text.
Stages accept canonical Kanban values (`new`, `saved`, `tailored`, `applied`,
`interview`, `offer`, `rejected`, `archived`) and the aliases `discovered`,
`interviewing`, `offered`, `declined`, and `closed`.

Tags are not supported because JobFoundry does not store tags.

### `get_job_fit_score`

Returns the 0–100 score plus the scorer's reasoning, matching skills, and gap
analysis for one job.

### `generate_tailored_resume`

Runs the truthful tailoring pipeline and returns links to the PDF, JSON Resume,
Markdown, and ATS plaintext artifacts. `timeout_seconds` defaults to 900 and is
capped at 1800.

Clients with a shorter tool timeout will cut the call off. The job remains on the
server and its status becomes `tailored` or `failed`; re-run the tool or check
the dashboard. `resume.pdf`, `resume.json`, and `resume.txt` are guaranteed on
success; `resume.md` is best-effort.

### `update_application_status`

Moves an application across Kanban stages and returns the canonical stage.

## Hosted JobFoundry

Point the server at any HTTPS deployment:

```json
"env": {
  "JOBFOUNDRY_URL": "https://jobfoundry.example.com",
  "JOBFOUNDRY_API_KEY": "your-api-key"
}
```

Remote URLs must use HTTPS; the server refuses to send an API key over plain
HTTP to a non-loopback host. A hosted MCP endpoint is not part of this release —
this process always runs locally over stdio.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `401` / "JobFoundry rejected the API key" | Copy the key from Settings and set `JOBFOUNDRY_API_KEY` |
| "Could not reach JobFoundry" | Start the container and confirm `JOBFOUNDRY_URL` |
| "No active master resume found" | Upload a master resume in the dashboard |
| Tailoring fails with "No API key configured" | Add an LLM key in Settings |
| Tailoring times out in the client | Raise the client timeout or pass a smaller `timeout_seconds` only if the pipeline usually finishes faster |

## Security

- The MCP server stores no data and opens no database.
- It only knows your JobFoundry API key, never your LLM provider key.
- It never scrapes job boards.
- HTTPS is enforced for remote URLs so the API key is never sent in plaintext.
```

- [ ] **Step 2: Write the package README**

Create `server/mcp/README.md`:

```markdown
# JobFoundry MCP server

A stdio [Model Context Protocol](https://modelcontextprotocol.io) server that
exposes the running JobFoundry API to Claude Desktop, Cursor, and local agentic
CLIs.

It provides five tools: `get_profile`, `search_saved_jobs`,
`get_job_fit_score`, `generate_tailored_resume`, and
`update_application_status`.

## Quick start

```bash
npm ci
node server/mcp/src/index.mjs --help
```

Configure your client with an absolute path and the API key:

```json
{
  "mcpServers": {
    "jobfoundry": {
      "command": "node",
      "args": ["/absolute/path/to/JobFoundry/server/mcp/src/index.mjs"],
      "env": {
        "JOBFOUNDRY_URL": "http://127.0.0.1:8080",
        "JOBFOUNDRY_API_KEY": "your-api-key"
      }
    }
  }
}
```

Full setup, tool reference, hosted-backend instructions, and troubleshooting:
[docs/mcp.md](../../docs/mcp.md).

## Development

```bash
npm --workspace=server/mcp test
```

The suite includes a real stdio end-to-end test that boots the ingest API on a
temporary SQLite database and a mock tailor service.
```

- [ ] **Step 3: Link the guide from the root README**

In `README.md`, after the “How It Works” numbered list and before the
“Built in a real job search” heading, add:

```markdown
---

## Use from Claude Desktop or Cursor

JobFoundry includes a stdio **Model Context Protocol** server, so you can query
your saved jobs, fit scores, master resume, and Kanban stages from Claude
Desktop, Cursor, or a local agentic CLI. It talks only to your local or
self-hosted JobFoundry API; it opens no database and never sees your LLM keys.

See [docs/mcp.md](docs/mcp.md) for setup and the tool reference.
```

- [ ] **Step 4: Check formatting and links**

```bash
npx prettier --check README.md docs/mcp.md server/mcp/README.md
```

Expected: PASS. If Prettier rewrites the files, re-run the check.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/mcp.md server/mcp/README.md
git commit -m "docs(mcp): document Claude Desktop and Cursor setup"
```

---

### Task 9: Root test wiring and full verification

**Files:**
- Modify: `package.json` (root `test` script)

**Interfaces:**
- Consumes: the `server/mcp` test script from Task 1.
- Produces: `npm test` runs the MCP suite in CI.

- [ ] **Step 1: Wire the MCP suite into the root test command**

Modify the root `package.json` scripts:

```json
  "scripts": {
    "site:dev": "npm --workspace=site run dev",
    "site:build": "npm --workspace=site run build",
    "test": "npm run check:meta && node --test test/*.test.mjs && npm --workspace=server/mcp test",
    "check:meta": "node scripts/check-meta.mjs",
    "eval:prompt": "npx promptfoo eval --config server/scorer/evals/promptfooconfig.yaml",
    "eval:view": "npx promptfoo view",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
```

- [ ] **Step 2: Run the root test suite**

```bash
npm test
```

Expected: PASS — metadata checks, root integration tests, and the MCP suite.

- [ ] **Step 3: Run the ingest suite**

```bash
npm --workspace=server/ingest test
```

Expected: PASS, including the new company filter test.

- [ ] **Step 4: Run lint and formatting checks**

```bash
npm run lint
npm run format:check
```

Expected: both exit 0. Fix any reported file with `npx prettier --write <file>` or the relevant ESLint fix, then re-run both.

- [ ] **Step 5: Verify the manual CLI surface**

```bash
node server/mcp/src/index.mjs --help
node server/mcp/src/index.mjs --version
```

Expected: usage text and `0.1.0`.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "test: run MCP suite from root test command"
```

---

### Task 10: Final review

**Files:**
- No new files.

- [ ] **Step 1: Inspect the full branch diff**

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

Expected: only the MCP workspace, the company filter, the root wiring, the docs, and the spec/plan files. No changes to scoring, tailoring, or extension code.

- [ ] **Step 2: Re-run the verification commands**

```bash
npm test
npm --workspace=server/ingest test
npm run lint
npm run format:check
```

Expected: all pass.

- [ ] **Step 3: Confirm acceptance criteria**

- `server/mcp` uses `StdioServerTransport`.
- `tools/list` returns exactly the five required tools.
- The E2E test invokes all five over stdio against a temp SQLite database.
- `docs/mcp.md` documents Claude Desktop and Cursor.
- `JOBFOUNDRY_URL` accepts an HTTPS hosted backend and rejects plain HTTP off-loopback.
