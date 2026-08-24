import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "blog_agent"."article_chunks"
      ADD COLUMN IF NOT EXISTS "source_repository" text,
      ADD COLUMN IF NOT EXISTS "source_commit" varchar(64),
      ADD COLUMN IF NOT EXISTS "source_line_start" integer,
      ADD COLUMN IF NOT EXISTS "source_line_end" integer;

    ALTER TABLE "blog_agent"."article_chunks"
      ADD CONSTRAINT "article_chunks_source_lines_check"
      CHECK (
        ("source_line_start" IS NULL AND "source_line_end" IS NULL) OR
        (
          "source_line_start" IS NOT NULL AND
          "source_line_end" IS NOT NULL AND
          "source_line_start" >= 1 AND
          "source_line_end" >= "source_line_start"
        )
      );
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "blog_agent"."article_chunks"
      DROP CONSTRAINT IF EXISTS "article_chunks_source_lines_check",
      DROP COLUMN IF EXISTS "source_line_end",
      DROP COLUMN IF EXISTS "source_line_start",
      DROP COLUMN IF EXISTS "source_commit",
      DROP COLUMN IF EXISTS "source_repository";
  `);
}
