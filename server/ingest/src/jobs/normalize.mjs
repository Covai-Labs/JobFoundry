import { createHash } from 'node:crypto';
import { atsVendorOf, KNOWN_ATS_VENDORS } from '../vendored/ats-vendor.mjs';
import { normalizeUrl } from '../vendored/url-key.mjs';

const URL_RE = /^https?:\/\/\S+$/i;

function sha1(input) {
  return createHash('sha1').update(input).digest('hex');
}

function fingerprintId(fingerprint, url) {
  if (fingerprint) return sha1(`fingerprint:${fingerprint}`);
  return sha1(`url:${url}`);
}

function postedAtMs(postedAt) {
  if (postedAt === undefined || postedAt === null || postedAt === '') return null;
  if (typeof postedAt === 'number') return postedAt;
  const ms = Date.parse(postedAt);
  return Number.isNaN(ms) ? null : ms;
}

function resolveSource(rawSource, url) {
  if (typeof rawSource === 'string' && rawSource !== '' && rawSource !== 'unknown') {
    return rawSource;
  }
  const vendor = atsVendorOf(url);
  if (vendor && KNOWN_ATS_VENDORS.includes(vendor)) {
    return vendor;
  }
  return typeof rawSource === 'string' && rawSource !== '' ? rawSource : 'unknown';
}

export function normalizeJob(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('job must be an object');
  }
  const rawUrl = raw.url;
  if (typeof rawUrl !== 'string' || !URL_RE.test(rawUrl)) {
    throw new Error(`invalid url: ${String(rawUrl)}`);
  }
  const url = normalizeUrl(rawUrl) || rawUrl;
  const fingerprint = typeof raw.fingerprint === 'string' ? raw.fingerprint : '';
  const now = Date.now();
  return {
    id: fingerprintId(fingerprint, url),
    title: typeof raw.title === 'string' ? raw.title : '',
    company: typeof raw.company === 'string' ? raw.company : '',
    location: typeof raw.location === 'string' && raw.location !== '' ? raw.location : null,
    url,
    source: resolveSource(raw.source, url),
    posted_at: postedAtMs(raw.postedAt),
    description: typeof raw.description === 'string' ? raw.description : '',
    fingerprint,
    liveness: 'unknown',
    fit_score: null,
    fit_notes: null,
    status: 'new',
    tailored_resume_id: null,
    repost_status: typeof raw.repost_status === 'string' ? raw.repost_status : null,
    repost_confidence: typeof raw.repost_confidence === 'string' ? raw.repost_confidence : 'none',
    created_at: now,
    updated_at: now,
  };
}
