import { Blob } from "node:buffer";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MarkdownArticle } from "@/components/MarkdownArticle";

async function renderArticle(markdown: string, title?: string) {
  return render(await MarkdownArticle({ markdown, title }));
}

describe("MarkdownArticle", () => {
  beforeAll(() => vi.stubGlobal("Blob", Blob));
  afterAll(() => vi.unstubAllGlobals());
  it("does not repeat the CMS title when the first Markdown H1 matches it", async () => {
    const title = "Langfuse v4 海量数据接入与 UI 降级方案";
    await renderArticle(`# ${title}\n\n正文内容\n\n# 后续一级标题`, title);

    expect(screen.queryByRole("heading", { name: title })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "后续一级标题" })).toBeInTheDocument();
    expect(screen.getByText("正文内容")).toBeInTheDocument();
  });

  it("keeps the first Markdown H1 when it differs from the CMS title", async () => {
    await renderArticle("# 背景与目标\n正文内容", "工程手记");

    expect(screen.getByRole("heading", { name: "背景与目标" })).toBeInTheDocument();
  });

  it("renders stable IDs for Chinese and repeated headings", async () => {
    await renderArticle("## 中文标题\nA\n## 中文标题\nB");

    const headings = screen.getAllByRole("heading");
    expect(headings[0]).toHaveAttribute("id", "中文标题");
    expect(headings[1]).toHaveAttribute("id", "中文标题-2");
  });

  it("keeps citation occurrence IDs when the matching title H1 is hidden", async () => {
    await renderArticle("# 笔记\n开场\n## 笔记\n正文", "笔记");

    expect(document.getElementById("笔记")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "笔记" })).toHaveAttribute("id", "笔记-2");
  });

  it("does not turn a heading-like code line into a document heading", async () => {
    await renderArticle("# 正文\n```md\n# 代码里的标题\n```");

    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "可横向滚动的代码" })).toHaveTextContent("# 代码里的标题");
  });

  it("uses rendered inline text for Setext heading IDs", async () => {
    await renderArticle("[API *网关*](https://example.com) &copy;\n===\n正文");

    expect(screen.getByRole("heading", { name: "API 网关 ©" })).toHaveAttribute("id", "api-网关");
  });

  it("omits a leading markdown title that duplicates the page title", async () => {
    const { container } = await renderArticle(
      "# 智能座舱Agent记忆_Benchmark调研综述与演进建议\n\n正文\n\n# 附录\n\n## 先定义边界",
      "智能座舱 Agent 记忆：Benchmark 调研综述与演进建议",
    );

    expect(container.querySelector("h1")).not.toBeInTheDocument();
    expect(container.querySelector("h2#附录")).toHaveTextContent("附录");
    expect(container.querySelector("h2#先定义边界")).toHaveTextContent("先定义边界");
  });

  it("wraps tables in a keyboard-scrollable region", async () => {
    const { container } = await renderArticle("| 阶段 | 核心问题 | 产出 |\n| --- | --- | --- |\n| 1 | 建立基线 | 失败样本 |");

    const region = container.querySelector("[role='region']");
    expect(region).toHaveAttribute("aria-label", "可横向滚动的表格");
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region?.querySelector("table")).toBeInTheDocument();
  });

  it("makes code scrollable by keyboard and headings focusable as link targets", async () => {
    await renderArticle("## 实现\n```python\nprint('verified')\n```");

    expect(screen.getByRole("region", { name: "可横向滚动的代码" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("heading", { name: "实现" })).toHaveAttribute("tabindex", "-1");
  });

  it("keeps heading IDs stable when rendering edited Markdown", async () => {
    const markdown = "# 笔记\n\n## 实现\n正文\n## 实现\n细节";
    const { rerender } = await renderArticle(markdown, "笔记");
    for (const suffix of ["", "一处修改", "两处修改", "第三处修改"]) {
      rerender(await MarkdownArticle({ title: "笔记", markdown: `${markdown}\n\n${suffix}` }));
      expect(screen.queryByRole("heading", { name: "笔记" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("heading", { name: "实现" }).map((node) => node.id)).toEqual(["实现", "实现-2"]);
    }
  });

  it("renders dual-theme tokens and keeps browser-default priority for the eager first image", async () => {
    const { container } = await renderArticle(
      "~~~sql\nSELECT 1;\n~~~\n\n![查询](https://example.com/a.png)\n\n图 1：查询计划\n\n![明细](https://example.com/b.png)",
    );

    const code = container.querySelector(".shiki-code");
    const token = code?.querySelector("[style]");
    expect(token).toHaveTextContent("SELECT");
    expect(token).toHaveAttribute("style", expect.stringContaining("--shiki-light:"));
    expect(token).toHaveAttribute("style", expect.stringContaining("--shiki-dark:"));
    expect(code?.textContent).toBe("SELECT 1;\n");
    expect(screen.getByRole("button", { name: "复制代码" })).toBeEnabled();
    expect(container.querySelector("figcaption")).toHaveTextContent("图 1：查询计划");
    expect(screen.getByAltText("查询")).toHaveAttribute("loading", "eager");
    expect(screen.getByAltText("查询")).toHaveAttribute("decoding", "async");
    expect(screen.getByAltText("查询")).not.toHaveAttribute("fetchpriority");
    expect(screen.getByAltText("明细")).toHaveAttribute("loading", "lazy");
  });
});
