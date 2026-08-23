import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteDefaults } from "@/content/siteDefaults";
import { getCurrentUser } from "@/lib/auth";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";
import { summarizeExcerpt } from "@/lib/discovery";
import { getPayloadAPI } from "@/lib/payload";
import { formatSiteDate } from "@/lib/siteDate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "文章",
  description: siteDefaults.blog.description,
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const viewer = await getCurrentUser();
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: buildBlogFrontendWhere(viewer),
    sort: "-publishedDate",
    limit: 50,
  });

  return (
    <div className="site-shell page-space">
      <header className="page-header">
        <p className="eyebrow">NOTES</p>
        <h1>写下来，才能看见理解的边界。</h1>
        <p>{siteDefaults.blog.description}</p>
      </header>

      {result.docs.length === 0 ? (
        <div className="empty-state">{siteDefaults.blog.emptyMessage}</div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {result.docs.map((post, index) => {
            const tags = post.tags ?? [];
            return (
              <Link
                className="group grid gap-5 py-9 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:py-11"
                href={`/blog/${post.slug}`}
                key={post.id}
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-2xl font-semibold tracking-[-0.02em] transition-colors group-hover:text-primary">
                    {post.title}
                  </span>
                  <span className="mt-3 block max-w-3xl text-sm leading-7 text-muted-foreground">
                    {summarizeExcerpt(post.excerpt, 170)}
                  </span>
                  <span className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                    <time>
                      {post.publishedDate
                        ? formatSiteDate(post.publishedDate)
                        : ""}
                    </time>
                    {post.readingTime ? <span>{post.readingTime}</span> : null}
                    {tags.map((tag: { tag?: string | null }) => (
                      <span key={tag.tag ?? "tag"}>#{tag.tag}</span>
                    ))}
                  </span>
                </span>
                <ArrowUpRight aria-hidden="true" className="hidden md:block" size={19} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
