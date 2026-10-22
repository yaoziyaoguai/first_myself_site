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

**遗留**：实体设备、完整屏幕阅读器和生产数据库恢复演练未运行；全局 Skill 不会随网站 Actions 自动分发到其他机器。推送时 GitHub 的 94 条存量依赖告警未在本轮升级，不能把新增依赖审查通过说成全站漏洞已清零。

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

### 2026-10-09 Session-011

**目标**：落实 compose-ui-kit 只读审查中批准的文章 Agent 最小改进，完成验证后提交、推送；用户随后明确授权合并，并通过 GitHub Actions 部署阿里云。

**完成**：
- 会话在读者向上浏览时保留位置，提供“查看最新回答”；回答完成不抢焦点，保留 per-article session 历史、GitHub 引用和桌面缩放
- 输入框 2–6 行自适应、500 字提示、Ctrl / Cmd + Enter 发送并保护输入法组合；请求中只读而不失焦
- 使用现有 Base UI Dialog：手机锁背景 / 约束焦点 / 打开不主动唤起键盘，桌面保持非模态；引用关闭后定位并聚焦正文标题
- 44 项 Agent 测试、全量 835 项测试通过（17 项真库条件测试跳过）；ESLint、非增量 CI TypeScript、生产构建通过；graphify 已执行 AST-only 更新
- Chromium 验证 1440 / 768 / 390px 和 390×470 短视口：长回答、滚动保持、输入伸缩、Tab / Escape、引用定位、断点切换、草稿 / 历史保留及 reduced-motion；截图与脚本保存在 `output/playwright/agent-ux-20261009/`
- 本地启动自动生成的 `payload-types.ts` 引起类型合并干扰，连同陈旧的增量缓存保存到验收目录的 `.txt` 后，常规 / 非增量检查与生产构建重新通过；没有为此改动业务类型
- 隔离预览库原有 10 条正式迁移均已应用，只移除本轮 dev 启动新增的 `id=12, name=dev, batch=-1` 标记以便生产模式预览；未确认有损迁移、删除业务内容或连接生产库
- 用户追加合并 / 部署授权后，PR #66 全绿并合入 `main`（`2ad23a9`）；Actions Run 37911247296 成功部署阿里云，部署步骤 25 分 44 秒，生产 revision 一致且健康，全程未中断部署
- 合并后 CI 常规 835 项测试通过、17 项条件跳过，独立真实 PostgreSQL 检查 25 项通过；部署 canary 返回 `contextMode=article-package`、`codeExcerpt=true`
- 生产 Chromium 覆盖 1440 / 768 / 390px 和 390×470：输入高度约 59→155px、键盘及鼠标缩放 488→500→560px、Tab / Shift+Tab 焦点循环、背景锁定、Escape 返回焦点和断点草稿保留全部通过
- 两轮公网真实问答均 200、`cached=false`，有代码块和固定提交源码引用；阅读位置保持 60→60px，不抢键盘焦点，“查看最新回答”可回底部，关闭重开 / 刷新 / GitHub 返回均保留历史
- 实际点击源码进入 `runner.py#L80-L119`；手机点击文章依据后，H2 距顶部约 100px 且背景可重新滚动。截图与可复跑脚本同在本轮验收目录

**改动**：`BlogAgent.tsx`、全局 Agent 样式、组件测试、`DESIGN.md` 与现有状态记录；没有安装依赖、修改 lockfile、模型 / RAG / API / 缓存或部署流程。shadcn 的 Base UI Dialog 与 beUI Message Scroller 只用于交互参考，未复制第三方组件源码。

**遗留**：未执行实体手机键盘、Safari / Firefox 和完整屏幕阅读器验收。模型正文估计“约 90–95 行”与真实片段 96–100 行有偏差，但固定引用范围 L80-L119 正确；本轮不扩展到模型策略修改。GitHub 导航接口出现 404，源码页面正常；本站验收无控制台错误。初次焦点断言误捕获 Base UI 隐藏 focus guard，核对逐帧轨迹后改为浏览器完成焦点移交后检查，正反 Tab 均通过；源码链接实际使用同标签跳转，不是新窗口。

**后续授权与执行**：合并、阿里云部署和真实浏览器验收均完成；后续只提交本条状态 / 验收记录，不修改应用或重建本地服务。

