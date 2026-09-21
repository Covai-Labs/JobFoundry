import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { JSDOM } from 'jsdom';

if (typeof DOMParser === 'undefined') {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
}

const EXT = resolve(import.meta.dirname, '..');

const { parseLinkedInJobCards, linkedinSearchProvider } = await import(
  join(EXT, 'src', 'background', 'search', 'linkedin.ts')
);
const { parseIndeedGraphQLResponse, buildIndeedGraphQLQuery } = await import(
  join(EXT, 'src', 'background', 'search', 'indeed.ts')
);
const { parseGlassdoorGraphQLResponse } = await import(
  join(EXT, 'src', 'background', 'search', 'glassdoor.ts')
);
const { parseZipRecruiterResponse } = await import(
  join(EXT, 'src', 'background', 'search', 'ziprecruiter.ts')
);
const { parseGoogleJobsHtml } = await import(join(EXT, 'src', 'background', 'search', 'google.ts'));
const { parseNaukriResponse } = await import(join(EXT, 'src', 'background', 'search', 'naukri.ts'));
const { adzunaSearchProvider } = await import(
  join(EXT, 'src', 'background', 'search', 'adzuna.ts')
);
const { hiringcafeSearchProvider } = await import(
  join(EXT, 'src', 'background', 'search', 'hiringcafe.ts')
);
const { runSearchPipeline } = await import(join(EXT, 'src', 'background', 'search', 'index.ts'));

