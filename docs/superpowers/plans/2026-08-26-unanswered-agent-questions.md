# Unanswered Agent Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist only redacted, unanswered article-Agent questions and show a compact seven-day inbox in the existing Payload analytics screen.

**Architecture:** A focused recorder interface is injected into `BlogAgentService`; its PostgreSQL implementation owns redaction-safe persistence and retention cleanup. A separate read-only server query supplies the existing admin summary component. Successful answers never enter the inbox.

**Tech Stack:** TypeScript, Next.js 16, Payload CMS 3, PostgreSQL 15, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-agent-quality-operations-design.md`

## Global Constraints

- Store only `insufficient_evidence`, `rate_limited`, and `provider_error` events.
- Redact the question before persistence and cap the persisted excerpt at 500 characters.
- Never store answers, history, IP, visitor hashes, or provider error bodies.
- Telemetry is best-effort and must not alter the public Agent response.
- Delete records older than 30 days; migrations must remain backward-compatible with the previous image.

---

### Task 1: Redaction and recorder contract

**Files:**
- Create: `src/lib/blog-agent/unansweredQuestions.ts`
- Create: `__tests__/lib/blog-agent/unansweredQuestions.test.ts`

**Interfaces:**
- Produces: `UnansweredQuestionReason`, `UnansweredQuestionEvent`, `UnansweredQuestionRecorder.record(event)`, and `redactQuestionExcerpt(question)`.
- Consumes: no persistence or framework dependencies.

- [ ] **Step 1: Write the failing redaction tests**

Cover an email, `Bearer` token, `sk-` key, JWT, PEM private-key block, `password=...`, Unicode normalization, and a 600-character question. Assert that secrets are absent, replacement markers are present, and output length is at most 500.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run __tests__/lib/blog-agent/unansweredQuestions.test.ts`

Expected: FAIL because `@/lib/blog-agent/unansweredQuestions` does not exist.

- [ ] **Step 3: Implement the minimal pure contract**

Define:

```ts
export type UnansweredQuestionReason =
  | "insufficient_evidence"
  | "rate_limited"
  | "provider_error";

export type UnansweredQuestionEvent = {
  queryId: string;
  articleSlug: string;
  questionExcerpt: string;
  reason: UnansweredQuestionReason;
  createdAt: Date;
};

export interface UnansweredQuestionRecorder {
  record(event: UnansweredQuestionEvent): Promise<void>;
}

export function redactQuestionExcerpt(question: string): string;
```

Normalize with NFKC, apply fixed redaction patterns, trim, then slice to 500 characters. Return `[内容已脱敏]` if no safe visible text remains.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run __tests__/lib/blog-agent/unansweredQuestions.test.ts`

Expected: PASS with no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog-agent/unansweredQuestions.ts __tests__/lib/blog-agent/unansweredQuestions.test.ts
git commit -m "feat: redact unanswered agent questions"
```

### Task 2: Backward-compatible PostgreSQL persistence

**Files:**
- Create: `src/payload/migrations/20260826_000000_add_unanswered_agent_questions.ts`
- Modify: `src/payload/migrations/index.ts`
- Create: `src/lib/blog-agent/unansweredQuestions.postgres.ts`
- Create: `__tests__/payload/unanswered-agent-questions-migration.test.ts`
- Create: `__tests__/lib/blog-agent/unansweredQuestions.postgres.test.ts`

**Interfaces:**
- Consumes: `UnansweredQuestionEvent` and `UnansweredQuestionRecorder` from Task 1.
- Produces: `PostgresUnansweredQuestionRecorder` accepting the existing `BlogAgentQueryPool` shape.

- [ ] **Step 1: Write failing migration and repository tests**

Assert that the migration creates `blog_agent.unanswered_questions`, a unique `query_id`, constrained `reason`, and `created_at` index, while `down` only drops the new table. Assert that `record()` first deletes at most 100 rows older than 30 days and then inserts parameterized values with `ON CONFLICT (query_id) DO NOTHING`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run \
  __tests__/payload/unanswered-agent-questions-migration.test.ts \
  __tests__/lib/blog-agent/unansweredQuestions.postgres.test.ts
