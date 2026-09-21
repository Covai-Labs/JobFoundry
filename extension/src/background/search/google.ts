/**
 * google.ts — In-browser Google Jobs Search Provider.
 * Ported from JobSpy (MIT License, Copyright (c) 2023 Cullen Watson).
 */

import type {
  AggregatorSearchProvider,
  SearchCriteria,
  RawAggregatorJob,
  SearchProviderOptions,
} from './types.ts';

export function parseGoogleJobsHtml(html: string): RawAggregatorJob[] {
  const jobs: RawAggregatorJob[] = [];
  if (!html || typeof html !== 'string') return jobs;

  // Google Jobs emits structured Schema.org JobPosting in JSON-LD or internal tokens
  const jsonLdMatch = html.match(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (jsonLdMatch) {
    for (const scriptTag of jsonLdMatch) {
      try {
        const inner = scriptTag.replace(/^<script\b[^>]*>|<\/script>$/gi, '').trim();
        const data = JSON.parse(inner);
        const items = Array.isArray(data) ? data : data['@graph'] || [data];
        for (const it of items) {
          if (it['@type'] === 'JobPosting' || String(it['@type'] || '').includes('JobPosting')) {
            const title = String(it.title || '').trim();
            const company = String(it.hiringOrganization?.name || 'Unknown Company').trim();
            const url = it.url || it.sameAs || '';
            const description = it.description || '';
            const location =
              it.jobLocation?.address?.addressLocality ||
              it.jobLocation?.address?.addressRegion ||
              it.jobLocation?.address?.addressCountry ||
              '';

            if (title && url) {
              jobs.push({
                title,
                company,
                location,
                url,
                description,
                postedAt: it.datePosted || '',
                source: 'google',
              });
            }
          }
        }
      } catch {
        // Skip invalid JSON-LD
      }
    }
  }

  // Fallback: Parse card elements if present
  if (jobs.length === 0 && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const cards = doc.querySelectorAll('[data-share-url], [jsname="ibnC6b"], .iFjolb');
      for (const card of cards) {
        const url =
          card.getAttribute('data-share-url') ||
          card.querySelector('a')?.getAttribute('href') ||
          '';
        const title = card.querySelector('[role="heading"], .BjJfJf')?.textContent?.trim() || '';
        const company =
          card.querySelector('.vNEEBe, .nJlHg')?.textContent?.trim() || 'Unknown Company';
        const location = card.querySelector('.Qk80Jf')?.textContent?.trim() || '';

        if (title && url) {
          jobs.push({
            title,
            company,
            location,
            url,
            source: 'google',
          });
        }
      }
    } catch {
      // Ignore DOMParser error
    }
  }

  return jobs;
}

export const googleSearchProvider: AggregatorSearchProvider = {
  id: 'google',
  displayName: 'Google Jobs',

  async search(
    criteria: SearchCriteria,
    options: SearchProviderOptions = {}
  ): Promise<RawAggregatorJob[]> {
    const fetchImpl = options.fetchFn || globalThis.fetch;
    const resultsWanted = criteria.resultsWanted || 20;

    const queryParts = [criteria.searchTerm, 'jobs'];
    if (criteria.location) queryParts.push(criteria.location);
    if (criteria.isRemote) queryParts.push('remote');

    const query = encodeURIComponent(queryParts.join(' '));
    const url = `https://www.google.com/search?q=${query}&ibp=htl;jobs`;

    try {
      const res = await fetchImpl(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) {
        options.logger?.warn?.(`[google-search] request failed HTTP ${res.status}`);
        return [];
      }

      const html = await res.text();
      const jobs = parseGoogleJobsHtml(html);
      return jobs.slice(0, resultsWanted);
    } catch (err: any) {
      options.logger?.error?.(`[google-search] error: ${err?.message || err}`);
      return [];
    }
  },
};
