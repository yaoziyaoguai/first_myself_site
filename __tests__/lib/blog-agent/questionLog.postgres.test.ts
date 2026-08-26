import { describe, expect, it, vi } from "vitest";
import { PostgresAgentQuestionRecorder } from
  "@/lib/blog-agent/questionLog.postgres";
import type { BlogAgentQueryPool } from "@/lib/blog-agent/repository.postgres";

function poolWith(
  query = vi.fn<BlogAgentQueryPool["query"]>(async () => ({ rows: [] })),
) {
  return {
    pool: {
      query,
      connect: vi.fn(),
    } as unknown as BlogAgentQueryPool,
    query,
  };
}

describe("PostgresAgentQuestionRecorder", () => {
  it("purges expired rows and stores one bounded question without an answer", async () => {
    const { pool, query } = poolWith();
    const recorder = new PostgresAgentQuestionRecorder(pool);
    const createdAt = new Date("2026-08-27T01:02:03.000Z");

    await recorder.record({
      queryId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      articleSlug: "memory-agent",
      questionText: "这段代码为什么要先检查状态？",
      outcome: "answered",
      createdAt,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [statement, values] = query.mock.calls[0]!;
    expect(statement).toContain("LIMIT 100");
    expect(statement).toContain("OFFSET 49999");
    expect(statement).toContain('DELETE FROM "blog_agent"."questions"');
    expect(statement).toContain('INSERT INTO "blog_agent"."questions"');
    expect(statement).toContain('ON CONFLICT ("query_id") DO NOTHING');
    expect(statement).not.toContain('"answer"');
    expect(values).toEqual([
      new Date("2026-07-28T01:02:03.000Z"),
      "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      "memory-agent",
      "这段代码为什么要先检查状态？",
      "answered",
      createdAt,
    ]);
  });

  it("accepts only known outcomes and caps defense-in-depth text fields", async () => {
    const { pool, query } = poolWith();
    const recorder = new PostgresAgentQuestionRecorder(pool);

    await expect(
      recorder.record({
        queryId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
        articleSlug: "a".repeat(200),
        questionText: "问".repeat(700),
        outcome: "unknown" as "answered",
        createdAt: new Date("2026-08-27T00:00:00.000Z"),
      }),
    ).rejects.toThrow("Invalid Agent question outcome");
    expect(query).not.toHaveBeenCalled();

    await recorder.record({
      queryId: "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011",
      articleSlug: "a".repeat(200),
      questionText: "问".repeat(700),
      outcome: "provider_error",
      createdAt: new Date("2026-08-27T00:00:00.000Z"),
    });
    const values = query.mock.calls[0]![1];
    if (!values) throw new Error("Expected parameterized query values");
    expect(values[2]).toHaveLength(128);
    expect(values[3]).toHaveLength(500);
  });
});
