import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  analyzeAnswerCodeBlocks,
  answerFromArticle,
  BlogAgentInvalidAnswerError,
  type BlogAgentAnswerClient,
} from "../src/lib/blog-agent/answer";
import type { ArticleIndexRepository } from "../src/lib/blog-agent/articleIndexRepository";
import { PostgresArticleIndexRepository } from "../src/lib/blog-agent/articleIndexRepository.postgres";
import {
  buildArticleEvidence,
  type ArticleEvidence,
} from "../src/lib/blog-agent/articleMarkdown";
import { BlogScopedArticleRetriever } from "../src/lib/blog-agent/articleRetriever";
import { readBlogAgentConfig, type BlogAgentConfig } from "../src/lib/blog-agent/config";
import { DashScopeEmbeddingClient, type ArticleEmbeddingClient } from "../src/lib/blog-agent/embeddingClient";
import {
  BlogAgentProviderError,
  type BlogAgentProviderFailureCategory,
  DeepSeekBlogAgentClient,
} from "../src/lib/blog-agent/modelClient";
import type { BlogAgentQueryPool } from "../src/lib/blog-agent/repository.postgres";
import type { PublicMarkdownArticle } from "../src/lib/blog-agent/types";

type CanaryArguments = {
  slug: string;
  question: string;
  requirePackage: boolean;
  requireCode: boolean;
};

type CanaryArticleStore = {
  loadPublicMarkdownArticle(slug: string): Promise<Record<string, unknown> | null>;
  getReadyPackage: ArticleIndexRepository["getReadyPackage"];
  destroy(): Promise<void>;
};

type CanaryQueryPool = BlogAgentQueryPool & {
  end(): Promise<void>;
};

export class PostgresCanaryArticleStore implements CanaryArticleStore {
  private readonly articleIndex: Pick<ArticleIndexRepository, "getReadyPackage">;

  constructor(private readonly pool: CanaryQueryPool) {
    this.articleIndex = new PostgresArticleIndexRepository(pool);
  }

  async loadPublicMarkdownArticle(
    slug: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(
      `SELECT
         "id",
         "slug",
         "title",
         "excerpt",
         "content_markdown" AS "contentMarkdown",
         "agent_context_required" AS "agentContextRequired",
         "agent_package_hash" AS "agentPackageHash",
         "agent_index_status" AS "agentIndexStatus",
         "agent_indexed_package_hash" AS "agentIndexedPackageHash",
         "status",
         "visibility"
       FROM "blog"
       WHERE "slug" = $1
         AND "status" = 'published'
         AND "visibility" = 'public'
       LIMIT 1`,
      [slug],
    );
    return result.rows[0] ?? null;
  }

  async getReadyPackage(
    request: Parameters<ArticleIndexRepository["getReadyPackage"]>[0],
  ) {
    return this.articleIndex.getReadyPackage(request);
  }

  async destroy(): Promise<void> {
    await this.pool.end();
  }
}

export type BlogAgentCanaryDependencies = {
  readConfig: () => BlogAgentConfig;
  openArticleStore: () => Promise<CanaryArticleStore>;
  createClient: (config: BlogAgentConfig) => BlogAgentAnswerClient;
  createEmbeddingClient: (config: BlogAgentConfig) => ArticleEmbeddingClient;
  createQueryId: () => string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

type CanaryFailureCode =
  | "article-not-found"
  | "configuration-unavailable"
  | "code-excerpt-missing"
  | "code-evidence-missing"
  | "database-unavailable"
  | "evidence-empty"
  | "insufficient-evidence"
  | "invalid-arguments"
  | "invalid-question"
  | "invalid-slug"
  | "package-not-ready"
  | "generation-unavailable"
  | "answer-invalid"
  | "provider-authentication"
  | "provider-billing"
  | "provider-invalid-response"
  | "provider-network"
  | "provider-rate-limit"
  | "provider-request"
  | "provider-server"
  | "provider-timeout";

const PROVIDER_FAILURE_CODES: Record<
  BlogAgentProviderFailureCategory,
  CanaryFailureCode
> = {
  authentication: "provider-authentication",
  billing: "provider-billing",
  "invalid-response": "provider-invalid-response",
  network: "provider-network",
  "rate-limit": "provider-rate-limit",
  request: "provider-request",
  server: "provider-server",
  timeout: "provider-timeout",
};

class CanaryFailure extends Error {
  constructor(readonly code: CanaryFailureCode) {
    super(code);
  }
}

const defaultDependencies: BlogAgentCanaryDependencies = {
  readConfig: readBlogAgentConfig,
  openArticleStore: async () => {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new CanaryFailure("database-unavailable");
    }
    return new PostgresCanaryArticleStore(new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 3_000,
      query_timeout: 8_000,
      statement_timeout: 8_000,
      idleTimeoutMillis: 5_000,
    }));
  },
  createClient: (config) => new DeepSeekBlogAgentClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.modelTimeoutMs,
  }),
  createEmbeddingClient: (config) => new DashScopeEmbeddingClient({
    baseUrl: config.embeddingBaseUrl,
    apiKey: config.embeddingApiKey,
    model: config.embeddingModel,
    dimensions: config.embeddingDimensions,
    timeoutMs: config.embeddingTimeoutMs,
  }),
  createQueryId: randomUUID,
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

