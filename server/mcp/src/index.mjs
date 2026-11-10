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

try {
  await main();
} catch (err) {
  console.error(`jobfoundry-mcp: ${err.message}`);
  process.exit(1);
}
