import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildApp } from '../src/app.mjs';
import { openDb } from '../src/db/index.mjs';

test('settings API endpoints work as expected', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({
    db,
    apiKeys: ['test-api-key'],
    serverUrl: 'http://localhost:8080',
    logger: false,
  });

  try {
    // 1. Unauthorized access fails
    const unauthResp = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
    });
    assert.equal(unauthResp.statusCode, 401);

    // 2. Authorized GET returns settings
    const getResp = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { authorization: 'Bearer test-api-key' },
    });
    assert.equal(getResp.statusCode, 200);
    const getData = JSON.parse(getResp.payload);
    assert.ok(getData.settings);
    assert.ok(getData.meta);
    assert.equal(getData.settings.scorer_threshold, 75);

    // 3. Authorized PUT updates settings
    const putResp = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { authorization: 'Bearer test-api-key' },
      payload: {
        scorer_model: 'custom/model-via-api',
        scorer_threshold: 88,
        scorer_api_key: 'sk-or-new-test-api-key-123456',
      },
    });
    assert.equal(putResp.statusCode, 200);
    const putData = JSON.parse(putResp.payload);
    assert.equal(putData.ok, true);
    assert.equal(putData.settings.scorer_model, 'custom/model-via-api');
    assert.equal(putData.settings.scorer_threshold, 88);
    assert.equal(putData.meta.scorer_model.source, 'system');
    assert.match(putData.settings.scorer_api_key, /••••••••/);

    // 4. Invalid threshold is rejected
    const badPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { authorization: 'Bearer test-api-key' },
      payload: {
        scorer_threshold: 150,
      },
    });
    assert.equal(badPut.statusCode, 400);

    // 5. Extension config reflects new threshold
    const extResp = await app.inject({
      method: 'GET',
      url: '/api/v1/extension/config',
      headers: { authorization: 'Bearer test-api-key' },
    });
    assert.equal(extResp.statusCode, 200);
    const extData = JSON.parse(extResp.payload);
    assert.equal(extData.fitThreshold, 88);
  } finally {
    await app.close();
  }
});

