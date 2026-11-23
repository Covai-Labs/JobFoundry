import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExtensionSyncView } from '../ExtensionSyncView';
import { AuthProvider } from '../../../context/AuthContext';

describe('ExtensionSyncView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders Firefox first, Chromium second, and omits the Edge link', () => {
    render(
      <AuthProvider>
        <ExtensionSyncView />
      </AuthProvider>
    );

    const firefoxLink = screen.getByRole('link', { name: /Firefox.*LibreWolf/i });
    expect(firefoxLink).toHaveAttribute(
      'href',
      'https://addons.mozilla.org/en-US/firefox/addon/jobfoundry/'
    );
    expect(firefoxLink).toHaveAttribute('title', expect.stringContaining('Firefox Add-ons (AMO)'));
    expect(firefoxLink.getAttribute('title')).toContain('LibreWolf');

    const chromiumLink = screen.getByRole('link', { name: /Chromium.*Chrome/i });
    expect(chromiumLink).toHaveAttribute(
      'href',
      'https://chromewebstore.google.com/detail/jobfoundry/kacfnebbiekbofdkgfpgmdcncgohhonm'
    );
    expect(chromiumLink).toHaveAttribute('title', expect.stringContaining('Chrome Web Store'));
    expect(chromiumLink.getAttribute('title')).toContain('Brave');

    // Verify Firefox badge precedes Chromium badge in DOM order
    expect(
      firefoxLink.compareDocumentPosition(chromiumLink) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Edge link should not be present
    expect(screen.queryByRole('link', { name: /^Edge$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Chrome \/ Brave/i })).toBeNull();
  });
});
