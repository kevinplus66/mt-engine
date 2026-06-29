#!/usr/bin/env bash
set -euo pipefail

# Read-only curl smoke verifier for MT-Engine.
# Checks /health, /api/status, /api/home/media-wall, /api/auto-delete/status,
# /api/pilot/stats, and optionally /api/pilot/dry-run.
# Usage:
#   ./scripts/verify-deploy.sh [--base-url http://127.0.0.1:5050]
# Optional environment:
#   VERIFY_PILOT_DRY_RUN=1      Include /api/pilot/dry-run.
#   VERIFY_TIMEOUT_SECONDS=90   Health wait timeout.

BASE_URL="${VERIFY_BASE_URL:-http://127.0.0.1:5050}"
PILOT_DRY_RUN="${VERIFY_PILOT_DRY_RUN:-0}"
TIMEOUT_SECONDS="${VERIFY_TIMEOUT_SECONDS:-90}"

print_usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/verify-deploy.sh [options]

Options:
  --base-url URL       Base URL to verify (default: http://127.0.0.1:5050)
  --pilot-dry-run      Also check read-only /api/pilot/dry-run
  --timeout SECONDS    Seconds to wait for /health (default: 90)
  -h, --help           Show this help
USAGE
}

while (($#)); do
  case "$1" in
    --base-url)
      BASE_URL="${2:?--base-url requires a URL}"
      shift 2
      ;;
    --pilot-dry-run)
      PILOT_DRY_RUN=1
      shift
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:?--timeout requires seconds}"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      printf "Unknown verifier option: %s\n" "$1" >&2
      print_usage
      exit 2
      ;;
  esac
done

case "${TIMEOUT_SECONDS}" in
  ''|*[!0-9]*)
    printf "VERIFY_TIMEOUT_SECONDS/--timeout must be an integer number of seconds.\n" >&2
    exit 2
    ;;
esac

BASE_URL="${BASE_URL%/}"

curl_json() {
  local path="$1"
  curl -fsS --max-time 10 -H "Accept: application/json" "${BASE_URL}${path}" >/dev/null
}

printf "Waiting for MT-Engine health at %s\n" "${BASE_URL}"
deadline=$((SECONDS + TIMEOUT_SECONDS))
until curl_json "/health" >/dev/null 2>&1; do
  if ((SECONDS >= deadline)); then
    printf "MT-Engine deployment verification failed: /health did not become ready within %ss\n" "${TIMEOUT_SECONDS}" >&2
    exit 1
  fi
  sleep 2
done

paths=(
  "/api/status"
  "/api/home/media-wall"
  "/api/auto-delete/status"
  "/api/pilot/stats"
)

case "${PILOT_DRY_RUN}" in
  1|true|TRUE|yes|YES)
    paths+=("/api/pilot/dry-run")
    ;;
esac

for path in "${paths[@]}"; do
  printf "Checking %s\n" "${path}"
  curl_json "${path}"
done

printf "MT-Engine deployment verification passed\n"
