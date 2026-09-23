#!/usr/bin/env node
// stamp-version-from-tag.mjs — stamps extension/package.json from an
// extension release tag (ext-vX.Y.Z or extension-vX.Y.Z).
//
// Fails fast on prerelease/malformed versions: Chrome/Edge manifests only
// accept dot-separated integers, so a tag like ext-v1.2.3-rc.1 can never be
// published and must not silently become the manifest version.
//
// Usage: node extension/scripts/stamp-version-from-tag.mjs [tag]
//   tag defaults to $GITHUB_REF_NAME. The package path can be overridden
//   with $STAMP_PACKAGE_JSON (used by tests).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = process.env.STAMP_PACKAGE_JSON ?? resolve(EXT, 'package.json');

const raw = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';

let tag = raw;
if (tag.startsWith('extension-v')) {
  tag = tag.slice('extension-v'.length);
} else if (tag.startsWith('ext-v')) {
  tag = tag.slice('ext-v'.length);
} else if (tag.startsWith('v')) {
  tag = tag.slice(1);
}

if (!/^\d+\.\d+\.\d+$/.test(tag)) {
  console.error(
    `Refusing to stamp extension version from tag '${raw}': expected ext-vX.Y.Z with a plain X.Y.Z release version (Chrome/Edge manifests reject prerelease suffixes).`
  );
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
pkg.version = tag;
writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
console.log(tag);
