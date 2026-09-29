# 性能冲刺简报：first_myself_site（个人博客与作品展示站）

> 依据闪电.skill（huashu-flash）流程。所有性能产物放在 `perf/` 目录。

## 你的职责

负责本站打开和阅读的速度：先测基线，再一步步优化，每一步用测量证明，赢下来的用棘轮锁住。主动提出改进，但用户看得见的变化和上线由人决定。

## 测量环境（本次冲刺固定不变）

- 线上：<https://wangjinkun333.me>（阿里云 ECS，Nginx + Next.js production）
- 实验室：本机 `npm run build && npm start`（127.0.0.1:3000），数据库为本机 Homebrew PostgreSQL 15.17（127.0.0.1:5432，库 `first_myself_site`）
- 基线 commit：`origin/main`（0293913，即当前线上版本）；性能分支 `perf/lightning`
- 测速器：`perf/bench/bench.mjs`（Node + playwright 对 skill 自带 `scripts/bench.py` 的忠实移植：同样限速档、冷上下文、判定表达式每帧轮询、p50/p75/p95；因本机 Python 3.14 无 playwright wheel 改用 Node 实现，复用本机已缓存 Chromium）
- 口径：主口径 fast4g（RTT 20ms，下行 4Mbps，上行 3Mbps，对所有请求生效）+ 冷缓存（每次新浏览器上下文）+ 每组 ≥10 次

## 核心操作与「能用」的定义

| 操作 | 页面 | 起点 | 终点（真的能用） | 判定表达式 |
|---|---|---|---|---|
| 打开首页 | `/` | 导航开始 | 站点标题（h1）、角色/简介和首屏内容块可见可读 | `(() => { const h1 = document.querySelector('h1'); const blocks = document.querySelectorAll('.site-shell p, .site-shell .topic-pill'); return !!h1 && h1.textContent.trim().length > 3 && blocks.length >= 4; })()` |
| 打开博客列表 | `/blog` | 导航开始 | 「全部文章」标题与文章行可见可读 | `(() => { const h = document.querySelector('#all-articles-heading'); const rows = document.querySelectorAll('.article-row'); return !!h && rows.length >= 1; })()` |
| 阅读文章 | `/blog/撒大方`（主力样本，12690 字符长文） | 导航开始 | 文章标题与正文（.prose 内实际渲染的文字）可见可读 | `(() => { const h1 = document.querySelector('article h1'); const prose = document.querySelector('.prose'); return !!h1 && h1.textContent.trim().length > 3 && !!prose && prose.textContent.trim().length > 200; })()` |

三条页面路由均为 `force-dynamic` 服务端渲染，正文由服务端组件直接进 HTML，判定表达式与内容强绑定，不存在骨架屏提前「能用」的漏洞。

## 不能动的东西

- 视觉：布局、字体、配色、间距、动画一律不变（视觉回归截图锁住）
- 功能：评论、点赞、Blog Agent、合集导航、后台快捷入口等行为不变
- SEO / 统计：title、meta、canonical、JSON-LD、sitemap、RSS、无 Cookie 访问统计行为逐项一致（护栏测试锁住）
- 第三方：不引入新的外部依赖与付费平台能力

## 目标

- 主指标：三个核心操作「打开到能用」的 p75 各降一半
- 测量口径：`references/measurement-protocol.md` 主口径 fast4g；最终对比用 A/B 交替配对测

## 上线与回滚

- 谁批准上线：用户，每次上线前停下确认（用户已选「每次都问」档）
- 部署方式：本仓库标准链路 PR → CI → main → 阿里云（性能分支 `perf/lightning` 上的本地 commit 属于冲刺流程；push、PR、合并、部署均需用户点头）
- 回滚办法：部署工作流自带应用镜像回滚；代码层 revert 对应 commit 即可

## 已知事实（开工时侦察结论）

- 三个核心页面全部 `force-dynamic`，无静态化/无缓存：每次请求都渲染 React 服务端组件并经 Payload Local API 查 PostgreSQL
- 首页一次请求并行 4 组查询；博客列表 depth=1 查询；文章详情页最多 4 组串行查询（文章、合集成员、相关文章 + generateMetadata 又查一次文章）
- 本地库内容量偏少（开工时 1 篇公开文章），会补带 `perf-test-` 标记的代表性测试文章，结束后可清理
