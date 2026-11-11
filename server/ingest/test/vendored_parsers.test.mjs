import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { atsVendorOf, KNOWN_ATS_VENDORS } from '../src/vendored/ats-vendor.mjs';
import { normalizeUrl, isAggregatorUrl, aggregatorPostingId } from '../src/vendored/url-key.mjs';
import { extractSkills, canonicalize } from '../src/vendored/skill-extract.mjs';
import { buildTitleFilter } from '../src/vendored/title-keywords.mjs';
import {
  validatePayloadShape,
  foldCompetencies,
  lintPayload,
} from '../src/vendored/ats-payload.mjs';
import { flagValue, hasFlag, safeIntFlag } from '../src/vendored/lib/cli-flags.mjs';
import { normalizeJob } from '../src/jobs/normalize.mjs';
import { heuristicParseJd } from '../src/jobs/parse-jd.mjs';
import { analyzeRepost } from '../src/jobs/detect-reposts.mjs';

test('atsVendorOf detects major ATS platforms and falls back safely', () => {
  assert.equal(atsVendorOf('https://boards.greenhouse.io/acme/jobs/123'), 'greenhouse');
  assert.equal(atsVendorOf('https://jobs.lever.co/company/abc-123'), 'lever');
  assert.equal(atsVendorOf('https://jobs.ashbyhq.com/org/456'), 'ashby');
  assert.equal(atsVendorOf('https://acme.myworkdayjobs.com/en-US/careers/job/1'), 'workday');
  assert.equal(atsVendorOf('https://careers-company.icims.com/jobs/789/job'), 'icims');
  assert.equal(
    atsVendorOf('https://us.dayforcehcm.com/CandidatePortal/en-US/co/Posting/View/1'),
    'dayforce'
  );
  assert.equal(atsVendorOf('https://jobs.smartrecruiters.com/Co/123'), 'smartrecruiters');
  assert.equal(atsVendorOf('https://co.bamboohr.com/careers/1'), 'bamboohr');

  // Long tail unmapped host
  assert.equal(
    atsVendorOf('https://careers.custom-domain.org/jobs/42'),
    'careers.custom-domain.org'
  );

  // Invalid / non-HTTP URLs
  assert.equal(atsVendorOf(''), null);
  assert.equal(atsVendorOf('not-a-url'), null);
  assert.equal(atsVendorOf('file:///etc/passwd'), null);
  assert.equal(atsVendorOf(null), null);
});

test('KNOWN_ATS_VENDORS contains all supported vendor keys', () => {
  assert.ok(KNOWN_ATS_VENDORS.includes('greenhouse'));
  assert.ok(KNOWN_ATS_VENDORS.includes('lever'));
  assert.ok(KNOWN_ATS_VENDORS.includes('ashby'));
  assert.ok(KNOWN_ATS_VENDORS.includes('workday'));
});

test('normalizeUrl strips tracking query parameters and canonicalizes URLs', () => {
  const dirty =
    'https://example.com/jobs/42/?utm_source=linkedin&utm_medium=feed&gh_src=campaign#header';
  const clean = normalizeUrl(dirty);
  assert.equal(clean, 'https://example.com/jobs/42');

  const withFunctional = 'https://boards.greenhouse.io/acme/jobs/42?gh_jid=999&utm_campaign=winter';
  assert.equal(
    normalizeUrl(withFunctional),
    'https://boards.greenhouse.io/acme/jobs/42?gh_jid=999'
  );

  // Invalid / placeholder URLs return empty string (RFC 3986 / 3VL)
  assert.equal(normalizeUrl('N/A'), '');
  assert.equal(normalizeUrl('TBD'), '');
  assert.equal(normalizeUrl(''), '');
  assert.equal(normalizeUrl(null), '');
});

test('isAggregatorUrl identifies multi-employer boards and scrapers', () => {
  // Built-in supplement
  assert.equal(isAggregatorUrl('https://www.linkedin.com/jobs/view/12345'), true);
  assert.equal(isAggregatorUrl('https://indeed.com/viewjob?jk=abcdef'), true);

  // Static aggregator-domains.txt list
  assert.equal(isAggregatorUrl('https://builtin.com/job/senior-developer/123'), true);
  assert.equal(isAggregatorUrl('https://www.adzuna.com/details/456'), true);
  assert.equal(isAggregatorUrl('https://jooble.org/desc/789'), true);

  // Direct employer board
  assert.equal(isAggregatorUrl('https://boards.greenhouse.io/stripe/jobs/1'), false);
  assert.equal(isAggregatorUrl('https://careers.google.com/jobs/results/1'), false);
});

