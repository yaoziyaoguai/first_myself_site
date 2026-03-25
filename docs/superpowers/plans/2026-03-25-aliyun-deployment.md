# 阿里云部署实施计划

> **执行指南：** 本计划应使用 `superpowers:executing-plans` 或 `superpowers:subagent-driven-development` 技能分步骤执行。每个任务是独立的可执行单元，完成后立即验证。

**目标：** 将 Next.js 15 + Payload CMS 全栈应用从本地开发环境部署到阿里云 ECS，配置 SSL/HTTPS、域名解析和自动化运维。

**架构：**
- **本地开发：** 使用 npm 开发模式和 Docker Compose 本地测试
- **阿里云 ECS：** Ubuntu 20.04 + Docker + Docker Compose + Nginx + Let's Encrypt SSL
- **CI/CD 可选：** GitHub Actions 自动部署（第二阶段）
- **数据持久化：** SQLite 数据库和媒体文件存储在 ECS 持久卷

**技术栈：**
- Next.js 15.4.11 + Payload CMS 3.79.0 (Node.js 18+)
- Docker 容器化部署
- Nginx 反向代理（SSL/HTTPS）
- Let's Encrypt 证书管理（自动续期）
- Ubuntu 20.04 LTS

---

## 第一阶段：本地开发环境验证（约 15-20 分钟）

### 任务 1.1：启动本地开发服务

**文件：**
- 项目根目录 `package.json`
- `.env` （已存在）

- [ ] **Step 1.1.1：安装依赖**

```bash
cd /Users/jinkun.wang/work_space/first_myself_site
npm install
```

预期输出：`added X packages` 完成，无错误

- [ ] **Step 1.1.2：验证开发服务启动**

```bash
npm run dev
```

预期输出：
```
> dev
> next dev

  ▲ Next.js 15.4.11
  - Local:        http://localhost:3000
  - Environments: .env

✓ Ready in 2.1s
```

- [ ] **Step 1.1.3：验证应用可访问**

打开新终端标签，运行：
```bash
sleep 3 && curl http://localhost:3000
```

预期输出：返回 HTML 页面内容（非错误页面）

- [ ] **Step 1.1.4：验证 Payload CMS 管理界面**

浏览器访问 `http://localhost:3000/admin`，确保能加载管理页面

- [ ] **Step 1.1.5：提交状态**

在原始终端保持 `npm run dev` 运行，进入下个任务

---

### 任务 1.2：本地构建测试

**文件：**
- `package.json`
- `Dockerfile`

- [ ] **Step 1.2.1：停止开发服务**

```bash
# 在运行 npm run dev 的终端按 Ctrl+C
```

- [ ] **Step 1.2.2：运行 lint 检查**

```bash
npm run lint 2>&1 | head -20
```

预期输出：要么 `Lint passed`，要么返回可修复的警告（不应有 ERROR 阻止构建）

- [ ] **Step 1.2.3：构建生产镜像**

```bash
npm run build
```

预期输出：
```
> build
> next build

✓ Creating an optimized production build
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages (X/X)
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
...
✓ Build complete
```

构建应在 3-5 分钟内完成，无 ERROR

- [ ] **Step 1.2.4：提交进度**

构建成功完成，`.next` 目录已生成

---

## 第二阶段：Docker 镜像构建与本地测试（约 20-25 分钟）

### 任务 2.1：Docker 镜像构建

**文件：**
- `Dockerfile`
- `docker-compose.yml`
- `.env`

- [ ] **Step 2.1.1：生成必要的环境变量**

```bash
cd /Users/jinkun.wang/work_space/first_myself_site

# 生成 Payload Secret
export PAYLOAD_SECRET=$(openssl rand -base64 32)
export ADMIN_SECRET_TOKEN=$(openssl rand -hex 32)
export NEXTAUTH_SECRET=$(openssl rand -base64 32)

echo "PAYLOAD_SECRET=$PAYLOAD_SECRET"
echo "ADMIN_SECRET_TOKEN=$ADMIN_SECRET_TOKEN"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
```

预期输出：打印出三个长随机字符串

💾 **保存这些值，稍后会用在 .env.production 中**

- [ ] **Step 2.1.2：构建 Docker 镜像**

```bash
docker build -t mysites-app:latest .
```

预期输出：
```
...
Successfully built xxxxxxxxx
Successfully tagged mysites-app:latest
```

镜像构建应在 5-10 分钟内完成（首次可能较长）

- [ ] **Step 2.1.3：验证镜像**

