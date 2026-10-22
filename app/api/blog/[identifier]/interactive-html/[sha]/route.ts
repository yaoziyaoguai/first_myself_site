import { NextResponse } from "next/server";
import { getPayloadAPI } from "@/lib/payload";
import { getInteractiveHtmlRepository } from "@/lib/interactive-html/runtime";
import {
  preparePublicHtml,
  type ProfileIssue,
} from "@/lib/interactive-html/profile";
import { INTERACTIVE_HTML_LIMITS } from "@/lib/interactive-html/marker";
import {
  interactiveHtmlHeaders,
  type InteractiveHtmlResponseKind,
} from "@/lib/interactive-html/headers";
import {
  checkWriteBoundary,
  isInteractiveHtmlEnabled,
  parseBlogId,
  parseSha256,
} from "@/lib/interactive-html/access";
import { isRateLimited } from "@/lib/rateLimit";

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

function jsonError(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
) {
  return respond("json", JSON.stringify({ error, ...extra }), status);
}

async function authenticateAdmin(
  request: Request,
  authorizationOnly = false,
): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  let user: unknown = null;
  try {
    const payload = await getPayloadAPI();
    const headers = new Headers(request.headers);
    // 无浏览器来源信息的 CLI 必须真正通过 Authorization，不能借 Cookie 后备。
    if (authorizationOnly) headers.delete("cookie");
    const result = await payload.auth({ headers });
    user = result.user;
  } catch {
    return {
      ok: false,
      response: jsonError(503, "Authentication unavailable"),
    };
  }
  if (!user)
    return { ok: false, response: jsonError(401, "Authentication required") };
  const role = (user as { role?: unknown }).role;
  if (role !== "admin" && role !== "editor") {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }
  const userId = (user as { id?: unknown }).id;
  if (typeof userId !== "string" && typeof userId !== "number") {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }
  return { ok: true, userId: String(userId) };
}

async function readBodyWithinLimit(
  request: Request,
  maximum: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; tooLarge: boolean }> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximum) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, tooLarge: false };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

function isUtf8Html(value: string | null): boolean {
  if (!value) return false;
  const [type, ...parameters] = value.split(";");
  if (type.trim().toLowerCase() !== "text/html") return false;
  const charset = parameters
    .map((parameter) => parameter.trim().toLowerCase())
    .find((parameter) => parameter.startsWith("charset="));
  return charset === "charset=utf-8";
}

function issuePayload(issues: ProfileIssue[]) {
  return issues.slice(0, 20).map((issue) => ({
    code: issue.code,
    message: issue.message,
    ...(issue.line !== undefined ? { line: issue.line } : {}),
  }));
}

export async function PUT(request: Request, { params }: RouteContext) {
  const boundary = checkWriteBoundary(request);
  if (!boundary.ok) return jsonError(boundary.status, boundary.error);
  const { identifier, sha } = await params;
  const blogId = parseBlogId(identifier);
  const expectedSha = parseSha256(sha);
  if (!blogId || !expectedSha)
    return jsonError(400, "Invalid article or digest");
  if (!isInteractiveHtmlEnabled())
    return jsonError(503, "INTERACTIVE_DISABLED");

  const auth = await authenticateAdmin(
    request,
    !request.headers.has("origin") && !request.headers.has("sec-fetch-site"),
  );
  if (!auth.ok) return auth.response;
  if (isRateLimited(`interactive-html-upload:${auth.userId}`, 10, 60_000)) {
    return new NextResponse(
      JSON.stringify({ error: "INTERACTIVE_RATE_LIMITED" }),
      {
        status: 429,
        headers: interactiveHtmlHeaders("json", { "Retry-After": "60" }),
      },
    );
  }

  if (!isUtf8Html(request.headers.get("content-type"))) {
    return jsonError(415, "Content-Type must be text/html; charset=utf-8");
  }
  if (request.headers.get("x-interactive-request") !== "1") {
    return jsonError(400, "Missing X-Interactive-Request header");
  }
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.trim().toLowerCase() !== "identity") {
    return jsonError(415, "Content-Encoding is not supported");
  }

  const body = await readBodyWithinLimit(
    request,
    INTERACTIVE_HTML_LIMITS.maxDocumentBytes,
  );
  if (!body.ok) {
    return body.tooLarge
      ? jsonError(413, "INTERACTIVE_TOO_LARGE")
      : jsonError(400, "Unreadable request body");
  }

  // 服务端独立复核：不依赖客户端“已审查”的声明，也绝不自动适配。
  const prepared = preparePublicHtml(body.bytes, { adapt: false });
  if (!prepared.ok) {
    return jsonError(422, "INTERACTIVE_PROFILE_REJECTED", {
      issues: issuePayload(prepared.issues),
    });
  }
  if (prepared.value.sha256 !== expectedSha) {
    return jsonError(422, "INTERACTIVE_HASH_MISMATCH", {
      expected: expectedSha,
      actual: prepared.value.sha256,
    });
  }

  try {
    const repository = getInteractiveHtmlRepository();
    const result = await repository.put(
      blogId,
      prepared.value.sha256,
      prepared.value.html,
      INTERACTIVE_HTML_LIMITS.profileVersion,
    );
    if (result.status === "mismatch") {
      return jsonError(409, "INTERACTIVE_VERSION_CONFLICT");
    }
    if (result.status === "storage-limit") {
      return jsonError(409, "INTERACTIVE_STORAGE_LIMIT", {
        reason: result.reason,
      });
    }
    return respond(
      "json",
      JSON.stringify(result.metadata),
      result.status === "created" ? 201 : 200,
    );
  } catch (error) {
    console.error(
      "[interactive-html] put failed",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonError(503, "INTERACTIVE_STORAGE_UNAVAILABLE");
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const { identifier, sha } = await params;
  const blogId = parseBlogId(identifier);
  const expectedSha = parseSha256(sha);
  if (!blogId || !expectedSha)
    return jsonError(400, "Invalid article or digest");
  const auth = await authenticateAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const wantsSource = url.searchParams.get("source");
  for (const key of url.searchParams.keys()) {
    if (key !== "source") return jsonError(400, "Unsupported query parameter");
  }
  if (wantsSource !== null && wantsSource !== "1") {
    return jsonError(400, "Unsupported query parameter");
  }

  try {
    const repository = getInteractiveHtmlRepository();
    if (wantsSource === "1") {
      const document = await repository.getDocument(blogId, expectedSha);
      if (!document) return jsonError(404, "INTERACTIVE_NOT_FOUND");
      return respond(
        "json",
        JSON.stringify({
          sha256: document.sha256,
          byteLength: document.byteLength,
          profileVersion: document.profileVersion,
          html: document.html,
        }),
      );
    }
    const metadata = await repository.getMetadata(blogId, expectedSha);
    if (!metadata) return jsonError(404, "INTERACTIVE_NOT_FOUND");
    return respond("json", JSON.stringify(metadata));
  } catch (error) {
    console.error(
      "[interactive-html] metadata read failed",
      error instanceof Error ? error.name : "unknown",
    );
    return jsonError(503, "INTERACTIVE_STORAGE_UNAVAILABLE");
  }
}
