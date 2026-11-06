# RECENT_SESSIONS.md

> **User-Defined Harness File**  
> 不是 Claude Code 默认系统文件，而是用户自定义的仓库级记忆机制。  
> **职责**：存储**最近 5 条** session 记录，滑动窗口，不是永久归档。

---

## Roll-up 规则

**当本条数超过 5 条时**：
1. 取最旧的一条
2. 判断哪些信息仍影响当前项目现状
3. 将这些有效信息提炼到 `STATUS.md`
4. 删除这条最旧记录
5. 保持 5 条

**可进入 STATUS.md 的内容**：
- 当前主线任务变化
- 当前 blockers 变化
- 新的关键决策且仍然有效
- 新的关键成果且改变了项目状态

**不应进入 STATUS.md 的内容**：
- 纯过程性细节
- 一次性调试过程
- 已失效的临时问题
- 只对当次 session 有意义的细节

---

## Session 记录模板

```
### YYYY-MM-DD Session

**目标**：（本次要解决的问题）

**完成**：（实际完成的内容）

**改动**：（修改了哪些文件）

**遗留**：（未解决的问题）

**下一步**：（建议的后续行动）

**对当前状态的影响**：（是否改变了项目现状）
```

---

## 最近 Sessions（从新到旧）

### 2026-11-06 Session-016

**目标**：修复交付可靠性文章互动只换文案、关键内容被裁切、放大不增宽的问题；本轮修复后提交 / 推送，不复用历史合并部署或生产内容发布授权。

**完成**：
- 使用 dev_co 保持范围，由 compose-ui-kit 承接现有 UI；沿用纸色 / 品牌蓝与原生 HTML / SVG，不加 UI、动画或第三方依赖，不改安全 profile
- 两块互动分别实现按时点重算的三层交付证据、跨日链的有条件逐步执行与同轮真实闭环；可回退、重置、查看依据，明确合成数据，不输出生产操作指令
- 共享容器工具栏前置、原位宽屏展开、视口变化重算与收回清理；不搬动 / 重建 iframe，不增加 postMessage 或 same-origin 权限。手机关键结论和操作前置，修正平板展开变窄
- 常规 Vitest 103 文件 / 979 项通过、28 条真库条件跳过；针对性 23 项、ESLint、非增量 TypeScript、production build、AST-only graphify 更新通过
- 既有隔离 PostgreSQL 库仅新建本轮 local-only ID 35，真实资源 repository 上传两块合成内容；Chromium 1440 / 768 / 390px 完成场景、键盘滑块、播放暂停、初始化阻塞、依赖执行、宽屏 / resize / Escape、同 iframe / 状态保留与沙箱隔离验证，无横向溢出、零页面 / 控制台错误；截图已查看
- 全局发布 Skill 增加互动成品检查，43 项 Python 测试、结构检查与便携补丁检查通过；Claude 原有 symlink 保持。离线 plan 成功，公开 API 比对确认除两处 marker 与说明外文章未变，没有登录或写入生产 CMS

**改动**：`InteractiveHtmlEmbed.tsx`、局部 CSS、组件 / HTML 行为测试、文章更新包、现有设计 / 测试 / 状态文档。全局 Skill 在仓库外，Git 内携带可审查补丁，不会随 Actions 自动安装到其他电脑。截图 / 报告在 `output/playwright/interactive-quality-20261106/`，本机脚本 / 日志在 `.local/interactive-quality-20261106/`。

**遗留**：只证明最终本地候选；本轮 Firefox / WebKit、实体设备、完整屏幕阅读器、后台布局与生产效果未验证。验收曾有启动等待超时与过早读尺寸，不记为通过；核对资源引用与实际尺寸后完整重跑，不以此放宽生产门禁。应用推送不自动更新 CMS，线上两块旧互动仍在。

**下一步**：实现提交 `132b93b` 已推送独立分支，核对 PR 检查后收口，不合并或部署。GitHub 本次提示默认分支 108 个存量依赖告警，已更新 STATUS 快照，未擅自扩大依赖升级。后续获准上线时分别部署应用、复核线上正文，再用 Skill 更新同一篇文章。

