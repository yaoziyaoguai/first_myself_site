# 文章内交互 HTML：审计与实施执行包

审计日期：2026-10-21。目标仓库：`yaoziyaoguai/first_myself_site`。

> 审计与执行包已完成；2026-10-22 已实现、隔离验证、经 PR #68 合入 main（`ea1e527`）并通过 GitHub Actions 部署启用，生产三浏览器交互与撤回验收通过。实际证据见 TESTING_GUIDE 与 STATUS/RECENT。Oracle 使用网页控件确认的最高 5/5，正常结束并保存完整回答。本文件是经本地源码复核后的执行版本；与 Oracle 原始建议不一致时，以本文件明确的裁决为准。

**主路线：文章绑定的私有 HTML 存储 + 专用 HTML 响应 + HTTP CSP 沙箱；点击启动，同一 iframe 原位放大。** 不全站开启 raw HTML，不新建域名/服务，不把 HTML 加入 RAG。

Oracle 审计于 2026-10-21 以控件确认的最高 5/5 完成，正常捕获完整回答，退出码 0；发送了 12 个相关公开源码文件。原始回答与运行证据仅留在本机 `.local/interactive-html-audit-20261021/`，不随仓库公开。以下结论已结合实际源码复核，而非直接转录外部建议。

## 1. 本次目标与授权

支持把作者生成的独立交互 HTML 放在 Markdown 文章指定位置，读者能点击打开，操作按钮、标签页、参数滑块与本地演示，并在不丢失当前状态的情况下扩大阅读区域。HTML 是文章的一个内容块，不是另建产品、知识库或通用应用托管平台。

`answer-me-with-html` 只是输入文档的一个来源；不要调用它来解释本执行包。业务内容、文章 URL、slug、发布日期、更新日期语义、合集、SEO 与单文章 Agent 边界必须保持。

2026-10-21 审计阶段仅获准审计与编写执行包。后续本地实施与 2026-10-22 发布收尾已分别取得用户授权，当前进展见项目 STATUS/RECENT 记录。本执行包本身不授予将来的生产、凭据或外部写入权限。

## 2. 已核实的基线

- 审计基于本地 `main`，HEAD 为 `ef3aa93b41b999e77356f0941c23422ca3d4e584`；开始时跟踪文件干净。接手时必须重查分支、HEAD 和工作区，不得覆盖他人的修改。
- 仓库经 GitHub CLI 确认为公开。Oracle 只收到 12 个相关公开源码文件和审计问题，没有发送 `.env`、密钥、浏览器资料、真实文章附件或生产数据库。
- Next.js 16.3.0、React 19.2.4、Payload 3.87.1、PostgreSQL 15、Tailwind 4、react-markdown 10.1、remark-gfm 4；已有 Base UI Dialog、Vitest、Testing Library、Playwright。保持 npm 与现有 GitHub Actions → 阿里云流程。
- 当前 checkout 没有 `node_modules`。本轮是审计，未运行应用构建、单元测试、数据库集成测试或功能浏览器验收。历史测试记录不能作为这个新功能已通过的证据。
- 生产 Nginx 配置不在仓库，本轮没有登录服务器修改或读取它。已有探测只证明 `/api/media` 上 400 KiB 请求可到达，不证明新路径、更大的上传或实际 iframe 策略可用。

### 代码证据与必须处理的断点

| 已存在的事实                                                                                                             | 对新功能的要求                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/components/MarkdownArticle.tsx` 使用 ReactMarkdown，没有开放 raw HTML；已有标题去重、锚点与代码/表格滚动            | 不全局启用 `rehype-raw`；新块必须经过窄协议，保留原渲染行为                                    |
| `src/payload/collections/Media.ts` 的读取权限始终为 true                                                                 | HTML 不得作为普通 Media 上传；这不是已复现的现网攻击，而是不能继承的存储/权限设计              |
| `src/payload/collections/Blog.ts` 已有文章状态、可见性、发布门禁和缓存撤回逻辑                                           | HTML 读取与文章当前状态绑定，不能用“知道 URL”当授权                                            |
| `src/payload/fields/MarkdownPreviewField/index.tsx` 是另一套 Markdown renderer，用源偏移映射双栏滚动                     | 前后台共用块协议；预览外层保留 `data-source-offset`，布局改变后重测；普通打字不能反复启动 HTML |
| `next.config.ts` 全站 `frame-ancestors 'none'`，另有 X-Frame-Options                                                     | 不为嵌入功能放松主站/后台反嵌套策略；普通同源 HTML URL 不能直接照搬                            |
| `src/lib/visitorContentCache.ts` 只缓存匿名公开内容，登录态绕过                                                          | HTML 大文本不得进入列表、首页、文章 RSC 或共享内容缓存                                         |
| `replacePublishedPackage()` 在 `src/lib/blog-agent/articleIndexRepository.postgres.ts` 直接用 SQL 事务更新公开正文与索引 | 它绕过 Payload hooks。HTML 引用校验必须在这里的同一事务中再执行，不可只在 CMS 钩子检查         |
| `src/lib/blog-agent/articleMarkdown.ts` 用原始 Markdown 切文章上下文                                                     | Agent 只接收互动块的可见标题/说明，不索引 HTML、JS、隐藏源文或假装执行结果                     |
| 全局发布 Skill 的现有 `plan` 离线；`draft` 私有；公开/覆盖需要独立确认                                                   | HTML 必须接入这些现有命令与门禁，不另开可绕过确认的发布路径                                    |

### 示例 HTML 的隐私事实

本地检查 `answer-me-with-html/scripts/am.mjs`，确认其 `sourceTag()` 会在 `textarea#am-source` 中包含原始 Markdown。可见画面没有敏感词，不代表文件没有敏感信息。审查必须覆盖注释、隐藏 DOM、JSON、脚本字符串、内嵌资源及任何编码内容。对已识别的作者工具源文/复制控件，只处理发布副本；保留原始文件，不修改该生成器的全局行为。无法确认安全或完整性的文档拒绝发布，不能靠 iframe 沙箱掩盖数据泄露。

