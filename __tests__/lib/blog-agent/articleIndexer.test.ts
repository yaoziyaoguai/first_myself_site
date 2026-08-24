import { describe, expect, it, vi } from "vitest";
import { ArticleIndexer } from "@/lib/blog-agent/articleIndexer";
import type { ArticleIndexRepository } from "@/lib/blog-agent/articleIndexRepository";

const replacePackage = vi.fn();
const replacePublishedPackage = vi.fn();
const repository = {
  replacePackage,
  replacePublishedPackage,
  getReadyPackage: vi.fn(),
  getPackageSummary: vi.fn(),
} as unknown as ArticleIndexRepository;

const payload = {
  version: 1,
  packageHash: "9890d9f085d9ce2937001634303819f2336cefb28717463592bc3313b95b635e",
  sourceCommit: "a".repeat(40),
  mainSha256: "da1a7634bf82fdcd88624385c313a9496a2b43f469ec545693d6199c03989c2f",
  manifestPath: "docs/agent-loop.agent.json",
  sources: [{
    path: "src/loop.py",
    kind: "code",
    label: "Agent 主循环",
    sectionAnchor: "top",
    sha256: "08a01a1cf8ff85e271bbdfa903feebc565b8c2546c2e49d77b817e73dfc1999a",
    content: "while step < 3:\n    step += 1",
  }],
  excluded: [],
  canaryQuestion: "主循环如何限制步数？",
};

describe("ArticleIndexer", () => {
  it("embeds the validated snapshot and persists ready metadata only after all vectors exist", async () => {
    replacePackage.mockReset().mockResolvedValue(undefined);
    const embed = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const indexer = new ArticleIndexer({
      repository,
      embeddings: { embed },
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 3,
      now: () => new Date("2026-08-23T00:00:00.000Z"),
    });

    const summary = await indexer.index({
      article: {
        id: "42",
        slug: "agent-loop",
        title: "Agent Loop",
        excerpt: "一个受控循环",
        contentMarkdown: "主要内容",
      },
      packagePayload: payload,
    });

    expect(embed).toHaveBeenCalledOnce();
    expect(replacePackage).toHaveBeenCalledOnce();
    expect(replacePackage).toHaveBeenCalledWith(expect.objectContaining({
      blogId: "42",
      packageHash: payload.packageHash,
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 3,
      indexedAt: new Date("2026-08-23T00:00:00.000Z"),
    }));
    expect(summary).toEqual(expect.objectContaining({
      packageHash: payload.packageHash,
      chunkCount: expect.any(Number),
    }));
  });

  it("does not persist when the provider returns the wrong number of vectors", async () => {
    replacePackage.mockReset();
    const indexer = new ArticleIndexer({
      repository,
      embeddings: { embed: vi.fn(async () => []) },
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 3,
    });

    await expect(indexer.index({
      article: {
        id: "42",
        slug: "agent-loop",
        title: "Agent Loop",
        excerpt: "一个受控循环",
        contentMarkdown: "主要内容",
      },
      packagePayload: payload,
    })).rejects.toThrow("embedding count");
    expect(replacePackage).not.toHaveBeenCalled();
  });

  it("refreshes a published package through the repository's atomic swap", async () => {
    replacePublishedPackage.mockReset().mockResolvedValue(undefined);
    const embed = vi.fn(async (texts: string[]) => texts.map(() => [1, 0, 0]));
    const indexer = new ArticleIndexer({
      repository,
      embeddings: { embed },
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 3,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });
    const article = {
      id: "42",
      slug: "agent-loop",
      title: "Agent Loop",
      excerpt: "一个受控循环",
      contentMarkdown: "主要内容",
    };

    const summary = await indexer.refreshPublished({
      article,
      previousPackageHash: "f".repeat(64),
      packagePayload: payload,
    });

    expect(replacePublishedPackage).toHaveBeenCalledWith(expect.objectContaining({
      article,
      previousPackageHash: "f".repeat(64),
      packageHash: payload.packageHash,
      indexedAt: new Date("2026-08-24T00:00:00.000Z"),
    }));
    expect(summary).toEqual(expect.objectContaining({
      packageHash: payload.packageHash,
      chunkCount: expect.any(Number),
    }));
  });
});
