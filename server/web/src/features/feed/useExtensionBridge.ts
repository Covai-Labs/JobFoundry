import { useState, useEffect, useCallback } from 'react';

export interface ExtensionScanState {
  inProgress: boolean;
  type: 'search' | 'scan' | 'capture' | null;
  statusMessage: string;
  termsSearched?: string[];
  currentTerm?: string;
  totalFound?: number;
  newIngested?: number;
  droppedDedup?: number;
  errors?: string[];
  startedAt?: number;
  completedAt?: number;
}

export function useExtensionBridge(onRefreshJobs?: () => void) {
  const [isExtensionAvailable, setIsExtensionAvailable] = useState(() => {
    return (
      typeof window !== 'undefined' &&
      (localStorage.getItem('jf_extension_paired') === 'true' ||
        sessionStorage.getItem('jf_extension_active') === 'true')
    );
  });

  const [scanState, setScanState] = useState<ExtensionScanState | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if extension is installed by sending a ping
    window.postMessage({ type: 'JOBFOUNDRY_GET_SCAN_STATE_REQUEST' }, '*');

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;

      const { type, state, result } = event.data;

      if (type === 'JOBFOUNDRY_EXTENSION_AVAILABLE') {
        setIsExtensionAvailable(true);
        localStorage.setItem('jf_extension_paired', 'true');
      }

      if (type === 'JOBFOUNDRY_SCAN_STATE_UPDATE' && state) {
        setScanState(state);
        setBannerDismissed(false);
      }

      if (type === 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE') {
        if (result?.ok && result.newIngested > 0 && onRefreshJobs) {
          onRefreshJobs();
        }
      }

      if (type === 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE') {
        if (result?.ok && result.scanned > 0 && onRefreshJobs) {
          onRefreshJobs();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRefreshJobs]);

  const triggerSearchBoards = useCallback(() => {
    setBannerDismissed(false);
    setScanState({
      inProgress: true,
      type: 'search',
      statusMessage: 'Searching enabled job boards...',
      startedAt: Date.now(),
      totalFound: 0,
      newIngested: 0,
    });
    window.postMessage({ type: 'JOBFOUNDRY_SEARCH_BOARDS_REQUEST' }, '*');
  }, []);

  const triggerScanPortals = useCallback(() => {
    setBannerDismissed(false);
    setScanState({
      inProgress: true,
      type: 'scan',
      statusMessage: 'Scanning 38 portal feeds...',
      startedAt: Date.now(),
      totalFound: 0,
      newIngested: 0,
    });
    window.postMessage({ type: 'JOBFOUNDRY_SCAN_PORTALS_REQUEST' }, '*');
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  return {
    isExtensionAvailable,
    scanState,
    bannerDismissed,
    triggerSearchBoards,
    triggerScanPortals,
    dismissBanner,
  };
}
