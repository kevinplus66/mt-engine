# MT-Engine 部署指南 (AI Agent 版)

## 你是一个部署助手

当用户让你帮忙部署 MT-Engine 时，请按以下步骤执行。

---

## 第一步：收集用户信息

向用户索要以下信息：

### 1. NAS 连接信息
```
NAS IP 地址:
SSH 用户名:
SSH 密码:
安装路径（如 ~/MT-Engine）:
```

### 2. GitHub 认证（私有仓库）
这是私有仓库，需要 GitHub 认证才能 clone。

**先询问用户：** 你之前在这台 NAS 上部署过 MT-Engine 吗？安装文件夹还在吗？

**如果之前部署过且文件夹还在：**
- 不需要 Token，跳过此步骤
- 部署时用 `git pull` 更新代码即可

**如果是全新安装或已删除旧文件夹：**
需要 GitHub Token，询问用户是否有（以 `ghp_` 开头）

如果没有或忘记了，指导用户创建：
1. 打开 https://github.com/settings/tokens
2. 点击 `Generate new token` → `Generate new token (classic)`
3. Note 填：`MT-Engine`（备注，随便写）
4. Expiration 选：`No expiration`（永不过期）
5. 勾选 `repo`（第一个选项）
6. 点击最下方 `Generate token`
7. **立即复制** `ghp_xxxx...`（只显示一次！）

### 3. 配置文件
请用户复制以下模板，填写后发给你：

```env
# ===== 必填项 =====
# M-Team API Token（从 M-Team → 控制面板 → 实验室 → 存取令牌 获取）
MT_TOKEN=

# ===== 选填项（不需要的留空）=====
# M-Team 用户 ID（从个人主页 URL 获取，用于显示做种状态）
MT_USER_ID=

# qBittorrent 配置（用于一键下载功能）
QBITTORRENT_URL=
QBITTORRENT_USER=
QBITTORRENT_PASSWORD=
DOWNLOADS_PATH=
PILOT_SAVE_PATH=

# 微信推送通知（从 pushplus.plus 获取）
PUSHPLUS_TOKEN=

# 分享率对比（对手的 M-Team 用户 ID）
RIVAL_USER_ID=
```

---

## 第二步：提醒用户配置 Docker 镜像加速

告知用户：在 NAS 系统的 Docker 管理界面中，添加镜像加速源：
```
https://docker.1ms.run
```
（各品牌 NAS 都有图形化设置界面，在「注册表」或「镜像源」中添加）

---

## 第三步：SSH 连接并部署

使用用户提供的 NAS 信息 SSH 连接，然后执行：

```bash
# 1. 获取 PUID 和 PGID
id -u
id -g

# 2. 克隆仓库（私有仓库需要认证）
# 如果用户提供了 GitHub Token：
git clone https://[TOKEN]@github.com/kevinplus66/MT-Engine.git [安装路径]
# 如果 NAS 已配置 SSH key：
# git clone git@github.com:kevinplus66/MT-Engine.git [安装路径]
cd [安装路径]/release

# 3. 创建 .env 文件（用用户填写的配置 + 上面获取的 PUID/PGID）
cat > .env << 'EOF'
PUID=[id -u 的结果]
PGID=[id -g 的结果]
MT_SITE_URL=https://kp.m-team.cc
REFRESH_INTERVAL=300
[用户填写的其他配置项]
EOF

# 4. 启动容器（使用生产模式，会自动构建前端）
docker compose up -d --build

# 5. 验证
docker compose ps
curl http://localhost:5001/health
```

---

## 第四步：告知用户访问地址

部署成功后，告诉用户访问：`http://[NAS的IP]:5001`

---

## 故障排除

| 问题 | 解决方法 |
|------|----------|
| clone 失败 (authentication) | 确认 GitHub Token 正确，或 NAS 已配置 SSH key |
| 镜像拉取失败 | 检查 Docker 镜像加速源是否配置正确 |
| 权限错误 | 确认 PUID/PGID 与当前用户一致（运行 `id` 检查） |
| 端口被占用 | 运行 `netstat -tlnp \| grep 5001` 检查 |
| 容器启动失败 | 运行 `docker compose logs -f` 查看日志 |
| MT_TOKEN 无效 | 确认从 M-Team 控制面板正确复制 |
| Page not found | 运行 `docker compose up -d --build` 重新构建镜像 |

---

## 更新应用

```bash
cd [安装路径]/release
git pull
docker compose down
docker compose build
docker compose up -d
```

---

## 升级/重装（可选）

如果用户已有旧版本 MT-Engine，需要先清理再重新部署。

**先询问用户**：是全新安装还是升级/重装旧版本？

如果是升级/重装，先执行清理：

```bash
# 1. 进入旧安装目录
cd [旧安装路径]

# 2. 停止并删除容器
sudo docker compose down

# 3. 删除旧镜像
sudo docker rmi $(sudo docker images | grep mt-engine | awk '{print $3}') 2>/dev/null

# 4. 删除旧文件夹
cd ~
rm -rf [旧安装路径]

# 5. 确认清理干净
sudo docker ps -a | grep mt-engine  # 应该没有输出
sudo docker images | grep mt-engine  # 应该没有输出
```

清理完成后，回到「第一步：收集用户信息」重新部署。
