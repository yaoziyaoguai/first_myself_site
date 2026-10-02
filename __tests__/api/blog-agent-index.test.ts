import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));
vi.mock("@/lib/blog-agent/runtime", () => ({ getBlogAgentRuntime: vi.fn() }));
vi.mock("@/lib/visitorContentCache", () => ({ revalidateVisitorContent: vi.fn() }));

import { GET, POST, PUT, PATCH } from "@/app/api/blog/[identifier]/agent-index/route";
import { revalidateVisitorContent } from "@/lib/visitorContentCache";
import { getPayloadAPI } from "@/lib/payload";
import { getBlogAgentRuntime } from "@/lib/blog-agent/runtime";
import { ArticlePackageValidationError, hashPublicArticle } from "@/lib/blog-agent/articlePackage";
import { ArticlePackageIndexConflictError } from "@/lib/blog-agent/articleIndexRepository.postgres";

const auth = vi.fn();
const findByID = vi.fn();
const update = vi.fn();
const index = vi.fn();
const refreshPublished = vi.fn();
const getSummary = vi.fn();
const revisePublished = vi.fn();
const getSourceManifest = vi.fn();

const validBody = {
  version: 1,
  packageHash: "a".repeat(64),
  sourceCommit: "b".repeat(40),
  mainSha256: "c".repeat(64),
  manifestPath: "docs/a.agent.json",
  sources: [],
  excluded: [],
  canaryQuestion: "如何工作？",
};

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/blog/42/agent-index", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer token", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function putRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/blog/42/agent-index", {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: "Bearer token", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ identifier: "42" }) };

function privateArticle() {
  return {
    id: 42,
    slug: "agent-loop",
    title: "Agent Loop",
    excerpt: "循环",
    contentMarkdown: "主要内容",
    status: "draft",
    visibility: "private",
    agentContextRequired: true,
    agentPackageHash: "a".repeat(64),
    agentIndexStatus: "pending",
  };
}

function publishedArticle() {
  return {
    ...privateArticle(),
    status: "published",
    visibility: "public",
    agentIndexStatus: "ready",
    agentIndexedPackageHash: "a".repeat(64),
  };
}

function revisionRequest(patch: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/blog/42/agent-index", {
    method: "PATCH", headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      previousArticleHash: hashPublicArticle({ ...publishedArticle(), id: "42" }),
      previousPackageHash: "a".repeat(64),
      article: { title: "新标题", excerpt: "新摘要", contentMarkdown: "新正文", readingTime: "约 1 分钟" },
      package: { ...validBody, packageHash: "d".repeat(64) },
      ...patch,
    }),
  });
}

