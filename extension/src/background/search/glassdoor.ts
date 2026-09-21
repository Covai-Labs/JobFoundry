/**
 * glassdoor.ts — In-browser Glassdoor Job Search Provider.
 * Ported from JobSpy (MIT License, Copyright (c) 2023 Cullen Watson).
 */

import type {
  AggregatorSearchProvider,
  SearchCriteria,
  RawAggregatorJob,
  SearchProviderOptions,
} from './types.ts';

const GLASSDOOR_GRAPHQL_ENDPOINT = 'https://www.glassdoor.com/graph';

const GLASSDOOR_QUERY = `
  query JobSearchResultsQuery(
    $keyword: String,
    $numJobsToShow: Int!,
    $pageNumber: Int,
    $originalPageUrl: String,
    $seoUrl: Boolean
  ) {
    jobListings(
      contextHolder: {
        searchParams: {
          keyword: $keyword,
          numPerPage: $numJobsToShow,
          pageNumber: $pageNumber,
          originalPageUrl: $originalPageUrl,
          seoUrl: $seoUrl,
          searchType: SR
        }
      }
    ) {
      jobListings {
        ...JobView
        __typename
      }
      paginationCursors {
        cursor
        pageNumber
        __typename
      }
      totalJobsCount
      __typename
    }
  }

  fragment JobView on JobListingSearchResult {
    jobview {
      header {
        employer {
          id
          name
          shortName
          __typename
        }
        employerNameFromSearch
        jobLink
        jobTitleText
        locationName
        payCurrency
        payPeriod
        payPeriodAdjustedPay {
          p10
          p50
          p90
          __typename
        }
        rating
        __typename
      }
      job {
        description
        jobTitleText
        listingId
        __typename
      }
      __typename
    }
  }
`;

export function parseGlassdoorGraphQLResponse(json: any): RawAggregatorJob[] {
  const jobs: RawAggregatorJob[] = [];
  const listings = json?.data?.jobListings?.jobListings;

  if (!Array.isArray(listings)) {
    return jobs;
  }

  for (const item of listings) {
    const jv = item?.jobview;
    if (!jv) continue;

    const header = jv.header;
    const job = jv.job;

    const title = (job?.jobTitleText || header?.jobTitleText || '').trim();
    const company = (
      header?.employer?.name ||
      header?.employerNameFromSearch ||
      'Unknown Company'
    ).trim();
    const listingId = job?.listingId || '';

    let url = header?.jobLink || '';
    if (!url && listingId) {
      url = `https://www.glassdoor.com/job-listing?jl=${listingId}`;
    } else if (url && !url.startsWith('http')) {
      url = `https://www.glassdoor.com${url.startsWith('/') ? '' : '/'}${url}`;
    }

    if (!title || !url) continue;

    const location = (header?.locationName || '').trim();
    const description = (job?.description || '').trim();

    const pay = header?.payPeriodAdjustedPay;
    const salaryMin = typeof pay?.p10 === 'number' ? Math.round(pay.p10) : undefined;
    const salaryMax = typeof pay?.p90 === 'number' ? Math.round(pay.p90) : undefined;
    const salaryCurrency = header?.payCurrency || undefined;

    jobs.push({
      title,
      company,
      location,
      url,
      description,
      salaryMin,
      salaryMax,
      salaryCurrency,
      source: 'glassdoor',
    });
  }

  return jobs;
}

export const glassdoorSearchProvider: AggregatorSearchProvider = {
  id: 'glassdoor',
  displayName: 'Glassdoor',

  async search(
    criteria: SearchCriteria,
    options: SearchProviderOptions = {}
  ): Promise<RawAggregatorJob[]> {
    const fetchImpl = options.fetchFn || globalThis.fetch;
    const resultsWanted = criteria.resultsWanted || 25;
    const collected: RawAggregatorJob[] = [];
    const seenUrls = new Set<string>();

    const maxPages = Math.ceil(resultsWanted / 30);

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const variables = {
        keyword: criteria.searchTerm,
        numJobsToShow: Math.min(resultsWanted, 30),
        pageNumber,
        originalPageUrl: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(criteria.searchTerm)}`,
        seoUrl: false,
      };

      try {
        const res = await fetchImpl(GLASSDOOR_GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
            'apollographql-client-name': 'job-search-next',
            'apollographql-client-version': '4.65.5',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({
            operationName: 'JobSearchResultsQuery',
            query: GLASSDOOR_QUERY,
            variables,
          }),
        });

        if (!res.ok) {
          options.logger?.warn?.(`[glassdoor-search] query failed HTTP ${res.status}`);
          break;
        }

        const data = await res.json();
        const batch = parseGlassdoorGraphQLResponse(data);

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
        options.logger?.error?.(
          `[glassdoor-search] error on page ${pageNumber}: ${err?.message || err}`
        );
        break;
      }
    }

    return collected;
  },
};
