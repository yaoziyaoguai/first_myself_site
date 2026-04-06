import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPayloadAPI } from "@/lib/payload";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { defaultJSXConverters } from "@payloadcms/richtext-lexical/react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      slug: { equals: decodedSlug },
      status: { equals: "published" },
      visibility: { equals: "public" },
    },
    limit: 1,
  });
  const post = result.docs[0];
  if (!post) return { title: "文章未找到" };
  return {
    title: `${post.title} - DWEngineer`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      slug: { equals: decodedSlug },
      status: { equals: "published" },
      visibility: { equals: "public" },
    },
    limit: 1,
  });
  const post = result.docs[0];

  if (!post) {
    notFound();
  }

  const tags = (post.tags as { tag: string }[] | undefined) || [];
  const dateStr = post.publishedDate
    ? new Date(post.publishedDate).toISOString().split("T")[0]
    : "";

  return (
    <div className="container mx-auto px-4 py-12">
      <article className="max-w-3xl mx-auto">
        <Link
          href="/blog"
          className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block"
        >
          ← 返回博客列表
        </Link>

        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-medium mb-4" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span>{dateStr}</span>
            {post.readingTime && (
              <>
                <span>·</span>
                <span>{post.readingTime}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <div key={t.tag} className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium border border-border">
                {t.tag}
              </div>
            ))}
          </div>
        </header>

        <div className="h-px bg-border my-8" />

        {/* Lexical 富文本内容 */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <RichText data={post.content as any} converters={defaultJSXConverters} />
        </div>

        <div className="h-px bg-border my-12" />

        <footer>
          <div className="border border-border rounded-lg p-6 bg-muted">
            <h3 className="font-medium mb-2">关于作者</h3>
            <p className="text-sm text-muted-foreground">
              数据仓库工程师，专注于数据工程、数据架构与 AI 应用落地。
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
