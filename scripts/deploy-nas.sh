#!/usr/bin/env bash
set -euo pipefail

# NAS deploy path: upload a git bundle, fast-forward the NAS checkout, start
# Docker Compose, then run read-only deployment checks. Set PREBUILT_IMAGE_ARCHIVE
# to upload/load a local docker-save archive and skip NAS-side builds.
# Usage:
#   NAS_HOST=<host> NAS_USER=<user> NAS_PATH=<path> [DEPLOY_REF=<ref>] ./scripts/deploy-nas.sh
# Optional environment:
#   PREBUILT_IMAGE_ARCHIVE=/path/mt-engine.tar[.gz]  Upload/load image and run compose without build.
#   MT_ENGINE_IMAGE=mt-engine:<tag>                  Image tag inside the archive (default: mt-engine:<commit>).
#   VERIFY_DEPLOY=0                                  Skip post-deploy verification.
#   VERIFY_PILOT_DRY_RUN=1                           Include read-only /api/pilot/dry-run check.

DEPLOY_REF="${DEPLOY_REF:-HEAD}"
PREBUILT_IMAGE_ARCHIVE="${PREBUILT_IMAGE_ARCHIVE:-}"
VERIFY_DEPLOY="${VERIFY_DEPLOY:-1}"
VERIFY_PILOT_DRY_RUN="${VERIFY_PILOT_DRY_RUN:-0}"

print_usage() {
  {
    printf "Missing required deployment environment variable(s).\n"
    printf "Usage: NAS_HOST=<host> NAS_USER=<user> NAS_PATH=<path> [DEPLOY_REF=<ref>] %s\n" "$0"
    printf "Required variables: NAS_HOST, NAS_USER, NAS_PATH\n"
    printf "Optional: PREBUILT_IMAGE_ARCHIVE=/path/image.tar[.gz], MT_ENGINE_IMAGE=mt-engine:<tag>, VERIFY_DEPLOY=0, VERIFY_PILOT_DRY_RUN=1\n"
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

if [[ -n "${PREBUILT_IMAGE_ARCHIVE}" && ! -f "${PREBUILT_IMAGE_ARCHIVE}" ]]; then
  printf "PREBUILT_IMAGE_ARCHIVE does not exist: %s\n" "${PREBUILT_IMAGE_ARCHIVE}" >&2
  exit 2
fi

commit="$(git rev-parse --short "${DEPLOY_REF}")"
MT_ENGINE_IMAGE="${MT_ENGINE_IMAGE:-mt-engine:${commit}}"
bundle="$(mktemp -t "mt-engine-${commit}.XXXXXX.bundle")"
remote_bundle="/tmp/mt-engine-${commit}.bundle"
remote_image_archive=""

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

printf "Creating bundle for %s (%s)\n" "${DEPLOY_REF}" "${commit}"
git bundle create "${bundle}" "${DEPLOY_REF}"

printf "Uploading bundle to %s@%s:%s\n" "${NAS_USER}" "${NAS_HOST}" "${remote_bundle}"
scp "${bundle}" "${NAS_USER}@${NAS_HOST}:${remote_bundle}"

if [[ -n "${PREBUILT_IMAGE_ARCHIVE}" ]]; then
  remote_image_archive="/tmp/mt-engine-${commit}.image.tar"
  case "${PREBUILT_IMAGE_ARCHIVE}" in
    *.gz|*.tgz)
      remote_image_archive="${remote_image_archive}.gz"
      ;;
  esac
  printf "Uploading prebuilt image to %s@%s:%s\n" "${NAS_USER}" "${NAS_HOST}" "${remote_image_archive}"
  scp "${PREBUILT_IMAGE_ARCHIVE}" "${NAS_USER}@${NAS_HOST}:${remote_image_archive}"
fi

printf "Deploying on NAS at %s\n" "${NAS_PATH}"
quoted_nas_path="$(shell_quote "${NAS_PATH}")"
quoted_remote_bundle="$(shell_quote "${remote_bundle}")"
quoted_remote_image_archive="$(shell_quote "${remote_image_archive}")"
quoted_mt_engine_image="$(shell_quote "${MT_ENGINE_IMAGE}")"
quoted_verify_deploy="$(shell_quote "${VERIFY_DEPLOY}")"
quoted_verify_pilot_dry_run="$(shell_quote "${VERIFY_PILOT_DRY_RUN}")"
ssh "${NAS_USER}@${NAS_HOST}" \
  "NAS_PATH=${quoted_nas_path} REMOTE_BUNDLE=${quoted_remote_bundle} REMOTE_IMAGE_ARCHIVE=${quoted_remote_image_archive} REMOTE_MT_ENGINE_IMAGE=${quoted_mt_engine_image} VERIFY_DEPLOY=${quoted_verify_deploy} VERIFY_PILOT_DRY_RUN=${quoted_verify_pilot_dry_run} bash -s" <<'REMOTE'
   set -euo pipefail

   cleanup_remote() {
     rm -f "${REMOTE_BUNDLE}"
     if [[ -n "${REMOTE_IMAGE_ARCHIVE}" ]]; then
       rm -f "${REMOTE_IMAGE_ARCHIVE}"
     fi
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

   if [[ -n "${REMOTE_IMAGE_ARCHIVE}" ]]; then
     printf "Loading prebuilt MT-Engine image on NAS\n"
     case "${REMOTE_IMAGE_ARCHIVE}" in
       *.gz|*.tgz)
         gzip -dc "${REMOTE_IMAGE_ARCHIVE}" | docker load
         ;;
       *)
         docker load -i "${REMOTE_IMAGE_ARCHIVE}"
         ;;
     esac
     export MT_ENGINE_IMAGE="${REMOTE_MT_ENGINE_IMAGE}"
     docker compose up -d --no-build
   else
     docker compose up -d --build
   fi
   docker compose ps

   if [[ "${VERIFY_DEPLOY}" != "0" ]]; then
     export VERIFY_PILOT_DRY_RUN
     bash ./scripts/verify-deploy.sh --base-url "http://127.0.0.1:5050"
   else
     printf "Skipping deployment verification because VERIFY_DEPLOY=0\n"
   fi
REMOTE

printf "NAS deployed %s\n" "${commit}"
