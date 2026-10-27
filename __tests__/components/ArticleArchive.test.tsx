import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleArchive } from "@/components/ArticleArchive";
import { ArticleIndex } from "@/components/ArticleIndex";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({
    replace: (url: string) => window.history.replaceState(null, "", url),
  }),
}));

function Archive() {
  return (
    <ArticleArchive
      articleCount={2}
      seriesCount={1}
      articles={
        <ArticleIndex
          articles={[
            {
              id: "1",
              slug: "agent",
              title: "执行边界",
              excerpt: "",
              date: "",
              readingTime: "",
              tags: ["Agent"],
            },
            {
              id: "2",
              slug: "data",
              title: "数据管道",
              excerpt: "",
              date: "",
              readingTime: "",
              tags: ["Data"],
            },
          ]}
        />
      }
      series={<Link href="/blog/series/real-series">真实合集</Link>}
    />
  );
}

beforeEach(() => window.history.replaceState(null, "", "/blog?analytics=off"));
afterEach(cleanup);

describe("ArticleArchive", () => {
  it("switches views without losing the existing article filter or unrelated query parameters", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Archive />);
    await user.click(screen.getByRole("button", { name: "Agent 1" }));
    await user.click(screen.getByRole("tab", { name: "文章合集 1" }));
    expect(window.location.search).toBe("?analytics=off&view=series");
    // Next 的路由上下文在原生 history 更新后重渲染；单元测试显式刷新该上下文。
    rerender(<Archive />);
    expect(screen.getByRole("tab", { name: "文章合集 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("link", { name: "真实合集" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /执行边界/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "全部文章 2" }));
    rerender(<Archive />);
    expect(window.location.search).toBe("?analytics=off");
    expect(screen.getByRole("status")).toHaveTextContent("Agent · 1 篇文章");
    expect(screen.getByRole("button", { name: "Agent 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.queryByRole("link", { name: /数据管道/ }),
    ).not.toBeInTheDocument();
  });

  it("supports opening the series view directly and using arrow-key selection", async () => {
    window.history.replaceState(null, "", "/blog?view=series");
    const user = userEvent.setup();
    const { rerender } = render(<Archive />);
    const tab = screen.getByRole("tab", { name: "文章合集 1" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    await user.tab();
    expect(tab).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    rerender(<Archive />);
    expect(screen.getByRole("tab", { name: "全部文章 2" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "全部文章 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("keeps old series and article anchor entries usable", () => {
    window.history.replaceState(null, "", "/blog?analytics=off#series-heading");
    const { rerender } = render(<Archive />);
    expect(new URLSearchParams(window.location.search).get("view")).toBe(
      "series",
    );
    rerender(<Archive />);
    expect(screen.getByRole("link", { name: "真实合集" })).toBeVisible();
    window.history.replaceState(
      null,
      "",
      "/blog?view=series#all-articles-heading",
    );
    fireEvent(window, new HashChangeEvent("hashchange"));
    rerender(<Archive />);
    expect(screen.getByRole("tab", { name: "全部文章 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
