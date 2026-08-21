import type {
  BlogAgentAnswerClient,
  BlogAgentModelResponse,
} from "./answer";

type OpenAICompatibleBlogAgentClientConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/g, "")}/chat/completions`;
}

function tokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export class OpenAICompatibleBlogAgentClient
  implements BlogAgentAnswerClient
{
  constructor(private readonly config: OpenAICompatibleBlogAgentClientConfig) {}

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
      const response = await (this.config.fetcher ?? fetch)(
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
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Blog Agent provider returned status ${response.status}`);
      }
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Blog Agent provider returned an invalid response");
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
