"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ArticleLinkFeedback } from "@/components/ArticleLinkFeedback";
import { rememberArchiveLocation } from "@/lib/archiveNavigation";
import { matchesArticle, searchTerms } from "@/lib/articleDiscovery";
import type { BlogSeriesCollection } from "@/lib/blogSeries";

export function SeriesArchiveResults({ collections }: { collections: BlogSeriesCollection[] }) {
  const terms = searchTerms(useSearchParams().get("q") ?? "");
  const matching = collections.filter(({ series, articles }) => matchesArticle({
    title: series.title,
    excerpt: [series.description, ...articles.map((article) => article.title)].join(" "),
    tags: [],
  }, terms));

  if (matching.length === 0) {
    return <p className="empty-state" role="status">没有符合当前关键词的合集。</p>;
  }
  return matching.map((collection) => <SeriesFeature key={collection.series.id} collection={collection} />);
}

export function SeriesFeature({
  collection,
}: {
  collection: BlogSeriesCollection;
}) {
  const { series, articles } = collection;
  return (
    <article className="series-feature spotlight-card">
      <div className="min-w-0">
        <p className="series-meta">
          {articles.length} 篇文章
          <span>{series.progress === "completed" ? "已完结" : "持续更新"}</span>
        </p>
        <h3>
          <Link prefetch={false} href={`/blog/series/${series.slug}`}
            onNavigate={() => rememberArchiveLocation(`/blog/series/${series.slug}`)}>
            {series.title}
            <ArrowUpRight size={18} className="series-feature-arrow" aria-hidden="true" />
          </Link>
        </h3>
        <p className="series-description">{series.description}</p>
      </div>
      <ol className="series-preview">
        {articles.slice(0, 3).map((article, index) => (
          <li key={article.id}>
            <Link prefetch={false} href={`/blog/${article.slug}`}
              onNavigate={() => rememberArchiveLocation(`/blog/${article.slug}`)}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="series-preview-title">{String(article.title)}</span>
              <ArticleLinkFeedback compact iconSize={14} />
            </Link>
          </li>
        ))}
      </ol>
    </article>
  );
}
