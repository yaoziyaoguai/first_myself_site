"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { rememberArchiveLocation } from "@/components/ArticleSearch";
import type { BlogSeriesCollection } from "@/lib/blogSeries";

export function SeriesFeature({
  collection,
}: {
  collection: BlogSeriesCollection;
}) {
  const { series, articles } = collection;
  const minutes = articles.map(({ readingTime }) => Number(String(readingTime ?? "").match(/\d+/)?.[0]));
  const total = minutes.every(Number.isFinite) ? minutes.reduce((sum, value) => sum + value, 0) : 0;
  return (
    <Link
      prefetch={false}
      href={`/blog/series/${series.slug}`}
      className="series-feature"
      onNavigate={rememberArchiveLocation}
    >
      <div className="min-w-0">
        <p className="series-meta">
          {articles.length} 篇文章{total > 0 ? ` · 合计约 ${total} 分钟` : ""}{" "}
          <span>{series.progress === "completed" ? "已完结" : "持续更新"}</span>
        </p>
        <h3>{series.title}</h3>
        <p className="series-description">{series.description}</p>
        <ol className="series-preview">
          {articles.slice(0, 3).map((article, index) => (
            <li key={article.id}><span>{String(index + 1).padStart(2, "0")}</span> {String(article.title)}</li>
          ))}
        </ol>
      </div>
      <ArrowUpRight
        size={20}
        className="series-feature-arrow"
        aria-hidden="true"
      />
    </Link>
  );
}
