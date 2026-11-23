import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../src/db/index.mjs';
import { buildApp } from '../src/app.mjs';
import { validateResumeJson } from '../src/resumes/resumes.mjs';

const SAMPLE_RESUME = {
  basics: {
    name: 'Alice Developer',
    label: 'Senior Staff Engineer',
    email: 'alice@example.com',
    summary: 'Distributed systems architect with 10+ years experience.',
  },
  skills: [
    { name: 'Distributed Systems', keywords: ['Raft', 'Paxos', 'Kafka'] },
    { name: 'Languages', keywords: ['Go', 'Rust', 'TypeScript'] },
  ],
  work: [
    {
      name: 'Tech Corp',
      position: 'Staff Engineer',
      startDate: '2020-01-01',
      highlights: ['Scaled streaming platform to 1M msgs/sec'],
    },
  ],
};

test('validateResumeJson checks JSON Resume v1.0.0 schema compliance', () => {
  assert.doesNotThrow(() => validateResumeJson(SAMPLE_RESUME));

  // Non-JSON string throws
  assert.throws(() => validateResumeJson('not-json'), /Invalid JSON/);

  // Invalid email format throws
  assert.throws(
    () =>
      validateResumeJson({
        basics: {
          name: 'Bob',
          email: 'invalid-email-format',
        },
      }),
    /email/
  );

  // Invalid property types throw
  assert.throws(
    () =>
      validateResumeJson({
        basics: { name: 'Bob' },
        work: 'not-an-array',
      }),
    /must be array/
  );

  // Invalid date format throws
  assert.throws(
    () =>
      validateResumeJson({
        basics: { name: 'Bob' },
        work: [
          {
            name: 'Company',
            startDate: 'invalid-date-format',
          },
        ],
      }),
    /pattern/
  );
});

test('validateResumeJson reports all schema errors when multiple violations occur', () => {
  assert.throws(
    () =>
      validateResumeJson({
        basics: {
          name: 'Bob',
          email: 'invalid-email',
          url: 'invalid-uri',
        },
        work: 'not-an-array',
      }),
    (error) => {
      assert.match(error.message, /^JSON Resume validation failed:/);
      assert.ok(error.message.includes('email'));
      assert.ok(error.message.includes('uri'));
      assert.ok(error.message.includes('array'));
      assert.ok(error.message.includes(';'));
      return true;
    }
  );
});

test('resumes API: upload valid schema, reject invalid schema, switch active, delete', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, jwtSecret: 'test-secret' });

  // Register user
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email: 'alice@test.com', password: 'password123' },
  });
  const token = JSON.parse(regRes.body).token;
  const headers = { Authorization: `Bearer ${token}` };

  // 1. Upload invalid resume (violates schema) -> 400 Bad Request
  const badUploadRes = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes',
    headers,
    payload: {
      title: 'Bad Resume',
      resumeJson: {
        basics: {
          name: 'Bob',
          email: 'not-an-email',
        },
        illegalProperty: 123,
      },
    },
  });
  assert.equal(badUploadRes.statusCode, 400);
  assert.match(JSON.parse(badUploadRes.body).error, /JSON Resume validation failed/);

  // 2. Upload valid resume -> 201 Created
  const uploadRes1 = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes',
    headers,
    payload: {
      title: 'Staff Backend Resume',
      resumeJson: SAMPLE_RESUME,
    },
  });
  assert.equal(uploadRes1.statusCode, 201);
  const r1 = JSON.parse(uploadRes1.body).resume;
  assert.equal(r1.title, 'Staff Backend Resume');
  assert.equal(r1.isActive, true);

  // 3. Upload second valid resume
  const resume2Data = {
    ...SAMPLE_RESUME,
    basics: { ...SAMPLE_RESUME.basics, label: 'Engineering Leader' },
  };
  const uploadRes2 = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes',
    headers,
    payload: {
      title: 'Leadership Resume',
      resumeJson: resume2Data,
    },
  });
  assert.equal(uploadRes2.statusCode, 201);
  const r2 = JSON.parse(uploadRes2.body).resume;
  assert.equal(r2.isActive, true);

  // 4. GET active resume returns r2
  const activeRes = await app.inject({ method: 'GET', url: '/api/v1/resumes/active', headers });
  assert.equal(activeRes.statusCode, 200);
  assert.equal(JSON.parse(activeRes.body).resume.id, r2.id);

  // 5. Switch active resume back to r1
  const switchRes = await app.inject({
    method: 'PUT',
    url: `/api/v1/resumes/${r1.id}/active`,
    headers,
  });
  assert.equal(switchRes.statusCode, 200);

  const activeRes2 = await app.inject({ method: 'GET', url: '/api/v1/resumes/active', headers });
  assert.equal(JSON.parse(activeRes2.body).resume.id, r1.id);

  // 6. Delete resume r2
  const delRes = await app.inject({
    method: 'DELETE',
    url: `/api/v1/resumes/${r2.id}`,
    headers,
  });
  assert.equal(delRes.statusCode, 200);

  // 7. POST /api/v1/resumes/parse-raw converts raw text into JSON resume
  const rawResumeText = `
  Jane Doe
  Principal Distributed Systems Engineer
  jane.doe@example.com
  (555) 987-6543
  Experienced backend engineer with 12 years of experience in distributed consensus, Kafka, and Rust.
  `;
  const parseRes = await app.inject({
    method: 'POST',
    url: '/api/v1/resumes/parse-raw',
    headers,
    payload: { text: rawResumeText },
  });
  assert.equal(parseRes.statusCode, 200);
  const parsedBody = JSON.parse(parseRes.body);
  assert.equal(parsedBody.ok, true);
  assert.ok(parsedBody.resumeJson);
  assert.equal(parsedBody.resumeJson.basics.name, 'Jane Doe');
  assert.equal(parsedBody.resumeJson.basics.email, 'jane.doe@example.com');
});

