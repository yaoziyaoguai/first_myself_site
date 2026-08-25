import { describe, expect, it, vi } from "vitest";
import { PostgresUnansweredQuestionRecorder } from
  "@/lib/blog-agent/unansweredQuestions.postgres";
import type { BlogAgentQueryPool } from "@/lib/blog-agent/repository.postgres";

function poolWith(query = vi.fn(async () => ({ rows: [] }))) {
  return {
    pool: {
      query,
      connect: vi.fn(),
    } as unknown as BlogAgentQueryPool,
    query,
  };
}

describe("PostgresUnansweredQuestionRecorder", () => {
  it("purges a bounded expired batch before inserting parameterized data", async () => {
    const { pool, query } = poolWith();
    const recorder = new PostgresUnansweredQuestionRecorder(pool);
    const createdAt = new Date("2026-08-26T01:02:03.000Z");

    await recorder.record({
      queryId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      articleSlug: "memory-agent",
      questionExcerpt: "为什么这里没有足够证据？",
      reason: "insufficient_evidence",
      createdAt,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [statement, values] = query.mock.calls[0];
    expect(statement).toContain("LIMIT 100");
    expect(statement).toContain("DELETE FROM \"blog_agent\".\"unanswered_questions\"");
    expect(statement).toContain("INSERT INTO \"blog_agent\".\"unanswered_questions\"");
    expect(statement).toContain("ON CONFLICT (\"query_id\") DO NOTHING");
    expect(values).toEqual([
      new Date("2026-07-27T01:02:03.000Z"),
      "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      "memory-agent",
      "为什么这里没有足够证据？",
      "insufficient_evidence",
      createdAt,
    ]);
  });

  it("rejects invalid reasons and caps defense-in-depth text fields", async () => {
    const { pool, query } = poolWith();
    const recorder = new PostgresUnansweredQuestionRecorder(pool);

    await expect(
      recorder.record({
        queryId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        articleSlug: "a".repeat(200),
        questionExcerpt: "问".repeat(700),
        reason: "answered" as "provider_error",
        createdAt: new Date("2026-08-26T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Invalid unanswered question reason");
    expect(query).not.toHaveBeenCalled();

    await recorder.record({
      queryId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      articleSlug: "a".repeat(200),
      questionExcerpt: "问".repeat(700),
      reason: "provider_error",
      createdAt: new Date("2026-08-26T00:00:00.000Z"),
    });
    const values = query.mock.calls[0][1];
    expect(values[2]).toHaveLength(128);
    expect(values[3]).toHaveLength(500);
  });
});
