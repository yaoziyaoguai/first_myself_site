import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { answerFromArticle, type BlogAgentAnswerClient } from "../src/lib/blog-agent/answer";
import { buildArticleEvidence } from "../src/lib/blog-agent/articleMarkdown";
import { readBlogAgentConfig, type BlogAgentConfig } from "../src/lib/blog-agent/config";
import { OpenAICompatibleBlogAgentClient } from "../src/lib/blog-agent/modelClient";

type CanaryArguments = { slug: string; question: string };

type CanaryArticleStore = {
  loadPublicMarkdownArticle(slug: string): Promise<Record<string, unknown> | null>;
  destroy(): Promise<void>;
};

type CanaryQueryPool = {
  query(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
};

export class PostgresCanaryArticleStore implements CanaryArticleStore {
  constructor(private readonly pool: CanaryQueryPool) {}

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

  async destroy(): Promise<void> {
    await this.pool.end();
  }
}

export type BlogAgentCanaryDependencies = {
  readConfig: () => BlogAgentConfig;
  openArticleStore: () => Promise<CanaryArticleStore>;
  createClient: (config: BlogAgentConfig) => BlogAgentAnswerClient;
  createQueryId: () => string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

class CanaryFailure extends Error {}

const defaultDependencies: BlogAgentCanaryDependencies = {
  readConfig: readBlogAgentConfig,
  openArticleStore: async () => {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new CanaryFailure("DATABASE_URL is required");
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
  createClient: (config) => new OpenAICompatibleBlogAgentClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.modelTimeoutMs,
  }),
  createQueryId: randomUUID,
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

export function parseCanaryArguments(argv: string[]): CanaryArguments {
  if (argv.length !== 2) throw new CanaryFailure("Invalid canary arguments");
  const slugValues = argv.filter((value) => value.startsWith("--slug="));
  const questionValues = argv.filter((value) => value.startsWith("--question="));
  if (slugValues.length !== 1 || questionValues.length !== 1) {
    throw new CanaryFailure("Invalid canary arguments");
  }
  const slug = slugValues[0].slice("--slug=".length).trim();
  const question = questionValues[0].slice("--question=".length).trim();
  if (!slug || slug.length > 128 || slug.includes("/") || slug.includes("\\")) {
    throw new CanaryFailure("Invalid canary slug");
  }
  if (!question || question.length > 500) {
    throw new CanaryFailure("Invalid canary question");
  }
  return { slug, question };
}

async function runBlogAgentCanary(
  argv: string[],
  dependencies: BlogAgentCanaryDependencies,
): Promise<void> {
  const args = parseCanaryArguments(argv);
  const config = dependencies.readConfig();
  if (!config.generationConfigured) {
    throw new CanaryFailure("Blog Agent provider is not configured");
  }

  let articleStore: CanaryArticleStore | undefined;
  try {
    articleStore = await dependencies.openArticleStore();
    const rawArticle = await articleStore.loadPublicMarkdownArticle(args.slug);
    if (!rawArticle || typeof rawArticle !== "object" || Array.isArray(rawArticle)) {
      throw new CanaryFailure("Public Markdown article not found");
    }
    const article = rawArticle as Record<string, unknown>;
    if (
      article.status !== "published" ||
      article.visibility !== "public" ||
      typeof article.slug !== "string" ||
      article.slug !== args.slug ||
      typeof article.title !== "string" ||
      typeof article.contentMarkdown !== "string" ||
      !article.contentMarkdown.trim()
    ) {
      throw new CanaryFailure("Public Markdown article not found");
    }

    const evidence = buildArticleEvidence({
      title: article.title,
      excerpt: typeof article.excerpt === "string" ? article.excerpt : "",
      markdown: article.contentMarkdown,
      question: args.question,
    });
    if (evidence.sections.length === 0) {
      throw new CanaryFailure("Article has no usable evidence");
    }
    const answer = await answerFromArticle(
      args.question,
      evidence,
      dependencies.createClient(config),
    );
    if (answer.insufficientEvidence) {
      throw new CanaryFailure("Canary evidence was insufficient");
    }
    dependencies.stdout(JSON.stringify({
      queryId: dependencies.createQueryId(),
      result: "answered",
      citationCount: answer.citationIds.length,
      inputTokens: answer.usage.inputTokens,
      outputTokens: answer.usage.outputTokens,
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
  } catch {
    dependencies.stderr("Blog Agent canary failed");
    return 1;
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  void executeBlogAgentCanary(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
