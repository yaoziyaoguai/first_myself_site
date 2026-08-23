import { describe, expect, it, vi } from "vitest";
import {
  PostgresArticleIndexRepository,
} from "@/lib/blog-agent/articleIndexRepository.postgres";
import type {
  BlogAgentQueryClient,
  BlogAgentQueryPool,
} from "@/lib/blog-agent/repository.postgres";

function createDatabase(rows: Record<string, unknown>[] = []) {
  const query = vi.fn(async (
    _text: string,
    _values?: readonly unknown[],
  ) => {
    void _text;
    void _values;
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
      blog_id: "42",
      article_hash: "a".repeat(64),
      package_hash: "b".repeat(64),
      manifest_json: { version: 1 },
      embedding_model: "qwen3.7-text-embedding",
      embedding_dimensions: 3,
      indexed_at: new Date("2026-08-23T00:00:00.000Z"),
      chunk_id: "material:loop:0",
      source_kind: "code",
      source_path: "src/loop.py",
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

    expect(result?.chunks).toHaveLength(1);
    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain('p."blog_id" = $1');
    expect(sql).toContain('p."package_hash" = $2');
    expect(sql).toContain('p."article_hash" = $3');
    expect(sql).toContain("LIMIT 128");
    expect(values).toEqual(["42", "b".repeat(64), "a".repeat(64)]);
    expect(sql).not.toMatch(/trigram|<->|@@|ORDER BY[\s\S]*embedding/i);
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
});
