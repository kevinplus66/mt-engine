# MT-Engine Deployment Guide (AI Agent Edition)

This document is for an AI agent assisting a user in deploying MT-Engine on a NAS or Linux host. It is a manual skill for the agent to execute: confirm the environment and risks first, then deploy, then verify with read-only endpoints.

## Agent Execution Principles

- First confirm the target host, install path, repository source, whether the NAS can pull Docker Hub base images, and whether the user already has a previous deployment.
- Do not delete `.env`, `data/`, the download directory, or qBittorrent data by default.
- Do not click or call any side-effecting action during verification: download, save config, pause, resume, delete, cleanup, manually trigger download, manually trigger cleanup, or toggle switches.
- After deployment, prefer `scripts/verify-deploy.sh`; it checks only `/health`, `/api/status`, `/api/home/media-wall`, `/api/auto-delete/status`, `/api/pilot/stats`, and optionally `/api/pilot/dry-run`.
- If the user uses PILOT auto-download, confirm that auto-delete is enabled, qBittorrent is reachable, the PILOT loop is healthy, `/downloads` is mounted, and the dry-run disk budget is sane.
- If the deploy script, `docker compose`, or a health check fails, stop and report the error — do not attempt to reset the repository or clean up user data.
- Compose binds to `0.0.0.0:5050` by default, supports `MT_ENGINE_IMAGE` for prebuilt images, and is intended for trusted LAN access unless external authentication or a reverse proxy protects public access.

## Pre-Deployment Confirmation

Confirm with the user:

```text
NAS / host IP:
SSH username:
SSH password or key available:
Repository URL (default https://github.com/kevinplus66/mt-engine.git, replaceable with the user's fork):
Install path (e.g. ~/mt-engine or /volume1/docker/mt-engine):
Whether a previous version is already deployed:
Whether to enable PILOT auto-download / auto-cleanup:
Whether to keep the existing .env, data, and download directory:
Whether LAN or public access is needed; if so, what is the auth or reverse-proxy plan:
Whether the NAS can pull Docker Hub base images or needs offline image loading:
```

If repository access requires authentication, also confirm a GitHub Token or SSH key with the user. Do not retain the Token in the chat log long-term.

## Collecting Application Config

Have the user fill in the following `.env` template:

```env
PUID=1000
PGID=1000
MT_ENGINE_COMMIT=
MT_ENGINE_BIND_HOST=0.0.0.0

MT_TOKEN=
MT_TOKEN_FILE=
MT_USER_ID=
MT_SITE_URL=https://kp.m-team.cc

REFRESH_INTERVAL=300
FREE_REFRESH_FAILURE_BACKOFF_SECONDS=1800
PANEL_COLLECT_INTERVAL=60
MEDIA_WALL_REFRESH_INTERVAL=21600
MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS=1800
MEDIA_WALL_STARTUP_DELAY=420
MEDIA_WALL_METADATA_TTL=604800
MEDIA_WALL_MAX_METADATA_FETCHES=40
MEDIA_WALL_DOUBAN_POSTER_FETCHES=3
API_DELAY=3
DEBUG=false

PUSHPLUS_TOKEN=
PUSHPLUS_TOKEN_FILE=

QBITTORRENT_URL=http://<QB_HOST_IP>:8080
QBITTORRENT_USER=
QBITTORRENT_PASSWORD=
QBITTORRENT_PASSWORD_FILE=
DOWNLOADS_PATH=/volume1/downloads
PILOT_SAVE_PATH=/downloads/mt_free_farm
```

Notes:

