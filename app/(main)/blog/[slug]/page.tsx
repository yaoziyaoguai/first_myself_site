import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPayloadAPI } from "@/lib/payload";
import { isAdmin } from "@/lib/auth";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { defaultJSXConverters } from "@payloadcms/richtext-lexical/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CommentSection } from "@/components/CommentSection";
import { LikeButton } from "@/components/LikeButton";
import { ShareActions } from "@/components/ShareActions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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

  // 站点默认描述
  const defaultDescription = "个人项目、博客与技术思考，聚焦数据工程、AI 与软件架构。";
  // 使用文章摘要，缺失时回退到默认描述
  const description = post?.excerpt || defaultDescription;

  if (!post) {
    return {
      title: "文章未找到",
      description: defaultDescription,
    };
  }

  return {
    title: `${post.title} | Jinkun Wang`,
    description,
    openGraph: {
      title: `${post.title} | Jinkun Wang`,
      description,
      type: "article",
      locale: "zh_CN",
      siteName: "Jinkun Wang",
      images: [
        {
          url: "https://wangjinkun333.me/og-image.svg",
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | Jinkun Wang`,
      description,
      images: ["https://wangjinkun333.me/og-image.svg"],
    },
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

  // 检查是否为 Admin
  const admin = await isAdmin();
  const editUrl = admin && post.id ? `/admin/collections/blog/${post.id}` : null;

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
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-4xl md:text-5xl font-medium mb-4" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>{post.title}</h1>
            {editUrl && (
              <a
                href={editUrl}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-md bg-muted hover:bg-accent transition-colors shrink-0"
              >
                <span>编辑</span>
              </a>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span>{dateStr}</span>
            {post.readingTime && (
              <>
                <span>·</span>
                <span>{post.readingTime}</span>
              </>
            )}
            <span>·</span>
            <LikeButton targetId={String(post.id)} targetType="blog" size="sm" />
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

        {/* 文章内容渲染 - 优先使用 Markdown，回退到 RichText */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {(() => {
            const markdownContent =
              typeof post.contentMarkdown === "string"
                ? post.contentMarkdown.trim()
                : "";

            if (markdownContent) {
              return (
                <Markdown remarkPlugins={[remarkGfm]}>
                  {markdownContent}
                </Markdown>
              );
            }

            return (
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              <RichText data={post.content as any} converters={defaultJSXConverters} />
            );
          })()}
        </div>

        <div className="h-px bg-border my-12" />

        {/* 分享区域 */}
        <ShareActions
          url={`https://wangjinkun333.me/blog/${post.slug}`}
          title={post.title}
          summary={post.excerpt}
        />

        <footer>
          <div className="border border-border rounded-lg p-6 bg-muted">
            <h3 className="font-medium mb-2">关于作者</h3>
            <p className="text-sm text-muted-foreground">
              数据仓库工程师，专注于数据工程、数据架构与 AI 应用落地。
            </p>
          </div>
        </footer>

        <div className="mt-12">
          <CommentSection targetId={String(post.id)} targetType="blog" />
        </div>
      </article>
    </div>
  );
}
