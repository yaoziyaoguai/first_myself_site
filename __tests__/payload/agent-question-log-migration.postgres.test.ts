import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { PostgresAgentQuestionRecorder } from
  "@/lib/blog-agent/questionLog.postgres";
import { up as addUnansweredQuestions } from
  "@/payload/migrations/20260826_000000_add_unanswered_agent_questions";
import { up as addBlogAgentRuntime } from
  "@/payload/migrations/20260821_000000_add_blog_agent_runtime";
import { readAgentOperationsSummary } from
  "@/lib/blog-agent/operationsSummary.server";
import {
  down as removeQuestionLog,
  up as addQuestionLog,
} from "@/payload/migrations/20260827_000000_add_agent_question_log";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../helpers/blogAgentPostgres";

const { mockGetPayloadAPI } = vi.hoisted(() => ({ mockGetPayloadAPI: vi.fn() }));

vi.mock("@/lib/payload", () => ({ getPayloadAPI: mockGetPayloadAPI }));

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

describePostgres("Agent question log migration on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;
  const dialect = new PgDialect();

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    mockGetPayloadAPI.mockResolvedValue({ db: { pool: database.pool } });
  });

  afterAll(async () => database?.destroy());

  function migrationDb() {
    return {
      execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        const compiled = dialect.sqlToQuery(query);
        return database.pool.query(compiled.sql, compiled.params);
      },
    };
  }

  it("preserves recent and live legacy writes without importing expired questions or answers", async () => {
    await addBlogAgentRuntime({ db: migrationDb() } as unknown as MigrateUpArgs);
    await addUnansweredQuestions({ db: migrationDb() } as unknown as MigrateUpArgs);
    const recentLegacyId = "4f0f0b87-8f0d-4fc8-a8df-2e5169e35011";
    const expiredLegacyId = "4f0f0b87-8f0d-4fc8-a8df-2e5169e35012";
    await database.pool.query(
      `INSERT INTO "blog_agent"."unanswered_questions"
        ("query_id", "article_slug", "question_excerpt", "reason", "created_at")
       VALUES ($1, $2, $3, $4, now() - interval '1 day'),
              ($5, $2, '过期问题', $4, now() - interval '31 days')`,
      [
        recentLegacyId,
        "legacy-article",
        "为什么没有回答？",
        "insufficient_evidence",
        expiredLegacyId,
      ],
    );

    await addQuestionLog({ db: migrationDb() } as unknown as MigrateUpArgs);
    const columns = await database.pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'blog_agent' AND table_name = 'questions'
        ORDER BY ordinal_position`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "query_id",
      "article_slug",
      "question_text",
      "outcome",
      "created_at",
    ]);

    const liveLegacyId = "4f0f0b87-8f0d-4fc8-a8df-2e5169e35013";
    await database.pool.query(
      `INSERT INTO "blog_agent"."unanswered_questions"
        ("query_id", "article_slug", "question_excerpt", "reason", "created_at")
       VALUES ($1, $2, $3, $4, now())`,
      [
        liveLegacyId,
        "legacy-live-article",
        "迁移后旧版本仍在写入吗？",
        "provider_error",
      ],
    );

    const recorder = new PostgresAgentQuestionRecorder(database.pool);
    const currentCreatedAt = new Date();
    await recorder.record({
      queryId: "d6556237-e2d8-44ed-89a6-855adbb7f5e2",
      articleSlug: "current-article",
      questionText: "这段代码如何工作？",
      outcome: "answered",
      createdAt: currentCreatedAt,
    });
    const rows = await database.pool.query<{
      article_slug: string;
      question_text: string;
      outcome: string;
    }>(
      `SELECT "article_slug", "question_text", "outcome"
         FROM "blog_agent"."questions"
        ORDER BY "created_at"`,
    );
    expect(rows.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        article_slug: "legacy-article",
        question_text: "为什么没有回答？",
        outcome: "insufficient_evidence",
      }),
      expect.objectContaining({
        article_slug: "legacy-live-article",
        question_text: "迁移后旧版本仍在写入吗？",
        outcome: "provider_error",
      }),
      expect.objectContaining({
        article_slug: "current-article",
        question_text: "这段代码如何工作？",
        outcome: "answered",
      }),
    ]));
    expect(rows.rows).toHaveLength(3);

    const summary = await readAgentOperationsSummary(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000),
      new Date(),
    );
    expect(summary).toEqual(expect.objectContaining({
      requestCount: 0,
      questionCount: 3,
      unansweredCount: 2,
    }));
    expect(summary.recentQuestions.map((question) => ({
      articleSlug: question.articleSlug,
      outcome: question.outcome,
      hasAnswer: Object.hasOwn(question, "answer"),
    }))).toEqual(expect.arrayContaining([
      { articleSlug: "current-article", outcome: "answered", hasAnswer: false },
      { articleSlug: "legacy-live-article", outcome: "provider_error", hasAnswer: false },
      { articleSlug: "legacy-article", outcome: "insufficient_evidence", hasAnswer: false },
    ]));

    await database.pool.query(
      `INSERT INTO "blog_agent"."questions"
        ("query_id", "article_slug", "question_text", "outcome", "created_at")
       SELECT md5('bulk-question-' || value::text)::uuid,
              'capacity-article',
              '容量保护问题 ' || value::text,
              'answered',
              now() - make_interval(secs => value)
         FROM generate_series(1, 50000) AS value
       ON CONFLICT ("query_id") DO NOTHING`,
    );
    await recorder.record({
      queryId: "d6556237-e2d8-44ed-89a6-855adbb7f5e3",
      articleSlug: "capacity-article",
      questionText: "容量已满后仍记录最新问题吗？",
      outcome: "answered",
      createdAt: new Date(),
    });
    const bounded = await database.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "blog_agent"."questions"`,
    );
    expect(bounded.rows[0]?.count).toBe("50000");

    await removeQuestionLog({ db: migrationDb() } as unknown as MigrateDownArgs);
    const remaining = await database.pool.query(
      `SELECT to_regclass('blog_agent.questions') AS questions,
              to_regclass('blog_agent.unanswered_questions') AS unanswered`,
    );
    expect(remaining.rows[0]).toEqual({
      questions: "blog_agent.questions",
      unanswered: "blog_agent.unanswered_questions",
    });

    await addQuestionLog({ db: migrationDb() } as unknown as MigrateUpArgs);
    const preserved = await database.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "blog_agent"."questions"`,
    );
    expect(preserved.rows[0]?.count).toBe("50000");
  });
});