- `MT_TOKEN` is required; get it from the M-Team control panel / Lab / Access Token. `MT_TOKEN_FILE` can point at a mounted secret file instead; a directly set `MT_TOKEN` wins.
- `MT_ENGINE_BIND_HOST` defaults to `0.0.0.0`, suitable for direct LAN access on a NAS; if the user explicitly wants host-only access, set it to `127.0.0.1`.
- Public exposure needs external authentication or a reverse proxy; protect or rate-limit heavy qB listing/status calls.
- `MT_USER_ID` is optional, used to show user seeding/download status.
- `REFRESH_INTERVAL=300` is the current production steady-state value; do not set it below `300`, and if the user already has a longer interval, do not shorten it.
- `API_DELAY` must stay at `3` or higher; below `3` tends to trigger M-Team's dynamic rate limiting.
- `PANEL_COLLECT_INTERVAL` defaults to `60` seconds, controlling PANEL history collection frequency.
- `FREE_REFRESH_FAILURE_BACKOFF_SECONDS` defaults to `1800` seconds; on a FREE refresh failure it keeps the old cache and retries after cooldown. `_2X_FREE` can be included in rules/scoring when desired.
- `MEDIA_WALL_REFRESH_INTERVAL` defaults to `21600` seconds (6 hours), do not set it below `21600`; this is the per-source refresh interval, and `latest / movies / series / hot` rotate on a stagger, refreshing roughly one source every 90 minutes by default.
- `MEDIA_WALL_STARTUP_DELAY` defaults to `420` seconds, used to stagger away from SONAR's first refresh after container start.
- `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` defaults to `1800` seconds; on a media-wall source refresh failure it keeps the old cache and retries after cooldown.
- `MEDIA_WALL_DOUBAN_POSTER_FETCHES` defaults to `3`, reading Douban subject pages at low frequency only when M-Team metadata lacks a poster; do not raise it to a large value just to chase full poster coverage.
- `DEBUG` stays `false` for production deployments.
- In a Docker environment, `QBITTORRENT_URL` must use the NAS or host's LAN IP, not `localhost`.
- qBittorrent 4.6.7 is known-good; qBittorrent 5 is supported by the compatibility layer. Recommend a pinned qB image tag on NAS until the user intentionally upgrades.
- If configuring qBittorrent, use the user's own Web UI username and password; do not reuse an empty password, a default password, or a temporary setup password. `QBITTORRENT_PASSWORD_FILE` can point at a mounted secret file instead; a direct `QBITTORRENT_PASSWORD` wins.
- `PUSHPLUS_TOKEN_FILE` can point at a mounted PushPlus token file; a direct `PUSHPLUS_TOKEN` wins.
- `DOWNLOADS_PATH` is a host path, mounted read-only into the container at `/downloads`; if it is missing/unreadable, PILOT fails closed and skips downloads.
- `PILOT_SAVE_PATH` is usually a subdirectory under `/downloads`.
- `MT_ENGINE_COMMIT` should be set to the current code's short commit hash for deployment metadata tracing (e.g. `git rev-parse --short HEAD`).
- Optional Compose deploy guards: `MT_ENGINE_IMAGE`, `MT_ENGINE_PIDS_LIMIT`, `MT_ENGINE_MEMORY_LIMIT`, `MT_ENGINE_MEMORY_SWAP_LIMIT`, `MT_ENGINE_LOG_MAX_SIZE`, `MT_ENGINE_LOG_MAX_FILE`.
- After deployment, check `/health`, `/api/status`, `/api/home/media-wall`, `/api/auto-delete/status`, and `/api/pilot/stats`; `/api/status` includes qB app/Web API versions and warnings, and `/api/pilot/dry-run` is an optional read-only ledger/budget check.

## Docker Mirror Reminder

If the user's build fails on a network in mainland China, remind them to configure a working mirror in the NAS Docker / Container Manager. The mirror address depends on what is currently available in the user's NAS environment.

## First Deployment

After SSH-ing into the NAS or host, run:

```bash
# 1. Get the current user's UID/GID
id -u
id -g

# 2. Clone the repository
REPO_URL="https://github.com/kevinplus66/mt-engine.git"
INSTALL_PATH="$HOME/mt-engine"
git clone "$REPO_URL" "$INSTALL_PATH"
cd "$INSTALL_PATH"

# 3. Create .env
cat > .env << 'EOF'
PUID=[result of id -u]
PGID=[result of id -g]
MT_TOKEN=[provided by user]
MT_ENGINE_BIND_HOST=0.0.0.0
MT_USER_ID=[provided by user or leave empty]
MT_SITE_URL=https://kp.m-team.cc
MT_ENGINE_COMMIT=
REFRESH_INTERVAL=300
PANEL_COLLECT_INTERVAL=60
MEDIA_WALL_REFRESH_INTERVAL=21600
MEDIA_WALL_STARTUP_DELAY=420
MEDIA_WALL_METADATA_TTL=604800
MEDIA_WALL_MAX_METADATA_FETCHES=40
MEDIA_WALL_DOUBAN_POSTER_FETCHES=3
API_DELAY=3
DEBUG=false
PUSHPLUS_TOKEN=[provided by user or leave empty]
QBITTORRENT_URL=[provided by user or leave empty]
QBITTORRENT_USER=[provided by user or leave empty]
QBITTORRENT_PASSWORD=[provided by user or leave empty]
DOWNLOADS_PATH=[provided by user or /downloads]
PILOT_SAVE_PATH=[provided by user or leave empty]
EOF

# 4. Build and start
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build

# 5. Verify read-only acceptance
./scripts/verify-deploy.sh --base-url http://127.0.0.1:5050
```

