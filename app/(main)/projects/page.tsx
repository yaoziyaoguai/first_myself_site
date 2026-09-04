import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteDefaults } from "@/content/siteDefaults";
import { isAdmin } from "@/lib/auth";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "项目",
  description: "围绕数据工程、AI 评测与 Agent 系统的个人项目和实验。",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage() {
  const payload = await getPayloadAPI();
  const [result, admin] = await Promise.all([
    payload.find({ collection: "projects", sort: "sortOrder", limit: 50 }),
    isAdmin(),
  ]);
  const projects = result.docs.length > 0 ? result.docs : siteDefaults.projects;
  const projectGroups = [
    {
      title: "主要项目",
      description: "首页优先展示的项目，也可以继续在后台调整排序。",
      projects: projects.slice(0, 4),
    },
    {
      title: "更多实践",
      description: "已经形成完整实现、使用说明或复盘材料的公开项目。",
      projects: projects.slice(4),
    },
  ].filter((group) => group.projects.length > 0);

  return (
    <div className="site-shell page-space">
      <header className="page-header relative">
        <p className="eyebrow">PROJECTS</p>
        <h1>用项目验证正在学习的东西。</h1>
        <p>
          这里不是成果陈列柜，而是实践记录。每个项目都对应一组仍在推敲的问题。
        </p>
        {admin ? (
          <Link className="text-link mt-6" href="/admin/collections/projects">
            管理项目 →
          </Link>
        ) : null}
      </header>

      <div className="space-y-16 md:space-y-24">
        {projectGroups.map((group) => (
          <section className="grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)]" key={group.title}>
            <div>
              <h2 className="text-xl font-medium tracking-tight">{group.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{group.description}</p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {group.projects.map((project) => {
                const href = "href" in project ? project.href : null;
                const className =
                  "grid gap-5 py-8 sm:grid-cols-[minmax(12rem,0.72fr)_minmax(0,1.28fr)] md:py-10";
                const content = (
                  <>
                    <span>
                      <span className="flex items-start gap-3">
                        <span className="text-xl font-medium tracking-tight">{project.title}</span>
                        {href ? <ArrowUpRight aria-hidden="true" size={17} /> : null}
                      </span>
                      <span className="mt-3 block font-mono text-xs leading-5 text-muted-foreground">
                        {project.role} · {project.period}
                      </span>
                    </span>
                    <span>
                      <span className="block text-sm leading-7 text-muted-foreground">
                        {project.description}
                      </span>
                      <span className="mt-5 flex flex-wrap gap-2">
                        {project.tags?.map((tag: { tag?: string | null }) => (
                          <span className="topic-pill" key={tag.tag ?? "tag"}>
                            {tag.tag}
                          </span>
                        ))}
                      </span>
                      {project.highlights?.length ? (
                        <span className="mt-6 block border-l border-primary pl-5">
                          {project.highlights.map((highlight: { text?: string | null }) => (
                            <span
                              className="block text-sm leading-7 text-foreground/80"
                              key={highlight.text ?? "highlight"}
                            >
                              {highlight.text}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </>
                );

                return href ? (
                  <Link
                    className={className}
                    href={href}
                    key={String(project.id)}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                  >
                    {content}
                  </Link>
                ) : (
                  <article className={className} key={String(project.id)}>
                    {content}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
