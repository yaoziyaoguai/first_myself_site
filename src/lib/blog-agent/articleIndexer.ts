import type {
  ArticleIndexRepository,
  ArticlePackageSummary,
  ReadyArticlePackage,
} from "./articleIndexRepository";
import {
  buildArticlePackageChunks,
  hashPublicArticle,
  validateArticlePackagePayload,
} from "./articlePackage";
import type { ArticleEmbeddingClient } from "./embeddingClient";
import type { PublicMarkdownArticle } from "./types";

export type ArticleIndexingSummary = Pick<
  ArticlePackageSummary,
  "packageHash" | "chunkCount" | "embeddingModel" | "embeddingDimensions" | "indexedAt"
>;

export class ArticleIndexer {
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    repository: ArticleIndexRepository;
    embeddings: ArticleEmbeddingClient;
    embeddingModel: string;
    embeddingDimensions: number;
    now?: () => Date;
  }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async index(input: {
    article: PublicMarkdownArticle;
    packagePayload: unknown;
  }): Promise<ArticleIndexingSummary> {
    const readyPackage = await this.preparePackage(input);
    await this.dependencies.repository.replacePackage(readyPackage);
    return this.summary(readyPackage);
  }

  async refreshPublished(input: {
    article: PublicMarkdownArticle;
    previousPackageHash: string;
    packagePayload: unknown;
  }): Promise<ArticleIndexingSummary> {
    const readyPackage = await this.preparePackage(input);
    await this.dependencies.repository.replacePublishedPackage({
      ...readyPackage,
      article: input.article,
      previousPackageHash: input.previousPackageHash,
    });
    return this.summary(readyPackage);
  }

  private async preparePackage(input: {
    article: PublicMarkdownArticle;
    packagePayload: unknown;
  }): Promise<ReadyArticlePackage> {
    const packageSnapshot = validateArticlePackagePayload(input.packagePayload, {
      markdown: input.article.contentMarkdown,
    });
    const chunks = buildArticlePackageChunks({
      title: input.article.title,
      markdown: input.article.contentMarkdown,
      package: packageSnapshot,
    });
    const vectors = await this.dependencies.embeddings.embed(chunks.map((chunk) => [
      `来源：${chunk.sourcePath}`,
      `标题：${chunk.heading}`,
      chunk.content,
    ].join("\n")));
    if (vectors.length !== chunks.length) {
      throw new Error("article package embedding count does not match chunks");
    }
    const indexedAt = this.now();
    return {
      blogId: input.article.id,
      articleHash: hashPublicArticle(input.article),
      packageHash: packageSnapshot.packageHash,
      manifest: packageSnapshot.manifest,
      embeddingModel: this.dependencies.embeddingModel,
      embeddingDimensions: this.dependencies.embeddingDimensions,
      indexedAt,
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        embedding: vectors[index],
      })),
    };
  }

  private summary(readyPackage: ReadyArticlePackage): ArticleIndexingSummary {
    return {
      packageHash: readyPackage.packageHash,
      chunkCount: readyPackage.chunks.length,
      embeddingModel: readyPackage.embeddingModel,
      embeddingDimensions: readyPackage.embeddingDimensions,
      indexedAt: readyPackage.indexedAt,
    };
  }

  async getSummary(request: {
    blogId: string;
    packageHash: string;
  }): Promise<ArticleIndexingSummary | null> {
    const summary = await this.dependencies.repository.getPackageSummary(request);
    if (!summary) return null;
    return {
      packageHash: summary.packageHash,
      chunkCount: summary.chunkCount,
      embeddingModel: summary.embeddingModel,
      embeddingDimensions: summary.embeddingDimensions,
      indexedAt: summary.indexedAt,
    };
  }
}
