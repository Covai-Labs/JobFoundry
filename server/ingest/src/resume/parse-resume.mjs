/**
 * parse-resume.mjs — LLM-powered Raw Resume to JSON Resume v1.0.0 Converter.
 * Strictly operates on client-provided raw text or Markdown and converts it into
 * standard JSON Resume v1.0.0 format.
 */

import { safeFetch } from '../security/ssrf.mjs';
import { validateResumeJson } from '../resumes/resumes.mjs';

function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\r\t]+/g, ' ').trim();
}

/**
 * Sanitize and normalize a resume object to ensure strict compliance with JSON Resume schema.
 * - Strips empty strings from URI fields (which otherwise fail format: "uri").
 * - Normalizes URLs by prepending https:// if missing protocol.
 * - Normalizes or removes invalid dates and converts ongoing roles (e.g. "Present") to omitted endDate.
 * - Filters out empty strings from string arrays (highlights, keywords, courses).
 * - Prunes empty objects and ensures appropriate array types.
 */
export function sanitizeResumeJson(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  // Helper: clean URI
  const cleanUri = (val) => {
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (/^(https?|mailto|ftp):\/\//i.test(trimmed)) return trimmed;
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }
    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      return undefined;
    }
  };

  // Helper: clean Date (ISO 8601: YYYY, YYYY-MM, or YYYY-MM-DD)
  const cleanDate = (val) => {
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const lower = trimmed.toLowerCase();
    if (
      ['present', 'current', 'now', 'ongoing', 'active', 'n/a', 'none', 'till date'].includes(
        lower
      )
    ) {
      return undefined;
    }
    // Direct regex match for YYYY-MM-DD, YYYY-MM, YYYY
    const isoPattern =
      /^([1-2][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])|[1-2][0-9]{3}-(0[1-9]|1[0-2])|[1-2][0-9]{3})$/;
    if (isoPattern.test(trimmed)) return trimmed;

    // Check for YYYY/MM/DD or YYYY/MM
    const slashIso = trimmed.replace(/\//g, '-');
    if (isoPattern.test(slashIso)) return slashIso;

    // Try parsing Month Year (e.g. "January 2022" or "Jan 2022")
    const monthYear = trimmed.match(/^([a-zA-Z]+)[,\s]+(\d{4})$/);
    if (monthYear) {
      const parsedDate = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
      if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const candidate = `${year}-${month}`;
        if (isoPattern.test(candidate)) return candidate;
      }
    }

    return undefined;
  };

  // Helper: clean string arrays
  const cleanStringArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
      .filter((item) => item.length > 0);
  };

  const result = { ...raw };

  // $schema
  result.$schema =
    'https://raw.githubusercontent.com/jsonresume/jsonresume.org/master/packages/schema/schema.json';

  // basics
  if (result.basics && typeof result.basics === 'object') {
    const basics = { ...result.basics };
    if (basics.name) basics.name = String(basics.name).trim();
    if (basics.label) basics.label = String(basics.label).trim();
    if (basics.email) {
      const email = String(basics.email).trim();
      if (email.includes('@')) basics.email = email;
      else delete basics.email;
    }
    if (basics.phone) basics.phone = String(basics.phone).trim();
    if (!basics.phone) delete basics.phone;

    const cleanWebsite = cleanUri(basics.url);
    if (cleanWebsite) basics.url = cleanWebsite;
    else delete basics.url;

    const cleanImg = cleanUri(basics.image);
    if (cleanImg) basics.image = cleanImg;
    else delete basics.image;

    if (basics.summary) basics.summary = String(basics.summary).trim();

    // location
    if (typeof basics.location === 'string') {
      const locStr = basics.location.trim();
      basics.location = { address: locStr };
    } else if (basics.location && typeof basics.location === 'object') {
      const loc = { ...basics.location };
      ['address', 'postalCode', 'city', 'countryCode', 'region'].forEach((k) => {
        if (loc[k]) loc[k] = String(loc[k]).trim();
        if (!loc[k]) delete loc[k];
      });
      if (Object.keys(loc).length === 0) delete basics.location;
      else basics.location = loc;
    }

    // profiles
    if (Array.isArray(basics.profiles)) {
      basics.profiles = basics.profiles
        .map((p) => {
          if (!p || typeof p !== 'object') return null;
          const profile = { ...p };
          if (profile.network) profile.network = String(profile.network).trim();
          if (profile.username) profile.username = String(profile.username).trim();
          const pUrl = cleanUri(profile.url);
          if (pUrl) profile.url = pUrl;
          else delete profile.url;

          if (!profile.network && !profile.username && !profile.url) return null;
          return profile;
        })
        .filter(Boolean);
    } else {
      delete basics.profiles;
    }

    result.basics = basics;
  }

  // Clean arrays of objects: work, volunteer, education, awards, certificates, publications, skills, languages, interests, references, projects
  const arraySections = [
    'work',
    'volunteer',
    'education',
    'awards',
    'certificates',
    'publications',
    'skills',
    'languages',
    'interests',
    'references',
    'projects',
  ];

  for (const section of arraySections) {
    if (result[section] !== undefined) {
      if (!Array.isArray(result[section])) {
        delete result[section];
        continue;
      }
      result[section] = result[section]
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const entry = { ...item };

          // Clean URLs
          if (entry.url !== undefined) {
            const u = cleanUri(entry.url);
            if (u) entry.url = u;
            else delete entry.url;
          }

          // Clean Dates
          ['startDate', 'endDate', 'date', 'releaseDate'].forEach((dateKey) => {
            if (entry[dateKey] !== undefined) {
              const d = cleanDate(entry[dateKey]);
              if (d) entry[dateKey] = d;
              else delete entry[dateKey];
            }
          });

          // Clean string arrays
          ['highlights', 'keywords', 'courses'].forEach((arrKey) => {
            if (entry[arrKey] !== undefined) {
              entry[arrKey] = cleanStringArray(entry[arrKey]);
            }
          });

          // Trim text fields
          [
            'name',
            'position',
            'summary',
            'description',
            'institution',
            'area',
            'studyType',
            'score',
            'organization',
            'title',
            'awarder',
            'issuer',
            'publisher',
            'language',
            'fluency',
          ].forEach((textKey) => {
            if (entry[textKey] !== undefined) {
              entry[textKey] = String(entry[textKey]).trim();
              if (!entry[textKey]) delete entry[textKey];
            }
          });

          return entry;
        })
        .filter(Boolean);
    }
  }

  return result;
}

