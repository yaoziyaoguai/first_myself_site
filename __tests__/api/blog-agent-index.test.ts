import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));
vi.mock("@/lib/blog-agent/runtime", () => ({ getBlogAgentRuntime: vi.fn() }));

import { GET, POST } from "@/app/api/blog/[id]/agent-index/route";
import { getPayloadAPI } from "@/lib/payload";
import { getBlogAgentRuntime } from "@/lib/blog-agent/runtime";

const auth = vi.fn();
const findByID = vi.fn();
const update = vi.fn();
const index = vi.fn();
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

const context = { params: Promise.resolve({ id: "42" }) };

describe("/api/blog/[id]/agent-index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPayloadAPI).mockResolvedValue({ auth, findByID, update } as never);
    auth.mockResolvedValue({ user: { id: 1, role: "editor" } });
    findByID.mockResolvedValue({
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
    });
    update.mockResolvedValue({});
    index.mockResolvedValue({
      packageHash: "a".repeat(64),
      chunkCount: 3,
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 1024,
      indexedAt: new Date("2026-08-23T00:00:00.000Z"),
    });
    getSummary.mockResolvedValue(null);
    vi.mocked(getBlogAgentRuntime).mockReturnValue({
      indexer: { index, getSummary },
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

  it("marks the private draft failed when indexing fails without returning provider details", async () => {
    index.mockRejectedValueOnce(new Error("provider body: secret-debug"));
    const response = await POST(request(validBody), context);

    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain("secret-debug");
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ agentIndexStatus: "failed" }),
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
});
