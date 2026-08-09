import { describe, expect, it } from "vitest";
import {
  buildSitemapEntries,
  renderRssFeed,
  SITE_URL,
  summarizeExcerpt,
} from "@/lib/discovery";

const posts = [
  {
    title: "A & B",
    slug: "agent-notes",
    excerpt: "使用 <Agent> 做可靠实验",
    publishedDate: "2026-08-01T00:00:00.000Z",
    status: "published",
    visibility: "public",
  },
  {
    title: "Private",
    slug: "private-note",
    excerpt: "not public",
    publishedDate: "2026-08-02T00:00:00.000Z",
    status: "published",
    visibility: "private",
  },
];

describe("discovery metadata", () => {
  it("builds the main routes and public article URLs only", () => {
    const entries = buildSitemapEntries(posts);
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}/blog/agent-notes`);
    expect(urls).not.toContain(`${SITE_URL}/admin`);
    expect(urls).not.toContain(`${SITE_URL}/blog/private-note`);
  });

  it("renders valid escaped RSS XML for public posts", () => {
    const xml = renderRssFeed(posts);

    expect(xml).toContain("<rss version=\"2.0\">");
    expect(xml).toContain("A &amp; B");
    expect(xml).toContain("使用 &lt;Agent&gt; 做可靠实验");
    expect(xml).not.toContain("Private");
  });

  it("bounds long excerpts without changing short ones", () => {
    expect(summarizeExcerpt("短摘要", 10)).toBe("短摘要");
    expect(summarizeExcerpt("一二三四五六七八九十", 6)).toBe("一二三四五…");
  });
});