// 1. LinkedIn Parser Tests
test('LinkedIn: parseLinkedInJobCards extracts jobs from HTML cards', () => {
  const sampleHtml = `
    <div class="base-search-card">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/senior-software-engineer-12345?refId=xyz">
        <span class="sr-only">Senior Software Engineer</span>
      </a>
      <h4 class="base-search-card__subtitle">
        <a href="https://www.linkedin.com/company/stripe">Stripe</a>
      </h4>
      <span class="job-search-card__location">San Francisco, CA</span>
      <span class="job-search-card__salary-info">$180,000 - $220,000</span>
      <time datetime="2026-03-20">1 day ago</time>
    </div>
  `;

  const jobs = parseLinkedInJobCards(sampleHtml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Senior Software Engineer');
  assert.equal(jobs[0].company, 'Stripe');
  assert.equal(jobs[0].location, 'San Francisco, CA');
  assert.equal(jobs[0].url, 'https://www.linkedin.com/jobs/view/senior-software-engineer-12345');
  assert.equal(jobs[0].source, 'linkedin');
});

test('LinkedIn: parseLinkedInJobCards handles empty or invalid HTML', () => {
  assert.deepEqual(parseLinkedInJobCards(''), []);
  assert.deepEqual(parseLinkedInJobCards('<div>No jobs here</div>'), []);
});

test('LinkedIn: linkedinSearchProvider executes search with mock fetch', async () => {
  const mockHtml = `
    <div class="base-search-card">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/frontend-dev-999"></a>
      <h3 class="base-search-card__title">Frontend Developer</h3>
      <h4 class="base-search-card__subtitle">Acme Corp</h4>
      <span class="job-search-card__location">Remote</span>
    </div>
  `;

  const mockFetch = async () => ({
    ok: true,
    text: async () => mockHtml,
  });

  const jobs = await linkedinSearchProvider.search(
    { searchTerm: 'Frontend Developer', resultsWanted: 1 },
    { fetchFn: mockFetch }
  );

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Frontend Developer');
  assert.equal(jobs[0].company, 'Acme Corp');
});

// 2. Indeed Parser Tests
test('Indeed: parseIndeedGraphQLResponse maps structured GraphQL jobs', () => {
  const sampleData = {
    data: {
      jobSearch: {
        pageInfo: { nextCursor: 'cursor_xyz_123' },
        results: [
          {
            job: {
              key: 'indeed_key_001',
              title: 'Full Stack Engineer',
              datePublished: 1711000000000,
              description: { html: '<p>Exciting full stack role with React and Node.</p>' },
              location: {
                formatted: { long: 'Austin, TX, USA' },
              },
              compensation: {
                baseSalary: {
                  range: { min: 140000, max: 170000 },
                },
              },
              source: { name: 'TechCo' },
              recruit: { viewJobUrl: 'https://www.indeed.com/viewjob?jk=indeed_key_001' },
            },
          },
        ],
      },
    },
  };

  const { jobs, nextCursor } = parseIndeedGraphQLResponse(sampleData);
  assert.equal(nextCursor, 'cursor_xyz_123');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Full Stack Engineer');
  assert.equal(jobs[0].company, 'TechCo');
  assert.equal(jobs[0].location, 'Austin, TX, USA');
  assert.equal(jobs[0].url, 'https://www.indeed.com/viewjob?jk=indeed_key_001');
  assert.equal(jobs[0].salaryMin, 140000);
  assert.equal(jobs[0].salaryMax, 170000);
  assert.equal(jobs[0].source, 'indeed');
  assert.ok(jobs[0].description.includes('React and Node'));
});

test('Indeed: buildIndeedGraphQLQuery escapes quotes and backslashes safely', () => {
  const query = buildIndeedGraphQLQuery({
    searchTerm: 'Senior "Go" Developer',
    location: 'Seattle, WA',
  });
  assert.ok(query.includes('\\"Go\\"'));
  assert.ok(query.includes('Seattle, WA'));

  const queryBackslash = buildIndeedGraphQLQuery({ searchTerm: 'Dev C:\\' });
  assert.ok(queryBackslash.includes('\\\\'));
});

// 3. Glassdoor Parser Tests
test('Glassdoor: parseGlassdoorGraphQLResponse maps Apollo GraphQL listings', () => {
  const sampleData = {
    data: {
      jobListings: {
        jobListings: [
          {
            jobview: {
              header: {
                employer: { name: 'DataCorp' },
                jobTitleText: 'Data Scientist',
                locationName: 'New York, NY',
                jobLink: 'https://www.glassdoor.com/job-listing?jl=100800',
                payCurrency: 'USD',
                payPeriodAdjustedPay: { p10: 130000, p90: 165000 },
              },
              job: {
                description: 'Build predictive AI models.',
                listingId: 100800,
              },
            },
          },
        ],
      },
    },
  };

  const jobs = parseGlassdoorGraphQLResponse(sampleData);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Data Scientist');
  assert.equal(jobs[0].company, 'DataCorp');
  assert.equal(jobs[0].location, 'New York, NY');
  assert.equal(jobs[0].url, 'https://www.glassdoor.com/job-listing?jl=100800');
  assert.equal(jobs[0].salaryMin, 130000);
  assert.equal(jobs[0].salaryMax, 165000);
  assert.equal(jobs[0].source, 'glassdoor');
  assert.equal(jobs[0].description, 'Build predictive AI models.');
});

// 4. ZipRecruiter Parser Tests
test('ZipRecruiter: parseZipRecruiterResponse maps mobile API jobs', () => {
  const sampleData = {
    continue: 'token_abc_456',
    jobs: [
      {
        listing_key: 'zr_key_111',
        name: 'DevOps Engineer',
        job_description: 'Manage AWS and Kubernetes clusters.',
        hiring_company: { name: 'CloudScale' },
        job_city: 'Chicago',
        job_state: 'IL',
        job_country: 'US',
        compensation_min: 120000,
        compensation_max: 150000,
        compensation_currency: 'USD',
        posted_time: '2026-03-19T12:00:00Z',
      },
    ],
  };

  const { jobs, nextContinue } = parseZipRecruiterResponse(sampleData);
  assert.equal(nextContinue, 'token_abc_456');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'DevOps Engineer');
  assert.equal(jobs[0].company, 'CloudScale');
  assert.equal(jobs[0].location, 'Chicago, IL, US');
  assert.equal(jobs[0].url, 'https://www.ziprecruiter.com/jobs//j?lvk=zr_key_111');
  assert.equal(jobs[0].salaryMin, 120000);
  assert.equal(jobs[0].source, 'ziprecruiter');
});

