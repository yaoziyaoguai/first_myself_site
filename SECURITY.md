# 安全说明

本项目部署在阿里云 ECS，通过 Nginx 提供 HTTPS，应用与 PostgreSQL 由 Docker Compose 管理。生产发布只经过 GitHub Pull Request、CI、`main` 和部署工作流。

## 必需配置

生产环境的 `.env.docker.prod` 不进入 Git，至少包含：

- `POSTGRES_DB`、`POSTGRES_USER` 和强随机 `POSTGRES_PASSWORD`
- `PAYLOAD_SECRET`：使用 `openssl rand -base64 32` 生成
- `NEXT_PUBLIC_SERVER_URL=https://wangjinkun333.me`

应用在缺少 `DATABASE_URL` 或 `PAYLOAD_SECRET` 时会拒绝启动。仓库不包含默认管理员账号、默认密码或生产密钥。

`ADMIN_SECRET_TOKEN`、`PAYLOAD_INITIAL_ADMIN_EMAIL` 和 `PAYLOAD_INITIAL_ADMIN_PASSWORD` 只用于本地开发初始化。`/api/seed` 与 `/api/create-admin` 在生产环境始终拒绝访问；创建接口也不会在响应中返回密码。

## 访问控制

- `admin`：维护全部内容，并管理用户和角色。
- `editor`：维护内容，不能管理用户和角色。
- `viewer`：不能进入 Payload Admin。
- 草稿和私有文章不会向匿名访问者公开。
- Comments 与 Likes collection 禁止匿名直接读写；公开页面只能通过经过校验的应用接口访问。

评论和点赞的匿名标识由服务端使用 HMAC 生成。浏览器不能提交可信身份字段，公开响应也不包含邮箱、原始 IP、fingerprint 或内部删除字段。接口会校验目标资源、父评论关系与输入长度，并执行进程内限流。当前限流不跨多个应用实例；如果以后水平扩容，需要改为共享存储限流。

## 访问统计与隐私

- 统计客户端不使用 Cookie、localStorage 或跨站跟踪脚本。
- 浏览器启用 Do Not Track 或 Global Privacy Control 时不发送事件。
- 只接收与正式站点同源的 JSON 请求，并校验字段长度、数值范围和 session UUID。
- 原始 IP 只在服务端短暂用于 HMAC 派生和限流，不写入数据库。
- 数据库保存匿名 visitor hash、页面路径、标题、来源域名、有效停留和最大阅读深度。
- `admin` 和 `editor` 可以查看统计；公开用户不能读取 PageViews collection，只有 `admin` 可以删除记录。
- 当前速率限制是单进程内存实现；水平扩容前必须迁移到共享限流存储。

## 生产边界

- 应用端口只绑定 `127.0.0.1:3000`，公网只开放 Nginx 的 80/443。
- `/api/health` 会执行最小数据库查询，只返回 `ready` 或 `unavailable`。
- 部署工作流同时检查本机应用就绪和公网 HTTPS，失败时停止发布并输出有限容器日志。
- 部署脚本只通过本机 HTTPS 探测 400 KiB 请求能否到达真实媒体路径，不修改宿主机 Nginx；Nginx 配置、证书自动续期、阿里云安全组与 ICP 状态仍属于服务器/云平台配置。
- 备份脚本不会打包环境变量；备份应复制到 ECS 之外，并定期做隔离恢复演练。

## 依赖与检查

CI 使用锁文件执行 `npm ci`，并阻止 high/critical 依赖漏洞。提交前运行：

```bash
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm audit --audit-level=high
npm run build
```

`npm audit --audit-level=high` 是 CI 门禁。若审计仍报告 low/moderate 上游问题，应核对 Payload 与 Next.js 的兼容版本；没有无破坏性升级路径时，不应使用 `npm audit fix --force` 越过框架兼容范围。

如果任何密钥或管理员凭证可能泄露，应先在阿里云/服务器轮换，再重新部署；不要把真实值粘贴到 Issue、PR、日志或聊天中。
