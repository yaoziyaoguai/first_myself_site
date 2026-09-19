import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as migration from "@/payload/migrations/20260919_000000_add_blog_series";

const connectionString = process.env.MIGRATION_TEST_DATABASE_URL;
const describeWithPostgres = connectionString ? describe : describe.skip;
const keepSchema = process.env.MIGRATION_TEST_KEEP_SCHEMA === "1";
const bootstrapBaseSchema = process.env.MIGRATION_TEST_BOOTSTRAP === "1";

describeWithPostgres("blog series migration against PostgreSQL", () => {
  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);

  beforeAll(async () => {
    if (bootstrapBaseSchema) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "blog" ("id" serial PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS "payload_locked_documents_rels" (
          "id" serial PRIMARY KEY
        );
      `);
    }
    await migration.up({ db } as never);
  }, 30_000);

  afterAll(async () => {
    if (!keepSchema) await migration.down({ db } as never);
    await pool.end();
  }, 30_000);

  it("creates the series table and ordered article relationship", async () => {
    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'blog_series'
    `);
    expect(tables.rows).toEqual([{ table_name: "blog_series" }]);

    const columns = await pool.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'blog'
        AND column_name = ANY($1::text[])
      ORDER BY column_name
    `, [["series_id", "series_order"]]);
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "series_id",
      "series_order",
    ]);
  });

  it("keeps articles when a series is deleted", async () => {
    const constraints = await pool.query<{ confdeltype: string }>(`
      SELECT confdeltype
      FROM pg_constraint
      WHERE conname = 'blog_series_id_blog_series_id_fk'
    `);
    expect(constraints.rows).toEqual([{ confdeltype: "n" }]);
  });
});
