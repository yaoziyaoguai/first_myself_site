import Link from "next/link";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getPayloadAPI();
  const home = await payload.findGlobal({ slug: "home" });

  const title = home?.title || "Jinkun Wang";
  const role = home?.role || "Data Engineer";
  const bio = home?.bio || "";
  const directions = (home?.directions as { label: string }[]) || [];
  const capabilities =
    (home?.capabilities as { title: string; description: string }[]) || [];

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center py-16 md:py-24">
        <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>
          {title}
        </h1>
        <p className="text-base text-muted-foreground mb-4">{role}</p>
        <p className="text-lg text-muted-foreground max-w-xl mb-8">{bio}</p>

        {/* 方向标签 */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {directions.map((item, index) => (
            <div
              key={index}
              className="inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground px-4 py-2 text-sm font-medium border border-border"
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* 按钮组 */}
        <div className="flex gap-4">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-80 transition-opacity"
          >
            查看项目
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background text-foreground px-6 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            查看博客
          </Link>
        </div>
      </section>

      {/* 能力卡片 */}
      <section className="py-12">
        <h2 className="text-2xl font-medium mb-8 text-center" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>我能做什么</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="border border-border rounded-lg p-6 bg-background hover:bg-muted transition-colors"
            >
              <h3 className="text-base font-medium mb-3">{cap.title}</h3>
              <p className="text-sm text-muted-foreground">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
