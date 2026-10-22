import { createHash } from "node:crypto";
import { parse as parseHtml, type DefaultTreeAdapterMap } from "parse5";
import { parse as parseCss, walk as walkCss } from "css-tree";
import { INTERACTIVE_HTML_LIMITS } from "./marker";

/**
 * 交互 HTML 的公开副本预检（profile v1）。
 *
 * 确定性顺序：严格 UTF-8 解码 → 去 BOM、统一换行为 LF → 对已识别的
 * 作者工具做有界适配 → 用标准 HTML/CSS 解析器审查 → 计算准确 UTF-8
 * 字节的 SHA-256。之后上传、落库、读回与 HTTP 响应都使用同一份字节，
 * 服务端不再格式化、清洗或重新归一化。
 *
 * 这里只做静态检查，不执行脚本，也不宣称能证明动态脚本安全。
 */

export const INTERACTIVE_HTML_PROFILE = {
  version: INTERACTIVE_HTML_LIMITS.profileVersion,
  /** data: 资源白名单：图片、音视频与字体；明确排除 HTML/JS。 */
  dataMimeTypes: new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/svg+xml",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "video/mp4",
    "video/webm",
    "video/ogg",
    "font/woff",
    "font/woff2",
    "font/ttf",
    "font/otf",
    "application/font-woff",
    "application/vnd.ms-fontobject",
  ]),
  /** 允许作为导航目标的外链协议；其余（javascript:、data: 等）拒绝。 */
  linkProtocols: new Set(["https:", "http:", "mailto:"]),
  /** 禁止出现的元素：嵌套文档、表单与资源加载器。 */
  forbiddenElements: new Set([
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "form",
    "link",
    "base",
    "portal",
  ]),
  /** 带 URL 的属性；值必须是允许的 data: 或文档内引用。 */
  resourceAttributes: new Set(["src", "poster", "data"]),
} as const;

export type ProfileIssue = {
  code: string;
  message: string;
  line?: number;
};

export type PreparedPublicHtml = {
  html: string;
  byteLength: number;
  sha256: string;
  adaptations: string[];
};

export type PrepareResult =
  | { ok: true; value: PreparedPublicHtml }
  | { ok: false; issues: ProfileIssue[] };

type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlParentNode = DefaultTreeAdapterMap["parentNode"];

function issue(code: string, message: string, line?: number): ProfileIssue {
  return { code, message, ...(line !== undefined ? { line } : {}) };
}

function attributesOf(node: HtmlNode): Record<string, string> {
  const attrs =
    (node as { attrs?: Array<{ name: string; value: string }> }).attrs ?? [];
  return Object.fromEntries(
    attrs.map((attr) => [attr.name.toLowerCase(), attr.value]),
  );
}

function childNodesOf(node: HtmlNode): HtmlNode[] {
  return (node as { childNodes?: HtmlNode[] }).childNodes ?? [];
}

function textOf(node: HtmlNode): string {
  return childNodesOf(node)
    .map((child) => {
      if ((child as { nodeName?: string }).nodeName === "#text") {
        return (child as unknown as { value: string }).value;
      }
      return textOf(child);
    })
    .join("");
}

function lineOf(node: HtmlNode): number | undefined {
  const start = (node as { sourceCodeLocation?: { startLine?: number } })
    .sourceCodeLocation;
  return start?.startLine;
}

function walkHtml(node: HtmlNode, visit: (node: HtmlNode) => void): void {
  // parse5 的 DefaultTreeAdapterMap["node"] 覆盖 Document/Element/Text 等联合，
  // 子节点遍历统一按联合处理，具体字段由下方守卫读取。
  visit(node);
  for (const child of childNodesOf(node)) walkHtml(child, visit);
  const content = (node as { content?: HtmlParentNode }).content;
  if (content && "childNodes" in content) {
    for (const child of content.childNodes) walkHtml(child, visit);
  }
}

