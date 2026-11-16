export function isMac(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as {
    userAgentData?: { platform?: string };
    platform?: string;
    userAgent?: string;
  };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|darwin/i.test(platform);
}

export interface ModKeyInfo {
  symbol: string;
  label: string;
  text: string;
}

export function getModKey(): ModKeyInfo {
  const mac = isMac();
  return {
    symbol: mac ? '⌘' : 'Ctrl',
    label: mac ? 'Cmd' : 'Ctrl',
    text: mac ? '⌘K' : 'Ctrl+K',
  };
}
