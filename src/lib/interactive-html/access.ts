/**
 * 交互 HTML 的服务端开关与请求边界工具。
 *
 * 开关默认关闭：关闭时拒绝 PUT 与可执行 view/preview，但保留已认证的
 * 元数据/JSON 读回用于排障。它不是权限，也不是 `NEXT_PUBLIC_*` 秘密。
 */

export function isInteractiveHtmlEnabled(): boolean {
  return (
    process.env.BLOG_INTERACTIVE_HTML_ENABLED?.trim().toLowerCase() === "true"
  );
}

/** 只接受规范正整数 Blog ID。 */
export function parseBlogId(value: unknown): string | null {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,9}$/.test(value))
    return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647
    ? String(parsed)
    : null;
}

export function parseSha256(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
    ? value
    : null;
}

const TRUSTED_ORIGINS = new Set<string>();

/**
 * 可信站点 origin：只来自显式配置，不用请求的 Host 或转发头拼接。
 * 同源后台请求允许携带现有 Cookie；没有 Origin/Fetch Metadata 的 CLI
 * 必须使用 Authorization，由调用方独立验证。
 */
export function trustedOrigins(): string[] {
  if (TRUSTED_ORIGINS.size > 0) return [...TRUSTED_ORIGINS];
  for (const value of [
    process.env.NEXT_PUBLIC_SERVER_URL,
    process.env.PAYLOAD_PUBLIC_SERVER_URL,
  ]) {
    if (!value) continue;
    try {
      TRUSTED_ORIGINS.add(new URL(value).origin);
    } catch {
      // 配置无效时不把它当作可信来源。
    }
  }
  return [...TRUSTED_ORIGINS];
}

export type BoundaryCheck =
  { ok: true } | { ok: false; status: number; error: string };

/**
 * 写请求的来源边界。
 *
 * - Origin 存在时必须精确匹配可信 origin，拒绝 `null` 与 same-site 但不同源。
 * - Fetch Metadata 存在时只接受 same-origin。
 * - 两者都不存在时（CLI）要求 Authorization，不允许“空头借 Cookie”。
 */
export function checkWriteBoundary(request: Request): BoundaryCheck {
  const origin = request.headers.get("origin");
  if (origin !== null) {
    if (origin === "null" || !trustedOrigins().includes(origin)) {
      return { ok: false, status: 403, error: "Untrusted origin" };
    }
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return { ok: false, status: 403, error: "Cross-site request rejected" };
  }
  if (
    origin === null &&
    fetchSite === null &&
    !request.headers.get("authorization")
  ) {
    return { ok: false, status: 401, error: "Authentication required" };
  }
  return { ok: true };
}

/** 读取类请求的跨站限制：只拒绝明确的 cross-site。 */
export function checkReadBoundary(request: Request): BoundaryCheck {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return { ok: false, status: 403, error: "Cross-site request rejected" };
  }
  return { ok: true };
}