export function parseCanaryArguments(argv: string[]): CanaryArguments {
  if (argv.length < 2 || argv.length > 4) {
    throw new CanaryFailure("invalid-arguments");
  }
  const slugValues = argv.filter((value) => value.startsWith("--slug="));
  const questionValues = argv.filter((value) => value.startsWith("--question="));
  const packageFlags = argv.filter((value) => value === "--require-package");
  const codeFlags = argv.filter((value) => value === "--require-code");
  if (
    slugValues.length !== 1 ||
    questionValues.length !== 1 ||
    packageFlags.length > 1 ||
    codeFlags.length > 1 ||
    (codeFlags.length === 1 && packageFlags.length !== 1) ||
    slugValues.length + questionValues.length + packageFlags.length +
      codeFlags.length !== argv.length
  ) {
    throw new CanaryFailure("invalid-arguments");
  }
  const slug = slugValues[0].slice("--slug=".length).trim();
  const question = questionValues[0].slice("--question=".length).trim();
  if (!slug || slug.length > 128 || slug.includes("/") || slug.includes("\\")) {
    throw new CanaryFailure("invalid-slug");
  }
  if (!question || question.length > 500) {
    throw new CanaryFailure("invalid-question");
  }
  return {
    slug,
    question,
    requirePackage: packageFlags.length === 1,
    requireCode: codeFlags.length === 1,
  };
}

