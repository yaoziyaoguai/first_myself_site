import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("@/lib/payload", () => ({
  getPayloadAPI: vi.fn(async () => ({
    db: { pool: { query: mockQuery } },
  })),
}));

import {
  readAnalyticsSummary,
  recordPageView,
  startOfShanghaiDayWindow,
  updatePageView,
} from "@/lib/analytics.server";

const context = {
  sessionId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
  path: "/blog/memory",
  title: "Memory benchmark",
  referrerHost: "www.google.com",
};
const identity = {
  visitorHash: "anonymous-visitor-hash",
  networkPrefix: "203.0.113.0/24",
  isOwner: false,
};

describe("analytics server persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [{ id: 42 }] });
  });

  it("uses one conflict-safe statement for start writes", async () => {
    await recordPageView({ event: "start", ...context }, identity);

    const [statement, values] = mockQuery.mock.calls[0];
    expect(statement).toContain("INSERT INTO page_views");
    expect(statement).toContain("ON CONFLICT (session_id) DO UPDATE");
    expect(statement).toContain(
      "page_views.visitor_hash = EXCLUDED.visitor_hash",
    );
    expect(statement).toContain("network_prefix");
    expect(statement).toContain("is_owner");
    expect(statement).toContain(
      "network_prefix = EXCLUDED.network_prefix",
    );
    expect(statement).toContain(
      "is_owner = page_views.is_owner OR EXCLUDED.is_owner",
    );
    expect(values).toEqual([
      context.sessionId,
      "anonymous-visitor-hash",
      "203.0.113.0/24",
      false,
      context.path,
      context.title,
      context.referrerHost,
      0,
      0,
    ]);
  });

  it("lets a heartbeat create the row and atomically preserves collected maxima", async () => {
    await updatePageView(
      {
        event: "heartbeat",
        ...context,
        engagedSeconds: 20,
        scrollDepth: 90,
      },
      identity,
    );

    const [statement, values] = mockQuery.mock.calls[0];
    expect(statement).toContain(
      "engaged_seconds = GREATEST(page_views.engaged_seconds, EXCLUDED.engaged_seconds)",
    );
    expect(statement).toContain(
      "max_scroll_depth = GREATEST(page_views.max_scroll_depth, EXCLUDED.max_scroll_depth)",
    );
    expect(values.slice(-2)).toEqual([20, 90]);
  });

  it("reports a visitor/session conflict when the upsert updates no row", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await expect(
      updatePageView(
        {
          event: "heartbeat",
          ...context,
          engagedSeconds: 20,
          scrollDepth: 90,
        },
        { ...identity, visitorHash: "different-visitor-hash" },
      ),
    ).resolves.toBeNull();
  });

  it("aggregates the complete window in PostgreSQL instead of truncating rows", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            views: 12_345,
            visitors: 456,
            average_engaged_seconds: 37,
            median_engaged_seconds: 19,
            average_scroll_depth: 68,
            recent_views: 123,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ path: "/blog/memory", title: "Memory", views: 99 }],
      })
      .mockResolvedValueOnce({
        rows: [
          { date: "08-03", views: 5, visitors: 3 },
          { date: "08-04", views: 0, visitors: 0 },
        ],
      });

    await expect(
      readAnalyticsSummary(
        new Date("2026-08-03T00:00:00.000Z"),
        new Date("2026-08-09T00:00:00.000Z"),
        new Date("2026-08-10T00:00:00.000Z"),
      ),
    ).resolves.toEqual({
      views: 12_345,
      visitors: 456,
      averageEngagedSeconds: 37,
      medianEngagedSeconds: 19,
      averageScrollDepth: 68,
      recentViews: 123,
      topPages: [{ path: "/blog/memory", title: "Memory", views: 99 }],
      dailyViews: [
        { date: "08-03", views: 5, visitors: 3 },
        { date: "08-04", views: 0, visitors: 0 },
      ],
    });
    expect(mockQuery.mock.calls[0][0]).toContain(
      "COUNT(DISTINCT visitor_hash)",
    );
    expect(mockQuery.mock.calls[0][0]).toContain(
      "COALESCE(is_owner, false) = false",
    );
    expect(mockQuery.mock.calls[1][0]).toContain("GROUP BY path");
    expect(mockQuery.mock.calls[1][0]).toContain(
      "COALESCE(is_owner, false) = false",
    );
    expect(mockQuery.mock.calls[2][0]).toContain("generate_series");
    expect(mockQuery.mock.calls[2][0]).toContain("Asia/Shanghai");
    expect(mockQuery.mock.calls[2][0]).toContain(
      "COUNT(DISTINCT page_views.visitor_hash)",
    );
    expect(mockQuery.mock.calls[0][0]).toContain("created_at < $3");
    expect(mockQuery.mock.calls[1][0]).toContain("created_at < $2");
    expect(mockQuery.mock.calls[2][0]).toContain("page_views.created_at < $2");
    expect(mockQuery.mock.calls[0][1]).toEqual([
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-09T00:00:00.000Z"),
      new Date("2026-08-10T00:00:00.000Z"),
    ]);
  });

  it("starts a seven-day Shanghai calendar window at local midnight", () => {
    expect(
      startOfShanghaiDayWindow(new Date("2026-08-26T15:59:59.000Z")),
    ).toEqual(new Date("2026-08-19T16:00:00.000Z"));
    expect(
      startOfShanghaiDayWindow(new Date("2026-08-26T16:00:00.000Z")),
    ).toEqual(new Date("2026-08-20T16:00:00.000Z"));
  });
});
