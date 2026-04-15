# STATUS.md

> **User-Defined Harness File**  
> 不是 Claude Code 默认系统文件，而是用户自定义的仓库级记忆机制。  
> **职责**：存储**当前仍然有效**的项目状态快照，不是历史流水账。

---

## 项目基础

**名称**：个人博客与作品展示站点  
**仓库**：first_myself_site  
**线上地址**：https://wangjinkun333.me

---

## 技术栈

- **框架**：Next.js 15（App Router）
- **CMS**：Payload CMS 3.x
- **数据库**：PostgreSQL
- **样式**：Tailwind CSS 4 + shadcn/ui
- **设计系统**：Ollama 极简风格（纯黑白灰）

---

## 当前阶段

**阶段**：管理员快捷入口功能已完成，Markdown 编辑器功能已验证

**一句话概括**：核心功能就绪，测试覆盖率 80%+，Admin 前后台编辑体验已打通

---

## 当前主线任务

等待决策：确定下一个要开发的功能

候选方向：
1. 验证生产部署流程
2. 生成 Sitemap 和 RSS
3. 评论系统调研

---

## 当前整体状态

| 模块 | 状态 |
|------|------|
| Blog 文章管理 | ✅ 完成（Markdown + Lexical 双模式） |
| Project 展示 | ✅ 完成 |
| Payload Admin | ✅ 完成 |
| 管理员快捷入口 | ✅ 完成（前后台双向入口 + 快捷编辑） |
| Markdown 编辑器 | ✅ 完成（双栏实时预览） |
| 响应式布局 | ✅ 完成 |
| 测试覆盖 | ✅ 80%+ |
| 部署流程 | ⏸️ 待验证 |

---

## 当前 Blockers

无重大阻碍。

注意项：生产环境需定期验证部署流程。

---

## 下一步建议

1. **验证生产部署流程** — 确认 .env.local 不存在，测试 Docker 生产构建
2. **生成 Sitemap 和 RSS** — SEO 和内容分发
3. **评论系统调研** — Giscus / Disqus / 自研选型

---

## 重要决策与约束

- **设计系统**：Ollama 极简风格（纯黑白灰，pill-shaped，零阴影）
- **测试要求**：保持 80%+ 覆盖率
- **部署约束**：生产环境不得保留 .env.local
- **技术约束**：TypeScript 严格模式，无 implicit any

---

## 常用命令

```bash
npm run dev        # 开发服务器
npm test           # 运行测试
cd docker && docker-compose -f docker-compose.test.yml --env-file ../.env.test up -d  # 测试环境
```

---

**最后更新**：2026-04-11  
**更新说明**：建立极简版 Harness，记录当前项目快照
