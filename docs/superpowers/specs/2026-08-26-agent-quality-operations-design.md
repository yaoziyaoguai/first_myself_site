# Agent 反馈与生产运维轻量闭环设计

日期：2026-08-26

## 目标

只解决三个当前已经存在的问题：

1. 站长能看到文章 Agent 最近没有回答成功的问题，以便决定下一篇文章或文章材料包应该补什么。
2. 访问统计能识别已登录站长自己的访问，并显示访客的脱敏网段。
3. 生产环境每天自动检查健康、TLS、模型额度和备份。

这仍然是个人博客，不建设 AI 质量平台。

## 明确不做

- 不记录成功问题、回答全文或对话历史。
- 不做引用点击、cache 命中率、逐问题 token、延迟、评分或会话回放。
- 不保存完整 IP、User-Agent 原文、地理位置或 Agent 身份画像。
- 不引入第三方统计和告警服务。
- 不自动读取、轮换或展示模型 API Key。
- 不建设跨文章知识库或新的评测体系。

## 未回答问题收件箱

新增一张小表 `blog_agent.unanswered_questions`，只在 Agent 没有正常回答时写入：

- `query_id`：复用公开响应中的随机查询 ID，唯一索引。
- `article_slug`：服务端查到的当前公开文章 slug。
- `question_excerpt`：服务端脱敏后、最多 500 字的问题摘要。
- `reason`：`insufficient_evidence`、`rate_limited` 或 `provider_error`。
- `created_at`：用于排序和 30 天保留。

问题写库前按固定规则脱敏邮箱、Bearer/API Key、JWT、私钥区块、常见密码与凭据赋值。无法安全处理时保存固定占位符，不保存原文。表中不保存 IP、访客哈希、回答和历史，因此不能把问题关联成个人行为轨迹。

`BlogAgentService` 在最终确定证据不足、限流或 provider 失败时 best-effort 写入。写库失败不能改变访客已经得到的 HTTP 状态和响应正文。路由级无效请求、跨站请求、404 和未开启的 Agent 不记录问题。

30 天以前的数据由每日运维任务删除；每次写入时额外执行小批量兜底清理，避免定时任务短暂失效导致无限增长。

## 后台展示

复用现有“运营 → 访问统计”页面，增加一个紧凑的“文章 Agent · 近 7 天”区域：

- 现有 `usage_daily` 中的模型请求数、输入 token 和输出 token；
- 最近 7 天未回答数量；
- 最近 10 个脱敏问题摘要、文章和失败原因。

不新增复杂图表，不计算质量分数，也不展示成功问题明细。区域只对 admin/editor 可见。

## 站长访问与脱敏网段

在现有 `page_views` 增加两个字段：

- `network_prefix`：IPv4 只保留 `/24`，例如 `182.92.85.*`；IPv6 只保留规范化 `/64` 前缀；解析失败时为空。
- `is_owner`：分析请求携带有效 Payload admin/editor 登录会话时为 `true`，否则为 `false`。

不保存完整 IP。现有 HMAC 访客哈希继续用于匿名去重和限流。后台访问汇总默认排除 `is_owner=true`，访问列表显示“站长访问”标记和脱敏网段。未登录设备不会仅凭网段被认定为站长，避免共享 NAT、动态 IP 和 VPN 造成误判。

页面访问记录同样只保留 30 天，由每日运维任务清理。

## 每日生产运维

新增独立 GitHub Actions workflow，支持每日定时和手动触发，复用现有 SSH Secrets，不增加新凭据。它在服务器执行：

1. 公网 `/api/health`、容器状态和磁盘检查。
2. TLS 证书剩余有效期不少于 21 天。
3. PostgreSQL 和媒体备份，继续只保留最近 7 份。
4. 在正式保存前验证 database dump、媒体 tar 和最终归档可读。
5. 删除 30 天以前的页面访问和未回答问题。
6. 读取当天已有 `usage_daily` 请求数与 token；请求数达到全局日限额 80% 时让任务失败，在线硬限额仍负责阻止继续消费。

定时运维与生产部署共用同一个 GitHub Actions concurrency group，避免同时备份或迁移。任一步失败都使 workflow 失败，利用 GitHub Actions 自带通知和红色状态告警。日志只输出计数、阶段码和备份文件名，不输出问题、IP、数据库连接或 Secret。

`scripts/health-check.sh` 的 TLS 阈值改为可配置且默认 21 天。`scripts/backup.sh` 在原子移动文件前验证内容；失败不留下正式命名的备份。

API Key 继续在供应商控制台和 GitHub Secrets 中人工轮换。运维文档只增加季度步骤：创建专用低额度 Key、更新 Secret、触发部署与 canary、成功后吊销旧 Key。

## 安全与回滚

- 新数据只能从 Payload 后台读取，匿名 API 不提供查询接口。
- 所有 SQL 使用参数绑定；问题和 slug 不拼接进 SQL。
- 数据库迁移只新增表和 nullable/defaulted 列，与上一版应用向后兼容。
- 运维或遥测失败不泄露 Secret，也不产生伪造的成功状态。
- 生产部署继续沿用现有 canary、fail-closed 和镜像回滚流程。

## 测试与验收

实现遵循 red-green-refactor，自动化覆盖：

- 邮箱、Key、JWT、私钥、密码赋值和超长问题脱敏；
- 只记录证据不足、限流和 provider 失败，不记录成功回答；
- 遥测数据库失败不改变正常问答行为；
- IPv4/IPv6 脱敏和 Payload admin/editor 登录识别；
- 后台汇总排除站长访问并限制最近 10 条未回答问题；
- 30 天清理、migration up/down 和上一版兼容性；
- 备份验证失败、TLS 21 天阈值、额度 80% 告警和 workflow 互斥。

上线前运行完整测试、ESLint、TypeScript、production build、安全审查和 PR CI。合并后通过正常 GitHub 链路部署阿里云，并在生产验证后台卡片、一次公开的证据不足问题、站长访问标记、健康/TLS 和手动运维 workflow。

## 完成标准

- 后台能看到最近没有回答成功的问题及原因，不出现成功问题和回答全文。
- 后台默认排除已登录站长访问，并显示脱敏网段。
- 页面访问和未回答问题不会保留超过 30 天。
- 每日 workflow 能检查健康、TLS、额度和可读备份，异常时明确失败。
