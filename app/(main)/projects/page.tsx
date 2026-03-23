import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPayloadAPI } from "@/lib/payload";

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
        <h1 className="text-3xl md:text-4xl font-bold mb-4">项目经历</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          以下是我参与过的主要项目，涵盖实时数仓、数据治理、性能优化等多个方向。
          每个项目都注重实际业务价值与技术落地的平衡。
        </p>
      </section>

      <div className="space-y-8">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">
                    {project.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {project.role} · {project.period}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {project.description}
              </p>

              {/* 技术标签 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(
                  project.tags as { tag: string; id?: string }[] | undefined
                )?.map((t) => (
                  <Badge key={t.tag} variant="secondary">
                    {t.tag}
                  </Badge>
                ))}
              </div>

              {/* 项目亮点 */}
              <div className="bg-muted/50 rounded-lg p-4">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
