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
 * Call OpenRouter, OpenAI, or LiteLLM-compatible endpoint to convert raw resume text to JSON Resume v1.0.0.
 */
async function callLlmResumeParser({
  text,
  apiKey,
  model = process.env.DEFAULT_LLM_MODEL || 'openrouter/openrouter/free',
  apiBase = process.env.DEFAULT_LLM_API_BASE || 'https://openrouter.ai/api/v1',
}) {
  const prompt = `You are an expert resume parsing and ATS optimization engine.
Convert the following candidate resume text into a strictly valid JSON Resume v1.0.0 schema object.

The output MUST be a single, valid JSON object matching the JSON Resume schema (https://jsonresume.org/schema/).
Schema guidelines:
- basics: { name, label, email, phone, url, summary, location: { address, postalCode, city, countryCode, region }, profiles: [{ network, username, url }] }
- work: [{ name, position, url, startDate, endDate, summary, highlights: ["bullet point 1", "bullet point 2"] }]
- education: [{ institution, url, area, studyType, startDate, endDate, score, courses: [] }]
- skills: [{ name: "Category Name (e.g. Languages, Frameworks, Cloud)", level: "Master/Intermediate/Beginner", keywords: ["Tool1", "Tool2"] }]
- projects: [{ name, description, highlights: [], keywords: [], url }]
- certificates: [{ name, date, issuer, url }]

CRITICAL INSTRUCTIONS:
1. Return ONLY the raw JSON object. Do NOT wrap in markdown code blocks like \`\`\`json.
2. Ensure dates use YYYY-MM-DD or YYYY-MM or YYYY format when possible, or leave as empty string if unknown.
3. Ensure all keys and arrays conform to JSON Resume v1.0.0. Do not invent non-standard root keys.

--- CANDIDATE RESUME TEXT ---
${text.slice(0, 30000)}
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
            'You are an expert ATS parser. Convert resumes into valid JSON Resume v1.0.0 specifications. Return pure JSON only.',
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

  return JSON.parse(cleanJsonStr);
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
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
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

      // Ensure $schema is present
      if (!llmResult.$schema) {
        llmResult.$schema =
          'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json';
      }
      return validateResumeJson(llmResult);
    } catch (err) {
      console.warn(`[Parse-Resume] LLM extraction failed (${err.message}); fallback to heuristic`);
    }
  }

  const heuristic = heuristicParseResume({ text: content });
  return validateResumeJson(heuristic);
}
