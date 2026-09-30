# 性能验证简报：first_myself_site

> 当前有效协议为 `perf-v2`。旧 `perf-v1` 结果只用于解释历史过程，不能证明当前分支或线上版本。

## 范围与成功条件

范围是匿名访客的首页 `/`、文章列表 `/blog`、文章详情 `/blog/[slug]`。本轮不改变视觉、公开 URL、正文内容、SEO 语义、评论、点赞、Blog Agent、合集导航或部署方式。

成功需要同时满足：

- 页面业务哨兵、完整 `load`、字体、首屏图片和 1 秒网络静默全部完成；
- 主文档及资源没有 HTTP 错误、失败、未知字节或仍在途请求；
- 独立功能上下文中的输入或点击检查真实完成；
- 每个可比 A/B 批次至少 15 个样本，A/B 与 B/A 交替、单浏览器串行；
- 请求数 p75 不高于基线，编码字节 p75 不高于基线 5%；
- TTFB、打开到能用、完整首屏 p75 不高于 `基线 + max(50ms, 10%)`。

## 固定环境

- 基线：`39ef2610b775dac45ee0659853a1e1f9aa213caa`（独立 detached worktree）
- 应用候选：`1ecb7da2ebc02ef825b70fc3bfd1f35ab319b9d1`
- 浏览器：Google Chrome 154 / Playwright 1.55.0
- 视口：桌面 1440×900，手机 390×844
- 网络：`fast4g`，冷浏览器上下文，禁用 HTTP cache
- 数据：PostgreSQL 15 独立库 `first_myself_site_perf`，5 篇文章
- fixture hash：`eda65058396ec4ba17cea043cb9554b081a01b0f3c2933e864b78efe67c8c19d`
- 连续批次可使用站点已有的 `?analytics=off`，避免访问统计写入和本地按 IP 限流污染结果；A/B 必须一致。

## 业务哨兵

| 页面 | 完成条件 |
|---|---|
| 首页 | `h1` 有真实标题，首屏正文/主题块至少 4 个 |
| 文章列表 | `#all-articles-heading` 存在且至少一行 `.article-row` |
| 文章详情 | `article h1` 有标题，`.prose` 正文超过 200 字符 |

资源测量与功能操作使用不同 browser context，点击不会污染请求数和字节数。文章列表点击固定 fixture 的 `/blog/perf-test-short`；文章详情点击顶部“返回文章列表”。功能导航必须离开当前 URL 后才算通过。

## 原始证据

- `perf/bench/perf-v2/lab-home-desktop.json`
- `perf/bench/perf-v2/lab-blog-desktop.json`
- `perf/bench/perf-v2/lab-article-desktop.json`
- `perf/bench/perf-v2/lab-home-mobile.json`
- `perf/bench/perf-v2/lab-blog-mobile.json`
- `perf/bench/perf-v2/lab-article-mobile.json`
- `perf/bench/perf-v2/ceilings.json`

`perf/bench/perf-v2/ceilings.json` 只包含双方 15/15 完整的四个批次。文章页基线会产生浏览器取消的重复预取，因此不能建立时间棘轮；候选的完整结果单独报告，不用不完整基线计算提升比例。

## 运行入口

```bash
npm run perf:bench -- --url <url> --ready '<expression>' --out <result.json> \
  --fixture <fixture-id> --fixture-hash <sha256>

python3 perf/bench/ratchet.py check \
  --result <result.json> \
  --ceilings perf/bench/perf-v2/ceilings.json \
  --version B \
  --expected-app-sha <full-sha> \
  --label <frozen-label>
```

`check` 永远只读；只有显式 `init` 或 `update-baseline` 可以改写 ceilings。
