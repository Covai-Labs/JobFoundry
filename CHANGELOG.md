# Changelog

JobFoundry follows [Semantic Versioning](https://semver.org/). The current
version lives in [`VERSION`](VERSION). This file records user-visible changes
per release; the full commit history is in git.

## [0.8.0](https://github.com/Covai-Labs/JobFoundry/compare/v0.7.0...v0.8.0) (2026-11-13)


### Features

* enhance light mode contrast, clean extension options, and add Langfuse & LangSmith observability ([#170](https://github.com/Covai-Labs/JobFoundry/issues/170)) ([c1ad5d3](https://github.com/Covai-Labs/JobFoundry/commit/c1ad5d3c46180d695eb6ceb651f8ae2fbaa92c6c))
* **extension:** improve LinkedIn JD extraction, noise pruning, and formatting ([#173](https://github.com/Covai-Labs/JobFoundry/issues/173)) ([05ec695](https://github.com/Covai-Labs/JobFoundry/commit/05ec69541db64d0fcdfa5840e02ffb8ae2c8eee7))


### Bug Fixes

* **extension,ingest:** address CodeRabbit & Greptile review comments on JD hydration and extraction ([#174](https://github.com/Covai-Labs/JobFoundry/issues/174)) ([d931037](https://github.com/Covai-Labs/JobFoundry/commit/d9310379117ff8592f6015e2e53829cfc2b02536))
* SSRF DNS lookup, nested form submission, sticky save controls, and extension pairing onboarding ([#169](https://github.com/Covai-Labs/JobFoundry/issues/169)) ([8b4720f](https://github.com/Covai-Labs/JobFoundry/commit/8b4720fdaf6a976d92352b10a632379943e8dd95))

## [0.7.0](https://github.com/Covai-Labs/JobFoundry/compare/v0.6.0...v0.7.0) (2026-11-12)


### Features

* **ingest,scorer:** add user_facts store and in-place resume patch API ([#166](https://github.com/Covai-Labs/JobFoundry/issues/166)) ([aac0fb2](https://github.com/Covai-Labs/JobFoundry/commit/aac0fb2a334c8a618d61e13ed29dc7ef37767ea8))
* **web:** add visual resume form editor and candidate facts manager ([#168](https://github.com/Covai-Labs/JobFoundry/issues/168)) ([5db913d](https://github.com/Covai-Labs/JobFoundry/commit/5db913dfa27c0420d87a42bf930079c91a89c97e))

## [0.6.0](https://github.com/Covai-Labs/JobFoundry/compare/v0.5.1...v0.6.0) (2026-11-11)


### Features

* **copilot:** print-ready cover letter PDF export ([#127](https://github.com/Covai-Labs/JobFoundry/issues/127)) ([9ccde5a](https://github.com/Covai-Labs/JobFoundry/commit/9ccde5ae3d4e12ebc74b5056789b113f87bf4e0c))
* **deploy:** add self-hosting templates for Coolify, CapRover, and Dokploy ([#130](https://github.com/Covai-Labs/JobFoundry/issues/130)) ([f9c5b79](https://github.com/Covai-Labs/JobFoundry/commit/f9c5b79ee736e402ce572d011933ce09082b6c4f))
* **docs:** add graphify architecture knowledge graph and ignore rules ([#111](https://github.com/Covai-Labs/JobFoundry/issues/111)) ([591aa32](https://github.com/Covai-Labs/JobFoundry/commit/591aa322e70a2da2cbaf9d7662c10c20b7e7bc01))
* **export:** universal data export for JSON Resume, CSV, and full archive ([#128](https://github.com/Covai-Labs/JobFoundry/issues/128)) ([acf2ca4](https://github.com/Covai-Labs/JobFoundry/commit/acf2ca4d9a81d5f71f5dd18e1d94bffade57aace))
* **extension:** sync upstream ATS providers from career-ops & search improvements from JobSpy ([#104](https://github.com/Covai-Labs/JobFoundry/issues/104)) ([e662ca6](https://github.com/Covai-Labs/JobFoundry/commit/e662ca64b96f5afc529410a9f7bb198c0563532f))
* **ingest:** vendor career-ops parsers & static datasets verbatim ([#163](https://github.com/Covai-Labs/JobFoundry/issues/163)) ([702a818](https://github.com/Covai-Labs/JobFoundry/commit/702a81893480d9742b91f04097a790c586d73bcb))
* **ingest:** wire up repost and ghost job detection ([#149](https://github.com/Covai-Labs/JobFoundry/issues/149)) ([#162](https://github.com/Covai-Labs/JobFoundry/issues/162)) ([1745ee8](https://github.com/Covai-Labs/JobFoundry/commit/1745ee82bc0f3e97ac264f912fff2995db902612))
* **mcp:** Add stdio Model Context Protocol server ([#121](https://github.com/Covai-Labs/JobFoundry/issues/121)) ([#137](https://github.com/Covai-Labs/JobFoundry/issues/137)) ([e21f475](https://github.com/Covai-Labs/JobFoundry/commit/e21f4752a90acfc0d79e7a1b0db7aea33239e016))
* **site:** add unlisted directory listings page for external backlinks ([#106](https://github.com/Covai-Labs/JobFoundry/issues/106)) ([b426136](https://github.com/Covai-Labs/JobFoundry/commit/b426136bc197b4e1076673a207d03a95018030ba))


### Bug Fixes

* **deps:** update all dependencies ([#108](https://github.com/Covai-Labs/JobFoundry/issues/108)) ([0808495](https://github.com/Covai-Labs/JobFoundry/commit/080849535b38bf37ccc139d3c8a126315520fff0))
* **deps:** update all dependencies ([#97](https://github.com/Covai-Labs/JobFoundry/issues/97)) ([9c0b749](https://github.com/Covai-Labs/JobFoundry/commit/9c0b74923a618bd33199325c3736c68e4f4a16be))
* **deps:** update security-updates [security] ([#139](https://github.com/Covai-Labs/JobFoundry/issues/139)) ([89ddf46](https://github.com/Covai-Labs/JobFoundry/commit/89ddf46fc722f38dfdd27342a258da0bb1bf427c))
* **export:** close review gaps from [#128](https://github.com/Covai-Labs/JobFoundry/issues/128) ([#129](https://github.com/Covai-Labs/JobFoundry/issues/129)) ([1cc37e8](https://github.com/Covai-Labs/JobFoundry/commit/1cc37e87a0490476f0471a849c827fdfefba9798))
* **ingest:** require admin auth for diagnostics and drop pytest from runtime deps ([#161](https://github.com/Covai-Labs/JobFoundry/issues/161)) ([d500b42](https://github.com/Covai-Labs/JobFoundry/commit/d500b425c9ad83efb037cc62c2def45f4395ab7a))
* **site:** refine icon.svg styling ([#110](https://github.com/Covai-Labs/JobFoundry/issues/110)) ([9c2dd8f](https://github.com/Covai-Labs/JobFoundry/commit/9c2dd8f681324dd3eae97b2df9d3c68aae3a09f3))


### Performance Improvements

* **docker:** drop the uv build cache and prune the build context ([#156](https://github.com/Covai-Labs/JobFoundry/issues/156)) ([9cf8fd6](https://github.com/Covai-Labs/JobFoundry/commit/9cf8fd67fe8b7a74d73a3e93bddb96263a7c7a7a)), closes [#146](https://github.com/Covai-Labs/JobFoundry/issues/146)

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