describe("/api/blog/[id]/agent-index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPayloadAPI).mockResolvedValue({ auth, findByID, update } as never);
    auth.mockResolvedValue({ user: { id: 1, role: "editor" } });
    findByID.mockResolvedValue(privateArticle());
    update.mockResolvedValue({});
    index.mockResolvedValue({
      packageHash: "a".repeat(64),
      chunkCount: 3,
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 1024,
      indexedAt: new Date("2026-08-23T00:00:00.000Z"),
    });
    getSummary.mockResolvedValue(null);
    refreshPublished.mockResolvedValue({
      packageHash: "d".repeat(64),
      chunkCount: 3,
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 1024,
      indexedAt: new Date("2026-08-24T00:00:00.000Z"),
    });
    revisePublished.mockImplementation((...args) => refreshPublished(...args));
    getSourceManifest.mockResolvedValue({ version: 1, sources: [] });
    vi.mocked(revalidateVisitorContent).mockResolvedValue(undefined);
    vi.mocked(getBlogAgentRuntime).mockReturnValue({
      indexer: { index, refreshPublished, getSummary, revisePublished, getSourceManifest },
    } as never);
  });

  it("updates content and its index through one authenticated swap and invalidates visitor pages", async () => {
    findByID.mockResolvedValueOnce(publishedArticle());
    const response = await PATCH(revisionRequest(), context);
    expect(response.status).toBe(200);
    expect(revisePublished).toHaveBeenCalledWith(expect.objectContaining({
      article: expect.objectContaining({ id: "42", slug: "agent-loop", title: "Agent Loop" }),
      replacement: { title: "新标题", excerpt: "新摘要", contentMarkdown: "新正文", readingTime: "约 1 分钟" },
    }));
    expect(update).not.toHaveBeenCalled();
    expect(revalidateVisitorContent).toHaveBeenCalledOnce();
  });

  it.each([null, { role: "viewer" }])("blocks revision and manifest access for unauthorized users", async (user) => {
    auth.mockResolvedValue({ user });
    expect((await PATCH(revisionRequest(), context)).status).toBe(user ? 403 : 401);
    expect((await GET(new Request("https://example.com/api/blog/42/agent-index?manifest=1"), context)).status).toBe(user ? 403 : 401);
    expect(findByID).not.toHaveBeenCalled();
  });

  it.each([
    { previousArticleHash: "e".repeat(64) },
    { previousPackageHash: "e".repeat(64) },
    { package: validBody },
  ])("rejects stale content or package identity before indexing %#", async (patch) => {
    findByID.mockResolvedValueOnce(publishedArticle());
    expect((await PATCH(revisionRequest(patch), context)).status).toBe(409);
    expect(revisePublished).not.toHaveBeenCalled();
  });

  it.each([
    { status: "private" },
    { article: { title: "新", excerpt: "", contentMarkdown: "正文", readingTime: "1", slug: "changed" } },
    { article: { title: "", excerpt: "", contentMarkdown: "正文", readingTime: "1" } },
    { article: { title: "新", excerpt: "", contentMarkdown: "字".repeat(70000), readingTime: "1" } },
  ])("rejects changes outside the editorial fields and oversized Markdown %#", async (patch) => {
    expect((await PATCH(revisionRequest(patch), context)).status).toBe(400);
    expect(revisePublished).not.toHaveBeenCalled();
  });

  it("enforces JSON, cross-site protection and streamed request size for revisions", async () => {
    expect((await PATCH(revisionRequest({}, { "sec-fetch-site": "cross-site" }), context)).status).toBe(403);
    expect((await PATCH(revisionRequest({}, { "content-type": "text/plain" }), context)).status).toBe(415);
    const large = new Request("https://example.com/api/blog/42/agent-index", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: "x".repeat(361 * 1024),
    });
    expect((await PATCH(large, context)).status).toBe(413);
    expect(revisePublished).not.toHaveBeenCalled();
  });

  it.each([
    [new Error("provider-secret"), 503],
    [new ArticlePackageValidationError("invalid-source-secret"), 422],
    [new ArticlePackageIndexConflictError(), 409],
  ])("keeps the old article live and hides failure details %#", async (error, status) => {
    findByID.mockResolvedValueOnce(publishedArticle());
    revisePublished.mockRejectedValueOnce(error);
    const response = await PATCH(revisionRequest(), context);
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("secret");
    expect(update).not.toHaveBeenCalled();
    expect(revalidateVisitorContent).not.toHaveBeenCalled();
  });

  it("returns authenticated source metadata bound to the exact current article", async () => {
    findByID.mockResolvedValueOnce(publishedArticle());
    const response = await GET(new Request("https://example.com/api/blog/42/agent-index?manifest=1"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      packageHash: "a".repeat(64), articleHash: expect.any(String), manifest: { version: 1, sources: [] },
    });
  });

  it("reports a committed revision even if visitor cache invalidation fails", async () => {
    findByID.mockResolvedValueOnce(publishedArticle());
    vi.mocked(revalidateVisitorContent).mockRejectedValueOnce(new Error("cache unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const response = await PATCH(revisionRequest(), context);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, cacheRevalidated: false });
      expect(revisePublished).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("indexes only the authenticated draft/private Blog resolved from the path", async () => {
    const response = await POST(request(validBody), context);

    expect(response.status).toBe(200);
    expect(auth).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    expect(findByID).toHaveBeenCalledWith({
      collection: "blog",
      id: "42",
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    });
    expect(index).toHaveBeenCalledWith({
      article: {
        id: "42",
        slug: "agent-loop",
        title: "Agent Loop",
        excerpt: "循环",
        contentMarkdown: "主要内容",
      },
      packagePayload: validBody,
    });
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      collection: "blog",
      id: "42",
      overrideAccess: true,
      data: expect.objectContaining({
        agentIndexStatus: "ready",
        agentIndexedPackageHash: "a".repeat(64),
      }),
    }));
  });

  it.each([
    [null, 401],
    [{ id: 2, role: "viewer" }, 403],
  ])("rejects unauthorized identities before content lookup", async (user, status) => {
    auth.mockResolvedValue({ user });
    const response = await POST(request(validBody), context);
    expect(response.status).toBe(status);
    expect(findByID).not.toHaveBeenCalled();
    expect(index).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "published" }, 409],
    [{ visibility: "public" }, 409],
    [{ agentContextRequired: false }, 409],
    [{ agentPackageHash: "b".repeat(64) }, 409],
  ])("refuses an invalid Blog publication state %#", async (articlePatch, status) => {
    findByID.mockResolvedValueOnce({ ...(await findByID()), ...articlePatch });
    const response = await POST(request(validBody), context);
    expect(response.status).toBe(status);
    expect(index).not.toHaveBeenCalled();
  });

  it("rejects cross-site, malformed, and oversized requests before indexing", async () => {
    const crossSite = await POST(request(validBody, { "sec-fetch-site": "cross-site" }), context);
    expect(crossSite.status).toBe(403);

    const malformed = await POST(request("{"), context);
    expect(malformed.status).toBe(400);

    const oversized = await POST(request({ ...validBody, padding: "x".repeat(170 * 1024) }), context);
    expect(oversized.status).toBe(413);
    expect(index).not.toHaveBeenCalled();
  });

  it("returns 503 for a retryable provider failure without returning details", async () => {
    index.mockRejectedValueOnce(new Error("provider body: secret-debug"));
    const response = await POST(request(validBody), context);

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-debug");
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ agentIndexStatus: "failed" }),
    }));
  });

  it("returns 422 for a permanent package validation failure", async () => {
    index.mockRejectedValueOnce(
      new ArticlePackageValidationError("invalid private path"),
    );
    const response = await POST(request(validBody), context);

    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain("private path");
  });

  it("returns 409 without marking failure when the package changed during indexing", async () => {
    index.mockRejectedValueOnce(new ArticlePackageIndexConflictError());

    const response = await POST(request(validBody), context);

    expect(response.status).toBe(409);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { agentIndexStatus: "pending" },
    }));
  });

  it("rechecks the Blog before stamping a completed index ready", async () => {
    findByID
      .mockResolvedValueOnce(privateArticle())
      .mockResolvedValueOnce({
        ...privateArticle(),
        agentPackageHash: "b".repeat(64),
      });

    const response = await POST(request(validBody), context);

    expect(response.status).toBe(409);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { agentIndexStatus: "pending" },
    }));
  });

  it("does not stamp a stale index ready after article metadata changes", async () => {
    findByID
      .mockResolvedValueOnce(privateArticle())
      .mockResolvedValueOnce({
        ...privateArticle(),
        title: "Agent Loop（修订版）",
      });

    const response = await POST(request(validBody), context);

    expect(response.status).toBe(409);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: { agentIndexStatus: "pending" },
    }));
  });

  it("returns an authenticated summary without source content or embeddings", async () => {
    getSummary.mockResolvedValueOnce({
      packageHash: "a".repeat(64),
      chunkCount: 3,
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 1024,
      indexedAt: new Date("2026-08-23T00:00:00.000Z"),
    });
    const response = await GET(new Request(
      "https://example.com/api/blog/42/agent-index",
      { headers: { authorization: "Bearer token" } },
    ), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ indexStatus: "pending", chunkCount: 3 });
    expect(JSON.stringify(body)).not.toMatch(/content|embedding\s*:/i);
  });

  it("atomically refreshes a published article package while the old package remains live", async () => {
    const nextPackage = { ...validBody, packageHash: "d".repeat(64) };
    findByID.mockResolvedValueOnce(publishedArticle());

    const response = await PUT(putRequest({
      previousPackageHash: "a".repeat(64),
      package: nextPackage,
    }), context);

    expect(response.status).toBe(200);
    expect(refreshPublished).toHaveBeenCalledWith({
      article: {
        id: "42",
        slug: "agent-loop",
        title: "Agent Loop",
        excerpt: "循环",
        contentMarkdown: "主要内容",
      },
      previousPackageHash: "a".repeat(64),
      packagePayload: nextPackage,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses stale or non-public refreshes before embedding", async () => {
    const nextPackage = { ...validBody, packageHash: "d".repeat(64) };
    findByID
      .mockResolvedValueOnce(publishedArticle())
      .mockResolvedValueOnce(privateArticle());

    const stale = await PUT(putRequest({
      previousPackageHash: "b".repeat(64),
      package: nextPackage,
    }), context);
    const privateResponse = await PUT(putRequest({
      previousPackageHash: "a".repeat(64),
      package: nextPackage,
    }), context);

    expect(stale.status).toBe(409);
    expect(privateResponse.status).toBe(409);
    expect(refreshPublished).not.toHaveBeenCalled();
  });

  it("keeps the published package ready when refresh generation fails", async () => {
    findByID.mockResolvedValueOnce(publishedArticle());
    refreshPublished.mockRejectedValueOnce(new Error("provider body: secret-debug"));

    const response = await PUT(putRequest({
      previousPackageHash: "a".repeat(64),
      package: { ...validBody, packageHash: "d".repeat(64) },
    }), context);

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-debug");
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 503 when the published article lookup dependency fails", async () => {
    findByID.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await PUT(putRequest({
      previousPackageHash: "a".repeat(64),
      package: { ...validBody, packageHash: "d".repeat(64) },
    }), context);

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("database unavailable");
    expect(refreshPublished).not.toHaveBeenCalled();
  });
});
