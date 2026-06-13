# MT-Engine 部署指南（AI Agent 版）

本文档供 AI agent 协助用户在 NAS 或 Linux 主机上部署 MT-Engine。它是给 agent 执行的手动 skill：先确认环境和风险，再部署，最后用只读接口验收。

## Agent 执行原则

- 先确认目标主机、安装路径、仓库来源和用户是否已有旧部署。
- 不要默认删除 `.env`、`data/`、下载目录或 qBittorrent 数据。
- 不要在验收时点击或调用会产生副作用的动作：下载、保存配置、暂停、恢复、删除、清理、手动触发下载、手动触发清理、切换开关。
- 部署后必须用只读接口检查 `/health`、`/api/status`、`/api/home/media-wall`、`/api/auto-delete/status` 和 `/api/pilot/stats`。
- 如果用户使用 PILOT 自动下载，必须确认自动删除开启、qBittorrent 可达、PILOT loop 健康。
- 如果部署脚本、`docker compose` 或健康检查失败，停止并报告错误，不要尝试重置仓库或清理用户数据。
- 默认 Compose 绑定 `0.0.0.0:5050`，适合 NAS 局域网直连；非 DEBUG 部署必须设置 `MT_ENGINE_API_KEY`，公网访问必须先准备认证或反向代理。

## 部署前确认

向用户确认：

```text
NAS / 主机 IP：
SSH 用户名：
SSH 密码或 key 是否可用：
仓库 URL（默认 https://github.com/kevinplus66/mt-engine.git，可替换为用户 fork）：
安装路径（例如 ~/mt-engine 或 /volume1/docker/mt-engine）：
是否已有旧版本部署：
是否启用 PILOT 自动下载/自动清理：
是否希望保留已有 .env、data 和下载目录：
是否需要局域网或公网访问；如果需要，认证或反向代理方案是什么：
```

如果仓库访问需要认证，再向用户确认 GitHub Token 或 SSH key。不要在聊天记录中长期保存 Token。

## 收集应用配置

请用户填写以下 `.env` 模板：

```env
PUID=1000
PGID=1000
MT_ENGINE_COMMIT=
MT_ENGINE_BIND_HOST=0.0.0.0

MT_TOKEN=
MT_ENGINE_API_KEY=
MT_USER_ID=
MT_SITE_URL=https://kp.m-team.cc

REFRESH_INTERVAL=300
PANEL_COLLECT_INTERVAL=60
MEDIA_WALL_REFRESH_INTERVAL=21600
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

说明：

- `MT_TOKEN` 必填，从 M-Team 控制面板 / 实验室 / 存取令牌获取。
- `MT_ENGINE_BIND_HOST` 默认 `0.0.0.0`，适合 NAS 局域网直连；如果用户明确只允许主机本机访问，可设为 `127.0.0.1`。
- `MT_ENGINE_API_KEY` 非 DEBUG 部署必填，用长随机值；所有会改变状态 **或会额外消耗 M-Team / qB API 资源** 的接口（包括保存配置、手动触发下载/清理、暂停/恢复/删除、RADAR 搜索）都要求客户端或反向代理发送 `Authorization: Bearer <key>` 或 `X-MT-ENGINE-Key`。
- `MT_USER_ID` 可选，用于显示用户做种/下载状态。
- `REFRESH_INTERVAL=300` 是当前生产稳态值；不要设置低于 `300`，如果用户已有更长间隔，不要主动调短。
- `API_DELAY` 必须保持 `3` 或更高，低于 `3` 容易触发 M-Team 动态限流。
- `PANEL_COLLECT_INTERVAL` 默认 `60` 秒，控制 PANEL 历史数据采集频率。
- `FREE_REFRESH_FAILURE_BACKOFF_SECONDS` 默认 `1800` 秒；FREE 刷新失败时保留旧缓存并冷却后再试。
- `MEDIA_WALL_REFRESH_INTERVAL` 默认 `21600` 秒（6 小时），不要设置低于 `21600`；这是每个媒体墙 source 的刷新间隔，`latest / movies / series / hot` 会自动错峰轮转，默认约每 90 分钟刷新一个 source。
- `MEDIA_WALL_STARTUP_DELAY` 默认 `420` 秒，用于错开容器启动后的 SONAR 首轮刷新。
- `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` 默认 `1800` 秒；媒体墙 source 刷新失败时保留旧缓存并冷却后再试。
- `MEDIA_WALL_DOUBAN_POSTER_FETCHES` 默认 `3`，只在 M-Team 元数据缺海报时低频读取豆瓣 subject 页面补图；不要为了追求满海报而调高到大值。
- `DEBUG` 生产部署保持 `false`。
- Docker 环境中 `QBITTORRENT_URL` 必须使用 NAS 或主机局域网 IP，不能使用 `localhost`。
- 如果配置 qBittorrent，必须使用用户自己的 Web UI 用户名和密码；不要沿用空密码、默认密码或临时初始化密码。
- `DOWNLOADS_PATH` 是主机路径，会以只读方式挂载到容器内 `/downloads`。
- `PILOT_SAVE_PATH` 通常是 `/downloads` 下的子目录。
- `MT_ENGINE_COMMIT` 建议设置为当前代码提交短哈希，用于部署元数据追踪（例如 `git rev-parse --short HEAD`）。
- 部署后同时检查 `/health`、`/api/status` 和 `/api/home/media-wall`；`/api/status` 会返回版本、commit、缓存、依赖和非敏感配置摘要。

## Docker 镜像源提醒

如果用户在中国大陆网络环境中构建失败，提醒其在 NAS Docker / Container Manager 中配置可用镜像源。镜像源地址以用户当前 NAS 环境可用为准。

## 首次部署

SSH 到 NAS 或主机后执行：

```bash
# 1. 获取当前用户 UID/GID
id -u
id -g

