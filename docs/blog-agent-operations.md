# 单文章 Blog Agent 上线与应急手册

Agent 只读取访客当前打开的、`published + public` 且包含 Markdown 的一篇 Blog。普通文章使用当前 Markdown；增强文章可使用发布时离线生成的当前 Blog 私有材料包。两种模式都不读取其他文章、后台草稿或本地 Codex，也不提供工具调用。

## 上线前配置

在模型供应商后台分别创建低额度、可随时吊销的生成与向量化 API Key，并为它们配置消费上限和告警。不要复用个人主 Key，不要把 Key 粘贴到 Issue、PR、日志或 Git。

自动部署使用仓库级 GitHub Actions Secrets `BLOG_AGENT_API_KEY`、`DASHSCOPE_API_KEY`，以及以下 Repository Variables：

- `BLOG_AGENT_ENABLED=false`
- `BLOG_AGENT_GENERATION_ENABLED=false`
- `BLOG_AGENT_BASE_URL=https://api.deepseek.com`
- `BLOG_AGENT_MODEL=deepseek-v4-flash`
- `BLOG_AGENT_EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`
- `BLOG_AGENT_EMBEDDING_MODEL=qwen3.7-text-embedding`
- `BLOG_AGENT_EMBEDDING_DIMENSIONS=1024`
- `BLOG_AGENT_EMBEDDING_TIMEOUT_MS=15000`
- `BLOG_AGENT_CANARY_SLUG=<公开且 package ready 的实验文章 slug>`
- `BLOG_AGENT_CANARY_QUESTION=<必须依赖该文章 package 才能深入回答的问题>`

工作流通过 SSH 进程环境把它们传给 Docker Compose；Key 不进入镜像构建参数、客户端 bundle、Git 历史或服务器仓库文件。手工部署时必须在服务器 `.env.docker.prod` 中提供这些同名服务端变量。

两个开关都关闭时，工作流只校验开关值，允许在尚未配置 provider 的环境先安全部署数据库 migration 和页面代码。离线索引与 canary 仍需要 DashScope 配置；启用访客入口前则必须同时完整配置 DeepSeek 与 DashScope，工作流会 fail closed。

首次部署保持：

```dotenv
BLOG_AGENT_ENABLED=false
BLOG_AGENT_GENERATION_ENABLED=false
BLOG_AGENT_BASE_URL=https://api.deepseek.com
BLOG_AGENT_API_KEY=<专用低额度 Key>
BLOG_AGENT_MODEL=<模型名>
DASHSCOPE_API_KEY=<百炼专用低额度 Key>
BLOG_AGENT_EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BLOG_AGENT_EMBEDDING_MODEL=qwen3.7-text-embedding
BLOG_AGENT_EMBEDDING_DIMENSIONS=1024
BLOG_AGENT_EMBEDDING_TIMEOUT_MS=15000
```

其余限额使用 `.env.docker.prod.example` 的保守默认值。所有 `BLOG_AGENT_*` 变量都是服务端变量；不要添加 `NEXT_PUBLIC_` 前缀。

## Nginx 边缘限制

应用端口继续只监听宿主机 `127.0.0.1:3000`，不得通过安全组或 Docker 映射直接暴露。下面的 `limit_req_zone` 放在 Nginx `http` 块，正则 `location` 放在当前 HTTPS `server` 块，并复用现有代理头和超时策略：

```nginx
limit_req_zone $binary_remote_addr zone=blog_agent_per_ip:10m rate=6r/m;

server {
    # 现有 listen 443 ssl、证书和其他 location 保持不变。
    location ~ ^/api/blog/[^/]+/agent$ {
        client_max_body_size 8k;
        limit_req zone=blog_agent_per_ip burst=2 nodelay;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 25s;
        proxy_pass http://127.0.0.1:3000;
    }
}
```

执行 `nginx -t` 成功后再 reload。确认超大请求返回 `413`，短时间重复请求被边缘限流，并再次确认公网无法直接访问端口 3000。

## 文章包的离线发布边界

