# Production Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run a daily, fail-visible production check for health, TLS, readable backups, retention, and Agent request budget using the existing GitHub-to-Aliyun chain.

**Architecture:** Existing health and backup scripts gain deterministic validation. A single server-side maintenance script composes them with retention and budget SQL. A scheduled GitHub Actions workflow reuses existing SSH credentials and the production deployment concurrency group.

**Tech Stack:** Bash, Docker Compose, PostgreSQL 15 CLI, OpenSSL, GitHub Actions, Vitest static contract tests.

**Spec:** `docs/superpowers/specs/2026-08-26-agent-quality-operations-design.md`

## Global Constraints

- Do not print environment-file contents, database URLs, questions, IPs, API Keys, or provider responses.
- Default TLS warning threshold is 21 days and must reject invalid configuration.
- A backup is not successful until database dump, media archive, and outer archive are readable.
- Retain only seven production backups and 30 days of analytics/unanswered data.
- Budget alert threshold is 80% of the existing `BLOG_AGENT_GLOBAL_DAILY_LIMIT`; the online hard cap remains authoritative.
- Scheduled maintenance and deployment must not run concurrently.

---

### Task 1: Verify backup contents before publication

**Files:**
- Modify: `scripts/backup.sh`
- Create: `__tests__/scripts/backup-integrity.test.ts`

**Interfaces:**
- Produces: the existing `backup.sh` contract, now failing before the final `mv` when validation fails.
- Consumes: existing Docker Compose `postgres` and `app` services plus host `tar`.

- [ ] **Step 1: Write a failing script contract test**

Read `scripts/backup.sh` as text and assert the order is: `pg_dump` → `pg_restore --list` validation → media `tar -tzf` validation → outer archive creation → outer `tar -tzf` validation → atomic `mv`. Assert the final file is never named before all checks.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run __tests__/scripts/backup-integrity.test.ts`

Expected: FAIL because dump and archive validation are absent.

- [ ] **Step 3: Add minimal validation**

Pipe the dump into `docker compose exec -T postgres pg_restore --list`, run `tar -tzf` for the media archive and temporary outer archive, and keep the existing traps and `chmod 600`. Do not echo archive contents.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/backup.sh __tests__/scripts/backup-integrity.test.ts
git commit -m "fix: verify production backups"
```

### Task 2: Raise and validate the TLS safety window

**Files:**
- Modify: `scripts/health-check.sh`
- Create: `__tests__/scripts/health-check.test.ts`

**Interfaces:**
- Produces: `TLS_MIN_VALID_DAYS`, default `21`, converted to seconds only after positive-integer validation.
- Consumes: existing OpenSSL certificate stream.

- [ ] **Step 1: Write a failing script contract test**

Assert the script defines a 21-day default, rejects zero/non-integer values, computes `days * 86400`, passes that value to `openssl x509 -checkend`, and reports the configured day count without certificate contents.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run __tests__/scripts/health-check.test.ts`

Expected: FAIL because the current threshold is fixed at seven days.

- [ ] **Step 3: Implement validated threshold**

Add `TLS_MIN_VALID_DAYS="${TLS_MIN_VALID_DAYS:-21}"`, a positive-integer guard, `tls_check_seconds=$((TLS_MIN_VALID_DAYS * 86400))`, and use it in `-checkend`.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/health-check.sh __tests__/scripts/health-check.test.ts
git commit -m "feat: monitor tls renewal window"
```

### Task 3: Compose retention and budget maintenance

**Files:**
- Create: `scripts/production-maintenance.sh`
- Create: `__tests__/scripts/production-maintenance.test.ts`

**Interfaces:**
- Produces: one executable script accepting `PROJECT_DIR`, `BACKUP_DIR`, `ENV_FILE`, `RETENTION_DAYS` (default 30), and `AGENT_BUDGET_ALERT_PERCENT` (default 80).
- Consumes: `scripts/health-check.sh`, `scripts/backup.sh`, the production Compose file, `page_views`, `blog_agent.unanswered_questions`, and `blog_agent.usage_daily`.

- [ ] **Step 1: Write a failing maintenance contract test**

Assert positive bounds for retention and alert percentage, health before backup, backup before cleanup, static SQL executed through the PostgreSQL container, `created_at < NOW() - make_interval(days => $1)` via a psql variable rather than shell-concatenated SQL, and a final non-zero exit when request count reaches the rounded-up threshold. Assert logs contain counts only.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run __tests__/scripts/production-maintenance.test.ts`

Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement the orchestration script**

Use container environment variables for database user/name, `psql --set ON_ERROR_STOP=1 --tuples-only --no-align`, and one transaction for both deletes. Read the daily request/token aggregate after cleanup. Perform all work, print the aggregate, then exit non-zero if requests are at or above `ceil(limit * percent / 100)`.

- [ ] **Step 4: Run focused test and shell syntax checks**

Run:

```bash
npx vitest run __tests__/scripts/production-maintenance.test.ts
bash -n scripts/backup.sh scripts/health-check.sh scripts/production-maintenance.sh
```

Expected: PASS and exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/production-maintenance.sh __tests__/scripts/production-maintenance.test.ts
git commit -m "feat: add production maintenance check"
```

### Task 4: Schedule maintenance through the existing Aliyun chain

**Files:**
- Create: `.github/workflows/production-maintenance.yml`
- Create: `__tests__/deployment/production-maintenance.test.ts`
- Modify: `docs/blog-agent-operations.md`
- Modify: `README.md`

**Interfaces:**
- Produces: daily `schedule` plus `workflow_dispatch`, SSH execution of `scripts/production-maintenance.sh`, and the shared `production-deploy` concurrency group.
- Consumes: existing `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`, and `PROJECT_PATH` GitHub Secrets.

- [ ] **Step 1: Write a failing workflow contract test**

Assert `contents: read`, one daily cron, manual dispatch, `timeout-minutes`, `concurrency.group: production-deploy`, `cancel-in-progress: false`, pinned `appleboy/ssh-action@v1.0.3`, no provider/API secrets, explicit project directory, and the maintenance script call with the dedicated backups directory.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run __tests__/deployment/production-maintenance.test.ts`

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Add workflow and concise operations documentation**

Schedule at `17 18 * * *` UTC (02:17 Asia/Shanghai). Document GitHub failure notification expectations, manual run verification, 30-day retention, owner-IP masking, the 80% alert, backup restore checks, and quarterly provider-Key rotation. Do not include real Secret values.

- [ ] **Step 4: Run deployment tests and documentation checks**

Run:

```bash
npx vitest run \
  __tests__/deployment/production-maintenance.test.ts \
  __tests__/deployment/blog-agent-defaults.test.ts
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/production-maintenance.yml \
  __tests__/deployment/production-maintenance.test.ts \
  docs/blog-agent-operations.md README.md
git commit -m "feat: schedule production maintenance"
```
