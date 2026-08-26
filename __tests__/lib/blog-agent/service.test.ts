import { describe, expect, it, vi } from "vitest";
import type { BlogAgentAnswerClient } from "@/lib/blog-agent/answer";
import type { BlogAgentRepository } from "@/lib/blog-agent/repository";
import { BlogAgentService } from "@/lib/blog-agent/service";
import { GenerationUsagePolicy } from "@/lib/blog-agent/usagePolicy";
import { BlogScopedArticleRetriever } from "@/lib/blog-agent/articleRetriever";
import type { ArticleIndexRepository } from "@/lib/blog-agent/articleIndexRepository";
import { hashPublicArticle } from "@/lib/blog-agent/articlePackage";
import type { AgentQuestionRecorder } from "@/lib/blog-agent/questionLog";

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
  recorderError?: Error;
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
  const questionLog: AgentQuestionRecorder = {
    record: options?.recorderError
      ? vi.fn().mockRejectedValue(options.recorderError)
      : vi.fn().mockResolvedValue(undefined),
  };
  const service = new BlogAgentService({
    repository,
    usagePolicy,
    client,
    modelCacheKey: "model-cache-hash",
    cacheTtlMs: 86_400_000,
    now: () => new Date("2026-08-21T12:00:00.000Z"),
    createQueryId: () => "query-1",
    articleRetriever: options?.articleRetriever,
    questionLog,
  });
  return { service, repository, client, questionLog };
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
    expect(fixture.questionLog.record).toHaveBeenCalledOnce();
    expect(fixture.questionLog.record).toHaveBeenCalledWith({
      queryId: "query-1",
      articleSlug: article.slug,
      questionText: "为什么批量写入?",
      outcome: "answered",
      createdAt: new Date("2026-08-21T12:00:00.000Z"),
    });
    expect(Object.keys(vi.mocked(fixture.questionLog.record).mock.calls[0]![0]))
      .not.toContain("answer");
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

  it("isolates cache and retrieval by the bounded conversation context", async () => {
    const buildEvidence = vi.fn().mockResolvedValue({
      title: article.title,
      excerpt: article.excerpt,
      outline: [{ id: "section:0:写入路径", headingPath: ["写入路径"], anchor: "写入路径" }],
      sections: [{
        id: "section:0:写入路径",
        heading: "写入路径",
        headingPath: ["写入路径"],
        anchor: "写入路径",
        ordinal: 0,
        content: "使用 batch sink 减少小批次开销。",
      }],
      totalCharacters: 27,
    });
    const fixture = createFixture({
      articleRetriever: {
        prepare: vi.fn().mockResolvedValue({
          contextHash: "context-hash",
          sections: [],
          buildEvidence,
        }),
      } as unknown as BlogScopedArticleRetriever,
    });
    const history = [{
      question: "核心实现是什么？",
      answer: "核心使用 batch sink。",
    }];

    for (const [index, conversation] of [
      history,
      [{ question: "核心实现是什么？", answer: "另一段旧回答。" }],
      [{ question: "它解决什么问题？", answer: "核心使用 batch sink。" }],
    ].entries()) {
      await fixture.service.execute({
        article,
        question: "那为什么？",
        history: conversation,
        identityHash: `identity-hash-${index}`,
      });
    }

    expect(buildEvidence).toHaveBeenCalledWith("核心实现是什么？\n那为什么？");
    const questionHashes = vi.mocked(fixture.repository.getCachedAnswer).mock.calls
      .map(([input]) => input.questionHash);
    expect(questionHashes).toHaveLength(3);
    expect(questionHashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
    expect(new Set(questionHashes)).toHaveProperty("size", 3);
    expect(fixture.client.complete).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.stringContaining("核心使用 batch sink"),
    }));
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
    expect(fixture.questionLog.record).toHaveBeenCalledOnce();
    expect(fixture.questionLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "answered" }),
    );
  });

  it("regenerates a prose-only cached answer for a code question", async () => {
    const codeEvidence = {
      title: article.title,
      excerpt: article.excerpt,
      outline: [{
        id: "material:edit:0",
        headingPath: ["精确编辑 · src/edit.py"],
        anchor: "写入路径",
      }],
      sections: [{
        id: "material:edit:0",
        heading: "精确编辑 · src/edit.py",
        headingPath: ["精确编辑 · src/edit.py"],
        anchor: "写入路径",
        ordinal: 0,
        content: [
          "def edit_file(path, old, new):",
          "    matches = read(path).count(old)",
          "    if matches != 1:",
          "        raise ValueError(\"old must be unique\")",
          "    write(path, read(path).replace(old, new))",
          "    return path",
        ].join("\n"),
        protectedMaterial: true,
        sourceKind: "code" as const,
        sourcePath: "src/edit.py",
        sourceRepository: "https://github.com/yaoziyaoguai/doris-lab",
        sourceCommit: "c".repeat(40),
        sourceLineStart: 41,
        sourceLineEnd: 46,
      }],
      totalCharacters: 180,
    };
    const fixture = createFixture({
      cached: {
        answer: "缓存只解释了流程，没有代码。",
        citationIds: ["material:edit:0"],
        insufficientEvidence: false,
      },
      modelContent: JSON.stringify({
        answer: "精确编辑要求 old 唯一。",
        citationIds: ["material:edit:0"],
        insufficientEvidence: false,
      }),
      articleRetriever: {
        prepare: vi.fn().mockResolvedValue({
          contextHash: "code-context-hash",
          sections: codeEvidence.sections,
          buildEvidence: vi.fn().mockResolvedValue(codeEvidence),
        }),
      } as unknown as BlogScopedArticleRetriever,
    });

    const response = await fixture.service.execute({
      article,
      question: "给出 edit_file 的代码",
      identityHash: "identity-hash",
    });

    expect(fixture.client.complete).toHaveBeenCalledOnce();
    expect(response.body.answer).toContain("```\n");
    expect(response.body.answer).toContain("def edit_file");
    expect(response.body.citations).toEqual([{
      id: "material:edit:0",
      heading: "精确编辑 · src/edit.py",
      url: "/blog/doris-write-path#写入路径",
      github: {
        repository: "https://github.com/yaoziyaoguai/doris-lab",
        commit: "c".repeat(40),
        path: "src/edit.py",
        lineStart: 41,
        lineEnd: 46,
        url: `https://github.com/yaoziyaoguai/doris-lab/blob/${"c".repeat(40)}/src/edit.py#L41-L46`,
      },
    }]);
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
    expect(fixture.questionLog.record).toHaveBeenCalledOnce();
    expect(fixture.questionLog.record).toHaveBeenCalledWith({
      queryId: "query-1",
      articleSlug: article.slug,
      questionText: "为什么批量写入?",
      outcome: "rate_limited",
      createdAt: new Date("2026-08-21T12:00:00.000Z"),
    });
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
    expect(fixture.questionLog.record).toHaveBeenCalledOnce();
    expect(fixture.questionLog.record).toHaveBeenCalledWith({
      queryId: "query-1",
      articleSlug: article.slug,
      questionText: "作者的电话号码是什么?",
      outcome: "insufficient_evidence",
      createdAt: new Date("2026-08-21T12:00:00.000Z"),
    });
  });

  it("records every accepted question once and redacts sensitive text", async () => {
    const insufficient = createFixture({
      cached: { answer: "", citationIds: [], insufficientEvidence: true },
    });
    const cachedSuccess = createFixture({
      cached: {
        answer: "缓存回答",
        citationIds: ["section:0:写入路径"],
        insufficientEvidence: false,
      },
    });
    const generatedSuccess = createFixture();

    await insufficient.service.execute({
      article,
      question: "联系邮箱是 test@example.com 吗?",
      identityHash: "identity-insufficient",
    });
    await cachedSuccess.service.execute({
      article,
      question: "为什么批量写入?",
      identityHash: "identity-cache",
    });
    await generatedSuccess.service.execute({
      article,
      question: "为什么批量写入?",
      identityHash: "identity-generated",
    });

    expect(insufficient.questionLog.record).toHaveBeenCalledOnce();
    expect(insufficient.questionLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        questionText: "联系邮箱是 [邮箱已脱敏] 吗?",
        outcome: "insufficient_evidence",
      }),
    );
    expect(cachedSuccess.questionLog.record).toHaveBeenCalledOnce();
    expect(cachedSuccess.questionLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "answered" }),
    );
    expect(generatedSuccess.questionLog.record).toHaveBeenCalledOnce();
    expect(generatedSuccess.questionLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "answered" }),
    );
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
    expect(fixture.questionLog.record).toHaveBeenCalledOnce();
    expect(fixture.questionLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "provider_error" }),
    );
  });

  it("does not change the public answer when question logging fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fixture = createFixture({
      modelContent: JSON.stringify({
        answer: "",
        citationIds: [],
        insufficientEvidence: true,
      }),
      recorderError: new Error("telemetry unavailable"),
    });

    const response = await fixture.service.execute({
      article,
      question: "作者住在哪里?",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(200);
    expect(response.body.insufficientEvidence).toBe(true);
    expect(response.body.answer).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "[blog-agent] question-log-write-failed",
      { queryId: "query-1", articleSlug: article.slug },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("作者住在哪里");
    consoleError.mockRestore();
  });

  it("fails closed when an article requires a package that cannot be prepared", async () => {
    const prepare = vi.fn().mockResolvedValue(null);
    const fixture = createFixture({
      articleRetriever: { prepare } as unknown as BlogScopedArticleRetriever,
    });
    const packageArticle = {
      ...article,
      agentContextRequired: true,
      agentPackageHash: "b".repeat(64),
      agentIndexStatus: "ready",
      agentIndexedPackageHash: "b".repeat(64),
    };

    const response = await fixture.service.execute({
      article: packageArticle,
      question: "代码守卫如何工作？",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(503);
    expect(response.body.usage.reason).toBe("provider-unavailable");
    expect(fixture.client.complete).not.toHaveBeenCalled();
    expect(fixture.repository.reserveGeneration).not.toHaveBeenCalled();
    expect(fixture.questionLog.record).toHaveBeenCalledOnce();
    expect(fixture.questionLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "provider_error" }),
    );
  });

  it("returns a completed answer when only the cache write fails", async () => {
    const fixture = createFixture();
    vi.mocked(fixture.repository.setCachedAnswer).mockRejectedValue(
      new Error("cache unavailable"),
    );

    const response = await fixture.service.execute({
      article,
      question: "为什么批量写入？",
      identityHash: "identity-hash",
    });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe("批量写入可以减少小批次开销。");
    expect(response.body.usage).toEqual({ cached: false });
  });
});
