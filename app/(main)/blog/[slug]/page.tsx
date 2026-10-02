import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { cache, type ComponentProps } from "react";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { canUsePublicInteractions } from "@/lib/blogVisibility";
import {
  findBlogPostBySlugForViewer,
  findBlogPostsForViewer,
} from "@/lib/visitorContentCache";
import { RichText } from "@payloadcms/richtext-lexical/react";
import { defaultJSXConverters } from "@payloadcms/richtext-lexical/react";
import { CommentSection } from "@/components/CommentSection";
import { LikeButton } from "@/components/LikeButton";
import { MarkdownArticle } from "@/components/MarkdownArticle";
import { ArticleReadingNav } from "@/components/ArticleReadingNav";
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

// generateMetadata 与页面组件在同一次渲染中都会读取文章。只用稳定的 slug
// 作为 cache key，认证信息在函数内部读取，避免 viewer 对象引用导致去重失效。
const getArticlePageData = cache(async (decodedSlug: string) => {
  const viewer = await getCurrentUser();
  const post = await findBlogPostBySlugForViewer(viewer, decodedSlug);
  return { viewer, post };
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  // metadata 同样要按登录态决定 where：作者本人访问 private 文章时，
  // 应该拿到真实标题/摘要，而不是「文章未找到」。
  const { post } = await getArticlePageData(decodedSlug);

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
  const { viewer, post } = await getArticlePageData(decodedSlug);

  if (!post) {
    notFound();
  }

  // 检查是否为 Admin
  const admin = viewer?.role === "admin";
  const editUrl =
    admin && post.id ? `/admin/collections/blog/${post.id}` : null;

  const tags = (post.tags as { tag: string }[] | undefined) || [];
  const dateStr = post.publishedDate ? formatSiteDate(post.publishedDate) : "";
  const showPublicInteractions = canUsePublicInteractions(post.visibility);
  const markdownContent =
    typeof post.contentMarkdown === "string" ? post.contentMarkdown.trim() : "";
  const showBlogAgent = Boolean(
    showPublicInteractions && markdownContent && canShowBlogAgent(),
  );
  const series = populatedSeries(post.series);
  const seriesArticles = series
    ? sortSeriesArticles(
        (
          await findBlogPostsForViewer(viewer, {
            limit: 100,
            depth: 0,
            seriesId: series.id,
          })
        ).docs as unknown as SeriesArticle[],
      )
    : [];
  const seriesIndex = seriesArticles.findIndex(
    (article) => String(article.id) === String(post.id),
  );
  const previousArticle =
    seriesIndex > 0 ? seriesArticles[seriesIndex - 1] : null;
  const nextArticle =
    seriesIndex >= 0 && seriesIndex < seriesArticles.length - 1
      ? seriesArticles[seriesIndex + 1]
      : null;
  const relatedArticles = series
    ? []
    : (
        await findBlogPostsForViewer(viewer, {
          limit: 4,
          depth: 0,
          sort: "-publishedDate",
        })
      ).docs
        .filter((article) => String(article.id) !== String(post.id))
        .slice(0, 3);
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
      <article id="blog-article-top" className="article-page">
        <HashAnchorScroller />
        <Link prefetch={false} href="/blog" className="text-link article-back">
          ← 返回文章列表
        </Link>

        <header className="reading-header">
          {series ? (
            <Link
              prefetch={false}
              className="article-series-link"
              href={`/blog/series/${series.slug}`}
            >
              {series.title}
              {seriesIndex >= 0 ? ` · 第 ${seriesIndex + 1} 篇` : ""}
            </Link>
          ) : null}
          <div className="flex items-start justify-between gap-4">
            <h1>{post.title}</h1>
            {editUrl && (
              <a
                href={editUrl}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-4 text-sm transition-colors hover:bg-accent"
              >
                <span>编辑</span>
              </a>
            )}
          </div>
          {post.excerpt ? <p className="reading-deck">{post.excerpt}</p> : null}
          <div className="article-meta">
            <time dateTime={post.publishedDate}>{dateStr}</time>
            {post.readingTime ? <span>{post.readingTime}</span> : null}
            {showPublicInteractions ? (
              <LikeButton
                targetId={String(post.id)}
                targetType="blog"
                size="sm"
              />
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <div key={t.tag} className="topic-pill">
                {t.tag}
              </div>
            ))}
          </div>
        </header>

        <div className="reader-layout">
          <ArticleReadingNav
            key={String(post.slug)}
            articleSlug={String(post.slug)}
          />
          <div className="reader-main">
            {series ? (
              <details className="article-series-directory">
                <summary className="cursor-pointer py-5 text-sm leading-7">
                  <span className="font-medium">合集目录：{series.title}</span>
                  <span className="ml-3 text-muted-foreground">
                    第 {seriesIndex + 1} / {seriesArticles.length} 篇
                  </span>
                </summary>
                <nav
                  aria-label="合集文章目录"
                  className="border-t border-border py-3"
                >
                  <ol>
                    {seriesArticles.map((article, index) => (
                      <li key={article.id}>
                        <Link
                          prefetch={false}
                          href={`/blog/${String(article.slug)}`}
                          aria-current={
                            index === seriesIndex ? "page" : undefined
                          }
                          className={`flex min-h-11 items-start gap-3 py-3 text-sm leading-6 hover:text-primary ${index === seriesIndex ? "font-medium text-primary" : "text-muted-foreground"}`}
                        >
                          <span className="shrink-0 font-mono">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span>
                            {String(article.title)}
                            {index === seriesIndex ? "（正在阅读）" : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                  <Link
                    prefetch={false}
                    className="text-link mt-2"
                    href={`/blog/series/${series.slug}`}
                  >
                    查看合集介绍 →
                  </Link>
                </nav>
              </details>
            ) : null}

            {/* 文章内容渲染 - 优先使用 Markdown，回退到 RichText */}
            <div id="article-content" className="prose prose-neutral">
              {markdownContent ? (
                <MarkdownArticle
                  markdown={markdownContent}
                  title={String(post.title)}
                />
              ) : (
                <RichText
                  data={post.content as ComponentProps<typeof RichText>["data"]}
                  converters={defaultJSXConverters}
                />
              )}
            </div>

            <div className="mx-auto my-14 h-px max-w-[46rem] bg-border" />

            {series ? (
              <nav
                aria-label={`${series.title}合集导航`}
                className="mx-auto mb-12 max-w-[46rem]"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <Link
                    prefetch={false}
                    className="text-sm font-medium text-primary"
                    href={`/blog/series/${series.slug}`}
                  >
                    查看合集
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {seriesIndex + 1} / {seriesArticles.length}
                  </span>
                </div>
                {previousArticle || nextArticle ? (
                  <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
                    {previousArticle ? (
                      <Link
                        prefetch={false}
                        className="bg-card p-5 transition-colors hover:bg-accent/45"
                        href={`/blog/${String(previousArticle.slug)}`}
                      >
                        <span className="block text-xs text-muted-foreground">
                          上一篇
                        </span>
                        <span className="mt-2 block text-sm font-medium leading-6">
                          {String(previousArticle.title ?? "未命名文章")}
                        </span>
                      </Link>
                    ) : (
                      <span className="hidden bg-card sm:block" />
                    )}
                    {nextArticle ? (
                      <Link
                        prefetch={false}
                        className="bg-card p-5 text-right transition-colors hover:bg-accent/45"
                        href={`/blog/${String(nextArticle.slug)}`}
                      >
                        <span className="block text-xs text-muted-foreground">
                          下一篇
                        </span>
                        <span className="mt-2 block text-sm font-medium leading-6">
                          {String(nextArticle.title ?? "未命名文章")}
                        </span>
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {!nextArticle ? (
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    已读到合集当前最后一篇。
                    <Link
                      prefetch={false}
                      className="text-primary underline underline-offset-4"
                      href="/blog"
                    >
                      看看其他文章 →
                    </Link>
                  </p>
                ) : null}
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
                  <CommentSection
                    targetId={String(post.id)}
                    targetType="blog"
                  />
                </div>
              ) : null}

              <aside className="mt-14 grid gap-4 border-y border-border py-7 sm:grid-cols-[8rem_1fr]">
                <h2 className="font-serif text-lg font-medium">关于作者</h2>
                <p className="text-sm leading-7 text-muted-foreground">
                  {siteDefaults.identity.role}{" "}
                  这里记录学习过程、项目实验与尚未解决的问题。
                </p>
              </aside>
            </div>

            {relatedArticles.length > 0 ? (
              <section
                aria-labelledby="related-heading"
                className="mx-auto mt-16 max-w-[52rem] border-t border-border pt-8 md:mt-20"
              >
                <div className="mb-2 flex items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow">KEEP READING</p>
                    <h2
                      className="mt-3 font-serif text-2xl font-medium"
                      id="related-heading"
                    >
                      继续阅读
                    </h2>
                  </div>
                  <Link prefetch={false} className="text-link" href="/blog">
                    全部文章
                  </Link>
                </div>
                <div>
                  {relatedArticles.map((article) => (
                    <Link
                      prefetch={false}
                      className="group grid gap-3 border-b border-border py-6 sm:grid-cols-[1fr_auto]"
                      href={`/blog/${article.slug}`}
                      key={article.id}
                    >
                      <span>
                        <span className="block font-serif text-xl font-medium leading-snug transition-colors duration-200 group-hover:text-primary">
                          {article.title}
                        </span>
                        <span className="mt-2 block text-sm text-muted-foreground">
                          {article.readingTime}
                        </span>
                      </span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:block"
                        size={18}
                      />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
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
