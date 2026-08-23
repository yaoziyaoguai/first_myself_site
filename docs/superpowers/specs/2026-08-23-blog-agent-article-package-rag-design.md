# Blog Agent Article Package RAG Design

## Goal

在不改变“进入一篇文章后，通过悬浮 Agent 提问”这一入口的前提下，让新文章可以离线附带少量代码、文档和数据快照，并用严格限定在当前 Blog 内的 Hybrid RAG 支撑更深问题。

## Product boundary

- Blog 是唯一上下文、安全和引用边界；公开请求永远不能选择其他 Blog、全站知识库或外部 URL。
- 简单文章仍然只需要 Markdown。没有文章包或索引不可用时，继续使用第一阶段的 Markdown 章节检索。
- 文章包只服务一篇文章，由发布 Skill 在离线发布时生成；访客请求不连接本地 Codex、GitHub 或任意 coding agent。
- 入口仍是文章右下角的“问问这篇文章”，不新增全站 `/ask`、知识库页面或评测平台。

## Article package

文章包由主 Markdown 和一个 Git-tracked sidecar manifest 描述。manifest 只选择同一 Git commit 内的公开快照，不上传整个仓库。

```json
{
  "version": 1,
  "sources": [
    {
      "path": "src/agent/loop.py",
      "kind": "code",
      "label": "Agent 主循环",
      "sectionAnchor": "核心实现"
    }
  ],
  "excluded": [
    {
      "path": "tests/fixtures/private.json",
      "reason": "仅用于本地测试且包含不可公开样例"
    }
  ],
  "canaryQuestion": "Agent 主循环如何限制工具调用？"
}
```

Package mode 必须满足：

- 主 Markdown、manifest、全部 sources 都由 `git ls-files` 确认已跟踪，并且相对 `HEAD` 无未提交修改；`sourceCommit` 由脚本读取，不由 Agent 手填。
- sources 最多 10 个；单个 UTF-8 文本最多 20 KiB；sources 总计最多 120 KiB。
- 只接受 `code`、`documentation`、`data`、`image-description` 四类；原始图片继续走既有 Media/Markdown 链路，RAG 只接收人工或 Agent 审核后的文字描述。
- 路径不得逃逸仓库、跟随越界 symlink、读取 `.env`、credential、secret、私钥、构建产物或 `.git`。
- 确定性敏感信息扫描命中时 fail closed；无法判断能否公开时，执行发布 Skill 的 Agent 也必须 fail closed。
- package hash 由 canonical manifest、`sourceCommit`、主文档 SHA-256、每个 source 的 SHA-256 和内容共同计算；服务端重新计算并校验。
- package mode 仍然 create-only；现有 slug 默认停止，不覆盖已发布文章。

## Storage and publication state

Payload Blog 只增加私有的发布门禁字段：

- `agentContextRequired`: 是否要求文章包索引就绪；
- `agentPackageHash`: 发布 Skill 声明的预期 package hash；
- `agentIndexStatus`: `none | pending | ready | failed`；
- `agentIndexedPackageHash`: 已完成索引的 package hash；
- `agentIndexedAt`: 索引完成时间。

这些字段对匿名 REST/GraphQL 读取不可见。正文、sources snapshot 和 embedding 存入 `blog_agent` schema：

- `article_packages`: `blog_id + package_hash`、article hash、manifest JSON、embedding model/dimensions、chunk count 和 indexed time；
- `article_chunks`: 当前 package 的 bounded chunks、来源类型/路径/标题/文章锚点、原文和 `real[]` embedding。

不安装 pgvector。单篇文章最多 128 chunks，运行时 SQL 必须先按服务端解析出的 `blog_id + package_hash` 等值过滤，只读取这一篇文章的小集合，再在进程内做 cosine + lexical ranking。禁止在全表上执行 vector/FTS/trigram OR 排序。

发布状态机：

```text
Markdown only: private draft -------------------------------> public article

Article package: private draft + expected hash
      -> pending -> server validates + embeds + transactionally replaces chunks
      -> ready(expected == indexed) -> public article
      -> failed / hash mismatch ----------------------------X publish
```

