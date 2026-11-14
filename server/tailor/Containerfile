# Node comes from the official image instead of a `curl | bash` installer.
# `resumed` declares engines.node >= 24, which Debian's nodejs package does not
# satisfy, and every theme except the folio exporters needs it.
FROM node:26-slim AS node

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Use system Chromium instead of bundled puppeteer Chromium (smaller image, no sandbox issues)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_PATH=/data/themes/node_modules:/usr/local/lib/node_modules

# Copying the directory (not individual files) keeps npm's symlink into
# /usr/local/lib/node_modules intact; copying the npm file alone dereferences
# it and breaks its relative requires.
COPY --from=node /usr/local/bin/ /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        # Chromium and its runtime deps for PDF rendering via puppeteer
        chromium chromium-sandbox \
        # Fonts for resume rendering
        fonts-liberation fonts-noto-color-emoji \
    # Exact versions so the render toolchain is reproducible, and
    # --ignore-scripts because no package here needs lifecycle hooks: Chromium
    # is the system one, and resumed/themes ship prebuilt.
    && npm install -g --ignore-scripts \
        puppeteer@25.17.0 \
        resumed@7.1.0 \
        jsonresume-theme-folio@1.3.1 \
        jsonresume-theme-folio-concise@1.3.0 \
        jsonresume-theme-stackoverflow@3.3.0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --no-cache-dir .

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /data /data/themes \
    && chown -R appuser:appuser /app /data

USER appuser

EXPOSE 8000

CMD ["python", "-m", "resume_ops_api"]
