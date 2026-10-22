import { fromMarkdown } from "mdast-util-from-markdown";

/**
 * 文章内嵌交互 HTML 的 Markdown 协议。
 *
 * 只识别顶层 fenced code node（语言恰为 interactive-html、无 fence meta）。
 * 引用块、列表、缩进代码与四反引号示例中的同名字样都不是顶层 code node，
 * 因此不会被误执行。解析器同时供前台渲染、后台预览、写入校验与 Agent
 * 投影使用，是协议的唯一权威实现。
 */

export const INTERACTIVE_HTML_LIMITS = {
  /** 单个最终 HTML 及一次原始上传 body 的上限。 */
  maxDocumentBytes: 524_288,
  /** marker JSON 的 UTF-8 字节上限。 */
  maxMarkerBytes: 4_096,
  /** 每篇文章最多引用的互动块数量。 */
  maxBlocksPerArticle: 4,
  /** 当前引用的唯一资源字节总量上限。 */
  maxReferencedBytes: 2 * 1024 * 1024,
  /** 单篇最多保存的不同版本数。 */
  maxStoredVersionsPerArticle: 64,
  /** 全表 HTML 文本总量上限。 */
  maxStoredBytesTotal: 256 * 1024 * 1024,
  /** 固定 profile 版本，随预检规则升级。 */
  profileVersion: 1,
} as const;

export const INTERACTIVE_HTML_FENCE = "interactive-html";
export const INTERACTIVE_HTML_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const LOCAL_PATH_PATTERN = /^[A-Za-z0-9._/-]+$/;
const MARKER_KEYS = [
  "version",
  "id",
  "sha256",
  "path",
  "caption",
  "summary",
] as const;

export type InteractiveHtmlMarker = {
  version: 1;
  id: string;
  sha256?: string;
  path?: string;
  caption: string;
  summary?: string;
};

export type MarkerParseResult =
  { ok: true; marker: InteractiveHtmlMarker } | { ok: false; reason: string };

export class StrictJsonError extends Error {}

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * 保留重复键信息的严格 JSON 解析。
 *
 * `JSON.parse` 会静默保留最后一个重复键，无法据此证明输入合法；这里实现
 * 一个只接受 RFC 8259 语法、并在对象出现重复键时立即失败的解析器。
 */
export function parseStrictJson(text: string): JsonValue {
  let index = 0;

  function fail(message: string): never {
    throw new StrictJsonError(`${message}（位置 ${index}）`);
  }

  function skipWhitespace(): void {
    while (index < text.length) {
      const char = text[index];
      if (char === " " || char === "\t" || char === "\n" || char === "\r") {
        index += 1;
        continue;
      }
      break;
    }
  }

  function parseValue(): JsonValue {
    skipWhitespace();
    if (index >= text.length) fail("JSON 意外结束");
    const char = text[index];
    if (char === "{") return parseObject();
    if (char === "[") return parseArray();
    if (char === '"') return parseString();
    if (char === "-" || (char >= "0" && char <= "9")) return parseNumber();
    if (text.startsWith("true", index)) {
      index += 4;
      return true;
    }
    if (text.startsWith("false", index)) {
      index += 5;
      return false;
    }
    if (text.startsWith("null", index)) {
      index += 4;
      return null;
    }
    return fail("无法识别的 JSON 值");
  }

  function parseObject(): { [key: string]: JsonValue } {
    index += 1;
    // JSON 键必须保留为自有属性，不能让 __proto__ 被解释成原型赋值。
    const result: { [key: string]: JsonValue } = Object.create(null);
    const keys = new Set<string>();
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return result;
    }
    for (;;) {
      skipWhitespace();
      if (text[index] !== '"') fail("对象键必须是字符串");
      const key = parseString();
      if (keys.has(key)) fail(`重复的对象键: ${key}`);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") fail("对象键后缺少冒号");
      index += 1;
      result[key] = parseValue();
      skipWhitespace();
      if (text[index] === ",") {
        index += 1;
        continue;
      }
      if (text[index] === "}") {
        index += 1;
        return result;
      }
      fail("对象缺少逗号或右花括号");
    }
  }

  function parseArray(): JsonValue[] {
    index += 1;
    const result: JsonValue[] = [];
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return result;
    }
    for (;;) {
      result.push(parseValue());
      skipWhitespace();
      if (text[index] === ",") {
        index += 1;
        continue;
      }
      if (text[index] === "]") {
        index += 1;
        return result;
      }
      fail("数组缺少逗号或右方括号");
    }
  }

  function parseString(): string {
    index += 1;
    let result = "";
    for (;;) {
      if (index >= text.length) fail("字符串未结束");
      const char = text[index];
      if (char === '"') {
        index += 1;
        if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(result)) {
          fail("字符串包含孤立代理项");
        }
        return result;
      }
      if (char === "\\") {
        index += 1;
        const escape = text[index];
        if (escape === undefined) fail("转义序列未结束");
        if (escape === "u") {
          const hex = text.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("无效的 \\u 转义");
          result += String.fromCharCode(Number.parseInt(hex, 16));
          index += 5;
          continue;
        }
        const simple: Record<string, string> = {
          '"': '"',
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t",
        };
        const replacement = simple[escape];
        if (replacement === undefined) fail("无效的转义字符");
        result += replacement;
        index += 1;
        continue;
      }
      if (char.charCodeAt(0) < 0x20) fail("字符串包含未转义的控制字符");
      result += char;
      index += 1;
    }
  }

  function parseNumber(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      text.slice(index),
    );
    if (!match) return fail("无效的数字");
    index += match[0].length;
    return Number(match[0]);
  }

  const value = parseValue();
  skipWhitespace();
  if (index !== text.length) fail("JSON 之后存在多余内容");
  return value;
}

