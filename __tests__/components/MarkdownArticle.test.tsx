import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownArticle } from "@/components/MarkdownArticle";

describe("MarkdownArticle", () => {
  it("does not repeat the CMS title when the first Markdown H1 matches it", () => {
    render(
      <MarkdownArticle
        title="Langfuse v4 海量数据接入与 UI 降级方案"
        markdown={[
          "# Langfuse v4 海量数据接入与 UI 降级方案",
          "",
          "正文内容",
          "",
          "# 后续一级标题",
        ].join("\n")}
      />,
    );

    expect(screen.queryByRole("heading", {
      name: "Langfuse v4 海量数据接入与 UI 降级方案",
    })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "后续一级标题" }))
      .toBeInTheDocument();
    expect(screen.getByText("正文内容")).toBeInTheDocument();
  });

  it("keeps the first Markdown H1 when it differs from the CMS title", () => {
    render(
      <MarkdownArticle
        title="工程手记"
        markdown={"# 背景与目标\n正文内容"}
      />,
    );

    expect(screen.getByRole("heading", { name: "背景与目标" }))
      .toBeInTheDocument();
  });

  it("renders stable IDs for Chinese and repeated headings", () => {
    render(
      <MarkdownArticle markdown={"## 中文标题\nA\n## 中文标题\nB"} />,
    );

    const headings = screen.getAllByRole("heading");
    expect(headings[0]).toHaveAttribute("id", "中文标题");
    expect(headings[1]).toHaveAttribute("id", "中文标题-2");
  });

  it("does not turn a heading-like code line into a document heading", () => {
    render(
      <MarkdownArticle markdown={"# 正文\n```md\n# 代码里的标题\n```"} />,
    );

    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByText("# 代码里的标题")).toBeInTheDocument();
  });

  it("uses rendered inline text for Setext heading IDs", () => {
    render(
      <MarkdownArticle
        markdown={"[API *网关*](https://example.com) &copy;\n===\n正文"}
      />,
    );

    expect(screen.getByRole("heading", { name: "API 网关 ©" }))
      .toHaveAttribute("id", "api-网关");
  });
});
