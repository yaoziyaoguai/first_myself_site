# Jinkun Wang 的个人网站

一个基于 Next.js、Payload CMS 和 PostgreSQL 的个人网站，用来记录数据工程、AI 评测与 Agent 系统的学习和实践。

线上地址：<https://wangjinkun333.me>

## 功能

- CMS 优先的首页、关于、项目、文章和联系页面；CMS 内容为空时使用仓库内经过审阅的默认内容
- Payload Admin 内容管理、Markdown 预览和 admin/editor/viewer 权限
- 文章可见性、评论、回复和点赞
- robots、sitemap、RSS、canonical metadata 和数据库就绪检查
- GitHub Actions 检查、Docker Compose 部署和阿里云生产健康验证

## 技术栈

- Next.js 16（App Router）与 React 19
- Payload CMS 3 与 PostgreSQL 15
- Tailwind CSS 4
- Vitest、Testing Library、ESLint、TypeScript
- Docker Compose、Nginx、GitHub Actions、阿里云 ECS

## 本地开发

需要 Node.js 20.9 或更高版本（CI 与生产镜像使用 Node.js 22），以及可访问的 PostgreSQL。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local` 至少需要：

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/first_myself_site
PAYLOAD_SECRET=使用 openssl rand -base64 32 生成
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

`ADMIN_SECRET_TOKEN`、`PAYLOAD_INITIAL_ADMIN_EMAIL` 和 `PAYLOAD_INITIAL_ADMIN_PASSWORD` 只用于显式调用开发环境的初始化接口；仓库不提供默认管理员凭证，生产环境也会拒绝这些接口。

常用检查：

```bash
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm audit --audit-level=high
npm run build
```

## 内容与权限

公开页面优先显示 Payload 中非空的内容。空字符串、空白字符串和空数组才会回退到 `src/content/siteDefaults.ts`，部署不会为了填充页面而修改生产数据库。

文章状态：

- `draft`：不在公开网站展示
- `published + public`：所有访客可见
- `published + private`：仅 admin/editor 登录后可见

后台权限：

- `admin`：进入后台、维护内容、管理用户和角色
- `editor`：进入后台并维护内容，不能管理用户或角色
- `viewer`：不能进入 Payload Admin

评论和点赞的匿名标识由服务端生成。浏览器不会获取原始 IP，也不能提交可信身份字段。Payload collection 的匿名直读直写被关闭，公开接口只返回页面需要的字段。

## 生产架构

```text
访客
  → Nginx :80/:443（TLS 与反向代理，服务器配置不在本仓库）
  → 宿主机 127.0.0.1:3000
  → first_myself_site_prod 容器 :3001
  → postgres_prod 容器 :5432
```

Nginx 必须覆盖客户端传入的代理身份头：

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

应用优先信任由 Nginx 覆盖的 `X-Real-IP`。不要把应用端口直接暴露到公网。

应用和 PostgreSQL 由 `docker/docker-compose.prod.yml` 管理。数据库和媒体分别存放在 `postgres_prod_data` 与 `payload_uploads` 命名卷中。部署会通过本机 HTTPS 向真实 `/api/media` 路径发送 400 KiB 探测请求；文章图片应在上传前优化到该大小以内。

生产环境文件位于服务器仓库根目录的 `.env.docker.prod`，从 `.env.docker.prod.example` 复制。它不应提交到 Git：

```dotenv
POSTGRES_DB=first_myself_site_prod
POSTGRES_USER=payload_prod
POSTGRES_PASSWORD=强随机密码
PAYLOAD_SECRET=强随机密钥
NEXT_PUBLIC_SERVER_URL=https://wangjinkun333.me
```

## GitHub 到阿里云的发布流程

`.github/workflows/ci-cd.yml` 是生产发布入口：

1. Pull Request 运行 clean install、ESLint、TypeScript、Vitest、high audit 和 production build。
2. PR 审阅通过并合并到 `main`。
3. `main` push 通过 SSH 进入阿里云服务器。
4. 服务器对 `main` 做 fast-forward 更新，保留当前镜像作为 rollback，再构建新镜像；部署脚本会确认真实媒体路径接受 400 KiB 请求，但不会改写服务器上的 Nginx 配置。
5. 工作流在 120 秒内轮询 `http://127.0.0.1:3000/api/health`，随后验证公网 HTTPS；任一步失败时自动恢复上一镜像并再次检查健康状态。

GitHub 仓库需要配置以下 Actions secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SSH_PRIVATE_KEY`
- `PROJECT_PATH`：服务器上的仓库绝对路径

不要在服务器上直接修改应用文件。生产代码变更应始终经过 PR、CI、`main` 和部署工作流。

## 健康检查

公开就绪端点：

```bash
curl --fail https://wangjinkun333.me/api/health
```

成功返回 `{"status":"ready"}`。这个结果包含一次最小 Payload 数据库查询，不包含环境变量或数据库细节。

在服务器仓库目录运行完整检查：

```bash
PROJECT_DIR=/srv/first_myself_site ./scripts/health-check.sh
```

脚本检查应用就绪、Compose 容器状态、远端 TLS 证书和磁盘空间。实际 `PROJECT_DIR` 以 GitHub secret `PROJECT_PATH` 为准。

## 备份

`scripts/backup.sh` 从正在运行的 Compose 服务生成：

- PostgreSQL custom-format dump
- `/app/media` 媒体归档

示例：

```bash
PROJECT_DIR=/srv/first_myself_site \
BACKUP_DIR=/srv/backups/first_myself_site \
MAX_BACKUPS=7 \
./scripts/backup.sh
```

脚本不会打包 `.env.docker.prod`，备份文件权限为 `600`。请把备份复制到 ECS 之外的存储，并定期在隔离环境做恢复演练；仓库暂未配置远端备份目标和定时器。

## 运维边界

- Nginx 和证书续期由服务器层维护，当前仓库只验证 HTTPS 和证书结果。
- 如果阿里云对 HTTP 流量显示备案拦截，需要在云平台完成 ICP/网络配置；这不是应用代码或 TLS 证书能够修复的问题。
- 站内访问统计在 Payload 后台的“运营 → 访问统计”中查看；只保存匿名哈希、页面、有效停留和阅读深度，不使用 Cookie，并尊重浏览器的 Do Not Track 设置。
- 第三方 uptime monitoring 和异地备份仍需要另外选择供应商与账号。

## License

MIT
