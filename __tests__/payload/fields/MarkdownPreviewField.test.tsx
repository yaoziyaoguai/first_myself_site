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
 *   - requestAnimationFrame is stubbed to run synchronously and advance a
 *     fake performance.now() by 16ms per call, so the 80ms smooth-scroll
 *     animation completes deterministically within one test stack frame.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
import { MarkdownPreviewField } from "@/payload/fields/MarkdownPreviewField";

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
  opts: { scrollHeight: number; clientHeight: number; scrollTop?: number }
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
  let fakeNow = 0;

  beforeEach(() => {
    mockUseField.mockReset();
    mockUseField.mockReturnValue(defaultField());

    // Synchronous rAF + fake clock. Advances 16ms per frame so the 80ms
    // ease-out in scrollPreviewTo reaches p === 1 within ~5 frames — all
    // unrolled into a single synchronous call stack during a fireEvent.
    fakeNow = 0;
    vi.stubGlobal("performance", { now: () => fakeNow });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      fakeNow += 16;
      cb(fakeNow);
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
      "文章内容 (Markdown)"
    );
    expect(screen.getByTestId("field-description")).toHaveTextContent(
      "使用 Markdown 格式编写文章。"
    );
  });

  it("calls setValue with null for empty input (preserves empty→null semantics)", () => {
    const setValue = vi.fn();
    mockUseField.mockReturnValue(defaultField({ value: "hello", setValue }));

    render(<MarkdownPreviewField {...makeProps()} />);
    const textarea = screen.getByPlaceholderText(
      "在此输入 Markdown…"
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "updated" } });
    expect(setValue).toHaveBeenLastCalledWith("updated");

    fireEvent.change(textarea, { target: { value: "" } });
    expect(setValue).toHaveBeenLastCalledWith(null);
  });

  it("disables the textarea when useField reports disabled", () => {
    mockUseField.mockReturnValue(defaultField({ disabled: true }));

    render(<MarkdownPreviewField {...makeProps()} />);
    expect(
      screen.getByPlaceholderText("在此输入 Markdown…")
    ).toBeDisabled();
  });

  it("disables the textarea when props.readOnly is true", () => {
    render(<MarkdownPreviewField {...makeProps({ readOnly: true })} />);
    expect(
      screen.getByPlaceholderText("在此输入 Markdown…")
    ).toBeDisabled();
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
      "# Hello"
    );
  });

  it("renders the error message when showError is true", () => {
    mockUseField.mockReturnValue(
      defaultField({ showError: true, errorMessage: "必填项" })
    );

    render(<MarkdownPreviewField {...makeProps()} />);

    expect(screen.getByTestId("field-error")).toHaveTextContent("必填项");
  });

  it("scroll-driven sync: textarea onScroll maps ratio to preview.scrollTop", () => {
    mockUseField.mockReturnValue(
      defaultField({ value: "a\nb\nc\nd\ne\nf\ng\nh" })
    );

    const { container } = render(<MarkdownPreviewField {...makeProps()} />);

    const textarea = container.querySelector(
      ".mpf-textarea"
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

  it("cursor-driven sync: onClick with a moved caret scrolls preview to the caret line", () => {
    // 5 lines — caret inside line 2 (0-indexed 1) → ratio 1/(5-1) = 0.25
    const value = "line-one\nline-two\nline-three\nline-four\nline-five";
    mockUseField.mockReturnValue(defaultField({ value }));

    const { container } = render(<MarkdownPreviewField {...makeProps()} />);

    const textarea = container.querySelector(
      ".mpf-textarea"
    ) as HTMLTextAreaElement;
    const preview = container.querySelector(".mpf-preview") as HTMLDivElement;

    mockScrollGeometry(preview, {
      scrollHeight: 1000,
      clientHeight: 500,
      scrollTop: 0,
    });

    // Caret at position 11 → beforeCaret = "line-one\nli" → 0-indexed line 1
    textarea.value = value;
    textarea.selectionStart = 11;
    textarea.selectionEnd = 11;

    fireEvent.click(textarea);

    // previewMax = 500; ratio 0.25 → target 125
    expect(preview.scrollTop).toBeCloseTo(125, 0);
  });

  it("cursor-driven sync: onClick without caret movement does NOT re-scroll preview", () => {
    const value = "line-one\nline-two\nline-three";
    mockUseField.mockReturnValue(defaultField({ value }));

    const { container } = render(<MarkdownPreviewField {...makeProps()} />);

    const textarea = container.querySelector(
      ".mpf-textarea"
    ) as HTMLTextAreaElement;
    const preview = container.querySelector(".mpf-preview") as HTMLDivElement;

    mockScrollGeometry(preview, {
      scrollHeight: 1000,
      clientHeight: 500,
      scrollTop: 0,
    });

    // First click: caret moves from initial -1 to 10 → syncs (test above
    // verifies the math; here we only care that the sentinel below stays).
    textarea.value = value;
    textarea.selectionStart = 10;
    textarea.selectionEnd = 10;
    fireEvent.click(textarea);

    // Reset preview to a sentinel that the real sync math would never produce
    // (it computes a non-999 target), then click again WITHOUT moving the
    // caret. handleMaybeCursorMoved must early-return, leaving 999 intact.
    preview.scrollTop = 999;
    fireEvent.click(textarea);

    expect(preview.scrollTop).toBe(999);
  });

  it("cursor-driven sync: onInput updates preview scroll on typing", () => {
    const value = "l1\nl2\nl3\nl4\nl5";
    const setValue = vi.fn();
    mockUseField.mockReturnValue(defaultField({ value, setValue }));

    const { container } = render(<MarkdownPreviewField {...makeProps()} />);

    const textarea = container.querySelector(
      ".mpf-textarea"
    ) as HTMLTextAreaElement;
    const preview = container.querySelector(".mpf-preview") as HTMLDivElement;

    mockScrollGeometry(preview, {
      scrollHeight: 1000,
      clientHeight: 500,
      scrollTop: 0,
    });

    // value layout: "l1\nl2\nl3\nl4\nl5"
    //                 0 1 2 3 4 5 6 7 8 ...
    // selectionStart = 6 → beforeCaret = "l1\nl2\n" → split length 3
    // → caretLineIndex = 2 (start of line 3)
    textarea.value = value;
    textarea.selectionStart = 6;
    textarea.selectionEnd = 6;

    fireEvent.input(textarea);

    // lineCount = 5; ratio = 2/(5-1) = 0.5; previewMax = 500 → target 250
    expect(preview.scrollTop).toBeCloseTo(250, 0);
  });
});

/*
 * Deferred to a follow-up PR (noted, not stubbed):
 *
 *  - Trailing-edge behaviour of the 40ms cursor debounce. Testing this
 *    requires fake timers that coexist with fake performance.now() + fake
 *    requestAnimationFrame without racing each other. Feasible but the
 *    required timer plumbing is brittle compared to the value added —
 *    leading-edge behaviour is covered by the onClick / onInput tests above.
 *
 *  - rAF cancel-on-unmount. The real cleanup runs inside a useEffect
 *    teardown; asserting that cancelAnimationFrame was called requires
 *    capturing the rAF id from inside our stub and correlating. Low value
 *    for a unit test (no observable regression if cleanup breaks — just a
 *    warning after component unmount during an in-flight animation). Better
 *    validated in a Playwright pass alongside the other live-UI checks.
 */
