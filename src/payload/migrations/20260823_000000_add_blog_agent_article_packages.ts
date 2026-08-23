import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "blog"
      ADD COLUMN IF NOT EXISTS "agent_context_required" boolean NOT NULL DEFAULT false;
    ALTER TABLE "blog"
      ADD COLUMN IF NOT EXISTS "agent_package_hash" varchar;
    ALTER TABLE "blog"
      ADD COLUMN IF NOT EXISTS "agent_index_status" varchar NOT NULL DEFAULT 'none';
    ALTER TABLE "blog"
      ADD COLUMN IF NOT EXISTS "agent_indexed_package_hash" varchar;
    ALTER TABLE "blog"
      ADD COLUMN IF NOT EXISTS "agent_indexed_at" timestamptz;

    CREATE SCHEMA IF NOT EXISTS "blog_agent";

    CREATE TABLE IF NOT EXISTS "blog_agent"."article_packages" (
      "blog_id" text NOT NULL,
      "package_hash" varchar(64) NOT NULL,
      "article_hash" varchar(64) NOT NULL,
      "manifest_json" jsonb NOT NULL,
      "embedding_model" text NOT NULL,
      "embedding_dimensions" integer NOT NULL,
      "chunk_count" integer NOT NULL,
      "indexed_at" timestamptz NOT NULL,
      PRIMARY KEY ("blog_id", "package_hash"),
      CHECK ("embedding_dimensions" > 0 AND "embedding_dimensions" <= 4096),
      CHECK ("chunk_count" >= 0 AND "chunk_count" <= 128)
    );

    CREATE TABLE IF NOT EXISTS "blog_agent"."article_chunks" (
      "blog_id" text NOT NULL,
      "package_hash" varchar(64) NOT NULL,
      "chunk_id" text NOT NULL,
      "source_kind" text NOT NULL,
      "source_path" text NOT NULL,
      "heading" text NOT NULL,
      "anchor" text NOT NULL,
      "ordinal" integer NOT NULL,
      "content" text NOT NULL,
      "embedding" real[] NOT NULL,
      PRIMARY KEY ("blog_id", "package_hash", "chunk_id"),
      FOREIGN KEY ("blog_id", "package_hash")
        REFERENCES "blog_agent"."article_packages" ("blog_id", "package_hash")
        ON DELETE CASCADE,
      CHECK ("source_kind" IN ('article', 'code', 'documentation', 'data', 'image-description')),
      CHECK ("ordinal" >= 0)
    );

    CREATE INDEX IF NOT EXISTS "article_chunks_blog_package_idx"
      ON "blog_agent"."article_chunks" ("blog_id", "package_hash");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "blog_agent"."article_chunks";
    DROP TABLE IF EXISTS "blog_agent"."article_packages";

    ALTER TABLE "blog" DROP COLUMN IF EXISTS "agent_indexed_at";
    ALTER TABLE "blog" DROP COLUMN IF EXISTS "agent_indexed_package_hash";
    ALTER TABLE "blog" DROP COLUMN IF EXISTS "agent_index_status";
    ALTER TABLE "blog" DROP COLUMN IF EXISTS "agent_package_hash";
    ALTER TABLE "blog" DROP COLUMN IF EXISTS "agent_context_required";
  `);
}
