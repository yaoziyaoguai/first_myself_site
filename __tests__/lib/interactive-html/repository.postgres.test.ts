import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  PostgresInteractiveHtmlRepository,
  assertReferencesReady,
  markdownReferences,
  readArticleWithDocuments,
} from "@/lib/interactive-html/repository.postgres";
import { canonicalFence } from "@/lib/interactive-html/marker";
import { up as migrateInteractiveHtml } from "@/payload/migrations/20261021_000000_add_blog_interactive_html";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../../helpers/blogAgentPostgres";

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

const HTML_A = "<!doctype html><html><body><button>a</button></body></html>";
const HTML_B = "<!doctype html><html><body><button>b</button></body></html>";

function sha(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

const A = sha(HTML_A);
const B = sha(HTML_B);

function marker(id: string, sha256: string): string {
  return canonicalFence({ version: 1, id, sha256, caption: `${id} 说明` });
}

describePostgres("interactive HTML 私有存储（真实 PostgreSQL）", () => {
  let database: IsolatedPostgresDatabase;
  let repository: PostgresInteractiveHtmlRepository;
  const dialect = new PgDialect();

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    await database.pool.query(`CREATE TABLE "blog" (
      "id" serial PRIMARY KEY,
      "slug" text NOT NULL DEFAULT '',
      "title" text NOT NULL DEFAULT '',
      "excerpt" text NOT NULL DEFAULT '',
      "content_markdown" text NOT NULL DEFAULT '',
      "status" text NOT NULL DEFAULT 'draft',
      "visibility" text NOT NULL DEFAULT 'private',
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await migrateInteractiveHtml({
      db: {
        execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
          const compiled = dialect.sqlToQuery(query);
          return database.pool.query(compiled.sql, compiled.params);
        },
      },
    } as unknown as MigrateUpArgs);
    await database.pool.query(
      `INSERT INTO "blog" ("id", "slug", "content_markdown", "status", "visibility")
       VALUES (1, 'one', '', 'published', 'public'), (2, 'two', '', 'published', 'public'), (3, 'three', '', 'draft', 'private')`,
    );
    repository = new PostgresInteractiveHtmlRepository(database.pool);
  });

  afterAll(async () => database?.destroy());

  it("首次写入返回 created，重传相同字节返回 existing", async () => {
    const first = await repository.put("1", A, HTML_A);
    expect(first.status).toBe("created");
    if (first.status !== "created")
      throw new Error(`unexpected: ${first.status}`);
    expect(first.metadata).toMatchObject({
      sha256: A,
      byteLength: Buffer.byteLength(HTML_A),
    });
    const again = await repository.put("1", A, HTML_A);
    expect(again.status).toBe("existing");
    const count = await database.pool.query(
      `SELECT COUNT(*)::int AS n FROM "blog_interactive"."html_documents" WHERE "blog_id" = 1`,
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("同一 hash 不同字节被拒绝（不可变语义）", async () => {
    const tampered = await repository.put("1", A, `${HTML_A}<!-- changed -->`);
    expect(tampered.status).toBe("mismatch");
  });

  it("数据库触发器拒绝 UPDATE", async () => {
    await expect(
      database.pool.query(
        `UPDATE "blog_interactive"."html_documents" SET "html_text" = 'x' WHERE "blog_id" = 1 AND "sha256" = $1`,
        [A],
      ),
    ).rejects.toThrow(/immutable/);
  });

  it("拒绝不存在的文章，且不留下孤儿行", async () => {
    const result = await repository.put("999", B, HTML_B);
    expect(result.status).toBe("mismatch");
    const rows = await database.pool.query(
      `SELECT COUNT(*)::int AS n FROM "blog_interactive"."html_documents" WHERE "blog_id" = 999`,
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it("读取只返回绑定到该文章的文档", async () => {
    await repository.put("2", B, HTML_B);
    expect(await repository.getMetadata("1", A)).toMatchObject({ sha256: A });
    expect(await repository.getMetadata("2", A)).toBeNull();
    expect(await repository.getDocument("2", B)).toMatchObject({
      html: HTML_B,
    });
  });

  it("引用校验：存在、缺失、跨文章与语法错误", async () => {
    const ready = await assertReferencesReady(
      repository,
      "1",
      marker("demo", A),
    );
    expect(ready.ok).toBe(true);

    const missing = await assertReferencesReady(
      repository,
      "1",
      marker("demo", "f".repeat(64)),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.missing).toEqual(["f".repeat(64)]);

    const crossArticle = await assertReferencesReady(
      repository,
      "2",
      marker("demo", A),
    );
    expect(crossArticle.ok).toBe(false);

    const syntax = await assertReferencesReady(
      repository,
      "1",
      "```interactive-html\nnot json\n```",
    );
    expect(syntax.ok).toBe(false);
    if (!syntax.ok) expect(syntax.invalid.length).toBeGreaterThan(0);
  });

  it("引用校验拒绝超过 4 个块", async () => {
    const markdown = Array.from({ length: 5 }, (_, index) =>
      marker(`demo-${index}`, A),
    ).join("\n\n");
    const result = await assertReferencesReady(repository, "1", markdown);
    expect(result.ok).toBe(false);
  });

  it("文章删除级联删除资源", async () => {
    await repository.put("3", B, HTML_B);
    await database.pool.query(`DELETE FROM "blog" WHERE "id" = 3`);
    const rows = await database.pool.query(
      `SELECT COUNT(*)::int AS n FROM "blog_interactive"."html_documents" WHERE "blog_id" = 3`,
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it("一次快照同时读文章状态、正文与精确资源", async () => {
    await database.pool.query(
      `UPDATE "blog" SET "content_markdown" = $1 WHERE "id" = 1`,
      [marker("demo", A)],
    );
    const snapshot = await readArticleWithDocuments(repository, "1", A);
    expect(snapshot.kind).toBe("article");
    if (snapshot.kind !== "article") return;
    expect(snapshot.article).toMatchObject({
      status: "published",
      visibility: "public",
    });
    expect(snapshot.document.html).toBe(HTML_A);
    expect(markdownReferences(snapshot.article.contentMarkdown, A)).toBe(true);
    expect(markdownReferences(snapshot.article.contentMarkdown, B)).toBe(false);

    const notReferenced = await readArticleWithDocuments(repository, "2", A);
    expect(notReferenced.kind).toBe("not-found");
  });

  it("并发写入同一版本只产生一行且字节一致", async () => {
    const html = "<!doctype html><html><body>concurrent</body></html>";
    const digest = sha(html);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => repository.put("1", digest, html)),
    );
    expect(
      results.every(
        (result) => result.status === "created" || result.status === "existing",
      ),
    ).toBe(true);
    expect(
      results.filter((result) => result.status === "created"),
    ).toHaveLength(1);
    const rows = await database.pool.query(
      `SELECT COUNT(*)::int AS n FROM "blog_interactive"."html_documents" WHERE "sha256" = $1`,
      [digest],
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it("同一文章版本上限按事务串行生效", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 64; index += 1) {
      const html = `<!doctype html><html><body>v${index}</body></html>`;
      const digest = sha(html);
      ids.push(digest);
      await repository.put("2", digest, html);
    }
    const overflow = await repository.put("2", sha("overflow"), "overflow");
    expect(overflow).toEqual({ status: "storage-limit", reason: "versions" });
  });
});
