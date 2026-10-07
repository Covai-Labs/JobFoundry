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

const NKPARAM_MODULUS = BigInt(
  '0xbae543e763474463270045d71ba2b0799d16fdf7e0c2262ba2e0cc98662e137b079cae13268aa1ab205d0937f8e42096c39a071109d23e4f7132f79db3afb7cd'
);
const NKPARAM_EXPONENT = 65537n;
const NKPARAM_SIZE = 64;

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  let cur = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) res = (res * cur) % mod;
    e >>= 1n;
    cur = (cur * cur) % mod;
  }
  return res;
}

/**
 * Naukri's request token: RSA (PKCS#1 v1.5) of "v0|<ms>|121_<page>".
 * Ported from JobSpy (jobspy/naukri/util.py).
 */
export function generateNkparam(page: string = 'srp'): string {
  const encoder = new TextEncoder();
  const message = encoder.encode(`v0|${Date.now()}|121_${page}`);
  const padLen = NKPARAM_SIZE - 3 - message.length;
  const padding = new Uint8Array(padLen);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(padding);
    for (let i = 0; i < padLen; i++) {
      if (padding[i] === 0) padding[i] = (i % 254) + 1;
    }
  } else {
    for (let i = 0; i < padLen; i++) {
      padding[i] = Math.floor(Math.random() * 254) + 1;
    }
  }

  const block = new Uint8Array(NKPARAM_SIZE);
  block[0] = 0x00;
  block[1] = 0x02;
  block.set(padding, 2);
  block[2 + padLen] = 0x00;
  block.set(message, 3 + padLen);

  let base = 0n;
  for (let i = 0; i < NKPARAM_SIZE; i++) {
    base = (base << 8n) | BigInt(block[i]);
  }

  const cipher = modPow(base, NKPARAM_EXPONENT, NKPARAM_MODULUS);
  let hex = cipher.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const rawBytes = new Uint8Array(NKPARAM_SIZE);
  const cipherBytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    cipherBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  rawBytes.set(cipherBytes, NKPARAM_SIZE - cipherBytes.length);

  let binary = '';
  for (let i = 0; i < rawBytes.length; i++) {
    binary += String.fromCharCode(rawBytes[i]);
  }
  return btoa(binary);
}

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
      url = jdUrl.startsWith('http')
        ? jdUrl
        : `https://www.naukri.com${jdUrl.startsWith('/') ? '' : '/'}${jdUrl}`;
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
      postedAt =
        typeof item.createdDate === 'number'
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

  async search(
    criteria: SearchCriteria,
    options: SearchProviderOptions = {}
  ): Promise<RawAggregatorJob[]> {
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
        params.set('wfhType', '2');
      }
      if (criteria.hoursOld) {
        params.set('jobAge', String(Math.ceil(criteria.hoursOld / 24)));
      }

      try {
        const res = await fetchImpl(`${NAUKRI_SEARCH_API}?${params.toString()}`, {
          headers: {
            appid: '109',
            systemid: 'Naukri',
            nkparam: generateNkparam('srp'),
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
