import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  ArticleIndex,
  type ArticleIndexEntry,
} from "@/components/ArticleIndex";

const articles: ArticleIndexEntry[] = [
  {
    id: "1",
    slug: "runtime",
    title: "执行边界",
    excerpt: "真实摘录",
    date: "2026-08-23",
    readingTime: "约 7 分钟",
    tags: ["Agent", "Python"],
  },
  {
    id: "2",
    slug: "data",
    title: "数据管道",
    excerpt: "输入与输出",
    date: "2026-08-20",
    readingTime: "约 5 分钟",
    tags: ["Data", "Python"],
  },
];

afterEach(cleanup);
describe("ArticleIndex", () => {
  it("filters locally and restores the full list without changing article URLs", async () => {
    const user = userEvent.setup();
    render(<ArticleIndex articles={articles} />);
    await user.click(screen.getByRole("button", { name: "Agent 1" }));
    expect(screen.getByRole("link", { name: /执行边界/ })).toHaveAttribute(
      "href",
      "/blog/runtime",
    );
    expect(
      screen.queryByRole("link", { name: /数据管道/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Agent · 1 篇文章");
    await user.click(screen.getByRole("button", { name: "全部 2" }));
    expect(screen.getByRole("link", { name: /数据管道/ })).toBeInTheDocument();
  });

  it("keeps a selected extra topic visible when the topic list is collapsed", async () => {
    const user = userEvent.setup();
    render(
      <ArticleIndex
        articles={[
          { ...articles[0], tags: ["A", "B", "C", "D", "E", "F", "G"] },
        ]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "G 1" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更多主题 +" }));
    await user.click(screen.getByRole("button", { name: "G 1" }));
    await user.click(screen.getByRole("button", { name: "收起主题 −" }));
    expect(screen.getByRole("button", { name: "G 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("G · 1 篇文章");
  });
});
