# 测试与发布前验证

本项目使用 Vitest、Testing Library、ESLint、TypeScript 和 Next.js production build 作为主要质量门禁。CI 输出是最终依据；文档中的数量只是最近一次已验证基线。

## 当前基线

### 2026-10-27 归档切换验收

- `npm run lint`、`npx tsc --noEmit --incremental false -p tsconfig.ci.json`、生产构建通过；常规 Vitest 972 项通过，28 条真库条件测试未在本轮本地运行，另由 CI PostgreSQL 专项验证；性能工具自测通过
- 使用匿名公开 API 的 32 篇文章 / 3 个合集副本，在既有隔离库预览；不覆盖既有隔离文章，不复制生产用户、凭据或私有材料，不写生产内容
- Chromium 1440 / 768 / 390px：默认文章、合集切换、32→7 篇主题筛选及切换保留、方向键焦点与选中、进入原合集详情后返回、刷新恢复、旧锚点兼容、减少动态效果和无整页溢出均通过；切换无 RSC 请求，页面与控制台零错误
- 首篇文章标题在三个视口分别位于约 574 / 626 / 738px，390×844px 手机首屏可见；紧凑合集单项约 175–208px（手机），不再把多个大面板放在文章前
- 禁用 JavaScript 后默认页面仍有 32 条文章链接，canonical 保持 `https://wangjinkun333.me/blog`。管理员 / editor / viewer / 访客的管理与创建入口隔离由组件测试覆盖，本轮不改变权限实现
- 改动前真实生产截图：`output/playwright/series-audit-20261027/`；改动后本地截图与结果：`output/playwright/series-tabs-20261027/local/`。本地结果不能单独证明生产效果，生产证据见下文；实体手机与完整屏幕阅读器未运行

生产：PR #70 合入 `90ef993`，经 [Run 40488113284](https://github.com/yaoziyaoguai/first_myself_site/actions/runs/40488113284) 部署成功，Deploy Job 6 分钟。CI 常规 972 项通过、28 条真库条件另跑，PostgreSQL 专项 39 项通过；生产容器 revision 匹配且 healthy、HTTPS 健康接口 ready、Agent canary 含代码 / 文章包引用。正式域名 Chromium 1440 / 768 / 390px 重测上述切换 / 筛选 / 返回 / 刷新 / 锚点，实际点击文章进入正文并返回列表；无 JS 默认输出 32 条文章链接、合集直达视图可读，canonical 不变，无整页溢出与页面 / 控制台错误。生产截图与报告在 `output/playwright/series-tabs-20261027/production/`，不是用本地结果代替生产验收。未修改生产文章、依赖或部署配置，本地服务已关闭。

### 2026-10-22 交互 HTML 发布基线

截至 2026-10-22，交互 HTML PR #68（合入 main 为 `ea1e527`）的发布候选证据：

- CI Run 39720927514：101 个测试文件通过，9 个按真库条件跳过；969 个自动化测试通过，28 个按真库条件跳过。本地全量为 968 项；CI 前补入实际生成器的 tracked fixture 后多 1 项
- 另运行 CI 的 PostgreSQL 15 专项入口，10 个文件、39 项通过；隔离备份/恢复验证了 HTML 字节、文章归属与不可变触发器，临时库已清理
- 全局 `publish-site-article` Skill 的 43 项 Python 测试通过，并与网站共享交互协议 fixtures；真实本地 CLI 的 plan/draft/resume/publish/回读/撤回及匿名桌面、手机交互通过。普通公开更新只提交四个编辑字段，回读核对日期、标签、媒体及合集，不把并发撤回重新公开
- ESLint 零警告、CI TypeScript 和 production build 通过
- Chromium、Firefox、WebKit 在 1440 / 768 / 390px 各 51 项通过；390×470 短视口/Shift+Tab/reduced-motion 共 12 项通过；后台/权限/错误与响应头 24 项通过；后台编辑稳定性与新资源未保存预览 12 项通过
- 以上条目只描述本地与 CI 证据，生产验证单列如下；实体手机不能由自动化视口验证替代

### 2026-10-22 生产验收

