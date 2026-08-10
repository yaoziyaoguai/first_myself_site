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

**阶段**：核心内容、互动、运营统计和 GitHub → 阿里云部署链路已上线。

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
| SEO / 发现 | sitemap、RSS 和 canonical metadata 已上线 |
| 测试 | 最近基线为 42 个文件、382 个测试 |
| 部署 | PR → CI → main → 阿里云串行部署，带备份、健康检查和应用镜像回滚；数据库恢复需人工处理 |

## 当前 Blockers

无影响网站可用性的阻碍。

仍需持续关注：

- 证书续期和 Nginx 配置在服务器层，不由本仓库管理
- 备份尚未自动复制到 ECS 之外，也没有定期恢复演练
- 尚未接入独立的外部 uptime monitoring
- 进程内限流不适合未来的多实例部署

## 下一步建议

1. 配置异地备份目标和周期性恢复演练
2. 接入低维护成本的 uptime / TLS 到期监控
3. 持续发布真实学习文章，让项目和文章成为能力证据
4. 数据量积累后再决定是否增加趋势图或更复杂的统计分析

## 重要决策与约束

- 个人定位强调“学习和转型”，不做夸大的专家包装
- 生产代码不在服务器直接修改，始终走 GitHub PR 和部署工作流
- 内容上传默认草稿且私有，公开发布需要单独明确确认
- CMS 已编辑内容优先，迁移和兜底不能覆盖用户数据
- 访问统计无 Cookie，并尊重 DNT/GPC
- Nginx 必须覆盖代理身份头，应用端口不能直接暴露公网

## 常用命令

```bash
npm run dev
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm run build
```

**最后更新**：2026-08-10
**更新说明**：同步生产部署、可配置内容、文章发布、访问统计和 Markdown 编辑器现状。
