#!/usr/bin/env bash
# Regenerate the pinned Python requirement sets under packaging/python/.
#
# These files are compiled lockfiles, not hand-edited manifests: the AppImage
# and Windows builds install from them, so the pins are what actually ships.
# Regenerate after touching server/{scorer,tailor}/pyproject.toml, or let
# Renovate do it (its pip-compile manager re-runs the command in the header).
#
# Two non-obvious details about the command recorded in the header:
#
#   --upgrade
#       `uv pip compile` keeps the versions already pinned in the output file,
#       so a plain re-run is a no-op and can never detect drift.
#
#   --custom-compile-command
#       uv records the command it was invoked with in the file header, and
#       Renovate's pip-compile manager re-executes that header verbatim. So the
#       header must stay free of --upgrade (which Renovate rejects), must use
#       --output-file= rather than -o, and every option that takes a value must
#       use the = form (Renovate rejects `--python-version 3.14`).
#
# Usage:
#   scripts/regen-packaging-requirements.sh          # rewrite in place with --upgrade
#   scripts/regen-packaging-requirements.sh --check  # exit 1 if stale without modifying repo (CI)
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHON_VERSION=3.14
# CI pins this version and compares the regenerated files byte-for-byte, so a
# different resolver locally shows up as spurious drift. Keep in sync with the
# `python` job in .github/workflows/ci.yml.
UV_VERSION=0.12.24
SOURCES=(
  "server/scorer/pyproject.toml:packaging/python/scorer-requirements.txt"
  "server/tailor/pyproject.toml:packaging/python/tailor-requirements.txt"
)

command -v uv >/dev/null || {
  echo "uv is required: https://docs.astral.sh/uv/" >&2
  exit 1
}

uv_version="$(uv --version | awk '{print $2}')"
if [[ "${uv_version}" != "${UV_VERSION}" ]]; then
  echo "warning: uv ${uv_version} is installed but CI pins ${UV_VERSION}; the byte comparison may fail on resolver changes" >&2
fi

check=false
[[ "${1:-}" == "--check" ]] && check=true

if [[ "$check" == true ]]; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' EXIT

  status=0
  for entry in "${SOURCES[@]}"; do
    source="${entry%%:*}"
    target="${entry##*:}"
    filename="$(basename "${target}")"
    compiled="${tmp_dir}/${filename}"

    # Seed the temporary compile target with the committed lockfile so uv
    # retains existing pins and only updates if constraints cannot be satisfied.
    cp "${target}" "${compiled}"

    canonical="uv pip compile --python-version=${PYTHON_VERSION} --universal ${source} --output-file=${target}"

    uv pip compile --python-version="${PYTHON_VERSION}" --universal "${source}" \
      --custom-compile-command "${canonical}" \
      --output-file "${compiled}" >/dev/null

    if ! diff -q "${target}" "${compiled}" >/dev/null; then
      echo "Stale: ${target}" >&2
      diff -u "${target}" "${compiled}" >&2 || true
      status=1
    fi
  done

  if ((status != 0)); then
    echo >&2
    echo "packaging/python is out of date. Run scripts/regen-packaging-requirements.sh and commit the result." >&2
    exit 1
  fi
  echo "packaging/python is up to date."
else
  for entry in "${SOURCES[@]}"; do
    source="${entry%%:*}"
    output="${entry##*:}"

    canonical="uv pip compile --python-version=${PYTHON_VERSION} --universal ${source} --output-file=${output}"

    uv pip compile --python-version="${PYTHON_VERSION}" --universal "${source}" \
      --upgrade \
      --custom-compile-command "${canonical}" \
      --output-file "${output}" >/dev/null
  done
  echo "packaging/python regenerated successfully."
fi
