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

    await down({ db: migrationDb() } as unknown as MigrateDownArgs);
    const sentinel = await database.pool.query(
      `SELECT to_regclass('sentinel.keep_me') AS keep_me, to_regclass('public.blog') AS blog`,
    );
    expect(sentinel.rows[0]).toEqual({ keep_me: "sentinel.keep_me", blog: "blog" });
  });
});
