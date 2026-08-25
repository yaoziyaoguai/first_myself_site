import { describe, expect, it } from "vitest";
import {
  buildArticleJsonLd,
  buildArticleMetadata,
  buildSitemapEntries,
  renderRssFeed,
  serializeJsonLd,
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

  it("lets the site title template add the author name exactly once", () => {
    const metadata = buildArticleMetadata({
      title: "让 Agent 安全执行命令",
      slug: "safe-agent",
      description: "一篇测试文章",
    });

    expect(metadata.title).toBe("让 Agent 安全执行命令");
    expect(metadata.alternates).toEqual({ canonical: "/blog/safe-agent" });
    expect(metadata.openGraph).toMatchObject({
      title: "让 Agent 安全执行命令 | Jinkun Wang",
      url: `${SITE_URL}/blog/safe-agent`,
      type: "article",
    });
  });

  it("builds Article structured data with the canonical URL and dates", () => {
    expect(
      buildArticleJsonLd({
        title: "让 Agent 安全执行命令",
        slug: "safe-agent",
        description: "一篇测试文章",
        publishedDate: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "让 Agent 安全执行命令",
      description: "一篇测试文章",
      inLanguage: "zh-CN",
      url: `${SITE_URL}/blog/safe-agent`,
      mainEntityOfPage: `${SITE_URL}/blog/safe-agent`,
      image: `${SITE_URL}/og-image.svg`,
      datePublished: "2026-08-01T00:00:00.000Z",
      dateModified: "2026-08-02T00:00:00.000Z",
      author: {
        "@type": "Person",
        name: "Jinkun Wang",
        url: `${SITE_URL}/about`,
      },
      publisher: {
        "@type": "Person",
        name: "Jinkun Wang",
        url: SITE_URL,
      },
    });
  });

  it("serializes structured data without allowing a script breakout", () => {
    const serialized = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });

    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized)).toEqual({
      headline: "</script><script>alert(1)</script>",
    });
  });
});
