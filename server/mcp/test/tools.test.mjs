import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.mjs';

const RESUME = {
  basics: { name: 'Alice Developer', email: 'alice@example.com' },
  skills: [
    { name: 'Languages', keywords: ['TypeScript', 'Go'] },
    { name: 'Platform', keywords: ['SQLite'] },
  ],
  work: [{ name: 'Tech Corp', position: 'Staff Engineer', startDate: '2020-01-01' }],
};

const JOB = {
  id: 'job_1',
  title: 'Staff Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  source: 'greenhouse',
  url: 'https://acme.example/j1',
  status: 'new',
  fit_score: 88,
  fit_notes: JSON.stringify({
    reasoning: 'Strong match',
    matching_skills: ['Go'],
    missing_skills: ['Rust'],
    is_valid_job: true,
    is_truncated: false,
  }),
  liveness: 'live',
  posted_at: 1,
  created_at: 2,
  updated_at: 3,
};

function fakeClient(overrides = {}) {
  const calls = [];
  return {
    calls,
    async getActiveResume() {
      return {
        resume: {
          id: 'res_1',
          title: 'Master Resume',
          isActive: true,
          created_at: 1,
          updated_at: 2,
          resume: RESUME,
        },
      };
    },
    async listJobs(params) {
      calls.push(['listJobs', params]);
      return { jobs: [JOB] };
    },
    async getJob(id) {
      calls.push(['getJob', id]);
      return { job: { ...JOB, id } };
    },
    async tailorJob(id, options) {
      calls.push(['tailorJob', id, options]);
      return {
        ok: true,
        tailored_resume_id: 'tailored-1',
        job: { ...JOB, id, status: 'tailored' },
      };
    },
    async updateJobStatus(id, status) {
      calls.push(['updateJobStatus', id, status]);
      return { job: { ...JOB, id, status } };
    },
    artifactUrl(id, filename) {
      return `https://api.test/api/v1/jobs/${id}/artifacts/${filename}`;
    },
    ...overrides,
  };
}

async function connect(clientImpl) {
  const server = createServer({ client: clientImpl, version: '0.0.0-test' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content.find((item) => item.type === 'text')?.text ?? '';
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  return { isError: Boolean(result.isError), data };
}

test('lists exactly the five required tools', async (t) => {
  const { server, client } = await connect(fakeClient());
  t.after(() => server.close());

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'generate_tailored_resume',
    'get_job_fit_score',
    'get_profile',
    'search_saved_jobs',
    'update_application_status',
  ]);
  const readOnly = tools.filter((tool) => tool.annotations?.readOnlyHint).map((tool) => tool.name);
  assert.deepEqual(readOnly.sort(), ['get_job_fit_score', 'get_profile', 'search_saved_jobs']);
});

test('get_profile returns metadata, resume, skills, and experience', async (t) => {
  const { server, client } = await connect(fakeClient());
  t.after(() => server.close());

  const { isError, data } = await call(client, 'get_profile');
  assert.equal(isError, false);
  assert.equal(data.profile.title, 'Master Resume');
  assert.equal(data.profile.resume_json, undefined);
  assert.equal(data.resume.basics.name, 'Alice Developer');
  assert.deepEqual(data.skills, ['Go', 'SQLite', 'TypeScript']);
  assert.deepEqual(data.experience, [
    { position: 'Staff Engineer', company: 'Tech Corp', startDate: '2020-01-01', endDate: '' },
  ]);
});

test('get_profile handles a missing active resume without an error', async (t) => {
  const { server, client } = await connect(
    fakeClient({
      async getActiveResume() {
        return { resume: null };
      },
    })
  );
  t.after(() => server.close());

  const { isError, data } = await call(client, 'get_profile');
  assert.equal(isError, false);
  assert.equal(data.profile, null);
  assert.match(data.message, /master resume/i);
});

test('search_saved_jobs normalizes aliases and omits descriptions', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'search_saved_jobs', {
    status: 'discovered',
    company: 'Acme Corp',
    limit: 5,
  });
  assert.equal(isError, false);
  assert.equal(data.count, 1);
  assert.equal(data.jobs[0].description, undefined);
  const params = impl.calls.find(([name]) => name === 'listJobs')[1];
  assert.equal(params.status, 'new');
  assert.equal(params.company, 'Acme Corp');
  assert.equal(params.limit, 5);
});

test('search_saved_jobs rejects unknown statuses', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'search_saved_jobs', { status: 'nonsense' });
  assert.equal(isError, true);
  assert.match(data.message, /Unknown status/);
  assert.equal(impl.calls.length, 0);
});

