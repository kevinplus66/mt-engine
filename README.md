# MT-Engine

**English** | [简体中文](README.zh-CN.md)

![Version](https://img.shields.io/badge/version-6.6.2-2f6f9f.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.12+-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-16.2.6-black.svg)
![React](https://img.shields.io/badge/react-19.2.3-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

MT-Engine is a torrent search, freeleech monitor, automated download, and qBittorrent dashboard tool for M-Team.

## Modules

- **RADAR**: M-Team torrent search with filters for channel, category, country/region, resolution, video codec, audio codec, discount type, and sorting.
- **HOME**: A family-oriented 4K media radar that surfaces read-only entries for English-language TV, foreign-language films, Japanese/Korean dramas, Chinese-language series, and classic collections.
- **SONAR**: Freeleech monitor that shows the real cached Free torrents, with filters for size, seeders, remaining time, status, channel, and pagination.
- **PILOT**: Automated download and cleanup rules built around a seeding strategy of "high download demand, low upload supply, enough FREE time, suitable size", with budget control and cleanup.
- **PANEL**: A qBittorrent dashboard showing upload/download, share ratio, active torrents, trend charts, and a torrent monitor table.

## Current Version

Current version: **6.6.2**

6.6.2 continues to refine the family-oriented 4K media radar with wider candidate windows, tighter regional rails, read-only Home behavior, and improved poster fallback coverage.

See [CHANGELOG.md](CHANGELOG.md) for the full history.

## Tech Stack

### Backend

- Python 3.12+
- FastAPI
- httpx
- SQLite
- Pydantic

### Frontend

- Next.js 16.2.6 App Router
- Node.js 22 LTS
- React 19.2.3
- TypeScript
- Tailwind CSS 4
- Coss UI registry/style
- Base UI primitives
- Recharts 2.15.4
- SWR
- Sonner
- Lucide React

### Deployment

- Docker
- Docker Compose
- Single-container deployment: FastAPI serves the API and also hosts the Next.js static export.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An M-Team API Token
- An M-Team User ID (optional, used to show seeding/download status)
- qBittorrent Web UI (optional, used for downloads, auto cleanup, and PANEL)

### 1. Clone the repository

```bash
git clone https://github.com/kevinplus66/mt-engine.git
cd mt-engine
```

### 2. Create the config file

```bash
cp .env.example .env
```

Edit `.env`:

```env
PUID=1000
PGID=1000
MT_ENGINE_COMMIT=
MT_ENGINE_BIND_HOST=0.0.0.0

MT_TOKEN=your_api_token_here
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

For Docker deployments, `QBITTORRENT_URL` must use the actual LAN IP of your NAS or host — not `localhost`. qBittorrent 4.6.7 is known-good; qBittorrent 5 is supported through the compatibility layer that negotiates the pause/resume endpoint family. For NAS deployments, pin your qBittorrent image tag until you intentionally upgrade.

If you configure qBittorrent, use your own Web UI username and password; do not reuse an empty password, a default password, or a temporary setup password. `MT_TOKEN`, `QBITTORRENT_PASSWORD`, and `PUSHPLUS_TOKEN` also support `*_FILE` variants for Docker secrets or mounted files; direct values win when both are set.

To avoid M-Team rate limiting, FREE auto-refresh samples the page-1 shards `FREE/normal/default`, `FREE/normal/leechers_desc`, `FREE/adult/default`, and `FREE/adult/leechers_desc`; `_2X_FREE` can be included in rules/scoring when desired. PILOT uses MTID/M-Team-ID tags/cache, records ledger counters, and keeps managed cleanup away from unmanaged torrents. Public deployments should protect or rate-limit heavy qB listing/status calls.

Media-wall refresh still rotates sources on a stagger, refreshing only one source at a time; when an M-Team source refresh fails it keeps serving the old cache and retries after a `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` cooldown to avoid hammering the API while rate-limited.

### 3. Start

```bash
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
# Optional: use a prebuilt or NAS-loaded image instead of the default mt-engine:<commit>
# export MT_ENGINE_IMAGE="mt-engine:${MT_ENGINE_COMMIT}"
docker compose up -d --build
```

The first build installs the front-end and back-end dependencies and builds the Next.js static output. Compose supports `MT_ENGINE_IMAGE` for prebuilt/offline images and resource/log guard overrides: `MT_ENGINE_PIDS_LIMIT`, `MT_ENGINE_MEMORY_LIMIT`, `MT_ENGINE_MEMORY_SWAP_LIMIT`, `MT_ENGINE_LOG_MAX_SIZE`, and `MT_ENGINE_LOG_MAX_FILE`.

### 4. Access

```text
http://<NAS-IP>:5050
```

By default Compose binds the port to `0.0.0.0:5050`, suitable for direct LAN access on a NAS. To allow host-local access only, set `MT_ENGINE_BIND_HOST=127.0.0.1` in `.env`. Public access should sit behind external authentication or an existing reverse proxy — do not expose port 5050 unprotected.

### 5. Verify

```bash
docker compose ps
./scripts/verify-deploy.sh --base-url http://127.0.0.1:5050
```

`scripts/verify-deploy.sh` is read-only: it only calls `GET /health`, `/api/status`, `/api/home/media-wall`, `/api/auto-delete/status`, `/api/pilot/stats`, and optionally `/api/pilot/dry-run` with `--pilot-dry-run`. It also checks qBittorrent status/version fields from `/api/status`; qB version warnings such as `qbittorrent_version_unknown` or `qbittorrent_version_unsupported` must be understood or explicitly allowlisted with `--allow-warning`.

Example health response:

```json
{"status":"ok","timestamp":"2026-05-26T01:34:01.425811+08:00","torrents_count":400}
```

The status endpoint returns runtime version, commit, cache state, dependency status, qB app/Web API versions and warnings, and non-sensitive config, which can be used for deployment acceptance:

```bash
curl http://localhost:5050/api/status
```


If you use PILOT auto-download, also confirm:

- `enabled` in `/api/auto-delete/status` is `true` or matches your expectation.
- `is_running` in `/api/pilot/stats` is `true`, unless you have explicitly disabled the download and cleanup strategy.
- `/api/pilot/dry-run` returns a read-only preview of candidates, disk budget, and PILOT ledger counters without mutating qB.
- `warnings` in `/api/status` is empty, and both the qBittorrent and M-Team dependencies are healthy. qB 4.6.x and qB 5.x should have no `unsupported_version_warning`.
- `/api/home/media-wall` returns `rails`; if it is briefly empty right after the first deploy, just wait for the first background refresh to finish.

## Environment Variables

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `PUID` | No | Container run user ID, used for NAS file permissions | `1000` |
| `PGID` | No | Container run group ID | `1000` |
| `MT_ENGINE_COMMIT` | No | Build metadata (recommended: `git rev-parse --short HEAD`) | `local` |
| `MT_ENGINE_BIND_HOST` | No | Web service bind address; LAN-accessible by default on NAS, set to `127.0.0.1` for host-only access | `0.0.0.0` |
| `MT_TOKEN` | Yes | M-Team API Token; may be supplied via `MT_TOKEN_FILE` instead | - |
| `MT_TOKEN_FILE` | No | File containing the M-Team API Token; ignored when `MT_TOKEN` is set directly | - |
| `MT_USER_ID` | No | M-Team User ID, used for user seeding/download status | - |
| `MT_SITE_URL` | No | M-Team site URL | `https://kp.m-team.cc` |
| `REFRESH_INTERVAL` | No | SONAR background refresh interval, in seconds; this is the current production steady-state value, not recommended below 300 | `300` |
| `FREE_REFRESH_FAILURE_BACKOFF_SECONDS` | No | Backoff after a FREE refresh failure, in seconds; keeps the old cache and retries after cooldown | `1800` |
| `API_DELAY` | No | M-Team API request interval, clamped to 3-10 seconds; below 3 seconds tends to trigger dynamic rate limiting | `3` |
| `PANEL_COLLECT_INTERVAL` | No | PANEL data collection interval, in seconds | `60` |
| `MEDIA_WALL_REFRESH_INTERVAL` | No | HOME media-wall per-source background refresh interval, in seconds; defaults to 6 hours, not allowed below 21600; the four sources rotate on a stagger | `21600` |
| `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` | No | Backoff after a HOME media-wall source refresh failure, in seconds; keeps the old cache and retries after cooldown | `1800` |
| `MEDIA_WALL_STARTUP_DELAY` | No | Delay before the media wall's first refresh after container start, to avoid overlapping SONAR's first refresh | `420` |
| `MEDIA_WALL_METADATA_TTL` | No | Cache TTL for M-Team media metadata such as posters, year, and summary, in seconds | `604800` |
| `MEDIA_WALL_MAX_METADATA_FETCHES` | No | Metadata backfill budget per full rotation cycle; a single source refresh uses about 1/4 of the budget | `40` |
| `MEDIA_WALL_DOUBAN_POSTER_FETCHES` | No | Max number of Douban-page posters fetched at low frequency per media-wall source refresh; used only when M-Team metadata lacks a poster | `3` |
| `PUSHPLUS_TOKEN` | No | PushPlus WeChat push Token; may be supplied via `PUSHPLUS_TOKEN_FILE` instead | - |
| `PUSHPLUS_TOKEN_FILE` | No | File containing the PushPlus Token; ignored when `PUSHPLUS_TOKEN` is set directly | - |
| `QBITTORRENT_URL` | No | qBittorrent Web UI URL; use a pinned qB image tag on NAS until intentionally upgrading | - |
| `QBITTORRENT_USER` | No | qBittorrent Web UI username | - |
| `QBITTORRENT_PASSWORD` | No | qBittorrent Web UI password; may be supplied via `QBITTORRENT_PASSWORD_FILE` instead | - |
| `QBITTORRENT_PASSWORD_FILE` | No | File containing the qBittorrent Web UI password; ignored when `QBITTORRENT_PASSWORD` is set directly | - |
| `DOWNLOADS_PATH` | No | Download directory on the host, mounted read-only as `/downloads` in the container; PILOT fails closed if this path is missing or unreadable | `/downloads` |
| `PILOT_SAVE_PATH` | No | PILOT save path, usually a subdirectory under `/downloads` | `/downloads/mt_free_farm` |
| `DEBUG` | No | Local debug switch; suitable only for LAN/development environments | `false` |
| `MT_ENGINE_IMAGE` | No | Compose image tag to run; useful for prebuilt/offline images with `docker compose up -d --no-build` | `mt-engine:${MT_ENGINE_COMMIT:-local}` |
| `MT_ENGINE_PIDS_LIMIT` | No | Compose process-count guard | `256` |
| `MT_ENGINE_MEMORY_LIMIT` | No | Compose memory guard | `1024m` |
| `MT_ENGINE_MEMORY_SWAP_LIMIT` | No | Compose memory+swap guard | `1536m` |
| `MT_ENGINE_LOG_MAX_SIZE` | No | Compose json-file log rotation size | `10m` |
| `MT_ENGINE_LOG_MAX_FILE` | No | Compose json-file rotated file count | `3` |

### PILOT and Safety Semantics

- Omitting `delete_files` on `/api/panel/torrents/delete` preserves downloaded files; files are removed only when the request explicitly sets `delete_files: true`.
- Before restocking, PILOT reserves space for all active downloads on the `/downloads` filesystem and fails closed if `/downloads` or the configured save path cannot be measured.
- RADAR-tagged qB tasks are vetoed from automatic cleanup; `_2X_FREE` can be included in rules/scoring when desired.
- `/api/pilot/dry-run` previews candidates, disk budget, and PILOT ledger counters without mutating qB.

## Local Development

### Backend

```bash
pip install -r requirements-dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 5050 --reload
```

### Frontend

Front-end local development uses Node.js 22 LTS.

```bash
cd frontend
npm install
npm run dev
```

Default URL:

```text
http://localhost:3000
```

If `3000` is in use:

```bash
npm run dev -- -p 3001
```

In dev mode the front end proxies the API via the rewrites in `frontend/next.config.ts`, proxying to `http://localhost:5050` by default. To connect to a different backend, set this in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:5051
```

If the browser can reach the NAS IP but the Next dev proxy reports `EHOSTUNREACH`, the Node process cannot connect to that address directly; use a locally reachable bridge proxy address such as `127.0.0.1:5051`.

## Project Structure

```text
mt-engine/
├── app/                    # FastAPI backend
│   ├── main.py             # Application entry point
│   ├── config.py           # Configuration and version reading
│   ├── core/               # Background tasks, PILOT, rules, and alerts
│   ├── routes/             # API routes
│   └── services/           # M-Team, qBittorrent, PushPlus, PANEL DB
├── frontend/               # Next.js frontend
│   ├── app/                # App Router pages
│   ├── components/         # Page components and Coss/Base UI components
│   ├── hooks/              # SWR and interaction hooks
│   ├── lib/                # API client, types, sorting, and utilities
│   └── providers/          # Theme/SWR providers
├── data/                   # SQLite and runtime config data
├── Dockerfile              # Multi-stage image build
├── docker-compose.yml      # Compose deployment config
├── scripts/                # Deployment and maintenance scripts
├── AGENT_DEPLOY.md         # AI-agent-assisted deployment guide
├── CHANGELOG.md            # Version history
├── requirements.txt        # Python runtime dependencies
└── requirements-dev.txt    # Python local test dependencies
```

## Common Commands

```bash
# Start or update
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build

# Stop
docker compose down

# View logs
docker compose logs -f

# Restart
docker compose restart

# Health checks
curl -sf http://localhost:5050/health
curl -sf http://localhost:5050/api/status
curl -sf http://localhost:5050/api/home/media-wall
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
curl -sf http://localhost:5050/api/pilot/dry-run
```

## NAS Standard Deployment and Rollback

### Standard deployment

```bash
cd /path/to/mt-engine
cp .env.example .env
# Edit .env and fill in required fields such as MT_TOKEN
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
docker compose ps
curl -sf http://localhost:5050/health
curl -sf http://localhost:5050/api/status
curl -sf http://localhost:5050/api/home/media-wall
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
curl -sf http://localhost:5050/api/pilot/dry-run
```

If the NAS cannot access GitHub non-interactively, you can deploy from your local machine using the bundle script:

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" ./scripts/deploy-nas.sh
```

If the NAS cannot pull Docker Hub base images or should not build at all, use the offline path from a local machine that can build the target platform:

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" ./scripts/deploy-nas-offline.sh
```

Required env vars are `NAS_HOST`, `NAS_USER`, and `NAS_PATH`. Optional overrides include `DEPLOY_REF`, `MT_ENGINE_IMAGE`, `MT_ENGINE_PLATFORM`, `NODE_BASE_IMAGE`, `PYTHON_BASE_IMAGE`, `VERIFY_DEPLOY`, `VERIFY_ALLOW_WARNINGS`, and `VERIFY_PILOT_DRY_RUN`. The script builds the image locally, saves and uploads it, loads it on the NAS, fast-forwards the NAS checkout, and starts Compose with `MT_ENGINE_IMAGE` and `--no-build`, so the NAS does not pull Docker Hub base images during deployment.

### Standard rollback

```bash
cd /path/to/mt-engine
git log --oneline -n 5
git checkout <last-known-good-commit>
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
docker compose ps
curl -sf http://localhost:5050/health
curl -sf http://localhost:5050/api/status
curl -sf http://localhost:5050/api/home/media-wall
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
curl -sf http://localhost:5050/api/pilot/dry-run
```

Before rolling back, back up the current `.env` and `data/`; do not delete the user's download directory or qBittorrent data.

## Troubleshooting

### Page unreachable

1. Check container status: `docker compose ps`
2. Check the port: `lsof -nP -iTCP:5050 -sTCP:LISTEN`
3. Check logs: `docker compose logs -f`
4. Compose listens on `0.0.0.0:5050` by default; if the LAN cannot reach it, check whether `MT_ENGINE_BIND_HOST` in `.env` was changed to `127.0.0.1`, then check firewall and reverse-proxy rules.

### Page says `MT_TOKEN` is not configured

1. Confirm the `.env` file exists.
2. Confirm `MT_TOKEN` is filled in.
3. Restart the container: `docker compose restart`.

### M-Team API says requests are too frequent

Set `API_DELAY` in `.env` to `3` or higher, then restart. The program raises any value below `3` up to `3`:

```bash
docker compose restart
```

### qBittorrent cannot connect

Do not use `localhost` in a Docker environment. Set `QBITTORRENT_URL` to a LAN address reachable from inside the container for your NAS or host, and fill in your own qBittorrent Web UI username and password, for example:

```env
QBITTORRENT_URL=http://<QB_HOST_IP>:8080
```

### PILOT auto-delete status is uncertain

Read-only check of auto-delete status, the PILOT loop, and the qB task mapping:

```bash
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
curl -sf 'http://localhost:5050/api/panel/torrents?tag=PILOT'
```

If you rely on PILOT auto-download, keep auto-delete enabled and confirm that PILOT tasks resolve an `mteam_id`. While troubleshooting, do not call `/api/pilot/run-download`, `/api/pilot/run-cleanup`, `/api/panel/torrents/delete`, `/api/panel/torrents/pause`, `/api/panel/torrents/resume`, or `/api/auto-delete/toggle` unless you explicitly intend to perform those actions.

### Data directory permission errors

Look up your user and group on the host:

```bash
id -u
id -g
```

Write them into `.env`:

```env
PUID=1000
PGID=1000
```

Fix data-directory permissions if needed:

```bash
sudo chown -R $(id -u):$(id -g) ./data
docker compose restart
```

## Update

```bash
git pull --ff-only
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
docker compose ps
curl -sf http://localhost:5050/health
curl -sf http://localhost:5050/api/status
curl -sf http://localhost:5050/api/home/media-wall
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
```

After upgrading, confirm the current steady-state values exist in `.env`; if `REFRESH_INTERVAL` is already higher than `300`, you can keep the longer interval:

```env
REFRESH_INTERVAL=300
API_DELAY=3
MEDIA_WALL_REFRESH_INTERVAL=21600
MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS=1800
MEDIA_WALL_DOUBAN_POSTER_FETCHES=3
```

## Documentation and Version Maintenance

For local checks and contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](LICENSE).

## Disclaimer

This project is for personal use, study, and research within the bounds of authorized use only. Users must supply their own credentials such as the M-Team API Token and qBittorrent username/password, and are responsible for credential security, downloaded content, and how they use the software.

This project has no affiliation, partnership, or endorsement relationship with any third-party site, service, or project, including M-Team, Douban, qBittorrent, PushPlus, or Next.js/Vercel.

Users must comply with the relevant site rules, third-party terms of service, copyright law, and the laws and regulations of their jurisdiction. The software is provided "as is" without warranty of any kind, express or implied; the MIT License already includes the legal disclaimer, and this section is operational guidance only.
