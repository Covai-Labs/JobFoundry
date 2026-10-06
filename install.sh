#!/usr/bin/env bash
# ==============================================================================
# JobFoundry - One-Line Installer & Setup Script
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Covai-Labs/JobFoundry/main/install.sh | bash
#   OR run locally: ./install.sh
# ==============================================================================

set -euo pipefail

# Colors
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${BLUE}${BOLD}"
echo "  ╔═════════════════════════════════════════════════════════════════╗"
echo "  ║                       JobFoundry Installer                      ║"
echo "  ║       Job Search → Scoring → Resume Tailoring → Dashboard       ║"
echo "  ╚═════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ------------------------------------------------------------------------------
# 1. Check Prerequisites
# ------------------------------------------------------------------------------
echo -e "${BLUE}▶ Checking system prerequisites...${NC}"

# Check git
if ! command -v git >/dev/null 2>&1; then
  echo -e "${RED}✖ git is not installed. Please install git and re-run.${NC}"
  exit 1
fi

# Determine container compose command and engine
COMPOSE_CMD=""
ENGINE_NAME=""
DOCKER_ENGINE_RESPONSIVE=false
PODMAN_ENGINE_RESPONSIVE=false

# 1. Probe Docker
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DOCKER_ENGINE_RESPONSIVE=true
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    ENGINE_NAME="Docker (Compose v2)"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
    ENGINE_NAME="Docker (docker-compose)"
  fi
fi

# 2. Probe Podman (if Docker compose was not selected)
if command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
  PODMAN_ENGINE_RESPONSIVE=true
  if [ -z "$COMPOSE_CMD" ]; then
    if podman compose version >/dev/null 2>&1; then
      COMPOSE_CMD="podman compose"
      ENGINE_NAME="Podman (podman compose)"
    elif command -v podman-compose >/dev/null 2>&1; then
      COMPOSE_CMD="podman-compose"
      ENGINE_NAME="Podman (podman-compose)"
    fi
  fi
fi

# 3. Probe nerdctl (if neither Docker nor Podman compose was selected)
if [ -z "$COMPOSE_CMD" ] && command -v nerdctl >/dev/null 2>&1 && nerdctl compose version >/dev/null 2>&1; then
  COMPOSE_CMD="nerdctl compose"
  ENGINE_NAME="containerd (nerdctl compose)"
fi

# If still no working compose command found, diagnose and provide actionable help
if [ -z "$COMPOSE_CMD" ]; then
  # Case A: Docker engine is running, but compose plugin/binary is missing
  if [ "$DOCKER_ENGINE_RESPONSIVE" = true ]; then
    echo -e "${YELLOW}✖ Docker engine is active, but neither 'docker compose' nor 'docker-compose' was found.${NC}"
    echo ""
    echo "Please install Docker Compose:"
    echo "  - Linux: sudo apt/dnf install docker-compose-plugin"
    echo "  - Or follow: https://docs.docker.com/compose/install/"
    echo "Then re-run this script."
    exit 1
  fi

  # Case B: Podman engine is running, but podman-compose is missing
  if [ "$PODMAN_ENGINE_RESPONSIVE" = true ]; then
    echo -e "${YELLOW}✖ Podman engine is active, but neither 'podman compose' nor 'podman-compose' was found.${NC}"
    echo ""
    echo "To install podman-compose:"
    echo "  - Fedora/RHEL: sudo dnf install podman-compose"
    echo "  - Ubuntu/Debian: sudo apt install podman-compose"
    echo "  - macOS (Homebrew): brew install podman-compose"
    echo "  - Or via pip: pip install podman-compose"
    echo "Then re-run this script."
    exit 1
  fi

  # Case C: Docker CLI is installed, but the engine/daemon is stopped
  if command -v docker >/dev/null 2>&1 && [ "$DOCKER_ENGINE_RESPONSIVE" = false ]; then
    echo -e "${YELLOW}✖ Docker is installed, but the Docker daemon is not responding.${NC}"
    echo ""
    echo "Please ensure the Docker daemon is running:"
    echo "  - Linux: sudo systemctl start docker"
    echo "  - macOS / Windows: Start Docker Desktop"
    echo "Then re-run this script."
    exit 1
  fi

  # Case D: Podman CLI is installed, but the engine is stopped
  if command -v podman >/dev/null 2>&1 && [ "$PODMAN_ENGINE_RESPONSIVE" = false ]; then
    echo -e "${YELLOW}✖ Podman is installed, but the Podman engine is not responding.${NC}"
    echo ""
    echo "Please ensure the Podman engine is running:"
    echo "  - macOS / Windows: podman machine start"
    echo "  - Linux: systemctl --user start podman.socket (or sudo systemctl start podman)"
    echo "Then re-run this script."
    exit 1
  fi

  # Case E: No container runtime found at all
  echo -e "${YELLOW}✖ No container runtime found (Docker, Podman, or nerdctl).${NC}"
  echo ""
  echo "JobFoundry runs as a local-first containerized stack (ingest, scorer, tailor, web)."
  echo "To install Docker on Linux, run:"
  echo -e "  ${BOLD}curl -fsSL https://get.docker.com | sh${NC}"
  echo ""
  echo "Or install Podman:"
  echo "  - Fedora: sudo dnf install podman podman-compose"
  echo "  - Ubuntu: sudo apt install podman podman-compose"
  echo "  - macOS: brew install podman podman-compose"
  echo ""
  echo "Once Docker or Podman is installed, please re-run this script."
  exit 1
