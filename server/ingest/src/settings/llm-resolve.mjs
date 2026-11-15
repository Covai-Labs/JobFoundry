/**
 * Provider-aware resolution of LLM connection settings.
 *
 * A feature that opts out of the Default Gateway owns its credentials as one
 * unit: its own key, model and base URL. The base URL must never fall back to
 * `default_llm_api_base` in that case — doing so silently paired an OpenRouter
 * key with a self-hosted LiteLLM proxy and produced
 * `token_not_found_in_db` / 401 from the proxy.
 *
 * When no explicit base URL is configured the provider's public OpenAI-compatible
 * endpoint is used. Providers without a known endpoint resolve to an empty base,
 * which lets LiteLLM route natively from the model prefix (e.g. `gemini/...`).
 */

import {
  getEffectiveSetting,
  getEffectiveSettingWithSource,
  isRegisteredUser,
} from './settings.mjs';

export const LLM_FEATURES = new Set(['gateway', 'scorer', 'tailor', 'copilot']);

/** Public OpenAI-compatible endpoints for providers we can address directly. */
export const PROVIDER_DEFAULT_BASES = Object.freeze({
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  ollama: 'http://127.0.0.1:11434/v1',
  // A self-hosted gateway has no public endpoint; it must be configured.
  custom: '',
});

/**
 * Infers a provider id from a LiteLLM model identifier.
 * Mirrors the provider ids used by the web UI (`llmCatalog.ts`).
 * @param {string} modelString
 * @returns {string} provider id, or '' when unknown
 */
export function inferProviderFromModel(modelString) {
  const s = String(modelString || '')
    .toLowerCase()
    .trim();
  if (!s) return '';
  if (s.startsWith('openrouter/')) return 'openrouter';
  if (s.startsWith('groq/')) return 'groq';
  if (s.startsWith('ollama/')) return 'ollama';
  if (s.startsWith('deepseek/')) return 'deepseek';
  if (s.startsWith('gemini/') || s.startsWith('google/')) return 'google';
  if (s.startsWith('anthropic/') || s.includes('claude') || s.includes('fable')) return 'anthropic';
  if (s.startsWith('qwen/') || s.includes('qwen')) return 'qwen';
  if (s.startsWith('zhipu/') || s.includes('glm')) return 'zhipu';
  if (s.startsWith('moonshot/') || s.includes('kimi')) return 'moonshot';
  if (s.startsWith('meta/') || s.includes('muse')) return 'meta';
  if (s.startsWith('ibm/') || s.includes('granite')) return 'ibm';
  if (s.startsWith('mistral/') || s.includes('leanstral')) return 'mistral';
  if (s.startsWith('gpt-') || s.startsWith('openai/') || s.startsWith('o3-')) return 'openai';
  return '';
}

/**
 * UI-facing provider detection: unknown models default to OpenRouter, the
 * household default provider. Base-URL resolution must use
 * `inferProviderFromModel` instead so unknown models are not silently routed to
 * a provider the user never selected.
 * @param {string} modelString
 */
export function detectProviderFromModel(modelString) {
  return inferProviderFromModel(modelString) || 'openrouter';
}

/**
 * Trims a base URL and drops trailing slashes. Returns '' for non-strings.
 * Implemented without a regex: `/\/+$/` is polynomial on long input and trips
 * CodeQL's ReDoS rule.
 * @param {unknown} value
 */
export function normalizeApiBase(value) {
  if (typeof value !== 'string') return '';
  let out = value.trim();
  while (out.endsWith('/')) {
    out = out.slice(0, -1);
  }
  return out;
}

/**
 * Returns the public endpoint for an explicitly selected provider.
 *
 * An unknown / unsupported provider resolves to '' so LiteLLM routes from the
 * model prefix. It must never borrow another provider's public endpoint: that
 * is how a key ends up at the wrong service. Model inference is only used when
 * the caller selected no provider at all.
 * @param {string} [provider]
 * @param {string} [model]
 */
export function defaultBaseForProvider(provider, model) {
  const p = String(provider || '').toLowerCase();
  if (p) {
    return Object.prototype.hasOwnProperty.call(PROVIDER_DEFAULT_BASES, p)
      ? PROVIDER_DEFAULT_BASES[p]
      : '';
  }
  return PROVIDER_DEFAULT_BASES[inferProviderFromModel(model)] || '';
}

