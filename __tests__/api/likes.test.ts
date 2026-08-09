import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/likes.server", () => ({
  createLike: vi.fn(),
  getLikeStatus: vi.fn(),
  targetExists: vi.fn(),
}));
vi.mock("@/lib/requestIdentity", () => ({
  deriveRequestIdentity: vi.fn(() => ({
    ipHash: "server-ip-hash",
    fingerprint: "server-fingerprint",
    rateLimitKey: "server-rate-key",
  })),
}));
vi.mock("@/lib/rateLimit", () => ({ isRateLimited: vi.fn(() => false) }));

import { POST } from "@/app/api/likes/route";
import { createLike, getLikeStatus, targetExists } from "@/lib/likes.server";
import { isRateLimited } from "@/lib/rateLimit";

describe("POST /api/likes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(targetExists).mockResolvedValue(true);
    vi.mocked(createLike).mockResolvedValue(undefined);
    vi.mocked(getLikeStatus).mockResolvedValue({ count: 3, hasLiked: true });
  });

  it("ignores forged identity and returns status rather than a stored record", async () => {
    const response = await POST(
      new Request("https://example.com/api/likes", {
        method: "POST",
        body: JSON.stringify({
          targetId: "post-1",
          targetType: "blog",
          ipHash: "forged-ip",
          fingerprint: "forged-fingerprint",
        }),
      }) as never,
    );

    expect(response.status).toBe(201);
    expect(createLike).toHaveBeenCalledWith({
      targetId: "post-1",
      targetType: "blog",
      ipHash: "server-ip-hash",
      fingerprint: "server-fingerprint",
    });
    expect(await response.json()).toEqual({ count: 3, hasLiked: true });
  });

  it("rejects invalid target types", async () => {
    const response = await POST(
      new Request("https://example.com/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetId: "post-1", targetType: "user" }),
      }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for a missing target", async () => {
    vi.mocked(targetExists).mockResolvedValue(false);
    const response = await POST(
      new Request("https://example.com/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetId: "missing", targetType: "blog" }),
      }) as never,
    );
    expect(response.status).toBe(404);
  });

  it("returns 409 for a duplicate like", async () => {
    vi.mocked(createLike).mockRejectedValue(new Error("LIKE_ALREADY_EXISTS"));
    const response = await POST(
      new Request("https://example.com/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetId: "post-1", targetType: "blog" }),
      }) as never,
    );
    expect(response.status).toBe(409);
  });

  it("returns 429 for a throttled server-derived identity", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const response = await POST(
      new Request("https://example.com/api/likes", {
        method: "POST",
        body: JSON.stringify({ targetId: "post-1", targetType: "blog" }),
      }) as never,
    );
    expect(response.status).toBe(429);
  });
});
