import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate.mjs';
import {
  initConnectionsStore,
  listConnections,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  BUILTIN_CONNECTIONS,
} from '../src/settings/connections-store.mjs';

function insertUser(db, id, email = `${id}@example.com`) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email, 'hash', `key-${id}`, now, now);
}

test('initConnectionsStore seeds all built-in connections with correct endpoints', () => {
  const db = new Database(':memory:');
  migrate(db);
  initConnectionsStore(db);

  const conns = listConnections(db);
  assert.equal(conns.length >= BUILTIN_CONNECTIONS.length, true);

  const openrouter = conns.find((c) => c.id === 'conn_builtin_openrouter');
  assert.ok(openrouter);
  assert.equal(openrouter.isBuiltIn, true);
  assert.equal(openrouter.apiType, 'openrouter');
  assert.equal(openrouter.baseUrl, 'https://openrouter.ai/api/v1');

  const ollama = conns.find((c) => c.id === 'conn_builtin_ollama');
  assert.ok(ollama);
  assert.equal(ollama.isBuiltIn, true);
  assert.equal(ollama.apiType, 'ollama');
  assert.equal(ollama.baseUrl, 'http://127.0.0.1:11434/v1');
});

test('Built-in connection endpoints are immutable', () => {
  const db = new Database(':memory:');
  migrate(db);
  initConnectionsStore(db);

  // Attempt to modify baseUrl of built-in connection
  assert.throws(
    () => {
      updateConnection(db, 'conn_builtin_openrouter', { baseUrl: 'https://evil.proxy.com' });
    },
    { message: /Cannot modify base_url of built-in connection/ }
  );

  // Attempt to modify apiType of built-in connection
  assert.throws(
    () => {
      updateConnection(db, 'conn_builtin_openrouter', { apiType: 'custom' });
    },
    { message: /Cannot modify api_type of built-in connection/ }
  );

  // Attempt to delete built-in connection
  assert.throws(
    () => {
      deleteConnection(db, 'conn_builtin_openrouter');
    },
    { message: /Cannot delete built-in connection/ }
  );
});

test('Updating API key on built-in connection stores and masks the key', () => {
  const db = new Database(':memory:');
  migrate(db);
  initConnectionsStore(db);

  const updated = updateConnection(db, 'conn_builtin_openrouter', {
    apiKey: 'sk-or-v1-secret-test-token-123456789',
  });
  assert.equal(updated.isConfigured, true);
  assert.match(updated.apiKey, /sk-or-.*789/);

  // Raw secret retrieval
  const raw = getConnection(db, 'conn_builtin_openrouter', { includeSecret: true });
  assert.equal(raw.apiKey, 'sk-or-v1-secret-test-token-123456789');
});

test('Custom connection lifecycle: create, update, delete with validation', () => {
  const db = new Database(':memory:');
  migrate(db);
  initConnectionsStore(db);

  // Validation: invalid URL
  assert.throws(
    () => {
      createConnection(db, {
        name: 'LiteLLM Proxy',
        apiType: 'openai',
        baseUrl: 'invalid-url',
      });
    },
    { message: /Invalid URL/ }
  );

  // Create valid custom connection
  const created = createConnection(db, {
    name: 'LiteLLM Proxy',
    apiType: 'openai',
    baseUrl: 'https://litellm.kolofon.ai/v1',
    apiKey: 'sk-litellm-proxy-secret',
  });
  assert.ok(created.id.startsWith('conn_'));
  assert.equal(created.name, 'LiteLLM Proxy');
  assert.equal(created.apiType, 'openai');
  assert.equal(created.baseUrl, 'https://litellm.kolofon.ai/v1');
  assert.equal(created.isBuiltIn, false);
  assert.equal(created.isConfigured, true);

  // Update custom connection
  const modified = updateConnection(db, created.id, {
    name: 'LiteLLM Production Proxy',
    baseUrl: 'https://litellm-prod.kolofon.ai/v1',
  });
  assert.equal(modified.name, 'LiteLLM Production Proxy');
  assert.equal(modified.baseUrl, 'https://litellm-prod.kolofon.ai/v1');

  // Delete custom connection
  const delRes = deleteConnection(db, created.id);
  assert.equal(delRes.ok, true);
  assert.equal(getConnection(db, created.id), null);
});

test('Multi-user BYOK isolation on connections', () => {
  const db = new Database(':memory:');
  migrate(db);
  initConnectionsStore(db);

  insertUser(db, 'user-alice');
  insertUser(db, 'user-bob');

  // Alice sets her key for OpenRouter
  updateConnection(
    db,
    'conn_builtin_openrouter',
    { apiKey: 'sk-or-alice-key-12345678' },
    { userId: 'user-alice' }
  );

  // Alice sees her key
  const aliceOpenRouter = getConnection(db, 'conn_builtin_openrouter', {
    userId: 'user-alice',
    includeSecret: true,
  });
  assert.equal(aliceOpenRouter.apiKey, 'sk-or-alice-key-12345678');

  // Bob sees empty key (no leakage)
  const bobOpenRouter = getConnection(db, 'conn_builtin_openrouter', {
    userId: 'user-bob',
    includeSecret: true,
  });
  assert.equal(bobOpenRouter.apiKey, '');

  // Alice creates a custom connection
  const aliceCustom = createConnection(
    db,
    {
      name: "Alice's Ollama",
      apiType: 'ollama',
      baseUrl: 'http://127.0.0.1:11434/v1',
    },
    { userId: 'user-alice' }
  );

  // Alice can see it
  const aliceList = listConnections(db, { userId: 'user-alice' });
  assert.ok(aliceList.find((c) => c.id === aliceCustom.id));

  // Bob cannot see Alice's custom connection
  const bobList = listConnections(db, { userId: 'user-bob' });
  assert.equal(
    bobList.find((c) => c.id === aliceCustom.id),
    undefined
  );

  // Bob cannot delete Alice's custom connection
  assert.throws(
    () => {
      deleteConnection(db, aliceCustom.id, { userId: 'user-bob' });
    },
    { message: /Connection not found/ }
  );
});

test('Legacy migration: existing default_llm_api_base and keys migrate into connections', () => {
  const db = new Database(':memory:');
  migrate(db);

  // Simulate legacy database state before connections migration
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO system_settings (key, value, updated_at) VALUES
      ('default_llm_provider', 'openai', ${now}),
      ('default_llm_api_base', 'https://custom-proxy.internal/v1', ${now}),
      ('default_llm_api_key', 'sk-legacy-custom-key-12345', ${now})
  `
  ).run();

  initConnectionsStore(db);

  const conns = listConnections(db);
  const migratedGateway = conns.find((c) => c.id === 'conn_migrated_custom_gateway');
  assert.ok(migratedGateway);
  assert.equal(migratedGateway.name, 'Default Gateway (Custom)');
  assert.equal(migratedGateway.baseUrl, 'https://custom-proxy.internal/v1');
  assert.equal(migratedGateway.apiType, 'openai');

  // Check system_settings has gateway_connection_id set
  const gatewayConnRow = db
    .prepare("SELECT value FROM system_settings WHERE key = 'gateway_connection_id'")
    .get();
  assert.equal(gatewayConnRow.value, 'conn_migrated_custom_gateway');
});