- PR #68 的 `ea1e527` 经 [Run 39721714408](https://github.com/yaoziyaoguai/first_myself_site/actions/runs/39721714408) 部署迁移并保持 HTML 关闭；同镜像私有候选验证后，[Run 39726180969](https://github.com/yaoziyaoguai/first_myself_site/actions/runs/39726180969) 正式启用。运行时 HTML/Agent 开关均 true、镜像 revision 匹配、容器 healthy，两个部署的真实 Agent canary 均通过
- 获准的合成文章 ID 33 经过 Skill draft/resume/publish/update-published 和逐字回读；发布日期、标签、封面、附件与合集不变。正式 HTTPS 512 KiB 上传成功、+1 字节返回 413，未引用资源匿名 404；最终 CSP、no-store、nosniff、Referrer-Policy、X-Robots-Tag、X-Frame-Options 验证通过
- Chromium/Firefox/WebKit × 1440/390px 实测启动前零 HTML 制品请求、点击/键盘滑块/计数、放大与收回保持 iframe 和状态、宿主 DOM 隔离、停止、无横向溢出及零页面/控制台错误。WebKit 自动化不等于实体 iPhone/Safari 验收
- 测完 ID 33 已恢复 `draft + private`，匿名文章页和 HTML 都 404；之后 Chromium 两视口重测首页、手机菜单、28→7 篇筛选、原有代码文章、目录与返回列表，公开列表仍为 28 篇且无错误。没有修改原有文章；测试浏览器从 `?analytics=off` 进入
- 本轮临时验证容器、SSH 转发和本地服务已关闭。证据为 `.local/interactive-html-release/production-report.json`、`production-regression-report.json` 与 `output/playwright/interactive-html-production-20261022/`。实体设备、完整屏幕阅读器和生产数据库恢复演练未运行

不要用“测试文件存在”代替“测试已运行”。超时、截断输出或没有成功退出码都不能算通过。

## 本地完整检查

```bash
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.ci.json
npm test
npm run build
```

Pull Request 会由 GitHub Dependency Review 比较本次依赖变更，新增 high/critical 漏洞时直接失败。`npm audit` 可作为本地补充检查，但它依赖 npm registry 实时服务，不作为生产部署的重复门禁。

`npm run build` 需要有效但可以是临时的 PostgreSQL 和以下变量：

```dotenv
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/database
PAYLOAD_SECRET=至少32字符的本地构建密钥
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

不要删除 lockfile 来解决依赖问题。依赖安装以 `npm ci` 和已提交的 `package-lock.json` 为准。

## 测试结构

```text
__tests__/
├── api/          公开接口、初始化门禁和健康检查
├── components/   前台组件与匿名访问统计客户端
├── deployment/   Nginx 媒体探测和部署顺序
├── lib/          解析、身份、限流、评论、点赞和统计逻辑
├── metadata/     sitemap、RSS 和公开内容发现
└── payload/      权限、collection、迁移、后台字段和配置内容
```

### API 与安全边界

- `/api/health` 的数据库就绪语义
- `/api/seed` 与 `/api/create-admin` 的生产拒绝和 token 校验
- 评论、回复和点赞的输入校验、目标校验、匿名身份与限流
- 访问统计的 origin、content type、事件格式、速率限制和错误状态

### Payload 与数据

- Blog、Users 等 collection 的角色与可见性规则
- 项目链接、最近学习和公开邮箱在后台可配置
- 配置内容 backfill 只填空值，不覆盖用户已经编辑的数据
- 生产迁移以显式 `prodMigrations` 运行
- PageViews migration、collection 权限和 SQL 聚合结果
- 生产浏览器验收从带 `?analytics=off` 的 URL 开始，避免自动化流量污染访问统计

### Markdown 编辑器

- GFM 内容渲染
- 空值、错误和 disabled 状态
- 内容锚点插值的边界与双向映射
- 宽内容不会挤压任一 pane
- 图片加载后的锚点重新测量
- 互动块前插入普通段落、代码或另一 marker 时，运行中的 iframe DOM、`contentWindow` 和内部状态不重置
- 后台上传失败不改正文；成功只插入 canonical `sha256` marker，并继续由保存门禁复核

### 文章交互 HTML

- marker 严格 JSON、顶层 AST、canonical 字段顺序、本地路径边界、Unicode、数量/字节限制，以及 TS/Python 共享 golden fixtures
- HTML/CSS profile 拒绝远程资源、嵌套文档、`srcset`、`@import`、危险 data MIME 和未清理隐藏源文；生成器公开副本 hash 跨语言一致
- PUT 的认证、来源、Content-Type/Encoding、流式大小、hash、限速和错误响应；GET source 只向 admin/editor 返回 JSON
- `/view` 的当前引用/可见性检查、仅作者可用的未保存资源 `/preview`、跨文章拒绝、撤回和开关语义，以及 CSP / iframe 双重 sandbox
- 真实 PostgreSQL 验证外键、不可变、幂等、版本/总量并发上限、文章级引用与 ready-package 原子回滚；没有测试 URL 时 skip 不算通过
- 点击前无 iframe/HTML 请求，启动后真实控件可操作；放大/收回保持同一 iframe，停止后销毁并明示重置；失败/重试有界
- Chromium、Firefox、WebKit 覆盖 1440 / 768 / 390px 和 390×470 短视口，检查 Tab/Shift+Tab、宿主焦点 Escape、reduced-motion、横向溢出和控制台错误

### 部署

- 新镜像构建完成后才切换容器
- 同一台生产服务器上的部署通过 concurrency group 串行执行
- 切换前执行媒体路径探测与备份
- 只清理 Payload 的 legacy dev migration marker
- 部署失败时保留回滚路径

### 单文章 Blog Agent

- 公共 API 只接受当前 slug 的单个问题，不读取其他 Blog、草稿或私有文章
- Markdown 证据、文章包检索、引用锚点和无证据拒答保持同一 Blog 边界
- 文章包只接受 Git 审计后的有界 source，索引状态与文章内容/hash 绑定
- 持久化窗口/每日配额、并发限制、缓存隔离和供应商失败路径
- 桌面浮层、移动端 bottom sheet、键盘焦点、引用跳转和 reduced motion

没有 `BLOG_AGENT_TEST_DATABASE_URL` 时，Blog Agent 与交互 HTML 真库测试会显示为 `skipped`，不能把普通 `npm test` 当作真库通过。CI 会使用 PostgreSQL 15 运行这些 migration、repository 与 canary 测试。真实 provider 验收按 [Blog Agent 运维手册](docs/blog-agent-operations.md) 执行；不要把个人主 Key 放进浏览器测试或 GitHub 日志。

## 按范围运行

```bash
# 单个文件
npm test -- __tests__/api/analytics.test.ts