async function registerUser(app, email) {
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, password: 'password123' },
  });
  return { Authorization: `Bearer ${JSON.parse(regRes.body).token}` };
}

test('GET /api/v1/master-resume/preview-pdf proxies to tailor and returns PDF', async () => {
  const db = openDb({ path: ':memory:' });
  const upstreamCalls = [];
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/v1/master-resume/preview-pdf') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        upstreamCalls.push(body);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="master-resume-folio.pdf"',
        });
        res.end(Buffer.from('%PDF-1.4 Mock'));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  process.env.TAILOR_PORT = String(port);

  try {
    const app = await buildApp({ db, jwtSecret: 'test-secret' });
    const headers = await registerUser(app, 'preview-get@test.com');

    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes',
      headers,
      payload: { title: 'Master', resumeJson: SAMPLE_RESUME, setActive: true },
    });
    assert.equal(upload.statusCode, 201);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-folio',
      headers,
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(res.headers['content-disposition'].includes('inline'));
    // Previews must never be reused from the browser cache: they are per-draft.
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body, '%PDF-1.4 Mock');
    assert.ok(upstreamCalls.length === 1);
    assert.ok(upstreamCalls[0].includes('"jsonresume-theme-folio"'));
  } finally {
    server.close();
    delete process.env.TAILOR_PORT;
  }
});

test('POST /api/v1/master-resume/preview-pdf forwards the unsaved draft', async () => {
  const db = openDb({ path: ':memory:' });
  const upstreamBodies = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      upstreamBodies.push(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(Buffer.from('%PDF-1.4 Mock'));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.TAILOR_PORT = String(server.address().port);

  try {
    const app = await buildApp({ db, jwtSecret: 'test-secret' });
    const headers = await registerUser(app, 'preview-post@test.com');
    const draft = { ...SAMPLE_RESUME, basics: { ...SAMPLE_RESUME.basics, name: 'Draft Name' } };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/master-resume/preview-pdf',
      headers,
      payload: { theme: 'jsonresume-theme-pro', resume: draft },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(upstreamBodies.length, 1);
    assert.equal(upstreamBodies[0].resume.basics.name, 'Draft Name');
    assert.equal(upstreamBodies[0].theme, 'jsonresume-theme-pro');
  } finally {
    server.close();
    delete process.env.TAILOR_PORT;
  }
});

test('preview-pdf rejects unsupported theme names without calling the tailor', async () => {
  const db = openDb({ path: ':memory:' });
  let upstreamCalls = 0;
  const server = http.createServer((req, res) => {
    upstreamCalls += 1;
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(Buffer.from('%PDF-1.4 Mock'));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.TAILOR_PORT = String(server.address().port);

  try {
    const app = await buildApp({ db, jwtSecret: 'test-secret' });
    const headers = await registerUser(app, 'preview-bad-theme@test.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/master-resume/preview-pdf?theme=../../etc/passwd',
      headers,
    });

    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error, 'invalid_theme');
    assert.equal(upstreamCalls, 0);
  } finally {
    server.close();
    delete process.env.TAILOR_PORT;
  }
});

test('preview-pdf never falls back to the operator master resume', async () => {
  const db = openDb({ path: ':memory:' });
  let upstreamCalls = 0;
  const server = http.createServer((req, res) => {
    upstreamCalls += 1;
    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(Buffer.from('%PDF-1.4 Mock'));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.TAILOR_PORT = String(server.address().port);

  try {
    const app = await buildApp({ db, jwtSecret: 'test-secret' });
    const headers = await registerUser(app, 'preview-no-resume@test.com');
    // No resume has been uploaded for this user.
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/master-resume/preview-pdf?theme=jsonresume-theme-folio',
      headers,
    });

    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error, 'resume_missing');
    assert.equal(upstreamCalls, 0);
  } finally {
    server.close();
    delete process.env.TAILOR_PORT;
  }
});
