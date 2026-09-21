/**
 * naukri.ts — In-browser Naukri Job Search Provider.
 * Ported from JobSpy (MIT License, Copyright (c) 2023 Cullen Watson).
 */

import type {
  AggregatorSearchProvider,
  SearchCriteria,
  RawAggregatorJob,
  SearchProviderOptions,
} from './types.ts';

const NAUKRI_SEARCH_API = 'https://www.naukri.com/jobapi/v3/search';

export function parseNaukriResponse(json: any): RawAggregatorJob[] {
  const jobs: RawAggregatorJob[] = [];
  const rawJobs = json?.jobDetails;

  if (!Array.isArray(rawJobs)) {
    return jobs;
  }

  for (const item of rawJobs) {
    const title = (item?.title || '').trim();
    const company = (item?.companyName || 'Unknown Company').trim();
    const jobId = item?.jobId || '';

    const jdUrl = item?.jdURL;
    let url = '';
    if (jdUrl) {
      url = jdUrl.startsWith('http') ? jdUrl : `https://www.naukri.com${jdUrl.startsWith('/') ? '' : '/'}${jdUrl}`;
    } else if (jobId) {
      url = `https://www.naukri.com/job-listings-${jobId}`;
    }

    if (!title || !url) continue;

    const description = (item?.jobDescription || '').trim();

    // Extract location from placeholders
    let location = '';
    const placeholders = item?.placeholders;
    if (Array.isArray(placeholders)) {
      const locPlaceholder = placeholders.find((p: any) => p.type === 'location');
      if (locPlaceholder?.label) {
        location = String(locPlaceholder.label).trim();
      }
    }

    let postedAt: string | undefined;
    if (item?.createdDate) {
      postedAt = typeof item.createdDate === 'number'
        ? new Date(item.createdDate).toISOString()
        : String(item.createdDate);
    }

    jobs.push({
      title,
      company,
      location,
      url,
      description,
      postedAt,
      source: 'naukri',
    });
  }

  return jobs;
}

export const naukriSearchProvider: AggregatorSearchProvider = {
  id: 'naukri',
  displayName: 'Naukri',

  async search(criteria: SearchCriteria, options: SearchProviderOptions = {}): Promise<RawAggregatorJob[]> {
    const fetchImpl = options.fetchFn || globalThis.fetch;
    const resultsWanted = criteria.resultsWanted || 20;
    const collected: RawAggregatorJob[] = [];
    const seenUrls = new Set<string>();

    const maxPages = Math.ceil(resultsWanted / 20);

    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams();
      params.set('noOfResults', '20');
      params.set('keyword', criteria.searchTerm);
      params.set('k', criteria.searchTerm);
      params.set('pageNo', String(page));
      params.set('urlType', 'search_by_keyword');
      params.set('searchType', 'adv');
      params.set('src', 'jobsearchDesk');

      if (criteria.location) {
        params.set('location', criteria.location);
      }
      if (criteria.isRemote) {
        params.set('remote', 'true');
      }

      try {
        const res = await fetchImpl(`${NAUKRI_SEARCH_API}?${params.toString()}`, {
          headers: {
            appid: '109',
            systemid: 'Naukri',
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });

        if (!res.ok) {
          options.logger?.warn?.(`[naukri-search] API request failed HTTP ${res.status}`);
          break;
        }

        const data = await res.json();
        const batch = parseNaukriResponse(data);

        if (batch.length === 0) break;

        for (const job of batch) {
          if (!seenUrls.has(job.url)) {
            seenUrls.add(job.url);
            collected.push(job);
          }
          if (collected.length >= resultsWanted) break;
        }

        if (collected.length >= resultsWanted) break;

        if (options.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
      } catch (err: any) {
        options.logger?.error?.(`[naukri-search] error on page ${page}: ${err?.message || err}`);
        break;
      }
    }

    return collected;
  },
};
