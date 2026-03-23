import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPayloadAPI } from "@/lib/payload";

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
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-base text-muted-foreground mb-4">{role}</p>
        <p className="text-lg text-muted-foreground max-w-xl mb-8">{bio}</p>

        {/* 方向标签 */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {directions.map((item, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="text-sm px-3 py-1"
            >
              {item.label}
            </Badge>
          ))}
        </div>

        {/* 按钮组 */}
        <div className="flex gap-4">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/80 transition-colors"
          >
            查看项目
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            查看博客
          </Link>
        </div>
      </section>

      {/* 能力卡片 */}
      <section className="py-12">
        <h2 className="text-xl font-semibold mb-8 text-center">我能做什么</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {capabilities.map((cap) => (
            <Card
              key={cap.title}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <CardTitle className="text-base">{cap.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {cap.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
