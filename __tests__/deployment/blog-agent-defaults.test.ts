import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Blog Agent production defaults", () => {
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
      "COPY --from=builder /app/src/lib/blog-agent ./src/lib/blog-agent",
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
      "__tests__/lib/blog-agent/runtime.postgres.test.ts",
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
    expect(workflow).not.toMatch(/build-args:[\s\S]*BLOG_AGENT_API_KEY/);
  });
});
