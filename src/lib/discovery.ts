import type { Metadata, MetadataRoute } from "next";
import { SITE_URL, siteDefaults } from "@/content/siteDefaults";

export { SITE_URL };

export type DiscoveryPost = {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  publishedDate?: unknown;
  updatedAt?: unknown;
  status?: unknown;
  visibility?: unknown;
};

type ArticleDiscoveryInput = {
  title: string;
  slug: string;
  description: string;
  publishedDate?: string | null;
  updatedAt?: string | null;
  imageUrl?: string | null;
  tags?: string[];
};

const MAIN_ROUTES = ["", "/about", "/projects", "/blog", "/contact"];

function isPublicPost(post: DiscoveryPost): boolean {
  return (
    post.status === "published" &&
    post.visibility === "public" &&
    typeof post.slug === "string" &&
    post.slug.trim().length > 0
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function articlePath(slug: string): string {
  return `/blog/${encodeURIComponent(slug)}`;
}

function articleImageUrl(value?: string | null): string {
  if (!value) return `${SITE_URL}/og-image.svg`;

  try {
    const image = new URL(value, SITE_URL);
    return image.protocol === "http:" || image.protocol === "https:"
      ? image.toString()
      : `${SITE_URL}/og-image.svg`;
  } catch {
    return `${SITE_URL}/og-image.svg`;
  }
}

export function buildArticleMetadata(
  input: ArticleDiscoveryInput,
): Metadata {
  const path = articlePath(input.slug);
  const shareTitle = `${input.title} | Jinkun Wang`;
  const image = articleImageUrl(input.imageUrl);

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle,
      description: input.description,
      type: "article",
      locale: "zh_CN",
      siteName: "Jinkun Wang",
      url: `${SITE_URL}${path}`,
      authors: [`${SITE_URL}/about`],
      ...(input.publishedDate ? { publishedTime: input.publishedDate } : {}),
      ...(input.updatedAt ? { modifiedTime: input.updatedAt } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
      images: [
        {
          url: image,
          alt: input.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: input.description,
      images: [image],
    },
  };
}

export function buildArticleJsonLd(input: ArticleDiscoveryInput) {
  const url = `${SITE_URL}${articlePath(input.slug)}`;
  const image = articleImageUrl(input.imageUrl);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    inLanguage: "zh-CN",
    url,
    mainEntityOfPage: url,
    image,
    ...(input.tags?.length ? { keywords: input.tags } : {}),
    ...(input.publishedDate ? { datePublished: input.publishedDate } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt } : {}),
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
  };
}

export function buildSiteJsonLd() {
  const personId = `${SITE_URL}/#person`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": personId,
        name: siteDefaults.identity.name,
        url: `${SITE_URL}/about`,
        description: siteDefaults.identity.bio,
        sameAs: ["https://github.com/yaoziyaoguai"],
        knowsAbout: siteDefaults.home.directions.map((item) => item.label),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Jinkun Wang",
        url: SITE_URL,
        description: siteDefaults.identity.bio,
        inLanguage: "zh-CN",
        author: { "@id": personId },
      },
    ],
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function summarizeExcerpt(value: unknown, limit = 180): string {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function buildSitemapEntries(
  posts: DiscoveryPost[],
): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = MAIN_ROUTES.map((path) => ({
    url: `${SITE_URL}${path || "/"}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/blog" ? 0.9 : 0.7,
  }));

  const postEntries: MetadataRoute.Sitemap = posts
    .filter(isPublicPost)
    .map((post) => ({
      url: `${SITE_URL}/blog/${encodeURIComponent(String(post.slug))}`,
      lastModified:
        typeof post.updatedAt === "string"
          ? new Date(post.updatedAt)
          : typeof post.publishedDate === "string"
            ? new Date(post.publishedDate)
          : undefined,
      changeFrequency: "monthly",
      priority: 0.8,
    }));

  return [...staticEntries, ...postEntries];
}

export function renderRssFeed(posts: DiscoveryPost[]): string {
  const items = posts
    .filter(isPublicPost)
    .map((post) => {
      const title = typeof post.title === "string" ? post.title : "未命名文章";
      const excerpt = summarizeExcerpt(post.excerpt);
      const link = `${SITE_URL}/blog/${encodeURIComponent(String(post.slug))}`;
      const date =
        typeof post.publishedDate === "string"
          ? new Date(post.publishedDate).toUTCString()
          : new Date(0).toUTCString();

      return [
        "    <item>",
        `      <title>${escapeXml(title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid>${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(excerpt)}</description>`,
        `      <pubDate>${escapeXml(date)}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>Jinkun Wang · 学习笔记</title>",
    `    <link>${SITE_URL}</link>`,
    "    <description>数据工程、AI 评测与 Agent 系统的学习记录。</description>",
    "    <language>zh-CN</language>",
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
