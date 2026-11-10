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
  assert.throws(
    () => resolveConfig({ argv: ['--timeout', '3601'], env: {} }),
    /between 1 and 3600/
  );
  assert.throws(
    () => resolveConfig({ argv: ['--nope'], env: {} }),
    (err) => err instanceof ConfigError
  );
});

test('help and version flags are reported without requiring other config', () => {
  assert.equal(resolveConfig({ argv: ['--help'], env: {} }).help, true);
  assert.equal(resolveConfig({ argv: ['--version'], env: {} }).version, true);
  assert.match(usage(), /--api-key/);
  assert.match(usage(), /JOBFOUNDRY_API_KEY/);
});
