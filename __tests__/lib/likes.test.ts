import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  createLike,
  getLikeCount,
  getLikeStatus,
  hasLiked,
} from "@/lib/likes";

describe("likes utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it("gets server-derived like status without client identity fields", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ count: 100, hasLiked: true }),
    });

    expect(await getLikeStatus("blog-123", "blog")).toEqual({
      count: 100,
      hasLiked: true,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/likes?targetId=blog-123&targetType=blog",
    );
  });

  it("throws when status loading fails", async () => {
    (global.fetch as Mock).mockResolvedValueOnce({ ok: false });
    await expect(getLikeStatus("blog-123", "blog")).rejects.toThrow(
      "Failed to fetch like status",
    );
  });

  it("returns count and current visitor status", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 42, hasLiked: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 42, hasLiked: true }),
      });

    expect(await getLikeCount("blog-123", "blog")).toBe(42);
    expect(await hasLiked("blog-123", "blog")).toBe(true);
  });

  it("creates a like without sending hashes or fingerprints", async () => {
    const status = { count: 3, hasLiked: true };
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(status),
    });

    expect(
      await createLike({ targetId: "blog-123", targetType: "blog" }),
    ).toEqual(status);
    expect(global.fetch).toHaveBeenCalledWith("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: "blog-123", targetType: "blog" }),
    });
  });

  it("keeps duplicate and server error messages", async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "您已经点赞过了" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "database error" }),
      });

    await expect(
      createLike({ targetId: "blog-123", targetType: "blog" }),
    ).rejects.toThrow("已经点赞");
    await expect(
      createLike({ targetId: "blog-123", targetType: "blog" }),
    ).rejects.toThrow("database error");
  });
});
