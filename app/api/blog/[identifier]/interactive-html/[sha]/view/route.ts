import { NextResponse } from "next/server";
import { getPayloadAPI } from "@/lib/payload";
import { getInteractiveHtmlRepository } from "@/lib/interactive-html/runtime";
import {
  markdownReferences,
  readArticleWithDocuments,
} from "@/lib/interactive-html/repository.postgres";
import {
  interactiveHtmlHeaders,
  type InteractiveHtmlResponseKind,
} from "@/lib/interactive-html/headers";
import {
  checkReadBoundary,
  isInteractiveHtmlEnabled,
  parseBlogId,
  parseSha256,
} from "@/lib/interactive-html/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ identifier: string; sha: string }> };
type Mode = "view" | "preview";

function respond(
  kind: InteractiveHtmlResponseKind,
  body: BodyInit,
  status = 200,
): NextResponse {
  return new NextResponse(body, {
    status,
    headers: interactiveHtmlHeaders(kind),
  });
}

function textError(status: number, code: string): NextResponse {
  return respond("error", code, status);
}

function canManage(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const role = (user as { role?: unknown }).role;
  return role === "admin" || role === "editor";
}

async function currentUser(request: Request): Promise<unknown> {
  const payload = await getPayloadAPI();
  const result = await payload.auth({ headers: request.headers });
  return result.user ?? null;
}

async function authorizeRead(
  request: Request,
  mode: Mode,
  blogId: string,
  sha256: string,
): Promise<
  { ok: true; html: string } | { ok: false; status: number; code: string }
> {
  let user: unknown = null;
  try {
    user = await currentUser(request);
  } catch {
    return { ok: false, status: 503, code: "INTERACTIVE_UNAVAILABLE" };
  }
  const manager = canManage(user);

  // 权限不足、缺失、跨文章、未引用的读取统一 404，避免泄露存在性。
  if (mode === "preview" && !manager) {
    return { ok: false, status: 404, code: "INTERACTIVE_NOT_FOUND" };
  }

  try {
    const snapshot = await readArticleWithDocuments(
      getInteractiveHtmlRepository(),
      blogId,
      sha256,
    );
    if (snapshot.kind === "not-found") {
      return { ok: false, status: 404, code: "INTERACTIVE_NOT_FOUND" };
    }
    const { article, document } = snapshot;
    if (!markdownReferences(article.contentMarkdown, sha256)) {
      return { ok: false, status: 404, code: "INTERACTIVE_NOT_FOUND" };
    }
    if (mode === "view") {
      if (article.status !== "published") {
        return { ok: false, status: 404, code: "INTERACTIVE_NOT_FOUND" };
      }
      if (article.visibility !== "public" && !manager) {
        return { ok: false, status: 404, code: "INTERACTIVE_NOT_FOUND" };
      }
    }
    return { ok: true, html: document.html };
  } catch {
    return { ok: false, status: 503, code: "INTERACTIVE_UNAVAILABLE" };
  }
}

async function handle(
  request: Request,
  context: RouteContext,
  mode: Mode,
  method: "GET" | "HEAD",
): Promise<NextResponse> {
  const boundary = checkReadBoundary(request);
  if (!boundary.ok) return textError(boundary.status, boundary.error);
  const { identifier, sha } = await context.params;
  const blogId = parseBlogId(identifier);
  const sha256 = parseSha256(sha);
  if (!blogId || !sha256) return textError(400, "INTERACTIVE_INVALID_REQUEST");
  if (!isInteractiveHtmlEnabled())
    return textError(503, "INTERACTIVE_DISABLED");

  const result = await authorizeRead(request, mode, blogId, sha256);
  if (!result.ok) return textError(result.status, result.code);
  if (method === "HEAD") return respond("html", "");
  return respond("html", result.html);
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context, "view", "GET");
}

export async function HEAD(request: Request, context: RouteContext) {
  return handle(request, context, "view", "HEAD");
}
