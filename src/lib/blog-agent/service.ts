import { createHash, randomUUID } from "node:crypto";
import { answerFromArticle, type BlogAgentAnswerClient } from "./answer";
import { buildArticleEvidence, type ArticleEvidence } from "./articleMarkdown";
import type { BlogAgentRepository, CachedGroundedAnswer } from "./repository";
import type { BlogAgentResponse, PublicMarkdownArticle } from "./types";
import type { GenerationUsagePolicy } from "./usagePolicy";

type ServiceResult = {
  status: 200 | 429 | 503;
  body: BlogAgentResponse;
};

type BlogAgentServiceDependencies = {
  repository: BlogAgentRepository;
  usagePolicy: GenerationUsagePolicy;
  client: BlogAgentAnswerClient;
  modelCacheKey: string;
  cacheTtlMs: number;
  now?: () => Date;
  createQueryId?: () => string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedQuestion(question: string): string {
  return question.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function hashArticle(article: PublicMarkdownArticle): string {
  return sha256(JSON.stringify({
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    contentMarkdown: article.contentMarkdown,
  }));
}

function citationsFromEvidence(
  article: PublicMarkdownArticle,
  evidence: ArticleEvidence,
  citationIds: string[],
) {
  const sections = new Map(evidence.sections.map((section) => [section.id, section]));
  return citationIds.flatMap((id) => {
    const section = sections.get(id);
    if (!section) return [];
    const baseUrl = `/blog/${encodeURIComponent(article.slug)}`;
    return [{
      id,
      heading: section.heading,
      url: section.anchor === "top" ? baseUrl : `${baseUrl}#${section.anchor}`,
    }];
  });
}

export function createBlogAgentUnavailableResponse(
  reason: "rate-limited" | "provider-unavailable" | "generation-disabled",
  queryId: string = randomUUID(),
): BlogAgentResponse {
  return {
    queryId,
    answer: null,
    citationIds: [],
    citations: [],
    insufficientEvidence: false,
    usage: { cached: false, reason },
  };
}

export class BlogAgentService {
  private readonly now: () => Date;
  private readonly createQueryId: () => string;

  constructor(private readonly dependencies: BlogAgentServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createQueryId = dependencies.createQueryId ?? randomUUID;
  }

  async execute(input: {
    article: PublicMarkdownArticle;
    question: string;
    identityHash: string;
  }): Promise<ServiceResult> {
    const queryId = this.createQueryId();
    const evidence = buildArticleEvidence({
      title: input.article.title,
      excerpt: input.article.excerpt,
      markdown: input.article.contentMarkdown,
      question: input.question,
    });
    const cacheKey = {
      articleHash: hashArticle(input.article),
      modelCacheKey: this.dependencies.modelCacheKey,
      questionHash: sha256(normalizedQuestion(input.question)),
    };

    try {
      const cached = await this.dependencies.repository.getCachedAnswer({
        ...cacheKey,
        now: this.now(),
      });
      if (cached) {
        const cachedCitations = citationsFromEvidence(
          input.article,
          evidence,
          cached.citationIds,
        );
        if (cached.insufficientEvidence || cachedCitations.length > 0) {
          return {
            status: 200,
            body: {
              queryId,
              answer: cached.insufficientEvidence ? null : cached.answer,
              citationIds: cachedCitations.map((citation) => citation.id),
              citations: cachedCitations,
              insufficientEvidence: cached.insufficientEvidence,
              usage: { cached: true },
            },
          };
        }
      }

      const generated = await this.dependencies.usagePolicy.run(
        input.identityHash,
        async () => {
          const answer = await answerFromArticle(
            input.question,
            evidence,
            this.dependencies.client,
          );
          return { value: answer, usage: answer.usage };
        },
      );
      if (!generated.allowed) {
        return {
          status: 429,
          body: createBlogAgentUnavailableResponse("rate-limited", queryId),
        };
      }

      const answer = generated.value;
      const cacheAnswer: CachedGroundedAnswer = {
        answer: answer.answer,
        citationIds: answer.citationIds,
        insufficientEvidence: answer.insufficientEvidence,
      };
      await this.dependencies.repository.setCachedAnswer({
        ...cacheKey,
        answer: cacheAnswer,
        expiresAt: new Date(this.now().getTime() + this.dependencies.cacheTtlMs),
      });
      const citations = citationsFromEvidence(
        input.article,
        evidence,
        answer.citationIds,
      );
      return {
        status: 200,
        body: {
          queryId,
          answer: answer.insufficientEvidence ? null : answer.answer,
          citationIds: citations.map((citation) => citation.id),
          citations,
          insufficientEvidence: answer.insufficientEvidence,
          usage: { cached: false },
        },
      };
    } catch {
      return {
        status: 503,
        body: createBlogAgentUnavailableResponse("provider-unavailable", queryId),
      };
    }
  }
}
