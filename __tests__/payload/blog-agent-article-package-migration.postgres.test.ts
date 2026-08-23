import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { down, up } from "@/payload/migrations/20260823_000000_add_blog_agent_article_packages";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../helpers/blogAgentPostgres";

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL ? describe : describe.skip;

describePostgres("article package migration on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;
  const dialect = new PgDialect();

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    await database.pool.query('CREATE TABLE "blog" ("id" serial PRIMARY KEY)');
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

  it("creates and removes only its columns and package tables", async () => {
    await database.pool.query('CREATE SCHEMA "sentinel"');
    await database.pool.query('CREATE TABLE "sentinel"."keep_me" ("id" integer)');

    await up({ db: migrationDb() } as unknown as MigrateUpArgs);
    const tables = await database.pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'blog_agent' ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "article_chunks",
      "article_packages",
    ]);
    const columns = await database.pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'blog'
        ORDER BY ordinal_position`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "id",
      "agent_context_required",
      "agent_package_hash",
      "agent_index_status",
      "agent_indexed_package_hash",
      "agent_indexed_at",
    ]);

    const inserted = await database.pool.query<{ id: number }>(
      'INSERT INTO "blog" DEFAULT VALUES RETURNING "id"',
    );
    const blogId = inserted.rows[0].id;
    const packageHash = "b".repeat(64);
    await database.pool.query(
      `INSERT INTO "blog_agent"."article_packages"
        ("blog_id", "package_hash", "article_hash", "manifest_json",
         "embedding_model", "embedding_dimensions", "chunk_count", "indexed_at")
       VALUES ($1, $2, $3, '{}'::jsonb, 'embedding-model', 3, 1, now())`,
      [blogId, packageHash, "a".repeat(64)],
    );
    await database.pool.query(
      `INSERT INTO "blog_agent"."article_chunks"
        ("blog_id", "package_hash", "chunk_id", "source_kind", "source_path",
         "heading", "anchor", "ordinal", "content", "embedding")
       VALUES ($1, $2, 'chunk-1', 'code', 'src/a.ts', 'A', 'a', 0, 'body', ARRAY[1,0,0]::real[])`,
      [blogId, packageHash],
    );
    await database.pool.query('DELETE FROM "blog" WHERE "id" = $1', [blogId]);
    const packageRows = await database.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM "blog_agent"."article_packages"',
    );
    const chunkRows = await database.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM "blog_agent"."article_chunks"',
    );
    expect(packageRows.rows[0].count).toBe("0");
    expect(chunkRows.rows[0].count).toBe("0");

    await down({ db: migrationDb() } as unknown as MigrateDownArgs);
    const sentinel = await database.pool.query(
      `SELECT to_regclass('sentinel.keep_me') AS keep_me, to_regclass('public.blog') AS blog`,
    );
    expect(sentinel.rows[0]).toEqual({ keep_me: "sentinel.keep_me", blog: "blog" });
  });
});
