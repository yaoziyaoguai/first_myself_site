import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));

import { GET } from "@/app/api/health/route";
import { getPayloadAPI } from "@/lib/payload";

describe("GET /api/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports ready after a minimal database-backed query", async () => {
    const find = vi.fn().mockResolvedValue({ totalDocs: 1, docs: [{ id: "1" }] });
    vi.mocked(getPayloadAPI).mockResolvedValue({ find } as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        limit: 1,
        overrideAccess: true,
      }),
    );
  });

  it("returns a generic unavailable response without leaking errors", async () => {
    vi.mocked(getPayloadAPI).mockRejectedValue(
      new Error("postgresql://secret-user:secret-password@db/private"),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
    expect(JSON.stringify(body)).not.toContain("postgresql");
    expect(JSON.stringify(body)).not.toContain("secret-password");
  });
});
