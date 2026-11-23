/**
 * suggest-roles.mjs — AI-powered Role Keyword Generator.
 * Analyzes candidate JSON Resume and generates standardized industry job titles
 * optimized for job board scrapers and ATS matching.
 */

import { safeFetch } from '../security/ssrf.mjs';

/**
 * Clean and summarize JSON Resume into a compact text overview for LLM analysis.
 */
export function formatResumeForAnalysis(resume) {
  if (!resume || typeof resume !== 'object') return '';

  const parts = [];

  // Basics
  if (resume.basics) {
    const { label, summary } = resume.basics;
    if (label) parts.push(`Target / Current Headline: ${label.trim()}`);
    if (summary) parts.push(`Professional Summary: ${summary.trim()}`);
  }

  // Work experience
  if (Array.isArray(resume.work) && resume.work.length > 0) {
    parts.push('\nWork Experience:');
    for (const job of resume.work) {
      if (!job || typeof job !== 'object') continue;
      const pos = job.position ? job.position.trim() : '';
      const comp = job.name ? job.name.trim() : '';
      if (!pos && !comp) continue;
      let line = `- ${pos}${comp ? ` at ${comp}` : ''}`;
      if (job.summary) line += ` (${job.summary.slice(0, 150).trim()})`;
      parts.push(line);
      if (Array.isArray(job.highlights) && job.highlights.length > 0) {
        for (const h of job.highlights.slice(0, 2)) {
          if (typeof h === 'string' && h.trim()) {
            parts.push(`  * ${h.trim().slice(0, 150)}`);
          }
        }
      }
    }
  }

  // Skills
  if (Array.isArray(resume.skills) && resume.skills.length > 0) {
    parts.push('\nCore Skills & Competencies:');
    for (const skill of resume.skills) {
      if (!skill || typeof skill !== 'object') continue;
      const cat = skill.name ? skill.name.trim() : '';
      const kws = Array.isArray(skill.keywords)
        ? skill.keywords.filter((k) => typeof k === 'string' && k.trim()).join(', ')
        : '';
      if (cat || kws) {
        parts.push(`- ${cat ? `${cat}: ` : ''}${kws}`);
      }
    }
  }

  // Projects
  if (Array.isArray(resume.projects) && resume.projects.length > 0) {
    parts.push('\nKey Projects:');
    for (const proj of resume.projects.slice(0, 3)) {
      if (!proj || typeof proj !== 'object') continue;
      const name = proj.name ? proj.name.trim() : '';
      const desc = proj.description ? proj.description.trim() : '';
      if (name) parts.push(`- ${name}: ${desc.slice(0, 100)}`);
    }
  }

  return parts.join('\n').trim();
}

/**
 * Fallback heuristic role extraction when LLM is unavailable or fails.
 */
export function heuristicSuggestRoles(resume) {
  if (!resume || typeof resume !== 'object') return [];

  const rawCandidates = new Set();

  if (typeof resume.basics?.label === 'string' && resume.basics.label.trim()) {
    rawCandidates.add(resume.basics.label.trim());
  }

  if (Array.isArray(resume.work)) {
    for (const item of resume.work) {
      if (typeof item?.position === 'string' && item.position.trim()) {
        const pos = item.position.trim();
        // Split on common dividers like slashes or pipes e.g. "Fellow / Researcher"
        if (pos.includes('/') || pos.includes('|')) {
          pos
            .split(/[/|]/)
            .map((p) => p.trim())
            .filter((p) => p.length >= 3)
            .forEach((p) => rawCandidates.add(p));
        } else {
          rawCandidates.add(pos);
        }
      }
    }
  }

  if (Array.isArray(resume.skills)) {
    for (const skill of resume.skills) {
      if (typeof skill?.name === 'string' && skill.name.trim()) {
        const name = skill.name.trim();
        if (/engineer|developer|architect|lead|manager|analyst|specialist|consultant/i.test(name)) {
          rawCandidates.add(name);
        }
      }
      if (Array.isArray(skill?.keywords)) {
        for (const kw of skill.keywords) {
          if (
            typeof kw === 'string' &&
            /engineer|developer|scientist|specialist|lead|analyst|manager/i.test(kw)
          ) {
            rawCandidates.add(kw.trim());
          }
        }
      }
    }
  }

  return cleanAndDeduplicateRoles(Array.from(rawCandidates));
}

/**
 * Clean, sanitize and deduplicate role titles.
 */