// 5. Google Jobs Parser Tests
test('Google Jobs: parseGoogleJobsHtml extracts JobPosting JSON-LD', () => {
  const sampleHtml = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org/",
            "@type": "JobPosting",
            "title": "Cloud Architect",
            "description": "Architect multicloud solutions",
            "datePosted": "2026-03-21",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "GlobalTech"
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "addressLocality": "London",
                "addressCountry": "UK"
              }
            },
            "url": "https://example.com/jobs/cloud-architect"
          }
        </script>
      </head>
    </html>
  `;

  const jobs = parseGoogleJobsHtml(sampleHtml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Cloud Architect');
  assert.equal(jobs[0].company, 'GlobalTech');
  assert.equal(jobs[0].location, 'London');
  assert.equal(jobs[0].url, 'https://example.com/jobs/cloud-architect');
  assert.equal(jobs[0].source, 'google');
});

// 6. Naukri Parser Tests
test('Naukri: parseNaukriResponse maps jobDetails array', () => {
  const sampleData = {
    jobDetails: [
      {
        jobId: '12345678',
        title: 'Python Developer',
        companyName: 'Infosys',
        jdURL: '/job-listings-python-dev-12345678',
        jobDescription: 'Build high-performance Python microservices.',
        placeholders: [{ type: 'location', label: 'Bengaluru' }],
      },
    ],
  };

  const jobs = parseNaukriResponse(sampleData);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Python Developer');
  assert.equal(jobs[0].company, 'Infosys');
  assert.equal(jobs[0].location, 'Bengaluru');
  assert.equal(jobs[0].url, 'https://www.naukri.com/job-listings-python-dev-12345678');
  assert.equal(jobs[0].source, 'naukri');
});

// 7. runSearchPipeline Orchestrator Tests
test('runSearchPipeline: returns error if no search terms configured', async () => {
  const result = await runSearchPipeline({
    getConfig: async () => ({ titleFilter: { positive: [] } }),
    searchTerms: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.totalFound, 0);
  assert.ok(result.errors[0].includes('No search terms configured'));
});

test('runSearchPipeline: executes search across enabled boards, deduplicates, and sends to ingest', async () => {
  const mockLinkedInHtml = `
    <div class="base-search-card">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/lead-eng-1"></a>
      <span class="sr-only">Lead Software Engineer</span>
      <h4 class="base-search-card__subtitle">Vercel</h4>
      <span class="job-search-card__location">Remote</span>
    </div>
    <div class="base-search-card">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/lead-eng-duplicate"></a>
      <span class="sr-only">Lead Software Engineer Duplicate</span>
      <h4 class="base-search-card__subtitle">Vercel</h4>
      <span class="job-search-card__location">Remote</span>
    </div>
  `;

  let sentPayload = null;
  const mockSendJobs = async (payload) => {
    sentPayload = payload;
    return { ok: true };
  };

  const mockFetch = async (url) => {
    if (typeof url === 'string' && url.includes('linkedin.com')) {
      return { ok: true, text: async () => mockLinkedInHtml };
    }
    // Return empty for other providers
    return { ok: true, json: async () => ({ data: {} }), text: async () => '' };
  };

  const mockFingerprint = async () => {
    // Both jobs share the exact same description -> duplicate fingerprint
    return 'duplicate_simhash_fp_1234';
  };

  const result = await runSearchPipeline({
    searchTerms: ['Lead Software Engineer'],
    enabledBoards: ['linkedin'],
    fetchFn: mockFetch,
    fingerprint: mockFingerprint,
    sendJobs: mockSendJobs,
  });

  assert.equal(result.ok, true);
  assert.equal(result.totalFound, 2);
  // Second job had identical fingerprint -> dropped by in-batch dedup
  assert.equal(result.droppedDedup, 1);
  assert.equal(result.newIngested, 1);
  assert.equal(sentPayload.jobs.length, 1);
  assert.equal(sentPayload.jobs[0].title, 'Lead Software Engineer');
  assert.equal(sentPayload.jobs[0].source, 'linkedin');
});

// 7. Adzuna Provider Tests
test('Adzuna: skips search gracefully when credentials are not configured', async () => {
  const jobs = await adzunaSearchProvider.search({
    searchTerm: 'React Developer',
  });
  assert.deepEqual(jobs, []);
});

test('Adzuna: executes API search when appId and appKey are configured', async () => {
  const mockApiResponse = {
    results: [
      {
        id: '12345678',
        title: '<strong>Senior</strong> Frontend Engineer',
        redirect_url: 'https://www.adzuna.com/land/ad/12345678',
        company: { display_name: 'Tech Corp' },
        location: { display_name: 'Bangalore, India' },
        description: 'We are looking for a Senior Frontend Engineer with React experience.',
        salary_min: 1500000,
        salary_max: 2200000,
        created: '2026-09-20T10:00:00Z',
      },
    ],
  };

  let requestedUrl = '';
  const mockFetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      json: async () => mockApiResponse,
    };
  };

  const jobs = await adzunaSearchProvider.search(
    {
      searchTerm: 'Frontend Engineer',
      adzunaAppId: 'test_app_id',
      adzunaAppKey: '6d80dc8dee6b79122aeff578491e7f85',
      adzunaCountry: 'in',
    },
    { fetchFn: mockFetch }
  );

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Senior Frontend Engineer'); // stripped HTML
  assert.equal(jobs[0].company, 'Tech Corp');
  assert.equal(jobs[0].location, 'Bangalore, India');
  assert.equal(jobs[0].url, 'https://www.adzuna.com/land/ad/12345678');
  assert.equal(jobs[0].salaryMin, 1500000);
  assert.equal(jobs[0].salaryMax, 2200000);
  assert.equal(jobs[0].source, 'adzuna');
  assert.ok(requestedUrl.includes('api.adzuna.com/v1/api/jobs/in/search/1'));
  assert.ok(requestedUrl.includes('app_id=test_app_id'));
  assert.ok(requestedUrl.includes('app_key=6d80dc8dee6b79122aeff578491e7f85'));
});

// 8. HiringCafe Provider Tests
test('HiringCafe: extracts direct ATS apply links and pre-parsed salary from SSR HTML', async () => {
  const mockSsrHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>HiringCafe</title></head>
      <body>
        <script id="__NEXT_DATA__" type="application/json">
        {
          "buildId": "test_build_id_123",
          "props": {
            "pageProps": {
              "ssrHits": [
                {
                  "objectID": "icims_12345",
                  "apply_url": "https://company.greenhouse.io/jobs/998877",
                  "job_information": {
                    "title": "Principal Infrastructure Engineer"
                  },
                  "attributed_org": {
                    "name": "Cloud Native Labs"
                  },
                  "v5_processed_job_data": {
                    "core_job_title": "Infrastructure Engineer",
                    "formatted_workplace_location": "Remote, US",
                    "requirements_summary": "Kubernetes, Go, Terraform, 7+ years experience.",
                    "yearly_min_compensation": 190000,
                    "yearly_max_compensation": 240000,
                    "listed_compensation_currency": "USD",
                    "estimated_publish_date": "2026-09-21T08:00:00.000Z"
                  }
                }
              ],
              "ssrPage": 0,
              "ssrTotalCount": 1
            }
          }
        }
        </script>
      </body>
    </html>
  `;

  let requestedUrl = '';
  const mockFetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      text: async () => mockSsrHtml,
      json: async () => ({}),
    };
  };

  const jobs = await hiringcafeSearchProvider.search(
    {
      searchTerm: 'Infrastructure Engineer',
      isRemote: true,
    },
    { fetchFn: mockFetch }
  );

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Principal Infrastructure Engineer');
  assert.equal(jobs[0].company, 'Cloud Native Labs');
  assert.equal(jobs[0].location, 'Remote, US');
  // Crucial: Direct ATS apply link is preserved
  assert.equal(jobs[0].url, 'https://company.greenhouse.io/jobs/998877');
  assert.equal(jobs[0].salaryMin, 190000);
  assert.equal(jobs[0].salaryMax, 240000);
  assert.equal(jobs[0].salaryCurrency, 'USD');
  assert.equal(jobs[0].description, 'Kubernetes, Go, Terraform, 7+ years experience.');
  assert.equal(jobs[0].source, 'hiringcafe');
  assert.ok(requestedUrl.includes('hiringcafe.com/?searchState='));
});
