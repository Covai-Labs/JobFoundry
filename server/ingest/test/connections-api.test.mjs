import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.mjs';
import { openDb } from '../src/db/index.mjs';

test('Named connections REST API endpoints', async (t) => {
  const db = openDb({ path: ':memory:' });
  const app = buildApp({
    db,
    apiKeys: ['dev-api-key'],
    serverUrl: 'http://localhost:8080',
    logger: false,
  });
  t.after(() => app.close());

  const authHeaders = {
    authorization: 'Bearer dev-api-key',
  };

  await t.test('GET /api/v1/settings/connections lists seeded built-in connections', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/connections',
      headers: authHeaders,
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.connections));
    assert.ok(body.connections.length >= 8);

    const openrouter = body.connections.find((c) => c.id === 'conn_builtin_openrouter');
    assert.ok(openrouter);
    assert.equal(openrouter.name, 'OpenRouter');
    assert.equal(openrouter.apiType, 'openrouter');
    assert.equal(openrouter.baseUrl, 'https://openrouter.ai/api/v1');
    assert.equal(openrouter.isBuiltIn, true);
  });

  let createdCustomId = '';
  await t.test('POST /api/v1/settings/connections creates custom connection', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/connections',
      headers: authHeaders,
      payload: {
        name: 'Private LiteLLM Proxy',
        apiType: 'openai',
        baseUrl: 'https://litellm.kolofon.ai/v1',
        apiKey: 'sk-test-proxy-token-12345678',
      },
    });
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);
    assert.equal(body.connection.name, 'Private LiteLLM Proxy');
    assert.equal(body.connection.baseUrl, 'https://litellm.kolofon.ai/v1');
    assert.equal(body.connection.isBuiltIn, false);
    assert.match(body.connection.apiKey, /••••/);
    createdCustomId = body.connection.id;
  });

  await t.test('POST /api/v1/settings/connections rejects invalid URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/connections',
      headers: authHeaders,
      payload: {
        name: 'Bad URL Proxy',
        apiType: 'openai',
        baseUrl: 'not-a-valid-url',
      },
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, false);
    assert.match(body.error, /Invalid URL/);
  });

  await t.test('PUT /api/v1/settings/connections/:id updates custom connection', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/settings/connections/${createdCustomId}`,
      headers: authHeaders,
      payload: {
        name: 'Private LiteLLM Proxy (Updated)',
        baseUrl: 'https://litellm-prod.kolofon.ai/v1',
      },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);
    assert.equal(body.connection.name, 'Private LiteLLM Proxy (Updated)');
    assert.equal(body.connection.baseUrl, 'https://litellm-prod.kolofon.ai/v1');
  });

  await t.test(
    'PUT /api/v1/settings/connections/:id updates key on built-in connection',
    async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/connections/conn_builtin_openrouter',
        headers: authHeaders,
        payload: {
          apiKey: 'sk-or-v1-new-secret-key-123456789',
        },
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.ok, true);
      assert.equal(body.connection.isConfigured, true);
      assert.match(body.connection.apiKey, /sk-or-.*789/);
    }
  );

  await t.test(
    'PUT /api/v1/settings/connections/:id rejects mutating base_url of built-in connection',
    async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/settings/connections/conn_builtin_openrouter',
        headers: authHeaders,
        payload: {
          baseUrl: 'https://hijacked.openrouter.ai/v1',
        },
      });
      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.ok, false);
      assert.match(body.error, /Cannot modify base_url of built-in connection/);
    }
  );

  await t.test(
    'DELETE /api/v1/settings/connections/:id rejects deleting built-in connection',
    async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/settings/connections/conn_builtin_openrouter',
        headers: authHeaders,
      });
      assert.equal(res.statusCode, 400);
      const body = JSON.parse(res.payload);
      assert.equal(body.ok, false);
      assert.match(body.error, /Cannot delete built-in connection/);
    }
  );

  await t.test('DELETE /api/v1/settings/connections/:id deletes custom connection', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/settings/connections/${createdCustomId}`,
      headers: authHeaders,
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);
    assert.equal(body.deleted, true);
  });

  await t.test('POST /api/v1/settings/connections/:id/test rejects unconfigured key', async () => {
    // Gemini key not configured
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/settings/connections/conn_builtin_google/test',
      headers: authHeaders,
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, false);
    assert.match(body.error, /No API key configured/);
  });

  await t.test(
    'POST /api/v1/settings/test-llm uses connectionId credentials and base URL',
    async () => {
      // Create a custom connection with a dummy key and URL
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/connections',
        headers: authHeaders,
        payload: {
          name: 'LiteLLM Test Endpoint',
          apiType: 'openai',
          baseUrl: 'https://litellm-proxy.internal/v1',
          apiKey: 'sk-custom-litellm-secret-key-999',
        },
      });
      assert.equal(createRes.statusCode, 201);
      const customConn = JSON.parse(createRes.payload).connection;

      // Test LLM endpoint targeting this connectionId without providing raw apiKey or apiBase
      const testRes = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/test-llm',
        headers: authHeaders,
        payload: {
          connectionId: customConn.id,
          model: 'gpt-4o-mini',
        },
      });
      // In test environment, the downstream tailor service or mock may fail/refuse connection,
      // but the error response must reflect the connection's baseUrl and provider, not OpenRouter!
      const testBody = JSON.parse(testRes.payload);
      assert.equal(testBody.provider, 'openai');
      assert.equal(testBody.apiBase, 'https://litellm-proxy.internal/v1');
      assert.notEqual(testBody.apiBase, 'https://openrouter.ai/api/v1');
    }
  );
});
