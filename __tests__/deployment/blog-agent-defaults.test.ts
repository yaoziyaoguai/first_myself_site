import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Blog Agent production defaults", () => {
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

  it("runs the package canary through the managed production SSH deploy", () => {
    const workflow = source(".github/workflows/ci-cd.yml");
    const envForwarding = workflow.slice(
      workflow.indexOf("          envs:"),
      workflow.indexOf("          command_timeout:"),
    );
    const targetFlags = workflow.indexOf(
      'target_blog_agent_enabled="$BLOG_AGENT_ENABLED"',
    );
    const disableCandidate = workflow.indexOf(
      "export BLOG_AGENT_ENABLED=false",
      targetFlags,
    );
    const firstCandidateStart = workflow.indexOf(
      '"${compose[@]}" up -d',
      disableCandidate,
    );
    const nginxHealthDefinition = workflow.indexOf("verify_nginx_health() {");
    const firstNginxHealthCheck = workflow.indexOf(
      "verify_nginx_health",
      firstCandidateStart,
    );
    const canaryCommand = workflow.indexOf(
      "exec -T app npm run blog-agent:canary --",
    );
    const restorePublicAgent = workflow.indexOf(
      'export BLOG_AGENT_ENABLED="$target_blog_agent_enabled"',
      canaryCommand,
    );
    const restoreGeneration = workflow.indexOf(
      'export BLOG_AGENT_GENERATION_ENABLED="$target_blog_agent_generation_enabled"',
      canaryCommand,
    );
    const finalCandidateStart = workflow.indexOf(
      '"${compose[@]}" up -d --no-deps --force-recreate app',
      restoreGeneration,
    );
    const runtimeFlagCheck = workflow.indexOf(
      "verify_runtime_agent_flags",
      finalCandidateStart,
    );
    const finalNginxHealthCheck = workflow.indexOf(
      "verify_nginx_health",
      runtimeFlagCheck,
    );
    const deploySuccess = workflow.indexOf(
      '"${compose[@]}" ps',
      finalNginxHealthCheck,
    );

    expect(workflow).toContain(
      "BLOG_AGENT_CANARY_SLUG: ${{ vars.BLOG_AGENT_CANARY_SLUG }}",
    );
    expect(workflow).toContain(
      "BLOG_AGENT_CANARY_QUESTION: ${{ vars.BLOG_AGENT_CANARY_QUESTION }}",
    );
    expect(workflow).toContain(
      'if [ "$target_blog_agent_generation_enabled" = "true" ]; then',
    );
    expect(workflow).toContain(
      'exec -T app npm run blog-agent:canary --',
    );
    expect(workflow).toContain('"--slug=$BLOG_AGENT_CANARY_SLUG"');
    expect(workflow).toContain('"--question=$BLOG_AGENT_CANARY_QUESTION"');
    expect(workflow).toContain("--require-package");
    expect(workflow).toContain("--require-code");
    expect(envForwarding).toContain("BLOG_AGENT_CANARY_SLUG");
    expect(envForwarding).toContain("BLOG_AGENT_CANARY_QUESTION");
    expect(targetFlags).toBeGreaterThan(-1);
    expect(disableCandidate).toBeGreaterThan(targetFlags);
    expect(firstCandidateStart).toBeGreaterThan(disableCandidate);
    expect(nginxHealthDefinition).toBeGreaterThan(-1);
    expect(workflow.slice(nginxHealthDefinition, firstCandidateStart)).toContain(
      '--resolve "wangjinkun333.me:443:127.0.0.1"',
    );
    expect(workflow.slice(nginxHealthDefinition, firstCandidateStart)).toContain(
      "--noproxy '*'",
    );
    expect(firstNginxHealthCheck).toBeGreaterThan(firstCandidateStart);
    expect(canaryCommand).toBeGreaterThan(firstNginxHealthCheck);
    expect(restorePublicAgent).toBeGreaterThan(canaryCommand);
    expect(restoreGeneration).toBeGreaterThan(canaryCommand);
    expect(finalCandidateStart).toBeGreaterThan(restoreGeneration);
    expect(runtimeFlagCheck).toBeGreaterThan(finalCandidateStart);
    expect(finalNginxHealthCheck).toBeGreaterThan(runtimeFlagCheck);
    expect(deploySuccess).toBeGreaterThan(finalNginxHealthCheck);
    expect(workflow).toContain("verify_agent_disabled");
    expect(workflow).toContain("fail_closed_rollback");
    expect(workflow).not.toContain("rollback || true");
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
