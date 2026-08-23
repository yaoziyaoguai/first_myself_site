import type { QueryResultRow } from "pg";
import type {
  ArticleChunkRecord,
  ArticleChunkSourceKind,
  ArticleIndexRepository,
  ArticlePackageSummary,
  ReadyArticlePackage,
} from "./articleIndexRepository";
import type { BlogAgentQueryPool } from "./repository.postgres";

const SOURCE_KINDS = new Set<ArticleChunkSourceKind>([
  "article",
  "code",
  "documentation",
  "data",
  "image-description",
]);

export class ArticlePackageIndexConflictError extends Error {
  constructor() {
    super("article package state conflict");
    this.name = "ArticlePackageIndexConflictError";
  }
}

function integer(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizedBlogId(value: unknown): string | null {
  const parsed = integer(value);
  return parsed === null ? null : String(parsed);
}

function finiteVector(value: unknown, dimensions: number): number[] | null {
  if (!Array.isArray(value) || value.length !== dimensions) return null;
  const vector = value.map(Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function parseChunk(row: QueryResultRow, dimensions: number): ArticleChunkRecord | null {
  const sourceKind = row.source_kind;
  const ordinal = integer(row.ordinal);
  const embedding = finiteVector(row.embedding, dimensions);
  if (
    typeof row.chunk_id !== "string" ||
    typeof sourceKind !== "string" ||
    !SOURCE_KINDS.has(sourceKind as ArticleChunkSourceKind) ||
    typeof row.source_path !== "string" ||
    typeof row.heading !== "string" ||
    typeof row.anchor !== "string" ||
    ordinal === null ||
    typeof row.content !== "string" ||
    !embedding
  ) {
    return null;
  }
  return {
    id: row.chunk_id,
    sourceKind: sourceKind as ArticleChunkSourceKind,
    sourcePath: row.source_path,
    heading: row.heading,
    anchor: row.anchor,
    ordinal,
    content: row.content,
    embedding,
  };
}

function validatePackage(input: ReadyArticlePackage): void {
  if (input.chunks.length > 128) throw new Error("article package exceeds 128 chunks");
  if (!Number.isInteger(input.embeddingDimensions) || input.embeddingDimensions <= 0) {
    throw new Error("invalid embedding dimensions");
  }
  const ids = new Set<string>();
  for (const chunk of input.chunks) {
    if (ids.has(chunk.id)) throw new Error("duplicate article chunk id");
    ids.add(chunk.id);
    if (
      chunk.embedding.length !== input.embeddingDimensions ||
      !chunk.embedding.every(Number.isFinite)
    ) {
      throw new Error("article chunk embedding dimensions do not match package");
    }
  }
}

export class PostgresArticleIndexRepository implements ArticleIndexRepository {
  constructor(private readonly pool: BlogAgentQueryPool) {}

  async getReadyPackage(
    request: Parameters<ArticleIndexRepository["getReadyPackage"]>[0],
  ): Promise<ReadyArticlePackage | null> {
    const result = await this.pool.query(
      `SELECT
         p."blog_id", p."article_hash", p."package_hash", p."manifest_json",
         p."embedding_model", p."embedding_dimensions", p."indexed_at",
         c."chunk_id", c."source_kind", c."source_path", c."heading",
         c."anchor", c."ordinal", c."content", c."embedding"
       FROM "blog_agent"."article_packages" p
       LEFT JOIN "blog_agent"."article_chunks" c
         ON c."blog_id" = p."blog_id" AND c."package_hash" = p."package_hash"
       WHERE p."blog_id" = $1
         AND p."package_hash" = $2
         AND p."article_hash" = $3
       ORDER BY c."ordinal", c."chunk_id"
       LIMIT 128`,
      [request.blogId, request.packageHash, request.articleHash],
    );
    const first = result.rows[0];
    if (!first) return null;
    const dimensions = integer(first.embedding_dimensions);
    const blogId = normalizedBlogId(first.blog_id);
    if (
      !blogId ||
      typeof first.article_hash !== "string" ||
      typeof first.package_hash !== "string" ||
      typeof first.embedding_model !== "string" ||
      !dimensions ||
      !(first.indexed_at instanceof Date)
    ) {
      return null;
    }
    const chunks = result.rows.flatMap((row) => {
      if (row.chunk_id === null) return [];
      const chunk = parseChunk(row, dimensions);
      return chunk ? [chunk] : [];
    });
    if (chunks.length !== result.rows.filter((row) => row.chunk_id !== null).length) {
      return null;
    }
    return {
      blogId,
      articleHash: first.article_hash,
      packageHash: first.package_hash,
      manifest: first.manifest_json,
      embeddingModel: first.embedding_model,
      embeddingDimensions: dimensions,
      indexedAt: first.indexed_at,
      chunks,
    };
  }

  async getPackageSummary(
    request: Parameters<ArticleIndexRepository["getPackageSummary"]>[0],
  ): Promise<ArticlePackageSummary | null> {
    const result = await this.pool.query(
      `SELECT "blog_id", "article_hash", "package_hash", "embedding_model",
              "embedding_dimensions", "chunk_count", "indexed_at"
         FROM "blog_agent"."article_packages"
        WHERE "blog_id" = $1 AND "package_hash" = $2`,
      [request.blogId, request.packageHash],
    );
    const row = result.rows[0];
    const dimensions = integer(row?.embedding_dimensions);
    const chunkCount = integer(row?.chunk_count);
    const blogId = normalizedBlogId(row?.blog_id);
    if (
      !row ||
      !blogId ||
      typeof row.article_hash !== "string" ||
      typeof row.package_hash !== "string" ||
      typeof row.embedding_model !== "string" ||
      !dimensions ||
      chunkCount === null ||
      !(row.indexed_at instanceof Date)
    ) {
      return null;
    }
    return {
      blogId,
      articleHash: row.article_hash,
      packageHash: row.package_hash,
      embeddingModel: row.embedding_model,
      embeddingDimensions: dimensions,
      indexedAt: row.indexed_at,
      chunkCount,
    };
  }

  async replacePackage(input: ReadyArticlePackage): Promise<void> {
    validatePackage(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const article = await client.query(
        `SELECT "agent_package_hash"
           FROM "blog"
          WHERE "id" = $1
          FOR UPDATE`,
        [input.blogId],
      );
      if (article.rows[0]?.agent_package_hash !== input.packageHash) {
        throw new ArticlePackageIndexConflictError();
      }
      await client.query(
        `DELETE FROM "blog_agent"."article_packages"
          WHERE "blog_id" = $1 AND "package_hash" <> $2`,
        [input.blogId, input.packageHash],
      );
      await client.query(
        `INSERT INTO "blog_agent"."article_packages"
           ("blog_id", "package_hash", "article_hash", "manifest_json",
            "embedding_model", "embedding_dimensions", "chunk_count", "indexed_at")
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
         ON CONFLICT ("blog_id", "package_hash") DO UPDATE SET
           "article_hash" = EXCLUDED."article_hash",
           "manifest_json" = EXCLUDED."manifest_json",
           "embedding_model" = EXCLUDED."embedding_model",
           "embedding_dimensions" = EXCLUDED."embedding_dimensions",
           "chunk_count" = EXCLUDED."chunk_count",
           "indexed_at" = EXCLUDED."indexed_at"`,
        [
          input.blogId,
          input.packageHash,
          input.articleHash,
          JSON.stringify(input.manifest),
          input.embeddingModel,
          input.embeddingDimensions,
          input.chunks.length,
          input.indexedAt,
        ],
      );
      await client.query(
        `DELETE FROM "blog_agent"."article_chunks"
          WHERE "blog_id" = $1 AND "package_hash" = $2`,
        [input.blogId, input.packageHash],
      );
      for (const chunk of input.chunks) {
        await client.query(
          `INSERT INTO "blog_agent"."article_chunks"
             ("blog_id", "package_hash", "chunk_id", "source_kind", "source_path",
              "heading", "anchor", "ordinal", "content", "embedding")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::real[])`,
          [
            input.blogId,
            input.packageHash,
            chunk.id,
            chunk.sourceKind,
            chunk.sourcePath,
            chunk.heading,
            chunk.anchor,
            chunk.ordinal,
            chunk.content,
            chunk.embedding,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
