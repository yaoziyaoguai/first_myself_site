import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  process.cwd(),
  ".github/workflows/production-maintenance.yml",
);

describe("scheduled production maintenance workflow", () => {
  it("reuses the guarded Aliyun SSH chain without provider credentials", () => {
    expect(existsSync(workflowPath)).toBe(true);
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("cron: '17 18 * * *'");
    expect(workflow).toMatch(/\n  workflow_dispatch:\s*\n/);
    expect(workflow).toContain("timeout-minutes:");
    expect(workflow).toContain("group: production-deploy");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("appleboy/ssh-action@v1.0.3");
    expect(workflow).toContain('cd "${{ secrets.PROJECT_PATH }}"');
    expect(workflow).toContain("./scripts/production-maintenance.sh");
    expect(workflow).toContain(
      'BACKUP_DIR="$(dirname "$PWD")/backups/first_myself_site"',
    );
    expect(workflow.match(/\n\s+- cron:/g)).toHaveLength(1);
    expect(workflow).not.toMatch(/API_KEY|DASHSCOPE|BLOG_AGENT_API_KEY/);
  });
});