/** 严格 UTF-8 解码；非法字节、NUL 与孤立代理项一律拒绝。 */
export function decodePublicHtmlBytes(
  bytes: Uint8Array,
): { ok: true; text: string } | { ok: false; issues: ProfileIssue[] } {
  if (bytes.byteLength === 0) {
    return { ok: false, issues: [issue("INTERACTIVE_EMPTY", "HTML 不能为空")] };
  }
  if (bytes.byteLength > INTERACTIVE_HTML_LIMITS.maxDocumentBytes) {
    return {
      ok: false,
      issues: [
        issue(
          "INTERACTIVE_TOO_LARGE",
          `HTML 超过 ${INTERACTIVE_HTML_LIMITS.maxDocumentBytes} 字节`,
        ),
      ],
    };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return {
      ok: false,
      issues: [issue("INTERACTIVE_INVALID_UTF8", "HTML 必须是合法 UTF-8")],
    };
  }
  if (text.includes("\u0000")) {
    return {
      ok: false,
      issues: [issue("INTERACTIVE_NUL", "HTML 不能包含 NUL 字符")],
    };
  }
  if (
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
      text,
    )
  ) {
    return {
      ok: false,
      issues: [issue("INTERACTIVE_INVALID_UNICODE", "HTML 包含孤立代理项")],
    };
  }
  return { ok: true, text };
}

/** 去 BOM、统一 CRLF/CR 为 LF。之后的字节就是最终字节。 */
export function normalizePublicHtml(text: string): string {
  return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

type AmAdaptation = {
  html: string;
  adaptations: string[];
  remainingSource: boolean;
};

/**
 * 只针对已识别的 answer-me-with-html 页面做有界适配：
 * 清空隐藏的 #am-source 原文，移除其专用复制控件。其它注释、JSON、
 * 内嵌资源仍需作者审查，不能据此声称文件没有敏感信息。
 */
export function adaptAuthorToolHtml(html: string): AmAdaptation {
  const adaptations: string[] = [];
  const generator =
    /<meta\s+name="generator"\s+content="Answer me with HTML ([^"]+)"/i.exec(
      html,
    );
  let result = html;
  if (generator) {
    const sourcePattern =
      /(<textarea\b[^>]*\bid="am-source"[^>]*>)([\s\S]*?)(<\/textarea>)/gi;
    result = result.replace(
      sourcePattern,
      (match, open: string, body: string, close: string) => {
        if (!body.trim()) return match;
        adaptations.push(`清空隐藏源文 #am-source（生成器 ${generator[1]}）`);
        return `${open}${close}`;
      },
    );
    const copyPattern =
      /<button\b[^>]*\bdata-am="copy"[^>]*>[\s\S]*?<\/button>/gi;
    const before = result;
    result = result.replace(copyPattern, "");
    if (result !== before)
      adaptations.push("移除生成器专用复制按钮 [data-am=copy]");
  }
  const remaining = new RegExp(
    `<textarea\\b[^>]*\\bid="am-source"[^>]*>([\\s\\S]*?)</textarea>`,
    "i",
  ).exec(result);
  return {
    html: result,
    adaptations,
    remainingSource: Boolean(remaining && remaining[1].trim()),
  };
}

function checkDataUrl(
  value: string,
  code: string,
  label: string,
  line?: number,
): ProfileIssue | null {
  if (value.startsWith("#")) return null;
  if (!value.toLowerCase().startsWith("data:")) {
    return issue(code, `${label} 只允许 data: 或文档内 #引用`, line);
  }
  const match = /^data:([^;,]+)(?:;[^,]*)?,/i.exec(value);
  if (!match) return issue(code, `${label} 的 data: URL 无效`, line);
  const mime = match[1].trim().toLowerCase();
  if (!INTERACTIVE_HTML_PROFILE.dataMimeTypes.has(mime)) {
    return issue(code, `${label} 的 data: 类型不受支持: ${mime}`, line);
  }
  return null;
}

