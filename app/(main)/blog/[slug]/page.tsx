import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPayloadAPI } from "@/lib/payload";
import { isAdmin, getCurrentUser } from "@/lib/auth";
import {
  buildBlogFrontendWhere,
  canUsePublicInteractions,
} from "@/lib/blogVisibility";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { defaultJSXConverters } from "@payloadcms/richtext-lexical/react";
import { CommentSection } from "@/components/CommentSection";
import { LikeButton } from "@/components/LikeButton";
import { MarkdownArticle } from "@/components/MarkdownArticle";
import { BlogAgent } from "@/components/blog-agent/BlogAgent";
import { ShareActions } from "@/components/ShareActions";
import { SITE_URL, siteDefaults } from "@/content/siteDefaults";
import { canShowBlogAgent } from "@/lib/blog-agent/config";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  // metadata 同样要按登录态决定 where：作者本人访问 private 文章时，
  // 应该拿到真实标题/摘要，而不是「文章未找到」。
  const viewer = await getCurrentUser();
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      ...buildBlogFrontendWhere(viewer),
      slug: { equals: decodedSlug },
    },
    limit: 1,
  });
  const post = result.docs[0];

  // 站点默认描述
  const defaultDescription = siteDefaults.blog.description;
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
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} | Jinkun Wang`,
      description,
      type: "article",
      locale: "zh_CN",
      siteName: "Jinkun Wang",
      images: [
        {
          url: `${SITE_URL}/og-image.svg`,
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
      images: [`${SITE_URL}/og-image.svg`],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  // 详情页同样基于登录态构造可见性过滤：
  // - 未登录 / 普通用户：只能直接访问 published + public 的文章，private 一律 404
  // - admin / editor：可以直接访问 published 的 private 文章
  // 草稿（status != published）即使是作者也不在前台展示，符合 publish 工作流；
  // 后台编辑入口在 admin UI（下方 editUrl 提供快捷跳转）。
  const viewer = await getCurrentUser();
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      ...buildBlogFrontendWhere(viewer),
      slug: { equals: decodedSlug },
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
  const showPublicInteractions = canUsePublicInteractions(post.visibility);
  const markdownContent =
    typeof post.contentMarkdown === "string"
      ? post.contentMarkdown.trim()
      : "";
  const showBlogAgent = Boolean(
    showPublicInteractions &&
    markdownContent &&
    canShowBlogAgent(),
  );

  return (
    <div className="site-shell page-space">
      <article id="blog-article-top" className="mx-auto max-w-[46rem]">
        <Link
          href="/blog"
          className="text-link mb-10"
        >
          ← 返回博客列表
        </Link>

        <header className="mb-10">
          <p className="eyebrow mb-6">ARTICLE</p>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] md:text-6xl">{post.title}</h1>
            {editUrl && (
              <a
                href={editUrl}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-4 text-sm transition-colors hover:bg-accent"
              >
                <span>编辑</span>
              </a>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>{dateStr}</span>
            {post.readingTime && (
              <>
                <span>·</span>
                <span>{post.readingTime}</span>
              </>
            )}
            {showPublicInteractions && (
              <>
                <span>·</span>
                <LikeButton targetId={String(post.id)} targetType="blog" size="sm" />
              </>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <div key={t.tag} className="topic-pill">
                {t.tag}
              </div>
            ))}
          </div>
        </header>

        <div className="my-10 h-px bg-border" />

        {/* 文章内容渲染 - 优先使用 Markdown，回退到 RichText */}
        <div className="prose prose-neutral max-w-none">
          {markdownContent ? (
            <MarkdownArticle
              markdown={markdownContent}
              title={String(post.title)}
            />
          ) : (
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            <RichText data={post.content as any} converters={defaultJSXConverters} />
          )}
        </div>

        <div className="h-px bg-border my-12" />

        {/* 分享区域 */}
        <ShareActions
          url={`${SITE_URL}/blog/${post.slug}`}
          title={post.title}
          summary={post.excerpt}
        />

        {/* 评论区 */}
        {showPublicInteractions && (
          <div className="mt-8">
            <CommentSection targetId={String(post.id)} targetType="blog" />
          </div>
        )}

        {/* 关于作者 */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="rounded-2xl border border-border bg-card p-7">
            <h3 className="mb-2 font-medium">关于作者</h3>
            <p className="text-sm leading-7 text-muted-foreground">
              {siteDefaults.identity.role} 这里记录学习过程、项目实验与尚未解决的问题。
            </p>
          </div>
        </div>
      </article>
      {showBlogAgent && (
        <BlogAgent
          articleSlug={String(post.slug)}
          articleTitle={String(post.title)}
        />
      )}
    </div>
  );
}
