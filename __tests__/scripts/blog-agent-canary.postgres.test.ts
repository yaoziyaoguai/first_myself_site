import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresCanaryArticleStore } from "../../scripts/blog-agent-canary";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../helpers/blogAgentPostgres";

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

describePostgres("Blog Agent canary article lookup on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    await database.pool.query(`
      CREATE TABLE "blog" (
        "id" serial PRIMARY KEY,
        "slug" varchar NOT NULL,
        "title" varchar NOT NULL,
        "excerpt" varchar,
        "content_markdown" text,
        "status" varchar NOT NULL,
        "visibility" varchar NOT NULL
      )
    `);
    await database.pool.query(
      `INSERT INTO "blog"
         ("slug", "title", "excerpt", "content_markdown", "status", "visibility")
       VALUES
         ($1, $2, $3, $4, 'published', 'public'),
         ($5, $6, '', '# 私密', 'published', 'private')`,
      [
        "public-post",
        "公开文章",
        "摘要",
        "# 正文\n公开内容",
        "private-post",
        "私密文章",
      ],
    );
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("executes the production read-only SQL against the Blog schema", async () => {
    const store = new PostgresCanaryArticleStore({
      query: async (text, values) => {
        const result = await database.pool.query<Record<string, unknown>>(
          text,
          values ? [...values] : [],
        );
        return { rows: result.rows };
      },
      end: async () => undefined,
    });

    await expect(store.loadPublicMarkdownArticle("public-post")).resolves.toMatchObject({
      slug: "public-post",
      title: "公开文章",
      excerpt: "摘要",
      contentMarkdown: "# 正文\n公开内容",
      status: "published",
      visibility: "public",
    });
    await expect(store.loadPublicMarkdownArticle("private-post")).resolves.toBeNull();
  });
});
