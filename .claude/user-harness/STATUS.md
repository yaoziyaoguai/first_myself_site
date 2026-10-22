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

**当前交付**（2026-10-22）：文章内交互 HTML 已按 `docs/plans/2026-10-21-interactive-html-execution-package.md` 完成本地实现和隔离验证，尚未提交、推送、执行生产迁移或部署。实现包含严格 marker/HTML profile、文章绑定不可变 PostgreSQL 存储、管理/view/preview API、CMS 与 Agent 索引事务门禁、前后台受控渲染、后台上传插入、Agent 可见文案投影、默认关闭开关，以及全局 `publish-site-article` 的 plan/draft/resume/publish/update-published 接入。没有全站 raw HTML、Media HTML、`public/` 文件、跨文章资源库、新服务或额外 iframe 权限。

交接时本地证据：ESLint 零警告、CI TypeScript、production build；完整 Vitest 101 个文件/948 项通过（9 个文件/28 项按真库条件跳过并另行补跑）；PostgreSQL 15 隔离真库 2 个文件/25 项通过；发布 Skill 39 项通过；Chromium/Firefox/WebKit 在 1440/768/390px 各 51 项、390×470 与键盘/reduced-motion 12 项、权限/错误/响应头 24 项、后台编辑/上传 10 项通过。这些是前一位 Agent 的版本证据。

接手后已补修普通文章新建误拦截、作者未保存资源预览、CLI 独立认证、上传规范字节/隐藏源文/CSS 与 SVG 资源检查、加载超时/竞态/焦点及草稿索引完整元数据复核，并接通 GitHub 互动开关的候选关闭/目标恢复/失败关闭。发布候选已通过 ESLint、非增量类型检查、生产构建、全量 968 项（28 条条件项另跑）及完整真库入口 10 文件/39 项。隔离备份恢复保留字节、归属和不可变触发器，3 个临时库已清理。Skill 42 项与真实本地 CLI 发布/恢复/撤回通过；Codex/Claude 共用 symlink 保持。三浏览器三视口各 51 项、后台新上传未保存预览 12 项、短视口键盘 12 项、权限/错误 24 项通过。证据在 `.local/interactive-html-release/` 与 `output/playwright/interactive-html-release-20261022/`，下一步进入 PR/CI/发布。

**最近应用交付**（2026-10-09）：用户进一步授权合并、部署文章 Agent 最小交互改进，替代此前只提交 / 推送的边界。PR #66 已合入 `main`（`2ad23a9148513b93ef775cb515287ac12e0af6f9`），GitHub Actions Run 37911247296 成功部署阿里云；生产容器 revision 一致且 `healthy`，公网健康接口为 `ready`。桌面 / 手机交互与两轮真实问答已完成当时的生产验收。仅修改会话跟随、输入框和响应式焦点 / 滚动管理，不改变内容、API、检索、缓存、依赖或部署方式。

**最近生产基线**（2026-10-03 已验证）：8 篇旧文已完成改写，原子正文 / 索引更新通过 PR #63 上线；UI/UX 改版通过 PR #64 上线，应用 revision `8da380e93f342fad577e32886659260cf9c95396`、Actions Run 37076629022。目录、筛选、合集往返、Agent 缩放、代码引用和历史保留已完成当时的生产验收，不作为本轮新改动已上线的证明。

**阶段**：核心内容、文章合集、互动、运营统计、单文章 Blog Agent、访客内容缓存和 GitHub → 阿里云部署链路均已上线，性能与部署链路优化已完成生产收口。

**定位**：以低调的方式记录数据工程、AI 评测和 Agent 系统的学习、实验与转型过程。

## 当前整体状态

| 模块 | 状态 |
| --- | --- |
| 首页、关于、联系和站点信息 | 已由 Payload 配置，仓库默认值只作空值兜底 |
| 最近在学习 | 后台“首页与最近学习”可维护 |
| 项目与实验 | 后台可维护标题、描述、标签、亮点、排序和外部链接 |
| Blog | Markdown、GFM、图片、草稿/公开/私有可见性与文章合集已上线；Agent 记忆评测专题当前含 8 篇 |
| Markdown 编辑器 | 双栏预览和基于内容锚点的双向滚动同步已上线验证 |
| 评论与点赞 | 受控公开接口、匿名 HMAC 身份和权限隔离已上线 |
| 访问统计 | 后台可查看访问、估算访客、有效停留、阅读深度和热门页面 |
| 内容发布 Skill | 全局 `publish-site-article` 可从任意 Codex 项目上传 Markdown、图片和经审查的文章绑定交互 HTML；默认私有草稿，公开仍需明确确认 |
| 文章交互 HTML | 2026-10-22 本地实现与隔离验收完成；默认关闭，未提交/推送/生产迁移/部署，线上仍不可用 |
| Blog Agent UI | PR #66 已上线：阅读中不强拉新回答、2–6 行输入框与快捷发送、移动端模态焦点 / 背景滚动管理；保留按文章保存会话历史和调整面板大小 |
| Blog 内 RAG | 当前文章 Markdown 为基线；可选文章包补充同一 Blog 的代码、文档、数据和图片说明 |
| Agent 安全 | 不跨 Blog；服务端 Key、持久化配额、并发限制、无证据拒答和紧急双开关已实现 |
| 访客内容缓存 | 仅缓存公开且已发布内容，登录态始终直查；公开内容撤回或删除时失效失败会阻止写入 |
| 性能测量 | `perf/` 已提供 fail-closed 的真实导航基准与棘轮；生产 fast4g 绝对基线已留档 |
| SEO / 发现 | sitemap、RSS、canonical metadata 和 ICP 备案页脚已上线 |
| 测试 | 本轮本地和合并后 CI 常规测试 835 项通过、17 项条件跳过；CI 另一次真实 PostgreSQL 专项检查 25 项通过。ESLint、TypeScript、构建和部署 canary 通过。生产 Chromium 1440 / 768 / 390px 与 390×470 验证滚动、焦点、输入、引用、历史与缩放；两轮公网真实问答均 200、`cached=false` |
| 部署 | PR → CI → main → 阿里云串行部署；GitHub 仅传约 1.35 MB 的校验 Git bundle，阿里云使用 BuildKit、国内镜像源和缓存构建带 revision 标签的候选镜像；保留备份、迁移、Agent canary、健康检查及应用镜像回滚，纯文档变更可跳过重建；数据库恢复仍需人工处理 |

