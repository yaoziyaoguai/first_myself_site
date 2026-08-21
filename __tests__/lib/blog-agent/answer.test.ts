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
  });
});
