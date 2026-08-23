import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci-cd.yml"),
  "utf8",
);
const productionCompose = readFileSync(
  resolve(process.cwd(), "docker/docker-compose.prod.yml"),
  "utf8",
);

describe("production migration deployment", () => {
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

  it("injects the DashScope key through the server-only deploy environment", () => {
    expect(workflow).toContain(
      "DASHSCOPE_API_KEY: ${{ secrets.DASHSCOPE_API_KEY }}",
    );
    expect(workflow).toContain("envs: DASHSCOPE_API_KEY");
    expect(workflow).not.toContain("NEXT_PUBLIC_DASHSCOPE_API_KEY");
    expect(productionCompose).toContain(
      "DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:-}",
    );
  });
});
