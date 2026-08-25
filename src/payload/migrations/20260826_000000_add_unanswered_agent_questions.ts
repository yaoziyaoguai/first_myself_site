import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE SCHEMA IF NOT EXISTS "blog_agent";

    CREATE TABLE IF NOT EXISTS "blog_agent"."unanswered_questions" (
      "query_id" uuid PRIMARY KEY,
      "article_slug" varchar(128) NOT NULL,
      "question_excerpt" varchar(500) NOT NULL,
      "reason" varchar(32) NOT NULL
        CHECK ("reason" IN ('insufficient_evidence', 'rate_limited', 'provider_error')),
      "created_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "unanswered_questions_created_idx"
      ON "blog_agent"."unanswered_questions" ("created_at" DESC);
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "blog_agent"."unanswered_questions";
  `);
}
