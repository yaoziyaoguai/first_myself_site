import { describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as pageViewsMigration from "@/payload/migrations/20260810_110000_add_page_views";

describe("page views production migration", () => {
  it("adds the analytics table and Payload lock relation idempotently", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const db = {
      execute: vi.fn(async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        statements.push(dialect.sqlToQuery(query).sql);
        return { rows: [] };
      }),
    };

    await pageViewsMigration.up({ db } as unknown as MigrateUpArgs);
    await pageViewsMigration.down({ db } as unknown as MigrateDownArgs);

    const up = statements[0].replace(/\s+/g, " ");
    const down = statements[1].replace(/\s+/g, " ");

    expect(up).toContain('CREATE TABLE IF NOT EXISTS "page_views"');
    expect(up).toContain(
      'ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "page_views_id" integer',
    );
    expect(up).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "page_views_session_id_idx"');
    expect(up).toContain('CREATE INDEX IF NOT EXISTS "page_views_created_at_idx"');
    expect(down).toContain(
      'ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_page_views_fk"',
    );
    expect(down).toContain('DROP TABLE IF EXISTS "page_views"');
  });
});
