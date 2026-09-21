/**
 * index.ts — Aggregator Search Engine Router.
 * Coordinates multi-board job searching inside the browser extension.
 */

import type { AggregatorSearchProvider, RawAggregatorJob, SearchCriteria } from './types.ts';
import { linkedinSearchProvider } from './linkedin.ts';
import { indeedSearchProvider } from './indeed.ts';
import { glassdoorSearchProvider } from './glassdoor.ts';
import { ziprecruiterSearchProvider } from './ziprecruiter.ts';
import { googleSearchProvider } from './google.ts';
import { naukriSearchProvider } from './naukri.ts';
import { adzunaSearchProvider } from './adzuna.ts';
import { hiringcafeSearchProvider } from './hiringcafe.ts';

import { normalizeJob, withFingerprint } from '../normalize.js';
import { fingerprintText } from '../fingerprint.js';
import { dedupJobs, createSessionCache } from '../dedup.js';
import { buildLocationFilter } from '../filters/location-filter.js';

export const searchProviderMap: Record<string, AggregatorSearchProvider> = {
  linkedin: linkedinSearchProvider,
  indeed: indeedSearchProvider,
  glassdoor: glassdoorSearchProvider,
  ziprecruiter: ziprecruiterSearchProvider,
  google: googleSearchProvider,
  naukri: naukriSearchProvider,
  adzuna: adzunaSearchProvider,
  hiringcafe: hiringcafeSearchProvider,
};

export interface RunSearchPipelineOptions {
  getConfig?: () => Promise<any>;
  sendJobs?: (args: { jobs: any[] }) => Promise<any>;
  searchTerms?: string[];
  enabledBoards?: string[];
  location?: string;
  resultsWantedPerTerm?: number;
  fetchFn?: typeof fetch;
  cache?: any;
  fingerprint?: typeof fingerprintText;
  logger?: {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
}

export interface SearchPipelineResult {
  ok: boolean;
  termsSearched: string[];
  totalFound: number;
  newIngested: number;
  droppedDedup: number;
  errors: string[];
}

export async function runSearchPipeline({
  getConfig,
  sendJobs,
  searchTerms,
  enabledBoards,
  location,
  resultsWantedPerTerm,
  fetchFn = globalThis.fetch,
  cache = null,
  fingerprint = fingerprintText,
  logger = console,
}: RunSearchPipelineOptions = {}): Promise<SearchPipelineResult> {
  const config = getConfig ? await getConfig() : {};

  // Resolve search terms (from explicit parameter or positive title filters from master resume)
  let terms = searchTerms;
  if (!terms || terms.length === 0) {
    terms = config?.titleFilter?.positive || [];
  }
  if (!Array.isArray(terms) || terms.length === 0) {
    return {
      ok: false,
      termsSearched: [],
      totalFound: 0,
      newIngested: 0,
      droppedDedup: 0,
      errors: ['No search terms configured. Please configure target job titles in settings or master resume.'],
    };
  }

  // Resolve enabled search boards
  let boardIds = enabledBoards;
  if (!boardIds || boardIds.length === 0) {
    const configBoards = config?.searchBoards || {};
    const configuredKeys = Object.keys(configBoards);
    boardIds = configuredKeys.filter((k) => configBoards[k] === true);
    if (configuredKeys.length === 0) {
      // Default to the core boards only when nothing is configured in settings
      boardIds = ['linkedin', 'indeed', 'glassdoor', 'hiringcafe'];
    }
  }

  const activeProviders: AggregatorSearchProvider[] = [];
  for (const id of boardIds) {
    const provider = searchProviderMap[id];
    if (provider) {
      activeProviders.push(provider);
    }
  }

  if (activeProviders.length === 0) {
    return {
      ok: false,
      termsSearched: terms,
      totalFound: 0,
      newIngested: 0,
      droppedDedup: 0,
      errors: ['No valid search providers enabled.'],
    };
  }

  const resultsCap = resultsWantedPerTerm || config?.searchMaxResultsPerTerm || 25;
  const targetLocation = location || (config?.locationFilter?.allow?.includes('remote') ? 'remote' : undefined);
  const isRemote = location
    ? /remote|anywhere|worldwide/i.test(location)
    : (config?.locationFilter?.allow?.some((l: string) => /remote|anywhere|worldwide/i.test(l)) || false);

  const rawPooled: RawAggregatorJob[] = [];
  const errors: string[] = [];

  // Execute search per term across enabled boards
  for (const term of terms) {
    logger.info?.(`[aggregator-search] Searching for "${term}" across: ${activeProviders.map((p) => p.id).join(', ')}`);

    const criteria: SearchCriteria = {
      searchTerm: term,
      location: targetLocation,
      isRemote,
      resultsWanted: resultsCap,
      adzunaAppId: config?.adzunaAppId,
      adzunaAppKey: config?.adzunaAppKey,
      adzunaCountry: config?.adzunaCountry,
    };

    await Promise.all(
      activeProviders.map(async (provider) => {
        try {
          const jobs = await provider.search(criteria, { fetchFn, logger });
          if (Array.isArray(jobs)) {
            rawPooled.push(...jobs);
          }
        } catch (err: any) {
          const errMsg = `[${provider.id}] search failed for "${term}": ${err?.message || err}`;
          logger.warn?.(errMsg);
          errors.push(errMsg);
        }
      })
    );
  }

  const totalFound = rawPooled.length;
  if (totalFound === 0) {
    return {
      ok: true,
      termsSearched: terms,
      totalFound: 0,
      newIngested: 0,
      droppedDedup: 0,
      errors,
    };
  }

  // Location filter check
  const matchLocation = buildLocationFilter(config?.locationFilter);
  const locationFiltered = rawPooled.filter((job) => matchLocation(job));

  // Normalize jobs to Phase 01 canonical shape
  const normalized = [];
  for (const raw of locationFiltered) {
    try {
      normalized.push(normalizeJob(raw, raw.source));
    } catch (err: any) {
      logger.warn?.(`[aggregator-search] skipped malformed job: ${err?.message || err}`);
    }
  }

  // Compute fingerprints
  const withFps = await Promise.all(
    normalized.map((job) => withFingerprint(job, fingerprint))
  );

  // Deduplication
  const dedupCache = cache || createSessionCache();
  const survivors = await dedupJobs(withFps, dedupCache);
  const droppedDedup = withFps.length - survivors.length;

  let newIngested = 0;
  let ingestionFailed = false;
  if (survivors.length > 0 && sendJobs) {
    try {
      await sendJobs({ jobs: survivors });
      newIngested = survivors.length;
    } catch (err: any) {
      ingestionFailed = true;
      errors.push(`Failed to ingest jobs to server: ${err?.message || err}`);
    }
  }

  return {
    ok: !ingestionFailed && (errors.length === 0 || newIngested > 0),
    termsSearched: terms,
    totalFound,
    newIngested,
    droppedDedup,
    errors,
  };
}