**对当前状态的影响**：互动解释改进成为独立可审查候选，生产未变。Session-011 的有效已上线 Agent 行为 / 真实引用 / 模型行号限制在 STATUS 与 TESTING_GUIDE 保留，最近记录继续 5 条。

### 2026-10-27 Session-015

**目标**：解决文章合集挤占归档篇幅，切换入口需醒目；不扩展新功能，完成后按 GitHub 流程部署阿里云。

**完成**：复用现有 Base UI 实现「全部文章 / 文章合集」切换，默认文章；合集改为完整标题、两行摘要、篇数 / 进度的整行入口，不重复前三篇目录。查询参数保留视图，面板保留筛选，方向键可操作，旧锚点兼容。管理员创建 / 管理入口权限不变，文章、数据、URL、后台、依赖与部署配置未改。

本地常规 972 项测试通过、28 条真库条件跳过；ESLint、非增量 TypeScript、构建、性能工具自测与 graphify AST 更新通过。32 篇公开文章和 3 个合集的隔离副本完成 Chromium 1440 / 768 / 390px 操作、筛选保留、详情往返、刷新、旧锚点、零 RSC 切换请求、零异常 / 溢出，以及无 JavaScript 文章链接和 canonical 验证。浏览器发现并修复首次挂载旧锚点未同步路由的问题，修复后重新构建、检查和验收。

**改动**：`ArticleArchive`、`SeriesFeature`、归档页、局部 CSS、相关组件测试和既有文档。截图 / 报告在 `output/playwright/series-tabs-20261027/local/`，改前在 `output/playwright/series-audit-20261027/`。

**上线**：PR #70 的 CI Run 40487233585 全绿，squash 合入 `90ef993`；main Run 40488113284 常规 972 项 / PostgreSQL 专项 39 项通过，Deploy Job 6 分钟成功。正式容器 revision 一致且 healthy，公网 ready，部署 canary 返回 `contextMode=article-package`、`codeExcerpt=true`。正式站 Chromium 三视口重测切换 / 筛选保留 / 文章与合集点击返回 / 刷新 / 旧锚点、无 JS 32 条文章链接和 canonical，零页面 / 控制台异常、无整页横向溢出；截图与结果在 `output/playwright/series-tabs-20261027/production/`。本地预览服务已关闭，未中断部署或手改服务器源码。

**遗留**：实体设备和完整屏幕阅读器未运行。本机 PostgreSQL 启动失败源于残留 pid 指向非数据库进程，确认无 postgres 后将陈旧锁文件保留到 `.local/series-tabs-20261027/` 并启动原本地数据库，未改数据库配置。只读进程诊断意外带出现有模型 Key，未写入 Git / 文档或自行轮换；已告知用户并改为仅输出白名单字段，需用户安排轮换。

**下一步**：仅补齐现有发布记录，通过纯文档 PR 收尾；功能交付完成，不继续扩展。

**对当前状态的影响**：归档切换与紧凑合集目录已上线并验收；Session-010 的有效事实已保留到 STATUS 和既有设计 / 验收文档，最近记录仍为 5 条。

### 2026-10-22 Session-014

**目标**：接手交互 HTML 实现，核对并修复发布缺口，按用户明确授权走 GitHub 流程上线；同步完善 Codex/Claude 共用发布 Skill，使用获准临时文章验收后撤回。