function checkCss(
  css: string,
  label: string,
  line: number | undefined,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  let ast: ReturnType<typeof parseCss>;
  try {
    ast = parseCss(css, {
      positions: true,
      parseCustomProperty: true,
      onParseError: () => undefined,
    });
  } catch {
    return [issue("INTERACTIVE_INVALID_CSS", `${label} 无法解析`, line)];
  }
  walkCss(ast, (node) => {
    if (node.type === "Atrule" && node.name.toLowerCase() === "import") {
      issues.push(
        issue("INTERACTIVE_CSS_IMPORT", `${label} 不能使用 @import`, line),
      );
    }
    if (node.type === "Url") {
      const value = String(node.value);
      const found = checkDataUrl(
        value,
        "INTERACTIVE_CSS_URL",
        `${label} 中的 url()`,
        line,
      );
      if (found) issues.push(found);
    }
  });
  return issues;
}

function checkInlineStyle(
  style: string,
  label: string,
  line?: number,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  let ast: ReturnType<typeof parseCss>;
  try {
    ast = parseCss(style, { context: "declarationList", positions: true, parseCustomProperty: true });
  } catch {
    return [issue("INTERACTIVE_INVALID_CSS", `${label} 无法解析`, line)];
  }
  walkCss(ast, (node) => {
    if (node.type === "Url") {
      const found = checkDataUrl(
        String(node.value),
        "INTERACTIVE_CSS_URL",
        `${label} 中的 url()`,
        line,
      );
      if (found) issues.push(found);
    }
  });
  return issues;
}

/** 公开副本的静态审查；返回全部问题而不是在第一条停止。 */
export function validatePublicHtml(html: string): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  let document: DefaultTreeAdapterMap["document"];
  try {
    document = parseHtml<DefaultTreeAdapterMap>(html, {
      sourceCodeLocationInfo: true,
    });
  } catch {
    return [issue("INTERACTIVE_INVALID_HTML", "HTML 无法解析")];
  }

  walkHtml(document, (node) => {
    const name = (node as { nodeName?: string }).nodeName?.toLowerCase();
    if (!name || name.startsWith("#")) return;
    const attrs = attributesOf(node);
    const line = lineOf(node);

    // 通过解析后的 DOM 检查全部节点，不能让引号/实体或重复 id 绕过隐藏源文检查。
    if (name === "textarea" && attrs.id === "am-source" && textOf(node).trim()) {
      issues.push(issue("INTERACTIVE_HIDDEN_SOURCE", "文件仍包含非空的 #am-source 隐藏原文，请先准备公开副本", line));
    }

    if (INTERACTIVE_HTML_PROFILE.forbiddenElements.has(name)) {
      issues.push(
        issue("INTERACTIVE_FORBIDDEN_ELEMENT", `不支持 <${name}>`, line),
      );
    }

    if (name === "meta") {
      const httpEquiv = (attrs["http-equiv"] ?? "").toLowerCase();
      if (httpEquiv === "refresh" || httpEquiv === "content-security-policy") {
        issues.push(
          issue(
            "INTERACTIVE_FORBIDDEN_META",
            `<meta http-equiv="${httpEquiv}"> 不受支持`,
            line,
          ),
        );
      }
      if ((attrs.name ?? "").toLowerCase() === "referrer") {
        issues.push(
          issue(
            "INTERACTIVE_FORBIDDEN_META",
            "<meta name=referrer> 不受支持",
            line,
          ),
        );
      }
    }

    for (const attr of Object.keys(attrs)) {
      if (attr === "srcset" || attr === "imagesrcset") {
        issues.push(issue("INTERACTIVE_SRCSET", `不支持 ${attr}`, line));
      }
      if (attr === "ping" || attr === "formaction" || attr === "action") {
        issues.push(
          issue("INTERACTIVE_FORBIDDEN_ATTR", `不支持属性 ${attr}`, line),
        );
      }
      if (attr === "integrity" || attr === "nonce" || attr === "crossorigin") {
        continue;
      }
    }

    if (name === "script") {
      if (attrs.src !== undefined || attrs.href !== undefined) {
        issues.push(
          issue("INTERACTIVE_REMOTE_SCRIPT", "<script> 不能加载外部脚本", line),
        );
      }
      if (
        attrs.type !== undefined &&
        !/^(?:text\/javascript|application\/javascript|module)?$/i.test(
          attrs.type.trim(),
        )
      ) {
        issues.push(
          issue(
            "INTERACTIVE_SCRIPT_TYPE",
            `<script type="${attrs.type}"> 不受支持`,
            line,
          ),
        );
      }
      return;
    }

    if (name === "style") {
      issues.push(...checkCss(textOf(node), "<style>", line));
      return;
    }

    if (attrs.style) {
      issues.push(...checkInlineStyle(attrs.style, "style 属性", line));
    }

    // SVG image/use 的资源地址在 href（包括解析后的 xlink:href）中。
    if (attrs.href !== undefined && name !== "a" && name !== "area") {
      const found = checkDataUrl(attrs.href.trim(), "INTERACTIVE_REMOTE_RESOURCE", `<${name} href>`, line);
      if (found) issues.push(found);
    }

    for (const attr of INTERACTIVE_HTML_PROFILE.resourceAttributes) {
      if (attrs[attr] === undefined) continue;
      const value = attrs[attr].trim();
      if (name === "script") continue;
      const found = checkDataUrl(
        value,
        "INTERACTIVE_REMOTE_RESOURCE",
        `<${name} ${attr}>`,
        line,
      );
      if (found) issues.push(found);
    }

    if (
      (name === "img" || name === "source") &&
      attrs.src === undefined &&
      attrs.srcset === undefined
    ) {
      // 没有资源地址的占位元素无害，继续检查其它属性。
    }

    if (name === "a" || name === "area") {
      const href = attrs.href?.trim();
      if (href && !href.startsWith("#")) {
        let protocol = "";
        try {
          protocol = new URL(href).protocol;
        } catch {
          issues.push(
            issue(
              "INTERACTIVE_RELATIVE_LINK",
              "链接必须是 #锚点 或绝对 http(s) 地址",
              line,
            ),
          );
        }
        if (protocol && !INTERACTIVE_HTML_PROFILE.linkProtocols.has(protocol)) {
          issues.push(
            issue(
              "INTERACTIVE_LINK_PROTOCOL",
              `不支持的链接协议: ${protocol}`,
              line,
            ),
          );
        }
      }
    }

    if (name === "a" && attrs.target && attrs.target !== "_self") {
      issues.push(
        issue(
          "INTERACTIVE_LINK_TARGET",
          "链接不能使用 target=_blank 等目标",
          line,
        ),
      );
    }
  });

  return issues;
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 准备公开副本。`adapt: true` 时对已识别的作者工具做有界适配；
 * 服务端校验使用 `adapt: false`，避免把“适配”当作放行手段。
 */
