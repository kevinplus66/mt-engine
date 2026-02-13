# M-Team Engine (MT 引擎)

![Version](https://img.shields.io/badge/version-6.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Next.js](https://img.shields.io/badge/next.js-16-black.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

M-Team 引擎 - 雷达 RADAR / 声呐 SONAR / 领航 PILOT / 面板 PANEL

---

# 中文文档

## 简介

**M-Team Engine (MT 引擎)** 是一个四功能 M-Team 工具：
1. **声呐 (SONAR)** - 自动追踪 Free/2xFree 限时免费种子
2. **雷达 (RADAR)** - 全能种子搜索，支持高级筛选和一键下载
3. **领航 (PILOT)** - 规则化自动下载和管理免费种子
4. **面板 (PANEL)** - 个人数据仪表盘，可视化历史趋势和统计

### 主要功能

| 功能 |
|------|
| **声呐 (SONAR)** - 自动搜索 Free/2xFree 种子 |
| **雷达 (RADAR)** - 电影/电视剧/成人内容搜索 |
| **领航 (PILOT)** - 规则化自动管理系统 |
| **面板 (PANEL)** - 数据可视化和趋势分析仪表盘 |
| 表格排序功能（支持名称、大小、做种数、时间等） |
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
| **shadcn/ui + Tailwind CSS** 现代化 UI 设计系统 |
| **Framer Motion** 流畅页面过渡动画 |
| **SWR** 智能数据缓存与自动刷新 |
| 响应式设计（桌面/平板/手机）|
| 自动定时刷新 |
| Docker 一键部署 |
| 安全加固（XSS防护、速率限制）|
| PushPlus 微信推送预警 |
| qBittorrent 集成与自动删除 |

### PANEL (面板) - 数据可视化仪表盘

**实时统计卡片：**
- 分享率（带 24 小时趋势线）
- 上传/下载总量（MB/GB/TB）
- 魔力值（魔力值）
- 做种数/下载数
- 用户等级
- 最后更新时间

**历史趋势图表：**
- 上传/下载趋势图（4 线叠加对比 qBittorrent 和 M-Team）
- 每日总量柱状图（过去 30 天）
- 分享率变化折线图（显示最高/最低点）
- 时间范围切换（24H/7D/30D）
- 智能数据聚合（24H=5分钟/7D=1小时/30D=1天）

**技术特性：**
- SQLite 时序数据库（30 天自动清理）
- Tremor 3.18.7 可视化图表库
- UTC 存储，北京时间显示 (Asia/Shanghai, UTC+8)
- 每 5 分钟自动采集数据
- 自动刷新仪表盘
- shadcn/ui + Tailwind CSS 响应式设计

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

# 自动刷新间隔（秒，默认300）
REFRESH_INTERVAL=300

# API 请求间隔（秒，建议3以避免M-Team动态限流）
API_DELAY=3

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

**方法一：直接构建（网络良好时）**

```bash
docker-compose up -d
```

Docker 会自动构建前端和后端，首次构建可能需要 5-10 分钟。

**方法二：本地构建前端（网络不稳定时推荐）**

如果 Docker 拉取 Node.js 镜像失败，可以在本地构建前端：

```bash
# 1. 本地构建前端（需要 Node.js 18+）
cd frontend
npm install
npm run build

# 2. 使用简化的 Dockerfile（只需要 Python）
cd ..
cp Dockerfile.simple Dockerfile

# 3. 启动服务
docker-compose up -d
```

### 5. 访问页面

打开浏览器访问: `http://localhost:5050`

---

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `MT_TOKEN` | M-Team API 密钥 | - |
| `MT_USER_ID` | 用户ID，用于获取做种/下载状态 | - |
| `MT_SITE_URL` | M-Team 网站地址 | `https://kp.m-team.cc` |
| `REFRESH_INTERVAL` | 自动刷新间隔（秒） | `300` |
| `API_DELAY` | API 请求间隔（秒，建议设为 3 避免动态限流） | `3` |
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

### 部署方式说明

MT-Engine v6.0.0 支持两种部署方式：

**方式一：自动构建（推荐，需要稳定网络）**
- Docker 自动下载 Node.js 和 Python 镜像
- 自动构建前端和后端
- 一键部署，无需手动操作
- 首次构建约需 5-10 分钟

**方式二：本地构建（网络不稳定时使用）**
- 在本地 Mac/PC 上构建前端
- 只在 Docker 中运行 Python 后端
- 避免网络问题导致的构建失败
- 详见下方 "方法二" 说明

---

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

**自动构建方式：**
```bash
cd ~/MT-Engine
sudo docker compose up -d
```

**本地构建方式（网络不稳定时）：**

如果遇到 "failed to resolve source metadata for docker.io/library/node" 错误：

```bash
# 1. 在本地 Mac/PC 上构建前端（需要 Node.js 18+）
cd ~/MT-Engine/frontend
npm install
npm run build

# 2. 将构建产物上传到 NAS（如果在 NAS 上操作可跳过）
# 在本地电脑执行：
scp -r out/* 你的用户名@NAS的IP:~/MT-Engine/frontend/

# 3. SSH 到 NAS，使用简化 Dockerfile
ssh 你的用户名@NAS的IP
cd ~/MT-Engine
cp Dockerfile.simple Dockerfile

# 4. 构建并启动
sudo docker compose build
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
      - "5050:5050"
    environment:
      - MT_TOKEN=${MT_TOKEN}
      - MT_USER_ID=${MT_USER_ID}
      - MT_SITE_URL=${MT_SITE_URL:-https://kp.m-team.cc}
      - REFRESH_INTERVAL=${REFRESH_INTERVAL:-300}
      - API_DELAY=${API_DELAY:-3}
      - RIVAL_USER_ID=${RIVAL_USER_ID:-}
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "python", "-c", "import httpx; httpx.get('http://localhost:5050/health')"]
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

## 项目结构

```
MT-Engine/
├── app/                    # FastAPI 后端
│   ├── main.py            # 主应用入口
│   ├── config.py          # 配置管理
│   ├── models.py          # Pydantic 模型
│   ├── state.py           # 全局状态
│   ├── core/              # 核心业务逻辑
│   ├── routes/            # API 路由
│   └── services/          # 外部服务集成
├── frontend/              # Next.js 前端
│   ├── app/              # 页面路由（App Router）
│   ├── components/       # React 组件
│   │   ├── ui/          # shadcn/ui 基础组件
│   │   ├── radar/       # RADAR 专用组件
│   │   ├── sonar/       # SONAR 专用组件
│   │   ├── pilot/       # PILOT 专用组件
│   │   └── panel/       # PANEL 专用组件
│   ├── hooks/           # 自定义 React Hooks
│   ├── lib/             # 工具函数和类型
│   └── providers/       # Context Providers
├── data/                 # 数据目录（SQLite、配置文件）
├── .env                 # 环境变量配置
├── docker-compose.yml   # Docker Compose 配置
├── Dockerfile           # Docker 镜像构建文件
└── requirements.txt     # Python 依赖

```

---

## 开发指南

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 访问 http://localhost:3000
# API 请求会自动代理到后端（默认 http://localhost:5050）

# 构建生产版本
npm run build

# 运行生产版本
npm run start
```

### 后端开发

```bash
# 安装依赖
pip install -r requirements.txt

# 运行开发服务器
cd app
python main.py

# 访问 http://localhost:5050
```

---

## 技术栈

### 后端
- **Python 3.9+** - 核心运行时
- **FastAPI** - 现代异步 Web 框架
- **httpx** - 异步 HTTP 客户端
- **SQLite** - 时序数据存储
- **Pydantic** - 数据验证

### 前端
- **Next.js 16** - React 框架（App Router）
- **React 19** - UI 库
- **TypeScript** - 类型安全
- **Tailwind CSS 4** - 样式系统
- **shadcn/ui** - UI 组件库（基于 Radix UI）
- **SWR** - 数据获取与缓存
- **Framer Motion** - 动画库
- **Tremor** - 数据可视化
- **Lucide React** - 图标库

### 部署
- **Docker** - 容器化
- **Docker Compose** - 编排工具

---

## 常见问题

### Q: 访问页面显示空白或无法连接？

A: 请检查：
1. 容器是否正常运行：`docker compose ps`
2. 端口 5050 是否被占用
3. 防火墙是否允许 5050 端口

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

**方法一：自动构建**
1. 下载新版本文件（保留 `.env` 文件）
2. 重新构建并启动：
```bash
cd ~/MT-Engine
docker compose down
docker compose build --no-cache
docker compose up -d
```

**方法二：本地构建（网络不稳定时）**
1. 在本地 Mac/PC 上构建前端：
```bash
cd MT-Engine/frontend
npm install
npm run build
```
2. 上传构建产物到 NAS：
```bash
scp -r out/* 你的用户名@NAS的IP:~/MT-Engine/frontend/
```
3. SSH 到 NAS 重启容器：
```bash
ssh 你的用户名@NAS的IP
cd ~/MT-Engine
docker compose restart
```

### Q: Docker 构建时提示 "failed to resolve source metadata for node:20-alpine"？

A: 这是网络问题导致无法拉取 Node.js 镜像。解决方案：

1. **使用本地构建**（推荐）：
   - 在本地 Mac/PC 上构建前端（`npm run build`）
   - 使用 `Dockerfile.simple`（只需要 Python 镜像）
   - 详见上方 "方法二：使用命令行" 的本地构建说明

2. **配置 Docker 镜像加速器**：
   - 编辑 `/etc/docker/daemon.json`
   - 添加镜像加速器（如腾讯云、阿里云）
   - 重启 Docker 服务

### Q: 遇到权限错误（Permission denied）怎么办？

A: 如果看到 "Permission denied" 错误，涉及 panel.db 或 pilot.json 文件：

1. 查找主机系统的用户 ID：
```bash
id -u  # 用户 ID（例如：1000）
id -g  # 组 ID（例如：1000）
```

2. 在 `.env` 文件中添加：
```env
PUID=1000   # 替换为你的用户 ID
PGID=1000   # 替换为你的组 ID
```

3. 修复现有数据目录的所有权：
```bash
sudo chown -R $(id -u):$(id -g) ./data
```

4. 重启容器：
```bash
docker compose down && docker compose up -d
```

---

## 更新日志

### v6.0.0 (2026-01) - 前端现代化重构

**🎨 前端技术栈升级**
- **Next.js 16 + React 19 + TypeScript** - 从 Jinja2 + Vanilla JS 迁移到现代前端框架
- **shadcn/ui** - 采用基于 Radix UI 的统一设计系统
- **Tailwind CSS 4** - 现代化样式系统，代码减少 96%
- **SWR** - 智能数据缓存替代 setInterval 轮询
- **Framer Motion** - 流畅的页面过渡动画
- **AutoAnimate** - 列表自动动画效果
- **Tremor** - 专业数据可视化图表库

**⚡ 性能优化**
- 组件级代码分割，按需加载
- 完整的 TypeScript 类型安全
- Fast Refresh 热更新开发体验
- 总代码量减少约 42% (6,000 行 → 3,500 行)

**🚀 部署优化**
- Docker 多阶段构建（或本地构建选项）
- 单容器部署，简化运维
- 镜像大小优化至 ~160MB

### v5.0.0 (2026-01) - PILOT 领航模块
**全新 PILOT 功能**
- 基于规则的自动种子管理系统，专为 M-Team 免费种子设计
- 智能评分引擎：大小、免费时间、种子年龄、做种人数等多维度加权评分
- 磁盘空间检测：自动停止下载防止磁盘满载
- 重复下载防护：防止同一种子多次下载
- 僵尸任务检测：自动删除长时间停滞的下载任务
- H&R 保护：最小做种时间保护，防止 Hit and Run
- 路径隔离：独立下载目录，使用 `PILOT` 标签管理

**安全性**
- HTTP Basic Auth 认证保护（防时序攻击）
- IP 级别速率限制（5次失败/分钟）
- 环境变量存储凭证（不在配置文件中存储）

**前端**
- 全新 `/pilot` 页面，包含仪表板和规则配置标签页

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
