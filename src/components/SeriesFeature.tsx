import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BlogSeriesCollection } from "@/lib/blogSeries";

export function SeriesFeature({
  collection,
}: {
  collection: BlogSeriesCollection;
}) {
  const { series, articles } = collection;
  return (
    <Link
      prefetch={false}
      href={`/blog/series/${series.slug}`}
      className="series-feature"
    >
      <div className="min-w-0">
        <p className="series-meta">
          {articles.length} 篇文章{" "}
          <span>{series.progress === "completed" ? "已完结" : "持续更新"}</span>
        </p>
        <h3>{series.title}</h3>
        <p className="series-description">{series.description}</p>
      </div>
      <ArrowUpRight
        size={20}
        className="series-feature-arrow"
        aria-hidden="true"
      />
    </Link>
  );
}
