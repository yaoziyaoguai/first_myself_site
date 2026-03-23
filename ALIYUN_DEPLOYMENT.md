# Aliyun ECS 部署指南

## 目录
1. [前置条件](#前置条件)
2. [准备工作](#准备工作)
3. [本地构建](#本地构建)
4. [ECS 实例配置](#ecs-实例配置)
5. [部署步骤](#部署步骤)
6. [SSL 证书配置](#ssl-证书配置)
7. [监控和维护](#监控和维护)
8. [常见问题](#常见问题)
9. [回滚步骤](#回滚步骤)

## 前置条件

### 必需资源
- Aliyun 账户，已购买 ECS 实例
- 已配置的域名（DNS 已指向 ECS IP）
- 本地 Docker 环境
- SSH 密钥对
- GitHub 账户（用于 CI/CD）

### 系统要求
- ECS 实例：
  - 操作系统：Ubuntu 20.04 LTS 或更高版本
  - 配置：至少 1 vCPU, 1GB RAM（推荐 2vCPU, 2GB RAM）
  - 磁盘：至少 20GB 空间
  - 带宽：根据流量需求选择

- 安全组配置：
  - 入站规则：HTTP (80)、HTTPS (443)、SSH (22)
  - 出站规则：全部允许

## 准备工作

### 1. 获取 SSH 密钥

```bash
# 生成新的 SSH 密钥（如果还没有）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/aliyun_deploy

# 将公钥内容复制到 Aliyun 控制台
cat ~/.ssh/aliyun_deploy.pub
```

### 2. 准备环境变量

在项目根目录创建部署用的环境配置：

```bash
# 创建 .env.production 文件
cat > .env.production << 'EOF'
NODE_ENV=production
PAYLOAD_SECRET=your-long-random-secret-key-here
ADMIN_SECRET_TOKEN=your-admin-token-here
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://yourdomain.com
EOF

# 确保文件权限正确
chmod 600 .env.production
```

**生成安全的随机密钥：**

```bash
# 生成 Payload Secret
openssl rand -base64 32

# 生成 ADMIN_SECRET_TOKEN
openssl rand -hex 32

# 生成 NEXTAUTH_SECRET
openssl rand -base64 32
```

### 3. 配置本地部署脚本

```bash
# 编辑 deploy.sh 脚本顶部的配置
export DOMAIN="yourdomain.com"
export EMAIL="admin@yourdomain.com"
export REMOTE_HOST="your-aliyun-eip"  # ECS 公网 IP
export REMOTE_USER="root"  # 或其他用户
export SSH_KEY="$HOME/.ssh/aliyun_deploy"
```

## 本地构建

### 1. 验证代码

```bash
# 安装依赖
npm install

# 运行代码检查
npm run lint

# 类型检查
npm run type-check

# 构建应用
npm run build
```

### 2. 本地 Docker 测试

```bash
# 构建 Docker 镜像
docker build -t mysites-app:latest .

# 测试镜像运行
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e PAYLOAD_SECRET=test-secret \
  -e ADMIN_SECRET_TOKEN=test-token \
  -e NEXTAUTH_SECRET=test-nextauth \
  mysites-app:latest

# 验证应用是否运行
curl http://localhost:3000
```

## ECS 实例配置

### 1. 连接到 ECS 实例

```bash
# 使用 SSH 连接
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip

# 验证连接成功
echo "Successfully connected to ECS"
```

### 2. 初始化系统

```bash
# 更新系统包
sudo apt-get update
sudo apt-get upgrade -y

# 安装必需工具
sudo apt-get install -y \
  curl \
  wget \
  git \
  htop \
  net-tools \
  fail2ban

# 启用防火墙（如需要）
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 3. 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER

# 应用新的用户组（或重新登录）
newgrp docker
```

### 4. 配置目录结构

```bash
# 创建应用目录
sudo mkdir -p /opt/mysites-app
sudo mkdir -p /opt/backups

# 设置目录权限
sudo chown -R $(whoami):$(whoami) /opt/mysites-app
sudo chown -R $(whoami):$(whoami) /opt/backups

# 创建数据目录
mkdir -p /opt/mysites-app/.payload
mkdir -p /opt/mysites-app/public/media
```

## 部署步骤

### 方式 1：使用部署脚本（推荐）

```bash
# 检查前置条件
./deploy.sh check

# 设置远程服务器（一次性）
REMOTE_HOST=your-aliyun-eip \
REMOTE_USER=root \
SSH_KEY=$HOME/.ssh/aliyun_deploy \
./deploy.sh setup

# 构建本地 Docker 镜像
./deploy.sh build

# 部署应用（完整流程）
DOMAIN=yourdomain.com \
EMAIL=admin@yourdomain.com \
PAYLOAD_SECRET=your-secret \
ADMIN_SECRET_TOKEN=your-token \
NEXTAUTH_SECRET=your-nextauth \
REMOTE_HOST=your-aliyun-eip \
REMOTE_USER=root \
SSH_KEY=$HOME/.ssh/aliyun_deploy \
./deploy.sh full-deploy
```

### 方式 2：手动部署

#### 第一步：准备文件

```bash
# 在本地项目目录
mkdir -p deploy-pkg
cp docker-compose.yml deploy-pkg/
cp nginx.conf deploy-pkg/
cp .env.production deploy-pkg/.env

# 创建 Dockerfile（如果还没有）
cp Dockerfile deploy-pkg/
```

#### 第二步：上传到 ECS

```bash
# 使用 scp 上传文件
scp -i ~/.ssh/aliyun_deploy -r deploy-pkg/* root@your-aliyun-eip:/opt/mysites-app/

# 清理本地文件
rm -rf deploy-pkg
```

#### 第三步：在 ECS 上启动服务

```bash
# SSH 连接到 ECS
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip

# 进入应用目录
cd /opt/mysites-app

# 启动 Docker 容器
docker-compose up -d

# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

#### 第四步：验证部署

```bash
# 检查应用是否运行
curl http://localhost:3000

# 查看 Nginx 日志
docker-compose logs -f nginx

# 检查磁盘使用情况
df -h
du -sh .

# 检查内存使用
free -h
```

## SSL 证书配置

### 使用 Let's Encrypt 自动化 SSL

```bash
# SSH 连接到 ECS
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip

# 在 ECS 上执行
cd /opt/mysites-app

# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  -m admin@yourdomain.com \
  -d yourdomain.com \
  -d www.yourdomain.com

# 验证证书
sudo ls -la /etc/letsencrypt/live/yourdomain.com/

# 重新启动 Nginx 使证书生效
docker-compose restart nginx

# 验证 SSL 配置
curl -I https://yourdomain.com

# 配置自动续期
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## 监控和维护

### 1. 日志监控

```bash
# 查看应用日志
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip "cd /opt/mysites-app && docker-compose logs -f app --tail=50"

# 查看 Nginx 日志
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip "cd /opt/mysites-app && docker-compose logs -f nginx --tail=50"

# 查看系统日志
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip "journalctl -xe --tail=50"
```

### 2. 性能监控

```bash
# 连接到 ECS
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip

# 实时监控系统资源
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看容器资源使用
docker stats

# 查看网络连接
netstat -an | grep ESTABLISHED | wc -l
```

### 3. 定期备份

```bash
# 创建备份脚本 /opt/backups/backup.sh
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/opt/backups/backup_$TIMESTAMP.tar.gz"

cd /opt/mysites-app
tar -czf $BACKUP_FILE \
  .payload/ \
  public/media/ \
  .env \
  --exclude=node_modules \
  --exclude=.next

echo "Backup created: $BACKUP_FILE"
# 保留最近 7 天的备份
find /opt/backups -name "backup_*.tar.gz" -mtime +7 -delete

# 添加到 crontab（每天凌晨 2 点备份）
0 2 * * * /opt/backups/backup.sh
```

### 4. 自动更新

```bash
# 使用 GitHub Actions 自动部署（推荐）
# 配置 GitHub Actions secrets：
# - ALIYUN_PROD_HOST: 你的 ECS 公网 IP
# - ALIYUN_PROD_USER: SSH 用户名
# - ALIYUN_PROD_SSH_KEY: SSH 私钥内容
# - PAYLOAD_SECRET: Payload 密钥
# - ADMIN_SECRET_TOKEN: Admin 令牌
# - NEXTAUTH_SECRET: NextAuth 密钥
# - PROD_DOMAIN: 生产域名
# - DOCKER_USERNAME: Docker Hub 用户名
# - DOCKER_PASSWORD: Docker Hub 密码
# - SLACK_WEBHOOK_URL: Slack 通知 URL（可选）

# 当推送到 main 分支时，自动部署
git push origin main
```

## 常见问题

### 问题 1：无法连接到 ECS

**解决方案：**
```bash
# 检查 SSH 密钥权限
chmod 600 ~/.ssh/aliyun_deploy

# 检查 ECS 安全组是否允许 SSH
# 在 Aliyun 控制台检查安全组规则

# 测试连接
ssh -v -i ~/.ssh/aliyun_deploy root@your-aliyun-eip
```

### 问题 2：Docker 容器无法启动

**解决方案：**
```bash
# 检查日志
docker-compose logs app

# 检查环境变量是否正确
docker-compose config

# 重新构建镜像
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 问题 3：SSL 证书申请失败

**解决方案：**
```bash
# 确保域名 DNS 已解析到 ECS IP
dig yourdomain.com

# 检查 80/443 端口是否开放
sudo ufw allow 80
sudo ufw allow 443

# 查看 Certbot 日志
sudo certbot renew --dry-run -v
```

### 问题 4：磁盘空间不足

**解决方案：**
```bash
# 查看磁盘使用情况
df -h

# 清理 Docker 镜像和容器
docker system prune -a

# 压缩日志
docker-compose logs --no-log-prefix app > /dev/null

# 增加 ECS 磁盘空间（在 Aliyun 控制台操作）
```

### 问题 5：应用内存溢出

**解决方案：**
```bash
# 增加 Node.js 堆内存
docker-compose stop
# 编辑 docker-compose.yml，在 app 服务中添加：
# environment:
#   - NODE_OPTIONS=--max-old-space-size=1024

docker-compose up -d

# 升级 ECS 配置（在 Aliyun 控制台操作）
```

## 回滚步骤

### 回滚到上一个版本

```bash
# SSH 连接到 ECS
ssh -i ~/.ssh/aliyun_deploy root@your-aliyun-eip

cd /opt/mysites-app

# 停止当前容器
docker-compose down

# 检查可用的备份
ls -lah /opt/backups

# 恢复备份
BACKUP_FILE="/opt/backups/backup_20240120_020000.tar.gz"
tar -xzf $BACKUP_FILE

# 重新启动服务
docker-compose up -d

# 验证应用状态
curl -I https://yourdomain.com
```

### 使用 Docker 标签回滚

```bash
# 查看 Docker 镜像历史
docker image ls | grep mysites

# 使用之前的镜像版本
docker-compose down
# 编辑 docker-compose.yml，改变镜像标签
# image: mysites-app:20240120-120000
docker-compose up -d
```

## 故障排查清单

- [ ] ECS 实例状态正常
- [ ] SSH 连接成功
- [ ] Docker 和 Docker Compose 已安装
- [ ] 环境变量已正确配置
- [ ] 端口 80、443、3000 已开放
- [ ] DNS 已正确解析
- [ ] SSL 证书已安装
- [ ] 应用日志无错误
- [ ] 磁盘空间充足（> 10GB）
- [ ] 内存充足（> 512MB 可用）
- [ ] 网络连通性良好
- [ ] 备份已创建

## 联系支持

如有问题，请检查以下资源：
- [Aliyun 文档](https://help.aliyun.com/)
- [Docker 文档](https://docs.docker.com/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)
