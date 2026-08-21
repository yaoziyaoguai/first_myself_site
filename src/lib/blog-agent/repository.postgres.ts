import type { QueryResultRow } from "pg";
import type {
  BlogAgentRepository,
  CachedGroundedAnswer,
  GenerationReservation,
} from "./repository";

type QueryResult = { rows: QueryResultRow[] };

export interface BlogAgentQueryClient {
  query(text: string, values?: readonly unknown[]): Promise<QueryResult>;
  release(): void;
}

export interface BlogAgentQueryPool {
  query(text: string, values?: readonly unknown[]): Promise<QueryResult>;
  connect(): Promise<BlogAgentQueryClient>;
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function safeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function safeTokenCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function parseCachedAnswer(value: unknown): CachedGroundedAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.answer !== "string" ||
    !Array.isArray(record.citationIds) ||
    !record.citationIds.every((id) => typeof id === "string") ||
    typeof record.insufficientEvidence !== "boolean"
  ) {
    return null;
  }
  if (
    record.insufficientEvidence &&
    (record.answer !== "" || record.citationIds.length !== 0)
  ) {
    return null;
  }
  if (!record.insufficientEvidence && (!record.answer.trim() || record.citationIds.length === 0)) {
    return null;
  }
  return {
    answer: record.answer,
    citationIds: [...new Set(record.citationIds)],
    insufficientEvidence: record.insufficientEvidence,
  };
}

export class PostgresBlogAgentRepository implements BlogAgentRepository {
  constructor(private readonly pool: BlogAgentQueryPool) {}

  async reserveGeneration(
    request: Parameters<BlogAgentRepository["reserveGeneration"]>[0],
  ): Promise<GenerationReservation> {
    const client = await this.pool.connect();
    const day = utcDay(request.now);
    const windowStart = new Date(request.now.getTime() - request.limits.windowMs);
    const eventRetentionStart = new Date(request.now.getTime() - 86_400_000);

    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`blog-agent-generation:${day}`],
      );
      await client.query(
        'DELETE FROM "blog_agent"."generation_events" WHERE "created_at" < $1',
        [eventRetentionStart],
      );
      const countsResult = await client.query(
        `SELECT
          (SELECT COUNT(*)::integer
             FROM "blog_agent"."generation_events"
            WHERE "identity_hash" = $1 AND "created_at" >= $2) AS window_count,
          (SELECT COALESCE("request_count", 0)::integer
             FROM "blog_agent"."usage_daily"
            WHERE "day" = $3 AND "identity_hash" = $1) AS identity_daily_count,
          (SELECT COALESCE(SUM("request_count"), 0)::integer
             FROM "blog_agent"."usage_daily"
            WHERE "day" = $3) AS global_daily_count`,
        [request.identityHash, windowStart, day],
      );
      const counts = countsResult.rows[0] ?? {};
      const windowCount = safeCount(counts.window_count);
      const identityDailyCount = safeCount(counts.identity_daily_count);
      const globalDailyCount = safeCount(counts.global_daily_count);
      let denied: GenerationReservation | undefined;
      if (windowCount >= request.limits.perIdentityWindow) {
        denied = { allowed: false, reason: "window" };
      } else if (identityDailyCount >= request.limits.perIdentityDaily) {
        denied = { allowed: false, reason: "identity-daily" };
      } else if (globalDailyCount >= request.limits.globalDaily) {
        denied = { allowed: false, reason: "global-daily" };
      }

      if (denied) {
        await client.query("COMMIT");
        return denied;
      }

      await client.query(
        'INSERT INTO "blog_agent"."generation_events" ("identity_hash", "created_at") VALUES ($1, $2)',
        [request.identityHash, request.now],
      );
      await client.query(
        `INSERT INTO "blog_agent"."usage_daily"
           ("day", "identity_hash", "request_count", "updated_at")
         VALUES ($1, $2, 1, $3)
         ON CONFLICT ("day", "identity_hash") DO UPDATE
           SET "request_count" = "blog_agent"."usage_daily"."request_count" + 1,
               "updated_at" = EXCLUDED."updated_at"`,
        [day, request.identityHash, request.now],
      );
      await client.query("COMMIT");
      return { allowed: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async recordTokenUsage(
    request: Parameters<BlogAgentRepository["recordTokenUsage"]>[0],
  ): Promise<void> {
    await this.pool.query(
      `UPDATE "blog_agent"."usage_daily"
          SET "input_tokens" = "input_tokens" + $1,
              "output_tokens" = "output_tokens" + $2,
              "updated_at" = now()
        WHERE "day" = $3 AND "identity_hash" = $4`,
      [
        safeTokenCount(request.inputTokens),
        safeTokenCount(request.outputTokens),
        utcDay(request.now),
        request.identityHash,
      ],
    );
  }

  async getCachedAnswer(
    request: Parameters<BlogAgentRepository["getCachedAnswer"]>[0],
  ): Promise<CachedGroundedAnswer | null> {
    const result = await this.pool.query(
      `SELECT "response_json"
         FROM "blog_agent"."answer_cache"
        WHERE "article_hash" = $1
          AND "model_cache_key" = $2
          AND "question_hash" = $3
          AND "expires_at" > $4`,
      [
        request.articleHash,
        request.modelCacheKey,
        request.questionHash,
        request.now,
      ],
    );
    return parseCachedAnswer(result.rows[0]?.response_json);
  }

  async setCachedAnswer(
    request: Parameters<BlogAgentRepository["setCachedAnswer"]>[0],
  ): Promise<void> {
    const answer = parseCachedAnswer(request.answer);
    if (!answer) throw new Error("Cannot cache an invalid grounded answer");
    await this.pool.query(
      `INSERT INTO "blog_agent"."answer_cache"
         ("article_hash", "model_cache_key", "question_hash", "response_json", "expires_at")
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT ("article_hash", "model_cache_key", "question_hash") DO UPDATE
         SET "response_json" = EXCLUDED."response_json",
             "expires_at" = EXCLUDED."expires_at",
             "updated_at" = now()`,
      [
        request.articleHash,
        request.modelCacheKey,
        request.questionHash,
        JSON.stringify(answer),
        request.expiresAt,
      ],
    );
  }
}