# 2. 克隆仓库
REPO_URL="https://github.com/kevinplus66/mt-engine.git"
INSTALL_PATH="$HOME/mt-engine"
git clone "$REPO_URL" "$INSTALL_PATH"
cd "$INSTALL_PATH"

# 3. 创建 .env
cat > .env << 'EOF'
PUID=[id -u 的结果]
PGID=[id -g 的结果]
MT_TOKEN=[用户提供]
MT_ENGINE_API_KEY=[用户提供的长随机值]
MT_ENGINE_BIND_HOST=0.0.0.0
MT_USER_ID=[用户提供或留空]
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
PUSHPLUS_TOKEN=[用户提供或留空]
QBITTORRENT_URL=[用户提供或留空]
QBITTORRENT_USER=[用户提供或留空]
QBITTORRENT_PASSWORD=[用户提供或留空]
DOWNLOADS_PATH=[用户提供或 /downloads]
PILOT_SAVE_PATH=[用户提供或留空]
EOF

# 4. 构建并启动
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build

# 5. 验证
docker compose ps
curl http://localhost:5050/health
curl http://localhost:5050/api/status
curl http://localhost:5050/api/home/media-wall
curl http://localhost:5050/api/auto-delete/status
curl http://localhost:5050/api/pilot/stats
```

部署成功后，告诉用户默认 Compose 允许从局域网访问：

```text
http://[NAS-IP]:5050
```

如果用户需要公网访问，先确认已设置 `MT_ENGINE_API_KEY`，并已加认证或放到已有反向代理后面；客户端或反向代理调用会改变状态的接口时必须发送 `Authorization: Bearer <key>` 或 `X-MT-ENGINE-Key`。

## 更新应用

如果 NAS 不能无交互访问 GitHub，优先在本地仓库使用标准脚本通过 git bundle 部署：

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" ./scripts/deploy-nas.sh
```

脚本会上传当前 `HEAD` 的 bundle，在 NAS 上执行 fast-forward merge、`docker compose up -d --build`，并检查 `/health` 与 `/api/status`。如果目标仓库不能 fast-forward，脚本会失败，不会重写 `.env`、`data/` 或下载目录。

如果需要部署指定分支或提交，可设置 `DEPLOY_REF`：

```bash
NAS_HOST="<NAS_IP>" NAS_USER="<SSH_USER>" NAS_PATH="<INSTALL_PATH>" DEPLOY_REF=main ./scripts/deploy-nas.sh
```

如果 NAS 已经可以直接访问 GitHub，也可以在 NAS 上执行：

```bash
cd [安装路径]
git pull --ff-only
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
docker compose ps
curl http://localhost:5050/health
curl http://localhost:5050/api/status
curl http://localhost:5050/api/home/media-wall
curl http://localhost:5050/api/auto-delete/status
curl http://localhost:5050/api/pilot/stats
```

更新后检查：

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

如果 `REFRESH_INTERVAL` 低于 `300`，调回 `300` 或更高；如果 `API_DELAY` 低于 `3`，调回 `3` 或更高；如果 `MEDIA_WALL_REFRESH_INTERVAL` 低于 `21600`，调回 `21600` 或更高。

## 部署后只读验收

部署后先看健康和配置摘要：

```bash
curl -sf http://localhost:5050/health
curl -sf http://localhost:5050/api/status
curl -sf http://localhost:5050/api/home/media-wall
curl -sf http://localhost:5050/api/auto-delete/status
curl -sf http://localhost:5050/api/pilot/stats
```

验收重点：

