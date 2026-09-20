import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteDefaults } from "@/content/siteDefaults";
import { getCurrentUser } from "@/lib/auth";
import {
  buildSeriesCollections,
  type SeriesArticle,
} from "@/lib/blogSeries";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";
import { summarizeExcerpt } from "@/lib/discovery";
import { getPayloadAPI } from "@/lib/payload";
import { formatSiteDate } from "@/lib/siteDate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "文章",
  description: siteDefaults.blog.description,
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const viewer = await getCurrentUser();
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: buildBlogFrontendWhere(viewer),
    sort: "-publishedDate",
    limit: 100,
    depth: 1,
  });
  const articles = result.docs as unknown as SeriesArticle[];
  const collections = buildSeriesCollections(articles);
  const canManageSeries = viewer?.role === "admin";
  const showSeries = collections.length > 0 || canManageSeries;

  return (
    <div className="site-shell page-space">
      <header className="mb-16 grid gap-8 border-b border-border pb-12 md:mb-24 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)] md:items-end md:pb-16">
        <div>
          <p className="eyebrow">NOTES / 文章</p>
          <h1 className="mt-6 max-w-4xl text-balance font-serif text-[2.9rem] font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl md:text-6xl">
            写下来，才能看见理解的边界。
          </h1>
        </div>
        <p className="max-w-xl text-base leading-8 text-muted-foreground">{siteDefaults.blog.description}</p>
      </header>

      {articles.length > 0 ? <nav aria-label="文章浏览方式" className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border pb-5">
        <a className="text-link" href="#all-articles-heading">全部文章 · {articles.length}</a>
        {showSeries ? <a className="text-link" href="#series-heading">文章合集 · {collections.length}</a> : null}
        {canManageSeries ? (
          <Link className="text-link md:ml-auto" href="/admin/collections/blog-series">管理合集 ↗</Link>
        ) : null}
      </nav> : null}

      {result.docs.length === 0 ? (
        <div className="empty-state">{siteDefaults.blog.emptyMessage}</div>
      ) : (
        <>
          {showSeries ? <section aria-labelledby="series-heading" className="mb-20 md:mb-28">
              <div className="mb-7 grid gap-4 md:grid-cols-[1fr_minmax(18rem,32rem)] md:items-end">
                <div>
                  <p className="eyebrow">CURATED SERIES</p>
                  <h2 className="mt-3 scroll-mt-28 font-serif text-3xl font-medium tracking-[-0.035em] md:text-4xl" id="series-heading">
                    文章合集
                  </h2>
                </div>
                <p className="text-sm leading-7 text-muted-foreground md:text-right">
                  按主题一起读，也可以从目录中选择感兴趣的一篇。
                </p>
              </div>

              {collections.length === 0 ? (
                <div className="border-y border-border py-8 text-sm leading-7 text-muted-foreground">
                  <p>还没有可展示的合集。创建合集后，在合集里选择文章、调整顺序，再保存为「展示合集」。至少需要 1 篇已发布且公开的文章。</p>
                  <Link className="text-link mt-4" href="/admin/collections/blog-series/create">创建第一个合集 →</Link>
                </div>
              ) : <div className="border-y border-border">
                {collections.map(({ series, articles: seriesArticles }, index) => (
                  <article
                    className="group grid gap-6 border-b border-border py-8 last:border-b-0 hover:bg-card/70 lg:grid-cols-[5rem_minmax(14rem,0.75fr)_minmax(18rem,1fr)_auto] lg:items-start md:px-4 md:py-10"
                    key={series.id}
                  >
                    <span className="font-mono text-[0.7rem] text-primary">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <Link href={`/blog/series/${series.slug}`} className="block font-serif text-2xl font-medium leading-tight tracking-[-0.025em] hover:text-primary md:text-3xl">{series.title}</Link>
                      <span className="mt-3 block font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {series.progress === "completed" ? "已完结" : "持续更新"} · {seriesArticles.length} 篇
                      </span>
                      <Link className="text-link mt-5" href={`/blog/${String(seriesArticles[0].slug)}`}>从第一篇开始读 →</Link>
                    </span>
                    <div>
                      <p className="text-sm leading-7 text-muted-foreground">{series.description}</p>
                      <ol className="mt-5 grid gap-2">
                        {seriesArticles.slice(0, 3).map((article, articleIndex) => (
                          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-xs leading-5 text-foreground/80" key={article.id}>
                            <span className="font-mono text-muted-foreground">{String(articleIndex + 1).padStart(2, "0")}</span>
                            <Link className="py-1 hover:text-primary hover:underline" href={`/blog/${String(article.slug)}`}>{String(article.title ?? "未命名文章")}</Link>
                          </li>
                        ))}
                      </ol>
                      <Link className="text-link mt-4" href={`/blog/series/${series.slug}`}>查看全部 {seriesArticles.length} 篇 →</Link>
                    </div>
                    <ArrowUpRight aria-hidden="true" className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 lg:block" size={18} />
                  </article>
                ))}
              </div>}
            </section> : null}

          <section aria-labelledby="all-articles-heading">
            <div className="mb-7 flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow">ALL NOTES</p>
                <h2 className="mt-3 scroll-mt-28 font-serif text-3xl font-medium tracking-[-0.035em]" id="all-articles-heading">
                  全部文章
                </h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {result.docs.length} 篇
              </span>
            </div>
            <div className="border-y border-border">
              {result.docs.map((post, index) => {
                const tags = post.tags ?? [];
                return (
              <Link
                className="group article-row"
                href={`/blog/${post.slug}`}
                key={post.id}
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                  <span>
                  <span className="article-row-title">
                    {post.title}
                  </span>
                  <span className="mt-3 block max-w-3xl text-sm leading-7 text-muted-foreground">
                    {summarizeExcerpt(post.excerpt, 170)}
                  </span>
                  <span className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.68rem] text-muted-foreground">
                    <time>
                      {post.publishedDate
                        ? formatSiteDate(post.publishedDate)
                        : ""}
                    </time>
                    {post.readingTime ? <span>{post.readingTime}</span> : null}
                    {tags.map((tag: { tag?: string | null }) => (
                      <span key={tag.tag ?? "tag"}>#{tag.tag}</span>
                    ))}
                  </span>
                </span>
                <ArrowUpRight aria-hidden="true" className="hidden md:block" size={19} />
              </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
