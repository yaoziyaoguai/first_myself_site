import { describe, expect, it, vi } from "vitest";
import {
  BlogAgentProviderError,
  DeepSeekBlogAgentClient,
} from "@/lib/blog-agent/modelClient";

describe("DeepSeekBlogAgentClient", () => {
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
    const client = new DeepSeekBlogAgentClient({
      baseUrl: "https://api.deepseek.com/",
      apiKey: "secret-key",
      model: "deepseek-v4-flash",
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
      model: "deepseek-v4-flash",
      temperature: 0,
      max_tokens: 600,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
  });

  it.each([
    [400, "request"],
    [401, "authentication"],
    [402, "billing"],
    [403, "authentication"],
    [422, "request"],
    [429, "rate-limit"],
    [503, "server"],
  ] as const)("classifies HTTP %s without exposing the provider body", async (
    status,
    category,
  ) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("upstream-secret-debug-body", { status }),
    );
    const client = new DeepSeekBlogAgentClient({
      baseUrl: "https://models.example/v1",
      apiKey: "secret-key",
      model: "model-a",
      fetcher,
    });

    const error = await client
      .complete({ system: "s", user: "u", maxOutputTokens: 10 })
      .catch((reason: unknown) => reason);
    expect(error).toMatchObject({
      name: "BlogAgentProviderError",
      category,
    });
    expect(String(error)).not.toContain("upstream-secret-debug-body");
  });

  it("classifies an invalid success response", async () => {
    const client = new DeepSeekBlogAgentClient({
      baseUrl: "https://models.example/v1",
      apiKey: "secret-key",
      model: "model-a",
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      ),
    });

    await expect(
      client.complete({ system: "s", user: "u", maxOutputTokens: 10 }),
    ).rejects.toMatchObject(new BlogAgentProviderError("invalid-response"));
  });

  it("classifies a null JSON response without throwing a raw TypeError", async () => {
    const client = new DeepSeekBlogAgentClient({
      baseUrl: "https://models.example/v1",
      apiKey: "secret-key",
      model: "model-a",
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response("null", { status: 200 }),
      ),
    });

    await expect(
      client.complete({ system: "s", user: "u", maxOutputTokens: 10 }),
    ).rejects.toMatchObject(new BlogAgentProviderError("invalid-response"));
  });

  it("classifies a non-timeout fetch rejection as a network failure", async () => {
    const client = new DeepSeekBlogAgentClient({
      baseUrl: "https://models.example/v1",
      apiKey: "secret-key",
      model: "model-a",
      fetcher: vi.fn<typeof fetch>().mockRejectedValue(
        new Error("private-network-detail"),
      ),
    });

    const error = await client
      .complete({ system: "s", user: "u", maxOutputTokens: 10 })
      .catch((reason: unknown) => reason);
    expect(error).toMatchObject(new BlogAgentProviderError("network"));
    expect(String(error)).not.toContain("private-network-detail");
  });

  it("redacts a malformed successful response", async () => {
    const client = new DeepSeekBlogAgentClient({
      baseUrl: "https://models.example/v1",
      apiKey: "secret-key",
      model: "model-a",
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response("private-malformed-response", { status: 200 }),
      ),
    });

    const error = await client
      .complete({ system: "s", user: "u", maxOutputTokens: 10 })
      .catch((reason: unknown) => reason);
    expect(error).toMatchObject(new BlogAgentProviderError("invalid-response"));
    expect(String(error)).not.toContain("private-malformed-response");
  });

  it("aborts a provider request at the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      let providerSignal: AbortSignal | undefined;
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation((_url, request) => {
          providerSignal = request?.signal ?? undefined;
          return new Promise((_resolve, reject) => {
            providerSignal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          });
        });
      const client = new DeepSeekBlogAgentClient({
        baseUrl: "https://models.example/v1",
        apiKey: "secret-key",
        model: "model-a",
        timeoutMs: 50,
        fetcher,
      });

      const completion = client.complete({
        system: "s",
        user: "u",
        maxOutputTokens: 10,
      });
      const rejection = expect(completion).rejects.toMatchObject({
        name: "BlogAgentProviderError",
        category: "timeout",
      });
      await vi.advanceTimersByTimeAsync(50);

      await rejection;
      expect(providerSignal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("classifies an aborted response-body read as a timeout", async () => {
    vi.useFakeTimers();
    try {
      let providerSignal: AbortSignal | undefined;
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation((_url, request) => {
          providerSignal = request?.signal ?? undefined;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => new Promise((_resolve, reject) => {
              providerSignal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
          } as Response);
        });
      const client = new DeepSeekBlogAgentClient({
        baseUrl: "https://models.example/v1",
        apiKey: "secret-key",
        model: "model-a",
        timeoutMs: 50,
        fetcher,
      });

      const completion = client.complete({
        system: "s",
        user: "u",
        maxOutputTokens: 10,
      });
      const rejection = expect(completion).rejects.toMatchObject({
        name: "BlogAgentProviderError",
        category: "timeout",
      });
      await vi.advanceTimersByTimeAsync(50);

      await rejection;
      expect(providerSignal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
