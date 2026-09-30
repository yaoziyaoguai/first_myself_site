import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateVisitorContent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/visitorContentCache", () => ({ revalidateVisitorContent }));

import Blog from "@/payload/collections/Blog";
import BlogSeries from "@/payload/collections/BlogSeries";

const publicPost = {
  id: 1,
  status: "published",
  visibility: "public",
};
const privatePost = { ...publicPost, visibility: "private" };
const draftPost = { ...publicPost, status: "draft" };
const publishedSeries = { id: 10, status: "published" };
const draftSeries = { ...publishedSeries, status: "draft" };

function hookAt(
  hooks: unknown[] | undefined,
  index: number,
): (args: Record<string, unknown>) => Promise<unknown> {
  const hook = hooks?.[index];
  if (typeof hook !== "function") throw new Error(`Missing hook at index ${index}`);
  return hook as (args: Record<string, unknown>) => Promise<unknown>;
}

describe("visitor cache invalidation hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revalidateVisitorContent.mockResolvedValue(undefined);
  });

  it("disables Payload bulk mutations that cannot roll back per-document hook failures", () => {
    expect(Blog).toMatchObject({ disableBulkEdit: true, disableBulkDelete: true });
    expect(BlogSeries).toMatchObject({ disableBulkEdit: true, disableBulkDelete: true });
  });

  it("invalidates every Blog create, update, and delete", async () => {
    const afterChange = hookAt(Blog.hooks?.afterChange, 0);
    const afterDelete = hookAt(Blog.hooks?.afterDelete, 0);

    await afterChange({ doc: publicPost, previousDoc: {}, operation: "create" });
    await afterChange({
      doc: { ...publicPost, title: "更新后的标题" },
      previousDoc: publicPost,
      operation: "update",
    });
    await afterDelete({ doc: privatePost });

    expect(revalidateVisitorContent).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["private", privatePost],
    ["draft", draftPost],
  ])("fails closed when a public Blog becomes %s", async (_, nextDoc) => {
    const afterChange = hookAt(Blog.hooks?.afterChange, 0);
    revalidateVisitorContent.mockRejectedValue(new Error("cache unavailable"));

    await expect(afterChange({
      doc: nextDoc,
      previousDoc: publicPost,
      operation: "update",
    })).rejects.toThrow("cache unavailable");
  });

  it("fails closed when deleting a public Blog but keeps TTL fallback for private content", async () => {
    const afterDelete = hookAt(Blog.hooks?.afterDelete, 0);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    revalidateVisitorContent.mockRejectedValue(new Error("cache unavailable"));

    await expect(afterDelete({ doc: publicPost })).rejects.toThrow("cache unavailable");
    await expect(afterDelete({ doc: privatePost })).resolves.toEqual(privatePost);
    expect(warn).toHaveBeenCalledWith(
      "[cache] revalidate after blog delete failed:",
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it("keeps normal Blog updates available while warning about delayed freshness", async () => {
    const afterChange = hookAt(Blog.hooks?.afterChange, 0);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    revalidateVisitorContent.mockRejectedValue(new Error("cache unavailable"));

    await expect(afterChange({
      doc: { ...publicPost, title: "新标题" },
      previousDoc: publicPost,
      operation: "update",
    })).resolves.toMatchObject({ title: "新标题" });
    expect(warn).toHaveBeenCalledWith(
      "[cache] revalidate after blog change failed:",
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it("invalidates BlogSeries only after article membership is saved", async () => {
    const afterChange = BlogSeries.hooks?.afterChange;
    expect(afterChange).toHaveLength(2);
    const saveMembership = hookAt(afterChange, 0);
    const invalidate = hookAt(afterChange, 1);

    const args = {
      data: { title: "新名称" },
      doc: publishedSeries,
      previousDoc: publishedSeries,
      req: { payload: {} },
    };
    await saveMembership(args);
    expect(revalidateVisitorContent).not.toHaveBeenCalled();
    await invalidate(args);
    expect(revalidateVisitorContent).toHaveBeenCalledTimes(1);
  });

  it("fails closed when hiding or deleting a published BlogSeries", async () => {
    const afterChange = hookAt(BlogSeries.hooks?.afterChange, 1);
    const afterDelete = hookAt(BlogSeries.hooks?.afterDelete, 0);
    revalidateVisitorContent.mockRejectedValue(new Error("cache unavailable"));

    await expect(afterChange({
      doc: draftSeries,
      previousDoc: publishedSeries,
      operation: "update",
    })).rejects.toThrow("cache unavailable");
    await expect(afterDelete({ doc: publishedSeries }))
      .rejects.toThrow("cache unavailable");
  });
});
