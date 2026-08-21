import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresBlogAgentRepository } from "@/lib/blog-agent/repository.postgres";
import {
  down,
  up,
} from "@/payload/migrations/20260821_000000_add_blog_agent_runtime";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../../helpers/blogAgentPostgres";

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

describePostgres("Blog Agent runtime on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;
  const dialect = new PgDialect();

  function migrationDb() {
    return {
      execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        const compiled = dialect.sqlToQuery(query);
        return database.pool.query(compiled.sql, compiled.params);
      },
    };
  }

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    await up({ db: migrationDb() } as unknown as MigrateUpArgs);
  });

  afterAll(async () => {
    try {
      await down({ db: migrationDb() } as unknown as MigrateDownArgs);
    } finally {
      await database?.destroy();
    }
  });

  it("expires cache and isolates it by article, model, and question hashes", async () => {
    const repository = new PostgresBlogAgentRepository(database.pool);
    const answer = {
      answer: "批量写入。",
      citationIds: ["section:0:write-path"],
      insufficientEvidence: false,
    };
    await repository.setCachedAnswer({
      articleHash: "article-a",
      modelCacheKey: "model-a",
      questionHash: "question-a",
      answer,
      expiresAt: new Date("2030-01-02T00:00:00.000Z"),
    });

    await expect(repository.getCachedAnswer({
      articleHash: "article-a",
      modelCacheKey: "model-a",
      questionHash: "question-a",
      now: new Date("2030-01-01T00:00:00.000Z"),
    })).resolves.toEqual(answer);
    for (const differentKey of [
      { articleHash: "article-b", modelCacheKey: "model-a", questionHash: "question-a" },
      { articleHash: "article-a", modelCacheKey: "model-b", questionHash: "question-a" },
      { articleHash: "article-a", modelCacheKey: "model-a", questionHash: "question-b" },
    ]) {
      await expect(repository.getCachedAnswer({
        ...differentKey,
        now: new Date("2030-01-01T00:00:00.000Z"),
      })).resolves.toBeNull();
    }
    await expect(repository.getCachedAnswer({
      articleHash: "article-a",
      modelCacheKey: "model-a",
      questionHash: "question-a",
      now: new Date("2030-01-03T00:00:00.000Z"),
    })).resolves.toBeNull();

    await repository.setCachedAnswer({
      articleHash: "article-expired",
      modelCacheKey: "model-a",
      questionHash: "question-expired",
      answer,
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
    });
    await repository.setCachedAnswer({
      articleHash: "article-new",
      modelCacheKey: "model-a",
      questionHash: "question-new",
      answer,
      expiresAt: new Date("2030-01-04T00:00:00.000Z"),
    });
    const expiredRows = await database.pool.query(
      `SELECT COUNT(*)::integer AS count
         FROM "blog_agent"."answer_cache"
        WHERE "expires_at" <= now()`,
    );
    expect(expiredRows.rows[0]?.count).toBe(0);
  });

  it("keeps identity window and daily limits across repository instances", async () => {
    const limits = {
      windowMs: 600_000,
      perIdentityWindow: 1,
      perIdentityDaily: 20,
      globalDaily: 100,
    };
    const now = new Date("2030-02-01T12:00:00.000Z");
    const first = new PostgresBlogAgentRepository(database.pool);
    const second = new PostgresBlogAgentRepository(database.pool);
    await expect(first.reserveGeneration({ identityHash: "window-id", now, limits }))
      .resolves.toEqual({ allowed: true });
    await expect(second.reserveGeneration({ identityHash: "window-id", now, limits }))
      .resolves.toEqual({ allowed: false, reason: "window" });

    const dailyLimits = { ...limits, perIdentityWindow: 10, perIdentityDaily: 1 };
    await expect(first.reserveGeneration({ identityHash: "daily-id", now, limits: dailyLimits }))
      .resolves.toEqual({ allowed: true });
    await expect(second.reserveGeneration({ identityHash: "daily-id", now, limits: dailyLimits }))
      .resolves.toEqual({ allowed: false, reason: "identity-daily" });
  });

  it("serializes global daily reservations across fresh repository instances", async () => {
    const limits = {
      windowMs: 600_000,
      perIdentityWindow: 10,
      perIdentityDaily: 10,
      globalDaily: 1,
    };
    const now = new Date("2030-03-01T12:00:00.000Z");
    const [left, right] = await Promise.all([
      new PostgresBlogAgentRepository(database.pool).reserveGeneration({
        identityHash: "global-left",
        now,
        limits,
      }),
      new PostgresBlogAgentRepository(database.pool).reserveGeneration({
        identityHash: "global-right",
        now,
        limits,
      }),
    ]);

    expect([left, right].filter((result) => result.allowed)).toHaveLength(1);
    expect([left, right].filter((result) => !result.allowed)).toEqual([
      { allowed: false, reason: "global-daily" },
    ]);
  });
});
