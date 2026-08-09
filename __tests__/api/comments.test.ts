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

import { GET, PATCH, POST } from "@/app/api/comments/route";
import {
  createComment,
  getComments,
  getReplies,
  softDeleteComment,
} from "@/lib/comments.server";
import {
  parentMatchesTarget,
  targetExists,
} from "@/lib/interactionTarget.server";
import { isRateLimited } from "@/lib/rateLimit";
import { isAdmin } from "@/lib/auth";

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
    vi.mocked(isRateLimited).mockReturnValue(false);
    vi.mocked(targetExists).mockResolvedValue(true);
    vi.mocked(parentMatchesTarget).mockResolvedValue(true);
    vi.mocked(isAdmin).mockResolvedValue(false);
    vi.mocked(createComment).mockResolvedValue({
      id: "comment-1",
      targetId: "post-1",
      targetType: "blog",
      parentId: null,
      content: "你好",
      authorName: "访客",
      createdAt: "2026-08-10T00:00:00.000Z",
    });
    vi.mocked(getComments).mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0 });
    vi.mocked(getReplies).mockResolvedValue([]);
    vi.mocked(softDeleteComment).mockResolvedValue({ id: "comment-1" });
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

  it.each([null, 7, [], "comment"])(
    "rejects a non-object JSON body %#",
    async (body) => {
      const response = await POST(
        new Request("https://example.com/api/comments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }) as never,
      );
      expect(response.status).toBe(400);
      expect(createComment).not.toHaveBeenCalled();
    },
  );

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

  it("rejects a reply whose parent is not a top-level comment on the target", async () => {
    vi.mocked(parentMatchesTarget).mockResolvedValue(false);
    const response = await POST(
      new Request("https://example.com/api/comments", {
        method: "POST",
        body: JSON.stringify({
          targetId: "post-1",
          targetType: "blog",
          parentId: "nested-reply",
          content: "hi",
        }),
      }) as never,
    );
    expect(response.status).toBe(404);
    expect(createComment).not.toHaveBeenCalled();
  });
});

describe("GET /api/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(targetExists).mockResolvedValue(true);
    vi.mocked(parentMatchesTarget).mockResolvedValue(true);
    vi.mocked(getComments).mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0 });
    vi.mocked(getReplies).mockResolvedValue([]);
  });

  it("rejects an invalid target", async () => {
    const response = await GET(
      new Request("https://example.com/api/comments?targetId=post-1&targetType=user") as never,
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for a non-public target", async () => {
    vi.mocked(targetExists).mockResolvedValue(false);
    const response = await GET(
      new Request("https://example.com/api/comments?targetId=private&targetType=blog") as never,
    );
    expect(response.status).toBe(404);
  });

  it.each([
    ["0", 1],
    ["999999", 1000],
  ])("normalizes page %s to %i", async (input, expected) => {
    const response = await GET(
      new Request(
        `https://example.com/api/comments?targetId=post-1&targetType=blog&page=${input}`,
      ) as never,
    );
    expect(response.status).toBe(200);
    expect(getComments).toHaveBeenCalledWith("post-1", "blog", 10, expected);
    expect(await response.json()).toEqual({ docs: [], totalDocs: 0, totalPages: 0 });
  });

  it("returns replies only for a matching top-level parent", async () => {
    vi.mocked(getReplies).mockResolvedValue([
      {
        id: "reply-1",
        targetId: "post-1",
        targetType: "blog",
        parentId: "comment-1",
        content: "回复",
        authorName: "访客",
        createdAt: "2026-08-10T00:00:00.000Z",
      },
    ]);
    const response = await GET(
      new Request(
        "https://example.com/api/comments?targetId=post-1&targetType=blog&parentId=comment-1",
      ) as never,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ docs: [expect.objectContaining({ id: "reply-1" })] });

    vi.mocked(parentMatchesTarget).mockResolvedValue(false);
    const missing = await GET(
      new Request(
        "https://example.com/api/comments?targetId=post-1&targetType=blog&parentId=nested-reply",
      ) as never,
    );
    expect(missing.status).toBe(404);
  });
});

describe("PATCH /api/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAdmin).mockResolvedValue(false);
    vi.mocked(softDeleteComment).mockResolvedValue({ id: "comment-1" });
  });

  it("rejects unauthenticated moderation", async () => {
    const response = await PATCH(
      new Request("https://example.com/api/comments?id=comment-1", { method: "PATCH" }) as never,
    );
    expect(response.status).toBe(403);
    expect(softDeleteComment).not.toHaveBeenCalled();
  });

  it("soft-deletes a comment for an admin", async () => {
    vi.mocked(isAdmin).mockResolvedValue(true);
    const response = await PATCH(
      new Request("https://example.com/api/comments?id=comment-1", { method: "PATCH" }) as never,
    );
    expect(response.status).toBe(200);
    expect(softDeleteComment).toHaveBeenCalledWith("comment-1");
    expect(await response.json()).toEqual({ id: "comment-1" });
  });
});
