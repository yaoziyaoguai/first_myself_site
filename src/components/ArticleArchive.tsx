"use client";

import { Tabs } from "@base-ui/react/tabs";
import { LibraryBig, List } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function ArticleArchive({
  articles,
  series,
  articleCount,
  seriesCount,
  search,
}: {
  articles: ReactNode;
  series: ReactNode;
  articleCount: number;
  seriesCount: number;
  search?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get("view") === "series" ? "series" : "articles";

  useEffect(() => {
    // 首次挂载时原生 history 还可能未接管，用路由替换兼容旧锚点入口。
    function followLegacyAnchor() {
      const url = new URL(window.location.href);
      if (url.hash === "#series-heading") {
        url.searchParams.set("view", "series");
      } else if (url.hash === "#all-articles-heading") {
        url.searchParams.delete("view");
      } else {
        return;
      }
      if (url.href !== window.location.href) {
        router.replace(`${url.pathname}${url.search}${url.hash}`, {
          scroll: false,
        });
      }
    }
    followLegacyAnchor();
    window.addEventListener("hashchange", followLegacyAnchor);
    return () => window.removeEventListener("hashchange", followLegacyAnchor);
  }, [router]);

  return (
    <Tabs.Root
      value={view}
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        if (value === "series") url.searchParams.set("view", "series");
        else url.searchParams.delete("view");
        url.hash = "";
        if (url.href !== window.location.href) window.history.pushState(null, "", url);
      }}
    >
      <div className="archive-tools">
        <Tabs.List aria-label="文章浏览方式" className="archive-tabs" activateOnFocus>
          <Tabs.Tab value="articles" className="archive-tab">
            <List size={16} aria-hidden="true" />
            全部文章 <span className="archive-tab-count">{articleCount}</span>
          </Tabs.Tab>
          <Tabs.Tab value="series" className="archive-tab">
            <LibraryBig size={16} aria-hidden="true" />
            文章合集 <span className="archive-tab-count">{seriesCount}</span>
          </Tabs.Tab>
          <Tabs.Indicator className="archive-tab-indicator" />
        </Tabs.List>
        {search}
      </div>
      <Tabs.Panel value="articles" keepMounted className="archive-panel">
        {articles}
      </Tabs.Panel>
      <Tabs.Panel value="series" keepMounted className="archive-panel">
        {series}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
