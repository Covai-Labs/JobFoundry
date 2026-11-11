# ADR 0001 — Reject the single-runtime rewrite; consolidate instead

- **Status:** Accepted
- **Date:** 2026-11-11
- **Tracking:** #145 (epic), #153 (this record)
- **Supersedes:** nothing

## Context

JobFoundry runs three processes behind `supervisord`: the Fastify ingest API
(`:8080`), a Python fit scorer (`:8001`), and a Python tailoring engine
(`:8081`). A review proposed replacing both Python services with TypeScript to
obtain a single runtime, citing a Docker image reduction from ~1.8 GB to
~150 MB, a 7–12 day migration, and end-to-end Zod schema sharing.

This ADR records why that proposal was rejected, and what is being done instead,
so the same proposal is not re-litigated from scratch by the next contributor or
agent.

## Decision

**Do not port the Python services to TypeScript.**

Instead:

1. Collapse the scorer into the tailoring worker so there are two processes, not
   three (#150).
2. Remove the duplication that makes the split expensive — the byte-identical
   `ssrf_guard.py`, the second DB access layer, the loopback bridge (#150).
3. Fix the ingest server's dual-schema query duplication and settings ambiguity
   (#147, #148).
4. Measure container size before acting on it, rather than trusting the
   proposal's arithmetic (#146, #154).

## Evidence

All figures below were measured in-repo. Commands are reproducible.

### Code distribution

| Area | LOC | Notes |
| --- | ---: | --- |
| `extension/src` (non-test) | 35,297 | includes 104 provider adapters (~26,757 LOC) |
| `extension/src` (tests) | 30,963 | |
| `server/web/src` | 21,533 | React 19 SPA |
| `server/ingest/src` | 6,892 | Fastify API |
| `server/mcp/src` | 681 | MCP stdio server |
| `site/src` | 5,331 | Astro |
| **Python source** | **6,547** | scorer 2,017 + tailor 4,530 |
| **Python tests** | **5,996** | scorer 1,757 + tailor 4,239 |

The proposal reported an extension size of 7,847 LOC and a 42,819 LOC total.
Both undercount: `extension/src` alone is 66,260 LOC including tests. The
TypeScript surface is therefore more dominant than claimed — 69,734 non-test
source LOC against 6,547 of Python, or **91.4%** of non-test source. That is the
strongest argument for the proposal, and, as below, the weakest reason to act
on it.

"104 provider adapters" counts providers, not files: the directory holds 121
entries — 116 `.mjs` files, of which 11 are `_`-prefixed helpers, plus
`helpers.mjs` (a test helper), `_types.js`, `index.js`, two Markdown files and
`tests/`. The generated registry
(`extension/src/background/providers/index.js`) maps exactly 104 provider IDs,
one per module, and agrees.

### Process topology and duplication

| Fact | Evidence |
| --- | --- |
| Scorer exists mainly to proxy | `server/scorer/src/worker.py` polls SQLite, scores, then calls `tailor_bridge.py` over HTTP |
| `ssrf_guard.py` duplicated | `server/scorer/src/ssrf_guard.py` and `server/tailor/src/resume_ops_api/services/ssrf_guard.py` are byte-identical (258 lines each; `diff` returns no output) |
| Two DB access layers | tailor: `sqlalchemy.ext.asyncio` + `aiosqlite`; scorer: raw `sqlite3` with `check_same_thread=False` (`store.py`, 548 LOC) |
| Split-schema churn | `app.mjs` is 3,088 LOC; the `legacy-admin` / `dev-user` dual-table fork appears 16× |
| Schema is shared and small | `server/ingest/src/db/schema.sql` — 93 lines, read by both runtimes (the *database* schema; the resume schema is a separate story, below) |

## Reasoning

### 1. The image-size premise does not survive measurement

The PDF path requires Chromium. `Dockerfile` installs
`chromium chromium-sandbox fonts-liberation fonts-noto-color-emoji` plus
`puppeteer` and `resumed`; `packaging/appimage/build-appimage.sh` pins
`chrome-headless-shell` 153.0.8010.36.

Measured on 2026-11-11 (`docker build`, podman 5.8.9, amd64), the image is
**1.92 GB**:

| Layer / path | Size |
| --- | ---: |
| `apt-get install chromium … nodejs` + global npm | 1.08 GB |
| `uv pip install` (scorer) | 509 MB |
| `uv pip install -e` (tailor) | 125 MB |
| `/usr/lib/chromium` (inside the image) | 381 MB |
| `/root/.cache` — uv build cache, shipped to production | 339 MB |
| `/usr/local/lib` (site-packages) | 336 MB |

Deleting every line of Python removes roughly **450 MB** (site-packages, the
`uv` binary, and the interpreter share), which leaves ~1.47 GB. Deleting the uv
cache as well leaves ~1.13 GB. **A Node-only image that can still render resumes
lands near 1.1–1.2 GB, not 150 MB.** Python is not what dominates the image;
Chromium and a leftover build cache are.

The 150 MB figure is only reachable by removing PDF rendering altogether — a
separate decision with its own trade-offs (#154), not a consequence of changing
language. The 339 MB cache is recoverable today with no feature change at all.

### 2. LOC is not value

The Python 6,547 LOC are the differentiating logic: the LangGraph truthfulness
graph with three execution modes, merge semantics (`merge.py`, 259 LOC), the
final-check critic, per-section model routing across 11 model settings, and
ATS/PDF rendering. The ~100k TypeScript LOC are the integration surface: 104
provider adapters, a Kanban dashboard, an MV3 extension.

Wide-and-shallow code (providers, UI, CRUD) is cheap to rewrite and cheap to
get wrong in the same way again. Narrow-and-deep code (the no-hallucination
contract) is the product. The proposal's "85% is already TypeScript" framing
preserves the easy 85% and rewrites the 15% that carries the risk.

### 3. The test surface is unbudgeted

5,996 LOC of Python tests plus `server/scorer/evals/promptfooconfig.yaml`.

LLM output is not provable by golden files alone. Parity would require porting
the tests, re-baselining the evals, and accepting an unmeasurable behavioural
delta on the one guarantee the product sells. The proposal budgeted zero for
this and estimated 7–12 days for the whole migration.

### 4. Corrections to arguments made *on both sides*

Recorded so the record is trustworthy when either side is quoted later.

- **Wrong (against the rewrite):** "the tailoring pipeline cannot run in
  TypeScript because PDF rendering shells out to Node." Shelling out is a
  boundary, not a language constraint.
- **Wrong (against the rewrite):** "`toons` has no TypeScript equivalent."
  `toons` is a 779 KB PyO3 extension whose own docstring names the canonical
  TypeScript reference implementation, `@toon-format/toon` (npm, MIT, v4.4.0).
  This is not a lock-in.
- **Wrong (against the rewrite):** "a single Node process will block the event
  loop on Chromium renders." Chromium runs out-of-process; LLM calls are I/O;
  `server/ingest/src/jobs/parse-jd.mjs` already calls an LLM from inside
  Fastify. Event-loop starvation is not the argument.
- **Wrong (for the rewrite):** "one Zod schema across extension, server and
  LLM." Zod appears in exactly one file (`server/mcp/src/tools.mjs`). The
  *database* schema is genuinely single-source (`schema.sql`).
- **Wrong (for the rewrite, in the other direction):** "JSON Resume is validated
  from one schema by both runtimes." It is not. There are **three copies**:
  `server/ingest/src/resumes/resume-schema.json` and
  `server/web/src/features/resume/resume-schema.json` (byte-identical,
  draft-04, `additionalProperties: false`) and
  `server/tailor/src/resume_ops_api/resources/resume_schema.json` (draft-07,
  `additionalProperties: true`). The two runtimes already accept different
  documents. That is a real drift defect worth fixing — by generating the copies
  from one source — and it is still not a reason to port the runtime.

### 5. The genuine friction, recorded fairly

`server/tailor/src/resume_ops_api/services/renderer.py` reimplements Node's ESM
`exports` resolution in Python (`_resolve_theme_spec`, `_select_export_target`,
`_ACTIVE_CONDITIONS`). This is the strongest pro-TypeScript argument in the repo
and it is not sufficient on its own. If it causes a defect, fix the resolver —
do not use it to justify porting the tailoring graph.

## Options considered

| Option | Verdict |
| --- | --- |
| **A. Full TypeScript port** | Rejected: does not fix image size; rewrites the differentiating logic; unbudgeted test parity |
| **B. Next.js monolith** | Rejected: long-lived relay leasing and multi-minute background tailoring fit a dedicated worker better than serverless-first request handlers |
| **C. Go/Rust single binary** | Rejected: weakest LLM orchestration ecosystem; same test-parity problem with less leverage |
| **D. Consolidate and de-duplicate the existing stack** | **Accepted** — see the epic (#145) |

## Consequences

**Positive**

- ~6,000 LOC of tested truthfulness logic and its evals stay intact.
- The largest structural win — two processes instead of three, one DB layer, one
  `ssrf_guard` — is small enough to land in days. It is **planned**, tracked in
  #150; it has not happened yet, so `supervisord.conf` still starts three
  programs until that PR merges.
- Effort goes to user-visible work (repost detection already written but
  unwired, #149) instead of a port.

**Negative**

- Two runtimes remain. Contributors need Node **and** Python to run everything.
- Packaging keeps a Python runtime (AppImage bundles CPython via
  `python-build-standalone`).
- The ESM-resolution-in-Python wart stays until it causes a defect.

**Neutral**

- Image size is **1.92 GB** as measured (2026-11-11); 339 MB of that is an
  unused `uv` build cache. Reducing it is a separate, data-driven decision
  (#154), not a consequence of this ADR.

## Reopen conditions

Reopen this decision only if one of the following becomes true, with numbers:

1. **The Python surface shrinks below ~1,500 LOC** (excluding tests) because the
   pipeline moved to a TypeScript-first framework. At that point the port is
   cheap and the two-runtime tax is no longer justified.
2. **The measured image exceeds the target distribution channel's limit**, and
   #154 shows the excess is attributable to Python rather than Chromium.
   (Chromium is the expected answer; measure first.)
3. **A second hosted region or a reproducibility requirement forces a different
   deployment shape** that a single runtime materially simplifies — for example
   a hard-cold-start or serverless constraint that Python imports make
   impossible.
4. **The Python test surface drops below ~1,000 LOC**, meaning parity is
   demonstrable within a week.

Until one of those is true, the default answer to "should we rewrite in
TypeScript?" is **no**, with this document as the reason.

## References

- Epic and work breakdown: #145
- Measurement: #146 · Image decision: #154
- Consolidation: #150 · Query/settings cleanup: #147, #148
- Unwired feature: #149
- `ARCHITECTURE.md` — pipeline, components, design principles