## 3. 冻结后的实现合同

### 3.1 范围与作者体验

支持完整 UTF-8 文档中的内联 CSS/JS、按钮、tabs、滑块、纯前端计算、SVG/Canvas 动画，以及已内联且不超过限制的 data 图片/音视频/字体。是否支持某种媒体编码仍以真实浏览器为准。

读者看到正文中的标题/说明和“启动交互”，点击后才加载。可以扩大显示区域、继续操作、收回原尺寸；“停止交互”会销毁运行实例并明确告知状态重置。

作者两种入口共用一套协议：

1. **发布 Skill**：Markdown 在指定位置引用本地 HTML，照常 plan → draft → 明确 publish；工具负责公开副本、hash、上传和标记替换。
2. **后台**：新文章先保存私有草稿获得 ID，然后“插入互动内容”选择已审查的公开副本，填写说明；成功后插入光标位置，失败不改正文。已有文章同样插入，不要求作者手填 hash。ready Agent 文章公开正文的编辑仍提示使用现有原子更新路径，不能自动关掉 Agent 门禁。

v1 明确不支持：外部脚本/样式/CDN、未打包相对资源、网络字体、srcset、远程 API/模型调用、密钥/登录/表单提交、核心功能依赖 storage/clipboard/popup/download/eval，以及静态 `iframe/frame/object/embed`，包括 `data:text/html` 的嵌套动画。提示作者改为同文档 SVG/Canvas、内联资产或有界离线媒体。不要声称所有生成器输出都能原封不动上传。

不做自动高度消息桥、不做上传任务平台、不增加跨文章资源库、不运行服务器端 HTML、不重新构建网站来发布每个文件。

### 3.2 Markdown 协议

本地包示例：

````markdown
```interactive-html
{"version":1,"id":"latency-demo","path":"./interactive/latency.html","caption":"调整参数，观察排队延迟","summary":"比较服务时间变化对等待时间的影响。"}
```
````

存储正文示例（hash 占位符需要由程序替换，不可原样保存）：

````markdown
```interactive-html
{"version":1,"id":"latency-demo","sha256":"<64位小写SHA-256>","caption":"调整参数，观察排队延迟","summary":"比较服务时间变化对等待时间的影响。"}
```
````

- 只识别 Markdown AST 的**顶层 fenced code node**，语言恰为 `interactive-html`，没有额外 fence meta。引用块、列表中的节点、缩进代码、外层四反引号示例里出现的字样不能误执行。
- `version` 为数字 1；`id` 为 `[a-z][a-z0-9-]{0,47}`，同篇唯一；拒绝未知字段、重复 JSON 键、错误类型和未知版本。TS 不得只用丢失重复键信息的 JSON.parse 再声称检查了重复键；使用保留键事件的严格 JSON 解析能力，并做对照测试。
- `path` 与 `sha256` 恰有一个。本地路径是包内普通文件，拒绝 URL、绝对路径、路径穿越和 symlink；服务器正文只能保存 sha256 形式，不保存本机路径。
- `caption` 为 1–200 个 Unicode 码点，`summary` 可省略、最多 1000 码点，均 trim 后按纯文本显示；不映射为 HTML、URL 或任意 iframe 属性。
- 存储 JSON 字段顺序固定为 `version,id,sha256,caption,summary`，最后一项缺省时省略。用紧凑 JSON、实际 Unicode 字符与 LF；规范三反引号 fence。HTML hash 不含数据库 ID、域名或时间。
- 同一 hash 可由两个不同 id 引用，每个拥有独立运行状态；caption、周边文字和 source offset 变化不重启。更改 id/hash 或删除块可停止旧实例，新版本必须再次点击启动。
- 网站侧共享一个权威 TS parser。Python 使用正式 Markdown parser 与同一份 golden fixtures；不能用全文正则搜字符串冒充 AST 解析。

### 3.3 内容预检、字节与大小

固定上限：单个最终 HTML 及一次原始上传 body 各 **524,288 字节（512 KiB）**；marker JSON 4096 UTF-8 字节；每篇最多 4 个块；当前引用的唯一资源总量最多 2 MiB。

公开副本由本地准备流程产生，原件不变。确定性处理顺序：UTF-8 严格解码 → 移除可选 BOM、统一 CRLF/CR 为 LF → 针对确认版本的作者工具做有界适配 → 审查最终文本 → 计算准确 UTF-8 字节的 SHA-256。之后上传、落库、读回、HTTP body 都是这份准确字节，服务端不再格式化/清洗/注入脚本或重新归一化。服务器拒绝 NUL、BOM/非规范换行、非法 Unicode、超限或不符合 profile 的文档；不得截断。

HTML/CSS 预检使用标准解析器，而非不断增长的正则：识别并拒绝远程/相对资源、srcset、CSS `@import` 或非 data URL（允许 SVG `url(#id)`）、base、meta refresh、自带 CSP meta、预连接及不支持的嵌套文档。data MIME 设显式图片/音视频/字体白名单；即使写成 `data:` 也不准许 HTML/JS 资源。解码检查必须有累计 512 KiB 上限、不递归解包、不执行脚本。恶意构造的动态 JS 不能靠静态扫描证明安全，必须保留人工/执行 Agent 的全文审查与真实交互验证。

