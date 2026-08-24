# Jinkun Wang 的个人网站

[![CI/CD](https://github.com/yaoziyaoguai/first_myself_site/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/yaoziyaoguai/first_myself_site/actions/workflows/ci-cd.yml)

一个记录数据工程、AI 评测和 Agent 系统学习实践的个人网站。定位保持克制：这里不是能力清单，而是持续学习、实验和复盘的公开笔记。

- 线上地址：<https://wangjinkun333.me>
- 后台入口：<https://wangjinkun333.me/admin>
- 生产环境：阿里云 ECS

## 当前能力

- 首页、关于、项目、文章和联系页面由 Payload CMS 管理
- “最近在学习”、项目/实验、外部链接、公开邮箱均可在后台配置，不需要改代码
- 文章支持 Markdown、GFM 表格、任务列表和本地图片
- Markdown 后台提供等宽双栏预览，并按内容锚点双向同步滚动
- 草稿、公开文章和登录可见文章具有独立的可见性规则
- 评论、回复和点赞通过受控接口提供，Payload collection 不向匿名用户直开
- 后台“运营 → 访问统计”展示访问量、估算访客、有效停留和阅读深度
- 公开 Markdown 文章可启用悬浮 Agent，只回答当前 Blog，并可选使用同一文章的私有材料包增强上下文
- sitemap、RSS、canonical metadata 和数据库就绪检查已接入
- GitHub Pull Request 通过 CI 后合并到 `main`，自动部署到阿里云

## 后台内容地图

| 需要修改的内容 | 后台位置 |
| --- | --- |
| 姓名、定位、简介、方向标签、最近在学习 | 页面内容 → 首页与最近学习 |
| 关于页内容、技术栈和关注方向 | 页面内容 → 关于页面 |
| 邮箱、社交链接和站点信息 | 页面内容 → 网站设置 |
| 项目、实验、GitHub 链接和排序 | 内容管理 → 项目与实验 |
| Markdown 文章和图片 | Blog / Media |
| 评论与点赞 | Comments / Likes |
| 匿名访问和停留统计 | 运营 → 访问统计 |

仓库中的 `src/content/siteDefaults.ts` 只在 CMS 对应字段为空时提供兜底内容。部署不会覆盖后台已经编辑的数据。

## 技术栈

- Next.js 16（App Router）与 React 19
- Payload CMS 3.87 与 PostgreSQL 15
- Tailwind CSS 4、shadcn/ui
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

`ADMIN_SECRET_TOKEN`、`PAYLOAD_INITIAL_ADMIN_EMAIL` 和 `PAYLOAD_INITIAL_ADMIN_PASSWORD` 只用于显式调用开发环境初始化接口。仓库不提供默认管理员凭证，生产环境会拒绝这些接口。

常用检查：

```bash
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm audit --audit-level=high
npm run build
```

完整测试范围和手工检查清单见 [TESTING_GUIDE.md](TESTING_GUIDE.md)。

## 发布文章

可以直接在 Payload Admin 中编辑，也可以从任意 Codex 项目调用全局 `publish-site-article` Skill，把 Markdown 和文中引用的本地图片同步到网站。

发布 Skill 的安全约定：

- “上传”或“同步”默认只创建 `draft + private`
- 只有明确要求公开发布时才会改变公开状态
- 图片会生成稳定文件名，重复运行可以复用已有媒体
- 已存在的 slug 默认停止，避免误覆盖线上文章
- 凭据只从本机环境变量或系统 Keychain 读取，不进入仓库

推荐流程：先生成文章 → 本地预检 → 上传草稿 → 后台校对 → 明确公开发布。

## 权限与隐私

文章状态：

- `draft`：不在公开网站展示
- `published + public`：所有访客可见
- `published + private`：仅 admin/editor 登录后可见

后台权限：

- `admin`：维护内容、管理用户和角色、删除访问记录
- `editor`：维护内容并查看访问统计，不能管理用户或角色
- `viewer`：不能进入 Payload Admin

访问统计不使用 Cookie，尊重 Do Not Track 和 Global Privacy Control。系统只保留经 HMAC 处理的匿名标识、页面、来源域名、有效停留和最大阅读深度，不保存原始 IP。

## 单文章 Blog Agent

Blog Agent 始终以一篇 Blog 为唯一的数据与安全边界。机器人只出现在 `published + public` 且包含 Markdown 的文章页；服务端根据 URL slug 重新读取当前文章。请求体包含一个 1～500 字符的问题，并可携带当前文章最近 3 轮、经过长度和结构校验的追问历史；历史只帮助理解“它”“这个方案”等指代，不能充当事实证据。Markdown 永远是基础上下文，可选文章包只补充同一 Blog 的代码、文档、数据或图片说明，不会跨文章搜索。

浏览器只在当前标签页的 `sessionStorage` 中保留每篇文章最近 8 轮已完成对话，关闭面板或刷新后仍可继续，访客也可以显式清空。历史按 slug 隔离，不会同步到服务器、其他文章、其他标签页或其他设备；服务端仍会重新校验文章范围、历史边界和引用 URL。

文章包由全局发布 Skill 离线生成，并通过 admin/editor 认证接口写入私有 PostgreSQL 表。包必须来自 Git `HEAD` 中已跟踪且干净的文件，受 source 数量、大小、chunk 数、hash 和敏感信息扫描约束。选入 source 也代表允许 Agent 向匿名访客展示与问题直接相关的有界短摘录；完整文件导出、连续大段复述和跨文章内容仍会被拒绝。索引未 ready 或文章内容发生变化时，Payload 会拒绝公开发布。

模型与 embedding API Key 仅存在于服务端。访客入口与生成能力由两个默认关闭的开关控制，并有持久化配额、并发限制、超时、缓存、无证据拒答和紧急关闭能力。部署候选会先以两个开关关闭的状态完成健康检查和真实 provider 代码 canary，通过后才恢复目标开关；失败回滚也保持 Agent 关闭。完整顺序见 [Blog Agent 运维手册](docs/blog-agent-operations.md)。

更多安全边界见 [SECURITY.md](SECURITY.md)。

## GitHub 到阿里云

`.github/workflows/ci-cd.yml` 是唯一生产发布入口：

1. Pull Request 运行 ESLint、TypeScript、依赖安全扫描、Vitest 和 production build。
2. PR 审阅并合并到 `main`。
3. GitHub Actions 通过 SSH 让阿里云服务器 fast-forward 到最新 `main`。
4. 服务器在旧容器仍运行时构建新镜像，并在切换前备份数据库与媒体。
5. 切换后检查应用、数据库和公网 HTTPS；失败时尝试恢复上一应用镜像。

应用镜像回滚不等于数据库回滚。若新版本已经执行数据库迁移，或服务器没有可用的上一镜像，需要使用部署前备份人工评估并恢复数据库。

仓库需要配置以下 Actions secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SSH_PRIVATE_KEY`
- `PROJECT_PATH`：服务器上的仓库绝对路径

不要在服务器上直接修改应用文件。生产变更始终经过分支、PR、CI、`main` 和部署工作流。

## 生产结构

```text
访客
  → Nginx :80/:443（TLS 与反向代理，服务器配置不在本仓库）
  → 宿主机 127.0.0.1:3000
  → first_myself_site_prod 容器 :3001
  → postgres_prod 容器 :5432
```

Nginx 必须覆盖客户端提交的代理身份头，且应用端口不能直接暴露到公网。应用和 PostgreSQL 由 `docker/docker-compose.prod.yml` 管理；数据库和媒体存放在命名卷中。

公开就绪检查：

```bash
curl --fail https://wangjinkun333.me/api/health
```

成功返回 `{"status":"ready"}`。服务器上的完整检查由 `scripts/health-check.sh` 执行。

## 备份与运维边界

`scripts/backup.sh` 会从运行中的 Compose 服务生成 PostgreSQL custom-format dump 和媒体归档。部署前会自动执行一次备份；自动回滚只处理应用镜像，不恢复数据库。仍应把备份复制到 ECS 之外，并定期做隔离恢复演练。

- Nginx 配置和证书续期属于服务器层；仓库负责在部署时验证 HTTPS 结果
- ICP、阿里云安全组和网络策略属于云平台配置
- 第三方 uptime monitoring、异地备份目标和定时备份仍需单独配置

## 仓库导航

```text
app/                      Next.js 页面与 API
src/components/           前台交互组件
src/lib/                  业务规则、访问统计和服务端工具
src/payload/              CMS collections、globals、后台组件与迁移
__tests__/                自动化测试
docker/                   生产 Compose 配置
scripts/                  健康检查、备份和部署前验证
.github/workflows/        CI/CD
```

相关文档：

- [DESIGN.md](DESIGN.md)：视觉系统、内容语气和后台交互约束
- [TESTING_GUIDE.md](TESTING_GUIDE.md)：自动化测试与发布前验证
- [SECURITY.md](SECURITY.md)：权限、隐私和生产安全边界

## License

MIT
