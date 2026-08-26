import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHeaders, mockReadAnalyticsSummary, mockReadAgentOperationsSummary } = vi.hoisted(
  () => ({
    mockHeaders: vi.fn(),
    mockReadAnalyticsSummary: vi.fn(),
    mockReadAgentOperationsSummary: vi.fn(),
  }),
);

vi.mock("next/headers", () => ({ headers: mockHeaders }));

vi.mock("@/lib/analytics.server", () => ({
  readAnalyticsSummary: mockReadAnalyticsSummary,
  startOfShanghaiDayWindow: (now: Date) =>
    new Date(now.getTime() - 6 * 24 * 60 * 60 * 1_000),
}));

vi.mock("@/lib/blog-agent/operationsSummary.server", () => ({
  readAgentOperationsSummary: mockReadAgentOperationsSummary,
}));

import { AnalyticsSummary } from "@/payload/components/AnalyticsSummary";
import {
  deriveRequestIdentity,
  formatAnonymousVisitor,
} from "@/lib/requestIdentity";

describe("AnalyticsSummary", () => {
  beforeEach(() => {
    vi.stubEnv("PAYLOAD_SECRET", "analytics-summary-test-secret");
    mockHeaders.mockResolvedValue(
      new Headers({
        "x-real-ip": "203.0.113.42",
        "user-agent": "Test Browser",
      }),
    );
    mockReadAnalyticsSummary.mockResolvedValue({
      views: 105,
      visitors: 8,
      averageEngagedSeconds: 180,
      medianEngagedSeconds: 18,
      averageScrollDepth: 39,
      recentViews: 11,
      topPages: [],
      dailyViews: [
        { date: "08-25", views: 12, visitors: 3 },
        { date: "08-26", views: 11, visitors: 2 },
        { date: "08-27", views: 0, visitors: 0 },
      ],
    });
    mockReadAgentOperationsSummary.mockResolvedValue({
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      questionCount: 0,
      unansweredCount: 0,
      recentQuestions: [],
    });
  });

  it("explains the anonymous visitor estimate and identifies the current browser", async () => {
    render(await AnalyticsSummary());

    const request = new Request("https://example.com", {
      headers: {
        "x-real-ip": "203.0.113.42",
        "user-agent": "Test Browser",
      },
    });
    const currentVisitor = formatAnonymousVisitor(
      deriveRequestIdentity(request, "analytics-summary-test-secret").fingerprint,
    );

    expect(screen.getByText("匿名访客（估算）")).toBeInTheDocument();
    expect(screen.getByText(new RegExp("IP 与浏览器信息"))).toBeInTheDocument();
    expect(screen.getByText(`当前浏览器：${currentVisitor}`)).toBeInTheDocument();
  });

  it("shows the representative median instead of the outlier-sensitive average", async () => {
    render(await AnalyticsSummary());

    expect(screen.getByText("中位有效停留")).toBeInTheDocument();
    expect(screen.getByText("18 秒")).toBeInTheDocument();
    expect(screen.queryByText("平均有效停留")).not.toBeInTheDocument();
    expect(screen.queryByText("3 分 0 秒")).not.toBeInTheDocument();
  });

  it("shows a compact daily trend with both visits and anonymous visitors", async () => {
    render(await AnalyticsSummary());

    expect(screen.getByRole("heading", { name: "近 7 日趋势" })).toBeInTheDocument();
    expect(screen.getByLabelText("08-25：12 次访问，3 位匿名访客")).toBeInTheDocument();
    expect(screen.getByLabelText("08-26：11 次访问，2 位匿名访客")).toBeInTheDocument();
    expect(
      screen
        .getByLabelText("08-27：0 次访问，0 位匿名访客")
        .querySelector(".analytics-summary__trend-bar span"),
    ).toBeNull();
  });

  it("omits the current browser label if request identity cannot be read", async () => {
    mockHeaders.mockRejectedValueOnce(new Error("headers unavailable"));

    render(await AnalyticsSummary());

    expect(screen.queryByText(/当前浏览器：/u)).not.toBeInTheDocument();
  });

  it("shows recent Agent questions and outcomes without an answer field", async () => {
    mockReadAgentOperationsSummary.mockResolvedValueOnce({
      requestCount: 8,
      inputTokens: 1200,
      outputTokens: 300,
      questionCount: 11,
      unansweredCount: 2,
      recentQuestions: [{
        questionText: "这段代码为什么要先检查状态？",
        articleSlug: "local-process-tools",
        outcome: "answered",
        createdAt: new Date("2026-08-27T08:30:00.000Z"),
      }],
    });

    render(await AnalyticsSummary());

    expect(screen.getByText("用户提问")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近问题明细" }))
      .toBeInTheDocument();
    expect(screen.getByText("这段代码为什么要先检查状态？"))
      .toBeInTheDocument();
    const articleLink = screen.getByRole("link", { name: "local-process-tools" });
    expect(articleLink).toHaveAttribute("href", "/blog/local-process-tools");
    expect(articleLink.closest("small")).toHaveTextContent("已回答");
    expect(screen.getByText(/不保存模型答案/u)).toBeInTheDocument();
  });
});
