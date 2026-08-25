import { createHash } from "node:crypto";
import { BLOG_AGENT_SYSTEM_PROMPT } from "./answer";
import { readBlogAgentConfig, type BlogAgentConfig } from "./config";
import { getBlogAgentDatabasePool } from "./database";
import { DeepSeekBlogAgentClient } from "./modelClient";
import { ArticleIndexer } from "./articleIndexer";
import { PostgresArticleIndexRepository } from "./articleIndexRepository.postgres";
import { DashScopeEmbeddingClient } from "./embeddingClient";
import { BlogScopedArticleRetriever } from "./articleRetriever";
import { PostgresBlogAgentRepository } from "./repository.postgres";
import { BlogAgentService } from "./service";
import { GenerationUsagePolicy } from "./usagePolicy";
import { PostgresUnansweredQuestionRecorder } from "./unansweredQuestions.postgres";

export type BlogAgentRuntime = {
  config: BlogAgentConfig;
  service: BlogAgentService | null;
  indexer: ArticleIndexer | null;
};

let currentRuntime: { signature: string; value: BlogAgentRuntime } | undefined;

function runtimeSignature(config: BlogAgentConfig): string {
  return createHash("sha256").update(JSON.stringify({
    ...config,
    apiKey: config.apiKey ? createHash("sha256").update(config.apiKey).digest("hex") : "",
  })).digest("hex");
}

export function createModelCacheKey(
  config: Pick<BlogAgentConfig, "baseUrl" | "model">,
  systemPrompt = BLOG_AGENT_SYSTEM_PROMPT,
): string {
  return createHash("sha256")
    .update(`${config.baseUrl}\0${config.model}\0${systemPrompt}`)
    .digest("hex");
}

export function getBlogAgentRuntime(): BlogAgentRuntime {
  const config = readBlogAgentConfig();
  const signature = runtimeSignature(config);
  if (currentRuntime?.signature === signature) return currentRuntime.value;

  const pool = getBlogAgentDatabasePool();
  const articleIndexRepository = config.embeddingConfigured
    ? new PostgresArticleIndexRepository(pool)
    : null;
  const embeddingClient = config.embeddingConfigured
    ? new DashScopeEmbeddingClient({
        baseUrl: config.embeddingBaseUrl,
        apiKey: config.embeddingApiKey,
        model: config.embeddingModel,
        dimensions: config.embeddingDimensions,
        timeoutMs: config.embeddingTimeoutMs,
      })
    : null;
  const indexer = articleIndexRepository && embeddingClient
    ? new ArticleIndexer({
      repository: articleIndexRepository,
      embeddings: embeddingClient,
      embeddingModel: config.embeddingModel,
      embeddingDimensions: config.embeddingDimensions,
    })
    : null;
  const articleRetriever = articleIndexRepository && embeddingClient
    ? new BlogScopedArticleRetriever({
      repository: articleIndexRepository,
      embeddings: embeddingClient,
      embeddingModel: config.embeddingModel,
      embeddingDimensions: config.embeddingDimensions,
    })
    : undefined;
  if (!config.enabled || !config.generationEnabled || !config.generationConfigured) {
    const value = { config, service: null, indexer };
    currentRuntime = { signature, value };
    return value;
  }

  const repository = new PostgresBlogAgentRepository(pool);
  const unansweredQuestions = new PostgresUnansweredQuestionRecorder(pool);
  const usagePolicy = new GenerationUsagePolicy(repository, {
    windowMs: config.windowMs,
    perIdentityWindow: config.perIdentityWindow,
    perIdentityDaily: config.perIdentityDaily,
    globalDaily: config.globalDaily,
    perIdentityConcurrency: config.perIdentityConcurrency,
    globalConcurrency: config.globalConcurrency,
  });
  const client = new DeepSeekBlogAgentClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.modelTimeoutMs,
  });
  const value = {
    config,
    indexer,
    service: new BlogAgentService({
      repository,
      usagePolicy,
      client,
      modelCacheKey: createModelCacheKey(config),
      cacheTtlMs: config.cacheTtlMs,
      articleRetriever,
      unansweredQuestions,
    }),
  };
  currentRuntime = { signature, value };
  return value;
}
