import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(
  process.cwd(),
  "scripts/production-maintenance.sh",
);

describe("production maintenance", () => {
  it("checks health and backup before safe retention and budget reporting", () => {
    expect(existsSync(scriptPath)).toBe(true);
    const script = readFileSync(scriptPath, "utf8");
    const health = script.indexOf("./scripts/health-check.sh");
    const backup = script.indexOf("./scripts/backup.sh");
    const cleanup = script.indexOf('DELETE FROM "page_views"');
    const questionCleanup = script.indexOf(
      'DELETE FROM "blog_agent"."questions"',
    );
    const usage = script.indexOf('FROM "blog_agent"."usage_daily"');

    expect(script).toContain('RETENTION_DAYS="${RETENTION_DAYS:-30}"');
    expect(script).toContain(
      'AGENT_BUDGET_ALERT_PERCENT="${AGENT_BUDGET_ALERT_PERCENT:-80}"',
    );
    expect(script).toContain('[[ ! "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]');
    expect(script).toContain("AGENT_BUDGET_ALERT_PERCENT > 100");
    expect(health).toBeGreaterThan(-1);
    expect(backup).toBeGreaterThan(health);
    expect(cleanup).toBeGreaterThan(backup);
    expect(questionCleanup).toBeGreaterThan(cleanup);
    expect(usage).toBeGreaterThan(cleanup);
    expect(script).toContain(
      "days => current_setting('app.retention_days')::integer",
    );
    expect(script).toContain('--set=retention_days="$RETENTION_DAYS"');
    expect(script).toContain("to_regclass('blog_agent.questions')");
    expect(script).toContain("BEGIN;");
    expect(script).toContain("COMMIT;");
    expect(script).toContain(
      "alert_threshold=$(((global_daily_limit * AGENT_BUDGET_ALERT_PERCENT + 99) / 100))",
    );
    expect(script).toContain('if (( daily_requests >= alert_threshold )); then');
    expect(script).not.toContain("question_excerpt");
    expect(script).not.toContain("identity_hash");
    expect(script).toContain("agent_questions=");
  });
});
