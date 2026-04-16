import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import {
  getComments,
  getReplies,
  buildCommentTree,
  createComment,
  softDeleteComment,
  getCommentCount,
  type Comment,
} from "@/lib/comments";

describe("comments utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  describe("getComments", () => {
    it("should fetch top-level comments for a target", async () => {
      const mockComments = [
        { id: "1", content: "Comment 1", parentId: null },
        { id: "2", content: "Comment 2", parentId: null },
      ];

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            docs: mockComments,
            totalDocs: 2,
            totalPages: 1,
          }),
      });

      const result = await getComments("blog-123", "blog");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/comments?targetId=blog-123&targetType=blog&page=1"
      );
      expect(result.docs).toHaveLength(2);
      expect(result.totalDocs).toBe(2);
    });

    it("should support pagination", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            docs: [],
            totalDocs: 0,
            totalPages: 0,
          }),
      });

      await getComments("blog-123", "blog", 20, 2);

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/comments?targetId=blog-123&targetType=blog&page=2"
      );
    });

    it("should throw error when fetch fails", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
      });

      await expect(getComments("blog-123", "blog")).rejects.toThrow(
        "Failed to fetch comments"
      );
    });
  });

  describe("getReplies", () => {
    it("should fetch replies for a parent comment", async () => {
      const mockReplies = [
        { id: "2", content: "Reply 1", parentId: "1" },
        { id: "3", content: "Reply 2", parentId: "1" },
      ];

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            docs: mockReplies,
          }),
      });

      const result = await getReplies("1");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/comments?targetId=dummy&targetType=blog&parentId=1"
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("buildCommentTree", () => {
    it("should organize comments into tree structure", () => {
      const comments: Comment[] = [
        {
          id: "1",
          content: "Top level 1",
          parentId: null,
        } as Comment,
        {
          id: "2",
          content: "Top level 2",
          parentId: null,
        } as Comment,
        {
          id: "3",
          content: "Reply to 1",
          parentId: "1",
        } as Comment,
        {
          id: "4",
          content: "Reply to 3",
          parentId: "3",
        } as Comment,
      ];

      const tree = buildCommentTree(comments);

      expect(tree).toHaveLength(2);
      expect(tree[0].replies).toHaveLength(1);
      expect(tree[0].replies?.[0].id).toBe("3");
    });

    it("should respect maxDepth limit", () => {
      const comments: Comment[] = [
        { id: "1", content: "Level 1", parentId: null } as Comment,
        { id: "2", content: "Level 2", parentId: "1" } as Comment,
        { id: "3", content: "Level 3", parentId: "2" } as Comment,
        { id: "4", content: "Level 4", parentId: "3" } as Comment,
        { id: "5", content: "Level 5", parentId: "4" } as Comment,
        { id: "6", content: "Level 6", parentId: "5" } as Comment,
      ];

      const tree = buildCommentTree(comments, 3);

      // With maxDepth 3, it should stop attaching replies
      expect(tree).toHaveLength(1);
    });

    it("should handle empty array", () => {
      const tree = buildCommentTree([]);
      expect(tree).toEqual([]);
    });
  });

  describe("createComment", () => {
    it("should create a comment with default author name", async () => {
      const mockComment = {
        id: "new-1",
        content: "Test comment",
        authorName: "匿名用户",
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockComment),
      });

      const result = await createComment({
        targetId: "blog-123",
        targetType: "blog",
        content: "Test comment",
        ipHash: "hash123",
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: "blog-123",
          targetType: "blog",
          content: "Test comment",
          ipHash: "hash123",
        }),
      });
      expect(result.authorName).toBe("匿名用户");
    });

    it("should use provided author name", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "new-2" }),
      });

      await createComment({
        targetId: "blog-123",
        targetType: "blog",
        content: "Test",
        authorName: "John",
        ipHash: "hash123",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/comments",
        expect.objectContaining({
          body: expect.stringContaining("John"),
        })
      );
    });

    it("should throw error when create fails", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Failed" }),
      });

      await expect(
        createComment({
          targetId: "blog-123",
          targetType: "blog",
          content: "Test",
          ipHash: "hash123",
        })
      ).rejects.toThrow();
    });
  });

  describe("softDeleteComment", () => {
    it("should call API to mark comment as deleted", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "1",
            isDeleted: true,
            deletedBy: "admin",
          }),
      });

      const result = await softDeleteComment("1");

      expect(global.fetch).toHaveBeenCalledWith("/api/comments?id=1", {
        method: "PATCH",
      });
      expect(result.isDeleted).toBe(true);
    });
  });

  describe("getCommentCount", () => {
    it("should return count from getComments totalDocs", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            docs: [],
            totalDocs: 5,
            totalPages: 1,
          }),
      });

      const count = await getCommentCount("blog-123", "blog");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/comments?targetId=blog-123&targetType=blog&page=1"
      );
      expect(count).toBe(5);
    });
  });
});
