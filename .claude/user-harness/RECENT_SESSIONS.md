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

### 2026-09-30 Session-006

**目标**：审计并收口性能冲刺，将有效改动安全合入 `main`，通过 GitHub Actions 部署阿里云，并清理长期积累的本地仓库状态。

**完成**：
- 审计前序性能实验，保留文章查询去重、访客内容缓存和 prefetch 治理，补齐权限边界、失效 fail-closed 与真 PostgreSQL 回滚测试
- 把性能工具升级为 fail-closed 测量：真实导航、CDP 请求账本、连续 1 秒安静窗口、完整 SHA 和批次完整性校验
- PR #56 全部门禁通过并合入；GitHub Actions 成功部署阿里云
- 生产验证覆盖健康检查、容器镜像、Agent 双开关与 canary、Nginx/TLS、重定向、robots、sitemap、canonical 和 JSON-LD
- 用真实浏览器检查桌面与 390px 手机首页、文章列表和长文章；导航、手机菜单、Agent 展开、桌面拖拽缩放均通过，测试页面无控制台错误或横向溢出
- 留下生产 fast4g 绝对基线：主页 TTFB p75 528.2ms、文章列表 683.5ms、长文章 1338.1ms；因历史样本协议和时段不同，不宣称严格前后对比
- 将旧 worktree、分支、stash 和未跟踪文件先做校验归档，再把根 checkout 收敛为干净、仅含 `main` 的状态
- PR #58 把部署素材从约 581 MB 的完整镜像改为约 1.35 MB 的校验 Git bundle，由阿里云使用 BuildKit、国内镜像源和缓存本地构建；生产镜像由 580,492,580 字节降到 298,202,750 字节
- 首次缓存预热超过原 30 分钟 SSH 上限但没有切换旧容器；PR #59 将远程命令上限改为 60 分钟、任务总上限改为 70 分钟并补回归断言
- main Run 36740251643 完整部署成功：bundle 上传 98 秒，部署 Job 31 分 29 秒，随后 revision、容器健康、Agent 双开关、公网首页/Blog/health/robots/sitemap 和桌面/390px 浏览器均验证通过

**改动**：文章读取与缓存、Payload 失效钩子、`perf/` 测量工具、Dockerfile、`.dockerignore`、GitHub Actions、部署相关测试与状态文档；恢复归档位于工作区外的 `repo-archives/first_myself_site-cleanup-20260930T143408+0800`。

**遗留**：Dependabot 快照有 32 个依赖告警；异地备份、恢复演练、外部 uptime/TLS 监控和模型 Key 轮换仍需后续处理。

**下一步**：分批治理依赖告警；随后补异地备份、恢复演练和外部监控。

**对当前状态的影响**：性能改动已从实验分支进入生产，部署不再跨境传完整镜像，生产镜像约减半；验证和回滚证据闭环，仓库回到可继续开发的干净 `main` 基线。

---

### 2026-08-23 Session-005

**目标**：为每篇 Blog 增加严格文章边界的 Agent 问答，并通过 GitHub 链路安全发布到阿里云。

**完成**：
- 实现 Blog 详情页悬浮 Agent，覆盖桌面浮层和移动端 bottom sheet
- 实现 Markdown 基础上下文、Blog 内 RAG、引用和无证据拒答
- 增加可选文章数据包，用于关联当前文章的代码、文档、图片说明与数据证据
- 增加限额、并发控制、双功能开关、服务端密钥和私有材料防逐字导出
- 更新全局发布 Skill，支持 Git 审计、create-only 文章数据包和锚点校验
- 增加 Payload/PostgreSQL migration、repository、canary 与生产部署测试
- 用 Claude/智谱和视觉理解复核交互，确认现有设计系统无需大改

**遗留**：创建并审计 GitHub PR；先以关闭开关完成阿里云迁移；再发布实验文章、开启 Agent 并执行生产 canary。

**下一步**：完成 PR、部署、实验文章发布和生产验证闭环。

**对当前状态的影响**：代码已经进入 Blog Agent V1 发布候选，线上功能仍保持关闭。

---

### 2026-08-10 Session-004

