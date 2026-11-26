#!/usr/bin/env node
/**
 * scripts/vendor-career-ops.mjs — Vendor and sync parsers and utilities from career-ops.
 *
 * Keeps vendored files 100% byte-identical to upstream (MIT, attribution preserved).
 *
 * Usage:
 *   node scripts/vendor-career-ops.mjs --from /path/to/career-ops
 *   node scripts/vendor-career-ops.mjs --from /path/to/career-ops --check
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

const isCheckOnly = process.argv.includes('--check');
const fromPath = getArg('--from');

if (!fromPath) {
  console.error('Usage: node scripts/vendor-career-ops.mjs --from <path-to-career-ops> [--check]');
  process.exit(1);
}

const SRC = resolve(fromPath);
if (!existsSync(SRC)) {
  console.error(`Error: source path does not exist: ${SRC}`);
  process.exit(1);
}

const VENDOR_MAP = [
  { src: 'LICENSE', dst: 'server/ingest/src/vendored/LICENSE' },
  { src: 'ats-vendor.mjs', dst: 'server/ingest/src/vendored/ats-vendor.mjs' },
  { src: 'url-key.mjs', dst: 'server/ingest/src/vendored/url-key.mjs' },
  {
    src: 'data-static/aggregator-domains.txt',
    dst: 'server/ingest/src/vendored/data-static/aggregator-domains.txt',
  },
  { src: 'skill-extract.mjs', dst: 'server/ingest/src/vendored/skill-extract.mjs' },
  { src: 'title-keywords.mjs', dst: 'server/ingest/src/vendored/title-keywords.mjs' },
  { src: 'ats-payload.mjs', dst: 'server/ingest/src/vendored/ats-payload.mjs' },
  { src: 'lib/cli-flags.mjs', dst: 'server/ingest/src/vendored/lib/cli-flags.mjs' },
  { src: 'lib/is-main-module.mjs', dst: 'server/ingest/src/vendored/lib/is-main-module.mjs' },
  { src: 'lib/linkedin-url.mjs', dst: 'server/ingest/src/vendored/lib/linkedin-url.mjs' },
  { src: 'lib/jd-parse.mjs', dst: 'server/ingest/src/vendored/lib/jd-parse.mjs' },
  { src: 'lib/cv-markdown.mjs', dst: 'server/ingest/src/vendored/lib/cv-markdown.mjs' },
  { src: 'lib/posting-close.mjs', dst: 'server/ingest/src/vendored/lib/posting-close.mjs' },
  { src: 'lib/parse-date.mjs', dst: 'server/ingest/src/vendored/lib/parse-date.mjs' },
  {
    src: 'lib/scan-history-columns.mjs',
    dst: 'server/ingest/src/vendored/lib/scan-history-columns.mjs',
  },
  {
    src: 'lib/tsv-formula-escape.mjs',
    dst: 'server/ingest/src/vendored/lib/tsv-formula-escape.mjs',
  },
  { src: 'himalayas-posting.mjs', dst: 'server/ingest/src/vendored/himalayas-posting.mjs' },
  { src: 'fingerprint-core.mjs', dst: 'server/ingest/src/vendored/fingerprint-core.mjs' },
  { src: 'tracker-parse.mjs', dst: 'server/ingest/src/vendored/tracker-parse.mjs' },
  { src: 'tracker-aliases.json', dst: 'server/ingest/src/vendored/tracker-aliases.json' },
  { src: 'jd-skill-gap.mjs', dst: 'server/ingest/src/vendored/jd-skill-gap.mjs' },
  { src: 'verify-cv-facts.mjs', dst: 'server/ingest/src/vendored/verify-cv-facts.mjs' },
  { src: 'path-resolver.mjs', dst: 'server/ingest/src/vendored/path-resolver.mjs' },
  { src: 'role-clarity.mjs', dst: 'server/ingest/src/vendored/role-clarity.mjs' },
  { src: 'jd-similarity.mjs', dst: 'server/ingest/src/vendored/jd-similarity.mjs' },
  { src: 'templates/ats-rules.yml', dst: 'templates/ats-rules.yml' },
  { src: 'templates/ats/cv-template.ats.html', dst: 'templates/ats/cv-template.ats.html' },
];

const VENDOR_DIRS = [
  { src: 'employers/boards', dst: 'server/ingest/src/vendored/employers/boards' },
];

function listFilesRecursive(dir, base = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

// Pre-flight check: verify all upstream source files and dirs exist before mutating or comparing
const missingUpstream = [...VENDOR_MAP, ...VENDOR_DIRS].filter(
  ({ src }) => !existsSync(join(SRC, src))
);
if (missingUpstream.length > 0) {
  console.error(
    `Error: missing upstream source files:\n${missingUpstream.map((m) => `  - ${m.src}`).join('\n')}`
  );
  process.exit(1);
}

let hasDrift = false;

for (const { src, dst } of VENDOR_MAP) {
  const fullSrc = join(SRC, src);
  const fullDst = join(ROOT, dst);

  if (isCheckOnly) {
    if (!existsSync(fullDst)) {
      console.error(`Missing vendored file: ${dst}`);
      hasDrift = true;
    } else {
      const srcBuf = readFileSync(fullSrc);
      const dstBuf = readFileSync(fullDst);
      if (!srcBuf.equals(dstBuf)) {
        console.error(`Drifted from upstream: ${dst}`);
        hasDrift = true;
      }
    }
  } else {
    mkdirSync(dirname(fullDst), { recursive: true });
    copyFileSync(fullSrc, fullDst);
    console.log(`Vendored verbatim: ${dst}`);
  }
}

for (const { src, dst } of VENDOR_DIRS) {
  const fullSrcDir = join(SRC, src);
  const fullDstDir = join(ROOT, dst);
  const srcFiles = listFilesRecursive(fullSrcDir);
  if (isCheckOnly) {
    const dstFiles = new Set(listFilesRecursive(fullDstDir));
    for (const rel of srcFiles) {
      if (!dstFiles.has(rel)) {
        console.error(`Missing vendored file: ${dst}/${rel}`);
        hasDrift = true;
      } else if (!readFileSync(join(fullSrcDir, rel)).equals(readFileSync(join(fullDstDir, rel)))) {
        console.error(`Drifted from upstream: ${dst}/${rel}`);
        hasDrift = true;
      }
      dstFiles.delete(rel);
    }
    for (const orphan of dstFiles) {
      console.error(`Orphan vendored file: ${dst}/${orphan}`);
      hasDrift = true;
    }
  } else {
    rmSync(fullDstDir, { recursive: true, force: true });
    for (const rel of srcFiles) {
      const target = join(fullDstDir, rel);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(fullSrcDir, rel), target);
    }
    console.log(`Vendored verbatim dir (${srcFiles.length} files): ${dst}`);
  }
}

if (isCheckOnly) {
  if (hasDrift) {
    console.error('\nSync check failed: drift or missing files detected.');
    process.exit(1);
  } else {
    console.log('Sync check passed: all vendored files match upstream verbatim.');
  }
} else {
  console.log('\nVendoring complete: all files copied verbatim.');
}
