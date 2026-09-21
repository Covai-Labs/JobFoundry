/**
 * ziprecruiter.ts — In-browser ZipRecruiter Job Search Provider.
 * Ported from JobSpy (MIT License, Copyright (c) 2023 Cullen Watson).
 */

import type {
  AggregatorSearchProvider,
  SearchCriteria,
  RawAggregatorJob,
  SearchProviderOptions,
} from './types.ts';

const ZIPRECRUITER_API_ENDPOINT = 'https://api.ziprecruiter.com/jobs-app/jobs';

export function parseZipRecruiterResponse(json: any): {
  jobs: RawAggregatorJob[];
  nextContinue?: string | null;
} {
  const jobs: RawAggregatorJob[] = [];
  const rawJobs = json?.jobs;

  if (!Array.isArray(rawJobs)) {
    return { jobs, nextContinue: null };
  }

  for (const item of rawJobs) {
    const title = (item?.name || '').trim();
    const listingKey = item?.listing_key || '';
    const company = (item?.hiring_company?.name || 'Unknown Company').trim();

    if (!title || !listingKey) continue;

    const url = `https://www.ziprecruiter.com/jobs//j?lvk=${listingKey}`;
    const description = (item?.job_description || '').trim();

    const city = item?.job_city || '';
    const state = item?.job_state || '';
    const country = item?.job_country || '';
    const locationParts = [city, state, country].filter(Boolean);
    const location = locationParts.join(', ');

    const postedAt = item?.posted_time || '';

    const salaryMin =
      typeof item?.compensation_min === 'number' ? item.compensation_min : undefined;
    const salaryMax =
      typeof item?.compensation_max === 'number' ? item.compensation_max : undefined;
    const salaryCurrency = item?.compensation_currency || undefined;

    jobs.push({
      title,
      company,
      location,
      url,
      description,
      salaryMin,
      salaryMax,
      salaryCurrency,
      postedAt,
      source: 'ziprecruiter',
    });
  }

  return {
    jobs,
    nextContinue: json?.continue || null,
  };
}

export const ziprecruiterSearchProvider: AggregatorSearchProvider = {
  id: 'ziprecruiter',
  displayName: 'ZipRecruiter',

  async search(
    criteria: SearchCriteria,
    options: SearchProviderOptions = {}
  ): Promise<RawAggregatorJob[]> {
    const fetchImpl = options.fetchFn || globalThis.fetch;
    const resultsWanted = criteria.resultsWanted || 20;
    const collected: RawAggregatorJob[] = [];
    const seenUrls = new Set<string>();

    let continueToken: string | null = null;
    const maxPages = Math.ceil(resultsWanted / 20);

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams();
      params.set('search', criteria.searchTerm);
      if (criteria.location) {
        params.set('location', criteria.location);
      }
      if (criteria.isRemote) {
        params.set('remote', '1');
      }
      if (criteria.hoursOld) {
        params.set('days', String(Math.max(1, Math.floor(criteria.hoursOld / 24))));
      }
      if (continueToken) {
        params.set('continue_from', continueToken);
      }

      try {
        const res = await fetchImpl(`${ZIPRECRUITER_API_ENDPOINT}?${params.toString()}`, {
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
          },
        });

        if (!res.ok) {
          options.logger?.warn?.(`[ziprecruiter-search] API request failed HTTP ${res.status}`);
          break;
        }

        const data = await res.json();
        const { jobs, nextContinue } = parseZipRecruiterResponse(data);

        if (jobs.length === 0) break;

        for (const job of jobs) {
          if (!seenUrls.has(job.url)) {
            seenUrls.add(job.url);
            collected.push(job);
          }
          if (collected.length >= resultsWanted) break;
        }

        if (collected.length >= resultsWanted || !nextContinue) break;

        continueToken = nextContinue;

        if (options.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
      } catch (err: any) {
        options.logger?.error?.(
          `[ziprecruiter-search] error on page ${page + 1}: ${err?.message || err}`
        );
        break;
      }
    }

    return collected;
  },
};
