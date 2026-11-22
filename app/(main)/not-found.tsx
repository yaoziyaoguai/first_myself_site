import Link from "next/link";
import { ArticleLinkFeedback } from "@/components/ArticleLinkFeedback";
import { findArticleIndexForViewer } from "@/lib/visitorContentCache";

export default async function NotFound() {
  const { docs } = await findArticleIndexForViewer(null);

  return (
    <section className="site-shell page-space" aria-labelledby="missing-title">
      <header className="page-header site-message tech-grid-backdrop">
        <p className="eyebrow">404 · NOT FOUND</p>
        <h1 id="missing-title">这篇笔记不存在或已撤回</h1>
        <p>链接可能已失效。你可以从文章列表继续阅读。</p>
      </header>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link prefetch={false} className="primary-link" href="/blog">返回文章列表 →</Link>
        <Link prefetch={false} className="text-link" href="/">回到首页</Link>
      </div>
      {docs.length > 0 && (
        <nav aria-label="最近公开文章" className="mt-12 max-w-2xl border-t border-border pt-5">
          <h2 className="section-title">最近公开文章</h2>
          <ul className="mt-3 divide-y divide-border">
            {docs.slice(0, 3).map((post) => (
              <li key={post.id}>
                <Link prefetch={false} className="text-link gap-3" href={`/blog/${post.slug}`}>
                  {post.title}
                  <ArticleLinkFeedback compact iconSize={14} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