```bash
docker image ls | grep mysites-app
```

预期输出：
```
mysites-app   latest   xxxxxxxxx   X minutes ago   XXX MB
```

---

### 任务 2.2：Docker Compose 本地测试

**文件：**
- `docker-compose.yml`
- `Dockerfile`
- `.env`

- [ ] **Step 2.2.1：准备 docker-compose 环境**

```bash
cd /Users/jinkun.wang/work_space/first_myself_site

# 创建必要的目录结构
mkdir -p .payload/media
mkdir -p public/media
mkdir -p nginx
```

- [ ] **Step 2.2.2：检查 nginx.conf 存在**

```bash
ls -la nginx.conf
```

预期输出：文件存在且可读

如果不存在，参考 ALIYUN_DEPLOYMENT.md 中的 nginx 配置创建

- [ ] **Step 2.2.3：启动 Docker Compose**

```bash
docker-compose up -d
```

预期输出：
```
Creating network "first_myself_site_default" with the default driver
Creating first_myself_site_app_1 ... done
Creating first_myself_site_nginx_1 ... done
Creating first_myself_site_certbot_1 ... done
```

- [ ] **Step 2.2.4：等待容器就绪**

```bash
sleep 5 && docker-compose ps
```

预期输出：所有容器状态为 `Up`

```
NAME                             COMMAND                  STATE
first_myself_site_app_1          "npm start"              Up X seconds
first_myself_site_nginx_1        "nginx -g daemon off"    Up X seconds
first_myself_site_certbot_1      "/bin/sh -c 'trap ..."   Up X seconds
```

- [ ] **Step 2.2.5：验证应用响应**

```bash
curl -s http://localhost:3000 | head -20
```

预期输出：返回 HTML（不是错误页）

- [ ] **Step 2.2.6：查看应用日志**

```bash
docker-compose logs app --tail=20
```

预期输出：应看到类似 `Ready in X.XXs` 的启动日志，无 ERROR

- [ ] **Step 2.2.7：验证 Nginx 运行**

```bash
docker-compose logs nginx --tail=10
```

预期输出：Nginx 正常日志，无错误

- [ ] **Step 2.2.8：停止容器用于下一阶段**

```bash
docker-compose down
```

预期输出：
```
Removing first_myself_site_app_1 ... done
Removing first_myself_site_nginx_1 ... done
Removing first_myself_site_certbot_1 ... done
Removing network first_myself_site_default
```

---

## 第三阶段：阿里云 ECS 环境准备（约 30-40 分钟）

### 任务 3.1：ECS 实例初始化

**前置条件：**
- 已有阿里云 ECS 实例（Ubuntu 20.04 LTS，至少 1vCPU 2GB RAM）
- 已有 SSH 密钥对，或使用密码连接
- ECS 安全组已开放 22、80、443 端口
- 已有阿里云购买的域名

**环境：**
- ECS IP: `${REMOTE_HOST}` (例如 `1.2.3.4`)
- SSH 用户：`${REMOTE_USER}` (通常 `root` 或 `ubuntu`)
- SSH 密钥：`${SSH_KEY}` (例如 `~/.ssh/aliyun_deploy`)

- [ ] **Step 3.1.1：测试 SSH 连接**

```bash
export REMOTE_HOST="your-ecs-ip"
export REMOTE_USER="root"
export SSH_KEY="$HOME/.ssh/aliyun_deploy"

# 测试连接
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "echo 'SSH connection successful'"
```

预期输出：`SSH connection successful`

如果失败：
- 检查 SSH 密钥权限：`chmod 600 ~/.ssh/aliyun_deploy`
- 检查 ECS 安全组是否允许 SSH (22 端口)
- 检查 IP 和用户名是否正确

- [ ] **Step 3.1.2：系统更新**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e
echo "[INFO] Updating system packages..."
apt-get update
apt-get upgrade -y
echo "[INFO] System update complete"
EOF
```

预期输出：系统包更新完成

- [ ] **Step 3.1.3：安装基础工具**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
apt-get install -y \
  curl \
  wget \
  git \
  htop \
  net-tools \
  fail2ban \
  zip \
  unzip

echo "[INFO] Basic tools installed"
EOF
```

预期输出：工具安装完成

---

### 任务 3.2：Docker 和 Docker Compose 安装

**文件：** 无

