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

> ⚠️ **Active Development / Beta:** JobFoundry is built by a solo developer scratching his own itch. The core flows work, but rough edges exist and progress is happening every day. Bug reports, testing, and feedback are deeply appreciated!

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

## Built in a real job search

JobFoundry didn't start as a startup pitch or a polished product idea — it started because I was broke, exhausted, and desperately trying to get a job in a brutal tech market.

Job hunting right now is soul-crushing. Every tool out there wants a $30/month subscription, tries to lock you into their cloud, or burns expensive LLM tokens reading job descriptions only to hallucinate fake metrics, false skills, and invented employers on your resume. I couldn't afford subscriptions, and I refused to send recruiters hallucinated lies.

So I started hacking together tools to survive my own search. First came a tiny CLI experiment in truthful, zero-token resume tailoring. But I quickly realized that half the struggle was the daily chaos of browsing, tab-hopping, and sifting through duplicate cross-postings across 80+ job boards. That end-to-end loop became JobFoundry: capture straight from the browser session, dedup cross-posts with 64-bit SimHash, score fit with local models, and tailor truthfully under strict schema constraints.

Using it in my own search, I stayed stubbornly selective: letting fit scores filter out low-match noise, and only tailoring and applying to genuine high-fit roles. That focus actually worked, and I ended up receiving multiple job offers.

I don't know whether it was the right decision or the wrong decision, but I decided to take a pause for a couple of months and put my energy into polishing this and open-sourcing it under AGPL-3.0. I wanted to see if the tool that got me through the hardest stretch of my life could help other people going through the exact same struggle.

It is definitely not perfect. Rough edges exist, and active development is happening every single day. But if it saves you hours of burnout, protects your privacy, or helps you land an interview, it will have been completely worth it.

---

## Quick Install

The recommended way to run JobFoundry is containerized via **Docker** or **Podman**. The complete stack (Fastify ingest API, React dashboard, LLM scorer, and tailoring engine) starts in seconds:

### 1. One-Line Install (Default & Recommended)

Run this in your terminal (Linux, macOS, or Windows WSL2):

```bash
curl -fsSL https://raw.githubusercontent.com/Covai-Labs/JobFoundry/main/install.sh | bash
```

> **Smart runtime detection:** The script automatically detects whether you have `docker compose`, `podman compose`, `podman-compose`, `docker-compose`, or compatible container engines running, sets up `.env`, and launches the stack at `http://localhost:8080`.

Prefer running compose directly?

```bash
git clone https://github.com/Covai-Labs/JobFoundry.git && cd JobFoundry
docker compose up -d   # or: podman compose up -d
./scripts/healthcheck.sh
```

---

### 2. Add the Companion Browser Extension

The extension captures jobs directly as you browse your favorite boards (zero server scraping):

- **Chrome / Brave:** [Chrome Web Store](https://chromewebstore.google.com/detail/jobfoundry/kacfnebbiekbofdkgfpgmdcncgohhonm)
- **Firefox:** [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/jobfoundry/)
- **Microsoft Edge:** [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/ldnjhehiegnljjlmajlipldlhdkadnpe)

_(Prefer manual unpacked builds? Download the latest `.zip` from [Releases](https://github.com/Covai-Labs/JobFoundry/releases).)_

---

### 3. Standalone Desktop Apps (No Containers Needed)

If you don't use Docker or Podman, ready-made desktop convenience builds are available from [Releases](https://github.com/Covai-Labs/JobFoundry/releases):

- 💻 **Linux:** Download `JobFoundry-*-x86_64.AppImage`, make it executable (`chmod +x`), and double-click to launch (requires glibc 2.39+, e.g. Ubuntu 24.04+, Fedora 40+, Arch; older distros should use Docker).
- 🪟 **Windows 11:** Download `.msix` + `.cer`, trust the certificate via Terminal (Admin), and launch from the Start menu.
- 🍺 **macOS (Apple Silicon):** `brew tap covai-labs/tap && brew install covai-labs/tap/jobfoundry`, then `jobfoundry start` (or download the arm64 tarball). Intel Macs should use Docker above.

Full walkthrough: **[Quickstart Guide](https://jobfoundry.covai.org/docs/getting-started/)**.

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

## Supporting Independent Development

JobFoundry is developed and maintained by a solo developer. There are no venture capitalists, no subscription paywalls, no tracking ads, and no selling of your data.

If JobFoundry saved you hours of tedious copy-pasting, reduced your job-search anxiety, or helped you land a role, here are meaningful ways to back the work:

- ⭐ **Star the repository:** It takes two seconds and helps more job seekers find the tool.
- 💬 **Share feedback & report bugs:** Open an [issue](https://github.com/Covai-Labs/JobFoundry/issues) or join [Discussions](https://github.com/Covai-Labs/JobFoundry/discussions).
- 🧩 **Contribute job boards:** Adding an ATS adapter is usually under 100 lines of code. See [ADDING_A_PROVIDER.md](extension/src/background/providers/ADDING_A_PROVIDER.md).
- 💖 **[Sponsor on GitHub](https://github.com/sponsors/deadrat-in):** Help fund testing infrastructure, domain upkeep, and ongoing development time so JobFoundry remains free and open for everyone.

---

## Contributing

Contributions welcome — especially new providers (fewer than 100 lines each). Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [provider authoring guide](extension/src/background/providers/ADDING_A_PROVIDER.md), and [SUPPORT.md](SUPPORT.md). Bare-metal per-service commands and developer workflows live in [DEVELOPMENT.md](DEVELOPMENT.md). All participation follows our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).

---

## Attributions & Acknowledgements

A subset of the browser provider layer is adapted from the MIT-licensed [career-ops](https://github.com/career-ops) provider collection. Original MIT headers are preserved in every lifted file; see `extension/scripts/ports/README.md` for details. We are grateful to its maintainers and the open-source community.
