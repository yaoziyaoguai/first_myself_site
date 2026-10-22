import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("@/lib/payload", () => ({ getPayloadAPI: vi.fn() }));
vi.mock("@/lib/interactive-html/runtime", () => ({
  getInteractiveHtmlRepository: vi.fn(),
}));
vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn(() => false),
}));

import {
  GET,
  PUT,
} from "@/app/api/blog/[identifier]/interactive-html/[sha]/route";
import { getPayloadAPI } from "@/lib/payload";
import { getInteractiveHtmlRepository } from "@/lib/interactive-html/runtime";
import { isRateLimited } from "@/lib/rateLimit";

const auth = vi.fn();
const put = vi.fn();
const getMetadata = vi.fn();
const getDocument = vi.fn();

const HTML = "<!doctype html><html><body><button>ok</button></body></html>";
const SHA = createHash("sha256").update(HTML, "utf8").digest("hex");
const BASE = `https://example.com/api/blog/42/interactive-html/${SHA}`;

function putRequest(
  overrides: {
    body?: string;
    headers?: Record<string, string>;
  } = {},
) {
  return new Request(BASE, {
    method: "PUT",
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-interactive-request": "1",
      origin: "https://example.com",
      "sec-fetch-site": "same-origin",
      authorization: "JWT token",
      ...overrides.headers,
    },
    body: overrides.body ?? HTML,
  });
}

const context = { params: Promise.resolve({ identifier: "42", sha: SHA }) };

function enable(enabled = true) {
  process.env.BLOG_INTERACTIVE_HTML_ENABLED = enabled ? "true" : "false";
  process.env.NEXT_PUBLIC_SERVER_URL = "https://example.com";
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isRateLimited).mockReturnValue(false);
  enable(true);
  auth.mockResolvedValue({ user: { id: 1, role: "admin" } });
  vi.mocked(getPayloadAPI).mockResolvedValue({ auth } as never);
  put.mockResolvedValue({
    status: "created",
    metadata: {
      sha256: SHA,
      byteLength: Buffer.byteLength(HTML),
      profileVersion: 1,
    },
  });
  vi.mocked(getInteractiveHtmlRepository).mockReturnValue({
    put,
    getMetadata,
    getDocument,
  } as never);
});

