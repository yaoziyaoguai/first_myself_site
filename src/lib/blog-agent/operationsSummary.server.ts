import { getPayloadAPI } from "@/lib/payload";
import type { UnansweredQuestionReason } from "./unansweredQuestions";

type RecentUnansweredRow = {
  question_excerpt: unknown;
  article_slug: unknown;
  reason: unknown;
  created_at: unknown;
};

export type AgentOperationsSummary = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  unansweredCount: number;
  recentUnanswered: Array<{
    questionExcerpt: string;
    articleSlug: string;
    reason: UnansweredQuestionReason;
    createdAt: Date;
  }>;
};

const VALID_REASONS = new Set<UnansweredQuestionReason>([
  "insufficient_evidence",
  "rate_limited",
  "provider_error",
]);

function safeCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed));
}

function parseRecent(row: RecentUnansweredRow) {
  if (
    typeof row.question_excerpt !== "string" ||
    typeof row.article_slug !== "string" ||
    typeof row.reason !== "string" ||
    !VALID_REASONS.has(row.reason as UnansweredQuestionReason)
  ) {
    return null;
  }
  const createdAt = row.created_at instanceof Date
    ? row.created_at
    : new Date(String(row.created_at));
  if (!Number.isFinite(createdAt.getTime())) return null;
  return {
    questionExcerpt: row.question_excerpt,
    articleSlug: row.article_slug,
    reason: row.reason as UnansweredQuestionReason,
    createdAt,
  };
}

export async function readAgentOperationsSummary(
  since: Date,
  today: Date,
): Promise<AgentOperationsSummary> {
  const payload = await getPayloadAPI();
  const aggregate = await payload.db.pool.query<{
    request_count: unknown;
    input_tokens: unknown;
    output_tokens: unknown;
    unanswered_count: unknown;
  }>(
    `SELECT
       COALESCE((
         SELECT SUM("request_count")
           FROM "blog_agent"."usage_daily"
          WHERE "day" >= $1::date AND "day" <= $2::date
       ), 0) AS "request_count",
       COALESCE((
         SELECT SUM("input_tokens")
           FROM "blog_agent"."usage_daily"
          WHERE "day" >= $1::date AND "day" <= $2::date
       ), 0) AS "input_tokens",
       COALESCE((
         SELECT SUM("output_tokens")
           FROM "blog_agent"."usage_daily"
          WHERE "day" >= $1::date AND "day" <= $2::date
       ), 0) AS "output_tokens",
       (SELECT COUNT(*)
          FROM "blog_agent"."unanswered_questions"
         WHERE "created_at" >= $1) AS "unanswered_count"`,
    [since, today],
  );
  const recent = await payload.db.pool.query<RecentUnansweredRow>(
    `SELECT "question_excerpt", "article_slug", "reason", "created_at"
       FROM "blog_agent"."unanswered_questions"
      WHERE "created_at" >= $1
      ORDER BY "created_at" DESC
      LIMIT 10`,
    [since],
  );
  const row = aggregate.rows[0];

  return {
    requestCount: safeCount(row?.request_count),
    inputTokens: safeCount(row?.input_tokens),
    outputTokens: safeCount(row?.output_tokens),
    unansweredCount: safeCount(row?.unanswered_count),
    recentUnanswered: recent.rows.flatMap((item) => {
      const parsed = parseRecent(item);
      return parsed ? [parsed] : [];
    }),
  };
}
