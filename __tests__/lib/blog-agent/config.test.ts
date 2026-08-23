import { describe, expect, it } from "vitest";
import {
  canShowBlogAgent,
  readBlogAgentConfig,
} from "@/lib/blog-agent/config";

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
      BLOG_AGENT_MODEL: " deepseek-v4-flash ",
    });

    expect(config).toMatchObject({
      enabled: true,
      generationEnabled: true,
      generationConfigured: true,
      baseUrl: "https://api.deepseek.com",
      apiKey: "server-secret",
      model: "deepseek-v4-flash",
    });
  });

  it("recognizes a server-only DashScope embedding configuration", () => {
    const config = readBlogAgentConfig({
      DASHSCOPE_API_KEY: " server-embedding-secret ",
      BLOG_AGENT_EMBEDDING_BASE_URL: " https://dashscope.example/v1/ ",
      BLOG_AGENT_EMBEDDING_MODEL: " qwen3.7-text-embedding ",
      BLOG_AGENT_EMBEDDING_DIMENSIONS: "1024",
      BLOG_AGENT_EMBEDDING_TIMEOUT_MS: "999999",
    });

    expect(config).toMatchObject({
      embeddingConfigured: true,
      embeddingBaseUrl: "https://dashscope.example/v1/",
      embeddingApiKey: "server-embedding-secret",
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 1024,
      embeddingTimeoutMs: 60_000,
    });
  });

  it("rejects an embedding dimension that would invalidate stored packages", () => {
    expect(() => readBlogAgentConfig({
      BLOG_AGENT_EMBEDDING_DIMENSIONS: "2048",
    })).toThrow("must be 1024");
  });

  it("keeps article rendering available when optional Agent config is invalid", () => {
    expect(canShowBlogAgent({
      BLOG_AGENT_ENABLED: "true",
      BLOG_AGENT_GENERATION_ENABLED: "true",
      BLOG_AGENT_BASE_URL: "https://api.deepseek.com",
      BLOG_AGENT_API_KEY: "server-secret",
      BLOG_AGENT_MODEL: "deepseek-v4-flash",
      BLOG_AGENT_EMBEDDING_DIMENSIONS: "2048",
    })).toBe(false);
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
