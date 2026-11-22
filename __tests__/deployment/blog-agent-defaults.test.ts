import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Blog Agent production defaults", () => {
  it("passes the target public flags to the isolated candidate and keeps rollback disabled", () => {
    const workflow = source(".github/workflows/ci-cd.yml");
    expect(workflow).toContain("BLOG_INTERACTIVE_HTML_ENABLED: ${{ vars.BLOG_INTERACTIVE_HTML_ENABLED }}");
    expect(workflow).toMatch(/envs: [^\n]*BLOG_INTERACTIVE_HTML_ENABLED/);
    const target = workflow.indexOf('target_interactive_html_enabled="$BLOG_INTERACTIVE_HTML_ENABLED"');
    const candidate = workflow.indexOf('run --rm --no-deps -T app sh -se --');
    const rollback = workflow.slice(workflow.indexOf("fail_closed_rollback() {"), workflow.indexOf("# GitHub 只推送"));
    expect(rollback).toContain("export BLOG_INTERACTIVE_HTML_ENABLED=false");
    expect(workflow.slice(target, candidate).match(/export BLOG_INTERACTIVE_HTML_ENABLED=false/g)).toHaveLength(1);
    expect(workflow).toContain("process.env.BLOG_INTERACTIVE_HTML_ENABLED === process.argv[3]");
  });
  it("uses one dynamic parameter name for sibling Blog API routes", () => {
    const dynamicDirectories = readdirSync(
      resolve(process.cwd(), "app/api/blog"),
      { withFileTypes: true },
    )
      .filter((entry) => entry.isDirectory() && /^\[[^\]]+\]$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    expect(dynamicDirectories).toEqual(["[identifier]"]);
  });

  it.each([".env.example", ".env.docker.prod.example"])(
    "keeps public generation disabled in %s",
    (path) => {
      const environment = source(path);
      expect(environment).toMatch(/^BLOG_AGENT_ENABLED=false$/m);
      expect(environment).toMatch(/^BLOG_AGENT_GENERATION_ENABLED=false$/m);
      expect(environment).toMatch(/^BLOG_AGENT_API_KEY=$/m);
      expect(environment).toMatch(/^DASHSCOPE_API_KEY=$/m);
      expect(environment).toMatch(
        /^BLOG_AGENT_EMBEDDING_BASE_URL=https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v1$/m,
      );
      expect(environment).toMatch(/^BLOG_AGENT_EMBEDDING_MODEL=qwen3\.7-text-embedding$/m);
      expect(environment).toMatch(/^BLOG_AGENT_EMBEDDING_DIMENSIONS=1024$/m);
      expect(environment).toMatch(/^BLOG_AGENT_EMBEDDING_TIMEOUT_MS=15000$/m);
      expect(environment).not.toMatch(/^NEXT_PUBLIC_.*AGENT.*KEY=/m);
    },
  );

  it("passes bounded server-only variables into the application container", () => {
    const compose = source("docker/docker-compose.prod.yml");
    expect(compose).toContain("BLOG_AGENT_ENABLED: ${BLOG_AGENT_ENABLED:-false}");
    expect(compose).toContain(
      "BLOG_AGENT_GENERATION_ENABLED: ${BLOG_AGENT_GENERATION_ENABLED:-false}",
    );
    expect(compose).toContain("BLOG_AGENT_API_KEY: ${BLOG_AGENT_API_KEY:-}");
    expect(compose).toContain("DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY:-}");
    expect(compose).toContain(
      "BLOG_AGENT_EMBEDDING_MODEL: ${BLOG_AGENT_EMBEDDING_MODEL:-qwen3.7-text-embedding}",
    );
    expect(compose).toContain(
      "BLOG_AGENT_EMBEDDING_DIMENSIONS: ${BLOG_AGENT_EMBEDDING_DIMENSIONS:-1024}",
    );
    expect(compose).toContain("BLOG_AGENT_GLOBAL_DAILY_LIMIT: ${BLOG_AGENT_GLOBAL_DAILY_LIMIT:-100}");
    expect(compose).not.toContain("NEXT_PUBLIC_BLOG_AGENT_API_KEY");
    const buildBlock = compose.slice(
      compose.indexOf("    build:"),
      compose.indexOf("    container_name:"),
    );
    expect(buildBlock).not.toContain("DASHSCOPE_API_KEY");
    expect(buildBlock).not.toContain("BLOG_AGENT_API_KEY");
  });

  it("copies canary server sources outside the public directory", () => {
    const dockerfile = source("docker/Dockerfile");
    expect(dockerfile).toContain(
      "COPY --from=builder /app/scripts/blog-agent-canary.ts ./scripts/blog-agent-canary.ts",
    );
    expect(dockerfile).toContain(
      "COPY --from=builder /app/src ./src",
    );
    expect(dockerfile).not.toMatch(/COPY .*blog-agent-canary.*public/);
  });

  it("runs real PostgreSQL 15 Blog Agent integration gates in CI", () => {
    const workflow = source(".github/workflows/ci-cd.yml");
    expect(workflow).toContain("image: postgres:15-alpine");
    expect(workflow).toContain("BLOG_AGENT_TEST_DATABASE_URL:");
    expect(workflow).toContain(
      "__tests__/payload/blog-agent-migration.postgres.test.ts",
    );
    expect(workflow).toContain(
      "__tests__/payload/blog-agent-article-package-migration.postgres.test.ts",
    );
    expect(workflow).toContain(
      "__tests__/payload/owner-analytics-identity-migration.postgres.test.ts",
    );
    expect(workflow).toContain(
      "__tests__/lib/blog-agent/runtime.postgres.test.ts",
    );
    expect(workflow).toContain(
      "__tests__/lib/blog-agent/articleIndexRepository.postgres.test.ts",
    );
    expect(workflow).toContain(
      "__tests__/scripts/blog-agent-canary.postgres.test.ts",
    );
    expect(workflow).toContain(
      "BLOG_AGENT_ENABLED: ${{ vars.BLOG_AGENT_ENABLED }}",
    );
    expect(workflow).toContain(
      "BLOG_AGENT_GENERATION_ENABLED: ${{ vars.BLOG_AGENT_GENERATION_ENABLED }}",
    );
    expect(workflow).toContain(
      "BLOG_AGENT_EMBEDDING_MODEL: ${{ vars.BLOG_AGENT_EMBEDDING_MODEL }}",
    );
    expect(workflow).toContain(
      'if [ "$BLOG_AGENT_EMBEDDING_DIMENSIONS" != "1024" ]; then',
    );
    expect(workflow).not.toMatch(/build-args:[\s\S]*BLOG_AGENT_API_KEY/);
  });

  it("supports a gated manual redeploy after production variables change", () => {
    const workflow = source(".github/workflows/ci-cd.yml");
    expect(workflow).toMatch(/\n  workflow_dispatch:\s*\n/);
    expect(workflow).toContain(
      "github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')",
    );
  });

  it("starts a private candidate and completes its canary before a single production cutover", () => {
    const workflow = source(".github/workflows/ci-cd.yml");
    const candidate = workflow.indexOf('run --rm --no-deps -T app sh -se --');
    const canary = workflow.indexOf('npm run blog-agent:canary -- "--slug=$2" "--question=$3"');
    const production = workflow.slice(candidate);
    const cutover = production.indexOf('up -d --no-deps --force-recreate app');
    expect(candidate).toBeGreaterThan(0);
    expect(canary).toBeGreaterThan(candidate);
    expect(production).toContain("127.0.0.1:3001/api/health");
    expect(production).toContain("--require-package --require-code");
    expect(production).not.toContain("--service-ports");
    expect(production.match(/up -d --no-deps --force-recreate app/g)).toHaveLength(1);
    expect(cutover + candidate).toBeGreaterThan(canary);
    expect(production.indexOf("verify_runtime_agent_flags")).toBeGreaterThan(cutover);
    expect(production.indexOf("verify_nginx_health")).toBeGreaterThan(cutover);
    expect(workflow).toContain('--resolve "wangjinkun333.me:443:127.0.0.1"');
    expect(workflow).toContain("fail_closed_rollback");
  });

  it("keeps an unconfigured disabled Agent from blocking unrelated deploys", () => {
    const workflow = source(".github/workflows/ci-cd.yml");
    const disabledDefault = workflow.indexOf(
      'export BLOG_AGENT_ENABLED="${BLOG_AGENT_ENABLED:-false}"',
    );
    const providerGate = workflow.indexOf(
      'if [ "$BLOG_AGENT_ENABLED" = "true" ] || [ "$BLOG_AGENT_GENERATION_ENABLED" = "true" ]; then',
    );
    const providerValidation = workflow.indexOf(
      'echo "Blog Agent provider configuration is incomplete in GitHub"',
    );

    expect(disabledDefault).toBeGreaterThan(-1);
    expect(workflow).toContain(
      'export BLOG_AGENT_GENERATION_ENABLED="${BLOG_AGENT_GENERATION_ENABLED:-false}"',
    );
    expect(providerGate).toBeGreaterThan(disabledDefault);
    expect(providerValidation).toBeGreaterThan(providerGate);
    expect(workflow).not.toContain(
      "BLOG_AGENT_ENABLED must be true when generation is enabled",
    );
  });
});
