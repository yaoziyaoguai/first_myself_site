import type { BlogAgentQueryPool } from "./repository.postgres";
import type {
  UnansweredQuestionEvent,
  UnansweredQuestionReason,
  UnansweredQuestionRecorder,
} from "./unansweredQuestions";

const VALID_REASONS = new Set<UnansweredQuestionReason>([
  "insufficient_evidence",
  "rate_limited",
  "provider_error",
]);
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export class PostgresUnansweredQuestionRecorder
  implements UnansweredQuestionRecorder {
  constructor(private readonly pool: BlogAgentQueryPool) {}

  async record(event: UnansweredQuestionEvent): Promise<void> {
    if (!VALID_REASONS.has(event.reason)) {
      throw new Error("Invalid unanswered question reason");
    }

    const retentionStart = new Date(event.createdAt.getTime() - RETENTION_MS);
    await this.pool.query(
      `WITH expired AS (
         SELECT ctid
           FROM "blog_agent"."unanswered_questions"
          WHERE "created_at" < $1
          ORDER BY "created_at"
          LIMIT 100
       ), purged AS (
         DELETE FROM "blog_agent"."unanswered_questions"
          WHERE ctid IN (SELECT ctid FROM expired)
       )
       INSERT INTO "blog_agent"."unanswered_questions"
         ("query_id", "article_slug", "question_excerpt", "reason", "created_at")
       VALUES ($2, $3, $4, $5, $6)
       ON CONFLICT ("query_id") DO NOTHING`,
      [
        retentionStart,
        event.queryId,
        event.articleSlug.slice(0, 128),
        event.questionExcerpt.slice(0, 500),
        event.reason,
        event.createdAt,
      ],
    );
  }
}
