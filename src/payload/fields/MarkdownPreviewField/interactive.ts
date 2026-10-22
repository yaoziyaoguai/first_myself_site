"use client";

import {
  canonicalFence,
  extractInteractiveMarkers,
} from "@/lib/interactive-html/marker";

/**
 * 后台“插入互动内容”的共享逻辑。
 *
 * 与发布 Skill 共用同一套协议：上传已审查的公开副本 → 服务端独立复核
 * 并落库 → 在光标处插入 canonical marker。失败不改正文。
 */

export type InsertResult =
  | { ok: true; markdown: string; sha256: string; byteLength: number }
  | { ok: false; message: string };

export type UploadInput = {
  blogId: string | number;
  file: File;
  caption: string;
  summary?: string;
  /** 文章当前正文，用于生成不冲突的 id。 */
  currentMarkdown: string;
  /** 插入位置（UTF-16 偏移），默认追加到末尾。 */
  offset?: number;
};

function nextInteractiveId(markdown: string): string {
  const { markers } = extractInteractiveMarkers(markdown, {
    allowLocalPath: false,
  });
  const used = new Set(markers.map(({ marker }) => marker.id));
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `interactive-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("无法分配互动块 id");
}

function insertAt(markdown: string, offset: number, block: string): string {
  const position = Math.min(Math.max(offset, 0), markdown.length);
  const before = markdown.slice(0, position);
  const after = markdown.slice(position);
  const leading =
    before.length === 0 || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const trailing =
    after.length === 0 || after.startsWith("\n\n")
      ? ""
      : after.startsWith("\n")
        ? "\n"
        : "\n\n";
  return `${before}${leading}${block}${trailing}${after}`;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: unknown;
      issues?: unknown;
    };
    if (Array.isArray(body.issues) && body.issues.length > 0) {
      const first = body.issues[0] as { message?: unknown };
      if (typeof first?.message === "string") return first.message;
    }
    if (typeof body.error === "string") return body.error;
  } catch {
    // 非 JSON 响应走通用文案。
  }
  return `上传失败（HTTP ${response.status}）`;
}

export async function uploadAndInsert(
  input: UploadInput,
): Promise<InsertResult> {
  const caption = input.caption.trim();
  if (!caption) return { ok: false, message: "请填写互动内容说明（caption）" };
  if (caption.length > 200)
    return { ok: false, message: "说明最多 200 个字符" };
  const summary = input.summary?.trim();
  if (summary && summary.length > 1_000) {
    return { ok: false, message: "补充说明最多 1000 个字符" };
  }
  if (!input.file.name.toLowerCase().endsWith(".html")) {
    return { ok: false, message: "请选择 .html 文件" };
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const response = await fetch(
    `/api/blog/${encodeURIComponent(String(input.blogId))}/interactive-html/${sha256}`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Interactive-Request": "1",
      },
      body: bytes,
    },
  );

  if (!response.ok) return { ok: false, message: await readError(response) };
  const stored = (await response.json()) as {
    sha256?: unknown;
    byteLength?: unknown;
  };
  if (stored.sha256 !== sha256) {
    return { ok: false, message: "服务端返回的 hash 与本地不一致，请重新上传" };
  }

  const marker = {
    version: 1 as const,
    id: nextInteractiveId(input.currentMarkdown),
    sha256,
    caption,
    ...(summary ? { summary } : {}),
  };
  const block = canonicalFence(marker);
  const markdown = insertAt(
    input.currentMarkdown,
    input.offset ?? input.currentMarkdown.length,
    block,
  );
  return {
    ok: true,
    markdown,
    sha256,
    byteLength:
      typeof stored.byteLength === "number"
        ? stored.byteLength
        : bytes.byteLength,
  };
}

/**
 * 预览用的插入结果：后台预览与前台渲染共用同一个受控组件，
 * 不需要在编辑器里另写一套 iframe 逻辑。
 */
export function insertOffsetForCursor(
  textarea: HTMLTextAreaElement | null,
): number | undefined {
  if (!textarea) return undefined;
  return textarea.selectionStart ?? undefined;
}
