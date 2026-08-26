# 搜索发现运维

站点已经公开提供以下发现入口：

- `https://wangjinkun333.me/robots.txt`
- `https://wangjinkun333.me/sitemap.xml`
- `https://wangjinkun333.me/rss.xml`

公开页面使用 `https://wangjinkun333.me` 作为 canonical 域名；全站输出关联的 Person / WebSite JSON-LD，文章页输出 BlogPosting JSON-LD，并在有封面时复用封面作为分享与结构化数据图片。sitemap 的 `lastmod` 来自文章真实更新时间。`/admin/` 和 `/api/` 不允许搜索引擎抓取。

## 首次接入

Google：

1. 在 [Google Search Console](https://search.google.com/search-console/) 添加域名资源 `wangjinkun333.me`。
2. 优先通过阿里云 DNS 添加 Google 提供的 TXT 记录完成所有权验证，验证值不要写入仓库。
3. 在 Sitemaps 页面提交 `https://wangjinkun333.me/sitemap.xml`。
4. 用 URL Inspection 分别检查首页、文章列表和一篇公开文章，并各请求一次收录。

百度：

1. 在 [百度搜索资源平台](https://ziyuan.baidu.com/) 添加 `https://wangjinkun333.me`。
2. 按平台提示通过 DNS 或文件完成站点验证；验证 token 不进入仓库。
3. 在“普通收录”中提交 `https://wangjinkun333.me/sitemap.xml`。
4. 用平台的抓取诊断检查首页和一篇公开文章。

提交 sitemap 只帮助搜索引擎发现页面，不保证收录。新站通常仍需要等待抓取和质量判断；不要反复提交同一 URL。

## 发布后的检查

1. 确认新文章出现在 sitemap 和 RSS 中。
2. 确认页面返回 `200`，不存在 `noindex`，canonical 指向当前公开 URL。
3. 确认标题只包含一次站点名，Person / WebSite / BlogPosting JSON-LD 可以被解析，封面图 URL 可公开抓取。
4. 在两个站长平台中观察抓取错误、已发现未收录和索引数量，不以 `site:` 查询作为唯一结论。

如果平台报告无法抓取，先检查 DNS、TLS、Nginx/WAF 对 Googlebot 与 Baiduspider 的响应，再检查应用日志。不要为了“让爬虫通过”关闭全站安全策略；只修复能够复现的错误规则。
