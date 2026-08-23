import { createHash } from "node:crypto";
import type { ArticleIndexRepository, ReadyArticlePackage } from "./articleIndexRepository";
import { hashPublicArticle } from "./articlePackage";
import { articleQueryTerms, type ArticleEvidence, type ArticleSection } from "./articleMarkdown";
import type { ArticleEmbeddingClient } from "./embeddingClient";
import type { PublicMarkdownArticle } from "./types";

const MAX_SECTIONS = 6;
const MAX_CHARACTERS = 14_000;
const RRF_K = 60;

export type PreparedArticleContext = {
  contextHash: string;
  sections: ArticleSection[];
  buildEvidence(question: string): Promise<ArticleEvidence>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function cosine(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return Number.NEGATIVE_INFINITY;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) return Number.NEGATIVE_INFINITY;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function lexicalScore(section: ArticleSection & { sourcePath: string }, terms: string[]): number {
  const heading = section.heading.normalize("NFKC").toLocaleLowerCase();
  const path = section.sourcePath.normalize("NFKC").toLocaleLowerCase();
  const content = section.content.normalize("NFKC").toLocaleLowerCase();
  return terms.reduce((score, term) => score +
    (heading.includes(term) ? 5 : 0) +
    (path.includes(term) ? 6 : 0) +
    (content.includes(term) ? 1 : 0), 0);
}

function articleSections(articlePackage: ReadyArticlePackage): Array<ArticleSection & {
  sourcePath: string;
  embedding: number[];
}> {
  return articlePackage.chunks.map((chunk) => {
    const heading = chunk.sourceKind === "article"
      ? chunk.heading
      : `${chunk.heading} · ${chunk.sourcePath}`;
    return {
      id: chunk.id,
      heading,
      headingPath: [heading],
      anchor: chunk.anchor || "top",
      ordinal: chunk.ordinal,
      content: chunk.content,
      protectedMaterial: chunk.sourceKind !== "article",
      sourcePath: chunk.sourcePath,
      embedding: chunk.embedding,
    };
  });
}

function boundedSections(sections: ArticleSection[]): ArticleSection[] {
  let remaining = MAX_CHARACTERS;
  return sections.slice(0, MAX_SECTIONS).flatMap((section) => {
    if (remaining <= 0) return [];
    const content = section.content.slice(0, remaining).trimEnd();
    remaining -= content.length;
    return content ? [{ ...section, content }] : [];
  });
}

function rankSections(
  sections: Array<ArticleSection & { sourcePath: string; embedding: number[] }>,
  question: string,
  queryEmbedding: number[] | null,
): ArticleSection[] {
  const terms = articleQueryTerms(question);
  const dense = queryEmbedding
    ? sections
      .map((section) => ({ id: section.id, score: cosine(queryEmbedding, section.embedding) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((left, right) => right.score - left.score)
    : [];
  const lexical = sections
    .map((section) => ({ id: section.id, score: lexicalScore(section, terms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  const fused = new Map<string, number>();
  dense.forEach(({ id }, index) => fused.set(id, (fused.get(id) ?? 0) + 1 / (RRF_K + index + 1)));
  lexical.forEach(({ id }, index) => fused.set(id, (fused.get(id) ?? 0) + 1 / (RRF_K + index + 1)));
  const ranked = [...sections].sort((left, right) =>
    (fused.get(right.id) ?? 0) - (fused.get(left.id) ?? 0) ||
    left.ordinal - right.ordinal
  );
  return boundedSections(ranked);
}

export class BlogScopedArticleRetriever {
  constructor(private readonly dependencies: {
    repository: Pick<ArticleIndexRepository, "getReadyPackage">;
    embeddings: ArticleEmbeddingClient;
    embeddingModel: string;
    embeddingDimensions: number;
  }) {}

  async prepare(article: PublicMarkdownArticle): Promise<PreparedArticleContext | null> {
    if (
      article.agentContextRequired !== true ||
      article.agentIndexStatus !== "ready" ||
      typeof article.agentPackageHash !== "string" ||
      article.agentIndexedPackageHash !== article.agentPackageHash
    ) {
      return null;
    }
    const articleHash = hashPublicArticle(article);
    const articlePackage = await this.dependencies.repository.getReadyPackage({
      blogId: article.id,
      articleHash,
      packageHash: article.agentPackageHash,
    });
    if (
      !articlePackage ||
      articlePackage.embeddingModel !== this.dependencies.embeddingModel ||
      articlePackage.embeddingDimensions !== this.dependencies.embeddingDimensions ||
      articlePackage.chunks.length === 0
    ) {
      return null;
    }
    const sections = articleSections(articlePackage);
    return {
      contextHash: sha256(`${articleHash}\0${articlePackage.packageHash}\0${articlePackage.embeddingModel}`),
      sections,
      buildEvidence: async (question: string) => {
        let queryEmbedding: number[] | null = null;
        try {
          const vectors = await this.dependencies.embeddings.embed([question.trim()]);
          if (
            vectors.length === 1 &&
            vectors[0].length === articlePackage.embeddingDimensions &&
            vectors[0].every(Number.isFinite)
          ) {
            queryEmbedding = vectors[0];
          }
        } catch {
          queryEmbedding = null;
        }
        const selected = rankSections(sections, question, queryEmbedding);
        return {
          title: article.title,
          excerpt: article.excerpt,
          outline: sections.map(({ id, headingPath, anchor }) => ({ id, headingPath, anchor })),
          sections: selected,
          totalCharacters: selected.reduce((total, section) => total + section.content.length, 0),
        };
      },
    };
  }
}
