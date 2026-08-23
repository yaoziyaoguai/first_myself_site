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
    expect(workflow).not.toContain("NEXT_PUBLIC_DASHSCOPE_API_KEY");
    expect(productionCompose).toContain(
      "DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:-}",
    );
  });

  it("injects the DeepSeek Flash configuration without exposing its key", () => {
    expect(workflow).toContain(
      "BLOG_AGENT_API_KEY: ${{ secrets.BLOG_AGENT_API_KEY }}",
    );
    expect(workflow).toContain(
      "BLOG_AGENT_BASE_URL: ${{ vars.BLOG_AGENT_BASE_URL }}",
    );
    expect(workflow).toContain(
      "BLOG_AGENT_MODEL: ${{ vars.BLOG_AGENT_MODEL }}",
    );
    expect(workflow).toContain(
      "envs: BLOG_AGENT_API_KEY,BLOG_AGENT_ENABLED,BLOG_AGENT_GENERATION_ENABLED,BLOG_AGENT_BASE_URL,BLOG_AGENT_MODEL,DASHSCOPE_API_KEY,BLOG_AGENT_EMBEDDING_BASE_URL,BLOG_AGENT_EMBEDDING_MODEL,BLOG_AGENT_EMBEDDING_DIMENSIONS,BLOG_AGENT_EMBEDDING_TIMEOUT_MS",
    );
    expect(workflow).toContain(
      "BLOG_AGENT_EMBEDDING_MODEL: ${{ vars.BLOG_AGENT_EMBEDDING_MODEL }}",
    );
    expect(workflow).not.toContain("NEXT_PUBLIC_BLOG_AGENT_API_KEY");
  });
});