增强模式只用于新 slug，不更新或覆盖现有文章。执行全局 `publish-site-article` Skill 的 Agent 必须阅读文章与候选材料，自主选择最多 10 个 Git-tracked、clean-at-HEAD、可公开 source，并为主动排除的高相关候选记录理由。选入 source 代表允许 Agent 向匿名访客展示与问题直接相关的短代码、文档或数据摘录；只适合内部检索或概括的材料不得选入。脚本会限制单个 20 KiB、合计 120 KiB、最多 128 chunks，并在发送 embedding 前对 path、symlink、Git 状态、hash 和常见凭据模式 fail closed。

推荐顺序：

1. 在来源项目中提交 Markdown、`<article>.agent.json` 和 selected sources。
2. 运行 `plan --package-manifest ...`，检查 commit、hash、大小和 exclusions；plan 不输出 source 内容。
3. 网站新版本已经部署、两个公网开关仍为 `false` 时，运行 `draft --package-manifest ...`。
4. Skill 创建 `draft + private`，再调用 admin/editor-only 的 `/api/blog/<id>/agent-index`。只有状态 `ready`、expected/indexed hash 相同且 `chunkCount > 0` 才算成功。
5. 确认索引 ready 后，在两个 Agent 开关仍关闭时公开这篇文章；Payload hook 会拒绝绕过 ready gate。随后运行 package canary，只有通过后才开启访客 Agent。

source snapshot 和 embeddings 只存 PostgreSQL 私有 `blog_agent` 表，不会被匿名 raw-data API、plan、inspect 或日志完整返回。文章 Agent 可以在回答中展示最多两个有界代码块；服务端按 CommonMark AST 统计 backtick、tilde、缩进和未闭合 fence 等实际可渲染 code node，单块最多 1,200 字符、合计最多 1,600 字符。完整补充 source 不允许返回；回答在一个或多个补充 source 中累计复刻达到 600 字符时也会降级为证据不足。访客问题只会对当前 Blog 的最多 128 个 chunks 做有界内存排名；SQL 不形成全站向量/FTS 查询。

多轮追问仍以当前 Blog 为唯一边界。浏览器按文章 slug 在当前标签页保存最近 8 轮已完成对话；每次请求最多携带最近 3 轮，单个旧回答最多 1,200 字符，总请求体仍不得超过 8 KiB。客户端历史可能被访客篡改，因此服务端只使用旧问题辅助当前文章内检索，并明确要求模型将历史视为不可信输入、只用于解析指代；事实和引用必须重新来自本次选中的当前文章证据。历史不会以原文写入访问日志或独立会话表，回答缓存只保留包含历史的不可逆哈希，也不会跨文章加载。

## 入口关闭时运行 canary

先正常部署数据库 migration 和应用，但保持两个开关为 `false`。选择一篇不含敏感信息的公开 Markdown 文章，在服务器仓库目录运行：

```bash
docker compose --env-file .env.docker.prod \
  -f docker/docker-compose.prod.yml \
  exec app npm run blog-agent:canary -- \
  --slug=<公开文章-slug> \
  --question=<要求从该文章包给出最小代码片段的问题> \
  --require-package \
  --require-code
```

Canary 不经过公网 API、不要求 `BLOG_AGENT_ENABLED=true`、不写 Blog，只输出 query ID、结果类型、引用数量、token 数、`contextMode` 和是否存在代码摘录。使用 `--require-package` 时，没有当前 Blog 的 ready package 会直接失败，不会静默退回 Markdown；`--require-code` 只能与 `--require-package` 一起使用，并要求回答含非空 CommonMark code node、引用本次选中的 `sourceKind=code` 证据，且代码中至少 24 个实质字符来自该引用 source。生产部署同时启用两项门禁，成功输出必须包含 `"contextMode":"article-package"` 和 `"codeExcerpt":true`。它不会输出问题、Markdown、source 内容、回答全文、API Key、数据库地址或供应商错误正文。证据不足、文章不公开、代码摘录缺失、代码证据不匹配、配置缺失或 provider 异常都会以非零状态退出。

