import { describe, expect, it } from "vitest";
import { fromMarkdown } from "mdast-util-from-markdown";
import { remarkInteractiveHtml } from "@/lib/interactive-html/ast";
import { canonicalFence } from "@/lib/interactive-html/marker";

describe("interactive HTML AST bridge", () => {
  it("projects only the first valid top-level marker using its stable element name", () => {
    const marker = {
      version: 1 as const,
      id: "stateful-demo",
      sha256: "a".repeat(64),
      caption: "可观察状态",
    };
    const fence = canonicalFence(marker);
    const quoted = fence.split("\n").map((line) => `> ${line}`).join("\n");
    const tree = fromMarkdown([fence, fence, quoted].join("\n\n"));

    remarkInteractiveHtml()(tree);

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      data: {
        hName: "interactive-html-embed-stateful-demo",
        hProperties: {
          "data-interactive-id": marker.id,
          "data-interactive-sha256": marker.sha256,
        },
      },
    });
    expect(tree.children[1].type).toBe("code");
    expect(tree.children[2]).toMatchObject({ type: "blockquote", children: [{ type: "code" }] });
  });
});
