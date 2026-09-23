import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// Mirrors ai-chat-exporter/tests/version-check.test.mjs: the extension
// version lives in exactly one place (extension/package.json) and WXT
// inherits it dynamically. On extension release tags CI stamps package.json from the
// tag (ext-vX.Y.Z) before building so every store sees a fresh version.
// Paths are file-relative so the test passes however it is invoked
// (npm --workspace=extension test, or node --test from the repo root).

const EXT = path.resolve(import.meta.dirname, '..');

test('extension package.json version is valid SemVer string', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(EXT, 'package.json'), 'utf8'));

  assert.ok(pkg.version, 'package.json must specify a version');
  assert.match(
    pkg.version,
    /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/,
    'Version must follow SemVer format'
  );
});

test('wxt.config.ts does not hardcode a manifest version', () => {
  const config = fs.readFileSync(path.join(EXT, 'wxt.config.ts'), 'utf8');
  // A hardcoded `version:` in the manifest block would override the
  // package.json inheritance and drift on every release.
  assert.doesNotMatch(
    config,
    /^\s*version:\s*['"]\d+\.\d+\.\d+['"]/m,
    'wxt.config.ts must not hardcode version so WXT inherits it from package.json'
  );
});

test('built extension manifests match package.json version if built', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(EXT, 'package.json'), 'utf8'));

  const targets = [
    '.output/chrome-mv3/manifest.json',
    '.output/edge-mv3/manifest.json',
    '.output/firefox-mv3/manifest.json',
  ];
  for (const targetPath of targets) {
    const fullPath = path.join(EXT, targetPath);
    if (fs.existsSync(fullPath)) {
      const manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      assert.strictEqual(
        manifest.version,
        pkg.version,
        `${targetPath} version (${manifest.version}) must match package.json version (${pkg.version})`
      );
    }
  }
});
