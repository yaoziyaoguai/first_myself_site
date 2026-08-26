import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("@/lib/payload", () => ({
  getPayloadAPI: vi.fn(async () => ({
    db: { pool: { query: mockQuery } },
  })),
}));

import { readAgentOperationsSummary } from
  "@/lib/blog-agent/operationsSummary.server";

describe("readAgentOperationsSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aggregates usage and returns the twenty newest question details", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          request_count: "34",
          input_tokens: "12345",
          output_tokens: "678",
          question_count: "19",
          unanswered_count: "12",
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          question_text: "为什么没有代码证据?",
          article_slug: "agent-runtime",
          outcome: "insufficient_evidence",
          created_at: new Date("2026-08-26T01:00:00.000Z"),
        }],
      });
    const since = new Date("2026-08-20T00:00:00.000Z");
    const today = new Date("2026-08-26T00:00:00.000Z");

    await expect(readAgentOperationsSummary(since, today)).resolves.toEqual({
      requestCount: 34,
      inputTokens: 12_345,
      outputTokens: 678,
      questionCount: 19,
      unansweredCount: 12,
      recentQuestions: [{
        questionText: "为什么没有代码证据?",
        articleSlug: "agent-runtime",
        outcome: "insufficient_evidence",
        createdAt: new Date("2026-08-26T01:00:00.000Z"),
      }],
    });

    const [aggregateSql, aggregateValues] = mockQuery.mock.calls[0];
    expect(aggregateSql).toContain('FROM "blog_agent"."usage_daily"');
    expect(aggregateSql).toContain('FROM "blog_agent"."questions"');
    expect(aggregateValues).toEqual([since, today]);
    const [recentSql, recentValues] = mockQuery.mock.calls[1];
    expect(recentSql).toContain('FROM "blog_agent"."questions"');
    expect(recentSql).toContain("ORDER BY \"created_at\" DESC");
    expect(recentSql).toContain("LIMIT 20");
    expect(recentValues).toEqual([since]);
  });

  it("returns safe zeroes for missing or invalid aggregate values", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          request_count: "invalid",
          input_tokens: null,
          output_tokens: "-5",
          question_count: "bad",
          unanswered_count: undefined,
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await readAgentOperationsSummary(
      new Date("2026-08-20T00:00:00.000Z"),
      new Date("2026-08-26T00:00:00.000Z"),
    );

    expect(result).toEqual({
      requestCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      questionCount: 0,
      unansweredCount: 0,
      recentQuestions: [],
    });
  });
});
