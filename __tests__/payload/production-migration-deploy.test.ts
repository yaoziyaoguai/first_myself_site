import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/ci-cd.yml"),
  "utf8",
);
const productionCompose = readFileSync(
  resolve(process.cwd(), "docker/docker-compose.prod.yml"),
  "utf8",
);
const payloadConfig = readFileSync(
  resolve(process.cwd(), "payload.config.ts"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe("production migration deployment", () => {
  it("loads the real Payload config through the production CLI", () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(process.cwd(), "node_modules/payload/bin.js"),
        "run",
        "payload.config.ts",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          BLOG_AGENT_ENABLED: "false",
          BLOG_AGENT_GENERATION_ENABLED: "false",
          DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
          NEXT_PUBLIC_SERVER_URL: "http://localhost:3000",
          PAYLOAD_SECRET: "payload-cli-smoke-test-secret",
        },
        timeout: 30_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  }, 30_000);

  it("serializes production deployments on the shared server", () => {
    expect(workflow).toContain("group: production-deploy");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("loads the verified candidate, backs up, migrates, then replaces the app", () => {
    const candidateBuildIndex = workflow.indexOf(
      "DOCKER_BUILDKIT=1 docker build",
    );
    const candidateVerificationIndex = workflow.indexOf(
      "docker image inspect first_myself_site:candidate >/dev/null",
      candidateBuildIndex,
    );
    const revisionVerificationIndex = workflow.indexOf(
      'candidate_revision="$(docker image inspect first_myself_site:candidate',
      candidateVerificationIndex,
    );
    const backupIndex = workflow.indexOf(
      "./scripts/backup.sh",
      revisionVerificationIndex,
    );
    const cleanupIndex = workflow.indexOf(
      "to_regclass('payload_migrations')",
      backupIndex,
    );
    const migrationIndex = workflow.indexOf(
      '"${compose[@]}" run --rm --no-deps app npm run payload -- migrate',
      cleanupIndex,
    );
    const cutoverIndex = workflow.indexOf('"${compose[@]}" up -d', migrationIndex);

    expect(candidateBuildIndex).toBeGreaterThan(-1);
    expect(candidateVerificationIndex).toBeGreaterThan(candidateBuildIndex);
    expect(revisionVerificationIndex).toBeGreaterThan(candidateVerificationIndex);
    expect(backupIndex).toBeGreaterThan(revisionVerificationIndex);
    expect(cleanupIndex).toBeGreaterThan(backupIndex);
    expect(migrationIndex).toBeGreaterThan(cleanupIndex);
    expect(cutoverIndex).toBeGreaterThan(migrationIndex);
    expect(workflow).not.toContain('"${compose[@]}" build app');
    expect(workflow).not.toContain("first_myself_site-candidate.tar");
    expect(workflow).toContain("set -euo pipefail");
    expect(workflow).toContain(
      `DELETE FROM "payload_migrations"\n                  WHERE "batch" = -1 AND "name" = 'dev'`,
    );
    expect(workflow.match(/DELETE FROM "payload_migrations"/g)).toHaveLength(1);
  });

  it("ships the Payload migration source in the candidate runtime image", () => {
    const dockerfile = readFileSync(
      resolve(process.cwd(), "docker/Dockerfile"),
      "utf8",
    );
    const dockerignore = readFileSync(
      resolve(process.cwd(), ".dockerignore"),
      "utf8",
    );
    expect(dockerfile).toContain(
      "COPY --from=builder /app/payload.config.ts ./payload.config.ts",
    );
    expect(dockerfile).toContain("COPY --from=builder /app/src ./src");
    expect(dockerfile).toContain("npm prune \\");
    expect(dockerfile).toContain("--omit=dev");
    expect(dockerfile).toContain(
      "COPY --from=production-deps /app/node_modules ./node_modules",
    );
    expect(dockerfile).toContain("rm -rf .next/cache");
    expect(dockerignore).toContain(".env*");
    expect(dockerignore).toContain("perf");
    expect(packageJson.dependencies).not.toHaveProperty("shadcn");
    expect(packageJson.devDependencies).toHaveProperty("shadcn");
  });

  it("points the production CLI at a directory containing only executable migrations", () => {
    const migrationDir = resolve(process.cwd(), "src/payload/migrations");
    const nonMigrationFiles = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".ts") && file !== "index.ts")
      .filter((file) => {
        const source = readFileSync(resolve(migrationDir, file), "utf8");
        return !source.includes("export async function up(")
          || !source.includes("export async function down(");
      });

    expect(payloadConfig).toContain(
      'migrationDir: resolve(process.cwd(), "src/payload/migrations")',
    );
    expect(nonMigrationFiles).toEqual([]);
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