/**
 * Resolves the effective LLM credentials for one feature.
 *
 * Credential scopes are resolved independently:
 *  - `gateway` always uses the `default_llm_*` settings.
 *  - A feature that inherits uses the gateway settings.
 *  - A feature that does not inherit uses only its own `*_api_base`. It never
 *    falls back to the gateway's base URL, because that URL belongs to a
 *    different credential scope and may point at an incompatible provider.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {'gateway'|'scorer'|'tailor'|'copilot'} feature
 * @param {{ userId?: string|null, env?: Record<string, string|undefined> }} [options]
 */
export function resolveFeatureLlmConfig(db, feature, { userId = null, env = process.env } = {}) {
  if (!LLM_FEATURES.has(feature)) {
    throw new Error(`invalid llm feature: ${feature}`);
  }
  const scope = { userId, env };
  const isGateway = feature === 'gateway';

  const inherit = isGateway
    ? true
    : (getEffectiveSetting(db, `${feature}_inherit_default`, env, userId) ?? true);
  const inheritModel = isGateway
    ? true
    : (getEffectiveSetting(db, `${feature}_inherit_model`, env, userId) ?? true);

  const defaultProvider = getEffectiveSetting(db, 'default_llm_provider', env, userId) || '';
  const featureProvider = isGateway
    ? defaultProvider
    : getEffectiveSetting(db, `${feature}_provider`, env, userId) || '';
  const provider = inherit ? defaultProvider : featureProvider;

  // --- Model -------------------------------------------------------------
  let modelSetting;
  if (isGateway || (inherit && inheritModel)) {
    modelSetting = getEffectiveSettingWithSource(db, 'default_llm_model', scope);
    if (!modelSetting.value && !isGateway) {
      modelSetting = getEffectiveSettingWithSource(db, `${feature}_model`, scope);
    }
  } else {
    modelSetting = getEffectiveSettingWithSource(db, `${feature}_model`, scope);
    if (!modelSetting.value) {
      modelSetting = getEffectiveSettingWithSource(db, 'default_llm_model', scope);
    }
  }
  const model = modelSetting.value || '';

  // --- API key -----------------------------------------------------------
  let keySetting;
  if (isGateway) {
    keySetting = getEffectiveSettingWithSource(db, 'default_llm_api_key', scope);
  } else if (inherit) {
    // Inheritance means the gateway's credential scope, including its key.
    // Borrowing the feature key here would pair a feature credential with the
    // gateway endpoint (the reverse of the bug this resolver fixes).
    keySetting = getEffectiveSettingWithSource(db, 'default_llm_api_key', scope);
  } else {
    // An explicit override owns its key. Falling back to the gateway key would
    // re-introduce the cross-scope pairing this resolver exists to prevent.
    keySetting = getEffectiveSettingWithSource(db, `${feature}_api_key`, scope);
  }

  // --- Base URL ----------------------------------------------------------
  // The gateway/inherited scope may use the gateway base. A feature that
  // opted out must use its own base only. A retained feature base is ignored
  // while inheriting: it belongs to a different credential scope and would
  // send the gateway key to a stale private proxy.
  let baseSetting;
  if (isGateway || inherit) {
    baseSetting = getEffectiveSettingWithSource(db, 'default_llm_api_base', scope);
  } else {
    baseSetting = getEffectiveSettingWithSource(db, `${feature}_api_base`, scope);
  }

  let apiBase = normalizeApiBase(baseSetting.value);
  let apiBaseSource = baseSetting.source;
  if (!apiBase) {
    apiBase = defaultBaseForProvider(provider, model);
    apiBaseSource = apiBase ? 'provider-default' : 'default';
  }

  // --- BYOK --------------------------------------------------------------
  // A registered user may only use their own key; a shared platform/system
  // key is never forwarded on their behalf.
  const registered = isRegisteredUser(db, userId);
  const keyAllowed = !registered || keySetting.source === 'user';

  return {
    feature,
    inherited: inherit,
    provider: provider || inferProviderFromModel(model),
    model,
    apiKey: keyAllowed ? keySetting.value || '' : '',
    keySource: keySetting.source,
    apiBase,
    apiBaseSource,
    registered,
  };
}
