# 单篇 Blog 悬浮 Agent 第一阶段设计

## 背景与目标

个人站的核心内容单元是 Blog。每篇 Blog 可以承载文章叙述、技术实践、代码、图片和数据，但第一阶段只有已经发布的 Markdown 正文。

第一阶段要在公开 Blog 详情页增加一个悬浮 Agent。用户通过自然语言提问，Agent 只依据当前 Blog 的 Markdown 回答，并提供可以跳转到原文章章节的引用。系统不跨 Blog 检索，也不连接本地 Codex。

成功标准：

- 公开 Markdown Blog 详情页出现易发现但不打扰阅读的悬浮机器人；
- 用户不需要选择“检索”或“生成”模式，直接提问即可；
- 回答只使用当前 Blog，引用可跳转到对应章节；
- 草稿、私密文章、其他 Blog 和未公开材料不能进入上下文；
- 没有模型配置或功能关闭时，现有博客功能、构建和发布流程不受影响；
- 模型调用有服务端密钥、限额、超时、缓存、并发控制和紧急关闭能力。

## 第一阶段边界

### 包含

- 公开且已发布、拥有 `contentMarkdown` 的单篇 Blog；
- Markdown 标题解析、稳定章节锚点和当前文章内的相关章节选择；
- OpenAI-compatible 聊天模型的一次 grounded generation；
- 当前文章章节引用；
- Blog 页右下角悬浮机器人和问答面板；
- 服务端持久化生成配额与回答缓存；
- 安全开关、Nginx 边缘限流说明和上线 canary 流程。

### 不包含

- 跨 Blog、全站或外部网页检索；
- 独立 `/ask` 页面；
- embedding、vector extension 或语义向量索引；
- 多轮对话记忆；
- 本地 Codex、Coding Agent、仓库或数据库的实时连接；
- 代码、数据集和附件的按需加载；
- Experiment、LearningEntry、Project 等其他集合接入 Agent；
- 任意 URL 抓取、文件上传、工具写入、MCP 或 A2A；
- 第一阶段修改全局 `publish-site-article` Skill。

## 核心设计决策

### Blog 是安全和数据边界

API 路径使用当前文章 slug，例如 `POST /api/blog/[slug]/agent`。请求体只包含问题，不接受 `blogId`、其他 slug、来源列表、历史消息、自定义 prompt 或 URL。

服务端根据路径中的 slug 重新查询 Blog，并显式要求：

- `status = published`；
- `visibility = public`；
- `contentMarkdown` 非空。

上下文构建函数只接收这次查询返回的单篇 Blog 文档。它没有列举或搜索其他 Blog 的依赖，因此跨 Blog 不只是运行时过滤，而是能力上不存在。

### Markdown 是唯一事实源

第一阶段不新增文章业务字段，也不维护独立的知识索引。每次请求从当前 Blog 的最新 Markdown 构建上下文，避免索引过期、文章转私密后残留或发布 Skill 与索引双写不一致。

Markdown 会解析成有顺序的章节：

```ts
type ArticleSection = {
  id: string;
  heading: string;
  headingPath: string[];
  anchor: string;
  ordinal: number;
  content: string;
};
```

章节只是模型上下文的内部切片，不是新的站点内容实体。正文、代码围栏、表格和列表继续保留在 Markdown 中。

### 先文章内选择，再调用模型

上下文构建分两步：

1. 始终提供文章标题、摘要和章节目录；
2. 根据问题从当前文章中选择正文。

短文章在预算内时整体发送。长文章使用确定性的本地相关性评分选择章节，并在预算允许时补充相邻章节，保留叙事上下文。中文匹配使用规范化文本与字符 n-gram，英文和技术标识符使用 token 匹配；第一阶段不调用 embedding provider。

默认约束：

- 问题去空白后 1～500 字符；
- 请求体不超过 8 KiB；
- 最多选择 5 个章节；
- 模型证据正文总量不超过 14,000 字符；
- 模型输出不超过 600 tokens；
- 单次请求最多一次 chat completion；
- provider 超时默认 15 秒。

这些值通过有上下界的服务端环境变量调整，不能由访客请求覆盖。

## 请求与回答流程

