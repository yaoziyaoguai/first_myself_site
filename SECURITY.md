# 安全说明

本项目部署在阿里云 ECS，通过 Nginx 提供 HTTPS，应用与 PostgreSQL 由 Docker Compose 管理。生产发布只经过 GitHub Pull Request、CI、`main` 和部署工作流。

## 必需配置

生产环境的 `.env.docker.prod` 不进入 Git，至少包含：

- `POSTGRES_DB`、`POSTGRES_USER` 和强随机 `POSTGRES_PASSWORD`
- `PAYLOAD_SECRET`：使用 `openssl rand -base64 32` 生成
- `NEXT_PUBLIC_SERVER_URL=https://wangjinkun333.me`

应用在缺少 `DATABASE_URL` 或 `PAYLOAD_SECRET` 时会拒绝启动。仓库不包含默认管理员账号、默认密码或生产密钥。`BLOG_INTERACTIVE_HTML_ENABLED` 是默认关闭的服务端开关；它不替代文章状态、可见性和当前引用检查。

`ADMIN_SECRET_TOKEN`、`PAYLOAD_INITIAL_ADMIN_EMAIL` 和 `PAYLOAD_INITIAL_ADMIN_PASSWORD` 只用于本地开发初始化。`/api/seed` 与 `/api/create-admin` 在生产环境始终拒绝访问；创建接口也不会在响应中返回密码。

## 访问控制

- `admin`：维护全部内容，并管理用户和角色。
- `editor`：维护内容，不能管理用户和角色。
- `viewer`：不能进入 Payload Admin。
- 草稿和私有文章不会向匿名访问者公开。
- Payload 登录会话 Cookie 使用 `HttpOnly`、`Secure` 和 `SameSite=Lax`，不会通过明文 HTTP 发送。
- Comments 与 Likes collection 禁止匿名直接读写；公开页面只能通过经过校验的应用接口访问。

评论和点赞的匿名标识由服务端使用 HMAC 生成。浏览器不能提交可信身份字段，公开响应也不包含邮箱、原始 IP、fingerprint 或内部删除字段。接口会校验目标资源、父评论关系与输入长度，并执行进程内限流。当前限流不跨多个应用实例；如果以后水平扩容，需要改为共享存储限流。

## 文章交互 HTML

- HTML 存在文章绑定的私有不可变表中，不是 Payload Media、公开静态文件或跨文章资源库。管理接口只接受 admin/editor；同 hash 重传需逐字一致。
- `/view` 每次读取都在同一数据库快照中核对文章状态、可见性与当前正文引用；撤回或移除引用后，新前台请求被拒绝，不能只凭 hash 或旧缓存读取。`/preview` 仅限 admin/editor，允许预览已绑定目标文章但尚未保存到正文的新上传资源；两条路径都拒绝跨文章读取。
- 可执行响应固定使用 HTTP CSP sandbox；外层 iframe 只有 `sandbox="allow-scripts"`。没有 `allow-same-origin`、网络、表单、弹窗、下载或顶层跳转权限；JSON 与错误响应不可嵌入执行。
- 上传服务端独立复核 UTF-8、大小、hash 和 HTML/CSS profile，拒绝远程资源、嵌套文档、隐藏生成器源文等；客户端“已审查”声明不能绕过校验。
- 原始生成文件保持不变，只上传经过审查的公开副本。人工审查仍需覆盖注释、隐藏 DOM、脚本字符串、内联 JSON 和 data 资源；sandbox 不能防止已经上传的敏感字节被读取。
- 沙箱与 CSP 不保证任意脚本完全零网络或不会消耗 CPU；动态自导航/子文档仍需按真实浏览器行为评估。本能力只接收作者审查的离线演示，不托管任意敌意脚本。
- HTML、JavaScript、隐藏原文和内嵌数据不进入 RAG；文章 Agent 只看到 marker 的可见标题与说明。
- 单文件、单篇版本数、当前引用总量和全表文本量均有上限；上传采用进程内限流。当前限流与其它小站接口一样不跨多实例。

## 访问统计与隐私

- 统计客户端不使用 localStorage 或跨站跟踪脚本；通过 Payload 验证的 admin/editor 会收到签名、HttpOnly、`SameSite=Lax` 的站长设备 Cookie，只用于从统计中排除站长流量，不授予登录状态或任何权限。
- 浏览器启用 Do Not Track 或 Global Privacy Control 时不发送事件。
- 只接收与正式站点同源的 JSON 请求，并校验字段长度、数值范围和 session UUID。
- 原始 IP 只在服务端短暂用于 HMAC 派生和限流，不写入数据库。
- 数据库保存匿名 visitor hash、页面路径、标题、来源域名、有效停留和最大阅读深度。
- Agent 只保存通过接口校验且经过邮箱与常见凭据脱敏的当前问题、文章 slug、时间和有限状态，最多保留 30 天且全表最多 50,000 条；不保存模型答案、历史对话、IP、访客哈希或 Provider 返回。
- 同一匿名身份 10 分钟最多进入文章 Agent 30 次；超限请求返回 `429` 且不写问题明细，防止重复缓存命中或额度拒绝挤占统计容量。
- 生产数据库备份排除 Agent 问题明细和旧版未回答问题的数据，只保留表结构，不会借由备份延长问题文本的保留期。
- `admin` 和 `editor` 可以查看统计；公开用户不能读取 PageViews collection，只有 `admin` 可以删除记录。
- 当前速率限制是单进程内存实现；水平扩容前必须迁移到共享限流存储。

## 生产边界

- 应用端口只绑定 `127.0.0.1:3000`，公网只开放 Nginx 的 80/443。
- `/api/health` 会执行最小数据库查询，只返回 `ready` 或 `unavailable`。
- 部署工作流同时检查本机应用就绪和公网 HTTPS，失败时停止发布并输出有限容器日志。
- 部署脚本只通过本机 HTTPS 探测 400 KiB 请求能否到达真实媒体路径，不修改宿主机 Nginx；Nginx 配置、证书自动续期、阿里云安全组与 ICP 状态仍属于服务器/云平台配置。
- 备份脚本不会打包环境变量；备份应复制到 ECS 之外，并定期做隔离恢复演练。

## 依赖与检查

CI 使用锁文件执行 `npm ci`，并在 Pull Request 上阻止本次新增的 high/critical 依赖漏洞。提交前运行：

```bash
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm run build
```

GitHub Dependency Review 直接比较 PR 的基准与当前依赖图；它是依赖变更门禁。`npm audit` 可作为本地补充检查，但不再作为生产部署的实时前置条件，避免 npm registry 审计接口故障将已通过 PR 审查的发布卡死。若审查报告 low/moderate 上游问题，应核对 Payload 与 Next.js 的兼容版本；没有无破坏性升级路径时，不应使用 `npm audit fix --force` 越过框架兼容范围。

仓库必须保持 GitHub Dependency Graph 和 Dependabot vulnerability alerts 开启；两者只做依赖分析与告警，不会自动升级生产依赖。

如果任何密钥或管理员凭证可能泄露，应先在阿里云/服务器轮换，再重新部署；不要把真实值粘贴到 Issue、PR、日志或聊天中。