function isPlainObject(
  value: JsonValue,
): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function codePointLength(value: string): number {
  return [...value].length;
}

/** 本地包内的相对路径：允许一个前导 ./，拒绝 URL、绝对路径、路径穿越与控制字符。 */
export function isSafeLocalHtmlPath(value: string): boolean {
  if (!value || value.length > 300) return false;
  if (!LOCAL_PATH_PATTERN.test(value)) return false;
  const normalized = value.startsWith("./") ? value.slice(2) : value;
  if (!normalized || normalized.startsWith("/")) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)) return false;
  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) => segment === ".." || segment === "" || segment === ".",
    )
  ) {
    return false;
  }
  return normalized.toLowerCase().endsWith(".html");
}

function validateMarkerObject(
  value: JsonValue,
  options: { allowLocalPath: boolean },
): MarkerParseResult {
  if (!isPlainObject(value))
    return { ok: false, reason: "marker 必须是 JSON 对象" };
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!(MARKER_KEYS as readonly string[]).includes(key)) {
      return { ok: false, reason: `未知字段: ${key}` };
    }
  }
  if (value.version !== 1) return { ok: false, reason: "version 必须为数字 1" };
  if (
    typeof value.id !== "string" ||
    !INTERACTIVE_HTML_ID_PATTERN.test(value.id)
  ) {
    return { ok: false, reason: "id 必须是 [a-z][a-z0-9-]{0,47}" };
  }
  const hasSha = value.sha256 !== undefined;
  const hasPath = value.path !== undefined;
  if (hasSha === hasPath) {
    return { ok: false, reason: "path 与 sha256 必须恰有一个" };
  }
  if (hasSha) {
    if (
      typeof value.sha256 !== "string" ||
      !SHA256_PATTERN.test(value.sha256)
    ) {
      return { ok: false, reason: "sha256 必须是 64 位小写十六进制" };
    }
  }
  if (hasPath) {
    if (!options.allowLocalPath) {
      return {
        ok: false,
        reason: "已保存正文只能使用 sha256，不能保存本机路径",
      };
    }
    if (typeof value.path !== "string" || !isSafeLocalHtmlPath(value.path)) {
      return { ok: false, reason: "path 必须是包内相对 HTML 路径" };
    }
  }
  if (typeof value.caption !== "string") {
    return { ok: false, reason: "caption 必须是字符串" };
  }
  const caption = value.caption.trim();
  if (codePointLength(caption) < 1 || codePointLength(caption) > 200) {
    return { ok: false, reason: "caption 必须为 1–200 个字符" };
  }
  let summary: string | undefined;
  if (value.summary !== undefined) {
    if (typeof value.summary !== "string") {
      return { ok: false, reason: "summary 必须是字符串" };
    }
    const trimmed = value.summary.trim();
    if (codePointLength(trimmed) > 1_000) {
      return { ok: false, reason: "summary 最多 1000 个字符" };
    }
    if (trimmed) summary = trimmed;
  }
  return {
    ok: true,
    marker: {
      version: 1,
      id: value.id,
      ...(hasSha ? { sha256: value.sha256 as string } : {}),
      ...(hasPath ? { path: value.path as string } : {}),
      caption,
      ...(summary ? { summary } : {}),
    },
  };
}

