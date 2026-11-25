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
import { existsSync } from 'node:fs';
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

if (checkOnly) {
  console.log(`[sync-career-ops] Checking drift against ${SRC}...\n`);
  run('extension/scripts/sync-providers.mjs', ['--from', SRC]);
  run('scripts/vendor-career-ops.mjs', ['--from', SRC, '--check']);
  console.log('\n[sync-career-ops] All vendored trees are in sync.');
} else {
  console.log(`[sync-career-ops] Syncing from ${SRC}...\n`);
  run('extension/scripts/vendor.mjs', ['--from', SRC]);
  run('extension/scripts/gen-provider-index.mjs', []);
  run('scripts/vendor-career-ops.mjs', ['--from', SRC]);
  console.log('\n[sync-career-ops] Running drift verification...');
  run('extension/scripts/sync-providers.mjs', ['--from', SRC]);
  run('scripts/vendor-career-ops.mjs', ['--from', SRC, '--check']);
  console.log('\n[sync-career-ops] Done.');
}