Blog hook 必须拒绝 `agentContextRequired=true` 且索引未 ready 或 hash 不一致的 public/published mutation，防止绕过 Skill 从后台直接发布半成品。

## Index API

`POST /api/blog/[id]/agent-index`：

- 只接受 Payload 已认证的 admin/editor；匿名、普通用户和跨站请求拒绝。
- 只处理 `draft + private` Blog；请求体硬限制 160 KiB，结构只允许 package payload。
- 从服务端按 id 读取 title、slug、excerpt、contentMarkdown 和预期 hash，不接受客户端替换 Blog 身份或主 Markdown。
- 校验 Git-derived manifest snapshot、内容 hash、package hash、大小和 source kind；重新切块并调用 DashScope embedding。
- 新 package/chunks 在 PostgreSQL 事务内写入；写入完成后才把 Blog 标记为 ready。中途失败保留 draft/private 并标记 failed。

`GET /api/blog/[id]/agent-index` 只向 admin/editor 返回预期 hash、索引状态、实际 hash、chunk count、model 和 indexedAt；不回传 source content 或 embedding。

## Chunking and retrieval

- 主 Markdown 按 heading 划分；过长章节再按段落/字符切为约 1,200 字符、150 字符 overlap。
- supporting source 以文件为边界，按约 1,500 字符、200 字符 overlap；chunk id 包含稳定 source id 与 ordinal。
- 索引模型固定为 `qwen3.7-text-embedding`、1024 dimensions，通过 DashScope OpenAI-compatible embeddings endpoint，服务端超时和响应维度必须校验。
- 查询时先读取当前 Blog ready package。缓存命中只根据 package context hash 校验引用，不调用 embedding。
- 缓存未命中时只为访客 question 生成 embedding；将 dense cosine 排名与确定性 lexical/code-identifier 排名融合，最多选择 6 chunks、总证据最多 14,000 字符。
- DashScope 暂时不可用时退回当前 package 的 lexical ranking；无法得到有效 package context 时退回第一阶段 Markdown 检索。
- DeepSeek 仍只看到当前问题和最终选中的当前 Blog evidence；evidence 中任何指令都按不可信数据处理。

## Citations and UI

- 主文档 chunk 沿用当前 heading anchor。
- supporting chunk 的引用标题包含来源类型与 label/path，并只跳回该 Blog 的 manifest `sectionAnchor`；没有有效 anchor 时跳到文章顶部。
- API 仍只返回当前 `/blog/<slug>` 或其 hash fragment。客户端继续拒绝其他 URL，不给模型生成任意链接的能力。
- 不新增通用客服头像、全站对话历史、访客文件上传或工具执行。

## Configuration and safety

- Answer provider: DeepSeek `deepseek-v4-flash`，使用现有 `BLOG_AGENT_*` 预算、缓存、并发与 Nginx 限流。
- Embedding provider: `DASHSCOPE_API_KEY`、`BLOG_AGENT_EMBEDDING_BASE_URL`、`BLOG_AGENT_EMBEDDING_MODEL`、`BLOG_AGENT_EMBEDDING_DIMENSIONS`、`BLOG_AGENT_EMBEDDING_TIMEOUT_MS`；全部 server-only。
- 首次生产部署时 UI/generation flags 仍保持 false。先运行 migration、private draft indexing、provider canary 和 abuse checks，再通过 GitHub variables 开启。
- 日志、usage 表和错误响应不得存储/输出 API key、原始 IP、访客问题、完整 Markdown、source content 或 provider response。

## Success criteria

- 没有 manifest 的旧文章行为和发布流程不变。
- Package article 未索引 ready 时无法公开；ready 后 Agent 能引用主文档和至少一个 supporting source。
- 修改 package hash 会让旧索引和旧回答缓存失效。
- 任意访客请求都无法跨 Blog 读取 chunks；SQL 证据显示始终有 `blog_id + package_hash` 等值过滤。
- 敏感内容、未跟踪/未提交 source、越界路径、超限 package、错误 embedding 维度全部 fail closed。
- 全量单测、PostgreSQL 15 集成测试、lint、type-check、build、浏览器 QA、生产 canary 全部通过后才开启入口。
