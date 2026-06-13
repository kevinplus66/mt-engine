#!/usr/bin/env bash
set -euo pipefail

DEPLOY_REF="${DEPLOY_REF:-HEAD}"

print_usage() {
  {
    printf "Missing required deployment environment variable(s).\n"
    printf "Usage: NAS_HOST=<host> NAS_USER=<user> NAS_PATH=<path> [DEPLOY_REF=<ref>] %s\n" "$0"
    printf "Required variables: NAS_HOST, NAS_USER, NAS_PATH\n"
  } >&2
}

missing_required=()
for required_var in NAS_HOST NAS_USER NAS_PATH; do
  if [[ -z "${!required_var:-}" ]]; then
    missing_required+=("${required_var}")
  fi
done

if ((${#missing_required[@]})); then
  printf "Missing: %s\n" "${missing_required[*]}" >&2
  print_usage
  exit 2
fi

commit="$(git rev-parse --short "${DEPLOY_REF}")"
bundle="$(mktemp -t "mt-engine-${commit}.XXXXXX.bundle")"
remote_bundle="/tmp/mt-engine-${commit}.bundle"

cleanup() {
  rm -f "${bundle}"
}
trap cleanup EXIT

shell_quote() {
  local value="$1"
  printf "'"
  printf "%s" "${value}" | sed "s/'/'\\\\''/g"
  printf "'"
}

echo "Creating bundle for ${DEPLOY_REF} (${commit})"
git bundle create "${bundle}" "${DEPLOY_REF}"

echo "Uploading bundle to ${NAS_USER}@${NAS_HOST}:${remote_bundle}"
scp "${bundle}" "${NAS_USER}@${NAS_HOST}:${remote_bundle}"

echo "Deploying on NAS at ${NAS_PATH}"
quoted_nas_path="$(shell_quote "${NAS_PATH}")"
quoted_remote_bundle="$(shell_quote "${remote_bundle}")"
ssh "${NAS_USER}@${NAS_HOST}" \
  "NAS_PATH=${quoted_nas_path} REMOTE_BUNDLE=${quoted_remote_bundle} bash -s" <<'REMOTE'
   set -euo pipefail

   cleanup_remote() {
     rm -f "${REMOTE_BUNDLE}"
   }
   trap cleanup_remote EXIT

   case "${NAS_PATH}" in
     "~")
       NAS_PATH="${HOME}"
       ;;
     "~/"*)
       NAS_PATH="${HOME}/${NAS_PATH#\~/}"
       ;;
   esac

   cd "${NAS_PATH}"
   git fetch "${REMOTE_BUNDLE}" HEAD
   git switch main
   git merge --ff-only FETCH_HEAD
   export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
   docker compose up -d --build
   docker compose ps
   for attempt in $(seq 1 30); do
     if curl -sf http://localhost:5050/health >/tmp/mt-engine-health.json; then
       cat /tmp/mt-engine-health.json
       echo
       curl -sf http://localhost:5050/api/status
       echo
       exit 0
     fi
     sleep 2
   done
   echo "mt-engine health check did not pass in time" >&2
   docker compose logs --tail=120 mt-engine >&2
   exit 1
REMOTE

echo "NAS deployed ${commit}"
