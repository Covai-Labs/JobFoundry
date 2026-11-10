import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { openDb } from '../../ingest/src/db/index.mjs';
import { buildApp } from '../../ingest/src/app.mjs';

const RESUME = {
  basics: {
    name: 'Alice Developer',
    label: 'Staff Engineer',
    email: 'alice@example.com',
    summary: 'Distributed systems engineer.',
  },
  skills: [
    { name: 'Languages', keywords: ['Go', 'TypeScript'] },
    { name: 'Platform', keywords: ['SQLite', 'Kubernetes'] },
  ],
  work: [
    {
      name: 'Tech Corp',
      position: 'Staff Engineer',
      startDate: '2020-01-01',
      highlights: ['Scaled streaming platform'],
    },
  ],
};

const JOB_A = {
  title: 'Staff Platform Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  url: 'https://acme.example/jobs/1',
  source: 'greenhouse',
  postedAt: '2026-11-01T00:00:00Z',
  description:
    'We need a Staff Platform Engineer with Go, TypeScript, SQLite, and Kubernetes experience.',
};

const JOB_B = {
  title: 'Backend Engineer',
  company: 'Beta Inc',
  location: 'Berlin, DE',
  url: 'https://beta.example/jobs/2',
  source: 'lever',
  postedAt: '2026-11-02T00:00:00Z',
  description: 'Backend role focused on Rust, Kafka, and distributed systems.',
};

function textOf(result) {
  return result.content.find((item) => item.type === 'text')?.text ?? '';
}

