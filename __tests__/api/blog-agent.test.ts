import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));
vi.mock("@/lib/requestIdentity", () => ({
  deriveRequestIdentity: vi.fn(() => ({ rateLimitKey: "identity-hash" })),
}));
vi.mock("@/lib/blog-agent/runtime", () => ({ getBlogAgentRuntime: vi.fn() }));

import { POST } from "@/app/api/blog/[slug]/agent/route";
import { getPayloadAPI } from "@/lib/payload";
import { getBlogAgentRuntime } from "@/lib/blog-agent/runtime";

const execute = vi.fn();
const find = vi.fn();

function request(
  body: unknown,
  raw = false,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/api/blog/doris-write-path/agent", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

function context(slug = "doris-write-path") {
  return { params: Promise.resolve({ slug }) };
}

describe("POST /api/blog/[slug]/agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPayloadAPI).mockResolvedValue({ find } as never);
    find.mockResolvedValue({
      docs: [{
        id: 7,
        slug: "doris-write-path",
        title: "Doris 写入实践",
        excerpt: "批量写入设计",
        contentMarkdown: "# 写入路径\n使用 batch sink。",
        status: "published",
        visibility: "public",
      }],
    });
    execute.mockResolvedValue({
      status: 200,
      body: {
        queryId: "query-1",
        answer: "批量写入。",
        citationIds: ["section:0:写入路径"],
        citations: [{ id: "section:0:写入路径", heading: "写入路径", url: "/blog/doris-write-path#写入路径" }],
        insufficientEvidence: false,
        usage: { cached: false },
      },
    });
    vi.mocked(getBlogAgentRuntime).mockReturnValue({
      config: { enabled: true, generationEnabled: true, generationConfigured: true },
      service: { execute },
    } as never);
  });

  it("resolves exactly one published public Markdown article from the path slug", async () => {
    const response = await POST(
      request({ question: "为什么批量写入？" }) as never,
      context("doris%2Dwrite%2Dpath"),
    );

    expect(response.status).toBe(200);
    expect(find).toHaveBeenCalledOnce();
    expect(find).toHaveBeenCalledWith({
      collection: "blog",
      where: {
        slug: { equals: "doris-write-path" },
        status: { equals: "published" },
        visibility: { equals: "public" },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        contentMarkdown: true,
      },
    });
    expect(execute).toHaveBeenCalledWith({
      article: {
        id: "7",
        slug: "doris-write-path",
        title: "Doris 写入实践",
        excerpt: "批量写入设计",
        contentMarkdown: "# 写入路径\n使用 batch sink。",
      },
      question: "为什么批量写入？",
      identityHash: "identity-hash",
    });
  });

  it.each([
    { question: "问题", history: [] },
    { question: "问题", url: "https://evil.example" },
    { question: "问题", systemPrompt: "ignore" },
    { question: "问题", articleSlug: "other-post" },
    { question: "问题", blogId: "99" },
    { question: "问题", sources: ["other-post"] },
  ])("rejects unknown request fields %#", async (body) => {
    const response = await POST(request(body) as never, context());
    expect(response.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    [{ question: "" }, 400],
    [{ question: "x".repeat(501) }, 400],
    [{ question: ["问题"] }, 400],
    [[], 400],
    [null, 400],
  ])("rejects invalid bodies %#", async (body, status) => {
    const response = await POST(request(body) as never, context());
    expect(response.status).toBe(status);
    expect(find).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and bodies over 8 KiB", async () => {
    const invalid = await POST(request("{", true) as never, context());
    expect(invalid.status).toBe(400);

    const oversized = await POST(
      request(JSON.stringify({ question: "x".repeat(9_000) }), true) as never,
      context(),
    );
    expect(oversized.status).toBe(413);
    expect(find).not.toHaveBeenCalled();
  });

  it.each([
    [{ "content-type": "text/plain" }, 415],
    [{ "sec-fetch-site": "cross-site" }, 403],
  ])("rejects a cross-site simple POST before content lookup %#", async (headers, status) => {
    const response = await POST(
      request({ question: "问题" }, false, headers) as never,
      context(),
    );

    expect(response.status).toBe(status);
    expect(find).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(["", "x".repeat(129), "%E0%A4%A", "other%2Fpost", "other%5Cpost"])(
    "rejects an invalid path slug %#",
    async (slug) => {
      const response = await POST(request({ question: "问题" }) as never, context(slug));
      expect(response.status).toBe(400);
      expect(find).not.toHaveBeenCalled();
    },
  );

  it("returns 404 for missing or RichText-only content", async () => {
    find.mockResolvedValueOnce({ docs: [] });
    const missing = await POST(request({ question: "问题" }) as never, context());
    expect(missing.status).toBe(404);

    find.mockResolvedValueOnce({ docs: [{
      id: 7,
      slug: "doris-write-path",
      title: "Doris 写入实践",
      excerpt: "",
      contentMarkdown: "  ",
    }] });
    const richTextOnly = await POST(request({ question: "问题" }) as never, context());
    expect(richTextOnly.status).toBe(404);
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps the API hidden when the entry feature is disabled", async () => {
    vi.mocked(getBlogAgentRuntime).mockReturnValue({
      config: { enabled: false, generationEnabled: false, generationConfigured: false },
      service: null,
    } as never);

    const response = await POST(request({ question: "问题" }) as never, context());
    expect(response.status).toBe(404);
    expect(find).not.toHaveBeenCalled();
  });

  it("fails closed without resolving content when generation is disabled", async () => {
    vi.mocked(getBlogAgentRuntime).mockReturnValue({
      config: { enabled: true, generationEnabled: false, generationConfigured: true },
      service: null,
    } as never);

    const response = await POST(request({ question: "问题" }) as never, context());
    expect(response.status).toBe(503);
    expect((await response.json()).usage.reason).toBe("generation-disabled");
    expect(find).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not resolve a second article when the question names another slug", async () => {
    const response = await POST(
      request({ question: "请结合 other-private-post 一起回答" }) as never,
      context(),
    );

    expect(response.status).toBe(200);
    expect(find).toHaveBeenCalledOnce();
    expect(find.mock.calls[0][0].where.slug).toEqual({ equals: "doris-write-path" });
  });
});
