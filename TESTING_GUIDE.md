# 测试指南

项目使用 Vitest、Testing Library、ESLint、TypeScript 和 Next.js production build 作为合并门禁。CI 使用 Node.js 22 与 PostgreSQL 15。

## 日常检查

安装锁定依赖后运行：

```bash
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
```

普通 `npm test` 覆盖纯函数、Payload 权限与 migration 形状、API 路由、React 交互和安全回归。需要真实 PostgreSQL 的三个 Blog Agent 文件在没有专用环境变量时会显示为 `skipped`，不能把这个结果当作真库通过。

Production build 不需要模型 Key，而且 Blog Agent 默认关闭：

```bash
DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder \
PAYLOAD_SECRET=ci-placeholder-secret-32-chars-long \
NEXT_PUBLIC_SERVER_URL=http://localhost:3000 \
BLOG_AGENT_ENABLED=false \
BLOG_AGENT_GENERATION_ENABLED=false \
npm run build
```

## Blog Agent 聚焦测试

```bash
npx vitest run \
  __tests__/lib/blog-agent \
  __tests__/api/blog-agent.test.ts \
  __tests__/security/blog-agent-adversarial.test.ts \
  __tests__/components/blog-agent \
  __tests__/payload/blog-agent-migration.test.ts \
  __tests__/deployment/blog-agent-defaults.test.ts \
  __tests__/scripts/blog-agent-canary.test.ts
```

这些测试验证：单文章 Markdown 上下文、稳定标题锚点、grounded JSON 校验、缓存和配额、请求体严格校验、草稿/私密隔离、浮动面板竞态与安全 Markdown、默认关闭部署和 canary 脱敏输出。

## 真实 PostgreSQL 15

只允许使用名称中含 `test` 的专用数据库 URL。测试会在该数据库服务器内创建随机命名的临时数据库，并在结束后删除；不要把开发库或生产库 URL 放入 `BLOG_AGENT_TEST_DATABASE_URL`。

示例：

```bash
docker run --rm --name blog-agent-postgres \
  -e POSTGRES_DB=blog_agent_test \
  -e POSTGRES_USER=blog_agent_test \
  -e POSTGRES_PASSWORD=blog_agent_test_password \
  -p 127.0.0.1:55433:5432 \
  postgres:15-alpine
```

数据库就绪后，在另一个终端运行：

```bash
BLOG_AGENT_TEST_DATABASE_URL=postgresql://blog_agent_test:blog_agent_test_password@127.0.0.1:55433/blog_agent_test \
npx vitest run \
  __tests__/payload/blog-agent-migration.postgres.test.ts \
  __tests__/lib/blog-agent/runtime.postgres.test.ts \
  __tests__/scripts/blog-agent-canary.postgres.test.ts
```

真库测试证明 migration up/down 只管理 `blog_agent` schema、运行时只有三张最小表、缓存按文章/模型/问题 hash 隔离并过期、窗口/身份每日/全站每日配额在新 repository 实例和并发事务之间仍然成立。

## 浏览器与上线前验证

没有专用模型测试 Key 时，不要把真实个人 Key 放进本地浏览器测试。可以使用本地 OpenAI-compatible mock server 验证文章页机器人、桌面/移动面板、Escape 和焦点、错误重试、引用滚动、reduced motion，以及 private/draft/RichText-only 页面不显示入口。

真实 provider canary 和生产验收按 [Blog Agent 运维手册](docs/blog-agent-operations.md) 执行。Canary 必须使用不含敏感信息的公开文章和供应商侧低额度专用 Key。
