import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ArticlePackageValidationError,
  buildArticlePackageChunks,
  validateArticlePackagePayload,
} from "@/lib/blog-agent/articlePackage";

const VALID_PAYLOAD = {
  version: 1,
  packageHash: "a217e0d45262e2832249ff7cd7de7972f2d818ebd8fc1616fdcf6a7b0275a492",
  sourceCommit: "a".repeat(40),
  mainSha256: "da1a7634bf82fdcd88624385c313a9496a2b43f469ec545693d6199c03989c2f",
  manifestPath: "docs/agent-loop.agent.json",
  sources: [{
    path: "src/loop.py",
    kind: "code",
    label: "Agent 主循环",
    sectionAnchor: "核心实现",
    sha256: "08a01a1cf8ff85e271bbdfa903feebc565b8c2546c2e49d77b817e73dfc1999a",
    content: "while step < 3:\n    step += 1",
  }],
  excluded: [],
  canaryQuestion: "主循环如何限制步数？",
} as const;

describe("article package validation", () => {
  it("accepts a canonical immutable snapshot with a hand-checked package hash", () => {
    const result = validateArticlePackagePayload(VALID_PAYLOAD, {
      markdown: "主要内容",
    });

    expect(result.packageHash).toBe("a217e0d45262e2832249ff7cd7de7972f2d818ebd8fc1616fdcf6a7b0275a492");
    expect(result.sources[0]).toMatchObject({ path: "src/loop.py", kind: "code" });
    expect(JSON.stringify(result.manifest)).not.toContain("while step");
  });

  it.each([
    ["wrong main hash", { mainSha256: "b".repeat(64) }],
    ["wrong source hash", { sources: [{ ...VALID_PAYLOAD.sources[0], sha256: "b".repeat(64) }] }],
    ["wrong package hash", { packageHash: "b".repeat(64) }],
    ["absolute path", { sources: [{ ...VALID_PAYLOAD.sources[0], path: "/etc/passwd" }] }],
    ["path escape", { sources: [{ ...VALID_PAYLOAD.sources[0], path: "../secret" }] }],
    ["unknown kind", { sources: [{ ...VALID_PAYLOAD.sources[0], kind: "secret" }] }],
    ["secret content", { sources: [{ ...VALID_PAYLOAD.sources[0], content: "api_key = 'sk-secret-value'" }] }],
  ])("rejects %s", (_name, patch) => {
    const payload = { ...VALID_PAYLOAD, ...patch };
    expect(() => validateArticlePackagePayload(payload, { markdown: "主要内容" }))
      .toThrow(ArticlePackageValidationError);
  });

  it("rejects a bare provider key before accepting the snapshot", () => {
    const content = "accidentally copied sk-1234567890abcdef";
    const payload = {
      ...VALID_PAYLOAD,
      sources: [{
        ...VALID_PAYLOAD.sources[0],
        content,
        sha256: createHash("sha256").update(content).digest("hex"),
      }],
    };

    expect(() => validateArticlePackagePayload(payload, { markdown: "主要内容" }))
      .toThrow("敏感信息");
  });

  it("enforces source count, per-file bytes, and total bytes independently", () => {
    const source = VALID_PAYLOAD.sources[0];
    expect(() => validateArticlePackagePayload({
      ...VALID_PAYLOAD,
      sources: Array.from({ length: 11 }, (_, index) => ({
        ...source,
        path: `src/${index}.py`,
      })),
    }, { markdown: "主要内容" })).toThrow("最多包含 10 个");

    expect(() => validateArticlePackagePayload({
      ...VALID_PAYLOAD,
      sources: [{ ...source, content: "中".repeat(7_000) }],
    }, { markdown: "主要内容" })).toThrow("20 KiB");

    expect(() => validateArticlePackagePayload({
      ...VALID_PAYLOAD,
      sources: Array.from({ length: 7 }, (_, index) => ({
        ...source,
        path: `src/${index}.py`,
        sha256: "2e993110d1106fdfd39892315f3c6014c160b81ff6e7bdcecc666c82022c3690",
        content: "x".repeat(18 * 1024),
      })),
    }, { markdown: "主要内容" })).toThrow("120 KiB");
  });
});

describe("article package chunking", () => {
  it("creates stable article and material chunks with bounded content", () => {
    const validated = validateArticlePackagePayload(VALID_PAYLOAD, {
      markdown: "主要内容",
    });
    const chunks = buildArticlePackageChunks({
      title: "Agent Loop",
      markdown: "# 核心实现\n" + "段落内容。".repeat(500),
      package: validated,
    });

    expect(chunks[0]).toMatchObject({
      sourceKind: "article",
      sourcePath: "article.md",
      heading: "核心实现",
      anchor: "核心实现",
      ordinal: 0,
    });
    expect(chunks.some((chunk) =>
      chunk.sourceKind === "code" && chunk.sourcePath === "src/loop.py"
    )).toBe(true);
    expect(chunks.every((chunk) => chunk.content.length <= 1_700)).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
  });

  it("rejects a material citation anchor that is absent from the article", () => {
    const validated = validateArticlePackagePayload(VALID_PAYLOAD, {
      markdown: "主要内容",
    });

    expect(() => buildArticlePackageChunks({
      title: "Agent Loop",
      markdown: "主要内容",
      package: validated,
    })).toThrow("sectionAnchor 不存在于文章");
  });
});
