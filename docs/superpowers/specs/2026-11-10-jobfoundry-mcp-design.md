# JobFoundry MCP Server — Design

- **Date:** 2026-11-10
- **Issue:** [#121](https://github.com/Covai-Labs/JobFoundry/issues/121)
- **Status:** Draft for review
- **Scope owner:** JobFoundry maintainers

## 1. Problem

JobFoundry holds high-signal local career data: captured postings, fit scores,
truthful resumes, and Kanban state. Users of Claude Desktop, Cursor, and local
agentic CLIs cannot query or act on that data without switching tools.

We will expose JobFoundry through a stdio Model Context Protocol (MCP) server so
external AI tools can read and manage the user's own career data.

## 2. Goals

1. Provide a stdio MCP server with five tools: `get_profile`,
   `search_saved_jobs`, `get_job_fit_score`, `generate_tailored_resume`, and
   `update_application_status`.
2. Reuse the existing ingest API for authentication, multi-tenancy, BYOK key
   selection, scoring state, and tailoring orchestration. Do not duplicate
   business logic.
3. Keep the MCP process credential-light: it holds only the user's JobFoundry
   API key, never LLM provider keys.
4. Work against a local instance today and a hosted HTTPS backend later without
   changing the tool surface.
5. Ship an end-to-end test that invokes every tool over real stdio against a
   temporary SQLite database.

## 3. Non-goals

- No direct SQLite access from the MCP process.
- No new scraping, fetching, or liveness checks. The no-backend-scraping
  invariant in `ARCHITECTURE.md` still applies.
- No auto-submission of applications.
- No hosted MCP (Streamable HTTP) transport, OAuth flow, or async tailoring job
  queue in this issue. Section 10 defines the seams for those follow-ups.
- No tag support. The schema has no tags field; see Decision D5.
- No changes to the tailoring or scoring algorithms.

## 4. Decisions

| ID  | Decision | Rationale |
| --- | -------- | --------- |
| D1 | MCP server is a thin HTTP adapter to the ingest API. | Reuses auth, tenancy, BYOK, and orchestration; avoids schema coupling and divergence. |
| D2 | `generate_tailored_resume` is synchronous with a configurable timeout (default 900 s, max 1800 s). | Matches the existing API; async work is deferred until a real client/proxy limit is demonstrated. |
| D3 | Application stages accept canonical Kanban values plus conservative aliases; responses always use canonical values. | Keeps Kanban state consistent while matching the issue's vocabulary. |
| D4 | `search_saved_jobs` exposes the existing filters plus a new optional `company` query parameter. Tags are omitted. | Company filtering should not rely on full-text noise; tags do not exist. |
| D5 | Configuration comes from CLI flags overriding environment variables. | Works in Claude Desktop/Cursor `env` blocks and in shell usage. |
| D6 | Use `@modelcontextprotocol/sdk` for MCP and `zod` for input schemas. Use Node built-ins for HTTP and argument parsing. | Two well-maintained dependencies instead of hand-rolled protocol code or extra CLI/HTTP libraries. |
| D7 | Require `https://` for non-loopback API URLs. | A bearer API key must never travel in plaintext to a remote/SaaS host. |
| D8 | Keep tool registration transport-agnostic. | Allows Streamable HTTP hosting later without rewriting handlers. |

## 5. Architecture

```
Claude Desktop / Cursor / CLI
            │  MCP over stdio (JSON-RPC)
            ▼
  jobfoundry-mcp process
  ├── config.mjs      flags + env, URL/key validation
  ├── client.mjs      fetch wrapper (bearer, timeout, redirect: error)
  ├── tools.mjs       five tool schemas + handlers
  └── server.mjs      McpServer factory (transport-agnostic)
            │  HTTPS/HTTP REST + Bearer API key
            ▼
  JobFoundry ingest API (:8080)
  ├── auth + user scoping (jobs / user_jobs)
  ├── resume storage
  ├── relay queue (unchanged)
  └── scorer + tailor orchestration (unchanged)
```

The MCP process has no database handle. Every read and write goes through the
same authenticated API the web dashboard uses.

### 5.1 Package layout

```
server/mcp/
├── package.json          # name: jobfoundry-mcp, bin: jobfoundry-mcp
├── README.md             # connect Claude Desktop / Cursor, tool reference
├── src/
│   ├── index.mjs         # bin entry: config → server → stdio transport
│   ├── config.mjs        # parseArgs + env resolution and validation
│   ├── client.mjs        # JobFoundryClient
│   ├── tools.mjs         # registerTools(server, client)
│   └── server.mjs        # createServer({ client, version })
└── test/
    ├── unit.test.mjs     # config, status mapping, fit_notes parsing
    └── mcp.test.mjs      # stdio E2E against temp SQLite + mock tailor
```

The package is private and is not published to npm. Users run it from the repo
or via a global `npm link`.

## 6. Configuration

Precedence: CLI flag > environment variable > default.

| Flag | Env | Default | Notes |
| --- | --- | --- | --- |
| `--url <url>` | `JOBFOUNDRY_URL` | `http://127.0.0.1:8080` | http allowed only for loopback hosts |
| `--api-key <key>` | `JOBFOUNDRY_API_KEY` | none | Sent as `Authorization: Bearer <key>` |
| `--timeout <seconds>` | `JOBFOUNDRY_TIMEOUT` | `30` | Base request timeout; tailor has its own |
| `--help` | — | — | Print usage to stdout and exit 0 |
| `--version` | — | — | Print package version and exit 0 |

Validation rules:

- The URL must parse, use `http:` or `https:`, contain no credentials, and have
  no query or hash.
- `http:` is accepted only when the hostname is `127.0.0.1`, `::1`, or
  `localhost`. Anything else must be `https:`.
- `--timeout` and `JOBFOUNDRY_TIMEOUT` must be positive integers.
- A missing API key is not fatal at startup: the server may be a keyless dev
  instance. A `401` response produces an actionable error telling the user to
  set `JOBFOUNDRY_API_KEY`.
- Invalid configuration exits non-zero with a single stderr message before the
  transport starts.

stdout is reserved for the MCP protocol. All diagnostics go to stderr. The API
key is never logged, echoed, or included in tool output.

## 7. HTTP client

`JobFoundryClient` wraps global `fetch`:

- Base URL is normalized by stripping trailing slashes.
- Adds `Authorization: Bearer <key>` only when a key is configured.
- Adds `Content-Type: application/json` for bodies and
  `Accept: application/json`.
- Uses `redirect: 'error'` so a redirect can never forward the bearer token to
  another origin.
- Applies an `AbortSignal.timeout` per request. Read/write calls use the base
  timeout; tailoring uses the tool-provided timeout.
- Parses non-2xx responses. If the body is `{ "error": "..." }`, that message is
  surfaced. Otherwise the status code and a truncated body are surfaced.
- Distinguishes network/timeout failures from HTTP errors so tool messages can
  suggest checking that the server is running.

## 8. Tools

All tools return `content: [{ type: 'text', text: <pretty JSON> }]`.
Operational failures return `isError: true` with the same text shape, so the
calling model can recover. Read-only tools set `readOnlyHint: true`.

### 8.1 `get_profile`

- **API:** `GET /api/v1/resumes/active`
- **Input:** none.
- **Output:**

```json
{
  "profile": {
    "id": "res_...",
    "title": "Master Resume",
    "isActive": true,
    "created_at": 0,
    "updated_at": 0
  },
  "resume": { "basics": {}, "work": [], "skills": [] },
  "skills": ["TypeScript", "Go", "..."],
  "experience": [
    {
      "position": "...",
      "company": "...",
      "startDate": "...",
      "endDate": "..."
    }
  ]
}
```

`profile` is metadata only; the raw `resume_json` string from the API is omitted
because `resume` carries the parsed object. `skills` is a de-duplicated, sorted
flattening of `resume.skills[].keywords`. `experience` projects `resume.work`
and maps JSON Resume's `name` field to `company`; it does not replace the full
`resume` object.

- **Empty state:** when the API returns no active resume, return a normal result
  with `profile: null`, `resume: null`, empty `skills`/`experience`, and a
  `message` explaining that a master resume must be uploaded in the dashboard.
  Do not use `isError`.

### 8.2 `search_saved_jobs`

- **API:** `GET /api/v1/jobs`
- **Input:**

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `status` | string | — | Canonical status or alias; passed through as canonical |
| `company` | string | — | Case-insensitive exact filter (new query parameter) |
| `source` | string | — | Capture source (e.g. `greenhouse`) |
| `min_score` | integer 0–100 | — | Inclusive lower bound |
| `search` | string | — | Full-text search over title, company, description |
| `sort_by` | enum | `updated_at` | `fit_score`, `created_at`, `updated_at`, `title`, `company`, `status` |
| `order` | enum | `desc` | `asc` or `desc` |
| `limit` | integer 1–200 | `25` | Caps the API response |

- **Output:** `{ "count": n, "jobs": [...] }` where each row contains `id`,
  `title`, `company`, `location`, `source`, `url`, `status`, `fit_score`,
  `liveness`, `posted_at`, `created_at`, and `updated_at`. Descriptions are
  omitted to keep responses small; use `get_job_fit_score` for a single job.
- **Status semantics:** filters accept canonical values, aliases, and the
  internal failure states `score_failed`, `tailor_failed`, `failed`, `error`,
  `rejected_by_score`, and `invalid_job` so failures remain discoverable. Any
  other value is rejected with a validation error. The update tool is stricter
  (section 8.5).

### 8.3 `get_job_fit_score`

- **API:** `GET /api/v1/jobs/:id`
- **Input:** `job_id` (string, required).
- **Output:**

```json
{
  "scored": true,
  "job": {
    "id": "job_...",
    "title": "...",
    "company": "...",
    "status": "new",
    "fit_score": 82
  },
  "breakdown": {
    "reasoning": "...",
    "matching_skills": ["..."],
    "missing_skills": ["..."],
    "is_valid_job": true,
    "is_truncated": false
  }
}
```

- `fit_notes` is stored as a JSON string by the scorer. Parse it defensively:
  - Valid object → project known keys into `breakdown`.
  - `{ "error": "..." }` → `scored: false`, `error` populated.
  - Malformed JSON → `scored: <score != null>`, `raw_fit_notes` included.
- When `fit_score` is null and no error exists, return `scored: false` and a
  message that the job has not been scored yet. Do not use `isError`.

### 8.4 `generate_tailored_resume`

- **API:** `POST /api/v1/jobs/:id/tailor`
- **Input:** `job_id` (required), `timeout_seconds` (integer 30–1800, default
  900).
- **Output:**

```json
{
  "ok": true,
  "tailored_resume_id": "tailored-...",
  "job": { "id": "...", "status": "tailored", "tailored_resume_id": "..." },
  "artifacts": {
    "pdf": "http://127.0.0.1:8080/api/v1/jobs/<id>/artifacts/resume.pdf",
    "json": ".../resume.json",
    "markdown": ".../resume.md",
    "plaintext": ".../resume.txt"
  }
}
```

- The request waits for completion. Clients that impose shorter tool timeouts
  will cut the call off; the README documents this limitation and the
  `timeout_seconds` input.
- `resume.md` is best-effort in the server; the URL is listed but may 404. The
  README states which artifacts are guaranteed (`resume.pdf`, `resume.json`,
  `resume.txt`).
- HTTP `400` (no active resume, missing key, short description) and `502`
  (tailor failure) become `isError: true` with the server's message.

### 8.5 `update_application_status`

- **API:** `PATCH /api/v1/jobs/:id`
- **Input:** `job_id` (required), `status` (required, enum of canonical values
  and aliases).
- **Output:** `{ "ok": true, "job_id": "...", "status": "<canonical>", "job":
  { ... } }`.
- Only user-movable stages are accepted. Internal failure states cannot be set
  manually.

Canonical mapping:

| Input aliases | Canonical |
| --- | --- |
| `new`, `discovered` | `new` |
| `saved`, `bookmarked` | `saved` |
| `tailored` | `tailored` |
| `applied` | `applied` |
| `interview`, `interviewing` | `interview` |
| `offer`, `offered` | `offer` |
| `rejected`, `declined` | `rejected` |
| `archived`, `closed` | `archived` |

Unknown values return a validation error listing valid inputs.

## 9. Backend change: optional `company` filter

`GET /api/v1/jobs` gains an optional `company` query parameter.

- Case-insensitive exact match: `j.company = ? COLLATE NOCASE` (multi-tenant) or
  `company = ? COLLATE NOCASE` (legacy).
- Applied in both the multi-tenant and legacy query branches.
- Backward compatible; no response shape change.
- Covered by a focused ingest API test.

This is the only server-side change required by the issue.

## 10. SaaS readiness

- **Hosted backend, local MCP binary:** supported immediately. Set
  `JOBFOUNDRY_URL=https://api.example.com` and a user API key.
- **HTTPS enforcement:** non-loopback URLs must be HTTPS (D7).
- **Tenancy:** delegated to the API. The MCP process never chooses a user ID.
- **Timeouts:** configurable. A future async tailoring job endpoint can be added
  behind the same tool name by introducing a `wait` strategy; the tool schema is
  designed so `timeout_seconds` remains meaningful.
- **Transport:** handlers live in `tools.mjs` and are registered on an
  `McpServer` factory. A future entry point can attach
  `StreamableHTTPServerTransport` and OAuth without changing tool logic.
- **Docs:** README wording stays accurate: local/self-hosted by default,
  optional hosted backend. A hosted MCP endpoint is explicitly out of scope.

## 11. Testing

### 11.1 Unit (`test/unit.test.mjs`)

- Flag-over-env precedence and defaults.
- URL validation: rejects credentials, query/hash, non-http schemes, and plain
  HTTP to a remote host; accepts HTTP loopback and HTTPS remote.
- Status alias normalization and rejection of unknown/internal-set statuses.
- `fit_notes` parsing for valid JSON, `{ error }`, malformed JSON, and `null`.

### 11.2 End-to-end over stdio (`test/mcp.test.mjs`)

1. Create a temp directory and `openDb({ path })`.
2. Start `buildApp` on an ephemeral port with a legacy API key and temp
   artifacts directory.
3. Seed an active master resume and two jobs through the HTTP API.
4. Set a fit score and `fit_notes` directly in the temp DB for the scored job.
5. Start a local mock tailor service on an ephemeral port and set
   `process.env.TAILOR_PORT` before the tailor call. It returns
   `pdf_base64` (starting with `%PDF-`), `plain_text`, and `resume`.
6. Spawn `server/mcp/src/index.mjs` with `StdioClientTransport` and
   `JOBFOUNDRY_URL` / `JOBFOUNDRY_API_KEY`.
7. Assert `tools/list` returns exactly the five tools.
8. Invoke and assert:
   - `get_profile` returns the seeded name and flattened skills.
   - `search_saved_jobs` filters by status and by company.
   - `get_job_fit_score` returns the score, reasoning, matching and missing
     skills.
   - `update_application_status` accepts `interviewing`, persists `interview`,
     and rejects an invalid stage with `isError`.
   - `generate_tailored_resume` returns a tailored ID, marks the job `tailored`,
     and writes `resume.pdf`, `resume.json`, and `resume.txt` under the temp
     artifacts directory, with the PDF magic bytes intact.
9. Close the MCP client, app, mock tailor, DB, and temp directory.

### 11.3 Wiring

- Add `server/mcp` to root `package.json` workspaces.
- Add `server/mcp` script `test: node --test test/*.test.mjs`.
- Root `test` becomes:
  `npm run check:meta && node --test test/*.test.mjs && npm --workspace=server/mcp test`
  so CI exercises the MCP suite.
- No Dockerfile or packaging change: the MCP server is a desktop-side client,
  not part of the all-in-one container.

## 12. Documentation

- `server/mcp/README.md`: purpose, prerequisites, local setup, Claude Desktop and
  Cursor configuration, full tool reference with input/output examples, timeout
  guidance, troubleshooting (`401`, server not running, no active resume), and
  the artifact caveat.
- Root `README.md`: a short "Use JobFoundry from Claude Desktop or Cursor"
  section linking to `server/mcp/README.md`.
- `docs/mcp.md`: user-facing page mirroring the README for the docs site.

## 13. Acceptance criteria mapping

| Issue criterion | Design section |
| --- | --- |
| stdio transport per MCP spec | §5, §6, D6, official SDK |
| E2E tool invocation against local SQLite | §11.2 (real stdio + temp SQLite) |
| Docs for Claude Desktop / Cursor | §12 |
| Five named tools | §8 |

## 14. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Client tool timeout cuts off tailoring | `timeout_seconds` input, documented behavior, job status reflects success/failure on the server |
| API key leaks through logs or redirects | Never log keys; `redirect: 'error'`; HTTPS required off-loopback |
| Duplicated business logic drifts from the dashboard | All operations go through the ingest API; only a company query filter is added |
| MCP dependency churn | Pin `@modelcontextprotocol/sdk` and `zod` versions; follow the official transport API |
| `company` filter misses aliases (e.g. "Acme Inc") | Exact match is documented; use `search` for fuzzy company discovery |
| Tool output too large for model context | Search excludes descriptions; limits capped at 200 |
