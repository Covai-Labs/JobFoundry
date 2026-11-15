import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate.mjs';
import { updateSettings } from '../src/settings/settings.mjs';
import {
  defaultBaseForProvider,
  detectProviderFromModel,
  resolveFeatureLlmConfig,
} from '../src/settings/llm-resolve.mjs';

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
  assert.equal(detectProviderFromModel(''), '');
});

test('defaultBaseForProvider prefers the provider and falls back to the model', () => {
  assert.equal(defaultBaseForProvider('openrouter'), 'https://openrouter.ai/api/v1');
  assert.equal(
    defaultBaseForProvider('', 'groq/llama-3.3-70b-versatile'),
    'https://api.groq.com/openai/v1'
  );
  assert.equal(defaultBaseForProvider('google', 'gemini/gemini-3.8-flash'), '');
  assert.equal(defaultBaseForProvider('custom', 'my-local-model'), '');
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
