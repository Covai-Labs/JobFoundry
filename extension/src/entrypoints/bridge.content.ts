import { defineContentScript } from 'wxt/utils/define-content-script';
import { sendMessage } from '../shared/messaging.ts';
import { getScanState, watchScanState } from '../shared/scan-state.ts';

export default defineContentScript({
  matches: ['http://localhost/*', 'http://127.0.0.1/*', 'https://*.covai.org/*'],
  runAt: 'document_start',
  main() {
    // Notify dashboard that extension bridge is active
    window.postMessage({ type: 'JOBFOUNDRY_EXTENSION_AVAILABLE', version: '0.10.1' }, '*');
    try {
      window.sessionStorage.setItem('jf_extension_active', 'true');
      localStorage.setItem('jf_extension_paired', 'true');
    } catch {}

    // Listen for scan / search requests from the dashboard web app
    window.addEventListener('message', async (event) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'JOBFOUNDRY_SEARCH_BOARDS_REQUEST') {
        try {
          const res = await sendMessage('popup:searchBoardsNow', undefined);
          window.postMessage({ type: 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE', result: res }, '*');
        } catch (err: any) {
          window.postMessage(
            { type: 'JOBFOUNDRY_SEARCH_BOARDS_RESPONSE', error: err?.message || String(err) },
            '*'
          );
        }
      }

      if (event.data.type === 'JOBFOUNDRY_SCAN_PORTALS_REQUEST') {
        try {
          const res = await sendMessage('popup:scanNow', undefined);
          window.postMessage({ type: 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE', result: res }, '*');
        } catch (err: any) {
          window.postMessage(
            { type: 'JOBFOUNDRY_SCAN_PORTALS_RESPONSE', error: err?.message || String(err) },
            '*'
          );
        }
      }

      if (event.data.type === 'JOBFOUNDRY_GET_SCAN_STATE_REQUEST') {
        try {
          const state = await getScanState();
          window.postMessage({ type: 'JOBFOUNDRY_SCAN_STATE_UPDATE', state }, '*');
        } catch {}
      }
    });

    // Forward live scan state updates to dashboard window
    try {
      watchScanState((state) => {
        window.postMessage({ type: 'JOBFOUNDRY_SCAN_STATE_UPDATE', state }, '*');
      });
    } catch {}
  },
});
