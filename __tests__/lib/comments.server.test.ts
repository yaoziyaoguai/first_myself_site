import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));

import { toPublicComment } from "@/lib/comments.server";

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
