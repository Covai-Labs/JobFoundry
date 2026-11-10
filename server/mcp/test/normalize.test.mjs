import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFitBreakdown,
  extractSkills,
  normalizeSearchStatus,
  normalizeStatus,
  parseFitNotes,
  summarizeExperience,
  summarizeJob,
} from '../src/normalize.mjs';

test('normalizes aliases to canonical Kanban statuses', () => {
  assert.equal(normalizeStatus('discovered'), 'new');
  assert.equal(normalizeStatus('  INTERVIEWING '), 'interview');
  assert.equal(normalizeStatus('offered'), 'offer');
  assert.equal(normalizeStatus('declined'), 'rejected');
  assert.equal(normalizeStatus('closed'), 'archived');
  assert.equal(normalizeStatus('applied'), 'applied');
});

test('rejects unknown and internal failure statuses for updates', () => {
  assert.equal(normalizeStatus('nonsense'), null);
  assert.equal(normalizeStatus('score_failed'), null);
  assert.equal(normalizeStatus('tailor_failed'), null);
  assert.equal(normalizeStatus(null), null);
});

test('search statuses include internal failure states', () => {
  assert.equal(normalizeSearchStatus('score_failed'), 'score_failed');
  assert.equal(normalizeSearchStatus('discovered'), 'new');
  assert.equal(normalizeSearchStatus('nonsense'), null);
});

test('parses valid, error, malformed, and empty fit_notes', () => {
  assert.deepEqual(parseFitNotes('{"reasoning":"ok"}'), { ok: true, value: { reasoning: 'ok' } });
  assert.deepEqual(parseFitNotes('{"error":"boom"}'), { ok: true, value: { error: 'boom' } });
  assert.deepEqual(parseFitNotes('not-json'), { ok: false, value: null });
  assert.deepEqual(parseFitNotes(''), { ok: false, value: null });
  assert.deepEqual(parseFitNotes(null), { ok: false, value: null });
  assert.deepEqual(parseFitNotes({ reasoning: 'object' }), {
    ok: true,
    value: { reasoning: 'object' },
  });
});

test('builds a fit breakdown from stored scorer notes', () => {
  const result = buildFitBreakdown({
    fit_score: 82,
    fit_notes: JSON.stringify({
      reasoning: 'Strong backend match',
      matching_skills: ['Go', 'SQLite'],
      missing_skills: ['Rust'],
      is_valid_job: true,
      is_truncated: false,
    }),
  });
  assert.equal(result.scored, true);
  assert.equal(result.breakdown.reasoning, 'Strong backend match');
  assert.deepEqual(result.breakdown.matching_skills, ['Go', 'SQLite']);
  assert.deepEqual(result.breakdown.missing_skills, ['Rust']);
});

test('reports scorer errors and malformed notes without throwing', () => {
  const errored = buildFitBreakdown({
    fit_score: null,
    fit_notes: JSON.stringify({ error: 'LLM unavailable' }),
  });
  assert.equal(errored.scored, false);
  assert.equal(errored.error, 'LLM unavailable');

  const malformed = buildFitBreakdown({ fit_score: null, fit_notes: 'not-json' });
  assert.equal(malformed.scored, false);
  assert.equal(malformed.breakdown, null);
  assert.equal(malformed.raw_fit_notes, 'not-json');

  const unscored = buildFitBreakdown({ fit_score: null, fit_notes: null });
  assert.equal(unscored.scored, false);
  assert.equal(unscored.breakdown, null);
  assert.equal(unscored.raw_fit_notes, null);
});

test('flattens skills and projects work history', () => {
  const resume = {
    skills: [
      { name: 'Languages', keywords: ['TypeScript', 'Go'] },
      { name: 'Platform', keywords: ['SQLite', 'Go'] },
    ],
    work: [
      { name: 'Acme Corp', position: 'Staff Engineer', startDate: '2020-01-01' },
      { name: 'Beta Inc', position: 'Engineer', endDate: '2019-12-31' },
    ],
  };
  assert.deepEqual(extractSkills(resume), ['Go', 'SQLite', 'TypeScript']);
  assert.deepEqual(summarizeExperience(resume), [
    { position: 'Staff Engineer', company: 'Acme Corp', startDate: '2020-01-01', endDate: '' },
    { position: 'Engineer', company: 'Beta Inc', startDate: '', endDate: '2019-12-31' },
  ]);
});

test('summarizes a job without leaking fit_notes or description', () => {
  const summary = summarizeJob({
    id: 'j1',
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    source: 'greenhouse',
    url: 'https://example.com/j1',
    status: 'new',
    fit_score: 80,
    fit_notes: '{"secret":true}',
    description: 'Long text',
    liveness: 'live',
    posted_at: 1,
    created_at: 2,
    updated_at: 3,
  });
  assert.deepEqual(summary, {
    id: 'j1',
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    source: 'greenhouse',
    url: 'https://example.com/j1',
    status: 'new',
    fit_score: 80,
    liveness: 'live',
    posted_at: 1,
    created_at: 2,
    updated_at: 3,
  });
});
