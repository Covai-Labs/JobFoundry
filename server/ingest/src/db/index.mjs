import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrate } from './migrate.mjs';

export function openDb({ path }) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 10000');
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  migrate(db);
  return db;
}
