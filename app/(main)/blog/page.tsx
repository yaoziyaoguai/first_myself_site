import Link from "next/link";
import { getPayloadAPI } from "@/lib/payload";
import { getCurrentUser } from "@/lib/auth";
import { buildBlogFrontendWhere } from "@/lib/blogVisibility";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  // 先识别当前请求的登录态（基于 payload-token cookie）：
  // - 未登录 / 普通用户：只能看到公开 + 已发布的文章
  // - 作者本人 (admin) / 编辑 (editor)：看到全部已发布文章（含 private）
  // 之所以在这一层手动加 where，是因为 Local API 默认 overrideAccess: true，
  // Blog.access.read 在前台 server component 链路上不会自动生效。
  // 详细原因见 src/lib/blogVisibility.ts 顶部注释。
  const viewer = await getCurrentUser();
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: buildBlogFrontendWhere(viewer),
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
