#!/usr/bin/env bash
# ==============================================================================
# JobFoundry - One-Line Installer & Setup Script
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Covai-Labs/JobFoundry/main/install.sh | bash
#   OR run locally: ./install.sh
# ==============================================================================

# Wrap script in main function so that a truncated partial download (e.g. broken pipe)
# fails immediately with a syntax error instead of executing partial instructions.
main() {
  set -euo pipefail

  # Error trap for actionable troubleshooting feedback
  trap 'echo -e "\n${RED:-}✖ Installation aborted or failed unexpectedly.${NC:-}\nNeed help? Open an issue: https://github.com/Covai-Labs/JobFoundry/issues"' ERR

  # Colors (enabled only when stdout is a TTY and NO_COLOR is not set)
  if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    BOLD="\033[1m"
    GREEN="\033[0;32m"
    BLUE="\033[0;34m"
    YELLOW="\033[1;33m"
    RED="\033[0;31m"
    NC="\033[0m" # No Color
  else
    BOLD=""
    GREEN=""
    BLUE=""
    YELLOW=""
    RED=""
    NC=""
  fi

  # Parse CLI arguments
  case "${1:-}" in
    -h|--help)
      echo "JobFoundry Installer"
      echo ""
      echo "Usage:"
      echo "  curl -fsSL https://raw.githubusercontent.com/Covai-Labs/JobFoundry/main/install.sh | bash"
      echo "  OR run locally: ./install.sh [options]"
      echo ""
      echo "Options:"
      echo "  -h, --help       Show this help message and exit"
      echo ""
      echo "Environment Variables:"
      echo "  JOBFOUNDRY_DIR   Target installation directory (default: \$HOME/.jobfoundry or current directory)"
      echo "  NO_COLOR         Disable ANSI colored output"
      exit 0
      ;;
  esac

  echo -e "${BLUE}${BOLD}"
  echo "  ╔═════════════════════════════════════════════════════════════════╗"
  echo "  ║                       JobFoundry Installer                      ║"
  echo "  ║       Job Search → Scoring → Resume Tailoring → Dashboard       ║"
  echo "  ╚═════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # ----------------------------------------------------------------------------
  # 1. Check Prerequisites
  # ----------------------------------------------------------------------------
  echo -e "${BLUE}▶ Checking system prerequisites...${NC}"

  # Check Operating System
  OS="$(uname -s)"
  case "$OS" in
    Linux|Darwin) ;;
    *)
      echo -e "${RED}✖ Unsupported operating system: $OS${NC}"
      echo "JobFoundry requires Linux or macOS (Darwin)."
      echo "On Windows, please run within WSL2 (Windows Subsystem for Linux)."
      exit 1
      ;;
  esac

  # Check CPU Architecture
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64|arm64|aarch64) ;;
    *)
      echo -e "${RED}✖ Unsupported CPU architecture: $ARCH${NC}"
      echo "JobFoundry container images require x86_64 (amd64) or arm64 (aarch64)."
      exit 1
      ;;
  esac

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
  NERDCTL_ENGINE_RESPONSIVE=false

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
  if command -v nerdctl >/dev/null 2>&1 && nerdctl info >/dev/null 2>&1; then
    NERDCTL_ENGINE_RESPONSIVE=true
    if [ -z "$COMPOSE_CMD" ]; then
      if nerdctl compose version >/dev/null 2>&1 || nerdctl compose --help >/dev/null 2>&1; then
        COMPOSE_CMD="nerdctl compose"
        ENGINE_NAME="containerd (nerdctl compose)"
      fi
    fi
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

    # Case C: nerdctl engine is running, but nerdctl compose is missing
    if [ "$NERDCTL_ENGINE_RESPONSIVE" = true ]; then
      echo -e "${YELLOW}✖ containerd engine is active, but 'nerdctl compose' is not working or not installed.${NC}"
      echo ""
      echo "Please install or verify nerdctl compose support (buildkit and compose plugin)."
      echo "Then re-run this script."
      exit 1
    fi

    # Case D: Docker CLI is installed, but the engine is stopped or lacks permissions
    if command -v docker >/dev/null 2>&1 && [ "$DOCKER_ENGINE_RESPONSIVE" = false ]; then
      # Check if failure is due to socket permissions (common Linux non-root issue)
      if docker info 2>&1 | grep -qi "permission denied"; then
        echo -e "${YELLOW}✖ Docker daemon is active, but the current user cannot access the Docker socket.${NC}"
        echo ""
        echo "To grant permissions to your user without root:"
        echo "  sudo usermod -aG docker \$USER"
        echo "  newgrp docker"
        echo "Or re-run this script with sudo: sudo ./install.sh"
        exit 1
      fi

      echo -e "${YELLOW}✖ Docker is installed, but the Docker daemon is not responding.${NC}"
      echo ""
      echo "Please ensure the Docker daemon is running:"
      echo "  - Linux: sudo systemctl start docker"
      echo "  - macOS / Windows: Start Docker Desktop"
      echo "Then re-run this script."
      exit 1
    fi

    # Case E: Podman CLI is installed, but the engine is stopped
    if command -v podman >/dev/null 2>&1 && [ "$PODMAN_ENGINE_RESPONSIVE" = false ]; then
      echo -e "${YELLOW}✖ Podman is installed, but the Podman engine is not responding.${NC}"
      echo ""
      echo "Please ensure the Podman engine is running:"
      echo "  - macOS / Windows: podman machine start"
      echo "  - Linux: systemctl --user start podman.socket (or sudo systemctl start podman)"
      echo "Then re-run this script."
      exit 1
    fi

    # Case F: nerdctl CLI is installed, but containerd daemon is stopped
    if command -v nerdctl >/dev/null 2>&1 && [ "$NERDCTL_ENGINE_RESPONSIVE" = false ]; then
      echo -e "${YELLOW}✖ nerdctl is installed, but the containerd daemon is not responding.${NC}"
      echo ""
      echo "Please ensure containerd is running:"
      echo "  - Linux: sudo systemctl start containerd"
      echo "Then re-run this script."
      exit 1
    fi

    # Case G: No container runtime found at all
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

  # ----------------------------------------------------------------------------
  # 2. Determine Installation Directory
  # ----------------------------------------------------------------------------
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

  # ----------------------------------------------------------------------------
  # 3. Configure Environment (.env)
  # ----------------------------------------------------------------------------
  echo -e "${BLUE}▶ Configuring environment...${NC}"

  if [ ! -f ".env" ]; then
    cp .env.example .env

    # Generate random 32-character API key using sequential fallbacks
    RANDOM_KEY=""
    if command -v openssl >/dev/null 2>&1; then
      RANDOM_KEY="$(openssl rand -hex 16 2>/dev/null || true)"
    fi
    if [ -z "$RANDOM_KEY" ] && command -v python3 >/dev/null 2>&1; then
      RANDOM_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(16))' 2>/dev/null || true)"
    fi
    if [ -z "$RANDOM_KEY" ]; then
      RANDOM_KEY="$(LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom 2>/dev/null | head -c 32 || true)"
    fi

    if [ -z "$RANDOM_KEY" ]; then
      rm -f .env
      echo -e "${RED}✖ Failed to generate a secure random API key.${NC}"
      echo "Please set API_KEYS in .env manually before starting."
      exit 1
    fi

    # Replace placeholder in .env using temp file for universal sed compatibility (GNU/BSD)
    if ! sed "s/secret-api-key-1,secret-api-key-2/jf_${RANDOM_KEY}/g" .env > .env.tmp; then
      rm -f .env .env.tmp
      echo -e "${RED}✖ Failed to write API key to .env.${NC}"
      exit 1
    fi
    mv .env.tmp .env

    # Verify placeholder credentials were removed from active API_KEYS setting
    if grep -E -q '^[[:space:]]*API_KEYS=.*secret-api-key-[12]' .env; then
      rm -f .env
      echo -e "${RED}✖ Failed to replace placeholder API keys in .env.${NC}"
      exit 1
    fi

    echo -e "  ${GREEN}✔ Created .env with generated API key${NC}"
  else
    if grep -E -q '^[[:space:]]*API_KEYS=.*secret-api-key-[12]' .env; then
      echo -e "${RED}✖ Existing .env contains insecure template default credentials in API_KEYS (secret-api-key-1 or secret-api-key-2).${NC}"
      echo "Please replace API_KEYS in .env with a secure random key before starting."
      exit 1
    fi
    echo -e "  ${GREEN}✔ Existing .env preserved${NC}"
  fi

  # ----------------------------------------------------------------------------
  # 4. Start Stack
  # ----------------------------------------------------------------------------
  echo -e "${BLUE}▶ Starting JobFoundry services...${NC}"
  echo -e "  Checking for pre-built container images..."
  if $COMPOSE_CMD pull 2>/dev/null; then
    echo -e "  ${GREEN}✔ Pre-built images pulled successfully!${NC}"
    $COMPOSE_CMD up -d
  else
    echo -e "  Building containers from source (first run may take a few minutes)..."
    $COMPOSE_CMD up --build -d
  fi

  # ----------------------------------------------------------------------------
  # 5. Run Healthcheck
  # ----------------------------------------------------------------------------
  echo -e "${BLUE}▶ Verifying services health...${NC}"

  chmod +x scripts/healthcheck.sh
  if ./scripts/healthcheck.sh; then
    echo -e "  ${GREEN}✔ All services started successfully!${NC}"
  else
    echo -e "${YELLOW}⚠️  One or more services took longer than expected to report healthy.${NC}"
    echo "Check container logs using: $COMPOSE_CMD logs -f"
  fi

  # ----------------------------------------------------------------------------
  # 6. Completion & Onboarding Instructions
  # ----------------------------------------------------------------------------
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
}

main "$@"

