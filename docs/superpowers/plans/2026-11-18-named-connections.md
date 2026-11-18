# Named Connections (Phase 2 & Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw provider pills, free-text base URLs, and duplicated feature API keys with a first-class Named Connections model (`{ id, name, apiType, baseUrl, apiKey, isBuiltIn }`) across backend storage, REST APIs, resolution logic, and settings UI.

**Architecture:** 
- A new `connections` (and `user_connections`) table stores built-in provider profiles (locked base URLs) and user-defined custom connections (SSRF-validated).
- Features (`gateway`, `scorer`, `tailor`, `copilot`) reference connection IDs instead of storing raw base URLs or provider keys.
- The LLM resolver (`llm-resolve.mjs` and `server/scorer/src/store.py`) resolves credentials exclusively from the referenced connection, guaranteeing that keys are never paired with unrelated endpoints.
- Settings UI provides a connection manager (add/edit/delete/test) and connection dropdowns for each AI feature.

**Tech Stack:** Node.js/ESM, SQLite (`better-sqlite3`), FastAPI/Python (`sqlite3`, `litellm`), React/TypeScript, Vitest, Pytest.

**Spec:** Issue [#198](https://github.com/Covai-Labs/JobFoundry/issues/198)

## Global Constraints
- Built-in provider base URLs are fixed and immutable via API (must return 400 if an update attempts to change `base_url`, not just hidden in UI).
- Custom connection base URLs must pass SSRF validation (`isValidHttpUrl` and private/internal IP check).
- Secret masking: `api_key` must never be returned in plaintext in list responses; only masked (`sk-...1234`) or empty indicators, unless explicitly verifying/testing.
- No direct push to `main`; all changes on branch `feat/settings-named-connections`.
- Existing #197 regression assertions must continue to pass (no cross-scope pairing of keys and endpoints).

## Review Focus
1. Built-in connection immutability: attempts to delete or mutate `base_url` on built-in connections must fail with clear error.
2. Custom connection SSRF prevention: local loopback/private network URLs are restricted according to environment policy.
3. Feature inheritance and connection switching: inheriting features correctly use the gateway's connection, while overridden features isolate their credentials.
4. Python Scorer parity: `server/scorer/src/store.py` reads connections table and resolves the exact same effective endpoint and key as Ingest.
5. Migration idempotency: running migrations multiple times or on clean vs existing databases preserves existing user keys.

---

### Task 1: Database Schema & Migration for Connections

**Files:**
- Modify: `server/ingest/src/db/schema.sql`
- Create: `server/ingest/src/settings/connections-store.mjs`
- Test: `server/ingest/test/connections-store.test.mjs`

- [ ] Define `connections` and `user_connections` tables with indices in `schema.sql`.
- [ ] Implement `initConnectionsStore` in `connections-store.mjs` with built-in seeds (OpenRouter, OpenAI, Groq, DeepSeek, Ollama, Anthropic, Gemini/Google).
- [ ] Implement migration of legacy `default_llm_api_key`, `scorer_api_key`, etc. into corresponding built-in connections.
- [ ] Implement CRUD operations with built-in immutability checks (`base_url` lock) and secret masking.
- [ ] Write unit tests verifying seeding, legacy migration, custom connection creation, and built-in protection.
- [ ] Run test suite and commit.

---

### Task 2: REST API Endpoints & SSRF Validation for Connections

**Files:**
- Modify: `server/ingest/src/app.mjs`
- Modify: `server/ingest/src/settings/settings.mjs`
- Create/Modify: `server/ingest/test/connections-api.test.mjs`

- [ ] Add `GET /api/v1/settings/connections`: returns list of connections for current user (masked keys).
- [ ] Add `POST /api/v1/settings/connections`: creates custom connection with SSRF validation on `base_url`.
- [ ] Add `PUT /api/v1/settings/connections/:id`: updates connection (blocks changing `base_url` or `api_type` on built-in connections).
- [ ] Add `DELETE /api/v1/settings/connections/:id`: deletes custom connection (rejects deleting built-in connections with 400).
- [ ] Add `POST /api/v1/settings/connections/:id/test`: tests live connection against `/models` or probe endpoint.
- [ ] Write integration tests for all connection endpoints and error cases.
- [ ] Run test suite and commit.

---

### Task 3: Connection-Based LLM Resolution (`server/ingest` & `server/scorer`)

**Files:**
- Modify: `server/ingest/src/settings/llm-resolve.mjs`
- Modify: `server/scorer/src/store.py`
- Modify: `server/ingest/test/llm-resolve.test.mjs`
- Modify: `server/scorer/tests/test_store.py`

- [ ] Update `resolveFeatureLlmConfig` in `llm-resolve.mjs` to resolve from `connection_id` when present, falling back gracefully to legacy settings if unset.
- [ ] Update `server/scorer/src/store.py` (`get_user_effective_llm`, `get_user_effective_tailor`) to read from the connections store/table.
- [ ] Verify that #197 regression tests and newly added tests pass.
- [ ] Run pytest on scorer and node test on ingest, and commit.

---

### Task 4: Web Frontend API Client & Connections UI

**Files:**
- Modify: `server/web/src/api/client.ts`
- Modify: `server/web/src/features/settings/SettingsPage.tsx`
- Modify: `server/web/src/features/settings/llmCatalog.ts`
- Modify: `server/web/src/features/settings/__tests__/SettingsPage.test.tsx`
- Modify: `server/web/src/api/__tests__/client.test.ts`

- [ ] Update `client.ts` with TypeScript interfaces for `LLMConnection` and API client methods (`getConnections`, `createConnection`, `updateConnection`, `deleteConnection`, `testConnection`).
- [ ] Add "AI Connections" management UI (modal or tab section) allowing users to see all connections, update API keys, add custom connections, and delete custom connections.
- [ ] Update Gateway, Scorer, Tailor, and Copilot forms in `SettingsPage.tsx` to select from named connections dropdown instead of provider pill wall and manual base URLs.
- [ ] Update Vitest unit tests in `SettingsPage.test.tsx` and `client.test.ts`.
- [ ] Run `npm test` and `tsc --noEmit` in `server/web`, and commit.

---

### Task 5: Documentation & End-to-End Verification

**Files:**
- Modify/Check: `site/src/pages/docs/api-keys.astro` (or relevant doc file)
- Run end-to-end regression tests across all services (tailor, scorer, ingest, web).
- Format and lint check across entire repo.
- Push branch and open PR with detailed summary.
