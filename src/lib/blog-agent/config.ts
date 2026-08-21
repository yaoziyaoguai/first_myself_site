export type BlogAgentConfig = {
  enabled: boolean;
  generationEnabled: boolean;
  generationConfigured: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelTimeoutMs: number;
  cacheTtlMs: number;
  perIdentityWindow: number;
  windowMs: number;
  perIdentityDaily: number;
  globalDaily: number;
  perIdentityConcurrency: number;
  globalConcurrency: number;
};

function enabled(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function readBlogAgentConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): BlogAgentConfig {
  const baseUrl = environment.BLOG_AGENT_BASE_URL?.trim() ?? "";
  const apiKey = environment.BLOG_AGENT_API_KEY?.trim() ?? "";
  const model = environment.BLOG_AGENT_MODEL?.trim() ?? "";

  return {
    enabled: enabled(environment.BLOG_AGENT_ENABLED),
    generationEnabled: enabled(environment.BLOG_AGENT_GENERATION_ENABLED),
    generationConfigured: Boolean(baseUrl && apiKey && model),
    baseUrl,
    apiKey,
    model,
    modelTimeoutMs: boundedInteger(
      environment.BLOG_AGENT_MODEL_TIMEOUT_MS,
      15_000,
      1_000,
      60_000,
    ),
    cacheTtlMs:
      boundedInteger(
        environment.BLOG_AGENT_CACHE_TTL_SECONDS,
        86_400,
        60,
        604_800,
      ) * 1_000,
    perIdentityWindow: boundedInteger(
      environment.BLOG_AGENT_WINDOW_LIMIT,
      3,
      1,
      100,
    ),
    windowMs:
      boundedInteger(
        environment.BLOG_AGENT_WINDOW_SECONDS,
        600,
        60,
        86_400,
      ) * 1_000,
    perIdentityDaily: boundedInteger(
      environment.BLOG_AGENT_IDENTITY_DAILY_LIMIT,
      20,
      1,
      10_000,
    ),
    globalDaily: boundedInteger(
      environment.BLOG_AGENT_GLOBAL_DAILY_LIMIT,
      100,
      1,
      1_000_000,
    ),
    perIdentityConcurrency: boundedInteger(
      environment.BLOG_AGENT_IDENTITY_CONCURRENCY,
      1,
      1,
      10,
    ),
    globalConcurrency: boundedInteger(
      environment.BLOG_AGENT_GLOBAL_CONCURRENCY,
      3,
      1,
      100,
    ),
  };
}
