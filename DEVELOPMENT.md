# Development Guide

This guide covers setting up, running, and testing JobFoundry locally for development.

---

## Project Structure

```
JobFoundry/
├── extension/            # WXT MV3 browser extension (Chrome + Firefox)
│   ├── src/background/   # Service worker: scan, relay, safe-url
│   │   └── providers/    # 100+ ATS/job-board adapters
│   ├── src/content/      # In-page extractors (LinkedIn, Indeed, Glassdoor …)
│   ├── src/entrypoints/  # Popup, options, sidepanel, dashboard
│   └── test/             # node:test suites
├── server/
│   ├── ingest/           # Fastify REST API, SQLite, auth, dedup  (:8080)
│   ├── scorer/           # FastAPI fit scorer + worker daemon       (:8001, loopback)
│   ├── tailor/           # LangGraph resume engine + PDF export    (:8081, loopback)
│   └── web/              # Vite + React 19 SPA (Kanban, feed, resume manager)
├── site/                 # Astro marketing/docs site
├── packaging/            # Docker (default), AppImage, MSIX, Homebrew builders
├── scripts/              # Healthcheck, metadata checks, misc utilities
├── test/                 # Multi-service E2E tests
├── compose.yaml          # Full-stack container orchestration
├── supervisord.conf      # In-container process supervision
└── install.sh            # One-command installer
```

Design docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [.agents/AGENTS.md](.agents/AGENTS.md)

---

## Prerequisites

| Tool             | Version                                        |
| :--------------- | :--------------------------------------------- |
| Node.js          | v26+                                           |
| Python           | 3.12+                                          |
| uv               | Latest ([install](https://docs.astral.sh/uv/)) |
| Docker or Podman | Optional (for containerized runs)              |

---

## Running Services Locally

### Recommended: Docker / Podman

The fastest way to run the full stack:

```bash
docker compose up -d   # or: podman compose up -d
```

Dashboard available at `http://localhost:8080`.

---

### Running Services Individually

#### 1. Ingest Server (`server/ingest`)

Handles job ingestion, deduplication, authentication, and artifact serving.

```bash
cd server/ingest
npm install
npm run dev
# → http://localhost:8080
```

#### 2. Scorer (`server/scorer`)

Evaluates jobs against your master resume and computes 0–100 fit scores.

```bash
cd server/scorer
uv sync --dev
uv run uvicorn src.app:app --port 8001 --reload

# Run the background worker standalone:
uv run python -m src.worker
```

#### 3. Resume Tailor (`server/tailor`)

LangGraph pipeline for truthful resume tailoring + PDF export via `jsonresume-theme-folio`.

```bash
cd server/tailor
uv sync --dev
uv run python -m resume_ops_api
# → http://localhost:8081
```

#### 4. Web Dashboard (`server/web`)

React 19 SPA with Vite.

```bash
cd server/web
npm install
npm run dev
# → http://localhost:5173
```

#### 5. Browser Extension (`extension`)

Built with [WXT](https://wxt.dev/) for Manifest V3.

```bash
cd extension
npm install

npm run dev            # Chrome dev mode with hot reload
npm run build          # Production build → .output/chrome-mv3/
npm run build:firefox  # Firefox build   → .output/firefox-mv3/
```

Load unpacked:

- **Chrome:** `chrome://extensions/` → Load unpacked → `.output/chrome-mv3/`
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `.output/firefox-mv3/manifest.json`

---

## Running Tests

```bash
# Full monorepo: E2E + metadata assertions
npm test

# Extension unit + extractor tests
npm --workspace=extension test

# Ingest server API + migration tests
npm --workspace=server/ingest test

# Web dashboard unit tests
npm --workspace=server/web test

# Scorer Python test suite
cd server/scorer && uv run pytest

# Tailor Python test suite
cd server/tailor && uv run pytest
```

---

## Code Quality

Always run before committing:

```bash
npm run lint           # ESLint (flat config)
npm run format:check   # Prettier check
npm run format         # Auto-format
```

---

## Marketing Site (`site/`)

The docs and marketing site is built with [Astro](https://astro.build):

```bash
cd site
npm run dev    # → http://localhost:4321
npm run build  # → site/dist/
```
