import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPayloadAPI } from "@/lib/payload";

export default async function AboutPage() {
  const payload = await getPayloadAPI();
  const settings = await payload.findGlobal({ slug: "site-settings" });
  const about = await payload.findGlobal({ slug: "about" });

  const name = settings?.name || "Jinkun Wang";
  const introText = (about?.introText as string) || "";
  const workDirections =
    (about?.workDirections as { title: string; description: string }[]) || [];
  const techStack =
    (about?.techStack as { category: string; items: string }[]) || [];
  const focusAreas =
    (about?.focusAreas as { title: string; description: string }[]) || [];

  return (
    <div className="container mx-auto px-4 py-12">
      {/* 自我介绍 */}
      <section className="max-w-3xl mx-auto mb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">关于我</h1>
        <div className="space-y-4">
          <p className="text-lg text-muted-foreground leading-relaxed">
            我是 {name}，一名数据仓库工程师。
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {introText}
          </p>
        </div>
      </section>

      {/* 工作方向 */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-8">工作方向</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          {workDirections.map((direction) => (
            <Card key={direction.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{direction.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {direction.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 技术栈 */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-8">技术栈</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-3xl">
          {techStack.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                {group.category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.items.split(",").map((item) => (
                  <Badge key={item.trim()} variant="secondary">
                    {item.trim()}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 关注的问题领域 */}
      <section>
        <h2 className="text-xl font-semibold mb-8">我关注的问题</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          {focusAreas.map((area) => (
            <Card key={area.title} className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{area.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {area.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
