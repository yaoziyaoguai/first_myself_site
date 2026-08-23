import { describe, expect, it, vi } from "vitest";
import type {
  MigrateDownArgs,
  MigrateUpArgs,
} from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import * as blogAgentRuntimeMigration from "@/payload/migrations/20260821_000000_add_blog_agent_runtime";
import { migrations } from "@/payload/migrations";

describe("blog agent runtime migration", () => {
  it("registers the migration after existing production migrations", () => {
    const pageViewsIndex = migrations.findIndex(
      ({ name }) => name === "20260810_110000_add_page_views",
    );
    const runtimeIndex = migrations.findIndex(
      ({ name }) => name === "20260821_000000_add_blog_agent_runtime",
    );
    const packageIndex = migrations.findIndex(
      ({ name }) => name === "20260823_000000_add_blog_agent_article_packages",
    );

    expect(pageViewsIndex).toBeGreaterThan(-1);
    expect(runtimeIndex).toBeGreaterThan(pageViewsIndex);
    expect(packageIndex).toBeGreaterThan(runtimeIndex);
    expect(migrations[runtimeIndex]).toEqual({
      name: "20260821_000000_add_blog_agent_runtime",
      up: blogAgentRuntimeMigration.up,
      down: blogAgentRuntimeMigration.down,
    });
  });

  it("creates only runtime usage and cache tables", async () => {
    const statements: string[] = [];
    const dialect = new PgDialect();
    const db = {
      execute: vi.fn(async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        statements.push(dialect.sqlToQuery(query).sql);
        return { rows: [] };
      }),
    };

    await blogAgentRuntimeMigration.up({ db } as unknown as MigrateUpArgs);
    await blogAgentRuntimeMigration.down({ db } as unknown as MigrateDownArgs);

    const source = statements.join("\n");
    expect(source).toContain('CREATE SCHEMA IF NOT EXISTS "blog_agent"');
    expect(source).toContain('"usage_daily"');
    expect(source).toContain('"generation_events"');
    expect(source).toContain('"answer_cache"');
    expect(source).toContain('DROP SCHEMA IF EXISTS "blog_agent"');
    expect(source).not.toContain("vector");
    expect(source).not.toContain("public_knowledge_chunks");
    expect(source).not.toContain("CASCADE");
  });
});
