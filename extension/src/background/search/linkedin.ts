/**
 * linkedin.ts — In-browser LinkedIn Job Search Provider.
 * Ported from JobSpy (MIT License, Copyright (c) 2023 Cullen Watson).
 */

import type {
  AggregatorSearchProvider,
  SearchCriteria,
  RawAggregatorJob,
  SearchProviderOptions,
} from './types.ts';

export function parseLinkedInJobCards(html: string): RawAggregatorJob[] {
  const jobs: RawAggregatorJob[] = [];
  if (!html || typeof html !== 'string') return jobs;

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const cards = doc.querySelectorAll('.base-search-card, .job-search-card');

      for (const card of cards) {
        const linkTag = card.querySelector('a.base-card__full-link, a.job-search-card__title-link');
        const href = linkTag?.getAttribute('href') || '';
        const cleanUrl = href.split('?')[0];
        if (!cleanUrl) continue;

        const titleTag =
          card.querySelector('.base-search-card__title, .job-search-card__title, span.sr-only') ||
          linkTag;
        const title = titleTag?.textContent?.trim() || '';

        const companyTag = card.querySelector(
          '.base-search-card__subtitle, .job-search-card__company-name'
        );
        const company = companyTag?.textContent?.trim() || '';

        const locTag = card.querySelector('.job-search-card__location');
        const location = locTag?.textContent?.trim() || '';

        const timeTag = card.querySelector('time');
        const postedAt = timeTag?.getAttribute('datetime') || timeTag?.textContent?.trim() || '';

        const salaryTag = card.querySelector('.job-search-card__salary-info');
        const salaryText = salaryTag?.textContent?.trim() || '';
        let salaryMin: number | undefined;
        let salaryMax: number | undefined;
        let salaryCurrency: string | undefined;

        if (salaryText) {
          const numbers = salaryText.match(/\d[\d,]*/g);
          if (numbers && numbers.length > 0) {
            salaryMin = parseInt(numbers[0].replace(/,/g, ''), 10);
            if (numbers.length > 1) {
              salaryMax = parseInt(numbers[1].replace(/,/g, ''), 10);
            }
          }
          if (salaryText.includes('$')) salaryCurrency = 'USD';
          else if (salaryText.includes('€')) salaryCurrency = 'EUR';
          else if (salaryText.includes('£')) salaryCurrency = 'GBP';
        }

        if (title && company) {
          jobs.push({
            title,
            company,
            location,
            url: cleanUrl,
            postedAt,
            salaryMin,
            salaryMax,
            salaryCurrency,
            source: 'linkedin',
          });
        }
      }
      if (jobs.length > 0) return jobs;
    } catch {
      // Fall through to regex if DOMParser fails
    }
  }

  // Regex-based fallback parser (for headless/testing environments without full DOM)
  const cardRegex =
    /<(?:div|li)[^>]*class="[^"]*(?:base-search-card|job-search-card)[^"]*"[\s\S]*?<\/(?:div|li)>/gi;
  const matches = html.match(cardRegex) || [];

  for (const card of matches) {
    const urlMatch = card.match(/href="([^"?]+)[^"]*"/i);
    const url = urlMatch ? urlMatch[1] : '';
    if (!url || !url.includes('linkedin.com/jobs/view/')) continue;

    const titleMatch =
      card.match(/class="[^"]*(?:base-search-card__title)[^"]*"[^>]*>\s*([^<]+)/i) ||
      card.match(/<span[^>]*class="sr-only"[^>]*>\s*([^<]+)/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const companyMatch =
      card.match(/class="[^"]*(?:base-search-card__subtitle)[^"]*"[^>]*>[\s\S]*?>\s*([^<]+)/i) ||
      card.match(/class="[^"]*(?:base-search-card__subtitle)[^"]*"[^>]*>\s*([^<]+)/i);
    const company = companyMatch ? companyMatch[1].trim() : '';

    const locMatch = card.match(/class="[^"]*(?:job-search-card__location)[^"]*"[^>]*>\s*([^<]+)/i);
    const location = locMatch ? locMatch[1].trim() : '';

    const timeMatch = card.match(/<time[^>]*datetime="([^"]+)"/i);
    const postedAt = timeMatch ? timeMatch[1] : '';

    if (title && company) {
      jobs.push({
        title,
        company,
        location,
        url,
        postedAt,
        source: 'linkedin',
      });
    }
  }

  return jobs;
}

export const linkedinSearchProvider: AggregatorSearchProvider = {
  id: 'linkedin',
  displayName: 'LinkedIn',

  async search(criteria: SearchCriteria, options: SearchProviderOptions = {}): Promise<RawAggregatorJob[]> {
    const fetchImpl = options.fetchFn || globalThis.fetch;
    const resultsWanted = criteria.resultsWanted || 25;
    const collected: RawAggregatorJob[] = [];
    const seenUrls = new Set<string>();

    let start = 0;
    const maxPages = Math.ceil(resultsWanted / 25);

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams();
      params.set('keywords', criteria.searchTerm);
      if (criteria.location) {
        params.set('location', criteria.location);
      }
      params.set('start', String(start));
      if (criteria.isRemote) {
        params.set('f_WT', '2'); // LinkedIn remote filter
      }
      if (criteria.hoursOld) {
        params.set('f_TPR', `r${criteria.hoursOld * 3600}`);
      }

      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;

      try {
        const res = await fetchImpl(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if (!res.ok) {
          options.logger?.warn?.(`[linkedin-search] HTTP ${res.status} on page ${page + 1}`);
          break;
        }

        const html = await res.text();
        const batch = parseLinkedInJobCards(html);

        if (batch.length === 0) {
          break;
        }

        for (const job of batch) {
          if (!seenUrls.has(job.url)) {
            seenUrls.add(job.url);
            collected.push(job);
          }
          if (collected.length >= resultsWanted) break;
        }

        if (collected.length >= resultsWanted || batch.length < 10) {
          break;
        }

        start += batch.length;

        // Friendly delay between pages if configured
        if (options.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
      } catch (err: any) {
        options.logger?.error?.(`[linkedin-search] failed on page ${page + 1}: ${err?.message || err}`);
        break;
      }
    }

    return collected;
  },
};
