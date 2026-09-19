export type BlogSeriesRecord = {
  id: string | number;
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  progress?: unknown;
  featured?: unknown;
  sortOrder?: unknown;
  status?: unknown;
};

export type SeriesArticle = {
  id: string | number;
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  publishedDate?: unknown;
  readingTime?: unknown;
  tags?: unknown;
  series?: unknown;
  seriesOrder?: unknown;
};

export type BlogSeriesCollection = {
  series: BlogSeriesRecord & {
    title: string;
    slug: string;
    description: string;
  };
  articles: SeriesArticle[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function order(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function publishedAt(value: unknown): number {
  if (typeof value !== "string") return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function populatedSeries(value: unknown): BlogSeriesCollection["series"] | null {
  if (!value || typeof value !== "object" || !("id" in value)) return null;
  const series = value as BlogSeriesRecord;
  const title = text(series.title);
  const slug = text(series.slug);
  const description = text(series.description);

  if (!title || !slug || !description || series.status !== "published") return null;
  return { ...series, title, slug, description };
}

export function sortSeriesArticles(articles: SeriesArticle[]): SeriesArticle[] {
  return [...articles].sort((left, right) => {
    const byOrder = order(left.seriesOrder) - order(right.seriesOrder);
    if (byOrder !== 0) return byOrder;
    return publishedAt(left.publishedDate) - publishedAt(right.publishedDate);
  });
}

export function buildSeriesCollections(
  articles: SeriesArticle[],
  minimumArticles = 2,
): BlogSeriesCollection[] {
  const grouped = new Map<string, BlogSeriesCollection>();

  for (const article of articles) {
    const series = populatedSeries(article.series);
    if (!series) continue;
    const key = String(series.id);
    const current = grouped.get(key) ?? { series, articles: [] };
    current.articles.push(article);
    grouped.set(key, current);
  }

  return [...grouped.values()]
    .filter((collection) => collection.articles.length >= minimumArticles)
    .map((collection) => ({
      ...collection,
      articles: sortSeriesArticles(collection.articles),
    }))
    .sort((left, right) => {
      const featuredDifference = Number(Boolean(right.series.featured)) - Number(Boolean(left.series.featured));
      if (featuredDifference !== 0) return featuredDifference;
      const byOrder = order(left.series.sortOrder) - order(right.series.sortOrder);
      if (byOrder !== 0) return byOrder;
      return left.series.title.localeCompare(right.series.title, "zh-CN");
    });
}
