import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/siteDefaults";

export { SITE_URL };

export type DiscoveryPost = {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  publishedDate?: unknown;
  status?: unknown;
  visibility?: unknown;
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
        typeof post.publishedDate === "string"
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
