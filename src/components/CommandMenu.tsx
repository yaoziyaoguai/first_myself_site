"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, Command, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArticleLinkFeedback } from "@/components/ArticleLinkFeedback";
import { searchTerms } from "@/lib/articleDiscovery";
import { toggleSiteTheme } from "@/lib/siteTheme";

type Route = { href: string; label: string };
type SearchArticle = { slug: string; title: string; excerpt: string; tags: string[] };
type MenuEntry = Route | { label: string; run: () => void };

function matchesText(value: string, terms: readonly string[]) {
  const text = value.normalize("NFKC").toLocaleLowerCase("zh-CN");
  return terms.every((term) => {
    if (text.includes(term)) return true;
    if (!/^[a-z\d]{2,}$/i.test(term)) return false;
    let position = 0;
    for (const character of term) {
      const found = text.indexOf(character, position);
      if (found === -1) return false;
      position = found + 1;
    }
    return true;
  });
}

export function CommandMenu({ routes }: { routes: readonly Route[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [articles, setArticles] = useState<SearchArticle[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState(false);
  const [feedback, setFeedback] = useState("");

  const show = useCallback(async () => {
    if (open) return;
    setOpen(true);
    setSelected(0);
    setFeedback("");
    if (articles !== null) return;
    setFailed(false);
    try {
      const response = await fetch("/api/article-index");
      if (!response.ok) {
        setFailed(true);
        return;
      }
      setArticles(await response.json());
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof SyntaxError)) throw error;
      setFailed(true);
    }
  }, [articles, open]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const command = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const slash = event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey &&
        !(event.target as HTMLElement).closest("input,textarea,select,[contenteditable]");
      if (!command && !slash) return;
      event.preventDefault();
      const archiveSearch = slash && document.querySelector<HTMLInputElement>("#article-search");
      if (archiveSearch) {
        archiveSearch.focus();
        return;
      }
      void show();
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [show]);

  async function copyFeed() {
    try {
      await navigator.clipboard.writeText(new URL("/rss.xml", location.origin).href);
      setFeedback("已复制 RSS 地址");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "NotAllowedError") throw error;
      setFeedback("浏览器拒绝了复制权限");
    }
  }

  const terms = searchTerms(query);
  const commands: MenuEntry[] = [
    ...routes,
    { label: "切换明暗主题", run: toggleSiteTheme },
    { label: "复制 RSS 地址", run: () => void copyFeed() },
  ];
  const routeResults = commands.filter(({ label }) => matchesText(label, terms));
  const articleResults = articles?.filter(({ title, tags, excerpt }) =>
    matchesText([title, ...tags, excerpt].join(" "), terms),
  ).slice(0, 6).map((article) => ({
    href: `/blog/${article.slug}`,
    label: article.title,
  })) ?? [];
  const entries = [...routeResults, ...articleResults];
  const active = Math.min(selected, entries.length - 1);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => next ? void show() : setOpen(false)}>
      <Dialog.Trigger type="button" className="nav-search-trigger" aria-label="搜索文章">
        <Search size={16} aria-hidden="true" />
        <kbd aria-hidden="true"><Command size={12} />K</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="command-backdrop" />
        <Dialog.Popup className="nav-search-dialog" initialFocus={input}>
          <Dialog.Title className="sr-only">文章速查</Dialog.Title>
          <div className="nav-search-input">
            <Search size={18} aria-hidden="true" />
            <input
              ref={input}
              value={query}
              type="search"
              aria-label="按关键词搜索"
              placeholder="搜索文章、页面或操作"
              onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
              onKeyDown={(event) => {
                if (entries.length === 0) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  setSelected((active + direction + entries.length) % entries.length);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const entry = entries[active];
                  if ("href" in entry) {
                    setOpen(false);
                    router.push(entry.href);
                  } else entry.run();
                }
              }}
            />
            <Dialog.Close type="button" aria-label="关闭搜索"><X size={18} /></Dialog.Close>
          </div>
          <ul className="nav-search-results" aria-label="命令与文章">
            {entries.map((entry, index) => (
              <li key={"href" in entry ? entry.href : entry.label} data-active={index === active}
                onPointerEnter={() => setSelected(index)}>
                {"href" in entry ? (
                  <Link prefetch={false} href={entry.href} onNavigate={() => setOpen(false)}>
                    {entry.label}
                    {entry.href.startsWith("/blog/") ? <ArticleLinkFeedback compact iconSize={14} /> :
                      <ArrowUpRight size={14} aria-hidden="true" />}
                  </Link>
                ) : (
                  <button type="button" onClick={entry.run}>{entry.label}</button>
                )}
              </li>
            ))}
          </ul>
          <span className="sr-only" aria-live="polite">{entries[active]?.label}</span>
          {failed && <p role="status" className="command-status text-destructive">暂时无法读取文章。</p>}
          {articles === null && !failed && <p role="status" className="command-status">正在读取文章…</p>}
          {articles !== null && entries.length === 0 && <p role="status" className="command-status">没有找到匹配结果。</p>}
          {feedback && <p role="status" className="command-status">{feedback}</p>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
