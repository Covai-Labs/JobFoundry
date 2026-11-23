import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeResumeJson, heuristicParseResume, parseResumeText } from '../src/resume/parse-resume.mjs';
import { validateResumeJson } from '../src/resumes/resumes.mjs';

test('sanitizeResumeJson cleans empty strings, URLs, dates, and arrays', () => {
  const dirty = {
    basics: {
      name: ' Jane Doe ',
      email: 'jane@example.com',
      phone: ' 555-1234 ',
      url: '', // empty string should be pruned
      image: '  ', // empty string should be pruned
      summary: 'Experienced engineer',
      location: 'New York, NY', // string location converted to object
      profiles: [
        { network: 'GitHub', username: 'janedoe', url: 'github.com/janedoe' }, // auto prepend https://
        { network: '', username: '', url: '' }, // empty profile pruned
      ],
    },
    work: [
      {
        name: 'Acme Corp',
        position: 'Staff Engineer',
        url: '', // empty url pruned
        startDate: '2020/01/15', // slash date normalized
        endDate: 'Present', // ongoing role pruned
        summary: 'Leading distributed teams',
        highlights: ['Shipped v1.0', '', '  ', 'Optimized throughput by 50%'],
        keywords: ['Node.js', '', 'TypeScript'],
      },
    ],
    education: [
      {
        institution: 'State University',
        url: '   ',
        area: 'Computer Science',
        studyType: 'B.S.',
        startDate: '2015',
        endDate: '2019',
        courses: ['Algorithms', ''],
      },
    ],
    projects: [
      {
        name: 'OpenSource Tool',
        url: 'npmjs.com/package/tool',
        highlights: ['1k stars', ''],
      },
    ],
  };

  const clean = sanitizeResumeJson(dirty);

  // Assertions on basics
  assert.equal(clean.basics.name, 'Jane Doe');
  assert.equal(clean.basics.phone, '555-1234');
  assert.equal(clean.basics.url, undefined);
  assert.equal(clean.basics.image, undefined);
  assert.deepEqual(clean.basics.location, { address: 'New York, NY' });
  assert.equal(clean.basics.profiles.length, 1);
  assert.equal(clean.basics.profiles[0].url, 'https://github.com/janedoe');

  // Assertions on work
  assert.equal(clean.work[0].url, undefined);
  assert.equal(clean.work[0].startDate, '2020-01-15');
  assert.equal(clean.work[0].endDate, undefined);
  assert.deepEqual(clean.work[0].highlights, ['Shipped v1.0', 'Optimized throughput by 50%']);
  assert.deepEqual(clean.work[0].keywords, ['Node.js', 'TypeScript']);

  // Assertions on education
  assert.equal(clean.education[0].url, undefined);
  assert.deepEqual(clean.education[0].courses, ['Algorithms']);

  // Assertions on projects
  assert.equal(clean.projects[0].url, 'https://npmjs.com/package/tool');
  assert.deepEqual(clean.projects[0].highlights, ['1k stars']);

  // Validate that sanitized output complies with JSON Resume schema
  assert.doesNotThrow(() => validateResumeJson(clean));
});

test('heuristicParseResume produces schema-valid JSON Resume', () => {
  const text = `
    Jane Doe
    Principal Cloud Architect
    jane.architect@example.com
    (555) 123-4567
    Over 15 years designing fault-tolerant cloud infrastructures on AWS and GCP.
  `;
  const result = heuristicParseResume({ text });
  assert.equal(result.basics.name, 'Jane Doe');
  assert.equal(result.basics.label, 'Principal Cloud Architect');
  assert.equal(result.basics.email, 'jane.architect@example.com');
  assert.doesNotThrow(() => validateResumeJson(result));
});

test('parseResumeText throws descriptive error on short text or LLM failure', async () => {
  await assert.rejects(
    () => parseResumeText({ text: 'too short' }),
    /Resume content is too short or empty/
  );

  // When invalid API key is provided, throws descriptive AI conversion error
  await assert.rejects(
    () =>
      parseResumeText({
        text: 'Valid resume text with enough characters to pass minimum threshold.\nExperience at Tech Corp.',
        apiKey: 'invalid-dummy-key',
        apiBase: 'http://127.0.0.1:9999', // unreachable port
      }),
    /AI resume conversion failed/
  );
});
