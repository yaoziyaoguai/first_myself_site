import { getPayloadAPI } from "@/lib/payload";
import type { AgentQuestionOutcome } from "./questionLog";

type RecentQuestionRow = {
  question_text: unknown;
  article_slug: unknown;
  outcome: unknown;
  created_at: unknown;
};

export type AgentOperationsSummary = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  questionCount: number;
  unansweredCount: number;
  recentQuestions: Array<{
    questionText: string;
    articleSlug: string;
    outcome: AgentQuestionOutcome;
    createdAt: Date;
  }>;
};

const VALID_OUTCOMES = new Set<AgentQuestionOutcome>([
  "answered",
  "insufficient_evidence",
  "rate_limited",
  "provider_error",
]);

function safeCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed));
}

function parseRecent(row: RecentQuestionRow) {
  if (
    typeof row.question_text !== "string" ||
    typeof row.article_slug !== "string" ||
    typeof row.outcome !== "string" ||
    !VALID_OUTCOMES.has(row.outcome as AgentQuestionOutcome)
  ) {
    return null;
  }
  const createdAt = row.created_at instanceof Date
    ? row.created_at
    : new Date(String(row.created_at));
  if (!Number.isFinite(createdAt.getTime())) return null;
  return {
    questionText: row.question_text,
    articleSlug: row.article_slug,
    outcome: row.outcome as AgentQuestionOutcome,
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
    question_count: unknown;
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
          FROM "blog_agent"."questions"
         WHERE "created_at" >= $1) AS "question_count",
       (SELECT COUNT(*)
          FROM "blog_agent"."questions"
         WHERE "created_at" >= $1
           AND "outcome" <> 'answered') AS "unanswered_count"`,
    [since, today],
  );
  const recent = await payload.db.pool.query<RecentQuestionRow>(
    `SELECT "question_text", "article_slug", "outcome", "created_at"
       FROM "blog_agent"."questions"
      WHERE "created_at" >= $1
      ORDER BY "created_at" DESC
      LIMIT 20`,
    [since],
  );
  const row = aggregate.rows[0];

  return {
    requestCount: safeCount(row?.request_count),
    inputTokens: safeCount(row?.input_tokens),
    outputTokens: safeCount(row?.output_tokens),
    questionCount: safeCount(row?.question_count),
    unansweredCount: safeCount(row?.unanswered_count),
    recentQuestions: recent.rows.flatMap((item) => {
      const parsed = parseRecent(item);
      return parsed ? [parsed] : [];
    }),
  };
}
