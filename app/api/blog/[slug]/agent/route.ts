import { NextResponse } from "next/server";
import { getBlogAgentRuntime } from "@/lib/blog-agent/runtime";
import { createBlogAgentUnavailableResponse } from "@/lib/blog-agent/service";
import { getPayloadAPI } from "@/lib/payload";
import { deriveRequestIdentity } from "@/lib/requestIdentity";
import type { PublicMarkdownArticle } from "@/lib/blog-agent/types";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_QUESTION_LENGTH = 500;
const MAX_SLUG_LENGTH = 128;

type RouteContext = { params: Promise<{ slug: string }> };
type BodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; tooLarge: boolean };

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function requestBoundaryError(request: Request) {
  const mediaType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLocaleLowerCase();
  if (mediaType !== "application/json") {
    return errorResponse("Content-Type must be application/json", 415);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("Cross-site request rejected", 403);
  }
  return null;
}

async function readLimitedJsonObject(request: Request): Promise<BodyResult> {
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
      const { done, value } = await reader.read();
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
    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, tooLarge: false };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

function decodeSlug(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded &&
      decoded.length <= MAX_SLUG_LENGTH &&
      !decoded.includes("/") &&
      !decoded.includes("\\")
      ? decoded
      : null;
  } catch {
    return null;
  }
}

async function findPublicMarkdownArticle(
  slug: string,
): Promise<PublicMarkdownArticle | null> {
  const payload = await getPayloadAPI();
  const result = await payload.find({
    collection: "blog",
    where: {
      slug: { equals: slug },
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
      agentContextRequired: true,
      agentPackageHash: true,
      agentIndexStatus: true,
      agentIndexedPackageHash: true,
    },
  });
  const article = result.docs[0];
  if (
    !article ||
    typeof article.slug !== "string" ||
    typeof article.title !== "string" ||
    typeof article.contentMarkdown !== "string" ||
    !article.contentMarkdown.trim()
  ) {
    return null;
  }
  return {
    id: String(article.id),
    slug: article.slug,
    title: article.title,
    excerpt: typeof article.excerpt === "string" ? article.excerpt : "",
    contentMarkdown: article.contentMarkdown,
    agentContextRequired: article.agentContextRequired === true,
    agentPackageHash: typeof article.agentPackageHash === "string"
      ? article.agentPackageHash
      : undefined,
    agentIndexStatus: typeof article.agentIndexStatus === "string"
      ? article.agentIndexStatus
      : undefined,
    agentIndexedPackageHash: typeof article.agentIndexedPackageHash === "string"
      ? article.agentIndexedPackageHash
      : undefined,
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const runtime = getBlogAgentRuntime();
    if (!runtime.config.enabled) return errorResponse("Not found", 404);
    if (
      !runtime.config.generationEnabled ||
      !runtime.config.generationConfigured ||
      !runtime.service
    ) {
      return NextResponse.json(
        createBlogAgentUnavailableResponse("generation-disabled"),
        { status: 503 },
      );
    }

    const boundaryError = requestBoundaryError(request);
    if (boundaryError) return boundaryError;

    const body = await readLimitedJsonObject(request);
    if (!body.ok) {
      return errorResponse(
        body.tooLarge ? "Request body too large" : "Invalid JSON body",
        body.tooLarge ? 413 : 400,
      );
    }
    const keys = Object.keys(body.value);
    if (keys.length !== 1 || keys[0] !== "question") {
      return errorResponse("Invalid request body", 400);
    }
    const question = typeof body.value.question === "string"
      ? body.value.question.trim()
      : "";
    if (!question || question.length > MAX_QUESTION_LENGTH) {
      return errorResponse("Question must contain 1 to 500 characters", 400);
    }

    const { slug: rawSlug } = await params;
    const slug = decodeSlug(rawSlug);
    if (!slug) return errorResponse("Invalid article", 400);
    const article = await findPublicMarkdownArticle(slug);
    if (!article) return errorResponse("Article not found", 404);

    const identity = deriveRequestIdentity(request);
    const result = await runtime.service.execute({
      article,
      question,
      identityHash: identity.rateLimitKey,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json(
      createBlogAgentUnavailableResponse("provider-unavailable"),
      { status: 503 },
    );
  }
}
