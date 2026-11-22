import { sql, type MigrateDownArgs, type MigrateUpArgs } from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN "reset_password_requested_at" timestamp(3) with time zone;
    ALTER TABLE "comments" ADD COLUMN "is_author_role" boolean DEFAULT false;

    CREATE TABLE "projects_rels" (
      "id" serial PRIMARY KEY,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "blog_id" integer,
      CONSTRAINT "projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "projects"("id") ON DELETE CASCADE,
      CONSTRAINT "projects_rels_blog_fk" FOREIGN KEY ("blog_id") REFERENCES "blog"("id") ON DELETE CASCADE
    );
    CREATE INDEX "projects_rels_order_idx" ON "projects_rels" ("order");
    CREATE INDEX "projects_rels_parent_idx" ON "projects_rels" ("parent_id");
    CREATE INDEX "projects_rels_path_idx" ON "projects_rels" ("path");
    CREATE INDEX "projects_rels_blog_id_idx" ON "projects_rels" ("blog_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "projects_rels";
    ALTER TABLE "comments" DROP COLUMN "is_author_role";
    ALTER TABLE "users" DROP COLUMN "reset_password_requested_at";
  `);
}
