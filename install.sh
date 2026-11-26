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
  # Helpers: Privilege Escalation, OS Package Manager & Container Probing
  # ----------------------------------------------------------------------------
  PKG_MGR=""
  APT_UPDATED=false

  run_privileged() {
    if [ "${EUID:-$(id -u)}" -eq 0 ]; then
      "$@"
    elif command -v sudo >/dev/null 2>&1; then
      sudo "$@"
    elif command -v doas >/dev/null 2>&1; then
      doas "$@"
    else
      return 1
    fi
  }

  privileged_prefix() {
    if [ "${EUID:-$(id -u)}" -eq 0 ]; then
      echo ""
    elif command -v sudo >/dev/null 2>&1; then
      echo "sudo"
    elif command -v doas >/dev/null 2>&1; then
      echo "doas"
    else
      echo ""
    fi
  }

  detect_pkg_manager() {
    if [ "$OS" = "Darwin" ]; then
      if command -v brew >/dev/null 2>&1; then
        PKG_MGR="brew"
      fi
      return
    fi

    for mgr in apt-get dnf yum pacman zypper apk; do
      if command -v "$mgr" >/dev/null 2>&1; then
        PKG_MGR="$mgr"
        return
      fi
    done
  }

  install_pkgs() {
    case "$PKG_MGR" in
      apt-get)
        if [ "$APT_UPDATED" = false ]; then
          run_privileged env DEBIAN_FRONTEND=noninteractive apt-get update -qq || return 1
          APT_UPDATED=true
        fi
        run_privileged env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
        ;;
      dnf)
        run_privileged dnf install -y "$@"
        ;;
      yum)
        run_privileged yum install -y "$@"
        ;;
      pacman)
        run_privileged pacman -S --noconfirm --needed "$@"
        ;;
      zypper)
        run_privileged zypper --non-interactive install "$@"
        ;;
      apk)
        run_privileged apk add --no-cache "$@"
        ;;
      brew)
        brew install "$@"
        ;;
      *)
        return 1
        ;;
    esac
  }

  start_docker_service() {
    if command -v systemctl >/dev/null 2>&1; then
      run_privileged systemctl start docker >/dev/null 2>&1 && return 0
    fi
    if command -v service >/dev/null 2>&1; then
      run_privileged service docker start >/dev/null 2>&1 && return 0
    fi
    if command -v rc-service >/dev/null 2>&1; then
      run_privileged rc-service docker start >/dev/null 2>&1 && return 0
    fi
    return 1
  }

  probe_compose() {
    local prefix="${1:-}"
    COMPOSE_CMD=""
    ENGINE_NAME=""
    DOCKER_ENGINE_RESPONSIVE=false
    PODMAN_ENGINE_RESPONSIVE=false
    NERDCTL_ENGINE_RESPONSIVE=false

    # 1. Probe Docker
    if command -v docker >/dev/null 2>&1 && $prefix docker info >/dev/null 2>&1; then
      DOCKER_ENGINE_RESPONSIVE=true
      if $prefix docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="${prefix:+$prefix }docker compose"
        ENGINE_NAME="Docker (Compose v2)"
      elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_CMD="${prefix:+$prefix }docker-compose"
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
    if command -v nerdctl >/dev/null 2>&1 && $prefix nerdctl info >/dev/null 2>&1; then
      NERDCTL_ENGINE_RESPONSIVE=true
      if [ -z "$COMPOSE_CMD" ]; then
        if $prefix nerdctl compose version >/dev/null 2>&1 || $prefix nerdctl compose --help >/dev/null 2>&1; then
          COMPOSE_CMD="${prefix:+$prefix }nerdctl compose"
          ENGINE_NAME="containerd (nerdctl compose)"
        fi
      fi
    fi
  }

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

  detect_pkg_manager

  # Check & auto-install git
  if ! command -v git >/dev/null 2>&1; then
    echo -e "${YELLOW}▶ git not found; attempting to install git...${NC}"
    if install_pkgs git; then
      echo -e "  ${GREEN}✔ git installed${NC}"
    else
      echo -e "${RED}✖ git is not installed and automatic installation failed.${NC}"
      if [ "$OS" = "Darwin" ]; then
        echo "Please install Xcode Command Line Tools (xcode-select --install) or Homebrew (https://brew.sh), then re-run."
      else
        echo "Please install git using your system package manager and re-run."
      fi
      exit 1
    fi
  fi

  # Check & auto-install curl (required by healthcheck.sh and Docker installer)
  if ! command -v curl >/dev/null 2>&1; then
    echo -e "${YELLOW}▶ curl not found; attempting to install curl...${NC}"
    if install_pkgs curl; then
      echo -e "  ${GREEN}✔ curl installed${NC}"
    else
      echo -e "${RED}✖ curl is not installed and automatic installation failed.${NC}"
      echo "Please install curl using your system package manager and re-run."
      exit 1
    fi
  fi

  # Determine container compose command and engine
  probe_compose

  install_docker_compose() {
    case "$PKG_MGR" in
      apt-get|dnf|yum) install_pkgs docker-compose-plugin || install_pkgs docker-compose || true ;;
      pacman|zypper)   install_pkgs docker-compose || true ;;
      apk)             install_pkgs docker-cli-compose || install_pkgs docker-compose || true ;;
    esac
  }

  add_user_to_docker_group() {
    local current_user
    current_user="$(id -un 2>/dev/null || true)"
    if [ "${EUID:-$(id -u)}" -ne 0 ] && [ -n "$current_user" ] && command -v usermod >/dev/null 2>&1; then
      if run_privileged usermod -aG docker "$current_user" >/dev/null 2>&1; then
        echo -e "  ${YELLOW}Note: Added $current_user to the 'docker' group. Log out and back in (or run 'newgrp docker') for rootless CLI access.${NC}"
      fi
    fi
  }

  # Attempt automatic installation/startup of missing container runtime or compose plugin
  if [ -z "$COMPOSE_CMD" ]; then
    # Case A: Docker is running, but compose plugin/binary is missing
    if [ "$DOCKER_ENGINE_RESPONSIVE" = true ]; then
      echo -e "${YELLOW}▶ Docker is running, but Docker Compose is missing; attempting to install...${NC}"
      install_docker_compose
      probe_compose
    fi

    # Case B: Podman is running, but podman-compose is missing
    if [ -z "$COMPOSE_CMD" ] && [ "$PODMAN_ENGINE_RESPONSIVE" = true ]; then
      echo -e "${YELLOW}▶ Podman is running, but podman-compose is missing; attempting to install...${NC}"
      install_pkgs podman-compose || true
      probe_compose
    fi

    # Case C: Docker is installed, but daemon is stopped or socket lacks permissions
    if [ -z "$COMPOSE_CMD" ] && command -v docker >/dev/null 2>&1 && [ "$DOCKER_ENGINE_RESPONSIVE" = false ]; then
      DOCKER_INFO_ERR="$(docker info 2>&1 || true)"
      if echo "$DOCKER_INFO_ERR" | grep -qi "permission denied"; then
        PRIV_PREFIX="$(privileged_prefix)"
        if [ -n "$PRIV_PREFIX" ]; then
          echo -e "${YELLOW}▶ Current user lacks Docker socket permission; using $PRIV_PREFIX for this run...${NC}"
          add_user_to_docker_group
          probe_compose "$PRIV_PREFIX"
        fi
      elif [ "$OS" = "Linux" ]; then
        echo -e "${YELLOW}▶ Docker is installed but not running; attempting to start Docker service...${NC}"
        if start_docker_service; then
          probe_compose
          if [ -z "$COMPOSE_CMD" ]; then
            DOCKER_INFO_ERR="$(docker info 2>&1 || true)"
            if echo "$DOCKER_INFO_ERR" | grep -qi "permission denied"; then
              PRIV_PREFIX="$(privileged_prefix)"
              [ -n "$PRIV_PREFIX" ] && probe_compose "$PRIV_PREFIX"
            elif [ "$DOCKER_ENGINE_RESPONSIVE" = true ]; then
              install_docker_compose
              probe_compose
            fi
          fi
        fi
      fi
    fi

    # Case D: Podman is installed, but engine is stopped
    if [ -z "$COMPOSE_CMD" ] && command -v podman >/dev/null 2>&1 && [ "$PODMAN_ENGINE_RESPONSIVE" = false ]; then
      if [ "$OS" = "Darwin" ]; then
        echo -e "${YELLOW}▶ Starting Podman machine...${NC}"
        podman machine start >/dev/null 2>&1 || (podman machine init >/dev/null 2>&1 && podman machine start >/dev/null 2>&1) || true
      elif [ "$OS" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
        systemctl --user start podman.socket >/dev/null 2>&1 || run_privileged systemctl start podman >/dev/null 2>&1 || true
      fi
      probe_compose
    fi

    # Case E: No container runtime found at all — attempt install
    if [ -z "$COMPOSE_CMD" ] && ! command -v docker >/dev/null 2>&1 && ! command -v podman >/dev/null 2>&1 && ! command -v nerdctl >/dev/null 2>&1; then
      if [ "$OS" = "Linux" ]; then
        echo -e "${YELLOW}▶ No container runtime found; attempting to install Docker...${NC}"
        DOCKER_INSTALLED=false
        case "$PKG_MGR" in
          pacman)
            if install_pkgs docker docker-compose; then DOCKER_INSTALLED=true; fi
            ;;
          apk)
            if install_pkgs docker docker-cli-compose; then DOCKER_INSTALLED=true; fi
            ;;
          *)
            if command -v curl >/dev/null 2>&1; then
              if curl -fsSL --proto '=https' --tlsv1.2 https://get.docker.com | run_privileged sh; then
                DOCKER_INSTALLED=true
              fi
            fi
            ;;
        esac

        if [ "$DOCKER_INSTALLED" = true ]; then
          start_docker_service || true
          add_user_to_docker_group
          probe_compose
          if [ -z "$COMPOSE_CMD" ]; then
            DOCKER_INFO_ERR="$(docker info 2>&1 || true)"
            if echo "$DOCKER_INFO_ERR" | grep -qi "permission denied"; then
              PRIV_PREFIX="$(privileged_prefix)"
              [ -n "$PRIV_PREFIX" ] && probe_compose "$PRIV_PREFIX"
            fi
          fi
        fi
      elif [ "$OS" = "Darwin" ] && [ "$PKG_MGR" = "brew" ]; then
        echo -e "${YELLOW}▶ No container runtime found; attempting to install Podman via Homebrew...${NC}"
        if install_pkgs podman podman-compose; then
          podman machine init >/dev/null 2>&1 || true
          podman machine start >/dev/null 2>&1 || true
          probe_compose
        fi
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