export function cleanAndDeduplicateRoles(roles) {
  if (!Array.isArray(roles)) return [];

  const seen = new Set();
  const cleaned = [];

  for (const item of roles) {
    if (typeof item !== 'string') continue;
    let title = item.trim().replace(/^[-*•]\s*/, '');
    // Strip numeric list prefixes only when followed by list punctuation or whitespace (e.g. "1. " or "2) ")
    // Preserves leading numbers in titles such as "3D Artist" or "2D Animator"
    title = title.replace(/^\d+[\s.)-]+\s*/, '').trim();

    // Safely strip surrounding quotes without polynomial regular expressions
    while (title.startsWith('"') || title.startsWith("'")) {
      title = title.slice(1).trim();
    }
    while (title.endsWith('"') || title.endsWith("'")) {
      title = title.slice(0, -1).trim();
    }

    if (!title || title.length < 3 || title.length > 60) continue;

    const lower = title.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    cleaned.push(title);
  }

  return cleaned;
}

/**
 * Suggest role keywords using LLM analysis of the resume.
 */
export async function suggestRolesFromResume({
  resume,
  model = 'openrouter/openrouter/free',
  apiKey = '',
  apiBase = 'https://openrouter.ai/api/v1',
  suppressEnvKeyFallback = false,
}) {
  const resumeOverview = formatResumeForAnalysis(resume);
  if (!resumeOverview) {
    return { ok: true, roles: [], source: 'heuristic' };
  }

  let effectiveKey = apiKey;
  if (!effectiveKey && !suppressEnvKeyFallback) {
    effectiveKey = process.env.DEFAULT_LLM_API_KEY || process.env.OPENROUTER_API_KEY || '';
  }

  // If no API key is available, fallback to heuristic extraction
  if (!effectiveKey) {
    return {
      ok: true,
      roles: heuristicSuggestRoles(resume),
      source: 'heuristic',
      notice: 'LLM API key not configured; extracted standard titles via heuristic fallback.',
    };
  }

  const prompt = `You are an expert talent acquisition strategist and technical recruiter.
Analyze the candidate's master resume details below.
Synthesize a list of 10 to 18 standardized, modern job titles that recruiters and ATS systems use when hiring for this candidate's exact profile, adjacent roles, and skill level.

STRICT RULES:
1. Target Role Titles ONLY. Examples: "AI Operations Specialist", "Chief of Staff", "Healthcare Data Analyst", "Lead Research Scientist", "Strategy & Operations Lead".
2. Keep each title standardized, concise, and 1 to 4 words.
3. DO NOT include candidate name, previous company names, universities, or compound slash titles (e.g. "Junior Research Fellow / Research Fellow").
4. Return ONLY a valid JSON object with the property "roles" containing an array of strings.

--- CANDIDATE PROFILE ---
${resumeOverview}
`;

  const effectiveBase = apiBase || 'https://openrouter.ai/api/v1';
  const endpoint = `${effectiveBase.replace(/\/$/, '')}/chat/completions`;
  const cleanModel = model.startsWith('openrouter/') ? model.replace('openrouter/', '') : model;

  try {
    const res = await safeFetch(endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveKey}`,
        'HTTP-Referer': 'https://jobfoundry.local',
        'X-Title': 'JobFoundry Role Suggester',
      },
      body: JSON.stringify({
        model: cleanModel,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert technical recruiter and job search consultant. Respond with pure JSON conforming to {"roles": ["Title 1", "Title 2"]}.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM API responded with ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('LLM returned empty message content');
    }

    const cleanJsonStr = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonStr);
    } catch {
      const firstBrace = cleanJsonStr.indexOf('{');
      const lastBrace = cleanJsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(cleanJsonStr.slice(firstBrace, lastBrace + 1));
      } else {
        throw new Error('Could not parse JSON from LLM response');
      }
    }

    const rawRoles = Array.isArray(parsed?.roles)
      ? parsed.roles
      : Array.isArray(parsed)
        ? parsed
        : [];
    const roles = cleanAndDeduplicateRoles(rawRoles);

    if (roles.length > 0) {
      return { ok: true, roles, source: 'llm' };
    }

    // If LLM returned empty array, fallback to heuristic
    return {
      ok: true,
      roles: heuristicSuggestRoles(resume),
      source: 'heuristic',
      notice: 'LLM returned no roles; fell back to heuristic titles.',
    };
  } catch (err) {
    // Graceful fallback to heuristic extraction on LLM failure
    return {
      ok: true,
      roles: heuristicSuggestRoles(resume),
      source: 'heuristic',
      notice: `LLM error (${err.message}); fell back to heuristic titles.`,
    };
  }
}
