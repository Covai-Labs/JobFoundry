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
