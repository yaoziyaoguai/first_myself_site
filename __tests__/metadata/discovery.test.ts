import { describe, expect, it } from "vitest";
import {
  buildArticleJsonLd,
  buildArticleMetadata,
  buildSiteJsonLd,
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
    updatedAt: "2026-08-03T12:30:00.000Z",
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
    expect(
      entries.find((entry) => entry.url.endsWith("/blog/agent-notes"))
        ?.lastModified,
    ).toEqual(new Date("2026-08-03T12:30:00.000Z"));
  });

  it("falls back to the publication date when an article has never been updated", () => {
    const entries = buildSitemapEntries([
      {
        ...posts[0],
        updatedAt: undefined,
      },
    ]);

    expect(entries.at(-1)?.lastModified).toEqual(
      new Date("2026-08-01T00:00:00.000Z"),
    );
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
      publishedDate: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      imageUrl: "/media/safe-agent-cover.png",
      tags: ["Agent", "Safety"],
    });

    expect(metadata.title).toBe("让 Agent 安全执行命令");
    expect(metadata.alternates).toEqual({ canonical: "/blog/safe-agent" });
    expect(metadata.openGraph).toMatchObject({
      title: "让 Agent 安全执行命令 | Jinkun Wang",
      url: `${SITE_URL}/blog/safe-agent`,
      type: "article",
      publishedTime: "2026-08-01T00:00:00.000Z",
      modifiedTime: "2026-08-02T00:00:00.000Z",
      authors: [`${SITE_URL}/about`],
      tags: ["Agent", "Safety"],
      images: [
        expect.objectContaining({
          url: `${SITE_URL}/media/safe-agent-cover.png`,
        }),
      ],
    });
  });

  it("falls back to the site share image for unsupported cover URLs", () => {
    const metadata = buildArticleMetadata({
      title: "安全封面",
      slug: "safe-cover",
      description: "一篇测试文章",
      imageUrl: "javascript:alert(1)",
    });

    expect(metadata.openGraph).toMatchObject({
      images: [expect.objectContaining({ url: `${SITE_URL}/og-image.svg` })],
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
        imageUrl: "/media/safe-agent-cover.png",
        tags: ["Agent", "Safety"],
      }),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "让 Agent 安全执行命令",
      description: "一篇测试文章",
      inLanguage: "zh-CN",
      url: `${SITE_URL}/blog/safe-agent`,
      mainEntityOfPage: `${SITE_URL}/blog/safe-agent`,
      image: `${SITE_URL}/media/safe-agent-cover.png`,
      keywords: ["Agent", "Safety"],
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
      isPartOf: {
        "@type": "WebSite",
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

  it("describes the site and its author as one connected structured-data graph", () => {
    expect(buildSiteJsonLd()).toMatchObject({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Person",
          "@id": `${SITE_URL}/#person`,
          name: "Jinkun Wang",
          url: `${SITE_URL}/about`,
          sameAs: ["https://github.com/yaoziyaoguai"],
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          url: SITE_URL,
          inLanguage: "zh-CN",
          author: { "@id": `${SITE_URL}/#person` },
        },
      ],
    });
  });
});