test('aggregatorPostingId extracts requisition ID from LinkedIn and Indeed', () => {
  assert.deepEqual(aggregatorPostingId('https://www.linkedin.com/jobs/view/3928172910'), {
    domain: 'linkedin.com',
    id: '3928172910',
  });
  assert.deepEqual(aggregatorPostingId('https://indeed.com/viewjob?jk=abc123xyz'), {
    domain: 'indeed.com',
    id: 'abc123xyz',
  });
  assert.equal(aggregatorPostingId('https://stripe.com/jobs/123'), null);
});

test('extractSkills recognizes hard skills, frameworks, cloud tools, and credentials', () => {
  const text = `
    Looking for a Staff Engineer with strong TypeScript, Python, and Golang expertise.
    Required: deep experience with Kubernetes, Docker, PostgreSQL, and Kafka.
    Preferred: AWS, Terraform, and PyTorch or LLMs for generative AI.
    Bonus: PMP or Certified ScrumMaster certification.
  `;
  const skills = extractSkills(text);
  assert.ok(skills.has('TypeScript'));
  assert.ok(skills.has('Python'));
  assert.ok(skills.has('Go'));
  assert.ok(!skills.has('Golang'));
  assert.ok(skills.has('Kubernetes'));
  assert.ok(skills.has('Docker'));
  assert.ok(skills.has('PostgreSQL'));
  assert.ok(skills.has('Kafka'));
  assert.ok(skills.has('AWS'));
  assert.ok(skills.has('Terraform'));
  assert.ok(skills.has('PyTorch'));

  assert.equal(canonicalize('k8s'), 'Kubernetes');
  assert.equal(canonicalize('golang'), 'Go');
  assert.equal(canonicalize('postgres'), 'PostgreSQL');
  assert.equal(canonicalize('node.js'), 'Node.js');
});

test('buildTitleFilter compiles complex title rules with prefixes and AND-groups', () => {
  const filter = buildTitleFilter({
    positive: ['engineer + python', 'word:lead', 'stem:architect'],
    negative: ['intern', 'junior'],
  });

  assert.equal(filter('Python Backend Engineer'), true);
  assert.equal(filter('Lead System Developer'), true);
  assert.equal(filter('Architectural Specialist'), true);
  assert.equal(filter('Junior Python Engineer'), false); // negative veto
  assert.equal(filter('Python Intern'), false); // negative veto
  assert.equal(filter('Sales Manager'), false); // does not match positive
});

test('normalizeJob automatically populates source from known ATS and cleans tracking URLs', () => {
  const greenhouseJob = normalizeJob({
    title: 'Staff Software Engineer',
    company: 'Anthropic',
    url: 'https://boards.greenhouse.io/anthropic/jobs/5555?utm_source=twitter&utm_medium=social',
  });
  assert.equal(greenhouseJob.source, 'greenhouse');
  assert.equal(greenhouseJob.url, 'https://boards.greenhouse.io/anthropic/jobs/5555');

  const ashbyJob = normalizeJob({
    title: 'Full Stack Engineer',
    company: 'Linear',
    url: 'https://jobs.ashbyhq.com/linear/9999',
  });
  assert.equal(ashbyJob.source, 'ashby');

  // Explicit user source takes precedence
  const customJob = normalizeJob({
    title: 'Engineer',
    company: 'Acme',
    url: 'https://boards.greenhouse.io/acme/jobs/1',
    source: 'custom-scanner',
  });
  assert.equal(customJob.source, 'custom-scanner');
});

test('heuristicParseJd returns extracted skills alongside requirements', () => {
  const text = `# Senior AI Engineer at Acme
Location: New York, NY
Requirements:
- 5+ years with Python and TypeScript
- Production experience with Docker and Kubernetes
- Familiarity with AWS and Redis
`;
  const result = heuristicParseJd({ text, url: 'https://example.com/job/1' });
  assert.ok(Array.isArray(result.skills));
  assert.ok(result.skills.includes('Python'));
  assert.ok(result.skills.includes('TypeScript'));
  assert.ok(result.skills.includes('Docker'));
  assert.ok(result.skills.includes('Kubernetes'));
});

