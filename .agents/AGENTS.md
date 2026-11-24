# AI Agent Guidelines (`AGENTS.md`)

This document defines behavioral constraints, critical invariants, and internal subsystem mechanics for AI agents working in this repository. For general setup and developer guides, refer to [DEVELOPMENT.md](../DEVELOPMENT.md), [CONTRIBUTING.md](../CONTRIBUTING.md), and [README.md](../README.md).

---

## 1. Prime Directives for AI Agents

1. **Strict Invariant: No Backend Scraping**
   - Never implement outbound job-board scraping, fetching, or liveness checks inside `server/`.
   - If a backend service requires page content or liveness info, it must enqueue a typed task (`FETCH_JOB_PAGE`, `CHECK_LIVENESS`) into the SQLite `relay_tasks` queue for the browser extension to lease and execute.

2. **Zero-Token ATS Extraction**
   - All job board connectors (`extension/src/background/providers/` and `extension/src/content/extractors/`) must adhere to zero-token extraction: extract structured data via public ATS JSON endpoints, JSON-LD schemas, or DOM parsing. Never introduce LLM calls to parse job listings.

3. **Truthful Resume Tailoring**
   - The LangGraph tailoring pipeline (`server/tailor`) must only re-rank, highlight, or truthfully rephrase genuine candidate experiences from `master-resume.json`. Never hallucinate skills, metrics, dates, or qualifications not present in the candidate profile.

4. **Preserve Vendored Provider Hashes**
   - Files in `extension/src/background/providers/` are lifted from upstream toolkits. Do not reformat or modify them unnecessarily to maintain synchronization integrity.

5. **Strict Theme Awareness for all UI Elements**
   - JobFoundry natively supports both **Dark Mode** (default `:root`) and **Light Mode** (`html[data-color-mode='light']`, `html.light`), alongside curated accent themes (`indigo`, `cyan`, `emerald`, `purple`, `amber`).
   - Every UI component, view, card, modal, toolbar, chip, badge, input, and label MUST be fully theme-aware and validated for high-contrast readability in **both** light and dark themes.
   - Never hardcode dark colors or surfaces (e.g., `#1e293b`, `#141521`, `#334155`, `#000000`, `rgba(0,0,0,...)`, or `rgba(255,255,255,...)`) for surfaces, text, or borders.
   - Never use white text (`#ffffff` or `--accent-text`) on soft/translucent tinted backgrounds (e.g., `rgba(99, 102, 241, 0.2)` or `color-mix(...)`), because in light mode the surface is light and white text becomes invisible. Use `var(--text-primary)` for high contrast across both modes, or reserve white text exclusively for solid `var(--accent-primary)` backgrounds.

---

## 2. Internal Subsystems & Gotchas

### 2.1 Process Coordination & Port Mapping

Within containers and production deployments, `supervisord` coordinates services behind the public ingress port (`8080`):

- **Ingest API & SPA** (`:8080`, managed by Supervisor): Serves the React SPA, SQLite DB, auth, SimHash dedup, and the task relay queue.
- **Fit Scorer** (`:8001`, internal only): Evaluates JDs against candidate resumes.
- **Resume Tailor** (`:8081`, internal only): LangGraph section-by-section tailoring engine (`resume_ops_api`).
- **LLM providers**: Scorer and tailor call the explicitly configured provider endpoint directly. Set `OPENROUTER_API_BASE`, `OPENAI_BASE_URL`, or an equivalent provider base in the environment.

### 2.2 Companion Task Relay & SSRF Guardrails

When modifying the task relay (`server/ingest/src/relay/` or `extension/src/background/relay.js`):

- Tasks are leased atomically using `lease_token` and `lease_expires_at` to prevent race conditions across multi-tab instances.
- **SSRF Invariant**: In `extension/src/background/safe-url.js`, `assertSafeDestination()` blocks loopback, private IPv4/IPv6 ranges (including IPv4-mapped IPv6 `::ffff:127.0.0.1` and CGNAT `100.64.0.0/10`), link-local, and `.internal`/`.local` TLDs.
- Never use native automatic redirect following (`fetch` with default `redirect: 'follow'`). Always use `fetchWithSafeRedirects()`, which validates destination safety on every single redirect hop.

### 2.3 PDF Toolchain & Headless Rendering

