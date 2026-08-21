import { describe, expect, it, vi } from "vitest";
import { BLOG_AGENT_POOL_LIMITS } from "@/lib/blog-agent/database";
import {
  PostgresBlogAgentRepository,
  type BlogAgentQueryClient,
  type BlogAgentQueryPool,
} from "@/lib/blog-agent/repository.postgres";

function createDatabase(counts: Record<string, number> = {
  window_count: 0,
  identity_daily_count: 0,
  global_daily_count: 0,
}) {
  const query = vi.fn<
    (text: string, values?: readonly unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
  >(async (text: string) => {
    if (text.includes("window_count")) return { rows: [counts] };
    return { rows: [] };
  });
  const release = vi.fn();
  const client = { query, release } as unknown as BlogAgentQueryClient;
  const pool = {
    connect: vi.fn(async () => client),
    query,
  } as unknown as BlogAgentQueryPool;
  return { pool, query, release };
}

describe("PostgresBlogAgentRepository", () => {
  it("uses strict connection and statement timeouts", () => {
    expect(BLOG_AGENT_POOL_LIMITS).toEqual({
      max: 5,
      connectionTimeoutMillis: 3_000,
      query_timeout: 8_000,
      statement_timeout: 8_000,
      idleTimeoutMillis: 30_000,
    });
  });

  it("atomically reserves window, identity daily, and global daily budget", async () => {
    const database = createDatabase();
    const repository = new PostgresBlogAgentRepository(database.pool);

    const result = await repository.reserveGeneration({
      identityHash: "identity-hash",
      now: new Date("2026-08-21T12:00:00.000Z"),
      limits: { windowMs: 600_000, perIdentityWindow: 3, perIdentityDaily: 20, globalDaily: 100 },
    });

    expect(result).toEqual({ allowed: true });
    const statements = database.query.mock.calls.map(([text]) => text).join("\n");
    expect(statements).toContain("BEGIN");
    expect(statements).toContain("pg_advisory_xact_lock");
    expect(statements).toContain("window_count");
    expect(statements).toContain("identity_daily_count");
    expect(statements).toContain("global_daily_count");
    expect(statements).toContain('INSERT INTO "blog_agent"."generation_events"');
    expect(statements).toContain('INSERT INTO "blog_agent"."usage_daily"');
    expect(statements).toContain("COMMIT");
    expect(statements).not.toContain("ROLLBACK");
    expect(database.release).toHaveBeenCalledOnce();
  });

  it.each([
    [{ window_count: 3, identity_daily_count: 2, global_daily_count: 2 }, "window"],
    [{ window_count: 1, identity_daily_count: 20, global_daily_count: 20 }, "identity-daily"],
    [{ window_count: 1, identity_daily_count: 2, global_daily_count: 100 }, "global-daily"],
  ] as const)("does not increment counters when %s is exhausted", async (counts, reason) => {
    const database = createDatabase(counts);
    const repository = new PostgresBlogAgentRepository(database.pool);

    await expect(repository.reserveGeneration({
      identityHash: "identity-hash",
      now: new Date("2026-08-21T12:00:00.000Z"),
      limits: { windowMs: 600_000, perIdentityWindow: 3, perIdentityDaily: 20, globalDaily: 100 },
    })).resolves.toEqual({ allowed: false, reason });

    const statements = database.query.mock.calls.map(([text]) => text).join("\n");
    expect(statements).not.toContain('INSERT INTO "blog_agent"."generation_events"');
    expect(statements).not.toContain('INSERT INTO "blog_agent"."usage_daily"');
    expect(statements).toContain("COMMIT");
  });

  it("rolls back and releases the client on database failure", async () => {
    const database = createDatabase();
    database.query.mockRejectedValueOnce(new Error("database unavailable"));
    const repository = new PostgresBlogAgentRepository(database.pool);

    await expect(repository.reserveGeneration({
      identityHash: "identity-hash",
      now: new Date("2026-08-21T12:00:00.000Z"),
      limits: { windowMs: 600_000, perIdentityWindow: 3, perIdentityDaily: 20, globalDaily: 100 },
    })).rejects.toThrow("database unavailable");

    expect(database.query).toHaveBeenCalledWith("ROLLBACK");
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("clamps invalid token usage before persistence", async () => {
    const database = createDatabase();
    const repository = new PostgresBlogAgentRepository(database.pool);

    await repository.recordTokenUsage({
      identityHash: "identity-hash",
      now: new Date("2026-08-21T12:00:00.000Z"),
      inputTokens: Number.NaN,
      outputTokens: -5,
    });

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "blog_agent"."usage_daily"'),
      [0, 0, "2026-08-21", "identity-hash"],
    );
  });

  it("misses expired cache entries and validates cached JSON", async () => {
    const database = createDatabase();
    database.query.mockResolvedValueOnce({ rows: [] });
    const repository = new PostgresBlogAgentRepository(database.pool);

    const cached = await repository.getCachedAnswer({
      articleHash: "article-hash",
      modelCacheKey: "model-hash",
      questionHash: "question-hash",
      now: new Date("2026-08-21T12:00:00.000Z"),
    });

    expect(cached).toBeNull();
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('"expires_at" > $4'),
      ["article-hash", "model-hash", "question-hash", new Date("2026-08-21T12:00:00.000Z")],
    );

    database.query.mockResolvedValueOnce({
      rows: [{ response_json: { answer: "cached", citationIds: ["a"], insufficientEvidence: false } }],
    });
    await expect(repository.getCachedAnswer({
      articleHash: "article-hash",
      modelCacheKey: "model-hash",
      questionHash: "question-hash",
      now: new Date("2026-08-21T12:00:00.000Z"),
    })).resolves.toEqual({ answer: "cached", citationIds: ["a"], insufficientEvidence: false });

    database.query.mockResolvedValueOnce({ rows: [{ response_json: { answer: 42 } }] });
    await expect(repository.getCachedAnswer({
      articleHash: "article-hash",
      modelCacheKey: "model-hash",
      questionHash: "question-hash",
      now: new Date("2026-08-21T12:00:00.000Z"),
    })).resolves.toBeNull();
  });

  it("stores only hashed keys and validated response JSON", async () => {
    const database = createDatabase();
    const repository = new PostgresBlogAgentRepository(database.pool);

    await repository.setCachedAnswer({
      articleHash: "article-hash",
      modelCacheKey: "model-hash",
      questionHash: "question-hash",
      answer: { answer: "批量写入。", citationIds: ["写入路径"], insufficientEvidence: false },
      expiresAt: new Date("2026-08-22T12:00:00.000Z"),
    });

    const [, params] = database.query.mock.calls[0];
    expect(params).toEqual([
      "article-hash",
      "model-hash",
      "question-hash",
      JSON.stringify({ answer: "批量写入。", citationIds: ["写入路径"], insufficientEvidence: false }),
      new Date("2026-08-22T12:00:00.000Z"),
    ]);
    expect(JSON.stringify(params)).not.toContain("为什么批量写入");
  });
});
