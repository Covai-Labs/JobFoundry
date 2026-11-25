#!/usr/bin/env node
/**
 * scripts/sync-career-ops.mjs — Unified sync & drift check for all vendored
 * career-ops modules across JobFoundry (extension + server/ingest + templates).
 *
 * Usage:
 *   node scripts/sync-career-ops.mjs --from /path/to/career-ops
 *   node scripts/sync-career-ops.mjs --from /path/to/career-ops --check
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

function argValue(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const fromArg =
  argValue('--from') ?? process.env.CAREER_OPS_PATH ?? join(ROOT, '..', 'Scratch', 'career-ops');
const SRC = resolve(fromArg);

if (!existsSync(join(SRC, 'providers'))) {
  console.error(`sync-career-ops: career-ops checkout not found at ${SRC}`);
  console.error('Pass --from <path-to-career-ops> or set CAREER_OPS_PATH.');
  process.exit(1);
}

function run(scriptRel, scriptArgs) {
  const scriptPath = join(ROOT, scriptRel);
  execFileSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

const EXTRA_EXTENSION_VERBATIM = [
  ['user-agent.mjs', 'extension/src/background/vendored/user-agent.mjs'],
  ['ats-vendor.mjs', 'extension/src/background/vendored/ats-vendor.mjs'],
  ['liveness-api.mjs', 'extension/src/background/vendored/liveness-api.mjs'],
  ['lib/mjs-files.mjs', 'extension/src/background/vendored/lib/mjs-files.mjs'],
  ['lib/walk-tree.mjs', 'extension/src/background/vendored/lib/walk-tree.mjs'],
  ['lib/scratch-dirs.mjs', 'extension/src/background/vendored/lib/scratch-dirs.mjs'],
  ['lib/local-today.mjs', 'extension/src/background/vendored/lib/local-today.mjs'],
  ['lib/board-truncation.mjs', 'extension/src/background/vendored/lib/board-truncation.mjs'],
  ['lib/ascii-fold.mjs', 'extension/src/background/vendored/lib/ascii-fold.mjs'],
  ['lib/parse-date.mjs', 'extension/src/background/vendored/lib/parse-date.mjs'],
  ['lib/linkedin-url.mjs', 'extension/src/background/vendored/lib/linkedin-url.mjs'],
  ['lib/jd-parse.mjs', 'extension/src/background/vendored/lib/jd-parse.mjs'],
];

function checkExtraExtensionFiles() {
  const drifted = [];
  for (const [srcRel, dstRel] of EXTRA_EXTENSION_VERBATIM) {
    const srcPath = join(SRC, srcRel);
    const dstPath = join(ROOT, dstRel);
    if (!existsSync(dstPath)) {
      drifted.push(`missing: ${dstRel}`);
      continue;
    }
    if (existsSync(srcPath) && !readFileSync(srcPath).equals(readFileSync(dstPath))) {
      drifted.push(`drifted: ${dstRel}`);
    }
  }
  if (drifted.length > 0) {
    console.error(`sync-career-ops: ${drifted.length} extra extension file(s) out of sync:`);
    for (const d of drifted) console.error(`  - ${d}`);
    process.exit(1);
  }
  console.log(
    `sync-career-ops: ${EXTRA_EXTENSION_VERBATIM.length} extra extension files match upstream verbatim.`
  );
}

if (checkOnly) {
  console.log(`[sync-career-ops] Checking drift against ${SRC}...\n`);
  run('extension/scripts/sync-providers.mjs', ['--from', SRC]);
  checkExtraExtensionFiles();
  run('scripts/vendor-career-ops.mjs', ['--from', SRC, '--check']);
  console.log('\n[sync-career-ops] All vendored trees are in sync.');
} else {
  console.log(`[sync-career-ops] Syncing from ${SRC}...\n`);
  run('extension/scripts/vendor.mjs', ['--from', SRC]);
  run('extension/scripts/gen-provider-index.mjs', []);
  run('scripts/vendor-career-ops.mjs', ['--from', SRC]);
  console.log('\n[sync-career-ops] Running drift verification...');
  run('extension/scripts/sync-providers.mjs', ['--from', SRC]);
  checkExtraExtensionFiles();
  run('scripts/vendor-career-ops.mjs', ['--from', SRC, '--check']);
  console.log('\n[sync-career-ops] Done.');
}
