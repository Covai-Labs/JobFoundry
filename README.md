<div align="center">

# JobFoundry

**Your private, free AI job search copilot.**

Capture jobs from 100+ boards as you browse. Get instant fit scores. Generate truthful, tailored resumes. Track everything. 100% on your machine.

[![Website](https://img.shields.io/badge/Website-jobfoundry.covai.org-blueviolet)](https://jobfoundry.covai.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Covai-Labs/JobFoundry)](https://github.com/Covai-Labs/JobFoundry/releases)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/kacfnebbiekbofdkgfpgmdcncgohhonm?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/jobfoundry/kacfnebbiekbofdkgfpgmdcncgohhonm)
[![Firefox Add-ons](https://img.shields.io/amo/v/jobfoundry?label=Firefox%20Add-ons)](https://addons.mozilla.org/en-US/firefox/addon/jobfoundry/)
[![Edge Add-ons](https://img.shields.io/badge/Edge_Add--ons-Install-0B7BE0?logo=microsoftedge&logoColor=white)](https://microsoftedge.microsoft.com/addons/detail/ldnjhehiegnljjlmajlipldlhdkadnpe)

[Get Started](#get-started) · [Why This Exists](#why-this-exists) · [How It Works](#how-it-works) · [Features](#features) · [Contributing](#contributing)

</div>

> [!TIP]
> **⭐ If this helps your job search, star the repo!** It costs two seconds and helps other job seekers find it.

---

<!-- TODO: Replace with demo GIF/video once recorded -->
<!-- Recommended: 10-second loop: browse a job page → extension captures it → fit score appears → 1-click tailored resume -->
<p align="center">
  <em>🎬 Demo video coming soon.</em>
</p>

---

## Why This Exists

I built JobFoundry because I was broke, exhausted, and job hunting in a brutal tech market.

Every tool I tried wanted a \$30/month subscription, tried to lock me into their cloud, or burned expensive AI tokens just to read job descriptions, only to hallucinate fake skills, made-up metrics, and invented employers onto my resume. I couldn't afford the subscriptions. I refused to send recruiters fabricated lies.

So I started building my own tools to survive. What began as a small experiment in honest resume tailoring grew into the full pipeline: capture listings straight from the browser, collapse cross-posted duplicates, score how well each job actually fits, and generate truthful resumes under strict schema constraints.

It worked. I stayed selective, letting fit scores filter out noise and only applying to genuinely high-fit roles, and ended up receiving multiple job offers.

I took a pause to polish this and open-source it under AGPL-3.0. If the tool that got me through the hardest stretch of my life can help even one other person going through the same struggle, it'll have been worth it.

> Mass-apply automation is flooding the market: it buries strong candidates and overwhelms hiring teams. JobFoundry bets the other way: **fewer, better, honest applications**.

---

## How It Works

```
Browse normally  →  Extension captures  →  Dedup + Score  →  Tailor + Track
  (your browser)     (your session,         (local AI,        (truthful resume,
                      zero cost)             fit 0–100)        Kanban board)
```

1. **Run the app.** One command, your browser is ready.
2. **Install the extension.** Browse any job site like you always do, and listings flow into your dashboard automatically.
3. **Review fit scores.** Generate tailored PDF + ATS-ready resumes for the jobs worth your time.
4. **Apply yourself.** Track everything in one place.

---

## Features

### 🔍 Capture From Where You Already Browse

Browse LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby and 100+ other boards. The extension captures listings silently as you go. No copy-pasting, and no server scraping: requests come from your own logged-in browser session, so boards that only render to a signed-in user still work.

### 🧹 Automatic Dedup

The same job cross-posted on 5 boards? You see it once. Duplicate detection runs automatically so you spend time on jobs, not noise.

### 🎯 AI Fit Scoring

Every captured job gets a 0–100 fit score with strengths and gap analysis. Works with OpenRouter, OpenAI, Anthropic, or **free local models via Ollama**: your choice, your keys, on your machine.

### 📄 Truthful Resume Tailoring

Your genuine experience, re-ranked and rephrased to match each job. Never invented employers, skills, or metrics. Outputs a polished PDF (via `jsonresume-theme-folio`) and an ATS-optimized plaintext version.

### 📋 Kanban Tracking

Track every application from Discovered → Applied → Interview → Offer. Each job gets paired artifacts (tailored resume + score) so you can see exactly what you sent.

### 🔒 100% Private, 100% Free

Everything runs on your machine. SQLite storage. Zero telemetry. Zero tracking. When using local models via Ollama, zero data ever leaves your computer; when using cloud LLMs, only necessary inference prompts are sent to your chosen provider. AGPL-3.0 forever.

---

## Supported Boards

| Category             | Examples                                                      |
| :------------------- | :------------------------------------------------------------ |
| **Modern ATS**       | Greenhouse, Lever, Ashby, Workable, SmartRecruiters, BambooHR |
| **Enterprise ATS**   | Workday, SuccessFactors, Taleo, iCIMS, Jobvite, Phenom        |
| **Major Job Boards** | LinkedIn, Indeed, Glassdoor, ZipRecruiter                     |
| **Niche & Remote**   | Wellfound, We Work Remotely, RemoteOK, Remotive, Hacker News  |
| **Regional & Feeds** | Regional job boards, RSS feeds, and aggregators               |

100+ board and ATS adapters ship with the extension. [Browse a sample](https://jobfoundry.covai.org/docs/providers/) or see the full registry with `npm run gen:provider-index` in the extension workspace. Missing a board? [Request it](https://github.com/Covai-Labs/JobFoundry/issues/new?template=provider_request.yml) or [add one yourself](extension/src/background/vendored/providers/ADDING_A_PROVIDER.md) (most adapters are under 100 lines).

---

<a id="quick-install"></a>

## Get Started

### 1. Run the App

One line, works on Linux, macOS, and Windows (WSL2):

```bash
curl -fsSL https://raw.githubusercontent.com/Covai-Labs/JobFoundry/main/install.sh | bash
```

> Auto-detects Docker or Podman, sets up `.env`, and launches the dashboard at `http://localhost:8080`.

Or clone and compose directly:

```bash
git clone https://github.com/Covai-Labs/JobFoundry.git && cd JobFoundry
docker compose up -d   # or: podman compose up -d
```

### 2. Add the Browser Extension

[Chrome / Brave](https://chromewebstore.google.com/detail/jobfoundry/kacfnebbiekbofdkgfpgmdcncgohhonm) · [Firefox](https://addons.mozilla.org/en-US/firefox/addon/jobfoundry/) · [Edge](https://microsoftedge.microsoft.com/addons/detail/ldnjhehiegnljjlmajlipldlhdkadnpe)

### 3. Upload Resume & Browse Jobs

Upload your master resume in the dashboard (`http://localhost:8080`), then browse job sites normally. Captured jobs appear on your Kanban board with instant match scores.

Full walkthrough: **[Quickstart Guide](https://jobfoundry.covai.org/docs/getting-started/)**

---

### Alternative: Linux Desktop App (No Docker)

On x86_64 Linux with glibc 2.39+ (e.g. Ubuntu 24.04+, Fedora 40+, Arch), download the `.AppImage` from [Releases](https://github.com/Covai-Labs/JobFoundry/releases), `chmod +x`, and run. It bundles the full stack, with no container runtime needed. On older distributions or ARM Linux, use Docker or Podman instead.

> Other desktop builds (Windows `.msix`, macOS Homebrew) are also on the [Releases](https://github.com/Covai-Labs/JobFoundry/releases) page.

---

### Self-Hosted Panels

Coolify, CapRover, and Dokploy templates are in the **[Self-Hosting Guide](docs/self-hosting.md)**.

---

## Use with AI Assistants (MCP)

JobFoundry includes a Model Context Protocol server to query your saved jobs, fit scores, and Kanban stages from Claude Desktop, Cursor, or any MCP-compatible tool. See [docs/mcp.md](docs/mcp.md).

---

## Contributing

Contributions welcome, especially new job board adapters (most are under 100 lines). Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [provider guide](extension/src/background/vendored/providers/ADDING_A_PROVIDER.md).

How the pieces fit together: [ARCHITECTURE.md](ARCHITECTURE.md) · [MANIFESTO.md](MANIFESTO.md) · [DEVELOPMENT.md](DEVELOPMENT.md)

---

## Supporting This Project

No VCs, no subscriptions, no ads, no data selling. Just one developer trying to help.

- ⭐ **[Star this repo](https://github.com/Covai-Labs/JobFoundry)**: takes 2 seconds, helps others find it.
- 🐛 **[Report bugs or give feedback](https://github.com/Covai-Labs/JobFoundry/issues)**: rough edges exist and every report helps.
- 💖 **[Sponsor on GitHub](https://github.com/sponsors/deadrat-in)**: fund testing infra and ongoing dev time.

---

## License

This software is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0-only)** with an additional **FOSS Linking Exception**.

See [LICENSE](LICENSE) for the full AGPL-3.0 license text and [FOSS-EXCEPTION.md](FOSS-EXCEPTION.md) for exception permissions and commercial licensing details.

---

## Acknowledgements

- Browser ATS provider adapters adapted from the MIT-licensed [career-ops](https://github.com/career-ops) provider collection. Original MIT headers are preserved in every ported file; see `extension/scripts/ports/README.md` for details.
- Job search aggregator adapters adapted from the MIT-licensed [JobSpy](https://github.com/speedyapply/JobSpy) project by Cullen Watson and contributors.
- PDF resume output powered by [JSON Resume](https://jsonresume.org/) and [`jsonresume-theme-folio`](https://github.com/cwonrails/jsonresume-theme-folio).
- Thanks to everyone who filed issues, tested providers, and shared feedback during the beta.
