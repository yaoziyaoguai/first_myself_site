import type { Metadata } from "next";
import Link from "next/link";
import { ArticleIndex } from "@/components/ArticleIndex";
import { SeriesFeature } from "@/components/SeriesFeature";
import { siteDefaults } from "@/content/siteDefaults";
import { getCurrentUser } from "@/lib/auth";
import { buildSeriesCollections, type SeriesArticle } from "@/lib/blogSeries";
import { summarizeExcerpt } from "@/lib/discovery";
import { findBlogPostsForViewer } from "@/lib/visitorContentCache";
import { formatSiteDate } from "@/lib/siteDate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "文章",
  description: siteDefaults.blog.description,
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const viewer = await getCurrentUser();
  const result = await findBlogPostsForViewer(viewer, {
    sort: "-publishedDate",
    limit: 100,
    depth: 1,
  });
  const collections = buildSeriesCollections(
    result.docs as unknown as SeriesArticle[],
  );
  const canManageSeries = viewer?.role === "admin";
  const showSeries = collections.length > 0 || canManageSeries;
  return (
    <div className="site-shell page-space">
      <header className="archive-header">
        <div>
          <p className="eyebrow">WRITING</p>
          <h1>文章与笔记</h1>
          <p>{siteDefaults.blog.description}</p>
        </div>
        <nav aria-label="文章浏览方式" className="archive-jumps">
          <a href="#all-articles-heading">
            全部文章 <span>{result.docs.length}</span>{" "}
            <span aria-hidden="true">↓</span>
          </a>
          {showSeries ? (
            <a href="#series-heading">
              文章合集 <span>{collections.length}</span>{" "}
              <span aria-hidden="true">↓</span>
            </a>
          ) : null}
          {canManageSeries ? (
            <Link
              prefetch={false}
              className="text-link"
              href="/admin/collections/blog-series"
            >
              管理合集 ↗
            </Link>
          ) : null}
        </nav>
      </header>
      {result.docs.length === 0 ? (
        <div className="empty-state">{siteDefaults.blog.emptyMessage}</div>
      ) : (
        <>
          {showSeries ? (
            <section
              aria-labelledby="series-heading"
              className="archive-series"
            >
              <div className="section-heading">
                <h2 id="series-heading" className="section-title">
                  文章合集
                </h2>
                <p>围绕一个问题，按顺序读。</p>
              </div>
              {collections.length === 0 ? (
                <div className="empty-state">
                  <p>
                    还没有可展示的合集。创建合集后，选择文章、调整顺序，再保存为「展示合集」。
                  </p>
                  <Link
                    prefetch={false}
                    className="text-link mt-4"
                    href="/admin/collections/blog-series/create"
                  >
                    创建第一个合集 →
                  </Link>
                </div>
              ) : (
                collections.map((collection) => (
                  <SeriesFeature
                    key={collection.series.id}
                    collection={collection}
                  />
                ))
              )}
            </section>
          ) : null}
          <section
            aria-labelledby="all-articles-heading"
            className="archive-index"
          >
            <div className="section-heading">
              <h2 className="section-title" id="all-articles-heading">
                全部文章
              </h2>
            </div>
            <ArticleIndex
              articles={result.docs.map((post) => ({
                id: String(post.id),
                slug: String(post.slug),
                title: String(post.title),
                excerpt: summarizeExcerpt(post.excerpt, 170),
                date: post.publishedDate
                  ? formatSiteDate(post.publishedDate)
                  : "",
                publishedDate: post.publishedDate || undefined,
                readingTime: post.readingTime || "",
                tags: (post.tags ?? []).flatMap(
                  (item: { tag?: string | null }) =>
                    item.tag?.trim() ? [item.tag.trim()] : [],
                ),
              }))}
            />
          </section>
        </>
      )}
    </div>
  );
}
