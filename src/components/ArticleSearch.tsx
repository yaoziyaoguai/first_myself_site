"use client";

import { useEffect } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function updateArchiveQuery(update: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href);
  update(url.searchParams);
  window.history.replaceState(null, "", url);
}

export function rememberArchiveLocation() {
  sessionStorage.setItem("article-archive-query", window.location.search);
  history.replaceState({ ...history.state, articleArchiveScrollY: window.scrollY }, "");
}

export function ArticleSearch() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  useEffect(() => {
    const scrollY = history.state?.articleArchiveScrollY;
    if (typeof scrollY !== "number") return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="archive-search">
      <Search size={17} aria-hidden="true" />
      <input
        aria-label="搜索文章"
        id="article-search"
        type="search"
        placeholder="筛选标题、摘要或技术栈…"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          updateArchiveQuery((params) => {
            params.delete("page");
            if (value) {
              params.set("q", value);
              params.delete("view");
            } else {
              params.delete("q");
            }
          });
        }}
      />
      <kbd aria-hidden="true">/</kbd>
    </div>
  );
}
