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

**阶段**：核心内容、互动、运营统计、单文章 Blog Agent、访客内容缓存和 GitHub → 阿里云部署链路均已上线，性能与部署链路优化已完成生产收口。

**定位**：以低调的方式记录数据工程、AI 评测和 Agent 系统的学习、实验与转型过程。

## 当前整体状态

| 模块 | 状态 |
| --- | --- |
| 首页、关于、联系和站点信息 | 已由 Payload 配置，仓库默认值只作空值兜底 |
| 最近在学习 | 后台“首页与最近学习”可维护 |
| 项目与实验 | 后台可维护标题、描述、标签、亮点、排序和外部链接 |
| Blog | Markdown、GFM、图片、草稿/公开/私有可见性已上线 |
| Markdown 编辑器 | 双栏预览和基于内容锚点的双向滚动同步已上线验证 |
| 评论与点赞 | 受控公开接口、匿名 HMAC 身份和权限隔离已上线 |
| 访问统计 | 后台可查看访问、估算访客、有效停留、阅读深度和热门页面 |
| 内容发布 Skill | 全局 `publish-site-article` 可从任意 Codex 项目上传 Markdown 与图片 |
| Blog Agent UI | 桌面浮层与移动端 bottom sheet 已上线，支持按文章保存会话历史和调整面板大小 |
| Blog 内 RAG | 当前文章 Markdown 为基线；可选文章包补充同一 Blog 的代码、文档、数据和图片说明 |
| Agent 安全 | 不跨 Blog；服务端 Key、持久化配额、并发限制、无证据拒答和紧急双开关已实现 |
| 访客内容缓存 | 仅缓存公开且已发布内容，登录态始终直查；公开内容撤回或删除时失效失败会阻止写入 |
| 性能测量 | `perf/` 已提供 fail-closed 的真实导航基准与棘轮；生产 fast4g 绝对基线已留档 |
| SEO / 发现 | sitemap、RSS、canonical metadata 和 ICP 备案页脚已上线 |
| 测试 | PR #58 全量 Vitest 91 个文件、801 项测试通过（另有条件跳过），性能工具 Node 11/11、Python 9/9；PR #59 部署契约 22/22 通过，并通过 ESLint、TypeScript、Security Scan 与 production build |
| 部署 | PR → CI → main → 阿里云串行部署；GitHub 仅传约 1.35 MB 的校验 Git bundle，阿里云使用 BuildKit、国内镜像源和缓存构建带 revision 标签的候选镜像；保留备份、迁移、Agent canary、健康检查及应用镜像回滚，纯文档变更可跳过重建；数据库恢复仍需人工处理 |

## 当前 Blockers

无影响网站可用性的阻碍。

仍需持续关注：

- 证书续期和 Nginx 配置在服务器层，不由本仓库管理
- 备份尚未自动复制到 ECS 之外，也没有定期恢复演练
- 尚未接入独立的外部 uptime monitoring
- 进程内限流不适合未来的多实例部署
- 2026-09-30 GitHub Dependabot 快照仍有 32 个依赖告警（3 critical、5 high、19 moderate、5 low），需要按可利用性和升级回归风险分批治理
- 对话中使用过的模型 API Key 应在上线稳定后轮换

## 下一步建议

1. 对 32 个 Dependabot 告警做分层复核和小批量升级，避免无验证的依赖大扫除
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
- Agent 的模型 Key 只在服务端，功能开关默认关闭，无足够证据时拒答
- 访客缓存只允许公开、已发布内容进入；登录态绕过缓存，Payload 查询继续使用 `overrideAccess: false`
- 从公开状态撤回或删除内容时，缓存失效必须 fail closed；普通内容更新允许告警并由短 TTL 兜底
- 项目记忆继续只使用 `STATUS.md` 与 `RECENT_SESSIONS.md`；后者固定保留最近 5 条并将仍有效事实滚入前者

## 常用命令

```bash
npm run dev
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm run build
npm run payload -- run payload.config.ts
```

**最后更新**：2026-10-01
**更新说明**：同步 PR #58/#59 的部署瘦身、超时修复和阿里云生产验证；移除约 581 MB / 90 分钟上传瓶颈，并更新依赖告警快照。
