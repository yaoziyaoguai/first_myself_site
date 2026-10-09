# Jinkun / Field Notes 设计规范

## 1. 设计定位

这是一个以技术文章、项目实践和学习记录为核心的个人博客。设计目标不是模拟 SaaS 官网，也不是把每个区域包装成卡片，而是让读者快速知道作者在关注什么、先读哪篇文章，并能舒适地完成一次长文阅读。

关键词：克制、编辑感、个人气质、内容优先、技术可信度。

## 2. 本轮参考与取舍（2026-10-03）

本轮以 Awwwards、Webby Awards、FWA 优秀网站的完成度为目标，不把获奖当作可以自行认证的结果。方向仍是可持续阅读的个人技术博客。设计参数为 `DESIGN_VARIANCE: 6`、`MOTION_INTENSITY: 3`、`VISUAL_DENSITY: 4`：适度变化版式，低动效，中等信息密度。

### Cue 的实际访问范围

真实浏览器打开了 [Cue 组件库](https://www.cuedesign.space/)，读取到分类、标签筛选和排序等外壳。但组件数据请求出现 `ERR_CONNECTION_CLOSED`，页面显示 `Empty library`；官方 `llms-full.txt` 只能提供目录性介绍。本轮没有取得可用的具体组件预览或配套 Prompt，不能把以下实现声称为来自 Cue。

旧版文档记录过 Aethel Hero 与 Scrollspy Line Navigation；本轮无法重新核验这些预览，因此不继续把它们当作本次设计的已验证来源。未读取付费内容、复制代码、购买资源或绕过访问限制。

### 主视觉参考：Creative Boom 的编辑型首页

实际查看：[Awwwards 的 Creative Boom 页面参考](https://www.awwwards.com/inspiration/creative-boom)，截图保存在本次浏览器验收产物中。

- 借鉴：文章优先的首屏、主文章与次级内容的明确差异、元信息与标题的排版对比。
- 应用：首页最新文章与合集双层入口、近期文章列表、归档标题与日期层级。
- 不采用：新闻媒体的高密度栏目、大量摄影封面、订阅转化和广告区域。个人博客的真实内容不需要这些结构。
- 边界：查看的是公开设计参考截图；Creative Boom 实站访问超时，未声称测试过它的交互。没有复制其代码、字体或图片。

另查看了 [Diabla 编辑版式参考](https://www.awwwards.com/inspiration/editorial-layout-composition)，但其巨型装饰标题和图片拼贴会挤压本站文章入口，因此不采用。[Webby 官方评审维度](https://www.webbyawards.com/judging-criteria/) 用于检查内容、结构、视觉、功能和交互的一致性，不是视觉模板；本轮未取得可核验的 FWA 案例。

## 3. 视觉语言

### 色彩

- `--background: #f3f0e8`：暖纸色页面背景。
- `--foreground: #191915`：主文字，避免纯黑带来的生硬。
- `--card: #f9f7f1`：只用于需要轻微区分的内容表面。
- `--primary: #1f4f9f`：品牌蓝，用于链接、序号、焦点和少量强调。
- `--muted-foreground: #656158`：正文辅助信息，仍需保持可读对比度。
- `--border: #cec8bc`：组织结构的主要方式，优先于阴影。

不使用紫色渐变、装饰光斑和大面积阴影。使用连续的纸色背景，页脚不突然反转为黑底。保留既有浅色模式，不为本轮另建主题系统。

### 字体

- Display / 标题：`Iowan Old Style`, `Songti SC`, `Noto Serif CJK SC`, `STSong`, `Georgia`, serif。
- Body / UI：`Avenir Next`, `PingFang SC`, `Noto Sans CJK SC`, `Microsoft YaHei`, sans-serif。
- Code / 元信息：`SFMono-Regular`, `Cascadia Code`, `Consolas`, monospace。

衬线字体用于品牌、页面标题与文章标题；正文、章节标题和操作使用无衬线，便于长技术文的层级扫描。文章桌面正文 17px、行高 1.95，手机正文 16px、行高 1.9。使用本地系统字体，不新增远程字体请求。

### 间距与边界

- 页面最大宽度：80rem。
- 长文正文最大宽度：46rem。
- 主要间距遵循 4px / 8px 基础节奏。
- 内容分组优先使用留白和 1px 分隔线。
- 圆角只用于标签、按钮、输入框和确实需要容器感的区域；文章列表和信息分区默认无卡片。

## 4. 页面规则

### 导航

- 固定在顶部，高 68px，使用实色纸色背景，不让背后的正文干扰导航。
- 当前页面用细蓝线和文字颜色表示，不使用实心黑色药丸。
- 手机菜单按钮至少 44×44px；展开后每个入口至少 48px 高。
- 手机菜单支持 Escape 关闭并恢复按钮焦点；点击外部或切换至桌面宽度时关闭。

### 首页

- 首屏同时回答“这是谁”“主要写什么”“先读什么”。
- 最新文章是首屏的内容锚点，不用装饰图片挤压文章入口。
- 页面顺序：身份与最新文章 → 近期文章 → 项目与实验 → 最近学习。
- 同一文章不在同一区域重复出现。
- 合集从最新文章的真实关联中读取，不增加第二套内容源。没有合集时，侧栏回退为文章列表入口。

### 文章与合集

- 合集和全部文章使用同一套索引语言：序号、标题、摘要、日期、阅读时间、标签。
- 标题必须允许自然换行，不能省略关键技术名词。
- 整行可点击，但链接状态和焦点状态仍要清晰。
- 合集面板显示真实文章数、进度和前三篇目录，可以从第一篇开始或进入完整目录。
- 全部文章使用现有标签即时筛选；只向客户端传可见文章的摘要，不传正文、后台字段或 Agent source。筛选不发请求，不新增搜索服务。

### 文章正文

- 页面标题与 Markdown 内同名一级标题只显示一次。
- `h2`、`h3` 使用无衬线半粗体，字号分别约为正文的 1.55 与 1.22 倍；章节间距比段落间距更明显。
- 长代码和宽表格在自身容器内横向滚动，不能撑破页面。
- 图片保留原始比例并提供稳定边界，避免加载后布局跳动。
- 行内代码、引用和访问过的链接必须能被区分。
- 非合集文章在篇末提供真实的继续阅读入口，避免阅读死路。
- 至少含三个二级章节时提供目录：桌面左侧 sticky 导航，手机是正常文档流中的折叠目录。目录从已渲染标题读取，复用原锚点，不再次解析 Markdown，也不使用逐帧滚动监听。
- 点击目录收起手机面板并将焦点交给标题；章节保留顶部导航的滚动间距。合集目录与前后篇保持原有顺序。
- 桌面展开或调整 Agent 时，正文为实际面板宽度让出空间，章节目录改为折叠式；关闭后恢复。既有黑蓝 Orb、历史记录、引用和缩放能力不变。

## 5. 交互与响应式

- 所有主要操作触控区域不小于 44px。
- 不把重要信息只放在 hover 状态。
- hover 只使用轻微颜色和位移反馈，时长约 200ms。
- 支持 `prefers-reduced-motion`，禁用非必要动画并关闭平滑滚动。
- 手机端重新排列元信息和内容顺序，不做桌面布局的等比缩小。
- 390px、768px、1440px 是本项目的基础检查宽度。

## 6. 禁止项

- 不使用通用 SaaS 三列功能卡片。
- 不在首屏加入与文章无关的大图或视频。
- 不使用自定义光标、滚动劫持、逐字加载或内容出现前的等待动画。
- 不为了视觉效果修改文章内容、URL、发布日期和 SEO 语义。
- 不引入只为单个动效服务的大型依赖。

## 7. 验收产物

本轮使用真实公开文章的隔离本地副本，不复制生产用户、评论、凭据或私有材料。桌面 1440px、手机 390px、中间宽度 768px；重点覆盖长标题、59 分钟长文、表格、图片、代码、目录、合集、筛选、手机菜单和 Agent 面板。

本地截图和 Lighthouse JSON 位于 `output/playwright/design-20261003/`，不作为构建素材或生产依赖提交。改动前为生产页面，改动后为本地 production build；部署后的证据另在当前项目记录中注明，不能用本地结果冒充生产结果。尚未完成的检查不算通过。

### 本地验收记录

- 1440 / 768 / 390px：主页、文章列表、代表性代码文章、59 分钟长文、项目、关于、联系页面均无整页横向溢出；合集额外检查 390px 和实际文章往返。
- 长文：12/12 张真实图片可加载；20 张表格保持容器内滚动。手机表格实测容器 350px、内容 672px，方向键可滚动且焦点可见，整页仍为 390px。
- 目录：点击后目标标题位于顶部约 100px，不被 68px 导航挡住；焦点交给标题，当前章节更新。手机目录选择后关闭，减少动态效果设置下关闭平滑滚动。
- 导航与发现：手机菜单实际进入项目页后关闭；Escape 恢复焦点；文章主题筛选支持键盘，Agent Memory 筛出 7 篇，清除后恢复 22 篇；合集前后篇真实往返成功。
- Agent：桌面默认 416px 面板和拖拽至 614px 均不覆盖正文；关闭恢复阅读栏。手机保留原 bottom sheet、历史记录与操作语义。本地使用无真实 Provider 的 UI 预览，不宣称本地模型问答通过。
- SEO / 服务端输出：关闭 JavaScript 后首页、列表、正文和文章链接仍存在；canonical 保持原正式 URL；不存在文章和合集仍返回 HTTP 404，robots 与 sitemap 为 200。
- Lighthouse 13.5.0 单次本地移动端：主页性能 98、可访问性 100、最佳实践 100、SEO 100；代表文章分别为 92/100/100/100。主页 LCP 2.2 秒、CLS 0；文章 LCP 3.2 秒、CLS 0.033、TBT 140ms。文章慢网 LCP 仍未达到 2.5 秒目标，不能把这些分数当作生产性能、完整 WCAG 认证或获奖证明。
- 应用检查：844 项 Vitest 通过，2 项条件跳过，含真实 PostgreSQL；ESLint、TypeScript 和 production build 通过。浏览器覆盖的公开页面无运行时异常；没有执行实际手机设备和 Safari / Firefox 全套测试。

生产另已验证 PR #63 的原子文章更新和 ID 15 的真实代码问答：公开文字与 ready hash 一致，源码引用可进入固定 GitHub commit 和行号。

## 8. 文章 Agent 局部体验改进（2026-10-09）

本轮只改善会话阅读、输入和手机弹层，不再调整全站视觉，也不修改文章、检索或模型接口。保留纸色 / 品牌蓝主题、黑蓝 Orb、每文章最多 8 轮 session 历史、桌面缩放和固定 GitHub 行号引用。

### 参考与实现边界

- [shadcn/ui Base UI Dialog](https://ui.shadcn.com/docs/components/base/dialog)：借鉴焦点和模态交互规则，直接组合仓库已经安装的 `@base-ui/react/dialog`，不安装生成器或另一套 Dialog / Sheet。Portal 放回 Agent 原容器，保留桌面正文的让位布局。
- [beUI Message Scroller](https://beui.dev/r/message-scroller.json)：只参考“读者向上阅读时不强制跟随、提供回到底部入口”的行为。没有复制其源码，也不引入 `motion`、预览组件或额外辅助库。
- 没有从 Beautiful UI、Rare UI 或 Transitions.dev 添加代码、图片、字体及动效。现有 Base UI 继续遵循其 MIT 许可证；本站定制样式与交互由本项目维护。

### 交互约定

- 只有位于会话底部或主动发问时跟随新回答。向上翻阅后保留阅读位置，显示“查看最新回答”；回答完成不抢走正文或其他控件的焦点。
- 输入框按内容在 2–6 行间伸缩，超过后内部滚动。显示现有 500 字限制；Enter 换行，Ctrl / Cmd + Enter 发送，中文输入法组词期间不触发发送。
- 请求中输入框只读、发送按钮禁用，不丢失键盘焦点；失败保留问题，可使用原重试入口。没有新增请求、存储字段、统计或收费能力。
- 小于 80rem 使用模态底部弹层，锁定背景滚动、约束 Tab 焦点。打开时聚焦面板而非输入框，避免主动唤起手机键盘；关闭或 Escape 返回机器人按钮。
- 桌面仍是非模态面板，可操作正文，点击外部不关闭。断点切换不会丢失草稿和对话，拖拽及方向键缩放保持原行为。
- 点击文章依据时，先释放手机滚动锁，再定位并聚焦原文标题；沿用正文的滚动间距和 reduced-motion 设置。

### 验证范围

本地使用真实公开文章的隔离副本，截图与浏览器脚本位于 `output/playwright/agent-ux-20261009/`，不进入 Git 或生产构建。回答是明确标注的浏览器测试夹具，未调用真实模型，因此不作为模型效果或生产验收结论。检查 1440×900、390×844、768×1024，以及 390×470 短视口；实体手机键盘、Safari / Firefox 和完整屏幕阅读器验收未运行。

生产构建上的 Chromium 复测通过：长回答不抢滚动和焦点、输入伸缩、Tab / Escape、原文标题约 100px 的定位、草稿 / 历史保留、鼠标拖拽 428→506px 且正文仍留出空间。正常路径无控制台错误；故障夹具刻意返回 429 和 503，页面分别显示限流与重试，保留问题并可恢复。对应两条网络错误属于注入场景，不视为正常路径通过记录。

### 生产发布验收（2026-10-03）

- UI 经 [PR #64](https://github.com/yaoziyaoguai/first_myself_site/pull/64) 合入 `main`；[Actions Run 37076629022](https://github.com/yaoziyaoguai/first_myself_site/actions/runs/37076629022) 成功。生产容器 `healthy`，应用 revision 为 `8da380e93f342fad577e32886659260cf9c95396`。
- 新的 Chromium 上下文检查首页与代表文章的 1440 / 768 / 390px，以及项目、关于、联系的 390px：9 个页面/尺寸组合均为 200，零控制台错误、页面异常、HTTP 失败和整页横向溢出。
- 实际点击验证 22 篇文章筛选到 7 篇、展开更多主题、清除筛选；首页进入文章、进入合集、合集前后篇往返均通过。
- 目录跳转后目标标题距顶部约 100px，获得焦点；手机目录自动折叠，菜单跳转后关闭，Escape 将焦点交回菜单按钮。
- 59 分钟长文的 12 张图片均成功解码，20 张表格保持容器内滚动；手机首张表格容器 350px、内容 672px，实际方向键滚动成功。
- Agent 默认 416px 与实际拖拽后的 614px 均不覆盖正文；手机面板宽 390px，关闭/打开和返回后的历史保留正常。线上代码提问返回 200、代码块和 2 个固定 GitHub 引用（此次命中服务端缓存），点击打开 `runner.py#L217-L254`；不把缓存命中称为新的模型生成测试。
- `/api/health`、robots、sitemap 为 200，不存在文章与合集继续返回真实 404。部署内 Agent canary 通过。
- 预先打开、跨越容器切换的旧浏览器出现过 1 次 analytics 请求 502；切换完成后上述新上下文为零失败。不把这套现有单容器切换流程描述为零停机。
- 部署 Job 共 35 分 19 秒；只读日志确认服务器编译约 15.4 分钟、TypeScript 约 4.2 分钟，镜像层导出约 5 分钟、载入约 2.5 分钟。未中断部署，未在服务器直接修改源代码。

生产截图同样保存在本地证据目录：`production-home-{1440,768,390}.png`、`production-article-{1440,768,390}.png`、`production-archive-desktop.png`、`production-archive-mobile.png`、`production-series-mobile.png`、`production-long-article-mobile.png`、`production-table-mobile.png`、`production-agent-desktop.png`、`production-agent-mobile.png`、`production-agent-answer.png`、`production-github-ui-release.png`。Lighthouse 仍只有前述本地结果，不新增生产分数声明。

### 主要截图

目录均为 `output/playwright/design-20261003/`：

| 页面 | 改动前（生产） | 改动后（本地 production build） |
| --- | --- | --- |
| 主页桌面 | `before-home-desktop.png` | `after-home-1440.png` |
| 主页手机 | `before-home-mobile.png` | `after-home-390.png` |
| 文章桌面 | `before-article-desktop.png` | `after-article-desktop.png` |
| 文章手机 | `before-article-mobile.png` | `after-article-mobile.png` |
| 列表桌面 | `before-archive-desktop.png` | `after-archive-1440.png` |
| 列表手机 | `before-archive-mobile.png` | `after-archive-390.png` |

代码文章在本轮经过另行授权的文字改写，前后截图标题不同；不是视觉改版擅自改正文。其 URL、发布日期和代码来源保持不变。

### 修改文件地图

- 页面：`app/(main)/page.tsx`、`blog/page.tsx`、`blog/[slug]/page.tsx`、`blog/series/[slug]/page.tsx`、`projects/page.tsx`、`about/page.tsx`、`contact/page.tsx`。
- 样式：`app/globals.css`，继续复用原语义色彩和字体变量。
- 新组件：`src/components/ArticleIndex.tsx`、`ArticleReadingNav.tsx`、`SeriesFeature.tsx`。
- 现有组件：`src/components/Navbar.tsx`、`Footer.tsx`、`MarkdownArticle.tsx`、`blog-agent/BlogAgent.tsx`。
- 测试：`__tests__/components/ArticleIndex.test.tsx`、`ArticleReadingNav.test.tsx`、`MarkdownArticle.test.tsx`、`Navbar.test.tsx`、`blog-agent/BlogAgent.test.tsx`。
- 文档：`DESIGN.md`、`README.md`、`.claude/user-harness/STATUS.md`、`RECENT_SESSIONS.md`；`CLAUDE.md` 仅保留 Next.js 自动生成的项目指引块。