/**
 * Call OpenRouter, OpenAI, or LiteLLM-compatible endpoint to convert raw resume text to JSON Resume v1.0.0.
 */
async function callLlmResumeParser({
  text,
  apiKey,
  model = process.env.DEFAULT_LLM_MODEL || 'openrouter/openrouter/free',
  apiBase = process.env.DEFAULT_LLM_API_BASE || 'https://openrouter.ai/api/v1',
}) {
  const prompt = `You are an expert resume parsing and ATS optimization engine.
Convert the candidate resume text below into a strictly conforming JSON Resume v1.0.0 specification object (https://jsonresume.org/schema/).

Follow this JSON structure:
{
  "$schema": "https://raw.githubusercontent.com/jsonresume/jsonresume.org/master/packages/schema/schema.json",
  "basics": {
    "name": "Full Name",
    "label": "Professional Headline / Current Title",
    "email": "email@example.com",
    "phone": "Phone Number",
    "url": "https://portfolio-or-site.com",
    "summary": "2-4 sentence executive overview / professional biography",
    "location": {
      "address": "Street address or line",
      "postalCode": "Postal Code",
      "city": "City",
      "countryCode": "Two-letter ISO country code e.g. US, GB, IN, CA",
      "region": "State / Province / Region"
    },
    "profiles": [
      {
        "network": "LinkedIn / GitHub / Twitter",
        "username": "Username or handle",
        "url": "https://profile.url"
      }
    ]
  },
  "objective": "Candidate's forward-looking career objective or target role statement (if mentioned)",
  "work": [
    {
      "name": "Company Name",
      "position": "Job Title",
      "url": "https://company.url (omit if unknown)",
      "startDate": "YYYY-MM-DD, YYYY-MM, or YYYY",
      "endDate": "YYYY-MM-DD, YYYY-MM, or YYYY (omit entirely if current role)",
      "summary": "Overview of role and scope",
      "highlights": [
        "Action verb + quantifiable impact / outcome bullet point 1",
        "Bullet point 2 with metrics and technologies"
      ],
      "keywords": ["Core technologies / domains used in this role"]
    }
  ],
  "volunteer": [
    {
      "organization": "Organization Name",
      "position": "Role",
      "url": "https://org.url",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM",
      "summary": "Description",
      "highlights": ["Impact bullets"]
    }
  ],
  "education": [
    {
      "institution": "University / College Name",
      "url": "https://institution.url",
      "area": "Field of Study / Major (e.g. Computer Science)",
      "studyType": "Degree Type (e.g. B.S., M.S., Ph.D., B.Tech)",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY",
      "score": "GPA or honours (e.g. 3.9/4.0 or First Class)",
      "courses": ["Notable Course 1", "Notable Course 2"]
    }
  ],
  "awards": [
    {
      "title": "Award Title",
      "date": "YYYY-MM or YYYY",
      "awarder": "Granting Organization",
      "summary": "Award description"
    }
  ],
  "certificates": [
    {
      "name": "Certification Name (e.g. AWS Certified Solutions Architect)",
      "date": "YYYY-MM or YYYY",
      "issuer": "Issuing Body (e.g. Amazon Web Services)",
      "url": "https://certificate.url"
    }
  ],
  "publications": [
    {
      "name": "Publication Title",
      "publisher": "Journal or Conference",
      "releaseDate": "YYYY-MM-DD or YYYY",
      "url": "https://doi.org/...",
      "summary": "Brief abstract"
    }
  ],
  "skills": [
    {
      "name": "Category (e.g. Languages, Distributed Systems, Cloud & DevOps, Machine Learning)",
      "level": "Master, Advanced, or Intermediate",
      "keywords": ["Skill 1", "Skill 2", "Skill 3"]
    }
  ],
  "languages": [
    {
      "language": "Language name (e.g. English, French, Spanish)",
      "fluency": "Native speaker, Fluent, Professional working proficiency"
    }
  ],
  "interests": [
    {
      "name": "Interest category",
      "keywords": ["Topic 1", "Topic 2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Project overview",
      "highlights": ["Key achievements and architecture decisions"],
      "keywords": ["Tech stack used"],
      "url": "https://project.url",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM"
    }
  ]
}

STRICT CONSTRAINTS:
1. Return ONLY the JSON object. Do not wrap in markdown or conversational commentary.
2. DATES: Format as YYYY-MM-DD, YYYY-MM, or YYYY. For current/ongoing roles, OMIT the "endDate" property entirely. NEVER output empty strings ("") or "Present" for dates.
3. URLS: Must be absolute URLs starting with http:// or https://. If no URL is available, OMIT the "url" property. NEVER output empty strings ("").
4. ACCURACY: Extract all candidate details truthfully. Do not invent or hallucinate facts, dates, or companies not present in the input text.
5. COMPLETENESS: Extract all jobs, degrees, certifications, skills, and projects found in the text.

--- CANDIDATE RESUME TEXT ---
${text.slice(0, 40000)}
`;

  const endpoint = `${apiBase.replace(/\/$/, '')}/chat/completions`;
  const cleanModel = model.startsWith('openrouter/') ? model.replace('openrouter/', '') : model;

  const res = await safeFetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://jobfoundry.local',
      'X-Title': 'JobFoundry Resume Parser',
    },
    body: JSON.stringify({
      model: cleanModel,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert ATS parser. Convert resumes into valid JSON Resume v1.0.0 specifications. Return pure JSON only conforming to JSON Resume schema.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM API responded with ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const rawContent = json?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('LLM returned empty message content');
  }

  const cleanJsonStr = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleanJsonStr);
  } catch (initialErr) {
    // Attempt extracting outermost {...} if wrapped in commentary
    const firstBrace = cleanJsonStr.indexOf('{');
    const lastBrace = cleanJsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleanJsonStr.slice(firstBrace, lastBrace + 1));
    }
    throw initialErr;
  }
}

