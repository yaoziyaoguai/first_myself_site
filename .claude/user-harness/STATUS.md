# STATUS.md

> **User-Defined Harness File**
> 当前仍然有效的项目状态快照，不记录临时调试过程。

## 项目基础

- **名称**：个人博客与作品展示站点
- **仓库**：`yaoziyaoguai/first_myself_site`
- **线上地址**：<https://wangjinkun333.me>
- **生产环境**：阿里云 ECS

## 技术栈

- Next.js 16.3（App Router）与 React 19.2
- Payload CMS 3.87
- PostgreSQL 15
- Tailwind CSS 4 与 shadcn/ui
- Docker Compose、Nginx、GitHub Actions

## 当前阶段

**本轮交付**（2026-10-27）：文章归档默认展示全部文章，标题下方用醒目双选项切换文章 / 合集；合集改为紧凑目录，保留现有详情、URL、内容、权限与主题筛选。PR #70 已全绿合入 `main`（`90ef993be38f196fff1b534c0c74cd5b968e3c43`），Run 40488113284 成功部署阿里云，Deploy Job 6 分钟。容器 revision 一致且 healthy，公网健康接口 ready，部署 Agent canary 含文章包 / 代码引用。CI 常规 972 项通过、28 条真库条件另跑，PostgreSQL 专项 39 项通过。正式站 Chromium 1440 / 768 / 390px 完成切换、筛选保留、文章 / 合集点击返回、刷新、旧锚点和无溢出 / 零错误验收，截图与报告在 `output/playwright/series-tabs-20261027/production/`。没有新增依赖、后台功能、部署配置或生产内容写入。

**当前交付**（2026-10-22）：文章内交互 HTML 已通过 PR #68 合入 `main`（`ea1e527c7a9f1dbdb446804c7101063e9692ab55`），并经两次 GitHub Actions 完成阿里云上线。Run 39721714408 首次部署/迁移且保持关闭；同镜像回环候选验证通过后，Run 39726180969 应用 `BLOG_INTERACTIVE_HTML_ENABLED=true`。最终容器 healthy、revision 一致，HTML 与原有 Agent 开关均 true；部署 canary 返回代码与文章包引用。没有直接在服务器修改应用源码或中断部署。

能力包含严格 marker/HTML profile、文章绑定不可变 PostgreSQL 存储、管理/view/preview API、CMS 与 Agent 索引事务门禁、前后台点击启动/保留状态/停止、后台上传插入、Agent 可见文案投影，以及全局发布 Skill 的 plan/draft/resume/publish/update-published。HTML 不放入 Media、`public/` 或 RAG，也不授予 same-origin、表单、弹窗或顶层导航权限。生成器公开副本仍须审查隐藏数据，不是任意网页托管。

发布证据：CI 常规 969 项通过（28 条真库条件项另跑），PostgreSQL 15 专项 10 文件/39 项通过；ESLint、非增量类型检查和生产构建通过。隔离备份恢复保留字节、归属和不可变触发器，3 个本轮临时库已清理。Skill 43 项通过，Codex/Claude 共用 symlink 保持，真实生产 draft/resume/publish/update-published/回读通过，日期/合集等元数据不变。生产 Chromium/Firefox/WebKit × 1440/390px 交互、状态保留、隔离、无溢出和零控制台错误通过；新版本现有首页/筛选/代码文章/目录/返回列表回归通过。其他本地视口、后台与失败路径证据见 TESTING_GUIDE。临时文章 ID 33 已恢复 draft/private，匿名文章与 HTML 都 404，公开列表仍为 28 篇；临时验证容器、转发和本地服务均已关闭。

**前一次应用交付**（2026-10-09）：用户进一步授权合并、部署文章 Agent 最小交互改进，替代此前只提交 / 推送的边界。PR #66 已合入 `main`（`2ad23a9148513b93ef775cb515287ac12e0af6f9`），GitHub Actions Run 37911247296 成功部署阿里云；生产容器 revision 一致且 `healthy`，公网健康接口为 `ready`。桌面 / 手机交互与两轮真实问答已完成当时的生产验收。仅修改会话跟随、输入框和响应式焦点 / 滚动管理，不改变内容、API、检索、缓存、依赖或部署方式。

**最近生产基线**（2026-10-03 已验证）：8 篇旧文已完成改写，包含综述中 2 个内部飞书链接和内部数据表述的清理；原子正文 / 索引更新通过 PR #63 上线。UI/UX 改版通过 PR #64 上线，应用 revision `8da380e93f342fad577e32886659260cf9c95396`、Actions Run 37076629022。目录、筛选、合集往返、Agent 缩放、代码引用和历史保留已完成当时的生产验收，不作为本轮新改动已上线的证明。

**阶段**：核心内容、文章合集、互动、运营统计、单文章 Blog Agent、访客内容缓存和 GitHub → 阿里云部署链路均已上线，性能与部署链路优化已完成生产收口。

**定位**：以低调的方式记录数据工程、AI 评测和 Agent 系统的学习、实验与转型过程。

## 当前整体状态

