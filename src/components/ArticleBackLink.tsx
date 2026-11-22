"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function ArticleBackLink({ className = "text-link" }: { className?: string }) {
  const router = useRouter();
  return (
    <Link
      className={className}
      prefetch={false}
      href="/blog"
      onNavigate={(event) => {
        const query = new URLSearchParams(sessionStorage.getItem("article-archive-query") ?? "");
        if (query.size > 0) {
          event.preventDefault();
          router.push(`/blog?${query}`);
        }
      }}
    >
      ← 返回文章列表
    </Link>
  );
}
