# STATUS.md

> **User-Defined Harness File**
> 不是 Claude Code 默认系统文件，而是用户自定义的仓库级记忆机制。
> **职责**：存储**当前仍然有效**的项目状态快照，不是历史流水账。

---

## 项目基础

**名称**：个人技术博客与实践展示站点
**仓库**：first_myself_site
**线上地址**：https://wangjinkun333.me

---

## 技术栈

- **框架**：Next.js 16（App Router）
- **CMS**：Payload CMS 3.x
- **数据库**：PostgreSQL 15
- **样式**：Tailwind CSS 4 + shadcn/ui
- **部署**：GitHub Actions → Docker Compose → 阿里云 ECS
- **Blog Agent**：DeepSeek Flash 生成 + DashScope Qwen Embedding + Blog 内 RAG

---

## 当前阶段

**阶段**：Blog Agent V1 发布候选已完成，等待走 PR 与生产灰度链路

**一句话概括**：每篇公开 Blog 有独立悬浮 Agent；问题、检索、引用和可选文章数据包都严格限制在当前 Blog，不跨文章检索。

---

## 当前主线任务

1. 完成 `codex/blog-agent-v1` 的最终审计与 PR
2. 先以关闭开关部署到阿里云，执行迁移与健康检查
3. 通过全局发布 Skill 发布并索引实验文章
4. 开启 Agent 后执行生产 canary，失败则立即关闭开关并重新部署

---

## 当前整体状态

| 模块 | 状态 |
|------|------|
| Blog 文章管理 | ✅ Markdown + Lexical 双模式 |
| Project 展示 | ✅ 完成 |
| Payload Admin | ✅ 完成 |
| Markdown 编辑器 | ✅ 双栏预览与滚动同步 |
| 访问与停留统计 | ✅ 完成 |
| Blog Agent UI | ✅ 桌面浮层 + 移动端 bottom sheet |
| Blog 内 RAG | ✅ 混合检索、引用、无证据拒答 |
| 文章数据包 | ✅ 可选、create-only、Git 审计、Blog 生命周期绑定 |
| Agent 安全 | ✅ 双开关、限额、并发限制、输入边界、私有材料防逐字导出 |
| 发布 Skill | ✅ Markdown/图片/文章数据包离线发布，Keychain 凭据 |
| 生产发布 | ⏳ PR 与阿里云灰度验证待完成 |

---

## 当前 Blockers

无代码阻碍。

生产注意项：

- 首次部署必须保持 `BLOG_AGENT_ENABLED=false` 与 `BLOG_AGENT_GENERATION_ENABLED=false`
- Payload migration 必须在应用切换前从 candidate image 执行
- 生产 canary 失败时，通过 GitHub Repository Variables 关闭两个开关并手动重新部署
- 曾在对话中暴露过模型 API Key，上线稳定后应轮换 DeepSeek 与 DashScope Key

---

## 重要决策与约束

- **产品边界**：Agent 入口在 Blog 详情页，不能跨 Blog 检索或回答
- **内容基线**：每篇文章的 Markdown 永远是基础上下文
- **深层数据**：代码、文档、图片说明和数据证据只通过可选文章数据包补充
- **发布方式**：仅离线发布，不实时连接本地 Codex
- **安全默认**：功能开关默认关闭；模型 Key 只在服务端；无证据时拒答
- **发布链路**：独立分支 → GitHub PR/CI → 合并 → 阿里云部署 → canary
- **设计系统**：米白纸张感、黑色排版、蓝色交互强调；不做大改版
- **技术约束**：TypeScript 严格模式；项目使用 ESM；生产不得保留 `.env.local`

---

## 常用命令

```bash
npm run dev
npm run lint
npm test
npm run build
npm run payload -- run payload.config.ts  # 验证 Payload CLI 能加载生产配置
```

---

**最后更新**：2026-08-23
**更新说明**：记录 Blog Agent V1、文章级数据组织、安全边界、发布 Skill 与阿里云灰度计划
