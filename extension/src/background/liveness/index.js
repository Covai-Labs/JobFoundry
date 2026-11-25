/**
 * liveness/index.js — Adapter around vendored career-ops liveness-api.mjs.
 *
 * The upstream file (../liveness-api.mjs) is vendored 100% verbatim so future
 * career-ops updates drop straight in. This adapter bridges it to JobFoundry's
 * extension contract:
 *   - Accepts a job object `{ url }` (or raw URL string) in checkLivenessViaApi().
 *   - Bridges an optional `ctx.fetchResponse` transport (used in tests) to
 *     `liveness-api.mjs`'s `fetch()` calls.
 *   - Exposes `checkLiveness(job, ctx)` returning `'active' | 'expired' | 'unknown'`.
 */

import {
  classifyAshbyBoard,
  classifyLinkedInPosting,
  resolveAtsApi as upstreamResolveAtsApi,
  checkLivenessViaApi as upstreamCheckLivenessViaApi,
} from '../vendored/liveness-api.mjs';
import { resolveHimalayasPosting } from '../vendored/himalayas-posting.mjs';
import { fetchResponse as defaultFetchResponse } from '../vendored/providers/_http.mjs';

export { classifyAshbyBoard, classifyLinkedInPosting };

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Strict segment validation (rejects percent-encoded chars like %20/%2e in
 * extracted path segments, preserving JobFoundry's SSRF guard).
 */
export function resolveAtsApi(url) {
  const resolved = upstreamResolveAtsApi(url);
  if (!resolved) return null;
  if (resolved.parts) {
    for (const val of Object.values(resolved.parts)) {
      if (typeof val === 'string' && val.length > 0) {
        const valid = val
          .split('/')
          .every((seg) => seg.length > 0 && SAFE_SEGMENT.test(seg) && !seg.includes('..'));
        if (!valid) return null;
      }
    }
  }
  return resolved;
}

export function isAtsPosting(url) {
  return resolveAtsApi(url) !== null;
}

/**
 * Run a fetch via an injected `ctx.fetchResponse` while preserving
 * `liveness-api.mjs`'s `globalThis.fetch` call pattern.
 */
async function withFetchAdapter(ctx, fn) {
  // Only intercept globalThis.fetch when a custom/mock fetchResponse is injected;
  // makeHttpCtx().fetchResponse is the default _http.mjs transport, which calls
  // globalThis.fetch() itself and would otherwise infinitely recurse.
  if (
    !ctx ||
    typeof ctx.fetchResponse !== 'function' ||
    ctx.fetchResponse === defaultFetchResponse
  ) {
    return fn();
  }
  const prevFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => ctx.fetchResponse(url, init);
  try {
    return await fn();
  } finally {
    globalThis.fetch = prevFetch;
  }
}

/**
 * Zero-token liveness check via the posting's ATS API.
 *
 * @param {{url: string}|string} job - a posting (normalized or provider-shaped), or URL.
 * @param {object} [ctx] - optional transport context (e.g. `{ fetchResponse }` in tests).
 * @param {object} [opts] - optional `{ boardCache }` passed through to liveness-api.mjs.
 * @returns {Promise<{result: 'active'|'expired'|'uncertain', code: string, reason: string}|null>}
 */
export async function checkLivenessViaApi(job, ctx, opts) {
  const url = typeof job === 'string' ? job : job?.url;
  if (!url) return null;
  if (!resolveAtsApi(url) && !resolveHimalayasPosting(url)) return null;
  return withFetchAdapter(ctx, () => upstreamCheckLivenessViaApi(url, opts));
}

/**
 * Canonical tri-state liveness for the scan pipeline.
 *
 * @param {object} job - a posting (normalized or provider-shaped).
 * @param {object} [ctx] - transport context.
 * @returns {Promise<'active'|'expired'|'unknown'>}
 */
export async function checkLiveness(job, ctx) {
  const verdict = await checkLivenessViaApi(job, ctx);
  if (verdict?.result === 'active' || verdict?.result === 'expired') {
    return verdict.result;
  }
  return 'unknown';
}
