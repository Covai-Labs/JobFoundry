import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { createPassiveObserver } from '../src/content/passive.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures/content');

test('passive observer extracts jobs on initial start and ignores duplicates', async () => {
  const html = readFileSync(resolve(FIXTURES, 'linkedin-search.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://www.linkedin.com/jobs/search' });
  const discovered = [];

  const observer = createPassiveObserver({
    doc: dom.window.document,
    win: dom.window,
    debounceMs: 10,
    onJobsFound: (jobs) => {
      discovered.push(...jobs);
    },
  });

  observer.start();
  assert.equal(discovered.length, 2);
  assert.equal(discovered[0].title, 'Frontend Architect');

  // Triggering scan again on unchanged DOM does not re-emit
  observer.scan();
  assert.equal(discovered.length, 2);

  observer.stop();
});

test('passive observer reacts to DOM changes', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><ul id="jobs"></ul></body></html>', {
    url: 'https://www.linkedin.com/jobs/search',
  });
  const discovered = [];

  const observer = createPassiveObserver({
    doc: dom.window.document,
    win: dom.window,
    debounceMs: 20,
    onJobsFound: (jobs) => {
      discovered.push(...jobs);
    },
  });

  observer.start();
  assert.equal(discovered.length, 0);

  // Dynamically insert a job card
  const ul = dom.window.document.getElementById('jobs');
  const li = dom.window.document.createElement('li');
  li.className = 'job-card-container';
  li.innerHTML = `
    <a class="job-card-list__title" href="https://www.linkedin.com/jobs/view/99999/">New Role</a>
    <div class="job-card-container__primary-description">NewCorp</div>
  `;
  ul.appendChild(li);

  // Wait for debounce & mutation observation
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].title, 'New Role');
  assert.equal(discovered[0].company, 'NewCorp');

  observer.stop();
});

test('passive observer upgrades a stub job when full description hydrates', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><ul id="jobs"></ul></body></html>', {
    url: 'https://www.linkedin.com/jobs/search',
  });
  const discovered = [];

  const observer = createPassiveObserver({
    doc: dom.window.document,
    win: dom.window,
    debounceMs: 10,
    onJobsFound: (jobs) => {
      discovered.push(...jobs);
    },
  });

  observer.start();

  // 1. First emission: card stub without full description
  const stubJob = {
    url: 'https://www.linkedin.com/jobs/view/12345/',
    title: 'Distributed Systems Engineer',
    company: 'Cloud Corp',
    description: '',
  };
  // Directly trigger notify by inserting card
  const ul = dom.window.document.getElementById('jobs');
  const li = dom.window.document.createElement('li');
  li.className = 'job-card-container';
  li.innerHTML = `
    <a class="job-card-list__title" href="${stubJob.url}">${stubJob.title}</a>
    <div class="job-card-container__primary-description">${stubJob.company}</div>
  `;
  ul.appendChild(li);

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].description, '');

  // 2. Second scan: unchanged card stub does NOT re-emit
  observer.scan();
  assert.equal(discovered.length, 1);

  // 3. Detail pane hydrates with full description
  const detailContainer = dom.window.document.createElement('div');
  detailContainer.className = 'jobs-details__main-content';
  detailContainer.innerHTML = `
    <h1 class="t-24 job-details-jobs-unified-top-card__job-title">${stubJob.title}</h1>
    <div class="job-details-jobs-unified-top-card__company-name">${stubJob.company}</div>
    <div id="job-details">
      <h2>About the job</h2>
      <p>We are looking for a Senior Distributed Systems Engineer to scale our global high-throughput infrastructure. In this role, you will design, build, and optimize critical consensus algorithms and event-driven data streaming pipelines across thousands of nodes worldwide.</p>
      <ul>
        <li>10+ years of professional experience building distributed systems in production</li>
        <li>Deep expertise in Go, Rust, C++, Raft/Paxos consensus, and gRPC microservices</li>
        <li>Proven track record of designing low-latency network protocols and persistent storage engines</li>
      </ul>
    </div>
  `;
  // Set canonical link for URL matching
  const link = dom.window.document.createElement('link');
  link.rel = 'canonical';
  link.href = stubJob.url;
  dom.window.document.head.appendChild(link);
  dom.window.document.body.appendChild(detailContainer);

  await new Promise((resolve) => setTimeout(resolve, 30));

  // Should have emitted the upgraded job with the full description!
  assert.equal(discovered.length, 2);
  const upgraded = discovered[1];
  assert.equal(upgraded.url, stubJob.url);
  assert.ok(upgraded.description.length > 100);
  assert.ok(upgraded.description.includes('Raft/Paxos consensus'));

  observer.stop();
});

test('passive observer supports multi-stage hydration (stub -> partial -> full description)', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    url: 'https://www.linkedin.com/jobs/view/99999/',
  });
  const link = dom.window.document.createElement('link');
  link.rel = 'canonical';
  link.href = 'https://www.linkedin.com/jobs/view/99999/';
  dom.window.document.head.appendChild(link);

  const discovered = [];
  const observer = createPassiveObserver({
    doc: dom.window.document,
    win: dom.window,
    debounceMs: 10,
    onJobsFound: (jobs) => {
      discovered.push(...jobs);
    },
  });

  observer.start();

  const root = dom.window.document.getElementById('root');

  // Stage 1: Card stub with empty description
  root.innerHTML = `
    <div class="jobs-details__main-content">
      <h1 class="job-details-jobs-unified-top-card__job-title">Site Reliability Engineer</h1>
      <div class="job-details-jobs-unified-top-card__company-name">DataGrid Corp</div>
      <div id="job-details"></div>
    </div>
  `;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].description, '');

  // Stage 2: Partial preview description (120 chars)
  const partialText =
    'DataGrid is hiring an SRE to manage multi-region Kubernetes clusters, Prometheus alerting, and edge networking systems.';
  root.querySelector('#job-details').innerHTML = `<p>${partialText}</p>`;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(discovered.length, 2);
  assert.equal(discovered[1].description, partialText);

  // Stage 3: Same partial description does not re-emit
  observer.scan();
  assert.equal(discovered.length, 2);

  // Stage 4: Full detailed description hydrates (500+ chars)
  const fullText =
    'DataGrid is hiring an SRE to manage multi-region Kubernetes clusters, Prometheus alerting, and edge networking systems across 12 datacenters worldwide. Responsibilities include building automated canary deploy pipelines, incident response rotation, SLO definition, disaster recovery drill orchestration, and kernel networking optimizations for eBPF routing.';
  root.querySelector('#job-details').innerHTML = `<p>${fullText}</p>`;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(discovered.length, 3);
  assert.equal(discovered[2].description, fullText);

  observer.stop();
});
