import { createHash, randomUUID } from "node:crypto";
import {
  analyzeAnswerCodeBlocks,
  answerFromArticle,
  questionRequestsCode,
  type BlogAgentAnswerClient,
} from "./answer";
import { buildArticleEvidence, type ArticleEvidence } from "./articleMarkdown";
import type { ArticleSection } from "./articleMarkdown";
import { hashPublicArticle } from "./articlePackage";
import type { BlogScopedArticleRetriever, PreparedArticleContext } from "./articleRetriever";
import type { BlogAgentRepository, CachedGroundedAnswer } from "./repository";
import type {
  BlogAgentConversationTurn,
  BlogAgentResponse,
  PublicMarkdownArticle,
} from "./types";
import type { GenerationUsagePolicy } from "./usagePolicy";
import { buildGitHubSource } from "./githubSource";
import {
  redactAgentQuestion,
  type AgentQuestionOutcome,
  type AgentQuestionRecorder,
} from "./questionLog";

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
  articleRetriever?: BlogScopedArticleRetriever;
  questionLog?: AgentQuestionRecorder;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedQuestion(question: string): string {
  return question.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function citationsFromSections(
  article: PublicMarkdownArticle,
  sourceSections: ArticleSection[],
  citationIds: string[],
) {
  const sections = new Map(sourceSections.map((section) => [section.id, section]));
  return citationIds.flatMap((id) => {
    const section = sections.get(id);
    if (!section) return [];
    const baseUrl = `/blog/${encodeURIComponent(article.slug)}`;
    const github = githubSourceFromSection(section);
    return [{
      id,
      heading: section.heading,
      url: section.anchor === "top" ? baseUrl : `${baseUrl}#${section.anchor}`,
      ...(github ? { github } : {}),
    }];
  });
}

function githubSourceFromSection(section: ArticleSection) {
  return buildGitHubSource({
    repository: section.sourceRepository,
    commit: section.sourceCommit,
    path: section.sourcePath,
    lineStart: section.sourceLineStart,
    lineEnd: section.sourceLineEnd,
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

  private async recordQuestion(
    input: { article: PublicMarkdownArticle; question: string },
    queryId: string,
    outcome: AgentQuestionOutcome,
  ): Promise<void> {
    const recorder = this.dependencies.questionLog;
    if (!recorder) return;
    try {
      await recorder.record({
        queryId,
        articleSlug: input.article.slug,
        questionText: redactAgentQuestion(input.question),
        outcome,
        createdAt: this.now(),
      });
    } catch {
      // 记录失败不能泄露问题正文，也不能改变访客已经得到的问答结果。
      console.error("[blog-agent] question-log-write-failed", {
        queryId,
        articleSlug: input.article.slug,
      });
    }
  }

  async execute(input: {
    article: PublicMarkdownArticle;
    question: string;
    history?: BlogAgentConversationTurn[];
    identityHash: string;
  }): Promise<ServiceResult> {
    const queryId = this.createQueryId();
    const history = input.history ?? [];
    const retrievalQuestion = [
      ...history.map((turn) => turn.question),
      input.question,
    ].join("\n");
    let prepared: PreparedArticleContext | null = null;
    try {
      prepared = await this.dependencies.articleRetriever?.prepare(input.article) ?? null;
    } catch {
      prepared = null;
    }
    if (input.article.agentContextRequired === true && !prepared) {
      await this.recordQuestion(input, queryId, "provider_error");
      return {
        status: 503,
        body: createBlogAgentUnavailableResponse("provider-unavailable", queryId),
      };
    }
    const fallbackEvidence = () => buildArticleEvidence({
      title: input.article.title,
      excerpt: input.article.excerpt,
      markdown: input.article.contentMarkdown,
      question: retrievalQuestion,
    });
    let evidence: ArticleEvidence | undefined;
    const contextHash = prepared?.contextHash ?? hashPublicArticle(input.article);
    const cacheQuestion = history.length === 0
      ? normalizedQuestion(input.question)
      : JSON.stringify({
          question: normalizedQuestion(input.question),
          history: history.map((turn) => ({
            question: normalizedQuestion(turn.question),
            answer: turn.answer.normalize("NFKC").trim(),
          })),
        });
    const cacheKey = {
      articleHash: sha256(`${hashPublicArticle(input.article)}\0${contextHash}`),
      modelCacheKey: this.dependencies.modelCacheKey,
      questionHash: sha256(cacheQuestion),
    };

    try {
      const cached = await this.dependencies.repository.getCachedAnswer({
        ...cacheKey,
        now: this.now(),
      });
      const cachedMeetsCodeRequest = !questionRequestsCode(input.question) || (
        cached?.insufficientEvidence === false &&
        analyzeAnswerCodeBlocks(cached.answer).some((block) => block.trim())
      );
      if (cached && cachedMeetsCodeRequest) {
        const cachedSections = prepared?.sections ?? (evidence ??= fallbackEvidence()).sections;
        const cachedCitations = citationsFromSections(
          input.article,
          cachedSections,
          cached.citationIds,
        );
        if (cached.insufficientEvidence || cachedCitations.length > 0) {
          await this.recordQuestion(
            input,
            queryId,
            cached.insufficientEvidence ? "insufficient_evidence" : "answered",
          );
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
          evidence = prepared
            ? await prepared.buildEvidence(retrievalQuestion)
            : fallbackEvidence();
          if (evidence.sections.length === 0 && prepared) {
            evidence = fallbackEvidence();
          }
          const answer = await answerFromArticle(
            input.question,
            evidence,
            this.dependencies.client,
            history,
          );
          return { value: answer, usage: answer.usage };
        },
      );
      if (!generated.allowed) {
        await this.recordQuestion(input, queryId, "rate_limited");
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
      }).catch(() => undefined);
      const citations = citationsFromSections(
        input.article,
        evidence?.sections ?? [],
        answer.citationIds,
      );
      await this.recordQuestion(
        input,
        queryId,
        answer.insufficientEvidence ? "insufficient_evidence" : "answered",
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
      await this.recordQuestion(input, queryId, "provider_error");
      return {
        status: 503,
        body: createBlogAgentUnavailableResponse("provider-unavailable", queryId),
      };
    }
  }
}
