import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeAgentMarkdown } from "@/components/blog-agent/SafeAgentMarkdown";

describe("SafeAgentMarkdown", () => {
  it("renders useful Markdown without links, media, or raw HTML", () => {
    render(
      <SafeAgentMarkdown
        content={[
          "**结论**",
          "",
          "```ts",
          "const ok = true",
          "```",
          "<img src=x onerror=alert(1)>",
          "[外站](https://evil.example)",
        ].join("\n")}
      />,
    );

    expect(screen.getByText("结论")).toBeInTheDocument();
    expect(screen.getByText("const ok = true")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector('a[href="https://evil.example"]')).toBeNull();
  });
});
