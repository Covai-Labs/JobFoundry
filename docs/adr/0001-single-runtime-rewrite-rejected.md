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
4. Treat container size as an **unmeasured hypothesis** until it is measured, and
   act on the measurement rather than on the proposal's arithmetic (#146, #154).

## Evidence

All figures below were measured in-repo. Commands are reproducible.

### Code distribution

| Area | LOC | Notes |
| --- | ---: | --- |
| `extension/src` (non-test) | 35,297 | includes 116 provider adapters (~26,757 LOC) |
| `extension/src` (tests) | 30,963 | |
| `server/web/src` | 21,533 | React 19 SPA |
| `server/ingest/src` | 6,892 | Fastify API |
| `server/mcp/src` | 681 | MCP stdio server |
| `site/src` | 5,331 | Astro |
| **Python source** | **6,547** | scorer 2,017 + tailor 4,530 |
| **Python tests** | **5,996** | scorer 1,757 + tailor 4,239 |

The proposal reported an extension size of 7,847 LOC and a 42,819 LOC total.
Both undercount: `extension/src` alone is 66,260 LOC including tests. The
TypeScript surface is therefore *more* dominant than claimed (~93% of source
LOC), which is the strongest argument for the proposal — and, as below, the
weakest reason to act on it.

### Process topology and duplication

| Fact | Evidence |
| --- | --- |
| Scorer exists mainly to proxy | `server/scorer/src/worker.py` polls SQLite, scores, then calls `tailor_bridge.py` over HTTP |
| `ssrf_guard.py` duplicated | `server/scorer/src/ssrf_guard.py` and `server/tailor/src/resume_ops_api/services/ssrf_guard.py` are byte-identical (258 lines each; `diff` returns no output) |
| Two DB access layers | tailor: `sqlalchemy.ext.asyncio` + `aiosqlite`; scorer: raw `sqlite3` with `check_same_thread=False` (`store.py`, 548 LOC) |
| Split-schema churn | `app.mjs` is 3,088 LOC; the `legacy-admin` / `dev-user` dual-table fork appears 16× |
| Schema is shared and small | `server/ingest/src/db/schema.sql` — 93 lines, read by both runtimes |

## Reasoning

### 1. The image-size premise does not survive arithmetic

The PDF path requires Chromium. `Dockerfile` installs
`chromium chromium-sandbox fonts-liberation fonts-noto-color-emoji` plus
`puppeteer` and `resumed`; `packaging/appimage/build-appimage.sh` pins
`chrome-headless-shell` 153.0.8010.36.

Chromium and its font/shared-library dependencies are ~400–450 MB. **A Node-only
image that can still render resumes lands around 500–700 MB, not 150 MB.**
Deleting every line of Python does not move that number, because Python is not
what dominates the image.

The 150 MB figure is only reachable by removing PDF rendering altogether — a
separate decision with its own trade-offs (#154), not a consequence of changing
language.

> Image size itself has **not** been measured. #146 owns the measurement,
> including a per-layer breakdown. No size claim should be repeated as fact
> until that lands.

### 2. LOC is not value

The Python 6,547 LOC are the differentiating logic: the LangGraph truthfulness
graph with three execution modes, merge semantics (`merge.py`, 259 LOC), the
final-check critic, per-section model routing across 11 model settings, and
ATS/PDF rendering. The ~100k TypeScript LOC are the integration surface: 116
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
  LLM." Zod appears in exactly one file (`server/mcp/src/tools.mjs`). JSON
  Resume is already validated from **one** JSON Schema by `ajv` (Node) and
  `jsonschema` (Python) against **one** `schema.sql`. The drift is real but
  narrow — Pydantic response models vs TypeScript interfaces — and does not
  require a rewrite.

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
- The largest structural win (two processes instead of three, one DB layer, one
  `ssrf_guard`) is achieved in days, not weeks.
- Effort goes to user-visible work (repost detection already written but
  unwired, #149) instead of a port.

**Negative**

- Two runtimes remain. Contributors need Node **and** Python to run everything.
- Packaging keeps a Python runtime (AppImage bundles CPython via
  `python-build-standalone`).
- The ESM-resolution-in-Python wart stays until it causes a defect.

**Neutral**

- Image size remains what it is until #146 measures it and #154 decides.

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
