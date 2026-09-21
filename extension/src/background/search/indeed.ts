/**
 * indeed.ts — In-browser Indeed Job Search Provider.
 * Ported from JobSpy (MIT License, Copyright (c) 2023 Cullen Watson).
 */

import type {
  AggregatorSearchProvider,
  SearchCriteria,
  RawAggregatorJob,
  SearchProviderOptions,
} from './types.ts';

const INDEED_GRAPHQL_ENDPOINT = 'https://apis.indeed.com/graphql';
const INDEED_PUBLIC_API_KEY = '161092c2017b5bbab13edb12461a62d5a833871e7cad6d9d475304573de67ac8';

export function buildIndeedGraphQLQuery(criteria: SearchCriteria, cursor?: string | null): string {
  const searchTerm = criteria.searchTerm || '';
  const whatClause = searchTerm ? `what: ${JSON.stringify(searchTerm)}` : '';

  let locationClause = '';
  if (criteria.location) {
    locationClause = `location: { where: ${JSON.stringify(criteria.location)}, radius: 50, radiusUnit: MILES }`;
  }

  const cursorClause = cursor ? `cursor: ${JSON.stringify(cursor)}` : '';

  return `
    query GetJobData {
      jobSearch(
        ${whatClause}
        ${locationClause}
        limit: 50
        sort: RELEVANCE
        ${cursorClause}
      ) {
        pageInfo {
          nextCursor
        }
        results {
          job {
            key
            title
            datePublished
            description {
              html
            }
            location {
              city
              countryName
              formatted {
                short
                long
              }
            }
            compensation {
              baseSalary {
                range {
                  ... on Range {
                    min
                    max
                  }
                }
              }
            }
            source {
              name
            }
            recruit {
              viewJobUrl
            }
          }
        }
      }
    }
  `;
}

export function parseIndeedGraphQLResponse(json: any): {
  jobs: RawAggregatorJob[];
  nextCursor?: string | null;
} {
  const jobs: RawAggregatorJob[] = [];
  const search = json?.data?.jobSearch;
  const results = search?.results;

  if (!Array.isArray(results)) {
    return { jobs, nextCursor: null };
  }

  for (const item of results) {
    const job = item?.job;
    if (!job || !job.title) continue;

    const title = String(job.title).trim();
    const company = String(job.source?.name || 'Unknown Company').trim();
    const key = job.key ? String(job.key) : '';
    const viewUrl =
      job.recruit?.viewJobUrl || (key ? `https://www.indeed.com/viewjob?jk=${key}` : '');

    if (!viewUrl) continue;

    const locFormatted =
      job.location?.formatted?.long || job.location?.formatted?.short || job.location?.city || '';
    const descHtml = job.description?.html || '';

    const range = job.compensation?.baseSalary?.range;
    const salaryMin = typeof range?.min === 'number' ? range.min : undefined;
    const salaryMax = typeof range?.max === 'number' ? range.max : undefined;

    let postedAt: string | undefined;
    if (job.datePublished) {
      if (typeof job.datePublished === 'number') {
        const date = new Date(job.datePublished);
        postedAt = Number.isNaN(date.getTime()) ? undefined : date.toISOString();
      } else {
        postedAt = String(job.datePublished);
      }
    }

    jobs.push({
      title,
      company,
      location: locFormatted,
      url: viewUrl,
      description: descHtml,
      salaryMin,
      salaryMax,
      postedAt,
      source: 'indeed',
    });
  }

  return {
    jobs,
    nextCursor: search?.pageInfo?.nextCursor || null,
  };
}

export const indeedSearchProvider: AggregatorSearchProvider = {
  id: 'indeed',
  displayName: 'Indeed',

  async search(
    criteria: SearchCriteria,
    options: SearchProviderOptions = {}
  ): Promise<RawAggregatorJob[]> {
    const fetchImpl = options.fetchFn || globalThis.fetch;
    const resultsWanted = criteria.resultsWanted || 25;
    const collected: RawAggregatorJob[] = [];
    const seenKeys = new Set<string>();

    let cursor: string | null = null;
    const maxPages = Math.ceil(resultsWanted / 25);

    for (let page = 0; page < maxPages; page++) {
      const query = buildIndeedGraphQLQuery(criteria, cursor);

      try {
        const res = await fetchImpl(INDEED_GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'indeed-api-key': INDEED_PUBLIC_API_KEY,
            'indeed-locale': 'en-US',
            'user-agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Indeed App 193.1',
            'indeed-app-info':
              'appv=193.1; appid=com.indeed.jobsearch; osv=16.6.1; os=ios; dtype=phone',
          },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          options.logger?.warn?.(`[indeed-search] GraphQL query failed HTTP ${res.status}`);
          break;
        }

        const data = await res.json();
        const { jobs, nextCursor } = parseIndeedGraphQLResponse(data);

        if (jobs.length === 0) break;

        for (const job of jobs) {
          if (!seenKeys.has(job.url)) {
            seenKeys.add(job.url);
            collected.push(job);
          }
          if (collected.length >= resultsWanted) break;
        }

        if (collected.length >= resultsWanted || !nextCursor) break;

        cursor = nextCursor;

        if (options.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
      } catch (err: any) {
        options.logger?.error?.(
          `[indeed-search] error on page ${page + 1}: ${err?.message || err}`
        );
        break;
      }
    }

    return collected;
  },
};
