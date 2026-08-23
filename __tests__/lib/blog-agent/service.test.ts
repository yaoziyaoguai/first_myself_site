import { describe, expect, it, vi } from "vitest";
import type { BlogAgentAnswerClient } from "@/lib/blog-agent/answer";
import type { BlogAgentRepository } from "@/lib/blog-agent/repository";
import { BlogAgentService } from "@/lib/blog-agent/service";
import { GenerationUsagePolicy } from "@/lib/blog-agent/usagePolicy";
import { BlogScopedArticleRetriever } from "@/lib/blog-agent/articleRetriever";
import type { ArticleIndexRepository } from "@/lib/blog-agent/articleIndexRepository";
import { hashPublicArticle } from "@/lib/blog-agent/articlePackage";

const article = {
  id: "7",
  slug: "doris-write-path",
  title: "Doris 写入实践",
  excerpt: "批量写入设计",
  contentMarkdown: "# 写入路径\n使用 batch sink 减少小批次开销。",
};

function createFixture(options?: {
  cached?: Awaited<ReturnType<BlogAgentRepository["getCachedAnswer"]>>;
  reservation?: Awaited<ReturnType<BlogAgentRepository["reserveGeneration"]>>;
  modelContent?: string;
  modelError?: Error;
  articleRetriever?: BlogScopedArticleRetriever;
}) {
  const repository: BlogAgentRepository = {
    getCachedAnswer: vi.fn().mockResolvedValue(options?.cached ?? null),
    setCachedAnswer: vi.fn().mockResolvedValue(undefined),
    reserveGeneration: vi.fn().mockResolvedValue(
      options?.reservation ?? { allowed: true },
    ),
    recordTokenUsage: vi.fn().mockResolvedValue(undefined),
  };
  const client: BlogAgentAnswerClient = {
    complete: options?.modelError
      ? vi.fn().mockRejectedValue(options.modelError)
      : vi.fn().mockResolvedValue({
          content: options?.modelContent ?? JSON.stringify({
            answer: "批量写入可以减少小批次开销。",
            citationIds: ["section:0:写入路径"],
            insufficientEvidence: false,
          }),
          inputTokens: 12,
          outputTokens: 5,
        }),
  };
  const usagePolicy = new GenerationUsagePolicy(repository, {
    windowMs: 600_000,
    perIdentityWindow: 3,
    perIdentityDaily: 20,
    globalDaily: 100,
    perIdentityConcurrency: 1,
    globalConcurrency: 3,
  }, () => new Date("2026-08-21T12:00:00.000Z"));
  const service = new BlogAgentService({
    repository,
    usagePolicy,
    client,
    modelCacheKey: "model-cache-hash",
    cacheTtlMs: 86_400_000,
    now: () => new Date("2026-08-21T12:00:00.000Z"),
    createQueryId: () => "query-1",
    articleRetriever: options?.articleRetriever,
  });
  return { service, repository, client };
}

describe("BlogAgentService", () => {
  it("answers from one article and builds server-owned citation URLs", async () => {
    const fixture = createFixture();

    const response = await fixture.service.execute({
      article,
      question: "为什么批量写入？",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(200);
    expect(response.body.citations).toEqual([
      {
        id: "section:0:写入路径",
        heading: "写入路径",
        url: "/blog/doris-write-path#写入路径",
      },
    ]);
    expect(response.body.usage).toEqual({ cached: false });
    expect(fixture.repository.recordTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 12, outputTokens: 5 }),
    );
    expect(fixture.repository.setCachedAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        modelCacheKey: "model-cache-hash",
        questionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        articleHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("returns a cache hit without reserving quota or calling the model", async () => {
    const fixture = createFixture({
      cached: {
        answer: "缓存回答",
        citationIds: ["section:0:写入路径"],
        insufficientEvidence: false,
      },
    });

    const response = await fixture.service.execute({
      article,
      question: "为什么批量写入？",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe("缓存回答");
    expect(response.body.usage).toEqual({ cached: true });
    expect(fixture.repository.reserveGeneration).not.toHaveBeenCalled();
    expect(fixture.client.complete).not.toHaveBeenCalled();
  });

  it("serves a package cache hit without calling query embeddings", async () => {
    const embed = vi.fn(async () => [[1, 0, 0]]);
    const packageArticle = {
      ...article,
      agentContextRequired: true,
      agentPackageHash: "b".repeat(64),
      agentIndexStatus: "ready",
      agentIndexedPackageHash: "b".repeat(64),
    };
    const indexRepository = {
      getReadyPackage: vi.fn().mockResolvedValue({
        blogId: article.id,
        articleHash: hashPublicArticle(packageArticle),
        packageHash: "b".repeat(64),
        manifest: { version: 1 },
        embeddingModel: "qwen3.7-text-embedding",
        embeddingDimensions: 3,
        indexedAt: new Date("2026-08-23T00:00:00.000Z"),
        chunks: [{
          id: "material:edit:0",
          sourceKind: "code",
          sourcePath: "src/edit.py",
          heading: "精确编辑",
          anchor: "写入路径",
          ordinal: 0,
          content: "old 必须唯一",
          embedding: [1, 0, 0],
        }],
      }),
      getPackageSummary: vi.fn(),
      replacePackage: vi.fn(),
    } as unknown as ArticleIndexRepository;
    const fixture = createFixture({
      cached: {
        answer: "缓存的代码回答",
        citationIds: ["material:edit:0"],
        insufficientEvidence: false,
      },
      articleRetriever: new BlogScopedArticleRetriever({
        repository: indexRepository,
        embeddings: { embed },
        embeddingModel: "qwen3.7-text-embedding",
        embeddingDimensions: 3,
      }),
    });

    const response = await fixture.service.execute({
      article: packageArticle,
      question: "edit_file 如何工作？",
      identityHash: "identity-hash",
    });

    expect(response.body.answer).toBe("缓存的代码回答");
    expect(response.body.citations).toEqual([{
      id: "material:edit:0",
      heading: "精确编辑 · src/edit.py",
      url: "/blog/doris-write-path#写入路径",
    }]);
    expect(embed).not.toHaveBeenCalled();
    expect(fixture.client.complete).not.toHaveBeenCalled();
  });

  it("returns 429 when persistent quota is denied", async () => {
    const fixture = createFixture({
      reservation: { allowed: false, reason: "window" },
    });

    const response = await fixture.service.execute({
      article,
      question: "为什么批量写入？",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(429);
    expect(response.body.usage.reason).toBe("rate-limited");
    expect(fixture.client.complete).not.toHaveBeenCalled();
  });

  it("returns a safe 200 response when the article evidence is insufficient", async () => {
    const fixture = createFixture({
      modelContent: JSON.stringify({
        answer: "",
        citationIds: [],
        insufficientEvidence: true,
      }),
    });

    const response = await fixture.service.execute({
      article,
      question: "作者的电话号码是什么？",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      answer: null,
      citations: [],
      insufficientEvidence: true,
    }));
  });

  it("fails closed without leaking provider errors or article Markdown", async () => {
    const fixture = createFixture({
      modelError: new Error("secret provider body: token=abc"),
    });

    const response = await fixture.service.execute({
      article,
      question: "为什么批量写入？",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(503);
    expect(response.body.usage.reason).toBe("provider-unavailable");
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("token=abc");
    expect(serialized).not.toContain(article.contentMarkdown);
  });
});