test('MCP stdio server executes all five tools against a temp SQLite database', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jobfoundry-mcp-e2e-'));
  const artifactsDir = join(tmpDir, 'artifacts');
  const db = openDb({ path: join(tmpDir, 'jobfoundry.db') });

  const tailorServer = createHttpServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/v1/tailor') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          pdf_base64: Buffer.from('%PDF-1.4\n% JobFoundry MCP test\n').toString('base64'),
          plain_text: 'TAILORED PLAIN TEXT',
          resume: payload.resume,
        })
      );
    });
  });
  await new Promise((resolveListen) => tailorServer.listen(0, '127.0.0.1', resolveListen));
  const previousTailorPort = process.env.TAILOR_PORT;
  process.env.TAILOR_PORT = String(tailorServer.address().port);

  const app = buildApp({
    db,
    apiKeys: [],
    artifactsDir,
    logger: false,
  });
  const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

  const client = new Client({ name: 'jobfoundry-mcp-e2e', version: '0.0.0' });

  t.after(async () => {
    await client.close().catch(() => {});
    await app.close();
    await new Promise((resolveClose) => tailorServer.close(resolveClose));
    db.close();
    if (previousTailorPort === undefined) delete process.env.TAILOR_PORT;
    else process.env.TAILOR_PORT = previousTailorPort;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // Register a real user: the MCP server authenticates with that user's API key,
  // exactly as a dashboard user would copy it from Settings.
  const registerRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'alice@example.com', password: 'password123', name: 'Alice Developer' },
  });
  assert.equal(registerRes.statusCode, 201);
  const registered = registerRes.json();
  const apiKey = registered.user.apiKey;
  const userId = registered.user.id;
  const auth = { authorization: `Bearer ${apiKey}` };

  // A registered user must supply their own LLM key before tailoring runs.
  db.prepare('INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)').run(
    userId,
    'default_llm_api_key',
    'test-llm-key',
    Date.now()
  );

  const resumeRes = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes',
    headers: auth,
    payload: { title: 'Master Resume', resumeJson: RESUME, setActive: true },
  });
  assert.equal(resumeRes.statusCode, 201);

  const ingestRes = await app.inject({
    method: 'POST',
    url: '/api/v1/jobs/ingest',
    headers: auth,
    payload: [JOB_A, JOB_B],
  });
  assert.equal(ingestRes.statusCode, 200);
  const [jobA, jobB] = ingestRes.json().ids;

  db.prepare(
    'UPDATE user_jobs SET fit_score = ?, fit_notes = ? WHERE user_id = ? AND job_id = ?'
  ).run(
    88,
    JSON.stringify({
      reasoning: 'Strong platform match',
      matching_skills: ['Go', 'SQLite'],
      missing_skills: ['Kubernetes operators'],
      is_valid_job: true,
      is_truncated: false,
    }),
    userId,
    jobA
  );

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(import.meta.dirname, '../src/index.mjs')],
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)),
      JOBFOUNDRY_URL: baseUrl,
      JOBFOUNDRY_API_KEY: apiKey,
    },
    stderr: 'pipe',
  });
  const stderrChunks = [];
  transport.stderr?.on('data', (chunk) => stderrChunks.push(chunk));
  await client.connect(transport);

  const list = await client.listTools();
  assert.deepEqual(list.tools.map((tool) => tool.name).sort(), [
    'generate_tailored_resume',
    'get_job_fit_score',
    'get_profile',
    'search_saved_jobs',
    'update_application_status',
  ]);

  const profile = JSON.parse(textOf(await client.callTool({ name: 'get_profile', arguments: {} })));
  assert.equal(profile.resume.basics.name, 'Alice Developer');
  assert.deepEqual(profile.skills, ['Go', 'Kubernetes', 'SQLite', 'TypeScript']);

  const search = JSON.parse(
    textOf(
      await client.callTool({
        name: 'search_saved_jobs',
        arguments: { status: 'discovered', company: 'acme corp' },
      })
    )
  );
  assert.equal(search.count, 1);
  assert.equal(search.jobs[0].id, jobA);

  const badSearch = await client.callTool({
    name: 'search_saved_jobs',
    arguments: { status: 'nonsense' },
  });
  assert.equal(badSearch.isError, true);

  const fit = JSON.parse(
    textOf(await client.callTool({ name: 'get_job_fit_score', arguments: { job_id: jobA } }))
  );
  assert.equal(fit.scored, true);
  assert.equal(fit.breakdown.reasoning, 'Strong platform match');
  assert.deepEqual(fit.breakdown.matching_skills, ['Go', 'SQLite']);

  const applied = JSON.parse(
    textOf(
      await client.callTool({
        name: 'update_application_status',
        arguments: { job_id: jobB, status: 'interviewing' },
      })
    )
  );
  assert.equal(applied.status, 'interview');
  assert.equal(
    db.prepare('SELECT status FROM user_jobs WHERE user_id = ? AND job_id = ?').get(userId, jobB)
      .status,
    'interview'
  );

  const badUpdate = await client.callTool({
    name: 'update_application_status',
    arguments: { job_id: jobB, status: 'score_failed' },
  });
  assert.equal(badUpdate.isError, true);
  assert.equal(
    db.prepare('SELECT status FROM user_jobs WHERE user_id = ? AND job_id = ?').get(userId, jobB)
      .status,
    'interview'
  );

  const tailored = JSON.parse(
    textOf(
      await client.callTool({
        name: 'generate_tailored_resume',
        arguments: { job_id: jobA, timeout_seconds: 60 },
      })
    )
  );
  assert.equal(tailored.ok, true);
  assert.match(tailored.tailored_resume_id, /^tailored-/);
  assert.equal(tailored.job.status, 'tailored');

  const artifactDir = join(artifactsDir, userId, jobA);
  assert.ok(existsSync(join(artifactDir, 'resume.json')));
  assert.ok(existsSync(join(artifactDir, 'resume.txt')));
  const pdf = readFileSync(join(artifactDir, 'resume.pdf'));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');

  // The API key travels only in the Authorization header: never in tool output,
  // never on stderr (which is the only diagnostic channel over stdio).
  for (const payload of [profile, search, fit, applied, tailored]) {
    assert.ok(
      !JSON.stringify(payload).includes(apiKey),
      'tool output must never contain the API key'
    );
  }
  const stderrText = Buffer.concat(stderrChunks.map((chunk) => Buffer.from(chunk))).toString(
    'utf8'
  );
  assert.ok(!stderrText.includes(apiKey), 'stderr must never print the API key');
});
