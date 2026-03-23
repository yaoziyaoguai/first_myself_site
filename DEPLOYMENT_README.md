# 部署基础设施说明

本项目包含完整的部署基础设施，用于将应用部署到 Aliyun ECS。

## 📁 文件结构

```
├── Dockerfile                 # Docker 构建配置
├── .dockerignore             # Docker 构建忽略文件
├── docker-compose.yml        # Docker Compose 配置
├── nginx.conf                # Nginx 反向代理配置
├── deploy.sh                 # 部署脚本
├── ALIYUN_DEPLOYMENT.md      # 详细部署指南
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions CI/CD 工作流
└── scripts/
    ├── backup.sh            # 备份脚本
    └── health-check.sh      # 健康检查脚本
```

## 🚀 快速开始

### 本地测试

```bash
# 1. 构建 Docker 镜像
docker build -t mysites-app:latest .

# 2. 启动本地 Docker 环境
docker-compose up -d

# 3. 验证应用
curl http://localhost:3000

# 4. 查看日志
docker-compose logs -f app
```

### 部署到 Aliyun ECS

```bash
# 1. 设置环境变量
export DOMAIN="yourdomain.com"
export REMOTE_HOST="your-ecs-ip"
export PAYLOAD_SECRET=$(openssl rand -base64 32)
export ADMIN_SECRET_TOKEN=$(openssl rand -hex 32)
export NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 2. 检查前置条件
./deploy.sh check

# 3. 完整部署（包括 SSL 证书和备份）
./deploy.sh full-deploy
```

## 📋 配置说明

### Docker 配置

**Dockerfile 特点：**
- 多阶段构建，优化镜像大小
- 基于 Node 18 Alpine（轻量级）
- 包含健康检查
- 生产就绪

**docker-compose.yml 包含：**
- Next.js 应用服务
- Nginx 反向代理
- Certbot SSL 证书管理（可选）
- 数据卷持久化

### Nginx 配置

**功能：**
- HTTP 到 HTTPS 自动重定向
- SSL/TLS 安全配置（TLSv1.2+）
- 安全头部（CSP, HSTS, X-Frame-Options）
- Gzip 压缩
- 静态资源缓存（365 天）
- 代理到 Node.js 应用
- 上传文件大小限制（50MB）

## 🔧 脚本说明

### deploy.sh - 主部署脚本

**命令：**
```bash
./deploy.sh {check|setup|build|deploy|ssl|backup|status|rollback|full-deploy}
```

**常用命令：**
- `check` - 检查前置条件
- `setup` - 初始化远程服务器（一次性）
- `build` - 构建本地 Docker 镜像
- `deploy` - 部署应用到远程
- `ssl` - 配置 SSL 证书
- `backup` - 创建备份
- `status` - 显示部署状态
- `rollback` - 回滚到上一个版本
- `full-deploy` - 完整部署流程

### scripts/backup.sh - 自动备份

**功能：**
- 备份应用数据和配置
- 自动清理旧备份（保留最近 7 个）
- 记录备份时间戳

**安装到 Crontab：**
```bash
# 每天凌晨 2 点备份
0 2 * * * /opt/mysites-app/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### scripts/health-check.sh - 健康检查

**检查项：**
- 应用 HTTP 响应状态
- Docker 容器运行状态
- CPU/内存/磁盘使用率
- 网络连通性
- SSL 证书有效期
- 应用日志中的错误

**用法：**
```bash
./scripts/health-check.sh https://yourdomain.com
```

## 🔐 安全建议

### 环境变量

必须设置以下环境变量（不要硬编码）：
- `PAYLOAD_SECRET` - Payload CMS 密钥
- `ADMIN_SECRET_TOKEN` - 管理员创建令牌
- `NEXTAUTH_SECRET` - NextAuth.js 密钥
- `NODE_ENV` - 设置为 `production`

### SSH 安全

```bash
# 1. 使用强密钥
ssh-keygen -t rsa -b 4096

