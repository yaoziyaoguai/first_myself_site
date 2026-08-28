import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "page_views_known_owner_visitor_idx"
      ON "page_views" ("visitor_hash")
      WHERE "is_owner" = true;

    UPDATE "page_views" AS target
    SET "is_owner" = true, "updated_at" = NOW()
    WHERE "is_owner" = false
      AND EXISTS (
        SELECT 1
        FROM "page_views" AS known_owner
        WHERE known_owner."visitor_hash" = target."visitor_hash"
          AND known_owner."is_owner" = true
      );
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "page_views_known_owner_visitor_idx";
  `);
}
