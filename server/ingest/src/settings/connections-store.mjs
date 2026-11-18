/**
 * Named Connections Store & Management.
 * Manages built-in provider profiles (locked endpoints) and user-defined custom connections.
 */

import crypto from 'node:crypto';
import { maskSecret, isMaskedSecret, isRegisteredUser, validateApiBase } from './settings.mjs';

export const BUILTIN_CONNECTIONS = Object.freeze([
  {
    id: 'conn_builtin_openrouter',
    name: 'OpenRouter',
    apiType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'conn_builtin_openai',
    name: 'OpenAI',
    apiType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'conn_builtin_anthropic',
    name: 'Anthropic',
    apiType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'conn_builtin_google',
    name: 'Google Gemini',
    apiType: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'conn_builtin_deepseek',
    name: 'DeepSeek',
    apiType: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'conn_builtin_groq',
    name: 'Groq',
    apiType: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'conn_builtin_ollama',
    name: 'Ollama (Local)',
    apiType: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
  },
  {
    id: 'conn_builtin_mistral',
    name: 'Mistral',
    apiType: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
  },
]);

function stripTrailingSlashes(str) {
  let s = typeof str === 'string' ? str.trim() : '';
  while (s.endsWith('/')) {
    s = s.slice(0, -1);
  }
  return s;
}

/**
 * Ensures table existence and seeds built-in connections.
 * Runs legacy migration idempotently.
 * @param {import('better-sqlite3').Database} db
 */