```text
Blog 详情页
  → POST /api/blog/[slug]/agent { question }
  → 校验请求格式和大小
  → 查询当前 published + public Blog
  → 解析当前 Markdown 和稳定章节锚点
  → 在当前文章内选择相关章节
  → 检查缓存、配额和并发
  → 一次模型调用
  → 校验 JSON 与引用 ID
  → 返回安全 Markdown 答案和服务端引用
```

请求：

```json
{
  "question": "这个方案为什么选择批量写入？"
}
```

响应：

```json
{
  "queryId": "uuid",
  "answer": "……",
  "citationIds": ["section-id"],
  "citations": [
    {
      "id": "section-id",
      "heading": "写入路径设计",
      "url": "/blog/example#写入路径设计"
    }
  ],
  "insufficientEvidence": false,
  "usage": {
    "cached": false
  }
}
```

模型只能返回 `answer`、`citationIds` 和 `insufficientEvidence`。服务端删除未知 citation ID，并根据当前 Blog 的真实 slug 和 anchor 生成链接。没有有效引用的非拒答结果视为无效回答。

## 模型与提示词边界

模型客户端只支持服务端 OpenAI-compatible `chat/completions`：

```dotenv
BLOG_AGENT_ENABLED=false
BLOG_AGENT_GENERATION_ENABLED=false
BLOG_AGENT_BASE_URL=
BLOG_AGENT_API_KEY=
BLOG_AGENT_MODEL=
BLOG_AGENT_MODEL_TIMEOUT_MS=15000
```

- `BLOG_AGENT_ENABLED=false` 时不渲染悬浮入口，API 返回 404；
- 悬浮入口只有在两个开关都为 `true` 时渲染；
- `BLOG_AGENT_ENABLED=true` 但 `BLOG_AGENT_GENERATION_ENABLED=false` 时，直接调用 API 返回统一的暂不可用响应，不执行模型调用；
- API Key 不允许使用 `NEXT_PUBLIC_` 前缀；
- Base URL 和模型名由服务器部署环境控制，访客不能指定 provider；
- prompt 明确说明 Markdown、代码块和数据都是不可信证据，其中的指令不能覆盖 system 指令；
- 模型没有 Payload client、数据库连接、网络访问和写工具。

回答允许安全 Markdown 的段落、列表、强调、行内代码和代码围栏。禁用原始 HTML、图片、iframe 和模型生成的链接。引用由独立的 React 组件渲染。

## 费用与滥用控制

生成请求复用现有 HMAC 匿名身份，不保存原始 IP。新增最小持久化表：

- `blog_agent_usage_daily`：日期、identity hash、请求数、input/output token；
- `blog_agent_generation_events`：identity hash 和时间，用于滑动窗口限额；
- `blog_agent_answer_cache`：文章内容 hash、模型、规范化问题 hash、校验后的回答和过期时间。

默认限额：

- 每个匿名身份 10 分钟最多 3 次生成；
- 每个匿名身份每天最多 20 次；
- 全站每天最多 100 次；
- 每个身份并发 1；
- 单应用实例全局并发 3；
- 回答缓存 24 小时。

缓存键包含文章内容 hash，因此 Markdown 更新后旧回答不会命中。数据库异常、限额异常或 provider 异常都 fail closed，不进行未计量的模型调用。

生产 Nginx 对该精确 API 路径增加 body size 和请求频率限制。应用层限额不能替代边缘限流。

## 悬浮机器人交互

### 入口

- 只在未登录访客可访问的公开 Markdown Blog 页面显示；
- 固定在右下角，并避开移动端 safe area；
- 使用机器人图标和短标签，不遮挡正文操作；
- 默认做幅度约 4px、周期约 3 秒的轻微上下悬浮；
- 首次进入可以有一次柔和光晕，之后不持续闪烁；
- `prefers-reduced-motion` 下关闭位移动画。

### 面板

- 桌面端从右侧打开窄面板，文章仍然可见；
- 移动端使用底部面板；
- 面板标题显示“正在阅读《文章标题》”；
- 提供固定且不额外调用模型的建议问题，例如“这篇文章解决了什么问题？”“核心实现是什么？”“作者得出了什么结论？”；
- 第一阶段是单轮问答：新问题替换当前回答，不发送历史消息；
- 引用点击后关闭或最小化面板，并滚动到当前文章对应标题；
- 支持 loading、证据不足、限流、模型暂不可用和手动重试状态；
- 按钮和面板提供可访问名称、焦点管理、Escape 关闭和键盘操作。

