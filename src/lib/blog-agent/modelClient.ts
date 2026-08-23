import type {
  BlogAgentAnswerClient,
  BlogAgentModelResponse,
} from "./answer";

type DeepSeekBlogAgentClientConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

export type BlogAgentProviderFailureCategory =
  | "authentication"
  | "billing"
  | "invalid-response"
  | "network"
  | "rate-limit"
  | "request"
  | "server"
  | "timeout";

export class BlogAgentProviderError extends Error {
  readonly name = "BlogAgentProviderError";

  constructor(readonly category: BlogAgentProviderFailureCategory) {
    super(`Blog Agent provider failure: ${category}`);
  }
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/g, "")}/chat/completions`;
}

function tokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function failureCategory(status: number): BlogAgentProviderFailureCategory {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "billing";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server";
  return "request";
}

export class DeepSeekBlogAgentClient
  implements BlogAgentAnswerClient
{
  constructor(private readonly config: DeepSeekBlogAgentClientConfig) {}

  async complete(request: {
    system: string;
    user: string;
    maxOutputTokens: number;
  }): Promise<BlogAgentModelResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? 15_000,
    );
    try {
      let response: Response;
      try {
        response = await (this.config.fetcher ?? fetch)(
          endpoint(this.config.baseUrl),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: this.config.model,
              messages: [
                { role: "system", content: request.system },
                { role: "user", content: request.user },
              ],
              max_tokens: request.maxOutputTokens,
              temperature: 0,
              response_format: { type: "json_object" },
              thinking: { type: "disabled" },
            }),
            signal: controller.signal,
          },
        );
      } catch {
        throw new BlogAgentProviderError(
          controller.signal.aborted ? "timeout" : "network",
        );
      }
      if (!response.ok) {
        throw new BlogAgentProviderError(failureCategory(response.status));
      }
      let parsedBody: unknown;
      try {
        parsedBody = await response.json();
      } catch {
        throw new BlogAgentProviderError(
          controller.signal.aborted ? "timeout" : "invalid-response",
        );
      }
      if (
        parsedBody === null ||
        typeof parsedBody !== "object" ||
        Array.isArray(parsedBody)
      ) {
        throw new BlogAgentProviderError("invalid-response");
      }
      const body = parsedBody as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new BlogAgentProviderError("invalid-response");
      }
      return {
        content,
        inputTokens: tokenCount(body.usage?.prompt_tokens),
        outputTokens: tokenCount(body.usage?.completion_tokens),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
