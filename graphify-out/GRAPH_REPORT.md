# Graph Report - jobfoundry  (2026-10-11)

## Corpus Check
- Large corpus: 546 files · ~561,947 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3537 nodes · 8845 edges · 207 communities (166 shown, 41 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 466 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Provider Port Tests
- SSRF Guard & Network Security
- Scorer Configuration Tests
- Companion Task Relay & Liveness
- Web API Client & Types
- Job Workbench & UI Components
- CLI Entrypoints & Runner
- Alibaba ATS Provider
- Ingest Server & Auth
- Provider Index Generator
- Hiringroom Phenom
- Package Setup
- Helpers Local Today
- Test Worker Daemon Worker
- Test Services Renderer
- Test Db Session
- Test Tailor Bridge Worker
- Workable  Http
- Client Client.Test
- Themecontext Toastcontext
- Naukri Types
- Models Routes
- Sync Providers Ashby Retry.Test
- Careerviet Getro
- Models Pipeline
- Test Services Llm
- Package Eslint.Config
- Oraclecloud Rippling
- Package
- Llm Test Llm
- App Authcontext
- Settings App
- Scratch Dirs Mjs Files
- Amazon Arbeitnow
- Llm Test Custom Instructions And Mo
- Telegram Channel.Test
- Index Migrate
- Store Test Worker Daemon
- Glints Rheinmetall
- Peoplesoft
- Title Keywords Location Filter
- Gem Agentic Jobs
- Workday
- Test Custom Instructions And Modes 
- Test Config Main
- Ssrf Parse Jd
- Fingerprint Core Normalize
- Trackerutils Kanbanboard.Test
- Jobs Callbacks
- Config Config.Test
- Merge Models
- Test Api Test Merge
- Test Db Store
- Vendor
- Background.Test Dedup
- Taleo
- Mokahr.Test  Http.Test
- Copilot Test Copilot
- Test Services Schema
- Vdab Mycareersfuture
- Package
- Errorboundary Pipelineview
- Prompts Test Merge
- Ats Text Test Services
- Tsconfig
- Adp Workforcenow
- Test Services Themes
- Builtin
- Gupy
- Active Sidepanel.Test
- Main Config
- Test Multi User Worker Tailor Bridg
- Fingerprint Index
- Arbeitsagentur Feishu Jobs
- Jobvite
- Successfactors
- Config Test Services
- Ashby Ashby Compensation Tiers.Test
- Eploy
- Telegram Channel  Html To Text
- Smartrecruiters  Ids
- Ultipro
- Generalist World
- Jobbankca
- Main Popup.Test
- Test Eval Tailoring
- Dassault
- Jazzhr
- Radancy
- Startup Jobs
- Ingest Client Ingest Client.Test
- Avature
- Deutschebahn
- Eightfold
- Greenhouse
- Higheredjobs
- Icims
- Manfred
- Teamtailor
- Rss Entity Decoding.Test Fs
- App Logging
- Test Screener Llm
- Test Services Llm
- Conftest
-  Ip Guard
- Jobstreet
- Nodesk
- Personio
-  Trust Validator
- Weworkremotely
- Csod
- Itviec
- Justjoin
- Larajobs
- Nofluffjobs
- Pythonorg
- Remotli
- Schoolspring
- Messaging Package
- Test Validation
- Diff Resumediffview
- Applitrack
- Beesite
- Collage
- Comeet
- Workday Facet Split.Test Rippling.T
- Himalayas
- Jobspresso
- Neogov
- Prevueaps
- Recruitee
- Tkms
- Check Meta
- Import Career Ops
- Publish Chrome
- Alibaba
- Bamboohr
- Breezy
- Meituan
- Mokahr
- Scan.Test
- Decant Decant.Test
- 4Dayweek
- Consider
- Garena
- Getonbrd
- Jibeapply
- Landingjobs
- Lever
- Pinpoint
- Tencent
- Icims Host Fallback.Test
- Wttj
- Tsconfig
- Detect Reposts Detect Reposts.Test
- Skeleton
- Adding A Provider Readme
- Flowxtra
- Join
- Thehub
- Torre
- Install Healthcheck
- Renderer
- Solidjobs
-  Http.Test
- Icims.Test
- Index
- Browser Mock
- Renovate
- Promptfooconfig Evaluation
- Readme Index
- Architecture Compose
- Architecture Contributing
-  Profile Keywords
- Joinup
- Http Timeout.Test
- Occ.Test
- Wxt.Config Vitest.Config
-  Country.Test
- .Release Please Config
- Architecture Development
-  Fixture Local Parser
- Schoolspring.Test
- Vdab.Test
- Agents
- Architecture
- Architecture
- Architecture
- Changelog
- Readme
- Manifesto
- Pyproject
- Pyproject

## God Nodes (most connected - your core abstractions)
1. `pass()` - 117 edges
2. `fail()` - 117 edges
3. `ROOT` - 115 edges
4. `decodeEntities()` - 112 edges
5. `sleep()` - 85 edges
6. `buildApp()` - 58 edges
7. `JobStore` - 52 edges
8. `ApiClient` - 46 edges
9. `Job` - 46 edges
10. `ResumeMerger` - 43 edges

## Surprising Connections (you probably didn't know these)
- `test_validate_work_count_success()` --uses--> `WorkTailoringOutput`  [INFERRED]
  server/tailor/tests/test_validation.py → server/tailor/src/resume_ops_api/graph/models.py
- `test_validate_education_count_success()` --uses--> `EducationTailoringOutput`  [INFERRED]
  server/tailor/tests/test_validation.py → server/tailor/src/resume_ops_api/graph/models.py
- `test_skills_validation_constraints()` --uses--> `SkillsTailoringOutput`  [INFERRED]
  server/tailor/tests/test_merge.py → server/tailor/src/resume_ops_api/graph/models.py
- `test_projects_validation_constraints()` --uses--> `ProjectsTailoringOutput`  [INFERRED]
  server/tailor/tests/test_merge.py → server/tailor/src/resume_ops_api/graph/models.py
- `test_validate_project_names_success()` --uses--> `ProjectsTailoringOutput`  [INFERRED]
  server/tailor/tests/test_validation.py → server/tailor/src/resume_ops_api/graph/models.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Five Stage Capture to Track Pipeline** — architecture_browser_ingestion, architecture_ingest_dedup, architecture_fit_scoring, architecture_resume_tailoring, architecture_web_dashboard [EXTRACTED 1.00]
- **Extension shell entrypoints** — extension_src_entrypoints_popup_index_popup_shell, extension_src_entrypoints_sidepanel_index_sidepanel_shell, extension_src_entrypoints_dashboard_index_dashboard_shell [INFERRED 0.85]
- **Tailor prompt regression matrix** — server_tailor_promptfooconfig_benchmark [EXTRACTED 1.00]

## Communities (207 total, 41 thin omitted)

### Community 0 - "Provider Port Tests"
Cohesion: 0.09
Nodes (6): fail(), pass(), ROOT, ProbeSentinel, FakeProbeBudgetReached, ProbeSentinel

### Community 1 - "SSRF Guard & Network Security"
Cohesion: 0.05
Nodes (38): assert_safe_url(), _guarded_async_handle(), _guarded_sync_handle(), install_transport_guard(), is_blocked_ip(), _normalize_origin(), _pin_request(), _resolve() (+30 more)

### Community 2 - "Scorer Configuration Tests"
Cohesion: 0.05
Nodes (9): get_settings(), _clean_settings(), TestGetSettings, TestSettingsComputedProperties, TestSettingsDefaults, TestSettingsEnvironmentOverrides, TestSettingsFieldValidators, TestSettingsModelResolution (+1 more)

### Community 3 - "Companion Task Relay & Liveness"
Cohesion: 0.13
Nodes (51): checkLiveness(), BOT_CHALLENGE_PATTERNS, createRelayRunner(), step(), detectBotChallenge(), executeRelayTask(), pollAndExecuteOnce(), SUPPORTED_TASK_TYPES (+43 more)

### Community 4 - "Web API Client & Types"
Cohesion: 0.05
Nodes (49): ApiClientConfig, AuthResponse, CopilotArtifacts, CopilotCoverLetterData, CopilotOutreachData, CopilotQAItem, DiagnosticsInfo, ExtensionConfig (+41 more)

### Community 5 - "Job Workbench & UI Components"
Cohesion: 0.10
Nodes (39): lucide-react, CommandPaletteProps, ArtifactViewer(), ArtifactViewerProps, buildDownloadFilename(), mockJob, getCaptureChannelInfo(), getHostName() (+31 more)

### Community 6 - "CLI Entrypoints & Runner"
Cohesion: 0.09
Nodes (13): async_main(), main(), ResumeValidationError, _FakeContainer, _FakeOrchestrator, _FakeThemeService, _make_namespace(), _make_tailor_result() (+5 more)

### Community 7 - "Alibaba ATS Provider"
Cohesion: 0.07
Nodes (43): buildBody(), DEFAULT_KEYWORDS, fetch(), formatExperience(), parseAlibabaResponse(), randomUUID(), fetchJson(), fetchJsonWithRetry() (+35 more)

### Community 8 - "Ingest Server & Auth"
Cohesion: 0.08
Nodes (36): bearerToken(), buildApp(), authenticate(), requireAdmin(), resolveUser(), hashPassword(), scryptAsync, verifyPassword() (+28 more)

### Community 9 - "Provider Index Generator"
Cohesion: 0.06
Nodes (28): EXT, ids, lines, OUT, PROVIDERS, EXT, EXT, liftedTests (+20 more)

### Community 10 - "Hiringroom Phenom"
Cohesion: 0.09
Nodes (38): decodeFeedText(), extractTag(), fetch(), parseCryptocurrencyJobsRss(), splitTitle(), extractUrl(), fetch(), itemUrl() (+30 more)

### Community 11 - "Package Setup"
Cohesion: 0.04
Nodes (43): react-dom, @testing-library/jest-dom, @types/node, @types/react, @types/react-dom, vite, @vitejs/plugin-react, dependencies (+35 more)

### Community 12 - "Helpers Local Today"
Cohesion: 0.06
Nodes (25): localToday(), codeMask(), daysSpanned(), DEFAULT_SCRIPT_TIMEOUT_MS, directoryDenyBinds(), __dirname, FALLBACK_BASH_SOURCES, hermeticGitEnv() (+17 more)

### Community 13 - "Test Worker Daemon Worker"
Cohesion: 0.11
Nodes (21): create_app(), diagnostics(), worker_status(), worker_tick(), lifespan(), ScorerConfig, StubLLM, Screener (+13 more)

### Community 14 - "Test Services Renderer"
Cohesion: 0.12
Nodes (4): _resolve_theme_spec(), ResumeRenderer, TestResumeRenderer, mock_communicate()

### Community 15 - "Test Db Session"
Cohesion: 0.08
Nodes (8): Base, Job, JobStatus, Database, database(), job_store(), TestJobModel, TestJobStatusEnum

### Community 16 - "Test Tailor Bridge Worker"
Cohesion: 0.10
Nodes (11): ArtifactManager, TailorBridge, process_unscored_jobs(), process_unscored_user_jobs(), test_save_artifacts_all(), test_save_artifacts_from_base64(), test_tailor_bridge_handles_server_error(), test_tailor_bridge_skips_when_no_base_url() (+3 more)

### Community 17 - "Workable  Http"
Cohesion: 0.09
Nodes (38): ATS_PROVIDERS, checkLivenessViaApi(), isAtsPosting(), isSafeValue(), resolveAtsApi(), fetchJson(), fetchResponse(), fetchResponseWithRetry() (+30 more)

### Community 18 - "Client Client.Test"
Cohesion: 0.08
Nodes (3): ApiClient, ApiError, mockJob

### Community 19 - "Themecontext Toastcontext"
Cohesion: 0.10
Nodes (28): react-router-dom, @testing-library/react, App(), CommandPalette(), PaletteItem, AuthProvider(), ACCENT_THEMES, AccentOption (+20 more)

### Community 20 - "Naukri Types"
Cohesion: 0.13
Nodes (17): adzunaSearchProvider, glassdoorSearchProvider, googleSearchProvider, hiringcafeSearchProvider, indeedSearchProvider, SearchPipelineResult, searchProviderMap, linkedinSearchProvider (+9 more)

### Community 21 - "Models Routes"
Cohesion: 0.14
Nodes (28): get_container(), CopilotCoverLetterRequest, CopilotCoverLetterResponse, CopilotOutreachRequest, CopilotOutreachResponse, CopilotQARequest, CopilotQAResponse, HealthResponse (+20 more)

### Community 22 - "Sync Providers Ashby Retry.Test"
Cohesion: 0.05
Nodes (20): EXT, pkg, DROP_PROVIDER_FILES, expected, EXT, from, LOCAL_ONLY, localFiles (+12 more)

### Community 23 - "Careerviet Getro"
Cohesion: 0.11
Nodes (31): assertCareerVietUrl(), assertParsedSomething(), buildListUrl(), citySegment(), detect(), fetch(), parseListingPage(), parsePostedAt() (+23 more)

### Community 24 - "Models Pipeline"
Cohesion: 0.18
Nodes (17): BasicsTailoringOutput, EducationEntryTailoring, FinalCheckCriticOutput, FullResumeTailoringOutput, InterestTailoring, ProjectEntryTailoring, ProjectsTailoringOutput, QualificationsTailoringOutput (+9 more)

### Community 25 - "Test Services Llm"
Cohesion: 0.08
Nodes (4): _call_with_rate_limiting(), TestStructuredLLMClient, _FakeResponseModel, mock_completion()

### Community 26 - "Package Eslint.Config"
Cohesion: 0.06
Nodes (34): dependencies, ajv, ajv-formats, description, devDependencies, eslint, @eslint/js, globals (+26 more)

### Community 27 - "Oraclecloud Rippling"
Cohesion: 0.10
Nodes (31): assertFeedUrl(), fetch(), normalizeSpeedrunJob(), resolveMaxPages(), resolveQuery(), toEpochMs(), fetchJsonWithRetry(), assembleLocation() (+23 more)

### Community 28 - "Package"
Cohesion: 0.06
Nodes (34): devDependencies, jsdom, typescript, vitest, web-ext, @webext-core/messaging, wxt, @wxt-dev/storage (+26 more)

### Community 29 - "Llm Test Llm"
Cohesion: 0.10
Nodes (19): format_resume_for_prompt(), _is_transient_error(), ScoreResult, test_format_resume_for_prompt(), test_format_resume_for_prompt_empty(), test_litellm_client_skips_without_env(), test_score_result_boundaries(), test_score_result_validation() (+11 more)

### Community 30 - "App Authcontext"
Cohesion: 0.15
Nodes (23): react, api, User, DashboardLayout(), DashboardRoot(), JobDetailWrapper(), TrackerRoute(), SupportModal() (+15 more)

### Community 31 - "Settings App"
Cohesion: 0.10
Nodes (30): canAccessJob(), resolveCopilotConfig(), coerceValue(), DEFAULT_COPILOT_SYSTEM_PROMPT, DEFAULT_COVER_LETTER_PROMPT, DEFAULT_EXTENSION_CONFIG, DEFAULT_OUTREACH_PROMPT, DEFAULT_PROMPT_TEMPLATES (+22 more)

### Community 32 - "Scratch Dirs Mjs Files"
Cohesion: 0.08
Nodes (17): FakeSentinel, publish(), resolveZipPath(), sleep(), collectMjsFiles(), isNestedCheckout(), isUnderNestedCheckout(), SKIP_DIRS (+9 more)

### Community 33 - "Amazon Arbeitnow"
Cohesion: 0.08
Nodes (12): buildQuery(), fetch(), toEpochMs(), assertArbeitnowUrl(), fetch(), normalizeArbeitnowJob(), resolveMaxPages(), buildPostFilter() (+4 more)

### Community 34 - "Llm Test Custom Instructions And Mo"
Cohesion: 0.10
Nodes (5): ScoreRequest, LLMClient, sample_resume(), sample_resume(), validator()

### Community 35 - "Telegram Channel.Test"
Cohesion: 0.06
Nodes (27): BudgetReached, MEDIA_ONLY, P_AGENCY, P_ANON, P_AT, P_DATE_TITLE, P_DIGEST, P_FORM (+19 more)

### Community 36 - "Index Migrate"
Cohesion: 0.15
Nodes (14): better-sqlite3, loadConfig(), openDb(), migrate(), SCHEMA_SQL, config, db, makeApp() (+6 more)

### Community 38 - "Glints Rheinmetall"
Cohesion: 0.12
Nodes (25): ALLOWED_GLINTS_HOSTS, assertGlintsUrl(), deriveBaseUrl(), fetch(), graphqlPage(), parseGlintsItem(), toEpochMs(), sleep() (+17 more)

### Community 39 - "Peoplesoft"
Cohesion: 0.14
Nodes (29): assertPeopleSoftUrl(), buildDetailUrl(), buildSearchUrl(), cookieHeader(), createCookieJar(), createSession(), detect(), escapeRegExp() (+21 more)

### Community 40 - "Title Keywords Location Filter"
Cohesion: 0.15
Nodes (19): buildDateFilter(), buildLocationFilter(), compileLocationKeyword(), REMOTE_TITLE_RE, anchoredPattern(), buildTitleFilter(), compileKeyword(), compilePositiveKeyword() (+11 more)

### Community 41 - "Gem Agentic Jobs"
Cohesion: 0.14
Nodes (24): assertAgenticUrl(), fetch(), normalizeAgenticJob(), normalizeAgenticLocation(), normalizeAgenticSalary(), stripHtml(), ALPHA3_TO_ALPHA2, countryName() (+16 more)

### Community 42 - "Workday"
Cohesion: 0.13
Nodes (27): chooseSplitFacet(), confirmDeadViaCareersPage(), CONFIRMED_DEAD_API_STATUSES, detect(), facetCoverage(), facetLooksLikeLocation(), fetch(), isMultiLocationPlaceholder() (+19 more)

### Community 43 - "Test Custom Instructions And Modes "
Cohesion: 0.19
Nodes (8): TailorResult, FakeRenderer, FakeStructuredLLMClient, TestPromptsCustomInstructions, TestResumeGraphTopologies, generate_structured(), __init__(), TestResumeGraphPipeline

### Community 44 - "Test Config Main"
Cohesion: 0.14
Nodes (11): load_config(), setup_observability(), build_app(), main(), test_invalid_threshold_raises(), test_legacy_resume_ops_url_cannot_select_remote_endpoint(), test_load_config_custom_env(), test_load_config_defaults() (+3 more)

### Community 45 - "Ssrf Parse Jd"
Cohesion: 0.14
Nodes (21): RFC-6761, callLlmParser(), cleanText(), heuristicParseJd(), parseJobDescription(), assertSafeOutboundUrl(), BLOCKED_V4, BLOCKED_V6_PREFIXES (+13 more)

### Community 46 - "Fingerprint Core Normalize"
Cohesion: 0.14
Nodes (20): companyKey(), CROSSLIST_THRESHOLD, CROSSLIST_WINDOW_DAYS, findCrossListings(), FINGERPRINT_MIN_TEXT, fingerprintText(), maxDistanceFor(), normalizeJdText() (+12 more)

### Community 47 - "Trackerutils Kanbanboard.Test"
Cohesion: 0.13
Nodes (20): KanbanBoard(), KanbanBoardProps, getColumn(), getDropTarget(), hideColumn(), openColumnMenu(), renderBoard(), DEFAULT_KANBAN_PREFS (+12 more)

### Community 48 - "Jobs Callbacks"
Cohesion: 0.13
Nodes (5): CallbackService, build_container(), AsyncJobRunner, TailorOrchestrator, setup_tracing()

### Community 49 - "Config Config.Test"
Cohesion: 0.13
Nodes (20): clearOfflineQueue(), Config, DEFAULT_CONFIG, DEFAULT_SEARCH_BOARDS, DEFAULT_SEARCH_MAX_RESULTS, defaults, enqueueOfflineJobs(), fetchSeedConfig() (+12 more)

### Community 50 - "Merge Models"
Cohesion: 0.24
Nodes (12): AppError, _clean_string_list(), _normalize(), ResumeMerger, _stringify(), _tokenize(), CertificatesSelectionOutput, EducationTailoringOutput (+4 more)

### Community 51 - "Test Api Test Merge"
Cohesion: 0.15
Nodes (17): FakeCallbackService, test_async_tailor_completes_and_sends_callback(), test_invalid_resume_schema_returns_422(), test_invalid_theme_returns_400(), test_missing_optional_sections_still_complete(), test_node_failure_marks_job_failed(), test_startup_requeues_running_jobs(), test_sync_tailor_allows_alternate_theme() (+9 more)

### Community 53 - "Vendor"
Cohesion: 0.09
Nodes (19): DROP_PROVIDER_FILES, DROP_TEST_FILES, EXT, FIXTURES_DST, fixturesSrc, from, helpersDst, helpersSrc (+11 more)

### Community 54 - "Background.Test Dedup"
Cohesion: 0.14
Nodes (11): createSessionCache(), DEDUP_WINDOW_HOURS, dedupJobs(), makeFallbackCache(), STORAGE_KEY, timestampMs(), extractKeywordsFromResume(), runSearchPipeline() (+3 more)

### Community 55 - "Taleo"
Cohesion: 0.19
Nodes (21): assertTaleoUrl(), buildBody(), buildSearchUrl(), decodeDetail(), detailLimit(), detect(), extractHeadings(), extractLang() (+13 more)

### Community 56 - "Mokahr.Test  Http.Test"
Cohesion: 0.11
Nodes (11): nonTypeErrorLookalike, oldNodeShape, redirectRefusal, transportFailure, normalizeUrl(), normalizeUrlForDedup(), promoteKnownFragmentIdentity(), FakeSentinel (+3 more)

### Community 57 - "Copilot Test Copilot"
Cohesion: 0.23
Nodes (10): CopilotService, CoverLetterLLMResult, format_to_toon(), OutreachLLMResult, QALLMResult, StructuredLLMClient, test_format_to_toon(), test_generate_cover_letter() (+2 more)

### Community 59 - "Vdab Mycareersfuture"
Cohesion: 0.19
Nodes (15): intInRange(), cleanUrl(), fetch(), normalizeJob(), parseConfig(), parsePeoplesoftEntryConfig(), cleanKeywords(), profileTargetKeywords() (+7 more)

### Community 60 - "Package"
Cohesion: 0.10
Nodes (19): fastify, undici, dependencies, ajv, ajv-formats, better-sqlite3, fastify, undici (+11 more)

### Community 61 - "Errorboundary Pipelineview"
Cohesion: 0.14
Nodes (11): ErrorBoundary, Props, State, JobDetailModal(), baseJob, noopHandlers, baseJob, renderModal() (+3 more)

### Community 62 - "Prompts Test Merge"
Cohesion: 0.36
Nodes (17): _apply_style(), basics_prompt(), certificates_prompt(), education_prompt(), final_check_prompt(), _json(), monolithic_prompt(), optional_sections_prompt() (+9 more)

### Community 63 - "Ats Text Test Services"
Cohesion: 0.24
Nodes (13): _fmt_date(), json_to_ats_text(), _render_basics(), _render_certificates(), _render_education(), _render_interests(), _render_projects(), _render_skills() (+5 more)

### Community 64 - "Tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+10 more)

### Community 65 - "Adp Workforcenow"
Cohesion: 0.23
Nodes (17): assertAdpUrl(), buildDetailUrl(), buildListUrl(), buildPostingUrl(), detect(), extractExternalJobId(), extractLocation(), extractPostedAt() (+9 more)

### Community 67 - "Builtin"
Cohesion: 0.21
Nodes (16): assertHost(), composeLocation(), effectiveMaxPages(), fetch(), fieldAfterIcon(), HOSTS, jobIdFromUrl(), parseCards() (+8 more)

### Community 68 - "Gupy"
Cohesion: 0.21
Nodes (15): assertApiUrl(), buildGupyLocation(), extractGupyRows(), fetch(), isSafeGupyUrl(), listParam(), normalizeGupyApiJob(), pageIsPastWindow() (+7 more)

### Community 69 - "Active Sidepanel.Test"
Cohesion: 0.15
Nodes (9): findNextPageButton(), runActiveCrawl(), sleep(), createPassiveObserver(), FIXTURES, FIXTURES, EXT, EXT (+1 more)

### Community 70 - "Main Config"
Cohesion: 0.27
Nodes (14): main(), initDashboard(), currentConfig, getWebSettingsUrl(), hydrate(), init(), openWebSettings(), triggerSync() (+6 more)

### Community 71 - "Test Multi User Worker Tailor Bridg"
Cohesion: 0.18
Nodes (6): TailorResult, DynamicScoreLLM, MockTailorBridge, test_get_user_effective_tailor_partial_provider_never_mixes_keys(), test_multi_user_worker_no_key_failure_never_falls_back_to_legacy(), test_multi_user_worker_scoring_and_isolation()

### Community 72 - "Fingerprint Index"
Cohesion: 0.20
Nodes (15): companyKey(), CROSSLIST_THRESHOLD, CROSSLIST_WINDOW_DAYS, findCrossListings(), FINGERPRINT_MIN_TEXT, fingerprintText(), maxDistanceFor(), normalizeJdText() (+7 more)

### Community 73 - "Arbeitsagentur Feishu Jobs"
Cohesion: 0.22
Nodes (12): buildLocation(), fetch(), intInRange(), normalizeJob(), parseArbeitsagenturConfig(), DEFAULT_KEYWORDS, detect(), fetch() (+4 more)

### Community 74 - "Jobvite"
Cohesion: 0.25
Nodes (15): ALLOWED_HOSTS, assertJobviteHost(), buildBoardFetchUrl(), buildBoardUrl(), buildFeedUrl(), detect(), extractEidFromBoard(), fetch() (+7 more)

### Community 75 - "Successfactors"
Cohesion: 0.23
Nodes (14): cityFromSlug(), clean(), cleanCsbLocation(), CSB_DEFAULT_LOCALES, CSB_LOCALE_PRIORITY, extractLocales(), fetch(), fetchCsb() (+6 more)

### Community 77 - "Ashby Ashby Compensation Tiers.Test"
Cohesion: 0.22
Nodes (10): ALLOWED_ASHBY_HOSTS, assertAshbyUrl(), containsWholeWord(), detect(), fetch(), formatLocation(), INTERVAL_MULTIPLIERS, parseCompensation() (+2 more)

### Community 78 - "Eploy"
Cohesion: 0.30
Nodes (14): ACRONYMS, buildFeedUrl(), detect(), fetch(), flattenJsonLd(), isAllowedJobUrl(), isJobPosting(), locationFromAddress() (+6 more)

### Community 79 - "Telegram Channel  Html To Text"
Cohesion: 0.27
Nodes (13): DESCRIPTION_CAP, htmlToText(), stripMarkup(), applicationLink(), classifyLink(), employerName(), fetch(), headline() (+5 more)

### Community 80 - "Smartrecruiters  Ids"
Cohesion: 0.25
Nodes (13): coerceId(), ALLOWED_SMARTRECRUITERS_HOSTS, assertSmartRecruitersUrl(), buildPostingDetailUrl(), buildPostingsUrl(), detect(), extractDescription(), fetch() (+5 more)

### Community 81 - "Ultipro"
Cohesion: 0.26
Nodes (14): assertUltiproUrl(), buildDetailUrl(), buildListBody(), buildListUrl(), detect(), extractCandidateOpportunityDetail(), extractLocations(), fetch() (+6 more)

### Community 82 - "Generalist World"
Cohesion: 0.22
Nodes (12): CARDS_RE, cardToJob(), fetch(), normalizeGeneralistWorldCard(), ONE_CARD_RE, parseGeneralistWorldJobs(), RAW_TEXT_END, regionLabel() (+4 more)

### Community 83 - "Jobbankca"
Cohesion: 0.26
Nodes (12): assertJobBankUrl(), attrsOf(), buildFeedUrl(), cleanUrl(), extractText(), fetch(), linkHref(), parseJobBankConfig() (+4 more)

### Community 84 - "Main Popup.Test"
Cohesion: 0.26
Nodes (11): autoConnect(), captureCurrentTab(), DOM, hydrate(), init(), scanNow(), searchBoardsNow(), uiBase() (+3 more)

### Community 85 - "Test Eval Tailoring"
Cohesion: 0.19
Nodes (3): test_deepeval_faithfulness_metric(), test_tailoring_immutability_and_schema_compliance(), verify_immutability()

### Community 86 - "Dassault"
Cohesion: 0.22
Nodes (11): buildUrl(), CITY_LABELS, COUNTRY_LABELS, fetch(), LABEL_RE, LOC_LABELS, metaMap(), parseCategories() (+3 more)

### Community 87 - "Jazzhr"
Cohesion: 0.32
Nodes (12): assertJazzHRUrl(), boardUrl(), clean(), config(), detect(), fetch(), locationText(), parseJazzHRDetail() (+4 more)

### Community 88 - "Radancy"
Cohesion: 0.29
Nodes (11): buildFragmentUrl(), clean(), fetch(), makeNonce(), parseLegacyResults(), parseModernResults(), parseResults(), readFragmentTotals() (+3 more)

### Community 89 - "Startup Jobs"
Cohesion: 0.29
Nodes (12): assertStartupJobsUrl(), buildFeedUrl(), cleanUrl(), detect(), extractLocation(), extractText(), fetch(), maskCdataAndComments() (+4 more)

### Community 90 - "Ingest Client Ingest Client.Test"
Cohesion: 0.27
Nodes (7): AuthError, ConfigError, HttpError, sendJobs(), attempt(), TimeoutError, JOB

### Community 91 - "Avature"
Cohesion: 0.27
Nodes (9): assertParsedSomething(), clean(), fetch(), MONTHS, parseArticles(), parseLocation(), parsePosted(), RESERVED_PAGINATION_KEYS (+1 more)

### Community 92 - "Deutschebahn"
Cohesion: 0.35
Nodes (11): assertEmptyFirstPage(), assertNoUnparsedHits(), clean(), countHitAnchors(), countMissedPostingLinks(), detect(), fetch(), parseHits() (+3 more)

### Community 93 - "Eightfold"
Cohesion: 0.32
Nodes (11): assembleLocation(), assertEightfoldUrl(), buildApiUrl(), buildJobUrl(), detect(), epochSecondsToMs(), fetch(), parseEightfoldResponse() (+3 more)

### Community 94 - "Greenhouse"
Cohesion: 0.30
Nodes (11): ALLOWED_GREENHOUSE_HOSTS, assertGreenhouseUrl(), buildOfficeMap(), contentToText(), detect(), fetch(), isWorkModelOnly(), LEGACY_BOARD_HOSTS (+3 more)

### Community 95 - "Higheredjobs"
Cohesion: 0.32
Nodes (11): assertRssFeed(), cleanUrl(), detect(), extractText(), fallbackCompany(), feedUrlFor(), fetch(), parseHigherEdJobsFeed() (+3 more)

### Community 96 - "Icims"
Cohesion: 0.29
Nodes (11): COUNTRY_NAMES, detect(), enrichDate(), fetch(), fetchPortal(), HEADERS, parseIcimsSearchPage(), pickDatePosted() (+3 more)

### Community 97 - "Manfred"
Cohesion: 0.29
Nodes (11): assertManfredUrl(), buildFeedUrl(), CURRENCY_BY_SYMBOL, detect(), fetch(), normalizeCurrency(), normalizeManfredOffer(), parseCompensation() (+3 more)

### Community 98 - "Teamtailor"
Cohesion: 0.33
Nodes (11): assertFeedUrl(), cleanUrl(), detect(), extractText(), fallbackCompany(), fetch(), parseTeamtailorFeed(), resolveFeedUrl() (+3 more)

### Community 99 - "Rss Entity Decoding.Test Fs"
Cohesion: 0.18
Nodes (6): cases, checked, checkProvider(), decodingCases, hasNulOrLoneSurrogate(), rssProviders

### Community 100 - "App Logging"
Cohesion: 0.26
Nodes (5): create_app(), app_error_handler(), request_validation_error_handler(), ErrorResponse, configure_logging()

### Community 101 - "Test Screener Llm"
Cohesion: 0.29
Nodes (5): LiteLLMClient, load_golden_case(), test_screener_handles_missing_optional_fields(), test_screener_live_llm(), test_screener_with_stub_golden_set()

### Community 103 - "Conftest"
Cohesion: 0.18
Nodes (4): client(), fake_callback_service(), set_default_test_env(), settings()

### Community 104 - " Ip Guard"
Cohesion: 0.20
Nodes (6): RFC-4007, isBlockedAddress(), RFC-1918, providerFetchContext, V4_BLOCKED, v4ToInt()

### Community 105 - "Jobstreet"
Cohesion: 0.29
Nodes (9): ALLOWED_JOBSTREET_HOSTS, assertJobstreetUrl(), buildSearchUrl(), deriveOrigin(), fetch(), ID_LOCALE_HOSTS, jobDetailPath(), parseJobstreetItem() (+1 more)

### Community 106 - "Nodesk"
Cohesion: 0.33
Nodes (9): assertNodeskUrl(), cleanUrl(), extractText(), fallbackCompany(), fetch(), parseNodeskFeed(), splitTitle(), tagText() (+1 more)

### Community 107 - "Personio"
Cohesion: 0.36
Nodes (10): assertPersonioUrl(), detect(), extractText(), fetch(), parsePersonioHtml(), parsePersonioXml(), resolveHost(), stripTags() (+2 more)

### Community 108 - " Trust Validator"
Cohesion: 0.27
Nodes (9): asciiFoldForHostname(), buildTrustValidator(), classifyTrustLevel(), companyMatchesHostname(), DEFAULT_ATS_ALLOWLIST, DEFAULT_SUSPICIOUS_DOMAINS, matchesDomainList(), PENALTIES (+1 more)

### Community 109 - "Weworkremotely"
Cohesion: 0.33
Nodes (9): assertWwrUrl(), cleanUrl(), extractText(), fallbackCompany(), fetch(), parseWwrFeed(), splitTitle(), tagText() (+1 more)

### Community 110 - "Csod"
Cohesion: 0.38
Nodes (9): cleanLocations(), cookieHeaderFrom(), detect(), extractToken(), fetch(), parseCsodDate(), parseRequisitions(), resolveConfig() (+1 more)

### Community 111 - "Itviec"
Cohesion: 0.38
Nodes (9): assertItviecUrl(), assertParsedSomething(), buildListUrl(), cityPath(), detect(), fetch(), parseListingPage(), parsePostedAt() (+1 more)

### Community 112 - "Justjoin"
Cohesion: 0.38
Nodes (9): ALLOWED_HOSTS, assertJustJoinUrl(), buildApiUrl(), detect(), detectUrl(), fetch(), normalizeLocation(), parseJustJoinResponse() (+1 more)

### Community 113 - "Larajobs"
Cohesion: 0.36
Nodes (8): assertLarajobsUrl(), cleanUrl(), extractText(), fallbackCompany(), fetch(), parseLarajobsFeed(), tagText(), toEpochMs()

### Community 114 - "Nofluffjobs"
Cohesion: 0.38
Nodes (9): ALLOWED_HOSTS, assertNoFluffUrl(), buildRequest(), detect(), detectUrl(), fetch(), normalizeLocation(), parseNoFluffJobsResponse() (+1 more)

### Community 115 - "Pythonorg"
Cohesion: 0.36
Nodes (8): assertPythonOrgUrl(), cleanUrl(), extractText(), fallbackCompany(), fetch(), parsePythonOrgFeed(), tagText(), toEpochMs()

### Community 116 - "Remotli"
Cohesion: 0.36
Nodes (8): assertRemotliUrl(), fetch(), htmlToText(), normalizeRemotliJob(), resolveLocation(), resolveSalary(), resolveUrl(), toEpochMs()

### Community 117 - "Schoolspring"
Cohesion: 0.36
Nodes (9): clean(), detect(), fetch(), NON_DISTRICT, pageUrl(), parseSchoolSpringPage(), resolveHost(), resolveMaxPages() (+1 more)

### Community 118 - "Messaging Package"
Cohesion: 0.20
Nodes (9): AutoConnectResult, CaptureActiveTabResult, JobFoundryProtocol, JobsDiscoveredPayload, JobsDiscoveredResult, onMessage, ScanNowResult, SearchBoardsResult (+1 more)

### Community 119 - "Test Validation"
Cohesion: 0.20
Nodes (8): test_validate_certificate_names_failure(), test_validate_certificate_names_success(), test_validate_education_count_failure(), test_validate_education_count_success(), test_validate_project_names_failure(), test_validate_project_names_success(), test_validate_work_count_failure(), test_validate_work_count_success()

### Community 120 - "Diff Resumediffview"
Cohesion: 0.29
Nodes (7): ResumeDiffViewProps, computeListDiff(), computeResumeDiff(), DiffItem, ResumeDiff, SkillDiff, WorkDiff

### Community 121 - "Applitrack"
Cohesion: 0.42
Nodes (8): APPLITRACK_HOSTS, baseFor(), detect(), fetch(), parseApplitrackOutput(), resolveSlug(), text(), toEpochMs()

### Community 122 - "Beesite"
Cohesion: 0.39
Nodes (8): buildSearchUrl(), DESCRIPTOR, detect(), fetch(), parseBeesiteDate(), parseSearchResult(), resolveConfig(), resolveMaxPages()

### Community 123 - "Collage"
Cohesion: 0.44
Nodes (8): absoluteHttpsUrl(), assertCollageApiUrl(), detect(), fetch(), parseCollageResponse(), resolveApiUrl(), text(), toEpochMs()

### Community 124 - "Comeet"
Cohesion: 0.44
Nodes (8): assertComeetUrl(), detect(), fetch(), isComeetApiUrl(), parseComeetResponse(), redactToken(), resolveApiUrl(), toEpochMs()

### Community 125 - "Workday Facet Split.Test Rippling.T"
Cohesion: 0.22
Nodes (4): captureConsoleErrors(), FakeProbeBudget, DSG_FACETS, DSG_NESTED_FACETS

### Community 126 - "Himalayas"
Cohesion: 0.42
Nodes (7): assertHimalayasUrl(), cleanHimalayasUrl(), cleanText(), fetch(), locationText(), parseHimalayasResponse(), toEpochMs()

### Community 127 - "Jobspresso"
Cohesion: 0.39
Nodes (7): assertJobspressoUrl(), cleanUrl(), extractText(), fetch(), parseJobspressoFeed(), tagText(), toEpochMs()

### Community 128 - "Neogov"
Cohesion: 0.42
Nodes (8): detect(), fetch(), NEOGOV_ORIGINS, pageUrl(), parseNeogovPage(), resolveMaxPages(), resolveTarget(), text()

### Community 129 - "Prevueaps"
Cohesion: 0.39
Nodes (8): assertPrevueapsUrl(), buildApiUrl(), DEFAULT_GET_PARAMS, detect(), extractDomainId(), fetch(), parsePrevueapsResponse(), resolveOrigin()

### Community 130 - "Recruitee"
Cohesion: 0.42
Nodes (8): assembleLocation(), assertRecruiteeUrl(), containsWholeWord(), detect(), fetch(), isRecruiteeSamplePosting(), parseRecruiteeResponse(), resolveApiUrl()

### Community 131 - "Tkms"
Cohesion: 0.42
Nodes (8): detect(), fetch(), parseQuery(), parseTkmsDate(), resolveConfig(), resolveMaxPages(), slugify(), tkmsLocation()

### Community 132 - "Check Meta"
Cohesion: 0.22
Nodes (5): architecture, failures, license, readme, ROOT

### Community 133 - "Import Career Ops"
Cohesion: 0.22
Nodes (6): content, fromArg, jobs, lines, serverUrl, targetFile

### Community 134 - "Publish Chrome"
Cohesion: 0.46
Nodes (7): getAccessToken(), publishExtension(), resolveZipPath(), run(), sleep(), uploadPackage(), waitForUploadSuccess()

### Community 135 - "Alibaba"
Cohesion: 0.39
Nodes (6): buildBody(), DEFAULT_KEYWORDS, fetch(), formatExperience(), parseAlibabaResponse(), randomUUID()

### Community 136 - "Bamboohr"
Cohesion: 0.46
Nodes (7): assertBambooHRUrl(), detect(), enrichDate(), fetch(), isLiveWithNoOpenings(), parseBambooHRResponse(), resolveOrigin()

### Community 137 - "Breezy"
Cohesion: 0.46
Nodes (7): assertBreezyUrl(), containsWholeWord(), detect(), fetch(), parseBreezyResponse(), resolveOrigin(), withCountry()

### Community 138 - "Meituan"
Cohesion: 0.39
Nodes (6): buildBody(), DEFAULT_KEYWORDS, fetch(), names(), parseMeituanResponse(), toEpochMs()

### Community 139 - "Mokahr"
Cohesion: 0.39
Nodes (7): decryptMokaHrEnvelope(), DEFAULT_KEYWORDS, detect(), fetch(), parseMokaHrJobs(), parseTenantUrl(), ROBOTS_EXCLUDED_PATHS

### Community 140 - "Scan.Test"
Cohesion: 0.29
Nodes (3): EXT, fetch(), job()

### Community 141 - "Decant Decant.Test"
Cohesion: 0.46
Nodes (6): cleanBoilerplate(), decantHtml(), decodeHtmlEntities(), fetchAndDecantUrl(), markupToText(), NAMED_ENTITIES

### Community 142 - "4Dayweek"
Cohesion: 0.48
Nodes (5): assertFourDayUrl(), fetch(), normalize4dwJob(), resolveMaxPages(), toEpochMs()

### Community 143 - "Consider"
Cohesion: 0.52
Nodes (6): acquireCsrfHandshake(), detect(), fetch(), locationString(), resolveOrigin(), toEpochMs()

### Community 144 - "Garena"
Cohesion: 0.57
Nodes (5): fetch(), idUrlSegment(), parseGarenaResponse(), resolveOffice(), urlSegment()

### Community 145 - "Getonbrd"
Cohesion: 0.52
Nodes (6): assertGetonbrdUrl(), feedBase(), fetch(), normalizeGetonbrdJob(), resolveCategories(), resolveMaxPages()

### Community 146 - "Jibeapply"
Cohesion: 0.52
Nodes (6): detect(), fetch(), parseJibeapplyResponse(), resolveMaxPages(), toApiUrl(), validateExplicitApi()

### Community 147 - "Landingjobs"
Cohesion: 0.48
Nodes (5): assertLandingUrl(), companyFromUrl(), fetch(), normalizeLandingJob(), toEpochMs()

### Community 148 - "Lever"
Cohesion: 0.52
Nodes (6): ALLOWED_LEVER_HOSTS, assertLeverUrl(), detect(), fetch(), resolveApiUrl(), resolveLocation()

### Community 149 - "Pinpoint"
Cohesion: 0.52
Nodes (6): assertPinpointUrl(), detect(), fetch(), isPinpointDemoPosting(), parsePinpointResponse(), resolveApiUrl()

### Community 150 - "Tencent"
Cohesion: 0.43
Nodes (5): buildUrl(), DEFAULT_KEYWORDS, fetch(), parseCnDate(), parseTencentResponse()

### Community 151 - "Icims Host Fallback.Test"
Cohesion: 0.38
Nodes (4): entry, httpError(), mkCtx(), page()

### Community 152 - "Wttj"
Cohesion: 0.48
Nodes (5): assertHost(), fetch(), normalizeWttjHit(), parseEnvPayload(), resolveConfig()

### Community 153 - "Tsconfig"
Cohesion: 0.29
Nodes (6): compilerOptions, allowJs, checkJs, extends, include, ./.wxt/tsconfig.json

### Community 154 - "Detect Reposts Detect Reposts.Test"
Cohesion: 0.52
Nodes (5): analyzeRepost(), COMPANY_STOP_WORDS, normalizeCompany(), normalizeJobTitle(), TITLE_STOP_WORDS

### Community 156 - "Skeleton"
Cohesion: 0.52
Nodes (6): Skeleton(), SkeletonFeed(), SkeletonJobCard(), SkeletonKanban(), SkeletonProps, SkeletonStatCard()

### Community 157 - "Adding A Provider Readme"
Cohesion: 0.40
Nodes (6): Browser port layer, Provider module contract (detect/fetch), Scan pipeline (providers to ingest API), SSRF trust guard and mandatory guards, Zero-token extraction principle, Zero-token provider layer with static index routing

### Community 158 - "Flowxtra"
Cohesion: 0.60
Nodes (5): assertFlowxtraEndpointUrl(), fetch(), normalizeFlowxtraJob(), resolveMaxPages(), toEpochMs()

### Community 159 - "Join"
Cohesion: 0.60
Nodes (5): detect(), extractNextData(), extractSlug(), fetch(), resolveMaxPages()

### Community 160 - "Thehub"
Cohesion: 0.60
Nodes (5): fetch(), fetchScope(), normalizeHubJob(), parseThehubConfig(), resolveMaxPages()

### Community 161 - "Torre"
Cohesion: 0.53
Nodes (5): assertTorreUrl(), buildTorreQuery(), EXPERIENCE_LEVELS, fetch(), normalizeTorreOpportunity()

### Community 162 - "Install Healthcheck"
Cohesion: 0.47
Nodes (4): main(), install.sh script, check_endpoint(), healthcheck.sh script

### Community 163 - "Renderer"
Cohesion: 0.53
Nodes (3): _default_theme_search_paths(), _package_entry_point(), _select_export_target()

### Community 164 - "Solidjobs"
Cohesion: 0.50
Nodes (3): ALLOWED_HOSTS, assertUrl(), fetch()

### Community 166 - " Http.Test"
Cohesion: 0.40
Nodes (4): nonTypeErrorLookalike, oldNodeShape, redirectRefusal, transportFailure

### Community 167 - "Icims.Test"
Cohesion: 0.50
Nodes (3): fixture, mkCtx(), page()

### Community 168 - "Index"
Cohesion: 0.40
Nodes (5): Dashboard entrypoint shell, Multi-board search providers settings, Options settings entrypoint shell, Popup action shell, Sidepanel shell reusing popup logic

### Community 170 - "Renovate"
Cohesion: 0.40
Nodes (4): local>Covai-Labs/.github, extends, ignorePaths, $schema

### Community 171 - "Promptfooconfig Evaluation"
Cohesion: 0.40
Nodes (5): Scorer Promptfoo Eval Config, Fit Screener Evaluation, Resume-Ops Evaluation Guide, Promptfoo Regression Benchmarking, Tailor Promptfoo Benchmark Config

### Community 172 - "Readme Index"
Cohesion: 0.40
Nodes (5): Resume Tailoring Engine README, Resume-Ops Tailoring Service, Tailoring Rules Immutability, JobFoundry Dashboard Index, Dashboard Application Entry

### Community 173 - "Architecture Compose"
Cohesion: 0.50
Nodes (4): Fit Scoring Service, Ingest and SimHash Dedup, Resume Tailoring Engine, JobFoundry All-in-One Service

### Community 174 - "Architecture Contributing"
Cohesion: 0.50
Nodes (4): Server Never Scrapes Principle, Provider Contract, Zero-Token Philosophy, JobFoundry Overview

## Knowledge Gaps
- **52 isolated node(s):** `@wxt-dev/storage`, `jsdom`, `typescript`, `vitest`, `web-ext` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 962 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `wxt` connect `Wxt.Config Vitest.Config` to `Main Config`, `Package`, `Background.Test Dedup`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `@wxt-dev/storage`, `jsdom`, `typescript` to the rest of the system?**
  _52 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Provider Port Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.09194193141173995 - nodes in this community are weakly interconnected._
- **Why does `decodeEntities()` connect `Hiringroom Phenom` to `Neogov`, `Tkms`, `Companion Task Relay & Liveness`, `Workable  Http`, `Careerviet Getro`, `Oraclecloud Rippling`, `Glints Rheinmetall`, `Peoplesoft`, `Gem Agentic Jobs`, `Builtin`, `Jobvite`, `Successfactors`, `Eploy`, `Telegram Channel  Html To Text`, `Jobbankca`, `Dassault`, `Radancy`, `Startup Jobs`, `Avature`, `Deutschebahn`, `Higheredjobs`, `Icims`, `Teamtailor`, `Nodesk`, `Personio`, `Weworkremotely`, `Csod`, `Itviec`, `Larajobs`, `Pythonorg`, `Remotli`, `Schoolspring`, `Applitrack`, `Beesite`, `Jobspresso`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `SSRF Guard & Network Security` be split into smaller, more focused modules?**
  _Cohesion score 0.05194805194805195 - nodes in this community are weakly interconnected._
- **Why does `fetchJsonWithRetry()` connect `Oraclecloud Rippling` to `Provider Port Tests`, `Adp Workforcenow`, `Manfred`, `Gupy`, `Hiringroom Phenom`, `Workday`, `Ashby Ashby Compensation Tiers.Test`, `Workable  Http`, `Ultipro`, `Schoolspring`, `Taleo`, `Careerviet Getro`, `Radancy`, `Vdab Mycareersfuture`, `Eightfold`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Scorer Configuration Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.0517503805175038 - nodes in this community are weakly interconnected._