import { describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as migration from
  "@/payload/migrations/20260828_000000_propagate_owner_analytics";
import { migrations } from "@/payload/migrations";

describe("owner analytics identity migration", () => {
  it("reclassifies every historical row for a known owner identity", async () => {
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
    expect(up).toContain('UPDATE "page_views" AS target SET "is_owner" = true');
    expect(up).toContain(
      'known_owner."visitor_hash" = target."visitor_hash"',
    );
    expect(up).toContain('known_owner."is_owner" = true');
    expect(up).toContain(
      'CREATE INDEX IF NOT EXISTS "page_views_known_owner_visitor_idx"',
    );
    expect(down).toContain(
      'DROP INDEX IF EXISTS "page_views_known_owner_visitor_idx"',
    );
    expect(down).not.toContain("UPDATE");
  });

  it("is registered after the Agent question-log migration", () => {
    expect(migrations.map(({ name }) => name).slice(-2)).toEqual([
      "20260827_000000_add_agent_question_log",
      "20260828_000000_propagate_owner_analytics",
    ]);
  });
});
