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
    profiles: [{ network: 'GitHub', username: 'janedoe', url: 'https://github.com/janedoe' }],
  },
  work: [
    {
      name: 'TechCo',
      position: 'Staff Engineer',
      startDate: '2020-01-01',
      highlights: ['Scaled platform to 10M DAU', 'Cut p99 latency by 40%'],
    },
  ],
  volunteer: [
    {
      organization: 'Code for India',
      position: 'Mentor',
      startDate: '2019',
      highlights: ['Mentored 12 engineers'],
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
  publications: [
    {
      name: 'Scaling Job Queues',
      publisher: 'ACM Queue',
      releaseDate: '2024',
      url: 'https://example.com/paper',
    },
  ],
  interests: [{ name: 'Distributed Systems', keywords: ['consensus', 'queues'] }],
  references: [{ name: 'Alex Kim', reference: 'Jane is an exceptional engineer.' }],
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
  assert.match(markdown, /## Profiles/);
  assert.match(markdown, /- GitHub: janedoe — https:\/\/github\.com\/janedoe/);
  assert.match(markdown, /## Volunteer/);
  assert.match(markdown, /### Mentor at Code for India/);
  assert.match(markdown, /- Mentored 12 engineers/);
  assert.match(markdown, /## Publications/);
  assert.match(markdown, /- Scaling Job Queues — ACM Queue — 2024/);
  assert.match(markdown, /## Interests/);
  assert.match(markdown, /- Distributed Systems: consensus, queues/);
  assert.match(markdown, /## References/);
  assert.match(markdown, /### Alex Kim/);
  assert.match(markdown, /Jane is an exceptional engineer\./);
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

test('renderResumeMarkdown ignores null and malformed section entries', () => {
  const markdown = renderResumeMarkdown({
    basics: { name: 'Null Safe' },
    work: [null, { position: 'Engineer' }, 'nope'],
    projects: [null],
    education: [null, { institution: 'State University' }],
    skills: [null, { name: 'Ops', keywords: ['K8s'] }],
    volunteer: [null],
    publications: [null],
    interests: [null],
    references: [null, { name: 'Sam', reference: 'Great work.' }],
  });

  assert.match(markdown, /^# Null Safe/);
  assert.match(markdown, /### Engineer/);
  assert.match(markdown, /### State University/);
  assert.match(markdown, /- \*\*Ops\*\*: K8s/);
  assert.match(markdown, /### Sam/);
  assert.match(markdown, /Great work\./);
});

test('renderResumeMarkdown preserves tailored labels', () => {
  const markdown = renderResumeMarkdown({
    ...RESUME,
    basics: { ...RESUME.basics, label: 'Principal Platform Engineer' },
  });
  assert.match(markdown, /\*\*Principal Platform Engineer\*\*/);
  assert.doesNotMatch(markdown, /\*\*Staff Engineer\*\*/);
});
