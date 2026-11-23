import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db/index.mjs';
import { buildApp } from '../src/app.mjs';
import {
  formatResumeForAnalysis,
  heuristicSuggestRoles,
  cleanAndDeduplicateRoles,
  suggestRolesFromResume,
} from '../src/resume/suggest-roles.mjs';

const SAMPLE_RESUME = {
  basics: {
    name: 'Anusha J',
    label: 'AI-Oriented Research and Operations Professional',
    email: 'anusha@example.com',
    summary:
      'AI-oriented research and operations professional with experience across market intelligence, healthcare research, startup operations, and workflow automation.',
  },
  work: [
    {
      name: 'Startup Inc',
      position: "Chief Of Staff / Founder's Office",
      startDate: '2023-01-01',
      highlights: ['Led operational scale-up', 'Implemented AI workflows'],
    },
    {
      name: 'Bio Health Labs',
      position: 'Market Research Associate',
      startDate: '2021-06-01',
      endDate: '2022-12-31',
      highlights: ['Market intelligence research', 'Data analysis'],
    },
  ],
  skills: [
    {
      name: 'Operations & Strategy',
      keywords: ['Workflow Automation', 'Market Research', 'Operations Lead'],
    },
    {
      name: 'AI Engineering',
      keywords: ['Prompt Engineering', 'AI Operations', 'Python'],
    },
  ],
};

test('formatResumeForAnalysis produces compact, structured text', () => {
  const formatted = formatResumeForAnalysis(SAMPLE_RESUME);
  assert.ok(formatted.includes('AI-Oriented Research and Operations Professional'));
  assert.ok(formatted.includes('Chief Of Staff'));
  assert.ok(formatted.includes('Market Research Associate'));
  assert.ok(formatted.includes('Operations & Strategy'));
});

test('cleanAndDeduplicateRoles standardizes and deduplicates strings', () => {
  const input = [
    '  - "Software Engineer" ',
    'Software Engineer',
    '• Frontend Developer',
    '1. AI Operations Specialist',
    '',
    'x', // too short (< 3 chars)
  ];
  const cleaned = cleanAndDeduplicateRoles(input);
  assert.deepEqual(cleaned, [
    'Software Engineer',
    'Frontend Developer',
    'AI Operations Specialist',
  ]);
});

test('heuristicSuggestRoles extracts and splits compound roles', () => {
  const roles = heuristicSuggestRoles(SAMPLE_RESUME);
  assert.ok(roles.includes('Chief Of Staff'));
  assert.ok(roles.includes("Founder's Office"));
  assert.ok(roles.includes('Market Research Associate'));
  assert.ok(roles.includes('Operations Lead'));
});

test('suggestRolesFromResume falls back to heuristic when no API key is provided', async () => {
  const result = await suggestRolesFromResume({
    resume: SAMPLE_RESUME,
    apiKey: '',
    suppressEnvKeyFallback: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, 'heuristic');
  assert.ok(result.roles.length > 0);
  assert.ok(result.roles.includes('Chief Of Staff'));
});

test('POST /api/v1/resumes/suggest-roles requires authentication when keys configured', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, apiKeys: ['static-key'], jwtSecret: 'test-secret' });
  await app.ready();

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes/suggest-roles',
    headers: {},
  });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('POST /api/v1/resumes/suggest-roles returns roles from active resume', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-secret' });
  await app.ready();

  // Register user
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'anusha@test.com', password: 'password123' },
  });
  const token = JSON.parse(regRes.body).token;
  const headers = { Authorization: `Bearer ${token}` };

  // Save active resume
  const uploadRes = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes',
    headers,
    payload: {
      title: 'Active Resume',
      resumeJson: SAMPLE_RESUME,
      setActive: true,
    },
  });
  assert.equal(uploadRes.statusCode, 201);

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes/suggest-roles',
    headers,
    payload: {},
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.roles));
  assert.ok(body.roles.length > 0);
  assert.ok(body.roles.includes('Chief Of Staff'));

  await app.close();
});
