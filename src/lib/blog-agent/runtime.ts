import { createHash } from "node:crypto";
import { readBlogAgentConfig, type BlogAgentConfig } from "./config";
import { getBlogAgentDatabasePool } from "./database";
import { OpenAICompatibleBlogAgentClient } from "./modelClient";
import { PostgresBlogAgentRepository } from "./repository.postgres";
import { BlogAgentService } from "./service";
import { GenerationUsagePolicy } from "./usagePolicy";

export type BlogAgentRuntime = {
  config: BlogAgentConfig;
  service: BlogAgentService | null;
};

let currentRuntime: { signature: string; value: BlogAgentRuntime } | undefined;

function runtimeSignature(config: BlogAgentConfig): string {
  return createHash("sha256").update(JSON.stringify({
    ...config,
    apiKey: config.apiKey ? createHash("sha256").update(config.apiKey).digest("hex") : "",
  })).digest("hex");
}

function modelCacheKey(config: BlogAgentConfig): string {
  return createHash("sha256")
    .update(`${config.baseUrl}\0${config.model}\0blog-agent-prompt-v1`)
    .digest("hex");
}

export function getBlogAgentRuntime(): BlogAgentRuntime {
  const config = readBlogAgentConfig();
  const signature = runtimeSignature(config);
  if (currentRuntime?.signature === signature) return currentRuntime.value;

  if (!config.enabled || !config.generationEnabled || !config.generationConfigured) {
    const value = { config, service: null };
    currentRuntime = { signature, value };
    return value;
  }

  const repository = new PostgresBlogAgentRepository(getBlogAgentDatabasePool());
  const usagePolicy = new GenerationUsagePolicy(repository, {
    windowMs: config.windowMs,
    perIdentityWindow: config.perIdentityWindow,
    perIdentityDaily: config.perIdentityDaily,
    globalDaily: config.globalDaily,
    perIdentityConcurrency: config.perIdentityConcurrency,
    globalConcurrency: config.globalConcurrency,
  });
  const client = new OpenAICompatibleBlogAgentClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.modelTimeoutMs,
  });
  const value = {
    config,
    service: new BlogAgentService({
      repository,
      usagePolicy,
      client,
      modelCacheKey: modelCacheKey(config),
      cacheTtlMs: config.cacheTtlMs,
    }),
  };
  currentRuntime = { signature, value };
  return value;
}