```

Expected: FAIL because the migration and repository do not exist.

- [ ] **Step 3: Implement migration and recorder**

Use parameterized SQL and this constructor:

```ts
export class PostgresUnansweredQuestionRecorder
  implements UnansweredQuestionRecorder {
  constructor(private readonly pool: BlogAgentQueryPool) {}
  async record(event: UnansweredQuestionEvent): Promise<void>;
}
```

The recorder receives an already-redacted excerpt; it must still cap it at 500 and validate the closed `reason` union before issuing SQL.

- [ ] **Step 4: Run migration and repository tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/payload/migrations src/lib/blog-agent/unansweredQuestions.postgres.ts \
  __tests__/payload/unanswered-agent-questions-migration.test.ts \
  __tests__/lib/blog-agent/unansweredQuestions.postgres.test.ts
git commit -m "feat: persist unanswered agent questions"
```

### Task 3: Record only failed answer outcomes

**Files:**
- Modify: `src/lib/blog-agent/service.ts`
- Modify: `src/lib/blog-agent/runtime.ts`
- Modify: `__tests__/lib/blog-agent/service.test.ts`
- Modify: `__tests__/lib/blog-agent/runtime.test.ts`

**Interfaces:**
- Consumes: `UnansweredQuestionRecorder` and `redactQuestionExcerpt` from Task 1; `PostgresUnansweredQuestionRecorder` from Task 2.
- Produces: optional `unansweredQuestions?: UnansweredQuestionRecorder` dependency in `BlogAgentServiceDependencies`.

- [ ] **Step 1: Add failing service tests**

Inject a recorder spy. Assert one event for cached and generated insufficient evidence, rate limiting, and provider failure. Assert no event for successful cached or generated answers. Make the recorder reject and assert the original public response remains unchanged.

- [ ] **Step 2: Run service tests and verify RED**

Run: `npx vitest run __tests__/lib/blog-agent/service.test.ts __tests__/lib/blog-agent/runtime.test.ts`

Expected: FAIL because the service has no recorder dependency.

- [ ] **Step 3: Add best-effort recording and runtime wiring**

Create one private helper in `BlogAgentService` that builds the event from server-owned `queryId`, `article.slug`, redacted current question, closed reason, and `now()`. Always attach `.catch(() => undefined)` and await it only to make tests deterministic; never change the service result on failure. Wire the PostgreSQL recorder from the existing runtime pool.

- [ ] **Step 4: Run service and runtime tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog-agent/service.ts src/lib/blog-agent/runtime.ts \
  __tests__/lib/blog-agent/service.test.ts __tests__/lib/blog-agent/runtime.test.ts
git commit -m "feat: collect unanswered agent questions"
```

### Task 4: Compact admin inbox

**Files:**
- Create: `src/lib/blog-agent/operationsSummary.server.ts`
- Create: `__tests__/lib/blog-agent/operationsSummary.server.test.ts`
- Modify: `src/payload/components/AnalyticsSummary/index.tsx`
- Modify: `src/payload/components/AnalyticsSummary/styles.css`

**Interfaces:**
- Produces: `readAgentOperationsSummary(since, today)` returning `{ requestCount, inputTokens, outputTokens, unansweredCount, recentUnanswered }`.
- Consumes: existing Payload PostgreSQL pool and `usage_daily`.

- [ ] **Step 1: Write failing summary query tests**

Assert that aggregate SQL reads the complete seven-day `usage_daily` window, counts unanswered rows, and selects only the latest 10 with `question_excerpt`, `article_slug`, `reason`, and `created_at`. Assert safe numeric parsing of bigint strings.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run __tests__/lib/blog-agent/operationsSummary.server.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement server summary and compact UI**

Use two parameterized aggregate/list queries. Render three small metrics and a list only when unanswered entries exist. Show fixed Chinese labels for the three reasons; never render raw HTML.

- [ ] **Step 4: Run focused and analytics tests and verify GREEN**

Run:

```bash
npx vitest run \
  __tests__/lib/blog-agent/operationsSummary.server.test.ts \
  __tests__/lib/analytics.server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog-agent/operationsSummary.server.ts \
  src/payload/components/AnalyticsSummary \
  __tests__/lib/blog-agent/operationsSummary.server.test.ts
git commit -m "feat: show unanswered agent inbox"
```
