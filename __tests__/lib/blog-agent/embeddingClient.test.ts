import { describe, expect, it, vi } from "vitest";
import { DashScopeEmbeddingClient } from "@/lib/blog-agent/embeddingClient";

function responseFor(inputs: string[], dimensions = 3): Response {
  return new Response(JSON.stringify({
    data: inputs.map((_input, index) => ({
      index,
      embedding: Array.from({ length: dimensions }, (_, dimension) => index + dimension + 1),
    })).reverse(),
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("DashScopeEmbeddingClient", () => {
  it("batches ten inputs, restores provider ordering, and sends only server credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, request) => {
      const body = JSON.parse(String(request?.body)) as { input: string[] };
      return responseFor(body.input);
    });
    const client = new DashScopeEmbeddingClient({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
      apiKey: "server-secret",
      model: "qwen3.7-text-embedding",
      dimensions: 3,
      fetcher,
    });

    const embeddings = await client.embed(
      Array.from({ length: 11 }, (_, index) => `chunk-${index}`),
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(embeddings[0]).toEqual([1, 2, 3]);
    expect(embeddings[10]).toEqual([1, 2, 3]);
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings");
    expect(request?.headers).toEqual(expect.objectContaining({
      Authorization: "Bearer server-secret",
    }));
    expect(JSON.parse(String(request?.body))).toEqual({
      model: "qwen3.7-text-embedding",
      input: Array.from({ length: 10 }, (_, index) => `chunk-${index}`),
      dimensions: 3,
      encoding_format: "float",
    });
  });

  it.each([
    ["non-200", new Response("private provider detail", { status: 401 })],
    ["wrong dimensions", responseFor(["one"], 2)],
    ["non-finite", new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, "NaN", 3] }] }), { status: 200 })],
  ])("fails closed for %s without exposing response bodies", async (_name, response) => {
    const client = new DashScopeEmbeddingClient({
      baseUrl: "https://models.example/v1",
      apiKey: "secret",
      model: "embedding-model",
      dimensions: 3,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(response),
    });

    await expect(client.embed(["one"])).rejects.not.toThrow("private provider detail");
  });

  it("aborts an embedding request at the configured timeout", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const client = new DashScopeEmbeddingClient({
        baseUrl: "https://models.example/v1",
        apiKey: "secret",
        model: "embedding-model",
        dimensions: 3,
        timeoutMs: 50,
        fetcher: vi.fn<typeof fetch>().mockImplementation((_url, request) => {
          signal = request?.signal ?? undefined;
          return new Promise((_resolve, reject) => signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
          ));
        }),
      });

      const pending = client.embed(["one"]);
      const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
