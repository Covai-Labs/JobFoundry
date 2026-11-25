/**
 * resume-adapter.mjs — Thin adapter bridging JobFoundry's JSON Resume
 * (`master-resume.json`) to vendored career-ops zero-LLM modules:
 *   - `jd-skill-gap.mjs` (`extractJdSkills`, `classifySkillGaps`, `diagnoseExtraction`, `diagnoseCoverage`)
 *   - `verify-cv-facts.mjs` (`auditClaims`)
 *   - `role-clarity.mjs` (`analyzeRoleClarity`, `formatSummary`)
 *   - `jd-similarity.mjs` (`jaccardSimilarity`, `recommendCvReuse`)
 *
 * Keeps vendored files 100% byte-identical to upstream.
 */

import {
  extractJdSkills,
  classifySkillGaps,
  diagnoseExtraction,
  diagnoseCoverage,
} from '../vendored/jd-skill-gap.mjs';
import { auditClaims } from '../vendored/verify-cv-facts.mjs';
import {
  analyzeRoleClarity,
  formatSummary as formatRoleClaritySummary,
} from '../vendored/role-clarity.mjs';
import {
  jaccardSimilarity,
  recommendCvReuse as upstreamRecommendCvReuse,
} from '../vendored/jd-similarity.mjs';

export { analyzeRoleClarity, formatRoleClaritySummary, jaccardSimilarity };

export function recommendCvReuse(newJd, previousText, options = {}) {
  if (
    typeof newJd !== 'string' ||
    !newJd.trim() ||
    typeof previousText !== 'string' ||
    !previousText.trim()
  ) {
    return { decision: 'rewrite', score: 0, reason: 'empty-input' };
  }
  return upstreamRecommendCvReuse(newJd, previousText, options);
}

const STANDARD_TOP_KEYS = new Set([
  '$schema',
  'meta',
  'basics',
  'work',
  'volunteer',
  'projects',
  'education',
  'certificates',
  'awards',
  'publications',
  'languages',
  'interests',
  'references',
  'skills',
]);

const SKIP_ENTRY_KEYS = new Set(['id', 'url', 'website', 'image', 'email', 'phone', 'profiles']);

function pushHighlights(lines, items) {
  if (!Array.isArray(items)) return;
  for (const h of items) {
    if (h) lines.push(`- ${h}`);
  }
}

function pushExtraValues(lines, obj, handledKeys) {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, val] of Object.entries(obj)) {
    if (handledKeys.has(key) || SKIP_ENTRY_KEYS.has(key) || val == null) continue;
    if (typeof val === 'string' && val.trim()) {
      lines.push(`- ${val.trim()}`);
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      lines.push(`- ${val}`);
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string' && item.trim()) lines.push(`- ${item.trim()}`);
        else if (typeof item === 'number' && Number.isFinite(item)) lines.push(`- ${item}`);
        else if (item && typeof item === 'object') pushExtraValues(lines, item, new Set());
      }
    } else if (typeof val === 'object') {
      pushExtraValues(lines, val, new Set());
    }
  }
}

const WORK_HANDLED_KEYS = new Set([
  'position',
  'name',
  'organization',
  'startDate',
  'endDate',
  'summary',
  'highlights',
]);

function pushWorkEntries(lines, heading, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  lines.push('', `## ${heading}`);
  for (const w of entries) {
    const header = [w.position, w.name || w.organization].filter(Boolean).join(' — ');
    if (header) lines.push(`### ${header}`);
    const dates = [w.startDate, w.endDate || 'Present'].filter(Boolean).join(' - ');
    if (dates) lines.push(dates);
    if (w.summary) lines.push(w.summary);
    pushHighlights(lines, w.highlights);
    pushExtraValues(lines, w, WORK_HANDLED_KEYS);
  }
}

/**
 * Render a JSON Resume object into the Markdown structure expected by
 * `jd-skill-gap.mjs` and `verify-cv-facts.mjs` (with `## Skills` and prose
 * sections separated so `classifySkillGaps` distinguishes named skills from
 * prose-supported skills). Preserves standard sections plus any custom/extra
 * JSON Resume keys.
 *
 * @param {Record<string, any>} resumeJson
 * @returns {string}
 */
