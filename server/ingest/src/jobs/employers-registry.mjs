/**
 * employers-registry.mjs — Adapter over vendored career-ops `employers/boards/`
 * (43k+ live-checked ATS company boards). Lazily loads and caches the `.ndjson`
 * files in memory on first search.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BOARDS_DIR = join(__dirname, '..', 'vendored', 'employers', 'boards');

let cachedBoards = null;
let cachedDir = null;

/**
 * Load all active employer boards from `boards/<ats>/*.ndjson`.
 *
 * @param {string} [boardsDir]
 * @returns {Array<{ name: string, nameLower: string, ats: string, region: string | null, board: string, boardLower: string, careers_url: string }>}
 */
export function loadEmployerBoards(boardsDir = DEFAULT_BOARDS_DIR) {
  if (cachedBoards && cachedDir === boardsDir) return cachedBoards;
  if (!existsSync(boardsDir)) return [];

  const records = [];
  for (const atsDir of readdirSync(boardsDir, { withFileTypes: true })) {
    if (!atsDir.isDirectory()) continue;
    const atsPath = join(boardsDir, atsDir.name);
    for (const file of readdirSync(atsPath, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.ndjson')) continue;
      const content = readFileSync(join(atsPath, file.name), 'utf8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          continue;
        }
        if (row.retired === true || !row.careers_url || !row.name || !row.ats) continue;
        records.push({
          name: row.name,
          nameLower: row.name.toLowerCase(),
          ats: row.ats,
          region: row.region ?? null,
          board: row.board || '',
          boardLower: (row.board || '').toLowerCase(),
          careers_url: row.careers_url,
        });
      }
    }
  }

  cachedBoards = records;
  cachedDir = boardsDir;
  return records;
}

/**
 * Search the vendored employer board registry.
 *
 * @param {{ q?: string, ats?: string, limit?: number, boardsDir?: string }} [opts]
 * @returns {{ total: number, atsList: string[], results: Array<{ name: string, ats: string, region: string | null, board: string, careers_url: string }> }}
 */
export function searchEmployers({
  q = '',
  ats = '',
  limit = 25,
  boardsDir = DEFAULT_BOARDS_DIR,
} = {}) {
  const all = loadEmployerBoards(boardsDir);
  const query = typeof q === 'string' ? q.trim().toLowerCase() : '';
  const atsFilter = typeof ats === 'string' ? ats.trim().toLowerCase() : '';
  const cappedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

  const prefixHits = [];
  const substringHits = [];

  for (const rec of all) {
    if (atsFilter && rec.ats !== atsFilter) continue;
    if (!query) {
      substringHits.push(rec);
      continue;
    }
    if (rec.nameLower.startsWith(query) || rec.boardLower.startsWith(query)) {
      prefixHits.push(rec);
    } else if (rec.nameLower.includes(query) || rec.boardLower.includes(query)) {
      substringHits.push(rec);
    }
  }

  const combined = [...prefixHits, ...substringHits];
  const results = combined
    .slice(0, cappedLimit)
    .map(({ name, ats: a, region, board, careers_url }) => ({
      name,
      ats: a,
      region,
      board,
      careers_url,
    }));

  return {
    total: combined.length,
    totalRegistry: all.length,
    results,
  };
}
