import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MigrateUpArgs } from "@payloadcms/db-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  PostgresArticleIndexRepository,
} from "@/lib/blog-agent/articleIndexRepository.postgres";
import { hashPublicArticle } from "@/lib/blog-agent/articlePackage";
import type {
  BlogAgentQueryClient,
  BlogAgentQueryPool,
} from "@/lib/blog-agent/repository.postgres";
import { up as migrateArticlePackages } from "@/payload/migrations/20260823_000000_add_blog_agent_article_packages";
import { up as migrateGithubSources } from "@/payload/migrations/20260824_000000_add_blog_agent_github_sources";
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from "../../helpers/blogAgentPostgres";

function createDatabase(
  rows: Record<string, unknown>[] = [],
  expectedPackageHash = "b".repeat(64),
  articleRow?: Record<string, unknown>,
) {
  const query = vi.fn(async (
    text: string,
    _values?: readonly unknown[],
  ) => {
    void _values;
    if (text.includes('FROM "blog"')) {
      return { rows: [articleRow ?? { agent_package_hash: expectedPackageHash }] };
    }
    return { rows };
  });
  const release = vi.fn();
  const client = { query, release } as unknown as BlogAgentQueryClient;
  const pool = {
    connect: vi.fn(async () => client),
    query,
  } as unknown as BlogAgentQueryPool;
  return { pool, query, release };
}

const packageInput = {
  blogId: "42",
  articleHash: "a".repeat(64),
  packageHash: "b".repeat(64),
  manifest: { version: 1 },
  embeddingModel: "qwen3.7-text-embedding",
  embeddingDimensions: 3,
  indexedAt: new Date("2026-08-23T00:00:00.000Z"),
  chunks: [{
    id: "material:loop:0",
    sourceKind: "code" as const,
    sourcePath: "src/loop.py",
    sourceRepository: "https://github.com/yaoziyaoguai/my-first-agent",
    sourceCommit: "a".repeat(40),
    sourceLineStart: 12,
    sourceLineEnd: 27,
    heading: "Agent 主循环",
    anchor: "核心实现",
    ordinal: 0,
    content: "while steps < max_steps:",
    embedding: [1, 0, 0],
  }],
};

