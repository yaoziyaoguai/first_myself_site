# 个人网站

基于 Next.js + Payload CMS + PostgreSQL 构建的个人博客与作品展示站点。

线上地址：`https://wangjinkun333.me`

---

## 技术栈

- **框架**：Next.js 15（App Router）
- **CMS**：Payload CMS 3.x
- **数据库**：PostgreSQL
- **样式**：Tailwind CSS + shadcn/ui
- **部署**：Nginx + PM2 + Node.js

---

## 主要功能

### Blog
- 文章发布、编辑、管理
- Lexical 富文本编辑器
- 标签系统
- 阅读时长估算
- 文章可见性控制

### Projects
- 项目展示
- 时间线、角色、技术栈记录

### Payload Admin
- 完整的 CMS 后台
- 用户权限管理
- 媒体文件上传管理

### Blog 可见性

文章有三种状态：

- **draft**：草稿，未发布，仅管理员可见
- **published + public**：正式发布，所有访客可见
- **published + private**：正式发布，但仅管理员可见，适合私人笔记

在 Payload Admin 中，可通过 `status` 和 `visibility` 两个字段组合控制文章可见性。

---

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制开发环境模板：

```bash
cp .env.example .env.local
```

编辑 .env.local，填写本地数据库连接和密钥：

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PAYLOAD_SECRET=your_payload_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问：http://localhost:3000

---

## Docker 测试环境

仓库包含 Docker 测试环境配置，用于快速启动隔离的测试环境。

### 1. 准备环境变量

```bash
cp .env.test.example .env.test
```

编辑 .env.test，生成并填写随机密钥：

```bash
openssl rand -base64 32
```

### 2. 启动测试环境

```bash
cd docker
docker-compose -f docker-compose.test.yml --env-file ../.env.test up -d
```

### 3. 访问测试站点

- 应用：http://localhost:3001
- 数据库：localhost:5433（与生产端口 5432 隔离）

### 4. 停止测试环境

```bash
docker-compose -f docker-compose.test.yml down
```

如需清空数据：

```bash
docker-compose -f docker-compose.test.yml down -v
```

---

## 生产环境说明

### 当前生产架构

```
用户 -> Nginx (80/443) -> PM2 -> Next.js/Payload (localhost:3000)
                               |
                               -> PostgreSQL (localhost:5432)
```

### 生产环境变量

生产环境使用 .env.production，至少应包含：

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PAYLOAD_SECRET=your_production_secret
NEXTAUTH_SECRET=your_production_secret
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
```

### 重要提醒

生产环境不要保留 .env.local。

Next.js 会优先读取 .env.local，从而覆盖 .env.production，这可能导致生产环境读取到开发配置，进而引发认证失败、保存失败等问题。

部署前请确认：

```bash
ls .env.local
```

预期应提示文件不存在。
如果存在，请删除：

```bash
rm .env.local
```

---

## 仓库文件说明

### 环境变量文件

| 文件 | 用途 | 是否提交 |
|------|------|----------|
| .env.local | 本地开发 | 否 |
| .env.test | Docker 测试 | 否 |
| .env.production | 生产环境 | 否 |
| .env.example | 开发模板 | 是 |
| .env.test.example | 测试模板 | 是 |

### 模板文件

使用模板时需复制并修改：

- `scripts/backup.sh.example` → `scripts/backup.sh`
- `.env.test.example` → `.env.test`

### Git 忽略规则

以下内容已不应进入仓库：

- 用户上传文件：`media/*`
- 服务器配置：`nginx.conf`
- 环境变量：`.env*`（示例文件除外）
- 依赖和构建输出：`node_modules/`、`.next/`

---

## 后续可改进项

- 添加自动化测试
- 配置 CI/CD
- 生成 Sitemap 和 RSS
- 评论系统
- 文章搜索

---

## License

MIT