After a successful deployment, tell the user that Compose allows LAN access by default:

```text
http://[NAS-IP]:5050
```

If the user needs public access, first confirm that the service sits behind external authentication or an existing reverse proxy; do not expose port 5050 directly.

## Updating the Application

If the NAS cannot access GitHub non-interactively, prefer deploying via git bundle from the local repository using the standard script:

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" ./scripts/deploy-nas.sh
```

The script uploads a bundle of the current `HEAD`, performs a fast-forward merge on the NAS, runs `docker compose up -d --build`, and checks the read-only acceptance endpoints. If the target repository cannot fast-forward, the script fails and does not rewrite `.env`, `data/`, or the download directory.

If the NAS cannot pull Docker Hub base images or should not build images, use the offline script from a local machine that can build the target platform:

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" ./scripts/deploy-nas-offline.sh
```

Required variables are `NAS_HOST`, `NAS_USER`, and `NAS_PATH`. Optional variables: `DEPLOY_REF`, `MT_ENGINE_IMAGE`, `MT_ENGINE_PLATFORM`, `NODE_BASE_IMAGE`, `PYTHON_BASE_IMAGE`, `VERIFY_DEPLOY`, `VERIFY_ALLOW_WARNINGS`, and `VERIFY_PILOT_DRY_RUN`. The script builds locally, saves and uploads the image, loads it on the NAS, fast-forwards the NAS checkout, and starts Compose with `MT_ENGINE_IMAGE` plus `--no-build`; the NAS does not pull Docker Hub base images during deployment.

