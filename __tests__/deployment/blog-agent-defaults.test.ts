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
    expect(compose).toContain("BLOG_AGENT_GLOBAL_DAILY_LIMIT: ${BLOG_AGENT_GLOBAL_DAILY_LIMIT:-100}");
    expect(compose).not.toContain("NEXT_PUBLIC_BLOG_AGENT_API_KEY");
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
});
