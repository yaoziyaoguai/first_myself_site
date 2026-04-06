import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

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
        <h1 className="text-4xl md:text-5xl font-medium mb-6" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>关于我</h1>
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
        <h2 className="text-2xl font-medium mb-8" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>工作方向</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          {workDirections.map((direction) => (
            <div key={direction.title} className="border border-border rounded-lg p-6 bg-background">
              <h3 className="text-base font-medium mb-2">{direction.title}</h3>
              <p className="text-sm text-muted-foreground">
                {direction.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 技术栈 */}
      <section className="mb-16">
        <h2 className="text-2xl font-medium mb-8" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>技术栈</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-3xl">
          {techStack.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                {group.category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.items.split(",").map((item) => (
                  <div
                    key={item.trim()}
                    className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-2.5 py-1 text-xs font-medium border border-border"
                  >
                    {item.trim()}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 关注的问题领域 */}
      <section>
        <h2 className="text-2xl font-medium mb-8" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>我关注的问题</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          {focusAreas.map((area) => (
            <div key={area.title} className="border border-border rounded-lg p-6 bg-muted">
              <h3 className="text-base font-medium mb-2">{area.title}</h3>
              <p className="text-sm text-muted-foreground">
                {area.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
