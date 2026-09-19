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
      limit: 4,
      depth: 0,
    }),
    payload.find({ collection: "projects", sort: "sortOrder", limit: 4 }),
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
          period: project.period,
          href: resolveText(project.href, "/projects"),
          tags: project.tags ?? [],
        }))
      : siteDefaults.projects;
  const featuredPost = postsResult.docs[0] ?? null;
  const recentPosts = postsResult.docs.slice(1);

  return (
    <div className="site-shell pb-24 pt-8 md:pb-32 md:pt-14">
      <section className="grid gap-12 border-b border-border pb-14 md:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)] md:items-end md:gap-16 md:pb-20">
        <div>
          <p className="eyebrow">DATA · EVALUATION · AGENTS</p>
          <h1 className="mt-7 max-w-4xl text-balance font-serif text-[3.3rem] font-medium leading-[0.96] tracking-[-0.045em] sm:text-6xl md:text-[5.2rem]">
            {title}
          </h1>
          <p className="mt-7 max-w-3xl text-pretty text-xl leading-relaxed text-foreground/90 md:text-2xl">
            {role}
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
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

        {featuredPost ? (
          <Link className="group border-t-2 border-primary pb-1 pt-5" href={`/blog/${featuredPost.slug}`}>
            <span className="flex items-center justify-between gap-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Latest note</span>
              <time>{featuredPost.publishedDate ? formatSiteDate(featuredPost.publishedDate) : ""}</time>
            </span>
            <span className="mt-7 block text-pretty font-serif text-[2rem] font-medium leading-[1.15] tracking-[-0.025em] transition-colors duration-200 group-hover:text-primary md:text-[2.45rem]">
              {featuredPost.title}
            </span>
            <span className="mt-4 block text-sm leading-7 text-muted-foreground">
              {summarizeExcerpt(featuredPost.excerpt, 150)}
            </span>
            <span className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary">
              阅读这篇文章 <ArrowUpRight aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={17} />
            </span>
          </Link>
        ) : (
          <div className="border-t-2 border-primary pt-5">
            <p className="text-sm leading-7 text-muted-foreground">这是一个持续更新的学习现场。文章记录理解，项目用来验证理解。</p>
            <Link className="text-link mt-5" href="/blog">前往文章列表 →</Link>
          </div>
        )}
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">01</p>
          <h2 className="section-title">近期文章</h2>
          <Link className="text-link mt-4" href="/blog">浏览全部文章 →</Link>
        </div>
        <div className="border-y border-border">
          {recentPosts.length === 0 ? (
            <div className="py-10 text-sm leading-7 text-muted-foreground">{siteDefaults.blog.emptyMessage}</div>
          ) : recentPosts.map((post) => (
            <Link className="group article-row" href={`/blog/${post.slug}`} key={post.id}>
              <time className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground">
                {post.publishedDate ? formatSiteDate(post.publishedDate) : ""}
              </time>
              <span>
                <span className="article-row-title">{post.title}</span>
                <span className="mt-3 block max-w-3xl text-sm leading-7 text-muted-foreground">
                  {summarizeExcerpt(post.excerpt, 135)}
                </span>
              </span>
              <ArrowUpRight aria-hidden="true" className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 md:block" size={18} />
            </Link>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">02</p>
          <h2 className="section-title">项目与实验</h2>
          <Link className="text-link mt-4" href="/projects">查看全部项目 →</Link>
        </div>
        <div className="grid border-y border-border md:grid-cols-2">
          {projects.slice(0, 2).map((project, index) => (
            <Link
              className={`group flex min-h-72 flex-col py-8 transition-colors duration-200 hover:bg-card/70 md:p-8 ${index === 0 ? "border-b border-border md:border-b-0 md:border-r" : ""}`}
              href={project.href}
              key={String(project.id)}
              target={project.href.startsWith("http") ? "_blank" : undefined}
              rel={project.href.startsWith("http") ? "noreferrer" : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">{project.role}</p>
                <ArrowUpRight aria-hidden="true" className="text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} />
              </div>
              <h3 className="mt-10 font-serif text-3xl font-medium tracking-[-0.025em]">{project.title}</h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{project.description}</p>
              <div className="mt-auto flex flex-wrap gap-x-3 gap-y-2 pt-8">
                {project.tags?.slice(0, 3).map((tag: { tag?: string | null }) => (
                  <span className="font-mono text-[0.68rem] text-muted-foreground" key={tag.tag ?? "tag"}>#{tag.tag}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div>
          <p className="section-number">03</p>
          <h2 className="section-title">最近在学习</h2>
          {admin ? <Link className="text-link mt-4" href="/admin/globals/home">管理最近学习 →</Link> : null}
        </div>
        <div className="divide-y divide-border border-y border-border">
          {learningAreas.map((area) => (
            <article className="grid gap-3 py-7 sm:grid-cols-[11rem_1fr]" key={area.title}>
              <h3 className="font-serif text-lg font-medium tracking-tight">{area.title}</h3>
              <p className="text-sm leading-7 text-muted-foreground">{area.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
