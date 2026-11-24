import { defineContentScript } from 'wxt/utils/define-content-script';
import { sendMessage } from '../shared/messaging.ts';
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
  main() {
    const targetOrigin = window.location.origin;
    if (!isAllowedOrigin(targetOrigin)) return;

    // Notify dashboard that extension bridge is active
    window.postMessage({ type: 'JOBFOUNDRY_EXTENSION_AVAILABLE', version: '0.10.1' }, targetOrigin);
    try {
      window.sessionStorage.setItem('jf_extension_active', 'true');
      localStorage.setItem('jf_extension_paired', 'true');
    } catch {}

    const handleMessage = async (data: any) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'JOBFOUNDRY_SEARCH_BOARDS_REQUEST') {
        try {
          const res = await sendMessage('popup:searchBoardsNow', undefined);
          window.postMessage(
            { type: 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE', result: res },
            targetOrigin
          );
        } catch (err: any) {
          window.postMessage(
            { type: 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE', error: err?.message || String(err) },
            targetOrigin
          );
        }
      }

      if (data.type === 'JOBFOUNDRY_SCAN_PORTALS_REQUEST') {
        try {
          const res = await sendMessage('popup:scanNow', undefined);
          window.postMessage(
            { type: 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE', result: res },
            targetOrigin
          );
        } catch (err: any) {
          window.postMessage(
            { type: 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE', error: err?.message || String(err) },
            targetOrigin
          );
        }
      }

      if (data.type === 'JOBFOUNDRY_GET_SCAN_STATE_REQUEST') {
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
