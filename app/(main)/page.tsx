import "./listing.css";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProjectStatus } from "@/components/ProjectStatus";
import { SpotlightSurfaces } from "@/components/SpotlightSurfaces";
import { ArticleLinkFeedback } from "@/components/ArticleLinkFeedback";
import {
  siteDefaults,
  type ContentCard,
  type Direction,
} from "@/content/siteDefaults";
import { getCurrentUser } from "@/lib/auth";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { summarizeExcerpt } from "@/lib/discovery";
import { articleTags } from "@/lib/articleDiscovery";
import { buildSeriesCollections } from "@/lib/blogSeries";
import {
  findArticleIndexForViewer,
  findHomeGlobalForViewer,
  findProjectsForViewer,
} from "@/lib/visitorContentCache";
import { formatSiteDate } from "@/lib/siteDate";

export const dynamic = "force-dynamic";

const researchLabels: Partial<Record<string, string>> = {
  数据工程: "Data Reliability",
  "AI 评测": "AI Evaluation",
  "Agent 系统": "Agent Harness",
};

export default async function Home() {
  const viewer = await getCurrentUser();
  const admin = viewer?.role === "admin";
  const [home, postsResult, projectsResult] = await Promise.all([
    findHomeGlobalForViewer(viewer),
    findArticleIndexForViewer(viewer),
    findProjectsForViewer(viewer),
  ]);

  const title = resolveText(home?.title, siteDefaults.identity.name);
  const role = resolveText(home?.role, siteDefaults.identity.role);
  const bio = resolveText(home?.bio, siteDefaults.identity.bio);
  const directions = resolveArray<Direction>(
    home?.directions,
    siteDefaults.home.directions,
  );
  const learningAreas = resolveArray<ContentCard>(
    home?.capabilities,
    siteDefaults.home.learningAreas,
  );
  const projects =
    projectsResult.docs.length > 0
      ? projectsResult.docs.map((project) => ({
          id: String(project.id),
          title: project.title,
          role: project.role,
          description: project.description,
          period: project.period,
          href: resolveText(project.href, "/projects"),
          tags: project.tags ?? [],
          highlights: project.highlights ?? [],
        }))
      : siteDefaults.projects;
  const featuredPost = postsResult.docs[0] ?? null;
  const recentPosts = postsResult.docs.slice(1, 4);
  const [featuredCollection] = buildSeriesCollections(postsResult.docs);

  return (
    <SpotlightSurfaces className="site-shell home-page">
      <header className="home-intro tech-grid-backdrop">
        <div>
          <p className="home-status animate-tech-in"><span aria-hidden="true" /> Online · Data &amp; AI Agent Engineering</p>
          <h1>{title}</h1>
          <p className="home-role">{role}</p>
          <p className="home-bio">{bio}</p>
        </div>
        <ol className="home-directions animate-tech-in" aria-label="当前研究方向">
          {directions.map(({ label }, index) => (
            <li key={label}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")} /</span>
              <span>{researchLabels[label] ?? label}</span>
            </li>
          ))}
        </ol>
      </header>

      <section className="home-lead grid-crosshair" aria-label="最新文章与专题">
        {featuredPost ? (
          <Link
            prefetch={false}
            className="group home-feature spotlight-card"
            href={`/blog/${featuredPost.slug}`}
          >
            <span className="home-feature-meta animate-tech-in">
              <span>Latest Dispatch</span>
              <time dateTime={featuredPost.publishedDate}>
                {formatSiteDate(featuredPost.publishedDate).replaceAll("-", ".")}
              </time>
              {featuredPost.readingTime && <span>{featuredPost.readingTime}</span>}
            </span>
            <h2>{featuredPost.title}</h2>
            <span className="home-feature-excerpt">
              {summarizeExcerpt(featuredPost.excerpt, 150)}
            </span>
            <span className="home-feature-bottom">
              <span className="home-log-tags">
                {articleTags(featuredPost.tags).slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
              </span>
              <ArticleLinkFeedback className="home-feature-action" iconSize={16} idleLabel="阅读全文" />
            </span>
          </Link>
        ) : (
          <div className="border-t-2 border-primary pt-5">
            <p className="text-sm leading-7 text-muted-foreground">
              这是一个持续更新的学习现场。文章记录理解，项目用来验证理解。
            </p>
            <Link prefetch={false} className="text-link mt-5" href="/blog">
              前往文章列表 →
            </Link>
          </div>
        )}
        <aside className="home-series spotlight-card">
          <p className="home-series-label animate-tech-in">
            Featured Track
            {featuredCollection && <span className="series-meter" aria-hidden="true"
              data-completed={featuredCollection.series.progress === "completed"}>
              <i /><i /><i /><i />
            </span>}
          </p>
          {featuredCollection ? (
            <>
              <h2>
                <Link
                  prefetch={false}
                  href={`/blog/series/${featuredCollection.series.slug}`}
                >
                  {featuredCollection.series.title}
                </Link>
              </h2>
              <p className="home-series-description">
                {featuredCollection.series.description}
              </p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                共 {featuredCollection.articles.length} 篇 · {featuredCollection.series.progress === "completed" ? "已完结" : "持续更新"}
              </p>
              <ol className="series-preview mt-3">
                {featuredCollection.articles.slice(0, 3).map((article, index) => (
                  <li key={article.id}>
                    <Link prefetch={false} href={`/blog/${article.slug}`}>
                      <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <span className="series-preview-title">{String(article.title)}</span>
                      <ArticleLinkFeedback compact iconSize={13} />
                    </Link>
                  </li>
                ))}
              </ol>
              <Link
                prefetch={false}
                className="text-link"
                href={`/blog/series/${featuredCollection.series.slug}`}
              >
                打开合集目录{" "}
                <ArrowUpRight className="ml-2" size={17} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <h2>从一篇笔记开始</h2>
              <p className="home-series-description">
                数据工程、AI 评测和 Agent 实践，都在文章里。
              </p>
              <Link prefetch={false} className="text-link" href="/blog">
                浏览全部文章 →
              </Link>
            </>
          )}
        </aside>
      </section>

      <section className="home-recent">
        <div className="section-heading">
          <h2 className="section-title">近期文章</h2>
          <Link prefetch={false} className="text-link" href="/blog">
            浏览全部文章 →
          </Link>
        </div>
        <div className="article-index-list">
          {recentPosts.length === 0 ? (
            <div className="py-10 text-sm leading-7 text-muted-foreground">
              {siteDefaults.blog.emptyMessage}
            </div>
          ) : (
            recentPosts.map((post) => (
              <Link
                prefetch={false}
                className="group home-log"
                href={`/blog/${post.slug}`}
                key={post.id}
              >
                <time dateTime={post.publishedDate}>
                  {formatSiteDate(post.publishedDate).replaceAll("-", ".")}
                </time>
                <span className="home-log-heading">
                  <span className="home-log-title">{post.title}</span>
                  <span className="home-log-tags">
                    {articleTags(post.tags).slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}
                  </span>
                </span>
                <span className="home-log-time">{post.readingTime}</span>
                <ArticleLinkFeedback className="home-log-arrow" compact iconSize={16} />
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="home-projects">
        <div className="section-heading">
          <h2 className="section-title">项目与实验</h2>
          <Link prefetch={false} className="text-link" href="/projects">
            查看全部项目 →
          </Link>
        </div>
        <div className="home-project-grid">
          {projects.slice(0, 2).map((project) => (
            <Link
              prefetch={false}
              className="group home-project spotlight-card"
              href={project.href}
              key={String(project.id)}
              target={project.href.startsWith("http") ? "_blank" : undefined}
              rel={project.href.startsWith("http") ? "noreferrer" : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <ProjectStatus period={project.period} />
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  size={18}
                />
              </div>
              <h3 className="mt-5 font-sans text-[1.65rem] font-semibold tracking-[-0.035em]">
                {project.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {project.description}
              </p>
              {project.highlights[0]?.text && (
                <p className="project-note">
                  {project.highlights[0].text}
                </p>
              )}
              <div className="mt-auto flex flex-wrap gap-x-3 gap-y-2 pt-6">
                {project.tags
                  ?.slice(0, 3)
                  .map((tag: { tag?: string | null }) => (
                    <span
                      className="font-mono text-[0.68rem] text-muted-foreground"
                      key={tag.tag ?? "tag"}
                    >
                      #{tag.tag}
                    </span>
                  ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-grid home-learning">
        <div>
          <h2 className="section-title">最近在学习</h2>
          {admin ? (
            <Link
              prefetch={false}
              className="text-link mt-4"
              href="/admin/globals/home"
            >
              管理最近学习 →
            </Link>
          ) : null}
        </div>
        <div className="divide-y divide-border border-y border-border">
          {learningAreas.map((area) => (
            <article
              className="grid gap-3 py-7 sm:grid-cols-[11rem_1fr]"
              key={area.title}
            >
              <h3 className="font-sans text-lg font-medium tracking-tight">
                {area.title}
              </h3>
              <p className="text-sm leading-7 text-muted-foreground">
                {area.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </SpotlightSurfaces>
  );
}
