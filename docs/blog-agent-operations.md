# 单文章 Blog Agent 上线与应急手册

第一阶段的 Agent 只读取访客当前打开的、`published + public` 且包含 Markdown 的一篇 Blog。它不读取其他文章、附件、后台草稿或本地 Codex，也不提供工具调用。

## 上线前配置

在模型供应商后台分别创建低额度、可随时吊销的生成与向量化 API Key，并为它们配置消费上限和告警。不要复用个人主 Key，不要把 Key 粘贴到 Issue、PR、日志或 Git。生成模型的真实值写入阿里云服务器仓库根目录、权限受限且已被 Git 忽略的 `.env.docker.prod`。

百炼向量化 Key 使用仓库级 GitHub Actions Secret `DASHSCOPE_API_KEY`。自动部署会通过 SSH 进程环境把它传给 Docker Compose；Key 不进入镜像构建参数、客户端 bundle、Git 历史或服务器仓库文件。手工部署时必须在服务器 `.env.docker.prod` 中提供同名服务端变量。

首次部署保持：

```dotenv
BLOG_AGENT_ENABLED=false
BLOG_AGENT_GENERATION_ENABLED=false
BLOG_AGENT_BASE_URL=<供应商官方 OpenAI-compatible Base URL>
BLOG_AGENT_API_KEY=<专用低额度 Key>
BLOG_AGENT_MODEL=<模型名>
DASHSCOPE_API_KEY=<百炼专用低额度 Key>
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

## 入口关闭时运行 canary

先正常部署数据库 migration 和应用，但保持两个开关为 `false`。选择一篇不含敏感信息的公开 Markdown 文章，在服务器仓库目录运行：

```bash
docker compose --env-file .env.docker.prod \
  -f docker/docker-compose.prod.yml \
  exec app npm run blog-agent:canary -- \
  --slug=<公开文章-slug> \
  --question=<只能由该文章回答的问题>
```

Canary 不经过公网 API、不要求 `BLOG_AGENT_ENABLED=true`、不写 Blog，只输出 query ID、结果类型、引用数量和 token 数。它不会输出问题、Markdown、回答全文、API Key、数据库地址或供应商错误正文。证据不足、文章不公开、非 Markdown、配置缺失或 provider 异常都会以非零状态退出。

## 开放顺序与验收

Canary 成功后，按下面顺序执行，每次只重建 app 容器：

1. 设置 `BLOG_AGENT_GENERATION_ENABLED=true`，`BLOG_AGENT_ENABLED=false`，重建 app；确认直接访问 API 仍为 `404`。
2. 复核模型供应商消费上限、PostgreSQL runtime 表、应用配额和 Nginx 限流。
3. 用公开测试文章验证正常问题、证据不足、文章内 prompt injection、跨文章诱导和模型生成外链；回答引用只能跳到当前文章标题。
4. 验证 private/draft/RichText-only 文章均无机器人且 API 为 `404`。
5. 验证桌面侧栏、移动端底部面板、键盘 Escape、焦点恢复和 reduced motion。
6. 检查域名 TLS、`/api/health`、浏览器控制台和模型费用。
7. 最后设置 `BLOG_AGENT_ENABLED=true` 并重建 app，再进行一轮小流量验证。

重建命令：

```bash
docker compose --env-file .env.docker.prod \
  -f docker/docker-compose.prod.yml \
  up -d --no-deps --force-recreate app
```

## 紧急关闭

出现费用异常、滥用、错误引用或 provider 故障时，第一步把 `.env.docker.prod` 中 `BLOG_AGENT_ENABLED=false`，然后只重建 app 容器。确认文章页不再渲染机器人、API 返回 `404`，再调查用量与日志。必要时同时在供应商侧吊销专用 Key；不要删除 Blog、数据库表或整站容器作为第一响应。
