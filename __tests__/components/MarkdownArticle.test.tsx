import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownArticle } from "@/components/MarkdownArticle";

describe("MarkdownArticle", () => {
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
});
