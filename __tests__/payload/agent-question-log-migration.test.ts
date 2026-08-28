import { describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as migration from
  "@/payload/migrations/20260827_000000_add_agent_question_log";
import { migrations } from "@/payload/migrations";

describe("Agent question log production migration", () => {
  it("adds an answer-free log and imports existing unanswered questions", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const db = {
      execute: vi.fn(async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        statements.push(dialect.sqlToQuery(query).sql);
        return { rows: [] };
      }),
    };

    await migration.up({ db } as unknown as MigrateUpArgs);
    await migration.down({ db } as unknown as MigrateDownArgs);

    const up = statements[0].replace(/\s+/g, " ");
    expect(up).toContain('CREATE TABLE IF NOT EXISTS "blog_agent"."questions"');
    expect(up).toContain('"question_text" varchar(500) NOT NULL');
    expect(up).toContain(
      "CHECK (\"outcome\" IN ('answered', 'insufficient_evidence', 'rate_limited', 'provider_error'))",
    );
    expect(up).toContain('INSERT INTO "blog_agent"."questions"');
    expect(up).toContain('FROM "blog_agent"."unanswered_questions"');
    expect(up).toContain("WHERE \"created_at\" >= now() - interval '30 days'");
    expect(up).toContain("LIMIT 50000");
    expect(up).toContain("OFFSET 50000");
    expect(up).toContain('CREATE TRIGGER "mirror_unanswered_question"');
    expect(up).not.toContain('"answer" text');
    expect(up).not.toContain('"answer" varchar');
    expect(statements).toHaveLength(1);
  });

  it("registers after the owner analytics migration", () => {
    const names = migrations.map(({ name }) => name);

    expect(names.indexOf("20260827_000000_add_agent_question_log"))
      .toBe(names.indexOf("20260826_010000_add_owner_analytics_fields") + 1);
  });
});
