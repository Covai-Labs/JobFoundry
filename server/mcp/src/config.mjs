import { parseArgs } from 'node:util';
export { VERSION } from './version.mjs';

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

function stripTrailingSlashes(str) {
  let end = str.length;
  while (end > 0 && str.charCodeAt(end - 1) === 47) {
    end--;
  }
  return str.slice(0, end);
}

function normalizeUrl(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) throw new ConfigError('JobFoundry URL must not be empty');

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ConfigError('Invalid JobFoundry URL: failed to parse URL');
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

  const path = stripTrailingSlashes(url.pathname);
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

  // --help and --version must work with a broken environment: a user debugging
  // configuration should never be blocked by the configuration itself.
  if (values.help || values.version) {
    return {
      help: values.help,
      version: values.version,
      url: DEFAULT_URL,
      apiKey: '',
      timeoutMs: DEFAULT_TIMEOUT_SECONDS * 1000,
    };
  }

  const url = normalizeUrl(values.url ?? env.JOBFOUNDRY_URL ?? DEFAULT_URL);
  const apiKey = String(values['api-key'] ?? env.JOBFOUNDRY_API_KEY ?? '').trim();
  const timeoutMs =
    parseTimeout(values.timeout ?? env.JOBFOUNDRY_TIMEOUT ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

  return { help: values.help, version: values.version, url, apiKey, timeoutMs };
}
