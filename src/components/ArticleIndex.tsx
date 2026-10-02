"use client";

import { useState } from "react";
import Link from "next/link";
import { ArticleLinkFeedback } from "@/components/ArticleLinkFeedback";

export type ArticleIndexEntry = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  publishedDate?: string;
  readingTime: string;
  tags: string[];
};

/** 只接收已过滤可见性的摘要，不把 Markdown 或后台字段带入客户端。 */
export function ArticleIndex({ articles }: { articles: ArticleIndexEntry[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const counts = new Map<string, number>();
  articles.forEach((article) =>
    new Set(article.tags).forEach((value) =>
      counts.set(value, (counts.get(value) ?? 0) + 1),
    ),
  );
  const topics = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"),
  );
  const visibleTopics = expanded
    ? topics
    : topics.filter(([topic], index) => index < 6 || topic === tag);
  const filtered = tag
    ? articles.filter((article) => article.tags.includes(tag))
    : articles;

  return (
    <div>
      {topics.length > 1 ? (
        <div
          className="article-filters"
          role="group"
          aria-label="按主题筛选文章"
        >
          <button
            type="button"
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
          >
            全部 <span>{articles.length}</span>
          </button>
          {visibleTopics.map(([topic, count]) => (
            <button
              type="button"
              key={topic}
              aria-pressed={tag === topic}
              onClick={() => setTag(topic)}
            >
              {topic} <span>{count}</span>
            </button>
          ))}
          {topics.length > 6 ? (
            <button
              type="button"
              className="filter-more"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "收起主题 −" : "更多主题 +"}
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="article-index-status" role="status">
        {tag
          ? `${tag} · ${filtered.length} 篇文章`
          : `${articles.length} 篇文章，按发布时间排列`}
      </p>
      <ol className="article-index-list">
        {filtered.map((article) => (
          <li key={article.id}>
            <Link
              prefetch={false}
              href={`/blog/${article.slug}`}
              className="group article-row"
            >
              <span className="article-date">
                <time dateTime={article.publishedDate}>{article.date}</time>
                <span>{article.readingTime}</span>
              </span>
              <span className="min-w-0">
                <span className="article-row-title">{article.title}</span>
                <span className="article-row-excerpt">{article.excerpt}</span>
                <span className="article-row-tags">
                  {article.tags.slice(0, 3).map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </span>
              </span>
              <ArticleLinkFeedback
                className="md:justify-self-end"
                compact
                iconSize={19}
              />
            </Link>
          </li>
        ))}
      </ol>
      {filtered.length === 0 ? (
        <div className="empty-state">
          这个主题暂时没有文章。
          <button
            className="text-link ml-3"
            type="button"
            onClick={() => setTag(null)}
          >
            查看全部文章
          </button>
        </div>
      ) : null}
    </div>
  );
}
