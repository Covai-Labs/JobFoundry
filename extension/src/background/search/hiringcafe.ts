/**
 * hiringcafe.ts — In-browser search provider for HiringCafe.
 * Leverages direct Next.js SSR hydration and JSON data endpoints
 * within the extension network stack, extracting direct employer ATS apply links.
 */

import type {
  AggregatorSearchProvider,
  RawAggregatorJob,
  SearchCriteria,
  SearchProviderOptions,
} from './types.ts';

const HIRINGCAFE_BASE_URL = 'https://hiringcafe.com';

// Cache known buildId in-memory across search queries to accelerate pagination
let cachedBuildId: string | null = null;

function parseNextDataScript(html: string): { buildId?: string; pageProps?: any } | null {
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>\s*([\s\S]*?)\s*<\/script>/i);
  if (!match || !match[1]) return null;

  try {
    const data = JSON.parse(match[1]);
    return {
      buildId: data.buildId,
      pageProps: data.props?.pageProps,
    };
  } catch {
    return null;
  }
}

function mapHiringCafeHit(hit: any): RawAggregatorJob | null {
  if (!hit || typeof hit !== 'object') return null;

  const jobInfo = hit.job_information || {};
  const processed = hit.v5_processed_job_data || {};
  const org = hit.attributed_org || {};

  const applyUrl = hit.apply_url || (hit.objectID ? `${HIRINGCAFE_BASE_URL}/job/${hit.objectID}` : null);
  if (!applyUrl) return null;

  const title =
    jobInfo.title ||
    jobInfo.job_title_raw ||
    processed.core_job_title ||
    'Unknown Title';

  const company =
    org.name ||
    processed.company_name ||
    'Unknown Company';

  const location =
    processed.formatted_workplace_location ||
    processed.workplace_cities?.[0] ||
    processed.workplace_states?.[0] ||
    undefined;

  const description =
    processed.requirements_summary ||
    jobInfo.description ||
    undefined;

  const salaryMin = typeof processed.yearly_min_compensation === 'number'
    ? processed.yearly_min_compensation
    : undefined;
  const salaryMax = typeof processed.yearly_max_compensation === 'number'
    ? processed.yearly_max_compensation
    : undefined;
  const salaryCurrency = processed.listed_compensation_currency || undefined;

  const postedAt =
    processed.estimated_publish_date ||
    undefined;

  return {
    title,
    company,
    location,
    url: applyUrl,
    description,
    salaryMin,
    salaryMax,
    salaryCurrency,
    postedAt,
    source: 'hiringcafe',
  };
}

export interface HiringCafeSearchProvider extends AggregatorSearchProvider {
  search(criteria: SearchCriteria, options?: SearchProviderOptions): Promise<RawAggregatorJob[]>;
}

export const hiringcafeSearchProvider: HiringCafeSearchProvider = {
  id: 'hiringcafe',
  displayName: 'HiringCafe',

  async search(criteria: SearchCriteria, options: SearchProviderOptions = {}): Promise<RawAggregatorJob[]> {
    const fetchFn = options.fetchFn ?? fetch;
    const logger = options.logger;
    const resultsWanted = criteria.resultsWanted ?? 25;

    const searchState: Record<string, any> = {
      searchQuery: criteria.searchTerm,
    };

    if (criteria.isRemote) {
      searchState.workplaceTypes = ['Remote'];
    }

    if (criteria.location?.trim()) {
      searchState.locations = [
        {
          formatted_address: criteria.location.trim(),
        },
      ];
    }

    const searchStateEncoded = encodeURIComponent(JSON.stringify(searchState));
    const jobs: RawAggregatorJob[] = [];
    const seenUrls = new Set<string>();

    let page = 0;
    const maxPages = Math.ceil(resultsWanted / 25);

    while (page <= maxPages && jobs.length < resultsWanted) {
      let pageHits: any[] = [];

      // Try fast JSON data endpoint first if buildId is known and page > 0
      let fetchedJson = false;
      if (cachedBuildId && page > 0) {
        const jsonUrl = `${HIRINGCAFE_BASE_URL}/_next/data/${cachedBuildId}/index.json?searchState=${searchStateEncoded}&page=${page}`;
        try {
          const resp = await fetchFn(jsonUrl, {
            headers: {
              Accept: 'application/json, text/plain, */*',
              'x-nextjs-data': '1',
            },
          });
          if (resp.ok) {
            const data = (await resp.json()) as any;
            if (data?.pageProps?.ssrHits) {
              pageHits = data.pageProps.ssrHits;
              fetchedJson = true;
            }
          }
        } catch {
          // Fall back to SSR HTML request below
        }
      }

      if (!fetchedJson) {
        // Fetch SSR HTML document
        const pageParam = page > 0 ? `&page=${page}` : '';
        const htmlUrl = `${HIRINGCAFE_BASE_URL}/?searchState=${searchStateEncoded}${pageParam}`;

        try {
          const resp = await fetchFn(htmlUrl, {
            headers: {
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });

          if (!resp.ok) {
            logger?.warn?.(`[HiringCafe] HTTP ${resp.status} fetching search page ${page}`);
            break;
          }

          const html = await resp.text();
          const parsed = parseNextDataScript(html);

          if (!parsed) {
            logger?.warn?.('[HiringCafe] Failed to extract Next.js hydration payload from response');
            break;
          }

          if (parsed.buildId) {
            cachedBuildId = parsed.buildId;
          }

          pageHits = parsed.pageProps?.ssrHits ?? [];
        } catch (err: any) {
          logger?.warn?.(`[HiringCafe] Fetch error: ${err.message || err}`);
          break;
        }
      }

      if (!Array.isArray(pageHits) || pageHits.length === 0) {
        break;
      }

      for (const hit of pageHits) {
        const job = mapHiringCafeHit(hit);
        if (!job || seenUrls.has(job.url)) continue;
        seenUrls.add(job.url);
        jobs.push(job);

        if (jobs.length >= resultsWanted) break;
      }

      page += 1;
      if (options.delayMs && options.delayMs > 0) {
        await new Promise((r) => setTimeout(r, options.delayMs));
      }
    }

    return jobs;
  },
};
