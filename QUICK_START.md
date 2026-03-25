# 快速启动指南

## 📍 当前状态

### ✅ 已启动的服务

```bash
# 前端开发服务已运行
Next.js 15.4.11 on http://localhost:3001

# 访问你的应用
主页：          http://localhost:3001
管理界面：      http://localhost:3001/admin
```

### 📦 项目结构

```
first_myself_site/
├── app/                          # Next.js 页面和路由
├── components/                   # React 组件
├── content/                       # 博客内容等静态资源
├── lib/                          # 工具函数
├── public/                       # 静态文件
├── src/payload/                  # Payload CMS 配置
│
├── Dockerfile                    # Docker 镜像定义
├── docker-compose.yml            # Docker Compose 编排
├── nginx.conf                    # Nginx 反向代理配置
│
├── .env                          # 开发环境变量
├── .env.production              # 生产环境变量（需新建）
│
├── ALIYUN_DEPLOYMENT.md          # 详细部署指南
├── DEPLOYMENT_PLAN_SUMMARY.md    # 计划总结（当前文件）
├── docs/superpowers/plans/
│   └── 2026-03-25-aliyun-deployment.md  # 完整分步计划
└── deploy.sh                     # 自动化部署脚本
```

---

## 🚀 三种启动方式

### 方式 1：本地开发（已启动 ✓）

```bash
# 启动开发服务
npm run dev

# 访问应用
# 主页：http://localhost:3001
# CMS：http://localhost:3001/admin
```

**特点：** Hot reload，快速开发迭代

---

### 方式 2：本地生产构建测试

```bash
# 构建生产版本
npm run build

# 启动生产服务
npm start

# 访问应用
# http://localhost:3000
```

**特点：** 真实生产环境模拟

---

### 方式 3：Docker Compose（接近生产环境）

```bash
# 构建 Docker 镜像
docker build -t mysites-app:latest .

# 启动 Docker Compose（包含 Nginx + SSL）
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止
docker-compose down
```

**特点：** 与生产环境一致，包含 Nginx 和 SSL

---

## 📝 主要文件说明

### `Dockerfile`
- 多阶段构建，优化镜像大小
- Node.js 18 Alpine 基础镜像
- 输出：3000 端口

### `docker-compose.yml`
- **app 服务**：Next.js + Payload CMS 应用
- **nginx 服务**：反向代理和 SSL 终止
- **certbot 服务**：Let's Encrypt 证书管理
- **持久卷**：`.payload` 和 `public/media`

### `nginx.conf`
- HTTP → HTTPS 重定向
- 反向代理到应用
- gzip 压缩
- 静态文件缓存

### `.env` 和 `.env.production`

**开发环境** (`.env`)
```
NODE_ENV=development
PAYLOAD_SECRET=your-secret-key-at-least-32-characters-long
ADMIN_SECRET_TOKEN=your-admin-secret-token-here
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

**生产环境** (`.env.production`)
```
NODE_ENV=production
PAYLOAD_SECRET=<生成的随机密钥>
ADMIN_SECRET_TOKEN=<生成的随机令牌>
NEXTAUTH_SECRET=<生成的随机密钥>
NEXT_PUBLIC_SERVER_URL=https://yourdomain.com
```

---

## 🔐 安全关键信息

⚠️ **重要：** 这些密钥从不提交到 Git

```bash
# 生成安全随机值
openssl rand -base64 32    # PAYLOAD_SECRET
openssl rand -hex 32       # ADMIN_SECRET_TOKEN
openssl rand -base64 32    # NEXTAUTH_SECRET
```

---

## 📋 完整部署计划

**位置：** `docs/superpowers/plans/2026-03-25-aliyun-deployment.md`

该计划包含：
- 9 个阶段的分步骤任务
- 每个步骤的确切命令
- 预期输出和故障排查
- 验收清单
- 总耗时：约 2-3 小时

---

## ⚡ 快速命令参考

### 开发

```bash
# 启动开发服务
npm run dev

# 代码检查
npm run lint

# 构建生产版本
npm run build

# 启动生产服务
npm start
```

### Docker

```bash
# 构建镜像
docker build -t mysites-app:latest .

# 启动 Compose
docker-compose up -d
docker-compose ps
docker-compose logs app -f

# 停止
docker-compose down
```

### 数据库操作

```bash
# 生成初始数据
npm run seed

# Payload CMS CLI
npm run payload
```

---

## ✅ 部署前检查清单

在推送到阿里云之前，确认：

- [ ] 本地开发正常（`npm run dev`）
- [ ] 构建无错误（`npm run build`）
- [ ] Docker 本地测试通过（`docker-compose up -d`）
- [ ] 所有密钥已正确设置
- [ ] `.env` 和 `.env.production` 已分离
- [ ] 敏感信息不在 Git 中

---

## 🆘 常见问题

### Q: 端口被占用

```bash
# 检查进程
lsof -i :3000
lsof -i :3001

# 杀死进程
kill -9 <PID>
```

### Q: Docker 构建失败

```bash
# 清空缓存重建
docker build --no-cache -t mysites-app:latest .
```

### Q: 忘记环境变量

```bash
# 复制示例
cp .env.example .env

# 编辑并填入正确的值
nano .env
```

---

## 📞 后续步骤

1. **确认信息** - 确保你有：
   - 阿里云 ECS IP
   - SSH 密钥或密码
   - 阿里云域名
   - 邮箱地址

2. **告诉我你的选择**：
   - 希望我自动执行计划？
   - 还是你自己手工执行？

3. **查看完整计划**：
   - `docs/superpowers/plans/2026-03-25-aliyun-deployment.md`

---

## 📚 参考文档

- **ALIYUN_DEPLOYMENT.md** - 阿里云详细部署指南
- **deploy.sh** - 自动化部署脚本
- **CLAUDE.md** - 项目编码原则
- **README.md**（如存在）- 项目说明

---

**现在，请告诉我你想如何继续？** 🚀
