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
