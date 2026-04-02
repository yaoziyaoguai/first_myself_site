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
        <h1 className="text-3xl md:text-4xl font-bold mb-4">博客</h1>
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
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <CardTitle className="text-xl hover:text-primary transition-colors">
                        {post.title}
                      </CardTitle>
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
                    <CardDescription className="mt-2">
                      {post.excerpt}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <Badge
                          key={t.tag}
                          variant="outline"
                          className="text-xs"
                        >
                          {t.tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
