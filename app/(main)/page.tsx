import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteDefaults, type ContentCard, type Direction } from "@/content/siteDefaults";
import { isAdmin } from "@/lib/auth";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";
import { resolveArray, resolveText } from "@/lib/contentFallback";
import { summarizeExcerpt } from "@/lib/discovery";
import { getPayloadAPI } from "@/lib/payload";
import { formatSiteDate } from "@/lib/siteDate";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getPayloadAPI();
  const [home, postsResult, projectsResult, admin] = await Promise.all([
    payload.findGlobal({ slug: "home" }),
    payload.find({
      collection: "blog",
      where: buildBlogFrontendWhere(null),
      sort: "-publishedDate",
      limit: 3,
      depth: 0,
    }),
    payload.find({ collection: "projects", sort: "sortOrder", limit: 2 }),
    isAdmin(),
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
          href: resolveText(project.href, "/projects"),
          tags: project.tags ?? [],
        }))
      : siteDefaults.projects;

  return (
    <div className="site-shell pb-24 pt-10 md:pt-16">
      <section className="grid gap-12 border-b border-border pb-16 md:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.55fr)] md:items-end md:pb-24">
        <div>
          <p className="eyebrow">DATA · EVALUATION · AGENTS</p>
          <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl md:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-balance text-xl leading-relaxed text-foreground/85 md:text-2xl">
            {role}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            {bio}
          </p>
          <div className="mt-8 flex flex-wrap gap-2" aria-label="当前学习方向">
            {directions.map((item) => (
              <span className="topic-pill" key={item.label}>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="border-l-2 border-primary pl-6">
          <p className="text-sm leading-6 text-muted-foreground">
            这是一个持续更新的学习现场。文章记录理解，项目用来验证理解。
          </p>
          <div className="mt-6 flex flex-col items-start gap-3">
            <Link className="primary-link" href="/blog">
              阅读最近文章 <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
            <Link className="text-link" href="/projects">
              看看正在做的项目
            </Link>
          </div>
        </div>
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">01</p>
          <h2 className="section-title">最近在学习</h2>
          {admin ? (
            <Link className="text-link mt-4" href="/admin/globals/home">
              管理最近学习 →
            </Link>
          ) : null}
        </div>
        <div className="divide-y divide-border border-y border-border">
          {learningAreas.map((area) => (
            <article className="grid gap-3 py-7 sm:grid-cols-[11rem_1fr]" key={area.title}>
              <h3 className="font-medium tracking-tight">{area.title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{area.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">02</p>
          <h2 className="section-title">项目与实验</h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          {projects.slice(0, 2).map((project) => (
            <Link
              className="group flex min-h-64 flex-col bg-card p-7 transition-colors hover:bg-muted"
              href={project.href}
              key={String(project.id)}
              target={project.href.startsWith("http") ? "_blank" : undefined}
              rel={project.href.startsWith("http") ? "noreferrer" : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {project.role}
                </p>
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  size={18}
                />
              </div>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight">{project.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{project.description}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-8">
                {project.tags?.slice(0, 3).map((tag: { tag?: string | null }) => (
                  <span className="text-xs text-muted-foreground" key={tag.tag ?? "tag"}>
                    #{tag.tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">03</p>
          <h2 className="section-title">最近文章</h2>
        </div>
        <div>
          {postsResult.docs.length === 0 ? (
            <div className="empty-state">{siteDefaults.blog.emptyMessage}</div>
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {postsResult.docs.map((post) => (
                <Link
                  className="group grid gap-3 py-7 sm:grid-cols-[8rem_1fr_auto] sm:items-start"
                  href={`/blog/${post.slug}`}
                  key={post.id}
                >
                  <time className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {post.publishedDate
                      ? formatSiteDate(post.publishedDate)
                      : ""}
                  </time>
                  <span>
                    <span className="block text-lg font-medium tracking-tight transition-colors group-hover:text-primary">
                      {post.title}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                      {summarizeExcerpt(post.excerpt, 120)}
                    </span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="hidden sm:block" size={18} />
                </Link>
              ))}
            </div>
          )}
          <Link className="text-link mt-6" href="/blog">
            查看全部文章 →
          </Link>
        </div>
      </section>
    </div>
  );
}