test('get_job_fit_score returns breakdown and unscored states', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const scored = await call(client, 'get_job_fit_score', { job_id: 'job_1' });
  assert.equal(scored.isError, false);
  assert.equal(scored.data.scored, true);
  assert.equal(scored.data.breakdown.matching_skills[0], 'Go');
  assert.equal(scored.data.job.fit_notes, undefined);

  impl.getJob = async (id) => ({ job: { ...JOB, id, fit_score: null, fit_notes: null } });
  const unscored = await call(client, 'get_job_fit_score', { job_id: 'job_1' });
  assert.equal(unscored.data.scored, false);
  assert.match(unscored.data.message, /not been scored/i);
});

test('get_job_fit_score surfaces scorer errors and malformed notes', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  impl.getJob = async (id) => ({
    job: { ...JOB, id, fit_score: null, fit_notes: JSON.stringify({ error: 'LLM unavailable' }) },
  });
  const errored = await call(client, 'get_job_fit_score', { job_id: 'job_1' });
  assert.equal(errored.isError, false);
  assert.equal(errored.data.scored, false);
  assert.match(errored.data.error, /LLM unavailable/);

  impl.getJob = async (id) => ({ job: { ...JOB, id, fit_score: null, fit_notes: 'not-json' } });
  const malformed = await call(client, 'get_job_fit_score', { job_id: 'job_1' });
  assert.equal(malformed.isError, false);
  assert.equal(malformed.data.scored, false);
  assert.equal(malformed.data.raw_fit_notes, 'not-json');
});

test('update_application_status accepts aliases and writes canonical values', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'update_application_status', {
    job_id: 'job_1',
    status: 'interviewing',
  });
  assert.equal(isError, false);
  assert.equal(data.status, 'interview');
  assert.deepEqual(impl.calls.at(-1), ['updateJobStatus', 'job_1', 'interview']);
});

test('update_application_status rejects internal failure stages', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  for (const status of ['score_failed', 'tailor_failed', 'nonsense']) {
    const { isError, data } = await call(client, 'update_application_status', {
      job_id: 'job_1',
      status,
    });
    assert.equal(isError, true);
    assert.match(data.message, /Unknown application status/);
  }
  assert.equal(impl.calls.length, 0);
});

test('generate_tailored_resume passes the timeout and returns artifact URLs', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'generate_tailored_resume', {
    job_id: 'job_1',
    timeout_seconds: 120,
  });
  assert.equal(isError, false);
  assert.equal(data.ok, true);
  assert.equal(data.tailored_resume_id, 'tailored-1');
  assert.equal(data.job.status, 'tailored');
  assert.equal(data.artifacts.pdf, 'https://api.test/api/v1/jobs/job_1/artifacts/resume.pdf');
  assert.deepEqual(impl.calls.at(-1), ['tailorJob', 'job_1', { timeoutMs: 120000 }]);
});

test('search_saved_jobs applies schema defaults when arguments are omitted', async (t) => {
  const impl = fakeClient();
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError } = await call(client, 'search_saved_jobs');
  assert.equal(isError, false);
  const params = impl.calls.find(([name]) => name === 'listJobs')[1];
  assert.equal(params.sort_by, 'updated_at');
  assert.equal(params.order, 'desc');
  assert.equal(params.limit, 25);
  assert.equal(params.status, undefined);
  assert.equal(params.company, undefined);
});

test('API failures become actionable tool errors', async (t) => {
  const impl = fakeClient({
    async tailorJob() {
      const error = new Error('No API key configured — go to Settings to add your LLM key.');
      throw error;
    },
  });
  const { server, client } = await connect(impl);
  t.after(() => server.close());

  const { isError, data } = await call(client, 'generate_tailored_resume', { job_id: 'job_1' });
  assert.equal(isError, true);
  assert.match(data.message, /No API key configured/);
});

test('maps 401 and timeout failures to actionable messages', async (t) => {
  const unauthorized = fakeClient({
    async getActiveResume() {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    },
  });
  const first = await connect(unauthorized);
  t.after(() => first.server.close());
  const denied = await call(first.client, 'get_profile');
  assert.equal(denied.isError, true);
  assert.match(denied.data.message, /JOBFOUNDRY_API_KEY/);

  const timedOut = fakeClient({
    async tailorJob() {
      throw new Error('Request to JobFoundry timed out after 900s');
    },
  });
  const second = await connect(timedOut);
  t.after(() => second.server.close());
  const timeout = await call(second.client, 'generate_tailored_resume', { job_id: 'job_1' });
  assert.equal(timeout.isError, true);
  assert.match(timeout.data.message, /timed out/);
});
