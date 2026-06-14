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

6.6.2 继续优化家庭偏好的 4K 媒体雷达：

- `/` 是只读 Home 媒体墙，不会在页面访问时触发 M-Team 请求。
- 媒体墙展示 `英美剧更新`、`近期外语电影`、`日韩剧更新`、`华语剧集` 和 `经典补档 / 高质量收藏` 五个横向内容区，并沿用 RADAR 的电影/电视剧分类口径。
- Home 只收录 4K / 2160p / UHD 资源，并优先展示 Dolby Vision/DoVi、Remux、H.265/HEVC、HDR、Atmos、TrueHD 和 DTS-HD 等高质量信号。
- 顶栏 logo 下方显示当前版本号；媒体墙每个 source 单次仍只发起一次 M-Team 搜索，但读取窗口扩大到 200 条，减少严格 4K 筛选后的资源断层。
- 近期外语电影继续排除华语地区资源，并结合 M-Team 国家 ID 兜底；对最近上传的外语电影略微放宽年份窗口，但不会把老片新版本放进近期电影。
- 剧集更新会按英美、日韩、华语分流，并过滤综艺、音乐、新闻、体育和动漫；最近上传且近几年完结的完整季包可以进入对应剧集栏。
- 海报点击打开只读详情 Sheet，只提供打开 M-Team、跳转 RADAR 搜索和关闭，不提供下载、保存、删除或自动化动作。
- 新增 `/api/home/media-wall`，页面访问只读缓存，不会触发 M-Team 请求。
- 媒体墙后台按 source 错峰轮转：每个 source 默认每 6 小时刷新一次，四个 source 默认约每 90 分钟轮到一个，并复用全局 `API_DELAY >= 3` 请求锁避免和 SONAR/PANEL 请求叠加。
- M-Team 元数据缺海报时，优先使用种子自带 `imageList`，再按小预算低频读取豆瓣 subject 页面补海报，并写入本地缓存。
- 新增媒体墙元数据缓存、OpenAPI 类型、前后端回归测试和部署验收文档。

6.6.1 继续优化家庭偏好的 4K 媒体雷达：

- 顶栏 logo 下方显示当前版本号。
- 每个媒体墙 source 搜索窗口从 40 条扩大到 120 条，不增加 M-Team 搜索请求数。
- 识别 `[英语]` 等明确英语音轨标签作为英美剧证据，同时避免英文字幕标签误导分流。
- Home poster 图片改为直接加载，避免有效的 M-Team gateway 海报 URL 被前端优化层拦截。

6.5.0 的重点是 Home 媒体墙和 M-Team API 访问节流：

- `/` 从跳转页改为只读 M-Team 媒体墙。
- 新增 Home 媒体墙缓存、海报 fallback、只读详情 Sheet 和 `/api/home/media-wall`。
- 媒体墙后台按 source 错峰轮转，并复用全局 `API_DELAY >= 3` 请求锁避免和 SONAR/PANEL 请求叠加。

6.4.0 的重点是组件地基、运行时观测和部署链路收束：

- `/` 直接进入 `/panel`，移除额外首页工作流。
- 统一视觉型筛选、范围和密度控件到共享 segmented control，避免 Tabs/ToggleGroup 暗色态漂移。
- 拆分 SONAR、PANEL 和 PILOT 的页面状态、过滤逻辑、校验逻辑和操作 hooks。
- `/api/status` 增加缓存 freshness、next refresh、stale warnings、PANEL collector heartbeat、last error 和 next collector refresh。
- 新增 `scripts/deploy-nas.sh`，支持 NAS 无法直接 pull GitHub 时的 git bundle 部署。
- 增加 PILOT emergency auto-delete 回归测试，覆盖免费即将到期、免费变收费和关闭自动删除时不删除。
- README 与 `AGENT_DEPLOY.md` 补齐部署后只读验收、PILOT 自动删除安全核查和通用化部署占位符。
- Next.js 升到 `16.2.6`，CI 增加 frontend dependency audit，当前 `npm audit --audit-level=moderate` 为 0 vulnerabilities。

6.3.0 的重点是基础设施门禁、部署可追踪性和控制台视觉收敛：

