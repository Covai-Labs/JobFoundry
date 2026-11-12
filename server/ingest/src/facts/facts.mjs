import { randomUUID } from 'node:crypto';

export const ALLOWED_CATEGORIES = new Set([
  'general',
  'preference',
  'constraint',
  'context',
  'style',
  'compensation',
]);

/**
 * Get all facts for a user.
 */
export function getUserFacts(db, userId, { activeOnly = false } = {}) {
  const query = activeOnly
    ? 'SELECT id, user_id, category, fact_text, is_active, created_at, updated_at FROM user_facts WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC'
    : 'SELECT id, user_id, category, fact_text, is_active, created_at, updated_at FROM user_facts WHERE user_id = ? ORDER BY created_at ASC';

  return db
    .prepare(query)
    .all(userId)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      factText: row.fact_text,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

/**
 * Create a new user fact.
 */
export function createUserFact(db, { userId, category = 'general', factText, isActive = true }) {
  if (!factText || typeof factText !== 'string' || !factText.trim()) {
    throw new Error('factText is required and must be non-empty');
  }

  const cleanCategory = typeof category === 'string' && ALLOWED_CATEGORIES.has(category.toLowerCase())
    ? category.toLowerCase()
    : 'general';

  const id = `fact_${randomUUID()}`;
  const now = Date.now();
  const trimmed = factText.trim();
  const activeInt = isActive ? 1 : 0;

  db.prepare(
    `INSERT INTO user_facts (id, user_id, category, fact_text, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, cleanCategory, trimmed, activeInt, now, now);

  return {
    id,
    userId,
    category: cleanCategory,
    factText: trimmed,
    isActive: Boolean(activeInt),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an existing user fact.
 */
export function updateUserFact(db, { userId, factId, category, factText, isActive }) {
  const existing = db
    .prepare('SELECT id, user_id, category, fact_text, is_active FROM user_facts WHERE id = ? AND user_id = ?')
    .get(factId, userId);

  if (!existing) return null;

  let finalCategory = existing.category;
  if (category !== undefined) {
    if (typeof category === 'string' && ALLOWED_CATEGORIES.has(category.toLowerCase())) {
      finalCategory = category.toLowerCase();
    }
  }

  let finalFactText = existing.fact_text;
  if (factText !== undefined) {
    if (typeof factText !== 'string' || !factText.trim()) {
      throw new Error('factText cannot be empty');
    }
    finalFactText = factText.trim();
  }

  const finalIsActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active;
  const now = Date.now();

  db.prepare(
    `UPDATE user_facts
     SET category = ?, fact_text = ?, is_active = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(finalCategory, finalFactText, finalIsActive, now, factId, userId);

  return {
    id: existing.id,
    userId,
    category: finalCategory,
    factText: finalFactText,
    isActive: Boolean(finalIsActive),
    updatedAt: now,
  };
}

/**
 * Delete a user fact.
 */
export function deleteUserFact(db, { userId, factId }) {
  const res = db
    .prepare('DELETE FROM user_facts WHERE id = ? AND user_id = ?')
    .run(factId, userId);
  return res.changes > 0;
}