失败日志只包含固定阶段码，例如 `configuration-unavailable`、`database-unavailable`、`package-not-ready`、`code-excerpt-missing`、`code-evidence-missing`、`provider-authentication`、`provider-billing`、`provider-invalid-response`、`answer-invalid` 或 `insufficient-evidence`。阶段码用于区分配置、数据库、数据 package、代码摘录、代码来源、供应商调用、回答校验与证据判定；未分类异常只输出 `internal`，不会透传配置内容、连接信息或供应商响应正文。

DeepSeek V4 默认开启 thinking mode。当前 Blog Agent 明确使用 `deepseek-v4-flash` 的 non-thinking mode：该链路只做有界文章问答和严格 JSON 输出，关闭 thinking 可以避免推理 token 挤占 600 token 的结构化答案预算，并降低延迟与费用。

GitHub 部署流程会保存目标开关，然后强制以 `BLOG_AGENT_ENABLED=false`、`BLOG_AGENT_GENERATION_ENABLED=false` 启动候选版本。候选完成内部健康检查、域名/TLS 检查和同一条 `--require-package --require-code` canary 后，工作流才恢复目标开关、重建 app，并复验健康状态与容器中的实际开关值。任何失败都会用关闭状态回滚上一镜像；若回滚本身失败，则停止 app，避免未验证或已开启的 Agent 继续对外服务。因此个人电脑不需要持有生产 SSH 密钥。

数据库 migration 在 canary 前执行，镜像回滚不会反向撤销数据库变更。因此所有 production migration 必须与上一版应用保持向后兼容，确保旧镜像在新 schema 上仍可安全运行。

## 开放顺序与验收

Canary 成功后，按下面顺序执行，每次只重建 app 容器：

1. 设置 `BLOG_AGENT_GENERATION_ENABLED=true`，`BLOG_AGENT_ENABLED=false`，重建 app；确认直接访问 API 仍为 `404`。
2. 复核模型供应商消费上限、PostgreSQL runtime 表、应用配额和 Nginx 限流。
3. 用公开测试文章验证正常问题、需要 package source 的深问题、要求最小代码片段的问题、完整文件导出拒绝、证据不足、文章/source 内 prompt injection、跨文章诱导和模型生成外链；代码回答必须包含 code block、引用对应的 `code` source，且摘录行能在该 source 中核对，回答引用只能跳到当前文章标题。
4. 验证 private/draft/RichText-only 文章均无机器人且 API 为 `404`。
5. 验证桌面侧栏、移动端底部面板、键盘 Escape、焦点恢复和 reduced motion；确认关闭后重开、同标签页刷新会恢复当前文章历史，显式清空后历史消失，切换到另一篇文章不会带入旧对话。
6. 检查域名 TLS、`/api/health`、浏览器控制台和模型费用。
7. 最后把 GitHub Repository Variables `BLOG_AGENT_GENERATION_ENABLED`、`BLOG_AGENT_ENABLED` 设为 `true`，手动触发 `main` workflow 重部署，立即用测试文章调用一次公网 API 并核对 `200`、当前文章引用和 provider 用量。失败时立刻把两个 Variables 都恢复为 `false` 并再次手动部署；不要只在服务器临时改文件。入口关闭时的 canary 不经过公开 route、runtime 配额或缓存，因此不能替代这一步。

重建命令：

```bash
docker compose --env-file .env.docker.prod \
  -f docker/docker-compose.prod.yml \
  up -d --no-deps --force-recreate app
```

## 紧急关闭

出现费用异常、滥用、错误引用或 provider 故障时，GitHub Repository Variables 是自动部署的配置源：第一步把 `BLOG_AGENT_ENABLED`、`BLOG_AGENT_GENERATION_ENABLED` 都设为 `false`，手动触发 `main` workflow，并确认文章页不再渲染机器人、API 返回 `404`。必要时同时在供应商侧吊销专用 Key；不要删除 Blog、数据库表或整站容器作为第一响应。

只有 GitHub 暂时不可用时，才把服务器 `.env.docker.prod` 中两个开关设为 `false` 并只重建 app 作为临时止血。该文件会被后续 GitHub 部署进程中的 Repository Variables 覆盖，所以 GitHub 恢复后必须同步把 Variables 设为 `false`，并在任何新部署前复核开关状态。
