import { createHash } from "node:crypto";
import { parseArticleMarkdown, slugifyArticleHeading } from "./articleMarkdown";
import type {
  ArticleChunkRecord,
  ArticleChunkSourceKind,
} from "./articleIndexRepository";
import type { PublicMarkdownArticle } from "./types";

const SOURCE_KINDS = new Set<ArticleChunkSourceKind>([
  "code",
  "documentation",
  "data",
  "image-description",
]);
const MAX_SOURCES = 10;
const MAX_SOURCE_BYTES = 20 * 1024;
const MAX_TOTAL_SOURCE_BYTES = 120 * 1024;
const MAX_ARTICLE_BYTES = 200 * 1024;
const MAX_CHUNKS = 128;
const ARTICLE_CHUNK_CHARACTERS = 1_500;
const ARTICLE_CHUNK_OVERLAP = 150;
const MATERIAL_CHUNK_CHARACTERS = 1_500;
const MATERIAL_CHUNK_OVERLAP = 200;
const SHA256_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|ghp|github_pat)_[A-Za-z0-9._-]{12,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:api[_-]?key|password|passwd|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i,
  /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{12,}/i,
];

export class ArticlePackageValidationError extends Error {}

type ArticlePackageSource = {
  path: string;
  kind: Exclude<ArticleChunkSourceKind, "article">;
  label: string;
  sectionAnchor: string;
  sha256: string;
  content: string;
};

type ArticlePackageExclusion = {
  path: string;
  reason: string;
};

