import { describe, expect, it } from "vitest";
import {
  buildSeriesCollections,
  populatedSeries,
  sortSeriesArticles,
} from "@/lib/blogSeries";

const agentSeries = {
  id: 1,
  title: "从零构建 AI Agent",
  slug: "building-an-agent",
  description: "按演进顺序记录 Agent 从能跑到可维护。",
  progress: "ongoing",
  featured: true,
  sortOrder: 10,
  status: "published",
};

describe("blog series", () => {
  it("only treats populated published relationships as public series", () => {
    expect(populatedSeries(agentSeries)?.slug).toBe("building-an-agent");
    expect(populatedSeries(1)).toBeNull();
    expect(populatedSeries({ ...agentSeries, status: "draft" })).toBeNull();
  });

  it("orders chapters explicitly and falls back to publication order", () => {
    const articles = sortSeriesArticles([
      { id: 3, seriesOrder: 3, publishedDate: "2026-04-20" },
      { id: 2, publishedDate: "2026-04-16" },
      { id: 1, seriesOrder: 1, publishedDate: "2026-04-09" },
    ]);

    expect(articles.map((article) => article.id)).toEqual([1, 3, 2]);
  });

  it("builds collections only after they contain enough public chapters", () => {
    const collections = buildSeriesCollections([
      { id: 2, title: "第二篇", series: agentSeries, seriesOrder: 2 },
      { id: 1, title: "第一篇", series: agentSeries, seriesOrder: 1 },
      {
        id: 9,
        title: "孤立文章",
        series: { ...agentSeries, id: 2, slug: "single" },
      },
    ]);

    expect(collections).toHaveLength(1);
    expect(collections[0].series.slug).toBe("building-an-agent");
    expect(collections[0].articles.map((article) => article.id)).toEqual([1, 2]);
  });
});