`answer-me-with-html` 适配只清空已识别的 `#am-source`，移除或禁用其专用 `[data-am="copy"]` 控件，不删除所有 textarea/hidden/script。当前查看的生成器对 copy 按钮有空值保护，但实现必须用真实版本 fixture 证明其它交互不受影响；不靠这个观察承诺所有未来版本。服务器发现非空的已知源文节点时返回 422，让作者先准备公开副本。其它注释、JSON、内嵌资源仍需审查，不能给出“敏感信息扫描保证无秘密”的结论。

512 KiB 是产品限制，不是已验证的生产限制。新路径通过反向代理的能力在上线门验证；不得通过分片绕过限制、放宽全站 body limit 或悄悄剥离图片/内容让文件变小。

### 3.4 一张私有表与不可变版本

新增 `blog_interactive.html_documents`，沿现有 prodMigrations 注册，不成为 Payload collection 或 Blog relationship：

| 列                | 约束                                                      |
| ----------------- | --------------------------------------------------------- |
| `blog_id`         | 与现有整数 Blog ID 一致；FK → blog.id，删除文章时 cascade |
| `sha256`          | 64 位小写 hex；与 blog_id 组成主键                        |
| `html_text`       | 最终审查副本，不存原件                                    |
| `byte_length`     | 等于 `octet_length(html_text)`，1–524288                  |
| `profile_version` | 固定为 1                                                  |
| `created_at`      | 创建时间                                                  |

只有验证成功才 INSERT。重复 `(blog_id,sha256)` 必须核对完全相同字节，201 首次/200 幂等；不提供 PATCH、可变 latest 指针或独立 DELETE。小型数据库触发器拒绝 UPDATE 内容、归属、digest、profile 等身份字段；删除只随文章删除级联。没有 pending/public 状态列或第二份引用表，公开引用唯一真源是当前正文。

**补充 Oracle 未封闭的积累风险**：每篇最多保存 64 个不同版本、全表最多 256 MiB HTML 文本；上传按已认证用户限速（复用现有小站进程内 limiter，如 10 次/分钟），不新增 Redis。新版本插入的数量/总量检查与 INSERT 同事务，必要时用一把固定 PostgreSQL advisory transaction lock 串行化短小上传事务；先锁再重新计数，不能读完额度后并发超额。已存在的完全相同版本仍可幂等读取/重试，不被额度卡住。耗尽返回 409 `INTERACTIVE_STORAGE_LIMIT`，说明需审查旧版本；不自动删除历史或创建 GC 服务。这里的 256 MiB 仅限制资源文本，不冒充数据库/WAL/备份总磁盘配额。

文章绑定不是上传者个人私有区：admin/editor 保持原文章管理能力。B 文章必须有自己的 `(B,hash)` 记录，不能只复制 A 的 marker 获得访问。

### 3.5 API 与权限

沿用实际目录 `app/api/blog/[identifier]/`，不要另建 `[id]` 造成同级动态路由参数冲突。以下 `{id}` 只接受规范正整数 Blog ID；`{sha}` 为小写 64 位 SHA-256。

