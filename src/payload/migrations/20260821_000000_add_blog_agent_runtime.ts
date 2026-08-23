import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE SCHEMA IF NOT EXISTS "blog_agent";

    CREATE TABLE IF NOT EXISTS "blog_agent"."usage_daily" (
      "day" date NOT NULL,
      "identity_hash" text NOT NULL,
      "request_count" integer NOT NULL DEFAULT 0,
      "input_tokens" bigint NOT NULL DEFAULT 0,
      "output_tokens" bigint NOT NULL DEFAULT 0,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("day", "identity_hash")
    );

    CREATE TABLE IF NOT EXISTS "blog_agent"."generation_events" (
      "id" bigserial PRIMARY KEY,
      "identity_hash" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "generation_events_identity_created_idx"
      ON "blog_agent"."generation_events" ("identity_hash", "created_at");

    CREATE INDEX IF NOT EXISTS "generation_events_created_idx"
      ON "blog_agent"."generation_events" ("created_at");

    CREATE TABLE IF NOT EXISTS "blog_agent"."answer_cache" (
      "article_hash" text NOT NULL,
      "model_cache_key" text NOT NULL,
      "question_hash" text NOT NULL,
      "response_json" jsonb NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("article_hash", "model_cache_key", "question_hash")
    );

    CREATE INDEX IF NOT EXISTS "answer_cache_expires_idx"
      ON "blog_agent"."answer_cache" ("expires_at");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "blog_agent"."answer_cache";
    DROP TABLE IF EXISTS "blog_agent"."generation_events";
    DROP TABLE IF EXISTS "blog_agent"."usage_daily";
    DROP SCHEMA IF EXISTS "blog_agent";
  `);
}
