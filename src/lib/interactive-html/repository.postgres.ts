import type { BlogAgentQueryPool } from "@/lib/blog-agent/repository.postgres";
import {
  INTERACTIVE_HTML_LIMITS,
  extractInteractiveMarkers,
  SHA256_PATTERN,
} from "./marker";

/**
 * 文章绑定的不可变 HTML 存储。
 *
 * - 只有验证成功才 INSERT；重复 (blog_id, sha256) 必须字节完全一致。
 * - 公开引用唯一真源是文章当前正文，本表没有 pending/public 状态。
 * - 新版本的数量/总量检查与 INSERT 同事务，用固定 advisory lock 串行化
 *   短小上传事务，避免“读完额度后并发超额”。
 */

const UPLOAD_LOCK_KEY = 6_163_199_001;

export type StoredDocumentMetadata = {
  sha256: string;
  byteLength: number;
  profileVersion: number;
};

export type InteractiveHtmlWriteResult =
  | { status: "created"; metadata: StoredDocumentMetadata }
  | { status: "existing"; metadata: StoredDocumentMetadata }
  | { status: "mismatch" }
  | { status: "storage-limit"; reason: "versions" | "bytes" };

export class InteractiveHtmlStorageLimitError extends Error {
  constructor(public readonly reason: "versions" | "bytes") {
    super(
      reason === "versions"
        ? "interactive html version limit reached"
        : "interactive html storage limit reached",
    );
    this.name = "InteractiveHtmlStorageLimitError";
  }
}

function metadataFromRow(
  row: Record<string, unknown>,
): StoredDocumentMetadata | null {
  const byteLength = Number(row.byte_length);
  const profileVersion = Number(row.profile_version);
  if (
    typeof row.sha256 !== "string" ||
    !SHA256_PATTERN.test(row.sha256) ||
    !Number.isInteger(byteLength) ||
    byteLength < 1 ||
    byteLength > INTERACTIVE_HTML_LIMITS.maxDocumentBytes ||
    !Number.isInteger(profileVersion) ||
    profileVersion !== INTERACTIVE_HTML_LIMITS.profileVersion
  ) {
    return null;
  }
  return { sha256: row.sha256, byteLength, profileVersion };
}

export class PostgresInteractiveHtmlRepository implements Queryable {
  constructor(private readonly pool: BlogAgentQueryPool) {}

  /** 读辅助函数需要的查询入口；不暴露连接或事务控制。 */
  query(text: string, values?: readonly unknown[]) {
    return this.pool.query(text, values);
  }

