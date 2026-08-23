import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";

const { mockUseField } = vi.hoisted(() => ({ mockUseField: vi.fn() }));

vi.mock("@payloadcms/ui", () => ({
  useField: mockUseField,
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
});
