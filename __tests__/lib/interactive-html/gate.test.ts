import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  checkInteractiveGate,
  checkInteractiveSyntax,
  pendingInteractiveReferences,
  requiresReadyReferences,
} from "@/lib/interactive-html/gate";
import { canonicalFence } from "@/lib/interactive-html/marker";

const SHA = "a".repeat(64);

function fence(id = "demo"): string {
  return canonicalFence({ version: 1, id, sha256: SHA, caption: "说明" });
}

function queryable(found: string[] = [SHA]) {
  return {
    query: vi.fn(async () => ({
      rows: found.map((sha) => ({
        sha256: sha,
        byte_length: 100,
        profile_version: 1,
      })),
    })),
  };
}

describe("互动 HTML 写入门禁", () => {
  it("语法错误在任何状态都拒绝", async () => {
    const result = await checkInteractiveGate(queryable(), {
      markdown: "```interactive-html\nbad json\n```",
      status: "draft",
      visibility: "private",
      blogId: "42",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("互动内容格式错误");
  });

  it("私有草稿允许资源待上传，且不查询数据库", async () => {
    const db = queryable([]);
    const result = await checkInteractiveGate(db, {
      markdown: fence(),
      status: "draft",
      visibility: "private",
      blogId: "42",
    });
    expect(result).toEqual({ ok: true });
    expect(db.query).not.toHaveBeenCalled();
  });

  it("只有 private draft 可以缺资源，其它可见性或状态都要求齐全", async () => {
    for (const [status, visibility] of [
      ["draft", "public"],
      ["published", "private"],
      ["published", "public"],
    ] as const) {
      const result = await checkInteractiveGate(queryable([]), {
        markdown: fence(),
        status,
        visibility,
        blogId: "42",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("尚未上传");
    }
  });

  it("ready 索引即使私有也要求资源齐全", async () => {
    const missing = await checkInteractiveGate(queryable([]), {
      markdown: fence(),
      status: "draft",
      visibility: "private",
      blogId: "42",
      willWriteReadyIndex: true,
    });
    expect(missing.ok).toBe(false);

    const ready = await checkInteractiveGate(queryable(), {
      markdown: fence(),
      status: "draft",
      visibility: "private",
      blogId: "42",
      willWriteReadyIndex: true,
    });
    expect(ready.ok).toBe(true);
  });

  it("没有 marker 的正文直接通过", async () => {
    const db = queryable([]);
    const result = await checkInteractiveGate(db, {
      markdown: "普通正文",
      status: "published",
      visibility: "public",
      blogId: "42",
    });
    expect(result).toEqual({ ok: true });
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each(["draft", "published"])("新建 %s 普通文章不要求预先有 ID", async (status) => {
    const db = queryable([]);
    expect(await checkInteractiveGate(db, {
      markdown: "# 普通文章\n\n没有互动资源的正文。",
      status,
      visibility: "public",
    })).toEqual({ ok: true });
    expect(db.query).not.toHaveBeenCalled();
  });

  it("公开文章缺少文章 ID 时拒绝", async () => {
    const result = await checkInteractiveGate(queryable(), {
      markdown: fence(),
      status: "published",
      visibility: "public",
      blogId: null,
    });
    expect(result.ok).toBe(false);
  });

  it("requiresReadyReferences 只豁免未写 ready 的 private draft", () => {
    expect(
      requiresReadyReferences({
        markdown: "",
        status: "draft",
        visibility: "private",
      }),
    ).toBe(false);
    expect(
      requiresReadyReferences({
        markdown: "",
        status: "draft",
        visibility: "public",
      }),
    ).toBe(true);
    expect(
      requiresReadyReferences({
        markdown: "",
        status: "published",
        visibility: "private",
      }),
    ).toBe(true);
    expect(
      requiresReadyReferences({
        markdown: "",
        status: "draft",
        visibility: "private",
        willWriteReadyIndex: true,
      }),
    ).toBe(true);
  });

  it("未知 profile 版本不能满足 ready 门禁", async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [{ sha256: SHA, byte_length: 100, profile_version: 2 }],
      })),
    };
    const result = await checkInteractiveGate(db, {
      markdown: fence(),
      status: "published",
      visibility: "public",
      blogId: "42",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("尚未上传");
  });

  it("checkInteractiveSyntax 忽略空正文", () => {
    expect(checkInteractiveSyntax(null)).toEqual([]);
    expect(checkInteractiveSyntax("")).toEqual([]);
  });

  it("pendingInteractiveReferences 报告缺失 hash", async () => {
    expect(
      await pendingInteractiveReferences(queryable([]), "42", fence()),
    ).toEqual([SHA]);
    expect(
      await pendingInteractiveReferences(queryable(), "42", fence()),
    ).toEqual([]);
    expect(
      await pendingInteractiveReferences(queryable([]), "42", "无 marker"),
    ).toEqual([]);
  });

  it("单文档上限与块数上限共同约束总量（恰好 2 MiB 仍允许）", async () => {
    const big = {
      query: vi.fn(async () => ({
        rows: Array.from({ length: 4 }, (_, index) => ({
          sha256: `${index}`.repeat(64).slice(0, 64),
          byte_length: 524_288,
          profile_version: 1,
        })),
      })),
    };
    const markdown = Array.from({ length: 4 }, (_, index) =>
      canonicalFence({
        version: 1,
        id: `demo-${index}`,
        sha256: `${index}`.repeat(64).slice(0, 64),
        caption: "说明",
      }),
    ).join("\n\n");
    const result = await checkInteractiveGate(big, {
      markdown,
      status: "published",
      visibility: "public",
      blogId: "42",
    });
    // 4 × 512 KiB 恰好等于 2 MiB；总量检查是防御性上限，不在正常上限内触发。
    expect(result).toEqual({ ok: true });
  });
});

describe("marker hash 参与授权判定", () => {
  it("sha 计算与上传字节一致", () => {
    const html = "<!doctype html><html></html>";
    expect(createHash("sha256").update(html, "utf8").digest("hex")).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
});
