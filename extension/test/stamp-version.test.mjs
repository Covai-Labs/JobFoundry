import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

// Guards the release-tag → manifest version path: prerelease or malformed
// tags must fail fast instead of producing a manifest Chrome/Edge reject.

const EXT = resolve(import.meta.dirname, '..');
const SCRIPT = join(EXT, 'scripts', 'stamp-version-from-tag.mjs');

function makePackage() {
  const dir = mkdtempSync(join(tmpdir(), 'stamp-version-'));
  const pkgPath = join(dir, 'package.json');
  writeFileSync(pkgPath, JSON.stringify({ name: 'jobfoundry-extension', version: '0.0.0' }));
  return pkgPath;
}

function stamp(tag, pkgPath) {
  return execFileSync('node', [SCRIPT, tag], {
    env: { ...process.env, STAMP_PACKAGE_JSON: pkgPath },
    stdio: 'pipe',
  })
    .toString()
    .trim();
}

test('accepts ext-v and extension-v release tags and stamps X.Y.Z', () => {
  for (const tag of ['ext-v0.4.1', 'extension-v1.2.3']) {
    const pkgPath = makePackage();
    assert.equal(stamp(tag, pkgPath), tag.replace(/^(extension-v|ext-v)/, ''));
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  }
});

test('rejects prerelease and malformed tags without touching package.json', () => {
  for (const tag of ['ext-v1.2.3-rc.1', 'extension-v1.2', 'ext-v1.2.3.4.5-beta', 'main']) {
    const pkgPath = makePackage();
    assert.throws(() => stamp(tag, pkgPath), 'tag must be rejected');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    assert.equal(pkg.version, '0.0.0', 'rejected tag must not modify package.json');
  }
});