test('per-user settings API isolates settings between users', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({
    db,
    apiKeys: ['test-api-key'],
    serverUrl: 'http://localhost:8080',
    logger: false,
  });

  const now = Date.now();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('alice', 'alice@example.com', 'hash', 'jf-key-alice', now, now);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('bob', 'bob@example.com', 'hash', 'jf-key-bob', now, now);

  try {
    const aliceHeaders = { authorization: 'Bearer jf-key-alice' };
    const bobHeaders = { authorization: 'Bearer jf-key-bob' };

    // 1. Registered identity defaults: no shared key available
    const aliceGet = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: aliceHeaders,
    });
    assert.equal(aliceGet.statusCode, 200);
    const aliceBase = JSON.parse(aliceGet.payload);
    assert.equal(aliceBase.settings.scorer_api_key, '');
    assert.equal(aliceBase.meta.scorer_api_key.source, 'default');

    // 2. Alice writes her own key; Bob is unaffected
    const alicePut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: aliceHeaders,
      payload: { scorer_api_key: 'sk-alice-bring-123456789', scorer_model: 'alice/provider/model' },
    });
    assert.equal(alicePut.statusCode, 200);
    const alicePutData = JSON.parse(alicePut.payload);
    assert.equal(alicePutData.meta.scorer_api_key.source, 'user');
    assert.equal(alicePutData.meta.scorer_model.source, 'user');

    const aliceAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: aliceHeaders,
    });
    assert.match(JSON.parse(aliceAfter.payload).settings.scorer_api_key, /••••••••/);
    assert.equal(JSON.parse(aliceAfter.payload).meta.scorer_api_key.source, 'user');

    const bobAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: bobHeaders,
    });
    const bobData = JSON.parse(bobAfter.payload);
    assert.equal(bobData.settings.scorer_api_key, '');
    assert.equal(bobData.meta.scorer_api_key.source, 'default');

    // 3. Operator (legacy key) writes to system settings, does not see user rows
    const opPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { authorization: 'Bearer test-api-key' },
      payload: { scorer_threshold: 88 },
    });
    assert.equal(opPut.statusCode, 200);
    assert.equal(JSON.parse(opPut.payload).meta.scorer_threshold.source, 'system');

    // 4. Alice can delete her key back to defaults
    const aliceDel = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: aliceHeaders,
      payload: { scorer_api_key: null },
    });
    assert.equal(aliceDel.statusCode, 200);
    const aliceDelData = JSON.parse(aliceDel.payload);
    assert.equal(aliceDelData.settings.scorer_api_key, '');
    assert.equal(aliceDelData.meta.scorer_api_key.source, 'default');

    // 5. Invalid api_base is still rejected per-user
    const badBase = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: aliceHeaders,
      payload: { scorer_api_base: ['https://attacker.com'] },
    });
    assert.equal(badBase.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('POST /api/v1/settings/fetch-models retrieves models and caches results', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({
    db,
    apiKeys: ['test-api-key'],
    serverUrl: 'http://localhost:8080',
    logger: false,
  });

  // Mock OpenAI-compatible server
  const server = http.createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [
            { id: 'custom-model-1', name: 'Custom Model 1' },
            { id: 'custom-model-whisper', name: 'Whisper 1' },
            { id: 'custom-model-2', name: 'Custom Model 2' },
          ],
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const mockBase = `http://127.0.0.1:${port}/v1`;
  const prevAllowed = process.env.ALLOWED_LLM_BASES;
  process.env.ALLOWED_LLM_BASES = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthorized fails
    const unauth = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/fetch-models',
    });
    assert.equal(unauth.statusCode, 401);

    // 2. Invalid feature fails
    const badFeature = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/fetch-models',
      headers: { authorization: 'Bearer test-api-key' },
      payload: { feature: 'invalid-feature' },
    });
    assert.equal(badFeature.statusCode, 400);

    // 3. Successful fetch
    const fetchResp = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/fetch-models',
      headers: { authorization: 'Bearer test-api-key' },
      payload: {
        feature: 'gateway',
        provider: 'custom',
        apiBase: mockBase,
      },
    });
    assert.equal(fetchResp.statusCode, 200);
    const data = JSON.parse(fetchResp.payload);
    assert.equal(data.success, true);
    assert.equal(data.cached, false);
    assert.equal(data.models.length, 2);
    assert.equal(data.models[0].id, 'custom-model-1');
    assert.equal(data.models[1].id, 'custom-model-2');

    // 4. Second fetch is cached
    const cachedResp = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/fetch-models',
      headers: { authorization: 'Bearer test-api-key' },
      payload: {
        feature: 'gateway',
        provider: 'custom',
        apiBase: mockBase,
      },
    });
    assert.equal(cachedResp.statusCode, 200);
    const cachedData = JSON.parse(cachedResp.payload);
    assert.equal(cachedData.success, true);
    assert.equal(cachedData.cached, true);
    assert.equal(cachedData.models.length, 2);

    // 5. OpenRouter provider automatically prefixes model IDs
    const openrouterResp = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/fetch-models',
      headers: { authorization: 'Bearer test-api-key' },
      payload: {
        feature: 'gateway',
        provider: 'openrouter',
        apiKey: 'sk-or-test-key-1',
        apiBase: mockBase,
      },
    });
    assert.equal(openrouterResp.statusCode, 200);
    const openrouterData = JSON.parse(openrouterResp.payload);
    assert.equal(openrouterData.success, true);
    assert.equal(openrouterData.models[0].id, 'openrouter/custom-model-1');

    // 6. Cache isolation across distinct credentials
    const differentKeyResp = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/fetch-models',
      headers: { authorization: 'Bearer test-api-key' },
      payload: {
        feature: 'gateway',
        provider: 'openrouter',
        apiKey: 'sk-or-test-key-2',
        apiBase: mockBase,
      },
    });
    assert.equal(differentKeyResp.statusCode, 200);
    const diffData = JSON.parse(differentKeyResp.payload);
    assert.equal(diffData.cached, false);
  } finally {
    if (prevAllowed === undefined) delete process.env.ALLOWED_LLM_BASES;
    else process.env.ALLOWED_LLM_BASES = prevAllowed;
    server.close();
    await app.close();
  }
});

test('Observability settings are admin-only and stored in system_settings', async () => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({ db, apiKeys: [] });

  try {
    // First registered user becomes admin
    const adminReg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'admin-obs@example.com', password: 'password123', name: 'Admin' },
    });
    assert.equal(adminReg.statusCode, 201);
    const adminKey = adminReg.json().user.apiKey;

    // Second registered user is non-admin
    const userReg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'user-obs@example.com', password: 'password123', name: 'User' },
    });
    assert.equal(userReg.statusCode, 201);
    const userKey = userReg.json().user.apiKey;

    // Admin enables Opik + Langfuse
    const adminPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${adminKey}` },
      payload: {
        opik_enabled: true,
        opik_api_key: 'test-opik-placeholder',
        opik_project_name: 'jf-prod',
        langfuse_enabled: true,
        langfuse_public_key: 'test-lf-public-placeholder',
        langfuse_secret_key: 'test-lf-val-placeholder',
      },
    });
    assert.equal(adminPut.statusCode, 200);
    const adminPutBody = adminPut.json();
    assert.equal(adminPutBody.settings.opik_enabled, true);
    assert.equal(adminPutBody.meta.opik_api_key.source, 'system');

    // Non-admin cannot read admin observability keys
    const userGet = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${userKey}` },
    });
    assert.equal(userGet.statusCode, 200);
    const userGetBody = userGet.json();
    assert.equal(userGetBody.settings.opik_enabled, false);
    assert.equal(userGetBody.settings.opik_api_key, '');
    assert.equal(userGetBody.settings.langfuse_enabled, false);

    // Non-admin gets 403 when trying to modify observability settings
    const userPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      headers: { authorization: `Bearer ${userKey}` },
      payload: { opik_enabled: false },
    });
    assert.equal(userPut.statusCode, 403);
  } finally {
    await app.close();
  }
});
