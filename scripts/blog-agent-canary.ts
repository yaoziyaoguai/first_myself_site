import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { answerFromArticle, type BlogAgentAnswerClient } from "../src/lib/blog-agent/answer";
import { buildArticleEvidence } from "../src/lib/blog-agent/articleMarkdown";
import { readBlogAgentConfig, type BlogAgentConfig } from "../src/lib/blog-agent/config";
import { OpenAICompatibleBlogAgentClient } from "../src/lib/blog-agent/modelClient";

type CanaryArguments = { slug: string; question: string };

type CanaryPayload = {
  find(request: Record<string, unknown>): Promise<{ docs: unknown[] }>;
  destroy(): Promise<void>;
};

export type BlogAgentCanaryDependencies = {
  readConfig: () => BlogAgentConfig;
  getPayload: () => Promise<CanaryPayload>;
  createClient: (config: BlogAgentConfig) => BlogAgentAnswerClient;
  createQueryId: () => string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

class CanaryFailure extends Error {}

const defaultDependencies: BlogAgentCanaryDependencies = {
  readConfig: readBlogAgentConfig,
  getPayload: async () => {
    const { getPayloadAPI } = await import("../src/lib/payload");
    return getPayloadAPI() as unknown as Promise<CanaryPayload>;
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

  let payload: CanaryPayload | undefined;
  try {
    payload = await dependencies.getPayload();
    const result = await payload.find({
      collection: "blog",
      where: {
        slug: { equals: args.slug },
        status: { equals: "published" },
        visibility: { equals: "public" },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        contentMarkdown: true,
        status: true,
        visibility: true,
      },
    });
    const rawArticle = result.docs[0];
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
    await payload?.destroy();
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
