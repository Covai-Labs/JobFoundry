<div align="center">

# JobFoundry

**Browse jobs like you always have. Get capture, dedup, fit scores, tailored resumes, and tracking — 100% locally, no terminal, no AI tools required.**

[![Website](https://img.shields.io/badge/Website-jobfoundry.covai.org-blueviolet)](https://jobfoundry.covai.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Covai-Labs/JobFoundry)](https://github.com/Covai-Labs/JobFoundry/releases)
[![CI](https://github.com/Covai-Labs/JobFoundry/actions/workflows/ci.yml/badge.svg)](https://github.com/Covai-Labs/JobFoundry/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/kacfnebbiekbofdkgfpgmdcncgohhonm?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/jobfoundry/kacfnebbiekbofdkgfpgmdcncgohhonm)
[![Firefox Add-ons](https://img.shields.io/amo/v/jobfoundry?label=Firefox%20Add-ons)](https://addons.mozilla.org/en-US/firefox/addon/jobfoundry/)
[![Edge Add-ons](https://img.shields.io/badge/Edge_Add--ons-Install-0B7BE0?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/ldnjhehiegnljjlmajlipldlhdkadnpe)

[Quick Install](#quick-install) • [Why JobFoundry?](#why-jobfoundry) • [Features](#key-features) • [Providers](#supported-providers) • [How It Works](#how-it-works) • [Contributing](#contributing)

</div>

---

## Why JobFoundry?

Job hunting is stressful enough without new barriers: no accounts, no subscriptions, no CLIs to learn, no prompts to engineer. If you can browse the web, you can use JobFoundry.

**Capture where the jobs are visible — your browser:**

- **Server scrapers lose. Your browser wins.** Datacenter IPs die against Cloudflare, CAPTCHAs, and login walls. Your authenticated browser session walks straight through — so listings are captured inside the browser you already use.
- **Zero server scraping.** Capture happens in your browser; the server only ever receives already-captured jobs. Full statement: [ARCHITECTURE.md](ARCHITECTURE.md).

- **Zero-token discovery.** Reading a public job posting never costs an LLM call — structured data comes from public ATS endpoints, feeds, and markup. Models are spent only where judgment is needed: fit scoring and tailoring.
- **Truthful tailoring.** Your genuine experience, re-ranked and rephrased under strict schema constraints. Never invented employers, skills, or metrics.
- **The human applies.** JobFoundry prepares and prioritizes; it never auto-submits. You review, you click, you apply.
- **100% local.** SQLite storage, zero telemetry, zero tracking. API keys stay on your machine. See [SECURITY.md](SECURITY.md) and the [privacy guarantees](https://jobfoundry.covai.org/docs/privacy/).

---

## Key Features

- **🔍 87 Job Boards & ATS Adapters:** Greenhouse, Lever, Ashby, Workday, LinkedIn, Indeed, and 80+ more — captured inside your browser session, free forever.
- **🧹 SimHash Dedup:** 64-bit fingerprints collapse cross-posted duplicates automatically.
- **🎯 LLM Fit Scoring:** 0–100 scores with strengths and gap analysis — via OpenRouter, OpenAI, Anthropic, or free local Ollama.
- **📄 Truthful Resume Tailoring:** LangGraph pipeline with immutable protected fields; PDF via `jsonresume-theme-folio` + ATS plaintext.
- **📋 Kanban Dashboard:** Track every application from Discovered to Offer, with paired artifacts per job.
- **🔌 Career-ops Import:** Bring existing discoveries over with `node scripts/import-career-ops.mjs`.

---

## Supported Providers

| Category             | Examples                                                      | Count |
| :------------------- | :------------------------------------------------------------ | :---: |
| **Modern ATS**       | Greenhouse, Lever, Ashby, Workable, SmartRecruiters, BambooHR |  12+  |
| **Enterprise ATS**   | Workday, SuccessFactors, Taleo, iCIMS, Jobvite, Phenom        |  11+  |
| **Major Job Boards** | LinkedIn, Indeed, Dice, Glassdoor, ZipRecruiter, Monster      |  8+   |
| **Niche & Remote**   | Wellfound, YC Jobs, We Work Remotely, RemoteOK, Hacker News   |  15+  |
| **Regional & Feeds** | 40+ regional boards, RSS feeds, and aggregators               |  40+  |

Browse the full searchable index: **[Provider Directory](https://jobfoundry.covai.org/docs/providers/)**. Missing a board? [Request it](https://github.com/Covai-Labs/JobFoundry/issues/new?template=provider_request.yml) or [add it yourself](extension/src/background/providers/ADDING_A_PROVIDER.md).

---

## How It Works

```
Browse normally  ──►  [ Extension captures ]  ──►  [ Dedup + Score ]  ──►  [ Tailor + Track ]
your browser          your session, zero         SimHash, local LLM       truthful resume,
                      tokens, zero cost          fit 0–100                Kanban board
```

1. **Install** the app + extension (below), upload your master resume in the dashboard.
2. **Browse** job sites normally — listings flow into your local dashboard automatically.
3. **Review** fit scores on the Kanban board; generate tailored PDF + ATS resumes for the ones worth it.
4. **Apply** yourself, track everything in one place.

How the pieces fit: [ARCHITECTURE.md](ARCHITECTURE.md). How it started: [MANIFESTO.md](MANIFESTO.md).

---

## Quick Install

- 💻 **Linux:** download `JobFoundry-*-x86_64.AppImage` from [Releases](https://github.com/Covai-Labs/JobFoundry/releases), allow executing, double-click. No Docker needed (requires glibc 2.39+, e.g. Fedora 40+, Ubuntu 24.04+, Debian 13+, Arch; for older distros, use the Docker install below).
- 🪟 **Windows 11:** download the `.msix` + `.cer` from [Releases](https://github.com/Covai-Labs/JobFoundry/releases), trust the cert once, install, launch from the Start menu.
- 🐳 **Any OS with Docker:** `curl -fsSL https://raw.githubusercontent.com/Covai-Labs/JobFoundry/main/install.sh | bash`, then open `http://localhost:8080`.
- 🧩 **Extension (easiest):** install from the [Chrome Web Store](https://chromewebstore.google.com/detail/jobfoundry/kacfnebbiekbofdkgfpgmdcncgohhonm), [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/jobfoundry/), or [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ldnjhehiegnljjlmajlipldlhdkadnpe). Prefer the latest build? For Chrome/Edge, download the `.zip` from [Releases](https://github.com/Covai-Labs/JobFoundry/releases) and load unpacked — no build needed. For Firefox, extract the `.zip`, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on…**, and choose `manifest.json` (lasts until restart). Note: store listings may lag behind GitHub Releases due to store review, so check the latest Release if you hit an issue.

Full walkthrough (no terminal required): **[Quickstart Guide](https://jobfoundry.covai.org/docs/getting-started/)**.

<details>
<summary><b>🛠️ Manual / Developer Setup</b></summary>

```bash
git clone https://github.com/Covai-Labs/JobFoundry.git && cd JobFoundry
docker compose up -d   # or: podman compose up -d
./scripts/healthcheck.sh
```

JobFoundry starts with no `.env` file. To add an LLM key or override a default,
copy `.env.example` to `.env` and edit the values you need.

Bare-metal per-service commands, test suites, and repo layout: [DEVELOPMENT.md](DEVELOPMENT.md).

</details>

---

## JobFoundry vs career-ops

Both are free, local-first, and worth your time — they solve different jobs:

| Your goal                                                              | Use            |
| :--------------------------------------------------------------------- | :------------- |
| Drive everything from your **browser + dashboard**, no CLI or AI tools | **JobFoundry** |
| Run your search from inside **AI coding assistants** (agentic, CLI)    | **career-ops** |
| Capture listings through your **real session** (beats bot walls)       | **JobFoundry** |

Already using career-ops? Import your pipeline: `node scripts/import-career-ops.mjs --from /path/to/career-ops/data/pipeline.md`.

---

## Contributing

Contributions welcome — especially new providers (fewer than 100 lines each). Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [provider authoring guide](extension/src/background/providers/ADDING_A_PROVIDER.md), and [SUPPORT.md](SUPPORT.md). All participation follows our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

---

## Attributions & Acknowledgements

A subset of the browser provider layer is adapted from the MIT-licensed [career-ops](https://github.com/career-ops) provider collection. Original MIT headers are preserved in every lifted file; see `extension/scripts/ports/README.md` for details. We are grateful to its maintainers and the open-source community.
