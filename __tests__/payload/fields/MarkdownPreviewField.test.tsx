/**
 * MarkdownPreviewField unit tests.
 *
 * Testing strategy:
 *   - @payloadcms/ui is fully mocked. There is no <Form> provider in jsdom,
 *     so the real useField throws; we replace it with a hoisted vi.fn() each
 *     test controls via mockReturnValue(). FieldLabel/Description/Error are
 *     replaced with trivial placeholders so we only assert props we care
 *     about (label text, description text, error message + showError gate).
 *   - react-markdown v10 is pure ESM and brings a large dependency graph we
 *     don't want to exercise in a unit test. It is replaced with a div that
 *     echoes its children so we can assert "markdown was rendered" without
 *     parsing. remark-gfm is stubbed to a no-op for the same reason.
 *   - Scroll synchronisation tests mock scrollHeight / clientHeight /
 *     scrollTop via Object.defineProperty on the element instance (jsdom
 *     reports 0 for all of them otherwise, which would make the code paths
 *     under test trivially unreachable).
 *   - requestAnimationFrame is stubbed to run synchronously so the loop guard
 *     releases deterministically within one test stack frame.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------- Hoisted mocks (must appear before imports they affect) ----------

const { mockUseField } = vi.hoisted(() => ({
  mockUseField: vi.fn(),
}));

vi.mock("@payloadcms/ui", () => ({
  useField: mockUseField,
  FieldLabel: ({ label }: { label?: unknown }) => (
    <label data-testid="field-label">{String(label ?? "")}</label>
  ),
  FieldDescription: ({ description }: { description?: unknown }) => (
    <div data-testid="field-description">{String(description ?? "")}</div>
  ),
  FieldError: ({
    message,
    showError,
  }: {
    message?: string;
    showError?: boolean;
  }) =>
    showError && message ? (
      <div data-testid="field-error">{message}</div>
    ) : null,
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-rendered">{children}</div>
  ),
}));

vi.mock("remark-gfm", () => ({ default: () => ({}) }));

// Import AFTER mocks — vi.mock is hoisted by Vitest so this resolves to mocks.
import {
  MarkdownPreviewField,
  mapScrollTopByAnchors,
} from "@/payload/fields/MarkdownPreviewField";

// ---------- Helpers ----------

/**
 * Minimal props to satisfy TextareaFieldClientComponent. We intentionally cast
 * through `any`: the component only destructures { field, path, readOnly },
 * and reconstructing the full Payload ClientComponentProps surface here would
 * couple tests to internal type shape for zero test value.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function makeProps(overrides: Record<string, any> = {}): any {
  const { field: fieldOverride, ...rest } = overrides;
  return {
    field: {
      name: "contentMarkdown",
      type: "textarea",
      label: "文章内容 (Markdown)",
      required: false,
      admin: {
        description: "使用 Markdown 格式编写文章。",
      },
      ...(fieldOverride || {}),
    },
    path: "contentMarkdown",
    schemaPath: "blog.contentMarkdown",
    indexPath: "",
    permissions: {},
    readOnly: false,
    ...rest,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function defaultField(overrides: Record<string, unknown> = {}) {
  return {
    value: "",
    setValue: vi.fn(),
    showError: false,
    errorMessage: undefined,
    disabled: false,
    ...overrides,
  };
}

/**
 * Shadow scrollHeight / clientHeight / scrollTop on an element instance so
 * the production code can compute real scroll ratios. jsdom's default is 0.
 */
function mockScrollGeometry(
  el: Element,
  opts: { scrollHeight: number; clientHeight: number; scrollTop?: number },
) {
  let scrollTop = opts.scrollTop ?? 0;
  Object.defineProperty(el, "scrollHeight", {
    value: opts.scrollHeight,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", {
    value: opts.clientHeight,
    configurable: true,
  });
  Object.defineProperty(el, "scrollTop", {
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
    configurable: true,
  });
}

// ---------- Tests ----------

