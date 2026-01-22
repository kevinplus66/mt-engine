# M-Team Engine (MT 引擎)

![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

M-Team 引擎 - 免费种子猎手 + 全能搜索引擎

---

# 中文文档

## 简介

**M-Team Engine (MT 引擎)** 是一个三功能 M-Team 工具：
1. **免费猎手** - 自动追踪 Free/2xFree 限时免费种子
2. **搜索引擎** - 全能种子搜索，支持高级筛选和一键下载
3. **AutoFarm** - 自动农场，规则化自动下载和管理免费种子

### 主要功能

| 功能 |
|------|
| **免费猎手** - 自动搜索 Free/2xFree 种子 |
| **搜索引擎** - 电影/电视剧/成人内容搜索 |
| **AutoFarm** - 规则化自动农场管理系统 |
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

**确保 Docker 已安装：**
- **群晖 (Synology)**：套件中心 → 搜索 Docker 或 Container Manager
- **绿联 (UGREEN)**：应用中心 → 搜索 Docker
- **飞牛 (fnOS)**：应用中心 → 搜索 Docker
- **其他 NAS**：参考 NAS 系统文档安装 Docker

### 1. 克隆仓库

```bash
git clone https://github.com/kevinplus66/MT-Engine.git
cd MT-Engine
```

### 2. 上传文件到 NAS（NAS 用户）

**方法一：使用 NAS 文件管理器（推荐新手）**

1. 在电脑上解压文件（如果是压缩包）
2. 登录 NAS 管理界面
3. 打开文件管理器：
   - 群晖：File Station
   - 绿联：文件管理
   - 飞牛：文件管理器
4. 上传到推荐位置：`/docker/MT-Engine` 或 `/home/你的用户名/MT-Engine`

**方法二：使用 SSH**

```bash
# 在电脑终端执行（需要替换 IP 和用户名）
scp -r MT-Engine 用户名@NAS的IP地址:~/
```

### 3. 配置环境变量

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

### 4. 启动服务

```bash
docker-compose up -d
```

### 5. 访问页面

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

## Docker 部署

### 方法一：使用 NAS Docker 管理界面（推荐新手）

1. 打开 Docker 管理器
   - 群晖：Container Manager（或旧版 Docker 套件）
   - 绿联：Docker 应用
   - 飞牛：Docker 应用

2. 使用 Compose 功能
   - 找到 **Compose** 或 **编排** 功能
   - 点击 **新建** 或 **添加**

3. 选择 docker-compose.yml
   - 浏览到 `MT-Engine` 文件夹
   - 选择 `docker-compose.yml` 文件

4. 启动服务
   - 点击 **部署** 或 **启动**
   - 等待容器构建和启动（首次可能需要 1-2 分钟）

### 方法二：使用命令行

```bash
cd ~/MT-Engine
sudo docker compose up -d
```

### docker-compose.yml 配置示例

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

## 常见问题

### Q: 访问页面显示空白或无法连接？

A: 请检查：
1. 容器是否正常运行：`docker compose ps`
2. 端口 5001 是否被占用
3. 防火墙是否允许 5001 端口

### Q: 页面显示 "未配置 MT_TOKEN"？

A: 说明 `.env` 文件没有正确配置：
1. 确认 `.env` 文件存在（不是 `.env.example`）
2. 确认 MT_TOKEN 的值已正确填写
3. 重启容器：`docker compose restart`

### Q: API Token 报错 401？

A: Token 可能已失效：
1. 去 M-Team 网站重新生成一个新的 Token
2. 更新 `.env` 文件中的 MT_TOKEN
3. 重启容器

### Q: 为什么看不到成人区的种子？

A: 请确保你的 M-Team 账号已开启成人内容权限。

### Q: 如何查看日志排查问题？

A: 执行命令查看实时日志：
```bash
docker compose logs -f
```
按 `Ctrl+C` 退出日志查看。

### Q: 如何更新程序？

A:
1. 下载新版本文件（保留 `.env` 文件）
2. 重新构建并启动：
```bash
cd ~/MT-Engine
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 更新日志

### v5.0.0 (2026-01) - AutoFarm 自动农场模块
**全新 AutoFarm 功能**
- 基于规则的自动种子管理系统，专为 M-Team 免费种子设计
- 智能评分引擎：大小、免费时间、种子年龄、做种人数等多维度加权评分
- 磁盘空间检测：自动停止下载防止磁盘满载
- 重复下载防护：防止同一种子多次下载
- 僵尸任务检测：自动删除长时间停滞的下载任务
- H&R 保护：最小做种时间保护，防止 Hit and Run
- 路径隔离：独立下载目录，使用 `MT_AUTO` 标签管理

**安全性**
- HTTP Basic Auth 认证保护（防时序攻击）
- IP 级别速率限制（5次失败/分钟）
- 环境变量存储凭证（不在配置文件中存储）

**前端**
- 全新 `/automation` 页面，包含仪表板和规则配置标签页

**查看完整更新历史**: [GitHub Releases](https://github.com/kevinplus66/MT-Engine/releases)

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

## English Version

**For English users:** Please use any AI translation tool (ChatGPT, Claude, etc.) to translate this document.

---

**Made with love for M-Team users**
