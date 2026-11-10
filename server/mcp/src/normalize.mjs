export const CANONICAL_STATUSES = [
  'new',
  'saved',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
  'archived',
];

export const SEARCH_ONLY_STATUSES = [
  'score_failed',
  'tailor_failed',
  'failed',
  'error',
  'rejected_by_score',
  'invalid_job',
];

const STATUS_ALIASES = {
  discovered: 'new',
  bookmarked: 'saved',
  interviewing: 'interview',
  offered: 'offer',
  declined: 'rejected',
  closed: 'archived',
};

function canonicalize(value) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return STATUS_ALIASES[key] ?? key;
}

export function normalizeStatus(value) {
  const status = canonicalize(value);
  return CANONICAL_STATUSES.includes(status) ? status : null;
}

export function normalizeSearchStatus(value) {
  const status = canonicalize(value);
  if (CANONICAL_STATUSES.includes(status) || SEARCH_ONLY_STATUSES.includes(status)) {
    return status;
  }
  return null;
}

export function parseFitNotes(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: false, value: null };
  if (typeof raw === 'object') return { ok: true, value: raw };
  if (typeof raw !== 'string') return { ok: false, value: null };
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? { ok: true, value } : { ok: false, value: null };
  } catch {
    return { ok: false, value: null };
  }
}

export function extractSkills(resume) {
  const skills = new Set();
  for (const group of Array.isArray(resume?.skills) ? resume.skills : []) {
    for (const keyword of Array.isArray(group?.keywords) ? group.keywords : []) {
      if (typeof keyword === 'string' && keyword.trim()) skills.add(keyword.trim());
    }
  }
  return [...skills].sort((a, b) => a.localeCompare(b));
}

export function summarizeExperience(resume) {
  return (Array.isArray(resume?.work) ? resume.work : []).map((entry) => ({
    position: entry?.position ?? '',
    company: entry?.name ?? '',
    startDate: entry?.startDate ?? '',
    endDate: entry?.endDate ?? '',
  }));
}

export function summarizeJob(job) {
  return {
    id: job?.id ?? null,
    title: job?.title ?? '',
    company: job?.company ?? '',
    location: job?.location ?? null,
    source: job?.source ?? '',
    url: job?.url ?? '',
    status: job?.status ?? '',
    fit_score: job?.fit_score ?? null,
    liveness: job?.liveness ?? 'unknown',
    posted_at: job?.posted_at ?? null,
    created_at: job?.created_at ?? null,
    updated_at: job?.updated_at ?? null,
  };
}

export function buildFitBreakdown(job) {
  const score = job?.fit_score ?? null;
  const parsed = parseFitNotes(job?.fit_notes);
  if (!parsed.ok) {
    return {
      scored: score !== null,
      breakdown: null,
      raw_fit_notes: typeof job?.fit_notes === 'string' ? job.fit_notes : null,
    };
  }
  if (typeof parsed.value.error === 'string') {
    return { scored: false, error: parsed.value.error, breakdown: null };
  }
  return {
    scored: score !== null,
    breakdown: {
      reasoning: parsed.value.reasoning ?? '',
      matching_skills: Array.isArray(parsed.value.matching_skills)
        ? parsed.value.matching_skills
        : [],
      missing_skills: Array.isArray(parsed.value.missing_skills) ? parsed.value.missing_skills : [],
      is_valid_job: parsed.value.is_valid_job !== false,
      is_truncated: Boolean(parsed.value.is_truncated),
    },
  };
}
