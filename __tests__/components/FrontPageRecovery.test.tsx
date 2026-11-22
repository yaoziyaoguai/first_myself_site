import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFound from "@/app/(main)/not-found";
import MainError from "@/app/(main)/error";

vi.mock("@/lib/visitorContentCache", () => ({
  findArticleIndexForViewer: async () => ({
    docs: [
      { id: 1, slug: "note", title: "公开笔记" },
      { id: 2, slug: "second", title: "第二篇" },
      { id: 3, slug: "third", title: "第三篇" },
      { id: 4, slug: "fourth", title: "第四篇" },
    ],
  }),
}));

afterEach(cleanup);

describe("front page recovery", () => {
  it("shows the Chinese 404 landmark with recovery links and three recent notes", async () => {
    render(await NotFound());
    expect(screen.getByRole("region", { name: "这篇笔记不存在或已撤回" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回文章列表/ })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: /回到首页/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("navigation", { name: "最近公开文章" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "第四篇" })).not.toBeInTheDocument();
  });

  it("offers refresh and home navigation after a render error", () => {
    render(<MainError />);
    expect(screen.getByRole("region", { name: "这页暂时无法打开" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载当前页" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  });
});
