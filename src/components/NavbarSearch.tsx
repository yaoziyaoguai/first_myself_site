"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { matchesArticle, searchTerms } from "@/lib/articleDiscovery";

type QuickArticle = { slug: string; title: string; excerpt: string; tags: string[] };

export function NavbarSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [articles, setArticles] = useState<QuickArticle[]>();
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);

  const open = useCallback(async () => {
    const searchDialog = dialog.current!;
    if (searchDialog.open) return;
    searchDialog.showModal();
    input.current!.focus();
    if (articles) return;
    setFailed(false);
    try {
      const response = await fetch("/api/article-index");
      if (!response.ok) throw new Error("Article index unavailable");
      setArticles(await response.json());
    } catch {
      setFailed(true);
    }
  }, [articles]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void open();
      } else if (event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey &&
        !(event.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) {
        event.preventDefault();
        const archiveSearch = document.getElementById("article-search");
        if (archiveSearch?.getClientRects().length) archiveSearch.focus();
        else void open();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [open]);

  const terms = searchTerms(query);
  const results = articles?.filter((article) => matchesArticle(article, terms)).slice(0, 6);
  const archive = query.trim() ? `/blog?q=${encodeURIComponent(query.trim())}` : "/blog";

  return (
    <>
      <button ref={trigger} type="button" className="nav-search-trigger" aria-label="搜索文章"
        aria-haspopup="dialog" onClick={() => void open()}>
        <Search size={18} aria-hidden="true" />
      </button>
      <dialog ref={dialog} className="nav-search-dialog" aria-label="文章速查"
        onClose={() => trigger.current!.focus()}>
        <div className="nav-search-input">
          <Search size={18} aria-hidden="true" />
          <input ref={input} value={query} type="search" aria-label="按关键词搜索"
            placeholder="搜索标题、摘要、标签" onChange={(event) => setQuery(event.target.value)} />
          <button type="button" aria-label="关闭搜索" onClick={() => dialog.current!.close()}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {failed && <p role="status" className="px-4 py-3 text-sm text-destructive">速查暂时不可用。</p>}
        {!articles && !failed && <p role="status" className="px-4 py-3 text-sm">正在读取文章…</p>}
        {results?.length === 0 && <p role="status" className="px-4 py-3 text-sm">没有找到匹配的文章。</p>}
        {results && results.length > 0 && (
          <ul className="nav-search-results">
            {results.map((article) => (
              <li key={article.slug}>
                <Link prefetch={false} href={`/blog/${article.slug}`} onNavigate={() => dialog.current!.close()}>
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link className="text-link mx-4 my-2" href={archive} onNavigate={() => dialog.current!.close()}>
          打开文章归档 →
        </Link>
      </dialog>
    </>
  );
}
