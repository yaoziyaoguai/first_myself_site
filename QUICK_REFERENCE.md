# 快速参考指南

## 🚀 常用命令速查

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 本地测试 Docker
docker build -t mysites-app:latest .
docker-compose up -d

# 查看日志
docker-compose logs -f app
```

### 部署到 Aliyun

```bash
# 环境变量设置
export DOMAIN="yourdomain.com"
export REMOTE_HOST="your-ecs-ip"
export PAYLOAD_SECRET=$(openssl rand -base64 32)
export ADMIN_SECRET_TOKEN=$(openssl rand -hex 32)
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export SSH_KEY="$HOME/.ssh/aliyun_deploy"

# 首次部署
./deploy.sh full-deploy

# 后续部署（仅更新应用）
./deploy.sh deploy
```

### 远程操作

```bash
# SSH 连接
ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 启动服务
docker-compose up -d
```

### 备份和恢复

```bash
# 创建备份
/opt/mysites-app/scripts/backup.sh

# 列出备份
ls -la /opt/backups

# 恢复备份
cd /opt/mysites-app
tar -xzf /opt/backups/backup_YYYYMMDD_HHMMSS.tar.gz
docker-compose restart
```

### 监控和维护

```bash
# 健康检查
./scripts/health-check.sh https://yourdomain.com

# 查看资源使用
docker stats

# 查看磁盘使用
df -h
du -sh /opt/mysites-app

# 查看系统负载
top
uptime
```

## 🔐 安全检查清单

部署前必须检查：

- [ ] 环境变量已设置（不要硬编码）
- [ ] SSH 密钥权限正确（600）
- [ ] ECS 安全组规则配置（80/443/22）
- [ ] 域名 DNS 已解析
- [ ] SSL 证书已申请
- [ ] 数据库备份已创建
- [ ] 日志目录权限正确

## 🐛 快速故障排查

### 问题：应用无响应

```bash
# 1. 检查容器是否运行
docker-compose ps

# 2. 查看应用日志
docker-compose logs app

# 3. 检查 Nginx 日志
docker-compose logs nginx

# 4. 测试应用连接
curl -I http://localhost:3000

# 5. 检查端口占用
netstat -an | grep LISTEN
```

### 问题：内存溢出

```bash
# 1. 检查内存使用
free -h

# 2. 查看进程内存
docker stats

# 3. 增加堆内存大小
# 编辑 docker-compose.yml，添加：
# environment:
#   - NODE_OPTIONS=--max-old-space-size=1024

docker-compose restart
```

### 问题：磁盘满

```bash
# 1. 检查磁盘使用
df -h

# 2. 查看大文件
du -sh /* | sort -rh | head -10

# 3. 清理 Docker
docker system prune -a

# 4. 清理日志
docker-compose logs --no-log-prefix app > /dev/null
```

### 问题：SSL 证书过期

```bash
# 1. 检查证书有效期
openssl x509 -enddate -noout -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem

# 2. 手动续期
sudo certbot renew --force-renewal

# 3. 重启 Nginx
docker-compose restart nginx
```

## 📊 关键配置文件

| 文件 | 用途 | 位置 |
|------|------|------|
| `.env` | 环境变量 | `/opt/mysites-app/.env` |
| `docker-compose.yml` | 容器编排 | `/opt/mysites-app/` |
| `nginx.conf` | 反向代理 | `/opt/mysites-app/` |
| 应用日志 | 应用日志 | `docker-compose logs` |
| Nginx 日志 | 访问日志 | `docker-compose logs nginx` |
| 备份 | 数据备份 | `/opt/backups/` |

## 📞 常用文档链接

- **部署指南**：[ALIYUN_DEPLOYMENT.md](./ALIYUN_DEPLOYMENT.md)
- **部署基础设施**：[DEPLOYMENT_README.md](./DEPLOYMENT_README.md)
- **安全指南**：[SECURITY.md](./SECURITY.md)
- **本地测试**：[LOCAL_TEST.md](./LOCAL_TEST.md)
- **环境变量**：[.env.example](./.env.example)

## ⏰ 定期维护任务

### 每日
- 检查应用日志是否有错误
- 监控磁盘使用情况

### 每周
- 检查 SSL 证书有效期
- 审查访问日志
- 验证备份是否成功

### 每月
- 更新系统包
- 检查依赖安全更新
- 清理旧备份和日志

### 每季度
- 全面系统审计
- 性能优化检查
- 容量规划评估

## 🚨 紧急操作

### 应用崩溃恢复

```bash
# 1. 立即重启
docker-compose restart app

# 2. 查看错误日志
docker-compose logs app | tail -50

# 3. 如果问题仍存在，回滚到上一个版本
./deploy.sh rollback
```

### 磁盘满导致服务中断

```bash
# 1. 停止应用
docker-compose down

# 2. 删除旧备份或日志
rm -f /opt/backups/backup_*.tar.gz  # 谨慎操作！

# 3. 清理 Docker
docker system prune -a

# 4. 重启应用
docker-compose up -d
```

### 安全事件响应

```bash
# 1. 立即隔离
docker-compose down

# 2. 检查日志
docker-compose logs app > /tmp/incident.log

# 3. 验证备份完整性
ls -la /opt/backups

# 4. 联系安全团队
# ... 按照安全事件处理流程
```

## 📝 有用的 SSH 别名

在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
# Aliyun ECS 相关
alias ecs-connect='ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip'
alias ecs-logs='ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "cd /opt/mysites-app && docker-compose logs -f app"'
alias ecs-status='ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "cd /opt/mysites-app && docker-compose ps"'
alias ecs-health='ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "/opt/mysites-app/scripts/health-check.sh"'
alias ecs-backup='ssh -i ~/.ssh/aliyun_deploy root@your-ecs-ip "/opt/mysites-app/scripts/backup.sh"'
```

使用方法：
```bash
ecs-connect           # 连接到 ECS
ecs-logs             # 查看应用日志
ecs-status           # 查看容器状态
ecs-health           # 运行健康检查
ecs-backup           # 创建备份
```

## 🎯 下一步

1. 阅读 [ALIYUN_DEPLOYMENT.md](./ALIYUN_DEPLOYMENT.md) 了解完整部署流程
2. 设置 GitHub Actions secrets 进行自动部署
3. 配置 Slack 通知接收部署状态
4. 设置定期备份和健康检查
5. 配置日志收集和监控告警

---

**最后更新：** 2024-01-20
**维护者：** DWEngineer
