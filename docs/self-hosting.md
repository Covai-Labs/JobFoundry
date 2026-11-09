# Self-hosting JobFoundry

This guide covers deploying the all-in-one JobFoundry container on a VPS or
home server, including one-paste templates for **Coolify**, **CapRover**, and
**Dokploy**. The templates are in [`deploy/`](../deploy/).

If you only want the quickest local install, use the root
[`compose.yaml`](../compose.yaml) and the one-line installer in the
[README](../README.md#quick-install). This page is for a long-running,
internet-facing instance.

## What gets deployed

JobFoundry ships as one container:

| Component               | Purpose                                                        |
| :---------------------- | :------------------------------------------------------------- |
| Web dashboard           | React SPA at `/`                                               |
| Ingest API              | Capture, dedup, auth, jobs, exports                            |
| Fit scorer              | LLM scoring worker                                             |
| Resume tailor           | LangGraph tailoring pipeline and PDF export                    |
| Supervisor              | Starts and monitors the processes inside the container         |

The container listens on **port 8080** and exposes `GET /health`.

### Persistent data

Everything stateful lives under **`/data`**:

```text
/data/
├── jobfoundry.db       # SQLite database (users, jobs, scores, settings)
├── artifacts/          # tailored resumes, PDFs, ATS text, exports
├── master-resume.json  # uploaded master resume
└── themes/             # installed resume themes
```

The templates mount a named volume at `/data`. Back up that **whole volume**,
not just `jobfoundry.db`; otherwise tailored artifacts will not survive a
restore.

## Before you start

- A Linux host with Docker (or a panel that manages Docker for you).
- A domain name if the instance will be reachable from the internet.
- Ports 80/443 available to the panel's reverse proxy.
- At least **2 GB RAM** and **2 GB free disk** for the image, Chromium, SQLite,
  and generated artifacts. Give it more if you tailor many resumes.
- An LLM API key if you want fit scoring and resume tailoring. Job capture works
  without one. Keys can be added later in **Settings → LLM Provider**.

Do **not** publish container port 8080 directly to the internet. Put the
platform's TLS-terminating proxy in front of it.

## Security: the first account is the admin

JobFoundry has no pre-seeded password. The first account registered on a fresh
database becomes the administrator.

1. Deploy the stack.
2. Open the dashboard and register your account **immediately**.
3. Add your LLM provider key in **Settings**.
4. Set `REGISTRATION_MODE=disabled` in the platform's environment settings and
   redeploy. This blocks all future sign-ups while leaving existing logins
   working.

Until you lock registration, anyone who can reach the dashboard can create the
first account and become admin. Do not leave a public instance unattended with
`REGISTRATION_MODE=open`. If deploying directly to a public host, you can also
pre-set `API_KEYS` in your environment to enforce API key authentication, or keep
port 8080 restricted to loopback/VPN until your account is initialized.

`TRUST_PROXY=true` is correct when the container is only reachable through the
panel's reverse proxy. If you publish the port directly, set `TRUST_PROXY` to
the proxy's IP/CIDR list instead, or leave it empty.

## Coolify

Coolify support is a **manual Docker Compose fallback**, not an official Coolify
catalog listing. Coolify's service catalog requires the upstream repository to
have at least 1,000 GitHub stars, and external template contributions are
currently paused. JobFoundry does not meet that threshold yet.

The template is still formatted like a Coolify service template, including the
metadata comments and magic `SERVICE_URL_JOBFOUNDRY_8080` variable, so it can be
pasted into **Docker Compose Empty** today and submitted later if the
requirements change.

1. In Coolify, create or open a project and environment.
2. Choose **Create New Resource → Docker Compose Empty**.
3. Paste [`deploy/coolify/jobfoundry.yaml`](../deploy/coolify/jobfoundry.yaml).
4. Set any optional variables:
   - `JOBFOUNDRY_VERSION` (default `latest`; pin a release tag for stability)
   - `REGISTRATION_MODE` (leave `open` only until you create your account)
   - `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or
     `GEMINI_API_KEY` if you prefer environment keys over the dashboard
5. Save, then set the domain/URL for the `jobfoundry` component to container
   port **8080**. Coolify's `SERVICE_URL_JOBFOUNDRY_8080` entry handles the
   proxy URL.
6. Deploy and watch the logs. The first start can take 30–60 seconds while
   Chromium and the workers come up.
7. Open the generated URL, register your admin account, then set
   `REGISTRATION_MODE=disabled` and redeploy.

The named volume `jobfoundry-data` is managed by Coolify and appears under
**Persistent Storages**. Edit the Compose source if you need a different mount;
Coolify's storage view is read-only for Service components.

> Coolify's official one-click service catalog currently requires a service
> repository with at least 1,000 GitHub stars. The template in `deploy/coolify/`
> is ready for **Docker Compose Empty** today and for a future catalog
> submission when that requirement is met.

## CapRover

CapRover's one-click format only parses a subset of Compose. The template uses
only the supported fields; the image's built-in `HEALTHCHECK` is what
CapRover/Docker Swarm uses for health, and CapRover handles container restarts.

1. Open **Apps → One-Click Apps/Databases**.
2. Scroll to the bottom, choose **TEMPLATE**, and paste
   [`deploy/caprover/jobfoundry.yml`](../deploy/caprover/jobfoundry.yml).
3. Choose the image tag. `latest` tracks main; a release tag such as `v0.5.1`
   gives reproducible upgrades.
4. Deploy the app.
5. In the app's **HTTP Settings**, enable HTTPS and **Force HTTPS**.
6. Open the dashboard, register the first account, and add your LLM key.
7. In **App Configs → Environmental Variables**, set
   `REGISTRATION_MODE=disabled`, then redeploy.
8. Back up the app's persistent `/data` volume. CapRover configuration backups
   do **not** include application data.

If the first request returns a 502, wait for the image to finish starting and
check the app logs. The container needs a little time to initialize Chromium and
the Python workers before `/health` succeeds.

## Dokploy

### Manual Compose deployment

1. Create a project and add a **Compose** service.
2. Paste [`deploy/dokploy/docker-compose.yml`](../deploy/dokploy/docker-compose.yml).
3. In the **Environment** tab, set any optional values:
   - `JOBFOUNDRY_VERSION`
   - `REGISTRATION_MODE`
   - `SERVER_URL=https://your-domain.example`
   - provider keys, if not using the dashboard
4. Add a domain for the `jobfoundry` service on container port **8080**.
5. Deploy.
6. Register the first account, add the LLM key, then set
   `REGISTRATION_MODE=disabled` and redeploy.

The `jobfoundry-data` named volume is visible in Dokploy and can be backed up
with **Volume Backups**. Named volumes are required for Dokploy's automated
backup feature; bind mounts under `../files` are not backed up the same way.

### Template-catalog submission

`deploy/dokploy/` is a self-contained Dokploy blueprint:

```text
deploy/dokploy/
├── docker-compose.yml
├── template.toml
├── meta.json
└── jobfoundry.svg
```

To submit it to [Dokploy/templates](https://github.com/Dokploy/templates), copy
that directory to `blueprints/jobfoundry/` in a fork, regenerate the catalog
metadata with the repository's scripts, and open a PR. Pin
`JOBFOUNDRY_VERSION` and `meta.json.version` to a release tag if the reviewers
require reproducible image versions.

## Generic Docker Compose

For a plain Docker/Podman host without a panel:

```bash
git clone https://github.com/Covai-Labs/JobFoundry.git
cd JobFoundry
cp .env.example .env
# edit .env: set API_KEYS, LLM keys, and any optional settings
docker compose up -d
./scripts/healthcheck.sh
```

Open `http://localhost:8080`.

> [!IMPORTANT]
> When deploying on a public VPS behind a TLS reverse proxy (Caddy, Nginx, Traefik),
> do not expose unencrypted port 8080 publicly. Bind it to localhost by adding a
> `compose.override.yaml` (or setting firewall rules to block external access to port 8080):
>
> ```yaml
> # compose.override.yaml
> services:
>   jobfoundry:
>     ports:
>       - "127.0.0.1:8080:8080"
> ```
>
> Ensure `TRUST_PROXY=true` is set in your `.env` so JobFoundry detects the client's
> HTTPS protocol and public hostname from the proxy headers.

The complete environment reference is [`.env.example`](../.env.example). The
root `compose.yaml` also works with Podman:

```bash
podman compose up -d
```

## Updating

Back up the `/data` volume first, then pull the image:

```bash
docker compose pull
docker compose up -d
```

On a panel, use its **Pull latest image / Redeploy** action instead. If you pin
a release tag, change the tag deliberately and read the
[changelog](https://github.com/Covai-Labs/JobFoundry/blob/main/CHANGELOG.md)
before upgrading.

## Backups and restore

The exact volume name differs by platform. Find it with:

```bash
docker volume ls | grep -i jobfoundry
```

Back up a volume to a tarball. Stop or pause the container briefly before taking the
backup to ensure SQLite checkpoints its WAL log and writes finish cleanly:

```bash
VOLUME=jobfoundry-data   # replace with the real name

# Stop the container briefly to prevent partial writes
docker compose stop jobfoundry  # or stop/pause the service in your panel

docker run --rm \
  -v "$VOLUME":/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/jobfoundry-data-$(date +%F).tgz -C /data .

# Restart the container
docker compose start jobfoundry
```

Stop the app before restoring, then extract into a fresh volume:

```bash
docker run --rm \
  -v "$VOLUME":/data \
  -v "$PWD":/backup \
  alpine sh -c 'rm -rf /data/* && tar xzf /backup/jobfoundry-data-YYYY-MM-DD.tgz -C /data'
```

Start the app and verify the dashboard, job list, and a tailored artifact after
the restore.

## Troubleshooting

| Symptom | Check |
| :--- | :--- |
| `502` or connection refused right after deploy | Wait 30–60 seconds; inspect container logs; confirm the proxy targets port **8080**. |
| Health check stays unhealthy | Run `docker logs <container>`; verify `/data` is writable and the volume is mounted. |
| Registration says closed | Set `REGISTRATION_MODE=open`, redeploy, create the account, then set it back to `disabled`. |
| `401` after signing in | Log in again; API clients need the user API key from Settings, not the dashboard session. |
| Scoring/tailoring fails | Add an LLM provider key in **Settings → LLM Provider**; check the provider's balance and model name. |
| PDF export fails | Confirm the container has enough memory/disk and that `/data/artifacts` is on the persistent volume. |
| Data disappears after redeploy | The service is not mounting a volume at `/data`; fix the mount before generating more artifacts. |

## Catalog submissions

The templates are ready to submit, but this repository does not submit them
automatically. Status:

- **CapRover**: submit `deploy/caprover/jobfoundry.yml` and the logo to
  [caprover/one-click-apps](https://github.com/caprover/one-click-apps) under
  `public/v4/apps/` and its logos directory.
- **Dokploy**: submit the `deploy/dokploy/` blueprint to
  [Dokploy/templates](https://github.com/Dokploy/templates) under
  `blueprints/jobfoundry/`.
- **Coolify**: external service-template contributions are currently paused,
  and the upstream repository must have at least 1,000 GitHub stars. Revisit
  when those requirements change.
- **awesome-selfhosted**: proposed entry for the Productivity section:

  ```markdown
  - [JobFoundry](https://github.com/Covai-Labs/JobFoundry) - Local-first job-search pipeline with browser capture, deduplication, LLM fit scoring, and truthful resume tailoring. ([Source Code](https://github.com/Covai-Labs/JobFoundry)) `AGPL-3.0` `Docker`
  ```

  Open a PR against
  [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)
  after the deployment templates have been exercised on a real instance.
