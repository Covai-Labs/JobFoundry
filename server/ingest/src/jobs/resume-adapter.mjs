/**
 * resume-adapter.mjs — Thin adapter bridging JobFoundry's JSON Resume
 * (`master-resume.json`) to vendored career-ops zero-LLM modules:
 *   - `jd-skill-gap.mjs` (`extractJdSkills`, `classifySkillGaps`, `diagnoseExtraction`, `diagnoseCoverage`)
 *   - `verify-cv-facts.mjs` (`auditClaims`)
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

function pushHighlights(lines, items) {
  if (!Array.isArray(items)) return;
  for (const h of items) {
    if (h) lines.push(`- ${h}`);
  }
}

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
  }
}

/**
 * Render a JSON Resume object into the Markdown structure expected by
 * `jd-skill-gap.mjs` and `verify-cv-facts.mjs` (with `## Skills` and prose
 * sections separated so `classifySkillGaps` distinguishes named skills from
 * prose-supported skills).
 *
 * @param {Record<string, any>} resumeJson
 * @returns {string}
 */
export function jsonResumeToMarkdown(resumeJson) {
  if (!resumeJson || typeof resumeJson !== 'object') return '';
  const r =
    resumeJson.resume && typeof resumeJson.resume === 'object' ? resumeJson.resume : resumeJson;
  const lines = [];

  if (r.basics?.name) lines.push(`# ${r.basics.name}`);
  if (r.basics?.label) lines.push(r.basics.label);
  if (r.basics?.summary) lines.push('', '## Summary', r.basics.summary);

  pushWorkEntries(lines, 'Experience', r.work);
  pushWorkEntries(lines, 'Volunteer', r.volunteer);

  if (Array.isArray(r.projects) && r.projects.length > 0) {
    lines.push('', '## Projects');
    for (const p of r.projects) {
      if (p.name) lines.push(`### ${p.name}`);
      if (p.summary) lines.push(p.summary);
      if (p.description) lines.push(p.description);
      pushHighlights(lines, p.highlights);
    }
  }

  if (Array.isArray(r.education) && r.education.length > 0) {
    lines.push('', '## Education');
    for (const e of r.education) {
      const degree = [e.studyType, e.area].filter(Boolean).join(' in ');
      const line = [degree, e.institution].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
      if (Array.isArray(e.courses) && e.courses.length > 0) {
        lines.push(`  Courses: ${e.courses.filter(Boolean).join(', ')}`);
      }
    }
  }

  if (Array.isArray(r.certificates) && r.certificates.length > 0) {
    lines.push('', '## Certificates');
    for (const c of r.certificates) {
      const line = [c.name, c.issuer, c.date].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
    }
  }

  if (Array.isArray(r.awards) && r.awards.length > 0) {
    lines.push('', '## Awards');
    for (const a of r.awards) {
      const line = [a.title, a.awarder, a.date, a.summary].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
    }
  }

  if (Array.isArray(r.publications) && r.publications.length > 0) {
    lines.push('', '## Publications');
    for (const pub of r.publications) {
      const line = [pub.name, pub.publisher, pub.releaseDate, pub.summary]
        .filter(Boolean)
        .join(' — ');
      if (line) lines.push(`- ${line}`);
    }
  }

  if (Array.isArray(r.languages) && r.languages.length > 0) {
    lines.push('', '## Languages');
    for (const l of r.languages) {
      const line = [l.language, l.fluency].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
    }
  }

  if (Array.isArray(r.interests) && r.interests.length > 0) {
    lines.push('', '## Interests');
    for (const i of r.interests) {
      const kws = Array.isArray(i.keywords) ? i.keywords.filter(Boolean).join(', ') : '';
      const line = [i.name, kws].filter(Boolean).join(': ');
      if (line) lines.push(`- ${line}`);
    }
  }

  if (Array.isArray(r.references) && r.references.length > 0) {
    lines.push('', '## References');
    for (const ref of r.references) {
      const line = [ref.name, ref.reference].filter(Boolean).join(' — ');
      if (line) lines.push(`- ${line}`);
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
