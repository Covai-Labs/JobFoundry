import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VERSION } from './version.mjs';
import { registerTools } from './tools.mjs';

export function createServer({ client, version = VERSION } = {}) {
  const server = new McpServer({ name: 'jobfoundry', version });
  registerTools(server, client);
  return server;
}
