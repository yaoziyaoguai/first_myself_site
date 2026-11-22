export function articleTags(value: { tag?: string | null }[] | null | undefined): string[] {
  return (value ?? []).flatMap(({ tag }) => tag?.trim() ? [tag.trim()] : []);
}

export function searchTerms(query: string) {
  return query.normalize("NFKC").toLocaleLowerCase("zh-CN").trim().split(/\s+/).filter(Boolean);
}

export function matchesArticle(
  article: { title: string; excerpt: string; tags: string[] },
  terms: readonly string[],
) {
  if (terms.length === 0) return true;
  const text = [article.title, article.excerpt, ...article.tags].join(" ")
    .normalize("NFKC").toLocaleLowerCase("zh-CN");
  return terms.every((term) => text.includes(term));
}

export function relatedArticles<T extends {
  id: number | string;
  title?: string;
  excerpt?: string | null;
  tags?: { tag?: string | null }[] | null;
  publishedDate: string;
}>(
  articles: readonly T[],
  current: { id: number | string; tags?: { tag?: string | null }[] | null },
  excludedIds: ReadonlySet<string> = new Set(),
): T[] {
  const tags = new Set(articleTags(current.tags).map((tag) => tag.toLowerCase()));
  return articles
    .filter((article) => String(article.id) !== String(current.id) && !excludedIds.has(String(article.id)))
    .map((article) => {
      const overlap = new Set(articleTags(article.tags).map((tag) => tag.toLowerCase()).filter((tag) => tags.has(tag))).size;
      const text = [article.title, article.excerpt].join(" ").toLowerCase();
      const keywords = [...tags].filter((tag) => text.includes(tag)).length;
      return { article, overlap, keywords };
    })
    .sort((left, right) => right.overlap - left.overlap || right.keywords - left.keywords ||
      right.article.publishedDate.localeCompare(left.article.publishedDate))
    .slice(0, 3)
    .map(({ article }) => article);
}
