import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));
vi.mock("@/lib/interactive-html/runtime", () => ({
  getInteractiveHtmlRepository: vi.fn(),
}));
vi.mock("@/lib/interactive-html/repository.postgres", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/interactive-html/repository.postgres")
  >("@/lib/interactive-html/repository.postgres");
  return {
    ...actual,
    readArticleWithDocuments: vi.fn(),
  };
});

import {
  GET,
  HEAD,
} from "@/app/api/blog/[identifier]/interactive-html/[sha]/view/route";
import {
  GET as PREVIEW_GET,
  HEAD as PREVIEW_HEAD,
} from "@/app/api/blog/[identifier]/interactive-html/[sha]/preview/route";
import { getPayloadAPI } from "@/lib/payload";
import { getInteractiveHtmlRepository } from "@/lib/interactive-html/runtime";
import { readArticleWithDocuments } from "@/lib/interactive-html/repository.postgres";
import { canonicalFence } from "@/lib/interactive-html/marker";

const HTML = "<!doctype html><html><body><p>ok</p></body></html>";
const SHA = createHash("sha256").update(HTML, "utf8").digest("hex");
const MARKDOWN = canonicalFence({
  version: 1,
  id: "demo",
  sha256: SHA,
  caption: "演示",
});

const auth = vi.fn();
const context = { params: Promise.resolve({ identifier: "42", sha: SHA }) };

function request(
  url = `https://example.com/api/blog/42/interactive-html/${SHA}/view`,
  headers: Record<string, string> = {},
) {
  return new Request(url, { headers });
}

function snapshot(
  overrides: {
    status?: string;
    visibility?: string;
    contentMarkdown?: string;
    html?: string | null;
  } = {},
) {
  const status = overrides.status ?? "published";
  const visibility = overrides.visibility ?? "public";
  const html = overrides.html === undefined ? HTML : overrides.html;
  if (html === null) return { kind: "not-found" as const };
  return {
    kind: "article" as const,
    article: {
      id: "42",
      status,
      visibility,
      contentMarkdown: overrides.contentMarkdown ?? MARKDOWN,
    },
    document: {
      sha256: SHA,
      byteLength: Buffer.byteLength(html),
      profileVersion: 1,
      html,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BLOG_INTERACTIVE_HTML_ENABLED = "true";
  auth.mockResolvedValue({ user: null });
  vi.mocked(getPayloadAPI).mockResolvedValue({ auth } as never);
  vi.mocked(getInteractiveHtmlRepository).mockReturnValue({} as never);
  vi.mocked(readArticleWithDocuments).mockResolvedValue(snapshot() as never);
});

describe("GET /view", () => {
  it("公开且被当前正文引用的资源可读取，并带完整沙箱头", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(HTML);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).not.toContain("allow-same-origin");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("HEAD 返回同样的头但不带正文", async () => {
    const response = await HEAD(request(), context);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox allow-scripts",
    );
  });

  it("草稿、私有、未引用与跨文章统一 404", async () => {
    vi.mocked(readArticleWithDocuments).mockResolvedValue(
      snapshot({ status: "draft" }) as never,
    );
    expect((await GET(request(), context)).status).toBe(404);

    vi.mocked(readArticleWithDocuments).mockResolvedValue(
      snapshot({ visibility: "private" }) as never,
    );
    expect((await GET(request(), context)).status).toBe(404);

    vi.mocked(readArticleWithDocuments).mockResolvedValue(
      snapshot({ contentMarkdown: "没有互动块" }) as never,
    );
    expect((await GET(request(), context)).status).toBe(404);

    vi.mocked(readArticleWithDocuments).mockResolvedValue(
      snapshot({ html: null }) as never,
    );
    expect((await GET(request(), context)).status).toBe(404);
  });

  it("管理员可读取私有但已发布的文章资源", async () => {
    auth.mockResolvedValue({ user: { id: 1, role: "admin" } });
    vi.mocked(readArticleWithDocuments).mockResolvedValue(
      snapshot({ visibility: "private" }) as never,
    );
    expect((await GET(request(), context)).status).toBe(200);
  });

  it("开关关闭返回 503", async () => {
    process.env.BLOG_INTERACTIVE_HTML_ENABLED = "false";
    expect((await GET(request(), context)).status).toBe(503);
  });

  it("跨站读取被拒绝", async () => {
    const response = await GET(
      request(undefined, { "sec-fetch-site": "cross-site" }),
      context,
    );
    expect(response.status).toBe(403);
  });

  it("数据库不可用返回 503", async () => {
    vi.mocked(readArticleWithDocuments).mockRejectedValue(new Error("db"));
    expect((await GET(request(), context)).status).toBe(503);
  });
});

describe("GET /preview", () => {
  const previewRequest = (headers: Record<string, string> = {}) =>
    request(
      `https://example.com/api/blog/42/interactive-html/${SHA}/preview`,
      headers,
    );

  it("匿名与非作者一律 404", async () => {
    expect((await PREVIEW_GET(previewRequest(), context)).status).toBe(404);
    auth.mockResolvedValue({ user: { id: 3, role: "viewer" } });
    expect((await PREVIEW_GET(previewRequest(), context)).status).toBe(404);
  });

  it("作者可预览草稿，仍带沙箱头", async () => {
    auth.mockResolvedValue({ user: { id: 1, role: "editor" } });
    vi.mocked(readArticleWithDocuments).mockResolvedValue(
      snapshot({ status: "draft" }) as never,
    );
    const response = await PREVIEW_GET(previewRequest(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox allow-scripts",
    );
    expect(await response.text()).toBe(HTML);
  });

  it("作者能预览已绑定但尚未保存到正文的新上传资源", async () => {
    auth.mockResolvedValue({ user: { id: 1, role: "admin" } });
    vi.mocked(readArticleWithDocuments).mockResolvedValue(
      snapshot({ status: "draft", visibility: "private", contentMarkdown: "尚未插入" }) as never,
    );
    const response = await PREVIEW_GET(previewRequest(), context);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(HTML);
  });

  it("作者预览仍拒绝不存在或未绑定目标文章的资源", async () => {
    auth.mockResolvedValue({ user: { id: 1, role: "admin" } });
    vi.mocked(readArticleWithDocuments).mockResolvedValue({ kind: "not-found" });
    expect((await PREVIEW_GET(previewRequest(), context)).status).toBe(404);
  });

  it("HEAD 无正文", async () => {
    auth.mockResolvedValue({ user: { id: 1, role: "admin" } });
    const response = await PREVIEW_HEAD(previewRequest(), context);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