| 路由                                        | 行为                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/blog/{id}/interactive-html/{sha}` | admin/editor；原始 UTF-8 body，成功仅返回 `{sha256,byteLength,profileVersion}` 元数据                               |
| `GET` 同路径                                | admin/editor；同一份元数据；无匿名枚举/列表                                                                         |
| `GET` 同路径 `?source=1`                    | admin/editor 显式按需读回 `{sha256,byteLength,profileVersion,html}` JSON；其它查询参数拒绝，不能借 preview 字样绕权 |
| `GET/HEAD .../{sha}/view`                   | 匿名/viewer：published+public+当前有效引用；admin/editor：published+当前有效引用，可读 private                      |
| `GET/HEAD .../{sha}/preview`                | 仅 admin/editor；允许 draft 和尚未插入的已上传文档，但仍必须绑定目标 Blog                                           |

所有读取和错误都 `Cache-Control: private, no-store`；不走 unstable_cache、不提供可绕过鉴权的 304。HEAD 执行同一授权/引用规则，不返回 body；GET 再独立检查。

加一个服务端布尔开关 `BLOG_INTERACTIVE_HTML_ENABLED`，默认关闭。关闭时拒绝 PUT 和可执行 view/preview（503 `INTERACTIVE_DISABLED`），前端仍保留可见说明；后台的已认证元数据/JSON 读回可以保留用于排障。它不是 `NEXT_PUBLIC` 秘密或第二套权限，也不能远程杀死已经运行的 frame。测试环境明确打开，生产在代码、迁移和代理验收完成并获得授权后打开；`.env.example` 与现有 Compose 环境传递需同步，不借此重写部署流程。

读取使用**一次 SQL join 的快照**获得当前文章状态/正文和精确的资源，再用权威 parser 校验引用，不做两个可能看到不同提交状态的普通 SELECT。DB 故障返回 503，不伪装 404 或回退历史 HTML。权限不足、缺失、跨文章、未引用的前台读取统一 404；已开始并取得旧快照的请求可能完成，撤销提交后新开始的读取必须被拒绝。

PUT 的写边界：

- `Content-Type: text/html; charset=utf-8`、`X-Interactive-Request: 1`；拒绝非 identity Content-Encoding。
- 流式累加实际字节；有无 Content-Length 都有效，超过上限立即取消并返回 413。
- Origin 存在则必须精确匹配可信配置的站点 origin，拒绝 `null`、same-site 但不同 origin；Fetch Metadata 存在只接受 same-origin。不能相信用户任意 Host 或转发头拼白名单。
- 同源后台可用现有 Cookie。没有浏览器 Origin/Fetch Metadata 的 CLI 必须用其现有 Authorization 身份（JWT/API-Key），服务端独立验证该 Authorization，不接受伪造空头借 Cookie 后备通过。
- 无宽泛 CORS、无任意 URL 下载、无服务端执行；自定义 SQL 不能假设 Payload collection access 自动保护，角色在服务端检查。

状态：管理接口未登录 401/错角色 403；语法/ID/UTF-8 400；类型/编码 415；大小 413；profile/hash/引用校验 422；版本冲突/储存额度 409；限速 429 带 Retry-After；数据库 503。错误码稳定，消息指出安全的元素/属性/行号，不回显正文、内部路径或凭据。

### 3.6 HTTP 沙箱与精确响应头

仅 `/view`、`/preview` 返回可执行 HTML；成功时固定如下策略：

```text
Content-Security-Policy: sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self';
Content-Type: text/html; charset=utf-8
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: no-referrer
X-Robots-Tag: noindex, nofollow, noarchive
```

继续禁止设备/clipboard 等可选权限。外层 iframe 只有 `sandbox="allow-scripts"`、`referrerPolicy="no-referrer"` 和已转义的 title；没有 same-origin/forms/popups/top-navigation/downloads。内联事件兼容性保留，但没有 unsafe-eval、网络脚本来源或任意 allow 参数。

在 `next.config.ts` 保持全局保护，再用**精确匹配**的专用路由策略替换该响应的 CSP；不能对整个 `/api` 或 `/blog` 放宽。Next 文档描述最后一个匹配的同名头覆盖前者，但实施时仍须查看安装版本并用实际 production server 响应确认。路由本身也使用同一个 header helper，使成功、错误、HEAD 一致，不散写多份值。Nginx 追加的 CSP 不会被一个更宽松的应用头抵消，必须逐个检查最终 headers。[Next headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)

HTTP sandbox 与 iframe sandbox 双重保留：直接顶层打开 view/preview 也受限，不提供无沙箱 HTML 下载别名。JSON source 只能是 JSON + nosniff，不通过危险 Content-Type 变为另一条执行路径。[MDN CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox)

iframe 能否被嵌入由 frame-ancestors 决定，不能拿允许加载子 frame 的 frame-src 替代。只修改专用 HTML 响应，不改变主站/admin 的 `frame-ancestors 'none'`。[MDN frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)

**不能承诺**完全零网络、所有动态子文档不存在、任意脚本无恶意或没有 CPU 死循环。connect-src 约束的是特定网络 API，不是网络防火墙；sandbox 不是资源配额。测试自导航/动态 about:blank 等行为时如实记录，不伪造“全部禁止”的断言。[MDN connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src)

### 3.7 对 Oracle 草稿建议的明确简化

**不采用“先保存说明占位稿，再二次替换整个正文”的 bootstrap 方案。** 本地核对发现：发布器目前没有现成恢复日志；包模式是 create-only；新建用的 `build_agent_package_payload()` 不依赖数据库 ID。二次覆盖正文会增加部分失败与并发公开时的风险，还可能逼出新的草稿 CAS/finalize 平台。

选择更小的例外，且只允许在 `draft + private`：

1. 离线准备最终公共副本和 SHA；上传既有图片后，完成图片 URL 与 HTML marker 替换，得到本次准确正文和 package hash。
2. **一次创建私有草稿，正文已是最终 canonical marker**。语法、id 唯一、数量全部有效；允许其中部分 hash 尚未上传，后台显示“互动资源待上传”，不声称草稿已同步完毕。
3. 得到 blogId 后上传精确制品，回读核对 hash 与字节。尚未公开的内容只有作者 preview 能读。
4. 全部引用齐全后才启动现有 Agent 索引；无 Agent 包则回读整篇与资源即可。完整成功前不报告 draft 同步完成。
5. 继续沿用显式 publish；**任意转入 published 的保存、任何索引写入/ready 切换都要求所有引用真实存在且绑定当前文章**。`draft+public` 不获得缺失资源例外。新建即公开且带 marker 必须失败，先走私有草稿。

因此“私有草稿保存成功”与“资源准备完成/可发布”是不同结果，不新增数据库状态列；完成度从当前引用和资源实时推导。这个例外不影响匿名读取，不允许本地 path、坏 marker、跨文章读取或绕过发布门禁。

确认过的 hash 事实：新建 package 的 mainSha256 基于最终 Markdown，初始包不需要 DB ID；公开原子修订的 `hashPublicArticle()` / `_public_article_hash()` **包括 id**，必须保留原算法。图片优化/URL 改写尚未完成时，plan 不能把中间正文 hash 冒充最终服务端 hash。HTML 文件自身 digest 则可以离线固定。

### 3.8 校验接入点与事务

抽出纯 marker 校验和 `assertReferencesReady(queryClient, blogId, markdown)`：检查记录存在、owner/profile、数量和总量。只查必要元数据，不 SELECT 全部 HTML。

- **Blog hooks**：合并 data/originalDoc 后始终校验语法；仅私有草稿允许未齐资源。最终 published 或准备写 ready 状态必须调用完整引用校验。普通 CMS 保留现有并发语义，不宣传新增通用 CAS；不通过 second pool 锁同一 Blog 制造自锁。
- **原子公开修订**：`replacePublishedPackage()` 在 FOR UPDATE + matchesPublishedSnapshot 后、writePackage 前，对最终 replacement（或未改正文时的当前正文）使用同一个 client 校验；全部提交或全部回滚。
- **草稿索引**：`replacePackage()` 当前只选 agent_package_hash，需补读当前正文/状态，核对当前 articleHash 与准备的包一致，并在该事务用同一 client 校验资源；预检可在 embedding 前做，不能替代事务内复查。
- **索引刷新**：PUT 只更新索引也要对当前正文校验，不能让未齐资源变 ready。Agent 功能开关/模型没配不会妨碍普通 HTML 存储与读取；只复用数据库能力，不依赖 provider runtime。
- **删除/撤回**：保留现有禁用 bulk edit/delete、fail-closed cache hooks；FK 删除资源随文章事务一起回滚或成功。旧共享文章页可以显示旧说明，但新资源请求不能沿用旧权限。

### 3.9 发布失败与恢复

原发布器没有现成“草稿创建恢复日志”，不能写一句“沿原记录恢复”就当做已实现。

- 一旦获得草稿 ID，成功或失败输出都带该 ID、slug、当前阶段和已确认的资源 hash，不带 HTML/凭据。
- 增加窄的 `draft --resume-draft-id <id>` 恢复模式，与 `--update-draft` 互斥。只恢复当前计划下相同正文、slug、private+draft、相同 package hash 的准备流程，**不改正文或元数据**；只补传缺失制品、验证/恢复未完成索引。已 ready 且一致则直接核对，不再重复索引。ID 不匹配、目标公开、正文变化或第三版本出现均停止。
- 仍然禁止默认通过 slug 认领或覆盖既有文章；package create-only 保持，只把严格的同计划恢复单独列为例外。创建响应丢失且没有拿到 ID 时，先只读 inspect 并报告不确定状态，交由用户确认目标，再显式 resume；不能又 POST 一次试运气。
- 已有草稿的正常更新继续需要原 `--update-draft` 授权；新代码不能靠“恢复”绕过它。普通 CMS/草稿的并发编辑仍不新增通用 CAS，读回发现第三版本必须停止，不承诺消除已有 last-write-wins 语义。
- HTML PUT 超时允许同 owner/hash/准确字节幂等重传；原件在 plan 后变化必须重新计划。客户端最终 hash 与服务端及 source 读回不符则失败，不以“HTTP 200”代替内容验证。
- 公开更新先上传下一版，当前正文未引用前它对访客不可读。ready-package 继续走现有原子 PATCH，**不在其 360 KiB body 塞 HTML**。先上传失败则保持旧正文；PATCH 回执不确定先读文章/索引，已到目标版本视为成功、第三版本停止、只有明确仍是旧版本才重试。
- 所有路径保留 slug、日期、系列、已审查 GitHub 固定提交和公开确认门；不默默取消 agentContextRequired，不自动清除未引用版本。

### 3.10 读者 UI 与后台稳定性

初始 SSR 是说明和按钮，没有 iframe、HTML 字节或预取。点击后先 HEAD 获取状态，再 GET 加载 iframe；二者间撤回时 GET 仍要拒绝。load 事件仅表示浏览器完成该次加载处理，不能当作交互成功证据。[MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)

不用弹窗或 portal：保留同一 wrapper、iframe、父节点。常规高约 420px（短视口应有合理上限），扩大为约 80dvh、最大 960px；桌面可扩到文章布局允许的区域，不能压住 Agent 或让整页横向溢出。手机保持视口内宽度。前后都提供宿主控制，使用 aria-expanded/aria-controls，收起恢复按钮焦点。Escape 只承诺宿主有焦点时可处理；不能假称父页面收到 opaque frame 内按键，必须实测 Tab/Shift+Tab 可离开良性文档。

HEAD/GET 的 404/503 有状态文案和有界重试，caption 始终保留；设置合理超时，不无限转圈。成功页面真实控件由浏览器用例验收。纯 iframe 无跨帧协议无法可靠感知所有 CSP/运行错误，不能声称“已自动检测里面运行成功”；失败响应返回固定安全提示，外部保留“内容未正常显示？重试/停止”入口。

前后台各保留一次整篇 Markdown 解析，不能按 marker 切成多个 ReactMarkdown，避免破坏跨段引用链接/标题编号。自有 AST plugin 只将合法顶层节点变成固定受控块，保留原始 position。稳定 key 必须位于**同一父组件的直接 children 层**，按 `interactive:${id}`，renderer 组件类型模块级稳定；不能只给最内层 iframe 加 key。需实测在块前插入/删除普通段落、代码、另一 marker 时仍保留原实例。若 ReactMarkdown 当前版本的输出层不支持，先在 P0 找到真实可行的包装方式，不增加双 iframe 或 DOM 搬运。

后台原始 offset 使用 UTF-16，与 mdast 和 textarea 一致，不拿 Python 码点下标直接换用。新增 wrapper 后统一坐标系（例如相对预览容器的 rect + scrollTop），不能混用不同 offsetParent 的 offsetTop；ResizeObserver 只观察宿主尺寸，走现有 RAF 重算，不读取 frame 内部 DOM。

### 3.11 Agent 与内容发现

只在索引/证据派生阶段把有效 marker 变为“交互示例：caption。说明：summary。”，保持 sourceKind=article。不下载或索引 HTML/JS/隐藏文本，不把 JSON/hash/path 当代码证据，不暗示 Agent 操作过演示。先按原 Markdown 解析位置，再投影对应片段，标题锚点和原始 hash 输入不变；hash 的变化仍属于正文版本变化。

保留普通 Markdown、图片、合集、阅读时长语义、SEO 和原正文 URL。新内容的数据入库不依赖 GitHub 构建；网站与全局发布 Skill 的版本要分别验证和交付。

### 3.12 新依赖与证据闭环

必要的新增运行依赖限于标准 HTML/CSS/严格 JSON 解析（建议 parse5、css-tree，以及支持重复键检测的轻量 JSON AST parser）；已有 mdast/remark/GFM、pg、React/UI 库复用。parse5 虽出现在当前锁文件中，但属于 transitive，不能把开发期依赖偶然存在当成生产声明。安装时固定实际通过审查的版本，不批量升级框架或换包管理器。

Python 需要正式 Markdown/CSS 预检能力时采用小而明确、固定版本的依赖。不要另启 Node 服务；若选 uv 的脚本元数据，需验证实际启动形式确实加载它，不能在继续执行 `uv run ... python script.py` 时假设脚本元数据自动生效。同步更新 Skill 所有命令和测试入口，原 Markdown+图片用法必须仍然可执行。TS/Python 对同一组 marker、重复键、Unicode、HTML 字节 hash、CSS 转义资源样例一致；不要求两种 HTML parser 重新序列化出完全相同文档，因为服务器根本不重新序列化。

新增文件落点建议：`src/lib/interactive-html/{marker,profile,repository.postgres,headers}.ts`、一个受控 AST 接入模块、`src/components/InteractiveHtmlEmbed.tsx`，三类路由文件（管理、view、preview）、一份增量迁移和对应测试。具体拆分以职责为准，不额外增加通用 service/factory 层。HTML/CSS 服务器解析依赖不得打进前台 bundle；marker parser/常量可以共享。

### 3.13 审计采纳与修正摘要

- 采纳 Oracle 的 A 路线、HTTP 沙箱、文章绑定、原位放大、单层 HTML、原子 SQL 复查和严格证据要求；B/srcdoc 与独立域名不作为悄悄切换的备用实现。
- 修正草稿顺序为一次最终正文创建 + 私有待上传例外，避免二次覆盖正文；新 ready/public 门禁必须验证资源齐全。
- 补实已有 hash 算法和发布器没有恢复日志的事实，定义窄恢复命令；不引入 CAS/job 平台。
- 补齐未引用版本的储存上限、并发额度检查、重复键检测、无 Origin CLI 认证规则和上传后准确字节回读。
- 原位放大不是全屏模态，故不强行引入 Base UI Dialog 或跨帧 Escape/postMessage 桥；只凭 iframe.onload 不能报告里面运行正常。
- Media 的公开读取事实不等于当前版本已允许上传 HTML。实施 P0 核对安装源码并测试新建/替换上传；已拒绝则只加回归，确有旁路才加窄拒绝，不改历史媒体/SVG政策。

### 3.14 先做小型兼容性验证，不先铺完整系统

实施第一步必须在隔离本地环境，以站点实际 CSP 和正式 Markdown 渲染路径做小型验证。使用真正的生成器生成无敏感信息的例子，再加一个可观测状态的按钮/滑块例子。不得只拿手写的“Hello iframe”证明所有生成文档可用。

先确认：脚本能运行、父页面不能被访问、正常文档没有外部网络依赖、扩大后状态不重置、键盘有可达的退出/收起路径。前后台各验证一次；后台预览是高权限页面，不可为了方便在那里去掉沙箱。

验证失败时记录具体浏览器、响应头、文档及失败点；先修正小样例或报告架构阻塞。不能靠全站放宽 CSP、给 iframe 同源权限、禁用测试或改用线上真实文章来跨过门槛。只有这些事实成立，再增加数据库和完整发布流程。

### 实施顺序（每步都要有完成证据）

1. **P0 兼容性门槛**：正式路由的小型安全/交互样例和浏览器证据；现有页面不改行为。
2. **P1 协议与纯函数**：本地引用/存储引用、尺寸、hash、AST 识别、可见说明投影；先写 golden fixtures，再接数据库。
3. **P2 私有存储与受控 API**：增量迁移、授权、不可变保存、当前文章引用检查、失败与幂等；真库测试不能省略。
4. **P3 写入门禁**：普通 CMS 保存和现有 ready-package SQL 事务都覆盖；按 3.7 的私有待上传例外处理，不回到 Oracle 的占位正文方案。此步没完成，不接公开渲染。
5. **P4 前台与后台**：共享块渲染，按需加载、状态保留、错误提示、编辑器源偏移；不新增普通 Media 的 HTML 访问能力。
6. **P5 发布 Skill**：扩展原有 plan/draft/publish/update-published，而不是新增绕过旧门禁的上传脚本；两套语言通过同一组契约样例。
7. **P6 回归与交接**：完整检查、浏览器与真库证据、README/SECURITY/TESTING_GUIDE/Skill 契约，更新现有状态记录；远端动作另等授权。

### 接手时的文件边界

优先复用现有 renderer、权限方法、PostgreSQL 连接和发布命令。新增代码只围绕“文章交互 HTML”建立一个小模块，不借机重构整个 Blog Agent 或内容系统。

- 前台：`src/components/MarkdownArticle.tsx`、`app/(main)/blog/[slug]/page.tsx`、主站现有全局样式；新增一个明确命名的交互块组件及其必要样式。
- 后台：`src/payload/fields/MarkdownPreviewField/index.tsx` 及现有样式；保留 `mapScrollTopByAnchors` 和 `data-source-offset`。
- 权限/持久化：`src/payload/collections/Blog.ts`，新增受控路由与专用存储模块；新的迁移注册到 `src/payload/migrations/index.ts`。不要注册一个默认公开的 Payload upload collection。
- 响应头/开关：`next.config.ts`、`.env.example`、实际 Compose 配置的环境传递；只做精确路由策略和一个服务端布尔开关，不改 npm、镜像交付或 GitHub 部署架构。
- 原子更新：`src/lib/blog-agent/articleIndexRepository.postgres.ts`；API 错误映射和验证必要时才改 `app/api/blog/[identifier]/agent-index/route.ts`。
- Agent：只在 `src/lib/blog-agent/articleMarkdown.ts` 等已有正文入口投影互动块标题/说明；不修改模型配置、检索阈值或跨文章边界。
- 测试：沿用 `__tests__/components/`、`__tests__/payload/`、`__tests__/api/`、`__tests__/lib/`；真库执行入口在 `.github/workflows/ci-cd.yml`。
- 发布 Skill 真源：`/Users/jinkun.wang/.codex/skills/publish-site-article/` 下的 `SKILL.md`、`scripts/publish_article.py`、两份 references 和现有 tests。
- Claude Code 的 `/Users/jinkun.wang/.claude/skills/publish-site-article` 是指向上述目录的 symlink。只更新真源一次，不能替换该链接、复制另一套内容或声称网站 Git 提交会自动包含全局 Skill。

以上是文件职责范围，不是机械拆分要求。实现前再核对实际文件；为一个小函数新增一层 service/manager/factory 并无必要。

## 4. 实施后必须提供的证据

这些是后续实施验收要求，**不是本轮已通过的测试**。

| 范围         | 必须验证的行为                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正常体验     | 实际生成器的无敏感信息 HTML + 自定义滑块样例；点击前零 HTML 内容请求、零运行中的 iframe；点击后真实操作按钮/切页/计算；加载、失败、重试均有明确状态                                                                                                             |
| 保持状态     | 操作滑块或计数器后放大、缩回；值和 iframe DOM 身份不变，文档不重新执行；关闭运行再打开是否重置必须明确告知                                                                                                                                                      |
| 内容兼容     | 中文长标题、长文、图片、代码块、GFM 表格、目录重复标题；互动块前后段落不丢失，普通代码示例里的标记不执行                                                                                                                                                        |
| 响应式与键盘 | Chromium、Firefox、WebKit；1440 / 768 / 390px，另测手机短视口；真实 Tab、Shift+Tab、焦点恢复、明确退出控件、reduced-motion；不得把自动化 WebKit 说成实体 iPhone 验收                                                                                            |
| 权限         | 匿名、viewer、editor、admin；draft、published/private、published/public；当前引用、不再引用、其他文章的 hash、不存在资源；不能只检查按钮是否隐藏。private+draft 的缺失引用可以待上传，但不能读别篇资源、写 ready 或公开                                         |
| 撤回         | 先命中文章共享缓存，再将文章撤回/设私有/移除引用；新 HTML 请求必须失败。已下载到访客内存的公开字节无法远程销毁，不承诺追溯撤回                                                                                                                                  |
| HTML 隔离    | 嵌入时真实宿主 DOM、Cookie、存储访问失败；顶层跳转、弹窗、表单、下载、远程 fetch/XHR/beacon/WebSocket、远程脚本/CSS/图片分别验证。静态 frame 应拒绝，动态 about:blank/srcdoc 与自导航行为如实记录，不能宣称全部不存在；网络测试观察真实本地接收端，不只看控制台 |
| 输入错误     | 无效 UTF-8、超限、分块超限、缺失/伪造 Content-Length、错误 hash、路径穿越、symlink、未知协议版本/字段、无效 HTML、未处理的隐藏源文；全部有稳定错误且不产生公开内容                                                                                              |
| 数据库一致性 | 真实 PostgreSQL：外键、不可变版本、幂等重传、跨文章读取/发布失败、并发限额、文章删除；私有缺失资源草稿保存不等于 ready。公开 ready-package 正文与索引切换时引入不存在 HTML，必须整体回滚                                                                        |
| 发布         | 离线 plan 不联网/不鉴权；新私有草稿、中断恢复、普通公开文章更新、ready-package 原子更新、公开确认与回读；上传成功但后续失败不得报告“发布完成”                                                                                                                   |
| 回归         | 旧 Markdown/图片、系列、SEO、404、单文章 Agent、来源 GitHub 链接、缓存撤回、后台滚动对齐均不变；前后台看到同一标记的解释必须一致                                                                                                                                |
| 运行边界     | 正常生成器样例无未解释控制台错误；安全反例允许且应出现预期 CSP 错误，必须与业务样例错误分开统计                                                                                                                                                                 |

沿用仓库现有检查，不编造不存在的 npm script：

```bash
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm run build
```

- 真库测试接入已有 `BLOG_AGENT_TEST_DATABASE_URL` / `MIGRATION_TEST_DATABASE_URL` 隔离测试方式；环境缺失导致 skip 不能算通过，也不连接生产库补测。
- CI 当前位于 `.github/workflows/ci-cd.yml`，真实 PostgreSQL 专项是显式文件列表；新增真库测试必须加入相应执行路径，不能只放入文件而永远被默认条件跳过。
- Python Skill 测试沿用 `/Users/jinkun.wang/.codex/skills/publish-site-article/tests/test_publish_article.py`，同一份协议 golden fixtures 供 Python 与 TypeScript 使用。
- 截图、浏览器脚本、测试日志与 Oracle 原始结果保存在本地证据目录；不要把所有原始轨迹或 HTML 大文件提交到仓库。
- 至少在隔离库完成新表的备份/恢复验证。现有 `scripts/backup.sh` 是全库 pg_dump，理论上会包括新表，但不能用“理论上”替代恢复后 hash 一致的证据。

### 生产与仓库收尾边界

用户后续另行授权发布时，仍走 PR / CI / main / GitHub Actions → 阿里云，不在服务器直接改应用代码，不主动中断部署。验证迁移、实际新路由的请求上限、真实响应头、匿名/登录访问和一次无敏感信息的交互样例。

原始 HTML 是内容数据；功能部署完成后，新增或替换一篇文章的 HTML 不应触发 Docker 构建。首次新增功能和数据库结构仍需正常代码发布。上线先部署且保持新开关关闭，完成候选验证后再由授权的发布流程启用。

回滚优先关闭新开关，保留说明而停止新的可执行响应。回滚到不认识 marker 的旧应用时，可能退化为可见代码围栏，不能声称旧版本也会展示漂亮的静态卡片；这是安全但体验较差的退路。不要自动执行删除新表的 down migration，避免销毁已上传资源。恢复数据库属于另一次明确授权的操作。

交付前列清：修改文件、验证环境/版本、通过与未运行项目、所建本地服务、仍存在的用户工作。仅关闭本次启动且 PID 已核实的进程；不删除用户文件、不删除其他 worktree、不用强制 reset 把仓库“弄干净”。未经授权不提交、推送或清理远端分支。

## 5. 本轮真正完成的验证与交付

- 审计阶段已完成：公开仓库/HEAD/工作区核对；相关公开源码与全局发布 Skill 的审阅；真实生成器输出结构的源码核对；官方 CSP/Next 资料核对；Oracle 5/5 提交、完整结果回收、正常退出与临时浏览器清理；对 Oracle 建议的本地复核与本执行包定稿。
- 本地实施已完成：严格 marker/HTML profile、文章绑定不可变 PostgreSQL 存储、管理/view/preview API、写入/ready/公开门禁、前后台受控渲染、后台上传插入、Agent 可见文案投影、默认关闭开关与全局发布 Skill 的 plan/draft/resume/publish/update-published 接入。没有建立 Media HTML、`public/` 文件、跨文章资源库、新服务或第二套发布流程。
- 发布前验证：ESLint、非增量 CI TypeScript、production build；本地 101 文件/968 项通过，补入 tracked 实际生成器 fixture 后 CI Run 39720927514 为 969 项通过。28 条真库条件项由完整 PostgreSQL 15 专项入口的 10 文件/39 项补验。Skill 43 项与真实本地 CLI 发布/恢复链路通过；Chromium/Firefox/WebKit 三视口各 51 项、短视口与键盘 12 项、权限/错误/响应头 24 项、后台编辑与未保存资源预览 12 项通过。隔离备份恢复验证了内容字节、归属和触发器，临时库已清理。
- 本地收尾修正：普通文章新建不受无关资源门禁影响；作者可预览已绑定但未保存到正文的新资源；CLI 不能以 Cookie 后备伪装 Authorization；公开副本检查覆盖隐藏源文引号变体、CSS 变量与 SVG 资源；加载超时/旧请求竞态/焦点已补验；恢复脚本按 Payload GET 的扁平文档读取，并拒绝第三版本正文。
- 生产发布：PR #68 / `ea1e527` 经 Run 39721714408 关闭开关部署迁移，同镜像私有候选通过后，Run 39726180969 启用。生产 512 KiB/+1 字节边界、最终响应头、三浏览器桌面/手机交互和 Skill 内容更新保留元数据均通过；获准临时文章 ID 33 已回私有草稿，匿名文章/HTML 404。未改既有文章，临时容器与转发已关闭。详见 TESTING_GUIDE；实体设备、完整屏幕阅读器与生产库恢复演练仍未运行。
- 本地证据：最初实施记录位于 `.local/interactive-html-impl/`；收尾的测试/发布 Skill/备份恢复日志在 `.local/interactive-html-release/`，截图在 `output/playwright/interactive-html-release-20261022/`。这些目录不作为产品源码提交。
- 源码依据：仓库内文件以第 3、3.8、3.10、3.11 节对应模块为准；全局 Skill 真源仍是 `/Users/jinkun.wang/.codex/skills/publish-site-article/`，Claude 路径保持 symlink。不存在从本包自动发布、修改安全组、购买服务或运行生产迁移的授权。

## 6. 可直接转交 Coding Agent 的启动 Prompt

复制下面内容，是给后续 Agent 的**本地实施指令**，不是本审计轮已经实施的记录：

```text
请在 /Users/jinkun.wang/work_space/first_myself_site 实施文章内交互 HTML 功能。
先完整阅读：
/Users/jinkun.wang/work_space/first_myself_site/docs/plans/2026-10-21-interactive-html-execution-package.md

