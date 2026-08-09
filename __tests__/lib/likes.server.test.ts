import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));

import {
  createLike,
  getLikeCount,
  getLikeStatus,
} from "@/lib/likes.server";
import { getPayloadAPI } from "@/lib/payload";

describe("likes server service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts likes without loading stored documents", async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce({ totalDocs: 4 })
      .mockResolvedValueOnce({ totalDocs: 1 });
    vi.mocked(getPayloadAPI).mockResolvedValue({ count } as never);

    await expect(
      getLikeStatus("post-1", "blog", {
        ipHash: "ip-hash",
        fingerprint: "fingerprint",
      }),
    ).resolves.toEqual({ count: 4, hasLiked: true });
    expect(count).toHaveBeenCalledTimes(2);
  });

  it("relies on the unique index and maps duplicate errors", async () => {
    const create = vi
      .fn()
      .mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    const find = vi.fn();
    vi.mocked(getPayloadAPI).mockResolvedValue({ create, find } as never);

    await expect(
      createLike({
        targetId: "post-1",
        targetType: "blog",
        ipHash: "ip-hash",
        fingerprint: "fingerprint",
      }),
    ).rejects.toThrow("LIKE_ALREADY_EXISTS");
    expect(find).not.toHaveBeenCalled();
  });

  it("uses count for the total", async () => {
    const count = vi.fn().mockResolvedValue({ totalDocs: 7 });
    vi.mocked(getPayloadAPI).mockResolvedValue({ count } as never);

    await expect(getLikeCount("post-1", "blog")).resolves.toBe(7);
  });
});
