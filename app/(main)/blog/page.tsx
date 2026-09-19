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

      {result.docs.length === 0 ? (
        <div className="empty-state">{siteDefaults.blog.emptyMessage}</div>
      ) : (
        <>
          {collections.length > 0 ? (
            <section aria-labelledby="series-heading" className="mb-20 md:mb-28">
              <div className="mb-7 grid gap-4 md:grid-cols-[1fr_minmax(18rem,32rem)] md:items-end">
                <div>
                  <p className="eyebrow">CURATED SERIES</p>
                  <h2 className="mt-3 font-serif text-3xl font-medium tracking-[-0.035em] md:text-4xl" id="series-heading">
                    专题合集
                  </h2>
                </div>
                <p className="text-sm leading-7 text-muted-foreground md:text-right">
                  把同一条实践路径上的文章按阅读顺序整理起来，而不是让它们淹没在时间流里。
                </p>
              </div>

              <div className="border-y border-border">
                {collections.map(({ series, articles: seriesArticles }, index) => (
                  <Link
                    className="group grid gap-6 border-b border-border py-8 last:border-b-0 hover:bg-card/70 md:grid-cols-[5rem_minmax(14rem,0.75fr)_minmax(18rem,1fr)_auto] md:items-start md:px-4 md:py-10"
                    href={`/blog/series/${series.slug}`}
                    key={series.id}
                  >
                    <span className="font-mono text-[0.7rem] text-primary">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block font-serif text-2xl font-medium leading-tight tracking-[-0.025em] transition-colors duration-200 group-hover:text-primary md:text-3xl">{series.title}</span>
                      <span className="mt-3 block font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {series.progress === "completed" ? "已完结" : "持续更新"} · {seriesArticles.length} 篇
                      </span>
                    </span>
                    <div>
                      <p className="text-sm leading-7 text-muted-foreground">{series.description}</p>
                      <ol className="mt-5 grid gap-2">
                        {seriesArticles.slice(0, 3).map((article, articleIndex) => (
                          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-xs leading-5 text-foreground/80" key={article.id}>
                            <span className="font-mono text-muted-foreground">{String(articleIndex + 1).padStart(2, "0")}</span>
                            <span>{String(article.title ?? "未命名文章")}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <ArrowUpRight aria-hidden="true" className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:block" size={18} />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="all-articles-heading">
            <div className="mb-7 flex items-end justify-between gap-6">
              <div>
                <p className="eyebrow">ALL NOTES</p>
                <h2 className="mt-3 font-serif text-3xl font-medium tracking-[-0.035em]" id="all-articles-heading">
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