以这份复核后的执行包为实施合同，Oracle 原始回答只作审计证据；尤其遵守第 3.7 节的私有草稿待上传例外，不能同时实现两套 bootstrap 流程。

先读项目指令和现有状态，重查 HEAD/分支/用户改动；在合适的 codex/ 工作分支实施，保留已有交接文档。先通过真实生成器 + 自定义滑块的本地兼容性门，再分步实现，不只交建议或独立 Demo。

核心路线是：文章绑定不可变 HTML、精确 view/preview HTTP CSP sandbox、点击启动和同一 iframe 原位放大、公开/ready 引用门禁与原子 SQL 校验；扩展唯一一份全局 publish-site-article Skill，保持 Codex/Claude 的 symlink，不复制第二套。

不要全站开放 raw HTML，不放宽 iframe 权限，不增加新域名/平台，不把 HTML/JS 放入 RAG，不替换技术栈，不修改正文/slug/发布日期/合集，不降低现有发布确认门。新功能默认关闭。

按包内验收矩阵实际运行本地测试、真实隔离 PostgreSQL 和 Chromium/Firefox/WebKit 验收，保存结果；未运行/失败明确列出。遇到只能扩大权限或引入新基础设施才能继续的情况，说明证据并停下该部分，不自行绕过。

这次只授权本地代码、必要依赖、全局发布 Skill 修改及隔离环境验证。不要提交、推送、生产上传、修改阿里云/Nginx、执行生产迁移或部署，完成后交付变更和证据，等待下一步授权。只关闭你自己启动的服务，不用破坏性命令清理他人的工作。
```
