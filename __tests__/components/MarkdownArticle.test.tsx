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

  it("keeps citation occurrence IDs when the matching title H1 is hidden", () => {
    render(
      <MarkdownArticle
        title="笔记"
        markdown={"# 笔记\n开场\n## 笔记\n正文"}
      />,
    );

    expect(document.getElementById("笔记")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "笔记" }))
      .toHaveAttribute("id", "笔记-2");
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

  it("omits a leading markdown title that duplicates the page title", () => {
    const { container } = render(
      <MarkdownArticle
        title="智能座舱 Agent 记忆：Benchmark 调研综述与演进建议"
        markdown={"# 智能座舱Agent记忆_Benchmark调研综述与演进建议\n\n正文\n\n# 附录\n\n## 先定义边界"}
      />,
    );

    expect(container.querySelector("h1")).not.toBeInTheDocument();
    expect(container.querySelector("h2#附录")).toHaveTextContent("附录");
    expect(container.querySelector("h2#先定义边界")).toHaveTextContent("先定义边界");
  });

  it("wraps wide tables in a keyboard-scrollable region", () => {
    const { container } = render(
      <MarkdownArticle markdown={"| 阶段 | 核心问题 | 产出 |\n| --- | --- | --- |\n| 1 | 建立基线 | 失败样本 |"} />,
    );

    const region = container.querySelector("[role='region']");
    expect(region).toHaveAttribute("aria-label", "可横向滚动的表格");
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region?.querySelector("table")).toBeInTheDocument();
  });
});