| 模块 | 状态 |
| --- | --- |
| 首页、关于、联系和站点信息 | 已由 Payload 配置，仓库默认值只作空值兜底 |
| 最近在学习 | 后台“首页与最近学习”可维护 |
| 项目与实验 | 后台可维护标题、描述、标签、亮点、排序和外部链接 |
| Blog | Markdown、GFM、图片、可见性和文章合集已上线；归档默认文章，醒目双选项切换紧凑合集目录，保留主题筛选；2026-10-27 匿名列表为 32 篇 / 3 合集 |
| Markdown 编辑器 | 双栏预览和基于内容锚点的双向滚动同步已上线验证 |
| 评论与点赞 | 受控公开接口、匿名 HMAC 身份和权限隔离已上线 |
| 访问统计 | 后台可查看访问、估算访客、有效停留、阅读深度和热门页面 |
| 内容发布 Skill | Codex/Claude 共用全局 `publish-site-article`，支持 Markdown、图片与经审查的交互 HTML；默认私有草稿，公开仍需明确确认；普通内容更新也保留原发布元数据 |
| 文章交互 HTML | PR #68 已部署并启用，真实生产三浏览器桌面/手机与撤回验收通过；单个 512 KiB、每篇最多 4 个块 |
| Blog Agent UI | PR #66 已上线：阅读中不强拉新回答、2–6 行输入框与快捷发送、移动端模态焦点 / 背景滚动管理；保留按文章保存会话历史和调整面板大小 |
| Blog 内 RAG | 当前文章 Markdown 为基线；可选文章包补充同一 Blog 的代码、文档、数据和图片说明 |
| Agent 安全 | 不跨 Blog；服务端 Key、持久化配额、并发限制、无证据拒答和紧急双开关已实现 |
| 访客内容缓存 | 仅缓存公开且已发布内容，登录态始终直查；公开内容撤回或删除时失效失败会阻止写入 |
| 性能测量 | `perf/` 已提供 fail-closed 的真实导航基准与棘轮；生产 fast4g 绝对基线已留档 |
| SEO / 发现 | sitemap、RSS、canonical metadata 和 ICP 备案页脚已上线 |
| 测试 | 2026-10-27 CI 常规 972 项通过、28 条真库条件另跑，PostgreSQL 专项 39 项通过；归档 Chromium 三视口生产验收通过。交互 HTML / Skill 的历史独立验证仍见 TESTING_GUIDE，不把它们当作本轮全量重测 |
| 部署 | PR → CI → main → 阿里云串行部署；GitHub 仅传约 1.35 MB 的校验 Git bundle，阿里云使用 BuildKit、国内镜像源和缓存构建带 revision 标签的候选镜像；保留备份、迁移、Agent canary、健康检查及应用镜像回滚，纯文档变更可跳过重建；数据库恢复仍需人工处理 |

## 当前 Blockers

本轮归档功能没有未解决的上线阻塞，正式站三视口点击验收通过，本地临时预览已关闭。生产证据见 `output/playwright/series-tabs-20261027/production/report.json`；本轮没有发布 / 修改生产文章。实体设备与完整屏幕阅读器未运行。后续只以纯文档 PR 收尾，不再改应用或依赖。

2026-10-22 的交互 HTML 临时文章 `interactive-html-release-check-20261022`（ID 33）在当轮验收后恢复私有草稿；当轮报告 / 截图仍在 `.local/interactive-html-release/` 和 `output/playwright/interactive-html-production-20261022/`，本轮没有重复运行全部 HTML / Skill 验收。

2026-10-22 已验证生产 Nginx 的 512 KiB 接受、超出 1 字节的 413、最终 CSP/缓存/索引/嵌入响应头、匿名当前引用门禁与撤回。当轮隔离数据库备份恢复不等于生产库恢复演练。根目录遗留未跟踪自动生成 `payload-types.ts` 与正式声明冲突，已完整移至 `.local/interactive-html-release/payload-types.generated.ts.txt` 保留，不要恢复到根目录。服务器 origin 跟踪引用陈旧，不得据 ahead 计数重置源码。

历史 Agent 验收（2026-10-09）：两轮非缓存回答含代码，阅读位置不被强拉，草稿/历史与 GitHub 返回保持，引用进入固定提交；详见 Session-011，不把它当作本轮重新执行的全量 Agent UI 测试。2026-10-22 两次部署各执行真实文章包/代码 canary，未改模型或检索策略；2026-10-27 部署 canary 同样通过。

仍需持续关注：

