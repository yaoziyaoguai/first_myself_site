import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPayloadAPI } from "@/lib/payload";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      status: { equals: "published" },
      visibility: { equals: "public" },
    },
    sort: "-publishedDate",
    limit: 50,
  });
  const posts = result.docs;

  return (
    <div className="container mx-auto px-4 py-12">
      <section className="mb-12">
        <h1 className="text-4xl md:text-5xl font-medium mb-4" style={{ fontFamily: "'SF Pro Rounded', ui-sans-serif, system-ui" }}>博客</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          分享数据工程、数据架构、性能优化等方面的实践经验与思考。
          每篇文章都来自真实项目经验的总结。
        </p>
      </section>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">暂无文章，敬请期待。</p>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => {
            const tags = (post.tags as { tag: string }[] | undefined) || [];
            const dateStr = post.publishedDate
              ? new Date(post.publishedDate).toISOString().split("T")[0]
              : "";
            return (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <div className="border border-border rounded-lg p-6 bg-background hover:bg-muted transition-colors cursor-pointer">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                    <h2 className="text-xl font-medium hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{dateStr}</span>
                      {post.readingTime && (
                        <>
                          <span>·</span>
                          <span>{post.readingTime}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    {post.excerpt}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <div
                        key={t.tag}
                        className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-2.5 py-1 text-xs font-medium border border-border"
                      >
                        {t.tag}
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
