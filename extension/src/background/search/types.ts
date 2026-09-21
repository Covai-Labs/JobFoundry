/**
 * types.ts — Type definitions for in-browser aggregator search providers.
 * Adapted from JobSpy (MIT License, Copyright (c) 2023 Cullen Watson).
 */

export interface SearchCriteria {
  searchTerm: string;
  location?: string;
  isRemote?: boolean;
  resultsWanted?: number;
  hoursOld?: number;
  countryIndeed?: string;
}

export interface RawAggregatorJob {
  title: string;
  company: string;
  location?: string;
  url: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAt?: string;
  source: string;
}

export interface SearchProviderOptions {
  fetchFn?: typeof fetch;
  delayMs?: number;
  logger?: {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
}

export interface AggregatorSearchProvider {
  readonly id: string;
  readonly displayName: string;
  search(criteria: SearchCriteria, options?: SearchProviderOptions): Promise<RawAggregatorJob[]>;
}
