"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArticleLinkFeedback } from "@/components/ArticleLinkFeedback";
import { rememberArchiveLocation, updateArchiveQuery } from "@/components/ArticleSearch";
import { matchesArticle, searchTerms } from "@/lib/articleDiscovery";

export type ArticleIndexEntry = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  publishedDate: string;
  readingTime?: string | null;
  tags: string[];
};

const PAGE_SIZE = 25;

export function ArticleIndex({ articles }: { articles: ArticleIndexEntry[] }) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const tags = searchParams.getAll("tag");
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const visibleCount = page * PAGE_SIZE;
  const [expanded, setExpanded] = useState(false);
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      for (const tag of new Set(article.tags)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
  }, [articles]);
  const visibleTopics = expanded ? topics : topics.filter(([tag], index) => index < 6 || tags.includes(tag));
  const terms = searchTerms(query);
  const filtered = articles.filter((article) =>
    tags.every((tag) => article.tags.includes(tag)) && matchesArticle(article, terms),
  );
  const groups = new Map<string, ArticleIndexEntry[]>();
  for (const article of filtered.slice(0, visibleCount)) {
    const year = article.date.slice(0, 4);
    const group = groups.get(year);
    if (group) group.push(article);
    else groups.set(year, [article]);
  }

  function selectTag(tag: string) {
    updateArchiveQuery((params) => {
      if (tags.includes(tag)) params.delete("tag", tag);
      else params.append("tag", tag);
      params.delete("page");
    });
  }

  return (
    <div>
      {topics.length > 0 && (
        <div className="article-filters" role="group" aria-label="按主题筛选文章">
          <button type="button" aria-pressed={tags.length === 0}
            onClick={() => updateArchiveQuery((params) => {
              params.delete("tag");
              params.delete("page");
            })}>
            全部 <span>{articles.length}</span>
          </button>
          {visibleTopics.map(([topic, count]) => (
            <button type="button" key={topic} aria-pressed={tags.includes(topic)}
              onClick={() => selectTag(topic)}>
              {topic} <span>{tags.includes(topic) ? "×" : count}</span>
            </button>
          ))}
          {topics.length > 6 && (
            <button type="button" className="filter-more" aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}>
              {expanded ? "收起主题 −" : "更多主题 +"}
            </button>
          )}
        </div>
      )}
      <p className="article-index-status" role="status">{filtered.length} 篇文章</p>
      {[...groups].map(([year, entries]) => (
        <section className="article-year-group" key={year} aria-label={year}>
          <h3 className="article-year">{year}</h3>
          <ol className="article-index-list">
            {entries.map((article) => (
              <li key={article.id}>
                <Link prefetch={false} href={`/blog/${article.slug}`} className="group article-row"
                  onNavigate={rememberArchiveLocation}>
                  <span className="article-date">
                    <time dateTime={article.publishedDate}>{article.date.slice(5)}</time>
                    <span>{article.readingTime}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="article-row-title">{article.title}</span>
                    <span className="article-row-excerpt">{article.excerpt}</span>
                    <span className="article-row-tags">
                      {article.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
                    </span>
                  </span>
                  <ArticleLinkFeedback className="md:justify-self-end" compact iconSize={19} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {filtered.length > visibleCount && (
        <button className="text-link mt-5" type="button"
          onClick={() => updateArchiveQuery((params) => params.set("page", String(page + 1)))}>
          加载更多文章 →
        </button>
      )}
      {filtered.length === 0 && (
        <div className="empty-state">
          没有符合当前条件的文章。
          <button className="text-link ml-3" type="button"
            onClick={() => updateArchiveQuery((params) => {
              params.delete("q");
              params.delete("tag");
              params.delete("page");
            })}>
            清除筛选
          </button>
        </div>
      )}
    </div>
  );
}
