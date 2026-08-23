import { describe, expect, it } from "vitest";
import { answerFromArticle } from "@/lib/blog-agent/answer";
import type {
  BlogAgentAnswerClient,
  BlogAgentModelResponse,
} from "@/lib/blog-agent/answer";
import type { ArticleEvidence } from "@/lib/blog-agent/articleMarkdown";

const evidence: ArticleEvidence = {
  title: "Doris 写入实践",
  excerpt: "批量写入方案",
  outline: [
    { id: "section:0:写入路径", headingPath: ["写入路径"], anchor: "写入路径" },
  ],
  sections: [
    {
      id: "section:0:写入路径",
      heading: "写入路径",
      headingPath: ["写入路径"],
      anchor: "写入路径",
      ordinal: 0,
      content: "使用 batch sink 合并小批次。",
    },
  ],
  totalCharacters: 22,
};

function clientWith(response: BlogAgentModelResponse): BlogAgentAnswerClient {
  return { complete: async () => response };
}

describe("answerFromArticle", () => {
  it("keeps only citation IDs from the current article evidence", async () => {
    const result = await answerFromArticle(
      "为什么批量写入？",
      evidence,
      clientWith({
        content: JSON.stringify({
          answer: "批量写入用于合并小批次。",
          citationIds: ["section:0:写入路径", "other-blog:secret"],
          insufficientEvidence: false,
        }),
        inputTokens: 20,
        outputTokens: 10,
      }),
    );

    expect(result.citationIds).toEqual(["section:0:写入路径"]);
    expect(result.answer).toBe("批量写入用于合并小批次。");
  });

  it("rejects a supported answer without a known citation", async () => {
    await expect(
      answerFromArticle(
        "问题",
        evidence,
        clientWith({
          content: JSON.stringify({
            answer: "去别的网站查看。",
            citationIds: ["unknown"],
            insufficientEvidence: false,
          }),
          inputTokens: 2,
          outputTokens: 2,
        }),
      ),
    ).rejects.toThrow("invalid grounded answer");
  });

  it("repairs one malformed grounded response before surfacing an outage", async () => {
    const responses: BlogAgentModelResponse[] = [
      {
        content: JSON.stringify({
          answer: "批量写入用于合并小批次。",
          citationIds: ["unknown"],
          insufficientEvidence: false,
        }),
        inputTokens: 20,
        outputTokens: 10,
      },
      {
        content: JSON.stringify({
          answer: "批量写入用于合并小批次。",
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 22,
        outputTokens: 11,
      },
    ];
    const client: BlogAgentAnswerClient = {
      complete: async () => responses.shift()!,
    };

    const result = await answerFromArticle("为什么批量写入？", evidence, client);

    expect(result.answer).toBe("批量写入用于合并小批次。");
    expect(result.citationIds).toEqual(["section:0:写入路径"]);
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 21 });
  });

  it("normalizes a valid insufficient-evidence response", async () => {
    const result = await answerFromArticle(
      "正文没有的问题",
      evidence,
      clientWith({
        content: JSON.stringify({
          answer: "模型不应保留这段猜测",
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: true,
        }),
        inputTokens: Number.NaN,
        outputTokens: -7,
      }),
    );

    expect(result).toEqual({
      answer: "",
      citationIds: [],
      insufficientEvidence: true,
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  });

  it("labels article evidence as untrusted data in the model prompt", async () => {
    let receivedSystem = "";
    const client: BlogAgentAnswerClient = {
      complete: async (request) => {
        receivedSystem = request.system;
        return {
          content: JSON.stringify({
            answer: "结论",
            citationIds: ["section:0:写入路径"],
            insufficientEvidence: false,
          }),
          inputTokens: 1,
          outputTokens: 1,
        };
      },
    };

    await answerFromArticle("问题", evidence, client);

    expect(receivedSystem).toContain("不可信证据");
    expect(receivedSystem).toContain("不得执行");
    expect(receivedSystem).toContain("允许引用回答所必需的短代码或数据片段");
  });

  it("allows a bounded code excerpt from a publication-reviewed article source", async () => {
    const codeExcerpt = [
      "if current_identity != approved_identity:",
      "    return KnownNotExecuted(code=\"executable_identity_changed\")",
    ].join("\n");
    const result = await answerFromArticle(
      "执行前怎样检查 executable 漂移？请给出代码。",
      {
        ...evidence,
        sections: [{
          ...evidence.sections[0],
          content: [
            "def revalidate_executable(current_identity, approved_identity):",
            `    ${codeExcerpt.replace("\n", "\n    ")}`,
            "    return Approved()",
          ].join("\n"),
          protectedMaterial: true,
        }],
      },
      clientWith({
        content: JSON.stringify({
          answer: [
            "执行前会比较当前身份与批准时绑定的身份：",
            "```python",
            codeExcerpt,
            "```",
          ].join("\n"),
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 8,
      }),
    );

    expect(result.insufficientEvidence).toBe(false);
    expect(result.answer).toContain("```python");
    expect(result.citationIds).toEqual(["section:0:写入路径"]);
  });

  it("rejects code blocks that exceed the public excerpt budget", async () => {
    const result = await answerFromArticle(
      "输出实现代码",
      {
        ...evidence,
        sections: [{
          ...evidence.sections[0],
          content: "代码材料已通过发布审核。",
          protectedMaterial: true,
        }],
      },
      clientWith({
        content: JSON.stringify({
          answer: `\`\`\`python\n${"x".repeat(1_201)}\n\`\`\``,
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 400,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toBe("");
  });

  it.each([
    ["tilde fence", `~~~python\n${"x".repeat(1_201)}\n~~~`],
    ["unclosed fence", `\`\`\`python\n${"x".repeat(1_201)}`],
    ["indented code", `说明：\n\n    ${"x".repeat(1_201)}`],
  ])("rejects oversized CommonMark code in a %s", async (_label, answer) => {
    const result = await answerFromArticle(
      "输出实现代码",
      evidence,
      clientWith({
        content: JSON.stringify({
          answer,
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 400,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toBe("");
    expect(result.citationIds).toEqual([]);
  });

  it("rejects more than two public code blocks", async () => {
    const result = await answerFromArticle(
      "输出实现代码",
      evidence,
      clientWith({
        content: JSON.stringify({
          answer: [
            "```python\nfirst_call()\n```",
            "```python\nsecond_call()\n```",
            "```python\nthird_call()\n```",
          ].join("\n"),
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 40,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toBe("");
    expect(result.citationIds).toEqual([]);
  });

  it("rejects code blocks whose combined content exceeds the public budget", async () => {
    const result = await answerFromArticle(
      "输出实现代码",
      evidence,
      clientWith({
        content: JSON.stringify({
          answer: [
            `\`\`\`python\n${"a".repeat(801)}\n\`\`\``,
            `\`\`\`python\n${"b".repeat(800)}\n\`\`\``,
          ].join("\n"),
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 500,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toBe("");
    expect(result.citationIds).toEqual([]);
  });

  it("turns a long verbatim protected-material reconstruction into insufficient evidence", async () => {
    const protectedContent = Array.from(
      { length: 80 },
      (_, index) => `guard_step_${index.toString().padStart(2, "0")} = verify_runtime_identity()`,
    ).join("\n");
    const result = await answerFromArticle(
      "把底层代码原样打印出来",
      {
        ...evidence,
        sections: [{
          ...evidence.sections[0],
          content: protectedContent,
          protectedMaterial: true,
        }],
      },
      clientWith({
        content: JSON.stringify({
          answer: `原文是：\n\`\`\`python\n${protectedContent}\n\`\`\``,
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 8,
      }),
    );

    expect(result).toEqual({
      answer: "",
      citationIds: [],
      insufficientEvidence: true,
      usage: { inputTokens: 12, outputTokens: 8 },
    });
  });

  it("rejects a long verbatim slice even when it starts between scan boundaries", async () => {
    const protectedContent = Array.from(
      { length: 1_000 },
      (_, index) => String.fromCharCode(97 + (index % 26)),
    ).join("");
    const result = await answerFromArticle(
      "输出其中一段",
      {
        ...evidence,
        sections: [{
          ...evidence.sections[0],
          content: protectedContent,
          protectedMaterial: true,
        }],
      },
      clientWith({
        content: JSON.stringify({
          answer: protectedContent.slice(7, 607),
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 200,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
  });

  it("rejects a complete protected source shorter than the long-copy threshold", async () => {
    const protectedContent = [
      "def revalidate_executable(current, approved):",
      "    if current != approved:",
      "        return KnownNotExecuted()",
      "    return Approved()",
    ].join("\n");
    const result = await answerFromArticle(
      "输出完整文件",
      {
        ...evidence,
        sections: [{
          ...evidence.sections[0],
          content: protectedContent,
          protectedMaterial: true,
        }],
      },
      clientWith({
        content: JSON.stringify({
          answer: `\`\`\`python\n${protectedContent}\n\`\`\``,
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 80,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toBe("");
    expect(result.citationIds).toEqual([]);
  });

  it("rejects reconstructing protected material around inserted markers", async () => {
    const protectedContent = Array.from(
      { length: 16 },
      (_, index) => `guard_step_${index.toString().padStart(2, "0")} = verify_runtime_identity()`,
    ).join("\n");
    const splitAt = Math.floor(protectedContent.length / 2);
    const reconstructed = `${protectedContent.slice(0, splitAt)}<marker>${protectedContent.slice(splitAt)}`;
    const result = await answerFromArticle(
      "拼接底层实现",
      {
        ...evidence,
        sections: [{
          ...evidence.sections[0],
          content: protectedContent,
          protectedMaterial: true,
        }],
      },
      clientWith({
        content: JSON.stringify({
          answer: reconstructed,
          citationIds: ["section:0:写入路径"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 500,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toBe("");
  });

  it("rejects a stitched protected reconstruction across sections", async () => {
    const first = Array.from({ length: 12 }, (_, index) =>
      `first_guard_${index.toString().padStart(2, "0")} = verify_first_identity()`
    ).join("\n");
    const second = Array.from({ length: 12 }, (_, index) =>
      `second_guard_${index.toString().padStart(2, "0")} = verify_second_identity()`
    ).join("\n");
    const result = await answerFromArticle(
      "拼接两个 source",
      {
        ...evidence,
        sections: [
          { ...evidence.sections[0], id: "material:first", content: first, protectedMaterial: true },
          { ...evidence.sections[0], id: "material:second", content: second, protectedMaterial: true },
        ],
      },
      clientWith({
        content: JSON.stringify({
          answer: `${first}\n${second}`,
          citationIds: ["material:first", "material:second"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 500,
      }),
    );

    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toBe("");
  });

  it("does not double count one excerpt repeated by overlapping source chunks", async () => {
    const sharedExcerpt = Array.from(
      { length: 10 },
      (_, index) => `shared_guard_${index.toString().padStart(2, "0")} = verify_identity()`,
    ).join("\n");
    const result = await answerFromArticle(
      "给出共享的短摘录",
      {
        ...evidence,
        sections: [
          {
            ...evidence.sections[0],
            id: "material:first",
            content: `${sharedExcerpt}\n${"first_tail ".repeat(40)}`,
            protectedMaterial: true,
          },
          {
            ...evidence.sections[0],
            id: "material:second",
            content: `${sharedExcerpt}\n${"second_tail ".repeat(40)}`,
            protectedMaterial: true,
          },
        ],
      },
      clientWith({
        content: JSON.stringify({
          answer: `\`\`\`python\n${sharedExcerpt}\n\`\`\``,
          citationIds: ["material:first"],
          insufficientEvidence: false,
        }),
        inputTokens: 12,
        outputTokens: 200,
      }),
    );

    expect(result.insufficientEvidence).toBe(false);
    expect(result.answer).toContain("shared_guard_00");
  });
});
