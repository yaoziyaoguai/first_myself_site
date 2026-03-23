import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPayloadAPI } from "@/lib/payload";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { defaultJSXConverters } from "@payloadcms/richtext-lexical/react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: { status: { equals: "published" } },
    limit: 100,
  });
  return result.docs.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: { slug: { equals: slug } },
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
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: { slug: { equals: slug } },
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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
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
              <Badge key={t.tag} variant="secondary">
                {t.tag}
              </Badge>
            ))}
          </div>
        </header>

        <Separator className="my-8" />

        {/* Lexical 富文本内容 */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <RichText data={post.content as any} converters={defaultJSXConverters} />
        </div>

        <Separator className="my-12" />

        <footer>
          <Card className="bg-muted/50">
            <div className="p-6">
              <h3 className="font-semibold mb-2">关于作者</h3>
              <p className="text-sm text-muted-foreground">
                数据仓库工程师，专注于数据工程、数据架构与 AI 应用落地。
              </p>
            </div>
          </Card>
        </footer>
      </article>
    </div>
  );
}
