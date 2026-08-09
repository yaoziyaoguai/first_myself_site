import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));

import {
  parentMatchesTarget,
  targetExists,
} from "@/lib/interactionTarget.server";
import { getPayloadAPI } from "@/lib/payload";

describe("interaction target validation", () => {
  const count = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    count.mockResolvedValue({ totalDocs: 1 });
    vi.mocked(getPayloadAPI).mockResolvedValue({ count } as never);
  });

  it("requires a published public blog target", async () => {
    await expect(targetExists("post-1", "blog")).resolves.toBe(true);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "blog",
        where: {
          and: [
            { id: { equals: "post-1" } },
            { status: { equals: "published" }, visibility: { equals: "public" } },
          ],
        },
        overrideAccess: true,
      }),
    );
  });

  it("checks project targets by ID", async () => {
    await expect(targetExists("project-1", "project")).resolves.toBe(true);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "projects",
        where: { id: { equals: "project-1" } },
      }),
    );
  });

  it("accepts only a non-deleted top-level parent on the same target", async () => {
    await expect(parentMatchesTarget("comment-1", "post-1", "blog")).resolves.toBe(true);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "comments",
        where: {
          and: [
            { id: { equals: "comment-1" } },
            { targetId: { equals: "post-1" } },
            { targetType: { equals: "blog" } },
            { isDeleted: { equals: false } },
            { parentId: { exists: false } },
          ],
        },
        overrideAccess: true,
      }),
    );
  });

  it("returns false when the target query has no match", async () => {
    count.mockResolvedValue({ totalDocs: 0 });
    await expect(targetExists("private", "blog")).resolves.toBe(false);
  });
});
