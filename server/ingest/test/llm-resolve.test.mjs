import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate.mjs';
import { updateSettings } from '../src/settings/settings.mjs';
import {
  defaultBaseForProvider,
  detectProviderFromModel,
  inferProviderFromModel,
  resolveFeatureLlmConfig,
} from '../src/settings/llm-resolve.mjs';
import { createConnection, updateConnection } from '../src/settings/connections-store.mjs';

function insertUser(db, id, email = `${id}@example.com`, apiKey = `jf-key-${id}`) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (id, email, password_hash, api_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email, 'hash', apiKey, now, now);
}

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

test('detectProviderFromModel maps LiteLLM prefixes', () => {
  assert.equal(detectProviderFromModel('openrouter/openrouter/free'), 'openrouter');
  assert.equal(detectProviderFromModel('groq/llama-3.3-70b-versatile'), 'groq');
  assert.equal(detectProviderFromModel('deepseek/deepseek-chat'), 'deepseek');
  assert.equal(detectProviderFromModel('ollama/llama3.2'), 'ollama');
  assert.equal(detectProviderFromModel('gpt-4o-mini'), 'openai');
  assert.equal(detectProviderFromModel('gemini/gemini-3.8-flash'), 'google');
});

test('inferProviderFromModel never guesses for unknown models', () => {
  // UI defaults to OpenRouter, but credential resolution must not.
  assert.equal(inferProviderFromModel(''), '');
  assert.equal(inferProviderFromModel('my-private-model'), '');
  assert.equal(detectProviderFromModel('my-private-model'), 'openrouter');
});

test('defaultBaseForProvider prefers the provider and falls back to the model', () => {
  assert.equal(defaultBaseForProvider('openrouter'), 'https://openrouter.ai/api/v1');
  assert.equal(
    defaultBaseForProvider('', 'groq/llama-3.3-70b-versatile'),
    'https://api.groq.com/openai/v1'
  );
  assert.equal(defaultBaseForProvider('google', 'gemini/gemini-3.8-flash'), '');
  assert.equal(defaultBaseForProvider('custom', 'my-local-model'), '');
  // An explicitly selected unknown provider must not borrow another provider's
  // endpoint just because the model string looks like one.
  assert.equal(defaultBaseForProvider('my-proxy', 'gpt-4o-mini'), '');
  assert.equal(defaultBaseForProvider('', 'my-private-model'), '');
});

test('a feature that does not inherit never reuses the gateway base URL', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  updateSettings(
    db,
    {
      default_llm_provider: 'custom',
      default_llm_model: 'openrouter/openrouter/free',
      default_llm_api_key: 'sk-or-default-key-123456',
      default_llm_api_base: 'https://litellm.example.com/v1',
      scorer_inherit_default: false,
      scorer_provider: 'openrouter',
      scorer_model: 'openrouter/openrouter/free',
      scorer_api_key: 'sk-or-scorer-key-123456',
      scorer_api_base: '',
    },
    'u1'
  );

  const resolved = resolveFeatureLlmConfig(db, 'scorer', { userId: 'u1' });
  assert.equal(resolved.provider, 'openrouter');
  assert.equal(resolved.apiKey, 'sk-or-scorer-key-123456');
  // The OpenRouter key must not be sent to the LiteLLM proxy.
  assert.equal(resolved.apiBase, 'https://openrouter.ai/api/v1');
  assert.equal(resolved.apiBaseSource, 'provider-default');
});

test('an explicit feature base URL wins', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  updateSettings(
    db,
    {
      default_llm_api_base: 'https://litellm.example.com/v1',
      scorer_inherit_default: false,
      scorer_provider: 'openrouter',
      scorer_api_key: 'sk-or-scorer-key-123456',
      scorer_api_base: 'https://my-proxy.example.com/v1/',
    },
    'u1'
  );

  const resolved = resolveFeatureLlmConfig(db, 'scorer', { userId: 'u1' });
  assert.equal(resolved.apiBase, 'https://my-proxy.example.com/v1');
  assert.equal(resolved.apiBaseSource, 'user');
});

test('an inheriting feature uses the gateway credentials', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  updateSettings(
    db,
    {
      default_llm_provider: 'custom',
      default_llm_api_base: 'https://litellm.example.com/v1',
      default_llm_api_key: 'sk-or-default-key-123456',
      tailor_inherit_default: true,
      tailor_inherit_model: true,
    },
    'u1'
  );

  const resolved = resolveFeatureLlmConfig(db, 'tailor', { userId: 'u1' });
  assert.equal(resolved.inherited, true);
  assert.equal(resolved.apiKey, 'sk-or-default-key-123456');
  assert.equal(resolved.apiBase, 'https://litellm.example.com/v1');
});

test('registered users never receive an operator-level key', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  // System-scoped (operator) key only — no from user_settings.
  db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
    'default_llm_api_key',
    'sk-or-operator-key-123456',
    Date.now()
  );

  const resolved = resolveFeatureLlmConfig(db, 'gateway', { userId: 'u1' });
  assert.equal(resolved.apiKey, '');
});

