# Changelog

JobFoundry follows [Semantic Versioning](https://semver.org/). The current
version lives in [`VERSION`](VERSION). This file records user-visible changes
per release; the full commit history is in git.

## [0.6.0](https://github.com/Covai-Labs/JobFoundry/compare/v0.5.1...v0.6.0) (2026-10-09)


### Features

* **extension:** sync upstream ATS providers from career-ops & search improvements from JobSpy ([#104](https://github.com/Covai-Labs/JobFoundry/issues/104)) ([e662ca6](https://github.com/Covai-Labs/JobFoundry/commit/e662ca64b96f5afc529410a9f7bb198c0563532f))
* **site:** add unlisted directory listings page for external backlinks ([#106](https://github.com/Covai-Labs/JobFoundry/issues/106)) ([b426136](https://github.com/Covai-Labs/JobFoundry/commit/b426136bc197b4e1076673a207d03a95018030ba))


### Bug Fixes

* **deps:** update all dependencies ([#97](https://github.com/Covai-Labs/JobFoundry/issues/97)) ([9c0b749](https://github.com/Covai-Labs/JobFoundry/commit/9c0b74923a618bd33199325c3736c68e4f4a16be))

## [0.5.1](https://github.com/Covai-Labs/JobFoundry/compare/v0.5.0...v0.5.1) (2026-10-05)


### Bug Fixes

* automate ghcr release, repair python packaging deps, and respect VERSION ([#94](https://github.com/Covai-Labs/JobFoundry/issues/94)) ([4ace4a1](https://github.com/Covai-Labs/JobFoundry/commit/4ace4a1101e944ba4c435d8b1c4cedb2e8219106))

## [0.5.0](https://github.com/Covai-Labs/JobFoundry/compare/v0.4.1...v0.5.0) (2026-10-05)


### Features

* **tailor:** add custom instructions, sequential cascade, and critic check ([e12798d](https://github.com/Covai-Labs/JobFoundry/commit/e12798df2011856b1765ed87bc53853111df60c8))
* **tailor:** add custom instructions, sequential cascade, and critic check ([111200f](https://github.com/Covai-Labs/JobFoundry/commit/111200f1b323a8c360ed880c7fae67dd521fa5d5))
* **web:** add quick Mark Applied action to feed cards ([113eb3e](https://github.com/Covai-Labs/JobFoundry/commit/113eb3e65ee69b0d007a44a22f65cb294a407c85))
* **web:** elevate export toolbar and add provenance info to job detail ([ce4812e](https://github.com/Covai-Labs/JobFoundry/commit/ce4812e3372c6d00ca4b1abaeb09b617bd19f945))
* **web:** enhance UX navigation, job provenance, quick apply, and document exports ([65c9b68](https://github.com/Covai-Labs/JobFoundry/commit/65c9b68422820b7d9451eee5ded195ed4774d07b))
* **web:** link logo to feed and add heart support modal ([94cac76](https://github.com/Covai-Labs/JobFoundry/commit/94cac76a211de7db946b0b3b1c97e7ec200bf559))


### Bug Fixes

* **tailor:** add work count validation in monolithic_node and use tmp_path in test mock ([66b3108](https://github.com/Covai-Labs/JobFoundry/commit/66b31089dd327a8b6effec97f88d5425d2676369))
* **tailor:** address review feedback on async jobs, monolithic projects, and prompt ordering ([d447464](https://github.com/Covai-Labs/JobFoundry/commit/d447464427109b01f3bac253f0cd8196a0a708f9))
* **web:** address PR review feedback on exports, provenance, and feed status ([7f12b38](https://github.com/Covai-Labs/JobFoundry/commit/7f12b38b4ddee3e3d5e19b50e070b7280b6ef329))
* **web:** polish feed status options, modal shortcut isolation, and copy fallback cleanup ([a09f708](https://github.com/Covai-Labs/JobFoundry/commit/a09f708d9778d020a433a8ad70013756a456fb20))

## [0.4.1] — 2026-09-30

- **macOS Apple Silicon (darwin-arm64) distribution**:
  - Standalone portable tarball release with self-contained Node, Python standalone, Chrome headless shell, and dispatcher CLI.
  - Official Homebrew formula and automated tap release bump workflow.
- **Documentation overhaul**:
  - New Code of Conduct, Support, Architecture, Manifesto, Governance, Privacy-adjacent legal docs, and a non-technical-user-first getting-started guide.

## [0.4.0] — 2026-09-12

First packaged distribution release.

- **Windows 11 MSIX sideload package** (x64) with Start-menu launch and
  `jobfoundry` control CLI (`start` / `status` / `logs` / `stop`).
- **Linux AppImage** (x86_64): single portable file, no Docker required;
  distro-agnostic build on AlmaLinux 10. Data follows XDG conventions under
  `~/.local/share/jobfoundry/`.
- Web dashboard unification: settings with vertical categories, embedded
  profile & sync, onboarding quickstart, split-pane triage station.
- Per-user LLM settings for multi-tenant BYOK; multi-model catalog with
  LiteLLM test endpoint.
- Security: SSRF + credential-leak guard via LLM API base-URL allowlist.
- Scorer daemon self-heal for un-migrated databases.
- Runtime baseline: Node 26.
- Removed the in-container LLM proxy; scoring/tailoring call the configured
  provider directly.

## [0.3.0] — 2026-09-02

The "everything local" consolidation.

- **resume-ops merged into `server/tailor`**: the standalone tailoring
  service became JobFoundry's integrated LangGraph engine (it began life as
  a standalone API designed to sit alongside tools like career-ops; it now
  ships inside the stack).
- Single All-in-One container image published to GHCR with multi-arch
  support; single-command installer (`install.sh`).
- Extension dashboard, side panel with reconnect sync, secure
  extension-to-dashboard auto-connect (heartbeat + API-key UI).
- Universal job decanter, background worker daemon with attempt tracking
  and batch ingestion limits.
- TOON resume formatting for LLM prompts (lower token usage); tailored
  artifacts (PDF + ATS plaintext) with pipeline monitoring endpoints.
- Docs portal (Astro → GitHub Pages), `CONTRIBUTING.md`, `DEVELOPMENT.md`,
  `SECURITY.md`, `AGENTS.md`.

## [0.2.12] — 2026-07-22

- Parameterized LLM retry back-off exposed via environment variables.
- Default PDF theme switched to folio with runtime npm theme loading via
  `NODE_PATH`.

## [0.2.11] — 2026-07-01

- Refactored LLM response cache to a post-validation layer.

## [0.2.10] — 2026-07-01

- LiteLLM caching made configurable (`LLM_CACHE`).

## [0.2.9] — 2026-06-28

- Structured-LLM retry count made configurable (`LLM_MAX_RETRIES`).

## [0.2.8] — 2026-06-25

- Client-side rate limiting and concurrency throttling in the structured
  LLM client.

## [0.2.7] — 2026-06-24

- Plain-text ATS resume output added to the tailoring API.

## [0.2.6] — 2026-06-23

- `drop_params=True` for forward-compatible model routing.

## [0.2.5] — 2026-06-22

- Retry without `response_format` when `json_object` mode fails
  (Claude/OpenRouter compatibility).

## [0.2.4] — 2026-06-16

- Reverted strict verbatim-name instruction for optional resume sections.

## [0.2.3] — 2026-06-16

- Removed strict interest-name verification.

## [0.2.2] — 2026-06-16

- Strict warning to preserve interest names verbatim in prompts.

## [0.2.1] — 2026-06-16

- Ensure `'json'` appears in messages when `response_format` is
  `json_object`.

## [0.2.0] — 2026-06-15

- Pydantic model validators enforcing tailored output consistency against
  the master resume, with test coverage.
- Podman-first volume guidance (rootless `:U` mounts) with Docker
  compatibility notes.

## [0.1.1] — 2026-06-08

- Container build fixes (amd64).

## [0.1.0] — 2026-06-08

Initial public history: monorepo scaffold (AGPL-3.0), ingest API with
SQLite + API-key auth + SimHash dedup, LangGraph tailoring pipeline with
immutable-field protection, prompt-robustness work for structured LLM
output, and GHCR publishing.