**完成**：
- GitHub keyring 认证正常，无需再次登录。接手复现并修复普通新文误拦截、未保存资源预览、CLI 独立认证、规范字节/隐藏源文/CSS/SVG 检查、加载超时/竞态/焦点和草稿索引元数据复核
- Skill 修复 Payload GET 扁平文档读取、严格恢复正文与已有图片 URL 比对；普通公开内容更新只发四个编辑字段，核对原日期/标签/媒体/合集，不重写公开状态。43 项测试通过，Claude symlink 保持，未复制第二套 Skill
- 本地 ESLint、非增量 TypeScript、构建与 968 项常规测试通过；真实 PostgreSQL 入口 10 文件/39 项通过；隔离备份恢复验证字节、归属、不可变触发器，3 个本轮临时库清理。三浏览器三视口各 51 项、短视口/键盘 12 项、权限/错误 24 项、后台编辑/未保存预览 12 项及真实本地 CLI 链路通过
- PR #68 首次 CI 因测试读取 ignored fixture 失败；改成带 MIT 声明的 tracked 实际生成器产物，保留真实适配/校验，CI 常规 969 项、PostgreSQL 专项 39 项及其他门禁全绿，squash 合入 `ea1e527`
- Run 39721714408 完成首次生产迁移/部署且 HTML false；同镜像的回环临时容器通过 Skill draft/resume、私有桌面/手机、512 KiB/+1 边界，正式 HTTPS 代理和关闭开关门禁通过后，Run 39726180969 应用 HTML true。两次真实 Agent canary 通过，最终 revision 匹配且 healthy
- 正式域名 Chromium/Firefox/WebKit × 1440/390px 实测点击、键盘滑块、计数、保持 iframe/状态、宿主 DOM 隔离、停止、无溢出、零控制台错误；Skill publish/update-published 回读通过，日期等元数据保持
- 临时文章 `interactive-html-release-check-20261022`（ID 33）恢复 draft/private，新的匿名文章与 HTML 请求均 404；随后首页/菜单/28→7 篇筛选/原有代码文章/目录/返回列表回归通过，列表仍为 28 篇。未修改任何既有文章，仅上传获准的合成验证内容
- 首次 Deploy Job 39 分 38 秒，镜像 302,735,894 字节；同提交启用任务 3 分 35 秒，服务器构建各层 CACHED。未中断部署、未手改服务器应用代码；临时验证容器、SSH 转发及本轮本地服务都已关闭

**改动**：PR #68 包含交互 HTML 完整功能和接手修复；全局 Skill 在仓库外独立更新。后续收尾只同步 README、TESTING_GUIDE、原执行包与 STATUS/RECENT，不触碰应用或依赖。证据在 `.local/interactive-html-release/`、`output/playwright/interactive-html-{release,production}-20261022/`，不把原始轨迹或凭据提交。

**遗留**：实体设备、完整屏幕阅读器和生产数据库恢复演练未运行；全局 Skill 不会随网站 Actions 自动分发到其他机器。推送时 GitHub 仍提示存量依赖告警，最新数量见 STATUS 快照；本轮未逐项升级，不能把新增依赖审查通过说成全站漏洞已清零。

**下一步**：本轮功能交付收口，收尾文档按同一 PR/CI 流程合入并确认文档差异不重建生产镜像；后续文章可使用现有 Skill 上传 HTML，不需要再次构建网站。

**对当前状态的影响**：从“本地完成、认证交接”变为“正式生产启用且验收完成”。Session-009 的有效旧文改写/隐私清理事实已由 Session-010 与 STATUS 生产基线覆盖，本文件继续保留最近 5 条。

### 2026-10-22 Session-013

**目标**：按唯一执行包实施 Markdown 文章内嵌可交互 HTML，扩展现有全局发布 Skill，并在不触碰生产的前提下完成真实浏览器、PostgreSQL 和回归验收。

**完成**：
- 实现严格顶层 marker、HTML/CSS profile、文章绑定不可变 PostgreSQL 存储、管理/view/preview API、默认关闭开关，以及 CMS/Agent 索引/公开发布引用门禁
- 前后台共享点击启动、sandbox iframe、原位放大/收回、停止重置、错误/重试；后台可上传已审查公开副本并在光标处插入 canonical marker，失败不改正文
- Agent 只接收可见 caption/summary；HTML、JS、隐藏源文和内嵌数据不进 RAG；全局 `publish-site-article` 支持离线 plan、一次 private draft、严格 resume、资源回读、publish/update-published 门禁
- 修复后台编辑时 React 移动 iframe wrapper 导致文档重新导航的问题；在有互动块时为根级 Markdown block 加稳定 key 并移除无 key 根分隔 text node，真实浏览器确认 DOM、`contentWindow` 和内部状态均保持
- ESLint 零警告、CI TypeScript、production build；完整 Vitest 101 文件/948 项通过（真库条件项另跑），PostgreSQL 15 隔离真库 25 项、Skill 39 项通过
- Chromium/Firefox/WebKit 在 1440/768/390px 各 51 项，390×470/键盘/reduced-motion 12 项，权限/错误/响应头 24 项，后台编辑/上传 10 项全部通过