test('a non-inheriting feature never borrows the gateway key', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  updateSettings(
    db,
    {
      default_llm_provider: 'openrouter',
      default_llm_model: 'openrouter/openrouter/free',
      default_llm_api_key: 'sk-or-default-key-123456',
      scorer_inherit_default: false,
      scorer_provider: 'openrouter',
      scorer_model: 'openrouter/openrouter/free',
      scorer_api_key: '',
    },
    'u1'
  );

  const resolved = resolveFeatureLlmConfig(db, 'scorer', { userId: 'u1' });
  // Mixing the gateway key with the scorer scope is the bug this resolver
  // prevents; the caller must ask the user for a scorer key instead.
  assert.equal(resolved.apiKey, '');
});

test('an unknown provider resolves to no base instead of guessing', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  updateSettings(
    db,
    {
      default_llm_api_base: 'https://litellm.example.com/v1',
      copilot_inherit_default: false,
      copilot_provider: 'my-private-proxy',
      copilot_model: 'gpt-4o-mini',
      copilot_api_key: 'sk-copilot-key-123456',
      copilot_api_base: '',
    },
    'u1'
  );

  const resolved = resolveFeatureLlmConfig(db, 'copilot', { userId: 'u1' });
  assert.equal(resolved.provider, 'my-private-proxy');
  // Must not infer OpenRouter/OpenAI from the model string.
  assert.equal(resolved.apiBase, '');
  assert.equal(resolved.apiKey, 'sk-copilot-key-123456');
});

test('an inheriting feature ignores a retained feature base and key', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  updateSettings(
    db,
    {
      default_llm_provider: 'custom',
      default_llm_model: 'openrouter/openrouter/free',
      default_llm_api_base: 'https://litellm.example.com/v1',
      default_llm_api_key: 'sk-or-default-key-123456',
      scorer_inherit_default: true,
      // Left over from an earlier custom-scorer setup. Inheriting must not
      // pair the gateway key with this stale private proxy.
      scorer_provider: 'openrouter',
      scorer_api_base: 'https://stale-proxy.example.com/v1',
      scorer_api_key: 'sk-or-stale-key-123456',
    },
    'u1'
  );

  const resolved = resolveFeatureLlmConfig(db, 'scorer', { userId: 'u1' });
  assert.equal(resolved.inherited, true);
  assert.equal(resolved.apiKey, 'sk-or-default-key-123456');
  assert.equal(resolved.apiBase, 'https://litellm.example.com/v1');
});

test('the gateway does not borrow a feature key', () => {
  const db = freshDb();
  insertUser(db, 'u1');
  updateSettings(db, { scorer_api_key: 'sk-or-scorer-key-123456' }, 'u1');

  const resolved = resolveFeatureLlmConfig(db, 'gateway', { userId: 'u1' });
  assert.equal(resolved.apiKey, '');
});

test('connection-based resolution: gateway and features reference named connections', () => {
  const db = freshDb();
  insertUser(db, 'u1');

  // Create custom connection for user u1
  const customConn = createConnection(
    db,
    {
      name: 'User Private LiteLLM',
      apiType: 'openai',
      baseUrl: 'https://user-litellm.example.com/v1',
      apiKey: 'sk-user-custom-proxy-key',
    },
    { userId: 'u1' }
  );

  // Set Groq key for built-in Groq connection
  updateConnection(
    db,
    'conn_builtin_groq',
    { apiKey: 'gsk-user-groq-key-123456' },
    { userId: 'u1' }
  );

  // Configure user settings referencing the connections:
  // Gateway uses custom connection; Scorer overrides and uses built-in Groq
  updateSettings(
    db,
    {
      gateway_connection_id: customConn.id,
      default_llm_model: 'custom-model',
      scorer_inherit_default: false,
      scorer_connection_id: 'conn_builtin_groq',
      scorer_model: 'groq/llama-3.3-70b-versatile',
    },
    'u1'
  );

  // 1. Gateway resolves to the custom connection
  const gatewayResolved = resolveFeatureLlmConfig(db, 'gateway', { userId: 'u1' });
  assert.equal(gatewayResolved.connectionId, customConn.id);
  assert.equal(gatewayResolved.provider, 'openai');
  assert.equal(gatewayResolved.apiBase, 'https://user-litellm.example.com/v1');
  assert.equal(gatewayResolved.apiKey, 'sk-user-custom-proxy-key');
  assert.equal(gatewayResolved.model, 'custom-model');

  // 2. Inheriting feature (Tailor) inherits gateway custom connection
  const tailorResolved = resolveFeatureLlmConfig(db, 'tailor', { userId: 'u1' });
  assert.equal(tailorResolved.inherited, true);
  assert.equal(tailorResolved.connectionId, customConn.id);
  assert.equal(tailorResolved.apiBase, 'https://user-litellm.example.com/v1');
  assert.equal(tailorResolved.apiKey, 'sk-user-custom-proxy-key');

  // 3. Overridden feature (Scorer) resolves to Groq connection
  const scorerResolved = resolveFeatureLlmConfig(db, 'scorer', { userId: 'u1' });
  assert.equal(scorerResolved.inherited, false);
  assert.equal(scorerResolved.connectionId, 'conn_builtin_groq');
  assert.equal(scorerResolved.provider, 'groq');
  assert.equal(scorerResolved.apiBase, 'https://api.groq.com/openai/v1');
  assert.equal(scorerResolved.apiKey, 'gsk-user-groq-key-123456');
  assert.equal(scorerResolved.model, 'groq/llama-3.3-70b-versatile');
});
