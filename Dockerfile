# ==============================================================================
# JobFoundry - All-in-One (AIO) Container
# Packages: React Web Dashboard + Fastify Ingest + Scorer Worker + Resume Tailor
# ==============================================================================

# --- Stage 0: Node Base Image ---
FROM node:26-slim AS node

# --- Stage 1: Build React Web SPA ---
FROM node:26-slim AS web-builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/web/package.json ./server/web/
RUN npm ci --workspace=server/web

COPY server/web/ ./server/web/
ENV VITE_API_URL=""
RUN npm --workspace=server/web run build

# --- Stage 2: Install Node Ingest Dependencies ---
FROM node:26-bookworm-slim AS ingest-builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/ingest/package.json ./server/ingest/
RUN npm ci --omit=dev --workspace=server/ingest


# --- Stage 3: Final All-in-One Runtime ---
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PATH="/opt/node-tools/node_modules/.bin:${PATH}" \
    NODE_PATH=/data/themes/node_modules:/opt/node-tools/node_modules:/usr/local/lib/node_modules:/app/node_modules \
    PORT=8080 \
    DATA_DIR=/data \
    DB_PATH=/data/jobfoundry.db \
    ARTIFACTS_DIR=/data/artifacts \
    MASTER_RESUME_PATH=/data/master-resume.json \
    SCORER_MODEL=openrouter/google/gemini-2.0-flash-exp:free \
    SCORER_PROVIDER=openrouter \
    SCORER_THRESHOLD=75 \
    TAILOR_MODEL=openrouter/google/gemini-2.0-flash-exp:free \
    ALLOWED_THEMES='["jsonresume-theme-folio","jsonresume-theme-folio-concise","jsonresume-theme-stackoverflow","jsonresume-theme-pro","jsonresume-theme-harvard-classic","jsonresume-theme-jake-technical","jsonresume-theme-awesome-professional","jsonresume-theme-compact-developer","jsonresume-theme-charter-serif","jsonresume-theme-diplomat-cv","jsonresume-theme-ledger-professional","jsonresume-theme-stewardship-cv","jsonresume-theme-europass-inspired","jsonresume-theme-first-role","jsonresume-theme-academic-classic"]' \
    TAILOR_TIMEOUT_SECONDS=900 \
    TAILOR_TIMEOUT_MS=1800000 \
    LLM_REQUEST_TIMEOUT=600 \
    OPENROUTER_API_BASE="" \
    OPENAI_API_BASE="" \
    OPENAI_BASE_URL="" \
    SCORER_API_BASE="" \
    OPENAI_API_KEY="" \
    OPENROUTER_API_KEY="" \
    LLM_RATE_LIMIT_REQUESTS=20 \
    LLM_RATE_LIMIT_PERIOD=60 \
    LLM_MAX_RETRIES=25 \
    LLM_RETRY_MIN_WAIT_SECONDS=5 \
    LLM_RETRY_MAX_WAIT_SECONDS=120 \
    LLM_RETRY_MULTIPLIER=3 \
    API_KEYS=""

# 1. Copy Node runtime from official Node image
COPY --from=node /usr/local/bin/ /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules

# 2. Install system utilities, Chromium, and Supervisor
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates supervisor \
        chromium chromium-sandbox \
        fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# 3. Install PDF and resume export toolchain with pinned lockfile
COPY packaging/node-tools/package.json packaging/node-tools/package-lock.json /opt/node-tools/
RUN cd /opt/node-tools \
    && npm ci --omit=dev --ignore-scripts \
    && ln -s /opt/node-tools/node_modules/.bin/* /usr/local/bin/

# 4. Install uv for fast Python dependency installation
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# 5. Install Python dependencies for Scorer and Tailor
COPY server/scorer/pyproject.toml server/scorer/uv.lock ./server/scorer/
RUN cd server/scorer && uv pip install --system --no-cache -r pyproject.toml

COPY server/tailor/pyproject.toml server/tailor/uv.lock server/tailor/README.md ./server/tailor/
COPY server/tailor/src ./server/tailor/src
RUN cd server/tailor && uv pip install --system --no-cache -e .

# 6. Copy Ingest Server and node_modules
COPY --from=ingest-builder /app/node_modules ./node_modules
COPY server/ingest/ ./server/ingest/


# 7. Copy Scorer Source
COPY server/scorer/src/ ./server/scorer/src/

# 8. Copy Pre-built Web SPA
COPY --from=web-builder /app/server/web/dist ./server/web/dist

# 9. Configure Supervisor & Data Directories
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN mkdir -p /data /data/artifacts /data/themes

VOLUME ["/data"]

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