function comparableCodeLine(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function hasCitedCodeEvidence(
  blocks: string[],
  evidence: ArticleEvidence,
  citationIds: string[],
): boolean {
  const citedIds = new Set(citationIds);
  return evidence.sections.some((section) => {
    if (section.sourceKind !== "code" || !citedIds.has(section.id)) return false;
    const contentLines = new Set(
      section.content.split(/\r?\n/).map(comparableCodeLine),
    );
    return blocks.some((block) => {
      const matchedLines = new Set(
        block
          .split(/\r?\n/)
          .map(comparableCodeLine)
          .filter((line) =>
            line.length >= 12 &&
            /[\p{L}\p{N}_]/u.test(line) &&
            contentLines.has(line)
          ),
      );
      return [...matchedLines].reduce((total, line) => total + line.length, 0) >= 24;
    });
  });
}

function publicArticle(
  raw: Record<string, unknown>,
  slug: string,
): PublicMarkdownArticle | null {
  if (
    (typeof raw.id !== "number" && typeof raw.id !== "string") ||
    raw.status !== "published" ||
    raw.visibility !== "public" ||
    typeof raw.slug !== "string" ||
    raw.slug !== slug ||
    typeof raw.title !== "string" ||
    typeof raw.contentMarkdown !== "string" ||
    !raw.contentMarkdown.trim()
  ) {
    return null;
  }
  return {
    id: String(raw.id),
    slug: raw.slug,
    title: raw.title,
    excerpt: typeof raw.excerpt === "string" ? raw.excerpt : "",
    contentMarkdown: raw.contentMarkdown,
    agentContextRequired: raw.agentContextRequired === true,
    agentPackageHash: typeof raw.agentPackageHash === "string"
      ? raw.agentPackageHash
      : undefined,
    agentIndexStatus: typeof raw.agentIndexStatus === "string"
      ? raw.agentIndexStatus
      : undefined,
    agentIndexedPackageHash: typeof raw.agentIndexedPackageHash === "string"
      ? raw.agentIndexedPackageHash
      : undefined,
  };
}

async function runBlogAgentCanary(
  argv: string[],
  dependencies: BlogAgentCanaryDependencies,
): Promise<void> {
  const args = parseCanaryArguments(argv);
  let config: BlogAgentConfig;
  try {
    config = dependencies.readConfig();
  } catch {
    throw new CanaryFailure("configuration-unavailable");
  }
  if (!config.generationConfigured) {
    throw new CanaryFailure("configuration-unavailable");
  }

  let articleStore: CanaryArticleStore | undefined;
  try {
    try {
      articleStore = await dependencies.openArticleStore();
    } catch {
      throw new CanaryFailure("database-unavailable");
    }
    let rawArticle: Record<string, unknown> | null;
    try {
      rawArticle = await articleStore.loadPublicMarkdownArticle(args.slug);
    } catch {
      throw new CanaryFailure("database-unavailable");
    }
    if (!rawArticle || typeof rawArticle !== "object" || Array.isArray(rawArticle)) {
      throw new CanaryFailure("article-not-found");
    }
    const article = publicArticle(rawArticle, args.slug);
    if (!article) {
      throw new CanaryFailure("article-not-found");
    }

    const prepared = config.embeddingConfigured
      ? await new BlogScopedArticleRetriever({
        repository: articleStore,
        embeddings: dependencies.createEmbeddingClient(config),
        embeddingModel: config.embeddingModel,
        embeddingDimensions: config.embeddingDimensions,
      }).prepare(article)
      : null;
    if (args.requirePackage && !prepared) {
      throw new CanaryFailure("package-not-ready");
    }
    const evidence = prepared
      ? await prepared.buildEvidence(args.question)
      : buildArticleEvidence({
        title: article.title,
        excerpt: article.excerpt,
        markdown: article.contentMarkdown,
        question: args.question,
      });
    if (evidence.sections.length === 0) {
      throw new CanaryFailure("evidence-empty");
    }
    let answer;
    try {
      answer = await answerFromArticle(
        args.question,
        evidence,
        dependencies.createClient(config),
      );
    } catch (error) {
      if (error instanceof BlogAgentProviderError) {
        throw new CanaryFailure(PROVIDER_FAILURE_CODES[error.category]);
      }
      if (error instanceof BlogAgentInvalidAnswerError) {
        throw new CanaryFailure("answer-invalid");
      }
      throw new CanaryFailure("generation-unavailable");
    }
    if (answer.insufficientEvidence) {
      throw new CanaryFailure("insufficient-evidence");
    }
    const codeBlocks = analyzeAnswerCodeBlocks(answer.answer)
      .filter((block) => block.trim().length > 0);
    const codeExcerpt = codeBlocks.length > 0;
    if (args.requireCode && !codeExcerpt) {
      throw new CanaryFailure("code-excerpt-missing");
    }
    if (
      args.requireCode &&
      !hasCitedCodeEvidence(codeBlocks, evidence, answer.citationIds)
    ) {
      throw new CanaryFailure("code-evidence-missing");
    }
    dependencies.stdout(JSON.stringify({
      queryId: dependencies.createQueryId(),
      result: "answered",
      citationCount: answer.citationIds.length,
      inputTokens: answer.usage.inputTokens,
      outputTokens: answer.usage.outputTokens,
      contextMode: prepared ? "article-package" : "markdown",
      codeExcerpt,
    }));
  } finally {
    await articleStore?.destroy();
  }
}

export async function executeBlogAgentCanary(
  argv: string[],
  dependencies: BlogAgentCanaryDependencies = defaultDependencies,
): Promise<number> {
  try {
    await runBlogAgentCanary(argv, dependencies);
    return 0;
  } catch (error) {
    const failure = error instanceof CanaryFailure ? error.code : "internal";
    dependencies.stderr(`Blog Agent canary failed: ${failure}`);
    return 1;
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  void executeBlogAgentCanary(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