export function initConnectionsStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      api_type TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      is_built_in INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_connections_user ON connections(user_id);

    CREATE TABLE IF NOT EXISTS user_connection_keys (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      api_key TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, connection_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_connection_keys_user ON user_connection_keys(user_id);
  `);

  const now = Date.now();
  const selectStmt = db.prepare('SELECT id, base_url, is_built_in FROM connections WHERE id = ?');
  const insertStmt = db.prepare(`
    INSERT INTO connections (id, user_id, name, api_type, base_url, api_key, is_built_in, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, '', 1, ?, ?)
  `);
  const updateBuiltInStmt = db.prepare(`
    UPDATE connections
    SET name = ?, api_type = ?, base_url = ?, is_built_in = 1, updated_at = ?
    WHERE id = ?
  `);

  db.transaction(() => {
    for (const item of BUILTIN_CONNECTIONS) {
      const existing = selectStmt.get(item.id);
      if (!existing) {
        insertStmt.run(item.id, item.name, item.apiType, item.baseUrl, now, now);
      } else {
        updateBuiltInStmt.run(item.name, item.apiType, item.baseUrl, now, item.id);
      }
    }
  })();

  migrateLegacySettingsToConnections(db);
}

/**
 * Migrates existing keys from system_settings and user_settings to connections.
 * @param {import('better-sqlite3').Database} db
 */
export function migrateLegacySettingsToConnections(db) {
  const now = Date.now();
  const hasSystemSettings = Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'").get()
  );
  if (!hasSystemSettings) return;

  const getSystemSetting = (key) => {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    return row ? row.value : null;
  };

  const setSystemSettingIfMissing = (key, val) => {
    const row = db.prepare('SELECT key FROM system_settings WHERE key = ?').get(key);
    if (!row) {
      db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)').run(
        key,
        val,
        now
      );
    }
  };

  const explicitProvider = getSystemSetting('default_llm_provider');
  const defaultKey = getSystemSetting('default_llm_api_key') || '';
  const defaultBase = getSystemSetting('default_llm_api_base') || '';

  const hasLegacySettings = Boolean(explicitProvider || defaultKey || defaultBase);
  if (!hasLegacySettings) return;

  const defaultProvider = explicitProvider || 'openrouter';

  // Determine built-in connection matching default provider
  const matchingBuiltIn =
    BUILTIN_CONNECTIONS.find((c) => c.apiType === defaultProvider) || BUILTIN_CONNECTIONS[0];
  let defaultConnId = matchingBuiltIn.id;

  // If operator configured a custom base URL that doesn't match the built-in, create a custom connection
  if (defaultBase && defaultBase !== matchingBuiltIn.baseUrl) {
    const customId = 'conn_migrated_custom_gateway';
    const existingCustom = db.prepare('SELECT id FROM connections WHERE id = ?').get(customId);
    if (!existingCustom) {
      db.prepare(
        `
        INSERT INTO connections (id, user_id, name, api_type, base_url, api_key, is_built_in, created_at, updated_at)
        VALUES (?, NULL, 'Default Gateway (Custom)', ?, ?, ?, 0, ?, ?)
      `
      ).run(customId, defaultProvider || 'openai', defaultBase, defaultKey, now, now);
    }
    defaultConnId = customId;
  } else if (defaultKey) {
    // Populate the built-in connection's key if not already set
    db.prepare(
      `
      UPDATE connections
      SET api_key = ?
      WHERE id = ? AND (api_key IS NULL OR api_key = '')
    `
    ).run(defaultKey, matchingBuiltIn.id);
  }

  // Set default connection IDs on system_settings if not present
  setSystemSettingIfMissing('gateway_connection_id', defaultConnId);
  setSystemSettingIfMissing('scorer_connection_id', defaultConnId);
  setSystemSettingIfMissing('tailor_connection_id', defaultConnId);
  setSystemSettingIfMissing('copilot_connection_id', defaultConnId);

  // Migrate user_settings keys to user_connection_keys
  const hasUserSettings = Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'").get()
  );
  if (hasUserSettings) {
    const userKeys = db
      .prepare(
        `
      SELECT user_id, key, value FROM user_settings
      WHERE key IN ('default_llm_api_key', 'scorer_api_key', 'tailor_api_key', 'copilot_api_key')
        AND value != ''
    `
      )
      .all();

    const insertUserKeyStmt = db.prepare(`
      INSERT INTO user_connection_keys (user_id, connection_id, api_key, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, connection_id) DO UPDATE SET
        api_key = excluded.api_key,
        updated_at = excluded.updated_at
      WHERE user_connection_keys.api_key = ''
    `);

    db.transaction(() => {
      for (const row of userKeys) {
        insertUserKeyStmt.run(row.user_id, defaultConnId, row.value, now);
      }
    })();
  }
}

/**
 * Checks which features are referencing a connection id.
 * @param {import('better-sqlite3').Database} db
 * @param {string} connectionId
 * @param {string|null} userId
 * @returns {string[]} array of feature names ('gateway' | 'scorer' | 'tailor' | 'copilot')
 */
export function getFeaturesUsingConnection(db, connectionId, userId = null) {
  const features = [];
  const registered = isRegisteredUser(db, userId);

  const getVal = (key) => {
    if (registered) {
      const uRow = db
        .prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?')
        .get(userId, key);
      if (uRow?.value) return uRow.value;
    }
    const sRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
    return sRow?.value || null;
  };

  const gatewayConn = getVal('gateway_connection_id') || 'conn_builtin_openrouter';
  if (gatewayConn === connectionId) features.push('gateway');

  const scorerInherit = getVal('scorer_inherit_default') !== 'false';
  const scorerConn = scorerInherit ? gatewayConn : getVal('scorer_connection_id') || gatewayConn;
  if (scorerConn === connectionId && !features.includes('scorer')) features.push('scorer');

  const tailorInherit = getVal('tailor_inherit_default') !== 'false';
  const tailorConn = tailorInherit ? gatewayConn : getVal('tailor_connection_id') || gatewayConn;
  if (tailorConn === connectionId && !features.includes('tailor')) features.push('tailor');

  const copilotInherit = getVal('copilot_inherit_default') !== 'false';
  const copilotConn = copilotInherit ? gatewayConn : getVal('copilot_connection_id') || gatewayConn;
  if (copilotConn === connectionId && !features.includes('copilot')) features.push('copilot');

  return features;
}

/**
 * Lists connections for the caller, with secret masking.
 * @param {import('better-sqlite3').Database} db
 * @param {{ userId?: string|null }} [options]
 */
export function listConnections(db, { userId = null } = {}) {
  const registered = isRegisteredUser(db, userId);

  let rows;
  if (registered) {
    rows = db
      .prepare(
        `
      SELECT
        c.id,
        c.user_id,
        c.name,
        c.api_type,
        c.base_url,
        COALESCE(uck.api_key, CASE WHEN c.user_id = ? THEN c.api_key ELSE '' END) AS effective_key,
        c.is_built_in,
        c.created_at,
        c.updated_at
      FROM connections c
      LEFT JOIN user_connection_keys uck ON uck.connection_id = c.id AND uck.user_id = ?
      WHERE c.is_built_in = 1 OR c.user_id = ?
      ORDER BY c.is_built_in DESC, c.name ASC
    `
      )
      .all(userId, userId, userId);
  } else {
    rows = db
      .prepare(
        `
      SELECT
        id,
        user_id,
        name,
        api_type,
        base_url,
        api_key AS effective_key,
        is_built_in,
        created_at,
        updated_at
      FROM connections
      WHERE is_built_in = 1 OR user_id IS NULL
      ORDER BY is_built_in DESC, name ASC
    `
      )
      .all();
  }

  return rows.map((r) => {
    const rawKey = r.effective_key || '';
    const inUseBy = getFeaturesUsingConnection(db, r.id, userId);
    return {
      id: r.id,
      name: r.name,
      apiType: r.api_type,
      baseUrl: r.base_url,
      apiKey: maskSecret(rawKey),
      isConfigured: Boolean(rawKey || r.api_type === 'ollama'),
      isBuiltIn: Boolean(r.is_built_in),
      inUseBy,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

/**
 * Retrieves a single connection by ID.
 * @param {import('better-sqlite3').Database} db
 * @param {string} connectionId
 * @param {{ userId?: string|null, includeSecret?: boolean }} [options]
 */
export function getConnection(db, connectionId, { userId = null, includeSecret = false } = {}) {
  const registered = isRegisteredUser(db, userId);
  let row;

  if (registered) {
    row = db
      .prepare(
        `
      SELECT
        c.id,
        c.user_id,
        c.name,
        c.api_type,
        c.base_url,
        COALESCE(uck.api_key, CASE WHEN c.user_id = ? THEN c.api_key ELSE '' END) AS effective_key,
        c.is_built_in,
        c.created_at,
        c.updated_at
      FROM connections c
      LEFT JOIN user_connection_keys uck ON uck.connection_id = c.id AND uck.user_id = ?
      WHERE c.id = ? AND (c.is_built_in = 1 OR c.user_id = ?)
    `
      )
      .get(userId, userId, connectionId, userId);
  } else {
    row = db
      .prepare(
        `
      SELECT
        id,
        user_id,
        name,
        api_type,
        base_url,
        api_key AS effective_key,
        is_built_in,
        created_at,
        updated_at
      FROM connections
      WHERE id = ? AND (is_built_in = 1 OR user_id IS NULL)
    `
      )
      .get(connectionId);
  }

  if (!row) return null;

  const rawKey = row.effective_key || '';
  return {
    id: row.id,
    name: row.name,
    apiType: row.api_type,
    baseUrl: row.base_url,
    apiKey: includeSecret ? rawKey : maskSecret(rawKey),
    isConfigured: Boolean(rawKey || row.api_type === 'ollama'),
    isBuiltIn: Boolean(row.is_built_in),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Creates a custom connection.
 * @param {import('better-sqlite3').Database} db
 * @param {{ name: string, apiType: string, baseUrl: string, apiKey?: string }} payload
 * @param {{ userId?: string|null }} [options]
 */
export function createConnection(
  db,
  { name, apiType, baseUrl, apiKey = '' },
  { userId = null } = {}
) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Connection name is required');
  }
  if (!apiType || typeof apiType !== 'string' || !apiType.trim()) {
    throw new Error('API type is required');
  }
  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    throw new Error('Base URL is required');
  }

  const cleanBase = stripTrailingSlashes(baseUrl);
  validateApiBase(cleanBase);

  const cleanName = name.trim();
  const cleanType = apiType.trim().toLowerCase();
  const cleanKey = isMaskedSecret(apiKey) ? '' : apiKey.trim();

  const id = `conn_${crypto.randomUUID()}`;
  const now = Date.now();
  const effectiveUserId = isRegisteredUser(db, userId) ? userId : null;

  db.prepare(
    `
    INSERT INTO connections (id, user_id, name, api_type, base_url, api_key, is_built_in, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `
  ).run(id, effectiveUserId, cleanName, cleanType, cleanBase, cleanKey, now, now);

  return getConnection(db, id, { userId, includeSecret: false });
}

/**
 * Updates a connection. Enforces that built-in base URLs cannot be changed.
 * @param {import('better-sqlite3').Database} db
 * @param {string} connectionId
 * @param {{ name?: string, apiType?: string, baseUrl?: string, apiKey?: string }} patch
 * @param {{ userId?: string|null }} [options]
 */
export function updateConnection(db, connectionId, patch = {}, { userId = null } = {}) {
  const existing = getConnection(db, connectionId, { userId, includeSecret: true });
  if (!existing) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  const now = Date.now();
  const registered = isRegisteredUser(db, userId);

  if (existing.isBuiltIn) {
    // Built-in rule: base_url, api_type, and name are immutable via API
    if (patch.baseUrl !== undefined && patch.baseUrl !== existing.baseUrl) {
      throw new Error(`Cannot modify base_url of built-in connection: ${connectionId}`);
    }
    if (patch.apiType !== undefined && patch.apiType !== existing.apiType) {
      throw new Error(`Cannot modify api_type of built-in connection: ${connectionId}`);
    }

    // Only apiKey can be updated for built-ins
    if (patch.apiKey !== undefined && !isMaskedSecret(patch.apiKey)) {
      const cleanKey = patch.apiKey.trim();
      if (registered) {
        db.prepare(
          `
          INSERT INTO user_connection_keys (user_id, connection_id, api_key, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, connection_id) DO UPDATE SET
            api_key = excluded.api_key,
            updated_at = excluded.updated_at
        `
        ).run(userId, connectionId, cleanKey, now);
      } else {
        db.prepare(
          `
          UPDATE connections
          SET api_key = ?, updated_at = ?
          WHERE id = ?
        `
        ).run(cleanKey, now, connectionId);
      }
    }
  } else {
    // Custom connection
    const newName = patch.name !== undefined ? patch.name.trim() : existing.name;
    const newType =
      patch.apiType !== undefined ? patch.apiType.trim().toLowerCase() : existing.apiType;
    let newBase = existing.baseUrl;

    if (patch.baseUrl !== undefined) {
      newBase = stripTrailingSlashes(patch.baseUrl);
      validateApiBase(newBase);
    }

    const keyUpdate =
      patch.apiKey !== undefined && !isMaskedSecret(patch.apiKey)
        ? patch.apiKey.trim()
        : existing.apiKey;

    db.prepare(
      `
      UPDATE connections
      SET name = ?, api_type = ?, base_url = ?, api_key = ?, updated_at = ?
      WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
    `
    ).run(
      newName,
      newType,
      newBase,
      keyUpdate,
      now,
      connectionId,
      registered ? userId : null,
      registered ? userId : null
    );
  }

  return getConnection(db, connectionId, { userId, includeSecret: false });
}

/**
 * Deletes a custom connection. Rejects deleting built-in connections.
 * @param {import('better-sqlite3').Database} db
 * @param {string} connectionId
 * @param {{ userId?: string|null }} [options]
 */
export function deleteConnection(db, connectionId, { userId = null } = {}) {
  const existing = getConnection(db, connectionId, { userId, includeSecret: true });
  if (!existing) {
    throw new Error(`Connection not found: ${connectionId}`);
  }
  if (existing.isBuiltIn) {
    throw new Error(`Cannot delete built-in connection: ${connectionId}`);
  }

  const registered = isRegisteredUser(db, userId);
  const info = db
    .prepare(
      `
    DELETE FROM connections
    WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
  `
    )
    .run(connectionId, registered ? userId : null, registered ? userId : null);

  return { ok: true, deleted: info.changes > 0 };
}
