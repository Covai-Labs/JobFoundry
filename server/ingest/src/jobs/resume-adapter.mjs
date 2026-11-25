/**
 * resume-adapter.mjs — Thin adapter bridging JobFoundry's JSON Resume
 * (`master-resume.json`) to vendored career-ops zero-LLM modules:
 *   - `jd-skill-gap.mjs` (`extractJdSkills`, `classifySkillGaps`)
 *   - `verify-cv-facts.mjs` (`auditClaims`)
 *
 * Keeps vendored files 100% byte-identical to upstream.
 */

import { extractJdSkills, classifySkillGaps } from '../vendored/jd-skill-gap.mjs';
import { auditClaims } from '../vendored/verify-cv-facts.mjs';

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

  if (Array.isArray(r.work) && r.work.length > 0) {
    lines.push('', '## Experience');
    for (const w of r.work) {
      const header = [w.position, w.name].filter(Boolean).join(' — ');
      if (header) lines.push(`### ${header}`);
      const dates = [w.startDate, w.endDate || 'Present'].filter(Boolean).join(' - ');
      if (dates) lines.push(dates);
      if (w.summary) lines.push(w.summary);
      if (Array.isArray(w.highlights)) {
        for (const h of w.highlights) {
          if (h) lines.push(`- ${h}`);
        }
      }
    }
  }

  if (Array.isArray(r.projects) && r.projects.length > 0) {
    lines.push('', '## Projects');
    for (const p of r.projects) {
      if (p.name) lines.push(`### ${p.name}`);
      if (p.description) lines.push(p.description);
      if (Array.isArray(p.highlights)) {
        for (const h of p.highlights) {
          if (h) lines.push(`- ${h}`);
        }
      }
    }
  }

  if (Array.isArray(r.education) && r.education.length > 0) {
    lines.push('', '## Education');
    for (const e of r.education) {
      const degree = [e.studyType, e.area].filter(Boolean).join(' in ');
      const line = [degree, e.institution].filter(Boolean).join(' — ');
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
 * @returns {{ existing: string[], supportedByResume: string[], gap: string[], totalSkills: number }}
 */
export function analyzeSkillGap(jdText, masterResumeJson) {
  if (!jdText || typeof jdText !== 'string') {
    return { existing: [], supportedByResume: [], gap: [], totalSkills: 0 };
  }
  const jdSkills = extractJdSkills(jdText);
  const cvMarkdown = jsonResumeToMarkdown(masterResumeJson);
  const { existing, supportedByResume, gap } = classifySkillGaps(jdSkills, cvMarkdown);
  return {
    existing,
    supportedByResume,
    gap,
    totalSkills: jdSkills.length,
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
