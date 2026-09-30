import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const find = vi.fn();
  const getPayloadAPI = vi.fn(async () => ({ find }));
  const revalidateTag = vi.fn();
  const unstableCache = vi.fn(
    <T extends (...args: never[]) => Promise<unknown>>(fn: T) => {
      const values = new Map<string, ReturnType<T>>();
      return ((...args: Parameters<T>) => {
        const key = JSON.stringify(args);
        if (!values.has(key)) values.set(key, fn(...args) as ReturnType<T>);
        return values.get(key)!;
      }) as unknown as T;
    },
  );
  return { find, getPayloadAPI, revalidateTag, unstableCache };
});

vi.mock("@/lib/payload", () => ({ getPayloadAPI: mocks.getPayloadAPI }));
vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: mocks.unstableCache,
}));

async function loadCacheModule() {
  vi.resetModules();
  vi.stubEnv("VITEST", "");
  return import("@/lib/visitorContentCache");
}

describe("visitor content cache security boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.find.mockImplementation(async (query: {
      where?: { slug?: { equals?: string } };
      limit?: number;
      sort?: string;
    }) => ({
      docs: [{
        marker: query.where?.slug?.equals ?? `${query.sort ?? "none"}:${query.limit ?? 0}`,
      }],
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("caches anonymous list and article reads with both access control layers", async () => {
    const {
      findBlogPostBySlugForViewer,
      findBlogPostsForViewer,
    } = await loadCacheModule();

    await expect(findBlogPostBySlugForViewer(null, "article-a"))
      .resolves.toMatchObject({ marker: "article-a" });
    await findBlogPostBySlugForViewer(null, "article-a");
    await findBlogPostsForViewer(null, {
      limit: 4,
      depth: 0,
      sort: "-publishedDate",
    });
    await findBlogPostsForViewer(null, {
      limit: 4,
      depth: 0,
      sort: "-publishedDate",
    });

    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(mocks.find).toHaveBeenNthCalledWith(1, {
      collection: "blog",
      overrideAccess: false,
      where: {
        status: { equals: "published" },
        visibility: { equals: "public" },
        slug: { equals: "article-a" },
      },
      limit: 1,
    });
    expect(mocks.find).toHaveBeenNthCalledWith(2, {
      collection: "blog",
      overrideAccess: false,
      where: {
        status: { equals: "published" },
        visibility: { equals: "public" },
      },
      sort: "-publishedDate",
      limit: 4,
      depth: 0,
    });
    expect(mocks.unstableCache).toHaveBeenCalledTimes(2);
  });

  it("keeps every structured cache argument isolated", async () => {
    const {
      findBlogPostBySlugForViewer,
      findBlogPostsForViewer,
    } = await loadCacheModule();

    await findBlogPostBySlugForViewer(null, "article-a");
    await findBlogPostBySlugForViewer(null, "article-b");
    await findBlogPostsForViewer(null, { limit: 4, depth: 0, sort: "new" });
    await findBlogPostsForViewer(null, { limit: 5, depth: 0, sort: "new" });
    await findBlogPostsForViewer(null, { limit: 4, depth: 1, sort: "new" });
    await findBlogPostsForViewer(null, {
      limit: 4,
      depth: 0,
      sort: "new",
      seriesId: 10,
    });
    await findBlogPostsForViewer(null, {
      limit: 4,
      depth: 0,
      sort: "new",
      seriesId: 11,
    });

    expect(mocks.find).toHaveBeenCalledTimes(7);
    expect(mocks.find.mock.calls.map(([query]) => query.where?.slug?.equals)
      .filter(Boolean)).toEqual(["article-a", "article-b"]);
    expect(mocks.find.mock.calls.slice(2).map(([query]) => query.where?.series))
      .toEqual([undefined, undefined, undefined, { equals: 10 }, { equals: 11 }]);
  });

  it.each([
    [{ id: 1, role: "admin" }, { status: { equals: "published" } }],
    [{ id: 2, role: "editor" }, { status: { equals: "published" } }],
    [
      { id: 3, role: "viewer" },
      {
        status: { equals: "published" },
        visibility: { equals: "public" },
      },
    ],
  ])("bypasses shared cache for the logged-in viewer %#", async (viewer, where) => {
    const { findBlogPostsForViewer } = await loadCacheModule();

    await findBlogPostsForViewer(viewer, { limit: 4, depth: 0 });
    await findBlogPostsForViewer(viewer, { limit: 4, depth: 0 });

    expect(mocks.find).toHaveBeenCalledTimes(2);
    expect(mocks.unstableCache).not.toHaveBeenCalled();
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it("loads Next cache APIs lazily for invalidation", async () => {
    const { revalidateVisitorContent } = await loadCacheModule();
    await revalidateVisitorContent();
    expect(mocks.revalidateTag).toHaveBeenCalledWith("content", { expire: 0 });
  });
});
