import { describe, it, expect } from 'vitest';
import { THEME_CATALOG, findThemeMetadata } from '../themeCatalog';

describe('themeCatalog', () => {
  it('contains 14 curated themes', () => {
    expect(THEME_CATALOG).toHaveLength(14);
  });

  it('does not contain folio-concise', () => {
    expect(findThemeMetadata('jsonresume-theme-folio-concise')).toBeUndefined();
  });

  it('resolves metadata for folio and jake-technical', () => {
    const folio = findThemeMetadata('jsonresume-theme-folio');
    expect(folio?.name).toBe('Folio');
    expect(folio?.engine).toBe('folio');

    const jake = findThemeMetadata('jsonresume-theme-jake-technical');
    expect(jake?.name).toBe('Jake Technical');
    expect(jake?.badges).toContain('ATS-Safe');
  });
});
