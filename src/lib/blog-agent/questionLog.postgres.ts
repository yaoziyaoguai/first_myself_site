import type { BlogAgentQueryPool } from "./repository.postgres";
import type {
  AgentQuestionEvent,
  AgentQuestionOutcome,
  AgentQuestionRecorder,
} from "./questionLog";

const VALID_OUTCOMES = new Set<AgentQuestionOutcome>([
  "answered",
  "insufficient_evidence",
  "rate_limited",
  "provider_error",
]);
const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export class PostgresAgentQuestionRecorder implements AgentQuestionRecorder {
  constructor(private readonly pool: BlogAgentQueryPool) {}

  async record(event: AgentQuestionEvent): Promise<void> {
    if (!VALID_OUTCOMES.has(event.outcome)) {
      throw new Error("Invalid Agent question outcome");
    }

    const retentionStart = new Date(event.createdAt.getTime() - RETENTION_MS);
    await this.pool.query(
      `WITH cleanup_candidates AS (
         (SELECT ctid
            FROM "blog_agent"."questions"
           WHERE "created_at" < $1
           ORDER BY "created_at"
           LIMIT 100)
         UNION
         (SELECT ctid
            FROM "blog_agent"."questions"
           ORDER BY "created_at" DESC
           OFFSET 49999
           LIMIT 100)
       ), purged AS (
         DELETE FROM "blog_agent"."questions"
          WHERE ctid IN (SELECT ctid FROM cleanup_candidates)
       )
       INSERT INTO "blog_agent"."questions"
         ("query_id", "article_slug", "question_text", "outcome", "created_at")
       VALUES ($2, $3, $4, $5, $6)
       ON CONFLICT ("query_id") DO NOTHING`,
      [
        retentionStart,
        event.queryId,
        event.articleSlug.slice(0, 128),
        event.questionText.slice(0, 500),
        event.outcome,
        event.createdAt,
      ],
    );
  }
}
