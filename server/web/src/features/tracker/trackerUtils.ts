import { JobStatus } from '../../types/job';

export interface KanbanColumn {
  id: JobStatus;
  title: string;
  badgeClass: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'new', title: 'New', badgeClass: 'badge-blue' },
  { id: 'saved', title: 'Saved', badgeClass: 'badge-indigo' },
  { id: 'tailored', title: 'Tailored', badgeClass: 'badge-purple' },
  { id: 'applied', title: 'Applied', badgeClass: 'badge-cyan' },
  { id: 'interview', title: 'Interview', badgeClass: 'badge-amber' },
  { id: 'offer', title: 'Offer', badgeClass: 'badge-green' },
  { id: 'rejected', title: 'Rejected', badgeClass: 'badge-red' },
  { id: 'archived', title: 'Archived', badgeClass: 'badge-muted' },
];

export function isMoveAllowed(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  // Any status can be rejected, archived, or saved
  if (to === 'rejected' || to === 'archived' || to === 'saved') return true;
  return true; // Allow user flexibility in dragging across stages
}

// ---------------------------------------------------------------------------
// Per-column visibility + accent-color preferences (display-only).
// Stored under 'jf_kanban_prefs' in localStorage. Column ids map 1:1 onto
// JobStatus; this layer never touches the backend, scorer, or filters.
// ---------------------------------------------------------------------------

export interface KanbanPrefs {
  hiddenColumns: JobStatus[];
  columnColors: Partial<Record<JobStatus, string>>;
}

export const KANBAN_PREFS_STORAGE_KEY = 'jf_kanban_prefs';

export const DEFAULT_KANBAN_PREFS: KanbanPrefs = {
  hiddenColumns: [],
  columnColors: {},
};

export interface KanbanSwatch {
  name: string;
  cssVar: string; // theme-safe CSS variable, e.g. '--color-purple'
}

// Theme-safe accent swatches expressed as existing CSS variables so they work
// in both light and dark modes without introducing new design tokens.
export const KANBAN_SWATCHES: KanbanSwatch[] = [
  { name: 'Indigo', cssVar: '--accent-primary' },
  { name: 'Blue', cssVar: '--color-blue' },
  { name: 'Purple', cssVar: '--color-purple' },
  { name: 'Cyan', cssVar: '--color-cyan' },
  { name: 'Amber', cssVar: '--color-amber' },
  { name: 'Green', cssVar: '--color-green' },
  { name: 'Red', cssVar: '--color-red' },
];

const KNOWN_COLUMN_IDS: ReadonlySet<string> = new Set(KANBAN_COLUMNS.map((c) => c.id));

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && KNOWN_COLUMN_IDS.has(value);
}

const KNOWN_SWATCH_VARS: ReadonlySet<string> = new Set(KANBAN_SWATCHES.map((s) => s.cssVar));

export function loadKanbanPrefs(): KanbanPrefs {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_KANBAN_PREFS;
  }

  try {
    const raw = window.localStorage.getItem(KANBAN_PREFS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_KANBAN_PREFS;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_KANBAN_PREFS;
    }

    const hiddenColumns = Array.isArray(parsed.hiddenColumns)
      ? parsed.hiddenColumns.filter(isJobStatus)
      : [];

    const columnColors: Partial<Record<JobStatus, string>> = {};
    if (parsed.columnColors && typeof parsed.columnColors === 'object') {
      for (const [key, value] of Object.entries(parsed.columnColors)) {
        if (isJobStatus(key) && typeof value === 'string' && KNOWN_SWATCH_VARS.has(value)) {
          columnColors[key] = value;
        }
      }
    }

    return { hiddenColumns, columnColors };
  } catch {
    // Corrupt prefs fall back to defaults.
    return DEFAULT_KANBAN_PREFS;
  }
}

export function saveKanbanPrefs(prefs: KanbanPrefs): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(KANBAN_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Persistence is best-effort only. */
  }
}
