import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockRecordPageView, mockUpdatePageView, mockIsRateLimited } =
  vi.hoisted(() => ({
    mockRecordPageView: vi.fn(),
    mockUpdatePageView: vi.fn(),
    mockIsRateLimited: vi.fn(),
  }));

vi.mock("@/lib/analytics.server", () => ({
  recordPageView: mockRecordPageView,
  updatePageView: mockUpdatePageView,
}));
vi.mock("@/lib/requestIdentity", () => ({
  deriveRequestIdentity: vi.fn(() => ({
    fingerprint: "server-derived-visitor-hash",
    rateLimitKey: "server-rate-key",
  })),
}));
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: mockIsRateLimited,
}));

import { POST } from "@/app/api/analytics/route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/analytics", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      ...headers,
    },
  });
}

describe("POST /api/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRateLimited.mockReturnValue(false);
    mockRecordPageView.mockResolvedValue({ id: 1 });
    mockUpdatePageView.mockResolvedValue({ id: 1 });
  });

  it("records a valid start with the server-derived anonymous identity", async () => {
    const response = await POST(
      request({
        event: "start",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/blog/memory",
        title: "Memory benchmark",
        referrer: "https://example.com/source",
        visitorHash: "forged-client-value",
      }),
    );

    expect(response.status).toBe(201);
    expect(mockRecordPageView).toHaveBeenCalledWith(
      {
        event: "start",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/blog/memory",
        title: "Memory benchmark",
        referrerHost: "example.com",
      },
      "server-derived-visitor-hash",
    );
  });

  it("rejects malformed events without writing", async () => {
    const response = await POST(request({ event: "start", path: "/" }));

    expect(response.status).toBe(400);
    expect(mockRecordPageView).not.toHaveBeenCalled();
    expect(mockUpdatePageView).not.toHaveBeenCalled();
  });

  it("updates an existing session heartbeat", async () => {
    const response = await POST(
      request({
        event: "heartbeat",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/blog/memory",
        title: "Memory benchmark",
        referrer: "",
        engagedSeconds: 45,
        scrollDepth: 82,
      }),
    );

    expect(response.status).toBe(200);
    expect(mockUpdatePageView).toHaveBeenCalledWith(
      {
        event: "heartbeat",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/blog/memory",
        title: "Memory benchmark",
        referrerHost: "",
        engagedSeconds: 45,
        scrollDepth: 82,
      },
      "server-derived-visitor-hash",
    );
  });

  it("rejects cross-origin and non-JSON submissions before persistence", async () => {
    const event = {
      event: "start",
      sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      path: "/",
    };

    expect(
      (await POST(request(event, { origin: "https://attacker.example" })))
        .status,
    ).toBe(403);
    expect(
      (await POST(request(event, { "content-type": "text/plain" }))).status,
    ).toBe(415);
    expect(mockRecordPageView).not.toHaveBeenCalled();
  });

  it("returns 404 when a session belongs to another anonymous visitor", async () => {
    mockUpdatePageView.mockResolvedValue(null);
    const response = await POST(
      request({
        event: "heartbeat",
        sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        path: "/blog/memory",
        engagedSeconds: 1,
        scrollDepth: 10,
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Analytics session not found",
    });
  });

  it("returns 429 for excess traffic and 500 for persistence failures", async () => {
    mockIsRateLimited.mockReturnValueOnce(true);
    expect(
      (
        await POST(
          request({
            event: "start",
            sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
            path: "/",
          }),
        )
      ).status,
    ).toBe(429);

    mockIsRateLimited.mockReturnValue(false);
    mockRecordPageView.mockRejectedValueOnce(new Error("database unavailable"));
    expect(
      (
        await POST(
          request({
            event: "start",
            sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
            path: "/",
          }),
        )
      ).status,
    ).toBe(500);
  });
});
