import { NextResponse } from "next/server";
import { getPayloadAPI } from "@/lib/payload";
import { getInteractiveHtmlRepository } from "@/lib/interactive-html/runtime";
import { readArticleWithDocuments } from "@/lib/interactive-html/repository.postgres";
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

async function authorizePreview(
  request: Request,
  blogId: string,
  sha256: string,
): Promise<
  { ok: true; html: string } | { ok: false; status: number; code: string }
> {
  let user: unknown = null;
  try {
    const payload = await getPayloadAPI();
    const result = await payload.auth({ headers: request.headers });
    user = result.user ?? null;
  } catch {
    return { ok: false, status: 503, code: "INTERACTIVE_UNAVAILABLE" };
  }
  const role = (user as { role?: unknown } | null)?.role;
  if (!user || (role !== "admin" && role !== "editor")) {
    // 预览是后台能力：未授权时与不存在同响应，避免暴露草稿资源。
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
    // 资源已由查询绑定当前文章；作者可在保存新 marker 前预览，匿名 view 仍需当前引用。
    return { ok: true, html: snapshot.document.html };
  } catch {
    return { ok: false, status: 503, code: "INTERACTIVE_UNAVAILABLE" };
  }
}

async function handle(
  request: Request,
  context: RouteContext,
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

  const result = await authorizePreview(request, blogId, sha256);
  if (!result.ok) return textError(result.status, result.code);
  if (method === "HEAD") return respond("html", "");
  return respond("html", result.html);
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context, "GET");
}

export async function HEAD(request: Request, context: RouteContext) {
  return handle(request, context, "HEAD");
}
