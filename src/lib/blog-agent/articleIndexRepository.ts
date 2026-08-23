export type ArticleChunkSourceKind =
  | "article"
  | "code"
  | "documentation"
  | "data"
  | "image-description";

export type ArticleChunkRecord = {
  id: string;
  sourceKind: ArticleChunkSourceKind;
  sourcePath: string;
  heading: string;
  anchor: string;
  ordinal: number;
  content: string;
  embedding: number[];
};

export type ReadyArticlePackage = {
  blogId: string;
  articleHash: string;
  packageHash: string;
  manifest: unknown;
  embeddingModel: string;
  embeddingDimensions: number;
  indexedAt: Date;
  chunks: ArticleChunkRecord[];
};

export type ArticlePackageSummary = Omit<ReadyArticlePackage, "chunks" | "manifest"> & {
  chunkCount: number;
};

export interface ArticleIndexRepository {
  getReadyPackage(request: {
    blogId: string;
    articleHash: string;
    packageHash: string;
  }): Promise<ReadyArticlePackage | null>;

  getPackageSummary(request: {
    blogId: string;
    packageHash: string;
  }): Promise<ArticlePackageSummary | null>;

  replacePackage(input: ReadyArticlePackage): Promise<void>;
}