## 当前 Blockers

2026-10-22 本会话已验证 GitHub CLI/keyring 和远端读取正常，认证阻塞已解除，不需再登录。用户明确确认“按 GitHub 流程完成上线”，并允许临时公开 `interactive-html-release-check-20261022` 做无敏感信息验证、完成后改回私有草稿，不修改已有文章。分支 `codex/interactive-html-implementation` 已提交 `5e33527` 并推送，PR 为 https://github.com/yaoziyaoguai/first_myself_site/pull/68 。首轮 CI 的 ESLint/TypeScript/依赖审查通过，Tests 因一个测试误读 `.local` 样例而失败；已改用带上游 MIT 声明的版本控制内真实生成器 fixture，保持实际适配和校验断言，正在重新验证/推送。生产尚未变更，GitHub 互动开关为 false。生产仍为 revision `2ad23a9`、healthy，目录 `/root/work_space/first_myself_site`；服务器 origin 跟踪引用陈旧，不得把 ahead 计数当作冲突或重置源码。

上线时仍须验证生产 Nginx 与新路径 512 KiB 请求能力、最终响应头/权限及一份无敏感信息内容样例。本轮已完成隔离数据库备份恢复，不代表生产库恢复演练；实体设备和完整屏幕阅读器仍未验证。根目录遗留的未跟踪自动生成 `payload-types.ts` 与正式类型声明冲突，已完整移至 `.local/interactive-html-release/payload-types.generated.ts.txt` 保留；不要再恢复它干扰 CI 类型检查。

本轮生产验收：两轮非缓存真实回答包含代码，等待回答时阅读位置保持 60→60px、不抢焦点；关闭重开保留草稿 / 历史，刷新和访问 GitHub 返回后保留已完成历史。源码链接实际进入固定提交 `runner.py#L80-L119`；手机原文依据定位到 H2（顶部约 100px）并释放滚动锁。本站验收未观察到控制台错误；GitHub 自己的导航请求有 404，不影响源码页面加载。实体手机键盘、Safari / Firefox 和完整屏幕阅读器未运行。

仍需持续关注：

- 本轮部署 Job 耗时 25 分 44 秒；日志记录服务器编译约 13 分钟、类型检查 52 秒、镜像导出约 5.3 分钟。候选镜像约 298 MB，仍有较长的 ECS 构建耗时；未修改部署方式，未主动中断部署，不把单次耗时当作性能提升结论
- 真实回答正文把片段估为“约 90–95 行”，实际是 96–100 行；服务端固定引用 `L80-L119` 正确且覆盖该代码。自然语言细分行号仍可能不准确，本轮未修改模型 / 检索策略
- 跨版本切换期间，预先打开的浏览器曾有 1 次 analytics 请求返回 502；切换后的新浏览器验收为零错误，不把现有单容器切换描述为零停机
- 本地移动端 Lighthouse：主页 98/100/100/100，代表文章 92/100/100/100（性能/可访问性/最佳实践/SEO）；文章模拟慢网 LCP 3.2 秒，不能把单次本地测量当作生产性能或全部 WCAG 人工验收
- 证书续期和 Nginx 配置在服务器层，不由本仓库管理
- 备份尚未自动复制到 ECS 之外，也没有定期恢复演练
- 尚未接入独立的外部 uptime monitoring
- 进程内限流不适合未来的多实例部署
- 2026-10-09 推送时 GitHub 提示默认分支有 34 个依赖告警（4 critical、5 high、20 moderate、5 low）；本轮没有升级依赖或声称解决这些告警，需按可利用性和升级回归风险分批治理
- 对话中使用过的模型 API Key 应在上线稳定后轮换

## 下一步建议

0. 完成当前浏览器复验后提交/推送并创建 PR，CI 全绿后合入 main，通过 Actions 部署。GitHub 仓库变量 `BLOG_INTERACTIVE_HTML_ENABLED` 初次保持 false；验证生产候选后设 true 并 workflow_dispatch（保留 CI，不手工部署应用），完成线上验收与仓库收尾
1. 对 34 个 Dependabot 告警做分层复核和小批量升级，避免无验证的依赖大扫除
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

**最后更新**：2026-10-22
**更新说明**：交互 HTML 本地实现与隔离验收完成，证据位于 `.local/interactive-html-impl/`，执行合同与完成/未完成边界记录在 `docs/plans/2026-10-21-interactive-html-execution-package.md`。用户已授权后续提交/合并/部署，但 GitHub CLI token 失效，交接时尚无 commit/PR/生产变更；PR #66 的历史生产证据继续见 `DESIGN.md` 第 8 节。