# 一个目录
npm test -- __tests__/payload/

# 名称匹配
npm test -- -t "MarkdownPreviewField"

# 开发时监听
npm run test:watch
```

## 必要的手工验证

自动化测试不能替代以下真实交互。

### Markdown 长文

1. 在后台打开包含多级标题、表格和多张图片的长文章。
2. 确认编辑区与预览区宽度接近，各自可独立滚动。
3. 从编辑区滚动到文章中部，确认预览落在相同内容块。
4. 从预览区反向滚动，确认编辑区回到对应源码。
5. 等图片加载后重复检查，确认没有明显漂移。

### 访问统计

1. 在未开启 DNT/GPC 的浏览器访问公开页面并停留至少 15 秒。
2. 切换页面或隐藏标签页，确认阅读时间只统计可见时段。
3. 进入后台“运营 → 访问统计”，确认页面浏览量（PV）、独立访客（UV，估算）、停留和深度出现。
4. 用 admin/editor 登录后访问公开页面，再退出后台继续访问；确认同一浏览器的站长流量不会进入概览。
5. 开启 DNT 或 GPC 后重新访问，确认浏览器不发送统计事件。
6. 生产自动化验收从带 `?analytics=off` 的 URL 开始，并确认同一标签页后续导航也不再发送统计事件。

### 文章交互 HTML

1. 使用无敏感信息的真实生成器公开副本和带滑块/计数器的状态样例；确认点击前没有 iframe 或 HTML 请求。
2. 在前后台启动后操作控件，放大、收回并核对状态与同一 iframe 身份；停止后确认状态重置提示。
3. 在后台向运行中的块之前插入普通段落、代码和另一个 marker；确认 iframe 不发生额外 GET/导航，内部状态保持。
4. 验证上传失败不改正文，成功后 marker 插入当前光标；不要保存验收专用表单到生产内容。
5. 用匿名、viewer、editor、admin 覆盖草稿、公开/私有、跨文章、移除引用和撤回；读取结论必须来自真实 HTTP 状态，不只看按钮。
6. 核对最终应用与反向代理返回的 CSP、`Content-Type`、`Cache-Control`、`nosniff`、`Referrer-Policy`、`X-Robots-Tag`，并验证 512 KiB 请求能力。生产验证需要单独授权。

### 生产冒烟

1. `https://wangjinkun333.me/api/health` 返回 `{"status":"ready"}`。
2. 首页、项目页、文章列表和一篇长文正常加载。
3. 浏览器没有 TLS 警告，静态资源和文章图片返回成功。
4. Payload Admin 可以登录，内容与统计页面可打开。
5. Agent 开关关闭时文章页不渲染机器人且 API 返回 `404`；开放后只用审核过的实验文章做有额度约束的 canary。

## CI/CD 顺序

```text
Pull Request: ESLint ─┬→ TypeScript → Tests → Build
                     └→ Security Scan

main push / workflow_dispatch: ESLint → TypeScript → Tests → Build → Deploy
```

Pull Request 不会部署，但会审查本次新增的依赖风险。只有 `main` 的 push 或明确的 `workflow_dispatch` 且 Build 成功后，Deploy job 才会连接阿里云；同一生产服务器的部署按 concurrency group 串行执行。仓库变更应经 PR 合入，不直接 push 到 `main`。

## 结果报告要求

提交 PR 时至少报告：

- 实际运行的检查
- 测试文件数和测试数
- build 是否使用了本地临时数据库
- 手工验证了哪些用户路径
- 未验证或只能在生产验证的部分

不要声称固定覆盖率，除非本次确实生成并读取了 coverage report。当前仓库没有把覆盖率百分比作为 CI 门禁。
