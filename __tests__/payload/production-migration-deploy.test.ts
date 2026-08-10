import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci-cd.yml"),
  "utf8",
);

describe("production migration deployment", () => {
  it("serializes production deployments on the shared server", () => {
    expect(workflow).toContain("group: production-deploy");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("backs up, removes only the legacy dev marker, then replaces the app", () => {
    const buildIndex = workflow.indexOf('"${compose[@]}" build app');
    const backupIndex = workflow.indexOf("./scripts/backup.sh", buildIndex);
    const cleanupIndex = workflow.indexOf(
      "to_regclass('payload_migrations')",
      backupIndex,
    );
    const cutoverIndex = workflow.indexOf('"${compose[@]}" up -d', cleanupIndex);

    expect(buildIndex).toBeGreaterThan(-1);
    expect(backupIndex).toBeGreaterThan(buildIndex);
    expect(cleanupIndex).toBeGreaterThan(backupIndex);
    expect(cutoverIndex).toBeGreaterThan(cleanupIndex);
    expect(workflow).toContain("set -euo pipefail");
    expect(workflow).toContain(
      `DELETE FROM "payload_migrations"\n                  WHERE "batch" = -1 AND "name" = 'dev'`,
    );
    expect(workflow.match(/DELETE FROM "payload_migrations"/g)).toHaveLength(1);
  });
});
