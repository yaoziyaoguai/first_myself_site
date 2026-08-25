import { describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as migration from "@/payload/migrations/20260826_000000_add_unanswered_agent_questions";
import { migrations } from "@/payload/migrations";

describe("unanswered Agent questions production migration", () => {
  it("adds only the backward-compatible inbox table and indexes", async () => {
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
    const down = statements[1].replace(/\s+/g, " ");
    expect(up).toContain(
      'CREATE TABLE IF NOT EXISTS "blog_agent"."unanswered_questions"',
    );
    expect(up).toContain('"query_id" uuid PRIMARY KEY');
    expect(up).toContain(
      "CHECK (\"reason\" IN ('insufficient_evidence', 'rate_limited', 'provider_error'))",
    );
    expect(up).toContain(
      'CREATE INDEX IF NOT EXISTS "unanswered_questions_created_idx"',
    );
    expect(down).toContain(
      'DROP TABLE IF EXISTS "blog_agent"."unanswered_questions"',
    );
    expect(down).not.toContain("DROP SCHEMA");
  });

  it("registers the migration after the existing article-source migration", () => {
    const names = migrations.map(({ name }) => name);

    expect(names.at(-2)).toBe("20260824_000000_add_blog_agent_github_sources");
    expect(names.at(-1)).toBe("20260826_000000_add_unanswered_agent_questions");
  });
});
