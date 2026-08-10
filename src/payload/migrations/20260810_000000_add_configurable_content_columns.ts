import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 开发数据库可能已通过 schema push 添加这些列，因此 production migration 必须可重复执行。
  await db.execute(sql`
    ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "href" varchar;

    ALTER TABLE "site_settings"
      ADD COLUMN IF NOT EXISTS "email" varchar DEFAULT 'wangjinkun333@gmail.com';

    ALTER TABLE "site_settings"
      ADD COLUMN IF NOT EXISTS "content_version" numeric DEFAULT 0;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "projects"
      DROP COLUMN IF EXISTS "href";

    ALTER TABLE "site_settings"
      DROP COLUMN IF EXISTS "email";

    ALTER TABLE "site_settings"
      DROP COLUMN IF EXISTS "content_version";
  `);
}
