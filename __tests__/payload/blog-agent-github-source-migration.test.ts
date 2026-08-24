import { describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { migrations } from "@/payload/migrations";

describe("Blog Agent GitHub source migration", () => {
  it("is registered after the article package migration", () => {
    expect(migrations.at(-1)?.name).toBe(
      "20260824_000000_add_blog_agent_github_sources",
    );
  });

  it("adds nullable, line-bounded source metadata without rewriting old chunks", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const db = {
      execute: vi.fn(async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        statements.push(dialect.sqlToQuery(query).sql);
        return { rows: [] };
      }),
    };

    const migration = migrations.find((item) =>
      item.name === "20260824_000000_add_blog_agent_github_sources"
    );
    expect(migration).toBeDefined();
    if (!migration) return;
    await migration.up({ db } as unknown as MigrateUpArgs);
    await migration.down({ db } as unknown as MigrateDownArgs);

    const source = statements.join("\n").replace(/\s+/g, " ");
    expect(source).toContain('ALTER TABLE "blog_agent"."article_chunks"');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS "source_repository" text');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS "source_commit" varchar(64)');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS "source_line_start" integer');
    expect(source).toContain('ADD COLUMN IF NOT EXISTS "source_line_end" integer');
    expect(source).toContain('"source_line_start" IS NOT NULL');
    expect(source).toContain('"source_line_end" IS NOT NULL');
    expect(source).not.toMatch(/UPDATE|DELETE|TRUNCATE/i);
  });
});