fi

echo -e "  ${GREEN}✔ Found container orchestrator:${NC} $ENGINE_NAME ($COMPOSE_CMD)"

# ------------------------------------------------------------------------------
# 2. Determine Installation Directory
# ------------------------------------------------------------------------------
REPO_URL="https://github.com/Covai-Labs/JobFoundry.git"

if [ -f "compose.yaml" ] && [ -d "server" ]; then
  # Already in JobFoundry repository root
  TARGET_DIR="$(pwd)"
  echo -e "  ${GREEN}✔ Running from inside existing JobFoundry directory:${NC} $TARGET_DIR"
else
  # Running via curl | bash
  TARGET_DIR="${JOBFOUNDRY_DIR:-$HOME/.jobfoundry}"
  echo -e "${BLUE}▶ Installing JobFoundry to:${NC} $TARGET_DIR"
  if [ -d "$TARGET_DIR/.git" ]; then
    echo -e "  Found existing installation; pulling latest changes..."
    git -C "$TARGET_DIR" pull --ff-only || true
  else
    echo -e "  Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
  fi
  cd "$TARGET_DIR"
fi

# ------------------------------------------------------------------------------
# 3. Configure Environment (.env)
# ------------------------------------------------------------------------------
echo -e "${BLUE}▶ Configuring environment...${NC}"

if [ ! -f ".env" ]; then
  cp .env.example .env
  
  # Generate random 32-character API key
  RANDOM_KEY=$(LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 32 || true)
  if [ -n "$RANDOM_KEY" ]; then
    # Replace placeholder in .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/secret-api-key-1,secret-api-key-2/jf_${RANDOM_KEY}/g" .env
    else
      sed -i "s/secret-api-key-1,secret-api-key-2/jf_${RANDOM_KEY}/g" .env
    fi
  fi
  echo -e "  ${GREEN}✔ Created .env with generated API key${NC}"
else
  echo -e "  ${GREEN}✔ Existing .env preserved${NC}"
fi

# ------------------------------------------------------------------------------
# 4. Start Stack
# ------------------------------------------------------------------------------
echo -e "${BLUE}▶ Starting JobFoundry services...${NC}"
echo -e "  Checking for pre-built container images..."
if $COMPOSE_CMD pull 2>/dev/null; then
  echo -e "  ${GREEN}✔ Pre-built images pulled successfully!${NC}"
  $COMPOSE_CMD up -d
else
  echo -e "  Building containers from source (first run may take a few minutes)..."
  $COMPOSE_CMD up --build -d
fi


# ------------------------------------------------------------------------------
# 5. Run Healthcheck
# ------------------------------------------------------------------------------
echo -e "${BLUE}▶ Verifying services health...${NC}"

chmod +x scripts/healthcheck.sh
if ./scripts/healthcheck.sh; then
  echo -e "  ${GREEN}✔ All services started successfully!${NC}"
else
  echo -e "${YELLOW}⚠️  One or more services took longer than expected to report healthy.${NC}"
  echo "Check container logs using: $COMPOSE_CMD logs -f"
fi

# ------------------------------------------------------------------------------
# 6. Completion & Onboarding Instructions
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}═════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}             🎉 JobFoundry is running and ready!               ${NC}"
echo -e "${GREEN}${BOLD}═════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Web Dashboard:${NC}  http://localhost:8080"
echo -e "  ${BOLD}Ingest API:${NC}     http://localhost:8080/api/v1/jobs/ingest"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo "  1. Open your Dashboard: http://localhost:8080"
echo "  2. Install the Browser Extension:"
echo "     👉 Store listings & guide: https://jobfoundry.covai.org/docs/extension/"
echo "     Or load unpacked from: $TARGET_DIR/extension"
echo "  3. Configure your LLM API key in:"
echo -e "     ${BLUE}$TARGET_DIR/.env${NC}"
echo "     Then restart: $COMPOSE_CMD restart"
echo ""
echo -e "${BOLD}Support & Community:${NC}"
echo "  ⭐ Star on GitHub: https://github.com/Covai-Labs/JobFoundry"
echo "  💖 Sponsor ongoing development: https://github.com/sponsors/deadrat-in"
echo "  💬 Questions & Feedback: https://github.com/Covai-Labs/JobFoundry/discussions"
echo ""
echo -e "${BOLD}Useful Commands:${NC}"
echo "  View logs:    cd $TARGET_DIR && $COMPOSE_CMD logs -f"
echo "  Stop stack:   cd $TARGET_DIR && $COMPOSE_CMD down"
echo "  Restart:      cd $TARGET_DIR && $COMPOSE_CMD restart"
echo ""
echo "  Restart:      cd $TARGET_DIR && $COMPOSE_CMD restart"
echo ""

