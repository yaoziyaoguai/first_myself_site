import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { sortSeriesArticles, type SeriesArticle } from "@/lib/blogSeries";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";
import { getPayloadAPI } from "@/lib/payload";
import { formatSiteDate } from "@/lib/siteDate";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function findPublishedSeries(slug: string) {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog-series",
    where: {
      slug: { equals: slug },
      status: { equals: "published" },
    },
    limit: 1,
    depth: 0,
  });
  return result.docs[0] ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const series = await findPublishedSeries(decodeURIComponent(slug));

  if (!series) return { title: "合集未找到" };
  return {
    title: series.title,
    description: series.description,
    alternates: { canonical: `/blog/series/${series.slug}` },
    openGraph: {
      title: series.title,
      description: series.description,
      type: "website",
    },
  };
}

export default async function BlogSeriesPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const [viewer, series] = await Promise.all([
    getCurrentUser(),
    findPublishedSeries(decodedSlug),
  ]);

  if (!series) notFound();

  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      ...buildBlogFrontendWhere(viewer),
      series: { equals: series.id },
    },
    limit: 100,
    depth: 0,
  });
  const articles = sortSeriesArticles(result.docs as unknown as SeriesArticle[]);

  return (
    <div className="site-shell page-space">
      <Link className="text-link mb-10" href="/blog">
        ← 返回文章列表
      </Link>

      <header className="grid gap-8 border-b border-border pb-12 md:grid-cols-[minmax(0,1fr)_12rem] md:items-end md:pb-16">
        <div className="max-w-4xl">
          <p className="eyebrow">SERIES</p>
          <h1 className="mt-6 text-balance font-serif text-4xl font-medium leading-[1.08] tracking-[-0.04em] sm:text-5xl md:text-6xl">
            {series.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
            {series.description}
          </p>
        </div>
        <div className="border-l border-border pl-5 font-mono text-xs leading-6 text-muted-foreground md:text-right">
          <p>{series.progress === "completed" ? "已完结" : "持续更新"}</p>
          <p>{articles.length} 篇文章</p>
        </div>
      </header>

      {articles.length === 0 ? (
        <div className="empty-state mt-12">这个合集已经建立，文章仍在整理中。</div>
      ) : (
        <ol className="mt-12 border-y border-border md:mt-16">
          {articles.map((article, index) => {
            const tags = Array.isArray(article.tags)
              ? (article.tags as { tag?: string | null }[])
              : [];
            const publishedDate =
              typeof article.publishedDate === "string"
                ? formatSiteDate(article.publishedDate)
                : "";

            return (
              <li key={article.id}>
                <Link
                  className="group article-row md:grid-cols-[7rem_minmax(0,1fr)_2rem]"
                  href={`/blog/${String(article.slug)}`}
                >
                  <span className="font-mono text-xs text-primary">
                    第 {String(index + 1).padStart(2, "0")} 篇
                  </span>
                  <span>
                    <span className="article-row-title">
                      {String(article.title ?? "未命名文章")}
                    </span>
                    <span className="mt-3 block max-w-3xl text-sm leading-7 text-muted-foreground">
                      {String(article.excerpt ?? "")}
                    </span>
                    <span className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.68rem] text-muted-foreground">
                      <time>{publishedDate}</time>
                      {typeof article.readingTime === "string" && article.readingTime ? (
                        <span>{article.readingTime}</span>
                      ) : null}
                      {tags.map((tag) => (
                        <span key={tag.tag ?? "tag"}>#{tag.tag}</span>
                      ))}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:block" size={19} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