- [ ] **Step 3.2.1：安装 Docker**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e
echo "[INFO] Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# 验证安装
docker --version
echo "[INFO] Docker installed successfully"
EOF
```

预期输出：`Docker version XX.XX.XX`

- [ ] **Step 3.2.2：安装 Docker Compose**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e
echo "[INFO] Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
echo "[INFO] Docker Compose installed successfully"
EOF
```

预期输出：`Docker Compose version XX.XX.XX`

- [ ] **Step 3.2.3：配置 Docker 用户组**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
# 将用户添加到 docker 组（可选，便于无 sudo 运行）
if [ "$REMOTE_USER" != "root" ]; then
  usermod -aG docker $REMOTE_USER
  echo "[INFO] Added $REMOTE_USER to docker group"
fi
EOF
```

预期输出：用户组配置完成

---

### 任务 3.3：创建应用目录和权限配置

**文件：** 无

- [ ] **Step 3.3.1：创建应用目录**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e
echo "[INFO] Creating application directories..."

mkdir -p /opt/mysites-app
mkdir -p /opt/backups
mkdir -p /opt/mysites-app/.payload
mkdir -p /opt/mysites-app/public/media

# 设置权限
chmod 755 /opt/mysites-app
chmod 755 /opt/backups

echo "[INFO] Directories created: /opt/mysites-app"
ls -la /opt/
EOF
```

预期输出：目录创建完成，显示目录列表

---

## 第四阶段：上传应用文件到 ECS（约 10-15 分钟）

### 任务 4.1：准备本地部署包

**文件：**
- `Dockerfile`
- `docker-compose.yml`
- `.env.production` (需新建)
- `nginx.conf`

- [ ] **Step 4.1.1：创建生产环境配置文件**

```bash
cd /Users/jinkun.wang/work_space/first_myself_site

# 创建 .env.production
cat > .env.production << 'EOF'
NODE_ENV=production
PAYLOAD_SECRET=${PAYLOAD_SECRET}
ADMIN_SECRET_TOKEN=${ADMIN_SECRET_TOKEN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXT_PUBLIC_SERVER_URL=https://${DOMAIN}
PAYLOAD_LOG_LEVEL=info
EOF

# 替换占位符（使用前面生成的值）
export DOMAIN="yourdomain.com"  # ⚠️ 替换为你的实际域名
export PAYLOAD_SECRET="your-generated-secret"
export ADMIN_SECRET_TOKEN="your-generated-token"
export NEXTAUTH_SECRET="your-generated-secret"

# 检查文件
cat .env.production
```

预期输出：显示配置文件内容（带实际值）

⚠️ **重要：** 用前面生成的实际值替换占位符

- [ ] **Step 4.1.2：准备上传的文件**

```bash
cd /Users/jinkun.wang/work_space/first_myself_site

# 确认关键文件存在
test -f Dockerfile && echo "✓ Dockerfile exists"
test -f docker-compose.yml && echo "✓ docker-compose.yml exists"
test -f nginx.conf && echo "✓ nginx.conf exists"
test -f .env.production && echo "✓ .env.production exists"
```

预期输出：所有文件都存在

- [ ] **Step 4.1.3：上传文件到 ECS**

```bash
export REMOTE_HOST="your-ecs-ip"
export REMOTE_USER="root"
export SSH_KEY="$HOME/.ssh/aliyun_deploy"
export APP_DIR="/opt/mysites-app"

echo "[INFO] Uploading files to ECS..."

# 上传核心配置文件
scp -i "$SSH_KEY" Dockerfile "$REMOTE_USER@$REMOTE_HOST:$APP_DIR/"
scp -i "$SSH_KEY" docker-compose.yml "$REMOTE_USER@$REMOTE_HOST:$APP_DIR/"
scp -i "$SSH_KEY" nginx.conf "$REMOTE_USER@$REMOTE_HOST:$APP_DIR/"
scp -i "$SSH_KEY" .env.production "$REMOTE_USER@$REMOTE_HOST:$APP_DIR/.env"

echo "[INFO] Files uploaded successfully"
```

预期输出：文件传输完成

- [ ] **Step 4.1.4：验证 ECS 上的文件**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "ls -la $APP_DIR/"
```

预期输出：
```
-rw-r--r-- ... Dockerfile
-rw-r--r-- ... docker-compose.yml
-rw-r--r-- ... nginx.conf
-rw-r--r-- ... .env
```

---

## 第五阶段：ECS 上构建和启动应用（约 25-35 分钟）

### 任务 5.1：构建 Docker 镜像

**文件：**
- 已上传的 `Dockerfile`
- 已上传的 `.env`

- [ ] **Step 5.1.1：在 ECS 上构建镜像**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e
cd /opt/mysites-app

echo "[INFO] Building Docker image on ECS..."
docker build -t mysites-app:latest .

echo "[INFO] Image build complete"
docker image ls | grep mysites-app
EOF
```