- 新增 `/api/status`，展示运行时版本、部署 commit、缓存状态、依赖状态和非敏感配置。
- Docker/Compose 支持 `MT_ENGINE_COMMIT` 构建元数据，NAS 部署可追溯到具体提交。
- 增加 OpenAPI 导出、生成的前端 API 类型、后端 pytest、前端 lint/test/build 和无副作用 smoke 测试。
- PANEL 图表优化：流量趋势做前端展示平滑，分享率趋势过滤重启时的 0 值并收紧 Y 轴。
- 视觉系统从 Tailwind 默认蓝/绿/紫收敛为 Graphite + Signal 色板：深蓝青、墨绿、铜琥珀、静灰和砖红。
- 部署文档同步当前 NAS 稳态：`REFRESH_INTERVAL=300`、`API_DELAY=3`、`PANEL_COLLECT_INTERVAL=60`。

6.2.0 的重点是前端全量 Coss UI 重构：

- 使用 Coss UI 风格和 Base UI primitives 替换旧 Neo-Brutalism / Radix 外观。
- 统一应用外壳、页面标题、区块卡片、状态卡片、筛选控件、分页、表格名称列和下载动作。
- 恢复长名称列横向滚动，避免表格被长种子名压垮。
- 优化移动端 Sheet、SONAR 卡片、PILOT 表单和 PANEL 图表状态。
- 改进开发代理错误提示，避免直接暴露裸 `Internal Server Error`。

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
MT_ENGINE_API_KEY=
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

Docker 部署时，`QBITTORRENT_URL` 必须写 NAS 或主机在局域网中的实际 IP，不能写 `localhost`。

如果配置 qBittorrent，请填写你自己的 Web UI 用户名和密码；不要沿用空密码、默认密码或临时初始化密码。

非 DEBUG 部署必须设置 `MT_ENGINE_API_KEY`。所有会改变状态 **或会额外消耗 M-Team / qB API 资源** 的接口（例如保存配置、手动触发下载/清理、暂停/恢复/删除、RADAR 搜索）都要求客户端或受保护的反向代理发送 `Authorization: Bearer <key>` 或 `X-MT-ENGINE-Key`；只读验收接口不需要。

FREE 自动刷新为避免 M-Team 限流，会顺序采样四个 page-1 分片：`FREE/normal/default`、`FREE/normal/leechers_desc`、`FREE/adult/default`、`FREE/adult/leechers_desc`。刷新间隔内重复的手动或 PILOT 触发会复用当前缓存，不再重复请求 M-Team；M-Team 失败后按 `FREE_REFRESH_FAILURE_BACKOFF_SECONDS` 退避。自动刷新本身不会主动查询 `_2X_FREE` 频道，但如果 M-Team 的 FREE 结果里带有 `_2X_FREE` 折扣，PILOT 仍会按规则识别。

媒体墙刷新仍按 source 错峰轮转，一次只刷新一个 source；M-Team source 刷新失败时继续对外提供旧缓存，并按 `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` 冷却后再试，避免限流时反复打 API。

### 3. 启动

```bash
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
```

首次构建会安装前端和后端依赖，并构建 Next.js 静态产物。

### 4. 访问

```text
http://<NAS-IP>:5050
```

默认 Compose 端口绑定 `0.0.0.0:5050`，适合 NAS 局域网直连访问；如果只允许主机本机访问，可在 `.env` 中设置 `MT_ENGINE_BIND_HOST=127.0.0.1`。局域网或公网访问必须先设置 `MT_ENGINE_API_KEY`；公网访问还应放到已有反向代理后面，不要在未保护状态下裸露 5050 端口。

### 5. 验证

```bash
docker compose ps
curl -sf http://localhost:5050/health
curl -sf http://localhost:5050/api/status
curl -sf http://localhost:5050/api/home/media-wall
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
```

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
- `/api/pilot/dry-run` 能返回下载候选、清理候选和当前磁盘预算；如果 `download_candidates=0` 且 `skipped_budget>0`，说明当前是空间预算拦住了补货，不是筛选池为空。
- `/api/status` 中 `warnings` 为空，且 qBittorrent 与 M-Team 依赖均为健康。
- `/api/home/media-wall` 能返回 `rails`；首次部署后如果暂时为空，等待后台首刷完成即可。