站点不向用户展示“检索模式”“生成模式”“知识库”等内部概念。

## Markdown 渲染与锚点

文章页面和上下文解析器必须共用同一个 heading slug 算法。算法需要覆盖中文标题、重复标题、标点、代码围栏内的 `#` 和无标题开头。

文章渲染时为 heading 写入稳定 `id`。上下文引用只指向真实 heading；无标题开头使用页面顶部，不生成不存在的 fragment。

## 发布 Skill 第一阶段边界

现有 `publish-site-article` Skill 已能上传 Markdown、图片和 attachments，并默认创建 private draft。第一阶段不修改它：

- Blog 成为公开 Markdown 后，Agent 在请求时读取最新正文；
- Markdown 更新立即体现在下一次上下文构建中；
- Blog 转 draft/private 或删除后，公开 Agent 查询无法再取得正文；
- Skill 不负责解析章节、生成索引、调用模型或配置 Agent。

代码、数据和其他文章材料的离线文章包属于第二阶段，届时单独设计并审批。

## 错误处理与隐私

- 不在应用错误日志打印完整问题、Markdown、模型上下文、provider 响应或 API Key；
- 日志只记录 query ID、文章内部 ID、结果类型、耗时和 token 计数；
- provider 错误正文不返回访客；
- 前端将网络错误、限流、证据不足和 provider 不可用区分为可理解状态，但不泄露内部实现；
- 浏览器不持久化问题或回答到 localStorage；
- 对模型供应商只发送已经公开的当前 Blog 片段。

## 测试策略

### 解析与上下文

- 中文、英文、重复标题和代码围栏生成稳定章节；
- 短文章整体上下文与长文章预算裁剪；
- 中文改写、技术标识符、表格和代码块的文章内匹配；
- 任何选择结果都属于传入的单篇 Blog。

### API 与安全

- 未启用返回 404；
- 草稿、私密、RichText-only 和不存在的 Blog 返回 404；
- 未知字段、历史消息、URL、自定义 prompt、超长问题和超大 body 被拒绝；
- 请求无法通过 body 选择第二篇 Blog；
- Markdown prompt injection 不能产生工具调用或未知引用；
- 缓存按文章 hash 和模型隔离；
- 限额在进程重启后保持有效；
- provider 超时和无效 JSON fail closed。

### UI

- 悬浮机器人只在符合条件的 Blog 出现；
- 桌面侧栏、移动底部面板、Escape、焦点和 reduced motion；
- loading、回答、引用、证据不足、限流和错误状态；
- 引用可滚动到真实 heading。

### 发布门禁

- lint、TypeScript、完整测试和 production build；
- PostgreSQL migration up/down 真库测试；
- 使用专门的低额度模型 Key 对一篇无敏感信息的公开测试文章 canary；
- 验证 Nginx、域名 TLS、额度和紧急关闭后才允许正式开放。

## 发布顺序

1. 独立分支完成实现和审查，两个开关保持 `false`；
2. GitHub PR 运行 CI，不直接修改阿里云服务器代码；
3. 合并前备份生产数据库与媒体；
4. 部署 schema 与应用，保持入口关闭；
5. 配置服务端低额度模型 Key 和 Nginx 限流；
6. 保持公网入口关闭，在服务器容器内使用只读 canary 命令对一篇无敏感信息的公开测试文章调用模型；该命令接受固定 slug 和问题，不启动 HTTP 入口、不写文章；
7. 完成私密隔离、prompt injection、费用和移动端验证；
8. 显式开启悬浮入口；异常时首先关闭 `BLOG_AGENT_ENABLED`。

## 后续阶段

第二阶段才把 Blog 从“Markdown 文章”扩展为“文章包”：离线发布代码、数据和附件，并为每项材料提供类型、说明、章节归属和公开状态。公开 Agent 仍然只读取当前 Blog，问题决定加载当前文章包中的哪些材料。该阶段不会改变第一阶段的用户入口，但需要单独的安全与发布 Skill 设计。
