import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheMaps: [] as Array<Map<string, unknown>>,
  currentUser: vi.fn(),
  findPost: vi.fn(),
  findPosts: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => {
      const values = new Map<string, unknown>();
      mocks.cacheMaps.push(values);
      return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);
        if (!values.has(key)) values.set(key, fn(...args));
        return values.get(key);
      }) as unknown as T;
    },
  };
});

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({
  default: ({ prefetch, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    prefetch?: boolean;
  }) => (
    <a data-prefetch={String(prefetch)} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/visitorContentCache", () => ({
  findBlogPostBySlugForViewer: mocks.findPost,
  findBlogPostsForViewer: mocks.findPosts,
}));
vi.mock("@/lib/blog-agent/config", () => ({ canShowBlogAgent: () => true }));
vi.mock("@payloadcms/richtext-lexical/react", () => ({
  defaultJSXConverters: {},
  RichText: () => <div data-testid="rich-text" />,
}));
vi.mock("@/components/MarkdownArticle", () => ({
  MarkdownArticle: ({ markdown }: { markdown: string }) => (
    <div data-testid="markdown-article">{markdown}</div>
  ),
}));
vi.mock("@/components/CommentSection", () => ({
  CommentSection: () => <div data-testid="comments" />,
}));
vi.mock("@/components/LikeButton", () => ({
  LikeButton: () => <div data-testid="likes" />,
}));
vi.mock("@/components/blog-agent/BlogAgent", () => ({
  BlogAgent: () => <div data-testid="blog-agent" />,
}));
vi.mock("@/components/ShareActions", () => ({
  ShareActions: () => <div data-testid="share-actions" />,
}));
vi.mock("@/components/HashAnchorScroller", () => ({
  HashAnchorScroller: () => null,
}));

import BlogPostPage, {
  generateMetadata,
} from "@/app/(main)/blog/[slug]/page";

const basePost = {
  id: 10,
  title: "让 Agent 安全执行本地命令",
  slug: "agent-local-command",
  excerpt: "一篇真实技术文章",
  publishedDate: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
  readingTime: "约 7 分钟",
  visibility: "public",
  status: "published",
  tags: [{ tag: "Agent" }],
  coverImage: null,
  contentMarkdown: "# 正文",
  content: null,
  series: null,
};

const props = {
  params: Promise.resolve({ slug: encodeURIComponent(basePost.slug) }),
};

describe("blog article page delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const values of mocks.cacheMaps) values.clear();
    mocks.currentUser.mockResolvedValue(null);
    mocks.findPost.mockResolvedValue(basePost);
    mocks.findPosts.mockResolvedValue({
      docs: [
        basePost,
        { ...basePost, id: 11, slug: "related-a", title: "相关文章 A" },
        { ...basePost, id: 12, slug: "related-b", title: "相关文章 B" },
        { ...basePost, id: 13, slug: "related-c", title: "相关文章 C" },
      ],
    });
  });

  afterEach(cleanup);

  it("shares one slug-keyed article read between metadata and page rendering", async () => {
    const metadata = await generateMetadata(props);
    render(await BlogPostPage(props));

    expect(metadata.title).toBe(basePost.title);
    expect(metadata.alternates?.canonical).toBe(`/blog/${basePost.slug}`);
    expect(mocks.currentUser).toHaveBeenCalledTimes(1);
    expect(mocks.findPost).toHaveBeenCalledTimes(1);
    expect(mocks.findPost).toHaveBeenCalledWith(null, basePost.slug);
    expect(mocks.findPosts).toHaveBeenCalledWith(null, {
      sort: "-publishedDate",
      limit: 4,
      depth: 0,
    });
    expect(screen.getByTestId("markdown-article")).toHaveTextContent("# 正文");
    expect(screen.queryByTestId("rich-text")).not.toBeInTheDocument();
    expect(screen.getByTestId("blog-agent")).toBeInTheDocument();
    expect(screen.getByTestId("likes")).toBeInTheDocument();
    expect(screen.getByTestId("comments")).toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')?.textContent)
      .toContain('"@type":"BlogPosting"');
  });

  it("keeps not-found metadata and page behavior on one shared null read", async () => {
    mocks.findPost.mockResolvedValue(null);

    await expect(generateMetadata(props)).resolves.toMatchObject({
      title: "文章未找到",
    });
    await expect(BlogPostPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.findPost).toHaveBeenCalledTimes(1);
    expect(mocks.findPosts).not.toHaveBeenCalled();
  });

  it("preserves private author rendering and the RichText fallback", async () => {
    const privatePost = {
      ...basePost,
      visibility: "private",
      contentMarkdown: "",
      content: { root: { children: [] } },
    };
    mocks.currentUser.mockResolvedValue({ id: 1, role: "admin" });
    mocks.findPost.mockResolvedValue(privatePost);

    render(await BlogPostPage(props));

    expect(mocks.findPost).toHaveBeenCalledWith(
      { id: 1, role: "admin" },
      basePost.slug,
    );
    expect(screen.getByRole("link", { name: "编辑" })).toHaveAttribute(
      "href",
      "/admin/collections/blog/10",
    );
    expect(screen.getByTestId("rich-text")).toBeInTheDocument();
    expect(screen.queryByTestId("blog-agent")).not.toBeInTheDocument();
    expect(screen.queryByTestId("likes")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comments")).not.toBeInTheDocument();
  });

  it("uses the constrained series query and disables prefetch on every rendered series link", async () => {
    const series = {
      id: 7,
      title: "Agent Runtime",
      slug: "agent-runtime",
      description: "按顺序阅读",
      status: "published",
    };
    const articles = [
      { ...basePost, id: 9, slug: "previous", title: "上一篇", seriesOrder: 1 },
      { ...basePost, series, seriesOrder: 2 },
      { ...basePost, id: 11, slug: "next", title: "下一篇", seriesOrder: 3 },
    ];
    mocks.findPost.mockResolvedValue({ ...basePost, series, seriesOrder: 2 });
    mocks.findPosts.mockResolvedValue({ docs: articles });

    render(await BlogPostPage(props));

    expect(mocks.findPosts).toHaveBeenCalledWith(null, {
      seriesId: 7,
      limit: 100,
      depth: 0,
    });
    expect(mocks.findPosts).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "继续阅读" }))
      .not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
    const next = screen.getAllByRole("link", { name: /下一篇/ }).at(-1);
    expect(next).toHaveAttribute("href", "/blog/next");
  });

  it("disables prefetch on related-reading links and caps them at three", async () => {
    render(await BlogPostPage(props));

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
    expect(screen.getByRole("link", { name: /相关文章 A/ }))
      .toHaveAttribute("href", "/blog/related-a");
    expect(screen.queryByRole("link", { name: /Agent 安全执行/ }))
      .not.toBeInTheDocument();
  });
});
