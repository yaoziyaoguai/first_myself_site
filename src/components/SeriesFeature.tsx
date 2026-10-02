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
    <article className="series-feature">
      <div className="series-feature-intro">
        <p className="series-meta">
          {articles.length} 篇文章{" "}
          <span>{series.progress === "completed" ? "已完结" : "持续更新"}</span>
        </p>
        <h3>
          <Link prefetch={false} href={`/blog/series/${series.slug}`}>
            {series.title}
          </Link>
        </h3>
        <p className="series-description">{series.description}</p>
        {articles[0] ? (
          <Link
            prefetch={false}
            className="text-link"
            href={`/blog/${String(articles[0].slug)}`}
          >
            从第一篇开始读 →
          </Link>
        ) : null}
      </div>
      <div className="series-feature-contents">
        <p className="text-xs text-muted-foreground">从这些文章开始</p>
        <ol>
          {articles.slice(0, 3).map((article, index) => (
            <li key={article.id}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Link prefetch={false} href={`/blog/${String(article.slug)}`}>
                {String(article.title ?? "未命名文章")}
              </Link>
            </li>
          ))}
        </ol>
        <Link
          prefetch={false}
          className="text-link"
          href={`/blog/series/${series.slug}`}
        >
          查看全部 {articles.length} 篇{" "}
          <ArrowUpRight size={16} className="ml-2" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
