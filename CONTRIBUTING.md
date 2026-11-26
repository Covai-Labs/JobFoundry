# Contributing to JobFoundry

Thank you for helping make job hunting less awful. JobFoundry is a solo-maintained open-source project and every contribution — a bug report, a new job board, a typo fix — genuinely matters.

---

## Before You Start

### The One Architectural Rule

**The JobFoundry server never performs outbound job-board scraping.**

All job-board HTTP requests originate from the user's browser extension. The ingest server and scoring workers only ever receive already-captured job data. This is not negotiable — it is a privacy and reliability guarantee, not a convention.

Anything that makes an outbound job-board request must live strictly inside `extension/`. If your contribution would put scraping logic in the server, please open an issue first to discuss an alternative approach.

---

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/<your-username>/JobFoundry.git
cd JobFoundry
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Python Environment

Required for the scorer and tailor workers:

```bash
cd server/scorer && uv sync --dev && cd ../..
cd server/tailor && uv sync --dev && cd ../..
```

### 4. Verify Everything Works

```bash
npm test
npm run lint
npm run format:check
```

If all checks pass, you are ready to contribute.

---

## What to Contribute

### New Job Board Adapters ← Most Wanted

Adding a new job board is the highest-impact contribution and usually takes under 100 lines of code. See the **[Provider Authoring Guide](extension/src/background/vendored/providers/ADDING_A_PROVIDER.md)** for a full walkthrough.

The short version:

1. The providers under `extension/src/background/vendored/providers/` are vendored from `career-ops` and must stay byte-identical — fix those upstream, then re-sync. Browser-specific overrides go in `extension/scripts/ports/` (see `.agents/AGENTS.md` §2.6).
2. Export a default object matching the `Provider` interface (see existing providers for examples).
3. All outbound requests must go through the safe HTTP helpers (`_http.mjs` / `safe-url.js`) — never bypass private IP filtering.
4. Add test fixtures in `extension/test/fixtures/` and verify with `npm --workspace=extension test`.

### In-Page DOM Extractors

For job portals that require active DOM extraction (rather than background API fetches), add a targeted extractor in `extension/src/content/extractors/ats.js` that returns standard fields: `title`, `company`, `location`, `description`, `url`, `postedAt`.

### Bug Fixes & Other Improvements

Open an issue first for anything non-trivial so we can align on the approach before you spend time on it.

---

## Code Standards

- **Linting:** ESLint flat config — run `npm run lint` or `npm run lint:fix`.
- **Formatting:** Prettier — run `npm run format` to auto-format.
- **Vendored files:** Provider files ported from upstream open-source projects are kept byte-identical to preserve attribution and hash integrity. Do not reformat them.

### Dependency Updates

- **Renovate** owns JS/Python dependency updates. Do not submit manual version bumps.
- **`packaging/python/*-requirements.txt`** are compiled lockfiles. Never edit pins by hand. After changing `pyproject.toml`, regenerate:
  ```bash
  scripts/regen-packaging-requirements.sh
  ```

---

## Submitting a Pull Request

1. **Create a focused branch:**
   ```bash
   git checkout -b feat/my-new-provider
   ```
2. **Write clean commits** using conventional commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
3. **Run all checks locally** before opening the PR:
   ```bash
   npm run lint && npm run format:check && npm test
   npm --workspace=extension test
   cd server/scorer && uv run pytest
   cd server/tailor && uv run pytest
   ```
4. **Open a PR against `main`** with a clear description of what the change does and how to test it.

---

## Code of Conduct

Be respectful, constructive, and kind. Job hunting is already stressful — this community should be an encouraging space for everyone. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

Thank you for contributing. Every new job board you add is hours of copy-pasting saved for someone in the middle of a stressful search.

---

## Contributor License Agreement (CLA)

By submitting a Pull Request or contributing code or materials to this repository, you explicitly agree to the following terms:

1. **License Grant:** You grant the project maintainer(s) a perpetual, worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, modify, reproduce, distribute, display, and re-license your contributions.
2. **Future Re-licensing Rights:** The project maintainer(s) reserve the right to re-release, dual-license, or change the open-source or proprietary license of any future version of this project (including under permissive, copyleft, or commercial licenses) without requiring additional permission or consent from contributors.
3. **Originality & Ownership:** You represent and warrant that your contribution is your original creation, or that you have full legal authority and authorization to submit it under these terms.

This project is currently licensed under AGPL-3.0 with a FOSS Linking Exception — see [FOSS-EXCEPTION.md](FOSS-EXCEPTION.md) for details.
