import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE SCHEMA IF NOT EXISTS "blog_agent";

    CREATE TABLE IF NOT EXISTS "blog_agent"."questions" (
      "query_id" uuid PRIMARY KEY,
      "article_slug" varchar(128) NOT NULL,
      "question_text" varchar(500) NOT NULL,
      "outcome" varchar(32) NOT NULL
        CHECK ("outcome" IN ('answered', 'insufficient_evidence', 'rate_limited', 'provider_error')),
      "created_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "questions_created_idx"
      ON "blog_agent"."questions" ("created_at" DESC);

    CREATE INDEX IF NOT EXISTS "questions_article_created_idx"
      ON "blog_agent"."questions" ("article_slug", "created_at" DESC);

    CREATE OR REPLACE FUNCTION "blog_agent"."mirror_unanswered_question"()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO "blog_agent"."questions"
        ("query_id", "article_slug", "question_text", "outcome", "created_at")
      VALUES
        (NEW."query_id", NEW."article_slug", NEW."question_excerpt", NEW."reason", NEW."created_at")
      ON CONFLICT ("query_id") DO NOTHING;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS "mirror_unanswered_question"
      ON "blog_agent"."unanswered_questions";
    CREATE TRIGGER "mirror_unanswered_question"
      AFTER INSERT ON "blog_agent"."unanswered_questions"
      FOR EACH ROW
      EXECUTE FUNCTION "blog_agent"."mirror_unanswered_question"();

    INSERT INTO "blog_agent"."questions"
      ("query_id", "article_slug", "question_text", "outcome", "created_at")
    SELECT "query_id", "article_slug", "question_excerpt", "reason", "created_at"
      FROM "blog_agent"."unanswered_questions"
     WHERE "created_at" >= now() - interval '30 days'
     ORDER BY "created_at" DESC
     LIMIT 50000
    ON CONFLICT ("query_id") DO NOTHING;

    DELETE FROM "blog_agent"."questions"
     WHERE ctid IN (
       SELECT ctid
         FROM "blog_agent"."questions"
        ORDER BY "created_at" DESC
        OFFSET 50000
     );
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  void _args;
  // 该表只新增旁路统计数据；旧应用会忽略它。回滚镜像时保留日志与兼容触发器，避免数据丢失。
}