预期输出：镜像构建完成，显示镜像信息

⏱️ 首次构建可能需要 15-20 分钟（取决于网络速度）

- [ ] **Step 5.1.2：启动 Docker 容器**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
cd /opt/mysites-app

echo "[INFO] Starting Docker Compose..."
docker-compose up -d

echo "[INFO] Waiting for services to be ready..."
sleep 10

docker-compose ps
EOF
```

预期输出：
```
NAME                      COMMAND               STATUS
mysites-app_app_1         "npm start"           Up X seconds
mysites-app_nginx_1       "nginx -g daemon"     Up X seconds
mysites-app_certbot_1     "/bin/sh -c ..."      Up X seconds
```

---

### 任务 5.2：验证应用运行状态

**文件：** 无

- [ ] **Step 5.2.1：检查应用日志**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
cd /opt/mysites-app

echo "[INFO] Application logs:"
docker-compose logs app --tail=30
EOF
```

预期输出：应看到 `Ready in X.XXs` 启动日志，无 ERROR

- [ ] **Step 5.2.2：测试应用响应**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
echo "[INFO] Testing application response..."
curl -s http://localhost:3000 | head -20
EOF
```

预期输出：返回 HTML 页面内容

- [ ] **Step 5.2.3：检查容器资源使用**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
echo "[INFO] Container resource usage:"
docker stats --no-stream
EOF
```

预期输出：显示容器 CPU 和内存使用情况

---

## 第六阶段：配置域名和 SSL/HTTPS（约 15-20 分钟）

### 任务 6.1：配置阿里云域名 DNS

**前置条件：**
- 已购买的阿里云域名
- 已获取 ECS 的公网 IP

- [ ] **Step 6.1.1：获取 ECS 公网 IP**

```bash
export REMOTE_HOST="your-ecs-ip"  # 这就是公网 IP
echo "ECS Public IP: $REMOTE_HOST"
```

记下这个 IP

- [ ] **Step 6.1.2：在阿里云控制台配置 DNS**

