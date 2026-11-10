# Deployment templates

Ready-to-use templates for self-hosted panels. The full walkthrough, security
notes, backup/restore commands, and submission status live in
[docs/self-hosting.md](../docs/self-hosting.md).

| Panel    | File                         | How to use                                                     |
| :------- | :--------------------------- | :------------------------------------------------------------- |
| Coolify  | `coolify/jobfoundry.yaml`    | Create a **Docker Compose Empty** service and paste this file. |
| CapRover | `caprover/jobfoundry.yml`    | Paste into **Apps → One-Click Apps/Databases → TEMPLATE**.     |
| Dokploy  | `dokploy/docker-compose.yml` | Create a **Compose** service and paste this file.              |

`deploy/dokploy/` also contains the `template.toml`, `meta.json`, and logo
needed for a Dokploy template-catalog submission. `deploy/coolify/` includes the
logo expected by Coolify's service-template layout.

Every template:

- uses the all-in-one image at `ghcr.io/covai-labs/jobfoundry`;
- mounts a named volume at `/data` for the SQLite database, artifacts, master
  resume, and themes;
- uses a health check that fails if `GET /health` stops returning success
  (declared in Compose, or the image's built-in `HEALTHCHECK` for CapRover);
- leaves LLM provider keys optional so they can be added in the dashboard.

The templates intentionally do not publish port 8080 on the host. Let the
platform's reverse proxy handle TLS and routing, and keep `TRUST_PROXY=true`
only while the container is reachable exclusively through that proxy.
