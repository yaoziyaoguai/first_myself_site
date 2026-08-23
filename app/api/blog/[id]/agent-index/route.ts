import { NextResponse } from "next/server";
import { getBlogAgentRuntime } from "@/lib/blog-agent/runtime";
import { getPayloadAPI } from "@/lib/payload";
import type { PublicMarkdownArticle } from "@/lib/blog-agent/types";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 160 * 1024;
const MAX_ID_LENGTH = 128;

type RouteContext = { params: Promise<{ id: string }> };
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

async function readLimitedJson(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; tooLarge: boolean }
> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
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
      if (total > MAX_BODY_BYTES) {
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

export async function POST(request: Request, { params }: RouteContext) {
  const boundaryError = requestBoundaryError(request);
  if (boundaryError) return boundaryError;
  const { payload, denied } = await authenticate(request);
  if (denied) return denied;
  const id = validId((await params).id);
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
  } catch {
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
    return jsonError("Article package indexing failed", 422);
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const { payload, denied } = await authenticate(request);
  if (denied) return denied;
  const id = validId((await params).id);
  if (!id) return jsonError("Invalid article", 400);
  const article = await findPrivatePackageArticle(payload, id);
  if (!article) return jsonError("Article not found", 404);
  const packageHash = article.agentPackageHash;
  const indexer = getBlogAgentRuntime().indexer;
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