在阿里云域名解析管理中：
1. 登录 [阿里云管理控制台](https://dc.console.aliyun.com)
2. 进入 **域名** → **我的域名**
3. 找到你的域名，点击 **解析**
4. 添加以下记录：

```
记录类型  主机记录  记录值        TTL
A        @        your-ecs-ip   600
A        www      your-ecs-ip   600
```

- [ ] **Step 6.1.3：验证 DNS 解析**

```bash
# 等待 DNS 生效（通常 5-10 分钟）
sleep 30

# 验证 DNS 解析
export DOMAIN="yourdomain.com"  # ⚠️ 替换为实际域名

echo "[INFO] Checking DNS resolution..."
nslookup $DOMAIN
dig $DOMAIN
```

预期输出：显示 DNS 已解析到 ECS IP

---

### 任务 6.2：配置 Let's Encrypt SSL 证书

**文件：**
- `docker-compose.yml`（已上传）
- `nginx.conf`（已上传）

- [ ] **Step 6.2.1：在 ECS 上安装 Certbot**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
set -e
echo "[INFO] Installing Certbot..."

apt-get update
apt-get install -y certbot python3-certbot-nginx

# 验证安装
certbot --version
echo "[INFO] Certbot installed"
EOF
```

预期输出：显示 Certbot 版本

- [ ] **Step 6.2.2：申请 SSL 证书**

```bash
export DOMAIN="yourdomain.com"      # ⚠️ 替换为实际域名
export EMAIL="your@email.com"       # ⚠️ 替换为实际邮箱

ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << EOF
set -e
cd /opt/mysites-app

echo "[INFO] Requesting SSL certificate..."

sudo certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email $EMAIL \
  -d $DOMAIN \
  -d www.$DOMAIN

echo "[INFO] SSL certificate requested"

# 验证证书
sudo ls -la /etc/letsencrypt/live/$DOMAIN/
EOF
```

预期输出：证书申请成功，显示证书文件列表

- [ ] **Step 6.2.3：配置 Nginx SSL**

```bash
export DOMAIN="yourdomain.com"

ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << EOF
set -e
cd /opt/mysites-app

# 更新 nginx.conf 指向 SSL 证书
# 确保 nginx.conf 中包含以下配置：
# ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

# 重启 Nginx
docker-compose restart nginx

echo "[INFO] Nginx restarted with SSL configuration"
sleep 5

# 验证 Nginx 状态
docker-compose logs nginx --tail=10
EOF
```

预期输出：Nginx 正常启动，无错误

- [ ] **Step 6.2.4：验证 HTTPS 访问**

```bash
export DOMAIN="yourdomain.com"

echo "[INFO] Testing HTTPS access..."
curl -I https://$DOMAIN

# 如果出现证书警告，也是正常的（首次部署）
```

预期输出：HTTP/1.1 200 OK 或类似的正常响应

- [ ] **Step 6.2.5：配置证书自动续期**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
echo "[INFO] Configuring automatic certificate renewal..."

# 启用 Certbot 定时任务
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 验证
sudo systemctl status certbot.timer

echo "[INFO] Certificate auto-renewal configured"
EOF
```

预期输出：Certbot timer 已启用并运行

---

## 第七阶段：部署验证与优化（约 10-15 分钟）

### 任务 7.1：完整部署验证

**文件：** 无

- [ ] **Step 7.1.1：测试所有访问方式**

```bash
export DOMAIN="yourdomain.com"

echo "[INFO] Testing HTTP access..."
curl -I http://$DOMAIN

echo "[INFO] Testing HTTPS access..."
curl -I https://$DOMAIN

echo "[INFO] Testing www subdomain..."
curl -I https://www.$DOMAIN
```

预期输出：所有请求返回 HTTP 200

- [ ] **Step 7.1.2：验证应用功能**

使用浏览器访问以下链接：
- `https://yourdomain.com` - 主页
- `https://yourdomain.com/admin` - Payload CMS 管理界面
- `https://yourdomain.com/api/health` 或类似端点 - API 响应

预期：所有页面正常加载，无 SSL 错误

- [ ] **Step 7.1.3：检查容器健康状态**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
cd /opt/mysites-app

echo "[INFO] Checking container health..."
docker-compose ps

# 检查应用日志
docker-compose logs app --tail=20
EOF
```

预期输出：所有容器状态为 `Up`，应用日志无错误

- [ ] **Step 7.1.4：验证磁盘和内存**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
echo "[INFO] System resources:"
df -h | head -5
free -h

echo "[INFO] Container resource usage:"
docker stats --no-stream
EOF
```

预期输出：磁盘使用 < 50%，内存使用正常（< 70%）

---

### 任务 7.2：设置监控和日志

**文件：** 无

- [ ] **Step 7.2.1：创建备份脚本**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
cat > /opt/backups/backup.sh << 'BACKUP_EOF'
#!/bin/bash
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/opt/backups/backup_$TIMESTAMP.tar.gz"

echo "[INFO] Creating backup: $BACKUP_FILE"

cd /opt/mysites-app
tar -czf $BACKUP_FILE \
  .payload/ \
  public/media/ \
  .env \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git

echo "[INFO] Backup created successfully"

# 保留最近 7 天的备份
find /opt/backups -name "backup_*.tar.gz" -mtime +7 -delete
echo "[INFO] Old backups cleaned up"
BACKUP_EOF

chmod +x /opt/backups/backup.sh

echo "[INFO] Backup script created"
EOF
```

预期输出：备份脚本创建完成

- [ ] **Step 7.2.2：配置 Cron 定时备份**

```bash
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
# 添加每日备份任务（每天凌晨 2 点）
(crontab -l 2>/dev/null || echo "") | grep -v "backup.sh" > /tmp/crontab.tmp
echo "0 2 * * * /opt/backups/backup.sh" >> /tmp/crontab.tmp
crontab /tmp/crontab.tmp

# 验证
crontab -l | grep backup
echo "[INFO] Cron backup task configured"
EOF
```

预期输出：显示新增的 cron 任务

- [ ] **Step 7.2.3：设置日志查看命令**

将这些命令保存为本地别名（可选）：

```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
cat >> ~/.zshrc << 'EOF'

# 阿里云部署命令别名
export ALIYUN_HOST="your-ecs-ip"
export ALIYUN_USER="root"
export ALIYUN_KEY="$HOME/.ssh/aliyun_deploy"

alias aliyun-logs-app="ssh -i $ALIYUN_KEY $ALIYUN_USER@$ALIYUN_HOST 'cd /opt/mysites-app && docker-compose logs app -f --tail=50'"
alias aliyun-logs-nginx="ssh -i $ALIYUN_KEY $ALIYUN_USER@$ALIYUN_HOST 'cd /opt/mysites-app && docker-compose logs nginx -f --tail=50'"
alias aliyun-stats="ssh -i $ALIYUN_KEY $ALIYUN_USER@$ALIYUN_HOST 'docker stats --no-stream'"
alias aliyun-ps="ssh -i $ALIYUN_KEY $ALIYUN_USER@$ALIYUN_HOST 'cd /opt/mysites-app && docker-compose ps'"

EOF

source ~/.zshrc
```

---

## 第八阶段：文档和后续维护

### 任务 8.1：更新项目文档

**文件：**
- `README.md` （如存在）
- `DEPLOYMENT_INSTRUCTIONS.md` （可选新建）

- [ ] **Step 8.1.1：记录部署配置**

在项目根目录创建 `DEPLOYMENT_INSTRUCTIONS.md`：

```markdown
# 部署说明

## 生产环境信息

- **域名：** yourdomain.com
- **ECS IP：** your-ecs-ip
- **SSH 用户：** root
- **SSH 密钥：** ~/.ssh/aliyun_deploy
- **应用目录：** /opt/mysites-app
- **备份目录：** /opt/backups

## 常见操作

### 查看日志
\`\`\`bash
ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "cd /opt/mysites-app && docker-compose logs app -f"
\`\`\`

### 重启应用
\`\`\`bash
ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "cd /opt/mysites-app && docker-compose restart app"
\`\`\`

### 手动备份
\`\`\`bash
ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "/opt/backups/backup.sh"
\`\`\`

### 恢复备份
\`\`\`bash
ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "cd /opt/mysites-app && docker-compose down && tar -xzf /opt/backups/backup_YYYYMMDD_HHMMSS.tar.gz && docker-compose up -d"
\`\`\`

## 故障排查

详见 ALIYUN_DEPLOYMENT.md 中的"常见问题"部分。
```

- [ ] **Step 8.1.2：提交部署文档**

```bash
cd /Users/jinkun.wang/work_space/first_myself_site

git add DEPLOYMENT_INSTRUCTIONS.md
git commit -m "docs: add deployment instructions for Aliyun ECS"
```

预期输出：提交成功

---

## 第九阶段：后续优化（可选）

### 任务 9.1：设置 GitHub Actions 自动部署（可选，第二阶段）

**文件：**
- `.github/workflows/deploy.yml` （需新建）

这是可选的自动化步骤，建议在确保手动部署成功后再配置。

参考：ALIYUN_DEPLOYMENT.md 的"自动更新"部分

---

## 验收清单

部署完成后，确保以下项都已完成：

- [ ] 本地开发环境可启动（`npm run dev`）
- [ ] 本地构建成功（`npm run build`）
- [ ] Docker 镜像本地构建成功
- [ ] Docker Compose 本地测试运行正常
- [ ] ECS SSH 连接成功
- [ ] ECS 上 Docker 和 Docker Compose 已安装
- [ ] 应用文件已上传到 ECS
- [ ] 应用容器在 ECS 上正常运行
- [ ] 域名 DNS 已解析到 ECS IP
- [ ] HTTPS 证书已申请并配置
- [ ] 能通过 https://domain.com 访问应用
- [ ] Payload CMS 管理界面可访问
- [ ] 备份脚本已创建并配置定时任务
- [ ] 部署文档已更新
- [ ] 首次完整备份已创建

---

## 故障排查指南

| 问题 | 症状 | 解决方案 |
|------|------|--------|
| SSH 连接失败 | `Permission denied` | 检查密钥权限：`chmod 600 ~/.ssh/aliyun_deploy`，检查 ECS 安全组 |
| Docker 容器无法启动 | `docker-compose up` 失败 | 运行 `docker-compose logs` 查看错误日志 |
| HTTPS 证书申请失败 | Certbot 错误 | 确保 DNS 已解析，80 和 443 端口已开放 |
| 应用内存溢出 | 容器频繁重启 | 增加 docker-compose.yml 中的内存限制 |
| 磁盘空间不足 | `docker-compose up` 失败 | 运行 `docker system prune -a` 清理 |

---

## 相关文档

- [ALIYUN_DEPLOYMENT.md](../../ALIYUN_DEPLOYMENT.md) - 详细部署指南
- [deploy.sh](../../deploy.sh) - 自动化部署脚本
- [docker-compose.yml](../../docker-compose.yml) - Docker 配置
- [Dockerfile](../../Dockerfile) - 镜像定义
- [CLAUDE.md](../../CLAUDE.md) - 项目编码原则