**目标**：恢复并完善个人网站，通过标准 GitHub 流程部署到阿里云生产环境。

**完成**：
- 恢复正式域名 HTTPS 访问并确认生产环境位于阿里云
- 更新网站定位、可配置项目/实验、最近学习模块、公开邮箱和 MindForge 链接
- 建立全局 `publish-site-article` Skill，并发布一篇带图片的长文
- 增加无 Cookie 访问统计、有效停留和阅读深度后台
- 把 Markdown 双栏同步改为内容锚点映射，并修复生产长文导致的 pane 挤压
- 通过 PR #6 和 PR #7 合并、CI、部署与生产浏览器验证
- 用 Graphify 复核仓库结构、文档和部署链路
- 串行化阿里云生产部署，避免相邻 main push 竞争同一服务器状态

**改动**：前后台内容模型、文章发布工具、访问统计、Markdown 编辑器、迁移、测试、CI 与仓库文档。

**遗留**：异地备份、外部 uptime/TLS 监控和定期恢复演练仍需配置。

**下一步**：持续发布学习文章；优先补齐异地备份和低维护监控。

**对当前状态的影响**：网站已从“核心功能待部署验证”进入“生产稳定运行并可持续发布内容”的阶段。

### 2026-04-12 Session-003

**目标**：修复 CI 失败，优化 Markdown 编辑器滚动同步体验

**完成**：
- 修复 CI ESLint 失败：删除调试临时文件 `payload.config.test.ts`
- 修复 importMap 路径问题：`@/payload` → `@/src/payload`
- 实现 MarkdownPreviewField 滚动同步（多轮迭代）
  - 采用"左侧绝对主导"方案
  - 右侧允许手动滚动，左侧滚动时立即接管
  - 80ms ease-out 轻量平滑过渡
- 全部改动已提交并推送

**改动**：
- 删除：`payload.config.test.ts`
- 修改：`app/(payload)/admin/importMap.js` - 修正组件导入路径
- 修改：`src/payload/fields/MarkdownPreviewField/index.tsx` - 重写滚动同步逻辑

**遗留**：
- 等待实际验证滚动同步体验
- 长文场景下的比例偏差问题仍存在（待评估是否需进一步优化）

**下一步**：
- 验证滚动同步的流畅度和接管体验
- 根据反馈决定是否采用"粗粒度锚点同步"（方案 B）

**对当前状态的影响**：
- CI 已恢复绿色
- Markdown 编辑器增加滚动同步能力
- 建立了"最小实现 → 验证 → 迭代"的工作模式

---

### 2026-04-12 Session-002

**目标**：实现管理员快捷入口能力，打通前后台编辑链路

**完成**：
- 前台 Navbar 增加"前往后台"入口（仅 Admin 可见）
- Blog 详情页增加"编辑本文"按钮（跳转到后台对应文章编辑页）
- Projects 列表页增加"管理项目"按钮（跳转到后台项目管理）
- 后台 Admin 侧边栏增加"前往前台"入口（返回网站首页）
- 全部功能已提交并推送至远程

**改动**：
- 新增：`lib/auth.ts` - 封装获取当前用户和 Admin 身份判断
- 新增：`components/AdminLink.tsx` - 前台 Admin 入口组件
- 修改：`app/(main)/layout.tsx` - 集成 AdminLink
- 修改：`app/(main)/blog/[slug]/page.tsx` - 添加编辑按钮
- 修改：`app/(main)/projects/page.tsx` - 添加管理按钮
- 新增：`src/payload/components/BackToSite.tsx` - 后台返回前台组件
- 修改：`payload.config.ts` - 注册后台组件
- 修改：`app/(payload)/admin/importMap.js` - 手动注册自定义组件

**遗留**：无（全部功能已完成）

**下一步**：
- 在远程环境验证所有快捷入口功能正常
- 如 importMap 组件加载失败，在远程环境重新生成

**对当前状态的影响**：
- Admin 用户前后台编辑体验大幅提升
- 建立了可复用的身份判断和快捷入口模式

---

**总条数**：5/5
**最后更新**：2026-10-01
