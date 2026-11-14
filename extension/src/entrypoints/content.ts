import { defineContentScript } from 'wxt/utils/define-content-script';
import { sendMessage, onMessage } from '../shared/messaging.ts';
import { getConfig } from '../shared/config.ts';
import { createPassiveObserver } from '../content/passive.js';
import { extractJobsFromDocument } from '../content/extractors/index.js';

export default defineContentScript({
  matches: [
    '*://*.linkedin.com/*',
    '*://*.indeed.com/*',
    '*://*.indeed.co.uk/*',
    '*://*.indeed.ca/*',
    '*://*.indeed.de/*',
    '*://*.indeed.fr/*',
    '*://*.indeed.co.in/*',
    '*://*.glassdoor.com/*',
    '*://*.glassdoor.co.in/*',
    '*://*.glassdoor.co.uk/*',
    '*://*.naukri.com/*',
    '*://*.greenhouse.io/*',
    '*://job-boards.greenhouse.io/*',
    '*://boards.greenhouse.io/*',
    '*://*.lever.co/*',
    '*://jobs.lever.co/*',
    '*://*.ashbyhq.com/*',
    '*://jobs.ashbyhq.com/*',
    '*://*.workday.com/*',
    '*://*.myworkdayjobs.com/*',
  ],
  runAt: 'document_idle',
  async main(ctx) {
    // Register on-demand extraction listener for popup/background
    onMessage('content:extractActiveJob', () => {
      try {
        const jobs = extractJobsFromDocument(document);
        return { ok: true, jobs };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    });

    const config = await getConfig();
    if (!config.passiveMode) return;

    const observer = createPassiveObserver({
      doc: document,
      win: window,
      onJobsFound: (fresh: any[]) => {
        sendMessage('content:jobsDiscovered', { jobs: fresh }).catch(() => {
          // ignore background disconnection
        });
      },
    });

    observer.start();

    ctx.addEventListener(window, 'wxt:locationchange', () => {
      observer.scan();
    });
  },
});