test('analyzeRepost skips clustering across multi-employer aggregators', () => {
  const current = {
    title: 'Software Engineer',
    company: 'Various',
    url: 'https://builtin.com/jobs/software-engineer/1',
    posted_at: Date.now(),
  };
  const history = [
    {
      id: 'job-1',
      title: 'Software Engineer',
      company: 'Various',
      url: 'https://builtin.com/jobs/software-engineer/2',
      posted_at: Date.now() - 60 * 86400 * 1000,
    },
  ];

  const analysis = analyzeRepost(current, history);
  assert.equal(analysis.isRepost, false);
  assert.equal(analysis.confidence, 'none');
});

test('vendor-career-ops sync script verifies zero drift in --check mode and rejects incomplete source', () => {
  const rootDir = resolve(import.meta.dirname, '../../..');
  const careerOpsPath = resolve(rootDir, '../Scratch/career-ops');
  if (existsSync(careerOpsPath)) {
    const stdout = execFileSync(
      process.execPath,
      ['scripts/vendor-career-ops.mjs', '--from', careerOpsPath, '--check'],
      { cwd: rootDir, encoding: 'utf8' }
    );
    assert.ok(stdout.includes('Sync check passed'));
  }

  // Verify missing upstream source files fail with status 1
  const emptyDir = mkdtempSync(join(tmpdir(), 'career-ops-test-'));
  try {
    assert.throws(
      () => {
        execFileSync(process.execPath, ['scripts/vendor-career-ops.mjs', '--from', emptyDir], {
          cwd: rootDir,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      },
      (err) => err.status === 1
    );
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

test('ats-payload validates payload shape, folds competencies idempotently, and lints', () => {
  const valid = {
    skills: [{ category: 'Languages', items: ['TypeScript', 'Go'] }],
    experience: [{ company: 'Acme', role: 'Engineer' }],
    competencies: ['Distributed Systems', 'Cloud'],
  };
  const errors = validatePayloadShape(valid);
  assert.deepEqual(errors, []);

  // Fold competencies
  const { payload: folded, transform } = foldCompetencies(valid);
  assert.equal(transform.applied, true);
  const compCat = folded.skills.find((s) => s.category === 'Core Competencies');
  assert.ok(compCat);
  assert.ok(compCat.items.includes('Distributed Systems'));

  // Idempotence: folding twice produces identical payload
  const { payload: doubleFolded, transform: secondTransform } = foldCompetencies(folded);
  assert.equal(secondTransform.applied, false);
  assert.deepEqual(doubleFolded.skills, folded.skills);

  // Linting findings
  const trickyPayload = {
    experience: [{ company: 'Acme (Cloud Division)', role: 'Senior Developer at Acme' }],
  };
  const findings = lintPayload(trickyPayload);
  assert.ok(findings.some((f) => f.code === 'parenthetical-in-company'));
  assert.ok(findings.some((f) => f.code === 'employer-in-role'));
});

test('cli-flags handles flag values, boolean presence, and safe integers', () => {
  assert.equal(flagValue(['--file', 'cv.json'], '--file'), 'cv.json');
  assert.equal(flagValue(['--file=cv.json'], '--file'), 'cv.json');
  assert.equal(flagValue(['--other'], '--file'), undefined);

  assert.equal(hasFlag(['--yes'], '--yes'), true);
  assert.equal(hasFlag(['--file=test'], '--file'), true);
  assert.equal(hasFlag(['--dry-run'], '--yes'), false);

  assert.equal(safeIntFlag('42', 10), 42);
  assert.equal(safeIntFlag('-5', 10), 10);
  assert.equal(safeIntFlag('not-a-number', 10), 10);
  assert.equal(safeIntFlag(undefined, 10), 10);
});

test('ATS template and machine-readable rules exist and have valid structure', () => {
  const rootDir = resolve(import.meta.dirname, '../../..');
  const templateHtml = resolve(rootDir, 'templates/ats/cv-template.ats.html');
  const rulesYml = resolve(rootDir, 'templates/ats-rules.yml');

  assert.ok(existsSync(templateHtml), 'cv-template.ats.html must exist');
  assert.ok(existsSync(rulesYml), 'ats-rules.yml must exist');

  const htmlContent = readFileSync(templateHtml, 'utf8');
  assert.ok(htmlContent.includes('{{NAME}}'));
  assert.ok(htmlContent.includes('ATS Friendly'));

  const rulesContent = readFileSync(rulesYml, 'utf8');
  assert.ok(rulesContent.includes('rules:'));
  assert.ok(rulesContent.includes('single-column-layout'));
});
