import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleBlogAgentClient } from "@/lib/blog-agent/modelClient";

describe("OpenAICompatibleBlogAgentClient", () => {
  it("sends one server-authenticated JSON completion request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"answer":"结论","citationIds":["section:0:a"],"insufficientEvidence":false}' } }],
          usage: { prompt_tokens: 12, completion_tokens: 7 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new OpenAICompatibleBlogAgentClient({
      baseUrl: "https://api.deepseek.com/",
      apiKey: "secret-key",
      model: "deepseek-chat",
      fetcher,
    });

    const response = await client.complete({
      system: "system",
      user: "user",
      maxOutputTokens: 600,
    });

    expect(response).toMatchObject({ inputTokens: 12, outputTokens: 7 });
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(request?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer secret-key" }),
    );
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: "deepseek-chat",
      temperature: 0,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });
  });

  it("does not expose a provider response body in errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("upstream-secret-debug-body", { status: 401 }),
    );
    const client = new OpenAICompatibleBlogAgentClient({
      baseUrl: "https://models.example/v1",
      apiKey: "secret-key",
      model: "model-a",
      fetcher,
    });

    await expect(
      client.complete({ system: "s", user: "u", maxOutputTokens: 10 }),
    ).rejects.toThrow("status 401");
    await expect(
      client.complete({ system: "s", user: "u", maxOutputTokens: 10 }),
    ).rejects.not.toThrow("upstream-secret-debug-body");
  });

  it("aborts a provider request at the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      let providerSignal: AbortSignal | undefined;
      const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, request) => {
        providerSignal = request?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          providerSignal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      });
      const client = new OpenAICompatibleBlogAgentClient({
        baseUrl: "https://models.example/v1",
        apiKey: "secret-key",
        model: "model-a",
        timeoutMs: 50,
        fetcher,
      });

      const completion = client.complete({ system: "s", user: "u", maxOutputTokens: 10 });
      const rejection = expect(completion).rejects.toMatchObject({ name: "AbortError" });
      await vi.advanceTimersByTimeAsync(50);

      await rejection;
      expect(providerSignal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
