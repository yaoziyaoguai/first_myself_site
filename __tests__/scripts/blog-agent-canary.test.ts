import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { BlogAgentAnswerClient } from "@/lib/blog-agent/answer";
import { hashPublicArticle } from "@/lib/blog-agent/articlePackage";
import type { BlogAgentConfig } from "@/lib/blog-agent/config";
import type { ReadyArticlePackage } from "@/lib/blog-agent/articleIndexRepository";
import {
  BlogAgentProviderError,
  type BlogAgentProviderFailureCategory,
} from "@/lib/blog-agent/modelClient";
import {
  executeBlogAgentCanary,
  parseCanaryArguments,
  PostgresCanaryArticleStore,
  type BlogAgentCanaryDependencies,
} from "../../scripts/blog-agent-canary";

const config: BlogAgentConfig = {
  enabled: false,
  generationEnabled: false,
  generationConfigured: true,
  baseUrl: "https://api.deepseek.example",
  apiKey: "super-secret-api-key",
  model: "deepseek-chat",
  modelTimeoutMs: 15_000,
  cacheTtlMs: 86_400_000,
  perIdentityWindow: 3,
  windowMs: 600_000,
  perIdentityDaily: 20,
  globalDaily: 100,
  perIdentityConcurrency: 1,
  globalConcurrency: 3,
  embeddingConfigured: true,
  embeddingBaseUrl: "https://dashscope.example/v1",
  embeddingApiKey: "embedding-secret-api-key",
  embeddingModel: "qwen3.7-text-embedding",
  embeddingDimensions: 1024,
  embeddingTimeoutMs: 15_000,
};

function createDependencies(options?: {
  article?: Record<string, unknown>;
  client?: BlogAgentAnswerClient;
  articlePackage?: ReadyArticlePackage | null;
  readConfig?: () => BlogAgentConfig;
  openArticleStore?: BlogAgentCanaryDependencies["openArticleStore"];
}) {
  const loadPublicMarkdownArticle = vi.fn().mockResolvedValue(
    options?.article ?? {
      id: 7,
      slug: "doris-write-path",
      title: "Doris 写入实践",
      excerpt: "批量写入设计",
      contentMarkdown: "# 写入路径\nPRIVATE_MARKDOWN_SENTINEL 使用 batch sink。",
      status: "published",
      visibility: "public",
    },
  );
  const destroy = vi.fn().mockResolvedValue(undefined);
  const getReadyPackage = vi.fn().mockResolvedValue(options?.articlePackage ?? null);
  const client = options?.client ?? {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        answer: "批量写入减少小批次开销。",
        citationIds: ["section:0:写入路径"],
        insufficientEvidence: false,
      }),
      inputTokens: 13,
      outputTokens: 6,
    }),
  };
  const stdout = vi.fn();
  const stderr = vi.fn();
  const dependencies: BlogAgentCanaryDependencies = {
    readConfig: options?.readConfig ?? (() => config),
    openArticleStore: options?.openArticleStore ?? vi.fn().mockResolvedValue({
      loadPublicMarkdownArticle,
      getReadyPackage,
      destroy,
    }),
    createClient: () => client,
    createEmbeddingClient: () => ({
      embed: vi.fn().mockResolvedValue([Array.from({ length: 1024 }, () => 0.01)]),
    }),
    createQueryId: () => "query-canary-1",
    stdout,
    stderr,
  };
  return {
    dependencies,
    loadPublicMarkdownArticle,
    destroy,
    client,
    getReadyPackage,
    stdout,
    stderr,
  };
}

function packagedArticle() {
  return {
    id: "7",
    slug: "agent-loop",
    title: "Agent Loop",
    excerpt: "受控循环",
    contentMarkdown: "# 授权边界\n正文没有 executable drift 的细节。",
    status: "published",
    visibility: "public",
    agentContextRequired: true,
    agentPackageHash: "b".repeat(64),
    agentIndexStatus: "ready",
    agentIndexedPackageHash: "b".repeat(64),
  };
}