- `/api/status` 中 `dependencies.qbittorrent.ok` 和 `dependencies.mteam.ok` 应为 `true`。
- `/api/status` 中 `warnings` 通常应为空；如果有 `free_cache_stale`、`qbittorrent_unhealthy`、`mteam_unhealthy`、`free_refresh_backoff` 或 `panel_collector_stale`，先解释原因再决定是否宣布部署成功。
- `/api/status` 中 `config.refresh_interval_seconds` 应大于等于 `300`，`config.api_delay_seconds` 应大于等于 `3`，`config.media_wall_refresh_interval_seconds` 应大于等于 `21600`，`config.media_wall_douban_poster_fetches` 应保持小值。`FREE_REFRESH_FAILURE_BACKOFF_SECONDS` 和 `MEDIA_WALL_REFRESH_FAILURE_BACKOFF_SECONDS` 需要从 `.env` 本身核对。
- `/api/home/media-wall` 应返回 `rails`，当前 rail id 顺序应为 `western_series`, `foreign_movies`, `asian_series`, `chinese_series`, `classic_restorations`；首次部署后如果为空，说明后台错峰首刷还没完成；先等待 `MEDIA_WALL_STARTUP_DELAY`，后续各 source 会按 `MEDIA_WALL_REFRESH_INTERVAL / 4` 的节奏逐步补齐。
- `/api/auto-delete/status` 中 `enabled` 应符合用户预期；如果用户依赖 PILOT 自动下载，建议保持 `true`。
- `/api/pilot/stats` 中 `is_running` 应为 `true`；若刚启动、loop heartbeat 还没建立、或 heartbeat 已 stale，也会暂时返回 `false`，不要只凭一次瞬时值判定失败。

如果用户担心 PILOT 免费期过后仍在下载，可额外只读检查 qB 任务映射：

```bash
curl -sf 'http://localhost:5050/api/panel/torrents?tag=PILOT'
```

确认返回的 PILOT 任务能解析出 `mteam_id`。不要调用 `/api/pilot/run-download`、`/api/pilot/run-cleanup`、`/api/panel/torrents/delete`、`/api/panel/torrents/pause`、`/api/panel/torrents/resume` 或 `/api/auto-delete/toggle`，除非用户当场明确授权。

如需只读查看当前 PILOT 候选和空间预算，可额外检查：

```bash
curl -sf http://localhost:5050/api/pilot/dry-run
```

## 旧版本升级或重装

如果用户已有旧版本，先确认是否需要保留 `data/` 和 `.env`。

常规升级优先使用：

```bash
cd [安装路径]
git pull --ff-only
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
```

## 标准回滚流程

在保留 `.env` 与 `data/` 的前提下，按“代码回退 + 重新构建”回滚：

```bash
cd [安装路径]
git log --oneline -n 10
git checkout [最近一次确认可用的 commit]
export MT_ENGINE_COMMIT="$(git rev-parse --short HEAD)"
docker compose up -d --build
docker compose ps
curl http://localhost:5050/health
curl http://localhost:5050/api/status
```

回滚后记录：

- 使用的 commit 哈希
- 回滚时间
- `/health` 检查结果

只有在明确需要重装时才清理：

```bash
cd [旧安装路径]
docker compose down
cd ..
mv [旧安装路径]/.env ./mt-engine.env.backup 2>/dev/null || true
mv [旧安装路径]/data ./mt-engine-data.backup 2>/dev/null || true
```

不要默认删除用户数据。

## 故障排除

| 问题 | 处理 |
| --- | --- |
| clone 失败 | 检查仓库 URL、GitHub Token 或 SSH key |
| 镜像拉取失败 | 检查 NAS 网络和 Docker 镜像源 |
| 端口被占用 | `lsof -nP -iTCP:5050 -sTCP:LISTEN` 或 `netstat -tlnp \| grep 5050` |
| 容器启动失败 | `docker compose logs -f` |
| `.env` 未生效 | 确认在仓库根目录运行 `docker compose` |
| `MT_TOKEN` 无效 | 重新生成 M-Team Token 后重启容器 |
| M-Team 请求过于频繁 | 确认 `API_DELAY=3` 或更高；程序会将低于 `3` 的值提升到 `3` |
| qBittorrent 连不上 | 确认 `QBITTORRENT_URL` 使用局域网 IP 而不是 `localhost` |
| PILOT 自动删除状态不确定 | 只读检查 `/api/auto-delete/status`、`/api/pilot/stats` 和 `/api/panel/torrents?tag=PILOT` |
| 权限错误 | 检查 `PUID`/`PGID` 与 `data/` 所有权 |
| 前端页面 404 | 重新执行 `docker compose up -d --build` |

## Agent 注意事项

- 部署命令都在仓库根目录执行，没有 `release/` 子目录。
- 不要主动删除 `.env`、`data/`、下载目录或 qBittorrent 数据。
- 不要把 GitHub Token 写入 README、CHANGELOG 或提交记录。
- 生产容器端口默认绑定 `0.0.0.0:5050` 以支持 NAS 局域网直连；公网访问必须先设置 `MT_ENGINE_API_KEY` 并加认证或反向代理。
