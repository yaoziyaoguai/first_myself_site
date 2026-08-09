import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));

import { getComments, toPublicComment } from "@/lib/comments.server";
import { getPayloadAPI } from "@/lib/payload";

describe("toPublicComment", () => {
  it("projects only fields needed by the public UI", () => {
    const result = toPublicComment({
      id: "comment-1",
      targetId: "post-1",
      targetType: "blog",
      parentId: null,
      content: "公开内容",
      authorName: "访客",
      createdAt: "2026-08-10T00:00:00.000Z",
      authorEmail: "private@example.com",
      ipHash: "private-ip-hash",
      fingerprint: "private-fingerprint",
      isDeleted: false,
      deletedBy: null,
      updatedAt: "2026-08-10T00:01:00.000Z",
    });

    expect(result).toEqual({
      id: "comment-1",
      targetId: "post-1",
      targetType: "blog",
      parentId: null,
      content: "公开内容",
      authorName: "访客",
      createdAt: "2026-08-10T00:00:00.000Z",
    });
  });
});

describe("getComments", () => {
  it("loads one page of comments and their direct replies in two queries", async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [
          {
            id: "comment-1",
            targetId: "post-1",
            targetType: "blog",
            parentId: null,
            content: "顶层评论",
            authorName: "访客",
            createdAt: "2026-08-10T00:00:00.000Z",
          },
        ],
        totalDocs: 1,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: "reply-1",
            targetId: "post-1",
            targetType: "blog",
            parentId: "comment-1",
            content: "直接回复",
            authorName: "访客",
            createdAt: "2026-08-10T00:01:00.000Z",
          },
        ],
      });
    vi.mocked(getPayloadAPI).mockResolvedValue({ find } as never);

    const result = await getComments("post-1", "blog");

    expect(find).toHaveBeenCalledTimes(2);
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: "comments",
        where: expect.objectContaining({
          and: expect.arrayContaining([
            { parentId: { in: ["comment-1"] } },
          ]),
        }),
      }),
    );
    expect(result.docs[0].replies).toEqual([
      expect.objectContaining({ id: "reply-1", content: "直接回复" }),
    ]);
  });
});
