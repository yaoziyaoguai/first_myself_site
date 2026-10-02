import { NextResponse } from "next/server";
import { getBlogAgentRuntime } from "@/lib/blog-agent/runtime";
import { getPayloadAPI } from "@/lib/payload";
import type { PublicMarkdownArticle } from "@/lib/blog-agent/types";
import {
  ArticlePackageValidationError,
  hashPublicArticle,
} from "@/lib/blog-agent/articlePackage";
import { ArticlePackageIndexConflictError } from "@/lib/blog-agent/articleIndexRepository.postgres";
import type { PublishedArticleEdit } from "@/lib/blog-agent/articleIndexRepository";
import { revalidateVisitorContent } from "@/lib/visitorContentCache";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 160 * 1024;
const MAX_ID_LENGTH = 128;

type RouteContext = { params: Promise<{ identifier: string }> };
type AuthenticatedPayload = Awaited<ReturnType<typeof getPayloadAPI>>;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function validId(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value).trim();
  } catch {
    return null;
  }
  return decoded &&
    decoded.length <= MAX_ID_LENGTH &&
    !decoded.includes("/") &&
    !decoded.includes("\\")
    ? decoded
    : null;
}

async function authenticate(request: Request): Promise<{
  payload: AuthenticatedPayload;
  denied?: NextResponse;
}> {
  const payload = await getPayloadAPI();
  const result = await payload.auth({ headers: request.headers });
  if (!result.user) return { payload, denied: jsonError("Authentication required", 401) };
  const role = (result.user as { role?: unknown }).role;
  if (role !== "admin" && role !== "editor") {
    return { payload, denied: jsonError("Forbidden", 403) };
  }
  return { payload };
}

async function findPrivatePackageArticle(
  payload: AuthenticatedPayload,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await payload.findByID({
      collection: "blog",
      id,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    }) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function findPublishedPackageArticle(
  payload: AuthenticatedPayload,
  id: string,
): Promise<
  | { ok: true; article: Record<string, unknown> }
  | { ok: false }
> {
  try {
    const article = await payload.findByID({
      collection: "blog",
      id,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
    }) as unknown as Record<string, unknown>;
    return { ok: true, article };
  } catch {
    return { ok: false };
  }
}

function publicMarkdownArticle(value: Record<string, unknown>): PublicMarkdownArticle | null {
  if (
    typeof value.id !== "number" && typeof value.id !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.contentMarkdown !== "string" ||
    !value.contentMarkdown.trim()
  ) {
    return null;
  }
  return {
    id: String(value.id),
    slug: value.slug,
    title: value.title,
    excerpt: typeof value.excerpt === "string" ? value.excerpt : "",
    contentMarkdown: value.contentMarkdown,
  };
}

async function readLimitedJson(request: Request, maximum = MAX_BODY_BYTES): Promise<
  | { ok: true; value: unknown }
  | { ok: false; tooLarge: boolean }
> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximum) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      ok: true,
      value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

function requestBoundaryError(request: Request): NextResponse | null {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonError("Cross-site request rejected", 403);
  }
  const mediaType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLocaleLowerCase();
  return mediaType === "application/json"
    ? null
    : jsonError("Content-Type must be application/json", 415);
}

