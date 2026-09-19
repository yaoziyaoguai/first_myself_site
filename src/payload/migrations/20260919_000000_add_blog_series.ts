import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_blog_series_progress" AS ENUM(
      'ongoing', 'completed'
    );
    CREATE TYPE "public"."enum_blog_series_status" AS ENUM(
      'draft', 'published'
    );

    CREATE TABLE "blog_series" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "description" varchar NOT NULL,
      "progress" "enum_blog_series_progress" DEFAULT 'ongoing',
      "featured" boolean DEFAULT false,
      "sort_order" numeric DEFAULT 0,
      "status" "enum_blog_series_status" DEFAULT 'draft',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "blog" ADD COLUMN "series_id" integer;
    ALTER TABLE "blog" ADD COLUMN "series_order" numeric;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "blog_series_id" integer;

    ALTER TABLE "blog"
      ADD CONSTRAINT "blog_series_id_blog_series_id_fk"
      FOREIGN KEY ("series_id") REFERENCES "public"."blog_series"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_blog_series_fk"
      FOREIGN KEY ("blog_series_id") REFERENCES "public"."blog_series"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE UNIQUE INDEX "blog_series_slug_idx" ON "blog_series" ("slug");
    CREATE INDEX "blog_series_updated_at_idx" ON "blog_series" ("updated_at");
    CREATE INDEX "blog_series_created_at_idx" ON "blog_series" ("created_at");
    CREATE INDEX "blog_series_idx" ON "blog" ("series_id");
    CREATE INDEX "payload_locked_documents_rels_blog_series_id_idx"
      ON "payload_locked_documents_rels" ("blog_series_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_blog_series_fk";
    ALTER TABLE "blog"
      DROP CONSTRAINT "blog_series_id_blog_series_id_fk";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "blog_series_id";
    ALTER TABLE "blog"
      DROP COLUMN "series_order",
      DROP COLUMN "series_id";

    DROP TABLE "blog_series";
    DROP TYPE "enum_blog_series_status";
    DROP TYPE "enum_blog_series_progress";
  `);
}