**下一步**：本轮交付收口；模型自然语言行号精度与其他独立改进另行确认。

**对当前状态的影响**：文章 Agent 交互改进已在生产验证，公开文章 / URL / 模型 / 缓存 / 依赖保持不变；Session-006 的有效性能基线、部署约束与恢复归档已归并到 STATUS。

### 2026-10-03 Session-010

**目标**：收尾旧文改写与代码问答，再提升个人博客的内容发现、阅读和移动端体验。

**完成**：
- PR #63 实现正文与 ready Agent package 原子切换，保留原公开 GitHub 固定提交，具备来源 hash、文章 hash、行锁、并发冲突及失败回滚校验；全局 Codex/Claude 共用发布 Skill 同步支持
- `main` 的 `806dd0802b2c5c6924d149c71d9ee2f6d8332a1a` 经 Actions Run 37039438407 完整部署成功，全程未中断部署或直接修改服务器源代码
- 用发布 Skill 更新 ID 15《给 Agent 加本地命令执行：审批、超时与失败恢复》，82 块索引 ready；认证与公开 API 回读一致，原发布日期和其他非目标元数据不变，至此旧文 8/8 完成
- 生产浏览器询问超时清理代码，获得真实代码片段及固定提交引用，点击成功进入 `agent/process/runner.py#L217-L254`
- 本地 UI 重排首页最新文章和合集入口，新增基于现有标签的文章筛选；长文使用 46rem 阅读栏和响应式目录，统一导航/页脚，修复桌面 Agent 与正文的重叠
- 真实 Chromium 覆盖 1440/768/390px：首页、文章、合集、项目、关于、联系；验证筛选、手机菜单、目录锚点、合集前后篇、宽表格键盘滚动、Agent 展开/缩放，长文 12 张图片均可加载
- 本地 844 项应用测试通过，2 项条件跳过；发布 Skill 22 项通过。Lighthouse 手机首页 98/100/100/100，代表文章 92/100/100/100；文章 LCP 3.2 秒如实保留，不宣称生产性能达标
- 用户确认后，UI 经 PR #64 全部门禁合入 `main`；commit `8da380e93f342fad577e32886659260cf9c95396` 由 Actions Run 37076629022 成功部署阿里云，容器 revision 一致且健康，全程未中断部署
- 生产真实浏览器验证首页/代码文章 1440、768、390px 和项目/关于/联系手机页，9 个组合全部 200、无横向溢出、页面异常、控制台错误或失败响应；另实测 22→7 篇筛选、手机菜单、目录焦点、合集前后篇和宽表格键盘滚动
- 生产长文 12 张图片均成功解码，20 张表格不撑破页面；桌面 Agent 416px / 614px 均为正文留出空间，手机底部面板正常
- 线上代码问题返回 200、代码块与 2 个固定 GitHub 引用（本次命中缓存）；实际点击进入 `runner.py#L217-L254`，返回后对话保留；部署内 Agent canary 同样通过

**改动**：生产已上线原子文章发布能力、ID 15 内容和 UI 改版；新增 `ArticleIndex`、`ArticleReadingNav`、`SeriesFeature`，修改主站页面、全局样式、导航/页脚和相关测试。未更改包管理器、依赖、缓存与 prefetch 策略。发布结果写回现有状态记录和设计文档。

**遗留**：本轮功能无上线阻塞。Safari / Firefox 与实体手机未运行；本地 Lighthouse 不证明生产性能或获奖品质。Cue 实际访问得到空库和连接错误，没有可用具体组件；采用实际查看的 Awwwards Creative Boom 编辑版式参考，Webby 仅作质量维度。跨版本切换时旧浏览器有 1 次 analytics 502，切换后的独立验收零错误；不宣称单容器部署零停机。

**下一步**：本轮交付收尾；保留本地截图与隔离公开内容副本用于回溯，不删除用户数据。后续新需求另行确认，不继续扩展视觉或部署优化范围。

**对当前状态的影响**：旧文改写、Git 审计来源的 Agent 问答和 UI 改版均已完成生产收口；35 分 19 秒的部署任务成功，生产应用 revision 为 `8da380e`，截图见 `output/playwright/design-20261003/production-*.png`。

---

**总条数**：5/5
**最后更新**：2026-10-22