export function preparePublicHtml(
  bytes: Uint8Array,
  options: { adapt: boolean },
): PrepareResult {
  const decoded = decodePublicHtmlBytes(bytes);
  if (!decoded.ok) return decoded;
  let html = normalizePublicHtml(decoded.text);
  if (!options.adapt && html !== decoded.text) {
    return { ok: false, issues: [issue("INTERACTIVE_NON_CANONICAL", "请先准备 UTF-8、无 BOM、LF 换行的公开副本；服务端不会改写上传字节")] };
  }
  const adaptations: string[] = [];
  if (options.adapt) {
    const adapted = adaptAuthorToolHtml(html);
    html = adapted.html;
    adaptations.push(...adapted.adaptations);
    if (adapted.remainingSource) {
      return {
        ok: false,
        issues: [
          issue(
            "INTERACTIVE_HIDDEN_SOURCE",
            "隐藏源文 #am-source 仍非空，无法自动准备公开副本",
          ),
        ],
      };
    }
  }
  const issues = validatePublicHtml(html);
  if (issues.length > 0) return { ok: false, issues };
  const finalBytes = Buffer.from(html, "utf8");
  return {
    ok: true,
    value: {
      html,
      byteLength: finalBytes.byteLength,
      sha256: sha256Hex(finalBytes),
      adaptations,
    },
  };
}
