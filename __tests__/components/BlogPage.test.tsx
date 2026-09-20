import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BlogPage from "@/app/(main)/blog/page";

const { currentUser, find } = vi.hoisted(() => ({ currentUser: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: currentUser }));
vi.mock("@/lib/payload", () => ({ getPayloadAPI: async () => ({ find }) }));

describe("article discovery with empty series", () => {
  beforeEach(() => {
    currentUser.mockResolvedValue(null);
    find.mockResolvedValue({ docs: [{ id: 1, title: "已有文章", slug: "existing-article", tags: [] }] });
  });
  afterEach(cleanup);

  it("takes visitors directly to articles instead of an empty series section", async () => {
    render(await BlogPage());
    expect(screen.getByRole("heading", { name: "全部文章" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /已有文章/ })).toHaveAttribute("href", "/blog/existing-article");
    expect(screen.queryByRole("heading", { name: "文章合集" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /文章合集 ·/ })).not.toBeInTheDocument();
  });

  it("keeps the empty-state guidance and create action for the owner", async () => {
    currentUser.mockResolvedValue({ id: 1, role: "admin" });
    render(await BlogPage());
    expect(screen.getByRole("heading", { name: "文章合集" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建第一个合集 →" })).toHaveAttribute("href", "/admin/collections/blog-series/create");
  });

  it("shows the first published series and reading entry to visitors", async () => {
    find.mockResolvedValue({ docs: [{ id: 1, title: "已有文章", slug: "existing-article", tags: [],
      series: { id: 1, title: "真实合集", slug: "real-series", description: "按顺序阅读", status: "published" },
    }] });
    render(await BlogPage());
    expect(screen.getByRole("heading", { name: "文章合集" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "从第一篇开始读 →" })).toHaveAttribute("href", "/blog/existing-article");
  });
});