# 2. 限制 SSH 访问
# 在 /etc/ssh/sshd_config 中配置：
# PermitRootLogin no
# PasswordAuthentication no
# AllowUsers deploy-user
```

### 防火墙规则

```bash
# 仅允许必要的端口
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
```

## 📊 监控

### 实时监控

```bash
# 查看容器日志
docker-compose logs -f app

# 监控系统资源
docker stats

# 查看 Nginx 访问日志
docker-compose logs -f nginx
```

### 定期检查

```bash
# 每 5 分钟检查一次应用健康状态
*/5 * * * * /opt/mysites-app/scripts/health-check.sh

# 每周检查一次磁盘空间
0 3 * * 0 df -h >> /var/log/disk-usage.log
```

## 📈 CI/CD 集成

GitHub Actions 工作流（`.github/workflows/deploy.yml`）提供：

**自动化流程：**
1. 推送代码到 main 分支
2. 自动运行测试和构建
3. 构建 Docker 镜像
4. 推送到 Docker Hub
5. 自动部署到 Aliyun ECS
6. 运行安全扫描
7. 发送 Slack 通知

**所需 GitHub Secrets：**
```
ALIYUN_PROD_HOST           # ECS 公网 IP
ALIYUN_PROD_USER           # SSH 用户名
ALIYUN_PROD_SSH_KEY        # SSH 私钥
PAYLOAD_SECRET             # Payload 密钥
ADMIN_SECRET_TOKEN         # Admin 令牌
NEXTAUTH_SECRET            # NextAuth 密钥
PROD_DOMAIN                # 生产域名
DOCKER_USERNAME            # Docker Hub 用户名
DOCKER_PASSWORD            # Docker Hub 密码
SLACK_WEBHOOK_URL          # Slack 通知 URL（可选）
```

## 🐛 故障排查

### 常见问题

**问题：容器无法启动**
```bash
# 检查日志
docker-compose logs app

# 检查环境变量
docker-compose config

# 重新构建镜像
docker-compose build --no-cache
```

**问题：磁盘空间不足**
```bash
# 清理 Docker 系统
docker system prune -a

# 检查磁盘使用
du -sh /opt/mysites-app/*
```

**问题：SSL 证书过期**
```bash
# 手动续期
sudo certbot renew --force-renewal

# 检查续期日志
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

## 📚 相关文档

- [详细部署指南](./ALIYUN_DEPLOYMENT.md) - 完整的分步部署说明
- [安全指南](./SECURITY.md) - 安全最佳实践
- [本地测试指南](./LOCAL_TEST.md) - 本地测试步骤
- [环境变量配置](./lib/env.ts) - 环境变量验证

## 🔄 版本和更新

### 检查更新
```bash
# 查看容器当前版本
docker-compose ps

# 查看镜像标签
docker image ls | grep mysites
```

### 更新应用
```bash
# 拉取最新代码
git pull origin main

# 构建新镜像
docker-compose build

# 重启服务
docker-compose up -d
```

## 💾 备份和恢复

### 创建备份
```bash
/opt/mysites-app/scripts/backup.sh
```

### 恢复备份
```bash
# 查看可用备份
ls -la /opt/backups

# 恢复指定备份
cd /opt/mysites-app
tar -xzf /opt/backups/backup_20240120_020000.tar.gz
docker-compose restart
```

## 📞 获取帮助

如有问题，请参考：
1. [ALIYUN_DEPLOYMENT.md](./ALIYUN_DEPLOYMENT.md) - 详细故障排查
2. 检查应用日志：`docker-compose logs app`
3. 检查系统日志：`journalctl -xe`
4. 官方文档：
   - [Aliyun ECS 文档](https://help.aliyun.com/document_detail/25383.html)
   - [Docker 文档](https://docs.docker.com/)
   - [Next.js 部署指南](https://nextjs.org/docs/deployment)

## 📝 更新日志

### v1.0.0 (2024-01-20)
- 初始版本
- 包含 Docker、docker-compose、Nginx 配置
- 完整的部署脚本和文档
- GitHub Actions CI/CD 集成
- 备份和健康检查脚本

## 📄 许可证

该项目采用 MIT 许可证。详见 LICENSE 文件。
