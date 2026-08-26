import { describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as migration from
  "@/payload/migrations/20260826_010000_add_owner_analytics_fields";
import { migrations } from "@/payload/migrations";

describe("owner analytics production migration", () => {
  it("adds nullable masked network and defaulted owner columns idempotently", async () => {
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
      'ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "network_prefix" varchar',
    );
    expect(up).toContain(
      'ADD COLUMN IF NOT EXISTS "is_owner" boolean DEFAULT false NOT NULL',
    );
    expect(up).toContain(
      'CREATE INDEX IF NOT EXISTS "page_views_owner_created_idx"',
    );
    expect(down).toContain('DROP COLUMN IF EXISTS "network_prefix"');
    expect(down).toContain('DROP COLUMN IF EXISTS "is_owner"');
    expect(down).not.toContain('DROP TABLE IF EXISTS "page_views"');
  });

  it("registers after the unanswered-question migration", () => {
    expect(migrations.map(({ name }) => name).slice(-3)).toEqual([
      "20260826_000000_add_unanswered_agent_questions",
      "20260826_010000_add_owner_analytics_fields",
      "20260827_000000_add_agent_question_log",
    ]);
  });
});
