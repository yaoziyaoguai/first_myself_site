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

      <div className="divide-y divide-border border-y border-border">
        {projects.map((project, index) => {
          const href = "href" in project ? project.href : null;
          const Wrapper = href ? Link : "article";

          return (
            <Wrapper
              className="group grid gap-7 py-10 md:grid-cols-[5rem_minmax(0,0.8fr)_minmax(0,1.2fr)] md:py-14"
              href={href ?? "/projects"}
              key={String(project.id)}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noreferrer" : undefined}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="flex items-start gap-3">
                  <span className="text-2xl font-semibold tracking-tight">{project.title}</span>
                  {href ? <ArrowUpRight aria-hidden="true" size={18} /> : null}
                </span>
                <span className="mt-3 block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {project.role} · {project.period}
                </span>
              </span>
              <span>
                <span className="block text-sm leading-7 text-muted-foreground">
                  {project.description}
                </span>
                <span className="mt-6 flex flex-wrap gap-2">
                  {project.tags?.map((tag) => (
                    <span className="topic-pill" key={tag.tag ?? "tag"}>
                      {tag.tag}
                    </span>
                  ))}
                </span>
                {project.highlights?.length ? (
                  <span className="mt-7 block border-l border-primary pl-5">
                    {project.highlights.map((highlight) => (
                      <span className="block text-sm leading-7 text-foreground/80" key={highlight.text ?? "highlight"}>
                        {highlight.text}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
