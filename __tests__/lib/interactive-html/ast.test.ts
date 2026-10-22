import { describe, expect, it } from "vitest";
import {
  interactiveEmbedTagName,
  remarkInteractiveHtml,
} from "@/lib/interactive-html/ast";

const SHA = "a".repeat(64);

describe("interactive HTML AST bridge", () => {
  it("assigns an explicit id-based React key to the root interactive child", () => {
    const marker = {
      version: 1 as const,
      id: "stateful-demo",
      sha256: SHA,
      caption: "可观察状态",
    };
    const tree = {
      children: [
        {
          type: "code",
          lang: "interactive-html",
          value: "{}",
          position: {
            start: { offset: 42, line: 3 },
            end: { offset: 99, line: 5 },
          },
        },
      ],
    };

    const transform = remarkInteractiveHtml({
      markers: new Map([[42, marker]]),
      source: " ".repeat(42) + "```interactive-html\n{}\n```",
    });
    transform(tree);

    expect(tree.children[0]).toMatchObject({
      type: "paragraph",
      data: {
        hName: interactiveEmbedTagName(marker.id),
        hProperties: {
          key: `interactive:${marker.id}`,
          "data-interactive-id": marker.id,
          "data-interactive-sha256": SHA,
        },
      },
    });
  });
});
