"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ArticleLinkFeedback } from "@/components/ArticleLinkFeedback";
import { rememberArchiveLocation } from "@/components/ArticleSearch";
import type { BlogSeriesCollection } from "@/lib/blogSeries";

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
          <Link prefetch={false} href={`/blog/series/${series.slug}`} onNavigate={rememberArchiveLocation}>
            {series.title}
            <ArrowUpRight size={18} className="series-feature-arrow" aria-hidden="true" />
          </Link>
        </h3>
        <p className="series-description">{series.description}</p>
      </div>
      <ol className="series-preview">
        {articles.slice(0, 3).map((article, index) => (
          <li key={article.id}>
            <Link prefetch={false} href={`/blog/${article.slug}`} onNavigate={rememberArchiveLocation}>
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
