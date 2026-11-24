import { useState, useEffect, useCallback, useRef } from 'react';

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
  const pendingTimeoutRef = useRef<number | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const targetOrigin = window.location.origin;

    // Check if extension is installed by sending a ping with exact origin
    window.postMessage({ type: 'JOBFOUNDRY_GET_SCAN_STATE_REQUEST' }, targetOrigin);

    const handleMessage = (event: MessageEvent) => {
      // Validate origin and message payload
      if (
        event.origin !== targetOrigin ||
        event.source !== window ||
        !event.data ||
        typeof event.data !== 'object'
      ) {
        return;
      }

      const { type, state, result } = event.data;

      if (type === 'JOBFOUNDRY_EXTENSION_AVAILABLE') {
        setIsExtensionAvailable(true);
        localStorage.setItem('jf_extension_paired', 'true');
      }

      if (type === 'JOBFOUNDRY_SCAN_STATE_UPDATE' && state) {
        clearPendingTimeout();
        setScanState(state);
        setBannerDismissed(false);
      }

      if (type === 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE') {
        clearPendingTimeout();
        if (result?.ok && result.newIngested > 0 && onRefreshJobs) {
          onRefreshJobs();
        }
      }

      if (type === 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE') {
        clearPendingTimeout();
        if (result?.ok && result.scanned > 0 && onRefreshJobs) {
          onRefreshJobs();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearPendingTimeout();
      window.removeEventListener('message', handleMessage);
    };
  }, [onRefreshJobs, clearPendingTimeout]);

  const triggerSearchBoards = useCallback(() => {
    if (typeof window === 'undefined') return;
    const targetOrigin = window.location.origin;

    clearPendingTimeout();
    setBannerDismissed(false);
    setScanState({
      inProgress: true,
      type: 'search',
      statusMessage: 'Searching enabled job boards...',
      startedAt: Date.now(),
      totalFound: 0,
      newIngested: 0,
    });

    window.postMessage({ type: 'JOBFOUNDRY_SEARCH_BOARDS_REQUEST' }, targetOrigin);

    pendingTimeoutRef.current = window.setTimeout(() => {
      setScanState((prev) => {
        if (prev?.inProgress && prev?.type === 'search') {
          return {
            inProgress: false,
            type: 'search',
            statusMessage:
              'Search request timed out. Please ensure the JobFoundry extension is installed and active.',
            errors: ['Request timed out'],
          };
        }
        return prev;
      });
    }, 45000);
  }, [clearPendingTimeout]);

  const triggerScanPortals = useCallback(() => {
    if (typeof window === 'undefined') return;
    const targetOrigin = window.location.origin;

    clearPendingTimeout();
    setBannerDismissed(false);
    setScanState({
      inProgress: true,
      type: 'scan',
      statusMessage: 'Scanning 38 portal feeds...',
      startedAt: Date.now(),
      totalFound: 0,
      newIngested: 0,
    });

    window.postMessage({ type: 'JOBFOUNDRY_SCAN_PORTALS_REQUEST' }, targetOrigin);

    pendingTimeoutRef.current = window.setTimeout(() => {
      setScanState((prev) => {
        if (prev?.inProgress && prev?.type === 'scan') {
          return {
            inProgress: false,
            type: 'scan',
            statusMessage:
              'Scan request timed out. Please ensure the JobFoundry extension is installed and active.',
            errors: ['Request timed out'],
          };
        }
        return prev;
      });
    }, 45000);
  }, [clearPendingTimeout]);

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
