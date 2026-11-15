import { describe, it, expect } from 'vitest';
import {
  detectProviderFromModel,
  inferProviderFromModel,
  providerDefaultBase,
  resolveEffectiveEndpoint,
} from '../llmCatalog';

describe('llmCatalog endpoint resolution', () => {
  it('never invents a provider for an unknown model', () => {
    expect(inferProviderFromModel('my-private-model')).toBe('');
    // The UI still needs a default provider to preselect.
    expect(detectProviderFromModel('my-private-model')).toBe('openrouter');
  });

  it('does not give an explicitly selected unknown provider another provider base', () => {
    expect(providerDefaultBase('my-proxy', 'gpt-4o-mini')).toBe('');
    expect(providerDefaultBase('', 'my-private-model')).toBe('');
    expect(providerDefaultBase('openrouter', 'openrouter/openrouter/free')).toBe(
      'https://openrouter.ai/api/v1'
    );
  });

  it('a non-inheriting feature never reports the gateway proxy as its target', () => {
    const target = resolveEffectiveEndpoint({
      inherit: false,
      gatewayBase: 'https://litellm.example.com/v1',
      gatewayProvider: 'custom',
      gatewayModel: 'openrouter/openrouter/free',
      featureBase: '',
      featureProvider: 'openrouter',
      featureModel: 'openrouter/openrouter/free',
    });

    expect(target.url).toBe('https://openrouter.ai/api/v1');
    expect(target.url).not.toContain('litellm.example.com');
  });

  it('reports an unknown non-inheriting provider as prefix-routed, not guessed', () => {
    const target = resolveEffectiveEndpoint({
      inherit: false,
      gatewayBase: 'https://litellm.example.com/v1',
      featureBase: '',
      featureProvider: 'my-private-proxy',
      featureModel: 'gpt-4o-mini',
    });

    expect(target.url).toBe('');
    expect(target.note).toMatch(/model prefix/i);
  });

  it('mirrors backend inheritance for an inheriting feature', () => {
    const target = resolveEffectiveEndpoint({
      inherit: true,
      gatewayBase: 'https://litellm.example.com/v1',
      gatewayProvider: 'custom',
      gatewayModel: 'openrouter/openrouter/free',
    });

    expect(target.url).toBe('https://litellm.example.com/v1');
  });
});
