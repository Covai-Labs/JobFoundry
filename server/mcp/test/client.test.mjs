import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { ApiError, JobFoundryClient } from '../src/client.mjs';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test('sends the bearer token and parses JSON', async (t) => {
  let seenAuthorization = null;
  const { server, url } = await startServer((req, res) => {
    seenAuthorization = req.headers.authorization;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ resume: { id: 'r1' } }));
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url, apiKey: 'secret-key' });
  const result = await client.getActiveResume();

  assert.deepEqual(result, { resume: { id: 'r1' } });
  assert.equal(seenAuthorization, 'Bearer secret-key');
});

test('omits the authorization header when no key is configured', async (t) => {
  let seenAuthorization = 'not-called';
  const { server, url } = await startServer((req, res) => {
    seenAuthorization = req.headers.authorization ?? null;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  t.after(() => server.close());

  await new JobFoundryClient({ baseUrl: url }).getActiveResume();
  assert.equal(seenAuthorization, null);
});

test('turns API error bodies into ApiError messages', async (t) => {
  const { server, url } = await startServer((req, res) => {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'No active master resume found' }));
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url });
  await assert.rejects(
    () => client.getJob('job-1'),
    (err) =>
      err instanceof ApiError && err.status === 400 && /No active master resume/.test(err.message)
  );
});

test('handles non-JSON error responses without crashing', async (t) => {
  const { server, url } = await startServer((req, res) => {
    res.writeHead(502, { 'content-type': 'text/html' });
    res.end('<html>Bad gateway</html>');
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url });
  await assert.rejects(() => client.getJob('job-1'), /HTTP 502/);
  await assert.rejects(() => client.getJob('job-1'), /Bad gateway/);
});

test('surfaces the upstream message for non-standard error bodies', async (t) => {
  const { server, url } = await startServer((req, res) => {
    res.writeHead(429, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
      })
    );
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url });
  await assert.rejects(
    () => client.getJob('job-1'),
    (err) =>
      err instanceof ApiError && err.status === 429 && /Rate limit exceeded/.test(err.message)
  );
});

test('reports timeouts as ApiError', async (t) => {
  const { server, url } = await startServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    }, 200);
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const client = new JobFoundryClient({ baseUrl: url, timeoutMs: 20 });
  await assert.rejects(() => client.getActiveResume(), /timed out/);
});

test('never follows redirects', async (t) => {
  let targetHit = false;
  const target = await startServer((req, res) => {
    targetHit = true;
    res.end('{}');
  });
  const source = await startServer((req, res) => {
    res.writeHead(302, { location: `${target.url}/stolen` });
    res.end();
  });
  t.after(() => {
    source.server.close();
    target.server.close();
  });

  const client = new JobFoundryClient({ baseUrl: source.url });
  await assert.rejects(() => client.getActiveResume(), /redirect/i);
  await assert.rejects(() => client.getActiveResume(), /JOBFOUNDRY_URL/);
  assert.equal(targetHit, false);
});

test('maps a stalled response body to a timeout ApiError', async (t) => {
  const { server, url } = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{"jobs"');
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const client = new JobFoundryClient({ baseUrl: url, timeoutMs: 50 });
  await assert.rejects(
    () => client.getActiveResume(),
    (err) => err instanceof ApiError && /timed out/.test(err.message)
  );
});

test('builds query strings and encodes job ids', async (t) => {
  const paths = [];
  const { server, url } = await startServer((req, res) => {
    paths.push(req.url);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jobs: [], job: {} }));
  });
  t.after(() => server.close());

  const client = new JobFoundryClient({ baseUrl: url });
  await client.listJobs({ status: 'new', company: 'Acme Corp', limit: 10, search: undefined });
  await client.getJob('job_1');

  assert.equal(paths[0], '/api/v1/jobs?status=new&company=Acme+Corp&limit=10');
  assert.equal(paths[1], '/api/v1/jobs/job_1');
});

test('applies per-call tailoring timeout and builds artifact URLs', async (t) => {
  const { server, url } = await startServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }, 80);
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const client = new JobFoundryClient({ baseUrl: url, timeoutMs: 10 });
  const result = await client.tailorJob('job-1', { timeoutMs: 1000 });
  assert.equal(result.ok, true);
  assert.equal(
    client.artifactUrl('job-1', 'resume.pdf'),
    `${url}/api/v1/jobs/job-1/artifacts/resume.pdf`
  );
});

test('reports unreachable servers as ApiError', async () => {
  const client = new JobFoundryClient({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 100 });
  await assert.rejects(() => client.getActiveResume(), /Could not reach JobFoundry/);
});