describe("MarkdownPreviewField", () => {
  it("keeps both panes shrinkable when preview content is wider than its track", () => {
    const styles = readFileSync(
      resolve(
        process.cwd(),
        "src/payload/fields/MarkdownPreviewField/styles.css",
      ),
      "utf8",
    );

    expect(styles).toContain(
      "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);",
    );
    expect(styles).toMatch(/\.mpf-pane\s*{[\s\S]*?min-width: 0;/);
  });

  beforeEach(() => {
    mockUseField.mockReset();
    mockUseField.mockReturnValue(defaultField());

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the field label and description", () => {
    render(<MarkdownPreviewField {...makeProps()} />);

    expect(screen.getByTestId("field-label")).toHaveTextContent(
      "文章内容 (Markdown)",
    );
    expect(screen.getByTestId("field-description")).toHaveTextContent(
      "使用 Markdown 格式编写文章。",
    );
  });

  it("calls setValue with null for empty input (preserves empty→null semantics)", () => {
    const setValue = vi.fn();
    mockUseField.mockReturnValue(defaultField({ value: "hello", setValue }));

    render(<MarkdownPreviewField {...makeProps()} />);
    const textarea = screen.getByPlaceholderText(
      "在此输入 Markdown…",
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "updated" } });
    expect(setValue).toHaveBeenLastCalledWith("updated");

    fireEvent.change(textarea, { target: { value: "" } });
    expect(setValue).toHaveBeenLastCalledWith(null);
  });

  it("disables the textarea when useField reports disabled", () => {
    mockUseField.mockReturnValue(defaultField({ disabled: true }));

    render(<MarkdownPreviewField {...makeProps()} />);
    expect(screen.getByPlaceholderText("在此输入 Markdown…")).toBeDisabled();
  });

  it("disables the textarea when props.readOnly is true", () => {
    render(<MarkdownPreviewField {...makeProps({ readOnly: true })} />);
    expect(screen.getByPlaceholderText("在此输入 Markdown…")).toBeDisabled();
  });

  it("shows the empty-preview placeholder when value is blank", () => {
    render(<MarkdownPreviewField {...makeProps()} />);

    expect(screen.getByText("（无内容预览）")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-rendered")).not.toBeInTheDocument();
  });

  it("renders Markdown output when value is non-empty", () => {
    mockUseField.mockReturnValue(defaultField({ value: "# Hello" }));

    render(<MarkdownPreviewField {...makeProps()} />);

    expect(screen.queryByText("（无内容预览）")).not.toBeInTheDocument();
    expect(screen.getByTestId("markdown-rendered")).toHaveTextContent(
      "# Hello",
    );
  });

  it("renders the error message when showError is true", () => {
    mockUseField.mockReturnValue(
      defaultField({ showError: true, errorMessage: "必填项" }),
    );

    render(<MarkdownPreviewField {...makeProps()} />);

    expect(screen.getByTestId("field-error")).toHaveTextContent("必填项");
  });

  it("scroll-driven sync: textarea onScroll maps ratio to preview.scrollTop", () => {
    mockUseField.mockReturnValue(
      defaultField({ value: "a\nb\nc\nd\ne\nf\ng\nh" }),
    );

    const { container } = render(<MarkdownPreviewField {...makeProps()} />);

    const textarea = container.querySelector(
      ".mpf-textarea",
    ) as HTMLTextAreaElement;
    const preview = container.querySelector(".mpf-preview") as HTMLDivElement;

    // Editor: scrollable range 1000-500 = 500; scrollTop 250 → ratio 0.5
    mockScrollGeometry(textarea, {
      scrollHeight: 1000,
      clientHeight: 500,
      scrollTop: 250,
    });
    // Preview: scrollable range 2000-500 = 1500; ratio 0.5 → target 750
    mockScrollGeometry(preview, {
      scrollHeight: 2000,
      clientHeight: 500,
      scrollTop: 0,
    });

    fireEvent.scroll(textarea);

    // Animation completes synchronously via stubbed rAF.
    expect(preview.scrollTop).toBeCloseTo(750, 0);
  });

  it("keeps the same Markdown block aligned when an image expands the preview", () => {
    const target = mapScrollTopByAnchors({
      sourceScrollTop: 240,
      sourceMax: 600,
      targetMax: 1_800,
      anchors: [
        { source: 0, target: 0 },
        { source: 240, target: 900 },
        { source: 600, target: 1_800 },
      ],
    });

    // 总高度比例只能得到 720；锚点映射应把图片后的同一内容块对齐到 900。
    expect(target).toBe(900);
  });

  it("syncs preview scrolling back to the editor", () => {
    mockUseField.mockReturnValue(defaultField({ value: "a\nb\nc\nd" }));
    const { container } = render(<MarkdownPreviewField {...makeProps()} />);
    const textarea = container.querySelector(
      ".mpf-textarea",
    ) as HTMLTextAreaElement;
    const preview = container.querySelector(".mpf-preview") as HTMLDivElement;

    mockScrollGeometry(textarea, {
      scrollHeight: 1_000,
      clientHeight: 500,
      scrollTop: 0,
    });
    mockScrollGeometry(preview, {
      scrollHeight: 2_000,
      clientHeight: 500,
      scrollTop: 750,
    });

    fireEvent.scroll(preview);

    expect(textarea.scrollTop).toBeCloseTo(250, 0);
  });
});