**改动**：仓库新增 `src/lib/interactive-html/`、三类 API 路由、受控组件、Payload 迁移/后台入口、共享 fixtures 与测试，并更新现有 renderer、Blog/Agent 门禁、配置、README/SECURITY/TESTING_GUIDE 和执行包；全局 Skill 只修改 `/Users/jinkun.wang/.codex/skills/publish-site-article/` 真源，Claude 路径仍为 symlink。未提交、推送、生产上传、迁移或部署。

**遗留**：生产 Nginx/新路径 512 KiB、生产迁移/响应头/权限/内容 canary、实体设备和完整屏幕阅读器未验收。隔离数据库备份恢复因权限门禁要求单独授权创建恢复库而未运行；没有创建 dump 或恢复库。用户随后授权提交、推送、合入 `main`、Actions 部署和生产网页验收，但 `gh auth status` 确认默认账号 token 无效；两次登录未完成，最后一次按用户交接要求停止，因此没有 commit、push、PR、merge 或生产操作。

**下一步**：先由用户完成 `gh auth login -h github.com` 并确认认证有效。下一位 Agent 从当前 `codex/interactive-html-implementation` 工作树提交全部实现，推送并创建 PR；CI 全绿后合入 `main`，跟踪 Actions 部署和迁移，按执行包先关开关验证生产代理/权限/canary，再启用并完成网页验收。最后同步本地 `main`、删除已合并 feature 分支并确认仓库干净。

**对当前状态的影响**：交互 HTML 从“执行包待实施”变为“本地实现与隔离验收完成、生产尚未改变”；远端发布授权已给出，但被 GitHub CLI 认证阻塞。最旧 Session-008 的仍有效事实（8 篇 Agent 记忆评测专题与生产发布结果）已在 STATUS 的 Blog/生产基线中保留，本文件继续维持 5 条。

### 2026-10-21 Session-012

**目标**：审计 Markdown 文章内嵌可交互 HTML 的实现方式，用 Oracle Web 最高档给出第二意见，并整理供另一个 Coding Agent 执行的详细包；本轮不实现和上线。

**完成**：
- 基于公开仓库 `ef3aa93b41b999e77356f0941c23422ca3d4e584` 核对渲染、后台滚动锚点、权限、CSP、缓存、原子正文/索引事务、全局发布 Skill 和 HTML 生成器输出结构
- 用户重新登录且确认保持窗口非最小化后，会话 `blog-html-audit-visible-20261021` 验证 `Power, item 5 of 5 (slider ARIA)`，正常完成并保存全文；精确临时 Chrome PID 已退出、临时 profile 已移除，持久登录源未动
- 采纳专用 HTML 响应 + HTTP sandbox、文章绑定不可变数据、点击启动、原位放大；补足存储限额、真实权限与数据事务验收，明确嵌套 HTML/API/密钥不属 v1
- 复核后将 Oracle 两次覆盖的占位稿方案收敛为一次最终正文创建 + 私有待上传例外，公开/ready 必须验证所有资源；明确定义严格同计划恢复，不假设原发布脚本已经有恢复日志

**改动**：新增 `docs/plans/2026-10-21-interactive-html-execution-package.md`，更新现有 STATUS/RECENT 记录；原始回答/提示词仅留 `.local/interactive-html-audit-20261021/`。本地文档分支 `codex/interactive-html-audit`，未提交/推送。业务代码、全局 Skill、依赖和生产均未改动。

**遗留**：未实施新功能，因此构建、单测、真库事务、实际生成器 HTML 浏览器验收均未运行；生产 Nginx 响应头/新路径 512 KiB 能力仍需单独授权后的检查。不能用历史 835 项测试代表新功能通过。

**下一步**：用户可把执行包第 6 节 Prompt 交给 Coding Agent，授权本地实施后按 P0–P6 逐步执行；生产发布另行授权。

**对当前状态的影响**：仅明确待建功能的边界与执行合同，不改变网站现状。Session-007 有效加载反馈和部署竞争约束已并入 STATUS，最近记录仍保留 5 条。

---

**总条数**：5/5
**最后更新**：2026-11-06
