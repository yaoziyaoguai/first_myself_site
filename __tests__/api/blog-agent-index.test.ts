import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));
vi.mock("@/lib/blog-agent/runtime", () => ({ getBlogAgentRuntime: vi.fn() }));

import { GET, POST, PUT } from "@/app/api/blog/[identifier]/agent-index/route";
import { getPayloadAPI } from "@/lib/payload";
import { getBlogAgentRuntime } from "@/lib/blog-agent/runtime";
import { ArticlePackageValidationError } from "@/lib/blog-agent/articlePackage";
import { ArticlePackageIndexConflictError } from "@/lib/blog-agent/articleIndexRepository.postgres";

const auth = vi.fn();
const findByID = vi.fn();
const update = vi.fn();
const index = vi.fn();
const refreshPublished = vi.fn();
const getSummary = vi.fn();

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
    vi.mocked(getBlogAgentRuntime).mockReturnValue({
      indexer: { index, refreshPublished, getSummary },
    } as never);
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
