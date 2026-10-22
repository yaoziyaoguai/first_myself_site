import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * 文章内交互 HTML 的私有不可变存储。
 *
 * 这张表不属于 Payload collection：没有公开读取、没有可变 latest 指针、
 * 没有独立 DELETE。公开引用的唯一真源是文章当前正文；资源删除只随文章
 * 删除级联。身份字段的 UPDATE 由触发器拒绝，避免绕过 hash 语义。
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE SCHEMA IF NOT EXISTS "blog_interactive";

    CREATE TABLE IF NOT EXISTS "blog_interactive"."html_documents" (
      "blog_id" integer NOT NULL,
      "sha256" varchar(64) NOT NULL,
      "html_text" text NOT NULL,
      "byte_length" integer NOT NULL,
      "profile_version" integer NOT NULL DEFAULT 1,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("blog_id", "sha256"),
      FOREIGN KEY ("blog_id") REFERENCES "blog" ("id") ON DELETE CASCADE,
      CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
      CHECK ("profile_version" = 1),
      CHECK ("byte_length" >= 1 AND "byte_length" <= 524288),
      CHECK ("byte_length" = octet_length("html_text"))
    );

    CREATE OR REPLACE FUNCTION "blog_interactive"."reject_html_document_update"()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'interactive html documents are immutable'
        USING ERRCODE = 'check_violation';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS "html_documents_immutable"
      ON "blog_interactive"."html_documents";
    CREATE TRIGGER "html_documents_immutable"
      BEFORE UPDATE ON "blog_interactive"."html_documents"
      FOR EACH ROW EXECUTE FUNCTION "blog_interactive"."reject_html_document_update"();
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS "html_documents_immutable"
      ON "blog_interactive"."html_documents";
    DROP FUNCTION IF EXISTS "blog_interactive"."reject_html_document_update"();
    DROP TABLE IF EXISTS "blog_interactive"."html_documents";
    DROP SCHEMA IF EXISTS "blog_interactive";
  `);
}
