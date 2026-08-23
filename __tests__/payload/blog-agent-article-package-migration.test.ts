import { describe, expect, it, vi } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as articlePackageMigration from "@/payload/migrations/20260823_000000_add_blog_agent_article_packages";
import { migrations } from "@/payload/migrations";

describe("Blog Agent article package migration", () => {
  it("is registered after the Phase 1 runtime migration", () => {
    expect(migrations.at(-1)).toEqual({
      name: "20260823_000000_add_blog_agent_article_packages",
      up: articlePackageMigration.up,
      down: articlePackageMigration.down,
    });
  });

  it("adds private Blog readiness columns and scoped package tables without pgvector", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const db = {
      execute: vi.fn(async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        statements.push(dialect.sqlToQuery(query).sql);
        return { rows: [] };
      }),
    };

    await articlePackageMigration.up({ db } as unknown as MigrateUpArgs);
    await articlePackageMigration.down({ db } as unknown as MigrateDownArgs);

    const source = statements.join("\n").replace(/\s+/g, " ");
    expect(source).toContain('ALTER TABLE "blog" ADD COLUMN IF NOT EXISTS "agent_context_required" boolean');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS "blog_agent"."article_packages"');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS "blog_agent"."article_chunks"');
    expect(source).toContain('PRIMARY KEY ("blog_id", "package_hash", "chunk_id")');
    expect(source).toContain('CREATE INDEX IF NOT EXISTS "article_chunks_blog_package_idx" ON "blog_agent"."article_chunks" ("blog_id", "package_hash")');
    expect(source).not.toMatch(/CREATE EXTENSION|pgvector|vector\s*\(/i);
    expect(source).not.toMatch(/DROP[^;]+CASCADE/i);
    expect(source).not.toContain('DROP SCHEMA IF EXISTS "blog_agent"');
  });
});