function publishedRefreshBody(value: unknown): {
  previousPackageHash: string;
  packagePayload: Record<string, unknown>;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== "previousPackageHash" && key !== "package") ||
    typeof record.previousPackageHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.previousPackageHash) ||
    !record.package ||
    typeof record.package !== "object" ||
    Array.isArray(record.package)
  ) {
    return null;
  }
  return {
    previousPackageHash: record.previousPackageHash,
    packagePayload: record.package as Record<string, unknown>,
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  const boundaryError = requestBoundaryError(request);
  if (boundaryError) return boundaryError;
  const { payload, denied } = await authenticate(request);
  if (denied) return denied;
  const id = validId((await params).identifier);
  if (!id) return jsonError("Invalid article", 400);
  const body = await readLimitedJson(request);
  if (!body.ok) {
    return jsonError(body.tooLarge ? "Request body too large" : "Invalid JSON body", body.tooLarge ? 413 : 400);
  }
  const articleRecord = await findPrivatePackageArticle(payload, id);
  const article = articleRecord && publicMarkdownArticle(articleRecord);
  if (!articleRecord || !article) return jsonError("Article not found", 404);
  const expectedHash = articleRecord.agentPackageHash;
  const bodyHash = body.value && typeof body.value === "object" && !Array.isArray(body.value)
    ? (body.value as Record<string, unknown>).packageHash
    : undefined;
  if (
    articleRecord.status !== "draft" ||
    articleRecord.visibility !== "private" ||
    articleRecord.agentContextRequired !== true ||
    typeof expectedHash !== "string" ||
    bodyHash !== expectedHash
  ) {
    return jsonError("Article package state conflict", 409);
  }
  const indexer = getBlogAgentRuntime().indexer;
  if (!indexer) return jsonError("Embedding provider is not configured", 503);

  await payload.update({
    collection: "blog",
    id,
    overrideAccess: true,
    data: { agentIndexStatus: "pending" },
  });
  try {
    const summary = await indexer.index({ article, packagePayload: body.value });
    const latestArticle = await findPrivatePackageArticle(payload, id);
    const latestPublicArticle = latestArticle && publicMarkdownArticle(latestArticle);
    if (
      !latestArticle ||
      !latestPublicArticle ||
      latestArticle.status !== "draft" ||
      latestArticle.visibility !== "private" ||
      latestArticle.agentContextRequired !== true ||
      latestArticle.agentPackageHash !== summary.packageHash ||
      latestArticle.agentIndexStatus !== "pending" ||
      hashPublicArticle(latestPublicArticle) !== hashPublicArticle(article)
    ) {
      return jsonError("Article package state conflict", 409);
    }
    await payload.update({
      collection: "blog",
      id,
      overrideAccess: true,
      data: {
        agentIndexStatus: "ready",
        agentIndexedPackageHash: summary.packageHash,
        agentIndexedAt: summary.indexedAt.toISOString(),
      },
    });
    return NextResponse.json({ ok: true, ...summary, indexedAt: summary.indexedAt.toISOString() });
  } catch (error) {
    if (error instanceof ArticlePackageIndexConflictError) {
      return jsonError("Article package state conflict", 409);
    }
    await payload.update({
      collection: "blog",
      id,
      overrideAccess: true,
      data: {
        agentIndexStatus: "failed",
        agentIndexedPackageHash: null,
        agentIndexedAt: null,
      },
    }).catch(() => undefined);
    return error instanceof ArticlePackageValidationError
      ? jsonError("Article package validation failed", 422)
      : jsonError("Article package indexing unavailable", 503);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const boundaryError = requestBoundaryError(request);
  if (boundaryError) return boundaryError;
  const { payload, denied } = await authenticate(request);
  if (denied) return denied;
  const id = validId((await params).identifier);
  if (!id) return jsonError("Invalid article", 400);
  const body = await readLimitedJson(request);
  if (!body.ok) {
    return jsonError(body.tooLarge ? "Request body too large" : "Invalid JSON body", body.tooLarge ? 413 : 400);
  }
  const refresh = publishedRefreshBody(body.value);
  if (!refresh) return jsonError("Invalid published package refresh", 400);

  const lookup = await findPublishedPackageArticle(payload, id);
  if (!lookup.ok) return jsonError("Article lookup unavailable", 503);
  const articleRecord = lookup.article;
  const article = articleRecord && publicMarkdownArticle(articleRecord);
  const nextPackageHash = refresh.packagePayload.packageHash;
  if (
    !articleRecord ||
    !article ||
    articleRecord.status !== "published" ||
    articleRecord.visibility !== "public" ||
    articleRecord.agentContextRequired !== true ||
    articleRecord.agentIndexStatus !== "ready" ||
    articleRecord.agentPackageHash !== refresh.previousPackageHash ||
    articleRecord.agentIndexedPackageHash !== refresh.previousPackageHash ||
    typeof nextPackageHash !== "string" ||
    nextPackageHash === refresh.previousPackageHash
  ) {
    return jsonError("Article package state conflict", 409);
  }
  const indexer = getBlogAgentRuntime().indexer;
  if (!indexer) return jsonError("Embedding provider is not configured", 503);
  try {
    const summary = await indexer.refreshPublished({
      article,
      previousPackageHash: refresh.previousPackageHash,
      packagePayload: refresh.packagePayload,
    });
    return NextResponse.json({ ok: true, ...summary, indexedAt: summary.indexedAt.toISOString() });
  } catch (error) {
    if (error instanceof ArticlePackageIndexConflictError) {
      return jsonError("Article package state conflict", 409);
    }
    return error instanceof ArticlePackageValidationError
      ? jsonError("Article package validation failed", 422)
      : jsonError("Article package indexing unavailable", 503);
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const { payload, denied } = await authenticate(request);
  if (denied) return denied;
  const id = validId((await params).identifier);
  if (!id) return jsonError("Invalid article", 400);
  const article = await findPrivatePackageArticle(payload, id);
  if (!article) return jsonError("Article not found", 404);
  const packageHash = article.agentPackageHash;
  const indexer = getBlogAgentRuntime().indexer;
  if (new URL(request.url).searchParams.get("manifest") === "1") {
    const publicArticle = publicMarkdownArticle(article);
    if (!publicArticle || article.status !== "published" || article.visibility !== "public" ||
      article.agentContextRequired !== true || article.agentIndexStatus !== "ready" ||
      typeof packageHash !== "string" || article.agentIndexedPackageHash !== packageHash) {
      return jsonError("Article package state conflict", 409);
    }
    if (!indexer) return jsonError("Embedding provider is not configured", 503);
    try {
      const manifest = await indexer.getSourceManifest(publicArticle, packageHash);
      if (!manifest) return jsonError("Article package state conflict", 409);
      return NextResponse.json({ packageHash, articleHash: hashPublicArticle(publicArticle), manifest }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch {
      return jsonError("Article package lookup unavailable", 503);
    }
  }
  const summary = indexer && typeof packageHash === "string"
    ? await indexer.getSummary({ blogId: String(article.id), packageHash })
    : null;
  return NextResponse.json({
    expectedPackageHash: typeof packageHash === "string" ? packageHash : null,
    indexStatus: typeof article.agentIndexStatus === "string" ? article.agentIndexStatus : "none",
    indexedPackageHash: typeof article.agentIndexedPackageHash === "string"
      ? article.agentIndexedPackageHash
      : null,
    chunkCount: summary?.chunkCount ?? 0,
    embeddingModel: summary?.embeddingModel ?? null,
    embeddingDimensions: summary?.embeddingDimensions ?? null,
    indexedAt: summary?.indexedAt.toISOString() ?? null,
  });
}

function publishedRevisionBody(value: unknown): {
  previousPackageHash: string;
  previousArticleHash: string;
  article: PublishedArticleEdit;
  packagePayload: Record<string, unknown>;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["previousPackageHash", "previousArticleHash", "article", "package"].includes(key))) return null;
  const refresh = publishedRefreshBody({ previousPackageHash: record.previousPackageHash, package: record.package });
  if (!refresh || typeof record.previousArticleHash !== "string" || !/^[a-f0-9]{64}$/.test(record.previousArticleHash) ||
    !record.article || typeof record.article !== "object" || Array.isArray(record.article)) return null;
  const article = record.article as Record<string, unknown>;
  if (Object.keys(article).some((key) => !["title", "excerpt", "contentMarkdown", "readingTime"].includes(key)) ||
    typeof article.title !== "string" || !article.title.trim() || article.title.length > 500 ||
    typeof article.excerpt !== "string" || article.excerpt.length > 4000 ||
    typeof article.contentMarkdown !== "string" || !article.contentMarkdown.trim() ||
    Buffer.byteLength(article.contentMarkdown, "utf8") > 200 * 1024 ||
    typeof article.readingTime !== "string" || !article.readingTime.trim() || article.readingTime.length > 64) return null;
  return { ...refresh, previousArticleHash: record.previousArticleHash, article: article as PublishedArticleEdit };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const boundaryError = requestBoundaryError(request);
  if (boundaryError) return boundaryError;
  const { payload, denied } = await authenticate(request);
  if (denied) return denied;
  const id = validId((await params).identifier);
  if (!id) return jsonError("Invalid article", 400);
  // 主文最多 200 KiB，加上 120 KiB sources 与有界 manifest 元数据。
  const body = await readLimitedJson(request, 360 * 1024);
  if (!body.ok) return jsonError(body.tooLarge ? "Request body too large" : "Invalid JSON body", body.tooLarge ? 413 : 400);
  const revision = publishedRevisionBody(body.value);
  if (!revision) return jsonError("Invalid published article revision", 400);
  const lookup = await findPublishedPackageArticle(payload, id);
  if (!lookup.ok) return jsonError("Article lookup unavailable", 503);
  const record = lookup.article;
  const article = publicMarkdownArticle(record);
  if (!article || record.status !== "published" || record.visibility !== "public" ||
    record.agentContextRequired !== true || record.agentIndexStatus !== "ready" ||
    record.agentPackageHash !== revision.previousPackageHash ||
    record.agentIndexedPackageHash !== revision.previousPackageHash ||
    hashPublicArticle(article) !== revision.previousArticleHash ||
    revision.packagePayload.packageHash === revision.previousPackageHash) {
    return jsonError("Article package state conflict", 409);
  }
  const indexer = getBlogAgentRuntime().indexer;
  if (!indexer) return jsonError("Embedding provider is not configured", 503);
  try {
    const summary = await indexer.revisePublished({
      article, replacement: revision.article,
      previousPackageHash: revision.previousPackageHash, packagePayload: revision.packagePayload,
    });
    // 提交后按普通公开文章编辑的策略失效缓存；失效异常仍由 60 秒 TTL 兜底。
    let cacheRevalidated = true;
    try {
      await revalidateVisitorContent();
    } catch {
      cacheRevalidated = false;
      console.warn("[cache] revalidate after article revision failed");
    }
    return NextResponse.json({ ok: true, ...summary, indexedAt: summary.indexedAt.toISOString(), cacheRevalidated });
  } catch (error) {
    if (error instanceof ArticlePackageIndexConflictError) return jsonError("Article package state conflict", 409);
    return error instanceof ArticlePackageValidationError
      ? jsonError("Article package validation failed", 422)
      : jsonError("Article package indexing unavailable", 503);
  }
}
