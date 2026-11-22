"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";
import { archiveReturnSearch, consumeArchiveReturn } from "@/lib/archiveNavigation";

export function ArticleBackLink({
  pathname,
  className = "text-link",
}: { pathname: string; className?: string }) {
  const router = useRouter();
  useLayoutEffect(() => consumeArchiveReturn(pathname), [pathname]);

  return (
    <Link
      className={className}
      prefetch={false}
      href="/blog"
      onNavigate={(event) => {
        const search = archiveReturnSearch(pathname);
        if (search) {
          event.preventDefault();
          router.push(`/blog${search}`);
        }
      }}
    >
      ← 返回文章列表
    </Link>
  );
}