- Resume PDFs are compiled via `folio-export` (CLI of `jsonresume-theme-folio` powered by Puppeteer).
- The print layout engine uses CSS rules (`break-after: avoid` on section headings, `break-inside: avoid` on experience entries) to eliminate orphaned headers.
- Always verify generated output by checking for the `%PDF-` magic byte header before persisting artifacts.

### 2.4 Generated Architecture Graph

- The graph is **not committed**. `graphify-out/` is git-ignored: it is 8 MB of regenerated HTML/JSON, and tracking it churned every diff. Rebuild it locally with `graphify update .` (no LLM, no API key needed).
- Use `graphify-out/GRAPH_REPORT.md` for a human-readable overview, `graphify-out/graph.html` for the interactive view, and `graphify-out/graph.json` with `graphify-out/.vocab.txt` for Graphify queries.
- The browser view is published at <https://jobfoundry.covai.org/graph.html> (rebuilt from `main` by `.github/workflows/pages.yml`), so it never needs to live in git.
- The graph is a generated navigation aid, not a source of truth. Check `built_at_commit` in `graphify-out/graph.json`, verify claims against current source, and treat `INFERRED` connections as hypotheses.
- Never force-add `graphify-out/` back into git; regenerate it instead.

### 2.5 Frontend Design Tokens & Dual-Theme System

When authoring or modifying UI components (`server/web/src/`):

- **Surfaces & Backgrounds**:
  - Main view/page background: `var(--bg-primary)`
  - Cards & panels: `var(--bg-card)` or class `.card` / `.settings-card`
  - Floating/glass containers: `var(--bg-glass)`
  - Sub-bars, toolbars, and secondary controls: `var(--btn-secondary-bg)` (hover: `var(--btn-secondary-hover-bg)`)
  - Inputs & selects: `var(--bg-input)` and class `.input-text`
- **Borders & Dividers**:
  - Always use `var(--border-subtle)` (focus states: `var(--border-focus)`).
  - Do NOT invent non-existent variable names like `--border-color`.
- **Typography & Text Contrast**:
  - Primary text / titles / headings: `var(--text-primary)` (renders dark slate `#0f172a` in light mode, crisp `#f9fafb` in dark mode).
  - Secondary text / subheadings: `var(--text-secondary)`
  - Muted / timestamp text: `var(--text-muted)`
  - Never provide dark-mode fallbacks like `var(--bg-card, #1e293b)` or `var(--text-secondary, #94a3b8)`. If a fallback is ever needed, it must be theme-neutral or omit the fallback so standard CSS cascade works.
- **Accent Theming & Tints**:
  - Primary accent: `var(--accent-primary)` (hover: `var(--accent-primary-hover)`)
  - Accent text on solid background: `#ffffff` (or `var(--accent-text)`)
  - Subtle accent tint: `color-mix(in srgb, var(--accent-primary) 15%, transparent)`
  - Contrast requirements per accent: When using accent colors for text/links on light backgrounds, always pair them to meet WCAG 2.1 AA contrast (≥ 4.5:1) rather than using bright primary values directly (e.g. in light mode use deep tones: indigo `#4338ca`, cyan `#0e7490`, emerald `#047857`, purple `#7e22ce`, amber `#b45309`), or default to `var(--text-primary)`.
- **Pills, Chips & Checkboxes**:
  - **Selected / Active (Tinted)**:
    - `background`: `color-mix(in srgb, var(--accent-primary) 18%, transparent)`
    - `border`: `1px solid var(--accent-primary)`
    - `color`: `var(--text-primary)` (preserves WCAG AAA contrast in both light and dark modes)
    - Icon: `color: var(--accent-primary)`
  - **Selected / Active (Solid)**:
    - `background`: `var(--accent-primary)`
    - `border`: `1px solid var(--accent-primary)`
    - `color`: `#ffffff`
  - **Unselected / Inactive**:
    - `background`: `var(--btn-secondary-bg)`
    - `border`: `1px solid var(--border-subtle)`
    - `color`: `var(--text-secondary)`

---

## 3. Pre-Commit Verification

Before committing changes, ensure that all tests and lint checks pass across the repository:

```bash
# Run root integration suite and metadata checks
npm test

# Run extension & companion relay tests
npm --workspace=extension test

# Run ingest server tests
npm --workspace=server/ingest test

# Run web frontend tests
npm --workspace=server/web test

# Run Python test suites
(cd server/scorer && uv run pytest)
(cd server/tailor && uv run pytest)

# Verify styling & linting
npm run format:check
npm run lint
```
