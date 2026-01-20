# M-Team Engine (MT 引擎)

![Version](https://img.shields.io/badge/version-2.3.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

M-Team 引擎 - 免费种子猎手 + 全能搜索引擎

---

# 中文文档

## 简介

**M-Team Engine (MT 引擎)** 是一个双功能 M-Team 工具：
1. **免费猎手** - 自动追踪 Free/2xFree 限时免费种子
2. **搜索引擎** - 全能种子搜索，支持高级筛选和一键下载

### 主要功能

| 功能 |
|------|
| **免费猎手** - 自动搜索 Free/2xFree 种子 |
| **搜索引擎** - 电影/电视剧/成人内容搜索 |
| 高级筛选（分辨率/视频编码/音频编码/来源） |
| 可展开行显示质量元数据（分辨率、编码、音频、来源、制作组） |
| 一键下载到 qBittorrent（带标签分类） |
| 支持普通区和成人区 |
| 剩余时间倒计时显示 |
| 多维度筛选（类型、大小、做种人数、剩余时间、状态、频道） |
| 显示用户做种/下载状态 |
| 下载进度环形显示 |
| 分享率对比功能 |
| 支持中英文切换 |
| 深色/浅色主题切换 |
| Nothing OS 设计系统（极简工业风格） |
| 响应式设计（桌面/平板/手机）|
| 自动定时刷新 |
| Docker 一键部署 |
| 安全加固（XSS防护、速率限制）|
| PushPlus 微信推送预警 |
| qBittorrent 集成与自动删除 |

---

## 快速开始

### 前置要求

- Docker & Docker Compose
- M-Team API Token
- M-Team 用户ID（可选，用于显示做种/下载状态）

### 1. 克隆仓库

```bash
git clone https://github.com/kevinplus66/MT-Engine.git
cd MT-Engine
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# M-Team API Token（必需）
MT_TOKEN=your_api_token_here

# M-Team 用户ID（可选，用于显示做种/下载状态）
MT_USER_ID=your_user_id

# M-Team 网站地址（默认: https://kp.m-team.cc）
MT_SITE_URL=https://kp.m-team.cc

# 自动刷新间隔（秒，默认600）
REFRESH_INTERVAL=600

# API 请求间隔（秒，默认1）
API_DELAY=1

# 对手用户ID（可选，用于分享率对比）
RIVAL_USER_ID=

# PushPlus Token（可选，用于微信推送预警）
PUSHPLUS_TOKEN=

# qBittorrent Web UI 配置（可选，用于一键下载和自动删除）
# ⚠️ Docker 环境必须使用 NAS 的实际 IP，不能用 localhost
QBITTORRENT_URL=http://192.168.x.x:8080
QBITTORRENT_USER=admin
QBITTORRENT_PASSWORD=adminadmin
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 访问页面

打开浏览器访问: `http://localhost:5001`

---

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `MT_TOKEN` | M-Team API 密钥 | - |
| `MT_USER_ID` | 用户ID，用于获取做种/下载状态 | - |
| `MT_SITE_URL` | M-Team 网站地址 | `https://kp.m-team.cc` |
| `REFRESH_INTERVAL` | 自动刷新间隔（秒） | `600` |
| `API_DELAY` | API 请求间隔（秒） | `1` |
| `RIVAL_USER_ID` | 对手用户ID，用于分享率对比 | - |
| `PUSHPLUS_TOKEN` | PushPlus 微信推送 Token | - |
| `QBITTORRENT_URL` | qBittorrent Web UI 地址 | `http://192.168.x.x:8080` (需填写 NAS IP) |
| `QBITTORRENT_USER` | qBittorrent Web UI 用户名 | `admin` |
| `QBITTORRENT_PASSWORD` | qBittorrent Web UI 密码 | `adminadmin` |

### 获取 API Token

1. 登录 M-Team 网站
2. 进入 "控制面板" → "实验室" → "存取令牌"
3. 创建新令牌并复制

### 获取 User ID

1. 登录 M-Team 网站
2. 点击用户名进入个人页面
3. URL 中的数字即为 User ID
   - 例如: `https://kp.m-team.cc/userdetails.php?id=123456`
   - User ID = `123456`

### 获取 PushPlus Token

1. 访问 https://www.pushplus.plus/
2. 使用微信扫码登录
3. 在个人中心复制 Token

### 配置 qBittorrent Web UI

1. 打开 qBittorrent
2. 进入 "工具" → "选项" → "Web UI"
3. 勾选 "启用 Web 用户界面(远程控制)"
4. 设置端口（默认 8080）
5. 设置用户名和密码
6. 点击"确定"保存

**注意:** 自动删除功能需要配置 qBittorrent Web UI。当免费剩余时间 < 10 分钟或免费状态变为非免费且未下载完时，系统会自动从 qBittorrent 删除种子和文件。自动删除功能独立于 PushPlus，无需配置推送也可使用。

---

## API 接口

### 获取种子列表

```
GET /api/torrents
```

**查询参数:**

| 参数 | 说明 |
|-----|------|
| `discount` | 优惠类型：`FREE`, `_2X_FREE` |
| `min_size` | 最小大小（字节） |
| `max_size` | 最大大小（字节） |
| `category` | 类别ID |
| `mode` | 频道：`normal`, `adult` |

**示例:**

```bash
curl "http://localhost:5001/api/torrents?discount=FREE&mode=normal"
```

### 手动刷新

```
POST /api/refresh
```

### 下载种子（免费猎手）

```
POST /api/download
Content-Type: application/json

{
    "id": "torrent_id"
}
```

下载的种子会添加标签 `免费做种`

### 自动删除控制

**获取自动删除状态:**

```
GET /api/auto-delete/status
```

响应示例:
```json
{
    "enabled": false,
    "qbittorrent_configured": true
}
```

**切换自动删除状态:**

```
POST /api/auto-delete/toggle
```

响应示例:
```json
{
    "success": true,
    "enabled": true,
    "message": "自动删除已启用"
}
```

### 搜索引擎

```
GET /search
```
访问搜索引擎页面

**搜索种子:**

```
POST /api/search
Content-Type: application/json

{
    "keyword": "搜索关键词",
    "mode": "movie",
    "page": 1
}
```

**从搜索引擎下载:**

```
POST /api/search/download
Content-Type: application/json

{
    "id": "torrent_id"
}
```
下载的种子会添加标签 `个人下载`

**获取筛选选项:**

```
GET /api/filter-options
```

### 健康检查

```
GET /health
```

---

## Docker 部署

### 使用 Docker Compose

```yaml
services:
  mt-engine:
    build: .
    container_name: mt-engine
    restart: unless-stopped
    ports:
      - "5001:5001"
    environment:
      - MT_TOKEN=${MT_TOKEN}
      - MT_USER_ID=${MT_USER_ID}
      - MT_SITE_URL=${MT_SITE_URL:-https://kp.m-team.cc}
      - REFRESH_INTERVAL=${REFRESH_INTERVAL:-600}
      - API_DELAY=${API_DELAY:-1}
      - RIVAL_USER_ID=${RIVAL_USER_ID:-}
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "python", "-c", "import httpx; httpx.get('http://localhost:5001/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### 常用命令

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 查看日志
docker-compose logs -f

# 重新构建
docker-compose build --no-cache

# 重启
docker-compose restart
```

---

## 本地开发

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行

```bash
# 设置环境变量
export MT_TOKEN=your_token
export MT_USER_ID=your_user_id

# 启动服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 5001 --reload
```

---

## 项目结构

```
MT-Engine/
├── app/
│   ├── main.py              # 主应用
│   ├── static/
│   │   ├── favicon.png      # 浏览器图标
│   │   ├── seeder-logo.png  # 免费猎手 Logo
│   │   └── search-logo.png  # 搜索引擎 Logo
│   └── templates/
│       ├── index.html       # 免费猎手页面
│       └── search.html      # 搜索引擎页面
├── docker-compose.yml       # Docker Compose 配置
├── Dockerfile               # Docker 构建文件
├── requirements.txt         # Python 依赖
├── .env.example             # 环境变量示例
├── .gitignore               # Git 忽略文件
└── README.md                # 说明文档
```

---

## 技术栈

- **后端**: Python 3.9+, FastAPI, httpx
- **前端**: HTML5, CSS3, JavaScript (Vanilla)
- **模板**: Jinja2
- **容器**: Docker, Docker Compose

---

## 常见问题

### Q: 为什么没有显示成人区的种子？
A: 请确保你的 M-Team 账号已开启成人内容权限。

### Q: API Token 报错 401？
A: 请检查 Token 是否正确，或尝试重新生成。

### Q: 如何修改刷新间隔？
A: 修改 `.env` 文件中的 `REFRESH_INTERVAL` 值（单位：秒）。

---

## 更新日志

### v2.3.1 (2026-01)
- 简化 qBittorrent URL 配置文档
- 默认 URL 改为 `192.168.x.x:8080` 占位符
- 移除 `host.docker.internal` 相关说明
- 明确说明 Docker 环境下必须使用 NAS 实际 IP

### v2.3.0 (2026-01)
- 完善 qBittorrent 配置文档
- `docker-compose.yml` 添加 qBittorrent 环境变量
- `安装指南.md` 添加 qBittorrent 配置说明和 Docker 网络配置提示

### v2.2.0 (2026-01)
- 全新 Nothing OS 设计系统（极简工业风格）
- 三层字体体系：DotGothic16（标题）、Roboto Mono（数据）、Inter（正文）
- 新增来源筛选（Web-DL, Bluray, Remux, HDTV, DVD）
- 搜索引擎：可展开行显示质量元数据（分辨率、编码、音频、来源、制作组）
- 优化 qBittorrent 会话缓存（30分钟有效期，减少登录开销）
- 改进移动端响应式设计（卡片布局优化）
- 优化悬停效果（仅鼠标设备，触摸设备优化）
- 新增质量标签显示系统
- Logo 切换器（免费猎手 ⇄ 搜索引擎）
- 工业风格切换开关（自动删除功能）
- 状态点动画（脉冲效果）
- 筛选重置按钮（智能显示）
- 筛选计数徽章

### v2.1.0 (2026-01)
- 修复搜索引擎页面搜索后加载圈一直转的问题（移除未实现的 sortSelect 引用）
- 修复移动端导航栏过长溢出问题（隐藏统计信息）
- 修复移动端鼠标悬停时按钮背景色异常问题
- 搜索引擎：移除排序下拉框，简化界面

### v2.0.0 (2026-01)
- 重大更新：新增搜索引擎功能
- 支持电影/电视剧/成人内容搜索
- 高级筛选：分辨率、视频编码、音频编码
- 一键下载到 qBittorrent（带标签分类）
- 免费猎手下载标签：`免费做种`
- 搜索引擎下载标签：`个人下载`
- 全新 "Nothing OS" 风格界面设计
- 双 Logo 导航切换

### v1.5.4 (2025-12)
- 移除移动端筛选抽屉中的信息图标(ⓘ)
- 修复开关按钮颜色一致性（从绿色改为蓝色，与其他筛选按钮一致）
- 在页脚添加上次刷新时间显示
- 简化 PushPlus 推送告警模板，更简洁易读

### v1.5.3 (2025-12)
- 修复自动刷新间隔问题：现在刷新周期更准确（扣除数据获取时间）
- 改进 .env.example 文档：添加 Docker 网络配置说明（host.docker.internal）
- 添加刷新耗时日志输出

### v1.5.2 (2025-12)
- 自动删除功能独立于 PushPlus，无需配置推送也可使用
- 修复：即使未配置 PUSHPLUS_TOKEN，仍会追踪免费种子历史（用于变节检测）

### v1.5.1 (2025-12)
- 自动删除触发时机优化：免费剩余时间 < 10 分钟时即触发删除（更安全）
- 自动删除现在会同时删除种子和文件（释放存储空间）
- PushPlus 通知包含删除结果（成功/失败/未找到）

### v1.5.0 (2025-12)
- qBittorrent Web UI 集成
- 自动删除功能：免费变收费时自动从 qBittorrent 删除未完成种子
- 通过 M-Team ID 匹配 qBittorrent 中的种子
- iOS 风格的界面切换开关
- 自动删除状态通知

### v1.4.1 (2025-12)
- 修复剩余免费时间不实时更新的问题（现在每秒更新倒计时）
- 倒计时会根据页面加载后经过的时间自动减少
- 状态颜色会随时间变化自动更新

### v1.3.1 (2025-12)
- 修复免费种子搜索数量限制问题（pageSize 100→200）
- 修复部分做种/下载中种子状态不显示的问题

### v1.3.0 (2025-12)
- PushPlus 微信推送预警功能
- 免费即将到期预警（下载中种子 < 10分钟）
- 免费变收费预警（变节检测）

### v1.2.0 (2025-12)
- 平板响应式优化：中等屏幕自动启用横向滚动
- 返回顶部按钮
- 筛选栏手机端取消固定

### v1.1.0 (2025-12)
- 安全加固：XSS防护、输入验证、速率限制、安全头
- Docker 非 root 用户运行
- 分享率对比功能
- 用户统计显示（分享率、上传、下载）
- 下载进度环形显示
- 修复语言切换后进度环消失问题

### v1.0.0 (2025-12)
- 首次发布
- 支持 Free/2xFree 种子搜索
- 支持普通区和成人区
- 多维度筛选功能
- 中英文双语支持
- 深色/浅色主题
- Docker 部署支持

---

## 许可证

MIT License

---

## 免责声明

本项目仅供学习和研究使用，请勿用于任何商业或非法用途。使用本工具时请遵守 M-Team 的使用条款。

---

## 贡献

欢迎提交 Issue 和 Pull Request！

---

# English Documentation

## Introduction

**M-Team Engine (MT 引擎)** is a dual-function M-Team tool:
1. **Free Hunter** - Automatically tracks Free/2xFree time-limited free torrents
2. **Search Engine** - Full-featured torrent search with advanced filters and one-click download

### Key Features

| Feature |
|---------|
| **Free Hunter** - Auto-search Free/2xFree torrents |
| **Search Engine** - Movie/TV/Adult content search |
| Advanced filters (Resolution/Video Codec/Audio Codec/Source) |
| Expandable row details showing quality metadata (resolution, codecs, audio, source, team) |
| One-click download to qBittorrent (with tag classification) |
| Support Normal and Adult sections |
| Remaining time countdown display |
| Multi-dimensional filtering (type, size, seeders, time, status, channel) |
| Show user seeding/leeching status |
| Download progress ring display |
| Share ratio comparison with rival |
| Chinese/English language switch |
| Dark/Light theme toggle |
| Nothing OS Design System (minimalist industrial style) |
| Responsive design (Desktop/Tablet/Mobile) |
| Auto scheduled refresh |
| Docker one-click deployment |
| Security hardened (XSS protection, rate limiting) |
| PushPlus WeChat push notifications |
| qBittorrent integration and auto-delete |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- M-Team API Token
- M-Team User ID (optional, for seeding/leeching status)

### 1. Clone Repository

```bash
git clone https://github.com/kevinplus66/MT-Engine.git
cd MT-Engine
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file:

```env
# M-Team API Token (Required)
MT_TOKEN=your_api_token_here

# M-Team User ID (Optional, for seeding/leeching status)
MT_USER_ID=your_user_id

# M-Team Site URL (Default: https://kp.m-team.cc)
MT_SITE_URL=https://kp.m-team.cc

# Auto refresh interval (seconds, default 600)
REFRESH_INTERVAL=600

# API request delay (seconds, default 1)
API_DELAY=1

# Rival User ID (Optional, for share ratio comparison)
RIVAL_USER_ID=

# PushPlus Token (Optional, for WeChat push notifications)
PUSHPLUS_TOKEN=

# qBittorrent Web UI Configuration (Optional, for one-click download and auto-delete)
# ⚠️ In Docker, you MUST use your NAS's actual IP, NOT localhost
QBITTORRENT_URL=http://192.168.x.x:8080
QBITTORRENT_USER=admin
QBITTORRENT_PASSWORD=adminadmin
```

### 3. Start Service

```bash
docker-compose up -d
```

### 4. Access Page

Open browser and visit: `http://localhost:5001`

---

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `MT_TOKEN` | M-Team API key | - |
| `MT_USER_ID` | User ID for seeding/leeching status | - |
| `MT_SITE_URL` | M-Team website URL | `https://kp.m-team.cc` |
| `REFRESH_INTERVAL` | Auto refresh interval (seconds) | `600` |
| `API_DELAY` | API request delay (seconds) | `1` |
| `RIVAL_USER_ID` | Rival user ID for ratio comparison | - |
| `PUSHPLUS_TOKEN` | PushPlus WeChat push token | - |
| `QBITTORRENT_URL` | qBittorrent Web UI URL | `http://192.168.x.x:8080` (use NAS IP) |
| `QBITTORRENT_USER` | qBittorrent Web UI username | `admin` |
| `QBITTORRENT_PASSWORD` | qBittorrent Web UI password | `adminadmin` |

### Get API Token

1. Login to M-Team website
2. Go to "Control Panel" → "Laboratory" → "Access Token"
3. Create new token and copy

### Get User ID

1. Login to M-Team website
2. Click username to enter profile page
3. The number in URL is your User ID
   - Example: `https://kp.m-team.cc/userdetails.php?id=123456`
   - User ID = `123456`

### Get PushPlus Token

1. Visit https://www.pushplus.plus/
2. Login with WeChat (scan QR code)
3. Copy the token from your dashboard

### Configure qBittorrent Web UI

1. Open qBittorrent
2. Go to "Tools" → "Options" → "Web UI"
3. Check "Enable the Web User Interface (Remote control)"
4. Set port (default 8080)
5. Set username and password
6. Click "OK" to save

**Note:** Auto-delete feature requires qBittorrent Web UI configuration. When free time remaining < 10 minutes or free status changes to non-free while download is incomplete, the system will automatically delete the torrent and files from qBittorrent. Auto-delete works independently of PushPlus - no push token required.

---

## API Endpoints

### Get Torrent List

```
GET /api/torrents
```

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `discount` | Discount type: `FREE`, `_2X_FREE` |
| `min_size` | Minimum size (bytes) |
| `max_size` | Maximum size (bytes) |
| `category` | Category ID |
| `mode` | Channel: `normal`, `adult` |

**Example:**

```bash
curl "http://localhost:5001/api/torrents?discount=FREE&mode=normal"
```

### Manual Refresh

```
POST /api/refresh
```

### Download Torrent (Free Hunter)

```
POST /api/download
Content-Type: application/json

{
    "id": "torrent_id"
}
```

Downloaded torrents are tagged with `免费做种`

### Auto-Delete Control

**Get auto-delete status:**

```
GET /api/auto-delete/status
```

Response example:
```json
{
    "enabled": false,
    "qbittorrent_configured": true
}
```

**Toggle auto-delete status:**

```
POST /api/auto-delete/toggle
```

Response example:
```json
{
    "success": true,
    "enabled": true,
    "message": "自动删除已启用"
}
```

### Search Engine

```
GET /search
```
Access Search Engine page

**Search torrents:**

```
POST /api/search
Content-Type: application/json

{
    "keyword": "search keyword",
    "mode": "movie",
    "page": 1
}
```

**Download from Search Engine:**

```
POST /api/search/download
Content-Type: application/json

{
    "id": "torrent_id"
}
```
Downloaded torrents are tagged with `个人下载`

**Get filter options:**

```
GET /api/filter-options
```

### Health Check

```
GET /health
```

---

## Docker Deployment

### Using Docker Compose

```yaml
services:
  mt-engine:
    build: .
    container_name: mt-engine
    restart: unless-stopped
    ports:
      - "5001:5001"
    environment:
      - MT_TOKEN=${MT_TOKEN}
      - MT_USER_ID=${MT_USER_ID}
      - MT_SITE_URL=${MT_SITE_URL:-https://kp.m-team.cc}
      - REFRESH_INTERVAL=${REFRESH_INTERVAL:-600}
      - API_DELAY=${API_DELAY:-1}
      - RIVAL_USER_ID=${RIVAL_USER_ID:-}
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "python", "-c", "import httpx; httpx.get('http://localhost:5001/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### Common Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Rebuild
docker-compose build --no-cache

# Restart
docker-compose restart
```

---

## Local Development

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run

```bash
# Set environment variables
export MT_TOKEN=your_token
export MT_USER_ID=your_user_id

# Start service
python -m uvicorn app.main:app --host 0.0.0.0 --port 5001 --reload
```

---

## Project Structure

```
MT-Engine/
├── app/
│   ├── main.py              # Main application
│   ├── static/
│   │   ├── favicon.png      # Browser icon
│   │   ├── seeder-logo.png  # Free Hunter logo
│   │   └── search-logo.png  # Search Engine logo
│   └── templates/
│       ├── index.html       # Free Hunter page
│       └── search.html      # Search Engine page
├── docker-compose.yml       # Docker Compose config
├── Dockerfile               # Docker build file
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variables example
├── .gitignore               # Git ignore file
└── README.md                # Documentation
```

---

## Tech Stack

- **Backend**: Python 3.9+, FastAPI, httpx
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Template**: Jinja2
- **Container**: Docker, Docker Compose

---

## FAQ

### Q: Why are adult torrents not showing?
A: Make sure your M-Team account has adult content permission enabled.

### Q: API Token error 401?
A: Please check if the token is correct, or try regenerating it.

### Q: How to change refresh interval?
A: Modify the `REFRESH_INTERVAL` value in `.env` file (unit: seconds).

---

## Changelog

### v2.3.1 (2026-01)
- Simplified qBittorrent URL configuration for Docker users
- Changed default URL from `localhost:8080` to `192.168.x.x:8080` placeholder
- Removed `host.docker.internal` references to simplify setup
- Added clear warning that `localhost` won't work in Docker environment

### v2.3.0 (2026-01)
- Improved qBittorrent configuration documentation
- Added qBittorrent environment variables to `docker-compose.yml`
- Added qBittorrent setup instructions to installation guide with Docker network tips

### v2.2.0 (2026-01)
- New Nothing OS Design System (minimalist industrial style)
- Three-tier font hierarchy: DotGothic16 (headers), Roboto Mono (data), Inter (body)
- Added source filter (Web-DL, Bluray, Remux, HDTV, DVD)
- Search Engine: Expandable row details showing quality metadata (resolution, codecs, audio, source, team)
- Optimized qBittorrent session caching (30-minute TTL, reduced login overhead)
- Improved mobile responsive design (optimized card layout)
- Optimized hover effects (mouse devices only, touch-optimized)
- New quality tag display system
- Logo switcher (Free Hunter ⇄ Search Engine)
- Industrial-style toggle switch (auto-delete feature)
- Status dot animations (pulse effect)
- Filter reset button (smart visibility)
- Filter count badge

### v2.1.0 (2026-01)
- Fix search page infinite loading spinner (removed unused sortSelect references)
- Fix mobile navbar overflow (hide stats on mobile)
- Fix mobile hover button background color issue
- Search Engine: Remove sort dropdown, simplify interface

### v2.0.0 (2026-01)
- Major update: New Search Engine feature
- Support Movie/TV/Adult content search
- Advanced filters: Resolution, Video Codec, Audio Codec
- One-click download to qBittorrent (with tag classification)
- Free Hunter download tag: `免费做种`
- Search Engine download tag: `个人下载`
- New "Nothing OS" style interface design
- Dual logo navigation switcher

### v1.5.4 (2025-12)
- Remove info icon from mobile filter drawer
- Fix toggle color consistency (changed from green to blue to match other filter buttons)
- Add last refresh time display in footer
- Simplify PushPlus alert templates for better readability

### v1.5.3 (2025-12)
- Fix auto-refresh interval: now more accurate (accounts for fetch time)
- Improve .env.example docs: add Docker network config notes (host.docker.internal)
- Add refresh timing log output

### v1.5.2 (2025-12)
- Auto-delete now works independently of PushPlus (no push token required)
- Fix: Free torrent history tracking works even without PUSHPLUS_TOKEN configured

### v1.5.1 (2025-12)
- Auto-delete trigger optimization: deletes when free time < 10 minutes remaining (safer)
- Auto-delete now removes both torrent and files (frees storage space)
- PushPlus notifications include deletion result (success/failure/not found)

### v1.5.0 (2025-12)
- qBittorrent Web UI integration
- Auto-delete feature: automatically delete incomplete torrents when free status changes
- Match torrents in qBittorrent by M-Team ID
- iOS-style toggle switch in UI
- Auto-delete status notification

### v1.4.1 (2025-12)
- Fix remaining free time not updating in real-time (now counts down every second)
- Countdown automatically decreases based on elapsed time since page load
- Status colors automatically update as time progresses

### v1.3.1 (2025-12)
- Fix free torrent search limit issue (pageSize 100→200)
- Fix some seeding/leeching torrent status not displaying

### v1.3.0 (2025-12)
- PushPlus WeChat push notification feature
- Free expiring alert (downloading torrents < 10 minutes remaining)
- Free-to-paid change alert (defection detection)

### v1.2.0 (2025-12)
- Tablet responsive: auto horizontal scroll on medium screens
- Back to top button
- Filter bar not sticky on mobile

### v1.1.0 (2025-12)
- Security hardening: XSS protection, input validation, rate limiting, security headers
- Docker runs as non-root user
- Share ratio comparison with rival
- User stats display (ratio, upload, download)
- Download progress ring display
- Fix progress ring disappearing after language toggle

### v1.0.0 (2025-12)
- Initial release
- Support Free/2xFree torrent search
- Support Normal and Adult sections
- Multi-dimensional filtering
- Chinese/English bilingual support
- Dark/Light theme
- Docker deployment support

---

## License

MIT License

---

## Disclaimer

This project is for learning and research purposes only. Do not use it for any commercial or illegal purposes. Please follow M-Team's terms of service when using this tool.

---

## Contributing

Issues and Pull Requests are welcome!

---

**Made with love for M-Team users**