  /**
   * 保存一份已验证的公开副本。
   * `html` 必须已经是最终字节（UTF-8 字符串，服务端不再归一化）。
   */
  async put(
    blogId: string,
    sha256: string,
    html: string,
    profileVersion = INTERACTIVE_HTML_LIMITS.profileVersion,
  ): Promise<InteractiveHtmlWriteResult> {
    const byteLength = Buffer.byteLength(html, "utf8");
    if (
      !SHA256_PATTERN.test(sha256) ||
      byteLength < 1 ||
      byteLength > INTERACTIVE_HTML_LIMITS.maxDocumentBytes ||
      profileVersion !== INTERACTIVE_HTML_LIMITS.profileVersion
    ) {
      throw new Error("invalid interactive html document metadata");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [UPLOAD_LOCK_KEY]);

      const existing = await client.query(
        `SELECT "sha256", "byte_length", "profile_version",
                ("html_text" = $3) AS "same_bytes"
           FROM "blog_interactive"."html_documents"
          WHERE "blog_id" = $1 AND "sha256" = $2`,
        [blogId, sha256, html],
      );
      const row = existing.rows[0];
      if (row) {
        const metadata = metadataFromRow(row);
        await client.query("COMMIT");
        if (!metadata || row.same_bytes !== true) return { status: "mismatch" };
        return { status: "existing", metadata };
      }

      const article = await client.query(
        `SELECT "id" FROM "blog" WHERE "id" = $1`,
        [blogId],
      );
      if (article.rows.length === 0) {
        await client.query("ROLLBACK");
        return { status: "mismatch" };
      }

      const usage = await client.query(
        `SELECT COUNT(*)::int AS "versions",
                COALESCE(SUM("byte_length"), 0)::bigint AS "bytes"
           FROM "blog_interactive"."html_documents"
          WHERE "blog_id" = $1`,
        [blogId],
      );
      const versions = Number(usage.rows[0]?.versions ?? 0);
      if (versions >= INTERACTIVE_HTML_LIMITS.maxStoredVersionsPerArticle) {
        await client.query("ROLLBACK");
        return { status: "storage-limit", reason: "versions" };
      }
      const total = await client.query(
        `SELECT COALESCE(SUM("byte_length"), 0)::bigint AS "bytes"
           FROM "blog_interactive"."html_documents"`,
      );
      const usedBytes = Number(total.rows[0]?.bytes ?? 0);
      if (
        usedBytes + byteLength >
        INTERACTIVE_HTML_LIMITS.maxStoredBytesTotal
      ) {
        await client.query("ROLLBACK");
        return { status: "storage-limit", reason: "bytes" };
      }

      await client.query(
        `INSERT INTO "blog_interactive"."html_documents"
           ("blog_id", "sha256", "html_text", "byte_length", "profile_version")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("blog_id", "sha256") DO NOTHING`,
        [blogId, sha256, html, byteLength, profileVersion],
      );
      // 并发插入同一版本时 ON CONFLICT 可能跳过；重新读取确认字节一致。
      const stored = await client.query(
        `SELECT "sha256", "byte_length", "profile_version",
                ("html_text" = $3) AS "same_bytes"
           FROM "blog_interactive"."html_documents"
          WHERE "blog_id" = $1 AND "sha256" = $2`,
        [blogId, sha256, html],
      );
      await client.query("COMMIT");
      const storedRow = stored.rows[0];
      const metadata = storedRow ? metadataFromRow(storedRow) : null;
      if (!metadata || storedRow.same_bytes !== true)
        return { status: "mismatch" };
      return { status: "created", metadata };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getMetadata(
    blogId: string,
    sha256: string,
  ): Promise<StoredDocumentMetadata | null> {
    const result = await this.pool.query(
      `SELECT "sha256", "byte_length", "profile_version"
         FROM "blog_interactive"."html_documents"
        WHERE "blog_id" = $1 AND "sha256" = $2`,
      [blogId, sha256],
    );
    const row = result.rows[0];
    return row ? metadataFromRow(row as Record<string, unknown>) : null;
  }

  async getDocument(
    blogId: string,
    sha256: string,
  ): Promise<(StoredDocumentMetadata & { html: string }) | null> {
    const result = await this.pool.query(
      `SELECT "sha256", "byte_length", "profile_version", "html_text"
         FROM "blog_interactive"."html_documents"
        WHERE "blog_id" = $1 AND "sha256" = $2`,
      [blogId, sha256],
    );
    const row = result.rows[0];
    if (!row) return null;
    const metadata = metadataFromRow(row as Record<string, unknown>);
    if (!metadata || typeof row.html_text !== "string") return null;
    return { ...metadata, html: row.html_text };
  }
}

export type ReferenceCheck =
  | { ok: true; documents: StoredDocumentMetadata[] }
  | { ok: false; missing: string[]; invalid: string[] };

export type ArticleSnapshot = {
  id: string;
  status: string;
  visibility: string;
  contentMarkdown: string;
};

export interface Queryable {
  query(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * 校验正文中所有引用是否真实存在且绑定当前文章。
 * 只读取元数据，不 SELECT 全部 HTML。
 */
export async function assertReferencesReady(
  queryable: Queryable,
  blogId: string,
  markdown: string,
): Promise<ReferenceCheck> {
  const { markers, errors } = extractInteractiveMarkers(markdown, {
    allowLocalPath: false,
  });
  if (errors.length > 0) {
    return { ok: false, missing: [], invalid: errors };
  }
  const shas = [...new Set(markers.map(({ marker }) => marker.sha256!))];
  if (shas.length === 0) return { ok: true, documents: [] };
  if (shas.length > INTERACTIVE_HTML_LIMITS.maxBlocksPerArticle) {
    return {
      ok: false,
      missing: [],
      invalid: [
        `每篇文章最多 ${INTERACTIVE_HTML_LIMITS.maxBlocksPerArticle} 个互动块`,
      ],
    };
  }
  const result = await queryable.query(
    `SELECT "sha256", "byte_length", "profile_version"
       FROM "blog_interactive"."html_documents"
      WHERE "blog_id" = $1 AND "sha256" = ANY($2::text[])`,
    [blogId, shas],
  );
  const found = new Map<string, StoredDocumentMetadata>();
  for (const row of result.rows) {
    const metadata = metadataFromRow(row as Record<string, unknown>);
    if (metadata) found.set(metadata.sha256, metadata);
  }
  const missing = shas.filter((sha) => !found.has(sha));
  const documents = shas.flatMap((sha) => {
    const metadata = found.get(sha);
    return metadata ? [metadata] : [];
  });
  const totalBytes = documents.reduce((sum, doc) => sum + doc.byteLength, 0);
  if (
    missing.length === 0 &&
    totalBytes > INTERACTIVE_HTML_LIMITS.maxReferencedBytes
  ) {
    return {
      ok: false,
      missing: [],
      invalid: ["当前引用的互动资源超过 2 MiB"],
    };
  }
  return missing.length > 0
    ? { ok: false, missing, invalid: [] }
    : { ok: true, documents };
}

/**
 * 一次 SQL 快照：文章当前状态/正文与精确资源在同一语句中获得。
 * 调用方再用权威 parser 校验引用，避免两次普通 SELECT 看到不同提交状态。
 */
export async function readArticleWithDocuments(
  queryable: Queryable,
  blogId: string,
  sha256: string,
): Promise<
  | { kind: "not-found" }
  | {
      kind: "article";
      article: ArticleSnapshot;
      document: StoredDocumentMetadata & { html: string };
    }
> {
  const result = await queryable.query(
    `SELECT b."id" AS "blog_id", b."status", b."visibility", b."content_markdown",
            d."sha256", d."byte_length", d."profile_version", d."html_text"
       FROM "blog" b
       LEFT JOIN "blog_interactive"."html_documents" d
         ON d."blog_id" = b."id" AND d."sha256" = $2
      WHERE b."id" = $1`,
    [blogId, sha256],
  );
  const row = result.rows[0];
  if (!row) return { kind: "not-found" };
  if (
    typeof row.content_markdown !== "string" ||
    typeof row.status !== "string" ||
    typeof row.visibility !== "string" ||
    typeof row.html_text !== "string"
  ) {
    return { kind: "not-found" };
  }
  const metadata = metadataFromRow(row as Record<string, unknown>);
  if (!metadata) return { kind: "not-found" };
  return {
    kind: "article",
    article: {
      id: String(row.blog_id),
      status: row.status,
      visibility: row.visibility,
      contentMarkdown: row.content_markdown,
    },
    document: { ...metadata, html: row.html_text },
  };
}

/** 当前正文是否引用了该 hash（用于读取授权）。 */
export function markdownReferences(markdown: string, sha256: string): boolean {
  const { markers } = extractInteractiveMarkers(markdown, {
    allowLocalPath: false,
  });
  return markers.some(({ marker }) => marker.sha256 === sha256);
}
