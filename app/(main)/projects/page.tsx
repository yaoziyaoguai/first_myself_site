import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "projects",
    sort: "sortOrder",
    limit: 50,
  });
  const projects = result.docs;

  return (
    <div className="container mx-auto px-4 py-12">
      <section className="mb-12">
        <h1 className="text-4xl md:text-5xl font-medium mb-4" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>项目经历</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          以下是我参与过的主要项目，涵盖实时数仓、数据治理、性能优化等多个方向。
          每个项目都注重实际业务价值与技术落地的平衡。
        </p>
      </section>

      <div className="space-y-8">
        {projects.map((project) => (
          <div
            key={project.id}
            className="border border-border rounded-lg p-6 bg-background hover:bg-muted transition-colors"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-4">
              <div>
                <h2 className="text-xl font-medium">
                  {project.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {project.role} · {project.period}
                </p>
              </div>
            </div>

            <p className="text-muted-foreground mb-4">
              {project.description}
            </p>

            {/* 技术标签 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(
                project.tags as { tag: string; id?: string }[] | undefined
              )?.map((t) => (
                <div key={t.tag} className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium border border-border">
                  {t.tag}
                </div>
              ))}
            </div>

            {/* 项目亮点 */}
            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">项目成果</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {(
                  project.highlights as
                    | { text: string; id?: string }[]
                    | undefined
                )?.map((h, i) => (
                  <li key={i}>{h.text}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
