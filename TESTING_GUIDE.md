# 测试与发布前验证

本项目使用 Vitest、Testing Library、ESLint、TypeScript 和 Next.js production build 作为主要质量门禁。CI 输出是最终依据；文档中的数量只是最近一次已验证基线。

## 当前基线

截至 2026-08-23 的 Blog Agent 合并候选：

- 70 个测试文件，其中 66 个通过、4 个按真库条件跳过
- 555 个自动化测试通过，7 个按真库条件跳过
- ESLint、TypeScript、Vitest 和 production build 均通过
- GitHub Actions 在 Pull Request 上执行完整检查
- Blog Agent 另有 PostgreSQL 15 真库门禁和生产 Docker/Payload CLI 验证

不要用“测试文件存在”代替“测试已运行”。超时、截断输出或没有成功退出码都不能算通过。

## 本地完整检查

```bash
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm audit --audit-level=high
npm run build
```

`npm run build` 需要有效但可以是临时的 PostgreSQL 和以下变量：

```dotenv
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/database
PAYLOAD_SECRET=至少32字符的本地构建密钥
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

不要删除 lockfile 来解决依赖问题。依赖安装以 `npm ci` 和已提交的 `package-lock.json` 为准。

## 测试结构

```text
__tests__/
├── api/          公开接口、初始化门禁和健康检查
├── components/   前台组件与匿名访问统计客户端
├── deployment/   Nginx 媒体探测和部署顺序
├── lib/          解析、身份、限流、评论、点赞和统计逻辑
├── metadata/     sitemap、RSS 和公开内容发现
└── payload/      权限、collection、迁移、后台字段和配置内容
```

### API 与安全边界

- `/api/health` 的数据库就绪语义
- `/api/seed` 与 `/api/create-admin` 的生产拒绝和 token 校验
- 评论、回复和点赞的输入校验、目标校验、匿名身份与限流
- 访问统计的 origin、content type、事件格式、速率限制和错误状态

### Payload 与数据

- Blog、Users 等 collection 的角色与可见性规则
- 项目链接、最近学习和公开邮箱在后台可配置
- 配置内容 backfill 只填空值，不覆盖用户已经编辑的数据
- 生产迁移以显式 `prodMigrations` 运行
- PageViews migration、collection 权限和 SQL 聚合结果
- 生产浏览器验收从带 `?analytics=off` 的 URL 开始，避免自动化流量污染访问统计

### Markdown 编辑器

- GFM 内容渲染
- 空值、错误和 disabled 状态
- 内容锚点插值的边界与双向映射
- 宽内容不会挤压任一 pane
- 图片加载后的锚点重新测量

### 部署

- 新镜像构建完成后才切换容器
- 同一台生产服务器上的部署通过 concurrency group 串行执行
- 切换前执行媒体路径探测与备份
- 只清理 Payload 的 legacy dev migration marker
- 部署失败时保留回滚路径

### 单文章 Blog Agent

- 公共 API 只接受当前 slug 的单个问题，不读取其他 Blog、草稿或私有文章
- Markdown 证据、文章包检索、引用锚点和无证据拒答保持同一 Blog 边界
- 文章包只接受 Git 审计后的有界 source，索引状态与文章内容/hash 绑定
- 持久化窗口/每日配额、并发限制、缓存隔离和供应商失败路径
- 桌面浮层、移动端 bottom sheet、键盘焦点、引用跳转和 reduced motion

没有 `BLOG_AGENT_TEST_DATABASE_URL` 时，Blog Agent 真库测试会显示为 `skipped`，不能把普通 `npm test` 当作真库通过。CI 会使用 PostgreSQL 15 运行这些 migration、repository 与 canary 测试。真实 provider 验收按 [Blog Agent 运维手册](docs/blog-agent-operations.md) 执行；不要把个人主 Key 放进浏览器测试或 GitHub 日志。

## 按范围运行

```bash
# 单个文件
npm test -- __tests__/api/analytics.test.ts

# 一个目录
npm test -- __tests__/payload/

# 名称匹配
npm test -- -t "MarkdownPreviewField"

# 开发时监听
npm run test:watch
```

## 必要的手工验证

自动化测试不能替代以下真实交互。

### Markdown 长文

1. 在后台打开包含多级标题、表格和多张图片的长文章。
2. 确认编辑区与预览区宽度接近，各自可独立滚动。
3. 从编辑区滚动到文章中部，确认预览落在相同内容块。
4. 从预览区反向滚动，确认编辑区回到对应源码。
5. 等图片加载后重复检查，确认没有明显漂移。

### 访问统计

1. 在未开启 DNT/GPC 的浏览器访问公开页面并停留至少 15 秒。
2. 切换页面或隐藏标签页，确认阅读时间只统计可见时段。
3. 进入后台“运营 → 访问统计”，确认访问、停留和深度出现。
4. 开启 DNT 或 GPC 后重新访问，确认浏览器不发送统计事件。

### 生产冒烟

1. `https://wangjinkun333.me/api/health` 返回 `{"status":"ready"}`。
2. 首页、项目页、文章列表和一篇长文正常加载。
3. 浏览器没有 TLS 警告，静态资源和文章图片返回成功。
4. Payload Admin 可以登录，内容与统计页面可打开。
5. Agent 开关关闭时文章页不渲染机器人且 API 返回 `404`；开放后只用审核过的实验文章做有额度约束的 canary。

## CI/CD 顺序

```text
ESLint
  → TypeScript ─→ Tests → Build ─┐
  → Security Scan ────────────────┤
                                  └→ Deploy（main push 或受控手工触发）
```

Pull Request 不会部署。只有 `main` 的 push 或明确的 `workflow_dispatch` 且全部上游检查成功后，Deploy job 才会连接阿里云；同一生产服务器的部署按 concurrency group 串行执行。

## 结果报告要求

提交 PR 时至少报告：

- 实际运行的检查
- 测试文件数和测试数
- build 是否使用了本地临时数据库
- 手工验证了哪些用户路径
- 未验证或只能在生产验证的部分

不要声称固定覆盖率，除非本次确实生成并读取了 coverage report。当前仓库没有把覆盖率百分比作为 CI 门禁。