describe("PUT /interactive-html/[sha]", () => {
  it("接受通过预检的公开副本并返回 201", async () => {
    const response = await PUT(putRequest(), context);
    expect(response.status).toBe(201);
    expect(put).toHaveBeenCalledWith("42", SHA, HTML, 1);
    // 上传响应是 JSON 元数据，不能带可执行沙箱策略。
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(response.headers.get("content-security-policy")).not.toContain(
      "sandbox",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("重传相同字节返回 200", async () => {
    put.mockResolvedValue({
      status: "existing",
      metadata: {
        sha256: SHA,
        byteLength: Buffer.byteLength(HTML),
        profileVersion: 1,
      },
    });
    expect((await PUT(putRequest(), context)).status).toBe(200);
  });

  it("开关关闭时返回 503", async () => {
    enable(false);
    const response = await PUT(putRequest(), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "INTERACTIVE_DISABLED",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("按认证后台用户限制每分钟上传次数", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const response = await PUT(putRequest(), context);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(isRateLimited).toHaveBeenCalledWith(
      "interactive-html-upload:1",
      10,
      60_000,
    );
    expect(put).not.toHaveBeenCalled();
  });

  it("未认证 401、非管理员 403", async () => {
    auth.mockResolvedValue({ user: null });
    expect((await PUT(putRequest(), context)).status).toBe(401);
    auth.mockResolvedValue({ user: { id: 2, role: "viewer" } });
    expect((await PUT(putRequest(), context)).status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("CLI 认证不能用无效 Authorization 借 Cookie 后备通过", async () => {
    auth.mockImplementation(async ({ headers }: { headers: Headers }) => ({
      user: headers.has("cookie") ? { id: 1, role: "admin" } : null,
    }));
    const request = new Request(BASE, {
      method: "PUT",
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-interactive-request": "1",
        authorization: "JWT invalid-cli-token",
        cookie: "payload-token=browser-session",
      },
      body: HTML,
    });
    expect((await PUT(request, context)).status).toBe(401);
    expect(put).not.toHaveBeenCalled();
  });

  it("认证服务初始化失败返回有界的 503", async () => {
    vi.mocked(getPayloadAPI).mockRejectedValueOnce(new Error("initialization failed"));
    const response = await PUT(putRequest(), context);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(put).not.toHaveBeenCalled();
  });

  it("拒绝跨站与不可信 Origin", async () => {
    expect(
      (
        await PUT(
          putRequest({ headers: { origin: "https://evil.example" } }),
          context,
        )
      ).status,
    ).toBe(403);
    expect(
      (await PUT(putRequest({ headers: { origin: "null" } }), context)).status,
    ).toBe(403);
    expect(
      (
        await PUT(
          putRequest({ headers: { "sec-fetch-site": "cross-site" } }),
          context,
        )
      ).status,
    ).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("拒绝错误或非 UTF-8 Content-Type、缺少标记头与非 identity 编码", async () => {
    expect(
      (
        await PUT(
          putRequest({ headers: { "content-type": "application/json" } }),
          context,
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await PUT(
          putRequest({ headers: { "content-type": "text/html" } }),
          context,
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await PUT(
          putRequest({
            headers: { "content-type": "text/html; charset=latin1" },
          }),
          context,
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await PUT(
          putRequest({ headers: { "x-interactive-request": "0" } }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await PUT(
          putRequest({ headers: { "content-encoding": "gzip" } }),
          context,
        )
      ).status,
    ).toBe(415);
  });

  it("超限返回 413", async () => {
    const response = await PUT(
      putRequest({
        body: "a".repeat(524_289),
        headers: { "content-length": "524289" },
      }),
      context,
    );
    expect(response.status).toBe(413);
  });

  it("预检不通过返回 422 且不上传", async () => {
    const unsafe = `<!doctype html><html><body><script src="https://x.test/a.js"></script></body></html>`;
    const unsafeSha = createHash("sha256").update(unsafe, "utf8").digest("hex");
    const response = await PUT(putRequest({ body: unsafe }), {
      params: Promise.resolve({ identifier: "42", sha: unsafeSha }),
    });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("INTERACTIVE_PROFILE_REJECTED");
    expect(body.issues.map((issue: { code: string }) => issue.code)).toContain(
      "INTERACTIVE_REMOTE_SCRIPT",
    );
    expect(put).not.toHaveBeenCalled();
  });

  it("hash 不匹配返回 422", async () => {
    const response = await PUT(putRequest(), {
      params: Promise.resolve({ identifier: "42", sha: "b".repeat(64) }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "INTERACTIVE_HASH_MISMATCH",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("存储冲突与额度上限返回 409", async () => {
    put.mockResolvedValue({ status: "mismatch" });
    expect((await PUT(putRequest(), context)).status).toBe(409);
    put.mockResolvedValue({ status: "storage-limit", reason: "versions" });
    const limited = await PUT(putRequest(), context);
    expect(limited.status).toBe(409);
    expect(await limited.json()).toMatchObject({
      error: "INTERACTIVE_STORAGE_LIMIT",
    });
  });

  it("数据库不可用返回 503", async () => {
    put.mockRejectedValue(new Error("db down"));
    expect((await PUT(putRequest(), context)).status).toBe(503);
  });

  it("非法文章 id 或 hash 返回 400", async () => {
    expect(
      (
        await PUT(putRequest(), {
          params: Promise.resolve({ identifier: "0", sha: SHA }),
        })
      ).status,
    ).toBe(400);
    expect((await PUT(putRequest(), {
      params: Promise.resolve({ identifier: "2147483648", sha: SHA }),
    })).status).toBe(400);
    expect(
      (
        await PUT(putRequest(), {
          params: Promise.resolve({ identifier: "42", sha: "x" }),
        })
      ).status,
    ).toBe(400);
  });
});

describe("GET /interactive-html/[sha]", () => {
  const get = (query = "") =>
    new Request(`${BASE}${query}`, { headers: { authorization: "JWT token" } });

  it("返回元数据，source=1 时返回正文", async () => {
    getMetadata.mockResolvedValue({
      sha256: SHA,
      byteLength: 10,
      profileVersion: 1,
    });
    getDocument.mockResolvedValue({
      sha256: SHA,
      byteLength: 10,
      profileVersion: 1,
      html: HTML,
    });

    const meta = await GET(get(), context);
    expect(meta.status).toBe(200);
    expect(await meta.json()).toMatchObject({ sha256: SHA });

    const source = await GET(get("?source=1"), context);
    expect(await source.json()).toMatchObject({ html: HTML });
  });

  it("只接受 source=1，其余查询参数 400", async () => {
    expect((await GET(get("?source=2"), context)).status).toBe(400);
    expect((await GET(get("?other=1"), context)).status).toBe(400);
  });

  it("未认证 401", async () => {
    auth.mockResolvedValue({ user: null });
    expect((await GET(get(), context)).status).toBe(401);
  });

  it("不存在返回 404", async () => {
    getMetadata.mockResolvedValue(null);
    expect((await GET(get(), context)).status).toBe(404);
  });
});
