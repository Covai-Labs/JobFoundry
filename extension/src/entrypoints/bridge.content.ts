import { defineContentScript } from 'wxt/utils/define-content-script';
import { sendMessage } from '../shared/messaging.ts';
import { getConfig } from '../shared/config.ts';
import { getScanState, watchScanState } from '../shared/scan-state.ts';

function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (host === 'localhost' ||
        host === '127.0.0.1' ||
        host === 'covai.org' ||
        host.endsWith('.covai.org'))
    );
  } catch {
    return false;
  }
}

export default defineContentScript({
  matches: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*.covai.org/*'],
  runAt: 'document_start',
  async main() {
    const targetOrigin = window.location.origin;
    if (!isAllowedOrigin(targetOrigin)) return;

    let pairedOrigin: string | null = null;
    try {
      const config = await getConfig();
      if (config?.serverUrl) {
        pairedOrigin = new URL(config.serverUrl).origin.toLowerCase();
      }
    } catch {}

    const isPaired = pairedOrigin && targetOrigin.toLowerCase() === pairedOrigin;
    const isDevUnpaired =
      !pairedOrigin &&
      (targetOrigin.startsWith('http://localhost') || targetOrigin.startsWith('http://127.0.0.1'));

    if (!isPaired && !isDevUnpaired) {
      return;
    }

    // Notify dashboard that extension bridge is active
    window.postMessage({ type: 'JOBFOUNDRY_EXTENSION_AVAILABLE', version: '0.10.1' }, targetOrigin);
    try {
      window.sessionStorage.setItem('jf_extension_active', 'true');
      localStorage.setItem('jf_extension_paired', 'true');
    } catch {}

    const forwardCommand = async (
      action: 'popup:searchBoardsNow' | 'popup:scanNow',
      responseType: 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE' | 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE'
    ) => {
      try {
        const result = await sendMessage(action, undefined);
        window.postMessage({ type: responseType, result }, targetOrigin);
      } catch (err: any) {
        window.postMessage(
          { type: responseType, error: err?.message || String(err) },
          targetOrigin
        );
      }
    };

    const handleMessage = async (data: any) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'JOBFOUNDRY_SEARCH_BOARDS_REQUEST') {
        await forwardCommand('popup:searchBoardsNow', 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE');
      } else if (data.type === 'JOBFOUNDRY_SCAN_PORTALS_REQUEST') {
        await forwardCommand('popup:scanNow', 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE');
      } else if (data.type === 'JOBFOUNDRY_GET_SCAN_STATE_REQUEST') {
        try {
          const state = await getScanState();
          window.postMessage({ type: 'JOBFOUNDRY_SCAN_STATE_UPDATE', state }, targetOrigin);
        } catch {}
      }
    };

    // Listen synchronously for scan / search requests from the dashboard web app
    window.addEventListener('message', (event) => {
      if (
        event.origin !== targetOrigin ||
        event.source !== window ||
        !event.data ||
        typeof event.data !== 'object'
      ) {
        return;
      }
      void handleMessage(event.data);
    });

    // Forward live scan state updates to dashboard window
    try {
      watchScanState((state) => {
        window.postMessage({ type: 'JOBFOUNDRY_SCAN_STATE_UPDATE', state }, targetOrigin);
      });
    } catch {}
  },
});