describe("PostgresArticleIndexRepository", () => {
  it("loads chunks only through an exact server-owned Blog and package filter", async () => {
    const database = createDatabase([{
      blog_id: 42,
      article_hash: "a".repeat(64),
      package_hash: "b".repeat(64),
      manifest_json: { version: 1 },
      embedding_model: "qwen3.7-text-embedding",
      embedding_dimensions: 3,
      indexed_at: new Date("2026-08-23T00:00:00.000Z"),
      chunk_id: "material:loop:0",
      source_kind: "code",
      source_path: "src/loop.py",
      source_repository: "https://github.com/yaoziyaoguai/my-first-agent",
      source_commit: "a".repeat(40),
      source_line_start: 12,
      source_line_end: 27,
      heading: "Agent 主循环",
      anchor: "核心实现",
      ordinal: 0,
      content: "loop",
      embedding: [1, 0, 0],
    }]);
    const repository = new PostgresArticleIndexRepository(database.pool);

    const result = await repository.getReadyPackage({
      blogId: "42",
      articleHash: "a".repeat(64),
      packageHash: "b".repeat(64),
    });

    expect(result?.chunks).toEqual([expect.objectContaining({
      sourceRepository: "https://github.com/yaoziyaoguai/my-first-agent",
      sourceCommit: "a".repeat(40),
      sourceLineStart: 12,
      sourceLineEnd: 27,
    })]);
    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('p."blog_id" = $1');
    expect(sql).toContain('p."package_hash" = $2');
    expect(sql).toContain('p."article_hash" = $3');
    expect(sql).toContain("LIMIT 128");
    expect(values).toEqual(["42", "b".repeat(64), "a".repeat(64)]);
    expect(sql).not.toMatch(/trigram|<->|@@|ORDER BY[\s\S]*embedding/i);
  });

  it("keeps legacy chunks without GitHub metadata readable", async () => {
    const database = createDatabase([{
      blog_id: 42,
      article_hash: "a".repeat(64),
      package_hash: "b".repeat(64),
      manifest_json: { version: 1 },
      embedding_model: "qwen3.7-text-embedding",
      embedding_dimensions: 3,
      indexed_at: new Date("2026-08-23T00:00:00.000Z"),
      chunk_id: "material:legacy:0",
      source_kind: "code",
      source_path: "src/legacy.py",
      source_repository: null,
      source_commit: null,
      source_line_start: null,
      source_line_end: null,
      heading: "旧代码",
      anchor: "核心实现",
      ordinal: 0,
      content: "legacy()",
      embedding: [1, 0, 0],
    }]);
    const repository = new PostgresArticleIndexRepository(database.pool);

    const result = await repository.getReadyPackage({
      blogId: "42",
      articleHash: "a".repeat(64),
      packageHash: "b".repeat(64),
    });

    expect(result?.chunks[0]).toEqual(expect.objectContaining({
      sourcePath: "src/legacy.py",
      content: "legacy()",
    }));
    expect(result?.chunks[0]).not.toHaveProperty("sourceRepository");
    expect(result?.chunks[0]).not.toHaveProperty("sourceCommit");
    expect(result?.chunks[0]).not.toHaveProperty("sourceLineStart");
    expect(result?.chunks[0]).not.toHaveProperty("sourceLineEnd");
  });

  it("transactionally replaces one Blog package and releases the connection", async () => {
    const database = createDatabase();
    const repository = new PostgresArticleIndexRepository(database.pool);

    await repository.replacePackage(packageInput);

    const statements = database.query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).toContain("BEGIN");
    expect(statements).toContain('DELETE FROM "blog_agent"."article_packages"');
    expect(statements).toContain('INSERT INTO "blog_agent"."article_packages"');
    expect(statements).toContain('INSERT INTO "blog_agent"."article_chunks"');
    expect(statements).toContain('"source_repository"');
    expect(statements).toContain('"source_line_start"');
    expect(statements).toContain("COMMIT");
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("rolls back invalid embedding dimensions without partial writes", async () => {
    const database = createDatabase();
    const repository = new PostgresArticleIndexRepository(database.pool);

    await expect(repository.replacePackage({
      ...packageInput,
      chunks: [{ ...packageInput.chunks[0], embedding: [1, 0] }],
    })).rejects.toThrow("embedding dimensions");

    expect(database.query).not.toHaveBeenCalled();
    expect(database.release).not.toHaveBeenCalled();
  });

  it("rejects a stale package before deleting the current Blog package", async () => {
    const database = createDatabase([], "c".repeat(64));
    const repository = new PostgresArticleIndexRepository(database.pool);

    await expect(repository.replacePackage(packageInput)).rejects.toThrow(
      "article package state conflict",
    );

    const statements = database.query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).toContain('FROM "blog"');
    expect(statements).not.toContain('DELETE FROM "blog_agent"."article_packages"');
    expect(statements).toContain("ROLLBACK");
  });

  it("atomically swaps a ready public package only from the exact article snapshot", async () => {
    const previousPackageHash = "c".repeat(64);
    const article = {
      id: "42",
      slug: "agent-loop",
      title: "Agent Loop",
      excerpt: "一个受控循环",
      contentMarkdown: "主要内容",
    };
    const database = createDatabase([], packageInput.packageHash, {
      id: 42,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      content_markdown: article.contentMarkdown,
      status: "published",
      visibility: "public",
      agent_context_required: true,
      agent_package_hash: previousPackageHash,
      agent_index_status: "ready",
      agent_indexed_package_hash: previousPackageHash,
    });
    const repository = new PostgresArticleIndexRepository(database.pool);

    await repository.replacePublishedPackage({
      ...packageInput,
      article,
      previousPackageHash,
    });

    const statements = database.query.mock.calls.map(([sql]) => sql).join("\n");
    const insertIndex = statements.indexOf('INSERT INTO "blog_agent"."article_packages"');
    const updateIndex = statements.indexOf('UPDATE "blog"');
    expect(statements).toContain("FOR UPDATE");
    expect(insertIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(insertIndex);
    expect(statements).not.toContain('DELETE FROM "blog_agent"."article_packages"');
    expect(statements).toContain('"agent_index_status" = \'ready\'');
    expect(statements).toContain("COMMIT");
  });

  it("rolls back a published refresh when writing the replacement fails", async () => {
    const previousPackageHash = "c".repeat(64);
    const article = {
      id: "42",
      slug: "agent-loop",
      title: "Agent Loop",
      excerpt: "一个受控循环",
      contentMarkdown: "主要内容",
    };
    const database = createDatabase([], packageInput.packageHash, {
      id: 42,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      content_markdown: article.contentMarkdown,
      status: "published",
      visibility: "public",
      agent_context_required: true,
      agent_package_hash: previousPackageHash,
      agent_index_status: "ready",
      agent_indexed_package_hash: previousPackageHash,
    });
    database.query.mockImplementation(async (text: string) => {
      if (text.includes('FROM "blog"')) {
        return { rows: [{
          id: 42,
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          content_markdown: article.contentMarkdown,
          status: "published",
          visibility: "public",
          agent_context_required: true,
          agent_package_hash: previousPackageHash,
          agent_index_status: "ready",
          agent_indexed_package_hash: previousPackageHash,
        }] };
      }
      if (text.includes('INSERT INTO "blog_agent"."article_chunks"')) {
        throw new Error("simulated chunk write failure");
      }
      return { rows: [] };
    });
    const repository = new PostgresArticleIndexRepository(database.pool);

    await expect(repository.replacePublishedPackage({
      ...packageInput,
      article,
      previousPackageHash,
    })).rejects.toThrow("simulated chunk write failure");

    const statements = database.query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(statements).not.toContain('DELETE FROM "blog_agent"."article_packages"');
    expect(database.release).toHaveBeenCalledOnce();
  });

  it("leaves the live package untouched when a published snapshot changed", async () => {
    const previousPackageHash = "c".repeat(64);
    const article = {
      id: "42",
      slug: "agent-loop",
      title: "Agent Loop",
      excerpt: "一个受控循环",
      contentMarkdown: "主要内容",
    };
    const database = createDatabase([], packageInput.packageHash, {
      ...article,
      content_markdown: "后台刚刚修改过的正文",
      status: "published",
      visibility: "public",
      agent_context_required: true,
      agent_package_hash: previousPackageHash,
      agent_index_status: "ready",
      agent_indexed_package_hash: previousPackageHash,
    });
    const repository = new PostgresArticleIndexRepository(database.pool);

    await expect(repository.replacePublishedPackage({
      ...packageInput,
      article,
      previousPackageHash,
    })).rejects.toThrow("article package state conflict");

    const statements = database.query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).not.toContain('INSERT INTO "blog_agent"."article_packages"');
    expect(statements).not.toContain('UPDATE "blog"');
    expect(statements).toContain("ROLLBACK");
  });
});

