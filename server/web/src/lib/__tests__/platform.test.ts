import { describe, it, expect, afterEach } from 'vitest';
import { isMac, getModKey } from '../platform';

describe('platform utilities', () => {
  const originalNavigator = window.navigator;

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('detects macOS when userAgentData platform reports macOS', () => {
    Object.defineProperty(window, 'navigator', {
      value: { userAgentData: { platform: 'macOS' }, userAgent: 'Chrome' },
      configurable: true,
      writable: true,
    });
    expect(isMac()).toBe(true);
    expect(getModKey()).toEqual({
      symbol: '⌘',
      label: 'Cmd',
      text: '⌘K',
    });
  });

  it('detects macOS when navigator.platform reports MacIntel', () => {
    Object.defineProperty(window, 'navigator', {
      value: { platform: 'MacIntel', userAgent: 'Macintosh' },
      configurable: true,
      writable: true,
    });
    expect(isMac()).toBe(true);
    expect(getModKey()).toEqual({
      symbol: '⌘',
      label: 'Cmd',
      text: '⌘K',
    });
  });

  it('detects non-Mac when userAgentData platform reports Linux or Windows', () => {
    Object.defineProperty(window, 'navigator', {
      value: { userAgentData: { platform: 'Linux' }, userAgent: 'Linux x86_64' },
      configurable: true,
      writable: true,
    });
    expect(isMac()).toBe(false);
    expect(getModKey()).toEqual({
      symbol: 'Ctrl',
      label: 'Ctrl',
      text: 'Ctrl+K',
    });
  });

  it('detects non-Mac when navigator.platform reports Win32', () => {
    Object.defineProperty(window, 'navigator', {
      value: { platform: 'Win32', userAgent: 'Windows NT 10.0' },
      configurable: true,
      writable: true,
    });
    expect(isMac()).toBe(false);
    expect(getModKey()).toEqual({
      symbol: 'Ctrl',
      label: 'Ctrl',
      text: 'Ctrl+K',
    });
  });
});
