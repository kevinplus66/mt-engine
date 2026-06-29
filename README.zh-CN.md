# MT-Engine

[English](README.md) | **简体中文**

![Version](https://img.shields.io/badge/version-6.6.2-2f6f9f.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.12+-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-16.2.6-black.svg)
![React](https://img.shields.io/badge/react-19.2.3-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

MT-Engine 是一个面向 M-Team 的种子搜索、免费种子监控、自动化下载和 qBittorrent 面板工具。

## 功能模块

- **RADAR**：M-Team 种子搜索，支持频道、分类、国家/地区、清晰度、视频编码、音频编码、优惠类型和排序。
- **HOME**：家庭 4K 媒体雷达，按英美剧、外语电影、日韩剧、华语剧集和经典收藏展示只读作品入口。
- **SONAR**：免费种子监控，展示真实缓存中的 Free 种子，支持大小、做种数、剩余时间、状态、频道和分页筛选。
- **PILOT**：自动化下载与清理规则，围绕“高下载需求、低上传供给、FREE 时间足够、体积合适”的做种策略执行下载、预算控制和清理。
- **PANEL**：qBittorrent 数据面板，展示上传/下载、分享率、活跃种子、趋势图和种子监控表。

## 当前版本

当前版本：**6.6.2**

6.6.2 继续优化家庭偏好的 4K 媒体雷达：扩大候选读取窗口、收紧地区内容区分流、保持 Home 只读访问，并改进海报 fallback 覆盖率。

完整历史见 [CHANGELOG.md](CHANGELOG.md)。

## 技术栈

### 后端

- Python 3.12+
- FastAPI
- httpx
- SQLite
- Pydantic

### 前端

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

### 部署

- Docker
- Docker Compose
- 单容器部署：FastAPI 提供 API，同时托管 Next.js 静态导出产物。

## 快速开始

### 前置要求

- Docker 和 Docker Compose
- M-Team API Token
- M-Team 用户 ID（可选，用于显示做种/下载状态）
- qBittorrent Web UI（可选，用于下载、自动清理和 PANEL）

### 1. 克隆仓库

```bash
git clone https://github.com/kevinplus66/mt-engine.git
cd mt-engine
```

### 2. 创建配置文件

```bash
cp .env.example .env
```

编辑 `.env`：

```env
PUID=1000
PGID=1000
MT_ENGINE_COMMIT=
MT_ENGINE_BIND_HOST=0.0.0.0

MT_TOKEN=your_api_token_here
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

QBITTORRENT_URL=http://<QB_HOST_IP>:8080
QBITTORRENT_USER=
QBITTORRENT_PASSWORD=
DOWNLOADS_PATH=/volume1/downloads
PILOT_SAVE_PATH=/downloads/mt_free_farm
```

Docker 部署时，`QBITTORRENT_URL` 必须写 NAS 或主机在局域网中的实际 IP，不能写 `localhost`。qBittorrent 4.6.7 是已知可用版本；qBittorrent 5 通过兼容层支持，暂停/恢复接口会按版本协商。NAS 部署建议固定 qB 镜像 tag，等你明确要升级时再改。

如果配置 qBittorrent，请填写你自己的 Web UI 用户名和密码；不要沿用空密码、默认密码或临时初始化密码。部署密钥只使用直接环境变量：在 `.env` 中设置 `MT_TOKEN`、可选的 `QBITTORRENT_PASSWORD` 和可选的 `PUSHPLUS_TOKEN`；不要提交真实值。

MT-Engine 没有内置公网认证。请保持仅局域网访问，或把公网访问放在外部认证/反向代理后面。

FREE 自动刷新会在刷新间隔内复用当前缓存，并在 M-Team 失败后退避，避免频繁请求。PILOT 保守维护 qB 任务身份，让托管清理避开非托管种子。

媒体墙刷新仍按 source 错峰轮转，一次只刷新一个 source；M-Team source 刷新失败时继续对外提供旧缓存，并按 `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` 冷却后再试，避免限流时反复打 API。

### 3. 启动

```bash
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
# 可选：使用预构建或已在 NAS 加载的镜像，而不是默认 mt-engine:<commit>
# export MT_ENGINE_IMAGE="mt-engine:${MT_ENGINE_COMMIT}"
docker compose up -d --build
```

首次构建会安装前端和后端依赖，并构建 Next.js 静态产物。Docker 构建使用固定的 `node:22-alpine` 和 `python:3.12-slim` 基础镜像；NAS 上的 qBittorrent 镜像也建议固定 tag，等你明确要升级时再改。

### 4. 访问

```text
http://<NAS-IP>:5050
```

默认 Compose 端口绑定 `0.0.0.0:5050`，适合 NAS 局域网直连访问；如果只允许主机本机访问，可在 `.env` 中设置 `MT_ENGINE_BIND_HOST=127.0.0.1`。MT-Engine 没有内置公网认证；请保持仅局域网访问，或把公网访问放在外部认证/反向代理后面。

### 5. 验证

```bash
docker compose ps
./scripts/verify-deploy.sh --base-url http://127.0.0.1:5050
```

`scripts/verify-deploy.sh` 是只读验收脚本：只调用 `GET /health`、`/api/status`、`/api/home/media-wall`、`/api/auto-delete/status`、`/api/pilot/stats`，以及可选的 `--pilot-dry-run` 对应的 `/api/pilot/dry-run`。

健康接口返回示例：

```json
{"status":"ok","timestamp":"2026-05-26T01:34:01.425811+08:00","torrents_count":400}
```

运行状态接口返回运行时版本、commit、缓存状态、依赖状态和非敏感配置，可用于部署验收：

```bash
curl http://localhost:5050/api/status
```


如果使用 PILOT 自动下载，请同时确认：

- `/api/auto-delete/status` 中 `enabled` 为 `true` 或符合你的预期。
- `/api/pilot/stats` 中 `is_running` 为 `true`，除非你明确关闭下载和清理策略。
- `/api/pilot/dry-run` 能只读预览候选和磁盘预算，且不会修改 qB。
- `/api/status` 中 `warnings` 为空，且 qBittorrent 与 M-Team 依赖均为健康。qB 4.6 和 qB 5 会通过 qB Web API 接口族 fallback 兼容。
- `/api/home/media-wall` 能返回 `rails`；首次部署后如果暂时为空，等待后台首刷完成即可。

## 环境变量

| 变量 | 必填 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `PUID` | 否 | 容器运行用户 ID，用于 NAS 文件权限 | `1000` |
| `PGID` | 否 | 容器运行用户组 ID | `1000` |
| `MT_ENGINE_COMMIT` | 否 | 构建元数据（建议填 `git rev-parse --short HEAD`） | `local` |
| `MT_ENGINE_BIND_HOST` | 否 | Web 服务绑定地址；NAS 默认局域网可访问，仅本机访问可设为 `127.0.0.1` | `0.0.0.0` |
| `MT_TOKEN` | 是 | M-Team API Token，直接设置在 `.env` 中 | - |
| `MT_USER_ID` | 否 | M-Team 用户 ID，用于用户做种/下载状态 | - |
| `MT_SITE_URL` | 否 | M-Team 站点地址 | `https://kp.m-team.cc` |
| `REFRESH_INTERVAL` | 否 | SONAR 后台刷新间隔，单位秒；当前生产稳态值，不建议低于 300 | `300` |
| `FREE_REFRESH_FAILURE_BACKOFF_SECONDS` | 否 | FREE 刷新失败退避时间，单位秒；失败时保留旧缓存，冷却后再试 | `1800` |
| `API_DELAY` | 否 | M-Team API 请求间隔，限制 3-10 秒，低于 3 秒容易触发动态限流 | `3` |
| `PANEL_COLLECT_INTERVAL` | 否 | PANEL 数据采集间隔，单位秒 | `60` |
| `MEDIA_WALL_REFRESH_INTERVAL` | 否 | HOME 媒体墙每个 source 的后台刷新间隔，单位秒；默认 6 小时，不允许低于 21600；四个 source 会自动错峰轮转 | `21600` |
| `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` | 否 | HOME 媒体墙 source 刷新失败退避时间，单位秒；失败时保留旧缓存，冷却后再试 | `1800` |
| `MEDIA_WALL_STARTUP_DELAY` | 否 | 容器启动后媒体墙首刷延迟，避免和 SONAR 首轮刷新叠加 | `420` |
| `MEDIA_WALL_METADATA_TTL` | 否 | 海报、年份、简介等 M-Team 媒体元数据缓存时间，单位秒 | `604800` |
| `MEDIA_WALL_MAX_METADATA_FETCHES` | 否 | 媒体墙完整轮转周期的元数据补充预算；单个 source 刷新会使用约 1/4 预算 | `40` |
| `MEDIA_WALL_DOUBAN_POSTER_FETCHES` | 否 | 每个媒体墙 source 刷新时最多低频抓取的豆瓣页面海报数；只在 M-Team 元数据缺海报时使用 | `3` |
| `PUSHPLUS_TOKEN` | 否 | PushPlus 微信推送 Token | - |
| `QBITTORRENT_URL` | 否 | qBittorrent Web UI 地址；NAS 建议固定 qB 镜像 tag，明确升级时再改 | - |
| `QBITTORRENT_USER` | 否 | qBittorrent Web UI 用户名 | - |
| `QBITTORRENT_PASSWORD` | 否 | qBittorrent Web UI 密码 | - |
| `DOWNLOADS_PATH` | 否 | 主机上的下载目录，以只读方式挂载为容器内 `/downloads`；路径缺失或不可读时 PILOT 会失败关闭 | `/downloads` |
| `PILOT_SAVE_PATH` | 否 | PILOT 保存路径，通常是 `/downloads` 下的子目录 | `/downloads/mt_free_farm` |
| `DEBUG` | 否 | 本地调试开关，仅适合局域网/开发环境 | `false` |
| `MT_ENGINE_IMAGE` | 否 | Compose 运行的镜像 tag；用于预构建/离线镜像，可配合 `docker compose up -d --no-build` | `mt-engine:${MT_ENGINE_COMMIT:-local}` |

### PILOT 与安全语义补充

- `/api/panel/torrents/delete` 省略 `delete_files` 时会保留已下载文件；只有请求明确设置 `delete_files: true` 才删除文件。
- 如果 `/downloads` 或配置的保存路径无法测量，PILOT 会失败关闭并跳过下载，不会猜测剩余空间。
- RADAR/PILOT 托管清理会避开非托管种子。

## 本地开发

### 后端

```bash
pip install -r requirements-dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 5050 --reload
```

### 前端

前端本地开发使用 Node.js 22 LTS。

```bash
cd frontend
npm install
npm run dev
```

默认访问：

```text
http://localhost:3000
```

如果 `3000` 被占用：

```bash
npm run dev -- -p 3001
```

前端开发模式通过 `frontend/next.config.ts` 的 rewrites 代理 API。默认代理到 `http://localhost:5050`。如需连接其他后端，在 `frontend/.env.local` 中设置：

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:5051
```

如果浏览器能访问 NAS IP，但 Next dev 代理报 `EHOSTUNREACH`，说明 Node 进程无法直连该地址；可以使用本地可达的桥接代理地址，例如 `127.0.0.1:5051`。

## 项目结构

```text
mt-engine/
├── app/                    # FastAPI 后端
│   ├── main.py             # 应用入口
│   ├── config.py           # 配置与版本读取
│   ├── core/               # 后台任务、PILOT、规则和告警
│   ├── routes/             # API 路由
│   └── services/           # M-Team、qBittorrent、PushPlus、PANEL DB
├── frontend/               # Next.js 前端
│   ├── app/                # App Router 页面
│   ├── components/         # 页面组件和 Coss/Base UI 组件
│   ├── hooks/              # SWR 和交互 hooks
│   ├── lib/                # API client、类型、排序和工具函数
│   └── providers/          # Theme/SWR providers
├── data/                   # SQLite 和运行时配置数据
├── Dockerfile              # 多阶段镜像构建
├── docker-compose.yml      # Compose 部署配置
├── scripts/                # 部署和维护脚本
├── AGENT_DEPLOY.md         # AI agent 辅助部署指南
├── CHANGELOG.md            # 版本历史
├── requirements.txt        # Python 运行时依赖
└── requirements-dev.txt    # Python 本地测试依赖
```

## 常用命令

```bash
# 启动或更新
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build

# 停止
docker compose down

# 查看日志
docker compose logs -f

# 重启
docker compose restart

# 健康检查
curl -sf http://localhost:5050/health
curl -sf http://localhost:5050/api/status
curl -sf http://localhost:5050/api/home/media-wall
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
curl -sf http://localhost:5050/api/pilot/dry-run
```

## NAS 标准部署与回滚

### 标准部署

```bash
cd /path/to/mt-engine
cp .env.example .env
# 编辑 .env，填写 MT_TOKEN 等必填项
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

如果 NAS 无法无交互访问 GitHub，可以在本地使用 bundle 部署脚本：

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" ./scripts/deploy-nas.sh
```

如果 NAS 无法拉取 Docker Hub 基础镜像，或希望 NAS 端完全不构建，请先在本地机器准备 Docker 镜像归档，再交给同一个部署脚本：

```bash
PREBUILT_IMAGE_ARCHIVE="/path/to/mt-engine.tar" NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" ./scripts/deploy-nas.sh
```

必需环境变量是 `NAS_HOST`、`NAS_USER`、`NAS_PATH`；`DEPLOY_REF`、`VERIFY_DEPLOY`、`VERIFY_PILOT_DRY_RUN` 仍然可选。设置 `PREBUILT_IMAGE_ARCHIVE` 时，`scripts/deploy-nas.sh` 会上传并在 NAS 上加载该归档，设置 `MT_ENGINE_IMAGE`，然后以不在 NAS 构建的方式启动 Compose。

### 标准回滚

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

回滚前建议备份当前 `.env` 和 `data/`；不要删除用户下载目录或 qBittorrent 数据。

## 故障排除

### 页面无法访问

1. 检查容器状态：`docker compose ps`
2. 检查端口：`lsof -nP -iTCP:5050 -sTCP:LISTEN`
3. 检查日志：`docker compose logs -f`
4. 默认 Compose 监听 `0.0.0.0:5050`；如果局域网无法访问，检查 `.env` 中 `MT_ENGINE_BIND_HOST` 是否被改为 `127.0.0.1`，再检查防火墙和反向代理规则。

### 页面提示未配置 `MT_TOKEN`

1. 确认 `.env` 文件存在。
2. 确认 `MT_TOKEN` 已填写。
3. 重启容器：`docker compose restart`。

### M-Team API 提示请求过于频繁

将 `.env` 中的 `API_DELAY` 设置为 `3` 或更高，然后重启。程序会把低于 `3` 的值提升到 `3`：

```bash
docker compose restart
```

### qBittorrent 无法连接

Docker 环境中不要使用 `localhost`。请将 `QBITTORRENT_URL` 设置为 NAS 或主机在容器内可达的局域网地址，并填写你自己的 qBittorrent Web UI 用户名和密码，例如：

```env
QBITTORRENT_URL=http://<QB_HOST_IP>:8080
```

### PILOT 自动删除状态不确定

只读检查自动删除状态、PILOT loop 和 qB 任务映射：

```bash
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
curl -sf 'http://localhost:5050/api/panel/torrents?tag=PILOT'
```

如果依赖 PILOT 自动下载，建议保持自动删除开启，并确认 PILOT 任务能解析出 `mteam_id`。不要在排查时调用 `/api/pilot/run-download`、`/api/pilot/run-cleanup`、`/api/panel/torrents/delete`、`/api/panel/torrents/pause`、`/api/panel/torrents/resume` 或 `/api/auto-delete/toggle`，除非你明确要执行这些动作。

### 数据目录权限错误

在主机上查询用户和用户组：

```bash
id -u
id -g
```

写入 `.env`：

```env
PUID=1000
PGID=1000
```

必要时修复数据目录权限：

```bash
sudo chown -R $(id -u):$(id -g) ./data
docker compose restart
```

## 更新

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

升级后建议确认 `.env` 中存在当前稳态值；如果 `REFRESH_INTERVAL` 已经高于 `300`，可以保留更长间隔：

```env
REFRESH_INTERVAL=300
API_DELAY=3
MEDIA_WALL_REFRESH_INTERVAL=21600
MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS=1800
MEDIA_WALL_DOUBAN_POSTER_FETCHES=3
```

## 文档与版本维护

本地检查与贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

本项目使用 [MIT License](LICENSE)。

## 免责声明

本项目仅限授权范围内的个人使用、学习和研究。用户须自行提供 M-Team API Token、qBittorrent 账号密码等凭证，并对凭证安全、下载内容及使用行为负责。

本项目与 M-Team、豆瓣、qBittorrent、PushPlus、Next.js/Vercel 等第三方站点、服务或项目均无任何隶属、合作或背书关系。

使用者须遵守相应站点规则、第三方服务条款、版权法及所在地法律法规。软件按“现状”提供，不附带任何明示或默示担保；MIT License 已包含法律免责，此处仅作为操作性声明。
