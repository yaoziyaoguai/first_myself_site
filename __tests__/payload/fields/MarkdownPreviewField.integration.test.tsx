import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { canonicalFence } from "@/lib/interactive-html/marker";

const { mockUseField, mockUseDocumentInfo } = vi.hoisted(() => ({
  mockUseField: vi.fn(),
  mockUseDocumentInfo: vi.fn(() => ({ id: undefined as number | undefined })),
}));

vi.mock("@payloadcms/ui", () => ({
  useField: mockUseField,
  useDocumentInfo: mockUseDocumentInfo,
  FieldLabel: () => null,
  FieldDescription: () => null,
  FieldError: () => null,
}));

import { MarkdownPreviewField } from "@/payload/fields/MarkdownPreviewField";

function mockScrollGeometry(
  element: Element,
  values: { scrollHeight: number; clientHeight: number; scrollTop?: number },
) {
  let scrollTop = values.scrollTop ?? 0;
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, value: values.scrollHeight },
    clientHeight: { configurable: true, value: values.clientHeight },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    },
  });
}

describe("MarkdownPreviewField rendered anchor integration", () => {
  beforeEach(() => {
    mockUseDocumentInfo.mockReturnValue({ id: undefined });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps the rendered heading aligned in both directions after image reflow", () => {
    const content = [
      "开头",
      "",
      "![diagram](/diagram.png)",
      "",
      "## 图片后锚点",
      "",
      "结尾",
    ].join("\n");
    const headingOffset = content.indexOf("## 图片后锚点");
    mockUseField.mockReturnValue({
      value: content,
      setValue: vi.fn(),
      showError: false,
      errorMessage: undefined,
      disabled: false,
    });

    const props = {
      field: { name: "contentMarkdown", type: "textarea" },
      path: "contentMarkdown",
    } as unknown as ComponentProps<typeof MarkdownPreviewField>;
    const { container } = render(<MarkdownPreviewField {...props} />);
    const textarea = container.querySelector(
      ".mpf-textarea",
    ) as HTMLTextAreaElement;
    const preview = container.querySelector(".mpf-preview") as HTMLDivElement;
    const sourceMarkers = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".mpf-source-map [data-source-offset]",
      ),
    );
    const previewMarkers = Array.from(
      preview.querySelectorAll<HTMLElement>("[data-source-offset]"),
    );
    const image = preview.querySelector("img") as HTMLImageElement;
    let headingPreviewTop = 900;

    for (const marker of sourceMarkers) {
      const offset = Number(marker.dataset.sourceOffset);
      Object.defineProperty(marker, "offsetTop", {
        configurable: true,
        value: offset === headingOffset ? 240 : Math.min(offset * 4, 600),
      });
    }
    for (const marker of previewMarkers) {
      const offset = Number(marker.dataset.sourceOffset);
      Object.defineProperty(marker, "offsetTop", {
        configurable: true,
        get: () =>
          offset === headingOffset
            ? headingPreviewTop
            : Math.min(offset * 10, 1_800),
      });
    }
    mockScrollGeometry(textarea, {
      scrollHeight: 1_100,
      clientHeight: 500,
      scrollTop: 240,
    });
    mockScrollGeometry(preview, {
      scrollHeight: 2_300,
      clientHeight: 500,
    });

    fireEvent.scroll(textarea);
    expect(preview.scrollTop).toBe(900);

    fireEvent.scroll(preview);
    expect(textarea.scrollTop).toBe(240);

    headingPreviewTop = 1_200;
    fireEvent.load(image);

    expect(preview.scrollTop).toBe(900);
    expect(textarea.scrollTop).toBeLessThan(240);
  });

  it("keeps a running interactive wrapper mounted when prose is inserted before it", async () => {
    const sha = "a".repeat(64);
    const marker = canonicalFence({
      version: 1,
      id: "stateful-demo",
      sha256: sha,
      caption: "状态演示",
    });
    let value = `原有前言\n\n${marker}\n\n结尾`;
    const setValue = vi.fn((next: string | null) => {
      value = next ?? "";
    });
    mockUseDocumentInfo.mockReturnValue({ id: 1 });
    mockUseField.mockImplementation(() => ({
      value,
      setValue,
      showError: false,
      errorMessage: undefined,
      disabled: false,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 200 })),
    );

    const props = {
      field: { name: "contentMarkdown", type: "textarea" },
      path: "contentMarkdown",
    } as unknown as ComponentProps<typeof MarkdownPreviewField>;
    const { container, rerender } = render(<MarkdownPreviewField {...props} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "启动交互" }));
    await waitFor(() =>
      expect(container.querySelector("iframe")).not.toBeNull(),
    );

    const wrapper = container.querySelector(".interactive-html")!;
    const iframe = container.querySelector("iframe")!;
    const parent = wrapper.parentElement!;
    const removed: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) removed.push(...record.removedNodes);
    });
    observer.observe(parent, { childList: true });

    value = `新增前置段落\n\n${value}`;
    rerender(<MarkdownPreviewField {...props} />);
    observer.disconnect();

    expect(container.querySelector(".interactive-html")).toBe(wrapper);
    expect(container.querySelector("iframe")).toBe(iframe);
    expect(removed).not.toContain(wrapper);
  });
});