## 环境变量

| 变量 | 必填 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `PUID` | 否 | 容器运行用户 ID，用于 NAS 文件权限 | `1000` |
| `PGID` | 否 | 容器运行用户组 ID | `1000` |
| `MT_ENGINE_COMMIT` | 否 | 构建元数据（建议填 `git rev-parse --short HEAD`） | `local` |
| `MT_ENGINE_BIND_HOST` | 否 | Web 服务绑定地址；NAS 默认局域网可访问，仅本机访问可设为 `127.0.0.1` | `0.0.0.0` |
| `MT_TOKEN` | 是 | M-Team API Token | - |
| `MT_ENGINE_API_KEY` | 非 DEBUG 是 | 保护会改变状态 **或额外消耗 M-Team / qB API 资源** 的接口（包括保存配置、手动触发下载/清理、暂停/恢复/删除、RADAR 搜索）；客户端或反向代理发送 `Authorization: Bearer <key>` 或 `X-MT-ENGINE-Key` | - |
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
| `QBITTORRENT_URL` | 否 | qBittorrent Web UI 地址 | - |
| `QBITTORRENT_USER` | 否 | qBittorrent Web UI 用户名 | - |
| `QBITTORRENT_PASSWORD` | 否 | qBittorrent Web UI 密码 | - |
| `DOWNLOADS_PATH` | 否 | 主机上的下载目录，挂载为容器内 `/downloads` | `/downloads` |
| `PILOT_SAVE_PATH` | 否 | PILOT 保存路径，通常是 `/downloads` 下的子目录 | `/downloads/mt_free_farm` |
| `DEBUG` | 否 | 本地调试开关；为 `true` 时跳过 `MT_ENGINE_API_KEY` 鉴权，仅适合局域网/开发环境 | `false` |

### PILOT 运行语义补充

- `disk_usage_threshold` 不是只看“当前磁盘已用空间”。下载前会按 **当前已用空间 + 正在下载任务剩余大小 + 本轮准备新增任务大小** 做预算，避免任务队列把磁盘顶满。
- `elimination_ratio` 默认 `0`，也就是默认不做“按分数淘汰底部 X%”。
- `/api/pilot/dry-run` 现在会同时预览：下载候选、Phase 1 直接清理候选、Phase 2 低速清理候选，以及当前磁盘预算。
- 大体积 FREE 种子会要求更长的剩余 FREE 时间；不是只靠固定 10 分钟阈值。

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
# 编辑 .env，填写 MT_TOKEN、MT_ENGINE_API_KEY 等必填项
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

- 后端运行时版本从 `CHANGELOG.md` 第一个发布版本标题读取（自动跳过 `[Unreleased]`）。
- Python 包版本在 `app/__init__.py`。
- 前端包版本在 `frontend/package.json` 和 `frontend/package-lock.json`。
- OpenAPI 版本在 `openapi.json`，前端类型在 `frontend/lib/api/generated.ts`。
- README badge 与上述版本保持一致。
- 部署流程或验收口径变化时，同步更新 README 与 `AGENT_DEPLOY.md`。
- 发布前至少运行：

```bash
pip install -r requirements-dev.txt
pytest -q
cd frontend
npm run lint
npm run test
npm run build
MT_ENGINE_BASE_URL=http://localhost:3001 npm run smoke
```

## 许可证

本项目使用 [MIT License](LICENSE)。

## 免责声明

本项目仅限授权范围内的个人使用、学习和研究。用户须自行提供 M-Team API Token、qBittorrent 账号密码等凭证，并对凭证安全、下载内容及使用行为负责。

本项目与 M-Team、豆瓣、qBittorrent、PushPlus、Next.js/Vercel 等第三方站点、服务或项目均无任何隶属、合作或背书关系。

使用者须遵守相应站点规则、第三方服务条款、版权法及所在地法律法规。软件按“现状”提供，不附带任何明示或默示担保；MIT License 已包含法律免责，此处仅作为操作性声明。