export function parseMarkerJson(
  json: string,
  options: { allowLocalPath: boolean; meta?: string | null },
): MarkerParseResult {
  if (options.meta) {
    return { ok: false, reason: "interactive-html fence 不接受额外 meta" };
  }
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > INTERACTIVE_HTML_LIMITS.maxMarkerBytes) {
    return { ok: false, reason: "marker JSON 超过 4096 字节" };
  }
  let value: JsonValue;
  try {
    value = parseStrictJson(json);
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof StrictJsonError
          ? error.message
          : "marker 不是合法 JSON",
    };
  }
  return validateMarkerObject(value, options);
}

/**
 * 规范 JSON：字段顺序固定为 version,id,sha256,caption,summary，紧凑、
 * 保留实际 Unicode 字符，summary 缺省时省略。
 */
export function canonicalizeMarker(marker: InteractiveHtmlMarker): string {
  if (!marker.sha256) {
    throw new Error("已保存正文的 marker 必须包含 sha256");
  }
  return JSON.stringify({
    version: 1,
    id: marker.id,
    sha256: marker.sha256,
    caption: marker.caption,
    ...(marker.summary ? { summary: marker.summary } : {}),
  });
}

export function canonicalFence(marker: InteractiveHtmlMarker): string {
  return [
    "```" + INTERACTIVE_HTML_FENCE,
    canonicalizeMarker(marker),
    "```",
  ].join("\n");
}

export type ExtractedMarker = {
  marker: InteractiveHtmlMarker;
  /** 在源 Markdown 中的 UTF-16 起始偏移。 */
  start: number;
  end: number;
};

export type MarkerExtraction = {
  markers: ExtractedMarker[];
  errors: string[];
};

/**
 * 从 Markdown 顶层 AST 提取 marker。非顶层、非该语言、带 meta 的节点
 * 都不会被当成可执行块；语言匹配但内容非法的节点会记录错误（fail closed）。
 */
export function extractInteractiveMarkers(
  markdown: string,
  options: { allowLocalPath: boolean } = { allowLocalPath: false },
): MarkerExtraction {
  const source = markdown.replace(/\r\n?/g, "\n");
  const tree = fromMarkdown(source);
  const markers: ExtractedMarker[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();

  for (const node of tree.children) {
    if (node.type !== "code" || node.lang !== INTERACTIVE_HTML_FENCE) continue;
    const parsed = parseMarkerJson(node.value, {
      allowLocalPath: options.allowLocalPath,
      meta: node.meta,
    });
    if (!parsed.ok) {
      errors.push(
        `${parsed.reason}（第 ${node.position?.start.line ?? "?"} 行）`,
      );
      continue;
    }
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) {
      errors.push(
        `marker 缺少源位置（第 ${node.position?.start.line ?? "?"} 行）`,
      );
      continue;
    }
    const previous = seen.get(parsed.marker.id);
    if (previous !== undefined) {
      errors.push(
        `互动块 id 重复: ${parsed.marker.id}（第 ${node.position?.start.line ?? "?"} 行）`,
      );
      continue;
    }
    seen.set(parsed.marker.id, markers.length);
    markers.push({ marker: parsed.marker, start, end });
  }

  if (markers.length > INTERACTIVE_HTML_LIMITS.maxBlocksPerArticle) {
    errors.push(
      `每篇文章最多 ${INTERACTIVE_HTML_LIMITS.maxBlocksPerArticle} 个互动块`,
    );
  }
  return { markers, errors };
}

/** 校验只涉及语法与引用形状；资源是否已上传由数据库校验完成。 */
export function validateMarkerSyntax(markdown: string): string[] {
  return extractInteractiveMarkers(markdown, { allowLocalPath: false }).errors;
}

export function interactiveMarkerSummary(markers: ExtractedMarker[]): {
  ids: string[];
  shas: string[];
  totalBytesHint: number;
} {
  const ids: string[] = [];
  const shas: string[] = [];
  for (const { marker } of markers) {
    ids.push(marker.id);
    if (marker.sha256) shas.push(marker.sha256);
  }
  return { ids, shas: [...new Set(shas)], totalBytesHint: shas.length };
}

/**
 * Agent / RAG 只看到互动块的可见标题与说明；HTML、JS、隐藏原文和内嵌数据
 * 一律不进入检索与证据。这里按源位置替换为一段纯文本，再交给原解析器。
 */
export function projectInteractiveHtmlForAgent(markdown: string): string {
  const source = markdown.replace(/\r\n?/g, "\n");
  const { markers } = extractInteractiveMarkers(source, {
    allowLocalPath: false,
  });
  if (markers.length === 0) return source;
  let result = "";
  let cursor = 0;
  for (const { marker, start, end } of markers) {
    result += source.slice(cursor, start);
    result += [
      `交互示例：${marker.caption}。`,
      marker.summary ? `说明：${marker.summary}。` : "",
    ].join("");
    cursor = end;
  }
  result += source.slice(cursor);
  return result;
}
