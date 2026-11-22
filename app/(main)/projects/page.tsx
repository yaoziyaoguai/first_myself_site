import "../listing.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { projectLifecycle, ProjectStatus } from "@/components/ProjectStatus";
import { siteDefaults } from "@/content/siteDefaults";
import { getCurrentUser } from "@/lib/auth";
import { findArticleIndexForViewer, findProjectsForViewer } from "@/lib/visitorContentCache";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "项目",
  description: "围绕数据工程、AI 评测与 Agent 系统的个人项目和实验。",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage() {
  const viewer = await getCurrentUser();
  const [result, archive] = await Promise.all([
    findProjectsForViewer(viewer, 50),
    findArticleIndexForViewer(null),
  ]);
  const projects = result.docs.length > 0 ? result.docs : siteDefaults.projects;
  const publicPosts = new Map(archive.docs.map((post) => [String(post.id), post]));

  return (
    <div className="site-shell page-space">
      <header className="page-header relative">
        <p className="eyebrow">PROJECTS</p>
        <h1>项目与实验</h1>
        <p>在代码中实践数据工程、AI 评测与 Agent 系统，记录做法、取舍和仍在尝试的方向。</p>
        {viewer?.role === "admin" && (
          <Link className="text-link mt-6" href="/admin/collections/projects">管理项目 →</Link>
        )}
      </header>
      <div className="project-dossiers">
        {projects.map((project) => {
          const relatedIds = "relatedArticles" in project
            ? (project.relatedArticles as (number | string)[] | undefined) ?? []
            : [];
          const status = projectLifecycle(project.period);
          const period = status ? project.period.replace(` · ${status}`, "") : project.period;
          const links = relatedIds.flatMap((id) => publicPosts.get(String(id)) ?? []);
          return (
            <article id={project.slug} className="project-dossier" key={String(project.id)}>
              <div>
                <ProjectStatus period={project.period} />
                <h2 className="mt-3 font-serif text-2xl font-medium md:text-3xl">{project.title}</h2>
                <p className="mt-3 text-xs text-muted-foreground">
                  {project.role} · {period}
                </p>
                {project.href && (
                  <Link className="text-link mt-3" href={project.href}
                    target={project.href.startsWith("http") ? "_blank" : undefined}
                    rel={project.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                    查看项目 <ArrowUpRight className="ml-1" size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm leading-7 text-muted-foreground">{project.description}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {project.tags?.map(({ tag }: { tag?: string | null }) => (
                    <li className="topic-pill" key={tag}>{tag}</li>
                  ))}
                </ul>
                {project.highlights && project.highlights.length > 0 && (
                  <ul className="mt-5 border-l border-primary/45 pl-4 text-sm leading-7">
                    {project.highlights.map(({ text }: { text?: string | null }) => <li key={text}>{text}</li>)}
                  </ul>
                )}
                {links.length > 0 && (
                  <ul className="mt-5 border-t border-dashed border-border pt-2" aria-label="相关技术文章">
                    {links.map((post) => (
                      <li key={post.id}>
                        <Link className="text-link" href={`/blog/${post.slug}`}>{post.title} →</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
