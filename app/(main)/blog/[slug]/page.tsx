import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
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
import { HashAnchorScroller } from "@/components/HashAnchorScroller";
import { SITE_URL, siteDefaults } from "@/content/siteDefaults";
import { canShowBlogAgent } from "@/lib/blog-agent/config";
import { formatSiteDate } from "@/lib/siteDate";
import {
  buildArticleJsonLd,
  buildArticleMetadata,
  serializeJsonLd,
} from "@/lib/discovery";
import {
  populatedSeries,
  sortSeriesArticles,
  type SeriesArticle,
} from "@/lib/blogSeries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function readCoverImageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const url = (value as { url?: unknown }).url;
  return typeof url === "string" && url.trim() ? url : null;
}

function readArticleTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const tag = (item as { tag?: unknown }).tag;
    return typeof tag === "string" && tag.trim() ? [tag.trim()] : [];
  });
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

  return buildArticleMetadata({
    title: post.title,
    slug: post.slug,
    description,
    publishedDate: post.publishedDate,
    updatedAt: post.updatedAt,
    imageUrl: readCoverImageUrl(post.coverImage),
    tags: readArticleTags(post.tags),
  });
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
    ? formatSiteDate(post.publishedDate)
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
  const series = populatedSeries(post.series);
  const seriesArticles = series
    ? sortSeriesArticles(
        (
          await payload.find({
            collection: "blog",
            where: {
              ...buildBlogFrontendWhere(viewer),
              series: { equals: series.id },
            },
            limit: 100,
            depth: 0,
          })
        ).docs as unknown as SeriesArticle[],
      )
    : [];
  const seriesIndex = seriesArticles.findIndex(
    (article) => String(article.id) === String(post.id),
  );
  const previousArticle = seriesIndex > 0 ? seriesArticles[seriesIndex - 1] : null;
  const nextArticle =
    seriesIndex >= 0 && seriesIndex < seriesArticles.length - 1
      ? seriesArticles[seriesIndex + 1]
      : null;
  const relatedArticles = series
    ? []
    : (
        await payload.find({
          collection: "blog",
          where: buildBlogFrontendWhere(viewer),
          sort: "-publishedDate",
          limit: 4,
          depth: 0,
        })
      ).docs.filter((article) => String(article.id) !== String(post.id)).slice(0, 3);
  const articleJsonLd = buildArticleJsonLd({
    title: post.title,
    slug: post.slug,
    description: post.excerpt || siteDefaults.blog.description,
    publishedDate: post.publishedDate,
    updatedAt: post.updatedAt,
    imageUrl: readCoverImageUrl(post.coverImage),
    tags: readArticleTags(post.tags),
  });

  return (
    <div className="site-shell page-space">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
      />
      <article id="blog-article-top" className="mx-auto max-w-[64rem]">
        <HashAnchorScroller />
        <Link href="/blog" className="text-link mb-8 md:mb-12">
          ← 返回文章列表
        </Link>

        <header className="max-w-[58rem]">
          <p className="eyebrow mb-6">ARTICLE / 技术实践</p>
          {series ? (
            <Link
              className="mb-5 inline-flex min-h-8 items-center rounded-full border border-primary/25 bg-accent/55 px-3 text-xs font-medium text-primary"
              href={`/blog/series/${series.slug}`}
            >
              {series.title}
              {seriesIndex >= 0 ? ` · 第 ${seriesIndex + 1} 篇` : ""}
            </Link>
          ) : null}
          <div className="flex items-start justify-between gap-4">
            <h1 className="max-w-[56rem] text-balance font-serif text-[2.8rem] font-medium leading-[1.08] tracking-[-0.04em] sm:text-5xl md:text-[3.5rem] lg:text-[4.25rem]">
              {post.title}
            </h1>
            {editUrl && (
              <a
                href={editUrl}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-4 text-sm transition-colors hover:bg-accent"
              >
                <span>编辑</span>
              </a>
            )}
          </div>
          {post.excerpt ? (
            <p className="mt-7 max-w-[48rem] text-pretty font-serif text-xl leading-9 text-foreground/75 md:text-2xl md:leading-10">
              {post.excerpt}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-5 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
            <time>{dateStr}</time>
            {post.readingTime ? <span>{post.readingTime}</span> : null}
            {showPublicInteractions ? (
              <LikeButton targetId={String(post.id)} targetType="blog" size="sm" />
            ) : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <div key={t.tag} className="topic-pill">
                {t.tag}
              </div>
            ))}
          </div>
        </header>

        <div className="my-10 h-px bg-border md:my-14" />

        {/* 文章内容渲染 - 优先使用 Markdown，回退到 RichText */}
        <div className="prose prose-neutral mx-auto max-w-[46rem]">
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

        <div className="mx-auto my-14 h-px max-w-[46rem] bg-border" />

        {series && (previousArticle || nextArticle) ? (
          <nav aria-label={`${series.title}合集导航`} className="mx-auto mb-12 max-w-[46rem]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <Link className="text-sm font-medium text-primary" href={`/blog/series/${series.slug}`}>
                查看合集
              </Link>
              <span className="font-mono text-xs text-muted-foreground">
                {seriesIndex + 1} / {seriesArticles.length}
              </span>
            </div>
            <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
              {previousArticle ? (
                <Link className="bg-card p-5 transition-colors hover:bg-accent/45" href={`/blog/${String(previousArticle.slug)}`}>
                  <span className="block text-xs text-muted-foreground">上一篇</span>
                  <span className="mt-2 block text-sm font-medium leading-6">
                    {String(previousArticle.title ?? "未命名文章")}
                  </span>
                </Link>
              ) : (
                <span className="hidden bg-card sm:block" />
              )}
              {nextArticle ? (
                <Link className="bg-card p-5 text-right transition-colors hover:bg-accent/45" href={`/blog/${String(nextArticle.slug)}`}>
                  <span className="block text-xs text-muted-foreground">下一篇</span>
                  <span className="mt-2 block text-sm font-medium leading-6">
                    {String(nextArticle.title ?? "未命名文章")}
                  </span>
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}

        <div className="mx-auto max-w-[46rem]">
          <ShareActions
            url={`${SITE_URL}/blog/${post.slug}`}
            title={post.title}
            summary={post.excerpt}
          />

          {showPublicInteractions ? (
            <div className="mt-10">
              <CommentSection targetId={String(post.id)} targetType="blog" />
            </div>
          ) : null}

          <aside className="mt-14 grid gap-4 border-y border-border py-7 sm:grid-cols-[8rem_1fr]">
            <h2 className="font-serif text-lg font-medium">关于作者</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {siteDefaults.identity.role} 这里记录学习过程、项目实验与尚未解决的问题。
            </p>
          </aside>
        </div>

        {relatedArticles.length > 0 ? (
          <section aria-labelledby="related-heading" className="mx-auto mt-16 max-w-[52rem] border-t border-border pt-8 md:mt-20">
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">KEEP READING</p>
                <h2 className="mt-3 font-serif text-2xl font-medium" id="related-heading">继续阅读</h2>
              </div>
              <Link className="text-link" href="/blog">全部文章</Link>
            </div>
            <div>
              {relatedArticles.map((article) => (
                <Link className="group grid gap-3 border-b border-border py-6 sm:grid-cols-[1fr_auto]" href={`/blog/${article.slug}`} key={article.id}>
                  <span>
                    <span className="block font-serif text-xl font-medium leading-snug transition-colors duration-200 group-hover:text-primary">{article.title}</span>
                    <span className="mt-2 block text-sm text-muted-foreground">{article.readingTime}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block" size={18} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>
      {showBlogAgent && (
        <BlogAgent
          key={String(post.slug)}
          articleSlug={String(post.slug)}
          articleTitle={String(post.title)}
        />
      )}
    </div>
  );
}