const describePostgres = process.env.BLOG_AGENT_TEST_DATABASE_URL
  ? describe
  : describe.skip;

describePostgres("PostgresArticleIndexRepository on PostgreSQL 15", () => {
  let database: IsolatedPostgresDatabase;
  const dialect = new PgDialect();

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase();
    await database.pool.query(`CREATE TABLE "blog" (
      "id" serial PRIMARY KEY,
      "slug" text NOT NULL DEFAULT '',
      "title" text NOT NULL DEFAULT '',
      "excerpt" text NOT NULL DEFAULT '',
      "content_markdown" text NOT NULL DEFAULT '',
      "reading_time" text NOT NULL DEFAULT '',
      "published_date" timestamptz NOT NULL DEFAULT '2026-05-20T12:00:00Z',
      "series" integer,
      "status" text NOT NULL DEFAULT 'draft',
      "visibility" text NOT NULL DEFAULT 'private',
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await migrateArticlePackages({
      db: {
        execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
          const compiled = dialect.sqlToQuery(query);
          return database.pool.query(compiled.sql, compiled.params);
        },
      },
    } as unknown as MigrateUpArgs);
    await migrateGithubSources({
      db: {
        execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
          const compiled = dialect.sqlToQuery(query);
          return database.pool.query(compiled.sql, compiled.params);
        },
      },
    } as unknown as MigrateUpArgs);
    await database.pool.query(
      'INSERT INTO "blog" ("id") VALUES (42), (43), (45)',
    );
    await database.pool.query(
      'UPDATE "blog" SET "agent_package_hash" = $1 WHERE "id" IN (42, 43, 45)',
      [packageInput.packageHash],
    );
  });

  afterAll(async () => database?.destroy());

  async function seedPublished(id: string) {
    const article = { id, slug: `post-${id}`, title: "旧标题", excerpt: "旧摘要", contentMarkdown: "旧正文" };
    const previousPackageHash = "f".repeat(64);
    await database.pool.query(
      `INSERT INTO "blog" ("id", "slug", "title", "excerpt", "content_markdown", "reading_time", "series",
        "status", "visibility", "agent_context_required", "agent_package_hash", "agent_index_status", "agent_indexed_package_hash")
       VALUES ($1, $2, $3, $4, $5, '约 3 分钟', 2, 'published', 'public', true, $6, 'ready', $6)`,
      [id, article.slug, article.title, article.excerpt, article.contentMarkdown, previousPackageHash],
    );
    const repository = new PostgresArticleIndexRepository(database.pool);
    await repository.replacePackage({ ...packageInput, blogId: id, packageHash: previousPackageHash, articleHash: hashPublicArticle(article) });
    const replacement = { title: "新标题", excerpt: "新摘要", contentMarkdown: "新正文", readingTime: "约 4 分钟" };
    const next = { ...packageInput, blogId: id, article, replacement, previousPackageHash, articleHash: hashPublicArticle({ ...article, ...replacement }) };
    return { repository, article, next };
  }

  it("commits revised prose and its matching index together while retaining metadata and old readers", async () => {
    const { repository, article, next } = await seedPublished("46");
    await repository.replacePublishedPackage(next);
    const { rows } = await database.pool.query('SELECT * FROM "blog" WHERE id = 46');
    expect(rows[0]).toMatchObject({
      slug: article.slug, title: "新标题", excerpt: "新摘要", content_markdown: "新正文", reading_time: "约 4 分钟",
      series: 2, published_date: new Date("2026-05-20T12:00:00Z"), status: "published", visibility: "public",
      agent_index_status: "ready", agent_package_hash: next.packageHash, agent_indexed_package_hash: next.packageHash,
    });
    const current = await repository.getReadyPackage({ blogId: "46", articleHash: next.articleHash, packageHash: next.packageHash });
    const previous = await repository.getReadyPackage({ blogId: "46", articleHash: hashPublicArticle(article), packageHash: next.previousPackageHash });
    expect(current?.chunks[0]).toMatchObject({ sourceCommit: "a".repeat(40), sourceLineStart: 12, sourceLineEnd: 27 });
    expect(previous).not.toBeNull();
  });

  it("rolls back BOTH prose and all replacement chunks when the final ready switch fails", async () => {
    const { repository, article, next } = await seedPublished("47");
    await database.pool.query(`CREATE FUNCTION reject_revision() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.id = 47 AND NEW.agent_package_hash <> OLD.agent_package_hash THEN
          RAISE EXCEPTION 'simulated final switch failure';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER reject_revision BEFORE UPDATE ON blog FOR EACH ROW EXECUTE FUNCTION reject_revision()`);
    try {
      await expect(repository.replacePublishedPackage(next)).rejects.toThrow("simulated final switch failure");
      const { rows } = await database.pool.query('SELECT * FROM "blog" WHERE id = 47');
      expect(rows[0]).toMatchObject({ title: article.title, content_markdown: article.contentMarkdown, reading_time: "约 3 分钟",
        agent_package_hash: next.previousPackageHash, agent_index_status: "ready" });
      expect(await repository.getPackageSummary({ blogId: "47", packageHash: next.packageHash })).toBeNull();
      expect(await repository.getReadyPackage({ blogId: "47", articleHash: hashPublicArticle(article), packageHash: next.previousPackageHash })).not.toBeNull();
    } finally {
      await database.pool.query('DROP TRIGGER reject_revision ON blog; DROP FUNCTION reject_revision()');
    }
  });

  it("allows exactly one of two competing revisions and never overwrites the winner", async () => {
    const { repository, next } = await seedPublished("48");
    const otherReplacement = { ...next.replacement, title: "另一位编辑的新标题" };
    const other = { ...next, packageHash: "c".repeat(64), replacement: otherReplacement,
      articleHash: hashPublicArticle({ ...next.article, ...otherReplacement }) };
    const results = await Promise.allSettled([
      repository.replacePublishedPackage(next), repository.replacePublishedPackage(other),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const winner = results[0].status === "fulfilled" ? next : other;
    const { rows } = await database.pool.query('SELECT * FROM blog WHERE id = 48');
    expect(rows[0]).toMatchObject({ title: winner.replacement.title, agent_package_hash: winner.packageHash });
  });

  it("round-trips JSONB and real[] while isolating Blogs", async () => {
    const repository = new PostgresArticleIndexRepository(database.pool);
    await repository.replacePackage(packageInput);
    await repository.replacePackage({
      ...packageInput,
      blogId: "43",
      articleHash: "c".repeat(64),
      chunks: [{
        ...packageInput.chunks[0],
        id: "material:other:0",
        content: "other Blog material",
        embedding: [0, 1, 0],
      }],
    });

    const loaded = await repository.getReadyPackage({
      blogId: "42",
      articleHash: packageInput.articleHash,
      packageHash: packageInput.packageHash,
    });
    const summary = await repository.getPackageSummary({
      blogId: "42",
      packageHash: packageInput.packageHash,
    });

    expect(loaded).toMatchObject({
      blogId: "42",
      articleHash: packageInput.articleHash,
      packageHash: packageInput.packageHash,
      manifest: { version: 1 },
      chunks: [{
        id: "material:loop:0",
        content: "while steps < max_steps:",
        embedding: [1, 0, 0],
      }],
    });
    expect(JSON.stringify(loaded)).not.toContain("other Blog material");
    expect(summary).toMatchObject({
      blogId: "42",
      chunkCount: 1,
      embeddingDimensions: 3,
    });
  });

  it("atomically keeps a published article ready while replacing its package", async () => {
    const previousPackageHash = "d".repeat(64);
    const article = {
      id: "44",
      slug: "agent-loop",
      title: "Agent Loop",
      excerpt: "一个受控循环",
      contentMarkdown: "主要内容",
    };
    await database.pool.query(
      `INSERT INTO "blog"
         ("id", "slug", "title", "excerpt", "content_markdown", "status", "visibility",
          "agent_context_required", "agent_package_hash", "agent_index_status",
          "agent_indexed_package_hash")
       VALUES (44, $1, $2, $3, $4, 'published', 'public', true, $5, 'ready', $5)`,
      [
        article.slug,
        article.title,
        article.excerpt,
        article.contentMarkdown,
        previousPackageHash,
      ],
    );
    const repository = new PostgresArticleIndexRepository(database.pool);

    const previousArticleHash = "e".repeat(64);
    await repository.replacePackage({
      ...packageInput,
      blogId: article.id,
      packageHash: previousPackageHash,
      articleHash: previousArticleHash,
    });

    await repository.replacePublishedPackage({
      ...packageInput,
      blogId: article.id,
      article,
      previousPackageHash,
    });

    const state = await database.pool.query(
      `SELECT "status", "visibility", "agent_package_hash", "agent_index_status",
              "agent_indexed_package_hash"
         FROM "blog" WHERE "id" = 44`,
    );
    const readyPackage = await repository.getReadyPackage({
      blogId: article.id,
      articleHash: packageInput.articleHash,
      packageHash: packageInput.packageHash,
    });
    const inFlightOldPackage = await repository.getReadyPackage({
      blogId: article.id,
      articleHash: previousArticleHash,
      packageHash: previousPackageHash,
    });
    expect(state.rows[0]).toMatchObject({
      status: "published",
      visibility: "public",
      agent_package_hash: packageInput.packageHash,
      agent_index_status: "ready",
      agent_indexed_package_hash: packageInput.packageHash,
    });
    expect(readyPackage?.chunks[0]).toMatchObject({
      sourceRepository: "https://github.com/yaoziyaoguai/my-first-agent",
      sourceLineStart: 12,
      sourceLineEnd: 27,
    });
    expect(inFlightOldPackage?.packageHash).toBe(previousPackageHash);
  });

  it("accepts legacy NULL line metadata but rejects either one-sided line bound", async () => {
    const repository = new PostgresArticleIndexRepository(database.pool);
    await repository.replacePackage({
      ...packageInput,
      blogId: "45",
      chunks: [{
        ...packageInput.chunks[0],
        id: "material:base:0",
      }],
    });
    const insert = `INSERT INTO "blog_agent"."article_chunks"
      ("blog_id", "package_hash", "chunk_id", "source_kind", "source_path",
       "source_repository", "source_commit", "source_line_start", "source_line_end",
       "heading", "anchor", "ordinal", "content", "embedding")
      VALUES (45, $1, $2, 'documentation', 'docs/legacy.md', NULL, NULL, $3, $4,
              'Legacy', 'top', 1, 'legacy', ARRAY[1, 0, 0]::real[])`;

    await expect(database.pool.query(
      insert,
      [packageInput.packageHash, "material:legacy:null", null, null],
    )).resolves.toBeDefined();
    await expect(database.pool.query(
      insert,
      [packageInput.packageHash, "material:legacy:start", 1, null],
    )).rejects.toThrow(/article_chunks_source_lines_check/);
    await expect(database.pool.query(
      insert,
      [packageInput.packageHash, "material:legacy:end", null, 1],
    )).rejects.toThrow(/article_chunks_source_lines_check/);
  });
});
