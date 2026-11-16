import type { JobStatus } from '../types/job';

/**
 * Single source of truth for how pipeline stages are named, grouped and
 * ordered across the feed, the detail header and the tracker.
 */
export const STATUS_LABELS: Record<JobStatus, string> = {
  new: 'New',
  saved: 'Saved',
  tailored: 'Tailored',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  archived: 'Archived',
  rejected_by_score: 'Rejected by Score',
  invalid_job: 'Invalid Job',
  score_failed: 'Score Failed',
  tailor_failed: 'Tailor Failed',
};

/** Get the human-readable label for a pipeline stage safely without dynamic object injection. */
export function getStatusLabel(status: JobStatus): string {
  switch (status) {
    case 'new':
      return 'New';
    case 'saved':
      return 'Saved';
    case 'tailored':
      return 'Tailored';
    case 'applied':
      return 'Applied';
    case 'interview':
      return 'Interview';
    case 'offer':
      return 'Offer';
    case 'rejected':
      return 'Rejected';
    case 'archived':
      return 'Archived';
    case 'rejected_by_score':
      return 'Rejected by Score';
    case 'invalid_job':
      return 'Invalid Job';
    case 'score_failed':
      return 'Score Failed';
    case 'tailor_failed':
      return 'Tailor Failed';
  }
}

/** Stages a candidate actively moves through. */
export const PIPELINE_STATUSES: readonly JobStatus[] = [
  'new',
  'saved',
  'tailored',
  'applied',
  'interview',
  'offer',
];

/** Stages that end the line: either the user closed the job or the system did. */
export const CLOSED_STATUSES: readonly JobStatus[] = [
  'rejected',
  'archived',
  'rejected_by_score',
  'invalid_job',
  'score_failed',
  'tailor_failed',
];

/**
 * Statuses that still want something from the user. The feed defaults to
 * these so applied/closed jobs stop padding the queue (they live in the
 * tracker instead).
 */
export const ACTIONABLE_STATUSES: readonly JobStatus[] = [
  'new',
  'saved',
  'tailored',
  'score_failed',
  'tailor_failed',
];

export function isActionableStatus(status: JobStatus): boolean {
  return ACTIONABLE_STATUSES.includes(status);
}

/** Pseudo-status used by the feed's status filter. */
export const ACTIONABLE_FILTER = 'actionable';

export type StageAction =
  | { kind: 'status'; label: string; to: JobStatus; title: string }
  | { kind: 'rescore'; label: string; title: string };

/**
 * The one thing the user most likely wants to do next, derived from the
 * current stage. Returning null means there is nothing to advance to.
 *
 * `score_failed` deliberately returns null: that recovery path already lives
 * in the Fit tab error banner, where the failure is explained.
 */
const NEXT_ACTION: Partial<Record<JobStatus, StageAction>> = {
  new: {
    kind: 'status',
    label: 'Mark Applied',
    to: 'applied',
    title: 'Record that you sent this application',
  },
  saved: {
    kind: 'status',
    label: 'Mark Applied',
    to: 'applied',
    title: 'Record that you sent this application',
  },
  tailored: {
    kind: 'status',
    label: 'Mark Applied',
    to: 'applied',
    title: 'Record that you sent this application',
  },
  applied: {
    kind: 'status',
    label: 'Log Interview',
    to: 'interview',
    title: 'Record that an interview was scheduled',
  },
  interview: {
    kind: 'status',
    label: 'Log Offer',
    to: 'offer',
    title: 'Record that you received an offer',
  },
};

export function getNextAction(status: JobStatus): StageAction | null {
  return NEXT_ACTION[status] ?? null;
}

/**
 * Card-level shortcut: only the apply loop is worth a one-click button on a
 * tile. Later stages are recorded from the detail view or the tracker.
 */
export function getQuickApplyTarget(status: JobStatus): JobStatus | null {
  return status === 'new' || status === 'saved' || status === 'tailored' ? 'applied' : null;
}
