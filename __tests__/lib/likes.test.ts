import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import {
  getLikeCount,
  hasLiked,
  createLike,
  getLikeStatus,
  type Like,
} from "@/lib/likes";

describe("likes utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  describe("getLikeStatus", () => {
    it("should return count and hasLiked status", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 100,
            hasLiked: true,
          }),
      });

      const status = await getLikeStatus(
        "blog-123",
        "blog",
        "ip-hash-1",
        "fingerprint-1"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/likes?targetId=blog-123&targetType=blog&ipHash=ip-hash-1&fingerprint=fingerprint-1"
      );
      expect(status.count).toBe(100);
      expect(status.hasLiked).toBe(true);
    });

    it("should throw error when fetch fails", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
      });

      await expect(
        getLikeStatus("blog-123", "blog", "ip-hash-1", "fingerprint-1")
      ).rejects.toThrow("Failed to fetch like status");
    });
  });

  describe("getLikeCount", () => {
    it("should return count from status", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 42,
            hasLiked: false,
          }),
      });

      const count = await getLikeCount("blog-123", "blog");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/likes?targetId=blog-123&targetType=blog&ipHash=&fingerprint="
      );
      expect(count).toBe(42);
    });

    it("should return 0 when no likes", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 0,
            hasLiked: false,
          }),
      });

      const count = await getLikeCount("blog-456", "blog");

      expect(count).toBe(0);
    });
  });

  describe("hasLiked", () => {
    it("should return true if user has already liked", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 10,
            hasLiked: true,
          }),
      });

      const result = await hasLiked(
        "blog-123",
        "blog",
        "ip-hash-1",
        "fingerprint-1"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/likes?targetId=blog-123&targetType=blog&ipHash=ip-hash-1&fingerprint=fingerprint-1"
      );
      expect(result).toBe(true);
    });

    it("should return false if user has not liked", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            count: 10,
            hasLiked: false,
          }),
      });

      const result = await hasLiked(
        "blog-123",
        "blog",
        "ip-hash-2",
        "fingerprint-2"
      );

      expect(result).toBe(false);
    });
  });

  describe("createLike", () => {
    it("should create like successfully", async () => {
      const mockLike: Partial<Like> = {
        id: "new-like-1",
        targetId: "blog-123",
        targetType: "blog",
        ipHash: "ip-hash-1",
        fingerprint: "fingerprint-1",
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLike),
      });

      const result = await createLike({
        targetId: "blog-123",
        targetType: "blog",
        ipHash: "ip-hash-1",
        fingerprint: "fingerprint-1",
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: "blog-123",
          targetType: "blog",
          ipHash: "ip-hash-1",
          fingerprint: "fingerprint-1",
        }),
      });
      expect(result).toEqual(mockLike);
    });

    it("should throw error with duplicate message when 409", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "您已经点赞过了" }),
      });

      await expect(
        createLike({
          targetId: "blog-123",
          targetType: "blog",
          ipHash: "ip-hash-1",
          fingerprint: "fingerprint-1",
        })
      ).rejects.toThrow("已经点赞");
    });

    it("should throw error when create fails", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "database error" }),
      });

      await expect(
        createLike({
          targetId: "blog-123",
          targetType: "blog",
          ipHash: "ip-hash-1",
          fingerprint: "fingerprint-1",
        })
      ).rejects.toThrow("database error");
    });
  });
});
