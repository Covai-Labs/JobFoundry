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

Clone the repository and install dependencies from the repository root:

```bash
git clone https://github.com/Covai-Labs/JobFoundry.git
cd JobFoundry
npm ci
```

It is not published to npm. Use an absolute path to `server/mcp/src/index.mjs`
when configuring a client.

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

> [!WARNING]
> If you configure `.cursor/mcp.json` at project level, ensure `.cursor/` is
> listed in `.gitignore` so your `JOBFOUNDRY_API_KEY` is not accidentally committed.
> Prefer global configuration (`~/.cursor/mcp.json`) for shared projects.

## Configuration

CLI flags override environment variables.

| Flag          | Environment variable | Default                 | Notes                                                       |
| ------------- | -------------------- | ----------------------- | ----------------------------------------------------------- |
| `--url <url>` | `JOBFOUNDRY_URL`     | `http://127.0.0.1:8080` | Plain `http://` only for `127.0.0.1`, `::1`, or `localhost` |
| `--api-key`   | `JOBFOUNDRY_API_KEY` | none                    | Sent as a bearer token                                      |
| `--timeout`   | `JOBFOUNDRY_TIMEOUT` | `30`                    | Base HTTP timeout in seconds; tailoring has its own         |
| `--help`      | —                    | —                       | Print usage                                                 |
| `--version`   | —                    | —                       | Print the version                                           |

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

Downloading returned artifact URLs directly (e.g., via `curl` or browser) requires
passing the `Authorization: Bearer <key>` header on authenticated instances. You
can also view and download artifacts directly from the JobFoundry web dashboard.

Clients with a shorter tool timeout will cut the call off. The backend tailoring
task will continue running on the server until it reaches `tailored` or `failed`.
Before re-running the tool or retrying, check the web dashboard to see if the first
tailoring run succeeded to avoid starting duplicate LLM jobs. `resume.pdf`,
`resume.json`, and `resume.txt` are guaranteed on success; `resume.md` is best-effort.

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

| Symptom                                      | Fix                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `401` / "JobFoundry rejected the API key"    | Copy the key from Settings and set `JOBFOUNDRY_API_KEY`                   |
| "Could not reach JobFoundry"                 | Start the container and confirm `JOBFOUNDRY_URL`                          |
| "No active master resume found"              | Upload a master resume in the dashboard                                   |
| Tailoring fails with "No API key configured" | Add an LLM key in Settings                                                |
| Tailoring times out in the client            | Raise the client tool timeout and/or pass a larger `timeout_seconds`     |

## Security

- The MCP server stores no data and opens no database.
- It only knows your JobFoundry API key, never your LLM provider key.
- It never scrapes job boards.
- HTTPS is enforced for remote URLs so the API key is never sent in plaintext.