export function jsonResumeToMarkdown(resumeJson) {
  if (!resumeJson || typeof resumeJson !== 'object') return '';
  const r =
    resumeJson.resume && typeof resumeJson.resume === 'object' ? resumeJson.resume : resumeJson;
  const lines = [];

  if (r.basics && typeof r.basics === 'object') {
    if (r.basics.name) lines.push(`# ${r.basics.name}`);
    if (r.basics.label) lines.push(r.basics.label);
    if (r.basics.summary) lines.push('', '## Summary', r.basics.summary);
    pushExtraValues(lines, r.basics, new Set(['name', 'label', 'summary', 'location']));
  }

  pushWorkEntries(lines, 'Experience', r.work);
  pushWorkEntries(lines, 'Volunteer', r.volunteer);

  if (Array.isArray(r.projects) && r.projects.length > 0) {
    lines.push('', '## Projects');
    const handled = new Set(['name', 'summary', 'description', 'highlights']);
    for (const p of r.projects) {
      if (p.name) lines.push(`### ${p.name}`);
      if (p.summary) lines.push(p.summary);
      if (p.description) lines.push(p.description);
      pushHighlights(lines, p.highlights);
      pushExtraValues(lines, p, handled);
    }
  }

  if (Array.isArray(r.education) && r.education.length > 0) {
    lines.push('', '## Education');
    const handled = new Set(['studyType', 'area', 'institution', 'courses']);
    for (const e of r.education) {
      const degree = [e.studyType, e.area].filter(Boolean).join(' in ');
      const line = [degree, e.institution].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
      if (Array.isArray(e.courses) && e.courses.length > 0) {
        lines.push(`  Courses: ${e.courses.filter(Boolean).join(', ')}`);
      }
      pushExtraValues(lines, e, handled);
    }
  }

  if (Array.isArray(r.certificates) && r.certificates.length > 0) {
    lines.push('', '## Certificates');
    const handled = new Set(['name', 'issuer', 'date']);
    for (const c of r.certificates) {
      const line = [c.name, c.issuer, c.date].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
      pushExtraValues(lines, c, handled);
    }
  }

  if (Array.isArray(r.awards) && r.awards.length > 0) {
    lines.push('', '## Awards');
    const handled = new Set(['title', 'awarder', 'date', 'summary']);
    for (const a of r.awards) {
      const line = [a.title, a.awarder, a.date, a.summary].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
      pushExtraValues(lines, a, handled);
    }
  }

  if (Array.isArray(r.publications) && r.publications.length > 0) {
    lines.push('', '## Publications');
    const handled = new Set(['name', 'publisher', 'releaseDate', 'summary']);
    for (const pub of r.publications) {
      const line = [pub.name, pub.publisher, pub.releaseDate, pub.summary]
        .filter(Boolean)
        .join(' — ');
      if (line) lines.push(`- ${line}`);
      pushExtraValues(lines, pub, handled);
    }
  }

  if (Array.isArray(r.languages) && r.languages.length > 0) {
    lines.push('', '## Languages');
    const handled = new Set(['language', 'fluency']);
    for (const l of r.languages) {
      const line = [l.language, l.fluency].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
      pushExtraValues(lines, l, handled);
    }
  }

  if (Array.isArray(r.interests) && r.interests.length > 0) {
    lines.push('', '## Interests');
    const handled = new Set(['name', 'keywords']);
    for (const i of r.interests) {
      const kws = Array.isArray(i.keywords) ? i.keywords.filter(Boolean).join(', ') : '';
      const line = [i.name, kws].filter(Boolean).join(': ');
      if (line) lines.push(`- ${line}`);
      pushExtraValues(lines, i, handled);
    }
  }

  if (Array.isArray(r.references) && r.references.length > 0) {
    lines.push('', '## References');
    const handled = new Set(['name', 'reference']);
    for (const ref of r.references) {
      const line = [ref.name, ref.reference].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
      pushExtraValues(lines, ref, handled);
    }
  }

  // Fallback for any custom/non-standard top-level JSON Resume sections (placed
  // before ## Skills so splitSkillsSection treats ## Skills as the final section).
  for (const [key, val] of Object.entries(r)) {
    if (STANDARD_TOP_KEYS.has(key) || SKIP_ENTRY_KEYS.has(key) || val == null) continue;
    const sectionTitle = key.charAt(0).toUpperCase() + key.slice(1);
    const sectionLines = [];
    if (typeof val === 'string' && val.trim()) {
      sectionLines.push(val.trim());
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      sectionLines.push(String(val));
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string' && item.trim()) sectionLines.push(`- ${item.trim()}`);
        else if (typeof item === 'number' && Number.isFinite(item)) sectionLines.push(`- ${item}`);
        else if (item && typeof item === 'object') pushExtraValues(sectionLines, item, new Set());
      }
    } else if (typeof val === 'object') {
      pushExtraValues(sectionLines, val, new Set());
    }
    if (sectionLines.length > 0) {
      lines.push('', `## ${sectionTitle}`, ...sectionLines);
    }
  }

  if (Array.isArray(r.skills) && r.skills.length > 0) {
    lines.push('', '## Skills');
    for (const s of r.skills) {
      const kws = Array.isArray(s.keywords) ? s.keywords.filter(Boolean).join(', ') : '';
      if (s.name && kws) lines.push(`- ${s.name}: ${kws}`);
      else if (s.name) lines.push(`- ${s.name}`);
      else if (kws) lines.push(`- ${kws}`);
    }
  }

  return lines.join('\n');
}

/**
 * Zero-LLM skill-gap analysis comparing a JD against a JSON Resume.
 *
 * @param {string} jdText
 * @param {Record<string, any>} masterResumeJson
 * @returns {{ existing: string[], supportedByResume: string[], gap: string[], totalSkills: number, warnings: Array<{ reason: string, message: string }> }}
 */
export function analyzeSkillGap(jdText, masterResumeJson) {
  if (!jdText || typeof jdText !== 'string') {
    return { existing: [], supportedByResume: [], gap: [], totalSkills: 0, warnings: [] };
  }
  const jdSkills = extractJdSkills(jdText);
  const cvMarkdown = jsonResumeToMarkdown(masterResumeJson);
  const { existing, supportedByResume, gap } = classifySkillGaps(jdSkills, cvMarkdown);
  const warnings = [diagnoseExtraction(jdText, jdSkills), diagnoseCoverage(jdText)].filter(Boolean);
  return {
    existing,
    supportedByResume,
    gap,
    totalSkills: jdSkills.length,
    warnings,
  };
}

/**
 * Deterministic fact-audit comparing a tailored resume (text/Markdown or JSON
 * Resume) against the candidate's `master-resume.json` source facts.
 *
 * @param {string|Record<string, any>} tailoredResume
 * @param {Record<string, any>} masterResumeJson
 * @param {{ allow_metrics?: string[], forbidden_phrases?: string[] }} [config]
 * @returns {{ invented: string[], forbidden: string[] }}
 */
export function auditTailoredResumeFacts(tailoredResume, masterResumeJson, config = {}) {
  const targetText =
    typeof tailoredResume === 'string' ? tailoredResume : jsonResumeToMarkdown(tailoredResume);
  const sourceText = jsonResumeToMarkdown(masterResumeJson);
  return auditClaims(targetText, sourceText, config);
}
