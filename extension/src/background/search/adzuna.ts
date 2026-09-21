/**
 * adzuna.ts — In-browser search provider for Adzuna's official job search API.
 * Uses user-configured API credentials (developer.adzuna.com).
 */

import type {
  AggregatorSearchProvider,
  RawAggregatorJob,
  SearchCriteria,
  SearchProviderOptions,
} from './types.ts';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export interface AdzunaSearchProvider extends AggregatorSearchProvider {
  search(criteria: SearchCriteria, options?: SearchProviderOptions): Promise<RawAggregatorJob[]>;
}

export const adzunaSearchProvider: AdzunaSearchProvider = {
  id: 'adzuna',
  displayName: 'Adzuna',

  async search(criteria: SearchCriteria, options: SearchProviderOptions = {}): Promise<RawAggregatorJob[]> {
    const fetchFn = options.fetchFn ?? fetch;
    const logger = options.logger;

    const appId = criteria.adzunaAppId?.trim();
    const appKey = criteria.adzunaAppKey?.trim();

    if (!appId || !appKey) {
      logger?.info?.('[Adzuna] Missing adzunaAppId or adzunaAppKey in configuration. Skipping Adzuna search.');
      return [];
    }

    const country = (criteria.adzunaCountry || 'us').trim().toLowerCase();
    const resultsWanted = criteria.resultsWanted ?? 25;
    const resultsPerPage = Math.min(50, resultsWanted);

    const jobs: RawAggregatorJob[] = [];
    const seenUrls = new Set<string>();

    let page = 1;
    const maxPages = Math.ceil(resultsWanted / resultsPerPage);

    while (page <= maxPages && jobs.length < resultsWanted) {
      const take = Math.min(resultsPerPage, resultsWanted - jobs.length);
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
      url.searchParams.set('app_id', appId);
      url.searchParams.set('app_key', appKey);
      url.searchParams.set('what', criteria.searchTerm);
      url.searchParams.set('results_per_page', String(take));

      if (criteria.location?.trim()) {
        url.searchParams.set('where', criteria.location.trim());
      }

      try {
        const response = await fetchFn(url.toString(), {
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          logger?.warn?.(`[Adzuna] Request failed: ${response.status} ${response.statusText}`);
          break;
        }

        const data = (await response.json()) as { results?: any[] };
        const results = data.results ?? [];

        if (!Array.isArray(results) || results.length === 0) {
          break;
        }

        for (const item of results) {
          const rawUrl = item.redirect_url;
          if (!rawUrl || seenUrls.has(rawUrl)) continue;
          seenUrls.add(rawUrl);

          const title = stripHtml(item.title || 'Unknown Title');
          const company = item.company?.display_name || 'Unknown Company';
          const location = item.location?.display_name || undefined;
          const description = item.description ? stripHtml(item.description) : undefined;
          const salaryMin = typeof item.salary_min === 'number' ? item.salary_min : undefined;
          const salaryMax = typeof item.salary_max === 'number' ? item.salary_max : undefined;
          const postedAt = item.created || undefined;

          jobs.push({
            title,
            company,
            location,
            url: rawUrl,
            description,
            salaryMin,
            salaryMax,
            postedAt,
            source: 'adzuna',
          });

          if (jobs.length >= resultsWanted) break;
        }

        if (results.length < take) {
          // No more pages available
          break;
        }

        page += 1;
        if (options.delayMs && options.delayMs > 0) {
          await new Promise((r) => setTimeout(r, options.delayMs));
        }
      } catch (err: any) {
        logger?.warn?.(`[Adzuna] Search error: ${err.message || err}`);
        break;
      }
    }

    return jobs;
  },
};
