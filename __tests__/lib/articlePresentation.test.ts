// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createHighlighter } from "shiki";
import { prepareArticlePresentation } from "@/lib/articlePresentation";
import { parseMarkdown } from "@/lib/renderMarkdown";

vi.mock("shiki", async (importOriginal) => {
  const shiki = await importOriginal<typeof import("shiki")>();
  return { ...shiki, createHighlighter: vi.fn(shiki.createHighlighter) };
});

describe("article presentation", () => {
  it("shares an initialization across concurrent requests and retries initialization after a rejection", async () => {
    const initialize = vi.mocked(createHighlighter);
    const failed = new Error("grammar import unavailable");
    initialize.mockRejectedValueOnce(failed);
    const article = () => parseMarkdown("~~~sql\nSELECT 1;\n~~~");
    const results = await Promise.allSettled([
      prepareArticlePresentation(article()),
      prepareArticlePresentation(article()),
    ]);
    expect(results).toEqual([
      { status: "rejected", reason: failed },
      { status: "rejected", reason: failed },
    ]);
    expect(initialize).toHaveBeenCalledTimes(1);

    const tree = article();
    await prepareArticlePresentation(tree);
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(tree)).toContain("--shiki-light:");
  });
});
