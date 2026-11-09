import test from 'node:test';
import assert from 'node:assert/strict';
import { renderResumeMarkdown } from '../src/resumes/resume-markdown.mjs';

const RESUME = {
  basics: {
    name: 'Jane Doe',
    label: 'Staff Engineer',
    email: 'jane@example.com',
    phone: '+1 555 0100',
    location: { city: 'Bengaluru', region: 'KA', countryCode: 'IN' },
    url: 'https://example.com',
    summary: 'Distributed systems engineer.',
  },
  work: [
    {
      name: 'TechCo',
      position: 'Staff Engineer',
      startDate: '2020-01-01',
      highlights: ['Scaled platform to 10M DAU', 'Cut p99 latency by 40%'],
    },
  ],
  projects: [{ name: 'JobFoundry', description: 'Local job search pipeline' }],
  education: [
    {
      institution: 'State University',
      studyType: 'B.Tech',
      area: 'Computer Science',
      startDate: '2014',
      endDate: '2018',
    },
  ],
  skills: [{ name: 'Backend', keywords: ['Node.js', 'Go'] }],
  certificates: [{ name: 'CKA', issuer: 'CNCF', date: '2023' }],
};

test('renderResumeMarkdown emits standard sections', () => {
  const markdown = renderResumeMarkdown(RESUME);

  assert.match(markdown, /^# Jane Doe/m);
  assert.match(markdown, /\*\*Staff Engineer\*\*/);
  assert.match(markdown, /jane@example\.com · \+1 555 0100 · Bengaluru, KA, IN/);
  assert.match(markdown, /## Summary\n\nDistributed systems engineer\./);
  assert.match(markdown, /## Experience/);
  assert.match(markdown, /### Staff Engineer at TechCo/);
  assert.match(markdown, /- Scaled platform to 10M DAU/);
  assert.match(markdown, /## Projects/);
  assert.match(markdown, /### JobFoundry — Local job search pipeline/);
  assert.match(markdown, /## Education/);
  assert.match(markdown, /### B\.Tech in Computer Science, State University/);
  assert.match(markdown, /## Skills/);
  assert.match(markdown, /- \*\*Backend\*\*: Node\.js, Go/);
  assert.match(markdown, /## Certifications/);
  assert.match(markdown, /- CKA — CNCF — 2023/);
  assert.ok(markdown.endsWith('\n'));
});

test('renderResumeMarkdown tolerates sparse or malformed resumes', () => {
  assert.equal(renderResumeMarkdown({}), '\n');
  const markdown = renderResumeMarkdown({
    basics: { name: 'Solo' },
    work: [{ highlights: ['Did the thing'] }],
    skills: [],
  });
  assert.match(markdown, /^# Solo/);
  assert.match(markdown, /### Role/);
  assert.match(markdown, /- Did the thing/);
  assert.doesNotMatch(markdown, /## Skills/);
});

test('renderResumeMarkdown preserves tailored labels', () => {
  const markdown = renderResumeMarkdown({
    ...RESUME,
    basics: { ...RESUME.basics, label: 'Principal Platform Engineer' },
  });
  assert.match(markdown, /\*\*Principal Platform Engineer\*\*/);
  assert.doesNotMatch(markdown, /\*\*Staff Engineer\*\*/);
});
