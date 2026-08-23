import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  down,
  up,
} from "@/payload/migrations/20260821_000000_add_blog_agent_runtime";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../helpers/blogAgentPostgres";

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

describePostgres("Blog Agent migration on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;
  const dialect = new PgDialect();

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
  });

  afterAll(async () => {
    await database?.destroy();
  });

  function migrationDb() {
    return {
      execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
        const compiled = dialect.sqlToQuery(query);
        return database.pool.query(compiled.sql, compiled.params);
      },
    };
  }

  it("creates only runtime tables and removes only its own schema", async () => {
    await database.pool.query('CREATE SCHEMA "sentinel"');
    await database.pool.query('CREATE TABLE "sentinel"."keep_me" ("id" integer)');

    await up({ db: migrationDb() } as unknown as MigrateUpArgs);
    const tables = await database.pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'blog_agent'
        ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "answer_cache",
      "generation_events",
      "usage_daily",
    ]);

    const columns = await database.pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'blog_agent'
        ORDER BY table_name, ordinal_position`,
    );
    expect(columns.rows.map((row) => `${row.table_name}.${row.column_name}`)).toEqual([
      "answer_cache.article_hash",
      "answer_cache.model_cache_key",
      "answer_cache.question_hash",
      "answer_cache.response_json",
      "answer_cache.expires_at",
      "answer_cache.created_at",
      "answer_cache.updated_at",
      "generation_events.id",
      "generation_events.identity_hash",
      "generation_events.created_at",
      "usage_daily.day",
      "usage_daily.identity_hash",
      "usage_daily.request_count",
      "usage_daily.input_tokens",
      "usage_daily.output_tokens",
      "usage_daily.updated_at",
    ]);
    expect(columns.rows.some((row) => row.column_name === "question")).toBe(false);
    expect(columns.rows.some((row) => /markdown/i.test(row.column_name))).toBe(false);

    await down({ db: migrationDb() } as unknown as MigrateDownArgs);
    const schemas = await database.pool.query<{ schema_name: string }>(
      `SELECT schema_name
         FROM information_schema.schemata
        WHERE schema_name IN ('blog_agent', 'sentinel')
        ORDER BY schema_name`,
    );
    expect(schemas.rows.map((row) => row.schema_name)).toEqual(["sentinel"]);
    await database.pool.query('DROP TABLE "sentinel"."keep_me"');
    await database.pool.query('DROP SCHEMA "sentinel"');
  });
});