/**
 * Basic heuristic fallback parser when LLM is unavailable.
 */
export function heuristicParseResume({ text }) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let name = lines[0] || 'Candidate Name';
  let email = '';
  let phone = '';
  let label = '';

  const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}/);
  if (emailMatch) email = emailMatch[0];

  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) phone = phoneMatch[0];

  if (lines.length > 1 && !lines[1].includes('@') && lines[1].length < 60) {
    label = lines[1];
  }

  const basics = {
    name,
    label: label || 'Professional',
    email,
    phone,
    summary: lines.slice(2, 6).join(' '),
    location: { city: '', region: '' },
  };

  return {
    $schema:
      'https://raw.githubusercontent.com/jsonresume/jsonresume.org/master/packages/schema/schema.json',
    basics,
    skills: [{ name: 'Core Skills', keywords: [] }],
    work: [],
    education: [],
  };
}

/**
 * Main parseResume function
 */
export async function parseResumeText({
  text,
  model,
  apiKey,
  apiBase,
  suppressEnvKeyFallback = false,
}) {
  const content = cleanText(text);
  if (!content || content.length < 20) {
    throw new Error(
      'Resume content is too short or empty. Please provide resume text or markdown.'
    );
  }

  const effectiveKey =
    apiKey ||
    (suppressEnvKeyFallback
      ? ''
      : process.env.DEFAULT_LLM_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        process.env.OPENAI_API_KEY);

  if (effectiveKey) {
    try {
      const llmResult = await callLlmResumeParser({
        text: content,
        apiKey: effectiveKey,
        ...(model ? { model } : {}),
        ...(apiBase ? { apiBase } : {}),
      });

      const sanitized = sanitizeResumeJson(llmResult);
      return validateResumeJson(sanitized);
    } catch (err) {
      console.error(`[Parse-Resume] LLM extraction error: ${err.message}`);
      throw new Error(`AI resume conversion failed: ${err.message}`, { cause: err });
    }
  }

  // Heuristic parser when no LLM key is configured
  const heuristic = heuristicParseResume({ text: content });
  const sanitizedHeuristic = sanitizeResumeJson(heuristic);
  return validateResumeJson(sanitizedHeuristic);
}
