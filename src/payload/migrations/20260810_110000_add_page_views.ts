import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "page_views" (
      "id" serial PRIMARY KEY NOT NULL,
      "session_id" varchar NOT NULL,
      "visitor_hash" varchar NOT NULL,
      "path" varchar NOT NULL,
      "title" varchar,
      "referrer_host" varchar,
      "engaged_seconds" numeric DEFAULT 0 NOT NULL,
      "max_scroll_depth" numeric DEFAULT 0 NOT NULL,
      "last_seen_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "page_views_session_id_idx"
      ON "page_views" USING btree ("session_id");
    CREATE INDEX IF NOT EXISTS "page_views_visitor_hash_idx"
      ON "page_views" USING btree ("visitor_hash");
    CREATE INDEX IF NOT EXISTS "page_views_path_idx"
      ON "page_views" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "page_views_updated_at_idx"
      ON "page_views" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "page_views_created_at_idx"
      ON "page_views" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "page_views_id" integer;

    DO $page_views_fk$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payload_locked_documents_rels_page_views_fk'
          AND conrelid = 'public.payload_locked_documents_rels'::regclass
      ) THEN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_page_views_fk"
          FOREIGN KEY ("page_views_id") REFERENCES "public"."page_views"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END
    $page_views_fk$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_page_views_id_idx"
      ON "payload_locked_documents_rels" USING btree ("page_views_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_page_views_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_page_views_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "page_views_id";
    DROP TABLE IF EXISTS "page_views";
  `);
}