export type ValidatedArticlePackage = {
  version: 1;
  packageHash: string;
  sourceCommit: string;
  mainSha256: string;
  manifestPath: string;
  sources: ArticlePackageSource[];
  excluded: ArticlePackageExclusion[];
  canaryQuestion: string;
  manifest: {
    version: 1;
    sourceCommit: string;
    mainSha256: string;
    manifestPath: string;
    sources: Array<Omit<ArticlePackageSource, "content">>;
    excluded: ArticlePackageExclusion[];
    canaryQuestion: string;
  };
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ArticlePackageValidationError(`${label} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new ArticlePackageValidationError(`${label} 包含未知字段: ${unknown.join(", ")}`);
  }
}

function safeRelativePath(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 300) {
    throw new ArticlePackageValidationError(`${label} 路径无效`);
  }
  const path = value.replaceAll("\\", "/");
  if (
    path.startsWith("/") ||
    /^[A-Za-z]:\//.test(path) ||
    path.split("/").some((part) => part === ".." || part === "" || part === ".") ||
    /[\0\r\n]/.test(path)
  ) {
    throw new ArticlePackageValidationError(`${label} 必须是仓库内相对路径`);
  }
  return path;
}

function boundedText(
  value: unknown,
  label: string,
  maximum: number,
): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new ArticlePackageValidationError(`${label} 无效或超过 ${maximum} 字符`);
  }
  return value.trim();
}

function publicSafe(content: string, path: string): void {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new ArticlePackageValidationError(`source 触发敏感信息规则: ${path}`);
  }
}

function canonicalPackage(value: {
  sourceCommit: string;
  mainSha256: string;
  manifestPath: string;
  sources: ArticlePackageSource[];
  excluded: ArticlePackageExclusion[];
  canaryQuestion: string;
}) {
  return {
    version: 1 as const,
    sourceCommit: value.sourceCommit,
    mainSha256: value.mainSha256,
    manifestPath: value.manifestPath,
    sources: value.sources.map((source) => ({
      path: source.path,
      kind: source.kind,
      label: source.label,
      sectionAnchor: source.sectionAnchor,
      sha256: source.sha256,
      content: source.content,
    })),
    excluded: value.excluded.map((item) => ({
      path: item.path,
      reason: item.reason,
    })),
    canaryQuestion: value.canaryQuestion,
  };
}

export function validateArticlePackagePayload(
  input: unknown,
  article: { markdown: string },
): ValidatedArticlePackage {
  const value = record(input, "文章包");
  exactKeys(value, [
    "version",
    "packageHash",
    "sourceCommit",
    "mainSha256",
    "manifestPath",
    "sources",
    "excluded",
    "canaryQuestion",
  ], "文章包");
  if (value.version !== 1) throw new ArticlePackageValidationError("文章包 version 必须是 1");
  if (typeof value.packageHash !== "string" || !SHA256_RE.test(value.packageHash)) {
    throw new ArticlePackageValidationError("packageHash 必须是 SHA-256");
  }
  if (typeof value.sourceCommit !== "string" || !COMMIT_RE.test(value.sourceCommit)) {
    throw new ArticlePackageValidationError("sourceCommit 必须是完整 Git commit");
  }
  if (typeof value.mainSha256 !== "string" || !SHA256_RE.test(value.mainSha256)) {
    throw new ArticlePackageValidationError("mainSha256 必须是 SHA-256");
  }
  if (sha256(article.markdown) !== value.mainSha256) {
    throw new ArticlePackageValidationError("主 Markdown hash 与文章内容不一致");
  }
  const manifestPath = safeRelativePath(value.manifestPath, "manifest");
  const canaryQuestion = boundedText(value.canaryQuestion, "canaryQuestion", 300);
  if (!Array.isArray(value.sources) || value.sources.length > MAX_SOURCES) {
    throw new ArticlePackageValidationError(`文章包最多包含 ${MAX_SOURCES} 个 source`);
  }

  let totalBytes = 0;
  const paths = new Set<string>();
  const sources = value.sources.map((raw, index): ArticlePackageSource => {
    const source = record(raw, `source[${index}]`);
    exactKeys(source, ["path", "kind", "label", "sectionAnchor", "sha256", "content"], `source[${index}]`);
    const path = safeRelativePath(source.path, `source[${index}]`);
    if (paths.has(path)) throw new ArticlePackageValidationError(`source 路径重复: ${path}`);
    paths.add(path);
    if (typeof source.kind !== "string" || !SOURCE_KINDS.has(source.kind as ArticleChunkSourceKind)) {
      throw new ArticlePackageValidationError(`source 类型不允许: ${String(source.kind)}`);
    }
    const label = boundedText(source.label, `source[${index}].label`, 120);
    const sectionAnchor = boundedText(source.sectionAnchor, `source[${index}].sectionAnchor`, 160);
    if (typeof source.sha256 !== "string" || !SHA256_RE.test(source.sha256)) {
      throw new ArticlePackageValidationError(`source hash 无效: ${path}`);
    }
    if (typeof source.content !== "string" || !source.content) {
      throw new ArticlePackageValidationError(`source 内容为空: ${path}`);
    }
    const bytes = Buffer.byteLength(source.content, "utf8");
    if (bytes > MAX_SOURCE_BYTES) {
      throw new ArticlePackageValidationError(`source 超过 20 KiB: ${path}`);
    }
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_SOURCE_BYTES) {
      throw new ArticlePackageValidationError("sources 总计超过 120 KiB");
    }
    if (sha256(source.content) !== source.sha256) {
      throw new ArticlePackageValidationError(`source hash 不一致: ${path}`);
    }
    publicSafe(source.content, path);
    return {
      path,
      kind: source.kind as ArticlePackageSource["kind"],
      label,
      sectionAnchor,
      sha256: source.sha256,
      content: source.content,
    };
  });

  if (!Array.isArray(value.excluded) || value.excluded.length > 50) {
    throw new ArticlePackageValidationError("excluded 必须是最多 50 项的数组");
  }
  const excluded = value.excluded.map((raw, index): ArticlePackageExclusion => {
    const item = record(raw, `excluded[${index}]`);
    exactKeys(item, ["path", "reason"], `excluded[${index}]`);
    return {
      path: safeRelativePath(item.path, `excluded[${index}]`),
      reason: boundedText(item.reason, `excluded[${index}].reason`, 300),
    };
  });
  const canonical = canonicalPackage({
    sourceCommit: value.sourceCommit,
    mainSha256: value.mainSha256,
    manifestPath,
    sources,
    excluded,
    canaryQuestion,
  });
  if (sha256(JSON.stringify(canonical)) !== value.packageHash) {
    throw new ArticlePackageValidationError("packageHash 与 canonical snapshot 不一致");
  }
  return {
    ...canonical,
    packageHash: value.packageHash,
    manifest: {
      ...canonical,
      sources: sources.map((source) => ({
        path: source.path,
        kind: source.kind,
        label: source.label,
        sectionAnchor: source.sectionAnchor,
        sha256: source.sha256,
      })),
    },
  };
}

function splitContent(content: string, maximum: number, overlap: number): string[] {
  const normalized = content.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maximum, normalized.length);
    if (end < normalized.length) {
      const paragraph = normalized.lastIndexOf("\n\n", end);
      const line = normalized.lastIndexOf("\n", end);
      const boundary = Math.max(paragraph, line);
      if (boundary > start + Math.floor(maximum * 0.55)) end = boundary;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export function buildArticlePackageChunks(input: {
  title: string;
  markdown: string;
  package: ValidatedArticlePackage;
}): Array<Omit<ArticleChunkRecord, "embedding">> {
  if (Buffer.byteLength(input.markdown, "utf8") > MAX_ARTICLE_BYTES) {
    throw new ArticlePackageValidationError("文章包主 Markdown 超过 200 KiB");
  }
  const chunks: Array<Omit<ArticleChunkRecord, "embedding">> = [];
  for (const section of parseArticleMarkdown(input.markdown).sections) {
    splitContent(section.content, ARTICLE_CHUNK_CHARACTERS, ARTICLE_CHUNK_OVERLAP)
      .forEach((content, piece) => {
        chunks.push({
          id: `article:${section.ordinal}:${piece}`,
          sourceKind: "article",
          sourcePath: "article.md",
          heading: section.heading || input.title,
          anchor: section.anchor,
          ordinal: chunks.length,
          content,
        });
      });
  }
  for (const source of input.package.sources) {
    splitContent(source.content, MATERIAL_CHUNK_CHARACTERS, MATERIAL_CHUNK_OVERLAP)
      .forEach((content, piece) => {
        chunks.push({
          id: `material:${source.sha256.slice(0, 16)}:${piece}`,
          sourceKind: source.kind,
          sourcePath: source.path,
          heading: source.label,
          anchor: slugifyArticleHeading(source.sectionAnchor),
          ordinal: chunks.length,
          content,
        });
      });
  }
  if (chunks.length === 0) throw new ArticlePackageValidationError("文章包没有可索引内容");
  if (chunks.length > MAX_CHUNKS) {
    throw new ArticlePackageValidationError(`文章包超过 ${MAX_CHUNKS} 个 chunks`);
  }
  return chunks;
}

export function hashPublicArticle(article: PublicMarkdownArticle): string {
  return sha256(JSON.stringify({
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    contentMarkdown: article.contentMarkdown,
  }));
}
