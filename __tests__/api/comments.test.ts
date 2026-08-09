import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/comments.server", () => ({
  createComment: vi.fn(),
  getComments: vi.fn(),
  getReplies: vi.fn(),
  softDeleteComment: vi.fn(),
}));
vi.mock("@/lib/interactionTarget.server", () => ({
  targetExists: vi.fn(),
  parentMatchesTarget: vi.fn(),
}));
vi.mock("@/lib/requestIdentity", () => ({
  deriveRequestIdentity: vi.fn(() => ({
    ipHash: "server-ip-hash",
    fingerprint: "server-fingerprint",
    rateLimitKey: "server-rate-key",
  })),
}));
vi.mock("@/lib/rateLimit", () => ({ isRateLimited: vi.fn(() => false) }));
vi.mock("@/lib/auth", () => ({ isAdmin: vi.fn(() => false) }));

import { POST } from "@/app/api/comments/route";
import { createComment } from "@/lib/comments.server";
import { targetExists } from "@/lib/interactionTarget.server";
import { isRateLimited } from "@/lib/rateLimit";

const privateStoredComment = {
  id: "comment-1",
  targetId: "post-1",
  targetType: "blog",
  parentId: null,
  content: "你好",
  authorName: "访客",
  authorEmail: "private@example.com",
  ipHash: "stored-ip",
  fingerprint: "stored-fingerprint",
  isDeleted: false,
  deletedBy: null,
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

describe("POST /api/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(targetExists).mockResolvedValue(true);
    vi.mocked(createComment).mockResolvedValue({
      id: "comment-1",
      targetId: "post-1",
      targetType: "blog",
      parentId: null,
      content: "你好",
      authorName: "访客",
      createdAt: "2026-08-10T00:00:00.000Z",
    });
  });

  it("ignores forged client identity and returns a public DTO", async () => {
    const response = await POST(
      new Request("https://example.com/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetId: "post-1",
          targetType: "blog",
          content: "  你好  ",
          authorName: "访客",
          authorEmail: "private@example.com",
          ipHash: "forged-ip",
          fingerprint: "forged-fingerprint",
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "你好",
        ipHash: "server-ip-hash",
        fingerprint: "server-fingerprint",
      }),
    );
    const body = await response.json();
    for (const field of [
      "authorEmail",
      "ipHash",
      "fingerprint",
      "isDeleted",
      "deletedBy",
      "updatedAt",
    ]) {
      expect(body).not.toHaveProperty(field);
    }
    expect(JSON.stringify(body)).not.toContain(privateStoredComment.authorEmail);
  });

  it.each([
    [{ targetId: "post-1", targetType: "unknown", content: "hi" }, 400],
    [{ targetId: "post-1", targetType: "blog", content: "   " }, 400],
    [{ targetId: "post-1", targetType: "blog", content: "x".repeat(1001) }, 400],
    [
      {
        targetId: "post-1",
        targetType: "blog",
        content: "hi",
        authorEmail: "not-an-email",
      },
      400,
    ],
  ])("rejects invalid input %#", async (body, status) => {
    const response = await POST(
      new Request("https://example.com/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as never,
    );
    expect(response.status).toBe(status);
    expect(createComment).not.toHaveBeenCalled();
  });

  it("returns 404 when the public target does not exist", async () => {
    vi.mocked(targetExists).mockResolvedValue(false);
    const response = await POST(
      new Request("https://example.com/api/comments", {
        method: "POST",
        body: JSON.stringify({ targetId: "missing", targetType: "blog", content: "hi" }),
      }) as never,
    );
    expect(response.status).toBe(404);
  });

  it("returns 429 for a throttled server-derived identity", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const response = await POST(
      new Request("https://example.com/api/comments", {
        method: "POST",
        body: JSON.stringify({ targetId: "post-1", targetType: "blog", content: "hi" }),
      }) as never,
    );
    expect(response.status).toBe(429);
  });
});
