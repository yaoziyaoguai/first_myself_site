import { describe, expect, it } from "vitest";
import {
  buildArticleEvidence,
  parseArticleMarkdown,
} from "@/lib/blog-agent/articleMarkdown";

describe("parseArticleMarkdown", () => {
  it("creates stable Chinese anchors and ignores headings inside code fences", () => {
    const parsed = parseArticleMarkdown(
      "# 总览\n正文\n```md\n# 不是标题\n```\n## 方案\n实现",
    );

    expect(parsed.sections.map((section) => section.anchor)).toEqual([
      "总览",
      "方案",
    ]);
    expect(parsed.sections.map((section) => section.headingPath)).toEqual([
      ["总览"],
      ["总览", "方案"],
    ]);
    expect(parsed.sections[0]?.content).toContain("# 不是标题");
  });

  it("suffixes repeated headings without changing document order", () => {
    const parsed = parseArticleMarkdown("## 结果\nA\n## 结果\nB");

    expect(parsed.sections.map((section) => section.anchor)).toEqual([
      "结果",
      "结果-2",
    ]);
    expect(parsed.sections.map((section) => section.ordinal)).toEqual([0, 1]);
  });

  it("keeps prose before the first heading in a top section", () => {
    const parsed = parseArticleMarkdown("开场说明\n\n## 细节\n正文");

    expect(parsed.sections[0]).toMatchObject({
      anchor: "top",
      heading: "文章开头",
      content: "开场说明",
    });
  });
});

describe("buildArticleEvidence", () => {
  it("keeps a short article in source order", () => {
    const evidence = buildArticleEvidence({
      title: "Doris 写入实践",
      excerpt: "说明批量写入设计",
      markdown: "# 背景\n旧方案\n# 批量写入\nbatch sink 与 flush interval",
      question: "为什么使用 batch sink？",
      maxCharacters: 14_000,
      maxSections: 5,
    });

    expect(evidence.sections.map((section) => section.heading)).toEqual([
      "背景",
      "批量写入",
    ]);
    expect(evidence.sections[1]?.content).toContain("batch sink");
    expect(
      evidence.sections.every((section) => section.id.startsWith("section:")),
    ).toBe(true);
  });

  it("selects relevant Chinese sections from a long article within budget", () => {
    const evidence = buildArticleEvidence({
      title: "海量数据实践",
      excerpt: "",
      markdown: [
        "# 背景\n" + "背景信息。".repeat(30),
        "# 写入\n" + "批量写入。".repeat(30),
        "# 查询延迟\n延迟从 900ms 降到 120ms。\n" + "查询优化。".repeat(20),
        "# 部署\n" + "部署说明。".repeat(30),
      ].join("\n"),
      question: "查询延迟降低到了多少？",
      maxCharacters: 140,
      maxSections: 2,
    });

    expect(evidence.totalCharacters).toBeLessThanOrEqual(140);
    expect(evidence.sections.some((section) => section.heading === "查询延迟")).toBe(
      true,
    );
    expect(evidence.sections.length).toBeLessThanOrEqual(2);
  });

  it("returns no selected section for an empty Markdown document", () => {
    const evidence = buildArticleEvidence({
      title: "空文档",
      excerpt: "",
      markdown: "   ",
      question: "有什么内容？",
    });

    expect(evidence.sections).toEqual([]);
    expect(evidence.totalCharacters).toBe(0);
  });
});
