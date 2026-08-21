import { describe, expect, it } from "vitest";
import { readBlogAgentConfig } from "@/lib/blog-agent/config";

describe("readBlogAgentConfig", () => {
  it("keeps the public Agent and generation disabled by default", () => {
    expect(readBlogAgentConfig({})).toMatchObject({
      enabled: false,
      generationEnabled: false,
      generationConfigured: false,
      modelTimeoutMs: 15_000,
      cacheTtlMs: 86_400_000,
    });
  });

  it("recognizes a complete DeepSeek-compatible server configuration", () => {
    const config = readBlogAgentConfig({
      BLOG_AGENT_ENABLED: "true",
      BLOG_AGENT_GENERATION_ENABLED: "1",
      BLOG_AGENT_BASE_URL: " https://api.deepseek.com ",
      BLOG_AGENT_API_KEY: " server-secret ",
      BLOG_AGENT_MODEL: " deepseek-chat ",
    });

    expect(config).toMatchObject({
      enabled: true,
      generationEnabled: true,
      generationConfigured: true,
      baseUrl: "https://api.deepseek.com",
      apiKey: "server-secret",
      model: "deepseek-chat",
    });
  });

  it("clamps visitor-controlled cost limits to safe server ranges", () => {
    const config = readBlogAgentConfig({
      BLOG_AGENT_MODEL_TIMEOUT_MS: "999999",
      BLOG_AGENT_WINDOW_LIMIT: "0",
      BLOG_AGENT_GLOBAL_CONCURRENCY: "999",
    });

    expect(config.modelTimeoutMs).toBe(60_000);
    expect(config.perIdentityWindow).toBe(1);
    expect(config.globalConcurrency).toBe(100);
  });
});