function codePackage(article = packagedArticle()): ReadyArticlePackage {
  return {
    blogId: article.id,
    articleHash: hashPublicArticle(article),
    packageHash: article.agentPackageHash,
    manifest: {},
    embeddingModel: config.embeddingModel,
    embeddingDimensions: config.embeddingDimensions,
    indexedAt: new Date("2026-08-23T00:00:00Z"),
    chunks: [
      {
        id: "article:0:0",
        sourceKind: "article",
        sourcePath: "article.md",
        heading: "授权边界",
        anchor: "授权边界",
        ordinal: 0,
        content: "正文只说明执行前需要重新验证。",
        embedding: Array.from({ length: 1024 }, () => 0.01),
      },
      {
        id: "material:authority:0",
        sourceKind: "code",
        sourcePath: "agent/process/tools.py",
        heading: "执行身份重验",
        anchor: "授权边界",
        ordinal: 1,
        content: [
          "def revalidate_executable(current_identity, approved_identity):",
          "if current_identity != approved_identity:",
          "    return KnownNotExecuted(code=\"executable_identity_changed\")",
          "return Approved()",
        ].join("\n"),
        embedding: Array.from({ length: 1024 }, () => 0.01),
      },
    ],
  };
}

describe("Blog Agent canary", () => {
  it("uses a parameterized read-only query for the one public article", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const end = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn().mockRejectedValue(new Error("unused"));
    const store = new PostgresCanaryArticleStore({ query, connect, end });

    await expect(store.loadPublicMarkdownArticle("doris-write-path"))
      .resolves.toBeNull();

    const [statement, parameters] = query.mock.calls[0];
    expect(statement).toContain('FROM "blog"');
    expect(statement).toContain('"status" = \'published\'');
    expect(statement).toContain('"visibility" = \'public\'');
    expect(statement).toContain('"slug" = $1');
    expect(statement).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
    expect(parameters).toEqual(["doris-write-path"]);

    await store.destroy();
    expect(end).toHaveBeenCalledOnce();
  });

  it("runs through the repository CommonJS-compatible tsx entrypoint", () => {
    const result = spawnSync(
      process.execPath,
      [
        resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs"),
        resolve(process.cwd(), "scripts/blog-agent-canary.ts"),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Blog Agent canary failed");
    expect(result.stderr).not.toContain("Top-level await");
    expect(result.stderr).not.toContain("Transform failed");
  });

  it.each([
    { argv: [] },
    { argv: ["--slug=doris-write-path"] },
    { argv: ["--question=为什么"] },
    { argv: ["--slug=a", "--slug=b", "--question=q"] },
    { argv: ["--slug=a", "--question=q", "--extra=x"] },
    { argv: ["--slug=a", "--question=q", "--require-code"] },
  ])("requires exactly one explicit slug and question %#", ({ argv }) => {
    expect(() => parseCanaryArguments(argv)).toThrow();
  });

  it("accepts a single explicit package canary flag", () => {
    expect(parseCanaryArguments([
      "--slug=agent-loop",
      "--question=为什么不能复用批准？",
      "--require-package",
    ])).toEqual({
      slug: "agent-loop",
      question: "为什么不能复用批准？",
      requirePackage: true,
      requireCode: false,
    });
  });

  it("accepts package and code gates together", () => {
    expect(parseCanaryArguments([
      "--slug=agent-loop",
      "--question=给出最小代码片段",
      "--require-package",
      "--require-code",
    ])).toEqual({
      slug: "agent-loop",
      question: "给出最小代码片段",
      requirePackage: true,
      requireCode: true,
    });
  });

  it("loads one public article and prints only a redacted result summary", async () => {
    const fixture = createDependencies();
    const code = await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么批量写入？"],
      fixture.dependencies,
    );

    expect(code).toBe(0);
    expect(fixture.loadPublicMarkdownArticle).toHaveBeenCalledOnce();
    expect(fixture.loadPublicMarkdownArticle).toHaveBeenCalledWith(
      "doris-write-path",
    );
    expect(fixture.destroy).toHaveBeenCalledOnce();
    const output = fixture.stdout.mock.calls.flat().join("\n");
    expect(output).toContain('"queryId":"query-canary-1"');
    expect(output).toContain('"result":"answered"');
    expect(output).toContain('"inputTokens":13');
    expect(output).toContain('"outputTokens":6');
    expect(output).not.toContain("PRIVATE_MARKDOWN_SENTINEL");
    expect(output).not.toContain(config.apiKey);
    expect(output).not.toContain("为什么批量写入");
    expect(output).not.toContain("DATABASE_URL");
    expect(output).toContain('"contextMode":"markdown"');
    expect(output).toContain('"codeExcerpt":false');
  });

  it("requires a fenced code excerpt without printing the excerpt", async () => {
    const article = packagedArticle();
    const fixture = createDependencies({
      article,
      articlePackage: codePackage(article),
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            answer: [
              "执行前重验身份：",
              "```python",
              "if current_identity != approved_identity:",
              "    return KnownNotExecuted(code=\"executable_identity_changed\")",
              "```",
            ].join("\n"),
            citationIds: ["material:authority:0"],
            insufficientEvidence: false,
          }),
          inputTokens: 18,
          outputTokens: 22,
        }),
      },
    });

    const code = await executeBlogAgentCanary([
      "--slug=agent-loop",
      "--question=给出最小代码片段",
      "--require-package",
      "--require-code",
    ], fixture.dependencies);

    expect(code).toBe(0);
    const output = fixture.stdout.mock.calls.flat().join("\n");
    expect(output).toContain('"codeExcerpt":true');
    expect(output).not.toContain("KnownNotExecuted");
  });

  it("accepts CommonMark code syntax through the shared answer analyzer", async () => {
    const article = packagedArticle();
    const fixture = createDependencies({
      article,
      articlePackage: codePackage(article),
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            answer: [
              "~~~python",
              "if current_identity != approved_identity:",
              "    return KnownNotExecuted(code=\"executable_identity_changed\")",
              "~~~",
            ].join("\n"),
            citationIds: ["material:authority:0"],
            insufficientEvidence: false,
          }),
          inputTokens: 18,
          outputTokens: 22,
        }),
      },
    });

    const code = await executeBlogAgentCanary([
      "--slug=agent-loop",
      "--question=给出最小代码片段",
      "--require-package",
      "--require-code",
    ], fixture.dependencies);

    expect(code).toBe(0);
    expect(JSON.parse(fixture.stdout.mock.calls[0][0])).toMatchObject({
      result: "answered",
      codeExcerpt: true,
    });
  });

  it("fails the code gate when the answer contains no fenced code", async () => {
    const article = packagedArticle();
    const fixture = createDependencies({
      article,
      articlePackage: codePackage(article),
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            answer: "执行前会重新比较批准身份与当前身份。",
            citationIds: ["material:authority:0"],
            insufficientEvidence: false,
          }),
          inputTokens: 10,
          outputTokens: 8,
        }),
      },
    });

    const code = await executeBlogAgentCanary([
      "--slug=agent-loop",
      "--question=给出最小代码片段",
      "--require-package",
      "--require-code",
    ], fixture.dependencies);

    expect(code).toBe(1);
    expect(fixture.stdout).not.toHaveBeenCalled();
    expect(fixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: code-excerpt-missing"],
    ]);
  });

  it("proves a ready current-article package was used when required", async () => {
    const article = packagedArticle();
    const articlePackage = codePackage(article);
    const fixture = createDependencies({
      article,
      articlePackage,
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            answer: "批准与 command fingerprint 精确绑定。",
            citationIds: ["material:authority:0"],
            insufficientEvidence: false,
          }),
          inputTokens: 9,
          outputTokens: 4,
        }),
      },
    });

    const code = await executeBlogAgentCanary([
      "--slug=agent-loop",
      "--question=为什么不能复用批准？",
      "--require-package",
    ], fixture.dependencies);

    expect(code).toBe(0);
    expect(fixture.getReadyPackage).toHaveBeenCalledWith({
      blogId: "7",
      articleHash: articlePackage.articleHash,
      packageHash: articlePackage.packageHash,
    });
    expect(fixture.stdout.mock.calls.flat().join("\n"))
      .toContain('"contextMode":"article-package"');
  });

  it("requires combined package and code gates to cite matching code evidence", async () => {
    const article = packagedArticle();
    const articlePackage = codePackage(article);
    const fixture = createDependencies({
      article,
      articlePackage,
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            answer: [
              "执行前重新比较身份：",
              "```python",
              "if current_identity != approved_identity:",
              "    return KnownNotExecuted(code=\"executable_identity_changed\")",
              "```",
            ].join("\n"),
            citationIds: ["material:authority:0"],
            insufficientEvidence: false,
          }),
          inputTokens: 20,
          outputTokens: 30,
        }),
      },
    });

    const code = await executeBlogAgentCanary([
      "--slug=agent-loop",
      "--question=给出执行身份重验的最小代码片段",
      "--require-package",
      "--require-code",
    ], fixture.dependencies);

    expect(code).toBe(0);
    expect(JSON.parse(fixture.stdout.mock.calls[0][0])).toMatchObject({
      contextMode: "article-package",
      codeExcerpt: true,
    });
  });

  it.each([
    {
      label: "article-only citation",
      answer: "```python\nif current_identity != approved_identity:\n    return KnownNotExecuted()\n```",
      citationIds: ["article:0:0"],
    },
    {
      label: "unrelated code",
      answer: "```python\nprint(\"unrelated hallucination\")\n```",
      citationIds: ["material:authority:0"],
    },
    {
      label: "trivial fence",
      answer: "```text\n.\n```",
      citationIds: ["material:authority:0"],
    },
  ])("rejects $label under the combined code gate", async ({ answer, citationIds }) => {
    const article = packagedArticle();
    const fixture = createDependencies({
      article,
      articlePackage: codePackage(article),
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            answer,
            citationIds,
            insufficientEvidence: false,
          }),
          inputTokens: 10,
          outputTokens: 10,
        }),
      },
    });

    const code = await executeBlogAgentCanary([
      "--slug=agent-loop",
      "--question=给出执行身份重验的最小代码片段",
      "--require-package",
      "--require-code",
    ], fixture.dependencies);

    expect(code).toBe(1);
    expect(fixture.stdout).not.toHaveBeenCalled();
    expect(fixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: code-evidence-missing"],
    ]);
  });

  it("fails a required package canary instead of silently using Markdown", async () => {
    const fixture = createDependencies();
    const code = await executeBlogAgentCanary([
      "--slug=doris-write-path",
      "--question=为什么？",
      "--require-package",
    ], fixture.dependencies);

    expect(code).toBe(1);
    expect(fixture.client.complete).not.toHaveBeenCalled();
    expect(fixture.stdout).not.toHaveBeenCalled();
    expect(fixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: package-not-ready"],
    ]);
  });

  it.each([
    [{ status: "draft", visibility: "public", contentMarkdown: "# x\ny" }, "draft"],
    [{ status: "published", visibility: "private", contentMarkdown: "# x\ny" }, "private"],
    [{ status: "published", visibility: "public", contentMarkdown: "  " }, "RichText-only"],
  ])("refuses %s articles without invoking the model", async (override) => {
    const fixture = createDependencies({
      article: {
        id: 7,
        slug: "doris-write-path",
        title: "Doris 写入实践",
        excerpt: "",
        ...override,
      },
    });
    const code = await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      fixture.dependencies,
    );

    expect(code).toBe(1);
    expect(fixture.client.complete).not.toHaveBeenCalled();
    expect(fixture.destroy).toHaveBeenCalledOnce();
  });

  it("redacts provider failures and treats insufficient evidence as failure", async () => {
    const providerFixture = createDependencies({
      client: {
        complete: vi.fn().mockRejectedValue(
          new Error("raw provider body DATABASE_URL=secret api-key=secret"),
        ),
      },
    });
    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      providerFixture.dependencies,
    )).toBe(1);
    const errors = providerFixture.stderr.mock.calls.flat().join("\n");
    expect(errors).toBe("Blog Agent canary failed: generation-unavailable");
    expect(errors).not.toContain("provider body");

    const insufficientFixture = createDependencies({
      client: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({ answer: "", citationIds: [], insufficientEvidence: true }),
          inputTokens: 3,
          outputTokens: 1,
        }),
      },
    });
    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=未知信息？"],
      insufficientFixture.dependencies,
    )).toBe(1);
    expect(insufficientFixture.stdout).not.toHaveBeenCalled();
    expect(insufficientFixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: insufficient-evidence"],
    ]);
  });

  it("classifies configuration failures without leaking their message", async () => {
    const fixture = createDependencies({
      readConfig: () => {
        throw new Error("raw config secret=do-not-print");
      },
    });

    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      fixture.dependencies,
    )).toBe(1);
    expect(fixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: configuration-unavailable"],
    ]);
  });

  it("classifies database failures without leaking connection details", async () => {
    const fixture = createDependencies({
      openArticleStore: vi.fn().mockRejectedValue(
        new Error("postgres://private-user:private-password@private-host"),
      ),
    });

    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      fixture.dependencies,
    )).toBe(1);
    expect(fixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: database-unavailable"],
    ]);
  });

  it("uses one redacted fallback code for unexpected failures", async () => {
    const fixture = createDependencies();
    fixture.dependencies.createEmbeddingClient = () => {
      throw new Error("unexpected internal secret=do-not-print");
    };

    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      fixture.dependencies,
    )).toBe(1);
    expect(fixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: internal"],
    ]);
  });

  it.each([
    ["authentication", "provider-authentication"],
    ["billing", "provider-billing"],
    ["invalid-response", "provider-invalid-response"],
    ["network", "provider-network"],
    ["rate-limit", "provider-rate-limit"],
    ["request", "provider-request"],
    ["server", "provider-server"],
    ["timeout", "provider-timeout"],
  ] satisfies ReadonlyArray<[BlogAgentProviderFailureCategory, string]>)(
    "reports only the safe %s provider category",
    async (category, code) => {
      const fixture = createDependencies({
        client: {
          complete: vi.fn().mockRejectedValue(
            new BlogAgentProviderError(category),
          ),
        },
      });

      expect(await executeBlogAgentCanary(
        ["--slug=doris-write-path", "--question=为什么？"],
        fixture.dependencies,
      )).toBe(1);
      expect(fixture.stderr.mock.calls).toEqual([
        [`Blog Agent canary failed: ${code}`],
      ]);
      expect(fixture.stdout).not.toHaveBeenCalled();
    },
  );

  it("distinguishes an invalid grounded answer from provider failure", async () => {
    const fixture = createDependencies({
      client: {
        complete: vi.fn().mockResolvedValue({
          content: "{}",
          inputTokens: 3,
          outputTokens: 1,
        }),
      },
    });

    expect(await executeBlogAgentCanary(
      ["--slug=doris-write-path", "--question=为什么？"],
      fixture.dependencies,
    )).toBe(1);
    expect(fixture.stderr.mock.calls).toEqual([
      ["Blog Agent canary failed: answer-invalid"],
    ]);
  });
});