To deploy a specific branch or commit, set `DEPLOY_REF`:

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" DEPLOY_REF=main ./scripts/deploy-nas.sh
```

If the NAS can already access GitHub and Docker Hub directly, you can also run on the NAS:

```bash
cd [install path]
git pull --ff-only
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
./scripts/verify-deploy.sh --base-url http://127.0.0.1:5050
```

After updating, check:

```bash
grep REFRESH_INTERVAL .env || echo "REFRESH_INTERVAL=300" >> .env
grep FREE_REFRESH_FAILURE_BACKOFF_SECONDS .env || echo "FREE_REFRESH_FAILURE_BACKOFF_SECONDS=1800" >> .env
grep API_DELAY .env || echo "API_DELAY=3" >> .env
grep PANEL_COLLECT_INTERVAL .env || echo "PANEL_COLLECT_INTERVAL=60" >> .env
grep MEDIA_WALL_REFRESH_INTERVAL .env || echo "MEDIA_WALL_REFRESH_INTERVAL=21600" >> .env
grep MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS .env || echo "MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS=1800" >> .env
grep MEDIA_WALL_STARTUP_DELAY .env || echo "MEDIA_WALL_STARTUP_DELAY=420" >> .env
grep MEDIA_WALL_METADATA_TTL .env || echo "MEDIA_WALL_METADATA_TTL=604800" >> .env
grep MEDIA_WALL_MAX_METADATA_FETCHES .env || echo "MEDIA_WALL_MAX_METADATA_FETCHES=40" >> .env
grep MEDIA_WALL_DOUBAN_POSTER_FETCHES .env || echo "MEDIA_WALL_DOUBAN_POSTER_FETCHES=3" >> .env
docker compose restart
docker exec mt-engine env | grep -E "^(REFRESH_INTERVAL|FREE_REFRESH_FAILURE_BACKOFF_SECONDS|API_DELAY|PANEL_COLLECT_INTERVAL|MEDIA_WALL_REFRESH_INTERVAL|MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS|MEDIA_WALL_STARTUP_DELAY|MEDIA_WALL_METADATA_TTL|MEDIA_WALL_MAX_METADATA_FETCHES|MEDIA_WALL_DOUBAN_POSTER_FETCHES|MT_ENGINE_COMMIT)="
```

If `REFRESH_INTERVAL` is below `300`, raise it back to `300` or higher; if `API_DELAY` is below `3`, raise it back to `3` or higher; if `MEDIA_WALL_REFRESH_INTERVAL` is below `21600`, raise it back to `21600` or higher.

## Post-Deployment Read-Only Acceptance

After deployment, use the verifier:

```bash
./scripts/verify-deploy.sh --base-url http://127.0.0.1:5050
```

The verifier executes curl checks against only read-only GET endpoints: `/health`, `/api/status`, `/api/home/media-wall`, `/api/auto-delete/status`, `/api/pilot/stats`, and optionally `/api/pilot/dry-run` with `--pilot-dry-run`. It also checks qBittorrent status/version fields from `/api/status`; qB version warnings such as `qbittorrent_version_unknown` or `qbittorrent_version_unsupported` must be understood or explicitly allowlisted with `--allow-warning`.

Acceptance focus:

- In `/api/status`, `dependencies.qbittorrent.ok` and `dependencies.mteam.ok` should be `true`.
- In `/api/status`, `dependencies.qbittorrent.app_version` and `webapi_version` identify the qB version; qB 4.6.x and qB 5.x should have no `unsupported_version_warning`.
- In `/api/status`, `warnings` should normally be empty; explain any warning before declaring the deployment successful.
- `/api/home/media-wall` should return `rails`; if it is empty right after the first deploy, the background staggered first refresh has not finished yet.
- In `/api/auto-delete/status`, `enabled` should match the user's expectation; if the user relies on PILOT auto-download, keeping it `true` is recommended.
- In `/api/pilot/stats`, `is_running` should be `true`; it may briefly be `false` right after startup before the heartbeat is established.
- `/api/pilot/dry-run` can be used as a read-only view of candidates, disk budget, and PILOT ledger counters; it should not be used as proof that mutation endpoints are safe to call.

Do not call `/api/pilot/run-download`, `/api/pilot/run-cleanup`, `/api/panel/torrents/delete`, `/api/panel/torrents/pause`, `/api/panel/torrents/resume`, or `/api/auto-delete/toggle` unless the user explicitly authorizes it on the spot. If deletion is authorized, omitting `delete_files` preserves files; only `delete_files: true` removes downloaded data. RADAR-tagged tasks are vetoed from automatic cleanup; PILOT uses MTID/M-Team-ID tags/cache and accounts all active downloads on `/downloads` before restocking.

## Upgrading or Reinstalling an Older Version

If the user already has a previous version, first confirm whether `data/` and `.env` need to be kept.

For a routine upgrade, prefer:

```bash
cd [install path]
git pull --ff-only
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
```

## Standard Rollback Procedure

While keeping `.env` and `data/`, roll back via "revert code + rebuild":

```bash
cd [install path]
git log --oneline -n 10
git checkout [last known-good commit]
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
docker compose ps
curl http://localhost:5050/health
curl http://localhost:5050/api/status
```

After rollback, record:

- The commit hash used
- The rollback time
- The `/health` check result

Only clean up when a reinstall is explicitly required:

```bash
cd [old install path]
docker compose down
cd ..
mv [old install path]/.env ./mt-engine.env.backup 2>/dev/null || true
mv [old install path]/data ./mt-engine-data.backup 2>/dev/null || true
```

Do not delete user data by default.

## Troubleshooting

| Problem | Action |
| --- | --- |
| clone fails | Check the repository URL, GitHub Token, or SSH key |
| image pull/base build fails on NAS | Use `PREBUILT_IMAGE_ARCHIVE=/path/to/mt-engine.tar scripts/deploy-nas.sh` from a local builder, or check the NAS network and Docker mirror |
| qBittorrent compatibility concern | qB 4.6 and qB 5 are supported by fallback between qB Web API endpoint families; pin the qB image tag on NAS until intentionally upgrading |
| port in use | `lsof -nP -iTCP:5050 -sTCP:LISTEN` or `netstat -tlnp \| grep 5050` |
| container fails to start | `docker compose logs -f` |
| `.env` not taking effect | Confirm `docker compose` is run from the repository root |
| `MT_TOKEN` invalid | Regenerate the M-Team Token, set `MT_TOKEN` directly in `.env`, then restart the container |
| M-Team requests too frequent | Confirm `API_DELAY=3` or higher; the program raises values below `3` up to `3` |
| qBittorrent unreachable | Confirm `QBITTORRENT_URL` uses a LAN IP, not `localhost` |
| PILOT auto-delete status uncertain | Read-only check `/api/auto-delete/status`, `/api/pilot/stats`, and `/api/panel/torrents?tag=PILOT` |
| permission or disk-budget error | Check `PUID`/`PGID`, `data/` ownership, and that `DOWNLOADS_PATH` exists/readable on the host |
| frontend page 404 | Re-run `docker compose up -d --build` |

## Agent Notes

- All deployment commands run from the repository root; there is no `release/` subdirectory.
- Do not delete `.env`, `data/`, the download directory, or qBittorrent data on your own.
- Do not write the GitHub Token into the README, CHANGELOG, or commit history.
- The production container port binds to `0.0.0.0:5050` by default to support direct LAN access on a NAS; public access must use external authentication or a reverse proxy.