- 2026-10-22 交互 HTML 首次 Deploy Job 39 分 38 秒（需要重建依赖和应用），镜像 302,735,894 字节；同提交启用开关的 Deploy Job 为 3 分 35 秒，服务器构建各层 CACHED。2026-10-27 UI Deploy Job 6 分钟；保留原构建/备份/迁移/健康/回滚流程，不把单次耗时当作性能提升结论
- 真实回答正文把片段估为“约 90–95 行”，实际是 96–100 行；服务端固定引用 `L80-L119` 正确且覆盖该代码。自然语言细分行号仍可能不准确，本轮未修改模型 / 检索策略
- 跨版本切换期间，预先打开的浏览器曾有 1 次 analytics 请求返回 502；切换后的新浏览器验收为零错误，不把现有单容器切换描述为零停机
- 本地移动端 Lighthouse：主页 98/100/100/100，代表文章 92/100/100/100（性能/可访问性/最佳实践/SEO）；文章模拟慢网 LCP 3.2 秒，不能把单次本地测量当作生产性能或全部 WCAG 人工验收
- 证书续期和 Nginx 配置在服务器层，不由本仓库管理
- 备份尚未自动复制到 ECS 之外，也没有定期恢复演练
- 尚未接入独立的外部 uptime monitoring
- 进程内限流不适合未来的多实例部署
- 2026-10-22 收尾推送时 GitHub 提示默认分支有 78 个依赖告警（8 critical、22 high、40 moderate、8 low），替代本轮早先的 94 条快照。本次新增依赖审查通过，但没有逐项验证或升级存量告警，不把数量变化归因于本次修复；需按可利用性和回归风险分批治理
- 对话中使用过的模型 API Key 应在上线稳定后轮换
- 2026-10-27 只读进程诊断意外输出了部署 shell 参数中的现有模型 Key；未写入代码、文档或 Git，也未擅自轮换。生产诊断不得输出原始进程 args / 环境，只列 `comm` 或显式白名单健康字段；应由用户安排轮换受影响的 Key

## 下一步建议

0. 后续用既有发布 Skill 上传经审查的互动内容，默认私有草稿；内容发布不需要再次构建网站
1. 对当前 Dependabot 告警做分层复核和小批量升级，避免无验证的依赖大扫除
2. 配置异地备份、恢复演练和低维护成本的 uptime / TLS 监控
3. 持续通过全局发布 Skill 发布文章，并为需要代码问答的文章维护同 Blog 材料包
4. 在 Google Search Console 与百度搜索资源平台持续观察抓取和收录状态
5. 轮换曾在对话中使用过的模型 API Key

## 重要决策与约束

- 个人定位强调“学习和转型”，不做夸大的专家包装
- 生产代码不在服务器直接修改，始终走 GitHub PR 和部署工作流
- 生产部署只传校验后的 Git bundle，不再跨境传完整 Docker 镜像；镜像在阿里云本地构建并用 commit revision 校验，纯文档变更依据线上 revision 的完整差异决定是否跳过
- 内容上传默认草稿且私有，公开发布需要单独明确确认
- CMS 已编辑内容优先，迁移和兜底不能覆盖用户数据
- 访问统计无 Cookie，并尊重 DNT/GPC
- Nginx 必须覆盖代理身份头，应用端口不能直接暴露公网
- Agent 的问题、检索、引用和数据上下文必须限制在当前 Blog，不能跨文章
- Markdown 永远是基础上下文；可选文章包仅离线发布，不实时连接本地 Codex
- 已发布文字可与 ready Agent package 原子更新；保留已审核的 GitHub 固定提交和 source hash，标题/摘要/正文参与新版本 hash，失败保留旧正文和旧索引
- Agent 的模型 Key 只在服务端，功能开关默认关闭，无足够证据时拒答
- 文章交互 HTML 只存在文章绑定不可变私有表和精确 view/preview 响应；开关默认关闭，读取每次重查当前文章权限和引用，不进入 RAG，不授予 same-origin/网络/表单/弹窗/顶层跳转
- 访客缓存只允许公开、已发布内容进入；登录态绕过缓存，Payload 查询继续使用 `overrideAccess: false`
- 文章跳转反馈使用 `useLinkStatus`，保留 `prefetch={false}` 和真实 404；不为加载反馈引入会把 404 流式化为 200 的 loading 路由（Session-007 roll-up）
- 已确认同机其他项目构建会拖慢 ECS 部署；后续应先核实资源竞争/错峰，不把慢部署都归因于约 298 MB 镜像（Session-007 roll-up）
- 从公开状态撤回或删除内容时，缓存失效必须 fail closed；普通内容更新允许告警并由短 TTL 兜底
- 项目记忆继续只使用 `STATUS.md` 与 `RECENT_SESSIONS.md`；后者固定保留最近 5 条并将仍有效事实滚入前者
- 2026-09-30 性能收口的 fast4g 生产绝对基线：主页 / 列表 / 长文 TTFB p75 为 528.2 / 683.5 / 1338.1ms；不同测量协议和时段不能据此宣称严格前后提升。旧仓库清理的恢复归档在工作区外 `repo-archives/first_myself_site-cleanup-20260930T143408+0800`，未在本轮删除。

## 常用命令

```bash
npm run dev
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm run build
npm run payload -- run payload.config.ts
```

**最后更新**：2026-10-27
**更新说明**：PR #70 已通过 GitHub Actions 上线并完成正式站归档点击验收；仅补充发布记录，不继续扩大 UI / 部署改动。Session-010 的原子发布、设计与生产基线有效事实已保留。
