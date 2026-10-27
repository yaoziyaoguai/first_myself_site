import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BlogPage from "@/app/(main)/blog/page";

const { currentUser, find } = vi.hoisted(() => ({
  currentUser: vi.fn(),
  find: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: currentUser }));
vi.mock("@/lib/payload", () => ({ getPayloadAPI: async () => ({ find }) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("article discovery with empty series", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/blog");
    currentUser.mockResolvedValue(null);
    find.mockResolvedValue({
      docs: [{ id: 1, title: "已有文章", slug: "existing-article", tags: [] }],
    });
  });
  afterEach(cleanup);

  it("takes visitors directly to articles instead of an empty series section", async () => {
    render(await BlogPage());
    expect(
      screen.getByRole("heading", { name: "全部文章" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /已有文章/ })).toHaveAttribute(
      "href",
      "/blog/existing-article",
    );
    expect(
      screen.queryByRole("heading", { name: "文章合集" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /文章合集 ·/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the empty-state guidance and create action for the owner", async () => {
    currentUser.mockResolvedValue({ id: 1, role: "admin" });
    window.history.replaceState(null, "", "/blog?view=series");
    render(await BlogPage());
    expect(
      screen.getByRole("heading", { name: "文章合集" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "创建第一个合集 →" }),
    ).toHaveAttribute("href", "/admin/collections/blog-series/create");
  });

  it.each(["editor", "viewer"])(
    "hides series management and empty-state creation from %s",
    async (role) => {
      currentUser.mockResolvedValue({ id: 2, role });
      window.history.replaceState(null, "", "/blog?view=series");
      render(await BlogPage());
      expect(
        screen.queryByRole("link", { name: "管理合集 ↗" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "创建第一个合集 →" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "文章合集" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["editor", "viewer"])(
    "keeps published series readable without management links for %s",
    async (role) => {
      currentUser.mockResolvedValue({ id: 2, role });
      window.history.replaceState(null, "", "/blog?view=series");
      find.mockResolvedValue({
        docs: [
          {
            id: 1,
            title: "已有文章",
            slug: "existing-article",
            tags: [],
            series: {
              id: 1,
              title: "真实合集",
              slug: "real-series",
              description: "按顺序阅读",
              status: "published",
            },
          },
        ],
      });
      render(await BlogPage());
      expect(screen.getByRole("link", { name: /真实合集/ })).toHaveAttribute(
        "href",
        "/blog/series/real-series",
      );
      expect(
        screen.queryByRole("link", { name: "管理合集 ↗" }),
      ).not.toBeInTheDocument();
    },
  );

  it("defaults to articles while making the series tab available to visitors", async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 1,
          title: "已有文章",
          slug: "existing-article",
          tags: [],
          series: {
            id: 1,
            title: "真实合集",
            slug: "real-series",
            description: "按顺序阅读",
            status: "published",
          },
        },
      ],
    });
    render(await BlogPage());
    expect(screen.getByRole("tab", { name: "全部文章 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "文章合集 1" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("link", { name: /已有文章/ })).toHaveAttribute(
      "href",
      "/blog/existing-article",
    );
    expect(
      screen.queryByRole("link", { name: /真实合集/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "管理合集 ↗" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "创建第一个合集 →" }),
    ).not.toBeInTheDocument();
  });
});
