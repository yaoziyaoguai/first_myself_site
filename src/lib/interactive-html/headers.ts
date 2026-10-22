/**
 * 交互 HTML 专用响应头。
 *
 * 成功、错误与 HEAD 都必须使用同一份策略，避免散写多份值产生偏差。
 * 主站与后台的全局 `frame-ancestors 'none'` 保持不变；这里只覆盖
 * `/api/blog/{id}/interactive-html/{sha}/view|preview` 这两条精确路径。
 */

export const INTERACTIVE_HTML_CSP = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "media-src data:",
  "font-src data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export type InteractiveHtmlResponseKind = "html" | "json" | "error";

/**
 * 返回该响应的完整头集合。`html` 仅用于可执行的 view/preview 成功响应；
 * JSON 元数据/读回与错误响应不允许被当作可执行文档。
 */
export function interactiveHtmlHeaders(
  kind: InteractiveHtmlResponseKind,
  extra: Record<string, string> = {},
): Headers {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    ...extra,
  });
  if (kind === "html") {
    headers.set("Content-Type", "text/html; charset=utf-8");
    headers.set("Content-Security-Policy", INTERACTIVE_HTML_CSP);
    headers.set("X-Frame-Options", "SAMEORIGIN");
  } else if (kind === "json") {
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    headers.set("X-Frame-Options", "DENY");
  } else {
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    headers.set("X-Frame-Options", "DENY");
  }
  return headers;
}

/** next.config.ts 中用于精确路径覆盖的 CSP 值，与运行时保持一致。 */
export const INTERACTIVE_HTML_ROUTE_HEADERS = {
  "Content-Security-Policy": INTERACTIVE_HTML_CSP,
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Frame-Options": "SAMEORIGIN",
} as const;
