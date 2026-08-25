import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "page_views"
      ADD COLUMN IF NOT EXISTS "network_prefix" varchar,
      ADD COLUMN IF NOT EXISTS "is_owner" boolean DEFAULT false NOT NULL;

    CREATE INDEX IF NOT EXISTS "page_views_owner_created_idx"
      ON "page_views" ("is_owner", "created_at" DESC);
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "page_views_owner_created_idx";
    ALTER TABLE "page_views"
      DROP COLUMN IF EXISTS "network_prefix",
      DROP COLUMN IF EXISTS "is_owner";
  `);
}
