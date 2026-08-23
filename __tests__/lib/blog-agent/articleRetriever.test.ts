import { describe, expect, it, vi } from "vitest";
import { BlogScopedArticleRetriever } from "@/lib/blog-agent/articleRetriever";
import type { ArticleIndexRepository } from "@/lib/blog-agent/articleIndexRepository";
import { hashPublicArticle } from "@/lib/blog-agent/articlePackage";

const article = {
  id: "42",
  slug: "agent-loop",
  title: "Agent Loop",
  excerpt: "受控循环",
  contentMarkdown: "# 核心实现\n循环正文",
  agentContextRequired: true,
  agentPackageHash: "b".repeat(64),
  agentIndexStatus: "ready",
  agentIndexedPackageHash: "b".repeat(64),
};

function packageFixture() {
  return {
    blogId: "42",
    articleHash: hashPublicArticle(article),
    packageHash: "b".repeat(64),
    manifest: { version: 1 },
    embeddingModel: "qwen3.7-text-embedding",
    embeddingDimensions: 3,
    indexedAt: new Date("2026-08-23T00:00:00.000Z"),
    chunks: [
      {
        id: "article:0:0",
        sourceKind: "article" as const,
        sourcePath: "article.md",
        heading: "核心实现",
        anchor: "核心实现",
        ordinal: 0,
        content: "循环最多执行三步。",
        embedding: [0, 1, 0],
      },
      {
        id: "material:edit:0",
        sourceKind: "code" as const,
        sourcePath: "src/edit_file.py",
        heading: "精确文件编辑",
        anchor: "工具边界",
        ordinal: 1,
        content: "edit_file 在 old 出现多次时拒绝替换。",
        embedding: [1, 0, 0],
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `material:extra:${index}`,
        sourceKind: "documentation" as const,
        sourcePath: `docs/${index}.md`,
        heading: `补充 ${index}`,
        anchor: "核心实现",
        ordinal: index + 2,
        content: `无关补充 ${index} ` + "x".repeat(2_900),
        embedding: [0, 0, 1],
      })),
    ],
  };
}

function fixture(embed = vi.fn(async () => [[1, 0, 0]])) {
  const getReadyPackage = vi.fn().mockResolvedValue(packageFixture());
  const repository = {
    getReadyPackage,
    getPackageSummary: vi.fn(),
    replacePackage: vi.fn(),
  } as unknown as ArticleIndexRepository;
  const retriever = new BlogScopedArticleRetriever({
    repository,
    embeddings: { embed },
    embeddingModel: "qwen3.7-text-embedding",
    embeddingDimensions: 3,
  });
  return { retriever, getReadyPackage, embed };
}

describe("BlogScopedArticleRetriever", () => {
  it("prepares only the ready package for the server-resolved current Blog", async () => {
    const { retriever, getReadyPackage, embed } = fixture();

    const prepared = await retriever.prepare(article);

    expect(prepared).not.toBeNull();
    expect(getReadyPackage).toHaveBeenCalledWith({
      blogId: "42",
      articleHash: hashPublicArticle(article),
      packageHash: "b".repeat(64),
    });
    expect(embed).not.toHaveBeenCalled();
    expect(prepared?.contextHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fuses dense and code-identifier lexical evidence within six chunks and 14k characters", async () => {
    const { retriever } = fixture();
    const prepared = await retriever.prepare(article);
    const evidence = await prepared?.buildEvidence("edit_file 为什么拒绝多处替换？");

    expect(evidence?.sections[0]).toMatchObject({
      id: "material:edit:0",
      heading: "精确文件编辑 · src/edit_file.py",
      anchor: "工具边界",
    });
    expect(evidence?.sections.length).toBeLessThanOrEqual(6);
    expect(evidence?.sections.reduce((total, section) => total + section.content.length, 0))
      .toBeLessThanOrEqual(14_000);
  });

  it("falls back to lexical ranking when query embedding is unavailable", async () => {
    const { retriever } = fixture(vi.fn().mockRejectedValue(new Error("provider down")));
    const prepared = await retriever.prepare(article);
    const evidence = await prepared?.buildEvidence("edit_file 多处替换");

    expect(evidence?.sections[0]?.id).toBe("material:edit:0");
  });

  it("prioritizes reviewed code for a natural code question when query embedding is unavailable", async () => {
    const { retriever } = fixture(vi.fn().mockRejectedValue(new Error("provider down")));
    const prepared = await retriever.prepare(article);
    const evidence = await prepared?.buildEvidence("给我看看这篇文章的关键代码，并解释它在做什么。");

    expect(evidence?.sections[0]?.id).toBe("material:edit:0");
  });

  it("changes the context cache version when the ready package hash changes", async () => {
    const first = fixture();
    const firstPrepared = await first.retriever.prepare(article);
    const secondPackage = { ...packageFixture(), packageHash: "c".repeat(64) };
    const secondRepository = {
      getReadyPackage: vi.fn().mockResolvedValue(secondPackage),
      getPackageSummary: vi.fn(),
      replacePackage: vi.fn(),
    } as unknown as ArticleIndexRepository;
    const second = new BlogScopedArticleRetriever({
      repository: secondRepository,
      embeddings: { embed: vi.fn(async () => [[1, 0, 0]]) },
      embeddingModel: "qwen3.7-text-embedding",
      embeddingDimensions: 3,
    });
    const secondPrepared = await second.prepare({
      ...article,
      agentPackageHash: "c".repeat(64),
      agentIndexedPackageHash: "c".repeat(64),
    });

    expect(secondPrepared?.contextHash).not.toBe(firstPrepared?.contextHash);
  });

  it.each([
    [{ agentContextRequired: false }],
    [{ agentIndexStatus: "pending" }],
    [{ agentIndexedPackageHash: "c".repeat(64) }],
  ])("does not load package data for an ineligible article %#", async (patch) => {
    const { retriever, getReadyPackage } = fixture();
    await expect(retriever.prepare({ ...article, ...patch })).resolves.toBeNull();
    expect(getReadyPackage).not.toHaveBeenCalled();
  });
});
